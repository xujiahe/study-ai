/**
 * 向量检索路由
 *
 * POST /retrieve
 *   请求体：{ query: string, k?: number, filter?: Record<string, unknown> }
 *   流程：query 文本 → Embedding API → 查询向量 → Milvus search → 返回 top-k chunks
 *
 * 错误处理：
 *   - query 缺失 → 400
 *   - Milvus 不可用 → 503
 *   - 其他错误 → 500
 */
import { Router, Request, Response } from "express";
import { OpenAIEmbeddings } from "@langchain/openai";
import type { VectorStoreAdapter } from "../store/vectorStore.js";
import type { Config } from "../config.js";
import type { RetrieveResult } from "../types.js";

interface RetrieveRouterDeps {
  vectorStore: VectorStoreAdapter;
  config: Config;
}

/** 根据配置创建 Embedding 实例（与 Indexer 保持一致） */
function createEmbeddings(config: Config): OpenAIEmbeddings {
  if (config.zhipuApiKey) {
    return new OpenAIEmbeddings({
      openAIApiKey: config.zhipuApiKey,
      modelName: "embedding-3",
      configuration: { baseURL: "https://open.bigmodel.cn/api/paas/v4" },
    });
  }
  if (config.openaiApiKey) {
    return new OpenAIEmbeddings({
      openAIApiKey: config.openaiApiKey,
      modelName: "text-embedding-3-small",
    });
  }
  throw new Error("未配置 Embedding API Key");
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

    // 校验必填字段
    if (!query) {
      res.status(400).json({ error: "query 字段不能为空" });
      return;
    }

    try {
      // 1. 将查询文本转为向量
      const embeddings = createEmbeddings(config);
      const vector = await embeddings.embedQuery(query);

      // 2. 在 Milvus 中做向量相似度搜索
      const searchResults = await vectorStore.search(vector, k, filter);

      // 3. 格式化返回结果
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
      // Milvus 连接失败时返回 503
      if (msg.toLowerCase().includes("milvus") ||
          msg.toLowerCase().includes("unavailable") ||
          msg.toLowerCase().includes("connect")) {
        res.status(503).json({ error: "向量数据库不可用" });
        return;
      }
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
