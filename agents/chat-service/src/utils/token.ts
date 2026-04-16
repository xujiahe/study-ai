import { get_encoding } from "tiktoken";
import type { Message } from "../db/schema.js";

/**
 * 使用 tiktoken 计算消息列表的 token 总量
 * 使用 cl100k_base 编码（GPT-4 / GPT-3.5 通用编码）
 */
export function countTokens(messages: Pick<Message, "content" | "role">[]): number {
  const enc = get_encoding("cl100k_base");
  let total = 0;
  try {
    for (const msg of messages) {
      total += 4; // 每条消息固定开销（role + separators）
      total += enc.encode(msg.content).length;
    }
  } finally {
    enc.free();
  }
  return total;
}

/**
 * 计算单个字符串的 token 数量
 */
export function countStringTokens(text: string): number {
  const enc = get_encoding("cl100k_base");
  try {
    return enc.encode(text).length;
  } finally {
    enc.free();
  }
}
