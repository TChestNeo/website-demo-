-- 008_moderation_content — 审核与内容创作（§6 Content / 社区规则 / §28）
-- moderation_items：v1 原样（7 态状态机 + rule_hits/ai_result JSON）
-- moderation_decisions：v2 形状——item_id 可空（管理端直接处罚）+ user_id 时间线 + actor_type system|ai|staff
--   （v1 actor 自由文本 'admin:email' → v2 staff 主体；AI 处罚永无 staff 主体，§29）
-- reports：v1 原样；fluidcanvas_drafts：v1 原样（PK(user_id,doc_id) 乐观锁 409）
-- badge_codes：+ issued_by（§17 徽章归属 staff 行，D4）
-- articles：+ status 'hidden'（人工下架但可恢复）+ 互动计数器（与 content_* 表事务同步）

CREATE TABLE moderation_items (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  id           TEXT UNIQUE,                          -- MOD-xxxxxx
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
  item_id     TEXT REFERENCES moderation_items(id),  -- NULL = 管理端直接处罚
  user_id     TEXT REFERENCES users(id),             -- 被处罚用户（时间线查询）
  action      TEXT NOT NULL CHECK (action IN ('warn','remove_content','rate_limit','mute','ban','restore')),
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('system','ai','staff')),
  actor_id    TEXT,                                  -- staff 主体 = staff.id；system/ai 为 NULL
  reason_code TEXT,
  notes       TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_mod_decisions_item ON moderation_decisions(item_id);
CREATE INDEX idx_mod_decisions_user ON moderation_decisions(user_id, created_at);

CREATE TABLE reports (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  id          TEXT UNIQUE,                           -- RPT-xxxxxx
  reporter_id TEXT REFERENCES users(id),
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  reason      TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_reports_target ON reports(target_type, target_id);

CREATE TABLE fluidcanvas_drafts (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_id     TEXT NOT NULL DEFAULT 'main',
  data       TEXT NOT NULL,                          -- 整体 JSON
  version    INTEGER NOT NULL DEFAULT 1,
  size_bytes INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, doc_id)
);

CREATE TABLE badge_codes (
  code           TEXT PRIMARY KEY,                   -- 10 位码（排除 0O1IL）
  alias          TEXT NOT NULL,                      -- 化名（不出现真实姓名）
  role           TEXT NOT NULL,
  duties         TEXT NOT NULL,
  bound_incident TEXT NOT NULL,                      -- 与当次私信事由绑定；过期不再保留可反查内容
  issued_by      TEXT REFERENCES staff(id),          -- 签发人（§17）
  issued_at      TEXT NOT NULL,
  expires_at     TEXT NOT NULL,                      -- 签发 +12h
  revoked_at     TEXT
);

CREATE TABLE articles (
  seq                INTEGER PRIMARY KEY AUTOINCREMENT,
  id                 TEXT UNIQUE,                    -- ART-xxxxxx
  author_id          TEXT NOT NULL REFERENCES users(id),
  title              TEXT NOT NULL,
  content_json       TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','hidden','removed')),
  moderation_item_id TEXT,
  view_count         INTEGER NOT NULL DEFAULT 0,     -- §6 计数器（content_* 表事务同步）
  like_count         INTEGER NOT NULL DEFAULT 0,
  favorite_count     INTEGER NOT NULL DEFAULT 0,
  share_count        INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX idx_articles_author ON articles(author_id);
