const FALLBACK_HTML =
  "<!DOCTYPE html><html><body><h1>open-plan-annotator</h1><p>UI not built yet. Run <code>bun run build:ui</code> first.</p></body></html>";

export async function loadHtmlContent(embeddedHtml: unknown): Promise<string> {
  if (typeof embeddedHtml === "string") {
    return embeddedHtml;
  }

  try {
    return await Bun.file(new URL("../../build/index.html", import.meta.url).pathname).text();
  } catch {
    return FALLBACK_HTML;
  }
}
