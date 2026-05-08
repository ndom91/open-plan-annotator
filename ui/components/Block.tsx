import { createContext, useContext } from "react";
import type { Annotation } from "../utils/annotationSerializer.ts";
import { renderInlineMarkdown } from "../utils/inlineMarkdown.tsx";
import type { Block, ListItem } from "../utils/markdown.ts";
import { HighlightedCode } from "./HighlightedCode.tsx";

const RemoveAnnotationContext = createContext<((id: string) => void) | undefined>(undefined);

export const RemoveAnnotationProvider = RemoveAnnotationContext.Provider;

interface BlockProps {
  block: Block;
  annotations: Annotation[];
  onRemoveAnnotation?: (id: string) => void;
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

const annotationTypeClass: Record<Annotation["type"], string> = {
  deletion: "annotation-index--delete",
  replacement: "annotation-index--replace",
  insertion: "annotation-index--insert",
  comment: "annotation-index--comment",
};

function AnnotationIndex({ annotation, annotations }: { annotation: Annotation; annotations: Annotation[] }) {
  const index = annotations.findIndex((ann) => ann.id === annotation.id) + 1;
  const onRemove = useContext(RemoveAnnotationContext);
  const typeClass = annotationTypeClass[annotation.type];
  if (index <= 0) return null;
  if (!onRemove) {
    return <sup className={`annotation-index ${typeClass}`}>{index}</sup>;
  }
  return (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onRemove(annotation.id);
      }}
      className={`annotation-index annotation-index-button ${typeClass}`}
      title="Remove annotation"
      aria-label={`Remove annotation ${index}`}
    >
      <span className="annotation-index-num">{index}</span>
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 18 18"
        fill="currentColor"
        className="annotation-index-x"
      >
        <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
      </svg>
    </button>
  );
}

function renderAnnotationIndex(annotation: Annotation, annotations: Annotation[]) {
  return <AnnotationIndex annotation={annotation} annotations={annotations} />;
}

function renderSegments(segments: Segment[], annotations: Annotation[], useInline = true) {
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
        <span key={i} data-seg-start={seg.originalStart} data-seg-end={seg.originalEnd} {...segSourceAttr}>
          <span
            className="annotation-mark bg-redline-bg text-redline line-through decoration-redline/80 decoration-2"
            title="Marked for removal"
          >
            {content}
          </span>
          {renderAnnotationIndex(seg.annotation, annotations)}
        </span>
      );
    }
    if (seg.annotation.type === "replacement") {
      return (
        <span key={i} data-seg-start={seg.originalStart} data-seg-end={seg.originalEnd} {...segSourceAttr}>
          <span className="annotation-mark bg-redline-bg text-redline line-through decoration-redline/75 decoration-2">
            {content}
          </span>
          <span
            className="annotation-mark text-replace bg-replace-bg border-b-2 border-replace/60 ml-1 not-italic no-underline"
            data-replacement="true"
            style={{ textDecoration: "none" }}
          >
            {seg.annotation.replacement}
          </span>
          {renderAnnotationIndex(seg.annotation, annotations)}
        </span>
      );
    }
    if (seg.annotation.type === "insertion") {
      return (
        <span key={i} data-seg-start={seg.originalStart} data-seg-end={seg.originalEnd} {...segSourceAttr}>
          {content}
          <span
            className="annotation-mark text-approve bg-approve-bg border-b-2 border-approve/60 ml-1"
            data-replacement="true"
          >
            +{seg.annotation.replacement}
          </span>
          {renderAnnotationIndex(seg.annotation, annotations)}
        </span>
      );
    }
    // comment
    return (
      <span key={i} data-seg-start={seg.originalStart} data-seg-end={seg.originalEnd} {...segSourceAttr}>
        <span
          className="group/comment annotation-mark relative bg-margin-note-bg border-b-2 border-margin-note/70 cursor-help"
          role="note"
          aria-label={seg.annotation.comment ? `Comment: ${seg.annotation.comment}` : undefined}
        >
          {content}
          {seg.annotation.comment && (
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 rounded-md bg-inset border border-rule shadow-[0_4px_12px_oklch(0_0_0/0.15)] font-sans text-xs text-ink-secondary leading-relaxed whitespace-pre-wrap w-max max-w-160 opacity-0 group-hover/comment:opacity-100 group-focus-within/comment:opacity-100 transition-opacity duration-200 z-50">
              <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-rule" />
              {seg.annotation.comment}
            </span>
          )}
        </span>
        {renderAnnotationIndex(seg.annotation, annotations)}
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
  itemAnnotations: Annotation[],
  allAnnotations: Annotation[],
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
          const itemSegments = splitItemSegments(content, item.start, item.end, itemAnnotations);

          return (
            <li
              key={`${group.marker}-${groupIndex}-${itemIndex}`}
              className="text-[14.5px] text-ink-secondary leading-[1.65]"
            >
              {renderSegments(itemSegments, allAnnotations)}
              {item.children.length > 0 &&
                renderListGroups(item.children, content, itemAnnotations, allAnnotations, true)}
            </li>
          );
        })}
      </ListTag>
    );
  });
}

