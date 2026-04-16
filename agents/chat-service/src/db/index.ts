import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import * as schema from "./schema.js";

// 确保数据库目录存在
const dbDir = dirname(config.DB_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(config.DB_PATH);

// 启用 WAL 模式提升并发性能
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

/**
 * 执行数据库迁移（启动时调用）
 */
export function runMigrations(): void {
  try {
    migrate(db, { migrationsFolder: "./src/db/migrations" });
    logger.info("[DB] 数据库迁移完成");
  } catch (err) {
    // 如果迁移文件夹不存在，使用内联建表语句
    logger.warn("[DB] 迁移文件夹不存在，使用内联建表语句", err);
    runInlineMigration();
  }
}

/**
 * 内联建表（无迁移文件时的备用方案）
 */
function runInlineMigration(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '新对话',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `);
  logger.info("[DB] 内联建表完成");
}
