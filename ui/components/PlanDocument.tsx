import type { Annotation } from "../utils/annotationSerializer.ts";
import type { Block } from "../utils/markdown.ts";
import { BlockComponent } from "./Block.tsx";

interface PlanDocumentProps {
  blocks: Block[];
  annotations: Annotation[];
  onRemoveAnnotation?: (id: string) => void;
}

export function PlanDocument({ blocks, annotations, onRemoveAnnotation }: PlanDocumentProps) {
  return (
    <article className="max-w-none">
      {blocks.map((block) => (
        <BlockComponent
          key={block.index}
          block={block}
          annotations={annotations}
          onRemoveAnnotation={onRemoveAnnotation}
        />
      ))}
    </article>
  );
}
