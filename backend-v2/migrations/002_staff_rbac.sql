-- 002_staff_rbac — 工作人员与 RBAC（§21 Staff / §24 RBAC）
-- staff 独立于 users（D4）；staff_sessions 独立会话 cookie sc_session（D2）
-- 7 内置角色 + 42 权限键 + 角色矩阵基线（§4）；project_director = 全键（代码层判定，不落矩阵行）

CREATE TABLE staff (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  alias TEXT,
  position TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'UTC+8',
  working_hours TEXT NOT NULL DEFAULT '{"start":"09:00","end":"18:00"}',
  nationality TEXT,
  languages TEXT NOT NULL DEFAULT '["zh"]',
  real_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_staff_email ON staff(email);

CREATE TABLE staff_sessions (
  token_hash TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_staff_sessions_staff ON staff_sessions(staff_id);
CREATE INDEX idx_staff_sessions_expires ON staff_sessions(expires_at);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  builtin INTEGER NOT NULL DEFAULT 0 CHECK (builtin IN (0,1))
);

CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE staff_roles (
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, role_id)
);

-- ── 角色种子（7 内置，builtin 不可删）──
INSERT OR IGNORE INTO roles (id, name, description, builtin) VALUES
  ('project_director', '项目总监', '全部权限（§21 Neo），矩阵内置为全键，不可编辑', 1),
  ('customer_support', '客户支持', '§17/§21 Alex：工单/会话/客服分析/AI 日志/Copilot/KB 查阅', 1),
  ('finance',           '财务',     '§21 Daniel 财务侧：账本/工资/捐赠/订阅/退款/定价/平台财务键', 1),
  ('moderation',        '内容审核', '内容/社区管理、徽章、处罚', 1),
  ('security',          '安全',     '安全事件全量 IP、账户处置、审计、AI 配置', 1),
  ('technical',         '技术',     '平台设置、KB 维护、审计、AI 成本', 1),
  ('management',        '管理层',   '只读监督：全模块视图 + 升级审批', 1);

-- ── 权限种子（42 键，点分 module.action）──
INSERT OR IGNORE INTO permissions (id, module, name) VALUES
  ('dashboard.view',      'dashboard',     '查看总览'),
  ('analytics.view',      'analytics',     '查看分析'),
  ('users.view',          'users',         '查看用户'),
  ('users.manage',        'users',         '管理用户（封禁/警告/恢复）'),
  ('security.view_all',   'security',      '查看安全事件与登录历史（含全量 IP）'),
  ('security.manage',     'security',      '标记/处置安全事件'),
  ('content.view',        'content',       '查看内容'),
  ('content.manage',      'content',       '内容处置（隐藏/删除/恢复）'),
  ('community.view',      'community',     '查看社区'),
  ('community.moderate',  'community',     '社区审核处置'),
  ('finance.view',        'finance',       '查看财务'),
  ('finance.ledger',      'finance',       '流水账 CRUD 与月结'),
  ('finance.payroll',     'finance',       '工资单审批与发放'),
  ('finance.donations',   'finance',       '慈善捐赠管理'),
  ('finance.settings',    'finance',       '财务参数（汇率/税率/固定成本）'),
  ('subscriptions.view',  'subscriptions', '查看订阅'),
  ('subscriptions.manage','subscriptions', '订阅发放/取消/恢复'),
  ('pricing.manage',      'pricing',       '套餐与区域定价/促销'),
  ('refunds.view',        'refunds',       '查看退款'),
  ('refunds.approve',     'refunds',       '退款审批（AI 永无此键）'),
  ('cs.tickets.view',     'cs',            '查看工单'),
  ('cs.tickets.reply',    'cs',            '回复工单'),
  ('cs.tickets.assign',   'cs',            '分配工单'),
  ('cs.tickets.close',    'cs',            '关闭/解决工单'),
  ('cs.tickets.escalate', 'cs',            '升级工单'),
  ('cs.tickets.contact_user', 'cs',        '发起人工对话（联系用户）'),
  ('cs.conversations.view',   'cs',        '查看人工对话'),
  ('cs.conversations.reply',  'cs',        '回复人工对话'),
  ('cs.agents.view',      'cs',            '查看客服档案'),
  ('cs.analytics.view',   'cs',            '查看客服分析'),
  ('cs.logs.view',        'cs',            '查看 AI 客服日志（问答内容，敏感）'),
  ('ai.copilot',          'ai',            '使用 Copilot（分析/总结/草稿）'),
  ('ai.settings',         'ai',            'AI 配置'),
  ('kb.view',             'kb',            '查看知识库（含内部文章按权限）'),
  ('kb.manage',           'kb',            '知识库增改'),
  ('staff.view',          'staff',         '查看工作人员'),
  ('staff.manage',        'staff',         '工作人员增改'),
  ('staff.rbac',          'staff',         '角色与权限矩阵编辑'),
  ('staff.performance.view', 'staff',      '查看绩效'),
  ('audit.view',          'audit',         '查看审计日志'),
  ('platform.settings',   'platform',      '平台设置'),
  ('badges.manage',       'badges',        '徽章发放');

