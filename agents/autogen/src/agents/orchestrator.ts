/**
 * OrchestratorAgent — 主调度 Agent
 *
 * 职责：
 *   1. 接收用户请求
 *   2. 通过 LLM tool_use 决策将任务分发给专项 Agent（Researcher / Coder）
 *   3. 汇总各 Agent 的结果，合成最终回答
 *
 * 内置工具：
 *   - delegate_to_researcher：委托 Researcher Agent 进行知识检索
 *   - delegate_to_coder：委托 Coder Agent 生成/审查代码
 *   - datetime：获取当前时间
 *   - http_fetch：抓取 URL 内容
 *   - web_search：DuckDuckGo 网络搜索
 *   - list_agents：列出所有已注册的 Agent
 */
import { BaseAgent, type AgentConfig } from "./base.js";
import { bus, type A2AMessage } from "../a2a/bus.js";
import { runSkillScript } from "../skills/loader.js";
import type { ToolDefinition } from "../llm/types.js";
import type { Skill } from "../skills/loader.js";

/** Orchestrator 可用的工具列表 */
const TOOLS: ToolDefinition[] = [
  {
    name: "delegate_to_researcher",
    description: "将知识检索/事实查询任务委托给 Researcher Agent",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "需要研究的问题" } },
      required: ["query"],
    },
  },
  {
    name: "delegate_to_coder",
    description: "将代码生成/审查任务委托给 Coder Agent",
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string", description: "编码任务描述" },
        language: { type: "string", description: "编程语言，默认 JavaScript" },
        code: { type: "string", description: "待审查的现有代码（可选）" },
      },
      required: ["task"],
    },
  },
  {
    name: "datetime",
    description: "获取当前日期和时间",
    input_schema: {
      type: "object",
      properties: { timezone: { type: "string", description: "IANA 时区，如 Asia/Shanghai" } },
    },
  },
  {
    name: "http_fetch",
    description: "抓取指定 URL 的页面内容（GET 请求）",
    input_schema: {
      type: "object",
      properties: { url: { type: "string", description: "目标 URL" } },
      required: ["url"],
    },
  },
  {
    name: "web_search",
    description: "通过 DuckDuckGo 搜索网络上的最新信息",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "搜索关键词" } },
      required: ["query"],
    },
  },
  {
    name: "run_skill_script",
    description: "执行某个 Skill 的脚本工具（如代码格式化、数据分析等）",
    input_schema: {
      type: "object",
      properties: {
        skillId: { type: "string", description: "Skill 的 ID（目录名）" },
        scriptName: { type: "string", description: "脚本名称（不含扩展名），如 cli、analyze" },
        input: { type: "string", description: "通过 stdin 传入脚本的数据" },
        args: { type: "array", items: { type: "string" }, description: "额外的命令行参数" },
      },
      required: ["skillId", "scriptName"],
    },
  },
  {
    name: "list_agents",
    description: "列出所有已注册的 Agent 及其能力",
    input_schema: { type: "object", properties: {} },
  },
];

export class OrchestratorAgent extends BaseAgent {
  /** 已加载的 Skills 列表（由 server.ts 注入） */
  private loadedSkills: Skill[] = [];

  /**
   * @param overrides 可选的配置覆盖（用于运行时切换 LLM 模型）
   */
  constructor(overrides?: Partial<AgentConfig>) {
    super({
      id: "orchestrator",
      name: "Orchestrator",
      systemPrompt: `你是一个多 Agent AI 系统的主调度器。
你的工作流程：
1. 理解用户的请求
2. 将任务拆解为子任务
3. 将每个子任务委托给最合适的专项 Agent
4. 汇总所有 Agent 的结果，给出清晰、结构化的最终回答

可用的专项 Agent：
- Researcher：负责知识检索、RAG 搜索、事实查询
- Coder：负责代码生成、代码审查和执行

始终通过委托工具调用专项 Agent，而不是直接回答。
将所有 Agent 的回复整合成一个完整、清晰的最终答案。`,
      capabilities: [
        {
          name: "orchestrate",
          description: "调度复杂的多步骤任务",
          inputSchema: { task: { type: "string" } },
        },
      ],
      ...overrides,
    });
  }

  /**
   * 处理用户请求的入口方法
   * 由 server.ts 的 WebSocket 消息处理器调用
   */
  async run(userTask: string): Promise<string> {
    console.log(`\n[Orchestrator] 新任务: "${userTask}"\n`);
    return this.llmCall(userTask, TOOLS);
  }

  /** 注入已加载的 Skills（由 server.ts 在 bootAgents 后调用） */
  setSkills(skills: Skill[]) {
    this.loadedSkills = skills;
  }

  /** 处理来自 A2A 总线的任务消息（当 Orchestrator 被其他 Agent 调用时） */
  protected async handleMessage(msg: A2AMessage): Promise<void> {
    if (msg.type !== "task") return;
    const { task } = msg.payload as { task: string };
    const result = await this.run(task);
    bus.reply(msg, this.config.id, { result });
  }

