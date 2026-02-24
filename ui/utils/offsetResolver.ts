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

  // Only support single-block selections in V1
  if (!anchorBlock || !focusBlock || anchorBlock !== focusBlock) {
    return null;
  }

  const blockIndex = parseInt(anchorBlock.dataset.blockIndex ?? "-1", 10);
  if (blockIndex < 0) return null;

  const range = selection.getRangeAt(0);

  // Compute start offset relative to the block element
  const preRange = document.createRange();
  preRange.selectNodeContents(anchorBlock);
  preRange.setEnd(range.startContainer, range.startOffset);
  const startOffset = preRange.toString().length;

  const text = range.toString();
  const endOffset = startOffset + text.length;

  if (text.trim().length === 0) return null;

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
