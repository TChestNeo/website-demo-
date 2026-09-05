# syntax=docker/dockerfile:1
# M.NationWorld 后端 v2 — Cloud Run 试用镜像
# 构建（上下文 = 仓库根）：docker build -t mn-backend-v2 .
# 入口：backend-v2/scripts/entrypoint.js（SEED_ON_BOOT=1 先 seed → API 内网 :8081 → 对外 PORT 静态 docs/ + /api 反代）
# 两阶段：依赖阶段带 python3/make/g++（better-sqlite3 原生模块预编译失败时兜底编译）；运行时非 root。

# ── 阶段 1：安装依赖 ──
FROM node:24-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY backend-v2/package.json backend-v2/package-lock.json ./
RUN npm ci --omit=dev

# ── 阶段 2：运行时 ──
FROM node:24-slim
# NODE_ENV=development：试用口径（DEV_LOGIN_CODE 生效 + seed 建演示 staff）；正式部署时部署环节覆盖为 production
ENV NODE_ENV=development \
    HOST=0.0.0.0 \
    PORT=8080 \
    DATABASE_PATH=/app/data/mn-v2.sqlite \
    STATIC_DIR=/app/docs \
    UPLOADS_DIR=/mnt/data/uploads
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend-v2/package.json ./
COPY backend-v2/src ./src
COPY backend-v2/migrations ./migrations
COPY backend-v2/data ./data
# 运行用户 node（非 root）需要写 /app/data（SQLite + WAL）；COPY 进来的目录是 root 属主
RUN mkdir -p /app/data && chown -R node:node /app/data
COPY backend-v2/scripts ./scripts
COPY docs ./docs
USER node
EXPOSE 8080
CMD ["node", "scripts/entrypoint.js"]
