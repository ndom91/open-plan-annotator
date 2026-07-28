import { cn } from "../utils/cn.ts";
import type { ResolvedSelection } from "../utils/offsetResolver.ts";

export type ToolbarAction = "deletion" | "comment" | "replacement" | "insertion";

interface AnnotationToolbarProps {
  rect: DOMRect;
  selections: ResolvedSelection[];
  onAction: (action: ToolbarAction, selections: ResolvedSelection[]) => void;
  onDismiss: () => void;
}

export function AnnotationToolbar({ rect, selections, onAction, onDismiss }: AnnotationToolbarProps) {
  // Toolbar is ~50px tall (min-h-10 buttons + py-1 + borders); offset must clear
  // that plus a gap so it floats above the highlight instead of overlapping it.
  const top = rect.top + window.scrollY - 60;
  const left = rect.left + rect.width / 2;

  const handleToolbarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const buttons = (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>("button");
      const current = Array.from(buttons).indexOf(e.target as HTMLButtonElement);
      if (current === -1) return;
      const next =
        e.key === "ArrowRight" ? (current + 1) % buttons.length : (current - 1 + buttons.length) % buttons.length;
      buttons[next].focus();
    }
  };

  const btn =
    "tactile-button flex min-h-10 items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-pointer focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-paper";

  return (
    <div
      role="toolbar"
      aria-label="Annotation actions"
      onKeyDown={handleToolbarKeyDown}
      style={{ top, left, transform: "translateX(-50%)" }}
      className="animate-fade-in-up font-sans absolute z-50 flex items-center gap-1 bg-paper backdrop-blur-xl rounded-xl border border-rule shadow-[0_8px_20px_rgba(0,0,0,0.14),0_1px_3px_rgba(0,0,0,0.12)] pl-3 pr-1 py-1"
    >
      <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary select-none">
        Selection
      </span>
      <div className="w-px h-4 bg-rule mx-1" />
      <button
        type="button"
        onClick={() => {
          onAction("deletion", selections);
          onDismiss();
        }}
        className={cn(btn, "text-redline hover:bg-redline-bg")}
        title="Delete (D)"
      >
        <kbd className="shortcut-key">D</kbd>
        delete
      </button>
      <button
        type="button"
        onClick={() => {
          onAction("replacement", selections);
          onDismiss();
        }}
        className={cn(btn, "text-replace hover:bg-replace-bg")}
        title="Replace (R)"
      >
        <kbd className="shortcut-key">R</kbd>
        replace
      </button>
      <button
        type="button"
        onClick={() => {
          onAction("insertion", selections);
          onDismiss();
        }}
        className={cn(btn, "text-approve hover:bg-approve-bg")}
        title="Insert (S)"
      >
        <kbd className="shortcut-key">S</kbd>
        insert
      </button>
      <button
        type="button"
        onClick={() => {
          onAction("comment", selections);
          onDismiss();
        }}
        className={cn(btn, "text-margin-note hover:bg-margin-note-bg")}
        title="Comment (C)"
      >
        <kbd className="shortcut-key">C</kbd>
        comment
      </button>
    </div>
  );
}
