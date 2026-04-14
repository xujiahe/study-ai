# study-ai monorepo

AI Agent 学习项目，包含两种多 Agent 实现方案和共享的 RAG 服务。

## 整体架构

```
study-ai/
├── agent-chat/          # 共享前端 UI（Vue + Vite，:5173）
│
├── agents/
│   ├── autogen/         # 自定义 A2A 总线方案（:3001）
│   │   └── ARCHITECTURE.md
│   ├── langgraph/       # LangGraph StateGraph 方案（:3002）
│   │   └── ARCHITECTURE.md
│   └── rag-service/     # 共享 RAG 服务（:3003）
│       └── ARCHITECTURE.md
│
├── scripts/
│   └── seed-rag.mjs     # 批量上传知识库文档脚本
│
└── docker-compose.yml   # Milvus 向量数据库（etcd + minio + milvus）
```

## 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| agent-chat UI | 5173 | Vue 前端，连接 agent 服务端 |
| autogen | 3001 | 自定义 A2A 多 Agent 系统 |
| langgraph | 3002 | LangGraph 多 Agent 系统 |
| rag-service | 3003 | 向量检索服务（Milvus） |
| Milvus gRPC | 19530 | 向量数据库 |

## 快速开始

### 1. 安装依赖

```bash
cd study-ai
pnpm install
```

### 2. 配置环境变量

```bash
cp agents/autogen/.env.example agents/autogen/.env
cp agents/langgraph/.env.example agents/langgraph/.env
cp agents/rag-service/.env.example agents/rag-service/.env
```

最少需要填写：
- `ZHIPU_API_KEY`（或 `OPENAI_API_KEY`）
- `RAG_API_KEY`（自定义一个字符串，如 `my-dev-key`）

### 3. 启动 Milvus

```bash
docker compose up etcd minio milvus -d
# 等待约 30-60 秒，直到 milvus 状态变为 healthy
docker compose ps
```

### 4. 启动 RAG 服务

```bash
pnpm rag
```

### 5. 上传知识库文档

```bash
# 将 study-review/ 下的所有 .md 文档上传到 RAG 服务
$env:RAG_SERVICE_URL="http://localhost:3003"
$env:RAG_API_KEY="your-key"
node scripts/seed-rag.mjs
```

### 6. 启动 Agent + UI

```bash
# 使用 autogen 方案
pnpm start:autogen

# 或使用 langgraph 方案
pnpm start:langgraph
```

访问 http://localhost:5173

## 常用命令

```bash
pnpm start:autogen    # 一键启动 autogen + UI
pnpm start:langgraph  # 一键启动 langgraph + UI
pnpm rag              # 单独启动 rag-service
pnpm build:all        # 构建所有包
```

## 架构文档

- [autogen 架构](agents/autogen/ARCHITECTURE.md)
- [langgraph 架构](agents/langgraph/ARCHITECTURE.md)
- [rag-service 架构](agents/rag-service/ARCHITECTURE.md)
