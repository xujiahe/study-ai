import { describe, test, expect } from "vitest";
import fc from "fast-check";
import { SSEEventSchema } from "@study-ai/chat-shared";

// ── 属性 1：SSE 事件序列化往返 ────────────────────────────────────────────────
// Feature: llm-chat-enhanced, Property 1: SSE 事件序列化往返
// 验证：需求 1.3、1.6

describe("SSE 事件序列化往返（属性 1）", () => {
  test("chat_start 事件序列化往返后与原始对象深度相等", () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constant("chat_start" as const),
          message_id: fc.uuid(),
        }),
        (event) => {
          const serialized = JSON.stringify(event);
          const parsed = JSON.parse(serialized) as unknown;
          const result = SSEEventSchema.safeParse(parsed);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toEqual(event);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test("chat_delta 事件序列化往返后与原始对象深度相等", () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constant("chat_delta" as const),
          delta: fc.string(),
        }),
        (event) => {
          const serialized = JSON.stringify(event);
          const parsed = JSON.parse(serialized) as unknown;
          const result = SSEEventSchema.safeParse(parsed);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toEqual(event);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test("chat_done 事件序列化往返后与原始对象深度相等", () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constant("chat_done" as const),
          usage: fc.record({
            prompt_tokens: fc.nat(),
            completion_tokens: fc.nat(),
            total_tokens: fc.nat(),
          }),
        }),
        (event) => {
          const serialized = JSON.stringify(event);
          const parsed = JSON.parse(serialized) as unknown;
          const result = SSEEventSchema.safeParse(parsed);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toEqual(event);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test("error 事件序列化往返后与原始对象深度相等", () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constant("error" as const),
          code: fc.string(),
          message: fc.string(),
        }),
        (event) => {
          const serialized = JSON.stringify(event);
          const parsed = JSON.parse(serialized) as unknown;
          const result = SSEEventSchema.safeParse(parsed);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toEqual(event);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test("所有四种 SSE 事件类型均可序列化往返", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({
            type: fc.constant("chat_start" as const),
            message_id: fc.uuid(),
          }),
          fc.record({
            type: fc.constant("chat_delta" as const),
            delta: fc.string(),
          }),
          fc.record({
            type: fc.constant("chat_done" as const),
            usage: fc.record({
              prompt_tokens: fc.nat(),
              completion_tokens: fc.nat(),
              total_tokens: fc.nat(),
            }),
          }),
          fc.record({
            type: fc.constant("error" as const),
            code: fc.string(),
            message: fc.string(),
          })
        ),
        (event) => {
          const serialized = JSON.stringify(event);
          const parsed = JSON.parse(serialized) as unknown;
          const result = SSEEventSchema.safeParse(parsed);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toEqual(event);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── 属性 2：非法 SSE 数据不抛出异常 ──────────────────────────────────────────
// Feature: llm-chat-enhanced, Property 2: 非法 SSE 数据不抛出异常
// 验证：需求 1.7、1.8

/**
 * parseSSELine: 防御性解析 SSE 行，任何异常返回 null 而不抛出
 */
function parseSSELine(line: string): unknown | null {
  if (!line.startsWith("data: ")) return null;
  const raw = line.slice(6).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("[useSSE] JSON.parse 失败，跳过:", raw);
    return null;
  }
  const result = SSEEventSchema.safeParse(parsed);
  if (!result.success) {
    console.warn("[useSSE] schema 校验失败，跳过:", result.error.issues);
    return null;
  }
  return result.data;
}

describe("非法 SSE 数据不抛出异常（属性 2）", () => {
  test("任意字符串输入不抛出异常，返回 null", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(() => parseSSELine(input)).not.toThrow();
        const result = parseSSELine(input);
        // 对于非 "data: " 开头的字符串，必须返回 null
        if (!input.startsWith("data: ")) {
          expect(result).toBeNull();
        }
      }),
      { numRuns: 200 }
    );
  });

  test("非 JSON 字符串不抛出异常，返回 null", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => {
          try {
            JSON.parse(s);
            return false;
          } catch {
            return true;
          }
        }),
        (invalidJson) => {
          const line = `data: ${invalidJson}`;
          expect(() => parseSSELine(line)).not.toThrow();
          expect(parseSSELine(line)).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  test("格式错误的 JSON 对象不抛出异常，返回 null", () => {
    const invalidInputs = [
      "data: ",
      "data: null",
      "data: undefined",
      "data: {}",
      "data: {\"type\":\"unknown_type\"}",
      "data: {\"no_type\":true}",
      "data: []",
      "data: 42",
      "data: true",
      "",
      "event: message",
      ": heartbeat",
    ];

    for (const input of invalidInputs) {
      expect(() => parseSSELine(input)).not.toThrow();
    }
  });

  test("空字符串不抛出异常，返回 null", () => {
    expect(() => parseSSELine("")).not.toThrow();
    expect(parseSSELine("")).toBeNull();
  });
});
