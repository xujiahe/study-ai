/**
 * RAG 模块 — 生产版
 * 代理到独立的 rag-service（:3003），通过 HTTP API 交互
 * 签名与原版完全兼容，agent 侧无需修改调用代码
 */
import { RagClient } from "rag-client";

const ragClient = new RagClient(
  process.env.RAG_SERVICE_URL ?? "http://localhost:3003",
  process.env.RAG_API_KEY ?? ""
);

/**
 * 初始化 RAG — 对 rag-service 发起健康检查
 * 不可达时仅打印警告，不阻塞 agent 启动
 */
export async function initRAG(_docsPath: string): Promise<void> {
  try {
    const res = await fetch(`${process.env.RAG_SERVICE_URL ?? "http://localhost:3003"}/health`);
    if (res.ok) {
      console.log("[RAG] rag-service 连接正常");
    } else {
      console.warn(`[RAG] rag-service 健康检查失败: HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`[RAG] rag-service 不可达，RAG 功能将不可用: ${(err as Error).message}`);
  }
}

/**
 * 检索相关文档块
 */
export async function retrieve(query: string, k = 4): Promise<string> {
  return ragClient.retrieve(query, k);
}

/**
 * 动态追加文档到知识库
 */
export async function addDocuments(
  texts: string[],
  metadata?: Record<string, unknown>[]
): Promise<void> {
  for (let i = 0; i < texts.length; i++) {
    const title = (metadata?.[i]?.source as string) ?? `document-${i}`;
    await ragClient.uploadDocument(texts[i], title, metadata?.[i]);
  }
}
