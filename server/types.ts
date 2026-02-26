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

export interface UserPreferences {
  autoCloseOnSubmit: boolean;
}

export interface HookOutput {
  hookSpecificOutput: {
    hookEventName: "PermissionRequest";
    decision: { behavior: "allow" } | { behavior: "deny"; message: string };
  };
}

export interface HistoryKeySource {
  transcript_path?: unknown;
  session_id?: unknown;
  opencode_conversation_id?: unknown;
  opencode_session_id?: unknown;
  cwd?: unknown;
  hook_event_name?: unknown;
  tool_name?: unknown;
}

export interface ServerDecision {
  approved: boolean;
  feedback?: string;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  selfUpdatePossible: boolean;
  assetUrl: string | null;
  assetSha256: string | null;
  updateCommand: string;
}

export interface ServerState {
  planContent: string;
  planVersion: number;
  planHistory: string[];
  preferences: UserPreferences;
  htmlContent: string;
  resolveDecision: ((decision: ServerDecision) => void) | null;
  persistPreferences: (preferences: UserPreferences) => Promise<void>;
  updateInfo: UpdateInfo | null;
}
