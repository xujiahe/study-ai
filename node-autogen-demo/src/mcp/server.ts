/**
 * MCP Tool Server (SDK v1.x new API)
 * Tools: rag_search, web_search, run_code, calculate, read_file, write_file, datetime, http_fetch
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { retrieve, initRAG } from "../rag/index.js";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_PATH = resolve(__dirname, "../../docs");
const WORKSPACE = resolve(__dirname, "../../workspace");

const server = new McpServer({ name: "autogen-tools", version: "1.0.0" });

// ── RAG search ────────────────────────────────────────────────────────────────
server.tool(
  "rag_search",
  { query: z.string().describe("Search query"), topK: z.number().optional().default(4) },
  async ({ query, topK }) => ({
    content: [{ type: "text" as const, text: await retrieve(query, topK) }],
  })
);

// ── Web search (DuckDuckGo instant answer) ────────────────────────────────────
server.tool(
  "web_search",
  { query: z.string().describe("Search query") },
  async ({ query }) => {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = await res.json() as {
        AbstractText?: string; AbstractURL?: string;
        RelatedTopics?: { Text?: string; FirstURL?: string }[];
      };
      const parts: string[] = [];
      if (data.AbstractText) parts.push(`**Summary:** ${data.AbstractText}\n${data.AbstractURL ?? ""}`);
      data.RelatedTopics?.slice(0, 5).filter((t) => t.Text)
        .forEach((t) => parts.push(`- ${t.Text} ${t.FirstURL ? `(${t.FirstURL})` : ""}`));
      return { content: [{ type: "text" as const, text: parts.join("\n\n") || `No results for: ${query}` }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `Search failed: ${(err as Error).message}` }], isError: true };
    }
  }
);

// ── Run JavaScript ────────────────────────────────────────────────────────────
server.tool(
  "run_code",
  { code: z.string().describe("JavaScript code to execute") },
  async ({ code }) => {
    try {
      const logs: string[] = [];
      const fn = new Function("console", `"use strict"; ${code}`);
      fn({
        log: (...a: unknown[]) => logs.push(a.map(String).join(" ")),
        error: (...a: unknown[]) => logs.push("ERR: " + a.map(String).join(" ")),
        warn: (...a: unknown[]) => logs.push("WARN: " + a.map(String).join(" ")),
      });
      return { content: [{ type: "text" as const, text: logs.join("\n") || "(no output)" }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// ── Calculator ────────────────────────────────────────────────────────────────
server.tool(
  "calculate",
  { expression: z.string().describe("Math expression, e.g. 'Math.sqrt(144) + 2 * 10'") },
  async ({ expression }) => {
    try {
      const result = Function(`"use strict"; return (${expression})`)();
      return { content: [{ type: "text" as const, text: String(result) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// ── Read file ─────────────────────────────────────────────────────────────────
server.tool(
  "read_file",
  { path: z.string().describe("Relative path inside workspace/") },
  async ({ path }) => {
    try {
      const safe = resolve(WORKSPACE, path);
      if (!safe.startsWith(WORKSPACE)) throw new Error("Path traversal not allowed");
      const content = await readFile(safe, "utf-8");
      return { content: [{ type: "text" as const, text: content }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// ── Write file ────────────────────────────────────────────────────────────────
server.tool(
  "write_file",
  {
    path: z.string().describe("Relative path inside workspace/"),
    content: z.string().describe("File content to write"),
  },
  async ({ path, content }) => {
    try {
      const safe = resolve(WORKSPACE, path);
      if (!safe.startsWith(WORKSPACE)) throw new Error("Path traversal not allowed");
      await mkdir(dirname(safe), { recursive: true });
      await writeFile(safe, content, "utf-8");
      return { content: [{ type: "text" as const, text: `Written ${content.length} chars to workspace/${path}` }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// ── Date / Time ───────────────────────────────────────────────────────────────
server.tool(
  "datetime",
  { timezone: z.string().optional().default("Asia/Shanghai").describe("IANA timezone") },
  async ({ timezone }) => {
    const now = new Date();
    try {
      const fmt = new Intl.DateTimeFormat("zh-CN", {
        timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      }).format(now);
      return { content: [{ type: "text" as const, text: `当前时间 (${timezone}): ${fmt}\nUTC: ${now.toUTCString()}\nTimestamp: ${now.getTime()}` }] };
    } catch {
      return { content: [{ type: "text" as const, text: `UTC: ${now.toUTCString()}` }] };
    }
  }
);

// ── HTTP fetch ────────────────────────────────────────────────────────────────
server.tool(
  "http_fetch",
  { url: z.string().url().describe("URL to fetch (GET)"), headers: z.record(z.string()).optional() },
  async ({ url, headers }) => {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "autogen-mcp/1.0", ...headers },
        signal: AbortSignal.timeout(10000),
      });
      const text = await res.text();
      const out = text.length > 4000 ? text.slice(0, 4000) + "\n…[truncated]" : text;
      return { content: [{ type: "text" as const, text: `HTTP ${res.status}\n\n${out}` }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────
async function main() {
  await initRAG(DOCS_PATH);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP Server] Running — tools: rag_search, web_search, run_code, calculate, read_file, write_file, datetime, http_fetch");
}

main().catch(console.error);
