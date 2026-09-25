# Cloud Run 部署（backend-v2）——发布底子加固版

**线上地址（2026-08-27/28 已部署；服务名 08-28 由用户改名 mn-backend-v2 → mnationworld-web）**：https://mnationworld.com（自定义域名，08-28 接线；run.app 原址 https://mnationworld-web-641398703651.asia-southeast1.run.app 仍可用）
- 公网站点：`/` ｜ 管理后台：**admin.mnationworld.com 子域**（唯一入口——2026-09-23 接线并整体搬家：主域 `/admin/*` 全部 302 跳子域，staff 邮箱 + **密码 + 邮件验证码**双因素，production 姿态）｜ API：`/api/*`
- 项目 `project-02d050ab-8105-448e-bac`（唯一挂了计费 016AE6-868F19-B356BA）；镜像 `asia-southeast1-docker.pkg.dev/project-02d050ab-8105-448e-bac/mn-backend/mn-backend-v2:latest`
- **改名教训**：Cloud Run 服务名决定 URL；用户在控制台改名 = 建了一个空配置新服务（只有镜像，env/卷全没）——发现后已把加固配置全套搬过去并线上 4/4 复验。控制台手建服务不会继承任何配置，必须用 deploy 命令带齐 env + 卷。
- **数据持久化**：GCS 桶 `gs://mn-backend-data-641398703651`（FUSE 挂载 `/mnt/data`）+ 快照机制，实例重启/缩容/换版本数据不丢（详见下方「快照持久化」）。
- **安全口径（08-28 SMTP+production 切换后）**：NODE_ENV=production + Gmail SMTP——登录码走邮件，DEV 码 691032 已作废（config.js 强制 production 下失效，实测 400）。**W6（08-28）：登录 = 密码 + 每次邮件验证码**（银行级双因素；码 10 分钟有效、60s 重发冷却、5 次锁）；**旧账号首登仅码登录 → 强制设密引导 → 此后每次密码+码**（Neo 部署后第一次登录会走设密引导）。忘记密码：登录卡「忘记密码？」→ 邮箱收码 → 设新密码 → 全部会话失效强制重登。管理员 = director Neo，登录邮箱 **microcountry2677@gmail.com**。**发信账号 = slati.official@gmail.com**（用户新建的站务 Gmail；发信人与管理员收码邮箱分开——用户不切号，发件人也不暴露私人号）。演示 staff（Alex/Daniel）已下线。**教训：旧 ADMIN_EMAIL=admin@slatiworld.local 是假域名收不到码——切 production 前必须把管理员邮箱换成真实邮箱，否则锁死**。仍免认证公开（公网站点本来就该公开，后台安全靠登录不靠挡门）。还是别放真数据（账号/支付/内容都是试用数据），正式发布会整体迁移。

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
# 改用 access token 直登。PowerShell 下两坑（08-28 实测）：① config.json 里该 registry 的**空 auths 条目**
# 会盖过 credsStore 里的登录态 → 表现为 login 成功但 push 401，删掉 auths 块即可（Set-Content 重写必须
# [System.IO.File]::WriteAllText + UTF8Encoding($false)——PS5.1 默认带 BOM，docker 解析 config 直接报错）；
# ② 管道喂 --password-stdin 会带换行 → Basic 401，用 -p 直传（token 1 小时过期，本地命令行可接受）：
#   $token = (& "…\gcloud.cmd" auth print-access-token).Trim()
#   docker login -u oauth2accesstoken -p "$token" asia-southeast1-docker.pkg.dev
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
  --set-env-vars "NODE_ENV=production,ADMIN_EMAIL=microcountry2677@gmail.com,SEED_ON_BOOT=1,SEED_DEMO_STAFF=false,DEV_LOGIN_CODE=691032,SNAPSHOT_PATH=/mnt/data/mn-v2.sqlite.snap,SNAPSHOT_INTERVAL_MS=60000,SMTP_HOST=smtp.gmail.com,SMTP_PORT=465,SMTP_SECURE=true,SMTP_USER=slati.official@gmail.com,SMTP_PASS=<Gmail 应用专用密码 16 位无空格>,MAIL_FROM=M.NationWorld <slati.official@gmail.com>,DEEPSEEK_API_KEY=<DeepSeek 平台 API key 不进 git>,DEEPSEEK_MODEL=deepseek-v4-flash"
