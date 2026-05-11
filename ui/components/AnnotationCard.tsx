import type { Annotation } from "../utils/annotationSerializer.ts";
import { cn } from "../utils/cn.ts";

interface TypeConfig {
  label: string;
  bulletClass: string;
  bulletGlyph: React.ReactNode;
  pillClass: string;
  previewClass: string;
  indexClass: string;
}

const typeConfig: Record<Annotation["type"], TypeConfig> = {
  comment: {
    label: "Comment",
    bulletClass: "bg-margin-note text-white",
    bulletGlyph: "?",
    pillClass: "text-margin-note",
    previewClass: "bg-margin-note-bg text-margin-note",
    indexClass: "annotation-index--comment",
  },
  deletion: {
    label: "Delete",
    bulletClass: "bg-redline text-white",
    bulletGlyph: "−",
    pillClass: "text-redline",
    previewClass: "bg-redline-bg text-redline line-through decoration-redline/70",
    indexClass: "annotation-index--delete",
  },
  replacement: {
    label: "Replace",
    bulletClass: "bg-replace text-white",
    bulletGlyph: "→",
    pillClass: "text-replace",
    previewClass: "bg-replace-bg text-replace",
    indexClass: "annotation-index--replace",
  },
  insertion: {
    label: "Insert",
    bulletClass: "bg-approve text-white",
    bulletGlyph: "+",
    pillClass: "text-approve",
    previewClass: "bg-approve-bg text-approve",
    indexClass: "annotation-index--insert",
  },
};

interface AnnotationCardProps {
  annotation: Annotation;
  index: number;
  isLast: boolean;
  onRemove: (id: string) => void;
}

export function AnnotationCard({ annotation, index, isLast, onRemove }: AnnotationCardProps) {
  const cfg = typeConfig[annotation.type];

  return (
    <div
      className={cn("animate-fade-in-up flex gap-3", !isLast && "pb-3")}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="shrink-0 flex flex-col items-center">
        <div
          className={cn(
            "mt-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold leading-none",
            cfg.bulletClass,
          )}
          aria-hidden="true"
        >
          {cfg.bulletGlyph}
        </div>
        {!isLast && <div className="w-px flex-1 bg-rule mt-1" aria-hidden="true" />}
      </div>
      <div className="annotation-card group relative flex-1 min-w-0 rounded-md border border-rule-subtle bg-paper px-2.5 pt-1.5 pb-2.5">
        <div className="flex items-center justify-between gap-2 h-5">
          <span className={cn("text-[11px] font-bold uppercase tracking-wide leading-none", cfg.pillClass)}>
            {cfg.label}
          </span>
          <button
            type="button"
            onClick={() => onRemove(annotation.id)}
            className={cn(
              "annotation-index annotation-index-button !top-0 group-hover:bg-redline-bg group-hover:border-redline group-hover:text-redline group-focus-within:bg-redline-bg group-focus-within:border-redline group-focus-within:text-redline",
              cfg.indexClass,
            )}
            title="Remove annotation"
            aria-label={`Remove annotation ${index + 1}`}
          >
            <span className="annotation-index-num">{index + 1}</span>
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
        </div>
        <div
          className={cn("mt-2 px-2 py-1 rounded-sm text-[12px] font-mono leading-relaxed truncate", cfg.previewClass)}
        >
          {truncate(annotation.text, 50)}
        </div>
        {annotation.type === "replacement" && annotation.replacement && (
          <p className="mt-1.5 text-[12px] text-replace leading-relaxed">
            <span aria-hidden="true">→</span> {truncate(annotation.replacement, 60)}
          </p>
        )}
        {annotation.type === "insertion" && annotation.replacement && (
          <p className="mt-1.5 text-[12px] text-approve leading-relaxed">+ {truncate(annotation.replacement, 60)}</p>
        )}
        {annotation.type === "comment" && annotation.comment && (
          <p className="mt-1.5 text-[12px] text-ink-secondary leading-relaxed">{annotation.comment}</p>
        )}
      </div>
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
