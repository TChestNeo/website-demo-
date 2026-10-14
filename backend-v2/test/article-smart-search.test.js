'use strict';
// AI 智能搜索权益门禁：必须登录且为 Premium/Ultra；已过期会先降级。
// DeepSeek 不可用时仍要保留原有关键词回退，不因加权限而改变功能契约。

const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

test('智能搜索：匿名 401，Free/Basic/过期 Premium 403，Premium/Ultra 可用', async () => {
  const t = await testApp(); // 默认网络桩抛错，后续断言关键词回退
  try {
    const author = t.loginAs('author-smart@example.com');
    const iso = new Date().toISOString();
    t.db.prepare(`INSERT INTO articles
      (id, author_id, title, content_json, summary, search_blob, status, created_at, updated_at)
      VALUES ('ART-SMART-1', ?, 'Lunar Trade Routes', '{}', 'Moon economy', 'moon commerce shipping', 'published', ?, ?)`)
      .run(author.user.id, iso, iso);

    const anonymous = await t.request('POST', '/api/articles/search/smart', { q: 'moon' });
    assert.strictEqual(anonymous.status, 401);

    const free = t.loginAs('free-smart@example.com');
    const basic = t.loginAs('basic-smart@example.com', { tier: 'basic' });
    const expired = t.loginAs('expired-smart@example.com', { tier: 'premium' });
    t.db.prepare('UPDATE users SET tier_expires_at = ? WHERE id = ?')
      .run(new Date(Date.now() - 1000).toISOString(), expired.user.id);
    for (const account of [free, basic, expired]) {
      const r = await t.request('POST', '/api/articles/search/smart', { q: 'moon' }, { cookie: account.cookie });
      assert.strictEqual(r.status, 403);
      assert.strictEqual((await r.json()).error.code, 'FORBIDDEN');
    }
    assert.strictEqual(t.db.prepare('SELECT tier FROM users WHERE id = ?').get(expired.user.id).tier, 'free');

    for (const tier of ['premium', 'ultra']) {
      const account = t.loginAs(tier + '-smart@example.com', { tier });
      const r = await t.request('POST', '/api/articles/search/smart', { q: 'moon' }, { cookie: account.cookie });
      assert.strictEqual(r.status, 200);
      const body = await r.json();
      assert.strictEqual(body.smart, true);
      assert.strictEqual(body.degraded, true, 'AI 不可用时走关键词回退');
      assert.deepStrictEqual(body.articles.map((a) => a.id), ['ART-SMART-1']);
    }
  } finally { await t.close(); }
});
