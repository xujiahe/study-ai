/**
 * Ollama Provider — 本地大模型
 *
 * Ollama 暴露了 OpenAI 兼容的 REST 接口，因此直接继承 OpenAIProvider，
 * 只需将 baseURL 指向本地服务即可
 *
 * 使用前提：本地已运行 `ollama serve`（默认端口 11434）
 * 常用模型：llama3.2、qwen2.5-coder、deepseek-r1、mistral
 *
 * 所需环境变量：无（本地运行，不需要 API Key）
 * 可选环境变量：OLLAMA_BASE_URL（默认 http://localhost:11434/v1）
 */
import { OpenAIProvider } from "./openai.js";

export class OllamaProvider extends OpenAIProvider {
  override readonly name = "ollama";

  /**
   * @param model   本地模型名称，默认 llama3.2
   * @param baseURL Ollama 服务地址，默认 http://localhost:11434/v1
   */
  constructor(model = "llama3.2", baseURL = "http://localhost:11434/v1") {
    // 传入 "ollama" 作为 apiKey 占位符（Ollama 不校验 key）
    super(model, baseURL, "ollama");
  }
}
