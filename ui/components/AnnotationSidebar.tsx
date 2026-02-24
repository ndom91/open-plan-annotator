import type { Annotation } from "../utils/annotationSerializer.ts";

interface AnnotationSidebarProps {
  annotations: Annotation[];
  onRemove: (id: string) => void;
}

export function AnnotationSidebar({ annotations, onRemove }: AnnotationSidebarProps) {
  return (
    <div>
      <h3 className="text-xs font-medium text-ink-tertiary uppercase tracking-widest mb-4">
        Annotations
      </h3>
      <div className="space-y-2.5">
        {annotations.map((ann) => (
          <div key={ann.id} className="group rounded-md border border-rule-subtle bg-paper p-3 hover:border-rule transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div
                className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                  ann.type === "deletion" ? "bg-redline" : "bg-margin-note"
                }`}
              />
              <p className={`flex-1 text-xs leading-relaxed ${ann.type === "deletion" ? "line-through text-ink-tertiary" : "text-ink-secondary"}`}>
                {ann.text.length > 60 ? ann.text.slice(0, 60) + "..." : ann.text}
              </p>
              <button
                onClick={() => onRemove(ann.id)}
                className="opacity-0 group-hover:opacity-100 text-ink-tertiary hover:text-ink-secondary transition-opacity shrink-0"
                title="Remove"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
              </button>
            </div>
            {ann.comment && (
              <p className="mt-1.5 ml-3.5 text-xs text-ink-secondary/80 leading-relaxed italic">
                {ann.comment}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
