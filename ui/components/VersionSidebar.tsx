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
    <div>
      <h3 className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-widest mb-5 pl-1">
        Versions
        <span className="ml-2 text-ink-tertiary/60 tabular-nums">{totalVersions}</span>
      </h3>
      <div className="space-y-1">
        {versions.map((v) => {
          const isSelected = v === selectedVersion;
          const isCurrent = v === currentVersion;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onSelectVersion(v)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-left text-sm transition-all",
                isSelected
                  ? "bg-paper border border-rule-subtle shadow-[0_1px_3px_oklch(0_0_0/0.08)] border-l-[3px] border-l-accent"
                  : "text-ink-tertiary hover:text-ink-secondary hover:bg-ink/5 border border-transparent",
              )}
            >
              <span
                className={cn(
                  "font-mono text-xs tabular-nums",
                  isSelected ? "text-ink font-semibold" : "text-ink-tertiary",
                )}
              >
                v{v}
              </span>
              {isCurrent && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-approve bg-approve/10 px-1.5 py-0.5 rounded">
                  Current
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
