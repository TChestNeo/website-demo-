-- 009_finance — 财务（§8 Finance / §9 Subscriptions / §10 Promos / §11 Refunds / §12 Donations / §23 Payroll）
-- 金额口径（D1）：机器事件整数微元（payments/refunds/subscriptions/pricing/promos/payroll 列名 *_micro）；
--   人工记账 REAL 2 位小数 + 显式 currency（ledger/donations）。
-- ledger：v1 原样 + category 扩 13 类 + donation_id（慈善捐赠出账关联）
-- payments：v1 全列 + 区域定价/促销口径 + status 'partial_refunded'
-- refunds/subscriptions/donations/promos/checkout_events/payroll/staff_rates：§9-§12/§23 新表
-- pricing_plans/pricing_regions：区域定价每地区独立价格，禁止汇率换算（§9）

CREATE TABLE ledger (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  id           TEXT UNIQUE,                          -- LED-000001
  kind         TEXT NOT NULL,                        -- income 收款 / refund 退款 / expense 支出 / adjustment 调整
  category     TEXT NOT NULL CHECK (category IN ('subscription','payment_fees','refund','server','domain','saas','ai','payroll','charity','marketing','legal','tax','other')),
  amount       REAL NOT NULL,                        -- 正数；方向由 kind 决定（refund 冲减收款）
  currency     TEXT NOT NULL,                        -- RM / CNY（¥ 按汇率折 RM 入账）
  occurred_at  TEXT NOT NULL,                        -- YYYY-MM-DD（财报期间归属，月结按此锁定）
  counterparty TEXT NOT NULL DEFAULT '',             -- 对方（客户邮箱/供应商）
  note         TEXT NOT NULL DEFAULT '',             -- 备注
  invoice      TEXT NOT NULL DEFAULT '',             -- 发票号/账单号
  donation_id  TEXT,                                 -- charity 出账关联捐赠记录（§12）
  created_by   TEXT,                                 -- staff.id
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_ledger_occurred ON ledger (occurred_at);

CREATE TABLE payments (
  seq                    INTEGER PRIMARY KEY AUTOINCREMENT,
  id                     TEXT UNIQUE,                -- PAY-xxxxxx
  user_id                TEXT NOT NULL REFERENCES users(id),
  stripe_session_id      TEXT UNIQUE,                -- checkout 会话（pending 行由它定位转 paid）
  stripe_subscription_id TEXT,                       -- checkout.session.completed 回填
  stripe_invoice_id      TEXT UNIQUE,                -- 续费发票（invoice.paid 新增一行）
  stripe_event_id        TEXT UNIQUE,                -- webhook 幂等去重
  tier_key               TEXT NOT NULL,              -- basic/premium/ultra/pkg-premium/pkg-ultra
  amount_micro           INTEGER NOT NULL DEFAULT 0,
  currency               TEXT NOT NULL DEFAULT 'myr',
  months                 INTEGER NOT NULL DEFAULT 1,
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded','partial_refunded')),
  region                 TEXT,                       -- 区域定价地区（§9）
  list_amount_micro      INTEGER NOT NULL DEFAULT 0, -- 区域定价原价（折扣前，促销口径）
  discount_micro         INTEGER NOT NULL DEFAULT 0, -- 促销抵扣（§10）
  promo_id               TEXT,                       -- 应用的促销（§10）
  stripe_coupon_id       TEXT,
  created_at             TEXT NOT NULL,
  paid_at                TEXT
);
CREATE INDEX idx_payments_user ON payments(user_id);

CREATE TABLE refunds (
  seq              INTEGER PRIMARY KEY AUTOINCREMENT,
  id               TEXT UNIQUE,                      -- REF-xxxxxx
  payment_id       TEXT NOT NULL REFERENCES payments(id),
  amount_micro     INTEGER NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'myr',
  reason           TEXT NOT NULL,
  requested_by     TEXT NOT NULL,                    -- staff.id 建档人
  approved_by      TEXT,                             -- staff.id 审批人（**AI 永无此键**，§11/§29）
  status           TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','under_review','approved','processing','completed','rejected')),
  stripe_refund_id TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_status ON refunds(status);

-- 订阅账本（§9）：users.tier/tier_expires_at 保留为快读字段，webhook 双写
CREATE TABLE subscriptions (
  seq                    INTEGER PRIMARY KEY AUTOINCREMENT,
  id                     TEXT UNIQUE,                -- SUB-xxxxxx
  user_id                TEXT NOT NULL REFERENCES users(id),
  plan_key               TEXT NOT NULL,              -- basic/premium/ultra/pkg-premium/pkg-ultra
  tier_key               TEXT NOT NULL,              -- 生效 tier（pkg-* 映射 premium/ultra）
  region                 TEXT,
  amount_micro           INTEGER NOT NULL DEFAULT 0,
  currency               TEXT NOT NULL DEFAULT 'myr',
  promo_id               TEXT,
  stripe_subscription_id TEXT UNIQUE,
  status                 TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled','expired')),
  current_period_start   TEXT,
  current_period_end     TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id, status);

CREATE TABLE donations (
  seq              INTEGER PRIMARY KEY AUTOINCREMENT,
  id               TEXT UNIQUE,                      -- DON-xxxxxx
  period           TEXT NOT NULL,                    -- '2026-H1' 等财报期
  commission_micro INTEGER NOT NULL DEFAULT 0,       -- 佣金基数（利润的 2% 口径，§12）
  donation_micro   INTEGER NOT NULL DEFAULT 0,       -- 佣金实捐金额
  organization     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','sent','received','verified')),
  receipt          TEXT NOT NULL DEFAULT '',         -- 凭证（收据号/链接）
  note             TEXT NOT NULL DEFAULT '',
  created_by       TEXT,                             -- staff.id
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX idx_donations_period ON donations(period);

-- 套餐基准价（五 SKU；stripe price 引用按通道）；区域定价在 pricing_regions（每地区独立价格）
CREATE TABLE pricing_plans (
  plan_key            TEXT PRIMARY KEY,              -- basic/premium/ultra/pkg-premium/pkg-ultra
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  base_price_micro    INTEGER NOT NULL DEFAULT 0,    -- 基准价（上线前由管理员配置）
  currency            TEXT NOT NULL DEFAULT 'myr',
  stripe_price_id     TEXT NOT NULL DEFAULT '',      -- recurring（订阅通道）
  stripe_price_once_id TEXT NOT NULL DEFAULT '',     -- one_time（单次购买通道）
  active              INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE pricing_regions (
  plan_key            TEXT NOT NULL REFERENCES pricing_plans(plan_key) ON DELETE CASCADE,
  region              TEXT NOT NULL,                 -- 如 my / cn / sg（独立价格，禁止汇率换算 §9）
  price_micro         INTEGER NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'myr',
  stripe_price_id     TEXT NOT NULL DEFAULT '',
  stripe_price_once_id TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  PRIMARY KEY (plan_key, region)
);

CREATE TABLE promos (
  seq               INTEGER PRIMARY KEY AUTOINCREMENT,
  id                TEXT UNIQUE,                     -- PRM-xxxxxx
  code              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL DEFAULT '',
  discount_percent  INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 99),
  start_at          TEXT NOT NULL,
  end_at            TEXT NOT NULL,
  regions           TEXT NOT NULL DEFAULT '[]',      -- JSON：适用地区（空 = 全部）
  plans             TEXT NOT NULL DEFAULT '[]',      -- JSON：适用套餐（空 = 全部）
  stripe_coupon_id  TEXT,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','ended')),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- 转化率口径（§9）：paid/created；promo 期间收入按 payments.discount_micro 反推
CREATE TABLE checkout_events (
  seq               INTEGER PRIMARY KEY AUTOINCREMENT,
  id                TEXT UNIQUE,                     -- CHK-xxxxxx
  user_id           TEXT NOT NULL REFERENCES users(id),
  stripe_session_id TEXT UNIQUE,
  plan_key          TEXT NOT NULL,
  mode              TEXT NOT NULL DEFAULT 'subscription' CHECK (mode IN ('subscription','once')),
  region            TEXT,
  promo_id          TEXT,
  amount_micro      INTEGER NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'myr',
  status            TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed')),
  created_at        TEXT NOT NULL,
  paid_at           TEXT
);
CREATE INDEX idx_checkout_user ON checkout_events(user_id, created_at);

CREATE TABLE payroll (
  seq                INTEGER PRIMARY KEY AUTOINCREMENT,
  id                 TEXT UNIQUE,                    -- PRL-xxxxxx
  staff_id           TEXT NOT NULL REFERENCES staff(id),
  period             TEXT NOT NULL,                  -- YYYY-MM（月薪周期）
  tickets_replied    INTEGER NOT NULL DEFAULT 0,
  tickets_completed  INTEGER NOT NULL DEFAULT 0,
  rate_micro         INTEGER NOT NULL DEFAULT 0,     -- 计算时费率快照
  total_micro        INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid')),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (staff_id, period)
);

CREATE TABLE staff_rates (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id       TEXT NOT NULL REFERENCES staff(id),
  rate_micro     INTEGER NOT NULL DEFAULT 0,         -- 时薪（微元 MYR）
  currency       TEXT NOT NULL DEFAULT 'myr',
  effective_from TEXT NOT NULL,                      -- 费率生效日（历史费率按此列取）
  note           TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_staff_rates ON staff_rates(staff_id, effective_from);

-- ── 种子：五 SKU 套餐（价格上线前由管理员 UI 配置；Basic = 学生价付费层，新用户默认 free）──
INSERT OR IGNORE INTO pricing_plans (plan_key, name, description, created_at, updated_at) VALUES
  ('basic',       'Basic 基础',        '学生价订阅（付费层）', '2026-08-27T00:00:00.000Z', '2026-08-27T00:00:00.000Z'),
  ('premium',     'Premium 进阶',      '',                     '2026-08-27T00:00:00.000Z', '2026-08-27T00:00:00.000Z'),
  ('ultra',       'Ultra 旗舰',        '',                     '2026-08-27T00:00:00.000Z', '2026-08-27T00:00:00.000Z'),
  ('pkg-premium', 'Premium 整包',      '',                     '2026-08-27T00:00:00.000Z', '2026-08-27T00:00:00.000Z'),
  ('pkg-ultra',   'Ultra 整包',        '',                     '2026-08-27T00:00:00.000Z', '2026-08-27T00:00:00.000Z');
