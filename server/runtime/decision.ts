import type { HookEvent, HookOutput, ReviewOutput, ServerDecision } from "../types.ts";

export interface DecisionController {
  decisionPromise: Promise<ServerDecision>;
  resolveDecision: (decision: ServerDecision) => void;
}

export function createDecisionController(): DecisionController {
  let resolveDecision: (decision: ServerDecision) => void = () => {};
  const decisionPromise = new Promise<ServerDecision>((resolve) => {
    resolveDecision = resolve;
  });

  return { decisionPromise, resolveDecision };
}

export async function writeHookDecisionToStdout(decision: ServerDecision, hookEvent: HookEvent): Promise<void> {
  const output: HookOutput =
    hookEvent.hook_event_name === "PermissionRequest"
      ? {
          hookSpecificOutput: {
            hookEventName: "PermissionRequest",
            decision: decision.approved
              ? { behavior: "allow" }
              : { behavior: "deny", message: decision.feedback ?? "Plan changes requested." },
          },
        }
      : {
          hookSpecificOutput: decision.approved
            ? {
                hookEventName: "PreToolUse",
                permissionDecision: "allow",
              }
            : {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason: decision.feedback ?? "Plan changes requested.",
              },
        };

  const jsonLine = `${JSON.stringify(output)}\n`;
  const { closeSync, writeSync } = await import("node:fs");
  writeSync(1, jsonLine);
  closeSync(1);
}

export async function writeReviewDecisionToStdout(decision: ServerDecision, planPath: string): Promise<void> {
  const output: ReviewOutput = {
    approved: decision.approved,
    feedback: decision.feedback ?? null,
    annotations: decision.annotations ?? [],
    planPath,
  };

  const jsonLine = `${JSON.stringify(output)}\n`;
  const { closeSync, writeSync } = await import("node:fs");
  writeSync(1, jsonLine);
  closeSync(1);
}
