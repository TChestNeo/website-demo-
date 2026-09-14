-- 022_articles_direct_publish — v0.2.46.1 文章直接发布（用户「我点击上传时是提交审核你能不能先去除掉这一段」）：
-- P6 发布去除审核段——原 P7 审核管线从未接文章，pending 恒卡死（作者自己可见、他人永远 404）。
-- POST /api/articles 改直存 published（路由同轮改）；本迁移把遗留 pending 文章一律转 published，
-- 此前已发布过的文章对他人立即可见。updated_at 不动（数据迁移不虚报编辑时间）。
-- 无新表 → health 58 不变；user_version 21 → 22
UPDATE articles SET status = 'published' WHERE status = 'pending';
