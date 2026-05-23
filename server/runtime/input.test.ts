import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseReviewRuntimeInput } from "./input.ts";

describe("parseReviewRuntimeInput", () => {
  test("rejects missing files", async () => {
    await expect(parseReviewRuntimeInput(["/tmp/open-plan-annotator-missing.md"])).rejects.toThrow(
      "plan file not found",
    );
  });

  test("rejects non-Markdown files", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "open-plan-annotator-input-"));
    try {
      const filePath = join(tempRoot, "plan.txt");
      writeFileSync(filePath, "plan", "utf8");

      await expect(parseReviewRuntimeInput([filePath])).rejects.toThrow("review input must be a Markdown file");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("rejects empty Markdown files", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "open-plan-annotator-input-"));
    try {
      const filePath = join(tempRoot, "plan.md");
      writeFileSync(filePath, "\n", "utf8");

      await expect(parseReviewRuntimeInput([filePath])).rejects.toThrow("plan file is empty");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("rejects unknown flags", async () => {
    await expect(parseReviewRuntimeInput(["--json", "plan.md"])).rejects.toThrow("unknown review flag: --json");
  });

  test("parses valid Markdown files", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "open-plan-annotator-input-"));
    try {
      mkdirSync(join(tempRoot, "nested"));
      const filePath = join(tempRoot, "nested", "plan.md");
      writeFileSync(filePath, "# Plan\n", "utf8");

      const input = await parseReviewRuntimeInput([filePath, "--no-open"]);

      expect(input.mode).toBe("review");
      expect(input.planPath).toBe(filePath);
      expect(input.reviewOptions.noOpen).toBe(true);
      expect(input.hookEvent.cwd).toBe(join(tempRoot, "nested"));
      expect(input.planContent).toBe("# Plan\n");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
