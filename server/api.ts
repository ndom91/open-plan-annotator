import type { Annotation, ServerState } from "./types.ts";

export function createRouter(state: ServerState) {
  return async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/api/plan" && req.method === "GET") {
      return Response.json({
        plan: state.planContent,
        version: state.planVersion,
        history: state.planHistory,
        preferences: state.preferences,
      });
    }

    if (url.pathname === "/api/settings" && req.method === "POST") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const autoCloseOnSubmit = (body as { autoCloseOnSubmit?: unknown })?.autoCloseOnSubmit;
      if (typeof autoCloseOnSubmit !== "boolean") {
        return Response.json({ error: "autoCloseOnSubmit must be a boolean" }, { status: 400 });
      }

      const updatedPreferences = {
        ...state.preferences,
        autoCloseOnSubmit,
      };

      try {
        await state.persistPreferences(updatedPreferences);
      } catch {
        return Response.json({ error: "Failed to persist settings" }, { status: 500 });
      }

      state.preferences = updatedPreferences;
      return Response.json({ ok: true, preferences: state.preferences });
    }

    if (url.pathname === "/api/approve" && req.method === "POST") {
      if (state.resolveDecision) {
        state.resolveDecision({ approved: true });
        state.resolveDecision = null;
      }
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/deny" && req.method === "POST") {
      const body = (await req.json()) as { annotations: Annotation[] };
      const feedback = serializeAnnotations(body.annotations);
      if (state.resolveDecision) {
        state.resolveDecision({ approved: false, feedback });
        state.resolveDecision = null;
      }
      return Response.json({ ok: true });
    }

    // Serve the single-file React app for everything else
    return new Response(state.htmlContent, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  };
}

function serializeAnnotations(annotations: Annotation[]): string {
  if (annotations.length === 0) return "Plan changes requested.";

  const lines: string[] = [
    "## Plan Review Feedback",
    "",
    "The following changes were requested before proceeding:",
    "",
  ];

  const deletions = annotations.filter((a) => a.type === "deletion");
  const replacements = annotations.filter((a) => a.type === "replacement");
  const insertions = annotations.filter((a) => a.type === "insertion");
  const comments = annotations.filter((a) => a.type === "comment");

  if (deletions.length > 0) {
    lines.push("### Requested Deletions", "");
    for (const d of deletions) {
      lines.push(`- Remove: ~~${d.text}~~`);
    }
    lines.push("");
  }

  if (replacements.length > 0) {
    lines.push("### Requested Replacements", "");
    for (const r of replacements) {
      lines.push(`- Replace "${r.text}" with "${r.replacement}"`);
    }
    lines.push("");
  }

  if (insertions.length > 0) {
    lines.push("### Requested Insertions", "");
    for (const ins of insertions) {
      lines.push(`- After "${ins.text}", insert: "${ins.replacement}"`);
    }
    lines.push("");
  }

  if (comments.length > 0) {
    lines.push("### Comments", "");
    for (const c of comments) {
      lines.push(`- On "${c.text}": ${c.comment}`);
    }
    lines.push("");
  }

  lines.push("Please revise the plan to address this feedback and present it again.");
  return lines.join("\n");
}
