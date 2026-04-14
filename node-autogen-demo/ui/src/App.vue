<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from "vue";
import { useChatStore } from "./stores/chat";
import { useSettingsStore } from "./stores/settings";
import ChatMessage from "./components/ChatMessage.vue";
import ChatInput from "./components/ChatInput.vue";
import SkillsPanel from "./components/SkillsPanel.vue";
import McpPanel from "./components/McpPanel.vue";
import ModelSelector from "./components/ModelSelector.vue";

const chat = useChatStore();
const settings = useSettingsStore();

type Tab = "skills" | "mcp";
const sidebarTab = ref<Tab>("skills");
const sidebarOpen = ref(true);
const messagesEl = ref<HTMLElement | null>(null);

onMounted(() => settings.fetchAll());

// Auto-scroll to bottom on new messages
watch(
  () => chat.messages.map((m) => m.content).join(""),
  () => nextTick(() => {
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
  })
);
</script>

<template>
  <div class="layout">
    <!-- ── Sidebar ── -->
    <aside class="sidebar" :class="{ collapsed: !sidebarOpen }">
      <div class="sidebar-header">
        <div class="logo">🤖 Autogen</div>
        <button class="collapse-btn" @click="sidebarOpen = !sidebarOpen">
          {{ sidebarOpen ? "◀" : "▶" }}
        </button>
      </div>

      <div v-if="sidebarOpen" class="sidebar-body">
        <div class="tabs">
          <button :class="{ active: sidebarTab === 'skills' }" @click="sidebarTab = 'skills'">
            ⚡ Skills
          </button>
          <button :class="{ active: sidebarTab === 'mcp' }" @click="sidebarTab = 'mcp'">
            🔌 MCP
          </button>
        </div>

        <div class="tab-content">
          <SkillsPanel v-if="sidebarTab === 'skills'" />
          <McpPanel v-else />
        </div>
      </div>
    </aside>

    <!-- ── Main chat area ── -->
    <main class="chat-area">
      <!-- Top bar -->
      <header class="topbar">
        <div class="topbar-left">
          <span class="chat-title">Chat</span>
          <span class="agent-badge">Orchestrator · Researcher · Coder</span>
        </div>
        <div class="topbar-right">
          <ModelSelector />
          <button class="clear-btn" @click="chat.clear()" title="Clear chat">🗑️</button>
        </div>
      </header>

      <!-- Messages -->
      <div class="messages" ref="messagesEl">
        <div v-if="chat.messages.length === 0" class="welcome">
          <div class="welcome-icon">🤖</div>
          <div class="welcome-title">Multi-Agent System</div>
          <div class="welcome-sub">Powered by Orchestrator + Researcher + Coder agents</div>
          <div class="suggestions">
            <button v-for="s in ['What is RAG?', 'Write a binary search in TypeScript', 'Explain MCP protocol']"
              :key="s" class="suggestion" @click="chat.send(s)">
              {{ s }}
            </button>
          </div>
        </div>

        <ChatMessage v-for="msg in chat.messages" :key="msg.id" :message="msg" />
      </div>

      <!-- Input -->
      <div class="input-area">
        <ChatInput :disabled="chat.isStreaming" @send="chat.send" />
        <div class="input-hint">
          <span v-if="chat.isStreaming" class="streaming-indicator">
            <span class="dot-pulse" />
            Agents working…
          </span>
          <span v-else class="hint-text">Enter to send · Shift+Enter for newline</span>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ── Sidebar ── */
.sidebar {
  width: 280px;
  min-width: 280px;
  background: var(--bg2);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transition: width .2s, min-width .2s;
}
.sidebar.collapsed { width: 48px; min-width: 48px; }

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.logo { font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; }
.collapse-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 12px; padding: 4px; }
.collapse-btn:hover { color: var(--text); }

.sidebar-body { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px; }

.tabs { display: flex; gap: 4px; background: var(--bg3); border-radius: 8px; padding: 3px; }
.tabs button { flex: 1; background: none; border: none; color: var(--text-muted); font-size: 12px; padding: 5px 8px; border-radius: 6px; cursor: pointer; white-space: nowrap; }
.tabs button.active { background: var(--bg2); color: var(--text); font-weight: 500; }

.tab-content { flex: 1; }

/* ── Chat area ── */
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg2);
  flex-shrink: 0;
}
.topbar-left { display: flex; align-items: center; gap: 10px; }
.chat-title { font-weight: 600; font-size: 15px; }
.agent-badge { font-size: 11px; color: var(--text-dim); background: var(--bg3); border: 1px solid var(--border); border-radius: 20px; padding: 2px 10px; }
.topbar-right { display: flex; align-items: center; gap: 8px; }
.clear-btn { background: none; border: none; cursor: pointer; font-size: 16px; opacity: .6; }
.clear-btn:hover { opacity: 1; }

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Welcome screen */
.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  text-align: center;
}
.welcome-icon { font-size: 48px; }
.welcome-title { font-size: 22px; font-weight: 700; }
.welcome-sub { color: var(--text-dim); font-size: 14px; }
.suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 16px; }
.suggestion {
  background: var(--bg3);
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 20px;
  padding: 7px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: border-color .2s, color .2s;
}
.suggestion:hover { border-color: var(--accent); color: var(--text); }

/* Input area */
.input-area {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  background: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.input-hint { display: flex; align-items: center; gap: 6px; min-height: 18px; }
.hint-text { font-size: 11px; color: var(--text-dim); }
.streaming-indicator { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--accent); }
.dot-pulse {
  width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(.7); } }
</style>
