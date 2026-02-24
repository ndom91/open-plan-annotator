import type { Annotation } from "../utils/annotationSerializer.ts";

interface AnnotationSidebarProps {
  annotations: Annotation[];
  onRemove: (id: string) => void;
}

export function AnnotationSidebar({ annotations, onRemove }: AnnotationSidebarProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Annotations ({annotations.length})</h3>
      <div className="space-y-3">
        {annotations.map((ann) => (
          <div key={ann.id} className="group rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900/50">
            <div className="flex items-start justify-between gap-2">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                  ann.type === "deletion"
                    ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                    : "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400"
                }`}
              >
                {ann.type === "deletion" ? "Delete" : "Comment"}
              </span>
              <button
                onClick={() => onRemove(ann.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-opacity"
                title="Remove annotation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
              </button>
            </div>
            <p className={`mt-2 text-xs leading-relaxed ${ann.type === "deletion" ? "line-through text-gray-500" : "text-gray-600 dark:text-gray-400"}`}>
              "{ann.text.length > 80 ? ann.text.slice(0, 80) + "..." : ann.text}"
            </p>
            {ann.comment && <p className="mt-1.5 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{ann.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
