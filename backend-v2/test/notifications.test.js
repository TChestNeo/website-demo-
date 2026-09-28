'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

// 通知聚合（v0.2.52.0 GET /api/notifications 七类事件）：alice = 接收方；bob/carol = 事件发起方
async function setupTrio(t) {
  const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
  const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
  const carol = t.loginAs('carol@x.com', { displayName: 'Carol' });
  return { alice, bob, carol };
}

async function makePost(t, actor, content) {
  const r = await t.request('POST', '/api/social/posts', { content }, { cookie: actor.cookie });
  assert.strictEqual(r.status, 200);
  return (await r.json()).post.id;
}

async function makeArticle(t, actor, title) {
  const r = await t.request('POST', '/api/articles', { title, contentJson: JSON.stringify({ cards: [] }) }, { cookie: actor.cookie });
  assert.strictEqual(r.status, 200);
  return (await r.json()).article.id;
}

async function getNotifs(t, cookie) {
  const r = await t.request('GET', '/api/notifications', undefined, { cookie });
  assert.strictEqual(r.status, 200);
  return (await r.json()).notifications;
}

test('鉴权与空列表：无 cookie 401；登录空列表 200', async () => {
  const t = await testApp();
  try {
    const { alice } = await setupTrio(t);
    const anon = await t.request('GET', '/api/notifications');
    assert.strictEqual(anon.status, 401);
    assert.strictEqual((await anon.json()).error.code, 'UNAUTHORIZED');
    assert.deepStrictEqual(await getNotifs(t, alice.cookie), []);
  } finally { await t.close(); }
});

test('post_like/post_favorite 事件：形状断言 + 排除自己 + 取消消失', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupTrio(t);
    const postId = await makePost(t, alice, 'alice 的帖子');
    await t.request('POST', '/api/social/posts/' + postId + '/like', undefined, { cookie: bob.cookie });
    await t.request('POST', '/api/social/posts/' + postId + '/favorite', undefined, { cookie: bob.cookie });

    const notifs = await getNotifs(t, alice.cookie);
    assert.strictEqual(notifs.length, 2);
    const types = notifs.map((n) => n.type).sort();
    assert.deepStrictEqual(types, ['post_favorite', 'post_like']);

    for (const item of notifs) {
      assert.deepStrictEqual(Object.keys(item).sort(), ['actor', 'createdAt', 'id', 'targetId', 'type']);
      assert.deepStrictEqual(Object.keys(item.actor).sort(), ['avatarUrl', 'citizenId', 'displayName', 'id']);
      assert.strictEqual(item.actor.id, bob.user.id);
      assert.strictEqual(item.actor.displayName, 'Bob');
      assert.strictEqual(item.actor.citizenId, bob.user.id); // 026 迁移后 citizen_id 恒等于 id
      assert.strictEqual(item.targetId, postId);
      assert.strictEqual(item.id, null); // 赞/藏无事件行 id
      assert.ok(item.createdAt);
    }

    // 发起方视角为空（没有作用于他自己的事件）；自赞自帖不浮现
    assert.deepStrictEqual(await getNotifs(t, bob.cookie), []);
    await t.request('POST', '/api/social/posts/' + postId + '/like', undefined, { cookie: alice.cookie });
    const afterSelfLike = await getNotifs(t, alice.cookie);
    assert.strictEqual(afterSelfLike.length, 2, '自赞自己的帖子不产生通知');

    // 取消赞 → 事件消失（聚合=当前状态快照）
    await t.request('DELETE', '/api/social/posts/' + postId + '/like', undefined, { cookie: bob.cookie });
    const afterUnlike = await getNotifs(t, alice.cookie);
    assert.strictEqual(afterUnlike.length, 1);
    assert.strictEqual(afterUnlike[0].type, 'post_favorite');
  } finally { await t.close(); }
});

