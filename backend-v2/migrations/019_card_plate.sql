-- 019_card_plate — Community 主页独立卡片背景（v0.2.24.0）
-- 用户「不是我要纯透明的还有把他单独变成卡片背景」：背景层与横幅完全分开——
-- card_bg（018）= 横幅预设（编辑弹窗改名「横幅」）；card_plate（本迁移）= 卡片背景预设，
-- 前端把卡身改纯透明 + 背景层铺满整卡并四周阔出 6px（参考代码蓝紫渐变风格）。
-- 白名单键与 card_bg 同用 CARD_BG_KEYS（social.js / auth.js，PATCH /auth/me 拒非法键）。
-- 无新表 → health 58 不变；user_version 18 → 19。
ALTER TABLE users ADD COLUMN card_plate TEXT;
