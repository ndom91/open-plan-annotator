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
        <div className="flex items-center justify-center min-h-screen bg-desk">
          <div className="text-ink-tertiary text-sm tracking-wide">Loading plan...</div>
        </div>
      </ThemeProvider>
    );
  }

  if (error) {
    return (
      <ThemeProvider>
        <div className="flex items-center justify-center min-h-screen bg-desk">
          <div className="text-redline text-sm">Failed to load plan: {error}</div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-desk">
        <Header annotations={annotations} />

        <div className="flex justify-center px-4 py-8 sm:px-6 lg:px-8">
          {/* Document surface — the "paper" */}
          <main className="w-full max-w-[52rem] bg-paper border border-rule-subtle rounded-lg shadow-[0_1px_3px_oklch(0_0_0/0.12),0_8px_32px_oklch(0_0_0/0.08)]">
            <div className="px-10 py-12 sm:px-14 lg:px-20 lg:py-16">
              <PlanDocument blocks={blocks} annotations={annotations} />
            </div>
          </main>

          {/* Annotation sidebar — floats beside the document */}
          {annotations.length > 0 && (
            <aside className="w-72 shrink-0 ml-6 sticky top-[4.5rem] max-h-[calc(100vh-5.5rem)] overflow-y-auto hidden xl:block">
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
