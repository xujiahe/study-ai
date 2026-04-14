# Model Context Protocol (MCP)

MCP is an open protocol by Anthropic that standardizes how AI models connect to external tools and data sources.

## Architecture
- **MCP Server**: exposes tools, resources, and prompts
- **MCP Client**: the LLM host that connects to servers
- **Transport**: stdio (local) or HTTP/SSE (remote)

## Key concepts
- **Tools**: callable functions the model can invoke (like function calling)
- **Resources**: data sources the model can read (files, databases, APIs)
- **Prompts**: reusable prompt templates

## Benefits
- Standardized interface — one protocol for all tools
- Language agnostic — servers can be written in any language
- Composable — connect multiple servers to one client

## This project
This demo uses MCP to expose RAG search, web search, code execution, and calculator tools
to the agent system via the `@modelcontextprotocol/sdk`.
