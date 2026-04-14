import type { VectorChunk, SearchResult } from "../types.js";

/**
 * Vector Store 适配器接口
 * search 接收已生成好的向量（embedding 在 Indexer 层完成）
 */
export interface VectorStoreAdapter {
  /** 连接并初始化 collection（不存在则创建） */
  initialize(): Promise<void>;

  /** 批量写入 chunks，按 docId 关联 */
  upsert(docId: string, chunks: VectorChunk[]): Promise<void>;

  /**
   * 向量相似度检索
   * @param vector 已生成的查询向量
   * @param k      返回结果数量
   * @param filter 可选的标量过滤条件
   */
  search(
    vector: number[],
    k: number,
    filter?: Record<string, unknown>
  ): Promise<SearchResult[]>;

  /** 按 docId 列出所有 chunks（用于预览） */
  listByDocId(docId: string): Promise<SearchResult[]>;

  /** 删除指定文档的所有向量 */
  delete(docId: string): Promise<void>;
}
