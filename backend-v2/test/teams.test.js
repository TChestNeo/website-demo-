'use strict';
// 团队频道（FC v10.28.51.0 三步向导）写路径：一键建团（①身份转换 ②内容搬运 ③建群聊）、
// 成员上限（标配 3 / 扩容 8/16/26/∞ / 过期回落）、好友校验、角色门控。
// 搬运=只搬数据不搬频道：贴文/动态/媒体复制为团队行、原件不动；私人点赞收藏恒留个人。

const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

// 好友直插（accepted 口径；方向无关）
function befriend(t, aId, bId) {
  const iso = new Date().toISOString();
  t.db.prepare("INSERT INTO friend_requests (sender_id, recipient_id, status, created_at, responded_at) VALUES (?, ?, 'accepted', ?, ?)")
    .run(aId, bId, iso, iso);
}

test('建团：copyIdentity 身份转换拷入团队 data；个人 users 行零变化', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice Nation' });
    t.db.prepare('UPDATE users SET banner_url = ? WHERE id = ?').run('/uploads/UPL-AAA.jpg', alice.user.id);
    const res = await t.request('POST', '/api/teams', { name: 'fallback', copyIdentity: true, copyItems: [] }, { cookie: alice.cookie });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.team.name, 'Alice Nation', '身份转换：显示名直接成团队名');
    assert.strictEqual(body.team.avatarUrl, alice.user.avatar_url);
    assert.strictEqual(body.team.bannerUrl, '/uploads/UPL-AAA.jpg');
    assert.strictEqual(body.team.role, 'owner');
    assert.strictEqual(body.team.members, 1);
    assert.strictEqual(body.team.cap, 3, '标配上限 3');
    assert.match(body.team.id, /^TEAM-\d{6}$/);
    // 个人行零变化（只搬数据不搬频道）
    const u = t.db.prepare('SELECT * FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(u.display_name, 'Alice Nation');
    assert.strictEqual(u.banner_url, '/uploads/UPL-AAA.jpg');
    // data JSON 完整（ownerId/citizenId 在；decorations 空对象）
    const row = t.db.prepare('SELECT data FROM teams WHERE id = ?').get(body.team.id);
    const d = JSON.parse(row.data);
    assert.strictEqual(d.ownerId, alice.user.id);
    assert.strictEqual(d.citizenId, alice.user.id);
    assert.deepStrictEqual(d.decorations, {});
  } finally { await t.close(); }
});

test('搬运：贴文/动态/视频&贴图复制为团队行；原件与私人点赞收藏零变化', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    const iso = new Date().toISOString();
    // 贴文 2 visible（搬）+ 1 hidden（不搬）
    t.db.prepare("INSERT INTO posts (id, author_id, content, media, status, created_at, updated_at) VALUES ('PST-000001', ?, 'hello', '[]', 'visible', ?, ?)").run(alice.user.id, iso, iso);
    t.db.prepare("INSERT INTO posts (id, author_id, content, media, status, created_at, updated_at) VALUES ('PST-000002', ?, 'world', '[]', 'visible', ?, ?)").run(alice.user.id, iso, iso);
    t.db.prepare("INSERT INTO posts (id, author_id, content, media, status, created_at, updated_at) VALUES ('PST-000003', ?, 'secret', '[]', 'hidden', ?, ?)").run(alice.user.id, iso, iso);
    // 点赞收藏（bob 对 alice 贴文）= 私人数据恒留个人
    t.db.prepare("INSERT INTO content_likes (user_id, target_type, target_id, created_at) VALUES (?, 'post', 'PST-000001', ?)").run(bob.user.id, iso);
    t.db.prepare("INSERT INTO favorites (user_id, target_type, target_id, created_at) VALUES (?, 'post', 'PST-000001', ?)").run(bob.user.id, iso);
    // 动态 = 已发布文章（published 搬 / pending 不搬）
    t.db.prepare("INSERT INTO articles (id, author_id, title, content_json, status, created_at, updated_at) VALUES ('ART-000001', ?, 'War', '{}', 'published', ?, ?)").run(alice.user.id, iso, iso);
    t.db.prepare("INSERT INTO articles (id, author_id, title, content_json, status, created_at, updated_at) VALUES ('ART-000002', ?, 'Draft', '{}', 'pending', ?, ?)").run(alice.user.id, iso, iso);
    // 视频&贴图 1 条
    t.db.prepare("INSERT INTO uploads (id, owner_id, ext, mime, bytes, created_at) VALUES ('UPL-000001', ?, 'png', 'image/png', 10, ?)").run(alice.user.id, iso);
    // 主页装饰
    t.db.prepare('UPDATE users SET card_bg = ?, card_edge = ?, banner_url = ? WHERE id = ?').run('glass-ocean', 'paper', '/uploads/b1.png', alice.user.id);
    const res = await t.request('POST', '/api/teams', { name: 'Copy Team', copyItems: ['all'] }, { cookie: alice.cookie });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body.copied, { posts: 2, media: 1, activity: 1, decorations: true });
    // 原件不动：贴文 3 + 新 2；团队归属只在新行
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM posts').get().n, 5);
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM posts WHERE team_id IS NULL').get().n, 3);
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM posts WHERE team_id = ?').get(body.team.id).n, 2);
    // 私人点赞收藏零变化
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM content_likes').get().n, 1);
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM favorites').get().n, 1);
    // 动态只搬 published
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM articles WHERE team_id = ?').get(body.team.id).n, 1);
    // uploads 复制：copy_of 溯源原件 + 团队归属
    const copy = t.db.prepare('SELECT * FROM uploads WHERE copy_of = ?').get('UPL-000001');
    assert.ok(copy, 'copy_of 溯源在');
    assert.strictEqual(copy.team_id, body.team.id);
    // 装饰拷入 data
    assert.strictEqual(body.team.decorations.cardBg, 'glass-ocean');
    assert.strictEqual(body.team.decorations.cardEdge, 'paper');
  } finally { await t.close(); }
});

