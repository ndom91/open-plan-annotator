import type { HookOutput, ServerDecision } from "../types.ts";

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

export async function writeHookDecisionToStdout(decision: ServerDecision): Promise<void> {
  const output: HookOutput = {
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: decision.approved
        ? { behavior: "allow" }
        : { behavior: "deny", message: decision.feedback ?? "Plan changes requested." },
    },
  };

  const jsonLine = `${JSON.stringify(output)}\n`;
  const { closeSync, writeSync } = await import("node:fs");
  writeSync(1, jsonLine);
  closeSync(1);
}
