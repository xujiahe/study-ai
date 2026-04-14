/**
 * A2A（Agent-to-Agent）消息总线
 *
 * 基于 RxJS Subject 实现进程内消息传递，支持两种通信模式：
 *   1. 请求/响应（request/reply）：发送任务并等待对应 Agent 的回复，带超时保护
 *   2. 发布/订阅（pub/sub）：广播消息给所有 Agent（to: "*"）
 *
 * Agent 注册时声明自己的能力（capabilities），其他 Agent 可通过 findByCapability() 发现
 */
import { Subject, filter, firstValueFrom, timeout } from "rxjs";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger.js";

/** 消息类型 */
export type MessageType = "task" | "result" | "broadcast" | "ping" | "pong";

/** A2A 消息结构 */
export interface A2AMessage {
  id: string;              // 消息唯一 ID
  correlationId?: string;  // 请求/响应配对 ID
  from: string;            // 发送方 Agent ID
  to: string | "*";        // 接收方 Agent ID，"*" 表示广播
  type: MessageType;
  payload: unknown;        // 消息内容
  timestamp: number;       // 发送时间戳（毫秒）
}

/** Agent 能力描述 */
export interface AgentCapability {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Agent 注册信息 */
export interface AgentRegistration {
  id: string;
  name: string;
  capabilities: AgentCapability[];
}

class A2ABus {
  /** RxJS Subject，所有消息都流经这里 */
  private messages$ = new Subject<A2AMessage>();
  /** 已注册的 Agent 注册表，key 为 Agent ID */
  private registry = new Map<string, AgentRegistration>();

  /** 注册 Agent，使其可被其他 Agent 发现 */
  register(agent: AgentRegistration) {
    this.registry.set(agent.id, agent);
    console.log(`[A2ABus] Agent registered: ${agent.name} (${agent.id})`);
  }

  /** 注销 Agent */
  unregister(agentId: string) { this.registry.delete(agentId); }

  /** 列出所有已注册的 Agent */
  listAgents(): AgentRegistration[] { return Array.from(this.registry.values()); }

  /** 按能力名称查找 Agent */
  findByCapability(name: string): AgentRegistration[] {
    return this.listAgents().filter((a) => a.capabilities.some((c) => c.name === name));
  }

  /**
   * 发送一条消息（fire-and-forget）
   * 自动补充 id 和 timestamp
   */
  send(msg: Omit<A2AMessage, "id" | "timestamp">) {
    const full: A2AMessage = { ...msg, id: uuidv4(), timestamp: Date.now() };
    this.messages$.next(full);
    return full.id;
  }

  /**
   * 请求/响应模式：向目标 Agent 发送任务，等待其回复
   * @param from      发送方 Agent ID
   * @param to        目标 Agent ID
   * @param payload   任务内容
   * @param timeoutMs 超时毫秒数，默认 3 分钟（GLM 系列模型响应较慢）
   */
  async request<T = unknown>(
    from: string,
    to: string,
    payload: unknown,
    timeoutMs = 180_000
  ): Promise<T> {
    const correlationId = uuidv4();

    // 记录发送日志
    logger.log("a2a_send", from, `→ ${to}`, JSON.stringify(payload).slice(0, 150));

    // 先订阅回复，再发送请求，避免竞态条件
    const reply$ = this.messages$.pipe(
      // 过滤：correlationId 匹配 + 类型为 result + 来自目标 Agent
      filter((m) => m.correlationId === correlationId && m.type === "result" && m.from === to),
      timeout(timeoutMs)
    );

    const replyPromise = firstValueFrom(reply$);
    // 发送任务消息
    this.send({ from, to, type: "task", payload, correlationId });

    // 等待回复
    const reply = await replyPromise;
    logger.log("a2a_reply", from, `← ${to}`, JSON.stringify(reply.payload).slice(0, 150));
    return reply.payload as T;
  }

  /**
   * 订阅发给指定 Agent 的消息（包括广播）
   * @param agentId 订阅者 Agent ID
   * @param handler 消息处理函数
   * @returns RxJS Subscription，调用 .unsubscribe() 取消订阅
   */
  subscribe(agentId: string, handler: (msg: A2AMessage) => void) {
    return this.messages$
      .pipe(filter((m) => m.to === agentId || m.to === "*"))
      .subscribe(handler);
  }

  /**
   * 回复一条任务消息
   * 自动使用原消息的 correlationId 和 from 字段
   */
  reply(original: A2AMessage, from: string, payload: unknown) {
    this.send({
      from,
      to: original.from,
      type: "result",
      payload,
      correlationId: original.correlationId,
    });
  }
}

// 全局单例消息总线，所有 Agent 共享
export const bus = new A2ABus();
