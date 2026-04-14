/**
 * Simple in-memory store for skills and MCP configs (swap with SQLite/JSON file for persistence)
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Skill, McpServerConfig } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const SKILLS_FILE = join(DATA_DIR, "skills.json");
const MCP_FILE = join(DATA_DIR, "mcp-servers.json");

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readJSON<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJSON(path: string, data: unknown) {
  await ensureDir();
  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}

// ── Skills ────────────────────────────────────────────────────────────────────
export async function getSkills(): Promise<Skill[]> {
  return readJSON<Skill[]>(SKILLS_FILE, []);
}

export async function saveSkill(skill: Skill): Promise<void> {
  const skills = await getSkills();
  const idx = skills.findIndex((s) => s.id === skill.id);
  if (idx >= 0) skills[idx] = skill;
  else skills.push(skill);
  await writeJSON(SKILLS_FILE, skills);
}

export async function deleteSkill(id: string): Promise<void> {
  const skills = (await getSkills()).filter((s) => s.id !== id);
  await writeJSON(SKILLS_FILE, skills);
}

// ── MCP Servers ───────────────────────────────────────────────────────────────
export async function getMcpServers(): Promise<McpServerConfig[]> {
  return readJSON<McpServerConfig[]>(MCP_FILE, [
    {
      id: "builtin",
      name: "Built-in Tools",
      command: "tsx",
      args: ["src/mcp/server.ts"],
      enabled: true,
    },
  ]);
}

export async function saveMcpServer(server: McpServerConfig): Promise<void> {
  const servers = await getMcpServers();
  const idx = servers.findIndex((s) => s.id === server.id);
  if (idx >= 0) servers[idx] = server;
  else servers.push(server);
  await writeJSON(MCP_FILE, servers);
}

export async function deleteMcpServer(id: string): Promise<void> {
  const servers = (await getMcpServers()).filter((s) => s.id !== id);
  await writeJSON(MCP_FILE, servers);
}
