-- 042_subscription_entitlements — 逐订阅权益账本（P0-3）
-- payments 增两列：
--   active = Stripe 订阅行是否仍活跃（invoice.paid 置 1；subscription.deleted 置 0）
--   entitlement_expires_at = 该行权益的到期（订阅行 NULL=随活跃订阅；once 行 = 付款时点 + months）
-- users 增两列：管理员授权基线（staff_test_grant 写入；Stripe 取消事件不得抹掉）
-- tier / team_package_cap 从此一律由 src/entitlements.js 重算，不再由单一事件直接改写。

ALTER TABLE payments ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE payments ADD COLUMN entitlement_expires_at TEXT;

ALTER TABLE users ADD COLUMN admin_tier TEXT;
ALTER TABLE users ADD COLUMN admin_tier_expires_at TEXT;

-- 存量回填：
-- ① 全部已付行按 created_at + months 推到期（订阅行=当前周期结束估计；once 行=付款+months）
UPDATE payments
SET entitlement_expires_at = datetime(created_at, '+' || months || ' months')
WHERE status = 'paid' AND entitlement_expires_at IS NULL;
-- ② active 保持默认 1（订阅行）；重算只看 entitlement_expires_at，取消时清 NULL 立即失效
-- ③ tier 非 free 且没有任何已付行 = 历史管理员授予 → 落 admin_tier 基线（含到期）
UPDATE users
SET admin_tier = tier,
    admin_tier_expires_at = tier_expires_at
WHERE tier != 'free'
  AND id NOT IN (SELECT DISTINCT user_id FROM payments WHERE status = 'paid');
