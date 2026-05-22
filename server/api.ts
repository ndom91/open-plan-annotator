import { serializeAnnotations } from "./feedback.ts";
import type { Annotation, ServerState } from "./types.ts";

export function createRouter(state: ServerState) {
  return async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/api/plan" && req.method === "GET") {
      return Response.json({
        plan: state.planContent,
        version: state.planVersion,
        appVersion: state.updateInfo?.currentVersion ?? null,
        history: state.planHistory,
        preferences: state.preferences,
        updateInfo: state.updateInfo,
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
        state.resolveDecision({ approved: false, feedback, annotations: body.annotations });
        state.resolveDecision = null;
      }
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/update-info" && req.method === "GET") {
      return Response.json(state.updateInfo);
    }

    // Asset-looking paths (anything with a file extension other than .html)
    // are not bundled into the single-file binary. Return 404 instead of
    // serving HTML — otherwise browsers try to parse the SPA shell as an
    // SVG/ICO/JSON/manifest and silently drop the resource.
    if (/\.[a-z0-9]+$/i.test(url.pathname) && !url.pathname.endsWith(".html")) {
      return new Response("Not Found", { status: 404 });
    }

    // Serve the single-file React app for everything else
    return new Response(state.htmlContent, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  };
}
