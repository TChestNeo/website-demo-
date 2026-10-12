-- 036_article_summary — 文章简介（用户「搜索页显示文章简介，最多 125 字」；
-- 发布时 DeepSeek Flash 生成存本列，搜索/文章列表返回给前端展示）。
-- user_version 35 → 36。
ALTER TABLE articles ADD COLUMN summary TEXT;
