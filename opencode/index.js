import { tool } from "@opencode-ai/plugin";
import { runPlanReview } from "./bridge.js";
import { resolveImplementationHandoff } from "./config.js";

const PLAN_REVIEW_INSTRUCTIONS = `## Plan Review Workflow

For non-trivial implementation work, create a plan first and call the \`submit_plan\` tool.
The user will review the plan in a browser UI and either approve it or request changes.

- If the tool returns that the plan was **approved**: immediately begin writing code. Do NOT call \`submit_plan\` again — the plan phase is complete.
- If the tool returns **revision feedback**: revise the plan based on the feedback, then call \`submit_plan\` again with the updated plan.

Only call \`submit_plan\` once per plan version. After approval, your sole job is to implement what was approved.`;

const IMPLEMENTATION_PROMPT = "The plan has been approved by the user. Begin implementing it now — write code, create files, and make changes as described in the plan. Do not re-submit or re-review the plan.";

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
