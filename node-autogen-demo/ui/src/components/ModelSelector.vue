<script setup lang="ts">
import { ref } from "vue";
import { useSettingsStore } from "../stores/settings";

const store = useSettingsStore();
const open = ref(false);

function select(provider: string, model: string) {
  store.setModel(provider, model);
  open.value = false;
}
</script>

<template>
  <div class="model-selector">
    <button class="trigger" @click="open = !open">
      <span class="dot" />
      {{ store.currentModelLabel }}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <div v-if="open" class="dropdown">
      <div v-for="group in store.modelOptions" :key="group.provider" class="group">
        <div class="group-label">{{ group.provider }}</div>
        <button
          v-for="m in group.models"
          :key="m"
          class="model-btn"
          :class="{ active: store.selectedProvider === group.provider && store.selectedModel === m }"
          @click="select(group.provider, m)"
        >
          {{ m }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.model-selector { position: relative; }

.trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 10px;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.trigger:hover { border-color: var(--accent); }

.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--success); }

.dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px;
  min-width: 200px;
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0,0,0,.4);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-label { font-size: 11px; color: var(--text-dim); padding: 4px 6px 2px; text-transform: uppercase; letter-spacing: .05em; }

.model-btn {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  color: var(--text);
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.model-btn:hover { background: var(--bg3); }
.model-btn.active { background: var(--accent); color: white; }
</style>
