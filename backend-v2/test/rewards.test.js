'use strict';
// 等级奖励（FC v10.28.52.0）：领奖幂等（INSERT OR IGNORE）、等级表门禁、团队阈值+成员门、
// GET 清单形状、Lv.2 免费名片边缘解锁（PATCH card_edge 门）。
// 个人 claim 信任客户端 lv（装饰性；团队 claim 校验 teams.xp_gained ≥ TEAM_LEVELS[lv-1]）。

const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

// 团队直插（id/data/created_at + xp_gained 列 033）+ owner 成员行
function seedTeam(t, teamId, ownerId, xp) {
  const iso = new Date().toISOString();
  t.db.prepare('INSERT INTO teams (id, data, xp_gained, created_at) VALUES (?, ?, ?, ?)')
    .run(teamId, JSON.stringify({ name: 'Team ' + teamId, ownerId }), xp, iso);
  t.db.prepare("INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)").run(teamId, ownerId, iso);
}

test('个人领奖：L2 成就+徽章+新手相框+免费边缘四件套入账；重复 claim 幂等', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const res = await t.request('POST', '/api/rewards/claim', { scope: 'user', lv: 2 }, { cookie: alice.cookie });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body.claimed, { scope: 'user', lv: 2, ach: 'ACH-user-2' });
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM user_achievements WHERE user_id = ?").get(alice.user.id).n, 1);
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM user_badges WHERE user_id = ? AND badge_id = 'BADGE-user-2'").get(alice.user.id).n, 1);
    const cos = t.db.prepare("SELECT kind, value FROM user_cosmetics WHERE user_id = ? ORDER BY kind").all(alice.user.id);
    assert.deepStrictEqual(cos.map((r) => [r.kind, r.value]), [['edge', 'free-edge'], ['frame', 'rookie-frame']]);
    // 幂等：再领一次零新增
    const again = await t.request('POST', '/api/rewards/claim', { scope: 'user', lv: 2 }, { cookie: alice.cookie });
    assert.strictEqual(again.status, 200);
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM user_achievements WHERE user_id = ?").get(alice.user.id).n, 1);
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM user_badges WHERE user_id = ?").get(alice.user.id).n, 1);
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM user_cosmetics WHERE user_id = ?').get(alice.user.id).n, 2);
  } finally { await t.close(); }
});

test('个人领奖：等级不在奖励表 → 400 VALIDATION', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    for (const lv of [1, 3, 5, 13, -1, 'x']) {
      const res = await t.request('POST', '/api/rewards/claim', { scope: 'user', lv }, { cookie: alice.cookie });
      assert.strictEqual(res.status, 400, 'lv=' + lv);
      assert.strictEqual((await res.json()).error.code, 'VALIDATION');
    }
  } finally { await t.close(); }
});

test('团队领奖：非成员 403 / 阈值未达 400 / 达到后成就入队+徽章给发起人', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    seedTeam(t, 'TEAM-X001', alice.user.id, 0);
    // 非成员 → 403
    const outsider = await t.request('POST', '/api/rewards/claim', { scope: 'team', teamId: 'TEAM-X001', lv: 2 }, { cookie: bob.cookie });
    assert.strictEqual(outsider.status, 403);
    // 成员但 XP 不足 L2 阈值 1800 → 400
    const short = await t.request('POST', '/api/rewards/claim', { scope: 'team', teamId: 'TEAM-X001', lv: 2 }, { cookie: alice.cookie });
    assert.strictEqual(short.status, 400);
    assert.strictEqual((await short.json()).error.code, 'VALIDATION');
    // XP 1800 达标 → 200：团队成就 + 发起人徽章
    t.db.prepare('UPDATE teams SET xp_gained = 1800 WHERE id = ?').run('TEAM-X001');
    const ok = await t.request('POST', '/api/rewards/claim', { scope: 'team', teamId: 'TEAM-X001', lv: 2 }, { cookie: alice.cookie });
    assert.strictEqual(ok.status, 200);
    assert.deepStrictEqual((await ok.json()).claimed, { scope: 'team', teamId: 'TEAM-X001', lv: 2, ach: 'ACH-team-2' });
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM team_achievements WHERE team_id = 'TEAM-X001'").get().n, 1);
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM user_badges WHERE user_id = ? AND badge_id = 'BADGE-team-2'").get(alice.user.id).n, 1);
    // 幂等：再领一次零新增
    await t.request('POST', '/api/rewards/claim', { scope: 'team', teamId: 'TEAM-X001', lv: 2 }, { cookie: alice.cookie });
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM team_achievements WHERE team_id = 'TEAM-X001'").get().n, 1);
    // 团队不存在 → 404 / 缺 teamId → 400
    const ghost = await t.request('POST', '/api/rewards/claim', { scope: 'team', teamId: 'TEAM-NOPE', lv: 2 }, { cookie: alice.cookie });
    assert.strictEqual(ghost.status, 404);
    const noId = await t.request('POST', '/api/rewards/claim', { scope: 'team', lv: 2 }, { cookie: alice.cookie });
    assert.strictEqual(noId.status, 400);
  } finally { await t.close(); }
});

