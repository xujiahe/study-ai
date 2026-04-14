/**
 * BaseAgent — 所有 Agent 的抽象基类
 *
 * 职责：
 *   1. 在 A2A 总线上注册/注销自身
 *   2. 订阅发给自己的消息，调用子类实现的 handleMessage()
 *   3. 封装 LLM 调用循环（tool_use loop）：
 *      发送消息 → LLM 返回工具调用 → 执行工具 → 将结果追加到历史 → 继续调用 → 直到 end_turn
 *   4. 每一步都通过 logger 记录，方便调试和 UI 展示
 *
 * 子类需要实现：
 *   - handleMessage(msg)：处理来自 A2A 总线的任务消息
 *   - executeTool(name, input)：执行具体工具（可选，默认返回未实现提示）
 */
import { bus, type A2AMessage, type AgentCapability } from "../a2a/bus.js";
import { createLLM, type LLMFactoryOptions } from "../llm/factory.js";
import type { LLMProvider, LLMMessage, ToolDefinition } from "../llm/types.js";
import { logger } from "../utils/logger.js";
import type { Subscription } from "rxjs";

/** Agent 配置项 */
export interface AgentConfig {
  id: string;                    // Agent 唯一标识
  name: string;                  // Agent 显示名称
  systemPrompt: string;          // 注入给 LLM 的 system prompt
  capabilities: AgentCapability[]; // 声明的能力列表（用于 A2A 发现）
  llm?: LLMFactoryOptions;       // 可选：覆盖全局 LLM 配置（每个 Agent 可用不同模型）
}

export abstract class BaseAgent {
  protected llm: LLMProvider;       // LLM 提供商实例
  protected config: AgentConfig;
  private subscription: Subscription | null = null; // A2A 消息订阅句柄

  constructor(config: AgentConfig) {
    this.config = config;
    // 根据配置创建 LLM Provider（优先使用 config.llm，否则读取环境变量）
    this.llm = createLLM(config.llm);
    // 向 A2A 总线注册自身
    bus.register({ id: config.id, name: config.name, capabilities: config.capabilities });
  }

  /** 启动 Agent：开始监听 A2A 消息 */
  start() {
    this.subscription = bus.subscribe(this.config.id, (msg) => this.handleMessage(msg));
    console.log(`[${this.config.name}] Started (${this.llm.name}/${this.llm.model})`);
  }

  /** 停止 Agent：取消订阅并从总线注销 */
  stop() {
    this.subscription?.unsubscribe();
    bus.unregister(this.config.id);
  }

  /** 子类实现：处理来自 A2A 总线的任务消息 */
  protected abstract handleMessage(msg: A2AMessage): Promise<void>;

  /**
   * 向 LLM 发起调用，自动处理 tool_use 循环
   * @param userMessage 用户/上游消息内容
   * @param tools       本次调用可用的工具列表
   */
  protected async llmCall(userMessage: string, tools: ToolDefinition[] = []): Promise<string> {
    const messages: LLMMessage[] = [{ role: "user", content: userMessage }];
    return this.runLoop(messages, tools, 1);
  }

  /**
   * LLM 调用循环（递归）
   * 每轮：调用 LLM → 若返回 tool_use 则执行工具 → 将结果追加到历史 → 继续下一轮
   * 直到 LLM 返回 end_turn 或 stop
   *
   * @param messages 当前对话历史
   * @param tools    可用工具列表
   * @param turn     当前轮次（用于日志）
   */
  private async runLoop(messages: LLMMessage[], tools: ToolDefinition[], turn: number): Promise<string> {
    const toolNames = tools.map((t) => t.name).join(", ");

    // 记录 LLM 调用日志
    logger.log(
      "llm_call",
      this.config.name,
      `第 ${turn} 轮 → ${this.llm.name}/${this.llm.model}`,
      toolNames ? `可用工具: [${toolNames}]` : "无工具"
    );

    // 调用 LLM
    const response = await this.llm.call({
      system: this.config.systemPrompt,
      messages,
      tools,
      maxTokens: 4096,
    });

    // 记录 LLM 响应日志
    if (response.text) {
      logger.log(
        "llm_response",
        this.config.name,
        `第 ${turn} 轮 ← ${response.stopReason}`,
        response.text.slice(0, 300)
      );
    }

    // 如果不是工具调用，直接返回文本结果
    if (response.stopReason !== "tool_use" || response.toolCalls.length === 0) {
      return response.text;
    }

    // 构建 assistant 消息块（文本 + 工具调用声明）
    const assistantBlocks: LLMMessage["content"] = [];
    if (response.text) assistantBlocks.push({ type: "text", text: response.text });
    for (const tc of response.toolCalls) {
      assistantBlocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
    }
    messages.push({ role: "assistant", content: assistantBlocks });

    // 依次执行每个工具调用，收集结果
    const resultBlocks: LLMMessage["content"] = [];
    for (const tc of response.toolCalls) {
      logger.log(
        "tool_call",
        this.config.name,
        `调用工具: ${tc.name}`,
        JSON.stringify(tc.input).slice(0, 200)
      );

      const result = await this.executeTool(tc.name, tc.input);

      logger.log(
        "tool_result",
        this.config.name,
        `工具结果: ${tc.name}`,
        result.slice(0, 300)
      );

      // 将工具结果追加到消息历史
      resultBlocks.push({ type: "tool_result", tool_use_id: tc.id, content: result });
    }
    messages.push({ role: "user", content: resultBlocks });

    // 继续下一轮 LLM 调用
    return this.runLoop(messages, tools, turn + 1);
  }

  /**
   * 子类覆盖此方法以实现具体工具逻辑
   * 默认返回"未实现"提示
   */
  protected async executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    return `工具 "${name}" 未实现。输入: ${JSON.stringify(input)}`;
  }
}
