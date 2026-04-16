import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // UUID v4
  title: text("title").notNull().default("新对话"), // 首条用户消息前 30 字
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(), // UUID v4
  session_id: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  prompt_tokens: integer("prompt_tokens"), // 仅 assistant 消息有值
  completion_tokens: integer("completion_tokens"),
  total_tokens: integer("total_tokens"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// 索引
export const sessionCreatedAtIdx = index("idx_sessions_created_at").on(
  sessions.created_at
);

export const messageSessionIdIdx = index("idx_messages_session_id").on(
  messages.session_id
);

export const messageCreatedAtIdx = index("idx_messages_created_at").on(
  messages.created_at
);

// 类型推导
export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type Message = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;