test('GET /api/rewards/me：清单形状（成就带名称/徽章/装饰品/edgeUnlocked 旗）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    await t.request('POST', '/api/rewards/claim', { scope: 'user', lv: 2 }, { cookie: alice.cookie });
    await t.request('POST', '/api/rewards/claim', { scope: 'user', lv: 6 }, { cookie: alice.cookie });
    const res = await t.request('GET', '/api/rewards/me', undefined, { cookie: alice.cookie });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body.achievements.map((a) => [a.id, a.name, a.level]), [
      ['ACH-user-2', '官方对你的认可', 2],
      ['ACH-user-6', '恭喜你成为老玩家', 6]
    ]);
    assert.deepStrictEqual(body.badges.map((b) => b.id), ['BADGE-user-2', 'BADGE-user-6']);
    // 装饰品三件（顺序无关，按 kind+value 排序断言）
    assert.deepStrictEqual(body.cosmetics.map((c) => [c.kind, c.value]).sort(), [
      ['edge', 'free-edge'], ['frame', 'rookie-frame'], ['title', 'veteran-title']
    ].sort());
    assert.strictEqual(body.edgeUnlocked, true);
    // 未领奖者清单为空 + 旗 false
    const bob = t.loginAs('bob@x.com');
    const empty = await (await t.request('GET', '/api/rewards/me', undefined, { cookie: bob.cookie })).json();
    assert.deepStrictEqual(empty.achievements, []);
    assert.strictEqual(empty.edgeUnlocked, false);
    // 匿名 401
    const anon = await t.request('GET', '/api/rewards/me');
    assert.strictEqual(anon.status, 401);
  } finally { await t.close(); }
});

test('GET /api/teams/:id/rewards：成员可见（xpGained/level/levels/成就）；非成员 403', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    seedTeam(t, 'TEAM-X002', alice.user.id, 7200); // 7200 ≥ L4 阈值 7200（个人 4800 ×1.5）
    const res = await t.request('GET', '/api/teams/TEAM-X002/rewards', undefined, { cookie: alice.cookie });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.xpGained, 7200);
    assert.strictEqual(body.level, 4, '团队等级=个人 ×1.5 阈值表');
    assert.deepStrictEqual(body.levels.slice(0, 4), [0, 1800, 3600, 7200]);
    assert.deepStrictEqual(body.achievements, []);
    const denied = await t.request('GET', '/api/teams/TEAM-X002/rewards', undefined, { cookie: bob.cookie });
    assert.strictEqual(denied.status, 403);
  } finally { await t.close(); }
});

