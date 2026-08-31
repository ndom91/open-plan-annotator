import { useCallback, useEffect, useRef, useState } from "react";
import type { Annotation } from "../utils/annotationSerializer.ts";

export type Decision = "approved" | "feedback";
export type ScheduledDecision = Decision;

const SEND_DELAY_MS = 5000;

export function useDecision() {
  const [isPending, setIsPending] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [scheduledDecision, setScheduledDecision] = useState<ScheduledDecision | null>(null);
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearScheduledDecision = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timerRef.current = null;
    intervalRef.current = null;
  }, []);

  useEffect(() => clearScheduledDecision, [clearScheduledDecision]);

  const schedule = useCallback(
    (nextDecision: ScheduledDecision, annotations?: Annotation[]) => {
      if (isPending || decision || scheduledDecision) return;

      setScheduledDecision(nextDecision);
      setCountdown(5);
      intervalRef.current = setInterval(() => {
        setCountdown((seconds) => Math.max(seconds - 1, 0));
      }, 1000);
      timerRef.current = setTimeout(() => {
        clearScheduledDecision();
        setScheduledDecision(null);
        setIsPending(true);

        const request =
          nextDecision === "approved"
            ? fetch("/api/approve", { method: "POST" })
            : fetch("/api/deny", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ annotations }),
              });

        void request
          .then(
            () => setDecision(nextDecision),
            () => {},
          )
          .finally(() => setIsPending(false));
      }, SEND_DELAY_MS);
    },
    [clearScheduledDecision, decision, isPending, scheduledDecision],
  );

  const approve = useCallback(() => schedule("approved"), [schedule]);
  const deny = useCallback((annotations: Annotation[]) => schedule("feedback", annotations), [schedule]);
  const cancel = useCallback(() => {
    clearScheduledDecision();
    setScheduledDecision(null);
    setCountdown(5);
  }, [clearScheduledDecision]);

  return { approve, deny, cancel, isPending, decided: decision !== null, decision, scheduledDecision, countdown };
}