test('建群：kind=group+name+成员入队；非好友 400；反向好友也算；去重生效', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    const carol = t.loginAs('carol@x.com');
    const stranger = t.loginAs('stranger@x.com');
    befriend(t, alice.user.id, bob.user.id);
    befriend(t, carol.user.id, alice.user.id); // 反向（recipient=alice）也是好友
    // 非好友 memberIds → 400 点名
    const bad = await t.request('POST', '/api/teams', { name: 'T', chat: { name: 'G', memberIds: [stranger.user.id] } }, { cookie: alice.cookie });
    assert.strictEqual(bad.status, 400);
    assert.strictEqual((await bad.json()).error.code, 'VALIDATION');
    // 正常建群（memberIds 重复 → 去重）
    const res = await t.request('POST', '/api/teams', { name: 'T', chat: { name: 'Chat', memberIds: [bob.user.id, carol.user.id, bob.user.id] } }, { cookie: alice.cookie });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.chat.kind, 'group');
    assert.strictEqual(body.chat.name, 'Chat');
    assert.strictEqual(body.team.members, 3);
    // conversations 行 + 3 成员
    const conv = t.db.prepare("SELECT * FROM conversations WHERE kind = 'group'").get();
    assert.strictEqual(conv.name, 'Chat');
    const members = t.db.prepare('SELECT actor_id FROM conversation_members WHERE conversation_id = ?').all(conv.id).map((r) => r.actor_id).sort();
    assert.deepStrictEqual(members, [alice.user.id, bob.user.id, carol.user.id].sort());
    // team_members：owner + 2 member
    assert.strictEqual(t.db.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?').get(body.team.id, alice.user.id).role, 'owner');
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM team_members WHERE team_id = ? AND role = ?').get(body.team.id, 'member').n, 2);
    // GET /api/teams 列表（种子团队无成员行自动不可见）
    const list = await t.request('GET', '/api/teams', undefined, { cookie: alice.cookie });
    const listBody = await list.json();
    assert.strictEqual(listBody.teams.length, 1);
    assert.strictEqual(listBody.teams[0].id, body.team.id);
    assert.strictEqual(listBody.teams[0].role, 'owner');
    // GET /api/friends（accepted 口径；向导 Step3 用）
    const fr = await t.request('GET', '/api/friends', undefined, { cookie: alice.cookie });
    const frBody = await fr.json();
    assert.deepStrictEqual(frBody.friends.map((f) => f.id).sort(), [bob.user.id, carol.user.id].sort());
  } finally { await t.close(); }
});

