import { createHash } from "node:crypto";
import type { HistoryKeySource } from "./types.ts";

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

export function resolveHistoryKey(historySource: HistoryKeySource | null): string {
  const transcriptPath = readString(historySource?.transcript_path);
  if (transcriptPath) {
    return `history_${hashKeyMaterial(`transcript_path:${transcriptPath}`)}`;
  }

  const openCodeConversationId = readString(historySource?.opencode_conversation_id);
  if (openCodeConversationId) {
    return `history_${hashKeyMaterial(`opencode_conversation_id:${openCodeConversationId}`)}`;
  }

  const openCodeSessionId = readString(historySource?.opencode_session_id);
  if (openCodeSessionId) {
    return `history_${hashKeyMaterial(`opencode_session_id:${openCodeSessionId}`)}`;
  }

  const sessionId = readString(historySource?.session_id);
  if (sessionId) {
    return `history_${hashKeyMaterial(`session_id:${sessionId}`)}`;
  }

  const cwd = readString(historySource?.cwd) ?? "";
  const hookEventName = readString(historySource?.hook_event_name) ?? "";
  const toolName = readString(historySource?.tool_name) ?? "";

  return `history_${hashKeyMaterial(`composite:${cwd}|${hookEventName}|${toolName}`)}`;
}
