# M.NationWorld 部署手册 —— 腾讯云轻量服务器（Lighthouse 国际站）

单机部署：Caddy（自动 HTTPS + **只反代 API 子域**）+ Node 24 后端（node:http + SQLite，零框架）+ systemd + 每日在线备份。全程约 1-2 小时。

**前后端分离**：前端静态站托管在腾讯云 COS + CDN（`https://<域名>`，见同目录 `cos-deploy.md`）；本机只服务 `https://api.<域名>`。两部分独立部署、互不阻塞。

配套文件（本目录）：`Caddyfile`、`mn-backend.service`、`journald-mn.conf`、`cos-deploy.md`、`site-config.cos.js`；备份脚本 `backend/scripts/backup.sh`。

---

## 0. 前置清单（上线前验证项，先做）

| 项 | 说明 |
|---|---|
| 域名 | **`api.<域名>` 一条 A 记录**指向服务器 IP，解析生效后再装 Caddy 省去证书等待。根域 `@`/`www` 走 COS + CDN（CNAME，见 cos-deploy.md §3），与本机无关 |
| 腾讯云 **SES 国际站可用性** | 开通并配好发信域名（SPF/DKIM/DMARC），拿到 SMTP 凭据。**不可用 → 换 Mailgun**（只改 `.env` 的 SMTP_*，零代码改动） |
| 腾讯云 **IMS 国际站可用性** | 开通内容安全，确认可创建 API 密钥（TC3 签名已实现，见 `src/moderation/image.js`）。**不可用 → 备选 AWS Rekognition / 阿里云国际站内容安全**（换配置级改动，image.js 已隔离） |
| DeepSeek 余额 | 平台充值 ≥100 元（月度预算硬上限 60 元是最后防线，不是充值额） |
| 预算初值 | `.env` 三值按计划默认 30/20/10/60 元，上线后按真实流量在管理后台调 |

## 1. 购买与安全组

- Lighthouse 国际站，Ubuntu 24.04，≥2C2G（better-sqlite3 编译需要；1C1G 会慢但也能跑）。
- 安全组只开三条：**22**（SSH，建议限来源 IP）、**80**、**443**。其余全关。
- 登录后 `passwd` 换强密码；可选 SSH key。

## 2. 安装 Node 24 + Caddy

```bash
# Node 24 LTS（NodeSource；备选：官方 tar.xz 解到 /opt/node 后软链）
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs git rsync
node -v   # v24.x

# Caddy 官方 apt 仓库（自动 HTTPS 依赖它）
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy

# 服务用户 + 目录
useradd -m -s /bin/bash mn
mkdir -p /opt/mn /var/backups/mn /var/log/caddy
```

## 3. 上传代码

本地仓库无 remote 时的两条路（二选一）：

```bash
# 路线 A（推荐，最简单）：本地 Git Bash 打包上传
#   本地：cd <repo> && git archive --format=zip -o mn.zip HEAD
#   scp mn.zip 服务器 → 服务器解包：
unzip mn.zip -d /opt/mn

# 路线 B：建 Gitee/GitHub 私库后服务器 clone（后续更新 git pull）
cd /opt/mn && git clone <私库地址> .
```

**重要**：`node_modules` 不上传（Windows 编译的 better-sqlite3 二进制不可用），服务器上 `npm ci` 原生编译：

```bash
cd /opt/mn/backend && npm ci --omit=dev
chown -R mn:mn /opt/mn
```

## 4. 环境变量 + 初始化数据库 + seed 管理员

```bash
cd /opt/mn/backend
cp .env.example .env && chmod 600 .env && nano .env
#   NODE_ENV=production
#   ADMIN_EMAIL=<你的邮箱>          ← seed-admin 据此升级管理员
#   MAIL_FROM/SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS（SES 或 Mailgun）
#   DEEPSEEK_API_KEY（充值后填）
#   TENCENT_SECRET_ID/KEY/IMS_REGION（图像审核）
#   预算 BUDGET_* 保持默认即可（后台可调）
#   ── 前后端分离（配合 COS 前端，缺一不可）──
#   COOKIE_DOMAIN=mn.world                      ← cookie 放大到根域，前端子域才能携带登录态
#   FRONTEND_ORIGIN=https://mn.world,https://www.mn.world,https://admin.mn.world   ← CORS 白名单（完整 scheme+域名；含独立管理后台子域）

# 初始化 DB（跑迁移 001+002，24 张表 + user_version=2）
node --env-file-if-exists=.env -e "const{openDb}=require('./src/db');openDb(process.env.DATABASE_PATH).close();console.log('db init ok')"
```

**seed 顺序**：先跑起服务 → 公网打开站点用 `ADMIN_EMAIL` 邮箱**真实注册登录一次**（验证邮件链路的同时建号）→ 再执行：

```bash
cd /opt/mn/backend && npm run seed   # 提示「已升级为管理员」即成功
```

## 5. systemd + Caddy + 日志保留

