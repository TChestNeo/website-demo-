-- 029_user_banner — 个人资料横幅图片（v0.2.58.18）
-- 用户「能不能把个人资料的自定义横幅/头像做一下」（问询钦定：仅本人编辑、本地上传+FC 图库双来源无 URL 输入、
-- 服务端限大小/格式页面居中裁切零裁剪 UI、≤10MB 含 gif、头像补图库入口、横幅显示在资料页顶部头像叠其上）：
-- banner_url = 图片地址（/uploads/UPL-* 本站直传 或 http(s) 外链；NULL = 默认预设渐变横幅）。
-- 前端渲染于 community-profile.html 资料页顶部 140px 横幅（他人主页也渲染你的图）。
-- 校验口径与 020 page_bg_image / auth.js PATCH /auth/me 同步（仅本站上传路径或 http(s) 外链，拒其余）。
-- 无新表 → health 60 不变；user_version 28 → 29。
ALTER TABLE users ADD COLUMN banner_url TEXT;
