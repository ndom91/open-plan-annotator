import type { Annotation } from "../utils/annotationSerializer.ts";
import { AnnotationCard } from "./AnnotationCard.tsx";

interface AnnotationSidebarProps {
  annotations: Annotation[];
  onRemove: (id: string) => void;
}

export function AnnotationSidebar({ annotations, onRemove }: AnnotationSidebarProps) {
  return (
    <div className="font-sans pb-4">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-secondary uppercase tracking-widest">
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="w-3 h-3"
          >
            <path d="M1 8.74c0 .983.713 1.825 1.69 1.943.764.092 1.534.164 2.31.216a.75.75 0 0 1 .474.298l1.316 1.796a.25.25 0 0 0 .42 0l1.316-1.796a.75.75 0 0 1 .474-.298c.776-.052 1.546-.124 2.31-.216C12.287 10.565 13 9.723 13 8.74V4.26c0-.983-.713-1.825-1.69-1.943A44.077 44.077 0 0 0 7 2c-1.543 0-3.06.096-4.31.317C1.713 2.435 1 3.277 1 4.26v4.48Z" />
          </svg>
          Annotations
        </h3>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink-tertiary px-1.5 font-mono text-[11px] font-medium text-paper tabular-nums">
          {annotations.length}
        </span>
      </div>
      <div className="relative">
        {annotations.map((ann, i) => (
          <AnnotationCard
            key={ann.id}
            annotation={ann}
            index={i}
            isLast={i === annotations.length - 1}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}
