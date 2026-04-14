/**
 * HTTP + WebSocket 服务器（端口 3002）
 * 与 node-autogen-demo 接口完全兼容，前端 UI 可直接复用
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
import { runGraph } from "./graph.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.API_PORT ?? 3002);

const app = express();
app.use(cors());
app.use(express.json());

// 健康检查
app.get("/api/health", (_req, res) => res.json({ ok: true, engine: "langgraph" }));

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws: WebSocket) => {
  console.log("[WS] 客户端已连接");

  ws.on("message", async (raw) => {
    let event: { type: string; content?: string };
    try { event = JSON.parse(raw.toString()); } catch { return; }
    if (event.type !== "chat" || !event.content) return;

    const messageId = uuidv4();
    const send = (data: unknown) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
    };

    send({ type: "chat_start", messageId });

    try {
      // 每个 Agent 节点完成时推送 step 事件
      const result = await runGraph(event.content, (node, content) => {
        send({
          type: "step",
          event: {
            step: 0,
            type: node === "Researcher" ? "a2a_reply" : "tool_result",
            agent: node,
            message: `${node} 完成`,
            detail: content.slice(0, 150),
            timestamp: Date.now(),
          },
        });
      });

      // 逐词流式推送
      for (const word of result.split(" ")) {
        send({ type: "chat_delta", delta: word + " " });
        await new Promise((r) => setTimeout(r, 15));
      }
      send({ type: "chat_done", messageId, fullText: result });
    } catch (err) {
      send({ type: "error", messageId, error: (err as Error).message });
    }
  });

  ws.on("close", () => console.log("[WS] 客户端已断开"));
});

async function main() {
  await initRAG(join(__dirname, "../docs"));
  httpServer.listen(PORT, () => {
    console.log(`[LangGraph Server] 监听 http://localhost:${PORT}`);
  });
}

main().catch((err) => { console.error(err); process.exit(1); });
