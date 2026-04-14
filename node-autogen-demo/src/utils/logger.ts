/**
 * 步骤日志器
 * 记录每一次 LLM 调用、工具调用、A2A 消息，并通过 EventEmitter 推送给 WebSocket 服务端
 * 终端输出带颜色，UI 侧实时展示调用链
 */
import { EventEmitter } from "events";

/** 步骤类型枚举 */
export type StepType =
  | "llm_call"       // 向 LLM 发送请求
  | "llm_response"   // LLM 返回结果
  | "tool_call"      // Agent 调用工具
  | "tool_result"    // 工具返回结果
  | "a2a_send"       // Agent 向另一个 Agent 发送任务
  | "a2a_reply"      // 收到另一个 Agent 的回复
  | "rag_query"      // 向 RAG 发起检索
  | "rag_result"     // RAG 返回检索结果
  | "agent_start"    // Agent 开始处理任务
  | "agent_done"     // Agent 完成任务
  | "error";         // 发生错误

/** 单条步骤事件的数据结构 */
export interface StepEvent {
  step: number;      // 本次请求内的步骤序号（每次新请求从 1 开始）
  type: StepType;
  agent: string;     // 发出该步骤的 Agent 名称
  message: string;   // 简短描述
  detail?: string;   // 可选的详细内容（截断后）
  timestamp: number; // Unix 毫秒时间戳
}

// 终端 ANSI 颜色映射
const COLORS: Record<StepType, string> = {
  llm_call:     "\x1b[36m",   // 青色
  llm_response: "\x1b[32m",   // 绿色
  tool_call:    "\x1b[33m",   // 黄色
  tool_result:  "\x1b[90m",   // 灰色
  a2a_send:     "\x1b[35m",   // 品红
  a2a_reply:    "\x1b[34m",   // 蓝色
  rag_query:    "\x1b[33m",   // 黄色
  rag_result:   "\x1b[90m",   // 灰色
  agent_start:  "\x1b[1;36m", // 粗体青色
  agent_done:   "\x1b[1;32m", // 粗体绿色
  error:        "\x1b[31m",   // 红色
};
const RESET = "\x1b[0m";

// 终端图标映射
const ICONS: Record<StepType, string> = {
  llm_call:     "→ LLM",
  llm_response: "← LLM",
  tool_call:    "⚙ TOOL",
  tool_result:  "✓ TOOL",
  a2a_send:     "→ A2A",
  a2a_reply:    "← A2A",
  rag_query:    "🔍 RAG",
  rag_result:   "📄 RAG",
  agent_start:  "▶ AGENT",
  agent_done:   "■ AGENT",
  error:        "✗ ERROR",
};

class Logger extends EventEmitter {
  /** 当前请求的步骤计数器，每次 reset() 归零 */
  private counter = 0;

  /**
   * 记录一条步骤日志
   * @param type    步骤类型
   * @param agent   发出步骤的 Agent 名称
   * @param message 简短描述
   * @param detail  可选详细内容（超过 200 字符自动截断）
   */
  log(type: StepType, agent: string, message: string, detail?: string) {
    const step = ++this.counter;
    // 取时间戳 HH:MM:SS.mmm 部分
    const ts = new Date().toISOString().slice(11, 23);
    const color = COLORS[type];
    const icon = ICONS[type];

    // 详细内容截断处理
    const detailStr = detail
      ? `\n    ${RESET}\x1b[90m${detail.slice(0, 200)}${detail.length > 200 ? "…" : ""}${RESET}`
      : "";

    // 输出到终端（带颜色）
    console.log(`${color}[${ts}] #${step} ${icon} [${agent}] ${message}${detailStr}${RESET}`);

    // 通过 EventEmitter 广播给 WebSocket 服务端，再推送到 UI
    const event: StepEvent = { step, type, agent, message, detail, timestamp: Date.now() };
    this.emit("step", event);
  }

  /** 每次新的用户请求开始前调用，重置步骤序号 */
  reset() { this.counter = 0; }
}

// 全局单例，所有模块共享同一个日志器实例
export const logger = new Logger();
