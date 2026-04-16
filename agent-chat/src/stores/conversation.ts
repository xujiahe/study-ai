import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { SessionResponse, MessageResponse } from "../types/index.js";
import type { TokenUsage } from "@study-ai/chat-shared";
import {
  createSession,
  listSessions,
  deleteSession as apiDeleteSession,
  getSessionMessages,
} from "../api/chat.js";
import { useSSE } from "../composables/useSSE.js";

const SESSION_ID_KEY = "chat_current_session_id";

export const useConversationStore = defineStore("conversation", () => {
  // ── 状态 ──────────────────────────────────────────────────────────────────
  const sessions = ref<SessionResponse[]>([]);
  const currentSessionId = ref<string | null>(
    localStorage.getItem(SESSION_ID_KEY)
  );
  const messages = ref<MessageResponse[]>([]);
  const isStreaming = ref(false);
  const streamingMsgId = ref<string | null>(null);
  const error = ref<string | null>(null);

  // 当前流式消息的临时内容（流完成前不写入 messages）
  const streamingContent = ref("");

  // AbortController 用于停止生成
  let abortController: AbortController | null = null;

  // ── Computed ──────────────────────────────────────────────────────────────

  const currentSession = computed(() =>
    sessions.value.find((s) => s.id === currentSessionId.value) ?? null
  );

  /**
   * 当前 Session 的累计 Token 消耗总量（需求 6.2）
   */
  const totalTokens = computed(() =>
    messages.value.reduce((sum, m) => sum + (m.total_tokens ?? 0), 0)
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * 加载所有 Session 列表
   */
  async function loadSessions(): Promise<void> {
    try {
      sessions.value = await listSessions();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  /**
   * 创建新 Session 并自动切换（需求 7.2）
   */
  async function createNewSession(title?: string): Promise<void> {
    try {
      const session = await createSession(title);
      sessions.value.unshift(session);
      await switchSession(session.id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  /**
   * 切换到指定 Session，加载历史消息（需求 2.6、7.3）
   */
  async function switchSession(id: string): Promise<void> {
    currentSessionId.value = id;
    localStorage.setItem(SESSION_ID_KEY, id);
    messages.value = [];
    streamingContent.value = "";
    error.value = null;

    try {
      messages.value = await getSessionMessages(id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  /**
   * 删除 Session（需求 7.4）
   */
  async function deleteSession(id: string): Promise<void> {
    try {
      await apiDeleteSession(id);
      sessions.value = sessions.value.filter((s) => s.id !== id);

      // 如果删除的是当前 Session，切换到第一个或创建新的
      if (currentSessionId.value === id) {
        if (sessions.value.length > 0) {
          await switchSession(sessions.value[0]!.id);
        } else {
          currentSessionId.value = null;
          localStorage.removeItem(SESSION_ID_KEY);
          messages.value = [];
        }
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  /**
   * 发送消息，处理流式响应（需求 1.1、10.4）
   */
  async function sendMessage(content: string): Promise<void> {
    if (!currentSessionId.value) {
      setError("请先选择或创建一个对话");
      return;
    }

    if (isStreaming.value) return;

    // 立即添加用户消息到本地（乐观更新）
    const userMsg: MessageResponse = {
      id: `local-${Date.now()}`,
      session_id: currentSessionId.value,
      role: "user",
      content,
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      created_at: Math.floor(Date.now() / 1000),
    };
    messages.value.push(userMsg);

    isStreaming.value = true;
    streamingContent.value = "";
    streamingMsgId.value = null;
    error.value = null;

    abortController = new AbortController();

    try {
      await useSSE(currentSessionId.value, content, abortController.signal, {
        onStart: (messageId: string) => {
          streamingMsgId.value = messageId;
          // 添加空的 assistant 消息占位
          const assistantMsg: MessageResponse = {
            id: messageId,
            session_id: currentSessionId.value!,
            role: "assistant",
            content: "",
            prompt_tokens: null,
            completion_tokens: null,
            total_tokens: null,
            created_at: Math.floor(Date.now() / 1000),
          };
          messages.value.push(assistantMsg);
        },
        onDelta: (delta: string) => {
          streamingContent.value += delta;
          // 更新最后一条 assistant 消息的内容
          const lastMsg = messages.value[messages.value.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.content = streamingContent.value;
          }
        },
        onDone: (usage: TokenUsage) => {
          // 更新最后一条 assistant 消息的 token 统计
          const lastMsg = messages.value[messages.value.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.prompt_tokens = usage.prompt_tokens;
            lastMsg.completion_tokens = usage.completion_tokens;
            lastMsg.total_tokens = usage.total_tokens;
          }
          streamingContent.value = "";
          streamingMsgId.value = null;

          // 更新 session 标题（如果是第一条消息）
          const session = sessions.value.find(
            (s) => s.id === currentSessionId.value
          );
          if (session && session.title === "新对话" && messages.value.length <= 2) {
            session.title = content.slice(0, 30);
          }
        },
        onError: (code: string, message: string) => {
          console.error("[Store] SSE error event:", code, message);
          // 在最后一条 assistant 消息上追加错误说明（需求 10.2）
          const lastMsg = messages.value[messages.value.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.content =
              (lastMsg.content || "") + `\n\n⚠️ 错误：${message}`;
          }
        },
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // 用户主动停止，保留已接收内容，不显示错误（需求 10.5）
        return;
      }
      setError((err as Error).message);
      // 移除空的 assistant 消息占位
      if (
        streamingMsgId.value &&
        messages.value[messages.value.length - 1]?.id === streamingMsgId.value &&
        !messages.value[messages.value.length - 1]?.content
      ) {
        messages.value.pop();
      }
    } finally {
      abortController = null;
      isStreaming.value = false;
      streamingMsgId.value = null;
    }
  }

  /**
   * 停止流式生成（需求 10.5）
   */
  function stopStreaming(): void {
    abortController?.abort();
  }

  /**
   * 设置错误信息
   */
  function setError(message: string): void {
    error.value = message;
  }

  /**
   * 清除错误信息
   */
  function clearError(): void {
    error.value = null;
  }

  return {
    // 状态
    sessions,
    currentSessionId,
    messages,
    isStreaming,
    streamingMsgId,
    error,
    streamingContent,
    // Computed
    currentSession,
    totalTokens,
    // Actions
    loadSessions,
    createNewSession,
    switchSession,
    deleteSession,
    sendMessage,
    stopStreaming,
    setError,
    clearError,
  };
});
