import express, { type Express } from "express";
import cors from "cors";
import { config } from "./config.js";
import { runMigrations } from "./db/index.js";
import { logger } from "./utils/logger.js";
import chatRouter from "./routes/chat.js";
import sessionsRouter from "./routes/sessions.js";
import healthRouter from "./routes/health.js";
import type { Request, Response, NextFunction } from "express";

const app: Express = express();

// ── 中间件 ────────────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

// 请求日志
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ── 路由 ──────────────────────────────────────────────────────────────────────

app.use("/api/health", healthRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/chat", chatRouter);

// ── 全局错误处理 ──────────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("[Server] 未处理的异常", err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message:
        config.NODE_ENV === "development"
          ? err.message
          : "服务器内部错误，请稍后重试",
    },
  });
});

// ── 启动 ──────────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  // 执行数据库迁移
  runMigrations();

  app.listen(config.PORT, () => {
    logger.info(`[Server] chat-service 启动成功`, {
      port: config.PORT,
      env: config.NODE_ENV,
      model: config.LLM_MODEL,
    });
  });
}

start().catch((err) => {
  logger.error("[Server] 启动失败", err);
  process.exit(1);
});

export default app;
