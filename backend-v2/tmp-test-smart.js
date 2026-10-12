// tmp-test-smart.js — 本地复现智能搜索回退
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./test/helpers');

test('智能搜索：无 key 回退关键词应命中', async () => {
  const t = await testApp({});
  try {
    const alice = t.loginAs('alice@x.com');
    const r1 = await t.request('POST', '/api/articles', { title: '斯拉曼测试文章', contentJson: JSON.stringify({ cards: [] }) }, { cookie: alice.cookie });
    console.log('发布:', r1.status);
    const r2 = await t.request('POST', '/api/articles/search/smart', { q: '斯拉曼' });
    const b = await r2.json();
    console.log('智能搜索:', r2.status, JSON.stringify(b).slice(0, 300));
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(b.articles.length, 1);
    assert.strictEqual(b.articles[0].title, '斯拉曼测试文章');
  } finally { await t.close(); }
});
