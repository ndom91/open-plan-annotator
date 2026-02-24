import type { Annotation } from "../utils/annotationSerializer.ts";
import { useTheme } from "./ThemeProvider.tsx";

interface HeaderProps {
  annotations: Annotation[];
  version: number;
  approve: () => void;
  deny: () => void;
  isPending: boolean;
  decided: boolean;
}

export function Header({
  annotations,
  version,
  approve,
  deny,
  isPending,
  decided,
}: HeaderProps) {
  const { dark, toggle } = useTheme();

  if (decided) {
    return (
      <header className="sticky top-0 z-40">
        <div className="flex items-center justify-center px-8 py-4 bg-desk/70 backdrop-blur-xl border-b border-rule-subtle shadow-[inset_0_-1px_0_oklch(1_0_0/0.04)]">
          <div className="flex items-center gap-2.5 text-ink-tertiary">
            <div className="w-5 h-5 rounded-full bg-approve/15 flex items-center justify-center">
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
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40">
      <div className="flex items-center justify-between px-8 py-3 bg-desk/70 backdrop-blur-xl border-b border-rule-subtle shadow-[inset_0_-1px_0_oklch(1_0_0/0.04)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-accent/15 flex items-center justify-center ring-1 ring-accent/20">
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-3.5 h-3.5 text-accent"
              >
                <path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Zm2-.5a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V4a.5.5 0 0 0-.5-.5H4Zm1.75 2a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Zm0 3a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-2.5Z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-ink tracking-tight">Plan Review</span>
          </div>
          {version > 1 && (
            <span className="text-[11px] text-ink-tertiary font-mono tabular-nums px-1.5 py-0.5 rounded bg-ink/5 ring-1 ring-ink/8">
              v{version}
            </span>
          )}
          {annotations.length > 0 && (
            <span className="text-[11px] text-margin-note bg-margin-note-bg/80 px-2.5 py-0.5 rounded-full font-semibold tabular-nums ring-1 ring-margin-note/20 shadow-[0_0_8px_oklch(0.75_0.15_85/0.15)]">
              {annotations.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="p-2 rounded-md text-ink-tertiary hover:text-ink-secondary hover:bg-ink/5 transition-colors focus-visible:ring-2 focus-visible:ring-accent/50"
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

          <div className="w-px h-5 bg-rule mx-2" />

          <button
            type="button"
            onClick={deny}
            disabled={isPending || annotations.length === 0}
            className="px-3.5 py-1.5 rounded-lg text-[13px] font-medium text-redline ring-1 ring-redline/20 hover:bg-redline-bg/60 hover:ring-redline/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all focus-visible:ring-2 focus-visible:ring-accent/50"
            title="⌘⇧↵"
          >
            Send Annotations
          </button>
          <button
            type="button"
            onClick={approve}
            disabled={isPending}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-b from-approve to-approve-hover hover:shadow-[0_0_12px_oklch(0.65_0.18_155/0.3)] disabled:opacity-30 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-all shadow-[0_1px_2px_oklch(0_0_0/0.2),inset_0_1px_0_oklch(1_0_0/0.1)] focus-visible:ring-2 focus-visible:ring-accent/50"
            title="⌘↵"
          >
            Accept Plan
          </button>
        </div>
      </div>
    </header>
  );
}
