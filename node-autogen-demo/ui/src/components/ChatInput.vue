<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits<{ send: [text: string] }>();
const props = defineProps<{ disabled: boolean }>();

const text = ref("");

function submit() {
  const t = text.value.trim();
  if (!t || props.disabled) return;
  emit("send", t);
  text.value = "";
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}
</script>

<template>
  <div class="input-bar">
    <textarea
      v-model="text"
      :disabled="disabled"
      placeholder="Message the agent… (Enter to send, Shift+Enter for newline)"
      rows="1"
      @keydown="onKeydown"
      @input="(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 160) + 'px'; }"
    />
    <button :disabled="disabled || !text.trim()" @click="submit">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.input-bar {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
  transition: border-color .2s;
}
.input-bar:focus-within { border-color: var(--accent); }

textarea {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  resize: none;
  line-height: 1.5;
  min-height: 24px;
}
textarea::placeholder { color: var(--text-dim); }
textarea:disabled { opacity: .5; }

button {
  background: var(--accent);
  border: none;
  border-radius: 8px;
  color: white;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background .2s, opacity .2s;
}
button:hover:not(:disabled) { background: var(--accent-hover); }
button:disabled { opacity: .4; cursor: not-allowed; }
</style>
