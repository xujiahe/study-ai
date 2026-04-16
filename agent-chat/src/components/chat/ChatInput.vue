<template>
  <div class="chat-input-area">
    <!-- 错误提示 -->
    <ErrorBubble
      v-if="store.error"
      :message="store.error"
      :show-retry="!!lastContent"
      @retry="handleRetry"
      class="input-error"
    />

    <div class="input-wrapper">
      <textarea
        ref="textareaRef"
        v-model="inputContent"
        class="input-textarea"
        :class="{ 'over-limit': isOverLimit }"
        placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
        :disabled="store.isStreaming"
        rows="1"
        @keydown.enter.exact.prevent="handleSend"
        @input="autoResize"
        aria-label="消息输入框"
        :aria-invalid="isOverLimit"
      />

      <div class="input-footer">
        <span
          class="char-count"
          :class="{ warning: isOverLimit }"
          aria-live="polite"
        >
          {{ inputContent.length }}/10000
        </span>

        <!-- 停止生成按钮（流式响应进行中）-->
        <button
          v-if="store.isStreaming"
          class="stop-btn"
          @click="handleStop"
          aria-label="停止生成"
        >
          ⏹ 停止生成
        </button>

        <!-- 发送按钮 -->
        <button
          v-else
          class="send-btn"
          @click="handleSend"
          :disabled="!canSend"
          aria-label="发送消息"
        >
          发送
        </button>
      </div>
    </div>

    <!-- 超限警告 -->
    <p v-if="isOverLimit" class="limit-warning" role="alert">
      消息内容不能超过 10000 个字符
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { useConversationStore } from "../../stores/conversation.js";
import ErrorBubble from "../common/ErrorBubble.vue";

const store = useConversationStore();
const inputContent = ref("");
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const lastContent = ref("");

const MAX_LENGTH = 10000;

const isOverLimit = computed(() => inputContent.value.length > MAX_LENGTH);

const canSend = computed(
  () =>
    inputContent.value.trim().length > 0 &&
    !isOverLimit.value &&
    !store.isStreaming
);

function autoResize() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
}

async function handleSend() {
  if (!canSend.value) return;

  const content = inputContent.value.trim();
  lastContent.value = content;
  inputContent.value = "";
  store.clearError();

  await nextTick();
  autoResize();

  await store.sendMessage(content);
}

function handleStop() {
  store.stopStreaming();
}

async function handleRetry() {
  if (!lastContent.value) return;
  store.clearError();
  await store.sendMessage(lastContent.value);
}
</script>

<style scoped>
.chat-input-area {
  padding: 12px 24px 16px;
  background: white;
  border-top: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-error {
  margin-bottom: 4px;
}

.input-wrapper {
  border: 1px solid #d1d5db;
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.15s;
  background: white;
}

.input-wrapper:focus-within {
  border-color: #4f46e5;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
}

.input-textarea {
  width: 100%;
  padding: 12px 14px 4px;
  border: none;
  outline: none;
  resize: none;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  background: transparent;
  font-family: inherit;
  min-height: 44px;
  max-height: 200px;
  overflow-y: auto;
  box-sizing: border-box;
}

.input-textarea::placeholder {
  color: #aaa;
}

.input-textarea:disabled {
  background: #fafafa;
  color: #999;
}

.input-textarea.over-limit {
  color: #dc2626;
}

.input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px 8px;
}

.char-count {
  font-size: 12px;
  color: #aaa;
}

.char-count.warning {
  color: #dc2626;
  font-weight: 500;
}

.send-btn,
.stop-btn {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
}

.send-btn {
  background: #4f46e5;
  color: white;
}

.send-btn:hover:not(:disabled) {
  background: #4338ca;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stop-btn {
  background: #f3f4f6;
  color: #555;
  border: 1px solid #d1d5db;
}

.stop-btn:hover {
  background: #e5e7eb;
}

.limit-warning {
  font-size: 12px;
  color: #dc2626;
  margin: 0;
}
</style>
