-- 028_article_comments — v0.2.55.0 文章评论（用户钦定「点赞+收藏+评论」：平台侧文章详情页补齐互动，
-- 评论需要新后端——comments 表 post_id 绑定帖子，文章评论独立同构表）：
-- 一层结构无回复（帖子评论 parent_id 回复机制文章不接，用户口径「别那么复杂」）；
-- 结构照抄 005 comments 表（id 允许 NULL 是 insertWithId「先插 NULL 后回写」的硬契约；FK 级联同口径）；
-- ID 前缀 ACM- 与帖子 CMT- 隔离（moderation_items target_id 弱引用防同号混淆）。
-- 新表 1 张 → health 59 → 60；user_version 27 → 28
CREATE TABLE article_comments (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT UNIQUE,                            -- ACM-xxxxxx
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id),
  content    TEXT NOT NULL,                          -- ≤2000 字（写入层校验）
  status     TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_article_comments_article ON article_comments(article_id, created_at);
