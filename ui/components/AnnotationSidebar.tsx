import type { Annotation } from "../utils/annotationSerializer.ts";
import { cn } from "../utils/cn.ts";

interface AnnotationSidebarProps {
  annotations: Annotation[];
  onRemove: (id: string) => void;
}

const typeConfig: Record<Annotation["type"], { label: string; pillClass: string; barClass: string }> = {
  deletion: { label: "Delete", pillClass: "text-redline bg-redline-bg/60", barClass: "bg-redline" },
  replacement: { label: "Replace", pillClass: "text-ink-secondary bg-ink/8", barClass: "bg-ink-secondary" },
  insertion: { label: "Insert", pillClass: "text-approve bg-approve/10", barClass: "bg-approve" },
  comment: { label: "Comment", pillClass: "text-margin-note bg-margin-note-bg/60", barClass: "bg-margin-note" },
};

export function AnnotationSidebar({ annotations, onRemove }: AnnotationSidebarProps) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-widest mb-5 pl-1">Annotations</h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-1.25 top-2 bottom-2 w-px bg-rule-subtle" />

        <div className="space-y-3 relative">
          {annotations.map((ann, i) => {
            const cfg = typeConfig[ann.type];
            return (
              <div key={ann.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                {/* Timeline dot */}
                <div className="flex items-start gap-3">
                  <div className={cn("w-2.75 h-2.75 rounded-full mt-3.5 shrink-0 ring-2 ring-desk", cfg.barClass)} />

                  <div
                    className={cn(
                      "group flex-1 rounded-sm border border-rule-subtle bg-paper p-3.5 card-lift",
                      "border-l-[3px]",
                      ann.type === "deletion" && "border-l-redline",
                      ann.type === "replacement" && "border-l-ink-secondary",
                      ann.type === "insertion" && "border-l-approve",
                      ann.type === "comment" && "border-l-margin-note",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                            cfg.pillClass,
                          )}
                        >
                          {cfg.label}
                        </span>
                        <p
                          className={cn(
                            "mt-1 text-xs leading-relaxed",
                            ann.type === "deletion" ? "line-through text-ink-tertiary" : "text-ink-secondary",
                          )}
                        >
                          {truncate(ann.text, 60)}
                        </p>
                        {ann.type === "replacement" && ann.replacement && (
                          <p className="mt-1.5 text-xs text-approve leading-relaxed">
                            &rarr; {truncate(ann.replacement, 60)}
                          </p>
                        )}
                        {ann.type === "insertion" && ann.replacement && (
                          <p className="mt-1.5 text-xs text-approve leading-relaxed">
                            + {truncate(ann.replacement, 60)}
                          </p>
                        )}
                        {ann.comment && (
                          <p className="mt-1.5 text-xs text-ink-secondary/80 leading-relaxed italic">{ann.comment}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(ann.id)}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-ink-tertiary hover:text-ink-secondary transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-accent/50 rounded-sm p-0.5"
                        title="Remove"
                        aria-label="Remove annotation"
                      >
                        <svg
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className="w-3 h-3"
                        >
                          <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}\u2026` : s;
}
