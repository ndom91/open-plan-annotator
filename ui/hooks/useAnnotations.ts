import { useState, useCallback } from "react";
import type { Annotation } from "../utils/annotationSerializer.ts";
import type { ResolvedSelection } from "../utils/offsetResolver.ts";

export function useAnnotations() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  const hasOverlap = useCallback(
    (blockIndex: number, start: number, end: number) => {
      return annotations.some((a) => a.blockIndex === blockIndex && a.startOffset < end && a.endOffset > start);
    },
    [annotations],
  );

  const addDeletion = useCallback(
    (selection: ResolvedSelection) => {
      if (hasOverlap(selection.blockIndex, selection.startOffset, selection.endOffset)) return;
      const annotation: Annotation = {
        id: crypto.randomUUID(),
        type: "deletion",
        text: selection.text,
        blockIndex: selection.blockIndex,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        createdAt: new Date().toISOString(),
      };
      setAnnotations((prev) => [...prev, annotation]);
    },
    [hasOverlap],
  );

  const addComment = useCallback(
    (selection: ResolvedSelection, comment: string) => {
      if (hasOverlap(selection.blockIndex, selection.startOffset, selection.endOffset)) return;
      const annotation: Annotation = {
        id: crypto.randomUUID(),
        type: "comment",
        text: selection.text,
        comment,
        blockIndex: selection.blockIndex,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        createdAt: new Date().toISOString(),
      };
      setAnnotations((prev) => [...prev, annotation]);
    },
    [hasOverlap],
  );

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { annotations, addDeletion, addComment, removeAnnotation };
}
