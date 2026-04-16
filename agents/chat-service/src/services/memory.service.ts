import { config } from "../config.js";
import { countTokens } from "../utils/token.js";
import { complete } from "./llm.service.js";
import { logger } from "../utils/logger.js";
import type { Message } from "../db/schema.js";
import type { ChatMessage } from "./llm.service.js";

export interface BuildContextOptions {
  contextWindow?: number; // 模型最大 token 数，默认从 config 读取
  threshold?: number; // 压缩触发比例，默认从 config 读取
  keepRecent?: number; // 保留最近 N 条，默认从 config 读取
}

/**
 * 将数据库 Message 转换为 OpenAI ChatCompletionMessageParam
 */
function toOpenAIMessage(msg: Message): ChatMessage {
  return {
    role: msg.role as "user" | "assistant" | "system",
    content: msg.content,
  };
}

/**
 * 构建 LLM 摘要 prompt
 */
function buildSummaryPrompt(oldMessages: Message[]): string {
  const conversation = oldMessages
    .map((m) => `${m.role === "user" ? "用户" : "助手"}：${m.content}`)
    .join("\n");

  return `请对以下对话历史进行简洁的摘要，保留关键信息和上下文，以便后续对话能够理解背景：\n\n${conversation}\n\n请用中文输出摘要：`;
}

/**
 * 构建 LLM 上下文，自动处理记忆压缩
 *
 * 算法：
 * 1. 计算所有消息的 token 总量
 * 2. 若未超阈值，直接返回完整历史
 * 3. 若超阈值，保留最近 keepRecent 条，对更早的消息调用 LLM 生成摘要
 * 4. 若 LLM 摘要失败，降级为截断策略（仅保留最近 keepRecent 条）
 *
 * 注意：此函数不修改数据库，仅在传递给 LLM 时使用压缩版本（需求 3.4）
 */
export async function buildContext(
  messages: Message[],
  opts: BuildContextOptions = {}
): Promise<ChatMessage[]> {
  const contextWindow = opts.contextWindow ?? config.LLM_CONTEXT_WINDOW;
  const threshold = opts.threshold ?? config.COMPRESSION_THRESHOLD;
  const keepRecent = opts.keepRecent ?? config.COMPRESSION_KEEP_RECENT;

  const maxTokens = Math.floor(contextWindow * threshold);

  // 1. 计算当前 token 总量
  const totalTokens = countTokens(messages);

  logger.debug("[Memory] token 统计", {
    totalTokens,
    maxTokens,
    messageCount: messages.length,
  });

  // 2. 未超阈值，直接返回完整历史
  if (totalTokens <= maxTokens) {
    return messages.map(toOpenAIMessage);
  }

  logger.info("[Memory] token 超过阈值，触发压缩", {
    totalTokens,
    maxTokens,
    messageCount: messages.length,
  });

  // 3. 分割：保留最近 keepRecent 条，其余待压缩
  const recentMessages = messages.slice(-keepRecent);
  const oldMessages = messages.slice(0, -keepRecent);

  if (oldMessages.length === 0) {
    return recentMessages.map(toOpenAIMessage);
  }

  // 4. 尝试 LLM 摘要压缩
  try {
    const summaryPrompt = buildSummaryPrompt(oldMessages);
    const summary = await complete(summaryPrompt);

    const summaryMessage: ChatMessage = {
      role: "system",
      content: `【历史对话摘要】\n${summary}`,
    };

    logger.info("[Memory] 压缩成功，摘要长度", { summaryLength: summary.length });

    return [summaryMessage, ...recentMessages.map(toOpenAIMessage)];
  } catch (err) {
    // 5. 降级：截断策略
    logger.error("[Memory] LLM 摘要失败，降级为截断策略", err);
    return recentMessages.map(toOpenAIMessage);
  }
}
