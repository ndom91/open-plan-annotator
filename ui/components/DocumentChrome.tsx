import { cn } from "../utils/cn.ts";

interface DocumentChromeProps {
  isViewingHistory: boolean;
  activeVersion: number;
  onReturnToCurrent: () => void;
  showDiff: boolean;
  onToggleDiff: () => void;
  hasPreviousVersion: boolean;
  previousVersion: number;
}

export function DocumentChrome({
  isViewingHistory,
  activeVersion,
  onReturnToCurrent,
  showDiff,
  onToggleDiff,
  hasPreviousVersion,
  previousVersion,
}: DocumentChromeProps) {
  return (
    <div className="min-h-10 flex items-center justify-between px-5 py-2 border-b border-rule-subtle">
      <div className="flex items-center gap-3">
        {isViewingHistory ? (
          <div className="flex items-center gap-2.5">
            <span className="font-sans text-xs text-ink-secondary">
              Viewing <span className="font-mono font-semibold text-ink">v{activeVersion}</span>
              <span className="text-ink-tertiary ml-1.5">&mdash; read-only</span>
            </span>
            <button
              type="button"
              onClick={onReturnToCurrent}
              className="tactile-button font-sans min-h-10 px-2 py-1 text-[11px] font-medium text-accent hover:text-ink rounded-md cursor-pointer"
            >
              Return to current
            </button>
          </div>
        ) : (
          <span className="font-mono text-[12px] font-semibold tracking-tight text-ink-tertiary uppercase">
            <span className="text-ink-tertiary/70">#&nbsp;</span>
            <span className="text-ink-secondary">open-plan-annotator</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {hasPreviousVersion && (
          <button
            type="button"
            onClick={onToggleDiff}
            className={cn(
              "tactile-button font-sans flex min-h-10 items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer focus-visible:ring-2 focus-visible:ring-accent/50",
              showDiff
                ? "border border-accent/40 bg-accent-subtle text-accent"
                : "border border-rule text-ink-secondary hover:text-ink hover:bg-paper-edge",
            )}
            title={`Show changes from v${previousVersion}`}
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3 h-3"
            >
              <path
                fillRule="evenodd"
                d="M8 1.75a.75.75 0 0 1 .75.75v9.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.22 3.22V2.5A.75.75 0 0 1 8 1.75Z"
                clipRule="evenodd"
              />
            </svg>
            Diff
            <kbd className="shortcut-key ml-0.5">D</kbd>
          </button>
        )}
      </div>
    </div>
  );
}
