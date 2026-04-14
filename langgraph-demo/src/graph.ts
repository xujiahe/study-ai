/**
 * LangGraph 多 Agent 图定义
 *
 * 架构：Supervisor 模式
 *
 *   用户输入
 *      │
 *      ▼
 *  [supervisor] ──→ [researcher] ──┐
 *      │                           │
 *      └──────→ [coder]    ────────┤
 *                                  │
 *                              [supervisor] ──→ FINISH
 *
 * 每个节点是一个绑定了工具的 ReAct Agent。
 * Supervisor 决定下一步调用哪个 Agent，或直接结束。
 * LangGraph 自动处理工具调用循环（ToolNode）。
 */
import { StateGraph, MessagesAnnotation, END } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { createChatModel } from "./llm.js";
import { researcherTools, coderTools } from "./tools/index.js";

// ── Agent 节点定义 ────────────────────────────────────────────────────────────

/**
 * Researcher Agent — 绑定 RAG + 网络搜索工具
 * createReactAgent 自动实现 ReAct 循环（Reason → Act → Observe）
 */
function createResearcherAgent() {
  return createReactAgent({
    llm: createChatModel(),
    tools: researcherTools,
    messageModifier: new SystemMessage(
      `你是一名研究专家。使用 rag_search 工具检索内部知识库，
使用 web_search 获取最新信息。始终引用信息来源，给出清晰准确的答案。`
    ),
  });
}

/**
 * Coder Agent — 绑定代码执行工具
 */
function createCoderAgent() {
  return createReactAgent({
    llm: createChatModel(),
    tools: coderTools,
    messageModifier: new SystemMessage(
      `你是一名专业软件工程师。编写干净、高效、有注释的代码。
在返回代码前，始终使用 run_code 工具测试代码的可运行性。
最终代码用带语言标注的 markdown 代码块返回。`
    ),
  });
}

// ── Graph 状态定义 ────────────────────────────────────────────────────────────

/**
 * 图的状态：继承 MessagesAnnotation（消息列表）
 * 额外追踪当前活跃的 Agent 和迭代次数
 */
const GraphState = MessagesAnnotation;

// ── Supervisor 路由逻辑 ───────────────────────────────────────────────────────

const AGENTS = ["researcher", "coder"] as const;
type AgentName = typeof AGENTS[number] | "FINISH";

/**
 * Supervisor 节点：分析对话历史，决定下一步路由
 * 返回 { next: "researcher" | "coder" | "FINISH" }
 */
async function supervisorNode(state: typeof GraphState.State) {
  const llm = createChatModel();

  const systemPrompt = `你是一个多 Agent 系统的调度器。根据对话历史决定下一步行动。

可用的 Agent：
- researcher：负责知识检索、RAG 搜索、事实查询、网络搜索
- coder：负责代码生成、代码审查、代码执行

决策规则：
1. 如果用户问题需要查找信息/事实 → researcher
2. 如果用户问题需要写代码/调试 → coder
3. 如果需要先研究再编码 → 先 researcher，再 coder
4. 如果已经有足够信息可以给出最终答案 → FINISH

只回复一个 JSON 对象，格式：{"next": "researcher" | "coder" | "FINISH", "reason": "简短理由"}`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    ...state.messages,
    new HumanMessage("根据以上对话，下一步应该调用哪个 Agent？"),
  ]);

  // 解析路由决策
  const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  let next: AgentName = "FINISH";
  try {
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { next: AgentName };
      if (AGENTS.includes(parsed.next as typeof AGENTS[number]) || parsed.next === "FINISH") {
        next = parsed.next;
      }
    }
  } catch {
    // 解析失败默认结束
  }

  console.log(`[Supervisor] → ${next}`);
  return { messages: state.messages, next };
}

// ── 构建 StateGraph ───────────────────────────────────────────────────────────

/**
 * 创建并编译多 Agent 图
 *
 * 节点：supervisor、researcher、coder
 * 边：supervisor 根据 next 字段条件路由
 */
export function buildGraph() {
  const researcherAgent = createResearcherAgent();
  const coderAgent = createCoderAgent();

  // Researcher 节点：调用 researcher agent，将结果追加到消息历史
  async function researcherNode(state: typeof GraphState.State) {
    console.log("[Researcher] 开始处理...");
    const result = await researcherAgent.invoke({ messages: state.messages });
    // 将 agent 的最后一条回复标记来源，追加到全局消息历史
    const lastMsg = result.messages.at(-1)!;
    const annotated = new AIMessage({
      content: `[Researcher]\n${typeof lastMsg.content === "string" ? lastMsg.content : JSON.stringify(lastMsg.content)}`,
    });
    return { messages: [...state.messages, annotated] };
  }

  // Coder 节点：调用 coder agent
  async function coderNode(state: typeof GraphState.State) {
    console.log("[Coder] 开始处理...");
    const result = await coderAgent.invoke({ messages: state.messages });
    const lastMsg = result.messages.at(-1)!;
    const annotated = new AIMessage({
      content: `[Coder]\n${typeof lastMsg.content === "string" ? lastMsg.content : JSON.stringify(lastMsg.content)}`,
    });
    return { messages: [...state.messages, annotated] };
  }

  // 构建图
  const graph = new StateGraph(GraphState)
    .addNode("supervisor", supervisorNode)
    .addNode("researcher", researcherNode)
    .addNode("coder", coderNode)
    // 入口：从 supervisor 开始
    .addEdge("__start__", "supervisor")
    // supervisor 完成后 → researcher 或 coder 或结束
    .addConditionalEdges("supervisor", (state) => {
      // @ts-expect-error — next 字段由 supervisorNode 动态添加
      const next = (state as { next?: AgentName }).next ?? "FINISH";
      return next === "FINISH" ? END : next;
    })
    // researcher/coder 完成后 → 回到 supervisor 决定是否继续
    .addEdge("researcher", "supervisor")
    .addEdge("coder", "supervisor");

  return graph.compile();
}

// ── 对外接口 ──────────────────────────────────────────────────────────────────

/** 编译好的图实例（单例） */
let compiledGraph: ReturnType<typeof buildGraph> | null = null;

export function getGraph() {
  if (!compiledGraph) compiledGraph = buildGraph();
  return compiledGraph;
}

/**
 * 运行一次完整的多 Agent 对话
 * @param userMessage 用户输入
 * @param onStep      每个节点完成时的回调（用于流式推送）
 */
export async function runGraph(
  userMessage: string,
  onStep?: (node: string, content: string) => void
): Promise<string> {
  const graph = getGraph();

  const result = await graph.invoke(
    { messages: [new HumanMessage(userMessage)] },
    {
      // 最多 10 轮，防止无限循环
      recursionLimit: 10,
    }
  );

  // 收集所有 Agent 的输出
  const agentMessages = result.messages
    .filter((m) => m instanceof AIMessage && typeof m.content === "string" && m.content.startsWith("["))
    .map((m) => m.content as string);

  // 通知每个步骤
  if (onStep) {
    for (const msg of agentMessages) {
      const match = msg.match(/^\[(\w+)\]\n([\s\S]*)/);
      if (match) onStep(match[1], match[2]);
    }
  }

  // 返回最后一条 AI 消息作为最终答案
  const lastAI = [...result.messages].reverse().find((m) => m instanceof AIMessage);
  return typeof lastAI?.content === "string" ? lastAI.content : JSON.stringify(lastAI?.content ?? "");
}
