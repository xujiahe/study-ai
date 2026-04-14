/**
 * Express + WebSocket API 服务器（备用入口，端口 3001）
 *
 * 与 src/server.ts 功能类似，但使用文件系统持久化 Skills 和 MCP 配置
 * （通过 store.ts 读写 JSON 文件，而非内存存储）
 *
 * 主要区别：
 *   - Skills/MCP 配置持久化到磁盘
 *   - WebSocket 逻辑抽离到 ws.ts
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { v4 as uuidv4 } from "uuid";
import { attachWss } from "./ws.js";
import { getSkills, saveSkill, deleteSkill, getMcpServers, saveMcpServer, deleteMcpServer } from "./store.js";
import { initRAG } from "../rag/index.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.SERVER_PORT ?? 3001);

async function main() {
  await initRAG(join(__dirname, "../../docs"));

  const app = express();
  app.use(cors());
  app.use(express.json());

  // ── Models ──────────────────────────────────────────────────────────────────
  app.get("/api/models", (_req, res) => {
    res.json([
      { provider: "anthropic", models: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-3-5-haiku-20241022"] },
      { provider: "openai",    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
      { provider: "ollama",    models: ["llama3.2", "mistral", "qwen2.5-coder", "deepseek-r1"] },
    ]);
  });

  // ── Skills ──────────────────────────────────────────────────────────────────
  app.get("/api/skills", async (_req, res) => {
    res.json(await getSkills());
  });

  app.post("/api/skills", async (req, res) => {
    const skill = { ...req.body, id: req.body.id ?? uuidv4(), createdAt: Date.now() };
    await saveSkill(skill);
    res.json(skill);
  });

  app.put("/api/skills/:id", async (req, res) => {
    const skill = { ...req.body, id: req.params.id };
    await saveSkill(skill);
    res.json(skill);
  });

  app.delete("/api/skills/:id", async (req, res) => {
    await deleteSkill(req.params.id);
    res.json({ ok: true });
  });

  // ── MCP Servers ─────────────────────────────────────────────────────────────
  app.get("/api/mcp", async (_req, res) => {
    res.json(await getMcpServers());
  });

  app.post("/api/mcp", async (req, res) => {
    const server = { ...req.body, id: req.body.id ?? uuidv4() };
    await saveMcpServer(server);
    res.json(server);
  });

  app.put("/api/mcp/:id", async (req, res) => {
    const server = { ...req.body, id: req.params.id };
    await saveMcpServer(server);
    res.json(server);
  });

  app.delete("/api/mcp/:id", async (req, res) => {
    await deleteMcpServer(req.params.id);
    res.json({ ok: true });
  });

  // ── HTTP server + WebSocket ─────────────────────────────────────────────────
  const server = createServer(app);
  attachWss(server);

  server.listen(PORT, () => {
    console.log(`[Server] API: http://localhost:${PORT}`);
    console.log(`[Server] WS:  ws://localhost:${PORT}/ws`);
  });
}

main().catch(console.error);
