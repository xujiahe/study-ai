import { describe, test, expect } from "vitest";
import fc from "fast-check";
import { ChatStreamRequestSchema } from "../../src/schemas/api.schemas.js";

// ── 属性 3：请求体校验拒绝无效输入 ───────────────────────────────────────────
// Feature: llm-chat-enhanced, Property 3: 请求体校验拒绝无效输入
// 验证：需求 1.9

describe("ChatStreamRequestSchema 请求体校验（属性 3）", () => {
  test("缺少 session_id 字段时校验失败", () => {
    fc.assert(
      fc.property(
        fc.record({
          content: fc.string({ minLength: 1, maxLength: 10000 }),
        }),
        (body) => {
          const result = ChatStreamRequestSchema.safeParse(body);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test("缺少 content 字段时校验失败", () => {
    fc.assert(
      fc.property(fc.uuid(), (sessionId) => {
        const body = { session_id: sessionId };
        const result = ChatStreamRequestSchema.safeParse(body);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  test("session_id 不是有效 UUID 时校验失败", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => {
          // 过滤掉恰好是有效 UUID 格式的字符串
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return !uuidRegex.test(s) && s.length > 0;
        }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (invalidUuid, content) => {
          const body = { session_id: invalidUuid, content };
          const result = ChatStreamRequestSchema.safeParse(body);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test("content 为空字符串时校验失败", () => {
    fc.assert(
      fc.property(fc.uuid(), (sessionId) => {
        const body = { session_id: sessionId, content: "" };
        const result = ChatStreamRequestSchema.safeParse(body);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  test("content 超过 10000 字符时校验失败", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 10001, maxLength: 15000 }),
        (sessionId, longContent) => {
          const body = { session_id: sessionId, content: longContent };
          const result = ChatStreamRequestSchema.safeParse(body);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test("字段类型不符时校验失败（session_id 为数字）", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.string({ minLength: 1, maxLength: 100 }),
        (numericId, content) => {
          const body = { session_id: numericId, content };
          const result = ChatStreamRequestSchema.safeParse(body);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test("有效请求体通过校验", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 1000 }),
        (sessionId, content) => {
          const body = { session_id: sessionId, content };
          const result = ChatStreamRequestSchema.safeParse(body);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("完全空对象校验失败", () => {
    const result = ChatStreamRequestSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  test("null 值校验失败", () => {
    const result = ChatStreamRequestSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  test("数组值校验失败", () => {
    const result = ChatStreamRequestSchema.safeParse([]);
    expect(result.success).toBe(false);
  });
});
