/**
 * Anthropic Provider
 * 支持 Claude 系列模型（claude-opus-4-5、claude-3-5-haiku 等）
 * 使用官方 @anthropic-ai/sdk
 */
import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMCallOptions, LLMResponse, LLMMessage, LLMContentBlock } from "../types.js";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  readonly model: string;
  private client: Anthropic;

  constructor(model = "claude-opus-4-5") {
    this.model = model;
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async call({ system, messages, tools = [], maxTokens = 4096 }: LLMCallOptions): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      // 将工具定义转换为 Anthropic 格式
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      })),
      messages: messages.map(toAnthropicMessage),
    });

    // 提取文本内容
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("");

    // 提取工具调用
    const toolCalls = response.content
      .filter((b) => b.type === "tool_use")
      .map((b) => {
        const tb = b as Anthropic.ToolUseBlock;
        return { id: tb.id, name: tb.name, input: tb.input as Record<string, unknown> };
      });

    return { text, toolCalls, stopReason: response.stop_reason ?? "end_turn" };
  }
}

/**
 * 将统一消息格式转换为 Anthropic API 格式
 */
function toAnthropicMessage(msg: LLMMessage): Anthropic.MessageParam {
  // 纯文本消息
  if (typeof msg.content === "string") {
    return { role: msg.role, content: msg.content };
  }

  // 将内容块逐一映射为 Anthropic 格式
  const content = (msg.content as LLMContentBlock[]).map((b): Anthropic.ContentBlockParam => {
    if (b.type === "text") return { type: "text", text: b.text };
    if (b.type === "tool_use") return { type: "tool_use", id: b.id, name: b.name, input: b.input };
    // tool_result：工具执行结果回传
    return { type: "tool_result", tool_use_id: b.tool_use_id, content: b.content };
  });
  return { role: msg.role, content };
}
