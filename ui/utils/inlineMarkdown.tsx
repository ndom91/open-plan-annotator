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

/**
 * Map a rendered-text offset (no syntax chars) to a markdown-source offset
 * (including `**`, backticks, `[](url)`, etc.) within the same string.
 */
export function renderedToSourceOffset(markdownSource: string, renderedOffset: number): number {
  const tokens = tokenize(markdownSource);
  let renderedCursor = 0;
  let sourceCursor = 0;

  for (const token of tokens) {
    const renderedLen = token.content.length;
    // Reconstruct source length for this token
    let sourceLen: number;
    if (token.type === "text") {
      sourceLen = token.content.length;
    } else {
      // Find the original source text by scanning markdownSource at sourceCursor
      sourceLen = findSourceLength(markdownSource, sourceCursor, token);
    }

    if (renderedCursor + renderedLen >= renderedOffset) {
      // The target offset falls within this token
      const intraRendered = renderedOffset - renderedCursor;
      if (token.type === "text") {
        return sourceCursor + intraRendered;
      }
      // For formatted tokens, compute how far into the source the rendered offset maps.
      // The content starts after the opening syntax.
      const openingSyntaxLen = computeOpeningSyntaxLength(token);
      return sourceCursor + openingSyntaxLen + intraRendered;
    }

    renderedCursor += renderedLen;
    sourceCursor += sourceLen;
  }

  return sourceCursor;
}

function findSourceLength(source: string, cursor: number, token: InlineToken): number {
  // Re-match the token at cursor position in the source
  switch (token.type) {
    case "boldItalic": {
      // ***content*** or ___content___
      const m = source.slice(cursor).match(/^(\*{3}|_{3}).+?\1/);
      return m ? m[0].length : token.content.length;
    }
    case "bold": {
      const m = source.slice(cursor).match(/^(\*{2}|_{2}).+?\1/);
      return m ? m[0].length : token.content.length;
    }
    case "italic": {
      const m = source.slice(cursor).match(/^\*(.+?)\*|^_(.+?)_/);
      return m ? m[0].length : token.content.length;
    }
    case "code": {
      const m = source.slice(cursor).match(/^`[^`]+`/);
      return m ? m[0].length : token.content.length;
    }
    case "link": {
      const m = source.slice(cursor).match(/^\[[^\]]+\]\([^)]+\)/);
      return m ? m[0].length : token.content.length;
    }
    default:
      return token.content.length;
  }
}

function computeOpeningSyntaxLength(token: InlineToken): number {
  switch (token.type) {
    case "boldItalic":
      return 3; // ***
    case "bold":
      return 2; // **
    case "italic":
      return 1; // * or _
    case "code":
      return 1; // `
    case "link":
      return 1; // [
    default:
      return 0;
  }
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
          <code key={i} className="text-[13px] font-mono bg-inset border border-rule rounded px-1 py-0.5">
            {token.content}
          </code>
        );
      case "link":
        return (
          <a
            key={i}
            href={token.href}
            className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent/60 transition-colors duration-200"
            target="_blank"
            rel="noopener noreferrer"
          >
            {token.content}
          </a>
        );
      default:
        return <span key={i}>{token.content}</span>;
    }
  });
}
