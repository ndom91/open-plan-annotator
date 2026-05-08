import { useEffect, useState } from "react";
import { cn } from "../utils/cn.ts";
import type { Block } from "../utils/markdown.ts";

interface TableOfContentsProps {
  blocks: Block[];
}

interface HeadingEntry {
  index: number;
  level: number;
  text: string;
}

export function TableOfContents({ blocks }: TableOfContentsProps) {
  const headings: HeadingEntry[] = blocks
    .filter((b): b is Block & { level: number } => b.type === "heading" && typeof b.level === "number" && b.level <= 3)
    .map((b) => ({ index: b.index, level: b.level, text: b.content }));

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (headings.length === 0) {
      setActiveIndex(null);
      return;
    }

    const elements = headings
      .map((h) => document.querySelector<HTMLElement>(`[data-block-index="${h.index}"]`))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const visible = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          const idx = Number(target.dataset.blockIndex);
          if (entry.isIntersecting) {
            visible.set(idx, entry.intersectionRatio);
          } else {
            visible.delete(idx);
          }
        }
        if (visible.size === 0) return;
        const top = Array.from(visible.entries()).sort((a, b) => a[0] - b[0])[0][0];
        setActiveIndex(top);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: [0, 0.5, 1] },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  const handleClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    const el = document.querySelector<HTMLElement>(`[data-block-index="${index}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveIndex(index);
  };

  return (
    <nav aria-label="Table of contents">
      <h3 className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-widest mb-3 pl-1">Contents</h3>
      <ul className="space-y-0.5">
        {headings.map((h) => {
          const isActive = activeIndex === h.index;
          if (h.level === 1) {
            return (
              <li key={h.index} className="mt-3 first:mt-0">
                <a
                  href={`#block-${h.index}`}
                  onClick={(e) => handleClick(e, h.index)}
                  className={cn(
                    "block px-3 py-1 text-[11px] font-semibold uppercase tracking-widest cursor-pointer transition-colors duration-150",
                    isActive ? "text-accent" : "text-ink-tertiary hover:text-ink-secondary",
                  )}
                >
                  {h.text}
                </a>
              </li>
            );
          }
          const indent = h.level === 3 ? "pl-6" : "pl-3";
          return (
            <li key={h.index}>
              <a
                href={`#block-${h.index}`}
                onClick={(e) => handleClick(e, h.index)}
                className={cn(
                  "block py-1 pr-2 text-[13px] cursor-pointer transition-colors duration-150 border-l-2",
                  indent,
                  isActive
                    ? "border-l-accent text-ink font-medium"
                    : "border-l-transparent text-ink-tertiary hover:text-ink-secondary hover:border-l-rule",
                )}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
