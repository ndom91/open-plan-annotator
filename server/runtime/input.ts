import type { HookEvent } from "../types.ts";
import { DEV_PLAN } from "./devPlan.ts";

interface RuntimeInput {
  hookEvent: HookEvent;
  planContent: string;
}

function buildDevHookEvent(): HookEvent {
  return {
    session_id: "dev-session",
    transcript_path: "",
    cwd: process.cwd(),
    permission_mode: "default",
    hook_event_name: "PermissionRequest",
    tool_name: "ExitPlanMode",
    tool_use_id: "dev-tool-use",
    tool_input: { plan: DEV_PLAN },
  };
}

async function readLatestPlanFromFilesystem(): Promise<string | null> {
  const plansDir = `${process.env.HOME}/.claude/plans`;
  try {
    const files = await Array.fromAsync(new Bun.Glob("*.md").scan(plansDir));
    if (files.length === 0) {
      return null;
    }

    const sorted = await Promise.all(
      files.map(async (fileName) => {
        const path = `${plansDir}/${fileName}`;
        const stat = await Bun.file(path).stat();
        return { path, mtime: stat?.mtime?.getTime() ?? 0 };
      }),
    );
    sorted.sort((a, b) => b.mtime - a.mtime);
    return Bun.file(sorted[0].path).text();
  } catch {
    return null;
  }
}

export async function parseRuntimeInput(isDev: boolean): Promise<RuntimeInput> {
  if (isDev) {
    return {
      hookEvent: buildDevHookEvent(),
      planContent: DEV_PLAN,
    };
  }

  const stdinText = await Bun.stdin.text();
  let hookEvent: HookEvent;

  try {
    hookEvent = JSON.parse(stdinText) as HookEvent;
  } catch {
    throw new Error("failed to parse stdin hook event");
  }

  let planContent = typeof hookEvent.tool_input?.plan === "string" ? hookEvent.tool_input.plan : "";
  if (!planContent) {
    planContent = (await readLatestPlanFromFilesystem()) ?? "";
  }

  if (!planContent) {
    throw new Error("no plan content found");
  }

  return { hookEvent, planContent };
}
