import { Router, Request, Response } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import type { DocumentRepository } from "../db/documentRepo.js";
import type { IndexQueue } from "../queue/indexQueue.js";
import type { VectorStoreAdapter } from "../store/vectorStore.js";
import type { Config } from "../config.js";

interface DocumentsRouterDeps {
  repo: DocumentRepository;
  queue: IndexQueue;
  vectorStore: VectorStoreAdapter;
  config: Config;
}

const ALLOWED_EXTENSIONS = new Set([".md", ".txt", ".pdf"]);

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

export function createDocumentsRouter(deps: DocumentsRouterDeps): Router {
  const { repo, queue, vectorStore, config } = deps;

  const uploadRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.RAG_UPLOAD_RATE_LIMIT) || 20,
    message: { error: "Too many upload requests, please try again later" },
  });

  // multer: store to temp dir first, then rename
  const upload = multer({
    dest: join(config.uploadDir, ".tmp"),
    limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
  });

  const router = Router();

  // POST / — upload document
  router.post(
    "/",
    uploadRateLimit as any,
    upload.single("file"),
    async (req: Request, res: Response): Promise<void> => {
      try {
        // Check queue length
        if (queue.getQueueLength() >= 100) {
          res.status(429).json({ error: "Queue is full, try again later" });
          return;
        }

        const docId = uuidv4();
        let filePath: string;
        let title: string;

        if (req.file) {
          // multipart file upload
          const ext = getExtension(req.file.originalname);
          if (!ALLOWED_EXTENSIONS.has(ext)) {
            res.status(400).json({
              error: `Unsupported file type: ${ext}. Allowed: .md, .txt, .pdf`,
            });
            return;
          }
          // File size already enforced by multer limits above
          filePath = join(config.uploadDir, `${docId}${ext}`);
          await rename(req.file.path, filePath);
          title =
            (req.body?.title as string | undefined) ||
            req.file.originalname;
        } else if (req.body?.text) {
          // JSON body with text field
          const text = req.body.text as string;
          const sizeBytes = Buffer.byteLength(text, "utf-8");
          if (sizeBytes > config.maxFileSizeMb * 1024 * 1024) {
            res.status(400).json({ error: "Text content exceeds size limit" });
            return;
          }
          filePath = join(config.uploadDir, `${docId}.txt`);
          await writeFile(filePath, text, "utf-8");
          title = (req.body?.title as string | undefined) || docId;
        } else {
          res.status(400).json({ error: "No file or text provided" });
          return;
        }

        const metadata = req.body?.metadata
          ? (JSON.parse(req.body.metadata as string) as Record<string, unknown>)
          : {};

        repo.insert({
          id: docId,
          title,
          filePath,
          status: "pending",
          chunkCount: 0,
          metadata,
        });

        queue.enqueue({ docId, filePath, title, metadata });

        res.status(202).json({ docId, status: "pending" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: msg });
      }
    }
  );

  // GET / — list all documents
  router.get("/", (_req: Request, res: Response): void => {
    const documents = repo.findAll();
    res.json({ documents });
  });

  // GET /:id/status — get document status
  router.get("/:id/status", (req: Request, res: Response): void => {
    const doc = repo.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json({
      docId: doc.id,
      status: doc.status,
      chunkCount: doc.chunkCount,
      errorMessage: doc.errorMessage,
    });
  });

  // GET /:id/chunks — 查看文档的所有 chunk 内容
  router.get("/:id/chunks", async (req: Request, res: Response): Promise<void> => {
    const doc = repo.findById(req.params.id);
    if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
    if (doc.status !== "ready") {
      res.json({ chunks: [], status: doc.status });
      return;
    }
    try {
      const results = await vectorStore.listByDocId(req.params.id);
      res.json({ chunks: results.map(r => ({ index: r.metadata.chunkIndex, content: r.content })) });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // DELETE /:id — delete document
  router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
    const doc = repo.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    try {
      await vectorStore.delete(doc.id);
    } catch {
      // best-effort: continue even if vector store delete fails
    }

    repo.delete(doc.id);

    try {
      await unlink(doc.filePath);
    } catch {
      // ignore if file doesn't exist
    }

    res.json({ ok: true });
  });

  return router;
}
