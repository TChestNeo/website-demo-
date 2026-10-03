'use strict';
// FC 自定义边缘仓库端点测试：POST/GET/PUT/DELETE /api/fc/edges + GET /api/fc/edges/scopes（FC v10.28.50.0）。
// 覆盖：登录门控、POST 校验（名称/clip 白名单/可见性四值）、匿名只公开可见、四可见性过滤矩阵
// （public 匿名可见/private 只本人/friends 好友集/team 团队成员）、scope=mine|friends|team 过滤、
// scopes 圆球依据（hasFriends/hasTeam）、上限 200、PUT 改可见性（非本人 403/不存在 404）、DELETE、
// 限流 20/min。
// 好友集 = friend_requests status='accepted'；团队集 = team_members 同团成员（Phase B 起有真实数据）。
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

const CLIP = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
const CLIP2 = 'polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 90% 100%, 90% 10%, 10% 10%, 10% 90%, 0% 90%)';

const EDGE_BODY = (extra = {}) => ({ name: '撕边', kind: 'edge', clip: CLIP, visibility: 'private', ...extra });

// 建好友对：A↔B accepted（双向插入两行，模拟真实 accept 流程残留）
function befriend(db, a, b) {
  const iso = new Date().toISOString();
  db.prepare("INSERT INTO friend_requests (id, sender_id, recipient_id, status, created_at, responded_at) VALUES (?, ?, ?, 'accepted', ?, ?)")
    .run('FR-AAA-' + a + '-' + b, a, b, iso, iso);
  db.prepare("INSERT INTO friend_requests (id, sender_id, recipient_id, status, created_at, responded_at) VALUES (?, ?, ?, 'accepted', ?, ?)")
    .run('FR-BBB-' + a + '-' + b, b, a, iso, iso);
}

// 建同团队：users 插 team_members（teams 表须先有行）
function joinTeam(db, teamId, ...uids) {
  const iso = new Date().toISOString();
  if (!db.prepare('SELECT 1 FROM teams WHERE id = ?').get(teamId)) {
    db.prepare("INSERT INTO teams (id, data, created_at) VALUES (?, '{}', ?)").run(teamId, iso);
  }
  const ins = db.prepare('INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)');
  for (const u of uids) ins.run(teamId, u, 'member', iso);
}

test('fc/edges：POST 未登录 401', async () => {
  const t = await testApp();
  try {
    assert.strictEqual((await t.request('POST', '/api/fc/edges', EDGE_BODY())).status, 401);
  } finally { await t.close(); }
});

test('fc/edges：POST 校验 400（名称空/clip 拒/可见性非法）', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('edge@example.com');
    assert.strictEqual((await t.request('POST', '/api/fc/edges', EDGE_BODY({ name: '  ' }), { cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/fc/edges', EDGE_BODY({ clip: 'polygon(0 0, 50px 0, 0 50)' }), { cookie })).status, 400); // 51.1: 裸值 50 已合法，px 单位仍拒
    assert.strictEqual((await t.request('POST', '/api/fc/edges', EDGE_BODY({ visibility: 'nope' }), { cookie })).status, 400);
  } finally { await t.close(); }
});

test('fc/edges：POST 成功——EDG- 可读 id + 名称控字符剥除 + kind 归一', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('edge@example.com', { displayName: 'EdgeMaker' });
    const r = await t.request('POST', '/api/fc/edges', EDGE_BODY({ name: '撕\u0000边\u0007', kind: 'nope' }), { cookie });
    assert.strictEqual(r.status, 200);
    const b = await r.json();
    assert.match(b.edge.id, /^EDG-\d{6}$/);
    assert.strictEqual(b.edge.name, '撕边');
    assert.strictEqual(b.edge.kind, 'edge'); // 非法 kind 归一边缘
    assert.strictEqual(b.edge.clip, CLIP);
    assert.strictEqual(b.edge.visibility, 'private');
    assert.strictEqual(b.edge.authorName, 'EdgeMaker');
    assert.ok(b.edge.createdAt);
    // 服务端行落地（clip 规范化入库）
    const row = t.db.prepare('SELECT * FROM fc_edges WHERE id = ?').get(b.edge.id);
    assert.ok(row);
    assert.strictEqual(row.owner_id, t.db.prepare("SELECT id FROM users WHERE email = 'edge@example.com'").get().id);
  } finally { await t.close(); }
});

