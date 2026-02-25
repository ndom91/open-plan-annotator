export interface HookEvent {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: string;
  hook_event_name: string;
  tool_name: string;
  tool_use_id: string;
  tool_input: Record<string, unknown>;
}

export interface OpenCodeSubmitPlanPayload {
  host?: string;
  command?: string;
  tool?: string;
  plan?: unknown;
  sessionId?: unknown;
  conversationId?: unknown;
  cwd?: unknown;
  metadata?: Record<string, unknown>;
}

export interface Annotation {
  id: string;
  type: "deletion" | "comment" | "insertion" | "replacement";
  text: string;
  comment?: string;
  replacement?: string;
  blockIndex: number;
  startOffset: number;
  endOffset: number;
  createdAt: string;
}

export interface HookOutput {
  hookSpecificOutput: {
    hookEventName: "PermissionRequest";
    decision: { behavior: "allow" } | { behavior: "deny"; message: string };
  };
}

export interface OpenCodeOutput {
  ok: boolean;
  decision: "approve" | "deny";
  feedback?: string;
  message?: string;
}

export interface HistoryKeySource {
  transcript_path?: unknown;
  session_id?: unknown;
  cwd?: unknown;
  hook_event_name?: unknown;
  tool_name?: unknown;
  opencode_conversation_id?: unknown;
  opencode_session_id?: unknown;
}

export interface PlanReviewRequest {
  host: "claude" | "opencode" | "dev";
  planContent: string;
  historyKeySource: HistoryKeySource;
}

export interface PlanReviewDecision {
  approved: boolean;
  feedback?: string;
}

export type AdapterParseResult =
  | {
      ok: true;
      request: PlanReviewRequest;
    }
  | {
      ok: false;
      exitCode: number;
      stdout?: string;
      stderr?: string;
    };

export interface HostAdapter {
  readonly host: "claude" | "opencode";
  parseRequest(args: { stdinText: string; isDev: boolean; devPlan: string }): Promise<AdapterParseResult>;
  formatDecision(decision: PlanReviewDecision): string;
}

export interface ServerState {
  planContent: string;
  planVersion: number;
  planHistory: string[];
  htmlContent: string;
  resolveDecision: ((decision: PlanReviewDecision) => void) | null;
}
