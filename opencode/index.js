import { tool } from "@opencode-ai/plugin";
import { runPlanReview } from "./bridge.js";
import { resolveImplementationHandoff } from "./config.js";

const PLAN_REVIEW_INSTRUCTIONS = `## Plan Review Workflow

For non-trivial implementation work, create a plan first and call the \`submit_plan\` tool.
The user will review the plan in a browser and either approve it or request changes.

- If approved, proceed with implementation.
- If changes are requested, revise the plan and call \`submit_plan\` again.

Do not begin implementation until the plan is approved.`;

const IMPLEMENTATION_PROMPT = "Proceed with implementation.";

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
          "Submit a markdown plan for interactive user review. Returns approval status or structured revision feedback.",

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

          if (result.approved) {
            const lines = ["Plan approved by the user."];

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

            lines.push("Proceed with implementation.");
            return lines.join("\n\n");
          }

          return [
            "Plan needs revision.",
            "",
            "## User feedback",
            "",
            result.feedback ?? "Plan changes requested.",
            "",
            "Revise the plan using this feedback, then call `submit_plan` again.",
          ].join("\n");
        },
      }),
    },
  };
};

export default OpenPlanAnnotatorPlugin;
