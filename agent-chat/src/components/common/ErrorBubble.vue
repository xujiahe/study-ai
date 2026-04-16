<template>
  <div class="error-bubble" role="alert">
    <span class="error-icon">⚠️</span>
    <span class="error-message">{{ message }}</span>
    <button v-if="showRetry" class="retry-btn" @click="$emit('retry')">
      重试
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message: string;
  showRetry?: boolean;
}>();

defineEmits<{
  retry: [];
}>();
</script>

<style scoped>
.error-bubble {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 14px;
  color: #dc2626;
  max-width: 100%;
}

.error-icon {
  flex-shrink: 0;
}

.error-message {
  flex: 1;
  line-height: 1.4;
}

.retry-btn {
  flex-shrink: 0;
  padding: 4px 10px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: background 0.15s;
}

.retry-btn:hover {
  background: #b91c1c;
}
</style>
