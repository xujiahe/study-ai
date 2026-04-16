import { eq, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { sessions, messages } from "../db/schema.js";
import type { Message, Session } from "../db/schema.js";
import type { TokenUsage } from "@study-ai/chat-shared";
import { logger } from "../utils/logger.js";

/**
 * 保存用户消息到数据库
 * 写入失败时记录日志但不抛出异常（需求 4.6）
 */
export async function saveUserMessage(
  sessionId: string,
  content: string
): Promise<Message | null> {
  try {
    const id = uuidv4();
    const now = new Date();
    const [message] = await db
      .insert(messages)
      .values({
        id,
        session_id: sessionId,
        role: "user",
        content,
        created_at: now,
      })
      .returning();

    // 更新 session 的 updated_at
    await db
      .update(sessions)
      .set({ updated_at: now })
      .where(eq(sessions.id, sessionId));

    // 如果是第一条消息，更新 session 标题
    const sessionMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.session_id, sessionId));

    if (sessionMessages.length === 1) {
      const title = content.slice(0, 30);
      await db
        .update(sessions)
        .set({ title })
        .where(eq(sessions.id, sessionId));
    }

    return message ?? null;
  } catch (err) {
    logger.error("[MessageService] 保存用户消息失败", err);
    return null;
  }
}

/**
 * 保存 assistant 消息到数据库（含 token 统计）
 * 写入失败时记录日志但不抛出异常（需求 4.6）
 */
export async function saveAssistantMessage(
  sessionId: string,
  messageId: string,
  content: string,
  usage: TokenUsage | null
): Promise<Message | null> {
  try {
    const now = new Date();
    const [message] = await db
      .insert(messages)
      .values({
        id: messageId,
        session_id: sessionId,
        role: "assistant",
        content,
        prompt_tokens: usage?.prompt_tokens ?? null,
        completion_tokens: usage?.completion_tokens ?? null,
        total_tokens: usage?.total_tokens ?? null,
        created_at: now,
      })
      .returning();

    // 更新 session 的 updated_at
    await db
      .update(sessions)
      .set({ updated_at: now })
      .where(eq(sessions.id, sessionId));

    return message ?? null;
  } catch (err) {
    logger.error("[MessageService] 保存 assistant 消息失败", err);
    return null;
  }
}

/**
 * 获取指定 Session 的完整消息历史（按时间升序）
 */
export async function getSessionMessages(sessionId: string): Promise<Message[]> {
  return db
    .select()
    .from(messages)
    .where(eq(messages.session_id, sessionId))
    .orderBy(asc(messages.created_at));
}

/**
 * 根据 ID 获取 Session
 */
export async function getSessionById(id: string): Promise<Session | null> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id));
  return session ?? null;
}
