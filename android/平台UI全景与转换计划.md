# M.NationWorld 平台 UI 全景 → 安卓 App 转换计划

扫描日期：2026-10-12。范围：全站 52 个页面（docs/*.html + docs/pages/*.html），逐一阅读分析。
结论：app 需原生重写约 30 个屏幕 + 1 个 WebView（FC 编辑器）+ 跳过纯演示页。

## 一、已完成（app 线上）

| 网页 | App 屏幕 | 状态 |
| --- | --- | --- |
| signup-and-login（登录/注册，密码+验证码双因素） | 登录屏（渐变品牌卡+药丸切换+步骤条） | ✅ 1.0.2+ |
| forgot-password（找回密码） | 待做 | ⬜ |
| index/dashboard（首页工作台） | 首页 tab（我的国家+最新动态，浅版） | 🔶 需补全（通知/搜索/指标/快捷入口） |
| community-hub（社区流） | 社区 tab（发帖+点赞，浅版） | 🔶 需补全（评论/转发/收藏/上传） |
| messages（消息中心列表） | 消息 tab（会话列表） | 🔶 需补聊天界面 |
| 我的（设置中心 5 分类） | 设置中心完整版 | ✅ 1.1.0 |

## 二、核心高频（下一批，原生）

| 优先级 | 网页 | App 屏幕 | API |
| --- | --- | --- | --- |
| P1 | community-post | 帖子详情：正文/媒体/点赞/收藏/转发/分享 | GET posts/:id, comments, POST/DELETE like/favorite/repost |
| P1 | messages 聊天卡片 | 会话聊天：气泡/发送/文件/已读 | GET/POST conversations/:id/messages |
| P1 | community-profile | 用户主页：横幅/头像/统计/关注/内容 tab | GET users/:id, users/:id/posts, follow |
| P1 | index 通知弹窗 | 通知中心：点赞/评论/关注/好友请求（同意拒绝） | GET notifications, POST friend-requests/:id/accept,decline |
| P1 | article | 文章阅读：富媒体卡片渲染+目录+评论 | GET articles/:id, comments, like/favorite |
| P1 | help + ticket | 帮助中心（FAQ 折叠）+ 工单提交 | POST /api/tickets, chat 客服 |
| P1 | micronationary/overview/explore | 百科三视图：统计/搜索/AI 搜索/国家列表 | GET public/activity, nations, topics, articles, articles/search/smart |
| P2 | forgot-password | 找回密码（邮箱码+新密码） | email-code(password_reset), verify-code, password-reset |

## 三、创建向导（原生，中等）

| 网页 | App 屏幕 |
| --- | --- |
| create-world | 世界类型选择（8 卡） |
| registry-step-1/2/3 | 国家注册三步（身份→地缘→宏观指标，含扇区环形图） |
| create-topic-step-1/2/3 | 建话题三步（信息→品牌→审核） |
| world-wizard + world-created + sovereignty-ratified | 世界向导（21 类型配置）+ 完成页 |
| onboarding-identity + onboarding-complete | 引导身份设置 + 完成页 |

## 四、FC 创作（混合）

| 网页 | App 方案 |
| --- | --- |
| fluidcanvas（五视图工作台） | 原生列表外壳（dashboard/content/upload/analytics/articles） |
| fluidcanvas-editor（拖拽画布编辑器） | WKWebView 嵌入（已定案；原生重写=数月工程） |

## 五、法律/静态文档（原生简单文本页，复用同一渲染器）

terms / privacy / financial-terms / platform-responsibility / community-rules / guidelines / about / error-codes / badge（验证表单）

## 六、低频/商业页（按需原生）

plugins（商店+安装）/ premium（订阅三档+Stripe）/ activity（分析看板）/ following（关注管理）/ workspace（演示，低优先）

## 七、跳过

blackhole-demo / cyberfall-demo / edge-themes-demo（纯 WebGL/CSS 演示）、construction（占位）、transitioning（倒计时插页）、fluidcanvas-analytics/articles（重定向存根）、download.html（app 内无意义）

## 批量节奏

1. 1.2.0：帖子详情 + 聊天界面 + 用户主页
2. 1.3.0：通知中心 + 文章阅读 + 帮助/工单
3. 1.4.0：百科三视图 + 找回密码
4. 1.5.0：创建向导族（国家/话题/世界）
5. 1.6.0：FC 工作台外壳 + 编辑器 WebView + 法律文档
6. 1.7.0：插件商店 + Premium + 分析 + 关注管理
