'use strict';
// SlatiControl 安全中心（§5）：登录史/事件列表 + 单用户安全档案 + 事件标记（唯一写操作 → 审计）。
// 掩码矩阵：cs = IP 前两段 + 近 10 条（无 view_all → 全局端点 403）；moderation = 可看但无 IP 能力 → ip null；
// security = 全量 IP + 可标记；flag 写 → 审计行（next/prev/reason 可反查）。

const test = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

function iso(msAgo) {
  return new Date(Date.now() - msAgo).toISOString();
}
function seedUser(db, id, email) {
  db.prepare('INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(id, email, iso(0), iso(0));
}
function seedLogins(db, userId, n, extra = {}) {
  const ins = db.prepare('INSERT INTO login_history (id, actor_type, actor_id, email, ip, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  // i=0 从 1 分钟前起（留出「更最新」的插入空间）；LGH-0 最新 … LGH-(n-1) 最旧
  for (let i = 0; i < n; i++) ins.run(`LGH-${i}`, 'user', userId, `${userId}@x.y`, `203.0.113.${i}`, extra.result || 'success', iso((i + 1) * 60e3));
}

test('登录史：cs 单用户档案只近 10 条 + IP 前两段；security 全局全量 + 完整 IP；过滤分页；cs 全局 403', async () => {
  const t = await testApp();
  try {
    const db = t.db;
    seedUser(db, 'USR-T1', 'u1@x.y');
    seedLogins(db, 'USR-T1', 12); // LGH-0 最新 … LGH-11 最旧
    db.prepare("INSERT INTO login_history (id, actor_type, actor_id, email, ip, result, created_at) VALUES ('LGH-F1', 'user', 'USR-T1', 'u1@x.y', '9.9.9.9', 'failed', ?)").run(iso(30e3));

    // cs：单用户档案（users.view，用户工作流一部分）→ 掩码 = 最新 10 条 + 前两段
    const cs = t.loginStaffAs('cs@slatiworld.local');
    const r1 = await (await t.request('GET', '/api/staff/users/USR-T1/security', undefined, { cookie: cs.cookie })).json();
    assert.strictEqual(r1.loginHistory.length, 10, 'cs 只见近 10 条');
    assert.strictEqual(r1.loginHistory[0].id, 'LGH-F1', '最新登录必须在（掩码保留最新 10 条）');
    assert.strictEqual(r1.loginHistory[0].ip, '9.9.*.*');
    assert.strictEqual(r1.loginHistory[9].id, 'LGH-8', '第 10 条 = 第 10 新（LGH-9 起被截掉）');
    assert.ok(r1.loginHistory.every((r) => r.ip.endsWith('.*.*')), '全部前两段');

    // security：全局端点全量 + 完整 IP
    const sec = t.loginStaffAs('sec@slatiworld.local', {}, ['security']);
    const r2 = await (await t.request('GET', '/api/staff/security/logins?userId=USR-T1', undefined, { cookie: sec.cookie })).json();
    assert.strictEqual(r2.total, 13);
    assert.strictEqual(r2.logins.length, 13, 'security 全量');
    assert.strictEqual(r2.logins[0].ip, '9.9.9.9', 'security 完整 IP');

    // result 过滤 + 分页（pageSize=1 取最新 2 条）
    const r3 = await (await t.request('GET', '/api/staff/security/logins?userId=USR-T1&result=failed', undefined, { cookie: sec.cookie })).json();
    assert.strictEqual(r3.total, 1);
    assert.strictEqual(r3.logins[0].id, 'LGH-F1');
    const r4 = await (await t.request('GET', '/api/staff/security/logins?userId=USR-T1&pageSize=1&page=2', undefined, { cookie: sec.cookie })).json();
    assert.strictEqual(r4.logins.length, 1);
    assert.strictEqual(r4.logins[0].id, 'LGH-0', 'DESC 分页第 2 页 = 第二新');

    // cs 无 security.view_all → 全局端点 403 + 审计 denied
    await t.assertDenied(await t.request('GET', '/api/staff/security/logins', undefined, { cookie: cs.cookie }));
  } finally {
    await t.close();
  }
});

test('事件列表：moderation 可看但 ip null；eventType 过滤；分页；标记字段在行内', async () => {
  const t = await testApp();
  try {
    const db = t.db;
    seedUser(db, 'USR-T1', 'u1@x.y');
    const ev = db.prepare('INSERT INTO security_events (id, actor_type, actor_id, event_type, detail, ip, risk_level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    ev.run('EV-1', 'user', 'USR-T1', 'suspicious_login', 'd1', '198.51.100.1', 'high', iso(60e3));
    ev.run('EV-2', 'user', 'USR-T1', 'password_change', 'd2', '198.51.100.2', 'low', iso(2 * 60e3));
    ev.run('EV-3', 'user', 'USR-T1', 'suspicious_login', 'd3', '198.51.100.3', 'medium', iso(3 * 60e3));
    db.prepare("UPDATE security_events SET flagged = 1, flagged_by = 'STAFF-X', flagged_at = ? WHERE id = 'EV-2'").run(iso(30e3));

    const mod = t.loginStaffAs('mod@slatiworld.local', {}, ['moderation']);
    const r1 = await (await t.request('GET', '/api/staff/security/events', undefined, { cookie: mod.cookie })).json();
    assert.strictEqual(r1.total, 3);
    assert.strictEqual(r1.events[0].id, 'EV-1', 'DESC 最新在前');
    assert.strictEqual(r1.events[0].ip, null, 'moderation 无 IP 能力 → ip 隐藏（§28 阶梯）');
    assert.strictEqual(r1.events[1].flagged, 1, 'EV-2 已标记（flagged 字段行内可见）');

    const r2 = await (await t.request('GET', '/api/staff/security/events?eventType=suspicious_login', undefined, { cookie: mod.cookie })).json();
    assert.deepStrictEqual(r2.events.map((e) => e.id), ['EV-1', 'EV-3']);
    const r3 = await (await t.request('GET', '/api/staff/security/events?eventType=bogus', undefined, { cookie: mod.cookie })).json();
    assert.strictEqual(r3.total, 3, '非法 eventType 不注入 WHERE（防注入面）');
  } finally {
    await t.close();
  }
});

test('单用户安全档案：登录史 + 事件 + flagged 计数；404', async () => {
  const t = await testApp();
  try {
    const db = t.db;
    seedUser(db, 'USR-T1', 'u1@x.y');
    seedLogins(db, 'USR-T1', 5);
    db.prepare("INSERT INTO security_events (id, actor_type, actor_id, event_type, ip, created_at) VALUES ('EV-1', 'user', 'USR-T1', 'new_device', '1.1.1.1', ?), ('EV-2', 'user', 'USR-T1', 'email_change', '2.2.2.2', ?)").run(iso(60e3), iso(120e3));
    db.prepare("UPDATE security_events SET flagged = 1 WHERE id = 'EV-2'").run();

    const sec = t.loginStaffAs('sec@slatiworld.local', {}, ['security']);
    const r1 = await (await t.request('GET', '/api/staff/users/USR-T1/security', undefined, { cookie: sec.cookie })).json();
    assert.strictEqual(r1.loginHistory.length, 5);
    assert.strictEqual(r1.loginHistory[0].ip, '203.0.113.0', 'security 完整 IP');
    assert.strictEqual(r1.events.length, 2);
    assert.strictEqual(r1.flagged, 1);

    const nf = await t.request('GET', '/api/staff/users/USR-NOPE/security', undefined, { cookie: sec.cookie });
    assert.strictEqual(nf.status, 404);
  } finally {
    await t.close();
  }
});

test('flag 写操作：security.manage → 200 + 审计行；moderation 403 + denied 审计；note 截断；404', async () => {
  const t = await testApp();
  try {
    const db = t.db;
    seedUser(db, 'USR-T1', 'u1@x.y');
    db.prepare("INSERT INTO security_events (id, actor_type, actor_id, event_type, ip, created_at) VALUES ('EV-1', 'user', 'USR-T1', 'suspicious_login', '1.1.1.1', ?)").run(iso(60e3));

    const sec = t.loginStaffAs('sec@slatiworld.local', {}, ['security']);
    const r1 = await t.request('POST', '/api/staff/security/events/EV-1/flag', { note: '跟进中：疑似撞库' }, { cookie: sec.cookie });
    assert.strictEqual(r1.status, 200);
    assert.deepStrictEqual(await r1.json(), { flagged: true });
    const row = db.prepare('SELECT * FROM security_events WHERE id = ?').get('EV-1');
    assert.strictEqual(row.flagged, 1);
    assert.strictEqual(row.flagged_by, sec.staff.id);

    // 审计行：action/目标/前后值/理由（§25 写操作必审计）
    const a = db.prepare("SELECT * FROM audit_log WHERE action = 'security_event_flag' AND target_id = 'EV-1'").get();
    assert.ok(a, '审计行必须存在');
    assert.strictEqual(a.actor_id, sec.staff.id);
    assert.deepStrictEqual(JSON.parse(a.prev_value), { flagged: 0 });
    assert.deepStrictEqual(JSON.parse(a.new_value), { flagged: 1, by: sec.staff.id });
    assert.strictEqual(a.reason, '跟进中：疑似撞库');

    // 无 security.manage（moderation 只有 view_all）→ 403 + denied 审计；行未被改
    const mod = t.loginStaffAs('mod@slatiworld.local', {}, ['moderation']);
    const r2 = await t.request('POST', '/api/staff/security/events/EV-1/flag', { note: 'x' }, { cookie: mod.cookie });
    await t.assertDenied(r2);
    assert.strictEqual(db.prepare("SELECT count(*) AS n FROM audit_log WHERE result = 'denied'").get().n, 1);

    // note 超长截 500
    const long = 'x'.repeat(600);
    await t.request('POST', '/api/staff/security/events/EV-1/flag', { note: long }, { cookie: sec.cookie });
    const a2 = db.prepare("SELECT * FROM audit_log WHERE action = 'security_event_flag' ORDER BY seq DESC LIMIT 1").get();
    assert.strictEqual(a2.reason.length, 500);

    // 404
    const nf = await t.request('POST', '/api/staff/security/events/EV-NOPE/flag', { note: 'x' }, { cookie: sec.cookie });
    assert.strictEqual(nf.status, 404);
  } finally {
    await t.close();
  }
});
