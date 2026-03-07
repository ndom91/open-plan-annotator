import { type ReactNode, useState } from "react";

interface UpdateBannerProps {
  currentVersion: string;
  latestVersion: string;
  updateInstructions: string;
}

export function UpdateBanner({ currentVersion, latestVersion, updateInstructions }: UpdateBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <Banner color="info">
      <span>
        Update available: <span className="font-mono text-ink-tertiary">v{currentVersion}</span>
        {" -> "}
        <span className="font-mono font-medium text-accent">v{latestVersion}</span>
      </span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-ink-secondary">{updateInstructions}</span>
        <DismissButton onClick={() => setDismissed(true)} />
      </div>
    </Banner>
  );
}

const COLOR_MAP = {
  info: "bg-accent/8 ring-accent/15 text-ink-secondary",
} as const;

function Banner({ color, children }: { color: keyof typeof COLOR_MAP; children: ReactNode }) {
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
