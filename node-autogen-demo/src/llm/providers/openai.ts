/**
 * OpenAI Provider
 * 支持 GPT-4o、GPT-4o-mini 等模型
 * 也被 OllamaProvider 和 ZhipuProvider 复用（通过 baseURL 参数切换接口地址）
 */
import OpenAI from "openai";
import type { LLMProvider, LLMCallOptions, LLMResponse, LLMMessage } from "../types.js";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  readonly model: string;
  private client: OpenAI;

  /**
   * @param model   模型名称，默认 gpt-4o
   * @param baseURL 自定义接口地址（用于 Ollama、智谱等兼容接口）
   * @param apiKey  显式传入 API Key（优先级高于环境变量）
   */
  constructor(model = "gpt-4o", baseURL?: string, apiKey?: string) {
    this.model = model;
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.OPENAI_API_KEY ?? "sk-placeholder",
      ...(baseURL ? { baseURL } : {}),
    });
  }

  async call({ system, messages, tools = [], maxTokens = 4096 }: LLMCallOptions): Promise<LLMResponse> {
    // system prompt 作为第一条消息
    const oaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      ...messages.map(toOpenAIMessage),
    ];

    // 转换工具定义为 OpenAI function calling 格式
    const oaiTools: OpenAI.ChatCompletionTool[] = tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: oaiMessages,
      ...(oaiTools.length ? { tools: oaiTools, tool_choice: "auto" } : {}),
    });

    const choice = response.choices[0];
    const text = choice.message.content ?? "";

    // 提取工具调用
    const toolCalls = (choice.message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));

    // 统一 stopReason
    const stopReason =
      choice.finish_reason === "tool_calls" ? "tool_use" : choice.finish_reason ?? "end_turn";

    return { text, toolCalls, stopReason };
  }
}

/**
 * 将统一消息格式转换为 OpenAI API 格式
 */
function toOpenAIMessage(msg: LLMMessage): OpenAI.ChatCompletionMessageParam {
  // 纯文本消息
  if (typeof msg.content === "string") {
    return { role: msg.role, content: msg.content };
  }

  const blocks = msg.content as import("../types.js").LLMContentBlock[];

  if (msg.role === "assistant") {
    // 提取文本内容和工具调用
    const text = blocks
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
    const toolCalls = blocks
      .filter((b) => b.type === "tool_use")
      .map((b) => {
        const tb = b as { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
        return {
          id: tb.id,
          type: "function" as const,
          function: { name: tb.name, arguments: JSON.stringify(tb.input) },
        };
      });
    return { role: "assistant", content: text || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) };
  }

  // user 消息中的工具结果块
  const toolResults = blocks.filter((b) => b.type === "tool_result");
  if (toolResults.length) {
    // OpenAI 要求工具结果使用独立的 "tool" role 消息
    const tr = toolResults[0] as { type: "tool_result"; tool_use_id: string; content: string };
    return { role: "tool", tool_call_id: tr.tool_use_id, content: tr.content };
  }

  // 普通 user 文本
  return {
    role: "user",
    content: blocks
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join(""),
  };
}
