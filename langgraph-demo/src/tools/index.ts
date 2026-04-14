/**
 * LangChain Tools — 供 Agent 节点调用
 * 每个 tool 是一个 DynamicStructuredTool，LangGraph 自动处理调用循环
 */
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { retrieve } from "../rag/index.js";

// ── RAG 检索 ──────────────────────────────────────────────────────────────────
export const ragSearchTool = new DynamicStructuredTool({
  name: "rag_search",
  description: "在内部知识库中进行语义检索，获取相关文档内容",
  schema: z.object({
    query: z.string().describe("检索查询词"),
    topK: z.number().optional().default(4).describe("返回结果数量"),
  }),
  func: async ({ query, topK }) => retrieve(query, topK),
});

// ── DuckDuckGo 网络搜索 ───────────────────────────────────────────────────────
export const webSearchTool = new DynamicStructuredTool({
  name: "web_search",
  description: "通过 DuckDuckGo 搜索网络上的最新信息",
  schema: z.object({ query: z.string().describe("搜索关键词") }),
  func: async ({ query }) => {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = await res.json() as { AbstractText?: string; AbstractURL?: string; RelatedTopics?: { Text?: string }[] };
      const parts: string[] = [];
      if (data.AbstractText) parts.push(`${data.AbstractText}\n${data.AbstractURL ?? ""}`);
      data.RelatedTopics?.slice(0, 4).filter((t) => t.Text).forEach((t) => parts.push(`- ${t.Text}`));
      return parts.join("\n") || `未找到关于"${query}"的结果`;
    } catch (err) {
      return `搜索失败: ${(err as Error).message}`;
    }
  },
});

// ── JavaScript 代码执行 ───────────────────────────────────────────────────────
export const runCodeTool = new DynamicStructuredTool({
  name: "run_code",
  description: "在沙箱中执行 JavaScript 代码，验证可运行性并返回输出",
  schema: z.object({ code: z.string().describe("要执行的 JavaScript 代码") }),
  func: async ({ code }) => {
    try {
      const logs: string[] = [];
      const fn = new Function("console", `"use strict"; ${code}`);
      fn({ log: (...a: unknown[]) => logs.push(a.map(String).join(" ")), error: (...a: unknown[]) => logs.push("ERR: " + a.map(String).join(" ")) });
      return logs.join("\n") || "(无输出)";
    } catch (err) {
      return `执行错误: ${(err as Error).message}`;
    }
  },
});

// ── 数学计算 ──────────────────────────────────────────────────────────────────
export const calculateTool = new DynamicStructuredTool({
  name: "calculate",
  description: "对数学表达式求值",
  schema: z.object({ expression: z.string().describe("数学表达式，如 'Math.sqrt(144)'") }),
  func: async ({ expression }) => {
    try {
      return String(Function(`"use strict"; return (${expression})`)());
    } catch (err) {
      return `计算错误: ${(err as Error).message}`;
    }
  },
});

// ── 当前时间 ──────────────────────────────────────────────────────────────────
export const datetimeTool = new DynamicStructuredTool({
  name: "datetime",
  description: "获取当前日期和时间",
  schema: z.object({ timezone: z.string().optional().default("Asia/Shanghai").describe("IANA 时区") }),
  func: async ({ timezone }) => {
    const now = new Date();
    try {
      const fmt = new Intl.DateTimeFormat("zh-CN", {
        timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      }).format(now);
      return `当前时间 (${timezone}): ${fmt}`;
    } catch {
      return `UTC: ${now.toUTCString()}`;
    }
  },
});

// ── HTTP 抓取 ─────────────────────────────────────────────────────────────────
export const httpFetchTool = new DynamicStructuredTool({
  name: "http_fetch",
  description: "抓取指定 URL 的页面内容",
  schema: z.object({ url: z.string().url().describe("目标 URL") }),
  func: async ({ url }) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const text = await res.text();
      return `HTTP ${res.status}\n\n${text.slice(0, 3000)}${text.length > 3000 ? "\n…[截断]" : ""}`;
    } catch (err) {
      return `请求失败: ${(err as Error).message}`;
    }
  },
});

/** Researcher Agent 使用的工具集 */
export const researcherTools = [ragSearchTool, webSearchTool, datetimeTool, httpFetchTool];

/** Coder Agent 使用的工具集 */
export const coderTools = [runCodeTool, calculateTool];
