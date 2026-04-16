import type { Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { sessions, messages } from "../db/schema.js";
import { CreateSessionRequestSchema } from "../schemas/api.schemas.js";
import { getSessionMessages } from "../services/message.service.js";
import { logger } from "../utils/logger.js";

/**
 * POST /api/sessions
 * 创建新 Session
 */
export async function createSession(req: Request, res: Response): Promise<void> {
  const parsed = CreateSessionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
    });
    return;
  }

  try {
    const id = uuidv4();
    const title = parsed.data.title ?? "新对话";
    const now = new Date();

    const [session] = await db
      .insert(sessions)
      .values({ id, title, created_at: now, updated_at: now })
      .returning();

    if (!session) {
      throw new Error("创建 Session 失败");
    }

    res.status(201).json({
      id: session.id,
      title: session.title,
      created_at: Math.floor(session.created_at.getTime() / 1000),
      updated_at: Math.floor(session.updated_at.getTime() / 1000),
    });
  } catch (err) {
    logger.error("[SessionController] 创建 Session 失败", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "创建 Session 失败" },
    });
  }
}

/**
 * GET /api/sessions
 * 获取所有 Session 列表（按创建时间倒序）
 */
export async function listSessions(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(sessions)
      .orderBy(desc(sessions.created_at));

    res.json(
      rows.map((s) => ({
        id: s.id,
        title: s.title,
        created_at: Math.floor(s.created_at.getTime() / 1000),
        updated_at: Math.floor(s.updated_at.getTime() / 1000),
      }))
    );
  } catch (err) {
    logger.error("[SessionController] 获取 Session 列表失败", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "获取 Session 列表失败" },
    });
  }
}

/**
 * GET /api/sessions/:id
 * 获取单个 Session
 */
export async function getSession(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };

  try {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id));

    if (!session) {
      res.status(404).json({
        error: { code: "SESSION_NOT_FOUND", message: `Session ${id} 不存在` },
      });
      return;
    }

    res.json({
      id: session.id,
      title: session.title,
      created_at: Math.floor(session.created_at.getTime() / 1000),
      updated_at: Math.floor(session.updated_at.getTime() / 1000),
    });
  } catch (err) {
    logger.error("[SessionController] 获取 Session 失败", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "获取 Session 失败" },
    });
  }
}

/**
 * DELETE /api/sessions/:id
 * 删除 Session 及其所有消息（CASCADE）
 */
export async function deleteSession(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };

  try {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id));

    if (!session) {
      res.status(404).json({
        error: { code: "SESSION_NOT_FOUND", message: `Session ${id} 不存在` },
      });
      return;
    }

    await db.delete(sessions).where(eq(sessions.id, id));

    res.json({ ok: true });
  } catch (err) {
    logger.error("[SessionController] 删除 Session 失败", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "删除 Session 失败" },
    });
  }
}

/**
 * GET /api/sessions/:id/messages
 * 获取 Session 的完整消息历史（按时间升序）
 */
export async function getSessionMessagesHandler(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params as { id: string };

  try {
    // 先验证 session 存在
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id));

    if (!session) {
      res.status(404).json({
        error: { code: "SESSION_NOT_FOUND", message: `Session ${id} 不存在` },
      });
      return;
    }

    const msgs = await getSessionMessages(id);

    res.json(
      msgs.map((m) => ({
        id: m.id,
        session_id: m.session_id,
        role: m.role,
        content: m.content,
        prompt_tokens: m.prompt_tokens,
        completion_tokens: m.completion_tokens,
        total_tokens: m.total_tokens,
        created_at: Math.floor(m.created_at.getTime() / 1000),
      }))
    );
  } catch (err) {
    logger.error("[SessionController] 获取消息历史失败", err);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "获取消息历史失败" },
    });
  }
}
