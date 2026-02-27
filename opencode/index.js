import { tool } from "@opencode-ai/plugin";
import { runPlanReview } from "./bridge.js";
import { resolveImplementationHandoff } from "./config.js";

const PLAN_REVIEW_INSTRUCTIONS = `## Plan Review Workflow

Track planning/execution using this state enum:
- \`DISCOVERY\`, \`PLAN_DRAFT\`, \`AWAITING_PLAN_DECISION\`, \`EXECUTION\`, \`DONE\`

State transitions:
- Start in \`DISCOVERY\`.
- Move to \`PLAN_DRAFT\` only when a plan is required.
- From \`PLAN_DRAFT\`, call \`submit_plan\` exactly once, then move to \`AWAITING_PLAN_DECISION\`.
- If user approves plan, set \`plan_status=approved\` and move to \`EXECUTION\`.
- If user rejects or requests plan changes, set \`plan_status=rejected\` and return to \`PLAN_DRAFT\`.
- When work is complete, move to \`DONE\`.

Required flags:
- \`plan_status\` in \`{none, submitted, approved, rejected}\`
- \`explicit_replan\` in \`{true,false}\` (default \`false\`)
- Set \`explicit_replan=true\` only when user clearly asks to replan (for example: revise/change/new/update plan).

Hard rules:
1) \`submit_plan\` is allowed only in \`PLAN_DRAFT\`.
2) If \`plan_status=approved\`, \`submit_plan\` is forbidden unless \`explicit_replan=true\`.
3) Call \`submit_plan\` at most once per plan draft/version. If rejected, revise and submit once for the new draft.
4) After approval, treat follow-up user messages as execution refinements by default, not planning triggers.
5) On conflict, prioritize the approved plan and execute immediately.
6) Do not ask permission to proceed after approval; execute and report progress/results.
7) When delegating to subagents, always pass current \`plan_status\` and \`explicit_replan\` values.
8) If \`plan_status=approved\` and \`explicit_replan=false\`, subagents must execute and must not call \`submit_plan\`.

Tool guard before calling \`submit_plan\`:
- assert \`state == PLAN_DRAFT\`
- assert \`plan_status != approved || explicit_replan == true\`
- if an assertion fails, continue execution without submitting a new plan.`;

const IMPLEMENTATION_PROMPT = [
  "Plan review status: plan_status=approved.",
  "State transition: next_state=EXECUTION.",
  "Replan intent: explicit_replan=false unless the user explicitly asks to revise the plan.",
  "Execute the approved plan directly now — write code, create files, and make changes.",
  "Do not call `submit_plan` again unless the user explicitly requests re-planning.",
].join(" ");

function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "unknown error";
}

/** @type {import("@opencode-ai/plugin").Plugin} */
export const OpenPlanAnnotatorPlugin = async (ctx) => {
  const implementationHandoff = await resolveImplementationHandoff(ctx.directory);
  const implementationAgent = implementationHandoff.enabled ? implementationHandoff.agent : undefined;

  async function getCurrentUserAgent(sessionID) {
    if (!sessionID) {
      return undefined;
    }

    const response = await ctx.client.session.messages({
      path: { id: sessionID },
    });

    const messages = response?.data;
    if (!Array.isArray(messages)) {
      return undefined;
    }

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message?.info?.role === "user") {
        return message?.info?.agent;
      }
    }

    return undefined;
  }

  async function shouldInjectPlanReviewInstructions(sessionID) {
    if (!sessionID) {
      return true;
    }

    try {
      const currentAgent = await getCurrentUserAgent(sessionID);
      if (!currentAgent) {
        return true;
      }

      if (implementationAgent && currentAgent === implementationAgent) {
        return false;
      }

      const response = await ctx.client.app.agents({
        query: { directory: ctx.directory },
      });
      const agents = response?.data;
      if (!Array.isArray(agents)) {
        return true;
      }

      const agent = agents.find((candidate) => candidate.name === currentAgent);
      if (agent?.mode === "subagent") {
        return false;
      }
    } catch {
      return true;
    }

    return true;
  }

  async function handoffToImplementationAgent(sessionID) {
    if (!implementationAgent) {
      return null;
    }

    if (!sessionID) {
      return {
        agent: implementationAgent,
        warning: "Could not auto-switch because the current session ID was unavailable.",
      };
    }

    try {
      await ctx.client.session.prompt({
        path: { id: sessionID },
        body: {
          agent: implementationAgent,
          noReply: true,
          parts: [{ type: "text", text: IMPLEMENTATION_PROMPT }],
        },
      });

      return { agent: implementationAgent };
    } catch (error) {
      return {
        agent: implementationAgent,
        warning: `Could not auto-switch to \`${implementationAgent}\`: ${getErrorMessage(error)}`,
      };
    }
  }

  return {
    "experimental.chat.system.transform": async (input, output) => {
      const currentSystem = output.system.join("\n").toLowerCase();
      if (currentSystem.includes("title generator") || currentSystem.includes("generate a concise title")) {
        return;
      }

      if (!currentSystem.includes("submit_plan")) {
        const shouldInject = await shouldInjectPlanReviewInstructions(input?.sessionID);
        if (shouldInject) {
          output.system.push(PLAN_REVIEW_INSTRUCTIONS);
        }
      }
    },

    tool: {
      submit_plan: tool({
        description:
          "Submit a markdown plan for interactive user review. Returns a structured result with plan_status, next_state, approved, and feedback fields.",

        args: {
          plan: tool.schema.string().describe("The complete implementation plan in markdown format"),
          summary: tool.schema.string().optional().describe("Optional one-line plan summary"),
        },

        async execute(args, context) {
          const result = await runPlanReview({
            plan: args.plan,
            sessionId: context.sessionID,
            cwd: ctx.directory,
          });

          const basePayload = {
            plan_status: result.approved ? "approved" : "rejected",
            next_state: result.approved ? "EXECUTION" : "PLAN_DRAFT",
            approved: result.approved,
            feedback: result.approved ? null : (result.feedback ?? "Plan changes requested."),
          };

          if (result.approved) {
            const lines = [
              "Plan approved by the user.",
              "Do NOT call `submit_plan` again. The planning phase is finished.",
            ];

            if (args.summary) {
              lines.push(`Summary: ${args.summary}`);
            }

            const handoffResult = await handoffToImplementationAgent(context.sessionID);
            if (handoffResult) {
              if (handoffResult.warning) {
                lines.push(`Auto-switch warning: ${handoffResult.warning}`);
              } else {
                lines.push(`Auto-switched to the \`${handoffResult.agent}\` agent for implementation.`);
              }
            }

            lines.push("Begin implementing the approved plan now — write code and make changes.");
            return {
              ...basePayload,
              guidance: lines.join("\n\n"),
            };
          }

          return {
            ...basePayload,
            guidance: [
              "Plan needs revision.",
              "",
              "## User feedback",
              "",
              basePayload.feedback,
              "",
              "Revise the plan using this feedback, then submit the revised draft once via `submit_plan`.",
            ].join("\n"),
          };
        },
      }),
    },
  };
};

export default OpenPlanAnnotatorPlugin;
