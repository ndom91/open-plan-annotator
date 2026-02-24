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
    if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 overscroll-contain"
      onClick={onCancel}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div
        role="dialog"
        aria-labelledby="popover-title"
        aria-modal="true"
        className="bg-paper border border-rule rounded-xl shadow-[0_8px_40px_oklch(0_0_0/0.25),0_1px_3px_oklch(0_0_0/0.1)] p-6 w-[26rem]"
        onClick={(e) => e.stopPropagation()}
      >
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
          className="w-full h-20 px-3 py-2.5 text-sm rounded-md border border-rule bg-inset text-ink placeholder-ink-tertiary resize-none focus:outline-none focus:ring-2 focus:ring-margin-note/50 focus:border-margin-note/50 transition-colors"
        />
        <div className="flex items-center justify-between mt-4">
          <kbd className="text-[11px] text-ink-tertiary font-mono">
            <span className="px-1 py-0.5 rounded border border-rule-subtle bg-inset">⌘</span>
            <span className="mx-0.5">+</span>
            <span className="px-1 py-0.5 rounded border border-rule-subtle bg-inset">↵</span>
          </kbd>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm rounded-md text-ink-tertiary hover:text-ink-secondary hover:bg-ink/5 transition-colors focus-visible:ring-2 focus-visible:ring-margin-note/50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim()}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium focus-visible:ring-2 focus-visible:ring-margin-note/50",
                buttonClass,
              )}
            >
              {button}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
