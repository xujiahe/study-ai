/**
 * 智谱 AI（Z.ai）Provider
 * 使用 OpenAI 兼容接口：https://open.bigmodel.cn/api/paas/v4
 *
 * 最新模型（2025）：
 *   glm-5            — 最新旗舰 Agent 模型
 *   glm-5.1          — 旗舰增强版
 *   glm-4.5-flash    — 免费，适合编码/推理/Agent 任务
 *   glm-4.5v         — 多模态视觉推理（图片/视频/文档）
 *   glm-4-plus       — 上一代旗舰对话
 *   glm-4-flash      — 上一代免费
 *   glm-z1-flash     — 深度思考，免费
 *
 * 所需环境变量：ZHIPU_API_KEY
 *
 * 深度思考模式：thinking=true 时，模型额外输出 reasoning_content（思考链），
 * 本实现将其包裹在 <thinking>...</thinking> 标签内附加到回复文本前
 */
import OpenAI from "openai";
import type { LLMProvider, LLMCallOptions, LLMResponse, LLMMessage, LLMContentBlock } from "../types.js";

const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

export class ZhipuProvider implements LLMProvider {
  readonly name = "zhipu";
  readonly model: string;
  private client: OpenAI;
  private thinking: boolean; // 是否开启深度思考模式

  /**
   * @param model    模型名称，默认 glm-5
   * @param thinking 是否开启深度思考模式（glm-5 / glm-5.1 支持）
   */
  constructor(model = "glm-5", thinking = false) {
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) throw new Error("ZHIPU_API_KEY 未设置");
    this.model = model;
    this.thinking = thinking;
    // 使用 OpenAI SDK 指向智谱的兼容接口
    this.client = new OpenAI({ apiKey, baseURL: ZHIPU_BASE_URL });
  }

  async call({ system, messages, tools = [], maxTokens = 4096 }: LLMCallOptions): Promise<LLMResponse> {
    // 构建 OpenAI 格式的消息列表，system prompt 作为第一条 system 消息
    const oaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      ...messages.map(toOpenAIMessage),
    ];

    // 将工具定义转换为 OpenAI function calling 格式
    const oaiTools: OpenAI.ChatCompletionTool[] = tools.map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));

    // 智谱扩展参数：开启深度思考
    const extra = this.thinking ? { thinking: { type: "enabled" } } : {};

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: oaiMessages,
      ...(oaiTools.length ? { tools: oaiTools, tool_choice: "auto" } : {}),
      ...extra,
    } as OpenAI.ChatCompletionCreateParamsNonStreaming);

    const choice = response.choices[0];

    // 提取思考链（智谱专有字段 reasoning_content）
    const reasoning = (choice.message as unknown as Record<string, unknown>).reasoning_content as string | undefined;
    const content = choice.message.content ?? "";
    // 将思考链附加到回复文本前，方便调试
    const text = reasoning ? `<thinking>\n${reasoning}\n</thinking>\n\n${content}` : content;

    // 提取工具调用列表
    const toolCalls = (choice.message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));

    // 统一 stopReason：tool_calls → tool_use
    const stopReason =
      choice.finish_reason === "tool_calls" ? "tool_use" : choice.finish_reason ?? "end_turn";

    return { text, toolCalls, stopReason };
  }
}

/**
 * 将统一消息格式转换为 OpenAI API 格式
 * 处理三种情况：纯文本、assistant 的工具调用块、user 的工具结果块
 */
function toOpenAIMessage(msg: LLMMessage): OpenAI.ChatCompletionMessageParam {
  // 纯文本消息直接返回
  if (typeof msg.content === "string") {
    return { role: msg.role, content: msg.content };
  }

  const blocks = msg.content as LLMContentBlock[];

  if (msg.role === "assistant") {
    // assistant 消息：提取文本 + 工具调用
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

  // user 消息：可能包含工具结果块（tool_result）
  const toolResults = blocks.filter((b) => b.type === "tool_result");
  if (toolResults.length) {
    // OpenAI 要求工具结果使用 "tool" role，每条对应一个 tool_call_id
    const tr = toolResults[0] as { type: "tool_result"; tool_use_id: string; content: string };
    return { role: "tool", tool_call_id: tr.tool_use_id, content: tr.content };
  }

  // 普通 user 文本消息
  return {
    role: "user",
    content: blocks
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join(""),
  };
}
