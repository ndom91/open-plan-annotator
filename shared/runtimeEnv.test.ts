import { describe, expect, test } from "bun:test";
import { buildRuntimeEnv } from "./runtimeEnv.mjs";

describe("buildRuntimeEnv", () => {
  test("defaults host to claude-code for hook mode", () => {
    expect(buildRuntimeEnv({ cliMode: "hook", baseEnv: {}, packageManager: "npm" }).OPEN_PLAN_HOST).toBe("claude-code");
  });

  test("does not default host for generic review mode", () => {
    expect(buildRuntimeEnv({ cliMode: "review", baseEnv: {}, packageManager: "npm" }).OPEN_PLAN_HOST).toBeUndefined();
  });

  test("preserves explicit host in all modes", () => {
    const env = buildRuntimeEnv({ cliMode: "review", baseEnv: { OPEN_PLAN_HOST: "opencode" }, packageManager: "npm" });

    expect(env.OPEN_PLAN_HOST).toBe("opencode");
  });
});
