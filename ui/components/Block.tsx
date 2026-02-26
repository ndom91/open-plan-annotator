import type { Annotation } from "../utils/annotationSerializer.ts";
import { renderInlineMarkdown } from "../utils/inlineMarkdown.tsx";
import type { Block } from "../utils/markdown.ts";

interface BlockProps {
  block: Block;
  annotations: Annotation[];
}

interface Segment {
  text: string;
  originalStart: number;
  originalEnd: number;
  annotation?: Annotation;
}

function splitIntoSegments(text: string, annotations: Annotation[]): Segment[] {
  const sorted = [...annotations].sort((a, b) => a.startOffset - b.startOffset);
  const segments: Segment[] = [];
  let cursor = 0;

  for (const ann of sorted) {
    if (ann.startOffset > cursor) {
      segments.push({
        text: text.slice(cursor, ann.startOffset),
        originalStart: cursor,
        originalEnd: ann.startOffset,
      });
    }
    segments.push({
      text: text.slice(ann.startOffset, ann.endOffset),
      originalStart: ann.startOffset,
      originalEnd: ann.endOffset,
      annotation: ann,
    });
    cursor = ann.endOffset;
  }

  if (cursor < text.length) {
    segments.push({
      text: text.slice(cursor),
      originalStart: cursor,
      originalEnd: text.length,
    });
  }

  return segments;
}

function renderSegments(segments: Segment[], useInline = true) {
  return segments.map((seg, i) => {
    const content = useInline ? renderInlineMarkdown(seg.text) : seg.text;
    // Expose markdown source for inline segments so offsetResolver can map rendered→source offsets
    const segSourceAttr = useInline ? { "data-seg-source": seg.text } : {};

    if (!seg.annotation) {
      return (
        <span key={i} data-seg-start={seg.originalStart} data-seg-end={seg.originalEnd} {...segSourceAttr}>
          {content}
        </span>
      );
    }

    if (seg.annotation.type === "deletion") {
      return (
        <span
          key={i}
          data-seg-start={seg.originalStart}
          data-seg-end={seg.originalEnd}
          {...segSourceAttr}
          className="line-through decoration-redline/70 text-redline bg-redline-bg/50 rounded-sm px-px"
          title="Marked for removal"
        >
          {content}
        </span>
      );
    }
    if (seg.annotation.type === "replacement") {
      return (
        <span key={i} data-seg-start={seg.originalStart} data-seg-end={seg.originalEnd} {...segSourceAttr}>
          <span className="line-through decoration-redline/70 text-redline bg-redline-bg/50 rounded-sm px-px">
            {content}
          </span>
          <span
            className="text-approve bg-approve/10 rounded-sm px-px ml-1 not-italic no-underline"
            data-replacement="true"
            style={{ textDecoration: "none" }}
          >
            {seg.annotation.replacement}
          </span>
        </span>
      );
    }
    if (seg.annotation.type === "insertion") {
      return (
        <span key={i} data-seg-start={seg.originalStart} data-seg-end={seg.originalEnd} {...segSourceAttr}>
          {content}
          <span className="text-approve bg-approve/10  rounded-sm px-1 ml-1" data-replacement="true">
            +{seg.annotation.replacement}
          </span>
        </span>
      );
    }
    // comment
    return (
      <span
        key={i}
        data-seg-start={seg.originalStart}
        data-seg-end={seg.originalEnd}
        {...segSourceAttr}
        className="group/comment relative bg-margin-note-bg/60 border-b-2 border-margin-note/50 rounded-xs px-px cursor-help"
        role="note"
        aria-label={seg.annotation.comment ? `Comment: ${seg.annotation.comment}` : undefined}
      >
        {content}
        {seg.annotation.comment && (
          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 rounded-lg bg-paper-edge border border-rule shadow-[0_2px_4px_oklch(0_0_0/0.2),0_8px_24px_oklch(0_0_0/0.25),0_16px_48px_oklch(0_0_0/0.15)] text-xs text-ink-secondary leading-relaxed whitespace-pre-wrap w-max max-w-160 opacity-0 group-hover/comment:opacity-100 group-focus-within/comment:opacity-100 transition-opacity duration-200 z-50">
            <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-rule" />
            {seg.annotation.comment}
          </span>
        )}
      </span>
    );
  });
}

function computeListItemRanges(content: string, items: string[]): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let searchFrom = 0;

  for (const item of items) {
    const idx = content.indexOf(item, searchFrom);
    if (idx >= 0) {
      ranges.push({ start: idx, end: idx + item.length });
      searchFrom = idx + item.length;
    }
  }

  return ranges;
}

