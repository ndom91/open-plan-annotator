import type { Block } from "./markdown.ts";

export interface Annotation {
  id: string;
  type: "deletion" | "comment" | "insertion" | "replacement";
  text: string;
  comment?: string;
  replacement?: string;
  blockIndex: number;
  startOffset: number;
  endOffset: number;
  createdAt: string;
}

export function serializeAnnotations(annotations: Annotation[], blocks: Block[]): string {
  if (annotations.length === 0) return "No specific feedback provided.";

  const lines: string[] = [
    "## Plan Review Feedback",
    "",
    "The following changes were requested before proceeding:",
    "",
  ];

  const deletions = annotations.filter((a) => a.type === "deletion");
  const replacements = annotations.filter((a) => a.type === "replacement");
  const insertions = annotations.filter((a) => a.type === "insertion");
  const comments = annotations.filter((a) => a.type === "comment");

  if (deletions.length > 0) {
    lines.push("### Requested Deletions", "");
    for (const d of deletions) {
      const block = blocks[d.blockIndex];
      const ctx = block ? ` (in: "${truncate(block.content, 60)}")` : "";
      lines.push(`- Remove: ~~${d.text}~~${ctx}`);
    }
    lines.push("");
  }

  if (replacements.length > 0) {
    lines.push("### Requested Replacements", "");
    for (const r of replacements) {
      lines.push(`- Replace "${r.text}" with "${r.replacement}"`);
    }
    lines.push("");
  }

  if (insertions.length > 0) {
    lines.push("### Requested Insertions", "");
    for (const ins of insertions) {
      lines.push(`- After "${ins.text}", insert: "${ins.replacement}"`);
    }
    lines.push("");
  }

  if (comments.length > 0) {
    lines.push("### Comments", "");
    for (const c of comments) {
      lines.push(`- On "${c.text}": ${c.comment}`);
    }
    lines.push("");
  }

  lines.push("Please revise the plan to address this feedback and present it again.");
  return lines.join("\n");
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}...` : s;
}