test('article_like/article_favorite 事件：hidden 文不浮现 + 复用 005 表旁证（028 只加评论表）', async () => {
  const t = await testApp();
  try {
    const { alice, bob, carol } = await setupTrio(t);
    const artId = await makeArticle(t, alice, 'Alice 的文章');
    await t.request('POST', '/api/social/articles/' + artId + '/like', undefined, { cookie: bob.cookie });
    await t.request('POST', '/api/social/articles/' + artId + '/favorite', undefined, { cookie: bob.cookie });

    const notifs = await getNotifs(t, alice.cookie);
    assert.strictEqual(notifs.length, 2);
    assert.deepStrictEqual(notifs.map((n) => n.type).sort(), ['article_favorite', 'article_like']);
    for (const item of notifs) assert.strictEqual(item.targetId, artId);

    // 未公开文章的互动事件不浮现（直插 like 行模拟）
    t.db.prepare("UPDATE articles SET status = 'hidden' WHERE id = ?").run(artId);
    t.db.prepare("INSERT INTO content_likes (user_id, target_type, target_id, created_at) VALUES (?, 'article', ?, ?)")
      .run(carol.user.id, artId, new Date().toISOString());
    const after = await getNotifs(t, alice.cookie);
    assert.strictEqual(after.length, 0, 'hidden 文的互动事件不浮现');

    // 复用旁证：互动仍走 005 的 content_likes/favorites（029 只加 users.banner_url 列）
    assert.strictEqual(t.db.pragma('user_version', { simple: true }), 29);
  } finally { await t.close(); }
});

test('post_comment 事件：形状 + removed 不浮现 + 自评不浮现 + 回复同口径', async () => {
  const t = await testApp();
  try {
    const { alice, bob, carol } = await setupTrio(t);
    const postId = await makePost(t, alice, 'alice 的帖子');
    const c1 = (await (await t.request('POST', '/api/social/posts/' + postId + '/comments', { content: '评论一条' }, { cookie: bob.cookie })).json()).comment;

    let notifs = await getNotifs(t, alice.cookie);
    assert.strictEqual(notifs.length, 1);
    const item = notifs[0];
    assert.strictEqual(item.type, 'post_comment');
    assert.match(item.id, /^CMT-\d{6}$/);
    assert.strictEqual(item.targetId, postId);

    // removed 评论不浮现
    t.db.prepare("UPDATE comments SET status = 'removed' WHERE id = ?").run(c1.id);
    assert.deepStrictEqual(await getNotifs(t, alice.cookie), []);

    // 回复同口径（carol 回复 bob 的可见评论，alice 同样收到）
    const c2 = (await (await t.request('POST', '/api/social/posts/' + postId + '/comments', { content: '另一条可见' }, { cookie: bob.cookie })).json()).comment;
    await t.request('POST', '/api/social/posts/' + postId + '/comments', { content: '回复这条', parentId: c2.id }, { cookie: carol.cookie });
    notifs = await getNotifs(t, alice.cookie);
    assert.deepStrictEqual(notifs.map((n) => n.type).sort(), ['post_comment', 'post_comment']);

    // 自评不浮现
    await t.request('POST', '/api/social/posts/' + postId + '/comments', { content: '自己评论' }, { cookie: alice.cookie });
    assert.strictEqual((await getNotifs(t, alice.cookie)).length, 2);
  } finally { await t.close(); }
});

test('follow 事件：targetId=关注者 id + 取消关注消失', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupTrio(t);
    await t.request('POST', '/api/social/users/' + alice.user.id + '/follow', undefined, { cookie: bob.cookie });

    const notifs = await getNotifs(t, alice.cookie);
    assert.strictEqual(notifs.length, 1);
    assert.strictEqual(notifs[0].type, 'follow');
    assert.strictEqual(notifs[0].targetId, bob.user.id);
    assert.strictEqual(notifs[0].id, null);
    assert.deepStrictEqual(await getNotifs(t, bob.cookie), []);

    await t.request('DELETE', '/api/social/users/' + alice.user.id + '/follow', undefined, { cookie: bob.cookie });
    assert.deepStrictEqual(await getNotifs(t, alice.cookie), []);
  } finally { await t.close(); }
});

