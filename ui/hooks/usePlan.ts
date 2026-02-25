import { useEffect, useMemo, useState } from "react";
import { hashString } from "../utils/hash.ts";

interface PlanData {
  plan: string;
  version: number;
  history: string[];
  preferences?: {
    autoCloseOnSubmit?: boolean;
  };
}

export function usePlan() {
  const [data, setData] = useState<PlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plan")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d: PlanData) => {
        setData(d);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  const planHash = useMemo(() => (data?.plan ? hashString(data.plan) : null), [data?.plan]);

  return {
    plan: data?.plan ?? null,
    planHash,
    version: data?.version ?? 1,
    history: data?.history ?? [],
    autoCloseOnSubmit: data?.preferences?.autoCloseOnSubmit ?? false,
    isLoading,
    error,
  };
}
