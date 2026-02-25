import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn.ts";

interface TextInputPopoverProps {
  mode: "comment" | "replacement" | "insertion";
  selectedText: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

const config = {
  comment: {
    title: "Add Comment",
    placeholder: "What should be changed here?",
    button: "Comment",
    buttonClass: "bg-margin-note/90 hover:bg-margin-note",
  },
  replacement: {
    title: "Replace With",
    placeholder: "Enter replacement text\u2026",
    button: "Replace",
    buttonClass: "bg-ink-secondary hover:bg-ink",
  },
  insertion: {
    title: "Insert After",
    placeholder: "Enter text to insert\u2026",
    button: "Insert",
    buttonClass: "bg-approve hover:bg-approve-hover",
  },
};

export function TextInputPopover({ mode, selectedText, onSubmit, onCancel }: TextInputPopoverProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { title, placeholder, button, buttonClass } = config[mode];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape regardless of focus
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  // Focus trap: keep Tab/Shift+Tab within the dialog
  useEffect(() => {
    const dialog = inputRef.current?.closest('[role="dialog"]');
    if (!dialog) return;

    const handleTrapKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'textarea, button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleTrapKeyDown);
    return () => document.removeEventListener("keydown", handleTrapKeyDown);
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (trimmed) onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 overscroll-contain"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-labelledby="popover-title"
        aria-modal="true"
        className="bg-paper border border-rule rounded-2xl shadow-[0_1px_3px_oklch(0_0_0/0.12),0_8px_40px_oklch(0_0_0/0.25),0_24px_60px_oklch(0_0_0/0.15)] overflow-hidden w-104"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 id="popover-title" className="text-sm font-semibold text-ink mb-1.5">
            {title}
          </h3>
          <p className="text-xs text-ink-tertiary mb-4 truncate">
            {mode === "insertion" ? `After: "${selectedText}"` : `"${selectedText}"`}
          </p>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={title}
            className="w-full h-20 px-3 py-2.5 text-sm rounded-lg border border-rule bg-inset text-ink placeholder-ink-tertiary resize-none shadow-[inset_0_1px_2px_oklch(0_0_0/0.1)] focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/40 transition-all"
          />
          <div className="flex items-center justify-end mt-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 text-sm rounded-md text-ink-tertiary hover:text-ink-secondary hover:bg-ink/5 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-margin-note/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!text.trim()}
                className={cn(
                  "group flex items-center gap-3 pl-4 pr-2.5 py-1.5 text-sm rounded-lg text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium shadow-[0_1px_2px_oklch(0_0_0/0.2),inset_0_1px_0_oklch(1_0_0/0.1)] focus-visible:ring-2 focus-visible:ring-accent/50",
                  buttonClass,
                )}
              >
                {button}
                <kbd className="flex items-center gap-0.5 text-[11px] font-mono transition-opacity">
                  <span className="flex items-center justify-center size-[20px] rounded bg-black/20 text-white/70 leading-none shadow-[inset_0_-1px_0_oklch(0_0_0/0.15)]">⌘</span>
                  <span className="flex items-center justify-center size-[20px] rounded bg-black/20 text-white/70 leading-none shadow-[inset_0_-1px_0_oklch(0_0_0/0.15)]">↵</span>
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
