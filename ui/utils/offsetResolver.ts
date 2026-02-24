export interface ResolvedSelection {
  blockIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;
}

export function resolveSelection(selection: Selection): ResolvedSelection | null {
  if (selection.isCollapsed || !selection.anchorNode || !selection.focusNode) {
    return null;
  }

  const anchorBlock = findBlockElement(selection.anchorNode);
  const focusBlock = findBlockElement(selection.focusNode);

  // Only support single-block selections
  if (!anchorBlock || !focusBlock || anchorBlock !== focusBlock) {
    return null;
  }

  const blockIndex = parseInt(anchorBlock.dataset.blockIndex ?? "-1", 10);
  if (blockIndex < 0) return null;

  const range = selection.getRangeAt(0);
  const text = range.toString();
  if (text.trim().length === 0) return null;

  // Find the segment elements containing the start and end of the selection.
  // Each segment span has data-seg-start and data-seg-end attributes that
  // encode the original character offsets in block.content.
  const startSeg = findSegmentElement(range.startContainer);
  const endSeg = findSegmentElement(range.endContainer);

  if (!startSeg || !endSeg) {
    // Fallback: selection is outside segment spans (shouldn't happen, but be safe)
    return null;
  }

  // If the selection is inside a replacement/insertion preview span (data-replacement),
  // reject it — user shouldn't annotate the replacement text.
  if (isInsideReplacement(range.startContainer) || isInsideReplacement(range.endContainer)) {
    return null;
  }

  const segStart = parseInt(startSeg.dataset.segStart ?? "0", 10);
  const segEnd = parseInt(endSeg.dataset.segEnd ?? "0", 10);

  // Compute offset within the start segment's visible original text
  const preRange = document.createRange();
  preRange.selectNodeContents(startSeg);
  preRange.setEnd(range.startContainer, range.startOffset);
  const offsetInStartSeg = preRange.toString().length;

  const startOffset = segStart + offsetInStartSeg;

  // For the end offset: if start and end are in the same segment, easy math.
  // If they span segments, use the end segment's start + offset within it.
  let endOffset: number;
  if (startSeg === endSeg) {
    endOffset = startOffset + text.length;
    // Clamp to segment boundary
    if (endOffset > segEnd) endOffset = segEnd;
  } else {
    const endSegStart = parseInt(endSeg.dataset.segStart ?? "0", 10);
    const preRangeEnd = document.createRange();
    preRangeEnd.selectNodeContents(endSeg);
    preRangeEnd.setEnd(range.endContainer, range.endOffset);
    const offsetInEndSeg = preRangeEnd.toString().length;
    endOffset = endSegStart + offsetInEndSeg;
  }

  // Re-derive the selected text from original content offsets for accuracy
  return { blockIndex, startOffset, endOffset, text };
}

function findBlockElement(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== document.body) {
    if (current instanceof HTMLElement && current.dataset.blockIndex !== undefined) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

function findSegmentElement(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== document.body) {
    if (current instanceof HTMLElement && current.dataset.segStart !== undefined) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

function isInsideReplacement(node: Node): boolean {
  let current: Node | null = node;
  while (current && current !== document.body) {
    if (current instanceof HTMLElement && current.dataset.replacement === "true") {
      return true;
    }
    current = current.parentNode;
  }
  return false;
}
