-- 030_user_crop — 头像/横幅显示范围裁切元数据（v0.2.58.25）
-- 用户「那个横幅和头像在上传后能不能先弹出一个选择裁切范围的弹窗调整裁切范围」：
-- 裁切=显示范围裁切（绝不重编码，原文件原样上传，GIF 保持动画）——前端弹窗产出归一化矩形，
-- 服务端只存元数据；渲染=img+几何数学（中心锚定 cover，w=h=1 与 background-size:cover+center 等价）。
-- avatar_crop/banner_crop = TEXT JSON {"x":0..1,"y":0..1,"w":>0..1,"h":>0..1}（归一化矩形，x+w≤1、y+h≤1；
--   NULL = 默认 {0,0,1,1} 整图 cover=爷爷辈零回归）。
-- 公开渲染（他人主页/FC 频道卡也看裁切效果）→ social.js GET /social/users/:id 暴露；PATCH /auth/me 白名单校验。
-- 连带清：url 置 null 或换 url 未带 crop 时对应 crop 重置 NULL（防旧裁切错配新图）。
-- 无新表 → health 60 不变；user_version 29 → 30。
ALTER TABLE users ADD COLUMN avatar_crop TEXT;
ALTER TABLE users ADD COLUMN banner_crop TEXT;
