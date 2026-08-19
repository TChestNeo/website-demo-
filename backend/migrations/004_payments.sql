-- 002_payments.sql — 真实在线支付（Stripe 自动续费订阅）
-- users 增 tier_expires_at（NULL = 永久，管理员授予；支付/续费顺延 1 个月，取消/到期降 basic）
-- payments = 支付事件账（webhook 幂等：stripe_event_id UNIQUE；不对接 ledger，财务仍人工记账）。

ALTER TABLE users ADD COLUMN tier_expires_at TEXT;
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;

CREATE TABLE payments (
  seq                    INTEGER PRIMARY KEY AUTOINCREMENT,
  id                     TEXT UNIQUE,                -- PAY-xxxxxx（insertWithId）
  user_id                TEXT NOT NULL REFERENCES users(id),
  stripe_session_id      TEXT UNIQUE,                -- checkout 会话（pending 行由它定位转 paid）
  stripe_subscription_id TEXT,                       -- checkout.session.completed 回填
  stripe_invoice_id      TEXT UNIQUE,                -- 续费发票（invoice.paid 新增一行）
  stripe_event_id        TEXT UNIQUE,                -- webhook 幂等去重
  tier_key               TEXT NOT NULL,              -- premium/ultra/pkg-premium/pkg-ultra
  amount_micro           INTEGER NOT NULL DEFAULT 0,
  currency               TEXT NOT NULL DEFAULT 'myr',
  months                 INTEGER NOT NULL DEFAULT 1,
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  created_at             TEXT NOT NULL,
  paid_at                TEXT
);
CREATE INDEX idx_payments_user ON payments(user_id);
