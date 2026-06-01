import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface CommentTooltipProps {
  comment: string;
  children: ReactNode;
}

interface Anchor {
  top: number;
  bottom: number;
  center: number;
  placement: "above" | "below";
}

interface Box {
  left: number; // tooltip left edge (no transform — the fade animation owns transform)
  top: number; // tooltip top edge
  arrowLeft: number; // arrow x, relative to the tooltip's left edge
}

const GAP = 8;
const MARGIN = 8;
const MAX_WIDTH = 640; // matches max-w-160 (40rem)
const MIN_SPACE_ABOVE = 72; // flip below only when the mark is this close to the viewport top
const ARROW_INSET = 12; // keep the caret this far from the tooltip's corners

export function CommentTooltip({ comment, children }: CommentTooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [box, setBox] = useState<Box | null>(null);

  const measureAnchor = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const placement: Anchor["placement"] = rect.top >= MIN_SPACE_ABOVE ? "above" : "below";
    setAnchor({ top: rect.top, bottom: rect.bottom, center: rect.left + rect.width / 2, placement });
  }, []);

  const show = useCallback(() => measureAnchor(), [measureAnchor]);
  const hide = useCallback(() => {
    setAnchor(null);
    setBox(null);
  }, []);

  // After the tooltip mounts, measure its real size and place it with numeric
  // top/left. We intentionally do NOT use `transform` for positioning: the
  // fade-in-up animation animates `transform`, which would clobber it.
  useLayoutEffect(() => {
    if (!anchor) return;
    const tip = tooltipRef.current;
    if (!tip) return;
    const rect = tip.getBoundingClientRect();
    const width = Math.min(rect.width, MAX_WIDTH);
    const height = rect.height;

    const maxLeft = window.innerWidth - MARGIN - width;
    const left = Math.min(Math.max(anchor.center - width / 2, MARGIN), Math.max(MARGIN, maxLeft));
    const top = anchor.placement === "above" ? anchor.top - GAP - height : anchor.bottom + GAP;
    const arrowLeft = Math.min(Math.max(anchor.center - left, ARROW_INSET), width - ARROW_INSET);

    setBox({ left, top, arrowLeft });
  }, [anchor]);

  // Reposition while visible if layout shifts (scroll/resize).
  useLayoutEffect(() => {
    if (!anchor) return;
    const handler = () => measureAnchor();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [anchor, measureAnchor]);

  return (
    <span
      ref={triggerRef}
      className="annotation-mark bg-margin-note-bg border-b-2 border-margin-note/70 cursor-help"
      role="note"
      aria-label={`Comment: ${comment}`}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {anchor &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: "fixed",
              top: box ? box.top : anchor.top,
              left: box ? box.left : anchor.center,
              maxWidth: MAX_WIDTH,
              visibility: box ? "visible" : "hidden",
            }}
            className="pointer-events-none z-[60] block w-max rounded-md bg-inset border border-rule px-3 py-2 shadow-[0_4px_12px_oklch(0_0_0/0.15)] font-sans text-xs text-ink-secondary leading-relaxed whitespace-pre-wrap animate-fade-in-up"
          >
            <span
              style={box ? { left: box.arrowLeft } : { left: "50%" }}
              className={
                anchor.placement === "above"
                  ? "absolute -translate-x-1/2 top-full w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-rule"
                  : "absolute -translate-x-1/2 bottom-full w-0 h-0 border-x-[5px] border-x-transparent border-b-[5px] border-b-rule"
              }
            />
            {comment}
          </span>,
          document.body,
        )}
    </span>
  );
}
