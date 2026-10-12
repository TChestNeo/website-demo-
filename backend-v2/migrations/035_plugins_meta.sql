-- 035_plugins_meta — 插件商店上传者/GitHub 元数据（站点 v0.2.59.10）
-- 开发者模式上传插件弹窗支持「上传 / 连接 GitHub」；GitHub 连接插件卡片名右侧显示 GitHub logo；
-- 卡片左下角显示上传者头像+名称（点击出作者名片）。新增两列：github（仓库地址）、author_avatar（作者头像）。
-- user_version 34 → 35。
ALTER TABLE plugins ADD COLUMN github TEXT;
ALTER TABLE plugins ADD COLUMN author_avatar TEXT;

-- 演示：天气卡连一个 GitHub 仓库，展示卡片上的 GitHub logo（头像留空走前端兜底）
UPDATE plugins SET github = 'https://github.com/mnationworld/weather-card' WHERE id = 'demo-weather-card';