```

- ⚠ **2026-09-14 起一律用 `gcloud.ps1` 而不是 `gcloud.cmd`**：cmd 是批处理，PowerShell 调它走 cmd.exe /c——Windows 命令行 8191 字符上限，STRIPE_CATALOG_B64 单值 9.3KB 的 28 env 拼串必然报「The command line is too long」（rev 00071-qjb 实测）。gcloud.ps1 在进程内用 $args 数组直调 python（CreateProcess 32K 足够）：`& "…\google-cloud-sdk\bin\gcloud.ps1" run deploy … "--set-env-vars=$envArg"`。其余不变。
- `ADMIN_EMAIL`：seed 据此建 project_director（Neo）；改邮箱 + 重跑 seed = 再建一行（按邮箱幂等）。**必须是能收信的真实邮箱**（production 下登录码发到它，假域名=锁死）。W6：seed 不种密码（011 加列后 password_hash NULL）→ **首登走仅码登录 + 设密引导**，设密后每次密码+码。
- `DEV_LOGIN_CODE`：production 下 config.js 强制失效（留着当回退开关——出问题把 NODE_ENV 改回 development 即可用固定码救急；dev 模式固定码直登且跳过密码校验）。
- **SMTP 四件套 + MAIL_FROM**：Gmail 应用专用密码（myaccount.google.com → 安全性 → 两步验证 → 应用专用密码；16 位不带空格）。**发信人 = slati.official@gmail.com（站务号）；管理员收码 = ADMIN_EMAIL（主号）——两账号分开**。品牌域名邮箱（service@mnationworld.com）路线：Zoho 免费版无 SMTP 不可用（webmail only）、Workspace/Zoho Lite 付费绑卡；免费可发 = Brevo（300 封/天、不绑卡，域名验证走 Cloud DNS）——用户要真正自有域名发件人时再走 Brevo，只改这几个 env。
- **DeepSeek 二件套（2026-09-26，rev 00298- 图库标签 AI 查重）**：`DEEPSEEK_API_KEY` = DeepSeek 平台 API key（**值只进未跟踪部署脚本 tmp-deploy-*.ps1，绝不入 commit**，SMTP_PASS 同款纪律）；`DEEPSEEK_MODEL=deepseek-v4-flash`（用户钦定「用 DeepSeek V4 Flash 不要用 Pro」——API 也接受 `deepseek-v4-flash` 别名，两者实测 200 同模型）。**连带效应（已接受）**：同一 key 让 AI 客服 chat 端点从无 key 降级态转活——`deepseek-chat` 已退役路由到 v4-flash 行为等价；成本有 `budgets.chat` 20 元/月硬上限保护。用途：`POST /api/tags/dedup`（FC 图库自建标签语义查重；无 key 时 503 `{unavailable:true}` 前端静默本地-only）。
- 邮箱每天发送上限 ~500 封（Gmail 常规账号），试用期绰绰有余。
- `SEED_DEMO_STAFF=false`：只 seed director Neo，不建演示 staff。
- GCS FUSE 卷要求 gen2 执行环境 + 同项目桶 + 计算服务账号 storage.objectAdmin（已配：`641398703651-compute@developer.gserviceaccount.com`）。
- 区域 asia-southeast1（新加坡，离马来西亚最近）；已开的 API：run.googleapis.com、artifactregistry.googleapis.com（仓库 mn-backend）。
- 验证：`/api/health` 应回 `{status:ok, tables:60, version:2.0.0}`；`/admin/` 用 staff 邮箱登录——**W6 双因素：密码 + 邮件验证码**（Neo 首登仅码 → 设密引导 → 此后密码+码）。
- 扩容：`gcloud run services update mnationworld-web --region asia-southeast1 --max-instances N`（N>1 时活库随实例分裂——快照只保证「存续」不保证「一致」，正式发布前用 Cloud SQL）。
- 控制台改名会丢失配置（实测教训）——重命名服务后必须重跑上面完整 deploy 命令补 env + 卷，别在控制台裸建。

## 自定义域名 mnationworld.com（2026-08-28 接线）

- **域名映射**：Cloud Run 托管版的 `gcloud run domain-mappings` 是 Anthos-only（GA 命令拒绝 `--region`），beta 组件本机未装（非交互环境装不上）——**用 REST API 建**：`POST https://run.googleapis.com/v1/projects/<项目>/locations/<区域>/domainmappings`，body `{"apiVersion":"domains.cloudrun.com/v1","kind":"DomainMapping","metadata":{"name":"mnationworld.com"},"spec":{"routeName":"mnationworld-web"}}`。查状态 `GET …/domainmappings/mnationworld.com`。
- **DNS**：映射创建后 `status.resourceRecords` 给出 4 A（216.239.32/34/36/38.21）+ 4 AAAA（2001:4860:4802:32/34/36/38::15），已加入 Cloud DNS 区 `mnationworld-com`（change 1，TTL 300，apex 根记录）。区 NS = ns-cloud-a1~a4.googledomains.com，域名注册处已指向它们（Google Domains 注册 + 同项目 Cloud DNS 区，NS 自动一致）。
- **证书**：Google 托管证书在 DNS 生效后自动签发（DomainRoutable=True → CertificateProvisioned=True → Ready=True），全程无需人工。签发期间 HTTPS 连不上属正常（5–15 分钟）。**已实测（08-28）**：`https://mnationworld.com/api/health` 200（57 表 v2.0.0）；DNS 加记录 → Ready 全程 ~12 分钟，Ready 后本机网络还要再传播几分钟（run.app 对照 200 + WebFetch 独立视角 200 → 排除站点问题，纯边缘线路延迟，等几分钟重试即可）。
- 域名在 Cloud Domains 注册（另一个域名 medankahwin.com 另有用途，勿动）。若以后要 www.mnationworld.com：另建一条 mapping（name=www.mnationworld.com）+ CNAME 到 `ghs.googlehosted.com`。

