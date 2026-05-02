import { fileURLToPath } from "node:url";
import { detectPackageManager } from "../shared/packageManager.mjs";
import { runPlanReviewBinary } from "../shared/planReview.mjs";
import { resolveRuntimeBinary } from "../shared/runtimeResolver.mjs";

/**
 * @param {{ plan: string, sessionId?: string, cwd?: string }} options
 */
export async function runPlanReview(options) {
  const runtime = resolveRuntimeBinary({ parentUrl: import.meta.url });

  const output = await runPlanReviewBinary({
    binaryPath: runtime.binaryPath,
    plan: options.plan,
    sessionId: options.sessionId,
    cwd: options.cwd,
    env: {
      OPEN_PLAN_HOST: "opencode",
      OPEN_PLAN_PKG_MANAGER: process.env.OPEN_PLAN_PKG_MANAGER || detectPackageManager({ installPath: fileURLToPath(import.meta.url) }),
    },
    detached: true,
  });

  const decision = output.hookSpecificOutput.decision;

  if (decision.behavior === "allow") {
    return { approved: true };
  }

  return {
    approved: false,
    feedback: decision.message,
  };
}
