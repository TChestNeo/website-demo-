'use strict';
// SlatiControl 用户中心（§3/§4）：GET /api/staff/users 列表（q/filter/sort/page）+ GET /api/staff/users/:id 详情。
// 掩码矩阵（§28）：cs = 基础档案✅ 支付❌（null）内部❌（无 riskReasons）；finance = 支付✅；security = 内部✅。
// 权限：users.view 全角色都有 → 用零角色 staff 验证 403 链。

const test = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

const DAY = 86400e3;
function iso(nDaysAgo, extra = 0) {
  return new Date(Date.now() - nDaysAgo * DAY - extra).toISOString();
}
function insUser(db, id, email, over = {}) {
  db.prepare(`INSERT INTO users (id, email, display_name, citizen_id, tier, status, risk_level, risk_reasons, last_active_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, email, over.name || email, over.citizen || null, over.tier || 'free', over.status || 'active',
      over.risk || 'low', over.reasons || null, over.lastActive || null, over.createdAt, new Date().toISOString());
}

test('列表：默认排序/q 搜索/filter/sort/page 分页/pageSize 钳制', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginStaffAs('boss@slatiworld.local', {}, ['project_director']);
    const db = t.db;
    insUser(db, 'USR-T1', 'alpha@x.y', { createdAt: iso(1) });
    insUser(db, 'USR-T2', 'beta@x.y', { status: 'banned', risk: 'high', createdAt: iso(2) });
    insUser(db, 'USR-T3', 'gamma@x.y', { status: 'delete_pending', risk: 'medium', createdAt: iso(3) });
    insUser(db, 'USR-T4', 'delta@x.y', { tier: 'premium', lastActive: iso(1), createdAt: iso(4) });
    insUser(db, 'USR-T5', 'epsilon@x.y', { createdAt: iso(5) });

    // 默认 created_desc
    const r1 = await (await t.request('GET', '/api/staff/users', undefined, { cookie })).json();
    assert.strictEqual(r1.total, 5);
    assert.deepStrictEqual(r1.users.map((u) => u.id), ['USR-T1', 'USR-T2', 'USR-T3', 'USR-T4', 'USR-T5']);

    // q 搜索（email LIKE）
    const r2 = await (await t.request('GET', '/api/staff/users?q=bet', undefined, { cookie })).json();
    assert.deepStrictEqual(r2.users.map((u) => u.id), ['USR-T2']);

    // filter=banned / filter=risk（risk_desc：high 在前）
    const r3 = await (await t.request('GET', '/api/staff/users?filter=banned', undefined, { cookie })).json();
    assert.deepStrictEqual(r3.users.map((u) => u.id), ['USR-T2']);
    const r4 = await (await t.request('GET', '/api/staff/users?filter=risk', undefined, { cookie })).json();
    assert.deepStrictEqual(r4.users.map((u) => u.id), ['USR-T2', 'USR-T3']);

    // sort=created_asc / last_active_desc（T4 唯一有 last_active_at）
    const r5 = await (await t.request('GET', '/api/staff/users?sort=created_asc', undefined, { cookie })).json();
    assert.strictEqual(r5.users[0].id, 'USR-T5');
    const r6 = await (await t.request('GET', '/api/staff/users?sort=last_active_desc', undefined, { cookie })).json();
    assert.strictEqual(r6.users[0].id, 'USR-T4', 'NULLS LAST：唯一活跃用户排最前');

    // 分页：page=2&pageSize=2 → [T3, T4]；page 钳制 0→1；pageSize 钳制上限 100
    const r7 = await (await t.request('GET', '/api/staff/users?page=2&pageSize=2', undefined, { cookie })).json();
    assert.deepStrictEqual(r7.users.map((u) => u.id), ['USR-T3', 'USR-T4']);
    assert.strictEqual(r7.total, 5);
    const r8 = await (await t.request('GET', '/api/staff/users?page=0&pageSize=9999', undefined, { cookie })).json();
    assert.strictEqual(r8.page, 1);
    assert.strictEqual(r8.pageSize, 100);
  } finally {
    await t.close();
  }
});

test('列表掩码：cs 无 riskReasons/warningCount 等内部字段；director 全量', async () => {
  const t = await testApp();
  try {
    const db = t.db;
    insUser(db, 'USR-T1', 'alpha@x.y', { risk: 'high', reasons: '["flood"]', createdAt: iso(1) });
    const cs = await (await t.request('GET', '/api/staff/users', undefined, { cookie: t.loginStaffAs('cs@slatiworld.local').cookie })).json();
    const row = cs.users[0];
    assert.ok('riskLevel' in row, '风险等级安全标记永见');
    assert.ok(!('riskReasons' in row), 'cs 无内部数据（riskReasons）');
    assert.ok(!('warningCount' in row) && !('mutedUntil' in row), 'cs 无内部数据（警告/禁言）');
    assert.ok(!('dob' in row), 'cs 无内部数据（出生日期）');

    const dir = await (await t.request('GET', '/api/staff/users', undefined, { cookie: t.loginStaffAs('dir@slatiworld.local', {}, ['project_director']).cookie })).json();
    assert.deepStrictEqual(dir.users[0].riskReasons, ['flood']);
  } finally {
    await t.close();
  }
});

test('详情：活动聚合 + 支付掩码（cs null / finance 最新在前）+ 404', async () => {
  const t = await testApp();
  try {
    const db = t.db;
    const nowIso = iso(0);
    insUser(db, 'USR-T1', 'alpha@x.y', { createdAt: iso(3) });
    insUser(db, 'USR-T2', 'beta@x.y', { createdAt: iso(3) });
    // 活动：2 帖 1 评 1 关注（user）1 会话 2 工单
    db.prepare('INSERT INTO posts (id, author_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)')
      .run('PST-1', 'USR-T1', 'a', nowIso, nowIso, 'PST-2', 'USR-T1', 'b', nowIso, nowIso);
    db.prepare("INSERT INTO comments (id, post_id, author_id, content, created_at) VALUES ('CMT-1', 'PST-1', 'USR-T1', 'c', ?)").run(nowIso);
    db.prepare("INSERT INTO following (user_id, target_type, target_id, created_at) VALUES ('USR-T1', 'user', 'USR-T2', ?), ('USR-T1', 'nation', 'NAT-9', ?)").run(nowIso, nowIso);
    db.prepare("INSERT INTO conversations (id, kind, created_at) VALUES ('CONV-1', 'dm', ?)").run(nowIso);
    db.prepare("INSERT INTO conversation_members (conversation_id, actor_type, actor_id, joined_at) VALUES ('CONV-1', 'user', 'USR-T1', ?), ('CONV-1', 'user', 'USR-T2', ?)").run(nowIso, nowIso);
    const tk = db.prepare("INSERT INTO tickets (id, user_id, category, type, contact, subject, description, submitted_at, created_at, updated_at) VALUES (?, 'USR-T1', 'bug', '问题', 'c@x.y', 's', 'd', ?, ?, ?)");
    tk.run('MN-2026-000001', nowIso, nowIso, nowIso);
    tk.run('MN-2026-000002', nowIso, nowIso, nowIso);
    // 支付：2 笔（seq DESC → 最新在前）
    const pay = db.prepare("INSERT INTO payments (id, user_id, tier_key, amount_micro, status, created_at, paid_at) VALUES (?, 'USR-T1', ?, ?, ?, ?, ?)");
    pay.run('PAY-1', 'basic', 1000000, 'paid', iso(2), iso(2));
    pay.run('PAY-2', 'premium', 2000000, 'paid', iso(1), iso(1));

    // cs：基础档案 + 统计；支付 null
    const cs = await (await t.request('GET', '/api/staff/users/USR-T1', undefined, { cookie: t.loginStaffAs('cs@slatiworld.local').cookie })).json();
    assert.strictEqual(cs.user.id, 'USR-T1');
    assert.deepStrictEqual(cs.stats, { posts: 2, comments: 1, following: 1, conversations: 1, tickets: 2, lastLoginAt: null, loginCount: 0 });
    assert.strictEqual(cs.payments, null, 'cs 无 payments 能力 → null（区块隐藏）');

    // finance 有 payments 能力但矩阵无 users.view → 权限检查先于掩码（403）
    await t.assertDenied(await t.request('GET', '/api/staff/users/USR-T1', undefined, { cookie: t.loginStaffAs('fin@slatiworld.local', {}, ['finance']).cookie }));

    // management：支付可见且 seq DESC
    const fin = await (await t.request('GET', '/api/staff/users/USR-T1', undefined, { cookie: t.loginStaffAs('mgr@slatiworld.local', {}, ['management']).cookie })).json();
    assert.strictEqual(fin.payments.length, 2);
    assert.strictEqual(fin.payments[0].id, 'PAY-2', '按 seq DESC 最新在前');
    assert.strictEqual(fin.payments[0].amount_micro, 2000000);

    // 404
    const nf = await t.request('GET', '/api/staff/users/USR-NOPE', undefined, { cookie: t.loginStaffAs('cs2@slatiworld.local').cookie });
    assert.strictEqual(nf.status, 404);
  } finally {
    await t.close();
  }
});

test('users 权限：无角色 staff → 403 + 审计 denied', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginStaffAs('ghost@slatiworld.local', {}, []);
    await t.assertDenied(await t.request('GET', '/api/staff/users', undefined, { cookie }));
    const denied = t.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'perm_denied' AND result = 'denied' AND target_id = 'GET /api/staff/users'").get().n;
    assert.strictEqual(denied, 1);
  } finally {
    await t.close();
  }
});
