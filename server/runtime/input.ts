import { dirname, resolve } from "node:path";
import type { HookEvent } from "../types.ts";
import { DEV_PLAN } from "./devPlan.ts";

interface RuntimeInput {
  hookEvent: HookEvent;
  planContent: string;
  mode: "hook" | "review";
  planPath?: string;
}

interface HookRuntimeInput extends RuntimeInput {
  mode: "hook";
}

interface ReviewRuntimeInput extends RuntimeInput {
  mode: "review";
  planPath: string;
  reviewOptions: ReviewCliOptions;
}

interface ReviewCliOptions {
  filePath: string;
  noOpen: boolean;
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

export async function parseRuntimeInput(isDev: boolean): Promise<HookRuntimeInput> {
  if (isDev) {
    return {
      hookEvent: buildDevHookEvent(),
      planContent: DEV_PLAN,
      mode: "hook",
    };
  }

  const stdinText = await Bun.stdin.text();
  if (!stdinText.trim()) {
    throw new Error("missing stdin hook event JSON");
  }

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

  return { hookEvent, planContent, mode: "hook" };
}

export async function parseReviewRuntimeInput(args: string[]): Promise<ReviewRuntimeInput> {
  const reviewOptions = parseReviewCliOptions(args);
  const planPath = resolve(reviewOptions.filePath);
  reviewOptions.filePath = planPath;
  const file = Bun.file(reviewOptions.filePath);

  if (!(await file.exists())) {
    throw new Error(`plan file not found: ${reviewOptions.filePath}`);
  }

  if (!reviewOptions.filePath.toLowerCase().endsWith(".md")) {
    throw new Error(`review input must be a Markdown file: ${reviewOptions.filePath}`);
  }

  const planContent = await file.text();
  if (!planContent.trim()) {
    throw new Error(`plan file is empty: ${reviewOptions.filePath}`);
  }

  const hookEvent: HookEvent = {
    session_id: `cli-review-${reviewOptions.filePath}`,
    transcript_path: reviewOptions.filePath,
    cwd: dirname(reviewOptions.filePath),
    permission_mode: "default",
    hook_event_name: "PermissionRequest",
    tool_name: "ReviewPlan",
    tool_use_id: "cli-review",
    tool_input: { plan: planContent },
  };

  return { hookEvent, planContent, mode: "review", planPath: reviewOptions.filePath, reviewOptions };
}

function parseReviewCliOptions(args: string[]): ReviewCliOptions {
  const positionals: string[] = [];
  let noOpen = false;

  for (const arg of args) {
    if (arg === "--no-open") {
      noOpen = true;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`unknown review flag: ${arg}`);
    }

    positionals.push(arg);
  }

  if (positionals.length !== 1) {
    throw new Error("usage: open-plan-annotator review <plan.md> [--no-open]");
  }

  return { filePath: positionals[0], noOpen };
}
