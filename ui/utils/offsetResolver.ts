import { renderedToSourceOffset } from "./inlineMarkdown.tsx";

export interface ResolvedSelection {
  blockIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;
}

export function resolveSelection(selection: Selection): ResolvedSelection[] | null {
  if (selection.isCollapsed || !selection.anchorNode || !selection.focusNode) {
    return null;
  }

  const range = selection.getRangeAt(0);

  if (isInsideReplacement(range.startContainer) || isInsideReplacement(range.endContainer)) {
    return null;
  }

  const anchorBlock = findBlockElement(selection.anchorNode);
  const focusBlock = findBlockElement(selection.focusNode);

  if (!anchorBlock || !focusBlock) return null;

  // Single-block selection
  if (anchorBlock === focusBlock) {
    const result = resolveSingleBlock(range, anchorBlock);
    return result ? [result] : null;
  }

  // Multi-block selection
  return resolveMultiBlock(range, anchorBlock, focusBlock);
}

// --- Single-block resolution (existing logic) ---

function resolveSingleBlock(range: Range, block: HTMLElement): ResolvedSelection | null {
  const blockIndex = parseInt(block.dataset.blockIndex ?? "-1", 10);
  if (blockIndex < 0) return null;

  const text = range.toString();
  if (text.trim().length === 0) return null;

  const startSeg = findSegmentElement(range.startContainer);
  const endSeg = findSegmentElement(range.endContainer);
  if (!startSeg || !endSeg) return null;

  const segStart = parseInt(startSeg.dataset.segStart ?? "0", 10);
  const segEnd = parseInt(endSeg.dataset.segEnd ?? "0", 10);

  const preRange = document.createRange();
  preRange.selectNodeContents(startSeg);
  preRange.setEnd(range.startContainer, range.startOffset);
  const startOffset = segStart + toSourceOffset(startSeg, preRange.toString().length);

  let endOffset: number;
  if (startSeg === endSeg) {
    const fullPreRange = document.createRange();
    fullPreRange.selectNodeContents(startSeg);
    fullPreRange.setEnd(range.endContainer, range.endOffset);
    endOffset = segStart + toSourceOffset(startSeg, fullPreRange.toString().length);
    if (endOffset > segEnd) endOffset = segEnd;
  } else {
    const endSegStart = parseInt(endSeg.dataset.segStart ?? "0", 10);
    const preRangeEnd = document.createRange();
    preRangeEnd.selectNodeContents(endSeg);
    preRangeEnd.setEnd(range.endContainer, range.endOffset);
    endOffset = endSegStart + toSourceOffset(endSeg, preRangeEnd.toString().length);
  }

  return { blockIndex, startOffset, endOffset, text };
}

// --- Multi-block resolution ---

function resolveMultiBlock(
  range: Range,
  anchorBlock: HTMLElement,
  focusBlock: HTMLElement,
): ResolvedSelection[] | null {
  // Determine document order
  const cmp = anchorBlock.compareDocumentPosition(focusBlock);
  const firstBlock = cmp & Node.DOCUMENT_POSITION_FOLLOWING ? anchorBlock : focusBlock;
  const lastBlock = firstBlock === anchorBlock ? focusBlock : anchorBlock;

  const firstIndex = parseInt(firstBlock.dataset.blockIndex ?? "-1", 10);
  const lastIndex = parseInt(lastBlock.dataset.blockIndex ?? "-1", 10);
  if (firstIndex < 0 || lastIndex < 0) return null;

  // Find all block elements in the range
  const root = firstBlock.closest("article") ?? firstBlock.parentElement;
  if (!root) return null;

  const blockElements = Array.from(root.querySelectorAll<HTMLElement>("[data-block-index]"))
    .filter((el) => {
      const idx = parseInt(el.dataset.blockIndex ?? "-1", 10);
      return idx >= firstIndex && idx <= lastIndex;
    })
    .sort((a, b) => parseInt(a.dataset.blockIndex!, 10) - parseInt(b.dataset.blockIndex!, 10));

  const results: ResolvedSelection[] = [];

  for (let i = 0; i < blockElements.length; i++) {
    const block = blockElements[i];
    const blockIndex = parseInt(block.dataset.blockIndex!, 10);
    const contentLength = getBlockContentLength(block);
    if (contentLength === 0) continue;

    const isFirst = i === 0;
    const isLast = i === blockElements.length - 1;

    let startOffset: number;
    let endOffset: number;

    if (isFirst) {
      startOffset = computeStartOffset(range, block);
      if (startOffset < 0) continue;
      endOffset = contentLength;
    } else if (isLast) {
      startOffset = 0;
      endOffset = computeEndOffset(range, block);
      if (endOffset <= 0) continue;
    } else {
      startOffset = 0;
      endOffset = contentLength;
    }

    if (startOffset >= endOffset) continue;

    const text = collectSegmentText(block, startOffset, endOffset);
    if (text.trim().length === 0) continue;

    results.push({ blockIndex, startOffset, endOffset, text });
  }

  return results.length > 0 ? results : null;
}

function computeStartOffset(range: Range, block: HTMLElement): number {
  // The range.startContainer is inside this block
  const seg = findSegmentElement(range.startContainer);
  if (!seg || !block.contains(seg)) {
    // Selection starts before this block — use offset 0
    return 0;
  }
  const segStart = parseInt(seg.dataset.segStart ?? "0", 10);
  const preRange = document.createRange();
  preRange.selectNodeContents(seg);
  preRange.setEnd(range.startContainer, range.startOffset);
  return segStart + toSourceOffset(seg, preRange.toString().length);
}

function computeEndOffset(range: Range, block: HTMLElement): number {
  // The range.endContainer is inside this block
  const seg = findSegmentElement(range.endContainer);
  if (!seg || !block.contains(seg)) {
    // Selection ends after this block — use full content length
    return getBlockContentLength(block);
  }
  const segStart = parseInt(seg.dataset.segStart ?? "0", 10);
  const preRange = document.createRange();
  preRange.selectNodeContents(seg);
  preRange.setEnd(range.endContainer, range.endOffset);
  return segStart + toSourceOffset(seg, preRange.toString().length);
}

function getBlockContentLength(block: HTMLElement): number {
  let max = 0;
  for (const seg of block.querySelectorAll<HTMLElement>("[data-seg-end]")) {
    const end = parseInt(seg.dataset.segEnd ?? "0", 10);
    if (end > max) max = end;
  }
  return max;
}

function collectSegmentText(block: HTMLElement, startOffset: number, endOffset: number): string {
  let text = "";
  for (const seg of block.querySelectorAll<HTMLElement>("[data-seg-start]")) {
    if (seg.dataset.replacement === "true") continue;
    const segStart = parseInt(seg.dataset.segStart ?? "0", 10);
    const segEnd = parseInt(seg.dataset.segEnd ?? "0", 10);
    if (segEnd <= startOffset || segStart >= endOffset) continue;

    const segText = seg.textContent ?? "";
    const overlapStart = Math.max(0, startOffset - segStart);
    const overlapEnd = Math.min(segText.length, endOffset - segStart);
    text += segText.slice(overlapStart, overlapEnd);
  }
  return text;
}

/**
 * Convert a rendered-text distance (from preRange.toString().length) to a
 * markdown-source distance using data-seg-source when available.
 */
function toSourceOffset(seg: HTMLElement, renderedLen: number): number {
  const source = (seg as HTMLElement).dataset.segSource;
  if (source) {
    return renderedToSourceOffset(source, renderedLen);
  }
  // No source attr (e.g. code blocks) — rendered === source
  return renderedLen;
}

// --- DOM traversal helpers ---

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
