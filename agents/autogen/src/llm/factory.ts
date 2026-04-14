/**
 * LLM 工厂函数
 *
 * 根据环境变量或显式配置，创建对应的 LLMProvider 实例
 *
 * 环境变量：
 *   LLM_PROVIDER=anthropic|openai|ollama|zhipu  （默认 anthropic）
 *   LLM_MODEL=<模型名>                           （可选，留空使用各 provider 默认值）
 *   OLLAMA_BASE_URL=http://...                   （Ollama 专用，默认 http://localhost:11434/v1）
 *   ZHIPU_THINKING=true                          （智谱深度思考模式开关）
 */
import { AnthropicProvider } from "./providers/anthropic.js";
import { OpenAIProvider } from "./providers/openai.js";
import { OllamaProvider } from "./providers/ollama.js";
import { ZhipuProvider } from "./providers/zhipu.js";
import type { LLMProvider } from "./types.js";

/** 支持的提供商名称 */
export type ProviderName = "anthropic" | "openai" | "ollama" | "zhipu";

/** createLLM 的配置选项 */
export interface LLMFactoryOptions {
  provider?: ProviderName;
  model?: string;
  ollamaBaseURL?: string;
  /** 智谱深度思考模式（glm-5 / glm-5.1 支持），开启后模型输出 reasoning_content */
  thinking?: boolean;
}

/** 各 Provider 的默认模型 */
const DEFAULT_MODELS: Record<ProviderName, string> = {
  anthropic: "claude-opus-4-5",
  openai: "gpt-4o",
  ollama: "llama3.2",
  zhipu: "glm-5",
};

/**
 * 创建 LLM Provider 实例
 * 优先使用 options 中的配置，其次读取环境变量，最后使用默认值
 */
export function createLLM(options: LLMFactoryOptions = {}): LLMProvider {
  const provider = (options.provider ?? process.env.LLM_PROVIDER ?? "anthropic") as ProviderName;
  const model = options.model ?? process.env.LLM_MODEL ?? DEFAULT_MODELS[provider];

  switch (provider) {
    case "anthropic":
      return new AnthropicProvider(model);

    case "openai":
      return new OpenAIProvider(model);

    case "ollama":
      // Ollama 使用 OpenAI 兼容接口，需要指定本地 baseURL
      return new OllamaProvider(model, options.ollamaBaseURL ?? process.env.OLLAMA_BASE_URL);

    case "zhipu":
      // 智谱 AI，支持深度思考模式
      return new ZhipuProvider(model, options.thinking ?? process.env.ZHIPU_THINKING === "true");

    default:
      throw new Error(`未知的 LLM Provider: "${provider}"，可选值: anthropic, openai, ollama, zhipu`);
  }
}

/**
 * 便捷方法：通过 "provider/model" 格式字符串创建 Provider
 * 例如："zhipu/glm-5"、"openai/gpt-4o-mini"
 */
export function createLLMFromString(spec: string): LLMProvider {
  const [provider, ...rest] = spec.split("/");
  return createLLM({ provider: provider as ProviderName, model: rest.join("/") || undefined });
}
