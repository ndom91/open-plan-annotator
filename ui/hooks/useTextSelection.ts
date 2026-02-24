import { useCallback, useEffect, useState } from "react";
import { type ResolvedSelection, resolveSelection } from "../utils/offsetResolver.ts";

export interface SelectionState {
  resolved: ResolvedSelection[] | null;
  rect: DOMRect | null;
  isActive: boolean;
}

export function useTextSelection(): SelectionState {
  const [state, setState] = useState<SelectionState>({
    resolved: null,
    rect: null,
    isActive: false,
  });

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setState({ resolved: null, rect: null, isActive: false });
      return;
    }

    const resolved = resolveSelection(sel);
    if (!resolved) {
      setState({ resolved: null, rect: null, isActive: false });
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setState({ resolved, rect, isActive: true });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [handleSelectionChange]);

  return state;
}
