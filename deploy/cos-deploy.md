# 前端静态站部署手册 —— 腾讯云 COS + CDN（前后端分离）

前端（`docs/`，约 1.5MB / 74 文件，纯静态 vanilla JS）托管到腾讯云 COS 静态网站 + CDN 加速；
后端独立在 Lighthouse 服务器 `https://api.<域名>`（见 lighthouse-setup.md，Caddy 只反代 API）。

域名规划：`mn.world` / `www.mn.world` → CDN（本手册）；`api.mn.world` → A 记录指向服务器 IP（lighthouse-setup.md）。

前置：腾讯云账号 + 域名 DNS 托管（DNSPod）+ 国际站 COS 已开通。

---

## 1. 创建存储桶

COS 控制台 → 存储桶列表 → 创建存储桶：

| 项 | 值 |
|---|---|
| 名称 | `mn-world-<APPID>`（APPID 后缀自动） |
| 所属地域 | 就近用户：东南亚用户为主 → 新加坡 `ap-singapore` |
| 访问权限 | **私有读写**（公网只走 CDN/静态网站域名，桶本身不公开） |
| 版本控制 | 关闭 |

## 2. 开启静态网站托管

桶 → 基础配置 → 静态网站：

- 状态：开启
- 索引文档：`index.html`
- 错误文档：留空（多页静态站无 SPA 回退；404 由 COS 默认错误页）

## 3. 绑定自定义域名 + HTTPS

桶 → 域名与传输管理 → 自定义源站域名 → 绑定 `mn.world` 与 `www.mn.world`：

1. DNS（DNSPod 控制台）加两条 CNAME：`@` 与 `www` → COS 静态网站分配的 CNAME 域名
2. 证书：申请腾讯云**托管证书**（免费 DV，自动续期），两个域名一张证书
3. 绑定域名时选择该证书，强制 HTTPS

## 4. 开启 CDN 加速

CDN 控制台 → 域名管理 → 添加加速域名 `mn.world`（www 可同源或单独添加）：

- 源站类型：**COS 源站**（选择第 1 步的桶），回源 HOST = 桶域名
- 加速地域：中国大陆（如需境内访问且域名已备案）或**境外**（国际站未备案场景，用户东南亚为主选境外）
- 回源协议：HTTPS

## 5. 上传站点文件（含 apiBase 覆盖）

```bash
# 本地（Windows 可用 Git Bash；coscmd 为 Python 工具，pip install coscmd）
pip install coscmd
coscmd config -a <SecretId> -s <SecretKey> -b mn-world-<APPID> -r ap-singapore

# ① 先覆盖 site-config.js：复制模板、把 api.<你的域名> 换成真实 API 域名
cd <repo>/deploy
sed 's|<你的域名>|真实域名|' site-config.cos.js > /tmp/site-config.js
coscmd upload /tmp/site-config.js assets/js/site-config.js

# ② 全量上传 docs/（仓库内 site-config.js 空对象会被后续覆盖的本地文件顶替 —— 见下方「注意」）
coscmd upload -r ../docs/ /
```

**注意**：`docs/assets/js/site-config.js`（仓库版）是空对象（同源默认），上传后必须再执行一次 ① 的覆盖
（或调换顺序：先 ② 全量上传、再 ① 覆盖），确保 COS 上是 `apiBase: 'https://api.<域名>/api'` 版本。
浏览器验证：打开站点 → 控制台 `window.MN_SITE` → `{apiBase: 'https://api.<域名>/api'}`。

**后续每次改动 site-config.js 后都要重新覆盖上传**（全量同步会把仓库空对象版顶回去）。

## 6. CDN 缓存策略（CDN 控制台 → 域名管理 → 缓存配置）

本站无构建无内容哈希，缓存规则按文件类型：

| 路径 | 缓存 | 说明 |
|---|---|---|
| `*.html` | 不缓存（0 秒，遵循源站/回源） | 页面改动即时可见 |
| `assets/js/*.js`、`assets/css/*.css` | 600 秒 | site-config.js 也在内，改 apiBase 后「刷新目录」立即生效 |
| `assets/img/**`、其余 | 30 天 | 图片/字体基本不变 |

改动后如需立即生效：CDN 控制台 → 刷新预热 → URL 刷新（单文件）或目录刷新（`/assets/js/`）。

## 7. 后端配合（必须，缺一不可）

后端 `.env`（lighthouse-setup.md §4）：

```
COOKIE_DOMAIN=mn.world                    # 会话 cookie 放大到根域，前端子域才能携带登录态
FRONTEND_ORIGIN=https://mn.world,https://www.mn.world   # CORS 白名单（完整 scheme+域名，无路径）
```

链路原理：登录在 `api.mn.world` 种 `mn_session`（Domain=mn.world，SameSite=Lax，Secure）→
前端跨域请求 `credentials: 'include'` 自动携带（同站不同源，Lax 放行）→ 后端 CORS 白名单反射 Origin。

## 8. 上线检查清单（前端部分）

- [ ] `https://mn.world` 与 `https://www.mn.world` 打开正常（证书锁、无混合内容）
- [ ] 控制台 `window.MN_SITE.apiBase` 指向 `https://api.<域名>/api`（site-config.js 覆盖成功）
- [ ] 登录页发码/验证成功；DevTools → Application → Cookies → `mn_session` 带 `Domain=mn.world`
- [ ] Network 里 api 请求响应头含 `Access-Control-Allow-Origin: https://mn.world`（非 `*`）
- [ ] 另一个子域外站点（如 evil.example）构造同款请求被拒（无 CORS 头）——白名单生效
- [ ] 断网/后端停机演练：页面仍可浏览（本地为主）；恢复后登录正常
- [ ] 改动一个 HTML 后刷新可见（缓存策略生效）；改 site-config.js 后「目录刷新」生效

## 9. 成本

| 项 | 估算 |
|---|---|
| COS 存储 1.5MB | ~0（免费额度内） |
| CDN 流量 | 境外 0.1 元/GB 量级；小站月流量 <10GB ≈ **¥1-5/月** |
| 托管证书 | 免费 |

## 10. 更新流程（日常）

```bash
cd <repo>
coscmd upload -r docs/ /            # 全量上传（增量同步，只传变化文件）
# 若 site-config.js 之外另有改动且 apiBase 仍正确：无需重新覆盖
# CDN：html 不缓存即时可见；js/css 等 10 分钟或手动目录刷新
```