## admin.mnationworld.com 子域（2026-09-23 接线，rev 00283-pch）

用户要「把后端的 admin 改成 admin.mnationworld.com」——同一服务再挂一条域名映射 + entrypoint.js Host 路由，**admin 应用零改动**（已核实全相对路径 + hash 路由 `#/dashboard` + api.js base 默认 `'/api'` 同源，子域根直出零 CORS 零断链）。

- **域名映射**：REST API 同主域套路，name 换成 `admin.mnationworld.com`。子域映射给出的 DNS 记录是**一条 CNAME**（`admin` → `ghs.googlehosted.com.`），不是 apex 的 4 A + 4 AAAA——已加入 Cloud DNS 区 `mnationworld-com`（change 14，TTL 300）。签发流程与 apex 相同：DomainRoutable=True → CertificateProvisioned=True → Ready=True（5–15 分钟）。
- **Host 路由**（entrypoint.js）：`story.mnationworld.com → docs/story`、`admin.mnationworld.com → docs/admin`（根直出）、其余 → `docs/`。`split(':')[0]` + `toLowerCase` 同 story 口径。**`/api/*` 反代分支先于 Host 路由**——子域 API 同源直达后端。**admin 搬家（2026-09-23 晚，rev 00284-9mb）**：主域 `/admin` 与 `/admin/*` 全部 302 跳 `https://admin.mnationworld.com`（去 `/admin` 前缀：`/admin` → `/`、`/admin/xxx` → `/xxx`，query 原样带上；302 非 301——浏览器不缓存，回退路径不被锁死；adminHost 自身豁免防自跳死循环；story 主机名同样转跳）。子域 = 管理后台唯一入口，老书签自动指路，双入口退役。
- **Cookie**：COOKIE_DOMAIN/CORS 留空（同源）→ host-only cookie → admin 子域独立登录会话（与主站/故事站互不共享；staff 密码+邮件码双因素不变，邮箱走同一 SMTP）。
- **⚠ `../assets/*` 回退（rev 00286-zp7 修，之前子域登录链全断）**：admin 应用引用 `../assets/...`（site-config/liquid-glass/api/i18n/admin.i18n 五件 + favicon）——子域根直出时浏览器把 `..` 解析掉，请求变成 `/assets/*`，而 docRoot 是 docs/admin 下没有 assets → **全 404，api.js 缺失登录直接不可用**（前两轮验证只看根 HTML/app.js 全漏）。修法：entrypoint.js 静态解析加 `serveRoot = adminHost && p.startsWith('/assets/') ? DOCS : docRoot`——仅 /assets/ 前缀回主 DOCS 取共享资源，**/pages 等主站页面不享受回退，子域隔离保持**。lesson：验证子域不能只测 HTML 壳，要实测页面引用的每类资源。
- **订阅发放（rev 00286-zp7）**：admin Users 详情新增发放卡（pages-users.js）——等级 basic/premium/ultra + 月数 1/3/6/12，`SC.can('subscriptions.manage')` 门控（director/finance），POST /api/staff/subscriptions/grant（后端既有端点零改动：不经 Stripe、不扣款、不记 payments、审计 staff_test_grant、max 不降级）；i18n 8 新键 ×12 语言 + OpenCC zh-Hant 重生成。
- **左侧菜单条目名修复（rev 00287-wgw）**：用户「为什么左侧菜单 Dashboard 标题内的选项全部名称都是 dashboard」——v0.2.54.0 i18n 轮把合并分组的条目名查键写成 `T(it.k || g.kEn)`（g=节标题组恒 Dashboard），并入「Dashboard 总览」的 5 条目（Dashboard/Analytics/Users/Content/Community）全落 admin.nav.dashboard.en → 全显示「Dashboard」；图标用 sg.icon 无碍故只有名字错。修法一行：`g.kEn` → `sg.kEn`（子组自身键）。lesson：smoke 此前只数条目不查名——回归断言必须比对条目名文本。
- **验证（2026-09-23/24）**：本地容器端到端测三路 Host + 搬家重定向（admin 根直出、子域 /api/health 200、story 标题、主域首页、四种 /admin 路径 302 映射 + query 保留 + story 主机转跳 + 子域无自跳 + 隔离——主站页面在 admin 子域 404）；电池 admin-host 20/20（S19-S20 = /assets/ 回退分支）+ admin-grant 12/12 + admin-nav 8/8（00287 新：sg.kEn 锚/旧写法零在场/五组键独立/标题行与 showTodo 口径不误伤/12 语言词典执行体验证/smoke 条目名断言在场）+ 冒烟 54→55/55（00287 新：总览 5 条目名逐一比对——此前只数条目不查名，回归漏网）+ i18n 34/34；本地容器 /assets/ 回退矩阵（api.js 200/隔离 404）；线上探针 admin-subdomain 12/12 + admin-grant-live 8/8 + admin-nav-live 8/8（00287：子域修复版 app.js/12 语言 nav 键执行体验证/搬家 302/主站 58.0/60 表/回退/隔离）。
- 坑：run.app 直连加自定义 Host 头会被 Google 前端 404（连 story 也 404）——**Host 路由验证只能走真域名或本地容器**，不能用 run.app + Host 头。

