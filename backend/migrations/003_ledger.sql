-- 003_ledger.sql — 流水账（财报基础：收款/退款/支出/调整，月度结账锁定）
-- 约定同 001：TEXT 主键 LED- + seq；金额 REAL（2 位小数，币种 RM/CNY 由 currency 标明，非微元——
-- 流水为人工录入的经营数据，与 usage_log 的机器微元口径不同）；occurred_at = 经济事件日期（期间归属）。

CREATE TABLE ledger (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  id           TEXT UNIQUE,                          -- LED-000001（允许 NULL：insertWithId 先插后回写）
  kind         TEXT NOT NULL,                        -- income 收款 / refund 退款 / expense 支出 / adjustment 调整
  category     TEXT NOT NULL,                        -- server/domain/saas/legal/marketing/tax/subscription/other
  amount       REAL NOT NULL,                        -- 正数；方向由 kind 决定（refund 冲减收款）
  currency     TEXT NOT NULL,                        -- RM / CNY（¥ 按汇率折 RM 入账）
  occurred_at  TEXT NOT NULL,                        -- YYYY-MM-DD（财报期间归属，月结按此锁定）
  counterparty TEXT NOT NULL DEFAULT '',             -- 对方（客户邮箱/供应商）
  note         TEXT NOT NULL DEFAULT '',             -- 备注
  invoice      TEXT NOT NULL DEFAULT '',             -- 发票号/账单号（凭证留文字引用；附件二期）
  created_by   TEXT,                                 -- users.id（录入管理员）
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_ledger_occurred ON ledger (occurred_at);
