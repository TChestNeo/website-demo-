-- 005_free_tier.sql — 等级模型调整：新增免费「普通用户」（free）层，Basic 变学生价付费层（RM12/月）
-- 变更：新用户默认 tier = 'free'（Basic 不再直接拥有，需订阅/购买）；CHECK 放宽为 ('free','basic','premium','ultra')。
-- 存量保留：已有 Basic 用户不受影响（INSERT SELECT 原样搬行，只改新表默认值/CHECK，不动任何现有数据）。
-- SQLite 不能 ALTER CHECK 约束 → 重建 users 表（外键暂关；db.js exec 无事务包装，事务由本文件自理）。

PRAGMA foreign_keys = OFF;
BEGIN;

CREATE TABLE users_new (
  seq                 INTEGER PRIMARY KEY AUTOINCREMENT,
  id                  TEXT UNIQUE,
  email               TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name        TEXT NOT NULL DEFAULT '',
  citizen_id          TEXT UNIQUE,
  avatar_url          TEXT,
  language            TEXT NOT NULL DEFAULT 'zh',
  country             TEXT,
  dob                 TEXT,
  bio                 TEXT,
  tier                TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','basic','premium','ultra')),
  role                TEXT NOT NULL DEFAULT 'user'  CHECK (role IN ('user','admin')),
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','banned','delete_pending','deleted')),
  warning_count       INTEGER NOT NULL DEFAULT 0,
  muted_until         TEXT,
  rate_limited_until  TEXT,
  preferences         TEXT NOT NULL DEFAULT '{}',
  last_active_at      TEXT,
  delete_requested_at TEXT,
  data_deleted_at     TEXT,
  tier_expires_at     TEXT,                          -- 004 增列（NULL=永久；订阅到期惰性降级）
  stripe_customer_id  TEXT,                          -- 004 增列（Stripe Customer 关联）
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

INSERT INTO users_new (seq, id, email, display_name, citizen_id, avatar_url, language, country, dob, bio,
  tier, role, status, warning_count, muted_until, rate_limited_until, preferences, last_active_at,
  delete_requested_at, data_deleted_at, tier_expires_at, stripe_customer_id, created_at, updated_at)
SELECT seq, id, email, display_name, citizen_id, avatar_url, language, country, dob, bio,
  tier, role, status, warning_count, muted_until, rate_limited_until, preferences, last_active_at,
  delete_requested_at, data_deleted_at, tier_expires_at, stripe_customer_id, created_at, updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_citizen ON users(citizen_id);

COMMIT;
PRAGMA foreign_keys = ON;
