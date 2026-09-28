'use strict';
// 关注页三新端点（v0.2.58.17 关注页真实数据接入）：
//   GET /api/social/feed（followed users 帖 + followed topics 帖，seq DESC，postRow 随行）
//   GET /api/social/following/detail（三类目标解析成渲染行；已删丢弃；team 忽略）
//   GET /api/public/users（公开发现：PII 禁令只发 id/displayName/avatarUrl/citizenId；
//     followedByMe 仅 viewer 随行；followerCount DESC + seq ASC 平局；限流 pu:ip: 30/min）

const test = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

const iso = () => new Date().toISOString();
const isoAgo = (d) => new Date(Date.now() - d * 86400e3).toISOString();

function follow(t, userId, type, targetId, atIso) {
  t.db.prepare('INSERT INTO following (user_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, type, targetId, atIso || iso());
}
function seedNation(t, id, dataJson, status = 'visible', ownerId = 'u1') {
  t.db.prepare('INSERT INTO nations (id, owner_id, data, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, ownerId, dataJson, status, iso(), iso());
}
function seedTopic(t, id, dataJson, status = 'visible', creatorId = 'u1') {
  t.db.prepare('INSERT INTO topics (id, creator_id, data, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, creatorId, dataJson, status, iso(), iso());
}
function seedPost(t, id, authorId, content, { topicId = null, status = 'visible', atIso = iso() } = {}) {
  t.db.prepare('INSERT INTO posts (id, author_id, topic_id, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, authorId, topicId, content, status, atIso, atIso);
}

test('feed：匿名 → 401', async () => {
  const t = await testApp();
  try {
    const res = await t.request('GET', '/api/social/feed');
    assert.strictEqual(res.status, 401);
  } finally {
    await t.close();
  }
});

test('feed：空关注 → {posts:[]}', async () => {
  const t = await testApp();
  try {
    const u1 = await t.loginAs('u1@test.local');
    const res = await t.request('GET', '/api/social/feed', undefined, { cookie: u1.cookie });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { posts: [] });
  } finally {
    await t.close();
  }
});

test('feed：关注用户的帖进、未关注作者的帖不进、seq DESC', async () => {
  const t = await testApp();
  try {
    const u1 = await t.loginAs('u1@test.local');
    const u2 = t.seedUser({ email: 'u2@test.local', displayName: 'Nova' });
    const u3 = t.seedUser({ email: 'u3@test.local', displayName: 'Kai' });
    follow(t, u1.user.id, 'user', u2.id);
    seedPost(t, 'PST-000001', u2.id, 'p1');
    seedPost(t, 'PST-000002', u3.id, 'p2');
    seedPost(t, 'PST-000003', u2.id, 'p3');
    const b = await (await t.request('GET', '/api/social/feed', undefined, { cookie: u1.cookie })).json();
    assert.deepStrictEqual(b.posts.map((p) => p.id), ['PST-000003', 'PST-000001'], '只含关注作者的帖且新在前');
  } finally {
    await t.close();
  }
});

test('feed：关注话题的帖进（作者未关注）、未关注话题的帖不进、topic NULL 只走作者子句', async () => {
  const t = await testApp();
  try {
    const u1 = await t.loginAs('u1@test.local');
    const u9 = t.seedUser({ email: 'u9@test.local' });
    seedTopic(t, 'TOP-000001', '{"name":"AI Gov","description":"d","memberCount":1}', 'visible', u1.user.id);
    seedTopic(t, 'TOP-000002', '{"name":"Flags","description":"d","memberCount":1}', 'visible', u1.user.id);
    follow(t, u1.user.id, 'topic', 'TOP-000001');
    seedPost(t, 'PST-000004', u9.id, 'p4', { topicId: 'TOP-000001' });
    seedPost(t, 'PST-000005', u9.id, 'p5', { topicId: 'TOP-000002' });
    seedPost(t, 'PST-000006', u9.id, 'p6');
    const b = await (await t.request('GET', '/api/social/feed', undefined, { cookie: u1.cookie })).json();
    assert.deepStrictEqual(b.posts.map((p) => p.id), ['PST-000004'], '只进关注话题的帖');
  } finally {
    await t.close();
  }
});

test('feed：hidden/removed 不进（pending 也不进）', async () => {
  const t = await testApp();
  try {
    const u1 = await t.loginAs('u1@test.local');
    const u2 = t.seedUser({ email: 'u2@test.local' });
    follow(t, u1.user.id, 'user', u2.id);
    seedPost(t, 'PST-000007', u2.id, 'p7');
    seedPost(t, 'PST-000008', u2.id, 'p8', { status: 'removed' });
    seedPost(t, 'PST-000009', u2.id, 'p9', { status: 'hidden' });
    seedPost(t, 'PST-000010', u2.id, 'p10', { status: 'pending' });
    const b = await (await t.request('GET', '/api/social/feed', undefined, { cookie: u1.cookie })).json();
    assert.deepStrictEqual(b.posts.map((p) => p.id), ['PST-000007']);
  } finally {
    await t.close();
  }
});

test('feed：postRow 形状随行 + likedByMe 以 viewer 计', async () => {
  const t = await testApp();
  try {
    const u1 = await t.loginAs('u1@test.local');
    const u2 = t.seedUser({ email: 'u2@test.local', displayName: 'Nova' });
    const u3 = await t.loginAs('u3@test.local');
    follow(t, u1.user.id, 'user', u2.id);
    follow(t, u3.user.id, 'user', u2.id);
    seedPost(t, 'PST-000011', u2.id, 'hello');
    t.db.prepare("INSERT INTO content_likes (user_id, target_type, target_id, created_at) VALUES (?, 'post', ?, ?)")
      .run(u1.user.id, 'PST-000011', iso());
    const KEYS = ['id', 'authorId', 'authorName', 'avatarUrl', 'content', 'media', 'topicId', 'status', 'createdAt', 'likeCount', 'commentCount', 'likedByMe', 'repostOfId', 'repostOf', 'repostCount', 'repostedByMe', 'viewCount', 'favoritedByMe'];
    const b1 = await (await t.request('GET', '/api/social/feed', undefined, { cookie: u1.cookie })).json();
    assert.strictEqual(b1.posts.length, 1);
    const p = b1.posts[0];
    for (const k of KEYS) assert.ok(k in p, '缺字段 ' + k);
    assert.strictEqual(p.authorName, 'Nova');
    assert.strictEqual(p.likeCount, 1);
    assert.strictEqual(p.likedByMe, true, 'viewer=u1 点过赞');
    const b3 = await (await t.request('GET', '/api/social/feed', undefined, { cookie: u3.cookie })).json();
    assert.strictEqual(b3.posts[0].likedByMe, false, 'viewer=u3 没点过');
  } finally {
    await t.close();
  }
});

test('following/detail：匿名 → 401', async () => {
  const t = await testApp();
  try {
    const res = await t.request('GET', '/api/social/following/detail');
    assert.strictEqual(res.status, 401);
  } finally {
    await t.close();
  }
});

test('following/detail：三类解析 + created_at DESC 序 + followerCount 现算', async () => {
  const t = await testApp();
  try {
    const u1 = await t.loginAs('u1@test.local');
    const u2 = t.seedUser({ email: 'u2@test.local', displayName: 'Nova' });
    const u3 = t.seedUser({ email: 'u3@test.local' });
    seedNation(t, 'NAT-000001', '{"name":"Nova Terra","moniker":"NT","classification":"Republic","capital":"Newport"}', 'visible', u1.user.id);
    seedTopic(t, 'TOP-000001', '{"name":"AI Gov","description":"desc1","memberCount":3}', 'visible', u1.user.id);
    follow(t, u1.user.id, 'nation', 'NAT-000001', isoAgo(2));
    follow(t, u1.user.id, 'topic', 'TOP-000001', isoAgo(1));
    follow(t, u1.user.id, 'user', u2.id, iso());
    follow(t, u3.id, 'nation', 'NAT-000001'); // 第二个粉丝 → followerCount 2
    const b = await (await t.request('GET', '/api/social/following/detail', undefined, { cookie: u1.cookie })).json();
    assert.strictEqual(b.users.length, 1);
    assert.strictEqual(b.users[0].id, u2.id);
    assert.strictEqual(b.users[0].displayName, 'Nova');
    assert.strictEqual(b.users[0].citizenId, u2.id);
    assert.strictEqual(b.topics.length, 1);
    assert.strictEqual(b.topics[0].id, 'TOP-000001');
    assert.strictEqual(b.topics[0].memberCount, 3);
    assert.strictEqual(b.nations.length, 1);
    assert.strictEqual(b.nations[0].id, 'NAT-000001');
    assert.strictEqual(b.nations[0].moniker, 'NT');
    assert.strictEqual(b.nations[0].followerCount, 2);
  } finally {
    await t.close();
  }
});

test('following/detail：已删目标静默丢弃（nation removed/user deleted/topic hidden）', async () => {
  const t = await testApp();
  try {
    const u1 = await t.loginAs('u1@test.local');
    const u9 = t.seedUser({ email: 'u9@test.local' });
    seedNation(t, 'NAT-000009', '{"name":"Gone"}', 'removed', u1.user.id);
    seedNation(t, 'NAT-000001', '{"name":"Alive","moniker":"AL"}', 'visible', u1.user.id);
    seedTopic(t, 'TOP-000009', '{"name":"HiddenT"}', 'hidden', u1.user.id);
    t.db.prepare("UPDATE users SET status = 'deleted' WHERE id = ?").run(u9.id);
    follow(t, u1.user.id, 'nation', 'NAT-000009');
    follow(t, u1.user.id, 'nation', 'NAT-000001');
    follow(t, u1.user.id, 'topic', 'TOP-000009');
    follow(t, u1.user.id, 'user', u9.id);
    const b = await (await t.request('GET', '/api/social/following/detail', undefined, { cookie: u1.cookie })).json();
    assert.deepStrictEqual(b.nations.map((n) => n.id), ['NAT-000001']);
    assert.deepStrictEqual(b.topics, []);
    assert.deepStrictEqual(b.users, []);
  } finally {
    await t.close();
  }
});

test('following/detail：空关注 → 三空数组', async () => {
  const t = await testApp();
  try {
    const u1 = await t.loginAs('u1@test.local');
    const b = await (await t.request('GET', '/api/social/following/detail', undefined, { cookie: u1.cookie })).json();
    assert.deepStrictEqual(b, { nations: [], topics: [], users: [] });
  } finally {
    await t.close();
  }
});

test('public users：匿名 200 全形状 + 零 PII + 无 followedByMe 键', async () => {
  const t = await testApp();
  try {
    t.seedUser({ email: 'p1@test.local', displayName: 'Nova' });
    t.seedUser({ email: 'p2@test.local', displayName: 'Kai' });
    t.seedUser({ email: 'p3@test.local', displayName: 'Lena' });
    const res = await t.request('GET', '/api/public/users');
    assert.strictEqual(res.status, 200);
    const txt = await res.text();
    const b = JSON.parse(txt);
    assert.strictEqual(b.users.length, 3);
    for (const u of b.users) {
      assert.ok(u.id.startsWith('USR-'), 'USR id');
      assert.ok(typeof u.displayName === 'string' && u.displayName.length > 0);
      assert.ok('avatarUrl' in u, 'avatarUrl 键在位');
      assert.ok('citizenId' in u, 'citizenId 键在位');
      assert.strictEqual(typeof u.followerCount, 'number');
      assert.ok(!('followedByMe' in u), '匿名不带 followedByMe 键');
    }
    // PII 禁令：body 无 @（零邮箱）无 display_name 无 bio 无 email
    assert.ok(txt.indexOf('@') === -1, '零邮箱');
    assert.ok(txt.indexOf('display_name') === -1);
    assert.ok(txt.indexOf('bio') === -1);
    assert.ok(txt.indexOf('email') === -1);
  } finally {
    await t.close();
  }
});

test('public users：active only + followerCount DESC + seq 平局 ASC + LIMIT 20', async () => {
  const t = await testApp();
  try {
    const ids = [];
    for (let i = 1; i <= 27; i++) {
      const u = t.seedUser({ email: 'w' + i + '@test.local' });
      ids.push(u.id);
    }
    // 最后建的两个（seq 最大）拿粉丝：followerCount DESC 应排最前；其余按 seq ASC
    t.db.prepare("UPDATE users SET status = 'banned' WHERE id = ?").run(ids[18]);
    t.db.prepare("UPDATE users SET status = 'deleted' WHERE id = ?").run(ids[19]);
    follow(t, ids[0], 'user', ids[26]);
    follow(t, ids[1], 'user', ids[26]);
    follow(t, ids[2], 'user', ids[25]);
    const b = await (await t.request('GET', '/api/public/users')).json();
    assert.strictEqual(b.users.length, 20, 'LIMIT 20');
    assert.strictEqual(b.users[0].id, ids[26], '2 粉丝排第一');
    assert.strictEqual(b.users[0].followerCount, 2);
    assert.strictEqual(b.users[1].id, ids[25]);
    assert.strictEqual(b.users[1].followerCount, 1);
    assert.strictEqual(b.users[2].id, ids[0], '零粉按 seq ASC');
    assert.ok(!b.users.some((u) => u.id === ids[18] || u.id === ids[19]), 'banned/deleted 不上榜');
  } finally {
    await t.close();
  }
});

test('public users：viewer 随行 followedByMe', async () => {
  const t = await testApp();
  try {
    const u1 = await t.loginAs('v1@test.local');
    const u2 = t.seedUser({ email: 'v2@test.local', displayName: 'Nova' });
    follow(t, u1.user.id, 'user', u2.id);
    const b = await (await t.request('GET', '/api/public/users', undefined, { cookie: u1.cookie })).json();
    const row = b.users.find((u) => u.id === u2.id);
    assert.ok(row, '目标在榜');
    assert.strictEqual(row.followedByMe, true);
    const self = b.users.find((u) => u.id === u1.user.id);
    assert.strictEqual(self.followedByMe, false, '自关注恒 false');
  } finally {
    await t.close();
  }
});

test('public users：限流（30/min 默认可覆盖）→ 第 3 次 429', async () => {
  const t = await testApp({ config: { rateLimits: { publicUsers: { max: 2, windowMs: 60000 } } } });
  try {
    assert.strictEqual((await t.request('GET', '/api/public/users')).status, 200);
    assert.strictEqual((await t.request('GET', '/api/public/users')).status, 200);
    const r3 = await t.request('GET', '/api/public/users');
    assert.strictEqual(r3.status, 429);
    assert.strictEqual((await r3.json()).error.code, 'RATE_LIMITED');
  } finally {
    await t.close();
  }
});
