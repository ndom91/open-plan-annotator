import { describe, expect, test } from "bun:test";
import { buildUpdateInstructions } from "./updateHints.mjs";

describe("buildUpdateInstructions", () => {
  test("builds exact npm command by default", () => {
    expect(buildUpdateInstructions({ version: "1.2.3" })).toBe("Run `npm i -g open-plan-annotator@1.2.3`.");
  });

  test("builds exact pnpm command", () => {
    expect(buildUpdateInstructions({ packageManager: "pnpm", version: "1.2.3" })).toBe(
      "Run `pnpm i -g open-plan-annotator@1.2.3`.",
    );
  });

  test("builds exact bun command", () => {
    expect(buildUpdateInstructions({ packageManager: "bun", version: "1.2.3" })).toBe(
      "Run `bun add -g open-plan-annotator@1.2.3`.",
    );
  });

  test("keeps host-specific instructions", () => {
    expect(buildUpdateInstructions({ host: "claude-code", version: "1.2.3" })).toContain("Claude Code");
    expect(buildUpdateInstructions({ host: "opencode", version: "1.2.3" })).toContain("OpenCode");
  });
});
