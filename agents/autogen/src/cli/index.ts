/**
 * CLI 交互式 REPL 入口
 *
 * 提供命令行交互界面，支持：
 *   - 直接与多 Agent 系统对话
 *   - 运行时切换 LLM 模型（/model 命令）
 *   - 查看 Agent 间的 A2A 消息流转
 *
 * 运行方式：pnpm cli
 */
import "dotenv/config";
import readline from "readline";
import chalk from "chalk";
import { initRAG } from "../rag/index.js";
import { OrchestratorAgent } from "../agents/orchestrator.js";
import { ResearcherAgent } from "../agents/researcher.js";
import { CoderAgent } from "../agents/coder.js";
import { bus } from "../a2a/bus.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log(chalk.cyan.bold("\n╔══════════════════════════════════╗"));
  console.log(chalk.cyan.bold("║   Node Autogen — CLI Interface   ║"));
  console.log(chalk.cyan.bold("╚══════════════════════════════════╝\n"));

  await initRAG(join(__dirname, "../../docs"));

  const researcher = new ResearcherAgent();
  const coder = new CoderAgent();
  const orchestrator = new OrchestratorAgent();
  researcher.start();
  coder.start();
  orchestrator.start();

  // Show agent traces
  (bus as unknown as { messages$: import("rxjs").Subject<import("../a2a/bus.js").A2AMessage> })
    .messages$.subscribe((msg) => {
      if (msg.type === "task") {
        console.log(chalk.dim(`  [${msg.from} → ${msg.to}] delegating...`));
      }
    });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const providers = ["anthropic", "openai", "ollama"];
  let currentProvider = process.env.LLM_PROVIDER ?? "anthropic";
  let currentModel = process.env.LLM_MODEL ?? "";

  function prompt() {
    const tag = chalk.green(`[${currentProvider}${currentModel ? "/" + currentModel : ""}]`);
    rl.question(`\n${tag} ${chalk.white("You:")} `, async (input) => {
      const line = input.trim();

      if (!line) return prompt();

      // Built-in commands
      if (line === "/exit" || line === "/quit") {
        console.log(chalk.yellow("Bye!"));
        process.exit(0);
      }

      if (line === "/help") {
        console.log(chalk.cyan(`
Commands:
  /model <provider> <model>   Switch LLM  e.g. /model openai gpt-4o-mini
  /models                     List available models
  /skills                     List active skills
  /clear                      Clear screen
  /exit                       Quit
        `));
        return prompt();
      }

      if (line === "/models") {
        console.log(chalk.cyan("Available providers: " + providers.join(", ")));
        return prompt();
      }

      if (line.startsWith("/model ")) {
        const [, provider, model] = line.split(" ");
        if (provider) {
          process.env.LLM_PROVIDER = provider;
          currentProvider = provider;
        }
        if (model) {
          process.env.LLM_MODEL = model;
          currentModel = model;
        }
        console.log(chalk.green(`Switched to ${currentProvider}/${currentModel || "default"}`));
        return prompt();
      }

      if (line === "/clear") {
        console.clear();
        return prompt();
      }

      // Chat
      console.log(chalk.dim("\n  Thinking...\n"));
      try {
        const result = await orchestrator.run(line);
        console.log(chalk.blue.bold("Assistant:"));
        console.log(result);
      } catch (err) {
        console.log(chalk.red("Error: " + (err as Error).message));
      }

      prompt();
    });
  }

  console.log(chalk.dim('Type your message or "/help" for commands\n'));
  prompt();
}

main().catch(console.error);
