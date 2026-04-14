/**
 * 文档索引器
 *
 * 职责：
 *   1. 读取文件内容（.md / .txt / .pdf）
 *   2. 使用 RecursiveCharacterTextSplitter 将文本切分为 chunks
 *   3. 调用 Embedding API 为每个 chunk 生成向量
 *   4. 将向量写入 Milvus（通过 VectorStoreAdapter）
 *
 * Embedding 优先级：
 *   智谱 embedding-3（ZHIPU_API_KEY）> OpenAI text-embedding-3-small（OPENAI_API_KEY）
 */
import { readFile } from "fs/promises";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import type { Config } from "../config.js";
import type { VectorStoreAdapter } from "../store/vectorStore.js";
import type { IndexJob, IndexResult, VectorChunk } from "../types.js";

export class Indexer {
  constructor(
    private readonly config: Config,
    private readonly vectorStore: VectorStoreAdapter
  ) {}

  /**
   * 处理单个文档：读取 → 分块 → 向量化 → 写入
   * @returns IndexResult 包含 docId、chunk 数量、耗时
   */
  async processDocument(job: IndexJob): Promise<IndexResult> {
    const startTime = Date.now();
    const { docId, filePath } = job;

    // 读取文件内容
    const text = (await readFile(filePath)).toString("utf-8");

    // 按配置的 chunkSize / chunkOverlap 切分文本
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap,
    });
    const docs = await splitter.createDocuments([text]);

    // 获取 Embedding 实例（优先智谱，其次 OpenAI）
    const embeddings = this._createEmbeddings();

    // 为每个 chunk 生成向量
    const chunks: VectorChunk[] = [];
    for (let i = 0; i < docs.length; i++) {
      const content = docs[i].pageContent;
      const vector = await embeddings.embedQuery(content); // 失败时直接抛出，由 IndexQueue 捕获
      chunks.push({
        id: `${docId}_chunk_${i}`,  // 全局唯一 ID
        content,
        vector,
        metadata: {
          docId,
          source: filePath,   // 来源文件路径
          chunkIndex: i,
          ...(job.metadata ?? {}),
        },
      });
    }

    // 批量写入向量库
    await this.vectorStore.upsert(docId, chunks);

    return {
      docId,
      chunkCount: chunks.length,
      durationMs: Date.now() - startTime,
    };
  }

  /** 根据配置创建 Embedding 实例 */
  private _createEmbeddings(): OpenAIEmbeddings {
    if (this.config.zhipuApiKey) {
      // 智谱 embedding-3，向量维度 2048，复用 ZHIPU_API_KEY
      return new OpenAIEmbeddings({
        openAIApiKey: this.config.zhipuApiKey,
        modelName: "embedding-3",
        configuration: { baseURL: "https://open.bigmodel.cn/api/paas/v4" },
      });
    }
    if (this.config.openaiApiKey) {
      // OpenAI text-embedding-3-small，向量维度 1536
      return new OpenAIEmbeddings({
        openAIApiKey: this.config.openaiApiKey,
        modelName: "text-embedding-3-small",
      });
    }
    throw new Error("未配置 Embedding API Key（ZHIPU_API_KEY 或 OPENAI_API_KEY）");
  }
}