-- ── 角色矩阵基线（§4；project_director 无行 = 代码层全键）──
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  -- customer_support（§28 掩码：无 payments/internal/全 IP，登录史 IP 前两段+近 10 条）
  ('customer_support','dashboard.view'),('customer_support','analytics.view'),
  ('customer_support','users.view'),
  ('customer_support','cs.tickets.view'),('customer_support','cs.tickets.reply'),
  ('customer_support','cs.tickets.assign'),('customer_support','cs.tickets.close'),
  ('customer_support','cs.tickets.escalate'),('customer_support','cs.tickets.contact_user'),
  ('customer_support','cs.conversations.view'),('customer_support','cs.conversations.reply'),
  ('customer_support','cs.agents.view'),('customer_support','cs.analytics.view'),
  ('customer_support','cs.logs.view'),
  ('customer_support','ai.copilot'),('customer_support','kb.view'),
  ('customer_support','staff.performance.view'),
  -- finance
  ('finance','dashboard.view'),('finance','analytics.view'),
  ('finance','finance.view'),('finance','finance.ledger'),('finance','finance.payroll'),
  ('finance','finance.donations'),('finance','finance.settings'),
  ('finance','subscriptions.view'),('finance','subscriptions.manage'),
  ('finance','pricing.manage'),('finance','refunds.view'),('finance','refunds.approve'),
  ('finance','staff.view'),('finance','staff.performance.view'),
  ('finance','platform.settings'),
  -- moderation
  ('moderation','dashboard.view'),('moderation','analytics.view'),
  ('moderation','users.view'),('moderation','users.manage'),
  ('moderation','content.view'),('moderation','content.manage'),
  ('moderation','community.view'),('moderation','community.moderate'),
  ('moderation','badges.manage'),('moderation','staff.view'),
  ('moderation','cs.tickets.view'),('moderation','security.view_all'),
  -- security
  ('security','dashboard.view'),('security','analytics.view'),
  ('security','users.view'),('security','users.manage'),
  ('security','security.view_all'),('security','security.manage'),
  ('security','subscriptions.view'),('security','audit.view'),
  ('security','staff.view'),('security','ai.settings'),
  -- technical
  ('technical','dashboard.view'),('technical','analytics.view'),
  ('technical','users.view'),('technical','platform.settings'),
  ('technical','kb.view'),('technical','kb.manage'),
  ('technical','audit.view'),('technical','staff.view'),('technical','finance.view'),
  -- management（只读监督）
  ('management','dashboard.view'),('management','analytics.view'),
  ('management','users.view'),('management','content.view'),('management','community.view'),
  ('management','security.view_all'),('management','subscriptions.view'),
  ('management','refunds.view'),('management','cs.tickets.view'),
  ('management','cs.tickets.escalate'),('management','cs.analytics.view'),
  ('management','staff.performance.view'),('management','audit.view'),('management','kb.view');
