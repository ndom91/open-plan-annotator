import type { AdapterParseResult, HookEvent, HookOutput, HostAdapter, PlanReviewDecision } from "../types.ts";

async function readLatestClaudePlanFallback(): Promise<string> {
  const plansDir = `${process.env.HOME}/.claude/plans`;
  try {
    const files = await Array.fromAsync(new Bun.Glob("*.md").scan(plansDir));
    if (files.length === 0) return "";

    const sorted = await Promise.all(
      files.map(async (fileName) => {
        const path = `${plansDir}/${fileName}`;
        const stat = await Bun.file(path).stat();
        return { path, mtime: stat?.mtime ?? 0 };
      }),
    );

    sorted.sort((a, b) => (b.mtime as number) - (a.mtime as number));
    return await Bun.file(sorted[0].path).text();
  } catch {
    return "";
  }
}

export const claudeAdapter: HostAdapter = {
  host: "claude",

  async parseRequest({ stdinText, isDev, devPlan }): Promise<AdapterParseResult> {
    if (isDev) {
      return {
        ok: true,
        request: {
          host: "dev",
          planContent: devPlan,
          historyKeySource: {
            session_id: "dev-session",
            hook_event_name: "PermissionRequest",
            tool_name: "ExitPlanMode",
            cwd: process.cwd(),
          },
        },
      };
    }

    let hookEvent: HookEvent;
    try {
      hookEvent = JSON.parse(stdinText) as HookEvent;
    } catch {
      return {
        ok: false,
        exitCode: 1,
        stderr: "open-plan-annotator: failed to parse stdin hook event\n",
      };
    }

    let planContent = (hookEvent.tool_input?.plan as string) ?? "";
    if (!planContent) {
      planContent = await readLatestClaudePlanFallback();
    }

    if (!planContent) {
      return {
        ok: false,
        exitCode: 1,
        stderr: "open-plan-annotator: no plan content found\n",
      };
    }

    return {
      ok: true,
      request: {
        host: "claude",
        planContent,
        historyKeySource: hookEvent,
      },
    };
  },

  formatDecision(decision: PlanReviewDecision): string {
    const output: HookOutput = {
      hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: decision.approved
          ? { behavior: "allow" }
          : { behavior: "deny", message: decision.feedback ?? "Plan changes requested." },
      },
    };

    return JSON.stringify(output);
  },
};
