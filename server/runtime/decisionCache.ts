import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HookEvent, ServerDecision } from "../types.ts";

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_DIR = join(tmpdir(), "open-plan-annotator-decisions");

interface CachedDecision {
  approved: boolean;
  feedback?: string;
  createdAt: number;
}

function cachePathForHookEvent(hookEvent: HookEvent): string {
  const key = JSON.stringify({
    sessionId: hookEvent.session_id,
    transcriptPath: hookEvent.transcript_path,
    cwd: hookEvent.cwd,
    toolName: hookEvent.tool_name,
    toolUseId: hookEvent.tool_use_id,
  });
  const digest = createHash("sha256").update(key).digest("hex");
  return join(CACHE_DIR, `${digest}.json`);
}

function parseCachedDecision(value: unknown): CachedDecision | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const cached = value as { approved?: unknown; feedback?: unknown; createdAt?: unknown };
  if (typeof cached.approved !== "boolean" || typeof cached.createdAt !== "number") {
    return null;
  }

  if (cached.feedback !== undefined && typeof cached.feedback !== "string") {
    return null;
  }

  return {
    approved: cached.approved,
    feedback: cached.feedback,
    createdAt: cached.createdAt,
  };
}

async function cleanupExpiredCacheEntries(now = Date.now()): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(CACHE_DIR);
  } catch {
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.endsWith(".json")) {
        return;
      }

      const path = join(CACHE_DIR, entry);
      try {
        const cached = parseCachedDecision(JSON.parse(await readFile(path, "utf8")));
        if (!cached || now - cached.createdAt > CACHE_TTL_MS) {
          await rm(path, { force: true });
        }
      } catch {
        await rm(path, { force: true });
      }
    }),
  );
}

export async function storeDecisionForPermissionRequest(hookEvent: HookEvent, decision: ServerDecision): Promise<void> {
  await cleanupExpiredCacheEntries();
  await mkdir(CACHE_DIR, { recursive: true });
  const cached: CachedDecision = {
    approved: decision.approved,
    feedback: decision.feedback,
    createdAt: Date.now(),
  };
  await writeFile(cachePathForHookEvent(hookEvent), `${JSON.stringify(cached)}\n`, "utf8");
}

export async function consumeDecisionForPermissionRequest(hookEvent: HookEvent): Promise<ServerDecision | null> {
  await cleanupExpiredCacheEntries();
  const path = cachePathForHookEvent(hookEvent);

  try {
    const cached = parseCachedDecision(JSON.parse(await readFile(path, "utf8")));
    await rm(path, { force: true });

    if (!cached || Date.now() - cached.createdAt > CACHE_TTL_MS) {
      return null;
    }

    return { approved: cached.approved, feedback: cached.feedback };
  } catch {
    return null;
  }
}
