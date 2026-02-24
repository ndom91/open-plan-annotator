import type { ResolvedSelection } from "../utils/offsetResolver.ts";

interface AnnotationToolbarProps {
  rect: DOMRect;
  selection: ResolvedSelection;
  onStrikethrough: (selection: ResolvedSelection) => void;
  onComment: (selection: ResolvedSelection) => void;
  onDismiss: () => void;
}

export function AnnotationToolbar({ rect, selection, onStrikethrough, onComment, onDismiss }: AnnotationToolbarProps) {
  const top = rect.top + window.scrollY - 44;
  const left = rect.left + rect.width / 2;

  return (
    <div
      style={{ top, left, transform: "translateX(-50%)" }}
      className="absolute z-50 flex items-center bg-paper border border-rule rounded-lg shadow-[0_4px_16px_oklch(0_0_0/0.2),0_1px_3px_oklch(0_0_0/0.1)] px-1 py-1 text-sm"
    >
      <button
        onClick={() => {
          onStrikethrough(selection);
          onDismiss();
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-redline hover:bg-redline-bg/60 transition-colors"
        title="Mark for deletion"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M3.5 8a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 3.5 8Z" />
          <path fillRule="evenodd" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM2.5 8a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z" clipRule="evenodd" />
        </svg>
        <span className="text-xs font-medium">Delete</span>
      </button>
      <div className="w-px h-5 bg-rule mx-0.5" />
      <button
        onClick={() => {
          onComment(selection);
          onDismiss();
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-margin-note hover:bg-margin-note-bg/60 transition-colors"
        title="Add comment"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M1 8.74c0 .983.713 1.825 1.69 1.943.764.092 1.534.164 2.31.216a.75.75 0 0 1 .474.298l1.316 1.796a.25.25 0 0 0 .42 0l1.316-1.796a.75.75 0 0 1 .474-.298c.776-.052 1.546-.124 2.31-.216C12.287 10.565 13 9.723 13 8.74V4.26c0-.983-.713-1.825-1.69-1.943A44.077 44.077 0 0 0 7 2c-1.543 0-3.06.096-4.31.317C1.713 2.435 1 3.277 1 4.26v4.48Z" />
        </svg>
        <span className="text-xs font-medium">Comment</span>
      </button>
    </div>
  );
}
