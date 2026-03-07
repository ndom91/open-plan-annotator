import { describe, expect, test } from "bun:test";
import { detectPackageManager } from "./packageManager.mjs";

describe("detectPackageManager", () => {
  test("prefers explicit OPEN_PLAN_PKG_MANAGER", () => {
    expect(detectPackageManager({ env: { OPEN_PLAN_PKG_MANAGER: "pnpm" } })).toBe("pnpm");
  });

  test("detects package manager from npm user agent", () => {
    expect(detectPackageManager({ env: { npm_config_user_agent: "pnpm/10.0.0 node/v22.0.0" } })).toBe("pnpm");
  });

  test("detects package manager from npm execpath", () => {
    expect(detectPackageManager({ env: { npm_execpath: "/usr/local/lib/node_modules/pnpm/bin/pnpm.cjs" } })).toBe(
      "pnpm",
    );
  });

  test("detects package manager from install path hints", () => {
    expect(
      detectPackageManager({
        env: {},
        installPath: "/Users/test/Library/pnpm/global/5/node_modules/open-plan-annotator/bin/open-plan-annotator.mjs",
      }),
    ).toBe("pnpm");
  });

  test("falls back to npm", () => {
    expect(detectPackageManager({ env: {}, installPath: "/tmp/open-plan-annotator/bin/open-plan-annotator.mjs" })).toBe(
      "npm",
    );
  });
});
