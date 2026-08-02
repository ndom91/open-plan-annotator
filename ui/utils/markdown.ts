export type BlockType = "heading" | "paragraph" | "code" | "list" | "blockquote" | "hr" | "table" | "details";

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
  start: number;
  end: number;
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
  /** `<summary>` text of a `details` block, absent when the source had none. */
  summary?: string;
  /** Body of a `details` block, parsed as blocks sharing the document index space. */
  children?: Block[];
}

/** Depth-first walk of a block tree, so consumers can look blocks up by index. */
export function flattenBlocks(blocks: Block[]): Block[] {
  const flat: Block[] = [];
  for (const block of blocks) {
    flat.push(block);
    if (block.children) flat.push(...flattenBlocks(block.children));
  }
  return flat;
}

interface ListLineMatch {
  indent: number;
  marker: ListMarker;
  order?: number;
  text: string;
  textStart: number;
}

// A table separator row like `| --- | :--: |`, tolerating leading indentation
// so it can be detected inside list-item continuation.
function isTableSeparator(line: string): boolean {
  return /^\s*\|[\s:]*-{2,}[\s:|-]*\|?\s*$/.test(line);
}

// Whether the line at `i` begins a GitHub-flavored table: a pipe row followed
// by a separator row. Used to break list-continuation collection when a table
// is nested (indented) inside a list item.
function isTableStart(lines: string[], i: number): boolean {
  if (!lines[i]?.trimStart().startsWith("|")) return false;
  const next = lines[i + 1];
  return next !== undefined && isTableSeparator(next);
}

// An opening `<details>` (with optional attributes) at the start of a line.
function matchDetailsOpen(line: string): RegExpMatchArray | null {
  return line.match(/^\s*<details(?:\s[^>]*)?>/i);
}

// Any `<details>` / `</details>` tag at the start of a line. Used to stop
// paragraph collection so a details block that follows a paragraph without a
// blank line between them is not swallowed into it.
function isDetailsBoundary(line: string): boolean {
  return /^\s*<\/?details(?:\s[^>]*)?>/i.test(line);
}

/**
 * Walk the `<details>` / `</details>` tags in `text`, starting at nesting
 * `depth`, and report where the close tag that balances the outermost open tag
 * lies. Returns the running depth instead when the block is still open.
 */
function scanDetailsTags(
  text: string,
  depth: number,
): { closed: true; start: number; end: number } | { closed: false; depth: number } {
  const tagRe = /<details(?:\s[^>]*)?>|<\/details\s*>/gi;
  let current = depth;
  let m: RegExpExecArray | null = tagRe.exec(text);

  while (m !== null) {
    if (m[0].startsWith("</")) {
      current--;
      if (current === 0) return { closed: true, start: m.index, end: m.index + m[0].length };
    } else {
      current++;
    }
    m = tagRe.exec(text);
  }

  return { closed: false, depth: current };
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
  return parseBlocks(markdown, { value: 0 });
}

/**
 * Parse markdown into blocks, drawing block indices from a shared counter so
 * blocks nested inside a `<details>` body live in the same index space as the
 * top-level document.
 */
