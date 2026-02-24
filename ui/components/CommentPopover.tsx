import { useState, useRef, useEffect } from "react";

interface CommentPopoverProps {
  onSubmit: (comment: string) => void;
  onCancel: () => void;
}

export function CommentPopover({ onSubmit, onCancel }: CommentPopoverProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onCancel}>
      <div className="bg-paper border border-rule rounded-xl shadow-[0_8px_40px_oklch(0_0_0/0.25),0_1px_3px_oklch(0_0_0/0.1)] p-5 w-[22rem]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-medium text-ink mb-3">Add Comment</h3>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What should be changed here?"
          className="w-full h-24 px-3 py-2.5 text-sm rounded-md border border-rule bg-inset text-ink placeholder-ink-tertiary resize-none focus:outline-none focus:ring-1 focus:ring-margin-note/50 focus:border-margin-note/50 transition-colors"
        />
        <div className="flex items-center justify-between mt-3">
          <kbd className="text-[11px] text-ink-tertiary font-mono">
            <span className="px-1 py-0.5 rounded border border-rule-subtle bg-inset">⌘</span>
            <span className="mx-0.5">+</span>
            <span className="px-1 py-0.5 rounded border border-rule-subtle bg-inset">↵</span>
          </kbd>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-md text-ink-tertiary hover:text-ink-secondary hover:bg-ink/5 transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={!text.trim()} className="px-3 py-1.5 text-sm rounded-md bg-margin-note/90 text-white hover:bg-margin-note disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium">
              Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
