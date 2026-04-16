import OpenAI from "openai";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type { TokenUsage } from "@study-ai/chat-shared";

// 初始化 OpenAI 客户端（支持任意 OpenAI-compatible 端点）
const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
  baseURL: config.OPENAI_BASE_URL,
});

export type ChatMessage = OpenAI.ChatCompletionMessageParam;

export interface StreamChunk {
  delta: string;
  usage: TokenUsage | null;
  done: boolean;
}

/**
 * 流式调用 LLM，返回异步迭代器
 * 每次 yield 一个 delta 字符串，最后 yield usage 统计
 */
export async function* streamChat(
  messages: ChatMessage[]
): AsyncGenerator<StreamChunk> {
  logger.debug("[LLM] 开始流式调用", {
    model: config.LLM_MODEL,
    messageCount: messages.length,
  });

  const stream = await openai.chat.completions.create({
    model: config.LLM_MODEL,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  });

  let usage: TokenUsage | null = null;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";

    // 最后一个 chunk 包含 usage 统计
    if (chunk.usage) {
      usage = {
        prompt_tokens: chunk.usage.prompt_tokens,
        completion_tokens: chunk.usage.completion_tokens,
        total_tokens: chunk.usage.total_tokens,
      };
    }

    if (delta) {
      yield { delta, usage: null, done: false };
    }
  }

  yield { delta: "", usage, done: true };
}

/**
 * 非流式调用 LLM（用于记忆压缩摘要）
 */
export async function complete(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: config.LLM_MODEL,
    messages: [{ role: "user", content: prompt }],
    stream: false,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM 返回空内容");
  }
  return content;
}
