import { useTheme } from "./ThemeProvider.tsx";
import { useDecision } from "../hooks/useDecision.ts";
import type { Annotation } from "../utils/annotationSerializer.ts";

interface HeaderProps {
  annotations: Annotation[];
}

export function Header({ annotations }: HeaderProps) {
  const { approve, deny, isPending, decided } = useDecision();
  const { dark, toggle } = useTheme();

  if (decided) {
    return (
      <header className="sticky top-0 z-40 flex items-center justify-center px-6 py-4 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <span className="text-sm text-gray-500 dark:text-gray-400">Decision sent. You can close this tab.</span>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-gray-900 dark:text-gray-100">Plan Review</span>
        {annotations.length > 0 && (
          <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
            {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={toggle} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Toggle theme">
          {dark ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.06 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM5.404 6.464a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 1 0-1.06 1.06l1.06 1.06Z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        <button
          onClick={() => deny(annotations)}
          disabled={isPending || annotations.length === 0}
          className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-sm"
        >
          Request Changes
        </button>
        <button
          onClick={() => approve()}
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors shadow-sm"
        >
          Approve Plan
        </button>
      </div>
    </header>
  );
}
