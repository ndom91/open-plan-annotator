import { tool } from "@opencode-ai/plugin";
import { runPlanReview } from "./bridge.js";
import { resolveImplementationHandoff } from "./config.js";

const PLAN_REVIEW_INSTRUCTIONS = `## Plan Review Tool

The "open-plan-annotator plan annotation tool" refers to the \`annotate_plan\` tool.

When the user asks for a plan, proposal, implementation strategy, migration path, rollout plan, or asks "what would it look like," you MUST use the \`annotate_plan\` tool instead of replying with a normal Markdown plan.

Use \`annotate_plan\` when:
- The user explicitly says "make a plan", "write a plan", "give me a plan", "proposal", or "implementation plan".
- The user asks to evaluate an approach before code changes.
- The response contains ordered implementation steps.
- The plan would benefit from user approval before execution.

Do not use \`annotate_plan\` for:
- Tiny one-step tasks.
- Pure explanations with no proposed action.
- Final summaries after work is complete.

If there is any ambiguity about whether a response is a plan, prefer using \`annotate_plan\`.

The \`annotate_plan\` call should include:
- \`summary\`: one sentence describing the plan.
- \`plan\`: the full Markdown plan.

After calling \`annotate_plan\`, follow the returned instruction exactly:
- If approved, proceed.
- If revisions are requested, revise the plan and call \`annotate_plan\` again.
- If the user asks questions, answer them before proceeding.

## Plan Review Workflow

Track planning/execution using this state enum:
- \`DISCOVERY\`, \`PLAN_DRAFT\`, \`AWAITING_PLAN_DECISION\`, \`EXECUTION\`, \`DONE\`

State transitions:
- Start in \`DISCOVERY\`.
- Move to \`PLAN_DRAFT\` only when a plan is required.
- From \`PLAN_DRAFT\`, call \`annotate_plan\` exactly once, then move to \`AWAITING_PLAN_DECISION\`.
- If user approves plan, set \`plan_status=approved\` and move to \`EXECUTION\`.
- If user rejects or requests plan changes, set \`plan_status=rejected\` and return to \`PLAN_DRAFT\`.
- When work is complete, move to \`DONE\`.

Required flags:
- \`plan_status\` in \`{none, submitted, approved, rejected}\`
- \`explicit_replan\` in \`{true,false}\` (default \`false\`)
- Set \`explicit_replan=true\` only when user clearly asks to replan (for example: revise/change/new/update plan).

Hard rules:
1) \`annotate_plan\` is allowed only in \`PLAN_DRAFT\`.
2) If \`plan_status=approved\`, \`annotate_plan\` is forbidden unless \`explicit_replan=true\`.
3) Call \`annotate_plan\` at most once per plan draft/version. If rejected, revise and submit once for the new draft.
4) After approval, treat follow-up user messages as execution refinements by default, not planning triggers.
5) On conflict, prioritize the approved plan and execute immediately.
6) Do not ask permission to proceed after approval; execute and report progress/results.
7) When delegating to subagents, always pass current \`plan_status\` and \`explicit_replan\` values.
8) If \`plan_status=approved\` and \`explicit_replan=false\`, subagents must execute and must not call \`annotate_plan\`.

Tool guard before calling \`annotate_plan\`:
- assert \`state == PLAN_DRAFT\`
- assert \`plan_status != approved || explicit_replan == true\`
- if an assertion fails, continue execution without submitting a new plan.`;

const IMPLEMENTATION_PROMPT = [
  "Plan review status: plan_status=approved.",
  "State transition: next_state=EXECUTION.",
  "Replan intent: explicit_replan=false unless the user explicitly asks to revise the plan.",
  "Execute the approved plan directly now — write code, create files, and make changes.",
  "Do not call `annotate_plan` again unless the user explicitly requests re-planning.",
].join(" ");

/** @param {unknown} error */
function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "unknown error";
}

/**
 * @param {import("@opencode/plugin").Plugin.Context} ctx
 * @param {string | undefined} implementationAgent
 * @param {{ agent?: string }} event
 */
async function shouldInjectPlanReviewInstructions(ctx, implementationAgent, event) {
  const currentAgent = event.agent;
  if (!currentAgent) {
    return true;
  }

  try {
    if (implementationAgent && currentAgent === implementationAgent) {
      return false;
    }

    const agentsResponse = await ctx.agent.list();
    const agent = agentsResponse.data.find((candidate) => candidate.name === currentAgent);
    if (agent?.mode === "subagent") {
      return false;
    }
  } catch {
    return true;
  }

  return true;
}

/**
 * @param {import("@opencode/plugin").Plugin.Context} ctx
 * @param {string | undefined} implementationAgent
 * @param {string | undefined} sessionID
 */
async function handoffToImplementationAgent(ctx, implementationAgent, sessionID) {
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
    await ctx.session.switchAgent({ sessionID, agent: implementationAgent });
    return { agent: implementationAgent };
  } catch (error) {
    return {
      agent: implementationAgent,
      warning: `Could not auto-switch to \`${implementationAgent}\`: ${getErrorMessage(error)}`,
    };
  }
}

/** @param {unknown} system */
function getSystemText(system) {
  if (!Array.isArray(system)) {
    return "";
  }
  return system
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("\n")
    .toLowerCase();
}

