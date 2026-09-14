-- 021_student_verify — v0.2.44.0 学生价 RM5.50 学校邮箱认证（用户「订阅添加学生价格…学生电子邮件接受认证码」→「改成RM5.50」；
-- 问询钦定①两价并存②A 邮箱码③edu 白名单④用户 Stripe 后台建价）：
-- users 加学生认证四列（student_email=认证学校邮箱，可与登录邮箱不同；student_source 预留 B 轮人工审核 'staff_review'）
-- email_codes 重建扩 purpose 'student_verify'（012 同款 rename-建新-拷贝-删旧；无外键引用安全）
-- 无新表 → health 58 不变；user_version 20 → 21
ALTER TABLE users ADD COLUMN student_email TEXT;
ALTER TABLE users ADD COLUMN student_verified_at TEXT;
ALTER TABLE users ADD COLUMN student_expires_at TEXT;   -- 认证有效期 365 天（config.student.ttlMs）
ALTER TABLE users ADD COLUMN student_source TEXT;        -- 本期恒 'email_code'
ALTER TABLE email_codes RENAME TO email_codes_old;
CREATE TABLE email_codes (
  code_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login','delete_confirm','staff_login','password_reset','student_verify')),
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user','staff')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT
);
INSERT INTO email_codes SELECT code_hash, email, purpose, actor_type, created_at, expires_at, attempts, consumed_at FROM email_codes_old;
DROP TABLE email_codes_old;
CREATE INDEX idx_email_codes_email ON email_codes(actor_type, email, created_at);
CREATE INDEX idx_users_student ON users(student_email);
