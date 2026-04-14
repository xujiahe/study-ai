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
  await store.saveSkill(editing.value as Skill & { name: string });
  editing.value = null;
}

async function remove(id: string) {
  if (confirm(`删除 Skill "${id}"？`)) await store.deleteSkill(id);
}
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <span>Skills</span>
      <button class="btn-add" @click="startNew">+ 新建</button>
    </div>

    <div v-if="store.skills.length === 0 && !editing" class="empty">
      暂无 Skills。将 skill 目录放入 <code>skills/</code> 文件夹，或点击「新建」。
    </div>

    <div class="skill-list">
      <div v-for="s in store.skills" :key="s.id" class="skill-item">
        <div class="skill-info">
          <div class="skill-name-row">
            <span class="skill-name">{{ s.name }}</span>
            <span v-if="s.version" class="skill-version">v{{ s.version }}</span>
            <!-- 文件系统加载的 skill 显示目录标识 -->
            <span v-if="s.path" class="skill-fs-badge" title="从 skills/ 目录加载">📁</span>
          </div>
          <div class="skill-desc">{{ s.description }}</div>
        </div>
        <div class="skill-actions">
          <label class="toggle" :title="s.enabled ? '点击禁用' : '点击启用'">
            <input type="checkbox" :checked="s.enabled" @change="store.toggleSkill(s.id)" />
            <span class="slider" />
          </label>
          <button class="icon-btn" @click="startEdit(s)" title="编辑">✏️</button>
          <button class="icon-btn danger" @click="remove(s.id)" title="删除">🗑️</button>
        </div>
      </div>
    </div>

    <!-- 编辑/新建表单 -->
    <div v-if="editing" class="edit-form">
      <div class="form-title">{{ editing.id ? "编辑 Skill" : "新建 Skill" }}</div>
      <label>名称
        <input v-model="editing.name" placeholder="如：TypeScript 专家" />
      </label>
      <label>描述
        <input v-model="editing.description" placeholder="简短描述" />
      </label>
      <label>System Prompt
        <textarea v-model="editing.systemPrompt" rows="5"
          placeholder="注入到每次对话的指令…" />
      </label>
      <div class="form-actions">
        <button class="btn-cancel" @click="editing = null">取消</button>
        <button class="btn-save" @click="save">保存</button>
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
.empty code { background: var(--bg3); padding: 1px 5px; border-radius: 4px; font-size: 12px; }

.skill-list { display: flex; flex-direction: column; gap: 8px; }
.skill-item { display: flex; justify-content: space-between; align-items: center; background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; gap: 8px; }
.skill-info { flex: 1; min-width: 0; }
.skill-name-row { display: flex; align-items: center; gap: 6px; }
.skill-name { font-weight: 500; font-size: 13px; }
.skill-version { font-size: 10px; color: var(--text-dim); background: var(--bg2); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; }
.skill-fs-badge { font-size: 12px; opacity: .7; cursor: default; }
.skill-desc { font-size: 12px; color: var(--text-dim); margin-top: 2px; }
.skill-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.icon-btn { background: none; border: none; cursor: pointer; font-size: 14px; opacity: .7; }
.icon-btn:hover { opacity: 1; }
.icon-btn.danger:hover { filter: brightness(1.5); }

/* Toggle 开关 */
.toggle { position: relative; display: inline-block; width: 36px; height: 20px; }
.toggle input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; inset: 0; background: var(--border); border-radius: 20px; cursor: pointer; transition: .2s; }
.slider::before { content: ""; position: absolute; width: 14px; height: 14px; left: 3px; top: 3px; background: white; border-radius: 50%; transition: .2s; }
.toggle input:checked + .slider { background: var(--accent); }
.toggle input:checked + .slider::before { transform: translateX(16px); }

/* 编辑表单 */
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