function splitItemSegments(content: string, itemStart: number, itemEnd: number, annotations: Annotation[]): Segment[] {
  const itemAnns = annotations
    .filter((a) => a.startOffset < itemEnd && a.endOffset > itemStart)
    .sort((a, b) => a.startOffset - b.startOffset);

  const segments: Segment[] = [];
  let cursor = itemStart;

  for (const ann of itemAnns) {
    const annStart = Math.max(ann.startOffset, itemStart);
    const annEnd = Math.min(ann.endOffset, itemEnd);

    if (annStart > cursor) {
      segments.push({
        text: content.slice(cursor, annStart),
        originalStart: cursor,
        originalEnd: annStart,
      });
    }
    segments.push({
      text: content.slice(annStart, annEnd),
      originalStart: annStart,
      originalEnd: annEnd,
      annotation: ann,
    });
    cursor = annEnd;
  }

  if (cursor < itemEnd) {
    segments.push({
      text: content.slice(cursor, itemEnd),
      originalStart: cursor,
      originalEnd: itemEnd,
    });
  }

  return segments;
}

export function BlockComponent({ block, annotations }: BlockProps) {
  const blockAnnotations = annotations.filter((a) => a.blockIndex === block.index);
  const segments = splitIntoSegments(block.content, blockAnnotations);

  switch (block.type) {
    case "heading": {
      const level = Math.min(Math.max(block.level ?? 1, 1), 6);
      const sizeClasses: Record<number, string> = {
        1: "text-3xl font-bold tracking-[-0.03em] mt-0 mb-8 text-ink scroll-mt-20",
        2: "text-lg font-semibold tracking-tight mt-10 mb-3 text-ink pl-4 border-l-[3px] border-accent/50 scroll-mt-20",
        3: "text-base font-semibold tracking-tight mt-8 mb-2 text-ink scroll-mt-20",
        4: "text-sm font-semibold mt-6 mb-2 text-ink scroll-mt-20",
        5: "text-sm font-medium mt-5 mb-1.5 text-ink-secondary scroll-mt-20",
        6: "text-xs font-medium mt-5 mb-1.5 text-ink-tertiary uppercase tracking-widest scroll-mt-20",
      };
      const classes = sizeClasses[level] ?? sizeClasses[1];
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      return (
        <Tag data-block-index={block.index} className={classes}>
          {renderSegments(segments)}
        </Tag>
      );
    }

    case "code":
      return (
        <div
          data-block-index={block.index}
          className="my-5 rounded-lg bg-inset border border-rule-subtle overflow-hidden shadow-[inset_0_1px_2px_oklch(0_0_0/0.1)]"
        >
          {block.lang && (
            <div className="px-4 py-2 border-b border-rule-subtle bg-linear-to-b from-paper/50 to-transparent flex items-center">
              <span className="text-[11px] font-mono text-ink-tertiary tracking-wide bg-ink/5 px-2 py-0.5 rounded-full ring-1 ring-ink/8">
                {block.lang}
              </span>
            </div>
          )}
          <pre className="p-4 overflow-x-auto font-mono text-[13px] leading-relaxed text-ink-secondary">
            <code>{renderSegments(segments, false)}</code>
          </pre>
        </div>
      );

    case "list": {
      const itemRanges = computeListItemRanges(block.content, block.items ?? []);
      return (
        <ul data-block-index={block.index} className="my-3 space-y-1">
          {block.items?.map((item, i) => {
            const range = itemRanges[i];
            const itemSegments = range
              ? splitItemSegments(block.content, range.start, range.end, blockAnnotations)
              : [
                  {
                    text: item,
                    originalStart: 0,
                    originalEnd: item.length,
                  } as Segment,
                ];
            return (
              <li
                key={i}
                className="text-[15px] text-ink-secondary leading-relaxed pl-5 relative before:content-[''] before:absolute before:left-1.5 before:top-[0.6em] before:w-1 before:h-1 before:rounded-full before:bg-ink-tertiary"
              >
                {renderSegments(itemSegments)}
              </li>
            );
          })}
        </ul>
      );
    }

    case "table": {
      const alignClass = (align?: "left" | "center" | "right") => {
        if (align === "center") return "text-center";
        if (align === "right") return "text-right";
        return "text-left";
      };
      return (
        <div data-block-index={block.index} className="my-5 overflow-x-auto rounded-lg border border-rule">
          <table className="w-full text-[13px] text-ink-secondary">
            {block.headerRow && (
              <thead>
                <tr className="border-b border-rule bg-inset">
                  {block.headerRow.map((cell, ci) => (
                    <th key={ci} className={`px-4 py-2 font-semibold text-ink ${alignClass(cell.align)}`}>
                      {renderInlineMarkdown(cell.text)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            {block.bodyRows && (
              <tbody>
                {block.bodyRows.map((row, ri) => (
                  <tr key={ri} className="border-b border-rule last:border-b-0">
                    {row.map((cell, ci) => (
                      <td key={ci} className={`px-4 py-2 ${alignClass(cell.align)}`}>
                        {renderInlineMarkdown(cell.text)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      );
    }

    case "hr":
      return <hr data-block-index={block.index} className="my-10 border-0 h-px bg-rule-subtle" />;

    case "blockquote":
      return (
        <blockquote
          data-block-index={block.index}
          className="my-5 pl-4 border-l-[3px] border-accent/40 bg-accent/3 rounded-r-md py-3 pr-3 text-[15px] text-ink-secondary italic leading-relaxed"
        >
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
