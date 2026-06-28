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
        hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" },
      }).hookSpecificOutput.permissionDecision,
    ).toBe("allow");

    expect(
      validateHookOutput({
        hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "no" },
      }).hookSpecificOutput.permissionDecision,
    ).toBe("deny");
  });

  test("parseHookOutput finds hook JSON in noisy stdout", () => {
    const output = parseHookOutput(
      'open-plan-annotator: UI available at http://localhost:1234\n{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}',
      "",
    );

    expect(output.hookSpecificOutput.permissionDecision).toBe("allow");
  });
});
