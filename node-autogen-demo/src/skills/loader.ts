/**
 * Skills 加载器
 *
 * 扫描 skills/ 目录，读取每个 skill 的 SKILL.md，
 * 并发现 scripts/ 目录下的可执行脚本，注册为可调用工具
 *
 * Skill 目录结构：
 *   skills/
 *   └── skill-name/
 *       ├── SKILL.md          # 必需：front-matter 元数据 + system prompt
 *       ├── reference.md      # 可选：追加到 system prompt 的参考资料
 *       ├── resources/        # 可选：静态资源文件
 *       └── scripts/          # 可选：可执行脚本（Agent 可通过工具调用）
 *           ├── main.py       # Python 脚本
 *           ├── main.js       # Node.js 脚本
 *           └── cli.ts        # TypeScript CLI
 *
 * SKILL.md front-matter 字段：
 *   name: string          显示名称
 *   version: string       版本号
 *   description: string   简短描述
 *   enabled: true|false   是否默认启用
 *   cli: string           (可选) 默认 CLI 入口，如 "scripts/cli.ts"
 */
import { readdir, readFile, stat, access, constants } from "fs/promises";
import { join, extname } from "path";

/** 单个脚本的描述 */
export interface SkillScript {
  name: string;      // 脚本文件名（不含扩展名），作为工具名
  file: string;      // 脚本文件的绝对路径
  ext: string;       // 扩展名：.py | .js | .ts | .sh
  runtime: string;   // 推断的运行时：python | node | tsx | bash
  description: string; // 从脚本首行注释提取的描述
}

/** Skill 完整数据结构 */
export interface Skill {
  id: string;           // 目录名，唯一 ID
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  systemPrompt: string; // SKILL.md 正文 + reference.md（如有）
  path: string;         // skill 目录绝对路径
  scripts: SkillScript[]; // scripts/ 目录下发现的脚本列表
  cli?: string;         // front-matter 中指定的默认 CLI 入口路径
}

// 扩展名 → 运行时映射
const RUNTIME_MAP: Record<string, string> = {
  ".py":  "python",
  ".js":  "node",
  ".ts":  "tsx",
  ".sh":  "bash",
  ".mjs": "node",
};

// 支持的脚本扩展名
const SCRIPT_EXTS = new Set(Object.keys(RUNTIME_MAP));

/**
 * 解析 Markdown front-matter（简单 YAML key: value 格式）
 */
function parseFrontMatter(content: string): { meta: Record<string, string>; body: string } {
  const meta: Record<string, string> = {};
  if (!content.startsWith("---")) return { meta, body: content };

  const end = content.indexOf("\n---", 3);
  if (end === -1) return { meta, body: content };

  for (const line of content.slice(3, end).trim().split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    meta[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
  }

  return { meta, body: content.slice(end + 4).trim() };
}

/**
 * 从脚本文件首行注释提取描述
 * 支持 # 注释（Python/Shell）和 // 注释（JS/TS）
 */
async function extractScriptDescription(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath, "utf-8");
    const firstLine = content.split("\n")[0].trim();
    // Python/Shell: # Description
    if (firstLine.startsWith("#") && !firstLine.startsWith("#!")) {
      return firstLine.slice(1).trim();
    }
    // JS/TS: // Description
    if (firstLine.startsWith("//")) {
      return firstLine.slice(2).trim();
    }
  } catch { /* 忽略读取失败 */ }
  return "";
}

/**
 * 扫描 scripts/ 目录，返回所有可执行脚本的描述列表
 */
async function loadScripts(skillPath: string): Promise<SkillScript[]> {
  const scriptsDir = join(skillPath, "scripts");
  const scripts: SkillScript[] = [];

  let files: string[];
  try {
    files = await readdir(scriptsDir);
  } catch {
    return scripts; // scripts/ 目录不存在
  }

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (!SCRIPT_EXTS.has(ext)) continue;

    const filePath = join(scriptsDir, file);
    const info = await stat(filePath).catch(() => null);
    if (!info?.isFile()) continue;

    const name = file.slice(0, -ext.length); // 去掉扩展名
    const runtime = RUNTIME_MAP[ext];
    const description = await extractScriptDescription(filePath);

    scripts.push({ name, file: filePath, ext, runtime, description });
  }

  return scripts;
}

/**
 * 加载指定目录下的所有 Skills
 */
export async function loadSkills(skillsDir: string): Promise<Skill[]> {
  const skills: Skill[] = [];

  let entries: string[];
  try {
    entries = await readdir(skillsDir);
  } catch {
    return skills;
  }

  for (const entry of entries) {
    const skillPath = join(skillsDir, entry);
    const info = await stat(skillPath).catch(() => null);
    if (!info?.isDirectory()) continue;

    // 读取 SKILL.md（必需）
    let skillMdContent: string;
    try {
      skillMdContent = await readFile(join(skillPath, "SKILL.md"), "utf-8");
    } catch {
      console.warn(`[Skills] 跳过 ${entry}：缺少 SKILL.md`);
      continue;
    }

    const { meta, body } = parseFrontMatter(skillMdContent);

    // 读取 reference.md（可选）
    let referenceContent = "";
    try {
      referenceContent = await readFile(join(skillPath, "reference.md"), "utf-8");
    } catch { /* 无 reference.md */ }

    const systemPrompt = referenceContent
      ? `${body}\n\n---\n\n## 参考资料\n\n${referenceContent}`
      : body;

    // 扫描 scripts/ 目录
    const scripts = await loadScripts(skillPath);

    // 解析 cli 字段（相对于 skill 目录的路径）
    const cliRelative = meta.cli;
    const cli = cliRelative ? join(skillPath, cliRelative) : undefined;

    // 验证 cli 文件是否存在
    if (cli) {
      await access(cli, constants.F_OK).catch(() => {
        console.warn(`[Skills] ${entry}: cli 文件不存在: ${cliRelative}`);
      });
    }

    const skill: Skill = {
      id: entry,
      name: meta.name ?? entry,
      version: meta.version ?? "1.0.0",
      description: meta.description ?? "",
      enabled: meta.enabled === "true",
      systemPrompt,
      path: skillPath,
      scripts,
      cli,
    };

    const scriptNames = scripts.map((s) => s.name).join(", ");
    console.log(
      `[Skills] 已加载: ${skill.name} v${skill.version}` +
      (scripts.length ? ` | 脚本: [${scriptNames}]` : "") +
      (cli ? ` | CLI: ${cliRelative}` : "")
    );

    skills.push(skill);
  }

  return skills;
}

/**
 * 执行 skill 脚本，返回输出字符串
 * @param script  SkillScript 对象
 * @param args    传递给脚本的命令行参数
 * @param timeout 超时毫秒数，默认 30s
 */
export async function runSkillScript(
  script: SkillScript,
  args: string[] = [],
  timeout = 30_000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);

  // 根据运行时选择执行命令
  const cmd = script.runtime === "tsx" ? "npx" : script.runtime;
  const cmdArgs = script.runtime === "tsx"
    ? ["tsx", script.file, ...args]
    : [script.file, ...args];

  try {
    const { stdout, stderr } = await execFileAsync(cmd, cmdArgs, {
      timeout,
      maxBuffer: 1024 * 1024, // 1MB 输出上限
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number; message?: string };
    return {
      stdout: e.stdout?.trim() ?? "",
      stderr: e.stderr?.trim() ?? e.message ?? "Unknown error",
      exitCode: e.code ?? 1,
    };
  }
}
