/**
 * LLM 工厂 — 返回 LangChain ChatModel 实例
 * 智谱 AI 使用 ChatOpenAI 指向兼容接口
 */
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export function createChatModel(model?: string): BaseChatModel {
  const modelName = model ?? process.env.LLM_MODEL ?? "glm-5";

  // 智谱 AI — OpenAI 兼容接口
  if (process.env.ZHIPU_API_KEY) {
    return new ChatOpenAI({
      modelName,
      openAIApiKey: process.env.ZHIPU_API_KEY,
      configuration: { baseURL: "https://open.bigmodel.cn/api/paas/v4" },
      temperature: 0.1,
      streaming: true,
      // tiktoken 不认识 glm-* 模型名，用 gpt-4o 作为 token 计数的替代模型
      tiktoken_model_name: "gpt-4o",
    });
  }

  // 标准 OpenAI
  return new ChatOpenAI({
    modelName,
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.1,
    streaming: true,
  });
}
