-- 018_card_bg — Community 主页卡片背景自定义（v0.2.23.0）
-- 编辑资料弹窗「自定义」tab：液体玻璃卡片背景预设（liquid-glass-react 视觉移植，6 玻璃 + NULL=默认品牌横幅）。
-- 白名单键见 social.js / auth.js 的 CARD_BG_KEYS（服务端校验，PATCH /auth/me 拒非法键）。
-- 无新表 → health 58 不变；user_version 17 → 18。
ALTER TABLE users ADD COLUMN card_bg TEXT;
