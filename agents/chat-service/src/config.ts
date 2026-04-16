import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  // 服务配置
  PORT: z.coerce.number().int().positive().default(3010),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // 数据库
  DB_PATH: z.string().default("./data/chat.db"),

  // LLM 配置
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY 不能为空"),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
  LLM_CONTEXT_WINDOW: z.coerce.number().int().positive().default(128000),

  // 记忆压缩
  COMPRESSION_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
  COMPRESSION_KEEP_RECENT: z.coerce.number().int().positive().default(6),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ 环境变量配置错误：");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
