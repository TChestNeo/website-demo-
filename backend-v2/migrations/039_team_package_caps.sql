-- 039_team_package_caps — 套餐团队容量与独立 Team Slots 分账
-- pkg-premium 承诺 36 人，pkg-ultra 承诺无限；slots-* 仍独立按 8/16/26/无限生效。
-- 两种权益各自保存到期时间，teams.js 取有效权益中的较高值，避免后买较小 Slots 覆盖套餐容量。
ALTER TABLE users ADD COLUMN team_package_cap TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN team_package_expires_at TEXT;

-- 为迁移前仍持有付费等级的套餐用户补齐快读字段。到期从最新一笔套餐付款单独推算，
-- 不能沿用 tier_expires_at：后者可能被其他等级续费延长，也可能因管理员永久等级而为空。
-- 已取消订阅会立即降 free，因此不参与回填，避免历史 paid 流水把已取消权益重新激活。
UPDATE users
SET team_package_cap = CASE (
      SELECT p.tier_key
      FROM payments p
      WHERE p.user_id = users.id
        AND p.status = 'paid'
        AND p.tier_key IN ('pkg-premium', 'pkg-ultra')
      ORDER BY p.seq DESC
      LIMIT 1
    )
      WHEN 'pkg-premium' THEN 'premium'
      WHEN 'pkg-ultra' THEN 'ultra'
      ELSE ''
    END,
    team_package_expires_at = (
      SELECT strftime('%Y-%m-%dT%H:%M:%fZ',
        COALESCE(p.paid_at, p.created_at),
        '+' || MAX(COALESCE(p.months, 1), 1) || ' months')
      FROM payments p
      WHERE p.user_id = users.id
        AND p.status = 'paid'
        AND p.tier_key IN ('pkg-premium', 'pkg-ultra')
      ORDER BY p.seq DESC
      LIMIT 1
    )
WHERE users.tier IN ('premium', 'ultra')
  AND EXISTS (
  SELECT 1 FROM payments p
  WHERE p.user_id = users.id
    AND p.status = 'paid'
    AND p.tier_key IN ('pkg-premium', 'pkg-ultra')
);
