-- 016_post_views — Community 帖子浏览量（v0.2.20.0：帖页每打开一次 +1）
-- 简单计数列（同帖多次刷新也累计，试运营口径可接受；正式发布再考虑 viewer 去重表）。
-- 收藏用 005 已有的 favorites 表（target_type='post'），零新表 → health 58 不变。
ALTER TABLE posts ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
