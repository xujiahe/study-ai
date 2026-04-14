# Node Autogen Demo

Multi-agent system built with Node.js, MCP, LLM (Claude), RAG, and A2A communication.

## Architecture

```
User Request
     │
     ▼
┌─────────────────┐
│  Orchestrator   │  ← decomposes tasks, synthesizes results
└────────┬────────┘
         │  A2A Bus (RxJS pub/sub + request/reply)
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│Research│ │ Coder  │  ← specialist agents
└───┬────┘ └───┬────┘
    │           │
    ▼           ▼
┌───────────────────┐
│   MCP Tool Server │  ← rag_search, web_search, run_code, calculate
└───────────────────┘
    │
    ▼
┌───────────────────┐
│  RAG Vector Store │  ← LangChain + MemoryVectorStore + OpenAI embeddings
└───────────────────┘
```

## Quick Start

```bash
cd node-autogen-demo
npm install
cp .env.example .env
# Fill in ANTHROPIC_API_KEY and OPENAI_API_KEY in .env

npm run dev
```

## Adding Knowledge

Drop `.md` or `.txt` files into the `docs/` folder — they'll be indexed automatically on startup.

## A2A Communication

Agents communicate via the `A2ABus` in `src/a2a/bus.ts`:

```ts
// Request/reply between agents
const result = await bus.request("orchestrator", "researcher", { query: "..." });

// Fire-and-forget broadcast
bus.send({ from: "orchestrator", to: "*", type: "broadcast", payload: { ... } });
```

## Extending

Add a new agent by extending `BaseAgent`:

```ts
export class MyAgent extends BaseAgent {
  constructor() {
    super({ id: "my-agent", name: "MyAgent", systemPrompt: "...", capabilities: [...] });
  }
  protected async handleMessage(msg: A2AMessage) { ... }
}
```

Register it in `src/index.ts` and add a delegation tool to the Orchestrator.
