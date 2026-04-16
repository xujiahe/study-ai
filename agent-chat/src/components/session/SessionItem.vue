<template>
  <div
    class="session-item"
    :class="{ active: isActive }"
    @click="$emit('click')"
    role="button"
    :aria-selected="isActive"
    tabindex="0"
    @keydown.enter="$emit('click')"
  >
    <div class="session-info">
      <span class="session-title" :title="session.title">{{ session.title }}</span>
      <span class="session-time">{{ formatTime(session.created_at) }}</span>
    </div>
    <button
      class="delete-btn"
      @click.stop="showConfirm = true"
      aria-label="删除对话"
      title="删除对话"
    >
      ×
    </button>

    <DeleteConfirm
      v-if="showConfirm"
      :title="session.title"
      @confirm="handleConfirmDelete"
      @cancel="showConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { SessionResponse } from "../../types/index.js";
import DeleteConfirm from "./DeleteConfirm.vue";

const props = defineProps<{
  session: SessionResponse;
  isActive: boolean;
}>();

const emit = defineEmits<{
  click: [];
  delete: [];
}>();

const showConfirm = ref(false);

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (days === 1) {
    return "昨天";
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    });
  }
}

function handleConfirmDelete() {
  showConfirm.value = false;
  emit("delete");
}
</script>

<style scoped>
.session-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
  gap: 8px;
}

.session-item:hover {
  background: #f0f0f0;
}

.session-item.active {
  background: #ede9fe;
}

.session-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.session-title {
  font-size: 14px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.session-item.active .session-title {
  color: #4f46e5;
}

.session-time {
  font-size: 11px;
  color: #999;
}

.delete-btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  border-radius: 4px;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  padding: 0;
}

.session-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: #fee2e2;
  color: #ef4444;
}
</style>
