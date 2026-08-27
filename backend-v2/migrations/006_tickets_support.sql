-- 006_tickets_support — 工单与客服（§15 Tickets / §16 人工对话 / §18 升级）
-- tickets：v1 全列 + 扩展（§15）：
--   category 扩 8 类（refund/privacy 对齐 AI 客服转人工话术「支付与订阅 → 退款问题」「账号问题 → 隐私请求」）
--   status 扩 6 态（pending_user=等用户补充、escalated=已升级）
--   priority 扩 4 级；assigned_staff_id 接 staff 表（D4）
--   escalation_level L1-L4（§18 不强制逐级，任何一级可直达 L4）+ department 归属
--   ai_handled/ai_summary（AI 预筛痕迹）；sla_due_at + 五时间戳（§15 SLA 口径）
--   source public_form|ai_chat（AI 客服转人工时的工单来源，§16）
-- ticket_replies：author_type user|staff（v1 的 admin 在 v2 就是 staff，D4）+ 草稿（AI 拟稿人类发送，§29）
-- ticket_escalations：升级历史（§18 完整可追溯）
-- ticket_feedback：用户结单评分 1-5（§15）

CREATE TABLE tickets (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  id           TEXT UNIQUE,                          -- MN-YYYY-######（年 + 6 位 seq，契约形状）
  user_id      TEXT REFERENCES users(id),            -- 未登录可提交 → NULL
  category     TEXT NOT NULL CHECK (category IN ('bug','account','payment','payout','refund','privacy','suggestion','other')),
  type         TEXT NOT NULL,                        -- 自由文本（前端表单分类名）
  contact      TEXT NOT NULL,                        -- 联系方式（邮箱/电话，≤254）
  subject      TEXT NOT NULL,                        -- ≤200
  description  TEXT NOT NULL,                        -- ≤10000
  locale       TEXT NOT NULL DEFAULT 'zh',
  submitted_at TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','in_progress','pending_user','escalated','resolved','closed')),
  priority     TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_staff_id TEXT REFERENCES staff(id),
  escalation_level TEXT NOT NULL DEFAULT 'L1' CHECK (escalation_level IN ('L1','L2','L3','L4')),
  department   TEXT NOT NULL DEFAULT 'general' CHECK (department IN ('general','finance','technical','security','moderation','management','director')),
  ai_handled   INTEGER NOT NULL DEFAULT 0 CHECK (ai_handled IN (0,1)),   -- AI 预筛过
  ai_summary   TEXT,
  sla_due_at   TEXT,
  first_reply_at TEXT,
  last_reply_at  TEXT,
  resolved_at  TEXT,
  closed_at    TEXT,
  contact_requested_at TEXT,                        -- staff 发起人工对话（§16）
  contact_started_at   TEXT,                        -- 用户首次回复人工对话
  source       TEXT NOT NULL DEFAULT 'public_form' CHECK (source IN ('public_form','ai_chat')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_tickets_status ON tickets(status, submitted_at);
CREATE INDEX idx_tickets_assignee ON tickets(assigned_staff_id, status);
CREATE INDEX idx_tickets_sla ON tickets(sla_due_at);

CREATE TABLE ticket_replies (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id    TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_type  TEXT NOT NULL CHECK (author_type IN ('user','staff')),
  author_ref   TEXT NOT NULL,                       -- staff → staff.id；user → users.id
  body         TEXT NOT NULL,
  is_draft     INTEGER NOT NULL DEFAULT 0 CHECK (is_draft IN (0,1)),   -- 草稿（AI 拟稿待人类发送，§29）
  draft_source TEXT CHECK (draft_source IN ('ai','staff')),            -- is_draft=1 时非空
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_ticket_replies ON ticket_replies(ticket_id, seq);

CREATE TABLE ticket_escalations (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  id             TEXT UNIQUE,                       -- ESC-xxxxxx
  ticket_id      TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_level     TEXT NOT NULL CHECK (from_level IN ('L1','L2','L3','L4')),
  to_level       TEXT NOT NULL CHECK (to_level IN ('L1','L2','L3','L4')),
  from_staff_id  TEXT REFERENCES staff(id),         -- 升级发起人
  to_staff_id    TEXT REFERENCES staff(id),         -- 升级接收人（L4 = project_director）
  to_department  TEXT NOT NULL,                     -- 升级目标部门（与 tickets.department 同枚举）
  reason         TEXT NOT NULL,
  requested_by   TEXT NOT NULL,                     -- staff.id
  decided_by     TEXT,                              -- 批准人 staff.id（AI 永无此主体，§29）
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_esc_ticket ON ticket_escalations(ticket_id, seq);

CREATE TABLE ticket_feedback (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  id          TEXT UNIQUE,                          -- FBK-xxxxxx
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_feedback_ticket ON ticket_feedback(ticket_id);
