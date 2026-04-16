<template>
  <div class="session-list">
    <div v-if="store.sessions.length === 0" class="empty-state">
      <p>暂无对话</p>
    </div>
    <SessionItem
      v-for="session in store.sessions"
      :key="session.id"
      :session="session"
      :is-active="session.id === store.currentSessionId"
      @click="handleSelect(session.id)"
      @delete="handleDelete(session.id)"
    />
  </div>
</template>

<script setup lang="ts">
import { useConversationStore } from "../../stores/conversation.js";
import SessionItem from "./SessionItem.vue";

const store = useConversationStore();

async function handleSelect(id: string) {
  if (id !== store.currentSessionId) {
    await store.switchSession(id);
  }
}

async function handleDelete(id: string) {
  await store.deleteSession(id);
}
</script>

<style scoped>
.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-state {
  text-align: center;
  color: #999;
  padding: 24px 16px;
  font-size: 14px;
}
</style>
