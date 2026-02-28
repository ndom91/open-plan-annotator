import { resolveHistoryKey } from "../historyKey.ts";
import type { HookEvent } from "../types.ts";

interface PlanHistoryState {
  historyDir: string;
  planHistory: string[];
  planVersion: number;
}

export async function loadPlanHistory(
  isDev: boolean,
  historyRootDir: string,
  hookEvent: HookEvent,
  planContent: string,
): Promise<PlanHistoryState> {
  const historySessionKey = resolveHistoryKey(hookEvent);
  const historyDir = `${historyRootDir}/${historySessionKey}`;

  if (isDev) {
    return {
      historyDir,
      planHistory: [
        "# Example Plan\n\n## Context\n\nThis is the previous version of the plan.\n\n## Steps\n\n### Step 1: Set up SQLite\n\nUse SQLite instead of PostgreSQL.\n\n### Step 2: Build the API\n\nCreate basic CRUD endpoints.\n\n## Verification\n\nManual testing only.",
      ],
      planVersion: 2,
    };
  }

  const planHistory: string[] = [];
  let planVersion = 1;

  try {
    const files = await Array.fromAsync(new Bun.Glob("*.md").scan(historyDir));
    const sorted = await Promise.all(
      files.map(async (fileName) => {
        const path = `${historyDir}/${fileName}`;
        const stat = await Bun.file(path).stat();
        return { path, mtime: stat?.mtime?.getTime() ?? 0 };
      }),
    );

    sorted.sort((a, b) => a.mtime - b.mtime);
    for (const file of sorted) {
      planHistory.push(await Bun.file(file.path).text());
    }
    planVersion = planHistory.length + 1;
  } catch {
    // No history yet
  }

  try {
    await Bun.write(`${historyDir}/v${planVersion}.md`, planContent);
  } catch {
    try {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(historyDir, { recursive: true });
      await Bun.write(`${historyDir}/v${planVersion}.md`, planContent);
    } catch {
      // Non-critical - history is a nice-to-have
    }
  }

  return {
    historyDir,
    planHistory,
    planVersion,
  };
}

export async function cleanupHistory(isDev: boolean, approved: boolean, historyDir: string): Promise<void> {
  if (isDev || !approved) {
    return;
  }

  try {
    const { rmSync } = await import("node:fs");
    rmSync(historyDir, { recursive: true, force: true });
  } catch {
    // Non-critical cleanup
  }
}
