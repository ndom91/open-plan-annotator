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
    "flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-paper";

  return (
    <div
      role="toolbar"
      aria-label="Annotation actions"
      onKeyDown={handleToolbarKeyDown}
      style={{ top, left, transform: "translateX(-50%)" }}
      className="absolute z-50 flex items-center bg-paper/95 backdrop-blur-xl border border-rule rounded-xl shadow-[0_1px_2px_oklch(0_0_0/0.12),0_4px_16px_oklch(0_0_0/0.15),0_12px_40px_oklch(0_0_0/0.1)] p-1.5"
    >
      <button
        type="button"
        onClick={() => {
          onAction("deletion", selections);
          onDismiss();
        }}
        className={cn(btn, "text-redline hover:bg-redline-bg/60")}
        title="Delete (d)"
      >
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="w-3.5 h-3.5"
        >
          <path d="M3.5 8a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 3.5 8Z" />
          <path
            fillRule="evenodd"
            d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM2.5 8a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z"
            clipRule="evenodd"
          />
        </svg>
        Delete
      </button>
      <div className="w-px h-5 bg-rule mx-0.5" />
      <button
        type="button"
        onClick={() => {
          onAction("replacement", selections);
          onDismiss();
        }}
        className={cn(btn, "text-ink-secondary hover:bg-ink/5")}
        title="Replace (r)"
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
            d="M13.78 10.47a.75.75 0 0 1 0 1.06l-2.25 2.25a.75.75 0 0 1-1.06 0l-2.25-2.25a.75.75 0 1 1 1.06-1.06l.97.97V8.75a.75.75 0 0 1 1.5 0v2.69l.97-.97a.75.75 0 0 1 1.06 0ZM2.22 5.53a.75.75 0 0 1 0-1.06l2.25-2.25a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1-1.06 1.06l-.97-.97v2.69a.75.75 0 0 1-1.5 0V4.56l-.97.97a.75.75 0 0 1-1.06 0Z"
            clipRule="evenodd"
          />
        </svg>
        Replace
      </button>
      <div className="w-px h-5 bg-rule mx-0.5" />
      <button
        type="button"
        onClick={() => {
          onAction("insertion", selections);
          onDismiss();
        }}
        className={cn(btn, "text-approve hover:bg-approve/10")}
        title="Insert after (i)"
      >
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="w-3.5 h-3.5"
        >
          <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
        </svg>
        Insert
      </button>
      <div className="w-px h-5 bg-rule mx-0.5" />
      <button
        type="button"
        onClick={() => {
          onAction("comment", selections);
          onDismiss();
        }}
        className={cn(btn, "text-margin-note hover:bg-margin-note-bg/60")}
        title="Comment (c)"
      >
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="w-3.5 h-3.5"
        >
          <path d="M1 8.74c0 .983.713 1.825 1.69 1.943.764.092 1.534.164 2.31.216a.75.75 0 0 1 .474.298l1.316 1.796a.25.25 0 0 0 .42 0l1.316-1.796a.75.75 0 0 1 .474-.298c.776-.052 1.546-.124 2.31-.216C12.287 10.565 13 9.723 13 8.74V4.26c0-.983-.713-1.825-1.69-1.943A44.077 44.077 0 0 0 7 2c-1.543 0-3.06.096-4.31.317C1.713 2.435 1 3.277 1 4.26v4.48Z" />
        </svg>
        Comment
      </button>
    </div>
  );
}
