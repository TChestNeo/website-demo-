# M.NationWorld — iOS / iPadOS App（SwiftUI）

一套 SwiftUI 代码同时适配 **iPhone + iPad**（`TARGETED_DEVICE_FAMILY = 1,2`），
直连现有后端 `https://mnationworld.com` 的 REST API，**后端零重写**。

## 目录结构

```
ios/
├── project.yml                     # XcodeGen 工程定义（无 Mac 也能维护，生成 .xcodeproj）
├── .github/workflows/ios-build.yml # GitHub Actions 云端编译验证（macOS runner）
└── MNationWorld/
    ├── MNationWorldApp.swift       # @main 入口，注入 Session
    ├── ContentView.swift           # 根视图：未登录→LoginView，已登录→MainTabView
    ├── Models/Models.swift         # User / Post / Nation / Conversation（镜像后端形状）
    ├── Networking/
    │   ├── APIClient.swift         # REST 客户端（登录/动态/点赞/消息/百科）
    │   └── Session.swift           # @Observable 会话（cookie 由 URLSession 自动托管）
    └── Views/
        ├── MainTabView.swift       # 5 tab；iPhone=TabView，iPad=NavigationSplitView
        ├── LoginView.swift         # 邮箱验证码两步登录（对齐 /api/auth 契约）
        └── StubViews.swift         # 5 个模块占位（逐轮填充真实内容）
```

## 如何构建

### 有 Mac（最省事）

```bash
brew install xcodegen
cd ios
xcodegen generate          # 由 project.yml 生成 MNationWorld.xcodeproj
open MNationWorld.xcodeproj
```

### 没有 Mac（当前情况）

- 代码全部在此仓库维护，**云端用 GitHub Actions 的 macOS runner 编译验证**（推送到 GitHub 即自动跑 `.github/workflows/ios-build.yml`）。
- 真机调试 / TestFlight / 上架 App Store 最终需要 Mac（或云 Mac 服务）。
- 上架需要付费 Apple Developer Program（$99/年）；免费 Apple ID 只能 7 天真机侧载。

## 后端 API 契约（与网页端逐字一致）

| 功能 | 端点 |
| --- | --- |
| 发验证码 | `POST /api/auth/email-code` `{email, purpose?}` |
| 登录/注册 | `POST /api/auth/verify` `{email, code, password?, displayName?}` → `{status, user}` + Set-Cookie `mn_session` |
| 当前用户 | `GET /api/auth/me` |
| 登出 | `POST /api/auth/logout` |
| 社区动态 | `GET /api/social/feed` · `GET /api/social/posts` |
| 点赞 | `POST / DELETE /api/social/posts/:id/like` |
| 百科国家 | `GET /api/social/nations` |
| 消息 | `GET /api/messages`（形状以 `backend-v2/src/routes/public/messages.js` 为准） |

Cookie 会话：URLSession 共享 cookie 存储自动保存 `mn_session` 并随请求携带，与网页登录同源。

## 交付分期（整个网站 → app）

- **P0（骨架，已完成）**：工程结构、登录、5 tab、会话。
- **P1（核心浏览）**：首页工作台、百科列表、社区动态流 + 发帖 + 点赞、消息会话。
- **P2（我的）**：用户卡片 + 设置与隐私 5 分类（活动/账户/可见性/互动/偏好设置）、删除账户 30 天后悔期。
- **P3（复杂功能）**：FluidCanvas 编辑器先用 WKWebView 嵌入现有网页，逐步原生化。

> ?????? 2026-10-12 20:23