  /** 执行工具调用 */
  protected async executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    switch (name) {

      // 委托给 Researcher Agent（通过 A2A 总线）
      case "delegate_to_researcher": {
        console.log(`[Orchestrator → Researcher] 查询: "${input.query}"`);
        const result = await bus.request<{ answer?: string; error?: string }>(
          this.config.id,
          "researcher",
          { query: input.query }
        );
        return result.answer ?? result.error ?? "无响应";
      }

      // 委托给 Coder Agent（通过 A2A 总线）
      case "delegate_to_coder": {
        console.log(`[Orchestrator → Coder] 任务: "${input.task}"`);
        const result = await bus.request<{ code?: string; error?: string }>(
          this.config.id,
          "coder",
          { task: input.task, language: input.language, code: input.code }
        );
        return result.code ?? result.error ?? "无响应";
      }

      // 获取当前时间（直接在 Orchestrator 内处理，无需 A2A）
      case "datetime": {
        const tz = (input.timezone as string) ?? "Asia/Shanghai";
        const now = new Date();
        try {
          const fmt = new Intl.DateTimeFormat("zh-CN", {
            timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
          }).format(now);
          return `当前时间 (${tz}): ${fmt}\nUTC: ${now.toUTCString()}`;
        } catch {
          return `UTC: ${now.toUTCString()}`;
        }
      }

      // 抓取 URL 内容
      case "http_fetch": {
        try {
          const res = await fetch(input.url as string, { signal: AbortSignal.timeout(10000) });
          const text = await res.text();
          return `HTTP ${res.status}\n\n${text.slice(0, 3000)}${text.length > 3000 ? "\n…[内容已截断]" : ""}`;
        } catch (err) {
          return `请求失败: ${(err as Error).message}`;
        }
      }

      // DuckDuckGo 网络搜索
      case "web_search": {
        try {
          const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(input.query as string)}&format=json&no_html=1&skip_disambig=1`;
          const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
          const data = await res.json() as {
            AbstractText?: string;
            AbstractURL?: string;
            RelatedTopics?: { Text?: string }[];
          };
          const parts: string[] = [];
          if (data.AbstractText) parts.push(`${data.AbstractText}\n${data.AbstractURL ?? ""}`);
          data.RelatedTopics?.slice(0, 4).filter((t) => t.Text).forEach((t) => parts.push(`- ${t.Text}`));
          return parts.join("\n") || `未找到关于"${input.query}"的结果`;
        } catch (err) {
          return `搜索失败: ${(err as Error).message}`;
        }
      }

      // 列出所有已注册的 Agent
      // 执行 Skill 脚本工具
      case "run_skill_script": {
        const { skillId, scriptName, input: stdin = "", args = [] } = input as {
          skillId: string; scriptName: string; input?: string; args?: string[];
        };
        // 查找对应的 Skill
        const skill = this.loadedSkills.find((s) => s.id === skillId);
        if (!skill) {
          const available = this.loadedSkills.map((s) => s.id).join(", ");
          return `未找到 Skill "${skillId}"。可用的 Skills: ${available || "无"}`;
        }
        // 查找对应的脚本
        const script = skill.scripts.find((s) => s.name === scriptName);
        if (!script) {
          const available = skill.scripts.map((s) => s.name).join(", ");
          return `Skill "${skillId}" 中未找到脚本 "${scriptName}"。可用脚本: ${available || "无"}`;
        }
        console.log(`[Orchestrator] 执行脚本: ${skill.name}/${script.name}${script.ext}`);
        // 如果有 stdin 输入，通过临时文件传递（避免 shell 注入）
        if (stdin) {
          const { writeFile, unlink } = await import("fs/promises");
          const { tmpdir } = await import("os");
          const { join } = await import("path");
          const tmpFile = join(tmpdir(), `skill-input-${Date.now()}.txt`);
          await writeFile(tmpFile, stdin, "utf-8");
          const result = await runSkillScript(script, [...args, "--input-file", tmpFile]);
          await unlink(tmpFile).catch(() => {});
          if (result.exitCode !== 0 && result.stderr) {
            return `脚本执行失败 (exit ${result.exitCode}):\n${result.stderr}`;
          }
          return result.stdout || result.stderr || "(无输出)";
        }
        const result = await runSkillScript(script, args);
        if (result.exitCode !== 0 && result.stderr) {
          return `脚本执行失败 (exit ${result.exitCode}):\n${result.stderr}`;
        }
        return result.stdout || result.stderr || "(无输出)";
      }

      // 列出所有已注册的 Agent
      case "list_agents": {
        const agents = bus.listAgents();
        return agents
          .map((a) => `${a.name} (${a.id}): ${a.capabilities.map((c) => c.name).join(", ")}`)
          .join("\n");
      }

      default:
        return super.executeTool(name, input);
    }
  }
}
