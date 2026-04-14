/**
 * RAG Service 入口
 *
 * 职责：
 *   1. 初始化所有组件（DocumentRepository、MilvusAdapter、Indexer、IndexQueue）
 *   2. 注册 Express 中间件和路由
 *   3. 启动 HTTP 服务器
 *
 * 启动顺序：
 *   创建 uploads 目录 → 连接 Milvus → 监听端口
 */
import express from "express";
import cors from "cors";
import { mkdir } from "node:fs/promises";
import { config } from "./config.js";
import { DocumentRepository } from "./db/documentRepo.js";
import { MilvusAdapter } from "./store/milvusAdapter.js";
import { Indexer } from "./indexer/indexer.js";
import { IndexQueue } from "./queue/indexQueue.js";
import { createDocumentsRouter } from "./routes/documents.js";
import { createRetrieveRouter } from "./routes/retrieve.js";
import { apiKeyAuth } from "./middleware/auth.js";

const app = express();

// ─── 全局中间件 ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── 健康检查（无需鉴权，供 agent 启动时探活）─────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// ─── API Key 鉴权（所有业务路由均需通过）────────────────────────────────────────
app.use(apiKeyAuth(config));

// ─── 组件实例化 ────────────────────────────────────────────────────────────────
// DocumentRepository：SQLite 元数据存储，记录文档状态
const repo = new DocumentRepository(config.dbPath);
// MilvusAdapter：向量数据库适配器，负责向量的增删查
const vectorStore = new MilvusAdapter(config);
// Indexer：文档分块 + Embedding 生成 + 写入向量库
const indexer = new Indexer(config, vectorStore);
// IndexQueue：异步 FIFO 队列，解耦上传与向量化，控制并发
const queue = new IndexQueue(indexer, repo, config.indexConcurrency);

// ─── 路由挂载 ──────────────────────────────────────────────────────────────────
// /documents  文档管理（上传、列表、状态查询、chunk 预览、删除）
app.use("/documents", createDocumentsRouter({ repo, queue, vectorStore, config }));
// /retrieve   向量检索（query → embedding → Milvus search → 返回相关 chunks）
app.use("/retrieve", createRetrieveRouter({ vectorStore, config }));

// ─── 启动 ──────────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  // 确保上传目录存在
  await mkdir(config.uploadDir, { recursive: true });
  // 连接 Milvus，创建 collection 和索引（如不存在）
  await vectorStore.initialize();
  app.listen(config.port, () => {
    console.log(`rag-service listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error("rag-service 启动失败:", err);
  process.exit(1);
});
