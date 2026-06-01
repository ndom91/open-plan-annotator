import { useCallback, useState } from "react";
import type { Annotation } from "../utils/annotationSerializer.ts";

export type Decision = "approved" | "feedback";

export function useDecision() {
  const [isPending, setIsPending] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);

  const approve = useCallback(async () => {
    setIsPending(true);
    try {
      await fetch("/api/approve", { method: "POST" });
      setDecision("approved");
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
      setDecision("feedback");
    } finally {
      setIsPending(false);
    }
  }, []);

  return { approve, deny, isPending, decided: decision !== null, decision };
}
