<template>
  <div class="message-item" :class="[`role-${message.role}`]">
    <!-- 用户消息：纯文本，右对齐 -->
    <div v-if="message.role === 'user'" class="bubble user-bubble">
      <p class="user-content">{{ message.content }}</p>
    </div>

    <!-- assistant 消息：Markdown 渲染，左对齐 -->
    <div v-else-if="message.role === 'assistant'" class="bubble assistant-bubble">
      <div
        class="markdown-content"
        v-html="renderedContent"
        @click="handleCopyClick"
      />
      <TokenUsage :usage="tokenUsage" />
    </div>

    <!-- system 消息（摘要等）：居中小字 -->
    <div v-else class="system-message">
      <span>{{ message.content }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { MessageResponse } from "../../types/index.js";
import type { TokenUsage } from "../../types/index.js";
import { useMarkdown } from "../../composables/useMarkdown.js";
import TokenUsageComp from "./TokenUsage.vue";

const props = defineProps<{
  message: MessageResponse;
}>();

const { renderMarkdown } = useMarkdown();

const renderedContent = computed(() => {
  if (props.message.role === "assistant") {
    return renderMarkdown(props.message.content);
  }
  return props.message.content;
});

const tokenUsage = computed<TokenUsage | null>(() => {
  if (
    props.message.role === "assistant" &&
    props.message.total_tokens !== null
  ) {
    return {
      prompt_tokens: props.message.prompt_tokens ?? 0,
      completion_tokens: props.message.completion_tokens ?? 0,
      total_tokens: props.message.total_tokens,
    };
  }
  return null;
});

// 复制按钮处理（需求 5.4、5.5）
const copyingBtn = ref<HTMLButtonElement | null>(null);

function handleCopyClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const btn = target.closest<HTMLButtonElement>(".copy-btn");
  if (!btn) return;

  const code = btn.dataset["copy"] ?? "";

  navigator.clipboard
    .writeText(code)
    .then(() => {
      const originalText = btn.textContent;
      btn.textContent = "已复制";
      btn.disabled = true;
      copyingBtn.value = btn;

      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
        copyingBtn.value = null;
      }, 2000);
    })
    .catch((err) => {
      console.error("[MessageItem] 复制失败:", err);
    });
}
</script>

<!-- 使用 TokenUsage 组件 -->
<script lang="ts">
// 注册组件别名
export default {
  components: {
    TokenUsage: TokenUsageComp,
  },
};
</script>

<style scoped>
.message-item {
  display: flex;
  margin-bottom: 16px;
}

.role-user {
  justify-content: flex-end;
}

.role-assistant {
  justify-content: flex-start;
}

.role-system {
  justify-content: center;
}

.bubble {
  max-width: 75%;
  border-radius: 12px;
  padding: 12px 16px;
  word-break: break-word;
}

.user-bubble {
  background: #4f46e5;
  color: white;
  border-bottom-right-radius: 4px;
}

.user-content {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.assistant-bubble {
  background: white;
  border: 1px solid #e5e7eb;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.system-message {
  font-size: 12px;
  color: #999;
  background: #f9f9f9;
  padding: 4px 12px;
  border-radius: 12px;
  border: 1px solid #eee;
}

/* Markdown 内容样式（非 scoped，需要穿透） */
</style>

<style>
/* 全局 Markdown 样式（需要穿透 scoped） */
.markdown-content {
  font-size: 14px;
  line-height: 1.7;
  color: #333;
}

.markdown-content p {
  margin: 0 0 8px;
}

.markdown-content p:last-child {
  margin-bottom: 0;
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4 {
  margin: 16px 0 8px;
  font-weight: 600;
  color: #111;
}

.markdown-content h1 { font-size: 20px; }
.markdown-content h2 { font-size: 18px; }
.markdown-content h3 { font-size: 16px; }

.markdown-content ul,
.markdown-content ol {
  margin: 8px 0;
  padding-left: 20px;
}

.markdown-content li {
  margin-bottom: 4px;
}

.markdown-content blockquote {
  border-left: 3px solid #4f46e5;
  margin: 8px 0;
  padding: 4px 12px;
  color: #666;
  background: #f8f7ff;
}

.markdown-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
  font-size: 13px;
}

.markdown-content th,
.markdown-content td {
  border: 1px solid #e0e0e0;
  padding: 6px 10px;
  text-align: left;
}

.markdown-content th {
  background: #f5f5f5;
  font-weight: 600;
}

.markdown-content tr:nth-child(even) td {
  background: #fafafa;
}

/* 代码块样式 */
.code-block {
  margin: 8px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e0e0e0;
}

.code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.code-lang {
  font-size: 12px;
  color: #666;
  font-family: monospace;
}

.copy-btn {
  padding: 2px 8px;
  font-size: 12px;
  background: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  cursor: pointer;
  color: #555;
  transition: background 0.15s;
}

.copy-btn:hover {
  background: #f0f0f0;
}

.copy-btn:disabled {
  background: #e8f5e9;
  color: #4caf50;
  border-color: #a5d6a7;
}

.code-block pre {
  margin: 0;
  padding: 12px;
  overflow-x: auto;
  background: #1e1e1e;
}

.code-block code {
  font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
}

/* 行内代码 */
.markdown-content code:not(.hljs) {
  background: #f0f0f0;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 13px;
  color: #e53e3e;
}
</style>
