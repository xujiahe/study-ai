/**
 * RAG（检索增强生成）模块
 *
 * 工作流程：
 *   1. 启动时扫描 docs/ 目录，加载所有 .md / .txt 文件
 *   2. 用 RecursiveCharacterTextSplitter 将文档分块（默认 500 字符，50 重叠）
 *   3. 优先使用智谱 embedding-3 生成向量（复用 ZHIPU_API_KEY，无需额外费用）
 *   4. 向量存入 MemoryVectorStore（内存，适合开发；生产环境可换 Faiss/Pinecone）
 *   5. 无 API Key 时自动降级为关键词 TF 评分搜索
 *
 * 对外暴露：
 *   - initRAG(docsPath)：初始化，加载并索引文档
 *   - retrieve(query, k)：检索 top-k 相关文档块
 *   - addDocuments(texts, metadata)：运行时动态追加文档
 */
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { readdir, readFile } from "fs/promises";
import { join, extname } from "path";

/** 向量存储实例（null 表示未初始化或降级为关键词搜索） */
let vectorStore: MemoryVectorStore | null = null;
/** 原始文档块，用于关键词搜索降级 */
let rawChunks: Document[] = [];

/**
 * 获取 Embeddings 实例
 * 优先使用智谱 embedding-3（免费，复用 ZHIPU_API_KEY）
 * 其次使用 OpenAI text-embedding-3-small
 * 都没有则返回 null，触发关键词搜索降级
 */
function getEmbeddings() {
  if (process.env.ZHIPU_API_KEY) {
    return new OpenAIEmbeddings({
      openAIApiKey: process.env.ZHIPU_API_KEY,
      modelName: "embedding-3",
      // 指向智谱的 OpenAI 兼容接口
      configuration: { baseURL: "https://open.bigmodel.cn/api/paas/v4" },
    });
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-3-small",
    });
  }
  return null; // 无可用 Embeddings，降级为关键词搜索
}

/**
 * 从指定目录加载所有 .md / .txt 文件并分块
 * @param docsPath 文档目录路径
 */
async function loadDocs(docsPath: string): Promise<Document[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: Number(process.env.RAG_CHUNK_SIZE) || 500,
    chunkOverlap: Number(process.env.RAG_CHUNK_OVERLAP) || 50,
  });
  const docs: Document[] = [];
  try {
    const files = await readdir(docsPath);
    for (const file of files) {
      if (![".md", ".txt"].includes(extname(file))) continue;
      const content = await readFile(join(docsPath, file), "utf-8");
      // 分块，并记录来源文件名
      const chunks = await splitter.createDocuments([content], [{ source: file }]);
      docs.push(...chunks);
    }
  } catch {
    // docs 目录不存在时，插入占位文档
    docs.push(new Document({
      pageContent: "演示知识库。请将 .md 或 .txt 文件放入 docs/ 目录。",
      metadata: { source: "placeholder" },
    }));
  }
  return docs;
}

/**
 * 初始化 RAG 模块
 * 加载文档 → 生成向量 → 存入向量库
 * @param docsPath 文档目录路径
 */
export async function initRAG(docsPath: string): Promise<void> {
  console.log(`[RAG] 加载文档: ${docsPath}`);
  const docs = await loadDocs(docsPath);
  rawChunks = docs; // 保存原始块，用于关键词搜索降级

  const embeddings = getEmbeddings();
  if (!embeddings) {
    console.warn("[RAG] 未找到 Embedding API Key，使用关键词搜索降级模式");
    return;
  }

  try {
    vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
    console.log(`[RAG] 已索引 ${docs.length} 个文档块（向量搜索）`);
  } catch (err) {
    console.warn(`[RAG] 向量化失败 (${(err as Error).message})，降级为关键词搜索`);
  }
}

/**
 * 检索与查询最相关的 top-k 文档块
 * 优先使用向量相似度搜索，降级时使用关键词 TF 评分
 * @param query 查询文本
 * @param k     返回结果数量，默认 4
 */
export async function retrieve(query: string, k = 4): Promise<string> {
  // 向量相似度搜索
  if (vectorStore) {
    const results = await vectorStore.similaritySearch(query, k);
    if (results.length > 0) {
      return results
        .map((d: Document, i: number) => `[${i + 1}] (${d.metadata.source})\n${d.pageContent}`)
        .join("\n\n---\n\n");
    }
  }

  // 关键词搜索降级：统计查询词在文档块中出现的次数，按频率排序
  if (rawChunks.length === 0) return "知识库为空。";
  const q = query.toLowerCase();
  const scored = rawChunks
    .map((d) => ({
      d,
      // 计算查询词命中数（简单 TF 评分）
      score: q.split(" ").filter((w) => d.pageContent.toLowerCase().includes(w)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return scored
    .map(({ d }, i) => `[${i + 1}] (${d.metadata.source})\n${d.pageContent}`)
    .join("\n\n---\n\n");
}

/**
 * 运行时动态追加文档到知识库
 * @param texts    文档文本列表
 * @param metadata 对应的元数据列表（可选）
 */
export async function addDocuments(texts: string[], metadata?: Record<string, unknown>[]) {
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 50 });
  const docs = await splitter.createDocuments(texts, metadata);
  rawChunks.push(...docs);
  // 如果向量库已初始化，同步追加
  if (vectorStore) await vectorStore.addDocuments(docs);
  console.log(`[RAG] 追加了 ${docs.length} 个文档块`);
}
