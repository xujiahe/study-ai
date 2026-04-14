import { defineStore } from "pinia";
import { ref } from "vue";

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

function resolveWsUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) return apiUrl.replace(/^http/, "ws") + "/ws";
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

export const useChatStore = defineStore("chat", () => {
  const messages = ref<Message[]>([]);
  const isStreaming = ref(false);
  let ws: WebSocket | null = null;
  let currentMsgId: string | null = null;

  function connect() {
    ws = new WebSocket(resolveWsUrl());

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

      if (event.type === "step" && currentMsgId) {
        const msg = messages.value.find((m) => m.id === currentMsgId);
        if (msg) msg.traces?.push(event.event as StepTrace);
      }

      if (event.type === "chat_done" && currentMsgId) {
        const msg = messages.value.find((m) => m.id === currentMsgId);
        if (msg) { msg.content = event.fullText; msg.streaming = false; }
        isStreaming.value = false;
        currentMsgId = null;
      }

      if (event.type === "error") {
        const msg = messages.value.find((m) => m.id === (currentMsgId ?? event.messageId));
        if (msg) { msg.content = `Error: ${event.error}`; msg.streaming = false; }
        isStreaming.value = false;
        currentMsgId = null;
      }
    };

    ws.onclose = () => setTimeout(connect, 2000);
  }

  function send(content: string) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    messages.value.push({ id: crypto.randomUUID(), role: "user", content, timestamp: Date.now() });
    ws.send(JSON.stringify({ type: "chat", content }));
  }

  function clear() { messages.value = []; }

  connect();

  return { messages, isStreaming, send, clear };
});
