/**
 * HTTP + WebSocket API 服务器（端口 3001）
 *
 * 职责：
 *   1. 启动所有 Agent（RAG 初始化 → Researcher → Coder → Orchestrator）
 *   2. 提供 REST API（Skills CRUD、MCP 配置 CRUD、模型切换）
 *   3. 提供 WebSocket 接口，将用户消息转发给 Orchestrator，
 *      并将 Agent 执行步骤实时推送到前端 UI
 *
 * WebSocket 事件协议：
 *   客户端 → 服务端：{ type: "chat", content: "用户消息" }
 *   服务端 → 客户端：
 *     { type: "chat_start", messageId }          — 开始响应
 *     { type: "step", event: StepEvent }          — 实时步骤日志
 *     { type: "chat_delta", delta: "..." }        — 逐词流式输出
 *     { type: "chat_done", messageId, fullText }  — 完整响应
 *     { type: "error", messageId, error }         — 错误信息
 */
import "dotenv/config";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { initRAG } from "./rag/index.js";
import { OrchestratorAgent } from "./agents/orchestrator.js";
import { ResearcherAgent } from "./agents/researcher.js";
import { CoderAgent } from "./agents/coder.js";
import { type LLMFactoryOptions } from "./llm/factory.js";
import { logger } from "./utils/logger.js";
import { loadSkills, type Skill } from "./skills/loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.API_PORT ?? 3001);

// ── 数据类型定义 ──────────────────────────────────────────────────────────────

/** Skill：注入到每次对话 system prompt 的自定义指令（从 skills/ 目录加载） */
// 使用从 loader.ts 导入的 Skill 类型，此处重新导出供 REST API 使用

/** MCP 服务器配置（UI 展示用，实际调用由 Agent 内部处理） */
interface McpServer {
  id: string;
  name: string;
  command: string;  // 启动命令，如 "npx"
  args: string[];   // 命令参数
  enabled: boolean;
}

// ── 内存存储（生产环境可替换为数据库） ───────────────────────────────────────

/** 内置 Skills，开箱即用，用户可在 UI 中启用/禁用/编辑 */
const skills: Skill[] = [];

/** 内置 MCP 服务器配置（UI 展示用） */
const mcpServers: McpServer[] = [
  {
    id: "builtin-autogen",
    name: "autogen-tools",
    command: "npx",
    args: ["tsx", "src/mcp/server.ts"],
    enabled: true,
  },
  {
    id: "builtin-filesystem",
    name: "filesystem (官方)",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "./workspace"],
    enabled: false,
  },
];

/** 当前 LLM 配置（可通过 /api/settings/model 接口动态切换） */
let currentLLMOptions: LLMFactoryOptions = {
  provider: (process.env.LLM_PROVIDER as LLMFactoryOptions["provider"]) ?? "zhipu",
  model: process.env.LLM_MODEL ?? "glm-5",
};

// ── Agent 启动 ────────────────────────────────────────────────────────────────

let orchestrator: OrchestratorAgent;

const SKILLS_DIR = join(__dirname, "../skills");

/**
 * 按顺序启动所有 Agent：
 * 1. 从 skills/ 目录加载 Skills
 * 2. 初始化 RAG 知识库
 * 3. 启动 Researcher 和 Coder（专项 Agent 先注册到 A2A 总线）
 * 4. 最后启动 Orchestrator（确保委托目标已就绪）
 */
async function bootAgents() {
  // 从文件系统加载 Skills
  const loaded = await loadSkills(SKILLS_DIR);
  skills.push(...loaded);

  await initRAG(join(__dirname, "../docs"));
  const researcher = new ResearcherAgent();
  const coder = new CoderAgent();
  researcher.start();
  coder.start();
  orchestrator = new OrchestratorAgent();
  orchestrator.start();
  // 将已加载的 Skills 注入 Orchestrator，使其可以调用脚本工具
  orchestrator.setSkills(loaded);
  console.log(`[Server] 所有 Agent 就绪 (${currentLLMOptions.provider}/${currentLLMOptions.model})`);
}

