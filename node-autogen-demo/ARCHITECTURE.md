# node-autogen-demo 架构文档

## 项目概览

基于 Node.js 的多 Agent 系统，集成 MCP 工具协议、多 LLM 提供商、RAG 知识检索和 A2A Agent 间通信，配套 Vue 3 Web UI。

---

## 目录结构

```
node-autogen-demo/
├── src/
│   ├── a2a/
│   │   └── bus.ts              # Agent 间消息总线
│   ├── agents/
│   │   ├── base.ts             # BaseAgent 抽象类
│   │   ├── orchestrator.ts     # 调度 Agent
│   │   ├── researcher.ts       # 知识检索 Agent
│   │   └── coder.ts            # 代码生成 Agent
│   ├── llm/
│   │   ├── types.ts            # LLMProvider 统一接口
│   │   ├── factory.ts          # createLLM() 工厂函数
│   │   └── providers/
│   │       ├── anthropic.ts    # Claude 系列
│   │       ├── openai.ts       # GPT 系列
│   │       ├── ollama.ts       # 本地模型
│   │       └── zhipu.ts        # 智谱 GLM 系列
│   ├── rag/
│   │   └── index.ts            # RAG 向量检索模块
│   ├── mcp/
│   │   └── server.ts           # MCP 工具服务器（stdio）
│   ├── server.ts               # HTTP + WebSocket API 服务（port 3001）
│   └── index.ts                # CLI 批量运行入口
├── ui/                         # Vue 3 前端
│   └── src/
│       ├── App.vue
│       ├── stores/
│       │   ├── chat.ts         # WebSocket 聊天状态
│       │   └── settings.ts     # 模型/Skills/MCP 设置
│       └── components/
│           ├── ChatMessage.vue
│           ├── ChatInput.vue
│           ├── ModelSelector.vue
│           ├── SkillsPanel.vue
│           └── McpPanel.vue
├── docs/                       # RAG 知识库文档（.md / .txt）
└── .env                        # 环境变量配置
```

---

## 系统架构图

```
浏览器 (localhost:5173)
        │  HTTP + WebSocket
        ▼
┌─────────────────────────────┐
│   Express + WS Server       │  port 3001
│   src/server.ts             │
│                             │
│  REST API:                  │
│   GET/POST /api/skills      │
│   GET/POST /api/mcp         │
│   POST /api/settings/model  │
└──────────┬──────────────────┘
           │ 调用
           ▼
┌─────────────────────────────┐
│      OrchestratorAgent      │  接收用户消息，分解任务
│      src/agents/            │  通过 LLM tool_use 决策
│      orchestrator.ts        │
└────────┬──────────┬─────────┘
         │ A2A Bus  │ A2A Bus
    ┌────▼────┐ ┌───▼────┐
    │Research │ │ Coder  │   专项 Agent
    │  Agent  │ │ Agent  │
    └────┬────┘ └───┬────┘
         │          │
         ▼          ▼
    rag_search   run_code
    (RAG检索)   (代码执行)
         │
         ▼
┌─────────────────────────────┐
│         RAG 模块            │
│   src/rag/index.ts          │
│                             │
│  向量存储: MemoryVectorStore │
│  Embeddings: 智谱 embedding-3│
│  降级: 关键词搜索            │
└─────────────────────────────┘

┌─────────────────────────────┐
│      MCP Tool Server        │  独立进程，stdio 传输
│   src/mcp/server.ts         │
│                             │
│  Tools:                     │
│   rag_search                │
│   web_search (mock)         │
│   run_code                  │
│   calculate                 │
└─────────────────────────────┘
```

---

## 核心模块说明

### 1. A2A 消息总线 (`src/a2a/bus.ts`)

基于 RxJS Subject 实现的进程内消息总线，支持两种通信模式：

| 模式 | 方法 | 说明 |
|------|------|------|
| 请求/响应 | `bus.request(from, to, payload)` | 发送任务并等待结果，默认 60s 超时 |
| 发布/订阅 | `bus.send({ to: "*", ... })` | 广播消息给所有 Agent |

Agent 注册时声明自己的 `capabilities`，其他 Agent 可通过 `bus.findByCapability()` 发现。

### 2. LLM 抽象层 (`src/llm/`)

统一的 `LLMProvider` 接口，屏蔽各厂商 SDK 差异：

```typescript
interface LLMProvider {
  readonly name: string;
  readonly model: string;
  call(options: LLMCallOptions): Promise<LLMResponse>;
}
```

**支持的提供商：**

| Provider | 默认模型 | 所需环境变量 |
|----------|----------|-------------|
| `zhipu` | `glm-4.5` | `ZHIPU_API_KEY` |
| `anthropic` | `claude-opus-4-5` | `ANTHROPIC_API_KEY` |
| `openai` | `gpt-4o` | `OPENAI_API_KEY` |
| `ollama` | `llama3.2` | 无（本地运行） |

**智谱可用模型：**

