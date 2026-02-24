import type { Block } from "../utils/markdown.ts";
import type { Annotation } from "../utils/annotationSerializer.ts";

interface BlockProps {
  block: Block;
  annotations: Annotation[];
}

interface Segment {
  text: string;
  annotation?: Annotation;
}

function splitIntoSegments(text: string, annotations: Annotation[]): Segment[] {
  const sorted = [...annotations].sort((a, b) => a.startOffset - b.startOffset);
  const segments: Segment[] = [];
  let cursor = 0;

  for (const ann of sorted) {
    if (ann.startOffset > cursor) {
      segments.push({ text: text.slice(cursor, ann.startOffset) });
    }
    segments.push({ text: text.slice(ann.startOffset, ann.endOffset), annotation: ann });
    cursor = ann.endOffset;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }

  return segments;
}

function renderSegments(segments: Segment[]) {
  return segments.map((seg, i) => {
    if (!seg.annotation) return <span key={i}>{seg.text}</span>;
    if (seg.annotation.type === "deletion") {
      return (
        <span key={i} className="line-through text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-sm px-0.5" title="Marked for removal">
          {seg.text}
        </span>
      );
    }
    return (
      <span key={i} className="bg-yellow-100 dark:bg-yellow-900/40 border-b-2 border-yellow-400 dark:border-yellow-600 rounded-sm px-0.5" title={seg.annotation.comment}>
        {seg.text}
      </span>
    );
  });
}

export function BlockComponent({ block, annotations }: BlockProps) {
  const blockAnnotations = annotations.filter((a) => a.blockIndex === block.index);
  const segments = splitIntoSegments(block.content, blockAnnotations);

  switch (block.type) {
    case "heading": {
      const classes = "font-semibold text-gray-900 dark:text-gray-100";
      const sizeClasses: Record<number, string> = {
        1: "text-3xl mt-8 mb-4",
        2: "text-2xl mt-7 mb-3",
        3: "text-xl mt-6 mb-2",
        4: "text-lg mt-5 mb-2",
        5: "text-base mt-4 mb-1",
        6: "text-sm mt-4 mb-1 uppercase tracking-wide",
      };
      const size = sizeClasses[block.level ?? 1] ?? sizeClasses[1];
      return (
        <div data-block-index={block.index} className={`${classes} ${size}`}>
          {renderSegments(segments)}
        </div>
      );
    }

    case "code":
      return (
        <pre data-block-index={block.index} className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 overflow-x-auto font-mono text-sm my-4 leading-relaxed">
          <code>{renderSegments(segments)}</code>
        </pre>
      );

    case "list":
      return (
        <ul data-block-index={block.index} className="list-disc pl-6 my-3 space-y-1.5">
          {block.items?.map((item, i) => (
            <li key={i} className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      );

    case "hr":
      return <hr data-block-index={block.index} className="my-8 border-gray-200 dark:border-gray-700" />;

    case "blockquote":
      return (
        <blockquote data-block-index={block.index} className="border-l-4 border-blue-400 dark:border-blue-600 pl-4 italic text-gray-600 dark:text-gray-400 my-4 leading-relaxed">
          {renderSegments(segments)}
        </blockquote>
      );

    default:
      return (
        <p data-block-index={block.index} className="text-gray-700 dark:text-gray-300 leading-relaxed my-3">
          {renderSegments(segments)}
        </p>
      );
  }
}
