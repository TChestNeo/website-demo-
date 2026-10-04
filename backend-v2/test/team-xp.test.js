'use strict';
// 团队 XP 五事件双向对称（FC v10.28.52.0 用户数值表 2026-10-04）：
// 上传作品 +24（发帖/发文章带 teamId；非成员 403）/ 获赞 +16 / 粉丝 +32 / 收藏 +36 / 分享转发 +20；
// 「少一个就收走」=取消赞/取消收藏/取关/撤销转发/删除作品同额扣回，MAX(0) 不穿负；
// 向导搬运不计 XP（搬运≠上传防刷）；个人 XP 只进不出零改动。

const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

const xpOf = (t, teamId) => t.db.prepare('SELECT xp_gained FROM teams WHERE id = ?').get(teamId).xp_gained;

// 团队直插 + 双成员（alice=owner, bob=member）
function seedTeam(t, teamId, aId, bId) {
  const iso = new Date().toISOString();
  t.db.prepare('INSERT INTO teams (id, data, xp_gained, created_at) VALUES (?, ?, 0, ?)')
    .run(teamId, JSON.stringify({ name: 'Team ' + teamId, ownerId: aId }), iso);
  t.db.prepare("INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)").run(teamId, aId, iso);
  t.db.prepare("INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)").run(teamId, bId, iso);
}

test('上传：发帖带 teamId +24；动态文章带 teamId +24；非成员 403；删除文章 -24', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    const stranger = t.loginAs('stranger@x.com');
    seedTeam(t, 'TEAM-X101', alice.user.id, bob.user.id);
    // 非成员发帖 → 403
    const denied = await t.request('POST', '/api/social/posts', { content: 'hi', teamId: 'TEAM-X101' }, { cookie: stranger.cookie });
    assert.strictEqual(denied.status, 403);
    // 成员发帖 → +24
    const p = await t.request('POST', '/api/social/posts', { content: 'first team post', teamId: 'TEAM-X101' }, { cookie: alice.cookie });
    assert.strictEqual(p.status, 200);
    assert.strictEqual(xpOf(t, 'TEAM-X101'), 24);
    // 无 teamId 发帖不计团队 XP
    await t.request('POST', '/api/social/posts', { content: 'personal post' }, { cookie: alice.cookie });
    assert.strictEqual(xpOf(t, 'TEAM-X101'), 24);
    // 动态（FC 作品=articles）带 teamId → +24
    const a = await t.request('POST', '/api/articles', { title: 'Team War', contentJson: {}, teamId: 'TEAM-X101' }, { cookie: alice.cookie });
    assert.strictEqual(a.status, 200);
    assert.strictEqual(xpOf(t, 'TEAM-X101'), 48);
    // 非成员发文章 → 403
    const d2 = await t.request('POST', '/api/articles', { title: 'x', contentJson: {}, teamId: 'TEAM-X101' }, { cookie: stranger.cookie });
    assert.strictEqual(d2.status, 403);
    // 删除团队文章 → -24（少一个就收走）
    const artId = (await a.json()).article.id;
    const del = await t.request('DELETE', '/api/articles/' + artId, undefined, { cookie: alice.cookie });
    assert.strictEqual(del.status, 200);
    assert.strictEqual(xpOf(t, 'TEAM-X101'), 24);
  } finally { await t.close(); }
});

