-- 027_card_edge — Community 主页卡片边缘主题（v0.2.53.0）
-- 编辑资料弹窗「自定义」tab「边缘」区：FC 14 款边缘主题（paper/treasure/tech1-6/paint1-6）套用整张 profile-header 卡。
-- 白名单键见 social.js / auth.js 的 CARD_EDGE_KEYS（服务端校验，PATCH /auth/me 拒非法键）。
-- 无新表 → health 59 不变；user_version 26 → 27。
ALTER TABLE users ADD COLUMN card_edge TEXT;
