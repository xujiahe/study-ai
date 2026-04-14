/**
 * CoderAgent — 代码生成专项 Agent
 *
 * 职责：
 *   接收来自 Orchestrator 的编码任务，生成干净、高效、有注释的代码，
 *   并在沙箱中自测后返回结果
 *
 * 工具：
 *   - run_code：在沙箱中执行 JavaScript 代码（验证可运行性）
 *   - calculate：数学表达式求值
 *   - read_file：读取 workspace/ 目录下的文件
 *   - write_file：将生成的代码写入 workspace/ 目录
 */
import { BaseAgent } from "./base.js";
import { bus, type A2AMessage } from "../a2a/bus.js";
import { logger } from "../utils/logger.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { ToolDefinition } from "../llm/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// 文件读写的沙箱目录，防止路径遍历攻击
const WORKSPACE = resolve(__dirname, "../../workspace");

/** Coder 可用的工具列表 */
const TOOLS: ToolDefinition[] = [
  {
    name: "run_code",
    description: "在沙箱中执行 JavaScript 代码，验证其可运行性",
    input_schema: {
      type: "object",
      properties: { code: { type: "string", description: "要执行的 JavaScript 代码" } },
      required: ["code"],
    },
  },
  {
    name: "calculate",
    description: "对数学表达式求值",
    input_schema: {
      type: "object",
      properties: { expression: { type: "string", description: "数学表达式，如 'Math.sqrt(144)'" } },
      required: ["expression"],
    },
  },
  {
    name: "read_file",
    description: "读取 workspace/ 目录下的文件内容",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "workspace/ 内的相对路径" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "将生成的代码写入 workspace/ 目录",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "workspace/ 内的相对路径" },
        content: { type: "string", description: "文件内容" },
      },
      required: ["path", "content"],
    },
  },
];

export class CoderAgent extends BaseAgent {
  constructor() {
    super({
      id: "coder",
      name: "Coder",
      systemPrompt: `你是一名专业软件工程师。编写干净、高效、有注释的代码。
在返回代码前，始终使用 run_code 工具测试代码的可运行性。
最终代码用带语言标注的 markdown 代码块返回。`,
      capabilities: [
        {
          name: "code_generation",
          description: "为指定任务生成并测试代码",
          inputSchema: { task: { type: "string" }, language: { type: "string" } },
        },
        {
          name: "code_review",
          description: "审查并改进现有代码",
          inputSchema: { code: { type: "string" } },
        },
      ],
    });
  }

  /** 处理来自 A2A 总线的编码任务 */
  protected async handleMessage(msg: A2AMessage): Promise<void> {
    if (msg.type !== "task") return;

    const payload = msg.payload as { task: string; language?: string; code?: string };
    logger.log("agent_start", this.config.name, `任务: "${payload.task}"`);

    try {
      // 根据是否有现有代码，构建不同的 prompt
      const prompt = payload.code
        ? `审查并改进以下代码:\n\`\`\`\n${payload.code}\n\`\`\`\n任务: ${payload.task}`
        : `用 ${payload.language ?? "JavaScript"} 编写代码: ${payload.task}`;

      const result = await this.llmCall(prompt, TOOLS);
      logger.log("agent_done", this.config.name, `完成 (${result.length} 字符)`);
      // 将结果回复给 Orchestrator
      bus.reply(msg, this.config.id, { code: result, agent: this.config.name });
    } catch (err) {
      logger.log("error", this.config.name, (err as Error).message);
      bus.reply(msg, this.config.id, { error: (err as Error).message });
    }
  }

  /** 执行工具调用 */
  protected async executeTool(name: string, input: Record<string, unknown>): Promise<string> {

    // 在沙箱中执行 JavaScript 代码
    if (name === "run_code") {
      try {
        const fn = new Function(
          // 拦截 console.log，收集输出
          `"use strict";
           const logs = [];
           const console = { log: (...a) => logs.push(a.join(' ')) };
           ${input.code};
           return logs;`
        );
        const logs = fn() as string[];
        return logs.join("\n") || "(无输出)";
      } catch (err) {
        return `执行错误: ${(err as Error).message}`;
      }
    }

    // 数学表达式求值
    if (name === "calculate") {
      try {
        return String(Function(`"use strict"; return (${input.expression})`)());
      } catch (err) {
        return `计算错误: ${(err as Error).message}`;
      }
    }

    // 读取 workspace/ 目录下的文件
    if (name === "read_file") {
      try {
        const safe = resolve(WORKSPACE, input.path as string);
        // 安全检查：防止路径遍历（如 ../../etc/passwd）
        if (!safe.startsWith(WORKSPACE)) return "错误: 不允许访问 workspace 目录之外的文件";
        return await readFile(safe, "utf-8");
      } catch (err) {
        return `读取失败: ${(err as Error).message}`;
      }
    }

    // 写入文件到 workspace/ 目录
    if (name === "write_file") {
      try {
        const safe = resolve(WORKSPACE, input.path as string);
        // 安全检查：防止路径遍历
        if (!safe.startsWith(WORKSPACE)) return "错误: 不允许写入 workspace 目录之外的文件";
        // 自动创建父目录
        await mkdir(dirname(safe), { recursive: true });
        await writeFile(safe, input.content as string, "utf-8");
        return `已写入 workspace/${input.path}`;
      } catch (err) {
        return `写入失败: ${(err as Error).message}`;
      }
    }

    return super.executeTool(name, input);
  }
}
