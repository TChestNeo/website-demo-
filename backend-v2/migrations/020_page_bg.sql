-- 020_page_bg — Community 主页整页背景图片（v0.2.25.0）
-- 用户「在自定义那边再加上一个背景图片 这个就是整个页面的背景的图片」（问询钦定：只个人主页、
-- 公开、上传+网址双支持）：page_bg_image = 图片地址（/uploads/UPL-* 本站直传 或 http(s) 外链；
-- NULL = 默认无背景）。前端渲染于 community-profile.html 整页 body 背景（他人主页也渲染你的图）。
-- 校验口径与 social.js/auth.js PATCH /auth/me 同步（仅本站上传路径或 http(s) 外链，拒其余）。
-- 无新表 → health 58 不变；user_version 19 → 20。
ALTER TABLE users ADD COLUMN page_bg_image TEXT;
