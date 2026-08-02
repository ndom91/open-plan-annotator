import { describe, expect, test } from "bun:test";
import { parseMarkdownToBlocks } from "./markdown.ts";

describe("parseMarkdownToBlocks", () => {
  test("preserves ordered lists with nested unordered children", () => {
    const markdown = ["1. First step", "   - nested detail", "   - another detail", "2. Second step"].join("\n");
    const blocks = parseMarkdownToBlocks(markdown);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("list");
    expect(blocks[0]?.listItems).toEqual([
      {
        text: "First step",
        start: markdown.indexOf("First step"),
        end: markdown.indexOf("First step") + "First step".length,
        marker: "ordered",
        order: 1,
        children: [
          {
            text: "nested detail",
            start: markdown.indexOf("nested detail"),
            end: markdown.indexOf("nested detail") + "nested detail".length,
            marker: "unordered",
            children: [],
          },
          {
            text: "another detail",
            start: markdown.indexOf("another detail"),
            end: markdown.indexOf("another detail") + "another detail".length,
            marker: "unordered",
            children: [],
          },
        ],
      },
      {
        text: "Second step",
        start: markdown.indexOf("Second step"),
        end: markdown.indexOf("Second step") + "Second step".length,
        marker: "ordered",
        order: 2,
        children: [],
      },
    ]);
  });

  test("keeps indented continuation lines attached to the same item", () => {
    const blocks = parseMarkdownToBlocks(["- Parent item", "  continuation line", "- Sibling item"].join("\n"));

    expect(blocks[0]?.listItems?.[0]?.text).toBe("Parent item\ncontinuation line");
    expect(blocks[0]?.listItems?.[1]?.text).toBe("Sibling item");
  });

  test("table cells have correct source offsets", () => {
    const markdown = "| Name | Value |\n| --- | --- |\n| foo | bar |";
    const blocks = parseMarkdownToBlocks(markdown);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("table");

    const header = blocks[0]?.headerRow;
    expect(header).toHaveLength(2);
    expect(header?.[0]?.text).toBe("Name");
    expect(markdown.slice(header?.[0]?.start, header?.[0]?.end)).toBe("Name");
    expect(header?.[1]?.text).toBe("Value");
    expect(markdown.slice(header?.[1]?.start, header?.[1]?.end)).toBe("Value");

    const body = blocks[0]?.bodyRows;
    expect(body).toHaveLength(1);
    expect(body?.[0]?.[0]?.text).toBe("foo");
    expect(markdown.slice(body?.[0]?.[0]?.start, body?.[0]?.[0]?.end)).toBe("foo");
    expect(body?.[0]?.[1]?.text).toBe("bar");
    expect(markdown.slice(body?.[0]?.[1]?.start, body?.[0]?.[1]?.end)).toBe("bar");
  });

  test("parses tables indented inside an ordered list item", () => {
    const markdown = [
      "2. Use Standard.site collections:",
      "",
      "   | Collection | Use |",
      "   | --- | --- |",
      "   | `site.standard.publication` | One record for `https://ndo.dev`. |",
      "   | `site.standard.document` | One record per published blog post. |",
      "",
      "3. Resolve the format decision.",
    ].join("\n");
    const blocks = parseMarkdownToBlocks(markdown);

    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.type).toBe("list");
    expect(blocks[1]?.type).toBe("table");
    expect(blocks[2]?.type).toBe("list");

    const table = blocks[1];
    expect(table?.headerRow?.map((c) => c.text)).toEqual(["Collection", "Use"]);
    expect(table?.bodyRows).toHaveLength(2);
    expect(table?.bodyRows?.[0]?.map((c) => c.text)).toEqual([
      "`site.standard.publication`",
      "One record for `https://ndo.dev`.",
    ]);

    // Cell offsets must resolve against the (dedented) block content.
    const firstCell = table?.headerRow?.[0];
    expect(table?.content.slice(firstCell?.start, firstCell?.end)).toBe("Collection");
    const bodyCell = table?.bodyRows?.[1]?.[1];
    expect(table?.content.slice(bodyCell?.start, bodyCell?.end)).toBe("One record per published blog post.");
  });

  test("parses indented fenced code blocks", () => {
    const markdown = [
      "4. Update handler:",
      "   ```ts",
      "   const value = `inline`;",
      "   ```",
      "",
      "5. Next step",
    ].join("\n");
    const blocks = parseMarkdownToBlocks(markdown);

    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.type).toBe("list");
    expect(blocks[1]).toMatchObject({
      type: "code",
      lang: "ts",
      content: "const value = `inline`;",
      raw: "   ```ts\n   const value = `inline`;\n   ```",
    });
    expect(blocks[2]?.type).toBe("list");
  });

  test("strips list indent from multi-line indented fenced code", () => {
    const markdown = ["1. Step:", "   ```bash", "   cd /foo", "   ./bar", "   ```"].join("\n");
    const blocks = parseMarkdownToBlocks(markdown);

    expect(blocks[1]).toMatchObject({
      type: "code",
      lang: "bash",
      content: "cd /foo\n./bar",
    });
  });

  test("parses a details block with its summary and nested body blocks", () => {
    const markdown = [
      "<details>",
      "<summary>Deferred design</summary>",
      "",
      "An in-process `Map` would be worthless.",
      "",
      "```ts",
      "const cache = new Map();",
      "```",
      "",
      "- Needs a shared datastore",
      "</details>",
    ].join("\n");
    const blocks = parseMarkdownToBlocks(markdown);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      index: 0,
      type: "details",
      content: "Deferred design",
      summary: "Deferred design",
    });

    const children = blocks[0]?.children;
    expect(children?.map((c) => c.type)).toEqual(["paragraph", "code", "list"]);
    // Children draw from the same index counter, after the details block itself.
    expect(children?.map((c) => c.index)).toEqual([1, 2, 3]);
    expect(children?.[0]?.content).toBe("An in-process `Map` would be worthless.");
    expect(children?.[1]).toMatchObject({ lang: "ts", content: "const cache = new Map();" });
    expect(children?.[2]?.listItems?.[0]?.text).toBe("Needs a shared datastore");
  });

  test("continues the index counter after a details block", () => {
    const blocks = parseMarkdownToBlocks(
      ["<details>", "<summary>Aside</summary>", "", "Body text.", "</details>", "", "After the aside."].join("\n"),
    );

    expect(blocks.map((b) => [b.type, b.index])).toEqual([
      ["details", 0],
      ["paragraph", 2],
    ]);
    expect(blocks[0]?.children?.[0]?.index).toBe(1);
  });

  test("parses details tags carrying attributes", () => {
    const blocks = parseMarkdownToBlocks(
      ['<details open class="note">', "<summary>Open by default</summary>", "", "Body.", "</details>"].join("\n"),
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("details");
    expect(blocks[0]?.summary).toBe("Open by default");
  });

  test("handles a details block with no summary", () => {
    const blocks = parseMarkdownToBlocks(["<details>", "", "Just a body.", "</details>"].join("\n"));

    expect(blocks[0]).toMatchObject({ type: "details", content: "", summary: undefined });
    expect(blocks[0]?.children?.[0]?.content).toBe("Just a body.");
  });

  test("does not end an outer details block at a nested close tag", () => {
    const blocks = parseMarkdownToBlocks(
      [
        "<details>",
        "<summary>Outer</summary>",
        "",
        "<details>",
        "<summary>Inner</summary>",
        "",
        "Inner body.",
        "</details>",
        "",
        "Outer body.",
        "</details>",
      ].join("\n"),
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.summary).toBe("Outer");

    const children = blocks[0]?.children;
    expect(children?.map((c) => c.type)).toEqual(["details", "paragraph"]);
    expect(children?.[0]?.summary).toBe("Inner");
    expect(children?.[0]?.children?.[0]?.content).toBe("Inner body.");
    expect(children?.[1]?.content).toBe("Outer body.");
  });

  test("consumes an unclosed details block to the end of the input", () => {
    const blocks = parseMarkdownToBlocks(["<details>", "<summary>Unclosed</summary>", "", "Body text."].join("\n"));

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.summary).toBe("Unclosed");
    expect(blocks[0]?.children?.[0]?.content).toBe("Body text.");
  });

  test("drops a stray closing details tag instead of rendering it as text", () => {
    const blocks = parseMarkdownToBlocks(["Some text.", "</details>", "More text."].join("\n"));

    expect(blocks.map((b) => b.content)).toEqual(["Some text.", "More text."]);
  });

  test("keeps a paragraph directly above a details block separate", () => {
    const blocks = parseMarkdownToBlocks(
      ["Lead-in paragraph.", "<details>", "<summary>Aside</summary>", "", "Body.", "</details>"].join("\n"),
    );

    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "details"]);
    expect(blocks[0]?.content).toBe("Lead-in paragraph.");
  });

  test("leaves top-level (unindented) fenced code content untouched", () => {
    const markdown = ["```bash", "  cd /foo", "./bar", "```"].join("\n");
    const blocks = parseMarkdownToBlocks(markdown);

    expect(blocks[0]).toMatchObject({
      type: "code",
      lang: "bash",
      content: "  cd /foo\n./bar",
    });
  });
});
