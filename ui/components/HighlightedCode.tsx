import { memo, useEffect, useMemo, useState } from "react";
import type { HighlighterCore } from "shiki/core";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { Annotation } from "../utils/annotationSerializer.ts";

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
  annotations?: Annotation[];
  allAnnotations?: Annotation[];
}

const ANN_TYPE_CLASS: Record<Annotation["type"], string> = {
  deletion: "annotation-mark bg-redline-bg text-redline line-through decoration-redline/80 decoration-2",
  replacement: "annotation-mark bg-redline-bg text-redline line-through decoration-redline/75 decoration-2",
  insertion: "annotation-mark bg-approve-bg text-approve",
  comment: "annotation-mark bg-margin-note-bg border-b-2 border-margin-note/70",
};

const ANN_INDEX_CLASS: Record<Annotation["type"], string> = {
  deletion: "annotation-index annotation-index--delete",
  replacement: "annotation-index annotation-index--replace",
  insertion: "annotation-index annotation-index--insert",
  comment: "annotation-index annotation-index--comment",
};

export const HighlightedCode = memo(HighlightedCodeImpl);

function HighlightedCodeImpl({ code, lang, annotations = [], allAnnotations = [] }: HighlightedCodeProps) {
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

      const result = highlighter.codeToHtml(code, { lang, theme }).replace(/\stabindex="0"/g, "");
      setHtml(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  const annotatedHtml = useMemo(() => {
    if (!html) return null;
    if (annotations.length === 0) return html;
    return overlayAnnotations(html, annotations, allAnnotations);
  }, [html, annotations, allAnnotations]);

  if (!annotatedHtml) {
    return (
      <pre className="p-4 overflow-x-auto font-mono text-[13px] leading-relaxed text-code-ink">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="shiki-wrapper overflow-x-auto [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-[13px] [&_pre]:leading-relaxed [&_pre]:!bg-transparent [&_code]:!bg-transparent"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki generates HTML from code strings, not user-submitted content
      dangerouslySetInnerHTML={{ __html: annotatedHtml }}
    />
  );
}

function overlayAnnotations(html: string, annotations: Annotation[], allAnnotations: Annotation[]): string {
  if (typeof window === "undefined") return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return html;

  const sorted = [...annotations].sort((a, b) => a.startOffset - b.startOffset);
  for (const ann of sorted) {
    applyAnnotationToTree(root, ann, allAnnotations);
  }
  return root.innerHTML;
}

function applyAnnotationToTree(root: HTMLElement, ann: Annotation, allAnnotations: Annotation[]): void {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node = walker.nextNode() as Text | null;
  while (node) {
    textNodes.push(node);
    node = walker.nextNode() as Text | null;
  }

  let cursor = 0;
  let lastWrapped: HTMLElement | null = null;
  for (const tn of textNodes) {
    const text = tn.nodeValue ?? "";
    const nodeStart = cursor;
    const nodeEnd = cursor + text.length;
    cursor = nodeEnd;

    if (nodeEnd <= ann.startOffset) continue;
    if (nodeStart >= ann.endOffset) break;

    const localStart = Math.max(0, ann.startOffset - nodeStart);
    const localEnd = Math.min(text.length, ann.endOffset - nodeStart);
    if (localStart >= localEnd) continue;

    lastWrapped = wrapTextSlice(tn, localStart, localEnd, ANN_TYPE_CLASS[ann.type]);
  }

  if (!lastWrapped) return;

  const indexNode = root.ownerDocument.createElement("sup");
  indexNode.className = ANN_INDEX_CLASS[ann.type];
  const idx = allAnnotations.findIndex((a) => a.id === ann.id);
  indexNode.textContent = String(idx >= 0 ? idx + 1 : 0);
  lastWrapped.parentNode?.insertBefore(indexNode, lastWrapped.nextSibling);
}

function wrapTextSlice(textNode: Text, start: number, end: number, className: string): HTMLElement {
  const text = textNode.nodeValue ?? "";
  const before = text.slice(0, start);
  const middle = text.slice(start, end);
  const after = text.slice(end);

  const wrap = textNode.ownerDocument.createElement("span");
  wrap.className = className;
  wrap.textContent = middle;

  const parent = textNode.parentNode;
  if (!parent) return wrap;

  if (before) parent.insertBefore(textNode.ownerDocument.createTextNode(before), textNode);
  parent.insertBefore(wrap, textNode);
  if (after) parent.insertBefore(textNode.ownerDocument.createTextNode(after), textNode);
  parent.removeChild(textNode);

  return wrap;
}
