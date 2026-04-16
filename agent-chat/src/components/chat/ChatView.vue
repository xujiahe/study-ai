<template>
  <div class="chat-view">
    <StatusBar />
    <MessageList class="chat-messages" />
    <LoadingIndicator v-if="store.isStreaming" />
    <ChatInput />
  </div>
</template>

<script setup lang="ts">
import { useConversationStore } from "../../stores/conversation.js";
import StatusBar from "./StatusBar.vue";
import MessageList from "./MessageList.vue";
import LoadingIndicator from "../common/LoadingIndicator.vue";
import ChatInput from "./ChatInput.vue";

const store = useConversationStore();
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f9fafb;
}

.chat-messages {
  flex: 1;
  overflow: hidden;
}
</style>
