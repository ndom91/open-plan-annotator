import { cn } from "../utils/cn.ts";

interface VersionSidebarProps {
  currentVersion: number;
  totalVersions: number;
  selectedVersion: number;
  onSelectVersion: (version: number) => void;
}

export function VersionSidebar({
  currentVersion,
  totalVersions,
  selectedVersion,
  onSelectVersion,
}: VersionSidebarProps) {
  const versions = Array.from({ length: totalVersions }, (_, i) => totalVersions - i);

  return (
    <nav aria-label="Versions" className="font-sans">
      <div className="flex items-center justify-between mb-3 px-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-secondary uppercase tracking-widest">
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="w-3 h-3"
          >
            <path d="M2 4.5a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.5Zm0 3.5a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm.75 2.75a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H2.75Z" />
          </svg>
          Versions
        </h3>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-paper-edge border border-rule-subtle px-1.5 font-mono text-[10px] font-medium text-ink-tertiary tabular-nums">
          {totalVersions}
        </span>
      </div>
      <ul className="space-y-0.5">
        {versions.map((v) => {
          const isSelected = v === selectedVersion;
          const isCurrent = v === currentVersion;
          return (
            <li key={v}>
              <button
                type="button"
                onClick={() => onSelectVersion(v)}
                className={cn(
                  "group w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-left text-[13px] cursor-pointer transition-colors duration-150",
                  isSelected
                    ? "bg-paper-edge text-ink"
                    : "text-ink-tertiary hover:text-ink-secondary hover:bg-paper-edge/50",
                )}
              >
                <span className={cn("font-mono text-[12px] tabular-nums", isSelected ? "text-ink" : "")}>v{v}</span>
                {isCurrent && (
                  <span className="inline-flex h-4 items-center rounded bg-approve-bg px-1.5 text-[9px] font-bold uppercase tracking-widest text-approve">
                    Head
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
