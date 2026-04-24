import { useEffect } from "react";
import type { ToolbarAction } from "../components/AnnotationToolbar.tsx";
import type { ResolvedSelection } from "../utils/offsetResolver.ts";

interface ShortcutHandlers {
  getSelection: () => ResolvedSelection[] | null;
  onAction: (action: ToolbarAction, selections: ResolvedSelection[]) => void;
  onApprove: () => void;
  onDeny: () => void;
  onToggleDiff: () => void;
  canToggleDiff: boolean;
  hasAnnotations: boolean;
  decided: boolean;
}

export function useKeyboardShortcuts({
  getSelection,
  onAction,
  onApprove,
  onDeny,
  onToggleDiff,
  canToggleDiff,
  hasAnnotations,
  decided,
}: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (decided) return;

      // Don't trigger shortcuts when typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // Cmd/Ctrl+Enter → Approve
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        onApprove();
        return;
      }

      // Cmd/Ctrl+Shift+Enter → Deny (if annotations exist)
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        if (hasAnnotations) onDeny();
        return;
      }

      // Single-key shortcuts require active text selection
      const sels = getSelection();
      if (!sels) {
        if (e.key.toLowerCase() === "d" && !e.metaKey && !e.ctrlKey && !e.altKey && canToggleDiff) {
          e.preventDefault();
          onToggleDiff();
        }
        return;
      }

      if (e.key.toLowerCase() === "d" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onAction("deletion", sels);
        window.getSelection()?.removeAllRanges();
      } else if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onAction("comment", sels);
      } else if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onAction("replacement", sels);
      } else if (e.key.toLowerCase() === "i" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onAction("insertion", sels);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [getSelection, onAction, onApprove, onDeny, onToggleDiff, canToggleDiff, hasAnnotations, decided]);
}
