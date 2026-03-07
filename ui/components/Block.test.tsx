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
});
