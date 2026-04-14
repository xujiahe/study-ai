# LangGraph Agent 架构说明

## 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                   langgraph agent (:3002)                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              HTTP + WebSocket 服务器                      │   │
│  │  GET /api/health                                         │   │
│  │  WebSocket: /ws                                          │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │ 用户消息                           │
│                             ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              LangGraph StateGraph                        │   │
│  │                                                          │   │
│  │   __start__                                              │   │
│  │       │                                                  │   │
│  │       ▼                                                  │   │
│  │  [supervisor] ──────────────────────────────► END        │   │
│  │       │                    ▲                             │   │
│  │       ├──► [researcher] ───┤                             │   │
│  │       │                   │                             │   │
│  │       └──► [coder]    ────┘                             │   │
│  │                                                          │   │
│  │  每个节点是绑定了工具的 ReAct Agent                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Researcher  │    │    Coder     │    │   rag-service    │   │
│  │  工具：       │    │  工具：       │    │   (:3003)        │   │
│  │  rag_search  │───►│  run_code    │    │                  │   │
│  │  web_search  │    │  calculate   │    │                  │   │
│  └──────────────┘    └──────────────┘    └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
langgraph/
├── src/
│   ├── server.ts    # HTTP + WebSocket 服务器（端口 3002）
│   ├── index.ts     # CLI 批量演示入口
│   ├── graph.ts     # LangGraph 图定义（Supervisor 模式）
│   ├── llm.ts       # LLM 工厂（返回 LangChain ChatModel）
│   │
│   ├── rag/
│   │   └── index.ts # RAG 模块（HTTP 代理到 rag-service）
│   │
│   └── tools/
│       └── index.ts # 工具定义（rag_search、web_search、run_code 等）
│
└── docs/            # 知识库文档
```

## 数据流

### Supervisor 路由模式

```
用户消息
  │
  ▼
supervisor 节点
  ├── 分析对话历史
  ├── LLM 决策：researcher | coder | FINISH
  │
  ├── → researcher 节点
  │       ├── ReAct 循环：Reason → rag_search → Observe → ...
  │       └── 结果追加到消息历史，返回 supervisor
  │
  ├── → coder 节点
  │       ├── ReAct 循环：Reason → run_code → Observe → ...
  │       └── 结果追加到消息历史，返回 supervisor
  │
  └── → FINISH（END）
        └── 返回最后一条 AI 消息作为最终答案
```

### 与 autogen 的对比

| 特性 | autogen | langgraph |
|------|---------|-----------|
| 架构模式 | 自定义 A2A 总线 | LangGraph StateGraph |
| Agent 通信 | RxJS Subject 消息总线 | 图节点间状态传递 |
| LLM 抽象 | 自定义 LLMProvider 接口 | LangChain ChatModel |
| 工具调用 | 手动 tool_use 循环 | createReactAgent 自动处理 |
| 状态管理 | 内存（每次请求独立） | MessagesAnnotation 状态图 |
| 适合场景 | 复杂多 Agent 协作 | 标准 RAG + 代码生成流程 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_MODEL` | glm-5 | 模型名称 |
| `ZHIPU_API_KEY` | - | 智谱 API Key（优先） |
| `OPENAI_API_KEY` | - | OpenAI API Key（备用） |
| `RAG_SERVICE_URL` | http://localhost:3003 | RAG 服务地址 |
| `RAG_API_KEY` | - | RAG 服务鉴权 Key |
| `API_PORT` | 3002 | HTTP 服务端口 |
