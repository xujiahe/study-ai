/**
 * ResearcherAgent — 知识检索专项 Agent
 *
 * 职责：
 *   接收来自 Orchestrator 的研究任务，通过 RAG 检索知识库，
 *   结合 LLM 合成清晰、准确的答案并引用来源
 *
 * 工具：
 *   - rag_search：向量语义检索内部知识库
 */
import { BaseAgent } from "./base.js";
import { bus, type A2AMessage } from "../a2a/bus.js";
import { retrieve } from "../rag/index.js";
import { logger } from "../utils/logger.js";
import type { ToolDefinition } from "../llm/types.js";

/** Researcher 可用的工具列表 */
const TOOLS: ToolDefinition[] = [
  {
    name: "rag_search",
    description: "在内部知识库中进行语义相似度检索",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "检索查询词" },
        topK: { type: "number", description: "返回结果数量，默认 4", default: 4 },
      },
      required: ["query"],
    },
  },
];

export class ResearcherAgent extends BaseAgent {
  constructor() {
    super({
      id: "researcher",
      name: "Researcher",
      systemPrompt: `你是一名研究专家。你的工作是从知识库中找到相关信息，并合成清晰、准确的答案。
始终引用你的信息来源。
在回答前，先使用 rag_search 工具检索相关上下文。`,
      capabilities: [
        {
          name: "research",
          description: "使用 RAG 知识库研究某个主题",
          inputSchema: { query: { type: "string" } },
        },
      ],
    });
  }

  /** 处理来自 A2A 总线的研究任务 */
  protected async handleMessage(msg: A2AMessage): Promise<void> {
    if (msg.type !== "task") return;

    const { query } = msg.payload as { query: string };
    logger.log("agent_start", this.config.name, `开始研究: "${query}"`);

    try {
      // 调用 LLM，LLM 会主动调用 rag_search 工具检索知识库
      const answer = await this.llmCall(
        `研究以下主题并给出全面的回答: ${query}`,
        TOOLS
      );
      logger.log("agent_done", this.config.name, `完成 (${answer.length} 字符)`);
      // 将结果回复给 Orchestrator
      bus.reply(msg, this.config.id, { answer, agent: this.config.name });
    } catch (err) {
      logger.log("error", this.config.name, (err as Error).message);
      bus.reply(msg, this.config.id, { error: (err as Error).message });
    }
  }

  /** 执行工具调用 */
  protected async executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    if (name === "rag_search") {
      // 记录 RAG 检索日志
      logger.log("rag_query", this.config.name, `检索: "${input.query}"`);
      const result = await retrieve(input.query as string, (input.topK as number) ?? 4);
      // 统计返回的文档块数量（以 "---" 分隔）
      logger.log("rag_result", this.config.name, `找到 ${result.split("---").length} 个文档块`, result.slice(0, 200));
      return result;
    }
    return super.executeTool(name, input);
  }
}
