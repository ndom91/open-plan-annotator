import { describe, expect, test } from "bun:test";
import { isNewerVersion, normalizeVersion } from "./versionInfo.mjs";

describe("normalizeVersion", () => {
  test("strips a leading v", () => {
    expect(normalizeVersion("v1.2.3")).toBe("1.2.3");
  });
});

describe("isNewerVersion", () => {
  test("detects newer patch", () => {
    expect(isNewerVersion("1.0.0", "1.0.1")).toBe(true);
  });

  test("returns false for equal versions", () => {
    expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
  });

  test("treats stable version as newer than prerelease", () => {
    expect(isNewerVersion("1.0.0-beta.2", "1.0.0")).toBe(true);
  });
});
