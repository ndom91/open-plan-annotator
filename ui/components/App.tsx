import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAnnotations } from "../hooks/useAnnotations.ts";
import { useDecision } from "../hooks/useDecision.ts";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.ts";
import { usePlan } from "../hooks/usePlan.ts";
import { useTextSelection } from "../hooks/useTextSelection.ts";
import { parseMarkdownToBlocks } from "../utils/markdown.ts";
import { type ResolvedSelection, resolveSelection } from "../utils/offsetResolver.ts";
import { AnnotationSidebar } from "./AnnotationSidebar.tsx";
import { AnnotationToolbar, type ToolbarAction } from "./AnnotationToolbar.tsx";
import { TextInputPopover } from "./CommentPopover.tsx";
import { DiffViewer } from "./DiffViewer.tsx";
import { DocumentChrome } from "./DocumentChrome.tsx";
import { Header } from "./Header.tsx";
import { PlanDocument } from "./PlanDocument.tsx";
import { ThemeProvider } from "./ThemeProvider.tsx";
import { VersionSidebar } from "./VersionSidebar.tsx";

export default function App() {
  const { plan, planHash, version, history, autoCloseOnSubmit: initialAutoCloseOnSubmit, isLoading, error } = usePlan();
  const { annotations, addDeletion, addComment, addReplacement, addInsertion, removeAnnotation } =
    useAnnotations(planHash);
  const selection = useTextSelection();
  const { approve, deny, isPending, decided } = useDecision();

  const [popover, setPopover] = useState<{
    mode: "comment" | "replacement" | "insertion";
    selections: ResolvedSelection[];
  } | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [autoCloseOnSubmit, setAutoCloseOnSubmit] = useState(initialAutoCloseOnSubmit);
  const [isSavingAutoClose, setIsSavingAutoClose] = useState(false);

  useEffect(() => {
    setAutoCloseOnSubmit(initialAutoCloseOnSubmit);
  }, [initialAutoCloseOnSubmit]);

  const activeVersion = selectedVersion ?? version;
  const isViewingHistory = activeVersion !== version;
  const totalVersions = history.length + 1;

  const displayedPlan = useMemo(() => {
    if (!isViewingHistory) return plan;
    return history[activeVersion - 1] ?? plan;
  }, [isViewingHistory, activeVersion, history, plan]);

  const blocks = useMemo(() => (displayedPlan ? parseMarkdownToBlocks(displayedPlan) : []), [displayedPlan]);

  // Ref-based getter for keyboard shortcuts (avoids stale closures)
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const getResolvedSelection = useCallback((): ResolvedSelection[] | null => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;
    return resolveSelection(sel);
  }, []);

  const handleToolbarAction = useCallback(
    (action: ToolbarAction, sels: ResolvedSelection[]) => {
      if (action === "deletion") {
        for (const sel of sels) addDeletion(sel);
        window.getSelection()?.removeAllRanges();
      } else {
        setPopover({ mode: action, selections: sels });
      }
    },
    [addDeletion],
  );

  const handlePopoverSubmit = useCallback(
    (text: string) => {
      if (!popover) return;
      const { mode, selections: sels } = popover;
      for (const sel of sels) {
        if (mode === "comment") addComment(sel, text);
        else if (mode === "replacement") addReplacement(sel, text);
        else if (mode === "insertion") addInsertion(sel, text);
      }
      setPopover(null);
      window.getSelection()?.removeAllRanges();
    },
    [popover, addComment, addReplacement, addInsertion],
  );

  const handleApprove = useCallback(() => {
    if (!isPending && !decided) approve();
  }, [approve, isPending, decided]);

  const handleDeny = useCallback(() => {
    if (!isPending && !decided && annotations.length > 0) deny(annotations);
  }, [deny, isPending, decided, annotations]);

  const handleToggleAutoClose = useCallback(
    async (nextValue: boolean) => {
      if (isSavingAutoClose || isPending || decided) return;

      const previousValue = autoCloseOnSubmit;
      setAutoCloseOnSubmit(nextValue);
      setIsSavingAutoClose(true);

      try {
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autoCloseOnSubmit: nextValue }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (err) {
        setAutoCloseOnSubmit(previousValue);
        console.error("Failed to persist auto-close setting", err);
      } finally {
        setIsSavingAutoClose(false);
      }
    },
    [autoCloseOnSubmit, decided, isPending, isSavingAutoClose],
  );

  useEffect(() => {
    if (!decided || !autoCloseOnSubmit) return;
    const closeTimer = window.setTimeout(() => {
      window.close();
    }, 50);
    return () => window.clearTimeout(closeTimer);
  }, [autoCloseOnSubmit, decided]);

  useKeyboardShortcuts({
    getSelection: getResolvedSelection,
    onAction: handleToolbarAction,
    onApprove: handleApprove,
    onDeny: handleDeny,
    hasAnnotations: annotations.length > 0,
    decided,
  });

  if (isLoading) {
    return (
      <ThemeProvider>
        <div className="flex items-center justify-center min-h-screen bg-desk">
          <div className="text-ink-tertiary text-sm tracking-wide" aria-live="polite">
            Loading plan\u2026
          </div>
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

  const hasPreviousVersion = history.length > 0;
  const popoverText = popover ? popover.selections.map((s) => s.text).join("\n") : "";

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-desk desk-texture">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-100 focus:px-4 focus:py-2 focus:bg-paper focus:text-ink focus:rounded-md focus:shadow-lg focus:text-sm focus:font-medium"
        >
          Skip to content
        </a>
        <Header
          annotations={annotations}
          version={version}
          approve={handleApprove}
          deny={handleDeny}
          isPending={isPending}
          decided={decided}
          autoCloseOnSubmit={autoCloseOnSubmit}
          onToggleAutoClose={handleToggleAutoClose}
          isSavingAutoClose={isSavingAutoClose}
        />

        <div className="flex justify-center px-4 py-8 sm:px-6 lg:px-8">
          {/* Version history sidebar */}
          {totalVersions > 1 && (
            <aside className="w-56 shrink-0 pl-2 mr-6 sticky top-18 max-h-[calc(100vh-5.5rem)] overflow-y-auto hidden xl:block">
              <VersionSidebar
                currentVersion={version}
                totalVersions={totalVersions}
                selectedVersion={activeVersion}
                onSelectVersion={setSelectedVersion}
              />
            </aside>
          )}

          <div className="w-full max-w-208">
            {/* Document surface */}
            <main
              id="main-content"
              tabIndex={-1}
              className="bg-paper border border-rule-subtle rounded-xl shadow-[0_1px_2px_oklch(0_0_0/0.15),0_4px_16px_oklch(0_0_0/0.1),0_16px_48px_oklch(0_0_0/0.08)] overflow-hidden"
            >
              <DocumentChrome
                isViewingHistory={isViewingHistory}
                activeVersion={activeVersion}
                onReturnToCurrent={() => setSelectedVersion(null)}
                showDiff={showDiff}
                onToggleDiff={() => setShowDiff((v) => !v)}
                hasPreviousVersion={hasPreviousVersion}
              />
              {/* Diff view — between chrome and content */}
              {showDiff && hasPreviousVersion && !isViewingHistory && (
                <DiffViewer
                  oldText={history[history.length - 1]}
                  newText={plan!}
                  oldVersion={version - 1}
                  newVersion={version}
                />
              )}
              <div className="px-10 py-12 sm:px-14 lg:px-20 lg:py-16">
                <PlanDocument blocks={blocks} annotations={isViewingHistory ? [] : annotations} />
              </div>
            </main>
          </div>

          {/* Annotation sidebar — always reserve space to prevent layout shift */}
          <aside className="w-72 shrink-0 pr-2 ml-6 sticky top-18 max-h-[calc(100vh-5.5rem)] overflow-y-auto hidden xl:block">
            {!isViewingHistory && annotations.length > 0 && (
              <AnnotationSidebar annotations={annotations} onRemove={removeAnnotation} />
            )}
          </aside>
        </div>

        {/* Floating toolbar on selection — only on current version */}
        {!isViewingHistory && selection.isActive && selection.resolved && selection.rect && !popover && !decided && (
          <AnnotationToolbar
            rect={selection.rect}
            selections={selection.resolved}
            onAction={handleToolbarAction}
            onDismiss={() => window.getSelection()?.removeAllRanges()}
          />
        )}

        {/* Text input popover */}
        {popover && (
          <TextInputPopover
            mode={popover.mode}
            selectedText={popoverText}
            onSubmit={handlePopoverSubmit}
            onCancel={() => setPopover(null)}
          />
        )}
      </div>
    </ThemeProvider>
  );
}
