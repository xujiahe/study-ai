<template>
  <AppLayout>
    <ChatView />
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useConversationStore } from "./stores/conversation.js";
import AppLayout from "./components/layout/AppLayout.vue";
import ChatView from "./components/chat/ChatView.vue";

const store = useConversationStore();

onMounted(async () => {
  // 加载会话列表
  await store.loadSessions();

  // 如果有上次的 session，切换到它
  if (store.currentSessionId) {
    const exists = store.sessions.find((s) => s.id === store.currentSessionId);
    if (exists) {
      await store.switchSession(store.currentSessionId);
      return;
    }
  }

  // 如果没有会话，自动创建一个（需求 7.6）
  if (store.sessions.length === 0) {
    await store.createNewSession();
  } else {
    // 切换到最新的会话
    await store.switchSession(store.sessions[0]!.id);
  }
});
</script>
