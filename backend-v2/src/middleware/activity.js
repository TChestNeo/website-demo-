'use strict';
// DAU/留存源（D9）：鉴权中间件每请求 upsert activity_daily（user_id,date 主键，requests 计数）。
// 表在 010_analytics 迁移（W2 起恒存在）。

function recordActivity(db, userId) {
  const iso = new Date().toISOString();
  db.prepare(`
    INSERT INTO activity_daily (user_id, date, requests, last_seen_at) VALUES (?, ?, 1, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET requests = requests + 1, last_seen_at = excluded.last_seen_at
  `).run(userId, iso.slice(0, 10), iso);
}

module.exports = { recordActivity };
