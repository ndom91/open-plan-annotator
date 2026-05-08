import type { Annotation } from "../utils/annotationSerializer.ts";
import { cn } from "../utils/cn.ts";

interface AnnotationSidebarProps {
  annotations: Annotation[];
  onRemove: (id: string) => void;
}

interface TypeConfig {
  label: string;
  bulletClass: string;
  bulletGlyph: React.ReactNode;
  pillClass: string;
  previewClass: string;
}

const typeConfig: Record<Annotation["type"], TypeConfig> = {
  comment: {
    label: "Comment",
    bulletClass: "bg-margin-note text-white",
    bulletGlyph: "?",
    pillClass: "text-margin-note",
    previewClass: "bg-margin-note-bg text-margin-note",
  },
  deletion: {
    label: "Delete",
    bulletClass: "bg-redline text-white",
    bulletGlyph: "−",
    pillClass: "text-redline",
    previewClass: "bg-redline-bg text-redline line-through decoration-redline/70",
  },
  replacement: {
    label: "Replace",
    bulletClass: "bg-replace text-white",
    bulletGlyph: "→",
    pillClass: "text-replace",
    previewClass: "bg-replace-bg text-replace",
  },
  insertion: {
    label: "Insert",
    bulletClass: "bg-approve text-white",
    bulletGlyph: "+",
    pillClass: "text-approve",
    previewClass: "bg-approve-bg text-approve",
  },
};

export function AnnotationSidebar({ annotations, onRemove }: AnnotationSidebarProps) {
  return (
    <div className="font-sans pb-4">
      <div className="flex items-center justify-between mb-4 pl-3 pr-1">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-widest">
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="w-3 h-3"
          >
            <path d="M1 8.74c0 .983.713 1.825 1.69 1.943.764.092 1.534.164 2.31.216a.75.75 0 0 1 .474.298l1.316 1.796a.25.25 0 0 0 .42 0l1.316-1.796a.75.75 0 0 1 .474-.298c.776-.052 1.546-.124 2.31-.216C12.287 10.565 13 9.723 13 8.74V4.26c0-.983-.713-1.825-1.69-1.943A44.077 44.077 0 0 0 7 2c-1.543 0-3.06.096-4.31.317C1.713 2.435 1 3.277 1 4.26v4.48Z" />
          </svg>
          Conversation
        </h3>
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-paper-edge border border-rule-subtle px-1 font-mono text-[10px] font-medium text-ink-tertiary tabular-nums">
          {annotations.length}
        </span>
      </div>
      <div className="space-y-3 relative">
        {annotations.map((ann, i) => {
          const cfg = typeConfig[ann.type];
          return (
            <div key={ann.id} className="animate-fade-in-up flex gap-3" style={{ animationDelay: `${i * 40}ms` }}>
              <div
                className={cn(
                  "shrink-0 mt-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold leading-none",
                  cfg.bulletClass,
                )}
                aria-hidden="true"
              >
                {cfg.bulletGlyph}
              </div>
              <div className="group relative flex-1 min-w-0 rounded-md border border-rule-subtle bg-paper p-2.5">
                <button
                  type="button"
                  onClick={() => onRemove(ann.id)}
                  className="absolute top-2 right-2 inline-flex items-center justify-center w-4 h-4 rounded-sm text-ink-tertiary leading-none cursor-pointer transition-colors duration-150 hover:text-redline focus-visible:ring-2 focus-visible:ring-accent/50 opacity-0 group-hover:opacity-100"
                  title="Remove annotation"
                  aria-label="Remove annotation"
                >
                  <svg
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="size-3"
                  >
                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                  </svg>
                </button>
                <div className="flex items-center justify-between gap-2 pr-5">
                  <span className={cn("text-[10px] font-bold uppercase tracking-widest leading-none", cfg.pillClass)}>
                    {cfg.label}
                  </span>
                  <span className="font-mono text-[10px] text-ink-tertiary tabular-nums leading-none">
                    on selection #{i + 1}
                  </span>
                </div>
                <div
                  className={cn(
                    "mt-2 px-2 py-1 rounded-sm text-[12px] font-mono leading-relaxed truncate",
                    cfg.previewClass,
                  )}
                >
                  {truncate(ann.text, 50)}
                </div>
                {ann.type === "replacement" && ann.replacement && (
                  <p className="mt-1.5 text-[12px] text-replace leading-relaxed">
                    <span aria-hidden="true">→</span> {truncate(ann.replacement, 60)}
                  </p>
                )}
                {ann.type === "insertion" && ann.replacement && (
                  <p className="mt-1.5 text-[12px] text-approve leading-relaxed">+ {truncate(ann.replacement, 60)}</p>
                )}
                {ann.type === "comment" && ann.comment && (
                  <p className="mt-1.5 text-[12px] text-ink-secondary leading-relaxed">{ann.comment}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
