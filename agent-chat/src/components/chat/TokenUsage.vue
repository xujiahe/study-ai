<template>
  <!-- 仅在 usage 有值时渲染（需求 6.3）-->
  <div v-if="usage" class="token-usage" aria-label="Token 消耗统计">
    <span class="token-item" title="输入 tokens">↑ {{ usage.prompt_tokens }}</span>
    <span class="separator">·</span>
    <span class="token-item" title="输出 tokens">↓ {{ usage.completion_tokens }}</span>
    <span class="separator">·</span>
    <span class="token-total" title="总 tokens">共 {{ usage.total_tokens }}</span>
  </div>
</template>

<script setup lang="ts">
import type { TokenUsage } from "../../types/index.js";

defineProps<{
  usage: TokenUsage | null;
}>();
</script>

<style scoped>
.token-usage {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

.token-item {
  font-variant-numeric: tabular-nums;
}

.token-total {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: #777;
}

.separator {
  color: #ccc;
}
</style>
