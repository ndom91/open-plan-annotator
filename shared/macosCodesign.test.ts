import { describe, expect, test } from "bun:test";
import { codesignFixCommand, ensureValidCodeSignature, hasValidCodeSignature } from "./macosCodesign.mjs";

describe("macosCodesign", () => {
  test("treats non-darwin binaries as valid without running codesign", () => {
    expect(hasValidCodeSignature("/does/not/exist", "linux")).toBe(true);
    expect(ensureValidCodeSignature("/does/not/exist", "linux")).toBe(true);
  });

  test.if(process.platform === "darwin")("returns false without throwing when re-signing fails", () => {
    expect(ensureValidCodeSignature("/does/not/exist", "darwin")).toBe(false);
  });

  test("quotes the path in the fix command", () => {
    expect(codesignFixCommand("/a b/open-plan-annotator")).toBe('codesign --force --sign - "/a b/open-plan-annotator"');
  });
});
