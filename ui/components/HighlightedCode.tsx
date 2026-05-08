import { useEffect, useState } from "react";
import type { HighlighterCore } from "shiki/core";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

/**
 * Language grammars loaded on demand. Only languages listed here are bundled by
 * Vite — keeping this list small is what keeps the compiled binary slim.
 */
const LANG_IMPORTS: Record<string, () => Promise<unknown>> = {
  typescript: () => import("shiki/langs/typescript"),
  javascript: () => import("shiki/langs/javascript"),
  json: () => import("shiki/langs/json"),
  html: () => import("shiki/langs/html"),
  css: () => import("shiki/langs/css"),
  python: () => import("shiki/langs/python"),
  bash: () => import("shiki/langs/bash"),
  shell: () => import("shiki/langs/shell"),
  yaml: () => import("shiki/langs/yaml"),
  yml: () => import("shiki/langs/yaml"),
  markdown: () => import("shiki/langs/markdown"),
  md: () => import("shiki/langs/markdown"),
  go: () => import("shiki/langs/go"),
  rust: () => import("shiki/langs/rust"),
  sql: () => import("shiki/langs/sql"),
  graphql: () => import("shiki/langs/graphql"),
  diff: () => import("shiki/langs/diff"),
  toml: () => import("shiki/langs/toml"),
  tsx: () => import("shiki/langs/tsx"),
  jsx: () => import("shiki/langs/jsx"),
  ruby: () => import("shiki/langs/ruby"),
  java: () => import("shiki/langs/java"),
  swift: () => import("shiki/langs/swift"),
  kotlin: () => import("shiki/langs/kotlin"),
  c: () => import("shiki/langs/c"),
  cpp: () => import("shiki/langs/cpp"),
  csharp: () => import("shiki/langs/csharp"),
  php: () => import("shiki/langs/php"),
  dockerfile: () => import("shiki/langs/dockerfile"),
  docker: () => import("shiki/langs/dockerfile"),
};

let highlighterPromise: Promise<HighlighterCore> | null = null;

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [import("shiki/themes/github-dark-default")],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

interface HighlightedCodeProps {
  code: string;
  lang?: string;
}

export function HighlightedCode({ code, lang }: HighlightedCodeProps) {
  const [html, setHtml] = useState<string | null>(null);
  const theme = "github-dark-default";

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const highlighter = await getHighlighter();
      if (cancelled) return;

      if (!lang) {
        setHtml(null);
        return;
      }

      const loadedLangs = highlighter.getLoadedLanguages();
      if (!loadedLangs.includes(lang)) {
        const loader = LANG_IMPORTS[lang];
        if (!loader) {
          setHtml(null);
          return;
        }
        try {
          const grammar = await loader();
          await highlighter.loadLanguage(grammar as Parameters<typeof highlighter.loadLanguage>[0]);
        } catch {
          setHtml(null);
          return;
        }
      }

      if (cancelled) return;

      const result = highlighter.codeToHtml(code, { lang, theme });
      setHtml(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (!html) {
    return (
      <pre className="p-4 overflow-x-auto font-mono text-[13px] leading-relaxed text-[#e6edf3]">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="shiki-wrapper overflow-x-auto [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-[13px] [&_pre]:leading-relaxed [&_pre]:!bg-transparent [&_code]:!bg-transparent"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki generates HTML from code strings, not user-submitted content
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
