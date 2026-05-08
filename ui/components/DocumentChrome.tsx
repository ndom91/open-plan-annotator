import { cn } from "../utils/cn.ts";

interface DocumentChromeProps {
  isViewingHistory: boolean;
  activeVersion: number;
  onReturnToCurrent: () => void;
  showDiff: boolean;
  onToggleDiff: () => void;
  hasPreviousVersion: boolean;
}

export function DocumentChrome({
  isViewingHistory,
  activeVersion,
  onReturnToCurrent,
  showDiff,
  onToggleDiff,
  hasPreviousVersion,
}: DocumentChromeProps) {
  return (
    <div className="min-h-11 flex items-center justify-between px-4 py-2 bg-paper-edge border-b border-rule-subtle">
      <div className="flex items-center gap-3">
        {/* Window control dots */}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-ink/10" />
          <div className="w-3 h-3 rounded-full bg-ink/10" />
          <div className="w-3 h-3 rounded-full bg-ink/10" />
        </div>

        {isViewingHistory ? (
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-ink-secondary">
              Viewing <span className="font-mono font-semibold text-ink">v{activeVersion}</span>
              <span className="text-ink-tertiary ml-1.5">&mdash; read-only</span>
            </span>
            <button
              type="button"
              onClick={onReturnToCurrent}
              className="text-[11px] font-medium text-accent hover:text-ink px-1.5 py-0.5 rounded hover:bg-ink/5 cursor-pointer transition-colors duration-200"
            >
              Return to current
            </button>
          </div>
        ) : (
          <span className="font-mono text-[13px] font-semibold tracking-tight text-accent">open-plan-annotator</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {hasPreviousVersion && !isViewingHistory && (
          <button
            type="button"
            onClick={onToggleDiff}
            className={cn(
              "flex border-ink-tertiary/25 border items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent/50",
              showDiff
                ? "bg-accent/12 text-accent ring-1 ring-accent/20"
                : "text-ink-secondary hover:text-ink hover:bg-ink/5",
            )}
            title="Show changes from previous version"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3.5 h-3.5"
            >
              <path d="M8 1a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5A.75.75 0 0 1 8 1ZM3.75 9a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5ZM3 12.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75Z" />
            </svg>
            Diff
            <kbd className="shortcut-key ml-1">D</kbd>
          </button>
        )}
      </div>
    </div>
  );
}
