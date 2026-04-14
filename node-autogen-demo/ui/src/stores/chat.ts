import { defineStore } from "pinia";
import { ref } from "vue";
import { v4 as uuidv4 } from "uuid";

export interface StepTrace {
  step: number;
  type: string;
  agent: string;
  message: string;
  detail?: string;
  timestamp: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  streaming?: boolean;
  traces?: StepTrace[];
}

export const useChatStore = defineStore("chat", () => {
  const messages = ref<Message[]>([]);
  const isStreaming = ref(false);
  let ws: WebSocket | null = null;
  let currentMsgId: string | null = null;

  function connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws`);

    ws.onmessage = (e) => {
      const event = JSON.parse(e.data);

      if (event.type === "chat_start") {
        currentMsgId = event.messageId;
        messages.value.push({
          id: event.messageId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
          streaming: true,
          traces: [],
        });
        isStreaming.value = true;
      }

      if (event.type === "chat_delta" && currentMsgId) {
        const msg = messages.value.find((m) => m.id === currentMsgId);
        if (msg) msg.content += event.delta;
      }

      // Real-time step events from the logger
      if (event.type === "step" && currentMsgId) {
        const msg = messages.value.find((m) => m.id === currentMsgId);
        if (msg) msg.traces?.push(event.event as StepTrace);
      }

      // Legacy agent_trace support
      if (event.type === "agent_trace" && currentMsgId) {
        const msg = messages.value.find((m) => m.id === currentMsgId);
        if (msg) msg.traces?.push({ step: 0, type: "tool_call", agent: event.trace.agent, message: event.trace.action, detail: event.trace.detail, timestamp: Date.now() });
      }

      if (event.type === "chat_done" && currentMsgId) {
        const msg = messages.value.find((m) => m.id === currentMsgId);
        if (msg) { msg.content = event.fullText; msg.streaming = false; }
        isStreaming.value = false;
        currentMsgId = null;
      }

      if (event.type === "error") {
        const msg = messages.value.find((m) => m.id === (currentMsgId ?? event.messageId));
        if (msg) { msg.content = `⚠️ ${event.error}`; msg.streaming = false; }
        isStreaming.value = false;
        currentMsgId = null;
      }
    };

    ws.onclose = () => setTimeout(connect, 2000);
  }

  function send(content: string) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    messages.value.push({ id: uuidv4(), role: "user", content, timestamp: Date.now() });
    ws.send(JSON.stringify({ type: "chat", content }));
  }

  function clear() { messages.value = []; }

  connect();

  return { messages, isStreaming, send, clear };
});
