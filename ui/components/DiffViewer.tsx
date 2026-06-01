import { parseDiffFromFile } from "@pierre/diffs";
import { type BaseDiffOptions, type FileContents, FileDiff } from "@pierre/diffs/react";
import { useMemo } from "react";
import { useTheme } from "./ThemeProvider.tsx";

const DIFF_CONTEXT_BAR_CSS = `
[data-separator=line-info] {
  background: var(--diffs-bg-separator);
}

[data-separator=line-info] [data-separator-wrapper] {
  border-block: 1px solid var(--color-rule-subtle);
  background: var(--diffs-bg-separator);
}

[data-expand-button],
[data-separator-content] {
  background: transparent;
  transition: background-color 0.15s ease, color 0.15s ease;
}

[data-expand-button] {
  border-right: 1px solid var(--diffs-bg);
}

[data-expand-button]:hover,
[data-expand-index] [data-separator-content]:hover {
  background: var(--diffs-bg-context);
  color: var(--diffs-fg);
}

[data-expand-index] [data-separator-content]:hover {
  text-decoration: none;
}

[data-unmodified-lines] {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  height: 100%;
  font-weight: 500;
}

@supports (width: 1cqi) {
  [data-unified] [data-separator=line-info] [data-separator-wrapper] {
    width: 100cqi;
    padding-inline: 0;
  }

  :is([data-unified] [data-separator=line-info] [data-separator-wrapper]) [data-separator-content] {
    border-radius: 0;
  }
}
`;

const PIERRE_DIFF_OPTIONS = {
  dark: {
    theme: { dark: "pierre-dark", light: "pierre-light" },
    themeType: "dark",
    diffStyle: "unified",
    diffIndicators: "classic",
    disableFileHeader: true,
    disableLineNumbers: true,
    overflow: "scroll",
    lineDiffType: "word",
    unsafeCSS: DIFF_CONTEXT_BAR_CSS,
  },
  light: {
    theme: { dark: "pierre-dark", light: "pierre-light" },
    themeType: "light",
    diffStyle: "unified",
    diffIndicators: "classic",
    disableFileHeader: true,
    disableLineNumbers: true,
    overflow: "scroll",
    lineDiffType: "word",
    unsafeCSS: DIFF_CONTEXT_BAR_CSS,
  },
} satisfies Record<"dark" | "light", BaseDiffOptions>;

interface DiffViewerProps {
  oldText: string;
  newText: string;
  oldVersion: number;
  newVersion: number;
}

export function DiffViewer({ oldText, newText, oldVersion, newVersion }: DiffViewerProps) {
  const { dark } = useTheme();
  const fileDiff = useMemo(() => {
    const oldFile: FileContents = {
      name: `plan-v${oldVersion}.md`,
      contents: oldText,
      lang: "markdown",
    };
    const newFile: FileContents = {
      name: `plan-v${newVersion}.md`,
      contents: newText,
      lang: "markdown",
    };

    return parseDiffFromFile(oldFile, newFile);
  }, [oldText, newText, oldVersion, newVersion]);
  const added = fileDiff.hunks.reduce((sum, hunk) => sum + hunk.additionLines, 0);
  const removed = fileDiff.hunks.reduce((sum, hunk) => sum + hunk.deletionLines, 0);

  return (
    <div className="bg-inset">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-rule-subtle bg-inset/80 font-mono text-xs sticky top-0 z-10">
        <span className="text-ink-tertiary">
          Comparing <span className="font-medium text-ink-secondary">v{oldVersion}</span> &rarr;{" "}
          <span className="font-medium text-ink-secondary">v{newVersion}</span>
        </span>
        <span className="text-approve">{added} added</span>
        <span className="text-redline">{removed} removed</span>
      </div>
      <div className="overflow-x-auto py-3">
        <FileDiff
          fileDiff={fileDiff}
          disableWorkerPool
          className="plan-diff-container"
          options={PIERRE_DIFF_OPTIONS[dark ? "dark" : "light"]}
        />
      </div>
    </div>
  );
}
