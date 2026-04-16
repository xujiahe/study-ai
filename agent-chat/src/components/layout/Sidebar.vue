<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <h2 class="sidebar-title">对话列表</h2>
      <button
        class="new-chat-btn"
        @click="handleNewChat"
        :disabled="store.isStreaming"
        aria-label="新建对话"
      >
        + 新建对话
      </button>
    </div>
    <SessionList />
  </div>
</template>

<script setup lang="ts">
import { useConversationStore } from "../../stores/conversation.js";
import SessionList from "../session/SessionList.vue";

const store = useConversationStore();

async function handleNewChat() {
  await store.createNewSession();
}
</script>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.new-chat-btn {
  width: 100%;
  padding: 8px 12px;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s;
}

.new-chat-btn:hover:not(:disabled) {
  background: #4338ca;
}

.new-chat-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
