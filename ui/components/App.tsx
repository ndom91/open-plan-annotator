import { useState } from "react";
import { usePlan } from "../hooks/usePlan.ts";
import { useAnnotations } from "../hooks/useAnnotations.ts";
import { useTextSelection } from "../hooks/useTextSelection.ts";
import { parseMarkdownToBlocks } from "../utils/markdown.ts";
import type { ResolvedSelection } from "../utils/offsetResolver.ts";
import { ThemeProvider } from "./ThemeProvider.tsx";
import { Header } from "./Header.tsx";
import { PlanDocument } from "./PlanDocument.tsx";
import { AnnotationToolbar } from "./AnnotationToolbar.tsx";
import { CommentPopover } from "./CommentPopover.tsx";
import { AnnotationSidebar } from "./AnnotationSidebar.tsx";

export default function App() {
  const { plan, isLoading, error } = usePlan();
  const blocks = plan ? parseMarkdownToBlocks(plan) : [];
  const { annotations, addDeletion, addComment, removeAnnotation } = useAnnotations();
  const selection = useTextSelection();
  const [commentTarget, setCommentTarget] = useState<ResolvedSelection | null>(null);

  const handleComment = (sel: ResolvedSelection) => {
    setCommentTarget(sel);
  };

  const handleCommentSubmit = (text: string) => {
    if (commentTarget) addComment(commentTarget, text);
    setCommentTarget(null);
  };

  const clearSelection = () => {
    window.getSelection()?.removeAllRanges();
  };

  if (isLoading) {
    return (
      <ThemeProvider>
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
          <div className="text-gray-400 dark:text-gray-500 text-sm">Loading plan...</div>
        </div>
      </ThemeProvider>
    );
  }

  if (error) {
    return (
      <ThemeProvider>
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
          <div className="text-red-500 text-sm">Failed to load plan: {error}</div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Header annotations={annotations} />

        <div className="flex max-w-screen-xl mx-auto">
          <main className="flex-1 min-w-0 px-8 py-10 lg:px-16">
            <PlanDocument blocks={blocks} annotations={annotations} />
          </main>

          {annotations.length > 0 && (
            <aside className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-800 px-4 py-10 sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto hidden lg:block">
              <AnnotationSidebar annotations={annotations} onRemove={removeAnnotation} />
            </aside>
          )}
        </div>

        {selection.isActive && selection.resolved && selection.rect && !commentTarget && (
          <AnnotationToolbar rect={selection.rect} selection={selection.resolved} onStrikethrough={addDeletion} onComment={handleComment} onDismiss={clearSelection} />
        )}

        {commentTarget && <CommentPopover onSubmit={handleCommentSubmit} onCancel={() => setCommentTarget(null)} />}
      </div>
    </ThemeProvider>
  );
}