test('上限：标配 3 满员 403 TEAM_FULL；扩容 basic 后 8 人可加；过期回落 3', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const friends = [];
    for (let i = 1; i <= 9; i++) {
      const f = t.loginAs('f' + i + '@x.com');
      befriend(t, alice.user.id, f.user.id);
      friends.push(f.user.id);
    }
    // 建团带 2 人 = 3 满员
    const res = await t.request('POST', '/api/teams', { name: 'Cap', chat: { name: 'c', memberIds: [friends[0], friends[1]] } }, { cookie: alice.cookie });
    assert.strictEqual(res.status, 200);
    const { team } = await res.json();
    assert.strictEqual(team.members, 3);
    // 第四人 → 403 TEAM_FULL
    const full = await t.request('POST', '/api/teams/' + team.id + '/members', { userId: friends[2] }, { cookie: alice.cookie });
    assert.strictEqual(full.status, 403);
    assert.strictEqual((await full.json()).error.code, 'TEAM_FULL');
    // 扩容 basic（未来到期）→ cap 8，3→8 加 5 人
    const future = new Date(Date.now() + 86400000).toISOString();
    t.db.prepare('UPDATE users SET team_cap_addon = ?, team_cap_expires_at = ? WHERE id = ?').run('basic', future, alice.user.id);
    for (const uid of friends.slice(2, 7)) {
      const r = await t.request('POST', '/api/teams/' + team.id + '/members', { userId: uid }, { cookie: alice.cookie });
      assert.strictEqual(r.status, 200);
    }
    // 第 9 人 → 403（cap 8）
    const full8 = await t.request('POST', '/api/teams/' + team.id + '/members', { userId: friends[7] }, { cookie: alice.cookie });
    assert.strictEqual(full8.status, 403);
    assert.strictEqual((await full8.json()).error.code, 'TEAM_FULL');
    // 详情 cap 口径=8
    const det = await t.request('GET', '/api/teams/' + team.id, undefined, { cookie: alice.cookie });
    assert.strictEqual((await det.json()).team.cap, 8);
    // 过期 → 回落标配 3
    const past = new Date(Date.now() - 1000).toISOString();
    t.db.prepare('UPDATE users SET team_cap_expires_at = ? WHERE id = ?').run(past, alice.user.id);
    const det2 = await t.request('GET', '/api/teams/' + team.id, undefined, { cookie: alice.cookie });
    assert.strictEqual((await det2.json()).team.cap, 3);
  } finally { await t.close(); }
});

test('成员管理：仅队长可加人/移出；成员可自行退出；队长不可退', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    const carol = t.loginAs('carol@x.com');
    befriend(t, alice.user.id, bob.user.id);
    befriend(t, alice.user.id, carol.user.id);
    const res = await t.request('POST', '/api/teams', { name: 'T', chat: { name: 'c', memberIds: [bob.user.id] } }, { cookie: alice.cookie });
    const { team } = await res.json();
    // bob（成员）加 carol → 403
    const no = await t.request('POST', '/api/teams/' + team.id + '/members', { userId: carol.user.id }, { cookie: bob.cookie });
    await t.assertDenied(no);
    // alice 加 carol；bob 移出 carol → 403
    const add = await t.request('POST', '/api/teams/' + team.id + '/members', { userId: carol.user.id }, { cookie: alice.cookie });
    assert.strictEqual(add.status, 200);
    const tryRemove = await t.request('DELETE', '/api/teams/' + team.id + '/members/' + carol.user.id, undefined, { cookie: bob.cookie });
    await t.assertDenied(tryRemove);
    // bob 自行退出 → 200，队员数 2
    const leave = await t.request('DELETE', '/api/teams/' + team.id + '/members/' + bob.user.id, undefined, { cookie: bob.cookie });
    assert.strictEqual(leave.status, 200);
    assert.strictEqual((await leave.json()).memberCount, 2);
    // 队长退出 → 400
    const ownerLeave = await t.request('DELETE', '/api/teams/' + team.id + '/members/' + alice.user.id, undefined, { cookie: alice.cookie });
    assert.strictEqual(ownerLeave.status, 400);
    // 成员列表形状
    const members = await t.request('GET', '/api/teams/' + team.id + '/members', undefined, { cookie: alice.cookie });
    const m = await members.json();
    assert.strictEqual(m.members.length, 2);
    assert.ok(m.members.every((x) => x.userId && x.displayName && x.role && x.joinedAt));
  } finally { await t.close(); }
});

test('门禁：匿名 401；非成员看详情 403；重复加人 409；移出不存在的成员 404', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    befriend(t, alice.user.id, bob.user.id);
    const anon = await t.request('GET', '/api/teams');
    assert.strictEqual(anon.status, 401);
    const res = await t.request('POST', '/api/teams', { name: 'T' }, { cookie: alice.cookie });
    const { team } = await res.json();
    // 非成员看详情 → 403
    const stranger = t.loginAs('s@x.com');
    const det = await t.request('GET', '/api/teams/' + team.id, undefined, { cookie: stranger.cookie });
    assert.strictEqual(det.status, 403);
    // 重复加 → 409 CONFLICT
    const a1 = await t.request('POST', '/api/teams/' + team.id + '/members', { userId: bob.user.id }, { cookie: alice.cookie });
    assert.strictEqual(a1.status, 200);
    const a2 = await t.request('POST', '/api/teams/' + team.id + '/members', { userId: bob.user.id }, { cookie: alice.cookie });
    assert.strictEqual(a2.status, 409);
    assert.strictEqual((await a2.json()).error.code, 'CONFLICT');
    // 移出不存在的成员 → 404
    const del = await t.request('DELETE', '/api/teams/' + team.id + '/members/USR-999999', undefined, { cookie: alice.cookie });
    assert.strictEqual(del.status, 404);
  } finally { await t.close(); }
});
