# RAG Service 架构说明

## 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        study-ai monorepo                        │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   autogen    │    │  langgraph   │    │   agent-chat UI  │  │
│  │  :3001       │    │  :3002       │    │  :5173           │  │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘  │
│         │                  │                      │            │
│         └──────────────────┴──────────────────────┘            │
│                            │ HTTP (X-API-Key)                   │
│                            ▼                                    │
│              ┌─────────────────────────┐                        │
│              │      rag-service :3003  │                        │
│              │                         │                        │
│              │  ┌─────────────────┐    │                        │
│              │  │   Express API   │    │                        │
│              │  │  /health        │    │                        │
│              │  │  /documents     │    │                        │
│              │  │  /retrieve      │    │                        │
│              │  └────────┬────────┘    │                        │
│              │           │             │                        │
│              │  ┌────────▼────────┐    │                        │
│              │  │   IndexQueue    │    │                        │
│              │  │  (FIFO 异步)    │    │                        │
│              │  └────────┬────────┘    │                        │
│              │           │             │                        │
│              │  ┌────────▼────────┐    │                        │
│              │  │    Indexer      │    │                        │
│              │  │  分块+Embedding │    │                        │
│              │  └────────┬────────┘    │                        │
│              │           │             │                        │
│              │  ┌────────▼────────┐    │  ┌──────────────────┐ │
│              │  │  MilvusAdapter  │◄───┼──►│  Milvus :19530   │ │
│              │  └─────────────────┘    │  │  (向量数据库)     │ │
│              │                         │  └──────────────────┘ │
│              │  ┌─────────────────┐    │                        │
│              │  │DocumentRepository│   │                        │
│              │  │  (SQLite 元数据) │   │                        │
│              │  └─────────────────┘    │                        │
│              └─────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
rag-service/
├── src/
│   ├── server.ts          # 入口：组装 Express 应用，启动服务
│   ├── config.ts          # 环境变量配置（端口、Milvus 地址、API Key 等）
│   ├── types.ts           # 共享类型定义（DocumentRecord、VectorChunk 等）
│   │
│   ├── middleware/
│   │   └── auth.ts        # API Key 鉴权中间件（X-API-Key header）
│   │
│   ├── routes/
│   │   ├── documents.ts   # 文档管理路由（上传/列表/状态/chunks/删除）
│   │   └── retrieve.ts    # 向量检索路由（query → embedding → search）
│   │
│   ├── db/
│   │   └── documentRepo.ts # SQLite 文档元数据存储（node:sqlite 内置）
│   │
│   ├── queue/
│   │   └── indexQueue.ts  # 异步 FIFO 索引队列，控制并发
│   │
│   ├── indexer/
│   │   └── indexer.ts     # 文档处理：读取 → 分块 → Embedding → 写入 Milvus
│   │
│   └── store/
│       ├── vectorStore.ts  # VectorStoreAdapter 接口定义
│       └── milvusAdapter.ts # Milvus 实现（HNSW 索引 + Trie scalar index）
│
├── uploads/               # 上传文件存储（UUID 命名，防路径遍历）
├── data/
│   └── rag.db             # SQLite 数据库文件
├── .env.example           # 环境变量模板
└── Dockerfile             # Docker 镜像构建
```

## 数据流

### 文档上传与索引

```
客户端
  │
  │ POST /documents (multipart 或 JSON text)
  │ Header: X-API-Key
  ▼
apiKeyAuth 中间件 ──► 401 (Key 不匹配)
  │
  ▼
documents 路由
  ├── 校验文件类型（.md/.txt/.pdf）
  ├── 校验文件大小（< maxFileSizeMb）
  ├── 校验队列长度（< 100）
  ├── 生成 UUID 作为 docId 和文件名
  ├── 保存文件到 uploads/{docId}.ext
  ├── DocumentRepository.insert(status=pending)
  ├── IndexQueue.enqueue(job)
  └── 返回 202 { docId, status: "pending" }

IndexQueue（后台异步）
  │
  ├── DocumentRepository.updateStatus(indexing)
  │
  ├── Indexer.processDocument(job)
  │     ├── readFile(filePath)
  │     ├── RecursiveCharacterTextSplitter → chunks[]
  │     ├── OpenAIEmbeddings.embedQuery(chunk) × N
  │     └── MilvusAdapter.upsert(docId, chunks)
  │           ├── client.insert(data)
  │           └── client.flushSync()  ← 确保数据持久化
  │
  └── DocumentRepository.updateStatus(ready, chunkCount)
```

### 向量检索

```
Agent（autogen / langgraph）
  │
  │ POST /retrieve { query, k, filter? }
  │ Header: X-API-Key
  ▼
apiKeyAuth 中间件
  │
  ▼
retrieve 路由
  ├── OpenAIEmbeddings.embedQuery(query) → queryVector
  ├── MilvusAdapter.search(queryVector, k, filter)
  │     └── client.search({ data: [queryVector], limit: k, filter })
  └── 返回 { results: [{ content, source, docId, score, chunkIndex }] }
```

### Agent 侧调用（autogen/langgraph）

```
agents/autogen/src/rag/index.ts
  │
  ├── initRAG()     → GET /health（探活，失败仅警告）
  ├── retrieve()    → POST /retrieve
  └── addDocuments() → POST /documents（逐条上传）
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RAG_API_KEY` | 必填 | 所有请求的鉴权 Key |
| `RAG_SERVICE_PORT` | 3003 | HTTP 监听端口 |
| `RAG_MILVUS_ADDRESS` | localhost:19530 | Milvus gRPC 地址 |
| `RAG_MILVUS_COLLECTION` | rag_chunks | Collection 名称 |
| `RAG_UPLOAD_DIR` | ./uploads | 文件存储目录 |
| `RAG_DB_PATH` | ./data/rag.db | SQLite 路径 |
| `RAG_INDEX_CONCURRENCY` | 2 | 并发索引任务数 |
| `RAG_MAX_FILE_SIZE_MB` | 10 | 上传大小限制 |
| `RAG_CHUNK_SIZE` | 500 | 分块字符数 |
| `RAG_CHUNK_OVERLAP` | 50 | 分块重叠字符数 |
| `ZHIPU_API_KEY` | - | 智谱 API Key（优先） |
| `OPENAI_API_KEY` | - | OpenAI API Key（备用） |
| `EMBEDDING_DIM` | 1536 | 向量维度（智谱用 2048） |

## 启动方式

```bash
# 1. 启动 Milvus（Docker）
cd study-ai
docker compose up etcd minio milvus -d

# 2. 启动 rag-service
pnpm rag

# 3. 上传知识库文档
node scripts/seed-rag.mjs

# 4. 验证
curl -H "X-API-Key: your-key" http://localhost:3003/health
curl -H "X-API-Key: your-key" http://localhost:3003/documents
```
