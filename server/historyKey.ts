import { createHash } from "node:crypto";
import type { HookEvent } from "./types.ts";

function normalizeKeyMaterial(value: string): string {
  return value.normalize("NFKC").replace(/\r\n?/g, "\n").trim();
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeKeyMaterial(value);
  return normalized.length > 0 ? normalized : null;
}

function hashKeyMaterial(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function resolveHistoryKey(hookEvent: Partial<HookEvent> | null): string {
  const transcriptPath = readString(hookEvent?.transcript_path);
  if (transcriptPath) {
    return `history_${hashKeyMaterial(`transcript_path:${transcriptPath}`)}`;
  }

  const sessionId = readString(hookEvent?.session_id);
  if (sessionId) {
    return `history_${hashKeyMaterial(`session_id:${sessionId}`)}`;
  }

  const cwd = readString(hookEvent?.cwd) ?? "";
  const hookEventName = readString(hookEvent?.hook_event_name) ?? "";
  const toolName = readString(hookEvent?.tool_name) ?? "";

  return `history_${hashKeyMaterial(`composite:${cwd}|${hookEventName}|${toolName}`)}`;
}