function parseBlocks(markdown: string, counter: { value: number }): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Details disclosure: collect to the matching close tag, pull out the
    // summary, and parse the remaining body as nested blocks.
    const detailsOpen = matchDetailsOpen(line);
    if (detailsOpen) {
      const rawLines: string[] = [line];
      const bodyLines: string[] = [];
      let depth = 1;
      // Anything after the opening tag on the same line is already body.
      let chunk = line.slice(detailsOpen[0].length);

      while (true) {
        const scan = scanDetailsTags(chunk, depth);

        if (scan.closed) {
          bodyLines.push(chunk.slice(0, scan.start));
          const trailing = chunk.slice(scan.end);
          // Text after the close tag on the same line belongs to the document,
          // so hand it back to the line stream instead of consuming the line.
          if (trailing.trim() !== "") lines[i] = trailing;
          else i++;
          break;
        }

        depth = scan.depth;
        bodyLines.push(chunk);
        i++;
        // Unclosed `<details>` — consume to the end of the input.
        if (i >= lines.length) break;
        chunk = lines[i];
        rawLines.push(chunk);
      }

      const body = bodyLines.join("\n");
      const summaryMatch = body.match(/<summary(?:\s[^>]*)?>([\s\S]*?)<\/summary\s*>/i);
      const summary = summaryMatch?.[1].trim();
      const remainder = summaryMatch ? body.replace(summaryMatch[0], "") : body;

      const index = counter.value++;
      blocks.push({
        index,
        type: "details",
        raw: rawLines.join("\n"),
        content: summary ?? "",
        summary,
        children: parseBlocks(remainder, counter),
      });
      continue;
    }

    // A `</details>` with no matching open tag. Strip it rather than printing
    // the raw tag, and reprocess whatever text shared the line.
    if (isDetailsBoundary(line)) {
      const stripped = line.replace(/<\/details\s*>/gi, "");
      if (stripped.trim() === "") i++;
      else lines[i] = stripped;
      continue;
    }

    // Fenced code block
    const codeMatch = line.match(/^( {0,3})```([\w.+#-]*)\s*$/);
    if (codeMatch) {
      const fenceIndent = codeMatch[1];
      const lang = codeMatch[2];
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(new RegExp(`^${fenceIndent}\`\`\`\\s*$`))) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const rawContent = codeLines.join("\n");
      // Strip the fence indent (e.g. the 3-space ordered-list continuation) from
      // each code line so the code body renders flush-left inside the box.
      // `raw` keeps the original source for offset math.
      const stripPrefix = fenceIndent.length > 0 ? new RegExp(`^ {1,${fenceIndent.length}}`) : null;
      const content = stripPrefix ? codeLines.map((l) => l.replace(stripPrefix, "")).join("\n") : rawContent;
      blocks.push({
        index: counter.value++,
        type: "code",
        raw: `${fenceIndent}\`\`\`${lang}\n${rawContent}\n${fenceIndent}\`\`\``,
        content,
        lang,
      });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        index: counter.value++,
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
      blocks.push({ index: counter.value++, type: "hr", raw: line, content: "" });
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
      blocks.push({ index: counter.value++, type: "blockquote", raw, content });
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
        } else if (/^\s+/.test(l) && listLines.length > 0 && !/^ {0,3}```/.test(l) && !isTableStart(lines, i)) {
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
      blocks.push({ index: counter.value++, type: "list", raw, content: raw, listItems: parseListItems(listLines) });
      continue;
    }

    // Table (lines starting with |, with a separator row like |---|---|)
    if (line.trimStart().startsWith("|")) {
      const rawTableLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) {
        rawTableLines.push(lines[i]);
        i++;
      }
      // Strip leading indentation (e.g. a table nested inside an ordered-list
      // item) so the separator regex matches and cell offsets are computed
      // against the same flush-left content the table renderer uses.
      const tableLines = rawTableLines.map((l) => l.replace(/^\s+/, ""));
      // Need at least header + separator, and the second line must be a separator
      if (tableLines.length >= 2 && isTableSeparator(tableLines[1])) {
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

        // Compute row offsets within the joined content string
        const rowOffsets: number[] = [];
        let offset = 0;
        for (let ri = 0; ri < tableLines.length; ri++) {
          rowOffsets.push(offset);
          offset += tableLines[ri].length + 1; // +1 for \n
        }

        const parseCellsWithOffsets = (
          row: string,
          rowOffset: number,
        ): Array<{ text: string; start: number; end: number }> => {
          const results: Array<{ text: string; start: number; end: number }> = [];
          // Walk through pipe-delimited cells
          let cursor = row.indexOf("|");
          if (cursor === -1) return results;
          cursor++; // move past leading pipe
          while (cursor < row.length) {
            const nextPipe = row.indexOf("|", cursor);
            if (nextPipe === -1) break;
            const rawCell = row.substring(cursor, nextPipe);
            const trimmed = rawCell.trim();
            if (trimmed.length > 0) {
              const trimStart = rawCell.indexOf(trimmed);
              results.push({
                text: trimmed,
                start: rowOffset + cursor + trimStart,
                end: rowOffset + cursor + trimStart + trimmed.length,
              });
            } else {
              // Empty cell — point at the space between pipes
              results.push({ text: "", start: rowOffset + cursor, end: rowOffset + cursor });
            }
            cursor = nextPipe + 1;
          }
          return results;
        };

        const headerCellData = parseCellsWithOffsets(tableLines[0], rowOffsets[0]);
        const headerRow: TableCell[] = headerCellData.map((cell, ci) => ({
          text: cell.text,
          align: alignments[ci],
          start: cell.start,
          end: cell.end,
        }));

        const bodyRows: TableCell[][] = tableLines.slice(2).map((row, ri) => {
          const cellData = parseCellsWithOffsets(row, rowOffsets[ri + 2]);
          return cellData.map((cell, ci) => ({
            text: cell.text,
            align: alignments[ci],
            start: cell.start,
            end: cell.end,
          }));
        });

        const raw = tableLines.join("\n");
        const content = raw;
        blocks.push({ index: counter.value++, type: "table", raw, content, headerRow, bodyRows });
        continue;
      }
      // Not a valid table — rewind and let paragraph handle it
      i -= rawTableLines.length;
    }

    // Paragraph (collect consecutive non-empty, non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].match(/^#{1,6}\s/) &&
      !/^ {0,3}```/.test(lines[i]) &&
      !lines[i].startsWith(">") &&
      !matchListLine(lines[i]) &&
      !isDetailsBoundary(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      const content = paraLines.join(" ");
      blocks.push({ index: counter.value++, type: "paragraph", raw: paraLines.join("\n"), content });
    }
  }

  return blocks;
}
