import {
  MilvusClient,
  DataType,
  MetricType,
  IndexType,
} from "@zilliz/milvus2-sdk-node";
import type { VectorStoreAdapter } from "./vectorStore.js";
import type { VectorChunk, SearchResult } from "../types.js";
import type { Config } from "../config.js";

export class MilvusAdapter implements VectorStoreAdapter {
  private client: MilvusClient;
  private readonly collection: string;
  private readonly dim: number;

  constructor(private readonly config: Config) {
    this.collection = config.milvusCollection;
    this.dim = config.embeddingDim;
    this.client = new MilvusClient({ address: config.milvusAddress });
  }

  async initialize(): Promise<void> {
    // 验证连接
    try {
      await this.client.checkHealth();
    } catch (err) {
      throw new Error(
        `Milvus 不可用（${this.config.milvusAddress}）：${(err as Error).message}`
      );
    }

    // 检查 collection 是否存在，不存在则创建
    const { value: exists } = await this.client.hasCollection({
      collection_name: this.collection,
    });

    if (!exists) {
      await this.client.createCollection({
        collection_name: this.collection,
        fields: [
          {
            name: "id",
            data_type: DataType.VarChar,
            max_length: 256,
            is_primary_key: true,
            autoID: false,
          },
          {
            name: "content",
            data_type: DataType.VarChar,
            max_length: 65535,
          },
          {
            name: "vector",
            data_type: DataType.FloatVector,
            dim: this.dim,
          },
          {
            name: "doc_id",
            data_type: DataType.VarChar,
            max_length: 256,
          },
          {
            name: "source",
            data_type: DataType.VarChar,
            max_length: 512,
          },
          {
            name: "chunk_index",
            data_type: DataType.Int64,
          },
        ],
      });

      // 创建 HNSW 索引
      await this.client.createIndex({
        collection_name: this.collection,
        field_name: "vector",
        metric_type: MetricType.COSINE,
        index_type: IndexType.HNSW,
        params: { M: 8, efConstruction: 64 },
      });
    }

    // 加载 collection 到内存
    await this.client.loadCollection({ collection_name: this.collection });
  }

  async upsert(docId: string, chunks: VectorChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const data = chunks.map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      vector: chunk.vector,
      doc_id: docId,
      source: (chunk.metadata.source as string) ?? "",
      chunk_index: chunk.metadata.chunkIndex,
    }));

    try {
      await this.client.insert({
        collection_name: this.collection,
        data,
      });
    } catch (err) {
      throw new Error(
        `Milvus upsert 失败（docId=${docId}）：${(err as Error).message}`
      );
    }
  }

  async search(
    vector: number[],
    k: number,
    filter?: Record<string, unknown>
  ): Promise<SearchResult[]> {
    const expr = buildExpr(filter);

    let rawResults: Awaited<ReturnType<MilvusClient["search"]>>;
    try {
      rawResults = await this.client.search({
        collection_name: this.collection,
        data: [vector],
        limit: k,
        output_fields: ["id", "content", "doc_id", "source", "chunk_index"],
        ...(expr ? { filter: expr } : {}),
      });
    } catch (err) {
      throw new Error(`Milvus search 失败：${(err as Error).message}`);
    }

    const hits = rawResults.results ?? [];
    return hits.map((hit: Record<string, unknown>) => ({
      content: hit["content"] as string,
      score: hit["score"] as number,
      metadata: {
        docId: hit["doc_id"],
        source: hit["source"],
        chunkIndex: hit["chunk_index"],
      },
    }));
  }

  async delete(docId: string): Promise<void> {
    try {
      await this.client.deleteEntities({
        collection_name: this.collection,
        expr: `doc_id == "${docId}"`,
      });
    } catch (err) {
      throw new Error(
        `Milvus delete 失败（docId=${docId}）：${(err as Error).message}`
      );
    }
  }
}

/**
 * 将 filter 对象转换为 Milvus 标量过滤表达式
 * 当前仅支持 doc_id 等值过滤
 */
function buildExpr(filter?: Record<string, unknown>): string {
  if (!filter) return "";
  const parts: string[] = [];
  if (filter["doc_id"] !== undefined) {
    parts.push(`doc_id == "${filter["doc_id"]}"`);
  }
  return parts.join(" && ");
}
