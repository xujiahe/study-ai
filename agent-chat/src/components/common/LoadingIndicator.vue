<template>
  <div class="loading-indicator" role="status" aria-live="polite">
    <span class="dot" />
    <span class="dot" />
    <span class="dot" />
    <span class="loading-text">正在生成...</span>
  </div>
</template>

<style scoped>
.loading-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  color: #666;
  font-size: 13px;
}

.dot {
  width: 6px;
  height: 6px;
  background: #4f46e5;
  border-radius: 50%;
  animation: bounce 1.2s infinite ease-in-out;
}

.dot:nth-child(1) { animation-delay: 0s; }
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

.loading-text {
  margin-left: 4px;
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
</style>
