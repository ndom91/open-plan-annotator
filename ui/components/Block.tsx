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
        <span key={i} className="line-through decoration-redline/70 text-redline bg-redline-bg/50 rounded-sm px-px" title="Marked for removal">
          {seg.text}
        </span>
      );
    }
    return (
      <span key={i} className="bg-margin-note-bg/60 border-b-2 border-margin-note/50 rounded-sm px-px cursor-help" title={seg.annotation.comment}>
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
      const sizeClasses: Record<number, string> = {
        1: "text-2xl font-semibold tracking-tight mt-0 mb-6 text-ink",
        2: "text-lg font-semibold tracking-tight mt-10 mb-3 text-ink pb-2 border-b border-rule-subtle",
        3: "text-base font-semibold tracking-tight mt-8 mb-2 text-ink",
        4: "text-sm font-semibold mt-6 mb-2 text-ink",
        5: "text-sm font-medium mt-5 mb-1.5 text-ink-secondary",
        6: "text-xs font-medium mt-5 mb-1.5 text-ink-tertiary uppercase tracking-widest",
      };
      const classes = sizeClasses[block.level ?? 1] ?? sizeClasses[1];
      return (
        <div data-block-index={block.index} className={classes}>
          {renderSegments(segments)}
        </div>
      );
    }

    case "code":
      return (
        <div data-block-index={block.index} className="my-5 rounded-md bg-inset border border-rule overflow-hidden">
          {block.lang && (
            <div className="px-4 py-1.5 border-b border-rule text-[11px] font-mono text-ink-tertiary tracking-wide uppercase">
              {block.lang}
            </div>
          )}
          <pre className="p-4 overflow-x-auto font-mono text-[13px] leading-relaxed text-ink-secondary">
            <code>{renderSegments(segments)}</code>
          </pre>
        </div>
      );

    case "list":
      return (
        <ul data-block-index={block.index} className="my-3 space-y-1">
          {block.items?.map((item, i) => (
            <li key={i} className="text-[15px] text-ink-secondary leading-relaxed pl-5 relative before:content-[''] before:absolute before:left-1.5 before:top-[0.6em] before:w-1 before:h-1 before:rounded-full before:bg-ink-tertiary">
              {item}
            </li>
          ))}
        </ul>
      );

    case "hr":
      return <hr data-block-index={block.index} className="my-10 border-0 h-px bg-rule-subtle" />;

    case "blockquote":
      return (
        <blockquote data-block-index={block.index} className="my-5 pl-4 border-l-2 border-ink-tertiary/40 text-[15px] text-ink-secondary italic leading-relaxed">
          {renderSegments(segments)}
        </blockquote>
      );

    default:
      return (
        <p data-block-index={block.index} className="text-[15px] text-ink-secondary leading-[1.7] my-3">
          {renderSegments(segments)}
        </p>
      );
  }
}
