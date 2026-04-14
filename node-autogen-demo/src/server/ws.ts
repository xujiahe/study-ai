/**
 * WebSocket handler — streams agent responses to the client
 */
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "http";
import { v4 as uuidv4 } from "uuid";
import { OrchestratorAgent } from "../agents/orchestrator.js";
import { ResearcherAgent } from "../agents/researcher.js";
import { CoderAgent } from "../agents/coder.js";
import { bus } from "../a2a/bus.js";
import type { WsEvent, AgentTrace } from "./types.js";
import { getSkills } from "./store.js";

// Boot agents once
const researcher = new ResearcherAgent();
const coder = new CoderAgent();
const orchestrator = new OrchestratorAgent();
researcher.start();
coder.start();
orchestrator.start();

function send(ws: WebSocket, event: WsEvent) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

export function attachWss(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    console.log("[WS] Client connected");

    ws.on("message", async (raw) => {
      let payload: { type: string; content?: string; model?: string };
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (payload.type !== "chat") return;

      const messageId = uuidv4();
      const userMessage = payload.content ?? "";

      send(ws, { type: "chat_start", messageId });

      // Patch bus to emit traces to this WS client
      const origSend = bus.send.bind(bus);
      const traceSub = (bus as unknown as { messages$: import("rxjs").Subject<import("../a2a/bus.js").A2AMessage> }).messages$.subscribe((msg) => {
        if (msg.type === "task" || msg.type === "result") {
          const trace: AgentTrace = {
            agent: msg.from,
            action: msg.type === "task" ? `→ ${msg.to}` : `← ${msg.from}`,
            detail: typeof msg.payload === "object" && msg.payload !== null
              ? Object.values(msg.payload as Record<string, unknown>)[0]?.toString().slice(0, 120)
              : undefined,
          };
          send(ws, { type: "agent_trace", messageId, trace });
        }
      });

      try {
        // Prepend active skills to system context
        const skills = await getSkills();
        const activeSkills = skills.filter((s) => s.enabled);
        const skillContext = activeSkills.length
          ? `\n\nActive skills:\n${activeSkills.map((s) => `- ${s.name}: ${s.systemPrompt}`).join("\n")}`
          : "";

        const fullTask = skillContext ? `${userMessage}\n\n[Context]${skillContext}` : userMessage;

        // Run orchestrator (non-streaming for now; swap with streaming SDK call for delta events)
        const result = await orchestrator.run(fullTask);

        // Simulate streaming by chunking the result
        const words = result.split(" ");
        let accumulated = "";
        for (const word of words) {
          const delta = (accumulated ? " " : "") + word;
          accumulated += delta;
          send(ws, { type: "chat_delta", messageId, delta });
          await new Promise((r) => setTimeout(r, 15)); // ~65 words/sec
        }

        send(ws, { type: "chat_done", messageId, fullText: accumulated });
      } catch (err) {
        send(ws, { type: "error", messageId, error: (err as Error).message });
      } finally {
        traceSub.unsubscribe();
        void origSend; // keep reference
      }
    });

    ws.on("close", () => console.log("[WS] Client disconnected"));
  });

  return wss;
}
