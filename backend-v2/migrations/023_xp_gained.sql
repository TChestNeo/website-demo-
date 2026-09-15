-- 023_xp_gained — v0.2.49.0 社交获得类经验（用户数值表：粉丝+25/赞+15/获评论+10/收藏+12）
-- 「别人对你做」的获得类 XP 由后端实时累加进 users.xp_gained（social.js gainXp 助手）；
-- 动作类 XP 仍在前端 localStorage（既有 addXP 体系，storage.js）。
-- 前端总经验 = 本地动作 XP + 后端获得 XP（getLevelState 内部合计，等级表/徽章/公式零改动）。
-- 只进不出：取关/取消赞不清算（防刷循环）；自赞/自评/自藏由路由排除。
-- 无新表 → health 58 不变；user_version 22 → 23
ALTER TABLE users ADD COLUMN xp_gained INTEGER NOT NULL DEFAULT 0;
