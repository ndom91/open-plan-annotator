import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractBinaryFromTar } from "./selfUpdate.ts";
import { checkForUpdate, isNewerVersion } from "./updateCheck.ts";

// ---------------------------------------------------------------------------
// isNewerVersion
// ---------------------------------------------------------------------------
describe("isNewerVersion", () => {
  test("detects newer patch", () => {
    expect(isNewerVersion("1.0.0", "1.0.1")).toBe(true);
  });

  test("detects newer minor", () => {
    expect(isNewerVersion("1.0.0", "1.1.0")).toBe(true);
  });

  test("detects newer major", () => {
    expect(isNewerVersion("1.9.9", "2.0.0")).toBe(true);
  });

  test("returns false for equal versions", () => {
    expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
  });

  test("returns false for older version", () => {
    expect(isNewerVersion("2.0.0", "1.9.9")).toBe(false);
  });

  test("handles multi-digit segments", () => {
    expect(isNewerVersion("1.0.9", "1.0.10")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// extractBinaryFromTar
// ---------------------------------------------------------------------------
describe("extractBinaryFromTar", () => {
  function createTarEntry(name: string, content: Uint8Array): Uint8Array {
    const encoder = new TextEncoder();
    const header = new Uint8Array(512);

    // Name field (0-99)
    const nameBytes = encoder.encode(name);
    header.set(nameBytes.subarray(0, 100), 0);

    // Size field (124-135) in octal
    const sizeOctal = encoder.encode(content.length.toString(8).padStart(11, "0"));
    header.set(sizeOctal, 124);

    // Pad content to 512-byte boundary
    const paddedSize = Math.ceil(content.length / 512) * 512;
    const data = new Uint8Array(paddedSize);
    data.set(content, 0);

    const entry = new Uint8Array(512 + paddedSize);
    entry.set(header, 0);
    entry.set(data, 512);
    return entry;
  }

  test("extracts binary by exact name", () => {
    const content = new TextEncoder().encode("binary-content-here");
    const tar = createTarEntry("open-plan-annotator", content);
    const result = extractBinaryFromTar(tar);
    expect(new TextDecoder().decode(result)).toBe("binary-content-here");
  });

  test("extracts binary with directory prefix", () => {
    const content = new TextEncoder().encode("prefixed-binary");
    const tar = createTarEntry("some-dir/open-plan-annotator", content);
    const result = extractBinaryFromTar(tar);
    expect(new TextDecoder().decode(result)).toBe("prefixed-binary");
  });

  test("skips non-matching entries", () => {
    const other = createTarEntry("README.md", new TextEncoder().encode("readme"));
    const binary = createTarEntry("open-plan-annotator", new TextEncoder().encode("the-binary"));

    const combined = new Uint8Array(other.length + binary.length);
    combined.set(other, 0);
    combined.set(binary, other.length);

    const result = extractBinaryFromTar(combined);
    expect(new TextDecoder().decode(result)).toBe("the-binary");
  });

  test("throws if binary not found", () => {
    const tar = createTarEntry("something-else", new TextEncoder().encode("nope"));
    // Append empty block to signal end-of-archive
    const withEnd = new Uint8Array(tar.length + 512);
    withEnd.set(tar, 0);
    expect(() => extractBinaryFromTar(withEnd)).toThrow("not found");
  });
});

// ---------------------------------------------------------------------------
// checkForUpdate
// ---------------------------------------------------------------------------
describe("checkForUpdate", () => {
  let configDir: string;

  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), "opa-test-"));
  });

  afterEach(() => {
    rmSync(configDir, { recursive: true, force: true });
    mock.restore();
  });

  test("returns cached result when cache is fresh", async () => {
    const cache = {
      latestVersion: "99.0.0",
      checkedAt: Date.now(),
      assetUrl: "https://example.com/binary.tar.gz",
    };
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "update-check.json"), JSON.stringify(cache));

    const fetchSpy = spyOn(globalThis, "fetch");

    const result = await checkForUpdate(configDir, "npm");
    expect(result.updateAvailable).toBe(true);
    expect(result.latestVersion).toBe("99.0.0");
    // Should NOT have called GitHub API
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("fetches from GitHub when cache is stale", async () => {
    const staleCache = {
      latestVersion: "0.0.1",
      checkedAt: Date.now() - 5 * 60 * 60 * 1000, // 5 hours ago
      assetUrl: null,
    };
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "update-check.json"), JSON.stringify(staleCache));

    const mockResponse = {
      ok: true,
      json: async () => ({
        tag_name: "v99.0.0",
        assets: [{ name: "open-plan-annotator-darwin-arm64.tar.gz", browser_download_url: "https://example.com/dl" }],
      }),
    };
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as Response);

    const result = await checkForUpdate(configDir, "pnpm");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.latestVersion).toBe("99.0.0");
    expect(result.updateAvailable).toBe(true);
    expect(result.updateCommand).toBe("pnpm update open-plan-annotator");
  });

  test("returns updateAvailable: false when fetch fails", async () => {
    spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const result = await checkForUpdate(configDir, "npm");
    expect(result.updateAvailable).toBe(false);
    expect(result.latestVersion).toBeNull();
  });

  test("returns updateAvailable: false when versions are equal", async () => {
    // Use a mock that returns the same version as the current one
    // We need to know what VERSION is - import it
    const { VERSION } = await import("./version.ts");
    const cache = {
      latestVersion: VERSION,
      checkedAt: Date.now(),
      assetUrl: null,
    };
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "update-check.json"), JSON.stringify(cache));

    const result = await checkForUpdate(configDir, "npm");
    expect(result.updateAvailable).toBe(false);
  });

  test("reflects package manager in updateCommand", async () => {
    const cache = {
      latestVersion: "99.0.0",
      checkedAt: Date.now(),
      assetUrl: null,
    };
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "update-check.json"), JSON.stringify(cache));

    for (const pm of ["npm", "pnpm", "bun", "yarn"]) {
      const result = await checkForUpdate(configDir, pm);
      expect(result.updateCommand).toBe(`${pm} update open-plan-annotator`);
    }
  });
});
