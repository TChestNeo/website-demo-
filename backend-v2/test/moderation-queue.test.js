'use strict';
// 批处理集成测试：入队 → processTextBatch → 判定落库 → 下架+通知；
// AI 低置信/escalate → needs_human；重试 3 次耗尽 → needs_human；预算耗尽 → 零调用降级。
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');
const queue = require('../src/moderation/queue');

// 可定制桩：按 items 内容生成逐条判定（id 回显保证匹配）
function stub(cb, calls = { n: 0 }) {
  return async (url, opts) => {
    calls.n++;
    const req = JSON.parse(opts.body);
    const items = JSON.parse(req.messages[1].content).items;
    return {
      ok: true,
      text: async () => JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ results: items.map(cb) }) } }],
        usage: { prompt_tokens: 1000, completion_tokens: 100, prompt_cache_hit_tokens: 500 }
      })
    };
  };
}

const CLEAN = '我国舰队今日出海演习，欢迎围观直播回放';

async function postClean(t, cookie) {
  const r = await t.request('POST', '/api/social/posts', { content: CLEAN }, { cookie });
  return (await r.json()).post;
}

test('批处理：pass → ai_approved + 可见保持 + usage 记账（缓存 token 按 0.30 计）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const post = await postClean(t, alice.cookie);
    t.app.ctx.moderation.fetchImpl = stub(it => ({ id: it.id, verdict: 'pass', severity: 0, reason_code: 'none', labels: [], confidence: 0.95 }));
    const r = await queue.processTextBatch(t.app.ctx);
    assert.strictEqual(r.processed, 1);
    const item = t.db.prepare('SELECT * FROM moderation_items WHERE target_id = ?').get(post.id);
    assert.strictEqual(item.status, 'ai_approved');
    assert.ok(item.resolved_at);
    assert.strictEqual(t.db.prepare('SELECT status FROM posts WHERE id = ?').get(post.id).status, 'visible');
    // 记账：快照含缓存命中价格（batch 走 processTextBatch 当前真实时间）
    const log = t.db.prepare("SELECT * FROM usage_log WHERE feature = 'moderation_text'").get();
    assert.strictEqual(log.tokens_cached, 500);
    assert.ok(log.cost_micro > 0);
    assert.match(log.batch_id, /^TB-/);
  } finally { await t.close(); }
});

test('批处理：reject → ai_rejected + 下架 + 决策 + 通知', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const post = await postClean(t, alice.cookie);
    t.app.ctx.moderation.fetchImpl = stub(it => ({ id: it.id, verdict: 'reject', severity: 1, reason_code: 'abuse', labels: ['abuse'], confidence: 0.9 }));
    await queue.processTextBatch(t.app.ctx);
    const item = t.db.prepare('SELECT * FROM moderation_items WHERE target_id = ?').get(post.id);
    assert.strictEqual(item.status, 'ai_rejected');
    assert.strictEqual(t.db.prepare('SELECT status FROM posts WHERE id = ?').get(post.id).status, 'hidden');
    assert.strictEqual(t.db.prepare('SELECT action FROM moderation_decisions').get().action, 'remove_content');
    assert.ok(t.db.prepare('SELECT count(*) AS n FROM notifications WHERE user_id = ?').get(alice.user.id).n > 0);
  } finally { await t.close(); }
});

test('批处理：escalate / pass 低置信 / severity≥2 → needs_human（AI 只粗筛）', async () => {
  const cases = [
    { verdict: 'escalate', severity: 0, confidence: 0.9 },
    { verdict: 'pass', severity: 0, confidence: 0.5 },
    { verdict: 'pass', severity: 2, confidence: 0.9 }
  ];
  for (const cse of cases) {
    const t = await testApp();
    try {
      const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
      const post = await postClean(t, alice.cookie);
      t.app.ctx.moderation.fetchImpl = stub(it => ({ id: it.id, ...cse, reason_code: 'none', labels: [] }));
      await queue.processTextBatch(t.app.ctx);
      const item = t.db.prepare('SELECT * FROM moderation_items WHERE target_id = ?').get(post.id);
      assert.strictEqual(item.status, 'needs_human');
      assert.strictEqual(t.db.prepare('SELECT status FROM posts WHERE id = ?').get(post.id).status, 'visible'); // 未下架
    } finally { await t.close(); }
  }
});

test('批处理：DeepSeek 故障 → 重试 3 次 → needs_human（不硬下线）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const post = await postClean(t, alice.cookie);
    const calls = { n: 0 };
    t.app.ctx.moderation.fetchImpl = async () => { calls.n++; throw new Error('network down'); };
    await queue.processTextBatch(t.app.ctx);
    assert.strictEqual(calls.n, 3);
    const item = t.db.prepare('SELECT * FROM moderation_items WHERE target_id = ?').get(post.id);
    assert.strictEqual(item.status, 'needs_human');
  } finally { await t.close(); }
});

test('批处理：预算耗尽 → 全部 needs_human + 零 AI 调用（降级不硬下线）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const post = await postClean(t, alice.cookie);
    t.app.ctx.moderation.budget.setLimit('moderation_text', 0);
    const calls = { n: 0 };
    t.app.ctx.moderation.fetchImpl = stub(() => { calls.n++; throw new Error('should not call'); });
    const r = await queue.processTextBatch(t.app.ctx);
    assert.ok(r.degraded);
    assert.strictEqual(calls.n, 0);
    const item = t.db.prepare('SELECT * FROM moderation_items WHERE target_id = ?').get(post.id);
    assert.strictEqual(item.status, 'needs_human');
  } finally { await t.close(); }
});

test('批处理：单班 ≤500 条 + 50 条/请求（桩计数验证分块）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    // 直接造 120 条 queued 项（绕过发帖限流）
    const iso = new Date().toISOString();
    const ins = t.db.prepare('INSERT INTO moderation_items (id, kind, target_type, target_id, content_hash, status, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (let i = 0; i < 120; i++) {
      ins.run(`MOD-${String(i).padStart(6, '0')}`, 'text', 'post', `PST-x${i}`, `h${i}`, 'queued', 'normal', iso);
    }
    const calls = { n: 0 };
    t.app.ctx.moderation.fetchImpl = stub(it => ({ id: it.id, verdict: 'pass', severity: 0, reason_code: 'none', labels: [], confidence: 0.9 }), calls);
    await queue.processTextBatch(t.app.ctx);
    assert.strictEqual(calls.n, 3); // 120 → 50+50+20
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM moderation_items WHERE status = 'ai_approved'").get().n, 120);
  } finally { await t.close(); }
});
