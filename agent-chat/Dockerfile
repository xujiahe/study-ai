# ── Stage 1: 构建 ─────────────────────────────────────────────────────────────
FROM hub.rat.dev/library/node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

# 复制 monorepo 根配置
COPY pnpm-workspace.yaml ./

# 复制共享包（含源码，安装时需要）
COPY packages/chat-shared/package.json ./packages/chat-shared/
COPY packages/chat-shared/tsconfig.json ./packages/chat-shared/
COPY packages/chat-shared/src ./packages/chat-shared/src

# 复制 agent-chat 依赖文件
COPY agent-chat/package.json ./agent-chat/
COPY agent-chat/tsconfig.json ./agent-chat/

# 在根目录安装所有依赖（不用 frozen-lockfile，lockfile 可能未同步）
RUN pnpm install --no-frozen-lockfile

# 构建共享包
WORKDIR /app/packages/chat-shared
RUN pnpm build

# 构建前端
WORKDIR /app/agent-chat
COPY agent-chat/. .

ARG VITE_CHAT_URL=http://chat-service:3010
ENV VITE_CHAT_URL=$VITE_CHAT_URL

RUN pnpm build

# ── Stage 2: Nginx 静态服务 ───────────────────────────────────────────────────
FROM hub.rat.dev/library/nginx:alpine AS runtime

COPY --from=builder /app/agent-chat/dist /usr/share/nginx/html
COPY agent-chat/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:80/ || exit 1
