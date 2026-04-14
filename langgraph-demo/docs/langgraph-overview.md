# LangGraph 概述

LangGraph 是 LangChain 团队开发的有状态多 Agent 编排框架，基于有向图（DAG）模型。

## 核心概念

- **StateGraph**：带状态的有向图，每个节点可读写共享状态
- **Node**：图中的处理单元，可以是 LLM 调用、工具执行或自定义函数
- **Edge**：节点间的连接，支持条件路由（ConditionalEdge）
- **Checkpointer**：状态持久化，支持对话历史和断点续传

## 与 LangChain 的关系

LangGraph 构建在 LangChain 之上，复用其 ChatModel、Tool、Message 等抽象，
但提供了更强的流程控制能力，适合复杂的多步骤、多 Agent 场景。

## Supervisor 模式

本项目采用 Supervisor 模式：
1. Supervisor 节点分析用户请求，决定路由
2. 专项 Agent（Researcher/Coder）执行具体任务
3. 执行完成后回到 Supervisor，决定是否继续或结束

## 与 node-autogen-demo 的对比

| 特性 | node-autogen-demo | langgraph-demo |
|------|-------------------|----------------|
| Agent 通信 | 自定义 A2A Bus (RxJS) | LangGraph StateGraph |
| 工具调用 | 手动 tool_use 循环 | 内置 ToolNode + ReAct |
| 状态管理 | 手动维护消息历史 | MessagesAnnotation 自动管理 |
| 流式输出 | 手动逐词推送 | 原生 stream() 支持 |
| 可视化 | 无 | LangSmith 追踪 |
