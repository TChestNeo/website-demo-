-- 034_plugins — 插件系统（站点 v0.2.59.0）
-- 插件商店：用户写插件 → AI 检查 → 官方审核上架 → 默认高级订阅门槛 → 看使用量下放订阅等级。
-- 三张表：plugins（插件本体+审核状态+门槛）、plugin_versions（版本历史）、plugin_installs（安装关系）。
-- user_version 33 → 34。

CREATE TABLE plugins (
  id            TEXT PRIMARY KEY,                -- 唯一标识（作者前缀，如 demo-weather-card）
  name          TEXT NOT NULL,                   -- 显示名
  author_id     TEXT NOT NULL,                   -- 作者 user id（非 FK：允许 sys 官方种子）
  author_name   TEXT NOT NULL DEFAULT '',        -- 作者显示名（denormalized，展示免 join）
  description   TEXT NOT NULL DEFAULT '',        -- 简介介绍
  icon          TEXT,                            -- 图标（emoji / 短串）
  preview       TEXT,                            -- 预览图（data URI / http / linear-gradient）
  category      TEXT NOT NULL DEFAULT 'general', -- 分类（store 筛选）
  manifest      TEXT NOT NULL DEFAULT '{}',      -- 完整 manifest JSON（capabilities 等）
  code          TEXT,                            -- 插件代码（首个版本；后续版本在 plugin_versions）
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  min_tier      TEXT NOT NULL DEFAULT 'premium' CHECK (min_tier IN ('free','basic','premium','ultra')),
  install_count INTEGER NOT NULL DEFAULT 0,      -- 安装量（「使用量下放」的初版代理）
  usage_count   INTEGER NOT NULL DEFAULT 0,      -- 实际使用量（后续扩展点执行时累加）
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE plugin_versions (
  plugin_id  TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  version    TEXT NOT NULL,
  changelog  TEXT NOT NULL DEFAULT '',           -- 更新说明
  code       TEXT,                               -- 该版本代码
  created_at TEXT NOT NULL,
  PRIMARY KEY (plugin_id, version)
);

CREATE TABLE plugin_installs (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plugin_id    TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  enabled      INTEGER NOT NULL DEFAULT 1,
  installed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, plugin_id)
);

-- 种子：2 个演示插件（premium 门槛 + free 门槛），让商店第一环有东西可看
INSERT INTO plugins (id, name, author_id, author_name, description, icon, preview, category, manifest, status, min_tier, created_at, updated_at) VALUES
  ('demo-weather-card', '天气卡', 'sys', 'M.NationWorld 官方', '在画布里添加实时天气卡片，支持多城市切换与温度单位。', '⛅', 'linear-gradient(135deg,#4648d4,#7b7ff0)', 'card', '{"capabilities":["cardType"]}', 'approved', 'premium', '2026-10-07T00:00:00.000Z', '2026-10-07T00:00:00.000Z'),
  ('demo-minimal-theme', '极简主题', 'sys', 'M.NationWorld 官方', '一套更清爽的 UI 配色与画布背景。', '🎨', 'linear-gradient(135deg,#0f2027,#2c5364)', 'theme', '{"capabilities":["ui.theme","ui.background"]}', 'approved', 'free', '2026-10-07T00:00:00.000Z', '2026-10-07T00:00:00.000Z');

INSERT INTO plugin_versions (plugin_id, version, changelog, created_at) VALUES
  ('demo-weather-card', '1.0.0', '首个版本：支持单城市天气卡。', '2026-10-07T00:00:00.000Z'),
  ('demo-weather-card', '1.1.0', '新增多城市切换与温度单位设置。', '2026-10-07T00:00:00.000Z'),
  ('demo-minimal-theme', '1.0.0', '首个版本：极简配色 + 画布背景。', '2026-10-07T00:00:00.000Z');
