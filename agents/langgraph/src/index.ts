/**
 * CLI 入口 — 批量运行演示任务
 */
import "dotenv/config";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { initRAG } from "./rag/index.js";
import { runGraph } from "./graph.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("=== LangGraph 多 Agent 演示 ===\n");
  await initRAG(join(__dirname, "../docs"));

  const tasks = [
    "什么是 RAG？它是如何工作的？",
    "用 TypeScript 实现一个防抖函数，并测试它。",
    "先研究什么是 LangGraph，然后写一个最简单的 LangGraph 示例代码。",
  ];

  for (const [i, task] of tasks.entries()) {
    console.log(`\n--- 任务 ${i + 1}: ${task} ---`);
    const result = await runGraph(task, (node, content) => {
      console.log(`  [${node}] ${content.slice(0, 100)}...`);
    });
    console.log("\n[最终结果]\n", result.slice(0, 500));
  }

  console.log("\n=== 完成 ===");
}

main().catch((err) => { console.error(err); process.exit(1); });
