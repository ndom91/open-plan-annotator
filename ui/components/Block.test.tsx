import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BlockComponent } from "./Block.tsx";

describe("BlockComponent", () => {
  test("renders ordered lists with their original starting number", () => {
    const html = renderToStaticMarkup(
      <BlockComponent
        block={{
          index: 0,
          type: "list",
          raw: "3. Third item",
          content: "3. Third item",
          listItems: [{ text: "Third item", start: 3, end: 13, marker: "ordered", order: 3, children: [] }],
        }}
        annotations={[]}
      />,
    );

    expect(html).toContain('start="3"');
  });

  test("renders a details block expanded, with nested children", () => {
    const html = renderToStaticMarkup(
      <BlockComponent
        block={{
          index: 0,
          type: "details",
          raw: "<details>\n<summary>Deferred design</summary>\n\nBody text.\n</details>",
          content: "Deferred design",
          summary: "Deferred design",
          children: [{ index: 1, type: "paragraph", raw: "Body text.", content: "Body text." }],
        }}
        annotations={[]}
      />,
    );

    expect(html).toContain("<details open");
    expect(html).toContain("Deferred design");
    expect(html).toContain("Body text.");
    // The block index lives on the summary so offsetResolver does not sweep up
    // the segments of nested children.
    expect(html).toMatch(/<summary[^>]*data-block-index="0"/);
    expect(html).toMatch(/<p[^>]*data-block-index="1"/);
  });

  test("labels a summary-less details block without making it annotatable", () => {
    const html = renderToStaticMarkup(
      <BlockComponent
        block={{
          index: 0,
          type: "details",
          raw: "<details>\n\nBody text.\n</details>",
          content: "",
          children: [{ index: 1, type: "paragraph", raw: "Body text.", content: "Body text." }],
        }}
        annotations={[]}
      />,
    );

    expect(html).toContain("Details");
    expect(html).not.toMatch(/<summary[^>]*data-block-index/);
  });
});
