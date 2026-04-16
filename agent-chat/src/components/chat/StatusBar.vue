<template>
  <div class="status-bar">
    <h1 class="session-title">{{ title }}</h1>
    <div v-if="totalTokens > 0" class="token-summary" aria-label="累计 Token 消耗">
      <span class="token-label">累计</span>
      <span class="token-value">{{ totalTokens.toLocaleString() }}</span>
      <span class="token-unit">tokens</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useConversationStore } from "../../stores/conversation.js";

const store = useConversationStore();

const title = computed(() => store.currentSession?.title ?? "新对话");
const totalTokens = computed(() => store.totalTokens);
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: white;
  min-height: 52px;
}

.session-title {
  font-size: 16px;
  font-weight: 600;
  color: #111;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
}

.token-summary {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #888;
}

.token-label {
  color: #aaa;
}

.token-value {
  font-weight: 600;
  color: #666;
  font-variant-numeric: tabular-nums;
}

.token-unit {
  color: #aaa;
}
</style>