test('赞/收藏：团队帖 +16/+36、取消 -16/-36；团队文章同款', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    seedTeam(t, 'TEAM-X102', alice.user.id, bob.user.id);
    const p = await t.request('POST', '/api/social/posts', { content: 'like me', teamId: 'TEAM-X102' }, { cookie: alice.cookie });
    const postId = (await p.json()).post.id;
    // 获赞 +16
    await t.request('POST', '/api/social/posts/' + postId + '/like', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(t, 'TEAM-X102'), 24 + 16);
    // 重复赞不二次记（幂等开关）
    await t.request('POST', '/api/social/posts/' + postId + '/like', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(t, 'TEAM-X102'), 40);
    // 取消赞 -16
    await t.request('DELETE', '/api/social/posts/' + postId + '/like', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(t, 'TEAM-X102'), 24);
    // 收藏 +36 / 取消 -36
    await t.request('POST', '/api/social/posts/' + postId + '/favorite', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(t, 'TEAM-X102'), 60);
    await t.request('DELETE', '/api/social/posts/' + postId + '/favorite', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(t, 'TEAM-X102'), 24);
    // 团队文章同款
    const a = await t.request('POST', '/api/articles', { title: 'Like This', contentJson: {}, teamId: 'TEAM-X102' }, { cookie: alice.cookie });
    const artId = (await a.json()).article.id;
    await t.request('POST', '/api/social/articles/' + artId + '/like', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(t, 'TEAM-X102'), 24 + 24 + 16);
    await t.request('DELETE', '/api/social/articles/' + artId + '/like', undefined, { cookie: bob.cookie });
    await t.request('POST', '/api/social/articles/' + artId + '/favorite', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(t, 'TEAM-X102'), 48 + 36);
    await t.request('DELETE', '/api/social/articles/' + artId + '/favorite', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(t, 'TEAM-X102'), 48);
    // 非团队帖互动不计团队 XP
    const p2 = await t.request('POST', '/api/social/posts', { content: 'personal' }, { cookie: alice.cookie });
    await t.request('POST', '/api/social/posts/' + (await p2.json()).post.id + '/like', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(t, 'TEAM-X102'), 48);
  } finally { await t.close(); }
});

test('分享/转发：团队帖被转发 +20、撤销 -20（幂等守卫）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    seedTeam(t, 'TEAM-X103', alice.user.id, bob.user.id);
    const p = await t.request('POST', '/api/social/posts', { content: 'repost me', teamId: 'TEAM-X103' }, { cookie: alice.cookie });
    const postId = (await p.json()).post.id;
    // 转发 +20
    const r = await t.request('POST', '/api/social/posts/' + postId + '/repost', { content: '' }, { cookie: bob.cookie });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(xpOf(t, 'TEAM-X103'), 24 + 20);
    // 重复转发 409（同帖一次守卫）不二次记
    const dup = await t.request('POST', '/api/social/posts/' + postId + '/repost', { content: '' }, { cookie: bob.cookie });
    assert.strictEqual(dup.status, 409);
    assert.strictEqual(xpOf(t, 'TEAM-X103'), 44);
    // 撤销转发 -20
    await t.request('DELETE', '/api/social/posts/' + postId + '/repost', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(t, 'TEAM-X103'), 24);
    // 非团队帖转发不计
    const p2 = await t.request('POST', '/api/social/posts', { content: 'personal' }, { cookie: alice.cookie });
    await t.request('POST', '/api/social/posts/' + (await p2.json()).post.id + '/repost', { content: '' }, { cookie: bob.cookie });
    assert.strictEqual(xpOf(t, 'TEAM-X103'), 24);
  } finally { await t.close(); }
});

