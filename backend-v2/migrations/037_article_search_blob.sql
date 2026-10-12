-- 037_article_search_blob — 智能搜索压缩摘要（用户「发布文章时 DeepSeek Flash 生成压缩总结
-- （包含整个文章的特征等信息）存库，智能搜索按此匹配省 token」）。
-- user_version 36 → 37。
ALTER TABLE articles ADD COLUMN search_blob TEXT;
