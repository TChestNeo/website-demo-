-- 004_platform — 平台设置（§26 + D8 预算迁强类型表）
-- platform_settings：强类型（string|number|boolean|json），写操作必审计，updated_by 记录
-- kv：仅 cron.* 运行时键（上次运行时间等），不进 UI

CREATE TABLE platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'json' CHECK (type IN ('string','number','boolean','json')),
  description TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE kv (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);

-- ── 种子 ──
INSERT OR IGNORE INTO platform_settings (key, value, type, description, updated_at) VALUES
  ('platform.name', 'SlatiWorld', 'string', '平台名', '2026-08-27T00:00:00.000Z'),
  ('platform.description', 'M.NationWorld — 硬核架空国家创作社区', 'string', '平台简介', '2026-08-27T00:00:00.000Z'),
  ('budget.moderation_text', '30', 'number', '文字审核月度预算（元）', '2026-08-27T00:00:00.000Z'),
  ('budget.moderation_image', '10', 'number', '图像审核月度预算（元）', '2026-08-27T00:00:00.000Z'),
  ('budget.chat', '20', 'number', 'AI 客服月度预算（元）', '2026-08-27T00:00:00.000Z'),
  ('budget.copilot', '10', 'number', 'Copilot 子额度（元，计入 total）', '2026-08-27T00:00:00.000Z'),
  ('budget.total', '60', 'number', '月度总预算上限（元，红线 ≥80% warn ≥100% degrade）', '2026-08-27T00:00:00.000Z'),
  ('finance.fx', '0.62', 'number', 'CNY→MYR 汇率（AI 成本折算用；区域定价禁止用汇率换算）', '2026-08-27T00:00:00.000Z'),
  ('finance.tax_rate', '0.02', 'number', '税率（税单列，不进利润公式）', '2026-08-27T00:00:00.000Z'),
  ('finance.fixed_monthly', '0', 'number', '固定月度成本（元 MYR，可被 ledger 覆盖）', '2026-08-27T00:00:00.000Z'),
  ('finance.quarter_target', '0', 'number', '季度目标（MYR）', '2026-08-27T00:00:00.000Z'),
  ('features', '{}', 'json', '功能开关（站点点此读取）', '2026-08-27T00:00:00.000Z'),
  ('maintenance', '{"enabled":false,"message":"","start":null,"end":null}', 'json', '维护模式（公网只读/全停）', '2026-08-27T00:00:00.000Z'),
  ('support.hours', '{"start":"09:00","end":"18:00"}', 'json', '客服全局工作时间', '2026-08-27T00:00:00.000Z'),
  ('languages', '["zh","en","ms"]', 'json', '平台语言', '2026-08-27T00:00:00.000Z');
