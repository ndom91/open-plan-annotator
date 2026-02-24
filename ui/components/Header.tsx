import type { Annotation } from "../utils/annotationSerializer.ts";
import { cn } from "../utils/cn.ts";
import { useTheme } from "./ThemeProvider.tsx";

interface HeaderProps {
  annotations: Annotation[];
  version: number;
  hasPreviousVersion: boolean;
  showDiff: boolean;
  onToggleDiff: () => void;
  approve: () => void;
  deny: () => void;
  isPending: boolean;
  decided: boolean;
}

export function Header({
  annotations,
  version,
  hasPreviousVersion,
  showDiff,
  onToggleDiff,
  approve,
  deny,
  isPending,
  decided,
}: HeaderProps) {
  const { dark, toggle } = useTheme();

  if (decided) {
    return (
      <header className="sticky top-0 z-40 flex items-center justify-center px-6 py-5 bg-desk/80 backdrop-blur-md border-b border-rule-subtle">
        <div className="flex items-center gap-2 text-ink-tertiary">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm">Decision sent. You can close this tab.</span>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3.5 bg-desk/80 backdrop-blur-md border-b border-rule-subtle">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-ink/10 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3 h-3 text-ink-secondary"
            >
              <path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm2-.5a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V4a.5.5 0 0 0-.5-.5H4Zm1.75 2a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Zm0 3a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-2.5Z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-ink tracking-tight">Plan Review</span>
        </div>
        {version > 1 && <span className="text-xs text-ink-tertiary font-mono tabular-nums">v{version}</span>}
        {annotations.length > 0 && (
          <span className="text-xs text-margin-note bg-margin-note-bg px-2 py-0.5 rounded-full font-medium tabular-nums">
            {annotations.length}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {hasPreviousVersion && (
          <button
            type="button"
            onClick={onToggleDiff}
            className={cn(
              "px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
              showDiff ? "bg-ink/10 text-ink-secondary" : "text-ink-tertiary hover:text-ink-secondary hover:bg-ink/5",
            )}
            title="Show changes from previous version"
          >
            <span className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M8 1a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5A.75.75 0 0 1 8 1ZM3.75 9a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5ZM3 12.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75Z" />
              </svg>
              Diff
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={toggle}
          className="p-2 rounded-md text-ink-tertiary hover:text-ink-secondary hover:bg-ink/5 transition-colors"
          title="Toggle theme"
        >
          {dark ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.06 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM5.404 6.464a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 1 0-1.06 1.06l1.06 1.06Z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path
                fillRule="evenodd"
                d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        <div className="w-px h-5 bg-rule mx-1" />

        <button
          type="button"
          onClick={deny}
          disabled={isPending || annotations.length === 0}
          className="px-3.5 py-1.5 rounded-md text-sm font-medium text-redline hover:bg-redline-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="⌘⇧↵"
        >
          Send Annotations
        </button>
        <button
          type="button"
          onClick={approve}
          disabled={isPending}
          className="px-3.5 py-1.5 rounded-md bg-approve hover:bg-approve-hover disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          title="⌘↵"
        >
          Accept Plan
        </button>
      </div>
    </header>
  );
}