test('粉丝：关注团队 +32、取关 -32；非成员不可关注；幂等不二次记', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    const stranger = t.loginAs('stranger@x.com');
    seedTeam(t, 'TEAM-X104', alice.user.id, bob.user.id);
    // 非成员关注 → 403
    const denied = await t.request('POST', '/api/teams/TEAM-X104/follow', undefined, { cookie: stranger.cookie });
    assert.strictEqual(denied.status, 403);
    // 成员关注 → +32 + followerCount 1
    const f = await t.request('POST', '/api/teams/TEAM-X104/follow', undefined, { cookie: bob.cookie });
    assert.strictEqual(f.status, 200);
    assert.deepStrictEqual(await f.json(), { following: true, followerCount: 1 });
    assert.strictEqual(xpOf(t, 'TEAM-X104'), 32);
    // 重复关注幂等（INSERT OR IGNORE）不二次记
    const again = await t.request('POST', '/api/teams/TEAM-X104/follow', undefined, { cookie: bob.cookie });
    assert.strictEqual((await again.json()).followerCount, 1);
    assert.strictEqual(xpOf(t, 'TEAM-X104'), 32);
    // 取关 -32
    const u = await t.request('DELETE', '/api/teams/TEAM-X104/follow', undefined, { cookie: bob.cookie });
    assert.deepStrictEqual(await u.json(), { following: false, followerCount: 0 });
    assert.strictEqual(xpOf(t, 'TEAM-X104'), 0);
    // teamShape 粉丝数/关注态/XP 随行
    const g = await t.request('GET', '/api/teams/TEAM-X104', undefined, { cookie: bob.cookie });
    const team = (await g.json()).team;
    assert.strictEqual(team.followers, 0);
    assert.strictEqual(team.followingByMe, false);
    assert.strictEqual(team.xpGained, 0);
  } finally { await t.close(); }
});

test('双向对称 MAX(0)：XP 不足扣回不穿负', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    seedTeam(t, 'TEAM-X105', alice.user.id, bob.user.id);
    // 团队 0 XP：直接塞一条团队帖（绕过 +24 的正向计费）模拟历史数据，取消赞扣回 0-16 → MAX(0)=0
    const iso = new Date().toISOString();
    t.db.prepare("INSERT INTO posts (id, author_id, content, media, status, team_id, created_at, updated_at) VALUES ('PST-000099', ?, 'legacy', '[]', 'visible', 'TEAM-X105', ?, ?)").run(alice.user.id, iso, iso);
    t.db.prepare("INSERT INTO content_likes (user_id, target_type, target_id, created_at) VALUES (?, 'post', 'PST-000099', ?)").run(bob.user.id, iso);
    assert.strictEqual(xpOf(t, 'TEAM-X105'), 0);
    await t.request('DELETE', '/api/social/posts/PST-000099/like', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(t, 'TEAM-X105'), 0, '扣回不穿负');
  } finally { await t.close(); }
});

test('向导搬运不计 XP（搬运≠上传防刷）；团队 XP 五事件不影响个人 xp_gained', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    const iso = new Date().toISOString();
    t.db.prepare("INSERT INTO posts (id, author_id, content, media, status, created_at, updated_at) VALUES ('PST-000101', ?, 'copy me', '[]', 'visible', ?, ?)").run(alice.user.id, iso, iso);
    t.db.prepare("INSERT INTO articles (id, author_id, title, content_json, status, created_at, updated_at) VALUES ('ART-000101', ?, 'Copy Art', '{}', 'published', ?, ?)").run(alice.user.id, iso, iso);
    // 全量搬运建团：搬 1 帖 + 1 动态但团队 XP 恒 0
    const res = await t.request('POST', '/api/teams', { name: 'Copy Team', copyItems: ['all'] }, { cookie: alice.cookie });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body.copied, { posts: 1, media: 0, activity: 1, decorations: true });
    assert.strictEqual(body.team.xpGained, 0, '搬运不计 XP');
    assert.strictEqual(xpOf(t, body.team.id), 0);
    // 被搬运的团队帖获赞 → 照常 +16（真团队内容）
    const copiedPost = t.db.prepare('SELECT id FROM posts WHERE team_id = ?').get(body.team.id);
    await t.request('POST', '/api/social/posts/' + copiedPost.id + '/like', undefined, { cookie: bob.cookie });
    assert.strictEqual(xpOf(t, body.team.id), 16);
    // 个人 XP 不受团队事件影响（alice 作为帖作者获赞 +15 是个人轨，团队轨独立）
    const aliceXp = t.db.prepare('SELECT xp_gained FROM users WHERE id = ?').get(alice.user.id).xp_gained;
    assert.strictEqual(aliceXp, 15, '个人 XP 只走个人轨（被赞 +15），团队 16 不并入');
  } finally { await t.close(); }
});
