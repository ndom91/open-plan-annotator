import { describe, expect, test } from "bun:test";
import { serializeAnnotations } from "./feedback.ts";
import type { Annotation } from "./types.ts";

const baseAnnotation = {
  id: "a1",
  blockIndex: 0,
  startOffset: 0,
  endOffset: 4,
  createdAt: "2026-05-21T12:00:00.000Z",
} satisfies Omit<Annotation, "type" | "text">;

describe("serializeAnnotations", () => {
  test("serializes empty feedback compatibly", () => {
    expect(serializeAnnotations([])).toBe("Plan changes requested.");
  });

  test("serializes all annotation types as anchored review markup", () => {
    const annotations: Annotation[] = [
      { ...baseAnnotation, id: "a1", type: "deletion", text: "old" },
      { ...baseAnnotation, id: "a2", type: "replacement", text: "old", replacement: "new" },
      { ...baseAnnotation, id: "a3", type: "insertion", text: "anchor", replacement: "inserted" },
      { ...baseAnnotation, id: "a4", type: "comment", text: "anchor", comment: "explain" },
    ];

    const feedback = serializeAnnotations(annotations);

    expect(feedback).toContain('1. {--old--}{id="a1" by="user" at="2026-05-21T12:00:00.000Z"}');
    expect(feedback).toContain('2. {~~old~>new~~}{id="a2" by="user" at="2026-05-21T12:00:00.000Z"}');
    expect(feedback).toContain(
      '3. After {==anchor==}, insert {++inserted++}{id="a3" by="user" at="2026-05-21T12:00:00.000Z"}',
    );
    expect(feedback).toContain('4. {==anchor==}{>>explain<<}{id="a4" by="user" at="2026-05-21T12:00:00.000Z"}');
  });

  test("escapes metadata quotes and critic close delimiters", () => {
    const feedback = serializeAnnotations([
      {
        ...baseAnnotation,
        id: 'a"1',
        type: "comment",
        text: "anchor==}",
        comment: "comment<<}",
      },
    ]);

    expect(feedback).toContain('id="a\\"1"');
    expect(feedback).toContain("anchor[escaped ==}]");
    expect(feedback).toContain("comment[escaped <<}]");
  });
});
