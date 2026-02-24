import { useState, useCallback, useEffect, useRef } from "react";
import type { Annotation } from "../utils/annotationSerializer.ts";
import type { ResolvedSelection } from "../utils/offsetResolver.ts";

const STORAGE_PREFIX = "ope:annotations:";

function loadAnnotations(key: string): Annotation[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveAnnotations(key: string, annotations: Annotation[]) {
  try {
    if (annotations.length === 0) {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } else {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(annotations));
    }
  } catch {
    // localStorage full or unavailable — non-critical
  }
}

export function useAnnotations(planHash: string | null) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const initialized = useRef(false);

  // Load from localStorage once we have the plan hash
  useEffect(() => {
    if (!planHash || initialized.current) return;
    const stored = loadAnnotations(planHash);
    if (stored.length > 0) {
      setAnnotations(stored);
    }
    initialized.current = true;
  }, [planHash]);

  // Persist to localStorage on change (skip the initial load)
  useEffect(() => {
    if (!planHash || !initialized.current) return;
    saveAnnotations(planHash, annotations);
  }, [planHash, annotations]);

  const hasOverlap = useCallback(
    (blockIndex: number, start: number, end: number) => {
      return annotations.some((a) => a.blockIndex === blockIndex && a.startOffset < end && a.endOffset > start);
    },
    [annotations],
  );

  const addAnnotation = useCallback(
    (selection: ResolvedSelection, type: Annotation["type"], extra?: { comment?: string; replacement?: string }) => {
      if (hasOverlap(selection.blockIndex, selection.startOffset, selection.endOffset)) return;
      const annotation: Annotation = {
        id: crypto.randomUUID(),
        type,
        text: selection.text,
        comment: extra?.comment,
        replacement: extra?.replacement,
        blockIndex: selection.blockIndex,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        createdAt: new Date().toISOString(),
      };
      setAnnotations((prev) => [...prev, annotation]);
    },
    [hasOverlap],
  );

  const addDeletion = useCallback((sel: ResolvedSelection) => addAnnotation(sel, "deletion"), [addAnnotation]);

  const addComment = useCallback((sel: ResolvedSelection, comment: string) => addAnnotation(sel, "comment", { comment }), [addAnnotation]);

  const addReplacement = useCallback((sel: ResolvedSelection, replacement: string) => addAnnotation(sel, "replacement", { replacement }), [addAnnotation]);

  const addInsertion = useCallback((sel: ResolvedSelection, insertText: string) => addAnnotation(sel, "insertion", { replacement: insertText }), [addAnnotation]);

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { annotations, addDeletion, addComment, addReplacement, addInsertion, removeAnnotation };
}
