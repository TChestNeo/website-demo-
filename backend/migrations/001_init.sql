-- 001_init.sql — M.NationWorld 初始 schema（24 张表）
-- 约定：公开实体 TEXT 主键带前缀 + seq（USR-/NAT-/TOP-/PST-/CONV-/MSG-/MN-/MOD-/RPT-/ART-）；
-- 时间 ISO8601 UTC；金额整数微元（1 元 = 1e6）；WAL/busy_timeout/foreign_keys 由 db.js 设置。
-- nations/topics/teams 存完整 JSON（与 localStorage SlatiDB 元素形状逐字段一致，前端零适配）。

-- ═══ 用户与认证 ═══

CREATE TABLE users (
  seq                 INTEGER PRIMARY KEY AUTOINCREMENT,
  id                  TEXT NOT NULL UNIQUE,          -- USR-xxxxxx
  email               TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name        TEXT NOT NULL DEFAULT '',
  citizen_id          TEXT UNIQUE,                   -- CIT-xxxxxx（complete-profile 生成）
  avatar_url          TEXT,
  language            TEXT NOT NULL DEFAULT 'zh',
  country             TEXT,
  dob                 TEXT,                          -- ISO8601 日期（<13 岁拦截在 P2 校验）
  bio                 TEXT,
  tier                TEXT NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic','premium','ultra')),
  role                TEXT NOT NULL DEFAULT 'user'  CHECK (role IN ('user','admin')),
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','banned','delete_pending','deleted')),
  warning_count       INTEGER NOT NULL DEFAULT 0,
  muted_until         TEXT,                          -- 处罚阶梯：mute（+72h 可配）
  rate_limited_until  TEXT,                          -- 处罚阶梯：rate_limit（+24h）
  preferences         TEXT NOT NULL DEFAULT '{}',    -- JSON：主题/语言等用户偏好
  last_active_at      TEXT,
  delete_requested_at TEXT,                          -- 30 天后悔期起点
  data_deleted_at     TEXT,                          -- 后悔期结束，3 年不活跃清除（FAQ a.3/a.4）
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_citizen ON users(citizen_id);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,                       -- SHA-256(token)；token 只进 cookie mn_session
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE email_codes (
  code_hash  TEXT PRIMARY KEY,                       -- SHA-256(6 位码)
  email      TEXT NOT NULL COLLATE NOCASE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('login','delete_confirm')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,                          -- 10 分钟
  attempts   INTEGER NOT NULL DEFAULT 0,             -- 爆破防护：≥5 作废
  consumed_at TEXT
);
CREATE INDEX idx_email_codes_email ON email_codes(email, created_at);

-- ═══ 社交：国家/话题/团队（verbatim JSON 镜像 SlatiDB）═══

CREATE TABLE nations (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT NOT NULL UNIQUE,                   -- NAT-xxxxxx（服务端生成，覆盖本地 demo id）
  owner_id   TEXT REFERENCES users(id),
  data       TEXT NOT NULL,                          -- JSON：与 slati_nations 元素同形状（name/moniker/capital/lore/sectors/demographics…）
  status     TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_nations_owner ON nations(owner_id);

CREATE TABLE topics (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT NOT NULL UNIQUE,                   -- TOP-xxxxxx
  creator_id TEXT REFERENCES users(id),
  data       TEXT NOT NULL,                          -- JSON：与 slati_topics 元素同形状（name/description/category/memberCount…）
  status     TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','removed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE teams (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT NOT NULL UNIQUE,                   -- 一期只读 + 种子（与 slati_teams 元素同形状）
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE following (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('user','nation','topic','team')),
  target_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, target_type, target_id)
);

CREATE TABLE posts (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT NOT NULL UNIQUE,                   -- PST-xxxxxx
  author_id  TEXT NOT NULL REFERENCES users(id),
  topic_id   TEXT REFERENCES topics(id),
  content    TEXT NOT NULL,
  media      TEXT NOT NULL DEFAULT '[]',             -- JSON 数组 ≤3 项
  status     TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('pending','visible','hidden','removed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_posts_status ON posts(status, created_at);
CREATE INDEX idx_posts_author ON posts(author_id);

CREATE TABLE team_members (
  team_id   TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (team_id, user_id)
);

-- ═══ 私讯（明文 + 参与者 ACL；审核管线绝不触碰本区；管理调阅强制审计）═══

CREATE TABLE conversations (
  id         TEXT PRIMARY KEY,                       -- CONV-xxxxxx
  kind       TEXT NOT NULL DEFAULT 'dm' CHECK (kind IN ('dm','group')),
  created_at TEXT NOT NULL
);

CREATE TABLE conversation_members (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at    TEXT,
  joined_at       TEXT NOT NULL,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX idx_conv_members_user ON conversation_members(user_id);

CREATE TABLE messages (
  seq               INTEGER PRIMARY KEY AUTOINCREMENT,
  id                TEXT NOT NULL UNIQUE,            -- MSG-xxxxxx
  conversation_id   TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id         TEXT NOT NULL REFERENCES users(id),
  content           TEXT NOT NULL,                   -- ≤4000 字（写入层校验）
  created_at        TEXT NOT NULL,
  sender_deleted_at TEXT                            -- 发送者删除（仅自己不可见）
);
CREATE INDEX idx_messages_conv ON messages(conversation_id, seq);

-- ═══ 工单 / 徽章 ═══

CREATE TABLE tickets (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  id           TEXT NOT NULL UNIQUE,                 -- MN-2026-000123（年 + 6 位 seq，契约形状）
  user_id      TEXT REFERENCES users(id),            -- 未登录可提交 → NULL
  category     TEXT NOT NULL CHECK (category IN ('bug','account','payment','payout','suggestion')),
  type         TEXT NOT NULL,
  contact      TEXT NOT NULL,
  subject      TEXT NOT NULL,
  description  TEXT NOT NULL,
  locale       TEXT NOT NULL DEFAULT 'zh',
  submitted_at TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','in_progress','resolved','closed')),
  priority     TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgent')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_tickets_status ON tickets(status, submitted_at);

CREATE TABLE ticket_replies (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user','admin')),
  author_ref  TEXT NOT NULL,                         -- admin → 管理员 email；user → 提交者 email
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_ticket_replies ON ticket_replies(ticket_id, seq);

CREATE TABLE badge_codes (
  code           TEXT PRIMARY KEY,                   -- 10 位码（排除 0O1IL）
  alias          TEXT NOT NULL,                      -- 化名（不出现真实姓名）
  role           TEXT NOT NULL,
  duties         TEXT NOT NULL,
  bound_incident TEXT NOT NULL,                      -- 与当次私信事由绑定；过期不再保留可反查内容
  issued_at      TEXT NOT NULL,
  expires_at     TEXT NOT NULL,                      -- 签发 +12h
  revoked_at     TEXT
);

-- ═══ 审核 ═══

CREATE TABLE moderation_items (
  id           TEXT PRIMARY KEY,                     -- MOD-xxxxxx
  kind         TEXT NOT NULL CHECK (kind IN ('text','image')),
  target_type  TEXT NOT NULL,                        -- post/nation/topic/article/…
  target_id    TEXT NOT NULL,
  content_hash TEXT NOT NULL,                        -- sha1（去重用；内容本体不入本表）
  status       TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('l0_hold','queued','ai_approved','ai_rejected','needs_human','human_approved','human_rejected')),
  priority     TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  rule_hits    TEXT,                                 -- JSON：L0 规则命中结果
  ai_result    TEXT,                                 -- JSON：DeepSeek/IMS 原始判定
  batch_id     TEXT,
  created_at   TEXT NOT NULL,
  resolved_at  TEXT
);
CREATE INDEX idx_mod_items_status ON moderation_items(status, priority, created_at);
CREATE INDEX idx_mod_items_batch ON moderation_items(batch_id);

CREATE TABLE moderation_decisions (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     TEXT NOT NULL REFERENCES moderation_items(id),
  action      TEXT NOT NULL CHECK (action IN ('warn','remove_content','rate_limit','mute','ban','restore')),
  actor       TEXT NOT NULL,                         -- system / ai / admin:email
  reason_code TEXT,
  notes       TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_mod_decisions_item ON moderation_decisions(item_id);

CREATE TABLE reports (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  id          TEXT NOT NULL UNIQUE,                  -- RPT-xxxxxx
  reporter_id TEXT REFERENCES users(id),
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  reason      TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at  TEXT NOT NULL
);

-- ═══ 内容创作 ═══

CREATE TABLE fluidcanvas_drafts (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_id     TEXT NOT NULL DEFAULT 'main',
  data       TEXT NOT NULL,                          -- 整体 JSON
  version    INTEGER NOT NULL DEFAULT 1,
  size_bytes INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, doc_id)
);

CREATE TABLE articles (
  seq                INTEGER PRIMARY KEY AUTOINCREMENT,
  id                 TEXT NOT NULL UNIQUE,           -- ART-xxxxxx
  author_id          TEXT NOT NULL REFERENCES users(id),
  title              TEXT NOT NULL,
  content_json       TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','removed')),
  moderation_item_id TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX idx_articles_author ON articles(author_id);

-- ═══ 计费 / 审计 / 通知 / 配置 ═══

CREATE TABLE usage_log (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  feature        TEXT NOT NULL CHECK (feature IN ('moderation_text','moderation_image','chat','chat_faq_hit')),
  tokens_in      INTEGER NOT NULL DEFAULT 0,
  tokens_out     INTEGER NOT NULL DEFAULT 0,
  tokens_cached  INTEGER NOT NULL DEFAULT 0,
  price_snapshot TEXT NOT NULL,                      -- JSON：调用时刻峰谷单价快照
  cost_micro     INTEGER NOT NULL DEFAULT 0,         -- 整数微元
  batch_id       TEXT,
  latency_ms     INTEGER,
  created_at     TEXT NOT NULL                       -- 不记录任何用户内容文本
);
CREATE INDEX idx_usage_feature ON usage_log(feature, created_at);

CREATE TABLE admin_audit_log (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id   TEXT NOT NULL REFERENCES users(id),
  action     TEXT NOT NULL,                          -- view_dm/issue_badge/set_tier/penalty/mod_decide/ticket_reply/budget_set/…
  target     TEXT,
  detail     TEXT,                                   -- JSON
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_admin ON admin_audit_log(admin_id, created_at);

CREATE TABLE notifications (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  read_at    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_notif_user ON notifications(user_id, read_at);

CREATE TABLE kv (
  key        TEXT PRIMARY KEY,                       -- 公告 / L0 阈值 / 审核开关 / 预算额度（budget.*）
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
