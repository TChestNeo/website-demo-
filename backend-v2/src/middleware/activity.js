'use strict';
// DAU/留存源（D9）：鉴权中间件每请求 INSERT OR IGNORE activity_daily。
// 表在 010_analytics 迁移（W1 落表）；W0 提前挂载，表不存在时静默跳过。

function recordActivity(db, userId) {
  try {
    db.prepare('INSERT OR IGNORE INTO activity_daily (user_id, date) VALUES (?, ?)')
      .run(userId, new Date().toISOString().slice(0, 10));
  } catch {
    // 010 迁移未应用时静默（W0 阶段）
  }
}

module.exports = { recordActivity };
