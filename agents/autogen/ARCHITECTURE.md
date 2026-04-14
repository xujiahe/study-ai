# Autogen Agent 架构说明

## 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                     autogen agent (:3001)                           │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    HTTP + WebSocket 服务                      │   │
│  │  REST API: /api/skills  /api/mcp  /api/settings/model        │   │
│  │  WebSocket: /ws  (双向实时通信)                               │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │ 用户消息                               │
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  OrchestratorAgent                           │   │
│  │                                                              │   │
│  │  接收用户请求 → LLM 决策 → 工具调用 → 汇总结果               │   │
│  │                                                              │   │
│  │  内置工具：                                                   │   │
│  │    delegate_to_researcher  委托研究任务                       │   │
│  │    delegate_to_coder       委托编码任务                       │   │
│  │    datetime / http_fetch / web_search                        │   │
│  │    run_skill_script        执行 Skill 脚本                   │   │
│  └──────────────┬──────────────────────┬────────────────────────┘   │
│                 │ A2A 消息总线          │                            │
│        ┌────────▼────────┐    ┌────────▼────────┐                  │
│        │ ResearcherAgent │    │   CoderAgent    │                  │
│        │                 │    │                 │                  │
│        │ 工具：           │    │ 工具：           │                  │
│        │  rag_search     │    │  run_code       │                  │
│        │                 │    │  calculate      │                  │
│        │                 │    │  read_file      │                  │
│        │                 │    │  write_file     │                  │
│        └────────┬────────┘    └────────┬────────┘                  │
│                 │                      │                            │
│                 ▼                      ▼                            │
│        ┌────────────────┐    ┌──────────────────┐                  │
│        │  rag-service   │    │   workspace/     │                  │
│        │  (:3003)       │    │  (代码沙箱目录)   │                  │
│        └────────────────┘    └──────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
autogen/
├── src/
│   ├── server.ts          # 主入口：HTTP + WebSocket 服务器（端口 3001）
│   ├── index.ts           # CLI 批量演示入口（不启动 HTTP 服务）
│   │
│   ├── agents/
│   │   ├── base.ts        # BaseAgent 抽象基类（LLM 调用循环、A2A 注册）
│   │   ├── orchestrator.ts # 主调度 Agent（接收用户请求，分发给专项 Agent）
│   │   ├── researcher.ts  # 知识检索 Agent（RAG 搜索）
│   │   └── coder.ts       # 代码生成 Agent（代码执行沙箱）
│   │
│   ├── a2a/
│   │   └── bus.ts         # Agent-to-Agent 消息总线（RxJS Subject）
│   │
│   ├── llm/
│   │   ├── factory.ts     # LLM 工厂函数（根据环境变量创建 Provider）
│   │   ├── types.ts       # LLM 统一接口定义（与具体 SDK 解耦）
│   │   └── providers/     # 各 LLM Provider 实现
│   │       ├── anthropic.ts
│   │       ├── openai.ts
│   │       ├── ollama.ts
│   │       └── zhipu.ts
│   │
│   ├── rag/
│   │   └── index.ts       # RAG 模块（HTTP 代理到 rag-service）
│   │
│   ├── skills/
│   │   └── loader.ts      # Skills 加载器（扫描 skills/ 目录）
│   │
│   ├── utils/
│   │   └── logger.ts      # 步骤日志器（终端彩色输出 + WebSocket 推送）
│   │
│   ├── cli/
│   │   └── index.ts       # 交互式 CLI REPL
│   │
│   ├── mcp/
│   │   └── server.ts      # MCP 工具服务器
│   │
│   └── server/            # 备用服务器入口（持久化版本）
│       ├── index.ts
│       ├── ws.ts
│       └── store.ts
│
├── skills/                # 内置 Skills 目录
│   ├── chinese-assistant/
│   ├── code-formatter/
│   ├── code-reviewer/
│   ├── concise-mode/
│   ├── data-analyzer/
│   └── typescript-expert/
│
├── docs/                  # 知识库文档（上传到 rag-service）
└── workspace/             # Coder Agent 的文件读写沙箱
```

## 数据流

### 用户发送消息

```
浏览器 (agent-chat UI)
  │
  │ WebSocket: { type: "chat", content: "用户消息" }
  ▼
