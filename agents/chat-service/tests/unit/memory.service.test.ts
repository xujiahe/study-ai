import { describe, test, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

// Mock config before importing memory service
vi.mock("../../src/config.js", () => ({
  config: {
    LLM_CONTEXT_WINDOW: 128000,
    COMPRESSION_THRESHOLD: 0.7,
    COMPRESSION_KEEP_RECENT: 6,
    OPENAI_API_KEY: "test-key",
    OPENAI_BASE_URL: "https://api.openai.com/v1",
    LLM_MODEL: "gpt-4o-mini",
    PORT: 3010,
    NODE_ENV: "test",
    DB_PATH: ":memory:",
  },
}));

// Mock tiktoken to avoid native module issues in tests
vi.mock("tiktoken", () => ({
  get_encoding: () => ({
    encode: (text: string) => new Uint32Array(Math.ceil(text.length / 4)),
    free: () => {},
  }),
}));

// Mock LLM service
vi.mock("../../src/services/llm.service.js", () => ({
  complete: vi.fn().mockResolvedValue("这是一段历史对话摘要"),
}));

import { buildContext } from "../../src/services/memory.service.js";
import { complete } from "../../src/services/llm.service.js";
import type { Message } from "../../src/db/schema.js";

// 辅助函数：创建测试用 Message
function makeMessage(
  role: "user" | "assistant" | "system",
  content: string,
  index: number = 0
): Message {
  return {
    id: `msg-${index}`,
    session_id: "test-session",
    role,
    content,
    prompt_tokens: null,
    completion_tokens: null,
    total_tokens: null,
    created_at: new Date(Date.now() + index * 1000),
  };
}

// 辅助函数：生成足够多 token 的消息（每个字符约 0.25 token，4字符=1token）
function makeHighTokenMessages(count: number, contentLength: number = 400): Message[] {
  return Array.from({ length: count }, (_, i) =>
    makeMessage(i % 2 === 0 ? "user" : "assistant", "a".repeat(contentLength), i)
  );
}

// ── 属性 7：压缩触发条件正确 ──────────────────────────────────────────────────
// Feature: llm-chat-enhanced, Property 7: 压缩触发条件正确
// 验证：需求 3.1、3.2

describe("buildContext 压缩触发条件（属性 7）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(complete).mockResolvedValue("这是一段历史对话摘要");
  });

  test("token 总量未超阈值时，直接返回完整历史（不触发压缩）", async () => {
    // 使用少量短消息，确保不超过阈值
    const msgs = [
      makeMessage("user", "你好", 0),
      makeMessage("assistant", "你好！有什么可以帮助你的？", 1),
    ];

    const result = await buildContext(msgs, {
      contextWindow: 128000,
      threshold: 0.7,
      keepRecent: 6,
    });

    // 未触发压缩，返回完整历史
    expect(result.length).toBe(msgs.length);
    expect(vi.mocked(complete)).not.toHaveBeenCalled();
  });

  test("token 总量超过阈值时，触发压缩逻辑", async () => {
    // 使用大量长消息，确保超过阈值
    // contextWindow=1000, threshold=0.7 => maxTokens=700
    // 每条消息约 100 token（400字符/4），10条=1000 token > 700
    const msgs = makeHighTokenMessages(10, 400);

    const result = await buildContext(msgs, {
      contextWindow: 1000,
      threshold: 0.7,
      keepRecent: 3,
    });

    // 触发压缩：结果应包含 system 摘要消息 + 最近 3 条
    expect(result.length).toBe(4); // 1 摘要 + 3 最近
    expect(result[0]?.role).toBe("system");
    expect(result[0]?.content).toContain("历史对话摘要");
    expect(vi.mocked(complete)).toHaveBeenCalledOnce();
  });

  test("属性测试：任意超阈值消息集合都触发压缩或截断", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            role: fc.constantFrom("user" as const, "assistant" as const),
            content: fc.string({ minLength: 100, maxLength: 200 }),
          }),
          { minLength: 15, maxLength: 20 }
        ),
        async (rawMessages) => {
          vi.mocked(complete).mockResolvedValue("摘要内容");

          const msgs = rawMessages.map((m, i) =>
            makeMessage(m.role, m.content, i)
          );

          // 使用小 contextWindow 确保触发压缩
          const result = await buildContext(msgs, {
            contextWindow: 100,
            threshold: 0.7,
            keepRecent: 3,
          });

          // 结果应该是：system摘要+3条，或者仅3条（LLM失败降级）
          expect(result.length).toBeGreaterThanOrEqual(1);
          expect(result.length).toBeLessThanOrEqual(4);

          // 结果不应为空
          expect(result.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── 属性 8：压缩保留最近 N 条消息 ────────────────────────────────────────────
// Feature: llm-chat-enhanced, Property 8: 压缩保留最近 N 条消息
// 验证：需求 3.2

describe("buildContext 压缩保留最近 N 条（属性 8）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(complete).mockResolvedValue("这是一段历史对话摘要");
  });

  test("压缩触发时，返回上下文的最后 keepRecent 条与原始序列最后 keepRecent 条完全一致", async () => {
    const keepRecent = 3;
    const msgs = makeHighTokenMessages(10, 400);

    const result = await buildContext(msgs, {
      contextWindow: 1000,
      threshold: 0.7,
      keepRecent,
    });

    // 结果最后 keepRecent 条应与原始消息最后 keepRecent 条内容一致
    const lastN = msgs.slice(-keepRecent);
    const resultLastN = result.slice(-keepRecent);

    expect(resultLastN.length).toBe(keepRecent);
    for (let i = 0; i < keepRecent; i++) {
      expect(resultLastN[i]?.content).toBe(lastN[i]?.content);
      expect(resultLastN[i]?.role).toBe(lastN[i]?.role);
    }
  });

  test("属性测试：任意长度 > keepRecent 的消息序列，压缩后最后 N 条内容不变", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }).chain((keepRecent) =>
          fc
            .array(
              fc.record({
                role: fc.constantFrom("user" as const, "assistant" as const),
                content: fc.string({ minLength: 50, maxLength: 100 }),
              }),
              { minLength: keepRecent + 2, maxLength: keepRecent + 10 }
            )
            .map((msgs) => ({ msgs, keepRecent }))
        ),
        async ({ msgs, keepRecent }) => {
          vi.mocked(complete).mockResolvedValue("摘要");

          const messages = msgs.map((m, i) => makeMessage(m.role, m.content, i));

          const result = await buildContext(messages, {
            contextWindow: 50, // 小 contextWindow 确保触发压缩
            threshold: 0.7,
            keepRecent,
          });

          // 最后 keepRecent 条内容应与原始一致
          const originalLastN = messages.slice(-keepRecent);
          const resultLastN = result.slice(-keepRecent);

          expect(resultLastN.length).toBe(keepRecent);
          for (let i = 0; i < keepRecent; i++) {
            expect(resultLastN[i]?.content).toBe(originalLastN[i]?.content);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── 属性 9：压缩不修改数据库原始消息 ─────────────────────────────────────────
// Feature: llm-chat-enhanced, Property 9: 压缩不修改数据库原始消息
// 验证：需求 3.4

describe("buildContext 不修改输入消息数组（属性 9）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(complete).mockResolvedValue("摘要");
  });

  test("buildContext 调用前后，输入 messages 数组长度和内容不变", async () => {
    const msgs = makeHighTokenMessages(10, 400);
    const originalLength = msgs.length;
    const originalContents = msgs.map((m) => m.content);
    const originalIds = msgs.map((m) => m.id);

    await buildContext(msgs, {
      contextWindow: 1000,
      threshold: 0.7,
      keepRecent: 3,
    });

    // 输入数组不应被修改
    expect(msgs.length).toBe(originalLength);
    for (let i = 0; i < msgs.length; i++) {
      expect(msgs[i]?.content).toBe(originalContents[i]);
      expect(msgs[i]?.id).toBe(originalIds[i]);
    }
  });

  test("属性测试：buildContext 是纯函数，不修改输入", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            role: fc.constantFrom("user" as const, "assistant" as const),
            content: fc.string({ minLength: 10, maxLength: 50 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (rawMessages) => {
          vi.mocked(complete).mockResolvedValue("摘要");

          const messages = rawMessages.map((m, i) =>
            makeMessage(m.role, m.content, i)
          );

          const originalSnapshot = messages.map((m) => ({
            id: m.id,
            content: m.content,
            role: m.role,
          }));

          await buildContext(messages, {
            contextWindow: 100,
            threshold: 0.7,
            keepRecent: 3,
          });

          // 验证输入未被修改
          expect(messages.length).toBe(originalSnapshot.length);
          for (let i = 0; i < messages.length; i++) {
            expect(messages[i]?.id).toBe(originalSnapshot[i]?.id);
            expect(messages[i]?.content).toBe(originalSnapshot[i]?.content);
            expect(messages[i]?.role).toBe(originalSnapshot[i]?.role);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ── 属性 10：LLM 压缩失败时安全降级 ─────────────────────────────────────────
// Feature: llm-chat-enhanced, Property 10: LLM 压缩失败时安全降级
// 验证：需求 3.5

describe("buildContext LLM 失败安全降级（属性 10）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("LLM 摘要调用失败时，返回最近 keepRecent 条消息而不抛出异常", async () => {
    vi.mocked(complete).mockRejectedValue(new Error("LLM API 调用失败"));

    const keepRecent = 3;
    const msgs = makeHighTokenMessages(10, 400);

    // 不应抛出异常
    let result: Awaited<ReturnType<typeof buildContext>>;
    await expect(async () => {
      result = await buildContext(msgs, {
        contextWindow: 1000,
        threshold: 0.7,
        keepRecent,
      });
    }).not.toThrow();

    result = await buildContext(msgs, {
      contextWindow: 1000,
      threshold: 0.7,
      keepRecent,
    });

    // 应返回最近 keepRecent 条消息
    expect(result.length).toBe(keepRecent);

    const lastN = msgs.slice(-keepRecent);
    for (let i = 0; i < keepRecent; i++) {
      expect(result[i]?.content).toBe(lastN[i]?.content);
    }
  });

  test("属性测试：任意异常类型都不导致 buildContext 抛出", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string().map((msg) => new Error(msg)),
          fc.constant(new TypeError("类型错误")),
          fc.constant(new RangeError("范围错误")),
          fc.string().map((s) => s) // 非 Error 对象
        ),
        async (errorValue) => {
          vi.mocked(complete).mockRejectedValue(errorValue);

          const msgs = makeHighTokenMessages(10, 400);

          // 不应抛出异常
          await expect(
            buildContext(msgs, {
              contextWindow: 1000,
              threshold: 0.7,
              keepRecent: 3,
            })
          ).resolves.toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test("LLM 失败时返回的消息列表不为空", async () => {
    vi.mocked(complete).mockRejectedValue(new Error("网络错误"));

    const keepRecent = 4;
    const msgs = makeHighTokenMessages(10, 400);

    const result = await buildContext(msgs, {
      contextWindow: 1000,
      threshold: 0.7,
      keepRecent,
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBe(keepRecent);
  });
});
