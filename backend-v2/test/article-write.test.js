'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

// 文章更新/删除（v0.2.55.1 用户「点击public只是复制出新的文章而不是发布」+
// 「FC里无法删除我创建的文章没有删除按钮」）：PUT /api/articles/:id 本人更新
// （编辑器再发布 = 更新原文章不重复建文）；DELETE /api/articles/:id 本人删除
// （评论 FK 级联 + 互动行清理；非本人 403；不存在 404）。

async function setupPair(t) {
  const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
  const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
  return { alice, bob };
}

async function makeArticle(t, actor, title) {
  const r = await t.request('POST', '/api/articles', { title, contentJson: JSON.stringify({ cards: [] }) }, { cookie: actor.cookie });
  assert.strictEqual(r.status, 200);
  return (await r.json()).article.id;
}

test('PUT：本人更新 title+contentJson+updatedAt（不新建行）', async () => {
  const t = await testApp();
  try {
    const { alice } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'Original Title');
    const before = t.db.prepare('SELECT count(*) AS n FROM articles').get().n;
    const r = await t.request('PUT', '/api/articles/' + artId,
      { title: 'Updated Title', contentJson: JSON.stringify({ v: 9, cards: [{ id: 'c1', type: 'content' }] }) },
      { cookie: alice.cookie });
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.strictEqual(body.article.id, artId);
    assert.strictEqual(body.article.title, 'Updated Title');
    assert.strictEqual(body.article.status, 'published');
    assert.ok(body.article.updatedAt);
    const row = t.db.prepare('SELECT * FROM articles WHERE id = ?').get(artId);
    assert.strictEqual(row.title, 'Updated Title');
    assert.ok(row.content_json.indexOf('"v":9') !== -1);
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM articles').get().n, before); // 无新行
    // 详情返回新内容
    const detail = (await (await t.request('GET', '/api/articles/' + artId)).json()).article;
    assert.strictEqual(detail.title, 'Updated Title');
    assert.strictEqual(detail.contentJson.cards.length, 1);
  } finally { await t.close(); }
});

test('PUT：非本人 403 / 不存在 404 / 空标题 400', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'Guard Article');
    const r1 = await t.request('PUT', '/api/articles/' + artId, { title: 'Hijack', contentJson: '{}' }, { cookie: bob.cookie });
    assert.strictEqual(r1.status, 403);
    const r2 = await t.request('PUT', '/api/articles/ART-999999', { title: 'Ghost', contentJson: '{}' }, { cookie: alice.cookie });
    assert.strictEqual(r2.status, 404);
    const r3 = await t.request('PUT', '/api/articles/' + artId, { title: '   ', contentJson: '{}' }, { cookie: alice.cookie });
    assert.strictEqual(r3.status, 400);
    const r4 = await t.request('PUT', '/api/articles/' + artId, { title: 'NoAuth', contentJson: '{}' });
    assert.strictEqual(r4.status, 401);
  } finally { await t.close(); }
});

test('DELETE：本人删除 + 评论级联 + 互动行清理 + 详情 404', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'Doomed Article');
    // 造评论 + 点赞 + 收藏
    await t.request('POST', '/api/articles/' + artId + '/comments', { content: '好评' }, { cookie: bob.cookie });
    await t.request('POST', '/api/social/articles/' + artId + '/like', {}, { cookie: bob.cookie });
    await t.request('POST', '/api/social/articles/' + artId + '/favorite', {}, { cookie: bob.cookie });
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM article_comments WHERE article_id = ?').get(artId).n, 1);
    const r = await t.request('DELETE', '/api/articles/' + artId, {}, { cookie: alice.cookie });
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.strictEqual(body.deleted, true);
    assert.strictEqual(body.id, artId);
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM articles WHERE id = ?').get(artId).n, 0);
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM article_comments WHERE article_id = ?').get(artId).n, 0); // FK 级联
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM content_likes WHERE target_type = 'article' AND target_id = ?").get(artId).n, 0);
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM favorites WHERE target_type = 'article' AND target_id = ?").get(artId).n, 0);
    const g = await t.request('GET', '/api/articles/' + artId);
    assert.strictEqual(g.status, 404);
    const c = await t.request('GET', '/api/articles/' + artId + '/comments');
    assert.strictEqual(c.status, 404); // 评论端点同 404
  } finally { await t.close(); }
});

test('DELETE：非本人 403 / 不存在 404 / 未登录 401', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'Keep Article');
    const r1 = await t.request('DELETE', '/api/articles/' + artId, {}, { cookie: bob.cookie });
    assert.strictEqual(r1.status, 403);
    const r2 = await t.request('DELETE', '/api/articles/ART-999999', {}, { cookie: alice.cookie });
    assert.strictEqual(r2.status, 404);
    const r3 = await t.request('DELETE', '/api/articles/' + artId, {});
    assert.strictEqual(r3.status, 401);
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM articles WHERE id = ?').get(artId).n, 1); // 原样
  } finally { await t.close(); }
});
