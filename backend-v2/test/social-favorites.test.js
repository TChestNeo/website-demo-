'use strict';
// v0.2.20.0 收藏 + 浏览量测试：POST/DELETE /:id/favorite 幂等开关（favorites 表 005 已有）、
// favoritedByMe 随行（feed + 单帖详情可选鉴权）、GET /:id 浏览量 +1（迁移 016 view_count）。
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

const CLEAN = '收藏测试帖：欢迎收藏本贴';

async function makePost(t, who, content = CLEAN) {
  const r = await t.request('POST', '/api/social/posts', { content }, { cookie: who.cookie });
  assert.strictEqual(r.status, 200);
  return (await r.json()).post;
}

test('收藏幂等：POST×2 不重复、多用户、DELETE×2 幂等、favorites 落库', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const post = await makePost(t, alice);
    const f1 = await (await t.request('POST', '/api/social/posts/' + post.id + '/favorite', undefined, { cookie: bob.cookie })).json();
    assert.deepStrictEqual(f1, { favorited: true });
    const f2 = await (await t.request('POST', '/api/social/posts/' + post.id + '/favorite', undefined, { cookie: bob.cookie })).json();
    assert.deepStrictEqual(f2, { favorited: true }); // INSERT OR IGNORE 幂等
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM favorites WHERE target_type = 'post' AND target_id = ?").get(post.id).n, 1);
    // 第二人收藏不冲突（复合主键 user_id+target_type+target_id）
    await t.request('POST', '/api/social/posts/' + post.id + '/favorite', undefined, { cookie: alice.cookie });
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM favorites WHERE target_type = 'post' AND target_id = ?").get(post.id).n, 2);
    // DELETE 幂等（不校验存在 = 无害 no-op，与取消点赞同口径）
    const d1 = await (await t.request('DELETE', '/api/social/posts/' + post.id + '/favorite', undefined, { cookie: bob.cookie })).json();
    assert.deepStrictEqual(d1, { favorited: false });
    const d2 = await (await t.request('DELETE', '/api/social/posts/' + post.id + '/favorite', undefined, { cookie: bob.cookie })).json();
    assert.deepStrictEqual(d2, { favorited: false });
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM favorites WHERE target_type = 'post' AND target_id = ?").get(post.id).n, 1); // 只 alice 留
  } finally { await t.close(); }
});

test('favoritedByMe 随行：匿名 false / 本人 true / 取消后 false（feed + 单帖详情）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const post = await makePost(t, alice);
    await t.request('POST', '/api/social/posts/' + post.id + '/favorite', undefined, { cookie: alice.cookie });
    const detail = (await (await t.request('GET', '/api/social/posts/' + post.id, undefined, { cookie: alice.cookie })).json()).post;
    assert.strictEqual(detail.favoritedByMe, true);
    const anon = (await (await t.request('GET', '/api/social/posts/' + post.id)).json()).post;
    assert.strictEqual(anon.favoritedByMe, false); // 匿名恒 false（无鉴权可查）
    const feed = (await (await t.request('GET', '/api/social/posts', undefined, { cookie: alice.cookie })).json()).posts.find(p => p.id === post.id);
    assert.strictEqual(feed.favoritedByMe, true);
    await t.request('DELETE', '/api/social/posts/' + post.id + '/favorite', undefined, { cookie: alice.cookie });
    const after = (await (await t.request('GET', '/api/social/posts/' + post.id, undefined, { cookie: alice.cookie })).json()).post;
    assert.strictEqual(after.favoritedByMe, false);
  } finally { await t.close(); }
});

test('收藏错误：匿名 401；hidden / removed / 不存在帖 404', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const post = await makePost(t, alice);
    assert.strictEqual((await t.request('POST', '/api/social/posts/' + post.id + '/favorite')).status, 401);
    assert.strictEqual((await t.request('DELETE', '/api/social/posts/' + post.id + '/favorite')).status, 401);
    t.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('hidden', post.id);
    assert.strictEqual((await t.request('POST', '/api/social/posts/' + post.id + '/favorite', undefined, { cookie: alice.cookie })).status, 404);
    t.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('removed', post.id);
    assert.strictEqual((await t.request('POST', '/api/social/posts/' + post.id + '/favorite', undefined, { cookie: alice.cookie })).status, 404);
    assert.strictEqual((await t.request('POST', '/api/social/posts/PST-999999/favorite', undefined, { cookie: alice.cookie })).status, 404);
  } finally { await t.close(); }
});

test('收藏限流：socialWrite 同预算同 key——第 3 次操作 429', async () => {
  const t = await testApp({ config: { rateLimits: { socialWrite: { max: 2, windowMs: 60000 } } } });
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const post = await makePost(t, alice);
    assert.strictEqual((await t.request('POST', '/api/social/posts/' + post.id + '/favorite', undefined, { cookie: alice.cookie })).status, 200);
    assert.strictEqual((await t.request('DELETE', '/api/social/posts/' + post.id + '/favorite', undefined, { cookie: alice.cookie })).status, 200);
    const third = await t.request('POST', '/api/social/posts/' + post.id + '/favorite', undefined, { cookie: alice.cookie });
    assert.strictEqual(third.status, 429);
    assert.strictEqual((await third.json()).error.code, 'RATE_LIMITED');
  } finally { await t.close(); }
});

test('浏览量：GET /:id 每次 +1、feed 只读不增量、新帖默认 0、非 visible 404 不计数', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const post = await makePost(t, alice);
    assert.strictEqual(post.viewCount, 0); // 新建帖默认 0
    const g1 = (await (await t.request('GET', '/api/social/posts/' + post.id)).json()).post;
    assert.strictEqual(g1.viewCount, 1); // 打开一次 +1
    const g2 = (await (await t.request('GET', '/api/social/posts/' + post.id)).json()).post;
    assert.strictEqual(g2.viewCount, 2); // 再开一次再 +1（简单累计口径）
    // feed 只读不增量：多次 feed 后 view_count 不动，但随行 viewCount 可见
    const f1 = (await (await t.request('GET', '/api/social/posts')).json()).posts.find(p => p.id === post.id);
    await t.request('GET', '/api/social/posts');
    const f2 = (await (await t.request('GET', '/api/social/posts')).json()).posts.find(p => p.id === post.id);
    assert.strictEqual(f1.viewCount, 2);
    assert.strictEqual(f2.viewCount, 2);
    assert.strictEqual(t.db.prepare('SELECT view_count FROM posts WHERE id = ?').get(post.id).view_count, 2);
    // 非 visible 404 不计数
    t.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('removed', post.id);
    assert.strictEqual((await t.request('GET', '/api/social/posts/' + post.id)).status, 404);
    assert.strictEqual(t.db.prepare('SELECT view_count FROM posts WHERE id = ?').get(post.id).view_count, 2);
  } finally { await t.close(); }
});
