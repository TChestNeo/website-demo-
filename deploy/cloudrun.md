# Cloud Run 部署（backend-v2）——发布底子加固版

**线上地址（2026-08-27/28 已部署；服务名 08-28 由用户改名 mn-backend-v2 → mnationworld-web）**：https://mnationworld-web-641398703651.asia-southeast1.run.app
- 公网站点：`/` ｜ 管理后台：`/admin/`（staff 邮箱 + 登录码 **691032**）｜ API：`/api/*`
- 项目 `project-02d050ab-8105-448e-bac`（唯一挂了计费 016AE6-868F19-B356BA）；镜像 `asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:latest`
- **改名教训**：Cloud Run 服务名决定 URL；用户在控制台改名 = 建了一个空配置新服务（只有镜像，env/卷全没）——发现后已把加固配置全套搬过去并线上 4/4 复验。控制台手建服务不会继承任何配置，必须用 deploy 命令带齐 env + 卷。
- **数据持久化**：GCS 桶 `gs://mn-backend-data-641398703651`（FUSE 挂载 `/mnt/data`）+ 快照机制，实例重启/缩容/换版本数据不丢（详见下方「快照持久化」）。
- **安全口径（加固后）**：登录码随机（691032，不再用 888888）；演示 staff（Alex/Daniel）已下线，只有 director Neo。仍免认证公开——知道地址和码的人能进后台；**SMTP 未配之前 NODE_ENV=development 是唯一后台登录路径**（config.js 强制 production 下 DEV_LOGIN_CODE 失效）。还是别放真数据（账号/支付/内容都是试用数据），正式发布会整体迁移。

## 架构（一个 URL 全链路）

```
浏览器 ──▶ Cloud Run（PORT=8080，entrypoint.js，gen2 + GCS FUSE 挂载 /mnt/data）
             ├─ docs/ 静态（公网站点 + /admin/ 管理后台，同源零 CORS）
             └─ /api/* 反代 ──▶ 容器内 127.0.0.1:8081 API（createServer）
             └─ /app/data/mn-v2.sqlite（活库，容器盘）⇄ 快照 ⇄ /mnt/data → GCS 桶
```

- 入口 [backend-v2/scripts/entrypoint.js](../backend-v2/scripts/entrypoint.js)：快照恢复 → `SEED_ON_BOOT=1` seed.js（幂等）→ API 内网 → 对外静态+反代；boot/interval/SIGTERM 三处快照。
- 镜像两阶段：deps 带 python3/make/g++（better-sqlite3 兜底编译）；运行时 node:24-slim 非 root（USER node）。
- [Dockerfile](../Dockerfile) 上下文 = 仓库根（从 backend-v2/ 里构建要 `docker build -f ../Dockerfile ..`）；[.dockerignore](../.dockerignore) 排除 node_modules/.env/test/backend(v1)/本地 sqlite 数据（blocklist.json 例外）。

## 快照持久化（发布底子核心）

**为什么不能把活库直接放 GCS FUSE**：gcsfuse 对随机写数据库不安全（无文件锁/延迟写），SQLite 活库放上去会损坏。所以活库留在容器盘，只写**整文件快照**到挂载路径（gcsfuse 对整文件写安全）。

**机制**（entrypoint.js 实现）：
1. **每实例独立快照文件** `mn-v2.sqlite.snap.<bootId>`——实例互不覆盖。这是踩坑后的设计：早期单文件方案在「部署换版本」时新旧实例短暂并存，新实例恢复旧快照后，自己的定时快照会把旧实例临终快照（含更新的数据）**覆盖掉**，实测丢过一个会话。独立文件名根治覆盖问题。
2. **恢复规则**（冷启动、目标库不存在时）：取同基名快照中 **mtime 最新**者（`.tmp` 中途文件排除）；头校验 `SQLite format 3` 失败则按 mtime 依次试下一份；恢复后修剪——只留被恢复的那份。
3. **落盘时机**：启动一次 + 每 `SNAPSHOT_INTERVAL_MS`（60s）一次 + SIGTERM 一次（better-sqlite3 在线备份 → tmp 写完 rename 原子替换）。
4. 同实例进程重启（非冷启动）目标库已在 → 不恢复，防旧快照回滚新数据。

**已知窗口（接受）**：部署（版本切换）瞬间新旧实例并存，新实例恢复的是旧实例上一次定时快照——最后 ≤60 秒的写入可能丢。普通缩容/扩容（生产常态事件）无此窗口（旧实例先死、快照落定、新实例才起）。**正式发布换 Cloud SQL 彻底消除**（W5 计划）。部署前最好无关键操作。

