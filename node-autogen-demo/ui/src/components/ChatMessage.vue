<script setup lang="ts">
import { computed, ref } from "vue";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import type { Message, StepTrace } from "../stores/chat";

// Configure marked with syntax highlighting once
marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  })
);

const props = defineProps<{ message: Message }>();
const showTraces = ref(false);

const html = computed(() => {
  if (!props.message.content) return "";
  return marked.parse(props.message.content) as string;
});

const hasTraces = computed(() => (props.message.traces?.length ?? 0) > 0);

const STEP_ICONS: Record<string, string> = {
  llm_call:     "→",
  llm_response: "←",
  tool_call:    "⚙",
  tool_result:  "✓",
  a2a_send:     "↗",
  a2a_reply:    "↙",
  rag_query:    "🔍",
  rag_result:   "📄",
  agent_start:  "▶",
  agent_done:   "■",
  error:        "✗",
};

const STEP_COLORS: Record<string, string> = {
  llm_call:     "#67e8f9",
  llm_response: "#86efac",
  tool_call:    "#fde68a",
  tool_result:  "#94a3b8",
  a2a_send:     "#d8b4fe",
  a2a_reply:    "#93c5fd",
  rag_query:    "#fde68a",
  rag_result:   "#94a3b8",
  agent_start:  "#67e8f9",
  agent_done:   "#86efac",
  error:        "#fca5a5",
};

function stepColor(t: StepTrace) { return STEP_COLORS[t.type] ?? "#94a3b8"; }
function stepIcon(t: StepTrace) { return STEP_ICONS[t.type] ?? "·"; }
</script>

<template>
  <div class="msg-row" :class="message.role">
    <div class="avatar">{{ message.role === "user" ? "👤" : "🤖" }}</div>
    <div class="bubble">
      <span v-if="message.streaming && !message.content" class="cursor-blink">▋</span>
      <div v-if="message.content" class="md-content" v-html="html" />
      <span v-if="message.streaming" class="cursor-blink">▋</span>

      <!-- Step traces -->
      <div v-if="hasTraces" class="traces-toggle" @click="showTraces = !showTraces">
        <span>{{ showTraces ? "▾" : "▸" }} {{ message.traces!.length }} steps
          <span v-if="message.streaming" class="live-badge">LIVE</span>
        </span>
      </div>

      <div v-if="showTraces && hasTraces" class="traces">
        <div v-for="t in message.traces" :key="t.step" class="trace-item">
          <span class="trace-step">#{{ t.step }}</span>
          <span class="trace-icon" :style="{ color: stepColor(t) }">{{ stepIcon(t) }}</span>
          <span class="trace-agent" :style="{ color: stepColor(t) }">{{ t.agent }}</span>
          <span class="trace-msg">{{ t.message }}</span>
          <span v-if="t.detail" class="trace-detail">{{ t.detail }}</span>
        </div>
      </div>

      <div class="msg-time">{{ new Date(message.timestamp).toLocaleTimeString() }}</div>
    </div>
  </div>
</template>

<style scoped>
.msg-row { display: flex; gap: 12px; padding: 4px 0; align-items: flex-start; }
.msg-row.user { flex-direction: row-reverse; }

.avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--bg3); display: flex; align-items: center;
  justify-content: center; font-size: 16px; flex-shrink: 0;
  border: 1px solid var(--border);
}

.bubble {
  max-width: 72%; background: var(--ai-bubble);
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: 12px 16px; position: relative;
}
.msg-row.user .bubble { background: var(--user-bubble); border-color: #2a4a6e; }

.cursor-blink { display: inline-block; animation: blink 1s step-end infinite; color: var(--accent); }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

.msg-time { font-size: 11px; color: var(--text-dim); margin-top: 6px; text-align: right; }

/* Traces */
.traces-toggle {
  font-size: 12px; color: var(--accent); cursor: pointer;
  margin-top: 8px; user-select: none; display: flex; align-items: center; gap: 6px;
}
.traces-toggle:hover { color: var(--accent-hover); }

.live-badge {
  font-size: 10px; background: var(--accent); color: white;
  border-radius: 4px; padding: 1px 5px; animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }

.traces {
  margin-top: 8px; border-top: 1px solid var(--border);
  padding-top: 8px; display: flex; flex-direction: column; gap: 3px;
  max-height: 320px; overflow-y: auto;
}

.trace-item {
  display: grid;
  grid-template-columns: 28px 18px 90px 1fr;
  gap: 4px;
  font-size: 11px;
  font-family: var(--font-mono);
  align-items: baseline;
  padding: 2px 4px;
  border-radius: 4px;
}
.trace-item:hover { background: var(--bg3); }

.trace-step { color: var(--text-dim); text-align: right; }
.trace-icon { font-size: 12px; text-align: center; }
.trace-agent { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trace-msg { color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trace-detail {
  grid-column: 3 / -1;
  color: var(--text-dim);
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 4px;
}
</style>
