<script setup lang="ts">
import { ref } from "vue";
import { useSettingsStore, type McpServer } from "../stores/settings";

const store = useSettingsStore();
const editing = ref<Partial<McpServer> | null>(null);
const argsStr = ref("");

function startNew() {
  editing.value = { name: "", command: "npx", args: [], enabled: true };
  argsStr.value = "";
}
function startEdit(s: McpServer) {
  editing.value = { ...s };
  argsStr.value = s.args.join(" ");
}
async function save() {
  if (!editing.value?.name) return;
  editing.value.args = argsStr.value.trim().split(/\s+/).filter(Boolean);
  await store.saveMcp(editing.value as McpServer);
  editing.value = null;
}
async function remove(id: string) {
  if (confirm("Remove this MCP server?")) await store.deleteMcp(id);
}
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <span>MCP Servers</span>
      <button class="btn-add" @click="startNew">+ Add</button>
    </div>
    <div class="mcp-list">
      <div v-for="s in store.mcpServers" :key="s.id" class="mcp-item">
        <div class="mcp-dot" :class="{ active: s.enabled }" />
        <div class="mcp-info">
          <div class="mcp-name">{{ s.name }}</div>
          <div class="mcp-cmd">{{ s.command }} {{ s.args.join(" ") }}</div>
        </div>
        <div class="mcp-actions">
          <button class="icon-btn" @click="startEdit(s)">Edit</button>
          <button class="icon-btn danger" @click="remove(s.id)">Del</button>
        </div>
      </div>
    </div>
    <div v-if="editing" class="edit-form">
      <div class="form-title">{{ editing.id ? "Edit Server" : "New MCP Server" }}</div>
      <label>Name <input v-model="editing.name" placeholder="e.g. Filesystem Tools" /></label>
      <label>Command <input v-model="editing.command" placeholder="npx / uvx / node" /></label>
      <label>Args <input v-model="argsStr" placeholder="@modelcontextprotocol/server-filesystem /path" /></label>
      <label class="row-label"><input type="checkbox" v-model="editing.enabled" /> Enabled</label>
      <div class="form-actions">
        <button class="btn-cancel" @click="editing = null">Cancel</button>
        <button class="btn-save" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel { display: flex; flex-direction: column; gap: 12px; }
.panel-header { display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
.btn-add { background: var(--accent); color: white; border: none; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 13px; }
.btn-add:hover { background: var(--accent-hover); }
.mcp-list { display: flex; flex-direction: column; gap: 8px; }
.mcp-item { display: flex; align-items: center; gap: 10px; background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
.mcp-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-dim); flex-shrink: 0; }
.mcp-dot.active { background: var(--success); box-shadow: 0 0 6px var(--success); }
.mcp-info { flex: 1; min-width: 0; }
.mcp-name { font-weight: 500; font-size: 13px; }
.mcp-cmd { font-size: 11px; color: var(--text-dim); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mcp-actions { display: flex; gap: 6px; }
.icon-btn { background: none; border: 1px solid var(--border); border-radius: 4px; cursor: pointer; font-size: 11px; padding: 2px 7px; color: var(--text-muted); }
.icon-btn:hover { color: var(--text); border-color: var(--text-muted); }
.icon-btn.danger:hover { color: var(--danger); border-color: var(--danger); }
.edit-form { background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.form-title { font-weight: 600; font-size: 13px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); }
.row-label { flex-direction: row; align-items: center; gap: 8px; }
input { background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; color: var(--text); font-family: var(--font); font-size: 13px; outline: none; }
input:focus { border-color: var(--accent); }
.form-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn-cancel { background: var(--bg2); border: 1px solid var(--border); color: var(--text-muted); border-radius: 6px; padding: 5px 12px; cursor: pointer; font-size: 13px; }
.btn-save { background: var(--accent); border: none; color: white; border-radius: 6px; padding: 5px 12px; cursor: pointer; font-size: 13px; }
.btn-save:hover { background: var(--accent-hover); }
</style>