import type { ReactNode } from "react";

interface InlineToken {
  type: "text" | "bold" | "italic" | "code" | "link" | "boldItalic";
  content: string;
  href?: string;
}

const INLINE_PATTERNS = [
  // Bold italic: ***text*** or ___text___
  { regex: /(\*{3}|_{3})(.+?)\1/g, type: "boldItalic" as const },
  // Bold: **text** or __text__
  { regex: /(\*{2}|_{2})(.+?)\1/g, type: "bold" as const },
  // Italic: *text* or _text_ (but not inside words for _)
  { regex: /(?<!\w)\*(.+?)\*(?!\w)|(?<!\w)_(.+?)_(?!\w)/g, type: "italic" as const },
  // Inline code: `text`
  { regex: /`([^`]+)`/g, type: "code" as const },
  // Link: [text](url)
  { regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: "link" as const },
];

function tokenize(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const matches: { start: number; end: number; token: InlineToken }[] = [];

  for (const { regex, type } of INLINE_PATTERNS) {
    const re = new RegExp(regex.source, regex.flags);
    let m: RegExpExecArray | null = re.exec(text);
    while (m !== null) {
      let content: string;
      let href: string | undefined;

      if (type === "link") {
        content = m[1];
        href = m[2];
      } else if (type === "boldItalic" || type === "bold") {
        content = m[2];
      } else if (type === "italic") {
        content = m[1] || m[2];
      } else {
        content = m[1];
      }

      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        token: { type, content, href },
      });
      m = re.exec(text);
    }
  }

  // Sort by position, resolve overlaps (first match wins)
  matches.sort((a, b) => a.start - b.start);
  const filtered: typeof matches = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  // Build token list with text gaps
  let cursor = 0;
  for (const m of filtered) {
    if (m.start > cursor) {
      tokens.push({ type: "text", content: text.slice(cursor, m.start) });
    }
    tokens.push(m.token);
    cursor = m.end;
  }
  if (cursor < text.length) {
    tokens.push({ type: "text", content: text.slice(cursor) });
  }

  return tokens;
}

export function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = tokenize(text);
  return tokens.map((token, i) => {
    switch (token.type) {
      case "bold":
        return (
          <strong key={i} className="font-semibold text-ink">
            {token.content}
          </strong>
        );
      case "italic":
        return (
          <em key={i} className="italic">
            {token.content}
          </em>
        );
      case "boldItalic":
        return (
          <strong key={i} className="font-semibold text-ink italic">
            {token.content}
          </strong>
        );
      case "code":
        return (
          <code key={i} className="text-[13px] font-mono bg-inset border border-rule rounded px-1 py-px">
            {token.content}
          </code>
        );
      case "link":
        return (
          <span
            key={i}
            className="text-margin-note underline decoration-margin-note/30 underline-offset-2"
            title={token.href}
          >
            {token.content}
          </span>
        );
      default:
        return <span key={i}>{token.content}</span>;
    }
  });
}
