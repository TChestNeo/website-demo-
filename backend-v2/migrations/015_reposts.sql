-- 015_reposts — Community 帖子转发（v0.2.18.0 真转发：转发即发帖，Twitter 式）：
-- posts.repost_of 指向被转发原帖 id（NULL = 普通帖）；转发帖 content = 转发语（允许空串 = 裸转发）。
-- 原帖随行嵌入由 postRow 按 repost_of 现查（浅一层，不递归；原帖不可见 → 前端占位「原帖已删除或不可见」）。
-- 点赞/评论天然作用于转发帖（转发帖就是 posts 行，零额外工作）。
-- 无新表 → health 58 不变（ALTER 不改 sqlite_master 表数）。
ALTER TABLE posts ADD COLUMN repost_of TEXT;
CREATE INDEX idx_posts_repost_of ON posts(repost_of);
