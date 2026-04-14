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

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Health (no auth) ─────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// ─── Auth for all other routes ────────────────────────────────────────────────
app.use(apiKeyAuth(config));

// ─── Instances ────────────────────────────────────────────────────────────────
const repo = new DocumentRepository(config.dbPath);
const vectorStore = new MilvusAdapter(config);
const indexer = new Indexer(config, vectorStore);
const queue = new IndexQueue(indexer, repo, config.indexConcurrency);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use(
  "/documents",
  createDocumentsRouter({ repo, queue, vectorStore, config })
);
app.use("/retrieve", createRetrieveRouter({ vectorStore, config }));

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  await mkdir(config.uploadDir, { recursive: true });
  await vectorStore.initialize();
  app.listen(config.port, () => {
    console.log(`rag-service listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start rag-service:", err);
  process.exit(1);
});