test('fc/edges：匿名只公开可见（private/friends/team 全隐）', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('edge@example.com');
    for (const v of ['public', 'private', 'friends', 'team']) {
      await t.request('POST', '/api/fc/edges', EDGE_BODY({ name: v, visibility: v }), { cookie });
    }
    const r = await t.request('GET', '/api/fc/edges?scope=all');
    assert.strictEqual(r.status, 200);
    const b = await r.json();
    assert.strictEqual(b.edges.length, 1);
    assert.strictEqual(b.edges[0].visibility, 'public');
  } finally { await t.close(); }
});

test('fc/edges：可见性矩阵——private 只本人/friends 好友可见/team 同团可见/本人 mine 全收', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@example.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@example.com', { displayName: 'Bob' });
    const carol = t.loginAs('carol@example.com', { displayName: 'Carol' });
    const dave = t.loginAs('dave@example.com', { displayName: 'Dave' });
    // Bob→Alice 好友；Bob+Dave 同团
    befriend(t.db, bob.user.id, alice.user.id);
    joinTeam(t.db, 'team-x', bob.user.id, dave.user.id);

    // Bob 发布四可见性边缘
    for (const v of ['public', 'private', 'friends', 'team']) {
      await t.request('POST', '/api/fc/edges', EDGE_BODY({ name: v, visibility: v }), { cookie: bob.cookie });
    }

    // 匿名：只 public
    const anon = await (await t.request('GET', '/api/fc/edges?scope=all')).json();
    assert.deepStrictEqual(anon.edges.map((e) => e.visibility), ['public']);

    // Alice（好友）：public+friends；scope=friends 只好友发布的（含其公开款）
    const al = await (await t.request('GET', '/api/fc/edges?scope=all', undefined, { cookie: alice.cookie })).json();
    assert.deepStrictEqual(al.edges.map((e) => e.visibility).sort(), ['friends', 'public']);
    const alF = await (await t.request('GET', '/api/fc/edges?scope=friends', undefined, { cookie: alice.cookie })).json();
    assert.deepStrictEqual(alF.edges.map((e) => e.visibility).sort(), ['friends', 'public']);

    // Carol（陌生人）：只 public；friends/team 空
    const ca = await (await t.request('GET', '/api/fc/edges?scope=all', undefined, { cookie: carol.cookie })).json();
    assert.deepStrictEqual(ca.edges.map((e) => e.visibility), ['public']);
    const caF = await (await t.request('GET', '/api/fc/edges?scope=friends', undefined, { cookie: carol.cookie })).json();
    assert.strictEqual(caF.edges.length, 0);

    // Dave（同团）：public+team；scope=team 只同团成员发布的（含其公开款）
    const da = await (await t.request('GET', '/api/fc/edges?scope=all', undefined, { cookie: dave.cookie })).json();
    assert.deepStrictEqual(da.edges.map((e) => e.visibility).sort(), ['public', 'team']);
    const daT = await (await t.request('GET', '/api/fc/edges?scope=team', undefined, { cookie: dave.cookie })).json();
    assert.deepStrictEqual(daT.edges.map((e) => e.visibility).sort(), ['public', 'team']);

    // Bob 本人：mine 全收（4 条）
    const mine = await (await t.request('GET', '/api/fc/edges?scope=mine', undefined, { cookie: bob.cookie })).json();
    assert.strictEqual(mine.edges.length, 4);
  } finally { await t.close(); }
});

test('fc/edges/scopes：圆球依据——hasFriends/hasTeam；匿名全 false', async () => {
  const t = await testApp();
  try {
    assert.deepStrictEqual(await (await t.request('GET', '/api/fc/edges/scopes')).json(), { hasFriends: false, hasTeam: false });
    const alice = t.loginAs('alice@example.com');
    const bob = t.loginAs('bob@example.com');
    assert.deepStrictEqual(await (await t.request('GET', '/api/fc/edges/scopes', undefined, { cookie: alice.cookie })).json(), { hasFriends: false, hasTeam: false });
    befriend(t.db, bob.user.id, alice.user.id);
    assert.deepStrictEqual(await (await t.request('GET', '/api/fc/edges/scopes', undefined, { cookie: alice.cookie })).json(), { hasFriends: true, hasTeam: false });
    joinTeam(t.db, 'team-x', alice.user.id, bob.user.id);
    assert.deepStrictEqual(await (await t.request('GET', '/api/fc/edges/scopes', undefined, { cookie: alice.cookie })).json(), { hasFriends: true, hasTeam: true });
  } finally { await t.close(); }
});