## 运维速查

| 操作 | 命令 |
|---|---|
| 查快照桶 | `gcloud storage ls -l gs://mn-backend-data-641398703651` |
| 看启动/快照日志 | `gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="mnationworld-web"' --format='value(timestamp,textPayload)'` |
| 换发信邮箱/密码 | 改 `--set-env-vars` 里 `SMTP_USER`/`SMTP_PASS` 重部署（应用密码可随时在 Google 账号页删除作废） |
| 救急回退固定码 | `NODE_ENV` 改回 `development` 重部署 → 691032 复活（production 下恒失效；dev 码直登跳过密码） |
| 忘记密码（管理员） | `/admin/` 登录卡「忘记密码？」→ 邮箱收码 → 设新密码（全部会话失效）；不依赖 staff 会话 |
| 手动全量备份 | `gcloud storage cp gs://mn-backend-data-641398703651/<最新snap> ./backup.sqlite`（mtime 最大那个） |
| 试运行重置（清数据重来） | 删桶里全部 snap 文件 + 重部署（冷启动无快照 → 全新库 + seed） |

## 试用限制（剩余）

| 项 | 行为 | 正式部署（W5） |
|---|---|---|
| 数据 | GCS 快照持久化（60s 间隔 + 临终快照；部署瞬间 ≤60s 写入窗口） | Cloud SQL（零窗口、多实例一致） |
| cron | 不启动（scale-to-zero 杀进程内定时） | Cloud Scheduler + 独立 worker |
| 登录 | ✅ production + Gmail SMTP（08-28）：**密码 + 邮件验证码双因素**（W6；旧账号首登设密引导；忘记密码邮箱重置），691032 已作废 | 品牌邮箱收码（同一 SMTP 切换） |
| 邮件 | ✅ Gmail SMTP（08-28 应用专用密码；每天 ~500 封上限够试用） | 品牌邮箱发信（SES/Mailgun，等用户开账号） |
| 域名 | ✅ 自有域名 mnationworld.com 已接线（08-28，证书自动签发） | www 子域（可选） |
