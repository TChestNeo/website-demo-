'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

// 文章点赞/收藏（v0.2.52.0）：social.js 四端点 + articles.js GET /:id 互动字段扩展。
// content_likes/favorites 复用 target_type='article'（005 预留无 CHECK，零迁移）。

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

test('点赞：幂等 + 计数 + GET /:id 互动字段（登录/匿名双视角）', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'My First Article');

    const l1 = await (await t.request('POST', '/api/social/articles/' + artId + '/like', undefined, { cookie: bob.cookie })).json();
    assert.strictEqual(l1.liked, true);
    assert.strictEqual(l1.likeCount, 1);
    const l2 = await (await t.request('POST', '/api/social/articles/' + artId + '/like', undefined, { cookie: bob.cookie })).json();
    assert.strictEqual(l2.likeCount, 1, '重复点赞幂等');

    const full = await (await t.request('GET', '/api/articles/' + artId, undefined, { cookie: bob.cookie })).json();
    assert.strictEqual(full.article.likeCount, 1);
    assert.strictEqual(full.article.likedByMe, true);
    assert.strictEqual(full.article.favoriteCount, 0);
    assert.strictEqual(full.article.favoritedByMe, false);
    assert.strictEqual(typeof full.article.viewCount, 'number');

    const anon = await (await t.request('GET', '/api/articles/' + artId)).json();
    assert.strictEqual(anon.article.likeCount, 1, '匿名可见计数');
    assert.strictEqual(anon.article.likedByMe, false, '匿名 likedByMe 恒 false');
  } finally { await t.close(); }
});

test('收藏：幂等 + favoriteCount/favoritedByMe 双字段', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'Fav Article');

    const f1 = await (await t.request('POST', '/api/social/articles/' + artId + '/favorite', undefined, { cookie: bob.cookie })).json();
    assert.strictEqual(f1.favorited, true);
    assert.strictEqual(f1.favoriteCount, 1);
    const f2 = await (await t.request('POST', '/api/social/articles/' + artId + '/favorite', undefined, { cookie: bob.cookie })).json();
    assert.strictEqual(f2.favoriteCount, 1, '重复收藏幂等');

    const full = await (await t.request('GET', '/api/articles/' + artId, undefined, { cookie: bob.cookie })).json();
    assert.strictEqual(full.article.favoriteCount, 1);
    assert.strictEqual(full.article.favoritedByMe, true);
    assert.strictEqual(full.article.likeCount, 0);
    assert.strictEqual(full.article.likedByMe, false);
  } finally { await t.close(); }
});

test('取消赞/藏：幂等 no-op（计数归零、再取消仍 200）', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'Cancel Article');
    await t.request('POST', '/api/social/articles/' + artId + '/like', undefined, { cookie: bob.cookie });
    await t.request('POST', '/api/social/articles/' + artId + '/favorite', undefined, { cookie: bob.cookie });

    const dl = await (await t.request('DELETE', '/api/social/articles/' + artId + '/like', undefined, { cookie: bob.cookie })).json();
    assert.strictEqual(dl.liked, false);
    assert.strictEqual(dl.likeCount, 0);
    assert.strictEqual((await t.request('DELETE', '/api/social/articles/' + artId + '/like', undefined, { cookie: bob.cookie })).status, 200);

    const df = await (await t.request('DELETE', '/api/social/articles/' + artId + '/favorite', undefined, { cookie: bob.cookie })).json();
    assert.strictEqual(df.favorited, false);
    assert.strictEqual(df.favoriteCount, 0);
    assert.strictEqual((await t.request('DELETE', '/api/social/articles/' + artId + '/favorite', undefined, { cookie: bob.cookie })).status, 200);
  } finally { await t.close(); }
});

test('404/401：不存在、未公开文章、匿名操作', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'Guard Article');

    assert.strictEqual((await t.request('POST', '/api/social/articles/ART-999999/like', undefined, { cookie: bob.cookie })).status, 404);
    t.db.prepare("UPDATE articles SET status = 'hidden' WHERE id = ?").run(artId);
    const hidden = await t.request('POST', '/api/social/articles/' + artId + '/like', undefined, { cookie: bob.cookie });
    assert.strictEqual(hidden.status, 404);
    assert.strictEqual((await hidden.json()).error.code, 'NOT_FOUND');

    assert.strictEqual((await t.request('POST', '/api/social/articles/' + artId + '/like')).status, 401);
    assert.strictEqual((await t.request('DELETE', '/api/social/articles/' + artId + '/like')).status, 401);
    assert.strictEqual((await t.request('POST', '/api/social/articles/' + artId + '/favorite')).status, 401);
    assert.strictEqual((await t.request('DELETE', '/api/social/articles/' + artId + '/favorite')).status, 401);
  } finally { await t.close(); }
});

test('异人 XP：赞 +15、藏 +12；自操作与重复不记', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'XP Article');
    const xpOf = (id) => t.db.prepare('SELECT xp_gained FROM users WHERE id = ?').get(id).xp_gained;
    const before = xpOf(alice.user.id);

    await t.request('POST', '/api/social/articles/' + artId + '/like', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(alice.user.id), before + 15, '异人点赞 +15');
    await t.request('POST', '/api/social/articles/' + artId + '/like', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(alice.user.id), before + 15, '重复赞不重复记');
    await t.request('POST', '/api/social/articles/' + artId + '/favorite', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(alice.user.id), before + 15 + 12, '异人收藏 +12');

    // 自赞自藏不记
    const bobArt = await makeArticle(t, bob, 'Bob Self Article');
    await t.request('POST', '/api/social/articles/' + bobArt + '/like', undefined, { cookie: bob.cookie });
    await t.request('POST', '/api/social/articles/' + bobArt + '/favorite', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(bob.user.id), 0, '自操作不记 XP');
  } finally { await t.close(); }
});

test('view_count：GET /:id 每次自增（镜像帖子口径）', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'View Article');
    const v0 = t.db.prepare('SELECT view_count FROM articles WHERE id = ?').get(artId).view_count;
    await t.request('GET', '/api/articles/' + artId, undefined, { cookie: bob.cookie });
    await t.request('GET', '/api/articles/' + artId, undefined, { cookie: bob.cookie });
    const v2 = t.db.prepare('SELECT view_count FROM articles WHERE id = ?').get(artId).view_count;
    assert.strictEqual(v2, v0 + 2);
  } finally { await t.close(); }
});
