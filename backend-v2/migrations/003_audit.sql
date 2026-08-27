-- 003_audit — 审计日志（§25 + D12 哈希链）
-- 每行 hash = sha256(prev_hash ‖ canonical_row_json)，prev_hash 链接上一条 → 整链可验证
-- SQLite 触发器强制 append-only：UPDATE/DELETE 一律 ABORT（防篡改兜底）

CREATE TABLE audit_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('staff','system','stripe','cron')),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  prev_value TEXT,
  new_value TEXT,
  reason TEXT,
  ip TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT 'success' CHECK (result IN ('success','denied','failed')),
  created_at TEXT NOT NULL,
  prev_hash TEXT,
  hash TEXT NOT NULL
);
CREATE INDEX idx_audit_actor ON audit_log(actor_id, created_at);
CREATE INDEX idx_audit_action ON audit_log(action, created_at);
CREATE INDEX idx_audit_target ON audit_log(target_type, target_id);

-- append-only：任何内容 UPDATE 都拒绝（触发器兜底；正常路径根本没有 UPDATE/DELETE 路由）。
-- 唯一例外 = 插入后的 id 回写（OLD.id IS NULL → NEW.id 非空，且其余字段逐一相等）：
-- audit.js 依赖 AUTOINCREMENT seq 生成 'AUD-000123' 回写，此结构性 UPDATE 不破坏不可篡改性。
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON audit_log
WHEN NOT (OLD.id IS NULL AND NEW.id IS NOT NULL
  AND OLD.actor_type = NEW.actor_type AND OLD.actor_id = NEW.actor_id
  AND OLD.action = NEW.action AND OLD.target_type IS NEW.target_type
  AND OLD.target_id IS NEW.target_id AND OLD.prev_value IS NEW.prev_value
  AND OLD.new_value IS NEW.new_value AND OLD.reason IS NEW.reason
  AND OLD.ip = NEW.ip AND OLD.result = NEW.result AND OLD.created_at = NEW.created_at
  AND OLD.prev_hash IS NEW.prev_hash AND OLD.hash = NEW.hash)
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only');
END;

CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only');
END;
