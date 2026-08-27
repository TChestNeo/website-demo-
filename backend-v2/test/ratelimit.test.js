'use strict';
// D7 限流：SQLite 持久化滑动窗口——重启不清零（修 v1 内存版技术债）。

const test = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');
const { createRateLimiter } = require('../src/middleware/ratelimit');

test('限流：窗口内 max 次放行后拒绝；窗口过期自动重置', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const limit = createRateLimiter(a.db);
  assert.strictEqual(limit('k1', 2, 1000), true);
  assert.strictEqual(limit('k1', 2, 1000), true);
  assert.strictEqual(limit('k1', 2, 1000), false);
  // 把窗口戳回过去 → 过期重置
  a.db.prepare('UPDATE rate_limits SET window_start = ? WHERE bucket = ?')
    .run(new Date(Date.now() - 5000).toISOString(), 'k1');
  assert.strictEqual(limit('k1', 2, 1000), true);
});

test('限流：同一 db 新 limiter 实例共享计数（模拟重启，持久化生效）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  createRateLimiter(a.db)('k2', 1, 60_000);
  const again = createRateLimiter(a.db); // 重启后新建的 limiter
  assert.strictEqual(again('k2', 1, 60_000), false);
});