```bash
cp /opt/mn/deploy/mn-backend.service /etc/systemd/system/
cp /opt/mn/deploy/journald-mn.conf /etc/systemd/journald.conf.d/mn.conf
systemctl daemon-reload
systemctl enable --now mn-backend
journalctl -u mn-backend -f        # 看到 listening on 127.0.0.1:3000 即起
curl http://127.0.0.1:3000/api/health   # {"status":"ok","db":"ok","tables":24}

cp /opt/mn/deploy/Caddyfile /etc/caddy/Caddyfile   # 先改 api.<你的域名>
systemctl restart systemd-journald   # drop-in 生效
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
# 首次访问 https://api.<域名>/api/health 触发证书签发；失败看 journalctl -u caddy
# 静态站不在本机：前端托管 COS+CDN（cos-deploy.md），本机 Caddy 只反代 API
```

## 6. 备份 + 周报 cron（北京时间 10:17 备份 / 周一 10:00 周报，错开整点）

```bash
crontab -e   # root
17 2 * * * /opt/mn/backend/scripts/backup.sh >> /var/log/mn-backup.log 2>&1
# 周报（成本 vs 预算 + 审核时效 + 调参建议）发到 ADMIN_EMAIL；预算 80%/耗尽告警由后端内置 cron 每日 10:30 自动发
0 2 * * 1 cd /opt/mn/backend && node --env-file-if-exists=.env scripts/weekly-report.js --send >> /var/log/mn-weekly.log 2>&1
```

- `.backup()` 在线备份（WAL 安全，不锁写）；保留 30 天；文件 600。
- **恢复演练（上线当天做一次）**：
  ```bash
  cd /opt/mn/backend && node -e "const{openDb}=require('./src/db');openDb('/tmp/mn-restore.sqlite').close();console.log('restore ok')"
  ```
  再把 `/tmp/mn-restore.sqlite` 换到 `data/mn.sqlite` 即完成恢复（停服→替换→起服）。

## 7. 上线检查清单（全部打勾才算完成）

- [ ] `https://api.<域名>/api/health` → 200 ok（公网，非本机）
- [ ] **前后端分离链路**（前端部分见 cos-deploy.md §9）：COS 前端登录成功；cookie `mn_session` 带 `Domain=<域名>`；API 响应头 `Access-Control-Allow-Origin` 反射白名单 Origin（非 `*`）；白名单外 Origin 请求无 CORS 头
- [ ] **验证码邮件实测**：Gmail + Outlook 各注册一个账号，均能收到（进垃圾箱即检查 SPF/DKIM/DMARC，SES 控制台验证记录）
- [ ] **管理后台独立子域** `https://admin.<域名>`（部署见 cos-deploy.md §8）：独立登录页邮箱验证码登录（先 `npm run seed`）→ 五 tab 能打开、有数据；非管理员账号登录显示「无访问权限」；公网站点无 admin 文件/入口
- [ ] 发一条普通帖 → 立即可见（先发后审）→ 夜间三班 cron 后 usage_log 有 moderation_text 行、审核队列有 AI 结果
- [ ] 举报链路：另一账号举报该帖 → 审核队列出现高优先级项 → 人工 decide 撤回（community-hub 卡片状态变化）
- [ ] AI 客服：help.html 问「退款」→ 走规则卡不扣费；问 FAQ 内问题 → 0 元命中（后台 usage 见 chat_faq_hit）
- [ ] 私讯：账号 A↔B 互发可见、互不可见者 403；管理员调阅后 audit 有 view_dm
- [ ] 工单：提交 → 邮箱无回执要求、后台出现、回复后前端状态变化；badge 签发 → 另一浏览器 verify 通过
- [ ] 断网/后端停机演练：停 mn-backend 后前台页面仍可浏览（本地为主；COS 静态站与后端天然隔离）；恢复后登录正常
- [ ] SSL Labs 评级 ≥ A（`api.<域名>`）；curl -I 响应头含安全头
- [ ] 备份演练（见 §6）+ `crontab -l` 已确认
- [ ] `.env` 权限 600；`/var/backups/mn` 权限检查；安全组仅 22/80/443

## 8. 成本预估（首月）

| 项 | 估算 |
|---|---|
| Lighthouse 2C2G 国际站 | ~USD 4-7/月（固定） |
| COS + CDN（前端） | ~¥1-5/月（1.5MB 存储免费额度内；小站流量 <10GB） |
| 域名 + DNS | ~USD 1/月摊 |
| SES 邮件 | ~¥0.05/千封（验证码量级≈0） |
| IMS 图像审核 | ~¥0.0025/张 |
| DeepSeek（文字审核+客服） | 预算硬上限 60 元/月，谷价批处理 + FAQ 0 元命中下预期 10-30 元 |
| **合计** | **~¥50-110/月** |

## 9. 运维速查

```bash
systemctl status mn-backend           # 后端状态
journalctl -u mn-backend -n 100 -f    # 后端日志（30 天保留）
systemctl restart mn-backend          # 改代码后：npm ci 若依赖未变则无需重装；重启即生效
journalctl -u caddy -n 50             # api.<域名> 证书/反代问题（静态站在 COS，不在本机）
ls -l /var/backups/mn | tail          # 备份检查
# 预算调整：admin.<域名> → 成本看板（写 audit）；kv 直改：sqlite3 不在服务器上时用 node -e
# 迁移：新增 migrations/NNN_*.sql 进 git → 服务器 git pull（或重传）→ restart（openDb 自动升 user_version）
```

**上线后两周内**（P11 衔接）：每日看一次成本看板 vs 预算、审核队列积压与时效；按真实流量把预算初值调到「月耗 × 1.5」；跑 P11 清单（premium 定价修复、预算 80% 邮件告警、举报 UI 铺开）。
