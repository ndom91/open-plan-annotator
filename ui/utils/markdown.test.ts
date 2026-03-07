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
});
