import type { Annotation, ServerState } from "./types.ts";

export function createRouter(state: ServerState) {
  return async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/api/plan" && req.method === "GET") {
      return Response.json({
        plan: state.planContent,
        version: state.planVersion,
        history: state.planHistory,
      });
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
        state.resolveDecision({ approved: false, feedback, annotations: body.annotations });
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

/**
 * Apply annotations to the original plan text, producing a modified version.
 * Annotations reference blocks by index and character offsets within block content.
 */
export function applyAnnotations(planContent: string, annotations: Annotation[]): string {
  // Split plan into blocks (same logic as the UI markdown parser: split on double newlines)
  const rawBlocks = planContent.split(/\n\n+/);

  // Group annotations by block index, sorted by startOffset descending
  // (apply from end to start so offsets stay valid)
  const byBlock = new Map<number, Annotation[]>();
  for (const ann of annotations) {
    const list = byBlock.get(ann.blockIndex) ?? [];
    list.push(ann);
    byBlock.set(ann.blockIndex, list);
  }

  const modifiedBlocks = rawBlocks.map((block, index) => {
    const blockAnnotations = byBlock.get(index);
    if (!blockAnnotations) return block;

    // Sort descending by startOffset so we can splice from the end
    const sorted = [...blockAnnotations].sort((a, b) => b.startOffset - a.startOffset);

    let result = block;
    for (const ann of sorted) {
      const before = result.slice(0, ann.startOffset);
      const after = result.slice(ann.endOffset);

      switch (ann.type) {
        case "deletion":
          result = before + after;
          break;
        case "replacement":
          result = before + (ann.replacement ?? "") + after;
          break;
        case "insertion":
          // Insert after the selected text
          result = before + result.slice(ann.startOffset, ann.endOffset) + (ann.replacement ?? "") + after;
          break;
        case "comment":
          // Comments don't modify the text
          break;
      }
    }

    return result;
  });

  // Filter out blocks that became empty after deletions
  return modifiedBlocks.filter((b) => b.trim().length > 0).join("\n\n");
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
