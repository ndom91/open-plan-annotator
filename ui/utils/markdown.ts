export type BlockType = "heading" | "paragraph" | "code" | "list" | "blockquote" | "hr";

export interface Block {
  index: number;
  type: BlockType;
  raw: string;
  content: string;
  level?: number;
  lang?: string;
  items?: string[];
}

export function parseMarkdownToBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let index = 0;
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block
    const codeMatch = line.match(/^```(\w*)$/);
    if (codeMatch) {
      const lang = codeMatch[1];
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const content = codeLines.join("\n");
      blocks.push({ index: index++, type: "code", raw: `\`\`\`${lang}\n${content}\n\`\`\``, content, lang });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        index: index++,
        type: "heading",
        raw: line,
        content: headingMatch[2],
        level: headingMatch[1].length,
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ index: index++, type: "hr", raw: line, content: "" });
      i++;
      continue;
    }

    // Blockquote (collect consecutive > lines)
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      const raw = quoteLines.map((l) => `> ${l}`).join("\n");
      const content = quoteLines.join("\n");
      blocks.push({ index: index++, type: "blockquote", raw, content });
      continue;
    }

    // List (collect consecutive list item lines, including continuation lines)
    if (/^[-*+]\s/.test(line) || /^\d+\.\s/.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (/^[-*+]\s/.test(l) || /^\d+\.\s/.test(l)) {
          listLines.push(l);
          i++;
        } else if (l.startsWith("  ") && listLines.length > 0) {
          // Continuation line
          listLines[listLines.length - 1] += "\n" + l;
          i++;
        } else if (l.trim() === "") {
          // Empty line might separate list items — peek ahead
          if (i + 1 < lines.length && (/^[-*+]\s/.test(lines[i + 1]) || /^\d+\.\s/.test(lines[i + 1]))) {
            i++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      const raw = listLines.join("\n");
      const items = listLines.map((l) => l.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, ""));
      blocks.push({ index: index++, type: "list", raw, content: raw, items });
      continue;
    }

    // Paragraph (collect consecutive non-empty, non-special lines)
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].match(/^#{1,6}\s/) && !lines[i].startsWith("```") && !lines[i].startsWith(">") && !/^[-*+]\s/.test(lines[i]) && !/^\d+\.\s/.test(lines[i]) && !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      const content = paraLines.join(" ");
      blocks.push({ index: index++, type: "paragraph", raw: paraLines.join("\n"), content });
    }
  }

  return blocks;
}
