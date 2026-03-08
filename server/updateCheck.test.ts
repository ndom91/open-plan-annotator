import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkForUpdate } from "./updateCheck.ts";

describe("checkForUpdate", () => {
  let configDir: string;

  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), "opa-update-"));
  });

  afterEach(() => {
    rmSync(configDir, { recursive: true, force: true });
    mock.restore();
  });

  test("returns cached result when cache is fresh", async () => {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "update-check.json"),
      JSON.stringify({ latestVersion: "99.0.0", checkedAt: Date.now() }),
    );

    const fetchSpy = spyOn(globalThis, "fetch");
    const result = await checkForUpdate(configDir, "npm", { host: "claude-code" });

    expect(result.latestVersion).toBe("99.0.0");
    expect(result.updateAvailable).toBe(true);
    expect(result.updateInstructions).toContain("Claude Code");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("fetches latest version from npm when cache is stale", async () => {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "update-check.json"),
      JSON.stringify({ latestVersion: "0.0.1", checkedAt: Date.now() - 5 * 60 * 60 * 1000 }),
    );

    spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ version: "99.0.0" }),
    } as Response);

    const result = await checkForUpdate(configDir, "pnpm", { host: "opencode" });

    expect(result.latestVersion).toBe("99.0.0");
    expect(result.updateAvailable).toBe(true);
    expect(result.updateInstructions).toContain("OpenCode");
  });

  test("falls back to no-update result when registry lookup fails", async () => {
    spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const result = await checkForUpdate(configDir, "bun");

    expect(result.updateAvailable).toBe(false);
    expect(result.latestVersion).toBeNull();
    expect(result.updateInstructions).toContain("bun");
  });
});
