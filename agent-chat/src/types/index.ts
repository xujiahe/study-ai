// 从共享包重导出 SSE 相关类型
export {
  SSEEventSchema,
  ChatStartEventSchema,
  ChatDeltaEventSchema,
  ChatDoneEventSchema,
  ErrorEventSchema,
  TokenUsageSchema,
} from "@study-ai/chat-shared";

export type {
  SSEEvent,
  ChatStartEvent,
  ChatDeltaEvent,
  ChatDoneEvent,
  ErrorEvent,
  TokenUsage,
} from "@study-ai/chat-shared";

// ── 前端本地类型定义 ──────────────────────────────────────────────────────────

export interface SessionResponse {
  id: string;
  title: string;
  created_at: number; // Unix timestamp（秒）
  updated_at: number;
}

export interface MessageResponse {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  created_at: number; // Unix timestamp（秒）
}

export interface ApiError {
  code: string;
  message: string;
}

export interface StreamHandlers {
  onStart: (messageId: string) => void;
  onDelta: (delta: string) => void;
  onDone: (usage: import("@study-ai/chat-shared").TokenUsage) => void;
  onError: (code: string, message: string) => void;
}
