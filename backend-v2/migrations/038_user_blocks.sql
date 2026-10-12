-- 038_user_blocks — 用户屏蔽（v0.2.59.x 手机「屏蔽账号」；单向屏蔽）
-- 屏蔽即双向解除关注（应用层处理）；feed/帖子过滤后续在查询里排除 blocked_id。
CREATE TABLE user_blocks (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_user_blocks_pair ON user_blocks(blocker_id, blocked_id);