server.ts (WebSocket 处理器)
  ├── 注入已启用的 Skills 的 systemPrompt
  ├── logger.reset()  重置步骤计数器
  ├── send({ type: "chat_start", messageId })
  │
  ▼
OrchestratorAgent.run(userMessage)
  │
  ├── LLM 调用（第 1 轮）
  │     └── LLM 返回 tool_use: delegate_to_researcher
  │
  ├── A2ABus.request("orchestrator", "researcher", { query })
  │     │
  │     ▼
  │   ResearcherAgent.handleMessage(msg)
  │     ├── LLM 调用（第 1 轮）
  │     │     └── LLM 返回 tool_use: rag_search
  │     ├── retrieve(query) → POST http://rag-service:3003/retrieve
  │     ├── LLM 调用（第 2 轮，携带 RAG 结果）
  │     │     └── LLM 返回 end_turn: "答案..."
  │     └── bus.reply(msg, { answer: "..." })
  │
  ├── LLM 调用（第 2 轮，携带 Researcher 结果）
  │     └── LLM 返回 end_turn: "最终答案"
  │
  └── 返回最终文本
        │
        ▼
server.ts
  ├── 逐词 send({ type: "chat_delta", delta: word })
  └── send({ type: "chat_done", fullText })

同时，每个步骤通过 logger.emit("step") → WebSocket 推送 step 事件
前端 ChatMessage 组件实时展示调用链
```

### A2A 消息总线

```
OrchestratorAgent
  │
  │ bus.request("orchestrator", "researcher", payload)
  │   ├── 生成 correlationId
  │   ├── 订阅 correlationId 匹配的回复
  │   └── bus.send({ type: "task", to: "researcher", correlationId })
  │
  ▼
A2ABus (RxJS Subject)
  │
  ▼
ResearcherAgent (订阅了发给 "researcher" 的消息)
  │
  │ 处理完成后
  │ bus.reply(originalMsg, "researcher", { answer })
  │   └── bus.send({ type: "result", to: "orchestrator", correlationId })
  │
  ▼
A2ABus
  │
  ▼
OrchestratorAgent (firstValueFrom 等待 correlationId 匹配的 result)
  └── 返回 { answer }
```

## LLM 调用循环（tool_use loop）

```
BaseAgent.llmCall(userMessage, tools)
  │
  ▼
第 1 轮：LLM.call({ system, messages, tools })
  │
  ├── stopReason === "end_turn" → 直接返回 text
  │
  └── stopReason === "tool_use"
        ├── 将 tool_use 块追加到 messages（assistant 角色）
        ├── 执行每个工具：executeTool(name, input)
        ├── 将工具结果追加到 messages（user 角色，tool_result 块）
        └── 第 2 轮：LLM.call({ system, messages, tools })
              └── ... 循环直到 end_turn
```

## Skills 系统

```
skills/
└── typescript-expert/
    ├── SKILL.md          # front-matter: name, version, enabled, description
    │                     # body: system prompt（注入到每次对话）
    ├── reference.md      # 追加到 system prompt 的参考资料（可选）
    └── scripts/
        └── cli.ts        # 可被 Orchestrator 通过 run_skill_script 工具调用

启用的 Skill 的 systemPrompt 会在每次用户消息前注入：
  [Skill: TypeScript Expert]
  <systemPrompt 内容>
  ---
  <用户消息>
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_PROVIDER` | anthropic | LLM 提供商 |
| `LLM_MODEL` | 各 provider 默认 | 模型名称 |
| `ZHIPU_API_KEY` | - | 智谱 API Key |
| `ANTHROPIC_API_KEY` | - | Anthropic API Key |
| `OPENAI_API_KEY` | - | OpenAI API Key |
| `OLLAMA_BASE_URL` | localhost:11434/v1 | Ollama 地址 |
| `RAG_SERVICE_URL` | http://localhost:3003 | RAG 服务地址 |
| `RAG_API_KEY` | - | RAG 服务鉴权 Key |
| `API_PORT` | 3001 | HTTP 服务端口 |
