import { useEffect, useMemo, useState } from "react";
import { hashString } from "../utils/hash.ts";

interface PlanPreferences {
  autoCloseOnSubmit: boolean;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  selfUpdatePossible: boolean;
  updateCommand: string;
}

interface PlanData {
  plan: string;
  version: number;
  history: string[];
  preferences: PlanPreferences;
  updateInfo: UpdateInfo | null;
}

export function usePlan() {
  const [data, setData] = useState<PlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    fetch("/api/plan")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d: PlanData) => {
        setData(d);
        setUpdateInfo(d.updateInfo);
        setIsLoading(false);

        // If the update check hasn't completed yet, poll once after 3s
        if (!d.updateInfo) {
          setTimeout(() => {
            fetch("/api/update-info")
              .then((r) => r.json())
              .then((info: UpdateInfo | null) => {
                if (info) setUpdateInfo(info);
              })
              .catch(() => {});
          }, 3000);
        }
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
    updateInfo,
    isLoading,
    error,
  };
}
