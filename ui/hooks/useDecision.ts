import { useState, useCallback } from "react";
import type { Annotation } from "../utils/annotationSerializer.ts";

export function useDecision() {
  const [isPending, setIsPending] = useState(false);
  const [decided, setDecided] = useState(false);

  const approve = useCallback(async () => {
    setIsPending(true);
    try {
      await fetch("/api/approve", { method: "POST" });
      setDecided(true);
    } finally {
      setIsPending(false);
    }
  }, []);

  const deny = useCallback(async (annotations: Annotation[]) => {
    setIsPending(true);
    try {
      await fetch("/api/deny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations }),
      });
      setDecided(true);
    } finally {
      setIsPending(false);
    }
  }, []);

  return { approve, deny, isPending, decided };
}
