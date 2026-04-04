import { useEffect, useState } from "react";
import { type BundledLanguage, createHighlighter, type Highlighter } from "shiki/bundle/web";

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark-default"],
      langs: [],
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
        try {
          await highlighter.loadLanguage(lang as BundledLanguage);
        } catch {
          setHtml(null);
          return;
        }
      }

      if (cancelled) return;

      const result = highlighter.codeToHtml(code, {
        lang: lang as BundledLanguage,
        theme: "github-dark-default",
      });
      setHtml(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (!html) {
    return (
      <pre className="p-4 overflow-x-auto font-mono text-[13px] leading-relaxed text-ink-secondary">
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
