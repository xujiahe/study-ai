import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions } from "../db/schema.js";
import { ChatStreamRequestSchema } from "../schemas/api.schemas.js";
import { initSSE, sendSSEEvent } from "../utils/sse.js";
import { streamChat } from "../services/llm.service.js";
import { buildContext } from "../services/memory.service.js";
import {
  saveUserMessage,
  saveAssistantMessage,
  getSessionMessages,
} from "../services/message.service.js";
import { logger } from "../utils/logger.js";
import type { TokenUsage } from "@study-ai/chat-shared";

/**
 * POST /api/chat/stream
 * 流式对话核心逻辑
 */
export async function streamChatHandler(
  req: Request,
  res: Response
): Promise<void> {
  // 1. zod 校验请求体
  const parsed = ChatStreamRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
    });
    return;
  }

  const { session_id, content } = parsed.data;

  // 2. 验证 session 存在
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, session_id));

  if (!session) {
    res.status(404).json({
      error: {
        code: "SESSION_NOT_FOUND",
        message: `Session ${session_id} 不存在`,
      },
    });
    return;
  }

  // 3. 保存用户消息（写入失败不中断流程）
  await saveUserMessage(session_id, content);

  // 4. 获取历史消息并构建上下文
  const history = await getSessionMessages(session_id);
  const contextMessages = await buildContext(history);

  // 5. 初始化 SSE 响应
  initSSE(res);

  const messageId = uuidv4();

  // 6. 发送 chat_start 事件
  sendSSEEvent(res, { type: "chat_start", message_id: messageId });

  let fullContent = "";
  let usage: TokenUsage | null = null;

  try {
    // 7. 流式迭代 LLM 输出
    for await (const chunk of streamChat(contextMessages)) {
      if (chunk.done) {
        usage = chunk.usage;
        break;
      }
      fullContent += chunk.delta;
      // 8. 发送 chat_delta 事件
      sendSSEEvent(res, { type: "chat_delta", delta: chunk.delta });
    }

    // 9. 保存 assistant 消息（写入失败不中断流程）
    await saveAssistantMessage(session_id, messageId, fullContent, usage);

    // 10. 发送 chat_done 事件
    const finalUsage: TokenUsage = usage ?? {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
    sendSSEEvent(res, { type: "chat_done", usage: finalUsage });
  } catch (err) {
    logger.error("[ChatController] LLM 调用失败", err);

    const errorMessage =
      err instanceof Error ? err.message : "LLM 调用失败，请稍后重试";

    // 发送 error SSE 事件
    sendSSEEvent(res, {
      type: "error",
      code: "LLM_ERROR",
      message: errorMessage,
    });
  } finally {
    res.end();
  }
}
