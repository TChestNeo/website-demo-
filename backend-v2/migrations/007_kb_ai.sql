-- 007_kb_ai — 知识库与 AI 日志（§13 KB / §14 AI 日志 / §20 AI 架构）
-- kb_categories：9 类种子（§13）；kb_articles：三语言关键词 + 内部文章标记（kb.view 权限过滤）
-- chat_logs（§14 硬性要求，D5 用户批准的变更）：记录问答内容——公网客服与工单 AI 痕迹全落此表；
--   权限 cs.logs.view 收紧（内容敏感）；usage_log 仍零内容。
-- usage_log：v1 全列 + feature 'copilot'（子额度计入 total）+ status（ok|error|unconfigured）+ provider。

CREATE TABLE kb_categories (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT UNIQUE,                           -- KBC-xxxxxx
  parent_id  TEXT REFERENCES kb_categories(id),
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE kb_articles (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  id           TEXT UNIQUE,                         -- KB-xxxxxx
  category_id  TEXT NOT NULL REFERENCES kb_categories(id),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  keywords     TEXT NOT NULL DEFAULT '{"zh":[],"en":[],"ms":[]}',  -- 三语言关键词（§13 检索）
  language     TEXT NOT NULL DEFAULT 'zh' CHECK (language IN ('zh','en','ms')),
  is_internal  INTEGER NOT NULL DEFAULT 0 CHECK (is_internal IN (0,1)),  -- 内部指引（kb.view 过滤）
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version      INTEGER NOT NULL DEFAULT 1,
  updated_by   TEXT,                                -- staff.id
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_kb_cat ON kb_articles(category_id, status);

-- §14：AI 客服/工单 AI 痕迹全字段（问答内容敏感——cs.logs.view 权限，普通客服掩码）
CREATE TABLE chat_logs (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  id             TEXT UNIQUE,                       -- CHL-xxxxxx
  source         TEXT NOT NULL CHECK (source IN ('public_chat','ticket')),
  user_id        TEXT REFERENCES users(id),         -- 匿名会话可 NULL
  staff_id       TEXT REFERENCES staff(id),         -- Copilot 触发的工单痕迹（W3）
  ticket_id      TEXT,
  conversation_id TEXT,
  question       TEXT NOT NULL,
  answer         TEXT NOT NULL,
  answer_source  TEXT NOT NULL CHECK (answer_source IN ('faq','ai','degrade','unconfigured','refusal','out_of_scope')),
  needs_human    INTEGER NOT NULL DEFAULT 0 CHECK (needs_human IN (0,1)),
  ticket_created INTEGER NOT NULL DEFAULT 0 CHECK (ticket_created IN (0,1)),
  ai_failure     INTEGER NOT NULL DEFAULT 0 CHECK (ai_failure IN (0,1)),
  human_escalated INTEGER NOT NULL DEFAULT 0 CHECK (human_escalated IN (0,1)),
  tokens_in      INTEGER NOT NULL DEFAULT 0,
  tokens_out     INTEGER NOT NULL DEFAULT 0,
  cost_micro     INTEGER NOT NULL DEFAULT 0,
  locale         TEXT NOT NULL DEFAULT 'zh',
  latency_ms     INTEGER,
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_chat_logs_user ON chat_logs(user_id, created_at);
CREATE INDEX idx_chat_logs_ticket ON chat_logs(ticket_id, created_at);

CREATE TABLE usage_log (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  feature        TEXT NOT NULL CHECK (feature IN ('moderation_text','moderation_image','chat','chat_faq_hit','copilot')),
  tokens_in      INTEGER NOT NULL DEFAULT 0,
  tokens_out     INTEGER NOT NULL DEFAULT 0,
  tokens_cached  INTEGER NOT NULL DEFAULT 0,
  price_snapshot TEXT NOT NULL,                      -- JSON：调用时刻峰谷单价快照
  cost_micro     INTEGER NOT NULL DEFAULT 0,         -- 整数微元
  batch_id       TEXT,
  latency_ms     INTEGER,
  status         TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','error','unconfigured')),
  provider       TEXT,                               -- deepseek / tencent-ims / （unconfigured 时 NULL）
  created_at     TEXT NOT NULL                       -- 不记录任何用户内容文本
);
CREATE INDEX idx_usage_feature ON usage_log(feature, created_at);

-- ── 种子：9 类知识库目录（§13；kb-seed.js 负责把 v1 faq.json 灌成 kb_articles）──
INSERT OR IGNORE INTO kb_categories (id, slug, name, created_at) VALUES
  ('KBC-000001', 'faq',                    'FAQ 常见问题',   '2026-08-27T00:00:00.000Z'),
  ('KBC-000002', 'platform-rules',         '平台规则',       '2026-08-27T00:00:00.000Z'),
  ('KBC-000003', 'refund-policy',          '退款政策',       '2026-08-27T00:00:00.000Z'),
  ('KBC-000004', 'subscription-policy',    '订阅政策',       '2026-08-27T00:00:00.000Z'),
  ('KBC-000005', 'community-rules',        '社区规则',       '2026-08-27T00:00:00.000Z'),
  ('KBC-000006', 'moderation-guidelines',  '审核指引',       '2026-08-27T00:00:00.000Z'),
  ('KBC-000007', 'support-sop',            '客服 SOP',       '2026-08-27T00:00:00.000Z'),
  ('KBC-000008', 'account-recovery',       '账号找回流程',   '2026-08-27T00:00:00.000Z'),
  ('KBC-000009', 'internal-staff',         '内部员工指引',   '2026-08-27T00:00:00.000Z');
