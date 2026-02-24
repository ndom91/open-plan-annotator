import type { Annotation } from "../utils/annotationSerializer.ts";
import { cn } from "../utils/cn.ts";

interface AnnotationSidebarProps {
  annotations: Annotation[];
  onRemove: (id: string) => void;
}

const typeConfig: Record<Annotation["type"], { label: string; color: string }> = {
  deletion: { label: "Delete", color: "bg-redline" },
  replacement: { label: "Replace", color: "bg-ink-secondary" },
  insertion: { label: "Insert", color: "bg-approve" },
  comment: { label: "Comment", color: "bg-margin-note" },
};

export function AnnotationSidebar({ annotations, onRemove }: AnnotationSidebarProps) {
  return (
    <div>
      <h3 className="text-xs font-medium text-ink-tertiary uppercase tracking-widest mb-4">Annotations</h3>
      <div className="space-y-2.5">
        {annotations.map((ann) => {
          const cfg = typeConfig[ann.type];
          return (
            <div
              key={ann.id}
              className="group rounded-md border border-rule-subtle bg-paper p-3 hover:border-rule transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", cfg.color)} />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-medium text-ink-tertiary uppercase tracking-wide">{cfg.label}</span>
                  <p
                    className={cn(
                      "mt-0.5 text-xs leading-relaxed",
                      ann.type === "deletion" ? "line-through text-ink-tertiary" : "text-ink-secondary",
                    )}
                  >
                    {truncate(ann.text, 60)}
                  </p>
                  {ann.type === "replacement" && ann.replacement && (
                    <p className="mt-1 text-xs text-approve leading-relaxed">&rarr; {truncate(ann.replacement, 60)}</p>
                  )}
                  {ann.type === "insertion" && ann.replacement && (
                    <p className="mt-1 text-xs text-approve leading-relaxed">+ {truncate(ann.replacement, 60)}</p>
                  )}
                  {ann.comment && (
                    <p className="mt-1 text-xs text-ink-secondary/80 leading-relaxed italic">{ann.comment}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(ann.id)}
                  className="opacity-0 group-hover:opacity-100 text-ink-tertiary hover:text-ink-secondary transition-opacity shrink-0"
                  title="Remove"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}...` : s;
}
