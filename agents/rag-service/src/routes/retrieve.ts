import { Router, Request, Response } from "express";
import { OpenAIEmbeddings } from "@langchain/openai";
import type { VectorStoreAdapter } from "../store/vectorStore.js";
import type { Config } from "../config.js";
import type { RetrieveResult } from "../types.js";

interface RetrieveRouterDeps {
  vectorStore: VectorStoreAdapter;
  config: Config;
}

function createEmbeddings(config: Config): OpenAIEmbeddings {
  if (config.zhipuApiKey) {
    return new OpenAIEmbeddings({
      openAIApiKey: config.zhipuApiKey,
      modelName: "embedding-3",
      configuration: {
        baseURL: "https://open.bigmodel.cn/api/paas/v4",
      },
    });
  }
  if (config.openaiApiKey) {
    return new OpenAIEmbeddings({
      openAIApiKey: config.openaiApiKey,
      modelName: "text-embedding-3-small",
    });
  }
  throw new Error("No embedding API key configured");
}

export function createRetrieveRouter(deps: RetrieveRouterDeps): Router {
  const { vectorStore, config } = deps;
  const router = Router();

  router.post("/", async (req: Request, res: Response): Promise<void> => {
    const { query, k = 4, filter } = req.body as {
      query?: string;
      k?: number;
      filter?: Record<string, unknown>;
    };

    if (!query) {
      res.status(400).json({ error: "query field is required" });
      return;
    }

    try {
      const embeddings = createEmbeddings(config);
      const vector = await embeddings.embedQuery(query);
      const searchResults = await vectorStore.search(vector, k, filter);

      const results: RetrieveResult[] = searchResults.map((r) => ({
        content: r.content,
        source: (r.metadata.source as string) ?? "",
        docId: (r.metadata.docId as string) ?? "",
        score: r.score,
        chunkIndex: (r.metadata.chunkIndex as number) ?? 0,
      }));

      res.json({ results });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Milvus unavailable
      if (
        msg.toLowerCase().includes("milvus") ||
        msg.toLowerCase().includes("unavailable") ||
        msg.toLowerCase().includes("connect")
      ) {
        res.status(503).json({ error: "Vector store unavailable" });
        return;
      }
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