/**
 * @param {import("@opencode/plugin").Plugin.Context} ctx
 * @param {string | undefined} implementationAgent
 * @param {{ plan: string, summary?: string }} args
 * @param {{ sessionID?: string } | undefined} toolContext
 * @returns {Promise<string>}
 */
export async function executeAnnotatePlan(ctx, implementationAgent, args, toolContext) {
  const result = await runPlanReview({
    plan: args.plan,
    sessionId: toolContext?.sessionID,
    cwd: ctx.location.directory,
  });

  const feedback = result.approved ? "" : (result.feedback ?? "Plan changes requested.");

  if (result.approved) {
    const lines = ["Plan review status: plan_status=approved.", "State transition: next_state=EXECUTION."];

    if (args.summary) {
      lines.push(`Summary: ${args.summary}`);
    }

    const handoffResult = await handoffToImplementationAgent(ctx, implementationAgent, toolContext?.sessionID);
    if (handoffResult) {
      if (handoffResult.warning) {
        lines.push(`Auto-switch warning: ${handoffResult.warning}`);
      } else {
        lines.push(`Auto-switched to the \`${handoffResult.agent}\` agent for implementation.`);
      }
    }
    lines.push("Replan intent: explicit_replan=false unless the user explicitly asks to revise the plan.");
    lines.push("Execute the approved plan directly now — write code, create files, and make changes.");
    lines.push("Do not call `annotate_plan` again unless the user explicitly requests re-planning.");

    return lines.join("\n\n");
  }

  return [
    "Plan review status: plan_status=rejected.",
    "State transition: next_state=PLAN_DRAFT.",
    "",
    "## User feedback",
    "",
    feedback,
    "",
    "Revise the plan using this feedback, then submit the revised draft once via `annotate_plan`.",
  ].join("\n");
}

export { PLAN_REVIEW_INSTRUCTIONS };

/** @type {import("@opencode/plugin").Plugin.Plugin} */
export const OpenPlanAnnotatorPluginV2 = {
  id: "open-plan-annotator",
  async setup(ctx) {
    const implementationHandoff = await resolveImplementationHandoff(ctx.location.directory);
    const implementationAgent = implementationHandoff.enabled ? implementationHandoff.agent : undefined;

    await ctx.tool.transform((editor) => {
      editor.add({
        name: "annotate_plan",
        description:
          "Submit a markdown plan for interactive user review. Returns plain-text execution or revision instructions for the agent.",
        input: {
          type: "object",
          properties: {
            plan: {
              type: "string",
              description: "The complete implementation plan in markdown format",
            },
            summary: {
              type: "string",
              description: "Optional one-line plan summary",
            },
          },
          required: ["plan"],
          additionalProperties: false,
        },
        async execute(input, toolContext) {
          const text = await executeAnnotatePlan(ctx, implementationAgent, input, toolContext);
          return { content: text };
        },
      });
    });

    await ctx.session.hook("context", async (event) => {
      if (getSystemText(event.system).includes("annotate_plan")) {
        return;
      }
      const shouldInject = await shouldInjectPlanReviewInstructions(ctx, implementationAgent, event);
      if (shouldInject) {
        event.system.push({ type: "text", text: PLAN_REVIEW_INSTRUCTIONS });
      }
    });

    return () => {};
  },
};

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
        return message.info.agent;
      }
    }

    return undefined;
  }

  async function shouldInjectInstructions(sessionID) {
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
      const agent = response?.data?.find((candidate) => candidate.name === currentAgent);
      return agent?.mode !== "subagent";
    } catch {
      return true;
    }
  }

  async function handoff(sessionID) {
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

      if (!currentSystem.includes("annotate_plan") && (await shouldInjectInstructions(input?.sessionID))) {
        output.system.push(PLAN_REVIEW_INSTRUCTIONS);
      }
    },
    tool: {
      annotate_plan: tool({
        description:
          "Submit a markdown plan for interactive user review. Returns plain-text execution or revision instructions for the agent.",
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
          const feedback = result.approved ? "" : (result.feedback ?? "Plan changes requested.");

          if (!result.approved) {
            return [
              "Plan review status: plan_status=rejected.",
              "State transition: next_state=PLAN_DRAFT.",
              "",
              "## User feedback",
              "",
              feedback,
              "",
              "Revise the plan using this feedback, then submit the revised draft once via `annotate_plan`.",
            ].join("\n");
          }

          const lines = ["Plan review status: plan_status=approved.", "State transition: next_state=EXECUTION."];
          if (args.summary) {
            lines.push(`Summary: ${args.summary}`);
          }

          const handoffResult = await handoff(context.sessionID);
          if (handoffResult) {
            lines.push(
              handoffResult.warning
                ? `Auto-switch warning: ${handoffResult.warning}`
                : `Auto-switched to the \`${handoffResult.agent}\` agent for implementation.`,
            );
          }
          lines.push(
            "Replan intent: explicit_replan=false unless the user explicitly asks to revise the plan.",
            "Execute the approved plan directly now — write code, create files, and make changes.",
            "Do not call `annotate_plan` again unless the user explicitly requests re-planning.",
          );
          return lines.join("\n\n");
        },
      }),
    },
  };
};

export default {
  ...OpenPlanAnnotatorPluginV2,
  server: OpenPlanAnnotatorPlugin,
};
