import type { Annotation } from "../utils/annotationSerializer.ts";
import { useTheme } from "./ThemeProvider.tsx";

interface HeaderProps {
  annotations: Annotation[];
  version: number;
  appVersion: string | null;
  approve: () => void;
  deny: () => void;
  isPending: boolean;
  decided: boolean;
  autoCloseOnSubmit: boolean;
  onToggleAutoClose: () => void;
  settingsExpired: boolean;
  autoCloseCountdown: number;
}

export function Header({
  annotations,
  version: _version,
  appVersion,
  approve,
  deny,
  isPending,
  decided,
  autoCloseOnSubmit,
  onToggleAutoClose,
  settingsExpired,
  autoCloseCountdown,
}: HeaderProps) {
  const { dark, toggle } = useTheme();

  if (decided) {
    return (
      <header className="sticky top-0 z-40">
        <div className="font-sans flex items-center justify-center gap-4 px-8 py-4 bg-desk/85 backdrop-blur-xl border-b border-rule">
          <div className="flex items-center gap-2.5 text-ink-tertiary">
            <div className="w-5 h-5 rounded-full bg-approve-bg flex items-center justify-center">
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-3.5 h-3.5 text-approve"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <span className="text-sm">Decision sent. You can close this tab.</span>
          </div>
          <div className="w-px h-4 bg-rule-subtle" />
          <button
            type="button"
            role="switch"
            aria-checked={autoCloseOnSubmit}
            onClick={onToggleAutoClose}
            disabled={settingsExpired}
            className="flex items-center gap-2 px-2 py-1 rounded-md text-ink-tertiary hover:text-ink-secondary hover:bg-ink/5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <span className="text-[11px] select-none">
              {autoCloseOnSubmit ? (
                <>
                  Auto-closing in <span className="tabular-nums font-medium">{autoCloseCountdown}s</span>
                </>
              ) : (
                "Auto-close next time"
              )}
            </span>
            <span
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors duration-200 ${autoCloseOnSubmit ? "bg-accent" : "bg-ink/15"}`}
            >
              <span
                className={`inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${autoCloseOnSubmit ? "translate-x-3.5" : "translate-x-0.5"}`}
              />
            </span>
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40">
      <div className="font-sans flex items-center justify-between px-8 py-3 bg-desk/85 backdrop-blur-xl border-b border-rule">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-sm flex items-center justify-center text-accent bg-accent-subtle">
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm2-.5a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V4a.5.5 0 0 0-.5-.5H4Zm1.75 2a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Zm0 3a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-2.5Z" />
              </svg>
            </div>
            <span className="font-mono text-sm font-semibold text-ink tracking-tight">plan-review</span>
          </div>
          {appVersion && (
            <>
              <span className="text-ink-tertiary text-sm select-none">/</span>
              <span className="inline-flex h-6 items-center rounded border border-rule bg-paper-edge px-2 font-mono text-[11px] font-medium text-ink-secondary tabular-nums">
                v{appVersion}
              </span>
            </>
          )}
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-approve-bg px-2.5 ml-2 text-[11px] font-medium text-approve">
            <span className="w-1.5 h-1.5 rounded-full bg-approve" aria-hidden="true" />
            Open · {annotations.length} {annotations.length === 1 ? "comment" : "comments"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="p-2 rounded-md text-ink-tertiary hover:text-ink-secondary hover:bg-ink/5 cursor-pointer transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/50"
            title="Toggle theme"
            aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          >
            {dark ? (
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.06 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM5.404 6.464a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 1 0-1.06 1.06l1.06 1.06Z" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path
                  fillRule="evenodd"
                  d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={deny}
            disabled={isPending || annotations.length === 0}
            className="group flex items-center gap-2 pl-3 pr-2 py-1.5 rounded text-[13px] font-medium text-redline border border-redline/40 hover:bg-redline-bg hover:border-redline cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent/50"
            title="⌘⇧↵"
          >
            Request changes
            <kbd className="flex items-center gap-0.5 font-mono">
              <span className="shortcut-key">⌘</span>
              <span className="shortcut-key">⇧</span>
              <span className="shortcut-key">↵</span>
            </kbd>
          </button>
          <button
            type="button"
            onClick={approve}
            disabled={isPending}
            className="group flex items-center gap-2 pl-3 pr-2 py-1.5 rounded bg-approve hover:bg-approve-hover cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent/50"
            title="⌘↵"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3.5 h-3.5"
            >
              <path
                fillRule="evenodd"
                d="M12.78 5.22a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 1 1 1.06-1.06l1.97 1.97 4.72-4.72a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
            Approve
            <kbd className="flex items-center gap-0.5 font-mono">
              <span className="flex items-center justify-center size-[1.1rem] rounded-sm bg-black/20 text-white/80 text-[0.66rem] font-medium leading-none">
                ⌘
              </span>
              <span className="flex items-center justify-center size-[1.1rem] rounded-sm bg-black/20 text-white/80 text-[0.66rem] font-medium leading-none">
                ↵
              </span>
            </kbd>
          </button>
        </div>
      </div>
    </header>
  );
}
