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

  async processDocument(job: IndexJob): Promise<IndexResult> {
    const startTime = Date.now();
    const { docId, filePath } = job;

    // 读取文件内容（.md / .txt / .pdf 均用 readFile 读取文本）
    const fileBuffer = await readFile(filePath);
    const text = fileBuffer.toString("utf-8");

    // 分块
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap,
    });
    const docs = await splitter.createDocuments([text]);

    // 获取 Embeddings 实例
    const embeddings = this._createEmbeddings();

    // 为每个 chunk 生成向量并构造 VectorChunk[]
    const chunks: VectorChunk[] = [];
    for (let i = 0; i < docs.length; i++) {
      const content = docs[i].pageContent;
      // embedQuery 失败时直接向上抛出
      const vector = await embeddings.embedQuery(content);
      chunks.push({
        id: `${docId}_chunk_${i}`,
        content,
        vector,
        metadata: {
          docId,
          source: filePath,
          chunkIndex: i,
          ...(job.metadata ?? {}),
        },
      });
    }

    // 写入向量库
    await this.vectorStore.upsert(docId, chunks);

    return {
      docId,
      chunkCount: chunks.length,
      durationMs: Date.now() - startTime,
    };
  }

  private _createEmbeddings(): OpenAIEmbeddings {
    if (this.config.zhipuApiKey) {
      return new OpenAIEmbeddings({
        openAIApiKey: this.config.zhipuApiKey,
        modelName: "embedding-3",
        configuration: {
          baseURL: "https://open.bigmodel.cn/api/paas/v4",
        },
      });
    }

    if (this.config.openaiApiKey) {
      return new OpenAIEmbeddings({
        openAIApiKey: this.config.openaiApiKey,
        modelName: "text-embedding-3-small",
      });
    }

    throw new Error("No embedding API key configured");
  }
}
