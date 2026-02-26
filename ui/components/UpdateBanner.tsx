import { useCallback, useState } from "react";

interface UpdateBannerProps {
  currentVersion: string;
  latestVersion: string;
  selfUpdatePossible: boolean;
  updateCommand: string;
}

export function UpdateBanner({ currentVersion, latestVersion, selfUpdatePossible, updateCommand }: UpdateBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [errorCommand, setErrorCommand] = useState<string | null>(null);

  const handleSelfUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      const res = await fetch("/api/self-update", { method: "POST" });
      if (res.ok) {
        setResult("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setResult("error");
        setErrorCommand(data.updateCommand || updateCommand);
      }
    } catch {
      setResult("error");
      setErrorCommand(updateCommand);
    } finally {
      setUpdating(false);
    }
  }, [updateCommand]);

  if (dismissed) return null;

  if (result === "success") {
    return (
      <Banner color="approve">
        <span>
          Updated to <span className="font-mono font-medium">v{latestVersion}</span>. Changes take effect next run.
        </span>
        <DismissButton onClick={() => setDismissed(true)} />
      </Banner>
    );
  }

  if (result === "error") {
    return (
      <Banner color="warn">
        <span>
          Auto-update failed. Run:{" "}
          <code className="font-mono bg-ink/10 px-1.5 py-0.5 rounded text-xs">{errorCommand}</code>
        </span>
        <DismissButton onClick={() => setDismissed(true)} />
      </Banner>
    );
  }

  return (
    <Banner color="info">
      <span>
        Update available: <span className="font-mono text-ink-tertiary">v{currentVersion}</span>
        {" \u2192 "}
        <span className="font-mono font-medium text-accent">v{latestVersion}</span>
      </span>
      <div className="flex items-center gap-2">
        {selfUpdatePossible ? (
          <button
            type="button"
            onClick={handleSelfUpdate}
            disabled={updating}
            className="px-3 py-1 rounded text-xs font-medium bg-accent/15 text-accent hover:bg-accent/25 cursor-pointer transition-colors disabled:opacity-50"
          >
            {updating ? "Updating\u2026" : "Update now"}
          </button>
        ) : (
          <code className="font-mono text-xs bg-ink/10 px-2 py-1 rounded">{updateCommand}</code>
        )}
        <DismissButton onClick={() => setDismissed(true)} />
      </div>
    </Banner>
  );
}

const COLOR_MAP = {
  info: "bg-accent/8 ring-accent/15 text-ink-secondary",
  approve: "bg-approve/10 ring-approve/20 text-approve",
  warn: "bg-margin-note-bg/60 ring-margin-note/20 text-margin-note",
} as const;

function Banner({ color, children }: { color: keyof typeof COLOR_MAP; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl mt-2 px-4">
      <div
        className={`flex items-center justify-between gap-3 px-4 py-2 rounded-lg ring-1 text-sm ${COLOR_MAP[color]}`}
      >
        {children}
      </div>
    </div>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-ink-tertiary hover:text-ink-secondary p-1 cursor-pointer transition-colors"
      aria-label="Dismiss update notification"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
      </svg>
    </button>
  );
}
