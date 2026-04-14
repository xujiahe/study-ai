<script setup lang="ts">
import { ref } from "vue";
import { useSettingsStore, type Skill } from "../stores/settings";

const store = useSettingsStore();
const editing = ref<Partial<Skill> | null>(null);

function startNew() {
  editing.value = { name: "", description: "", systemPrompt: "", enabled: true };
}
function startEdit(skill: Skill) {
  editing.value = { ...skill };
}
async function save() {
  if (!editing.value?.name) return;
  await store.saveSkill(editing.value as Skill);
  editing.value = null;
}
async function remove(id: string) {
  if (confirm("Delete this skill?")) await store.deleteSkill(id);
}
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <span>Skills</span>
      <button class="btn-add" @click="startNew">+ New</button>
    </div>
    <div v-if="store.skills.length === 0 && !editing" class="empty">
      No skills yet. Add files to the skills/ folder or click New.
    </div>
    <div class="skill-list">
      <div v-for="s in store.skills" :key="s.id" class="skill-item">
        <div class="skill-info">
          <div class="skill-name-row">
            <span class="skill-name">{{ s.name }}</span>
            <span v-if="s.version" class="skill-version">v{{ s.version }}</span>
          </div>
          <div class="skill-desc">{{ s.description }}</div>
        </div>
        <div class="skill-actions">
          <label class="toggle">
            <input type="checkbox" :checked="s.enabled" @change="store.toggleSkill(s.id)" />
            <span class="slider" />
          </label>
          <button class="icon-btn" @click="startEdit(s)">Edit</button>
          <button class="icon-btn danger" @click="remove(s.id)">Del</button>
        </div>
      </div>
    </div>
    <div v-if="editing" class="edit-form">
      <div class="form-title">{{ editing.id ? "Edit Skill" : "New Skill" }}</div>
      <label>Name <input v-model="editing.name" placeholder="e.g. TypeScript Expert" /></label>
      <label>Description <input v-model="editing.description" placeholder="Short description" /></label>
      <label>System Prompt
        <textarea v-model="editing.systemPrompt" rows="5" placeholder="Instructions for every conversation..." />
      </label>
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
.empty { color: var(--text-dim); font-size: 13px; text-align: center; padding: 16px 0; }
.skill-list { display: flex; flex-direction: column; gap: 8px; }
.skill-item { display: flex; justify-content: space-between; align-items: center; background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; gap: 8px; }
.skill-info { flex: 1; min-width: 0; }
.skill-name-row { display: flex; align-items: center; gap: 6px; }
.skill-name { font-weight: 500; font-size: 13px; }
.skill-version { font-size: 10px; color: var(--text-dim); background: var(--bg2); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; }
.skill-desc { font-size: 12px; color: var(--text-dim); margin-top: 2px; }
.skill-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.icon-btn { background: none; border: 1px solid var(--border); border-radius: 4px; cursor: pointer; font-size: 11px; padding: 2px 7px; color: var(--text-muted); }
.icon-btn:hover { color: var(--text); border-color: var(--text-muted); }
.icon-btn.danger:hover { color: var(--danger); border-color: var(--danger); }
.toggle { position: relative; display: inline-block; width: 36px; height: 20px; }
.toggle input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; inset: 0; background: var(--border); border-radius: 20px; cursor: pointer; transition: .2s; }
.slider::before { content: ""; position: absolute; width: 14px; height: 14px; left: 3px; top: 3px; background: white; border-radius: 50%; transition: .2s; }
.toggle input:checked + .slider { background: var(--accent); }
.toggle input:checked + .slider::before { transform: translateX(16px); }
.edit-form { background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.form-title { font-weight: 600; font-size: 13px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); }
input, textarea { background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; color: var(--text); font-family: var(--font); font-size: 13px; outline: none; resize: vertical; }
input:focus, textarea:focus { border-color: var(--accent); }
.form-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn-cancel { background: var(--bg2); border: 1px solid var(--border); color: var(--text-muted); border-radius: 6px; padding: 5px 12px; cursor: pointer; font-size: 13px; }
.btn-save { background: var(--accent); border: none; color: white; border-radius: 6px; padding: 5px 12px; cursor: pointer; font-size: 13px; }
.btn-save:hover { background: var(--accent-hover); }
</style>