export function BlockComponent({ block, annotations, onRemoveAnnotation }: BlockProps) {
  const blockAnnotations = annotations.filter((a) => a.blockIndex === block.index);
  const segments = splitIntoSegments(block.content, blockAnnotations);
  const inner = renderBlock(block, segments, blockAnnotations, annotations);
  return <RemoveAnnotationProvider value={onRemoveAnnotation}>{inner}</RemoveAnnotationProvider>;
}

function renderBlock(block: Block, segments: Segment[], blockAnnotations: Annotation[], annotations: Annotation[]) {
  switch (block.type) {
    case "heading": {
      const level = Math.min(Math.max(block.level ?? 1, 1), 6);
      const sizeClasses: Record<number, string> = {
        1: "font-sans text-[26px] font-semibold leading-[1.2] tracking-[-0.015em] mt-0 mb-8 text-ink scroll-mt-20",
        2: "font-sans text-[18px] font-semibold leading-[1.3] tracking-[-0.01em] mt-12 mb-3 pb-2 text-ink scroll-mt-20 border-b border-dashed border-rule-subtle",
        3: "font-sans text-[14.5px] font-semibold leading-[1.35] mt-8 mb-2 text-ink scroll-mt-20",
        4: "font-sans text-[14.5px] font-semibold mt-6 mb-2 text-ink scroll-mt-20",
        5: "font-sans text-[11px] font-semibold uppercase tracking-widest mt-6 mb-1.5 text-ink-tertiary scroll-mt-20",
        6: "font-sans text-[10px] font-semibold uppercase tracking-widest mt-5 mb-1.5 text-ink-tertiary scroll-mt-20",
      };
      const classes = sizeClasses[level] ?? sizeClasses[1];
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      return (
        <Tag data-block-index={block.index} className={classes}>
          {renderSegments(segments, annotations)}
        </Tag>
      );
    }

    case "code":
      return (
        <div
          data-block-index={block.index}
          className="my-6 rounded-md bg-code-bg border border-code-edge overflow-hidden text-[#e6edf3]"
        >
          {block.lang && (
            <div className="px-4 py-2 border-b border-code-edge flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#8a93a0] uppercase tracking-widest">{block.lang}</span>
              <span className="flex items-center gap-1.5" aria-hidden="true">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ee7065]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#e7c073]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#4ec9a4]" />
              </span>
            </div>
          )}
          <HighlightedCode code={block.content} lang={block.lang} />
        </div>
      );

    case "list": {
      return (
        <div data-block-index={block.index}>
          {renderListGroups(block.listItems ?? [], block.content, blockAnnotations, annotations)}
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
        <div data-block-index={block.index} className="my-6 overflow-x-auto rounded border border-rule">
          <table className="w-full font-sans text-[13px] text-ink-secondary">
            {block.headerRow && (
              <thead>
                <tr className="border-b border-rule bg-inset">
                  {block.headerRow.map((cell, ci) => {
                    const cellSegments = splitItemSegments(block.content, cell.start, cell.end, blockAnnotations);
                    return (
                      <th key={ci} className={`px-4 py-2 font-semibold text-ink ${alignClass(cell.align)}`}>
                        {renderSegments(cellSegments, annotations)}
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
                          {renderSegments(cellSegments, annotations)}
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
      return <hr data-block-index={block.index} className="my-12 border-0 h-px bg-rule-subtle" />;

    case "blockquote":
      return (
        <blockquote
          data-block-index={block.index}
          className="my-6 pl-5 border-l-2 border-rule py-1 pr-3 text-[16px] text-ink-secondary italic leading-relaxed"
        >
          {renderSegments(segments, annotations)}
        </blockquote>
      );

    default:
      return (
        <p data-block-index={block.index} className="text-[14.5px] text-ink-secondary leading-[1.65] my-4">
          {renderSegments(segments, annotations)}
        </p>
      );
  }
}
