import type { Response } from "express";
import type { SSEEvent } from "@study-ai/chat-shared";

/**
 * 初始化 SSE 响应头，设置正确的 Content-Type 和缓存控制
 */
export function initSSE(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // 禁用 Nginx 缓冲
  res.flushHeaders();
}

/**
 * 向 SSE 流写入一个事件
 */
export function sendSSEEvent(res: Response, event: SSEEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
