import type { Block } from "../utils/markdown.ts";
import type { Annotation } from "../utils/annotationSerializer.ts";
import { BlockComponent } from "./Block.tsx";

interface PlanDocumentProps {
  blocks: Block[];
  annotations: Annotation[];
}

export function PlanDocument({ blocks, annotations }: PlanDocumentProps) {
  return (
    <div className="max-w-none">
      {blocks.map((block) => (
        <BlockComponent key={block.index} block={block} annotations={annotations} />
      ))}
    </div>
  );
}
