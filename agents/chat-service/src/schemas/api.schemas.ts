import { z } from "zod";

// ── 流式对话 ──────────────────────────────────────────────────────────────────

export const ChatStreamRequestSchema = z.object({
  session_id: z.string().uuid("session_id 必须是有效的 UUID"),
  content: z
    .string()
    .min(1, "消息内容不能为空")
    .max(10000, "消息内容不能超过 10000 字符"),
});
export type ChatStreamRequest = z.infer<typeof ChatStreamRequestSchema>;

// ── Session CRUD ──────────────────────────────────────────────────────────────

export const CreateSessionRequestSchema = z.object({
  title: z.string().max(100).optional(),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

// ── 响应体 ────────────────────────────────────────────────────────────────────

export const SessionResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  created_at: z.number(), // Unix timestamp（秒）
  updated_at: z.number(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export const MessageResponseSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  prompt_tokens: z.number().nullable(),
  completion_tokens: z.number().nullable(),
  total_tokens: z.number().nullable(),
  created_at: z.number(),
});
export type MessageResponse = z.infer<typeof MessageResponseSchema>;

// ── 错误响应 ──────────────────────────────────────────────────────────────────

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
