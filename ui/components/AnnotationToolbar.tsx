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
  const top = rect.top + window.scrollY - 44;
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
    "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-paper";

  return (
    <div
      role="toolbar"
      aria-label="Annotation actions"
      onKeyDown={handleToolbarKeyDown}
      style={{ top, left, transform: "translateX(-50%)" }}
      className="font-sans absolute z-50 flex items-center gap-1 bg-paper backdrop-blur-xl rounded-md border border-rule shadow-[0_4px_12px_rgba(0,0,0,0.12)] pl-3 pr-1 py-1"
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
