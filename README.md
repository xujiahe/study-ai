# study-ai monorepo

```
study-ai/
├── packages/
│   └── agent-chat/     # 共享前端 UI（Vue + Vite）
└── agents/
    ├── autogen/        # AutoGen agent 服务端（端口 3001）
    └── langgraph/      # LangGraph agent 服务端（端口 3002）
```

## 快速开始

```bash
# 安装所有依赖
pnpm install

# 一行启动 autogen 服务端 + UI
pnpm start:autogen     # → agent: http://localhost:3001  UI: http://localhost:5173

# 一行启动 langgraph 服务端 + UI
pnpm start:langgraph   # → agent: http://localhost:3002  UI: http://localhost:5173
```

## 新增 agent

1. 在 `agents/` 下新建目录，实现 HTTP + WebSocket 服务端（参考 autogen）
2. 在根 `package.json` 的 scripts 里加一行启动命令
3. UI 无需改动，设置 `VITE_API_URL` 指向新服务端即可
