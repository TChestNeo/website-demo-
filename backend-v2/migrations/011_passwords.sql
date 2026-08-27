-- 011_passwords — 密码 + 每次邮箱码双因素（W6 插入波）：
-- users/staff 加 password_hash。NULL = 旧账号（仅码登录 + 首登引导设密）；
-- 值 = 'hexSalt:hexHash'（scrypt，见 src/password.js）。
-- 不加新表：login_history/security_events 既有 CHECK 已覆盖 password_change/account_recovery。
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE staff ADD COLUMN password_hash TEXT;
