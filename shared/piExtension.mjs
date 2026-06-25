import { fileURLToPath } from "node:url";
import { Type } from "typebox";
import { detectPackageManager } from "./packageManager.mjs";
import { runPlanReviewBinary } from "./planReview.mjs";
import { resolveRuntimeBinary } from "./runtimeResolver.mjs";

const TOOL_NAME = "annotate_plan";

function getSessionId(ctx) {
  try {
    return ctx.sessionManager.getSessionId();
  } catch {
    return undefined;
  }
}

function getLastAssistantText(ctx) {
  const branch = ctx.sessionManager.getBranch();

  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry.type !== "message") continue;

    const message = entry.message;
    if (!message || message.role !== "assistant" || !Array.isArray(message.content)) continue;

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (text) return text;
  }

  return undefined;
}

async function reviewPlan(plan, ctx) {
  const runtime = resolveRuntimeBinary({ parentUrl: import.meta.url });
  const result = await runPlanReviewBinary({
    binaryPath: runtime.binaryPath,
    plan,
    sessionId: getSessionId(ctx),
    cwd: ctx.cwd,
    env: {
      OPEN_PLAN_HOST: "pi",
      OPEN_PLAN_PKG_MANAGER:
        process.env.OPEN_PLAN_PKG_MANAGER || detectPackageManager({ installPath: fileURLToPath(import.meta.url) }),
    },
    detached: true,
  });

  const { permissionDecision, permissionDecisionReason } = result.hookSpecificOutput;
  return {
    approved: permissionDecision === "allow",
    feedback: permissionDecision === "deny" ? permissionDecisionReason : undefined,
  };
}

export function registerPiExtension(pi) {
  pi.registerTool({
    name: TOOL_NAME,
    label: "Annotate Plan",
    description: "Open the browser-based plan annotation UI and return approval or revision feedback.",
    promptSnippet: "Use this tool after drafting a plan that needs human review before implementation.",
    promptGuidelines: [
      "Call annotate_plan when you have a concrete plan in markdown form.",
      "Include the full plan text, including numbered steps if available.",
      "Wait for the review result before proceeding with implementation.",
    ],
    parameters: Type.Object({
      plan: Type.String({ description: "The plan markdown to review" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const review = await reviewPlan(params.plan, ctx);

      if (review.approved) {
        return {
          content: [{ type: "text", text: "Plan approved. Continue with implementation." }],
          details: { approved: true },
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Plan changes requested:\n\n${review.feedback ?? "No feedback provided."}`,
          },
        ],
        details: { approved: false, feedback: review.feedback ?? null },
      };
    },
  });

  pi.registerCommand("annotate-plan", {
    description: "Open the plan annotation UI for the latest plan or provided plan text.",
    handler: async (args, ctx) => {
      let plan = args.trim();

      if (!plan) {
        plan = getLastAssistantText(ctx) ?? "";
      }

      if (!plan && !ctx.hasUI) {
        ctx.ui.notify("Usage: /annotate-plan <plan markdown> or run it after a plan message.", "warning");
        return;
      }

      if (!plan) {
        const edited = await ctx.ui.editor("Paste plan markdown", "# Plan\n\n1. ");
        if (!edited?.trim()) {
          ctx.ui.notify("Plan review cancelled", "info");
          return;
        }
        plan = edited;
      }

      try {
        const review = await reviewPlan(plan, ctx);
        if (review.approved) {
          ctx.ui.notify("Plan approved.", "success");
          return;
        }

        ctx.ui.notify(`Changes requested:\n${review.feedback ?? "No feedback provided."}`, "warning");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Plan review failed: ${message}`, "error");
      }
    },
  });
}
