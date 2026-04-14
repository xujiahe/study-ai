<script setup lang="ts">
import { ref, onMounted } from "vue";

interface DocRecord {
  id: string;
  title: string;
  status: "pending" | "indexing" | "ready" | "error";
  chunkCount: number;
  createdAt: string;
  errorMessage?: string;
}

interface Chunk { index: number; content: string; }

const docs = ref<DocRecord[]>([]);
const loading = ref(false);
const uploading = ref(false);
const error = ref("");
const expandedId = ref<string | null>(null);
const chunks = ref<Chunk[]>([]);
const chunksLoading = ref(false);

const RAG_KEY = import.meta.env.VITE_RAG_API_KEY ?? "";

async function fetchDocs() {
  loading.value = true;
  error.value = "";
  try {
    const res = await fetch("/rag/documents", { headers: { "X-API-Key": RAG_KEY } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    docs.value = data.documents ?? [];
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function toggleChunks(doc: DocRecord) {
  if (expandedId.value === doc.id) {
    expandedId.value = null;
    chunks.value = [];
    return;
  }
  if (doc.status !== "ready") return;
  expandedId.value = doc.id;
  chunksLoading.value = true;
  chunks.value = [];
  try {
    const res = await fetch(`/rag/documents/${doc.id}/chunks`, { headers: { "X-API-Key": RAG_KEY } });
    const data = await res.json();
    chunks.value = data.chunks ?? [];
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    chunksLoading.value = false;
  }
}

async function remove(id: string, title: string) {
  if (!confirm(`删除文档 "${title}"？`)) return;
  await fetch(`/rag/documents/${id}`, { method: "DELETE", headers: { "X-API-Key": RAG_KEY } });
  if (expandedId.value === id) { expandedId.value = null; chunks.value = []; }
  await fetchDocs();
}

async function uploadFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading.value = true;
  const form = new FormData();
  form.append("file", file);
  form.append("title", file.name.replace(/\.[^.]+$/, ""));
  try {
    const res = await fetch("/rag/documents", { method: "POST", headers: { "X-API-Key": RAG_KEY }, body: form });
    if (!res.ok) throw new Error(await res.text());
    await fetchDocs();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    uploading.value = false;
    input.value = "";
  }
}

const STATUS_LABEL: Record<string, string> = {
  pending: "等待中", indexing: "索引中", ready: "就绪", error: "失败",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "#94a3b8", indexing: "#f59e0b", ready: "#22c55e", error: "#ef4444",
};

onMounted(fetchDocs);
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <span>知识库文档</span>
      <div class="header-actions">
        <button class="btn-refresh" @click="fetchDocs" title="刷新">↻</button>
        <label class="btn-upload" :class="{ disabled: uploading }">
          {{ uploading ? "上传中..." : "+ 上传" }}
          <input type="file" accept=".md,.txt,.pdf" @change="uploadFile" :disabled="uploading" />
        </label>
      </div>
    </div>

    <div v-if="error" class="error-msg">{{ error }}</div>
    <div v-if="loading" class="empty">加载中...</div>

    <div v-else-if="docs.length === 0" class="empty">
      暂无文档。上传 .md / .txt / .pdf 文件。
    </div>

    <div v-else class="doc-list">
      <div v-for="doc in docs" :key="doc.id">
        <div class="doc-item" :class="{ expanded: expandedId === doc.id }">
          <div class="doc-status-dot" :style="{ background: STATUS_COLOR[doc.status] }" />
          <div class="doc-info" @click="toggleChunks(doc)" :class="{ clickable: doc.status === 'ready' }">
            <div class="doc-title">{{ doc.title }}</div>
            <div class="doc-meta">
              <span :style="{ color: STATUS_COLOR[doc.status] }">{{ STATUS_LABEL[doc.status] }}</span>
              <span v-if="doc.status === 'ready'"> · {{ doc.chunkCount }} 块</span>
              <span v-if="doc.status === 'ready'" class="expand-hint"> · {{ expandedId === doc.id ? '收起' : '查看 chunks' }}</span>
              <span v-if="doc.errorMessage" class="doc-error"> · {{ doc.errorMessage }}</span>
            </div>
          </div>
          <button class="icon-btn danger" @click="remove(doc.id, doc.title)">Del</button>
        </div>

        <!-- Chunks 展开区域 -->
        <div v-if="expandedId === doc.id" class="chunks-area">
          <div v-if="chunksLoading" class="chunk-loading">加载中...</div>
          <div v-else-if="chunks.length === 0" class="chunk-loading">暂无数据</div>
          <div v-else class="chunk-list">
            <div v-for="chunk in chunks" :key="chunk.index" class="chunk-item">
              <span class="chunk-idx">#{{ chunk.index }}</span>
              <pre class="chunk-content">{{ chunk.content }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel { display: flex; flex-direction: column; gap: 12px; }
.panel-header { display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
.header-actions { display: flex; gap: 6px; align-items: center; }
.btn-refresh { background: none; border: 1px solid var(--border); border-radius: 6px; color: var(--text-muted); cursor: pointer; padding: 3px 8px; font-size: 14px; }
.btn-refresh:hover { color: var(--text); }
.btn-upload { background: var(--accent); color: white; border: none; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 13px; }
.btn-upload input { display: none; }
.btn-upload.disabled { opacity: .5; cursor: not-allowed; }
.empty { color: var(--text-dim); font-size: 13px; text-align: center; padding: 16px 0; }
.error-msg { color: var(--danger); font-size: 12px; }

.doc-list { display: flex; flex-direction: column; gap: 4px; }
.doc-item {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: 8px; padding: 8px 10px;
}
.doc-item.expanded { border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom-color: transparent; }
.doc-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.doc-info { flex: 1; min-width: 0; }
.doc-info.clickable { cursor: pointer; }
.doc-info.clickable:hover .doc-title { color: var(--accent); }
.doc-title { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.doc-meta { font-size: 11px; color: var(--text-dim); margin-top: 2px; }
.expand-hint { color: var(--accent); }
.doc-error { color: var(--danger); }
.icon-btn { background: none; border: 1px solid var(--border); border-radius: 4px; cursor: pointer; font-size: 11px; padding: 2px 7px; color: var(--text-muted); flex-shrink: 0; }
.icon-btn.danger:hover { color: var(--danger); border-color: var(--danger); }

.chunks-area {
  background: var(--bg3); border: 1px solid var(--border);
  border-top: none; border-radius: 0 0 8px 8px;
  max-height: 400px; overflow-y: auto; padding: 8px;
}
.chunk-loading { color: var(--text-dim); font-size: 12px; text-align: center; padding: 8px; }
.chunk-list { display: flex; flex-direction: column; gap: 6px; }
.chunk-item { display: flex; gap: 8px; align-items: flex-start; }
.chunk-idx { font-size: 10px; color: var(--text-dim); font-family: var(--font-mono); min-width: 24px; padding-top: 2px; }
.chunk-content {
  flex: 1; font-size: 11px; font-family: var(--font-mono);
  color: var(--text-muted); background: var(--bg2);
  border: 1px solid var(--border); border-radius: 4px;
  padding: 6px 8px; margin: 0; white-space: pre-wrap; word-break: break-all;
  max-height: 120px; overflow-y: auto;
}
</style>
