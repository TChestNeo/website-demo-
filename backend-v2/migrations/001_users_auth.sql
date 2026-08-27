-- 001_users_auth — 用户认证与账户安全（§3 Users / §5 Security）
-- v1 users 全列保留 + role CHECK('user')（D4：admin 身份只存在于 staff 表）
-- 新增：reg_source / risk_level / risk_reasons / last_login_at / login_count
-- 新增表：login_history（登录历史）、security_events（安全事件）、rate_limits（持久化限流 D7）

CREATE TABLE users (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT,
  citizen_id TEXT UNIQUE,
  avatar_url TEXT,
  language TEXT NOT NULL DEFAULT 'zh',
  country TEXT,
  dob TEXT,
  bio TEXT,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','basic','premium','ultra')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','banned','delete_pending','deleted')),
  warning_count INTEGER NOT NULL DEFAULT 0,
  muted_until TEXT,
  rate_limited_until TEXT,
  preferences TEXT,
  last_active_at TEXT,
  delete_requested_at TEXT,
  data_deleted_at TEXT,
  tier_expires_at TEXT,
  stripe_customer_id TEXT,
  reg_source TEXT NOT NULL DEFAULT 'web',
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  risk_reasons TEXT,
  last_login_at TEXT,
  login_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created ON users(created_at);
CREATE INDEX idx_users_tier ON users(tier);

-- 公网用户会话（v1 sessions 原样；cookie mn_session，D2）
CREATE TABLE user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- 邮箱验证码（公网 login/delete_confirm + staff staff_login 共用；actor_type 区分 D2）
CREATE TABLE email_codes (
  code_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login','delete_confirm','staff_login')),
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user','staff')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT
);
CREATE INDEX idx_email_codes_email ON email_codes(actor_type, email, created_at);

-- 登录历史（§5 Security：IP 只作风险信号，不单独判盗号）
CREATE TABLE login_history (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user','staff')),
  actor_id TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  ip TEXT NOT NULL DEFAULT '',
  country TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  result TEXT NOT NULL CHECK (result IN ('success','failed','banned','deleted','no_user')),
  risk_flags TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_login_history_actor ON login_history(actor_type, actor_id, created_at);
CREATE INDEX idx_login_history_email ON login_history(email, created_at);
CREATE INDEX idx_login_history_ip ON login_history(ip, created_at);

-- 安全事件（§5：Low/Medium/High 标记）
CREATE TABLE security_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user','staff')),
  actor_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'password_change','email_change','2fa_change','new_device','new_session',
    'suspicious_login','account_recovery','security_settings_change'
  )),
  detail TEXT,
  ip TEXT NOT NULL DEFAULT '',
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_security_events_actor ON security_events(actor_type, actor_id, created_at);
CREATE INDEX idx_security_events_type ON security_events(event_type, created_at);

-- 站内通知（v1 原样）
CREATE TABLE notifications (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at);

-- 限流滑动窗口（D7：SQLite 持久化，修 v1 重启清零）
CREATE TABLE rate_limits (
  bucket TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