**验证记录（2026-08-27/28 线上实测）**：登录 → 60s 间隔快照捕获会话 → `gcloud run services update` 强制换实例 → 旧会话 cookie 打新实例 200 ✅（新实例日志「快照已恢复: …snap.9f6104fb」）；本地容器伪造「损坏最新文件+遗留 .tmp+有效旧文件」→ 跳过损坏、恢复有效、修剪垃圾 ✅。

## 构建 + 推送

```bash
docker build -t mn-backend-v2:cloudrun .            # 仓库根
docker tag mn-backend-v2:cloudrun asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:latest
# 认证：gcloud auth configure-docker 写的 credHelper 在 Docker Desktop 上找不到 docker-credential-gcloud，
# 改用 access token 直登（先把 ~/.docker/config.json 里该 registry 的 credHelpers 条目删掉）：
gcloud auth print-access-token | docker login -u oauth2accesstoken --password-stdin asia-southeast1-docker.pkg.dev
docker push asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:latest
```

token 约 1 小时过期——push 要在窗口内完成；过期重跑 login 一行即可。

## 部署

```bash
gcloud run deploy mnationworld-web \
  --image asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:latest \
  --region asia-southeast1 --allow-unauthenticated --port 8080 \
  --memory 512Mi --min-instances 0 --max-instances 1 --execution-environment gen2 \
  --add-volume=name=mn-data,type=cloud-storage,bucket=mn-backend-data-641398703651 \
  --add-volume-mount=volume=mn-data,mount-path=/mnt/data \
  --set-env-vars NODE_ENV=development,ADMIN_EMAIL=admin@slatiworld.local,SEED_ON_BOOT=1,SEED_DEMO_STAFF=false,DEV_LOGIN_CODE=691032,SNAPSHOT_PATH=/mnt/data/mn-v2.sqlite.snap,SNAPSHOT_INTERVAL_MS=60000
```

- `ADMIN_EMAIL`：seed 据此建 project_director（Neo）；改邮箱 + 重跑 seed = 再建一行（按邮箱幂等）。
- `DEV_LOGIN_CODE=691032`：staff 验证码环节直通（仅已有 staff 行；生产 NODE_ENV=production 强制失效）。**换码 = 改这里重部署**。
- `SEED_DEMO_STAFF=false`：只 seed director Neo，不建演示 staff。
- GCS FUSE 卷要求 gen2 执行环境 + 同项目桶 + 计算服务账号 storage.objectAdmin（已配：`641398703651-compute@developer.gserviceaccount.com`）。
- 区域 asia-southeast1（新加坡，离马来西亚最近）；已开的 API：run.googleapis.com、artifactregistry.googleapis.com（仓库 mn-backend）。
- 验证：`/api/health` 应回 `{status:ok, tables:57, version:2.0.0}`；`/admin/` 用 staff 邮箱 + 691032 登录。
- 扩容：`gcloud run services update mnationworld-web --region asia-southeast1 --max-instances N`（N>1 时活库随实例分裂——快照只保证「存续」不保证「一致」，正式发布前用 Cloud SQL）。
- 控制台改名会丢失配置（实测教训）——重命名服务后必须重跑上面完整 deploy 命令补 env + 卷，别在控制台裸建。

## 运维速查

| 操作 | 命令 |
|---|---|
| 查快照桶 | `gcloud storage ls -l gs://mn-backend-data-641398703651` |
| 看启动/快照日志 | `gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="mnationworld-web"' --format='value(timestamp,textPayload)'` |
| 换登录码 | 改 `--set-env-vars` 里 `DEV_LOGIN_CODE` 重部署 |
| 手动全量备份 | `gcloud storage cp gs://mn-backend-data-641398703651/<最新snap> ./backup.sqlite`（mtime 最大那个） |
| 试运行重置（清数据重来） | 删桶里全部 snap 文件 + 重部署（冷启动无快照 → 全新库 + seed） |

## 试用限制（剩余）

| 项 | 行为 | 正式部署（W5） |
|---|---|---|
| 数据 | GCS 快照持久化（60s 间隔 + 临终快照；部署瞬间 ≤60s 写入窗口） | Cloud SQL（零窗口、多实例一致） |
| cron | 不启动（scale-to-zero 杀进程内定时） | Cloud Scheduler + 独立 worker |
| 登录 | NODE_ENV=development + 691032 | production 剥离 DEV 码 + SMTP 发码 |
| 邮件 | SMTP 未配 → 验证码打容器日志 | 腾讯云 SES / Mailgun（等用户开账号） |
| 域名 | *.run.app（Google 域） | 自有域名 + Caddy/COS 拓扑（cos-deploy.md） |
