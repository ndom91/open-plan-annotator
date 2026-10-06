import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { shouldSkipHook } from "./skipHook.mjs";

describe("shouldSkipHook", () => {
  test("does not skip when the env var is unset", () => {
    expect(shouldSkipHook({})).toBe(false);
  });

  test("does not skip when the file is missing", () => {
    const skipFile = path.join(os.tmpdir(), "opa-skip-missing");
    expect(shouldSkipHook({ OPEN_PLAN_ANNOTATOR_SKIP_FILE: skipFile })).toBe(false);
  });

  test("skips when the file exists", () => {
    const skipFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "opa-skip-")), "skip");
    fs.writeFileSync(skipFile, "");
    expect(shouldSkipHook({ OPEN_PLAN_ANNOTATOR_SKIP_FILE: skipFile })).toBe(true);
  });
});
