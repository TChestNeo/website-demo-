'use strict';
// 预算模块测试：峰谷窗口边界、微元计算、状态机（ok/warn/exhausted）、降级预检、kv 覆盖。
const { test } = require('node:test');
const assert = require('node:assert');
const { isOffPeak, priceOf, costMicro } = require('../src/moderation/budget');
const { testApp } = require('./helpers');

// DeepSeek 低谷窗口 16:30–00:30 UTC（跨午夜）
test('峰谷窗口：16:29 峰 / 16:30 谷 / 00:29 谷 / 00:30 峰 / 12:00 峰', () => {
  assert.strictEqual(isOffPeak('2026-08-18T16:29:59Z'), false);
  assert.strictEqual(isOffPeak('2026-08-18T16:30:00Z'), true);
  assert.strictEqual(isOffPeak('2026-08-18T00:29:59Z'), true);
  assert.strictEqual(isOffPeak('2026-08-18T00:30:00Z'), false);
  assert.strictEqual(isOffPeak('2026-08-18T12:00:00Z'), false);
});

test('单价快照：峰谷各半价 + 缓存价', () => {
  assert.deepStrictEqual(priceOf('2026-08-18T12:00:00Z').rates, { in: 9, cached: 0.30, out: 27 });
  assert.deepStrictEqual(priceOf('2026-08-18T20:00:00Z').rates, { in: 4.5, cached: 0.15, out: 13.5 });
});

test('微元计算：costMicro = Σ tokens × 单价（1 token ≈ 1 微元 × 单价）', () => {
  const peak = { in: 9, cached: 0.30, out: 27 };
  assert.strictEqual(costMicro({ in: 1000 }, peak), 9000);            // 1000 × 9
  assert.strictEqual(costMicro({ in: 100, cached: 100, out: 10 }, peak), 100 * 9 + 100 * 0.30 + 10 * 27);
  const offPeak = { in: 4.5, cached: 0.15, out: 13.5 };
  assert.strictEqual(costMicro({ in: 1000 }, offPeak), 4500);
});

test('预算状态机：ok → warn（≥80%）→ exhausted（≥100%）→ canSpend 拒绝', async () => {
  const t = await testApp();
  try {
    const b = t.app.ctx.moderation.budget;
    b.setLimit('moderation_text', 1);  // 1 元 = 1,000,000 微元
    const iso = '2026-08-18T12:00:00Z';
    const ins = t.db.prepare('INSERT INTO usage_log (feature, tokens_in, price_snapshot, cost_micro, created_at) VALUES (?, ?, ?, ?, ?)');

    assert.strictEqual(b.status('moderation_text', iso).state, 'ok');
    ins.run('moderation_text', 0, '{}', 800000, '2026-08-05T00:00:00Z');
    assert.strictEqual(b.status('moderation_text', iso).state, 'warn');
    assert.ok(b.canSpend('moderation_text', iso));
    ins.run('moderation_text', 0, '{}', 400000, '2026-08-06T00:00:00Z');
    assert.strictEqual(b.status('moderation_text', iso).state, 'exhausted');
    assert.ok(!b.canSpend('moderation_text', iso));
    // 分项未耗尽但总额耗尽 → 同样 exhausted
    b.setLimit('chat', 100);
    b.setLimit('total', 1);
    ins.run('moderation_image', 0, '{}', 900000, '2026-08-07T00:00:00Z');
    ins.run('chat', 0, '{}', 200000, '2026-08-08T00:00:00Z');
    assert.strictEqual(b.status('chat', iso).state, 'exhausted');
    assert.ok(!b.canSpend('chat', iso));
  } finally { await t.close(); }
});

test('账期隔离：上月支出不计入本月', async () => {
  const t = await testApp();
  try {
    const b = t.app.ctx.moderation.budget;
    b.setLimit('chat', 1);
    t.db.prepare('INSERT INTO usage_log (feature, price_snapshot, cost_micro, created_at) VALUES (?, ?, ?, ?)')
      .run('chat', '{}', 999999, '2026-07-31T23:59:59Z');
    assert.strictEqual(b.status('chat', '2026-08-01T00:00:00Z').state, 'ok');
  } finally { await t.close(); }
});

test('record：快照 + 微元落库；costMicroOverride（IMS 按张计费）', async () => {
  const t = await testApp();
  try {
    const b = t.app.ctx.moderation.budget;
    b.record('moderation_text', { in: 1000, out: 50 }, { batchId: 'TB-test', latencyMs: 300, nowIso: '2026-08-18T12:00:00Z' });
    const row = t.db.prepare('SELECT * FROM usage_log WHERE batch_id = ?').get('TB-test');
    assert.strictEqual(row.cost_micro, 1000 * 9 + 50 * 27);
    assert.strictEqual(JSON.parse(row.price_snapshot).offPeak, false);

    b.record('moderation_image', {}, { nowIso: '2026-08-18T12:00:00Z', costMicroOverride: 2500 });
    const img = t.db.prepare("SELECT cost_micro FROM usage_log WHERE feature = 'moderation_image'").get();
    assert.strictEqual(img.cost_micro, 2500);
  } finally { await t.close(); }
});

test('kv 覆盖默认额度：setLimit 后 limitOf 读新值', async () => {
  const t = await testApp();
  try {
    const b = t.app.ctx.moderation.budget;
    assert.strictEqual(b.limitOf('chat'), 20); // config 默认
    b.setLimit('chat', 5);
    assert.strictEqual(b.limitOf('chat'), 5);
  } finally { await t.close(); }
});
