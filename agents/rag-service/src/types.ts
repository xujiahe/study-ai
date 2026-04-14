/**
 * RAG Service 共享类型定义
 */

// ─── 文档元数据 ────────────────────────────────────────────────────────────────

export interface DocumentRecord {
  id: string;
  title: string;
  filePath: string;
  status: "pending" | "indexing" | "ready" | "error";
  chunkCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}

// ─── 索引队列 ──────────────────────────────────────────────────────────────────

export interface IndexJob {
  docId: string;
  filePath: string;
  title: string;
  metadata?: Record<string, unknown>;
}

export interface IndexResult {
  docId: string;
  chunkCount: number;
  durationMs: number;
}

// ─── 向量存储 ──────────────────────────────────────────────────────────────────

export interface VectorChunk {
  /** 格式：`${docId}_chunk_${index}` */
  id: string;
  content: string;
  vector: number[];
  metadata: {
    docId: string;
    source: string;
    chunkIndex: number;
    [key: string]: unknown;
  };
}

export interface SearchResult {
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

// ─── HTTP API 请求/响应 ────────────────────────────────────────────────────────

export interface UploadDocumentRequest {
  /** multipart 上传时由 multer 填充 */
  file?: Express.Multer.File;
  /** 直接传文本内容 */
  text?: string;
  title: string;
  metadata?: Record<string, unknown>;
}

export interface UploadDocumentResponse {
  docId: string;
  status: "pending" | "ready" | "error";
}

export interface RetrieveRequest {
  query: string;
  /** 返回结果数量，默认 4 */
  k?: number;
  /** 元数据过滤条件 */
  filter?: Record<string, unknown>;
}

export interface RetrieveResult {
  content: string;
  /** 文档标题或文件名 */
  source: string;
  docId: string;
  score: number;
  chunkIndex: number;
}

export interface RetrieveResponse {
  results: RetrieveResult[];
}

export interface DocumentStatusResponse {
  docId: string;
  status: "pending" | "indexing" | "ready" | "error";
  chunkCount?: number;
  errorMessage?: string;
}