| 模型 | 特点 |
|------|------|
| `glm-4.5` | 旗舰 Agent，355B/32B active |
| `glm-4.5-air` | 轻量旗舰，106B/12B active |
| `glm-4.5-flash` | 免费，适合编码/推理 |
| `glm-4.5v` | 多模态，支持图片/视频/文档 |

**每个 Agent 可独立指定模型：**
```typescript
new CoderAgent({ llm: { provider: "zhipu", model: "glm-4.5-flash" } })
```

### 3. Agent 系统 (`src/agents/`)

所有 Agent 继承 `BaseAgent`，内置 tool_use 循环：

```
用户消息
  → llmCall()
  → LLM 返回 tool_use
  → executeTool() 执行工具
  → 结果追加到消息历史
  → 继续调用 LLM
  → LLM 返回 end_turn
  → 返回最终文本
```

**三个 Agent 的职责：**

- **OrchestratorAgent** — 接收用户请求，用 `delegate_to_researcher` / `delegate_to_coder` 工具分发任务，汇总结果
- **ResearcherAgent** — 调用 `rag_search` 检索知识库，合成答案
- **CoderAgent** — 调用 `run_code` 在沙箱中测试代码，返回可运行的实现

### 4. RAG 模块 (`src/rag/index.ts`)

- 启动时扫描 `docs/` 目录下所有 `.md` / `.txt` 文件
- 用 `RecursiveCharacterTextSplitter` 分块（默认 500 字符，50 重叠）
- 优先使用智谱 `embedding-3` 生成向量（复用 `ZHIPU_API_KEY`）
- 无 API Key 时自动降级为关键词 TF 评分搜索
- 运行时可通过 `addDocuments()` 动态追加文档

### 5. MCP 工具服务器 (`src/mcp/server.ts`)

独立进程，通过 stdio 传输暴露 4 个工具：

| 工具 | 说明 |
|------|------|
| `rag_search` | 语义检索知识库 |
| `web_search` | 网络搜索（当前为 mock，可接入 Tavily/Brave） |
| `run_code` | 沙箱执行 JavaScript |
| `calculate` | 数学表达式求值 |

### 6. API Server (`src/server.ts`)

Express + ws，监听 3001 端口：

**REST 接口：**
- `GET/POST/PUT/DELETE /api/skills` — Skills 管理（注入 system prompt）
- `GET/POST/PUT/DELETE /api/mcp` — MCP 服务器配置管理
- `POST /api/settings/model` — 运行时切换 LLM 模型

**WebSocket (`/ws`)：**
- 客户端发送 `{ type: "chat", content: "..." }`
- 服务端推送事件流：
  - `chat_start` — 开始响应
  - `chat_delta` — 逐词流式输出
  - `agent_trace` — Agent 调用链（显示在 UI 气泡下方）
  - `chat_done` — 完整响应
  - `error` — 错误信息

---

## 环境变量

```env
# 必填
ZHIPU_API_KEY=your_key

# LLM 配置
LLM_PROVIDER=zhipu          # anthropic | openai | ollama | zhipu
LLM_MODEL=glm-4.5           # 留空使用各 provider 默认值
ZHIPU_THINKING=false        # 开启深度思考模式

# RAG
RAG_CHUNK_SIZE=500
RAG_CHUNK_OVERLAP=50

# 服务端口
API_PORT=3001               # 后端端口（默认 3001）

# Ollama（本地模型）
OLLAMA_BASE_URL=http://localhost:11434/v1
```

---

## 启动方式

```bash
# 终端 1 — 后端
cd node-autogen-demo
npm run dev:server

# 终端 2 — 前端
cd node-autogen-demo/ui
npm run dev

# 浏览器访问
open http://localhost:5173
```

**CLI 批量模式（无 UI）：**
```bash
npm run dev   # 运行 src/index.ts 中的预设任务
```

**MCP 服务器（独立）：**
```bash
npm run mcp-server
```

---

## 扩展指南

### 添加新 Agent

```typescript
// src/agents/myAgent.ts
export class MyAgent extends BaseAgent {
  constructor() {
    super({
      id: "my-agent",
      name: "MyAgent",
      systemPrompt: "你的 system prompt",
      capabilities: [{ name: "my_skill", description: "...", inputSchema: {} }],
    });
  }
  protected async handleMessage(msg: A2AMessage) {
    const result = await this.llmCall(msg.payload.task, MY_TOOLS);
    bus.reply(msg, this.config.id, { result });
  }
}
```

然后在 `src/server.ts` 的 `bootAgents()` 中注册，并在 `OrchestratorAgent` 的 TOOLS 里加一个 `delegate_to_my_agent` 工具。

### 添加知识库文档

直接把 `.md` 或 `.txt` 文件放入 `docs/` 目录，重启后端即可自动索引。

### 接入真实网络搜索

在 `src/mcp/server.ts` 的 `web_search` 工具里替换 mock 实现：

```typescript
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
const search = new TavilySearchResults({ apiKey: process.env.TAVILY_API_KEY });
const result = await search.invoke(query);
```
