import { z } from "zod";

// ── 各事件 Schema ─────────────────────────────────────────────────────────────

export const ChatStartEventSchema = z.object({
  type: z.literal("chat_start"),
  message_id: z.string().uuid(),
});

export const ChatDeltaEventSchema = z.object({
  type: z.literal("chat_delta"),
  delta: z.string(),
});

export const TokenUsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
});

export const ChatDoneEventSchema = z.object({
  type: z.literal("chat_done"),
  usage: TokenUsageSchema,
});

export const ErrorEventSchema = z.object({
  type: z.literal("error"),
  code: z.string(),
  message: z.string(),
});

// ── Discriminated Union ───────────────────────────────────────────────────────

export const SSEEventSchema = z.discriminatedUnion("type", [
  ChatStartEventSchema,
  ChatDeltaEventSchema,
  ChatDoneEventSchema,
  ErrorEventSchema,
]);

// TypeScript 类型（编译期安全）
export type ChatStartEvent = z.infer<typeof ChatStartEventSchema>;
export type ChatDeltaEvent = z.infer<typeof ChatDeltaEventSchema>;
export type ChatDoneEvent = z.infer<typeof ChatDoneEventSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type SSEEvent = z.infer<typeof SSEEventSchema>;
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
