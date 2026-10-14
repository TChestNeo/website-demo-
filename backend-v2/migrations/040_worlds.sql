-- 040_worlds — 非 Nation 世界云端归档。
-- client_key 由客户端在首次本地保存时生成；(owner_id, client_key) 唯一保证断网重试幂等。
CREATE TABLE worlds (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  client_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_id, client_key)
);

CREATE INDEX idx_worlds_owner_created ON worlds(owner_id, created_at DESC);
CREATE INDEX idx_worlds_type_created ON worlds(type_key, created_at DESC);
CREATE INDEX idx_worlds_status_created ON worlds(status, created_at DESC);
