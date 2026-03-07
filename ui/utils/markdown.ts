export type BlockType = "heading" | "paragraph" | "code" | "list" | "blockquote" | "hr" | "table";

export type ListMarker = "ordered" | "unordered";

export interface ListItem {
  text: string;
  start: number;
  end: number;
  marker: ListMarker;
  order?: number;
  children: ListItem[];
}

export interface TableCell {
  text: string;
  align?: "left" | "center" | "right";
}

export interface Block {
  index: number;
  type: BlockType;
  raw: string;
  content: string;
  level?: number;
  lang?: string;
  listItems?: ListItem[];
  headerRow?: TableCell[];
  bodyRows?: TableCell[][];
}

interface ListLineMatch {
  indent: number;
  marker: ListMarker;
  order?: number;
  text: string;
  textStart: number;
}

function matchListLine(line: string): ListLineMatch | null {
  const match = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
  if (!match) return null;

  return {
    indent: match[1].length,
    marker: /^\d+\.$/.test(match[2]) ? "ordered" : "unordered",
    order: /^\d+\.$/.test(match[2]) ? Number.parseInt(match[2], 10) : undefined,
    text: match[3],
    textStart: match[1].length + match[2].length + 1,
  };
}

function parseListItems(listLines: string[]): ListItem[] {
  const root: ListItem[] = [];
  const stack: Array<{ indent: number; children: ListItem[] }> = [{ indent: -1, children: root }];
  let lastItem: ListItem | null = null;
  let offset = 0;

  for (const line of listLines) {
    const match = matchListLine(line);

    if (match) {
      while (stack.length > 1 && match.indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }

      const item: ListItem = {
        text: match.text,
        start: offset + match.textStart,
        end: offset + line.length,
        marker: match.marker,
        order: match.order,
        children: [],
      };

      stack[stack.length - 1].children.push(item);
      stack.push({ indent: match.indent, children: item.children });
      lastItem = item;
    } else if (lastItem) {
      const continuation = line.trim();
      if (continuation !== "") {
        lastItem.text += `\n${continuation}`;
        lastItem.end = offset + line.length;
      }
    }

    offset += line.length + 1;
  }

  return root;
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
    const codeMatch = line.match(/^```([\w.+#-]*)\s*$/);
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
    if (matchListLine(line)) {
      const listLines: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (matchListLine(l)) {
          listLines.push(l);
          i++;
        } else if (/^\s+/.test(l) && listLines.length > 0) {
          // Continuation line
          listLines.push(l);
          i++;
        } else if (l.trim() === "") {
          // Empty line might separate list items — peek ahead
          if (i + 1 < lines.length && matchListLine(lines[i + 1])) {
            i++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      const raw = listLines.join("\n");
      blocks.push({ index: index++, type: "list", raw, content: raw, listItems: parseListItems(listLines) });
      continue;
    }

    // Table (lines starting with |, with a separator row like |---|---|)
    if (line.trimStart().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      // Need at least header + separator + one body row, and second line must be a separator
      if (tableLines.length >= 2 && /^\|[\s:]*-{2,}[\s:|-]*\|?\s*$/.test(tableLines[1])) {
        const parseCells = (row: string): string[] =>
          row
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((c) => c.trim());

        const parseAlignments = (sep: string): Array<"left" | "center" | "right" | undefined> =>
          parseCells(sep).map((c) => {
            const left = c.startsWith(":");
            const right = c.endsWith(":");
            if (left && right) return "center";
            if (right) return "right";
            return left ? "left" : undefined;
          });

        const alignments = parseAlignments(tableLines[1]);
        const headerCells = parseCells(tableLines[0]);
        const headerRow: TableCell[] = headerCells.map((text, ci) => ({
          text,
          align: alignments[ci],
        }));

        const bodyRows: TableCell[][] = tableLines.slice(2).map((row) => {
          const cells = parseCells(row);
          return cells.map((text, ci) => ({ text, align: alignments[ci] }));
        });

        const raw = tableLines.join("\n");
        const content = raw;
        blocks.push({ index: index++, type: "table", raw, content, headerRow, bodyRows });
        continue;
      }
      // Not a valid table — rewind and let paragraph handle it
      i -= tableLines.length;
    }

    // Paragraph (collect consecutive non-empty, non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].match(/^#{1,6}\s/) &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith(">") &&
      !matchListLine(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
    ) {
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
