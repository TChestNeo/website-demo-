-- 017_user_profile — Community 用户主页 + 关注系统（v0.2.21.0）
-- (a) following.users 一期按显示名原文存储（005 设计时 v1 无用户主页、本地种子是演示名，
--     转换会静默丢数据）→ 迁为 users.id 引用：显示名能映射到非 banned/deleted 用户的替换为 id
--     （同名多人取最早注册，ORDER BY created_at, seq 确定性）；映射不到的整行删除
--     （先删后改：UPDATE 绝不落 NULL——target_id 是显式 NOT NULL 列）。
-- (b) 粉丝数按 (target_type, target_id) 反查无索引（主键是 (user_id, target_type, target_id)）→ 补索引。
-- 无新表 → health 58 不变。

BEGIN TRANSACTION;

DELETE FROM following WHERE target_type = 'user' AND NOT EXISTS (
  SELECT 1 FROM users u
  WHERE u.display_name = following.target_id
    AND u.display_name IS NOT NULL
    AND u.status NOT IN ('banned','deleted')
);

UPDATE following SET target_id = (
  SELECT u.id FROM users u
  WHERE u.display_name = following.target_id
    AND u.status NOT IN ('banned','deleted')
  ORDER BY u.created_at ASC, u.seq ASC LIMIT 1
) WHERE target_type = 'user';

CREATE INDEX idx_following_target ON following(target_type, target_id);

COMMIT;