// ── Express REST API ──────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// Skills CRUD + toggle
app.get("/api/skills", (_req, res) => res.json(skills));
app.post("/api/skills", (req, res) => {
  // 运行时新增 skill（内存中，不写入文件系统）
  const skill: Skill = { ...req.body, id: uuidv4(), path: "", version: "1.0.0" };
  skills.push(skill);
  res.json(skill);
});
app.put("/api/skills/:id", (req, res) => {
  const idx = skills.findIndex((s) => s.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  skills[idx] = { ...skills[idx], ...req.body };
  res.json(skills[idx]);
});
// 快捷切换 enabled 状态
app.patch("/api/skills/:id/toggle", (req, res) => {
  const idx = skills.findIndex((s) => s.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  skills[idx].enabled = !skills[idx].enabled;
  console.log(`[Skills] ${skills[idx].name} → ${skills[idx].enabled ? "启用" : "禁用"}`);
  res.json(skills[idx]);
});
app.delete("/api/skills/:id", (req, res) => {
  const idx = skills.findIndex((s) => s.id === req.params.id);
  if (idx >= 0) skills.splice(idx, 1);
  res.json({ ok: true });
});

// MCP 服务器配置 CRUD
app.get("/api/mcp", (_req, res) => res.json(mcpServers));
app.post("/api/mcp", (req, res) => {
  const s: McpServer = { ...req.body, id: uuidv4() };
  mcpServers.push(s);
  res.json(s);
});
app.put("/api/mcp/:id", (req, res) => {
  const idx = mcpServers.findIndex((s) => s.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });
  mcpServers[idx] = { ...mcpServers[idx], ...req.body };
  res.json(mcpServers[idx]);
});
app.delete("/api/mcp/:id", (req, res) => {
  const idx = mcpServers.findIndex((s) => s.id === req.params.id);
  if (idx >= 0) mcpServers.splice(idx, 1);
  res.json({ ok: true });
});

/**
 * 运行时切换 LLM 模型
 * 重新创建 Orchestrator 实例以应用新配置
 */
app.post("/api/settings/model", (req, res) => {
  const { provider, model } = req.body as { provider: string; model: string };
  currentLLMOptions = { ...currentLLMOptions, provider: provider as LLMFactoryOptions["provider"], model };
  // 停止旧 Orchestrator，用新配置重新启动
  orchestrator.stop();
  orchestrator = new OrchestratorAgent({ llm: currentLLMOptions });
  orchestrator.start();
  console.log(`[Server] 已切换模型: ${provider}/${model}`);
  res.json({ ok: true });
});

// ── WebSocket ─────────────────────────────────────────────────────────────────

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws: WebSocket) => {
  console.log("[WS] 客户端已连接");

  // 将 logger 的每条步骤事件实时推送给当前 WebSocket 客户端
  const onStep = (event: import("./utils/logger.js").StepEvent) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "step", event }));
    }
  };
  logger.on("step", onStep);

  // 客户端断开时取消监听，避免内存泄漏
  ws.on("close", () => {
    logger.off("step", onStep);
    console.log("[WS] 客户端已断开");
  });

  ws.on("message", async (raw) => {
    let event: { type: string; content?: string };
    try { event = JSON.parse(raw.toString()); } catch { return; }

    if (event.type !== "chat" || !event.content) return;

    const messageId = uuidv4();
    // 便捷发送函数，自动检查连接状态
    const send = (data: unknown) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
    };

    // 每次新请求重置步骤计数器
    logger.reset();
    send({ type: "chat_start", messageId });

    // 将所有已启用的 Skills 的 systemPrompt 注入到用户消息前
    const skillContext = skills
      .filter((s) => s.enabled)
      .map((s) => `[Skill: ${s.name}]\n${s.systemPrompt}`)
      .join("\n\n");

    const userMessage = skillContext
      ? `${skillContext}\n\n---\n\n${event.content}`
      : event.content;

    try {
      // 调用 Orchestrator 处理用户请求
      const result = await orchestrator.run(userMessage);

      // 逐词流式推送结果（模拟打字机效果）
      const words = result.split(" ");
      for (const word of words) {
        send({ type: "chat_delta", delta: word + " " });
        await new Promise((r) => setTimeout(r, 15));
      }

      // 发送完整结果（用于 UI 最终渲染）
      send({ type: "chat_done", messageId, fullText: result });
    } catch (err) {
      send({ type: "error", messageId, error: (err as Error).message });
    }
  });
});

// ── 启动服务器 ────────────────────────────────────────────────────────────────

bootAgents().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`[Server] API + WS 监听 http://localhost:${PORT}`);
    console.log(`[Server] 启动前端后访问 http://localhost:5173`);
  });
}).catch((err) => {
  console.error("[Server] 启动失败:", err);
  process.exit(1);
});
