import { describe, expect, test } from "bun:test";
import { resolveHistoryKey } from "./historyKey.ts";

describe("resolveHistoryKey", () => {
  test("continues history for same transcript_path across sessions", () => {
    const keyA = resolveHistoryKey({ transcript_path: "/tmp/plan.jsonl", session_id: "session-a" });
    const keyB = resolveHistoryKey({ transcript_path: "/tmp/plan.jsonl", session_id: "session-b" });

    expect(keyA).toBe(keyB);
  });

  test("isolates history for different transcript_path values", () => {
    const keyA = resolveHistoryKey({ transcript_path: "/tmp/plan-a.jsonl", session_id: "session-a" });
    const keyB = resolveHistoryKey({ transcript_path: "/tmp/plan-b.jsonl", session_id: "session-a" });

    expect(keyA).not.toBe(keyB);
  });

  test("falls back to session_id when transcript_path is missing", () => {
    const keyA = resolveHistoryKey({ session_id: "session-a" });
    const keyB = resolveHistoryKey({ session_id: "session-a" });
    const keyC = resolveHistoryKey({ session_id: "session-b" });

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
  });

  test("uses composite fallback when transcript_path and session_id are missing", () => {
    const keyA = resolveHistoryKey({ cwd: "/repo", hook_event_name: "PermissionRequest", tool_name: "Write" });
    const keyB = resolveHistoryKey({ cwd: "/repo", hook_event_name: "PermissionRequest", tool_name: "Write" });
    const keyC = resolveHistoryKey({ cwd: "/repo", hook_event_name: "PermissionRequest", tool_name: "Read" });

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
  });

  test("normalizes transcript_path key material (unicode, line endings, whitespace)", () => {
    const keyA = resolveHistoryKey({ transcript_path: "  /tmp/plan-A\r\n" });
    const keyB = resolveHistoryKey({ transcript_path: "/tmp/plan-A\n" });
    const keyC = resolveHistoryKey({ transcript_path: "\u212B" });
    const keyD = resolveHistoryKey({ transcript_path: "\u00C5" });

    expect(keyA).toBe(keyB);
    expect(keyC).toBe(keyD);
  });

  test("ignores blank transcript_path and falls back to session_id", () => {
    const keyA = resolveHistoryKey({ transcript_path: "   \n\r", session_id: "session-a" });
    const keyB = resolveHistoryKey({ session_id: "session-a" });

    expect(keyA).toBe(keyB);
  });

  test("ignores blank session_id and falls back to composite key", () => {
    const keyA = resolveHistoryKey({
      session_id: "\n\r\t",
      cwd: "/repo",
      hook_event_name: "PermissionRequest",
      tool_name: "Edit",
    });
    const keyB = resolveHistoryKey({
      cwd: "/repo",
      hook_event_name: "PermissionRequest",
      tool_name: "Edit",
    });

    expect(keyA).toBe(keyB);
  });

  test("prioritizes transcript_path over session_id and composite fallback", () => {
    const fromTranscript = resolveHistoryKey({
      transcript_path: "/tmp/t1.jsonl",
      session_id: "session-a",
      cwd: "/repo",
      hook_event_name: "PermissionRequest",
      tool_name: "Edit",
    });
    const fromSession = resolveHistoryKey({
      session_id: "session-a",
      cwd: "/repo",
      hook_event_name: "PermissionRequest",
      tool_name: "Edit",
    });

    expect(fromTranscript).not.toBe(fromSession);
  });

  test("returns deterministic hash-shaped key", () => {
    const key = resolveHistoryKey({ transcript_path: "/tmp/plan.jsonl" });

    expect(key).toMatch(/^history_[a-f0-9]{32}$/);
    expect(key).toBe(resolveHistoryKey({ transcript_path: "/tmp/plan.jsonl" }));
  });

  test("handles nullish and non-string values safely", () => {
    const keyA = resolveHistoryKey(null);
    const keyB = resolveHistoryKey({
      transcript_path: 123 as unknown as string,
      session_id: { id: "abc" } as unknown as string,
      cwd: false as unknown as string,
      hook_event_name: undefined as unknown as string,
      tool_name: "",
    });

    expect(keyA).toMatch(/^history_[a-f0-9]{32}$/);
    expect(keyB).toMatch(/^history_[a-f0-9]{32}$/);
  });

  test("uses OpenCode conversation id when available", () => {
    const keyA = resolveHistoryKey({
      opencode_conversation_id: "conv-123",
      opencode_session_id: "sess-a",
      session_id: "claude-session",
    });
    const keyB = resolveHistoryKey({ opencode_conversation_id: "conv-123" });
    const keyC = resolveHistoryKey({ opencode_conversation_id: "conv-456" });

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
  });

  test("falls back to OpenCode session id when conversation id missing", () => {
    const keyA = resolveHistoryKey({ opencode_session_id: "sess-a" });
    const keyB = resolveHistoryKey({ opencode_session_id: "sess-a" });
    const keyC = resolveHistoryKey({ opencode_session_id: "sess-b" });

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
  });
});
