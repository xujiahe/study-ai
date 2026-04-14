import { defineStore } from "pinia";
import { ref, computed } from "vue";

export interface Skill {
  id: string;
  name: string;
  version?: string;
  description: string;
  systemPrompt: string;
  enabled: boolean;
  path?: string; // skill 目录路径（文件系统加载的 skill 有此字段）
}

export interface McpServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
}

export const useSettingsStore = defineStore("settings", () => {
  const skills = ref<Skill[]>([]);
  const mcpServers = ref<McpServer[]>([]);
  const selectedProvider = ref("zhipu");
  const selectedModel = ref("glm-5.1");

  const modelOptions = [
    {
      provider: "zhipu",
      models: ["glm-5.1", "glm-5", "glm-4.5-flash", "glm-4.5v"],
    },
    {
      provider: "anthropic",
      models: ["claude-opus-4-5", "claude-3-5-haiku-20241022"],
    },
    {
      provider: "openai",
      models: ["gpt-4o", "gpt-4o-mini"],
    },
    {
      provider: "ollama",
      models: ["llama3.2", "qwen2.5-coder", "deepseek-r1"],
    },
  ];

  const currentModelLabel = computed(() => `${selectedProvider.value} / ${selectedModel.value}`);

  async function fetchAll() {
    try {
      const [s, m] = await Promise.all([
        fetch("/api/skills").then((r) => r.json()),
        fetch("/api/mcp").then((r) => r.json()),
      ]);
      skills.value = s;
      mcpServers.value = m;
    } catch {
      // backend not ready yet — ignore
    }
  }

  async function setModel(provider: string, model: string) {
    selectedProvider.value = provider;
    selectedModel.value = model;
    await fetch("/api/settings/model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model }),
    }).catch(() => {});
  }

  async function saveSkill(skill: Skill & { name: string }) {
    const res = await fetch(`/api/skills${skill.id ? `/${skill.id}` : ""}`, {
      method: skill.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(skill),
    });
    const saved = await res.json();
    const idx = skills.value.findIndex((s) => s.id === saved.id);
    if (idx >= 0) skills.value[idx] = saved;
    else skills.value.push(saved);
  }

  async function deleteSkill(id: string) {
    await fetch(`/api/skills/${id}`, { method: "DELETE" });
    skills.value = skills.value.filter((s) => s.id !== id);
  }

  async function toggleSkill(id: string) {
    // 使用专用 toggle 接口，避免覆盖 systemPrompt 等字段
    const res = await fetch(`/api/skills/${id}/toggle`, { method: "PATCH" });
    const updated = await res.json();
    const idx = skills.value.findIndex((s) => s.id === id);
    if (idx >= 0) skills.value[idx] = updated;
  }

  async function saveMcp(server: McpServer & { name: string }) {
    const res = await fetch(`/api/mcp${server.id ? `/${server.id}` : ""}`, {
      method: server.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(server),
    });
    const saved = await res.json();
    const idx = mcpServers.value.findIndex((s) => s.id === saved.id);
    if (idx >= 0) mcpServers.value[idx] = saved;
    else mcpServers.value.push(saved);
  }

  async function deleteMcp(id: string) {
    await fetch(`/api/mcp/${id}`, { method: "DELETE" });
    mcpServers.value = mcpServers.value.filter((s) => s.id !== id);
  }

  return {
    skills, mcpServers, selectedProvider, selectedModel, modelOptions, currentModelLabel,
    fetchAll, setModel, saveSkill, deleteSkill, toggleSkill, saveMcp, deleteMcp,
  };
});
