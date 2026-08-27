# Cloud Run 试用部署（backend-v2）

**线上地址（2026-08-27 已部署，试用）**：https://mn-backend-v2-641398703651.asia-southeast1.run.app
- 公网站点：`/` ｜ 管理后台：`/admin/`（staff 邮箱 + 888888）｜ API：`/api/*`
- 项目 `project-02d050ab-8105-448e-bac`（唯一挂了计费的项目）；镜像 `asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:trial`
- **安全提示（试用口径）**：服务免认证公开 + 开发码 888888 可登录总监——任何知道地址和码的人都能进后台；数据是临时盘（重启即丢，SEED_ON_BOOT=1 冷启动自动重建 staff）。别往里放真数据。换码/收紧 = 改 env 重部署。

2026-08-27 试用口径：**先跑起来看**——SQLite 数据不持久（实例重启/缩容即丢，W5 正式部署前换持久盘或云 SQL）、进程内 cron 不启动、NODE_ENV=development（DEV_LOGIN_CODE 生效 + seed 建演示 staff）。正式部署 = 同一镜像 + env 覆盖为 production + 持久化方案。

## 架构（一个 URL 全链路）

```
浏览器 ──▶ Cloud Run（PORT=8080，entrypoint.js）
             ├─ docs/ 静态（公网站点 + /admin/ 管理后台，同源零 CORS）
             └─ /api/* 反代 ──▶ 容器内 127.0.0.1:8081 API（createServer）
```

- 入口 [backend-v2/scripts/entrypoint.js](../backend-v2/scripts/entrypoint.js)：`SEED_ON_BOOT=1` 先跑 seed.js（幂等）→ API 内网 → 对外静态+反代；SIGTERM 优雅关 API。
- 镜像两阶段：deps 带 python3/make/g++（better-sqlite3 兜底编译）；运行时 node:24-slim 非 root（USER node）。
- [Dockerfile](../Dockerfile) 上下文 = 仓库根；[.dockerignore](../.dockerignore) 排除 node_modules/.env/test/backend(v1)/本地 sqlite 数据（blocklist.json 例外）。

## 构建 + 推送

```bash
docker build -t mn-backend-v2:cloudrun .
docker tag mn-backend-v2:cloudrun asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:trial
# 认证：gcloud auth configure-docker 写的 credHelper 在 Docker Desktop 上找不到 docker-credential-gcloud，
# 改用 access token 直登（先把 ~/.docker/config.json 里该 registry 的 credHelpers 条目删掉）：
gcloud auth print-access-token | docker login -u oauth2accesstoken --password-stdin asia-southeast1-docker.pkg.dev
docker push asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:trial
```

token 约 1 小时过期——push 要在窗口内完成；过期重跑 login 一行即可。

## 部署

```bash
gcloud run deploy mn-backend-v2 \
  --image asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:trial \
  --region asia-southeast1 --allow-unauthenticated --port 8080 \
  --memory 512Mi --min-instances 0 --max-instances 1 \
  --set-env-vars NODE_ENV=development,ADMIN_EMAIL=admin@slatiworld.local,SEED_ON_BOOT=1,SEED_DEMO_STAFF=true,DEV_LOGIN_CODE=888888
```

- `ADMIN_EMAIL`：seed 据此建 project_director（Neo）；改邮箱 + 重跑 seed = 再建一行（按邮箱幂等）。
- `DEV_LOGIN_CODE=888888`：staff 验证码环节直通（仅已有 staff 行；生产环境 NODE_ENV=production 强制失效）。
- 区域 asia-southeast1（新加坡，离马来西亚最近）。
- 已开的 API：run.googleapis.com、artifactregistry.googleapis.com（仓库 mn-backend 已建，2026-08-27）。
- 验证：线上地址（见文档顶部）`/api/health` 应回 `{status:ok, tables:57, version:2.0.0}`；`/admin/` 用 staff 邮箱 + 888888 登录。

## 试用限制（已接受）

| 项 | 行为 | 正式部署（W5） |
|---|---|---|
| 数据 | 实例重启/缩容丢（临时盘） | 持久盘挂 /app/data 或云 SQL |
| cron | 不启动（scale-to-zero 杀进程内定时） | Cloud Scheduler + 独立 worker |
| 登录 | NODE_ENV=development + 888888 | production 剥离 DEV 码 + SMTP 发码 |
| 邮件 | SMTP 未配 → 验证码打容器日志 | 腾讯云 SES / Mailgun |
| 域名 | *.run.app（Google 域） | 自有域名 + Caddy/COS 拓扑（cos-deploy.md） |
