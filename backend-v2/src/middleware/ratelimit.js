'use strict';
// SQLite 持久化滑动窗口限流（D7，修 v1 内存版重启清零）：
//   rate_limits 表 bucket 主键；窗口内第 max 次起拒绝；窗口过期自动重置。
// 防膨胀：每次建新 bucket 顺手清 24h 未更新的过期行（>5000 行才扫）。
// key 由调用方构造（如 'ec:email:x@y.z'）。单进程部署；多实例二期再上共享存储。

function createRateLimiter(db) {
  const nowIso = () => new Date().toISOString();
  return function limit(key, max, windowMs) {
    const now = Date.now();
    const row = db.prepare('SELECT * FROM rate_limits WHERE bucket = ?').get(key);
    if (!row || now - Date.parse(row.window_start) >= windowMs) {
      db.prepare(`
        INSERT INTO rate_limits (bucket, window_start, count, updated_at) VALUES (?, ?, 1, ?)
        ON CONFLICT(bucket) DO UPDATE SET window_start = excluded.window_start, count = 1, updated_at = excluded.updated_at
      `).run(key, new Date(now).toISOString(), nowIso());
      sweep(db);
      return true;
    }
    if (row.count >= max) return false;
    db.prepare('UPDATE rate_limits SET count = count + 1, updated_at = ? WHERE bucket = ?').run(nowIso(), key);
    return true;
  };
}

function sweep(db) {
  const n = db.prepare('SELECT COUNT(*) AS c FROM rate_limits').get().c;
  if (n > 5000) {
    // 所有窗口 ≤1h，24h 未更新必已过期
    db.prepare('DELETE FROM rate_limits WHERE updated_at < ?')
      .run(new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  }
}

// 客户端 IP：反向代理（Caddy）在环回上，取 X-Forwarded-For 第一个值
function ipOf(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

module.exports = { createRateLimiter, ipOf };
