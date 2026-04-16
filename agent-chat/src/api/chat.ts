import type { SessionResponse, MessageResponse } from "../types/index.js";

const BASE_URL = "/api";

/**
 * 统一错误处理
 */
async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      errorMessage = body.error?.message ?? errorMessage;
    } catch {
      // 忽略 JSON 解析失败
    }
    throw new Error(errorMessage);
  }
  return res.json() as Promise<T>;
}

/**
 * 创建新 Session
 */
export async function createSession(title?: string): Promise<SessionResponse> {
  const res = await fetch(`${BASE_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return handleResponse<SessionResponse>(res);
}

/**
 * 获取所有 Session 列表（按创建时间倒序）
 */
export async function listSessions(): Promise<SessionResponse[]> {
  const res = await fetch(`${BASE_URL}/sessions`);
  return handleResponse<SessionResponse[]>(res);
}

/**
 * 获取单个 Session
 */
export async function getSession(id: string): Promise<SessionResponse> {
  const res = await fetch(`${BASE_URL}/sessions/${id}`);
  return handleResponse<SessionResponse>(res);
}

/**
 * 删除 Session 及其所有消息
 */
export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/sessions/${id}`, {
    method: "DELETE",
  });
  await handleResponse<{ ok: boolean }>(res);
}

/**
 * 获取 Session 的消息历史（按时间升序）
 */
export async function getSessionMessages(
  sessionId: string
): Promise<MessageResponse[]> {
  const res = await fetch(`${BASE_URL}/sessions/${sessionId}/messages`);
  return handleResponse<MessageResponse[]>(res);
}

/**
 * 发起流式对话请求，返回 Response 对象供 useSSE 消费
 * 组件不直接调用 fetch，统一通过此函数
 */
export async function streamChat(
  sessionId: string,
  content: string,
  signal?: AbortSignal
): Promise<Response> {
  const res = await fetch(`${BASE_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, content }),
    signal,
  });
  return res;
}
