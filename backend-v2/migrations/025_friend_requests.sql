-- 025_friend_requests — 好友请求（v0.2.51.0 灵动岛通知 + 真实好友系统；+1 表 health 58→59）
-- 生命周期：pending → accepted（自动建 DM）/ declined；拒绝后可再请求（重复守卫在应用层，
-- 任一方向仅一条 pending——better-sqlite3 同步单进程 check-then-insert 原子，不建唯一对索引）
CREATE TABLE friend_requests (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  id           TEXT UNIQUE,                             -- FR-xxxxxx（insertWithId 回写）
  sender_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at   TEXT NOT NULL,
  responded_at TEXT
);
CREATE INDEX idx_friend_requests_recipient ON friend_requests(recipient_id, status);
CREATE INDEX idx_friend_requests_pair ON friend_requests(sender_id, recipient_id);
