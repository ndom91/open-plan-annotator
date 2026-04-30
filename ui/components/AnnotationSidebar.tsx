import type { Annotation } from "../utils/annotationSerializer.ts";
import { cn } from "../utils/cn.ts";

interface AnnotationSidebarProps {
  annotations: Annotation[];
  onRemove: (id: string) => void;
}

const typeConfig: Record<Annotation["type"], { label: string; pillClass: string; borderClass: string }> = {
  deletion: { label: "Delete", pillClass: "text-redline bg-redline-bg/70", borderClass: "border-l-redline" },
  replacement: { label: "Replace", pillClass: "text-ink bg-ink/10", borderClass: "border-l-ink-secondary" },
  insertion: { label: "Insert", pillClass: "text-approve bg-approve/12", borderClass: "border-l-approve" },
  comment: {
    label: "Comment",
    pillClass: "text-margin-note bg-margin-note-bg/70",
    borderClass: "border-l-margin-note",
  },
};

export function AnnotationSidebar({ annotations, onRemove }: AnnotationSidebarProps) {
  return (
    <div className="pb-4">
      <div className="flex items-center justify-between mb-4 pl-1">
        <h3 className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-[0.24em]">Annotations</h3>
        <span className="text-[10px] font-mono font-semibold text-ink-tertiary bg-ink/8 px-1.5 py-0.5 rounded-sm">
          {annotations.length}
        </span>
      </div>
      <div className="space-y-3 relative">
        {annotations.map((ann, i) => {
          const cfg = typeConfig[ann.type];
          return (
            <div key={ann.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
              <div
                className={cn(
                  "group relative rounded-sm border border-rule-subtle bg-paper/95 p-3.5 card-lift border-l-[3px] shadow-[0_1px_2px_oklch(0_0_0/0.12)]",
                  cfg.borderClass,
                )}
              >
                <button
                  type="button"
                  onClick={() => onRemove(ann.id)}
                  className="absolute top-2.5 right-2.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-paper-edge border border-rule font-mono text-[11px] font-bold text-ink-secondary leading-none shadow-[0_1px_2px_oklch(0_0_0/0.18)] cursor-pointer transition-colors duration-150 hover:bg-redline-bg/70 hover:border-redline/60 hover:text-redline focus-visible:ring-2 focus-visible:ring-accent/50"
                  title="Remove annotation"
                  aria-label="Remove annotation"
                >
                  <span className="group-hover:hidden">{i + 1}</span>
                  <svg
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="hidden group-hover:block size-3"
                  >
                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                  </svg>
                </button>
                <div className="pr-7">
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
                    <p className="mt-1.5 text-xs text-approve leading-relaxed">+ {truncate(ann.replacement, 60)}</p>
                  )}
                  {ann.comment && (
                    <p className="mt-1.5 text-xs text-ink-secondary/80 leading-relaxed italic">{ann.comment}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}\u2026` : s;
}
