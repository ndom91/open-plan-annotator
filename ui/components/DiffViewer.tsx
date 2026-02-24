import { computeDiff, type DiffLine } from "../utils/diff.ts";

interface DiffViewerProps {
  oldText: string;
  newText: string;
  oldVersion: number;
  newVersion: number;
  onClose: () => void;
}

export function DiffViewer({ oldText, newText, oldVersion, newVersion, onClose }: DiffViewerProps) {
  const lines = computeDiff(oldText, newText);

  return (
    <div className="border border-rule rounded-xl overflow-hidden bg-inset shadow-[0_1px_2px_oklch(0_0_0/0.12),0_4px_16px_oklch(0_0_0/0.08)]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-rule bg-paper/80">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-ink-tertiary">
            Comparing <span className="font-medium text-ink-secondary">v{oldVersion}</span> &rarr;{" "}
            <span className="font-medium text-ink-secondary">v{newVersion}</span>
          </span>
          <span className="text-approve">{lines.filter((l) => l.type === "added").length} added</span>
          <span className="text-redline">{lines.filter((l) => l.type === "removed").length} removed</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-ink-tertiary hover:text-ink-secondary transition-colors rounded-md focus-visible:ring-2 focus-visible:ring-margin-note/50"
        >
          Close diff
        </button>
      </div>
      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
        <pre className="text-[13px] font-mono leading-relaxed">
          {lines.map((line, i) => (
            <DiffLineRow key={`${line.type}-${i}`} line={line} />
          ))}
        </pre>
      </div>
    </div>
  );
}

function DiffLineRow({ line }: { line: DiffLine }) {
  if (line.type === "added") {
    return (
      <div className="bg-approve/8 text-approve border-l-2 border-approve px-4 py-px">
        <span className="select-none text-approve/50 mr-2">+</span>
        {line.text}
      </div>
    );
  }
  if (line.type === "removed") {
    return (
      <div className="bg-redline/8 text-redline border-l-2 border-redline px-4 py-px">
        <span className="select-none text-redline/50 mr-2">-</span>
        {line.text}
      </div>
    );
  }
  return (
    <div className="text-ink-tertiary px-4 py-px border-l-2 border-transparent">
      <span className="select-none text-ink-tertiary/30 mr-2"> </span>
      {line.text}
    </div>
  );
}
