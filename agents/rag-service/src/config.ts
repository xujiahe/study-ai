import "dotenv/config";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function optionalEnvNumber(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  return isNaN(parsed) ? defaultValue : parsed;
}

export const config = {
  /** HTTP 服务端口，默认 3003 */
  port: optionalEnvNumber("RAG_SERVICE_PORT", 3003),

  /** API 鉴权 Key（必需） */
  apiKey: requireEnv("RAG_API_KEY"),

  /** Milvus gRPC 地址，默认 localhost:19530 */
  milvusAddress: optionalEnv("RAG_MILVUS_ADDRESS", "localhost:19530"),

  /** Milvus Collection 名称，默认 rag_chunks */
  milvusCollection: optionalEnv("RAG_MILVUS_COLLECTION", "rag_chunks"),

  /** 文件上传目录，默认 ./uploads */
  uploadDir: optionalEnv("RAG_UPLOAD_DIR", "./uploads"),

  /** SQLite 元数据路径，默认 ./data/rag.db */
  dbPath: optionalEnv("RAG_DB_PATH", "./data/rag.db"),

  /** 并发索引任务数，默认 2 */
  indexConcurrency: optionalEnvNumber("RAG_INDEX_CONCURRENCY", 2),

  /** 上传文件大小限制（MB），默认 10 */
  maxFileSizeMb: optionalEnvNumber("RAG_MAX_FILE_SIZE_MB", 10),

  /** 文本分块大小（字符数），默认 500 */
  chunkSize: optionalEnvNumber("RAG_CHUNK_SIZE", 500),

  /** 分块重叠大小（字符数），默认 50 */
  chunkOverlap: optionalEnvNumber("RAG_CHUNK_OVERLAP", 50),

  /** 智谱 API Key（可选，优先使用） */
  zhipuApiKey: process.env.ZHIPU_API_KEY,

  /** OpenAI API Key（可选，备用） */
  openaiApiKey: process.env.OPENAI_API_KEY,

  /**
   * Embedding 向量维度，默认 1536（OpenAI）
   * 使用智谱 embedding-3 时应设为 2048
   */
  embeddingDim: optionalEnvNumber("EMBEDDING_DIM", 1536),
} as const;

export type Config = typeof config;
