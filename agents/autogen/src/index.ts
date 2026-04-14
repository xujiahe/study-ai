/**
 * CLI 批量运行入口
 *
 * 不启动 HTTP/WebSocket 服务，直接在终端运行预设的演示任务
 * 适合快速验证 Agent 系统是否正常工作
 *
 * 运行方式：npm run dev
 */
import "dotenv/config";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { initRAG } from "./rag/index.js";
import { OrchestratorAgent } from "./agents/orchestrator.js";
import { ResearcherAgent } from "./agents/researcher.js";
import { CoderAgent } from "./agents/coder.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("=== Node Autogen Demo — 多 Agent 系统 ===\n");

  // 1. 初始化 RAG 知识库（加载 docs/ 目录下的文档）
  await initRAG(join(__dirname, "../docs"));

  // 2. 启动专项 Agent（先注册到 A2A 总线）
  const researcher = new ResearcherAgent();
  const coder = new CoderAgent();
  researcher.start();
  coder.start();

  // 3. 最后启动 Orchestrator（确保委托目标已就绪）
  const orchestrator = new OrchestratorAgent();
  orchestrator.start();

  // ── 演示任务 ──────────────────────────────────────────────────────────────

  // 任务 1：纯知识检索
  console.log("\n--- 任务 1: 知识检索 ---");
  const r1 = await orchestrator.run(
    "什么是 RAG（检索增强生成）？它是如何工作的？"
  );
  console.log("\n[结果]\n", r1);

  // 任务 2：代码生成
  console.log("\n--- 任务 2: 代码生成 ---");
  const r2 = await orchestrator.run(
    "用 JavaScript 实现一个对有序数组进行二分查找的函数，并附上测试用例。"
  );
  console.log("\n[结果]\n", r2);

  // 任务 3：多 Agent 协作（研究 + 编码）
  console.log("\n--- 任务 3: 多 Agent 协作 ---");
  const r3 = await orchestrator.run(
    "先研究斐波那契数列是什么，然后用 JavaScript 实现一个使用记忆化的高效版本。"
  );
  console.log("\n[结果]\n", r3);

  // 清理：停止所有 Agent
  researcher.stop();
  coder.stop();
  orchestrator.stop();

  console.log("\n=== 完成 ===");
}

main().catch((err) => {
  console.error("致命错误:", err);
  process.exit(1);
});