test('friend_request 事件：id 形状 + accept 后消失', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupTrio(t);
    await t.request('POST', '/api/friend-requests', { userId: alice.user.id }, { cookie: bob.cookie });

    const notifs = await getNotifs(t, alice.cookie);
    assert.strictEqual(notifs.length, 1);
    assert.strictEqual(notifs[0].type, 'friend_request');
    assert.match(notifs[0].id, /^FR-\d{6}$/);
    assert.strictEqual(notifs[0].targetId, bob.user.id);

    await t.request('POST', '/api/friend-requests/' + notifs[0].id + '/accept', undefined, { cookie: alice.cookie });
    assert.deepStrictEqual(await getNotifs(t, alice.cookie), [], 'accept 后 pending 过滤自然消失');
  } finally { await t.close(); }
});

test('排序 + LIMIT 50 + 同刻稳定：createdAt 降序、两次请求顺序一致', async () => {
  const t = await testApp();
  try {
    const { alice, bob, carol } = await setupTrio(t);
    const postId = await makePost(t, alice, 'alice 的帖子');
    // 三类事件、把 created_at 回写为已知值制造乱序
    await t.request('POST', '/api/social/posts/' + postId + '/like', undefined, { cookie: bob.cookie });
    await t.request('POST', '/api/social/posts/' + postId + '/favorite', undefined, { cookie: carol.cookie });
    await t.request('POST', '/api/social/users/' + alice.user.id + '/follow', undefined, { cookie: bob.cookie });
    t.db.prepare("UPDATE content_likes SET created_at = ? WHERE user_id = ? AND target_type = 'post' AND target_id = ?")
      .run('2026-09-18T10:00:00.000Z', bob.user.id, postId);
    t.db.prepare("UPDATE favorites SET created_at = ? WHERE user_id = ? AND target_type = 'post' AND target_id = ?")
      .run('2026-09-18T11:00:00.000Z', carol.user.id, postId);
    t.db.prepare("UPDATE following SET created_at = ? WHERE user_id = ? AND target_type = 'user' AND target_id = ?")
      .run('2026-09-18T09:00:00.000Z', bob.user.id, alice.user.id);

    const notifs = await getNotifs(t, alice.cookie);
    assert.deepStrictEqual(notifs.map((n) => n.type), ['post_favorite', 'post_like', 'follow'], 'createdAt 降序');

    // 同刻稳定：两条事件改成同一 createdAt → 两次请求顺序一致（__i 追加序次级键）
    t.db.prepare("UPDATE favorites SET created_at = ? WHERE user_id = ? AND target_type = 'post' AND target_id = ?")
      .run('2026-09-18T10:00:00.000Z', carol.user.id, postId);
    const a = await getNotifs(t, alice.cookie);
    const b = await getNotifs(t, alice.cookie);
    assert.deepStrictEqual(a, b, '同毫秒事件两次请求顺序一致');

    // LIMIT 50：直插 60 个用户的 like 行 → 截断 50
    for (let k = 0; k < 60; k++) {
      const u = t.seedUser({ email: 'bulk' + k + '@x.com' });
      t.db.prepare("INSERT INTO content_likes (user_id, target_type, target_id, created_at) VALUES (?, 'post', ?, ?)")
        .run(u.id, postId, new Date(Date.now() - k * 1000).toISOString());
    }
    assert.strictEqual((await getNotifs(t, alice.cookie)).length, 50);
  } finally { await t.close(); }
});

test('隔离 + 读限流豁免：他人列表恒空；8 连读全 200', async () => {
  const t = await testApp();
  try {
    const { alice, bob, carol } = await setupTrio(t);
    const postId = await makePost(t, alice, 'alice 的帖子');
    await t.request('POST', '/api/social/posts/' + postId + '/like', undefined, { cookie: bob.cookie });
    assert.deepStrictEqual(await getNotifs(t, carol.cookie), []);
    for (let k = 0; k < 8; k++) {
      assert.strictEqual((await t.request('GET', '/api/notifications', undefined, { cookie: alice.cookie })).status, 200);
    }
  } finally { await t.close(); }
});
