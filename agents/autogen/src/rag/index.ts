/**
 * RAG 模块 — 通过 HTTP 代理到 rag-service
 * 签名与原版完全兼容，agent 侧无需修改调用代码
 */

const RAG_URL = process.env.RAG_SERVICE_URL ?? "http://localhost:3003";
const RAG_KEY = process.env.RAG_API_KEY ?? "";

async function ragRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${RAG_URL}${path}`, {
    method,
    headers: { "X-API-Key": RAG_KEY, "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`RAG HTTP ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json() as Promise<T>;
}

/** 初始化 — 对 rag-service 发起健康检查，不可达时仅警告不阻塞启动 */
export async function initRAG(_docsPath: string): Promise<void> {
  try {
    const res = await fetch(`${RAG_URL}/health`);
    console.log(res.ok ? "[RAG] rag-service 连接正常" : `[RAG] 健康检查失败: HTTP ${res.status}`);
  } catch (err) {
    console.warn(`[RAG] rag-service 不可达，RAG 功能将不可用: ${(err as Error).message}`);
  }
}

/** 检索相关文档块 */
export async function retrieve(query: string, k = 4): Promise<string> {
  const data = await ragRequest<{ results: Array<{ content: string; source: string }> }>(
    "POST", "/retrieve", { query, k }
  );
  return data.results.map((r, i) => `[${i + 1}] (${r.source})\n${r.content}`).join("\n\n---\n\n");
}

/** 动态追加文档到知识库 */
export async function addDocuments(texts: string[], metadata?: Record<string, unknown>[]): Promise<void> {
  for (let i = 0; i < texts.length; i++) {
    const title = (metadata?.[i]?.source as string) ?? `document-${i}`;
    await ragRequest("POST", "/documents", { text: texts[i], title, metadata: metadata?.[i] });
  }
}
