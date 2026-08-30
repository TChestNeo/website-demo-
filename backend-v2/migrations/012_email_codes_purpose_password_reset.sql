-- 012_email_codes_purpose_password_reset — v0.2.5.3 忘记密码发码新目的 password_reset（中性文案，注册与否同款）
-- SQLite 不能改既有 CHECK 约束 → 重建 email_codes 表（无任何外键引用该表，rename-建新-拷贝-删旧安全）
ALTER TABLE email_codes RENAME TO email_codes_old;
CREATE TABLE email_codes (
  code_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login','delete_confirm','staff_login','password_reset')),
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user','staff')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT
);
INSERT INTO email_codes SELECT code_hash, email, purpose, actor_type, created_at, expires_at, attempts, consumed_at FROM email_codes_old;
DROP TABLE email_codes_old;
CREATE INDEX idx_email_codes_email ON email_codes(actor_type, email, created_at);
