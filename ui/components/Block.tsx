import type { Annotation } from "../utils/annotationSerializer.ts";
import { renderInlineMarkdown } from "../utils/inlineMarkdown.tsx";
import type { Block, ListItem } from "../utils/markdown.ts";

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

function listClassName(marker: ListItem["marker"], nested = false): string {
  return marker === "ordered"
    ? `${nested ? "mt-2" : "my-3"} list-decimal space-y-1 pl-6`
    : `${nested ? "mt-2" : "my-3"} list-disc space-y-1 pl-6`;
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

function renderListGroups(
  items: ListItem[],
  content: string,
  annotations: Annotation[],
  nested = false,
): React.JSX.Element[] {
  const groups: Array<{ marker: ListItem["marker"]; items: ListItem[] }> = [];

  for (const item of items) {
    const currentGroup = groups[groups.length - 1];
    if (currentGroup && currentGroup.marker === item.marker) {
      currentGroup.items.push(item);
      continue;
    }

    groups.push({ marker: item.marker, items: [item] });
  }

  return groups.map((group, groupIndex) => {
    const ListTag = group.marker === "ordered" ? "ol" : "ul";
    const listProps = group.marker === "ordered" ? { start: group.items[0]?.order } : {};

    return (
      <ListTag key={`${group.marker}-${groupIndex}`} className={listClassName(group.marker, nested)} {...listProps}>
        {group.items.map((item, itemIndex) => {
          const itemSegments = splitItemSegments(content, item.start, item.end, annotations);

          return (
            <li
              key={`${group.marker}-${groupIndex}-${itemIndex}`}
              className="text-[15px] text-ink-secondary leading-relaxed"
            >
              {renderSegments(itemSegments)}
              {item.children.length > 0 && renderListGroups(item.children, content, annotations, true)}
            </li>
          );
        })}
      </ListTag>
    );
  });
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
      return (
        <div data-block-index={block.index}>
          {renderListGroups(block.listItems ?? [], block.content, blockAnnotations)}
        </div>
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
                  {block.headerRow.map((cell, ci) => {
                    const cellSegments = splitItemSegments(block.content, cell.start, cell.end, blockAnnotations);
                    return (
                      <th key={ci} className={`px-4 py-2 font-semibold text-ink ${alignClass(cell.align)}`}>
                        {renderSegments(cellSegments)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
            )}
            {block.bodyRows && (
              <tbody>
                {block.bodyRows.map((row, ri) => (
                  <tr key={ri} className="border-b border-rule last:border-b-0">
                    {row.map((cell, ci) => {
                      const cellSegments = splitItemSegments(block.content, cell.start, cell.end, blockAnnotations);
                      return (
                        <td key={ci} className={`px-4 py-2 ${alignClass(cell.align)}`}>
                          {renderSegments(cellSegments)}
                        </td>
                      );
                    })}
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
