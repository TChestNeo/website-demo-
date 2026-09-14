'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

const DRAFT = { v: 9, title: 'My Nation', cards: [{ id: 'c1', type: 'flag', label: 'A' }], lastSaved: Date.now() };

test('草稿：PUT 建 → GET 回读 → 版本递增 → 旧 baseVersion 409 → DELETE 后 404', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });

    const p1 = await t.request('PUT', '/api/drafts/fluidcanvas/main', { data: DRAFT }, { cookie: alice.cookie });
    assert.strictEqual(p1.status, 200);
    const d1 = (await p1.json()).draft;
    assert.strictEqual(d1.version, 1);
    assert.deepStrictEqual(d1.data, DRAFT);

    const g = await t.request('GET', '/api/drafts/fluidcanvas/main', undefined, { cookie: alice.cookie });
    const d2 = (await g.json()).draft;
    assert.deepStrictEqual(d2.data, DRAFT);

    const p2 = await t.request('PUT', '/api/drafts/fluidcanvas/main', { data: { ...DRAFT, title: 'V2' }, baseVersion: 1 }, { cookie: alice.cookie });
    assert.strictEqual(p2.status, 200);
    assert.strictEqual((await p2.json()).draft.version, 2);

    const stale = await t.request('PUT', '/api/drafts/fluidcanvas/main', { data: { ...DRAFT, title: 'Stale' }, baseVersion: 1 }, { cookie: alice.cookie });
    assert.strictEqual(stale.status, 409);
    const conflict = await stale.json();
    assert.strictEqual(conflict.error.code, 'CONFLICT');
    assert.strictEqual(conflict.draft.version, 2, '409 附服务端版本');
    assert.strictEqual(conflict.draft.data.title, 'V2');

    assert.strictEqual((await t.request('DELETE', '/api/drafts/fluidcanvas/main', undefined, { cookie: alice.cookie })).status, 200);
    assert.strictEqual((await t.request('GET', '/api/drafts/fluidcanvas/main', undefined, { cookie: alice.cookie })).status, 404);
  } finally { await t.close(); }
});

test('草稿：无 baseVersion 覆盖（upsert 语义）；用户隔离；校验 400；匿名 401', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });

    await t.request('PUT', '/api/drafts/fluidcanvas/main', { data: DRAFT }, { cookie: alice.cookie });
    // 无 baseVersion = 客户端未同步过 → 直接覆盖（离线兜底语义）
    const again = await t.request('PUT', '/api/drafts/fluidcanvas/main', { data: { ...DRAFT, title: 'Offline overwrite' } }, { cookie: alice.cookie });
    assert.strictEqual(again.status, 200);
    assert.strictEqual((await again.json()).draft.version, 2);

    assert.strictEqual((await t.request('GET', '/api/drafts/fluidcanvas/main', undefined, { cookie: bob.cookie })).status, 404, '草稿按用户隔离');
    assert.strictEqual((await t.request('PUT', '/api/drafts/fluidcanvas/bad id!', { data: DRAFT }, { cookie: alice.cookie })).status, 400);
    assert.strictEqual((await t.request('PUT', '/api/drafts/fluidcanvas/main', { data: 'nope' }, { cookie: alice.cookie })).status, 400);
    assert.strictEqual((await t.request('PUT', '/api/drafts/fluidcanvas/main', { data: DRAFT })).status, 401);
  } finally { await t.close(); }
});

test('文章：POST 直接 published（审核段已去除）+ ART- id；匿名立即可见；他人可取全文；遗留 pending 防御口径', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });

    const r = await t.request('POST', '/api/articles', { title: 'My First Article', contentJson: JSON.stringify(DRAFT) }, { cookie: alice.cookie });
    assert.strictEqual(r.status, 200);
    const art = (await r.json()).article;
    assert.match(art.id, /^ART-\d{6}$/);
    assert.strictEqual(art.status, 'published', '发布即公开（v0.2.46.1 去除审核段）');

    // 匿名列表：立即可见
    const anonList = (await (await t.request('GET', '/api/articles')).json()).articles;
    assert.strictEqual(anonList.length, 1);
    assert.strictEqual(anonList[0].id, art.id);
    assert.strictEqual(anonList[0].status, 'published');
    // 本人列表：同样可见
    const ownList = (await (await t.request('GET', '/api/articles', undefined, { cookie: alice.cookie })).json()).articles;
    assert.strictEqual(ownList.length, 1);
    assert.strictEqual(ownList[0].id, art.id);
    // 他人（bob）可直接取完整内容
    const full = (await (await t.request('GET', '/api/articles/' + art.id, undefined, { cookie: bob.cookie })).json()).article;
    assert.deepStrictEqual(full.contentJson, DRAFT);

    // 遗留 pending 防御口径（迁移 022 上线前的存量数据）：对他人 404、匿名列表不可见、本人列表仍可见
    t.db.prepare("UPDATE articles SET status = 'pending' WHERE id = ?").run(art.id);
    const anonList2 = (await (await t.request('GET', '/api/articles')).json()).articles;
    assert.strictEqual(anonList2.length, 0);
    assert.strictEqual((await t.request('GET', '/api/articles/' + art.id, undefined, { cookie: bob.cookie })).status, 404);
    const ownList2 = (await (await t.request('GET', '/api/articles', undefined, { cookie: alice.cookie })).json()).articles;
    assert.strictEqual(ownList2.length, 1);
    assert.strictEqual(ownList2[0].status, 'pending');
  } finally { await t.close(); }
});

test('文章校验：空标题/超长 400；匿名 POST 401', async () => {
  const t = await testApp({ config: { rateLimits: { articleWrite: { max: 10, windowMs: 3600000 } } } });
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    assert.strictEqual((await t.request('POST', '/api/articles', { title: '  ' }, { cookie: alice.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/articles', { title: 'x'.repeat(121) }, { cookie: alice.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/articles', { title: 'Anon' })).status, 401);
  } finally { await t.close(); }
});

test('文章限流：覆盖 2 → 第 3 次 429（限流先于校验，刷无效提交同样耗额度）', async () => {
  const t = await testApp({ config: { rateLimits: { articleWrite: { max: 2, windowMs: 3600000 } } } });
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    assert.strictEqual((await t.request('POST', '/api/articles', { title: 'a' }, { cookie: alice.cookie })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/articles', { title: 'b' }, { cookie: alice.cookie })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/articles', { title: 'c' }, { cookie: alice.cookie })).status, 429);
  } finally { await t.close(); }
});
