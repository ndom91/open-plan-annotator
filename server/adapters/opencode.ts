import type {
  AdapterParseResult,
  HostAdapter,
  OpenCodeOutput,
  OpenCodeSubmitPlanPayload,
  PlanReviewDecision,
} from "../types.ts";

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function denyOutput(message: string): string {
  const output: OpenCodeOutput = {
    ok: false,
    decision: "deny",
    feedback: message,
    message,
  };
  return JSON.stringify(output);
}

export const opencodeAdapter: HostAdapter = {
  host: "opencode",

  async parseRequest({ stdinText, isDev, devPlan }): Promise<AdapterParseResult> {
    if (isDev) {
      return {
        ok: true,
        request: {
          host: "dev",
          planContent: devPlan,
          historyKeySource: {
            opencode_session_id: "dev-session",
            opencode_conversation_id: "dev-conversation",
            cwd: process.cwd(),
          },
        },
      };
    }

    let payload: OpenCodeSubmitPlanPayload;
    try {
      payload = JSON.parse(stdinText) as OpenCodeSubmitPlanPayload;
    } catch {
      return {
        ok: false,
        exitCode: 0,
        stdout: denyOutput(
          "OpenCode submit_plan payload was not valid JSON. Submit again with a JSON object containing a non-empty `plan`.",
        ),
      };
    }

    const command = toStringOrNull(payload.command) ?? toStringOrNull(payload.tool) ?? "submit_plan";
    if (command !== "submit_plan") {
      return {
        ok: false,
        exitCode: 0,
        stdout: denyOutput(`Unsupported OpenCode command \`${command}\`. Expected \`submit_plan\`.`),
      };
    }

    const planContent = toStringOrNull(payload.plan);
    if (!planContent) {
      return {
        ok: false,
        exitCode: 0,
        stdout: denyOutput(
          "No plan content was provided in OpenCode `submit_plan` payload (`plan`). Please include the full plan text and submit again.",
        ),
      };
    }

    const sessionId = toStringOrNull(payload.sessionId) ?? toStringOrNull(payload.metadata?.sessionId);
    const conversationId = toStringOrNull(payload.conversationId) ?? toStringOrNull(payload.metadata?.conversationId);
    const cwd = toStringOrNull(payload.cwd) ?? toStringOrNull(payload.metadata?.cwd) ?? process.cwd();

    return {
      ok: true,
      request: {
        host: "opencode",
        planContent,
        historyKeySource: {
          opencode_conversation_id: conversationId,
          opencode_session_id: sessionId,
          cwd,
          hook_event_name: "submit_plan",
          tool_name: "submit_plan",
        },
      },
    };
  },

  formatDecision(decision: PlanReviewDecision): string {
    const output: OpenCodeOutput = decision.approved
      ? {
          ok: true,
          decision: "approve",
          message: "Plan approved.",
        }
      : {
          ok: false,
          decision: "deny",
          feedback: decision.feedback ?? "Plan changes requested.",
          message: "Plan changes requested.",
        };

    return JSON.stringify(output);
  },
};