test('PATCH cardEdge：免费未解锁 403 / 领奖后放行 / 订阅恒放行 / null 恒放行（祖父条款）', async () => {
  const t = await testApp();
  try {
    const free = t.loginAs('free@x.com');
    // 免费未解锁 → 403
    const no = await t.request('PATCH', '/api/auth/me', { cardEdge: 'paper' }, { cookie: free.cookie });
    assert.strictEqual(no.status, 403);
    assert.strictEqual((await no.json()).error.code, 'FORBIDDEN');
    // null 恒放行（卸载边缘不算新解锁）
    const nul = await t.request('PATCH', '/api/auth/me', { cardEdge: null }, { cookie: free.cookie });
    assert.strictEqual(nul.status, 200);
    // 领 Lv.2 奖（edge/free-edge）→ 放行（PATCH 响应经 publicUser 不含 cardEdge，落库以 DB 为准）
    await t.request('POST', '/api/rewards/claim', { scope: 'user', lv: 2 }, { cookie: free.cookie });
    const ok = await t.request('PATCH', '/api/auth/me', { cardEdge: 'paper' }, { cookie: free.cookie });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(t.db.prepare('SELECT card_edge FROM users WHERE id = ?').get(free.user.id).card_edge, 'paper');
    // 白名单外键照旧 400
    const bad = await t.request('PATCH', '/api/auth/me', { cardEdge: 'hax' }, { cookie: free.cookie });
    assert.strictEqual(bad.status, 400);
    // 订阅用户无需领奖 → 恒放行
    const paid = t.loginAs('paid@x.com', { tier: 'basic' });
    const p = await t.request('PATCH', '/api/auth/me', { cardEdge: 'paper' }, { cookie: paid.cookie });
    assert.strictEqual(p.status, 200);
  } finally { await t.close(); }
});

test('PATCH avatarFrame/title：未拥有 403 / 领奖后放行 / 白名单外 400 / null 卸下恒放行 / publicUser 随行', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    // 未领奖：相框/称号都 403
    const f1 = await t.request('PATCH', '/api/auth/me', { avatarFrame: 'rookie-frame' }, { cookie: alice.cookie });
    assert.strictEqual(f1.status, 403);
    const t1 = await t.request('PATCH', '/api/auth/me', { title: 'veteran-title' }, { cookie: alice.cookie });
    assert.strictEqual(t1.status, 403);
    // 白名单外 400
    const bad = await t.request('PATCH', '/api/auth/me', { avatarFrame: 'hax-frame' }, { cookie: alice.cookie });
    assert.strictEqual(bad.status, 400);
    assert.strictEqual((await bad.json()).error.code, 'VALIDATION');
    // null 恒放行（没拥有也能卸下）
    const nul = await t.request('PATCH', '/api/auth/me', { avatarFrame: null, title: null }, { cookie: alice.cookie });
    assert.strictEqual(nul.status, 200);
    // L2 领奖 → rookie-frame 可戴（veteran-title 是 L6 奖仍未拥有）
    await t.request('POST', '/api/rewards/claim', { scope: 'user', lv: 2 }, { cookie: alice.cookie });
    const f2 = await t.request('PATCH', '/api/auth/me', { avatarFrame: 'rookie-frame' }, { cookie: alice.cookie });
    assert.strictEqual(f2.status, 200);
    assert.strictEqual((await f2.json()).user.avatarFrame, 'rookie-frame');
    const t2 = await t.request('PATCH', '/api/auth/me', { title: 'veteran-title' }, { cookie: alice.cookie });
    assert.strictEqual(t2.status, 403, 'L6 称号未拥有仍 403');
    // L6 领奖 → 称号可戴 + champion-frame 仍 403（L12 奖）
    await t.request('POST', '/api/rewards/claim', { scope: 'user', lv: 6 }, { cookie: alice.cookie });
    const t3 = await t.request('PATCH', '/api/auth/me', { title: 'veteran-title' }, { cookie: alice.cookie });
    assert.strictEqual(t3.status, 200);
    assert.strictEqual((await t3.json()).user.title, 'veteran-title');
    const f3 = await t.request('PATCH', '/api/auth/me', { avatarFrame: 'champion-frame' }, { cookie: alice.cookie });
    assert.strictEqual(f3.status, 403, 'L12 相框未拥有仍 403');
    // 公共主页 shape 公开相框/称号
    const prof = await (await t.request('GET', '/api/social/users/' + alice.user.id)).json();
    assert.strictEqual(prof.user.avatarFrame, 'rookie-frame');
    assert.strictEqual(prof.user.title, 'veteran-title');
  } finally { await t.close(); }
});
