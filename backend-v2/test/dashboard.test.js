'use strict';
// SlatiControl 总览（§1）：六组统计卡单次聚合。种子数据反推断言——每个数字都能在种子 SQL 里找到出处。
// 权限：dashboard.view（moderation 角色矩阵无此键 → 403 + 审计 denied）。

const test = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

function iso(msAgo) {
  return new Date(Date.now() - msAgo).toISOString();
}

test('GET /api/staff/dashboard：六组统计卡数字全部反推命中（director）', async () => {
  const t = await testApp();
  try {
    const { staff, cookie } = t.loginStaffAs('boss@slatiworld.local', {}, ['project_director']);
    const db = t.db;
    const day = (n) => new Date(Date.now() - n * 86400e3).toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    // 用户 4：u1 2d 前 / u2 10d 前 medium / u3 封禁 / u4 premium+high 2h 前
    const ins = db.prepare('INSERT INTO users (id, email, display_name, tier, status, risk_level, risk_reasons, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    ins.run('USR-T1', 'u1@x.y', 'Uno', 'free', 'active', 'low', null, iso(2 * 86400e3), nowIso);
    ins.run('USR-T2', 'u2@x.y', 'Due', 'free', 'active', 'medium', '["abuse"]', iso(10 * 86400e3), nowIso);
    ins.run('USR-T3', 'u3@x.y', 'Tre', 'free', 'banned', 'low', null, iso(30 * 86400e3), nowIso);
    ins.run('USR-T4', 'u4@x.y', 'Qua', 'premium', 'active', 'high', '["flood"]', iso(2 * 3600e3), nowIso);

    // 活跃（24h 口径：date >= 今天）：u1 + u4 → 2；u2 昨天不计
    const act = db.prepare('INSERT INTO activity_daily (user_id, date, requests, last_seen_at) VALUES (?, ?, ?, ?)');
    act.run('USR-T1', day(0), 3, nowIso);
    act.run('USR-T4', day(0), 1, nowIso);
    act.run('USR-T2', day(1), 5, nowIso);

    // 内容：4 帖（2 可见 1 隐藏 1 移除）、1 待审、1 待处理举报
    const po = db.prepare('INSERT INTO posts (id, author_id, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    po.run('PST-1', 'USR-T1', 'a', 'visible', iso(1 * 86400e3), nowIso);
    po.run('PST-2', 'USR-T2', 'b', 'visible', iso(3 * 86400e3), nowIso);
    po.run('PST-3', 'USR-T3', 'c', 'hidden', iso(4 * 86400e3), nowIso);
    po.run('PST-4', 'USR-T4', 'd', 'removed', iso(5 * 86400e3), nowIso);
    db.prepare("INSERT INTO moderation_items (id, kind, target_type, target_id, content_hash, status, created_at) VALUES ('MOD-1', 'text', 'post', 'PST-1', 'h1', 'queued', ?)").run(nowIso);
    db.prepare("INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, created_at) VALUES ('RPT-1', 'USR-T1', 'post', 'PST-2', 'spam', 'open', ?), ('RPT-2', 'USR-T1', 'post', 'PST-3', 'x', 'resolved', ?)").run(nowIso, nowIso);

    // 社区：2 国 1 队 1 会话 3 关注
    db.prepare("INSERT INTO nations (id, owner_id, data, created_at, updated_at) VALUES ('NAT-1', 'USR-T1', '{}', ?, ?), ('NAT-2', 'USR-T2', '{}', ?, ?)").run(nowIso, nowIso, nowIso, nowIso);
    db.prepare("INSERT INTO teams (id, data, created_at) VALUES ('TEAM-1', '{}', ?)").run(nowIso);
    db.prepare("INSERT INTO conversations (id, kind, created_at) VALUES ('CONV-1', 'dm', ?)").run(nowIso);
    const fo = db.prepare('INSERT INTO following (user_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)');
    fo.run('USR-T1', 'user', 'USR-T2', nowIso);
    fo.run('USR-T1', 'nation', 'NAT-1', nowIso);
    fo.run('USR-T2', 'topic', 'TOP-1', nowIso);

    // 工单：queued 未分配 / escalated 已分配 / resolved 2h 前 / closed
    const tk = db.prepare(`INSERT INTO tickets (id, user_id, category, type, contact, subject, description, submitted_at, status, assigned_staff_id, resolved_at, created_at, updated_at)
      VALUES (?, ?, 'bug', '问题', 'c@x.y', 's', 'd', ?, ?, ?, ?, ?, ?)`);
    tk.run('MN-2026-000001', 'USR-T1', nowIso, 'queued', null, null, nowIso, nowIso);
    tk.run('MN-2026-000002', 'USR-T2', nowIso, 'escalated', staff.id, null, nowIso, nowIso);
    tk.run('MN-2026-000003', 'USR-T3', nowIso, 'resolved', staff.id, iso(2 * 3600e3), nowIso, nowIso);
    tk.run('MN-2026-000004', 'USR-T4', nowIso, 'closed', null, null, nowIso, nowIso);

    // 平台：登录史 24h 内 1 成 1 败（3d 前的不计）
    const lh = db.prepare('INSERT INTO login_history (id, actor_type, actor_id, email, ip, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    lh.run('LGH-1', 'user', 'USR-T1', 'u1@x.y', '1.2.3.4', 'success', iso(3600e3));
    lh.run('LGH-2', 'user', 'USR-T2', 'u2@x.y', '5.6.7.8', 'failed', iso(2 * 3600e3));
    lh.run('LGH-3', 'user', 'USR-T3', 'u3@x.y', '9.9.9.9', 'success', iso(3 * 86400e3));

    // 财务：1 笔已付（月窗内）+ 1 订阅活跃 + AI 成本 500000 CNY 微元 + 流水账
    db.prepare(`INSERT INTO payments (id, user_id, tier_key, amount_micro, status, created_at, paid_at) VALUES ('PAY-1', 'USR-T1', 'basic', 2000000, 'paid', ?, ?)`)
      .run(nowIso, iso(3600e3));
    db.prepare(`INSERT INTO payments (id, user_id, tier_key, amount_micro, status, created_at) VALUES ('PAY-2', 'USR-T2', 'premium', 9900000, 'pending', ?)`)
      .run(nowIso);
    db.prepare(`INSERT INTO subscriptions (id, user_id, plan_key, tier_key, amount_micro, status, created_at, updated_at) VALUES ('SUB-1', 'USR-T1', 'premium', 'premium', 9900000, 'active', ?, ?)`)
      .run(nowIso, nowIso);
    db.prepare(`INSERT INTO usage_log (feature, price_snapshot, cost_micro, status, created_at) VALUES ('chat', '{}', 500000, 'ok', ?)`)
      .run(iso(3600e3));
    db.prepare(`INSERT INTO ledger (id, kind, category, amount, currency, occurred_at, created_at) VALUES ('LED-1', 'income', 'subscription', 10.50, 'RM', ?, ?), ('LED-2', 'expense', 'ai', 2.00, 'RM', ?, ?)`)
      .run(day(0), nowIso, day(0), nowIso);

    const res = await t.request('GET', '/api/staff/dashboard', undefined, { cookie });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.generatedAt);
    const g = body.groups;
    assert.deepStrictEqual(g.users, { total: 4, new7d: 2, active24h: 2, banned: 1 });
    assert.deepStrictEqual(g.content, { posts: 4, pendingModeration: 1, hidden: 2, openReports: 1 });
    assert.deepStrictEqual(g.community, { nations: 2, teams: 1, conversations: 1, following: 3 });
    // finance.fx 种子 0.62：500000 CNY 微元 → 310000 RM 微元
    assert.deepStrictEqual(g.finance, { revenueMonthMicro: 2000000, mrrMicro: 9900000, aiCostMonthMicro: 310000, payingUsers: 1 });
    assert.deepStrictEqual(g.tickets, { open: 2, unassigned: 1, escalated: 1, resolved30d: 1 });
    assert.deepStrictEqual(g.platform, { signups24h: 1, logins24h: 1, failedLogins24h: 1, riskHigh: 1 });
  } finally {
    await t.close();
  }
});

test('dashboard 权限：无角色 staff → 403 + 审计 denied（矩阵里所有角色都有 dashboard.view，用零角色验证链）', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginStaffAs('ghost@slatiworld.local', {}, []);
    const res = await t.request('GET', '/api/staff/dashboard', undefined, { cookie });
    await t.assertDenied(res);
    const denied = t.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'perm_denied' AND result = 'denied' AND target_id = 'GET /api/staff/dashboard'").get().n;
    assert.strictEqual(denied, 1, '拒绝尝试必须落审计 denied 行');
  } finally {
    await t.close();
  }
});
