import { SSEEventSchema } from "@study-ai/chat-shared";
import type { SSEEvent } from "@study-ai/chat-shared";
import type { StreamHandlers } from "../types/index.js";
import { streamChat } from "../api/chat.js";

/**
 * 防御性解析 SSE 行
 * 任何单条事件的解析异常不会导致整个流中断（需求 1.7、1.8、8.3）
 */
function parseSSELine(line: string): SSEEvent | null {
  if (!line.startsWith("data: ")) return null;
  const raw = line.slice(6).trim();
  if (!raw) return null;

  // 层次 1：JSON 解析
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("[useSSE] JSON.parse 失败，跳过:", raw);
    return null;
  }

  // 层次 2：schema 校验（使用 safeParse，失败不抛异常）
  const result = SSEEventSchema.safeParse(parsed);
  if (!result.success) {
    console.warn("[useSSE] schema 校验失败，跳过:", result.error.issues);
    return null;
  }

  return result.data;
}

/**
 * SSE 流式对话 composable
 * 使用原生 fetch + ReadableStream（不用 EventSource），支持 POST 请求
 */
export async function useSSE(
  sessionId: string,
  content: string,
  signal: AbortSignal,
  handlers: StreamHandlers
): Promise<void> {
  let response: Response;

  try {
    response = await streamChat(sessionId, content, signal);
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw err; // 重新抛出，让调用方处理
    }
    throw new Error("网络连接失败，请检查网络后重试");
  }

  // HTTP 错误处理
  if (!response.ok) {
    let errorMessage = `请求失败 (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      errorMessage = body.error?.message ?? errorMessage;
    } catch {
      // 忽略 JSON 解析失败
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error("响应体为空");
  }

  // 读取 SSE 流
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 按行处理 SSE 数据
      const lines = buffer.split("\n");
      // 最后一个可能是不完整的行，保留到下次
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue; // 跳过空行

        const event = parseSSELine(trimmed);
        if (!event) continue; // 解析失败，跳过（不中断流）

        // 层次 3：根据事件类型分发
        switch (event.type) {
          case "chat_start":
            handlers.onStart(event.message_id);
            break;
          case "chat_delta":
            handlers.onDelta(event.delta);
            break;
          case "chat_done":
            handlers.onDone(event.usage);
            break;
          case "error":
            // 层次 4：SSE error 事件，不中断，保留已渲染内容
            handlers.onError(event.code, event.message);
            break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