test('fc/edges：每用户上限 200', async () => {
  const t = await testApp();
  try {
    const { cookie, user } = t.loginAs('edge@example.com');
    const iso = new Date().toISOString();
    const ins = t.db.prepare("INSERT INTO fc_edges (id, owner_id, name, kind, clip, visibility, created_at) VALUES (?, ?, ?, 'edge', ?, 'private', ?)");
    for (let i = 0; i < 200; i++) ins.run('EDG-X' + String(i).padStart(4, '0'), user.id, 'e' + i, CLIP, iso);
    const r = await t.request('POST', '/api/fc/edges', EDGE_BODY(), { cookie });
    assert.strictEqual(r.status, 409);
  } finally { await t.close(); }
});

test('fc/edges：PUT 本人改可见性/名称——非本人 403、不存在 404、clip 改也过白名单', async () => {
  const t = await testApp();
  try {
    const owner = t.loginAs('owner@example.com');
    const other = t.loginAs('other@example.com');
    const created = await (await t.request('POST', '/api/fc/edges', EDGE_BODY(), { cookie: owner.cookie })).json();

    assert.strictEqual((await t.request('PUT', '/api/fc/edges/nope', { visibility: 'public' }, { cookie: owner.cookie })).status, 404);
    assert.strictEqual((await t.request('PUT', `/api/fc/edges/${created.edge.id}`, { visibility: 'public' }, { cookie: other.cookie })).status, 403);

    const r = await t.request('PUT', `/api/fc/edges/${created.edge.id}`, { visibility: 'friends', name: '撕边V2', clip: CLIP2 }, { cookie: owner.cookie });
    assert.strictEqual(r.status, 200);
    const b = await r.json();
    assert.strictEqual(b.edge.visibility, 'friends');
    assert.strictEqual(b.edge.name, '撕边V2');
    assert.strictEqual(b.edge.clip, CLIP2);
    // 不带字段不动原值
    const r2 = await t.request('PUT', `/api/fc/edges/${created.edge.id}`, { visibility: 'public' }, { cookie: owner.cookie });
    assert.strictEqual((await r2.json()).edge.name, '撕边V2');
    // 坏 clip 400
    assert.strictEqual((await t.request('PUT', `/api/fc/edges/${created.edge.id}`, { clip: 'url(x)' }, { cookie: owner.cookie })).status, 400);
  } finally { await t.close(); }
});

test('fc/edges：DELETE 本人可删——非本人 403、不存在 404、删后 GET 消失', async () => {
  const t = await testApp();
  try {
    const owner = t.loginAs('owner@example.com');
    const other = t.loginAs('other@example.com');
    const created = await (await t.request('POST', '/api/fc/edges', EDGE_BODY({ visibility: 'public' }), { cookie: owner.cookie })).json();

    assert.strictEqual((await t.request('DELETE', '/api/fc/edges/nope', undefined, { cookie: owner.cookie })).status, 404);
    assert.strictEqual((await t.request('DELETE', `/api/fc/edges/${created.edge.id}`, undefined, { cookie: other.cookie })).status, 403);

    const r = await t.request('DELETE', `/api/fc/edges/${created.edge.id}`, undefined, { cookie: owner.cookie });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(await r.json(), { ok: true });
    const list = await (await t.request('GET', '/api/fc/edges?scope=all')).json();
    assert.strictEqual(list.edges.length, 0);
  } finally { await t.close(); }
});

test('fc/edges：限流——config.rateLimits.fcEdgesWrite 2/min 后 429', async () => {
  const t = await testApp({
    config: { rateLimits: { fcEdgesWrite: { max: 2, windowMs: 60000 } } }
  });
  try {
    const { cookie } = t.loginAs('edge@example.com');
    assert.strictEqual((await t.request('POST', '/api/fc/edges', EDGE_BODY(), { cookie })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/fc/edges', EDGE_BODY(), { cookie })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/fc/edges', EDGE_BODY(), { cookie })).status, 429);
  } finally { await t.close(); }
});
