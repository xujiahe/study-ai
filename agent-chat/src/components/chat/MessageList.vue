<template>
  <div ref="listRef" class="message-list" role="log" aria-live="polite" aria-label="对话消息列表">
    <div v-if="messages.length === 0" class="empty-chat">
      <div class="empty-icon">💬</div>
      <p>开始一段新对话吧</p>
    </div>
    <MessageItem
      v-for="message in messages"
      :key="message.id"
      :message="message"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useConversationStore } from "../../stores/conversation.js";
import MessageItem from "./MessageItem.vue";

const store = useConversationStore();
const messages = store.messages;
const listRef = ref<HTMLDivElement | null>(null);

// 自动滚动到底部
function scrollToBottom() {
  nextTick(() => {
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight;
    }
  });
}

// 监听消息变化，自动滚底
watch(
  () => store.messages.length,
  () => scrollToBottom()
);

// 监听流式内容变化，自动滚底
watch(
  () => store.streamingContent,
  () => scrollToBottom()
);
</script>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  scroll-behavior: smooth;
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  gap: 12px;
}

.empty-icon {
  font-size: 48px;
}

.empty-chat p {
  font-size: 16px;
  margin: 0;
}
</style>
