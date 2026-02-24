import type { ResolvedSelection } from "../utils/offsetResolver.ts";

interface AnnotationToolbarProps {
  rect: DOMRect;
  selection: ResolvedSelection;
  onStrikethrough: (selection: ResolvedSelection) => void;
  onComment: (selection: ResolvedSelection) => void;
  onDismiss: () => void;
}

export function AnnotationToolbar({ rect, selection, onStrikethrough, onComment, onDismiss }: AnnotationToolbarProps) {
  const top = rect.top + window.scrollY - 48;
  const left = rect.left + rect.width / 2;

  return (
    <div style={{ top, left, transform: "translateX(-50%)" }} className="absolute z-50 flex items-center gap-1 bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-xl px-2 py-1.5 text-sm">
      <button
        onClick={() => {
          onStrikethrough(selection);
          onDismiss();
        }}
        className="flex items-center gap-1.5 px-3 py-1 rounded hover:bg-gray-700 transition-colors"
        title="Mark for deletion"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z" clipRule="evenodd" />
        </svg>
        <span>Delete</span>
      </button>
      <div className="w-px h-4 bg-gray-600" />
      <button
        onClick={() => {
          onComment(selection);
          onDismiss();
        }}
        className="flex items-center gap-1.5 px-3 py-1 rounded hover:bg-gray-700 transition-colors"
        title="Add comment"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 0 0 1.33 0l1.713-3.293a.783.783 0 0 1 .642-.413 41.102 41.102 0 0 0 3.55-.414c1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0 0 10 2ZM6.75 6a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 2.5a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" clipRule="evenodd" />
        </svg>
        <span>Comment</span>
      </button>
    </div>
  );
}
