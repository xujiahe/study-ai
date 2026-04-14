/**
 * RAG 模块 — 与 node-autogen-demo 相同逻辑
 * 智谱 embedding-3 优先，降级为关键词搜索
 */
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { readdir, readFile } from "fs/promises";
import { join, extname } from "path";

let vectorStore: MemoryVectorStore | null = null;
let rawChunks: Document[] = [];

function getEmbeddings() {
  if (process.env.ZHIPU_API_KEY) {
    return new OpenAIEmbeddings({
      openAIApiKey: process.env.ZHIPU_API_KEY,
      modelName: "embedding-3",
      configuration: { baseURL: "https://open.bigmodel.cn/api/paas/v4" },
    });
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
  }
  return null;
}

export async function initRAG(docsPath: string): Promise<void> {
  console.log(`[RAG] 加载文档: ${docsPath}`);
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
      docs.push(...await splitter.createDocuments([content], [{ source: file }]));
    }
  } catch {
    docs.push(new Document({ pageContent: "演示知识库，请在 docs/ 目录添加文档。", metadata: { source: "placeholder" } }));
  }
  rawChunks = docs;

  const embeddings = getEmbeddings();
  if (!embeddings) {
    console.warn("[RAG] 无 Embedding Key，使用关键词搜索");
    return;
  }
  try {
    vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
    console.log(`[RAG] 已索引 ${docs.length} 个文档块`);
  } catch (err) {
    console.warn(`[RAG] 向量化失败: ${(err as Error).message}，降级为关键词搜索`);
  }
}

export async function retrieve(query: string, k = 4): Promise<string> {
  if (vectorStore) {
    const results = await vectorStore.similaritySearch(query, k);
    if (results.length > 0) {
      return results.map((d, i) => `[${i + 1}] (${d.metadata.source})\n${d.pageContent}`).join("\n\n---\n\n");
    }
  }
  // 关键词降级
  const q = query.toLowerCase();
  return rawChunks
    .map((d) => ({ d, score: q.split(" ").filter((w) => d.pageContent.toLowerCase().includes(w)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ d }, i) => `[${i + 1}] (${d.metadata.source})\n${d.pageContent}`)
    .join("\n\n---\n\n") || "知识库为空。";
}
