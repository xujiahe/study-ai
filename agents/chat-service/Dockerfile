# ── Stage 1: 构建 ─────────────────────────────────────────────────────────────
FROM hub.rat.dev/library/node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

# 复制 monorepo 根配置
COPY pnpm-workspace.yaml ./

# 复制共享包（含源码）
COPY packages/chat-shared/package.json ./packages/chat-shared/
COPY packages/chat-shared/tsconfig.json ./packages/chat-shared/
COPY packages/chat-shared/src ./packages/chat-shared/src

# 复制 chat-service 依赖文件
COPY agents/chat-service/package.json ./agents/chat-service/
COPY agents/chat-service/tsconfig.json ./agents/chat-service/

# 在根目录安装所有依赖
RUN pnpm install --no-frozen-lockfile

# 构建共享包
WORKDIR /app/packages/chat-shared
RUN pnpm build

# 构建 chat-service
WORKDIR /app/agents/chat-service
COPY agents/chat-service/src ./src
COPY agents/chat-service/drizzle.config.ts ./
RUN pnpm build

# ── Stage 2: 运行时 ───────────────────────────────────────────────────────────
FROM hub.rat.dev/library/node:20-alpine AS runtime
WORKDIR /app

RUN npm install -g pnpm

# 只复制 chat-service 的依赖文件，单独安装生产依赖
COPY agents/chat-service/package.json ./
RUN pnpm install --no-frozen-lockfile --prod

# 复制构建产物
COPY --from=builder /app/agents/chat-service/dist ./dist

# 数据库目录（挂载 Volume）
RUN mkdir -p /app/data

EXPOSE 3010

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3010/api/health || exit 1

CMD ["node", "dist/server.js"]
