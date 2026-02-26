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
  assetSha256: string | null;
  updateCommand: string;
}

interface PlanData {
  plan: string;
  version: number;
  history: string[];
  preferences: PlanPreferences;
  updateInfo: UpdateInfo | null;
}

const UPDATE_POLL_BASE_MS = 1500;
const UPDATE_POLL_MAX_BACKOFF_MS = 30_000;

export function usePlan() {
  const [data, setData] = useState<PlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;

    let consecutiveUpdateFailures = 0;

    const scheduleUpdatePoll = () => {
      const delay = Math.min(UPDATE_POLL_BASE_MS * 2 ** consecutiveUpdateFailures, UPDATE_POLL_MAX_BACKOFF_MS);

      pollTimeout = setTimeout(() => {
        fetch("/api/update-info")
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then((info: UpdateInfo | null) => {
            if (cancelled) return;
            if (info) {
              setUpdateInfo(info);
              return;
            }

            consecutiveUpdateFailures = 0;
            scheduleUpdatePoll();
          })
          .catch(() => {
            if (!cancelled) {
              consecutiveUpdateFailures += 1;
              scheduleUpdatePoll();
            }
          });
      }, delay);
    };

    fetch("/api/plan")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d: PlanData) => {
        if (cancelled) return;
        setData(d);
        setUpdateInfo(d.updateInfo);
        setIsLoading(false);

        // Keep polling until update check completes so status eventually appears.
        if (!d.updateInfo) {
          scheduleUpdatePoll();
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
    };
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
