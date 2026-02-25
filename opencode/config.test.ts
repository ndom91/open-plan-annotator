import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveImplementationHandoff } from "./config.js";

function withEnv(key: string, value: string | undefined, fn: () => Promise<void>) {
  const original = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }

  return fn().finally(() => {
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  });
}

describe("resolveImplementationHandoff", () => {
  test("returns defaults when no config files exist", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "open-plan-annotator-config-"));

    try {
      await withEnv("XDG_CONFIG_HOME", join(tempRoot, "xdg"), async () => {
        const result = await resolveImplementationHandoff(join(tempRoot, "project"));
        expect(result.enabled).toBe(true);
        expect(result.agent).toBe("build");
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("uses global config when project config is missing", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "open-plan-annotator-config-"));
    const xdgHome = join(tempRoot, "xdg");
    const globalConfigDir = join(xdgHome, "opencode");
    mkdirSync(globalConfigDir, { recursive: true });
    writeFileSync(
      join(globalConfigDir, "open-plan-annotator.json"),
      JSON.stringify({ implementationHandoff: { enabled: false, agent: "explore" } }),
      "utf8",
    );

    try {
      await withEnv("XDG_CONFIG_HOME", xdgHome, async () => {
        const result = await resolveImplementationHandoff(join(tempRoot, "project"));
        expect(result.enabled).toBe(false);
        expect(result.agent).toBe("explore");
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("project config overrides global config", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "open-plan-annotator-config-"));
    const xdgHome = join(tempRoot, "xdg");
    const globalConfigDir = join(xdgHome, "opencode");
    const projectDir = join(tempRoot, "project");
    const projectConfigDir = join(projectDir, ".opencode");

    mkdirSync(globalConfigDir, { recursive: true });
    mkdirSync(projectConfigDir, { recursive: true });

    writeFileSync(
      join(globalConfigDir, "open-plan-annotator.json"),
      JSON.stringify({ implementationHandoff: { enabled: true, agent: "explore" } }),
      "utf8",
    );
    writeFileSync(
      join(projectConfigDir, "open-plan-annotator.json"),
      JSON.stringify({ implementationHandoff: { enabled: false, agent: "build" } }),
      "utf8",
    );

    try {
      await withEnv("XDG_CONFIG_HOME", xdgHome, async () => {
        const result = await resolveImplementationHandoff(projectDir);
        expect(result.enabled).toBe(false);
        expect(result.agent).toBe("build");
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("ignores malformed config and falls back", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "open-plan-annotator-config-"));
    const xdgHome = join(tempRoot, "xdg");
    const globalConfigDir = join(xdgHome, "opencode");
    mkdirSync(globalConfigDir, { recursive: true });
    writeFileSync(join(globalConfigDir, "open-plan-annotator.json"), "not-json", "utf8");

    try {
      await withEnv("XDG_CONFIG_HOME", xdgHome, async () => {
        const result = await resolveImplementationHandoff(join(tempRoot, "project"));
        expect(result.enabled).toBe(true);
        expect(result.agent).toBe("build");
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
