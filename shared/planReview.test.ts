import { describe, expect, test } from "bun:test";
import { buildHookPayload, parseHookOutput, validateHookOutput } from "./planReview.mjs";

describe("planReview", () => {
  test("buildHookPayload includes the plan text and defaults", () => {
    const payload = buildHookPayload({ plan: "# Plan" });

    expect(payload.tool_name).toBe("ExitPlanMode");
    expect(payload.tool_input.plan).toBe("# Plan");
    expect(payload.permission_mode).toBe("default");
  });

  test("validateHookOutput accepts allow and deny decisions", () => {
    expect(
      validateHookOutput({
        hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow" } },
      }).hookSpecificOutput.decision.behavior,
    ).toBe("allow");

    expect(
      validateHookOutput({
        hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "deny", message: "no" } },
      }).hookSpecificOutput.decision.behavior,
    ).toBe("deny");
  });

  test("parseHookOutput finds hook JSON in noisy stdout", () => {
    const output = parseHookOutput(
      'open-plan-annotator: UI available at http://localhost:1234\n{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}',
      "",
    );

    expect(output.hookSpecificOutput.decision.behavior).toBe("allow");
  });
});
