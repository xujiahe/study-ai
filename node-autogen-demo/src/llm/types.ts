/**
 * LLM 统一抽象层 — 与具体提供商无关的接口定义
 *
 * 所有 LLM Provider（Anthropic、OpenAI、智谱、Ollama）都实现 LLMProvider 接口，
 * Agent 只依赖这个接口，不直接引用任何 SDK
 */

/** 工具定义（对应 LLM function calling 的 schema） */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>; // 参数字段定义
    required?: string[];                  // 必填参数列表
  };
}

/** LLM 决定调用某个工具时返回的调用信息 */
export interface ToolCall {
  id: string;                          // 工具调用 ID（用于 tool_result 配对）
  name: string;                        // 工具名称
  input: Record<string, unknown>;      // 工具入参
}

/** LLM 单次调用的返回结果 */
export interface LLMResponse {
  text: string;                        // 文本内容（可能为空，当 stopReason 为 tool_use 时）
  toolCalls: ToolCall[];               // 本轮需要执行的工具调用列表
  stopReason: "end_turn" | "tool_use" | "stop" | string; // 停止原因
}

/** 对话消息结构 */
export interface LLMMessage {
  role: "user" | "assistant";
  content: string | LLMContentBlock[]; // 简单文本 或 多块内容（含工具调用/结果）
}

/**
 * 消息内容块类型
 * - text：普通文本
 * - tool_use：LLM 发起的工具调用
 * - tool_result：工具执行结果（回传给 LLM）
 */
export type LLMContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

/** 调用 LLM 时传入的参数 */
export interface LLMCallOptions {
  system: string;              // System prompt
  messages: LLMMessage[];      // 对话历史
  tools?: ToolDefinition[];    // 可用工具列表（为空则不启用 function calling）
  maxTokens?: number;          // 最大输出 token 数
}

/** 所有 LLM Provider 必须实现的接口 */
export interface LLMProvider {
  readonly name: string;   // 提供商名称，如 "zhipu"、"openai"
  readonly model: string;  // 模型名称，如 "glm-5"、"gpt-4o"
  call(options: LLMCallOptions): Promise<LLMResponse>;
}
