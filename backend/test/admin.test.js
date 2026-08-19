'use strict';
// P9 端点测试：/api/admin/*（权限矩阵、审核 decide、直接处罚、工单、徽章、用户 tier、预算、审计）。
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

const CLEAN = '我的新国家正式成立，欢迎各位外交官来访交流';

function adminT() {
  return testApp().then(async (t) => {
    const admin = t.loginAs('admin@x.com', { role: 'admin' });
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    t.admin = admin; t.alice = alice; t.bob = bob;
    return t;
  });
}

// 创建一条通过 L0 的帖子 → 返回 post + 其 queued 审核项
async function makePost(t, cookie, content = CLEAN) {
  const r = await t.request('POST', '/api/social/posts', { content, media: [] }, { cookie });
  return (await r.json()).post;
}

test('admin：权限矩阵（匿名 401 / 普通用户 403 / 管理员 200）', async () => {
  const t = await adminT();
  try {
    assert.strictEqual((await t.request('GET', '/api/admin/stats')).status, 401);
    assert.strictEqual((await t.request('GET', '/api/admin/stats', undefined, { cookie: t.alice.cookie })).status, 403);
    assert.strictEqual((await t.request('GET', '/api/admin/stats', undefined, { cookie: t.admin.cookie })).status, 200);
    const s = await (await t.request('GET', '/api/admin/stats', undefined, { cookie: t.admin.cookie })).json();
    assert.strictEqual(s.users, 3);
    assert.strictEqual(typeof s.monthCostMicro, 'number');
    assert.ok(['ok', 'warn', 'exhausted'].includes(s.budgetState));
    assert.ok(s.sub && typeof s.sub.subscribers === 'number' && s.sub.tierEvents.length === 0);
  } finally { await t.close(); }
});

test('admin：stats 总览扩展（全站计数/分项预算/活动流倒序）', async () => {
  const t = await adminT();
  try {
    const post = await makePost(t, t.alice.cookie);
    const s = await (await t.request('GET', '/api/admin/stats', undefined, { cookie: t.admin.cookie })).json();
    assert.strictEqual(s.users, 3);
    assert.strictEqual(s.users7d, 3);
    assert.strictEqual(s.posts, 1);
    assert.strictEqual(s.posts24h, 1);
    assert.strictEqual(s.nations, 0);
    assert.strictEqual(s.topics, 0);
    assert.strictEqual(s.articles, 0);
    assert.strictEqual(s.openReports, 0);
    assert.strictEqual(s.openTickets, 0);
    assert.strictEqual(s.moderationItems.queued, 1);
    assert.ok(s.budget.total && typeof s.budget.total.limit === 'number');
    for (const f of ['moderation_text', 'chat', 'moderation_image']) {
      assert.ok(s.budget.features[f] && typeof s.budget.features[f].spent === 'number' && typeof s.budget.features[f].limit === 'number');
    }
    const postAct = s.activity.find(a => a.type === 'post');
    assert.ok(postAct && postAct.text.includes('新帖'), '活动流含发帖事件');
    for (let i = 1; i < s.activity.length; i++) {
      assert.ok(s.activity[i - 1].at >= s.activity[i].at, '活动流按时间倒序');
    }
    // 管理操作（decide）也应进入活动流
    const item = t.db.prepare('SELECT * FROM moderation_items WHERE target_id = ?').get(post.id);
    await t.request('POST', `/api/admin/moderation/${item.id}/decide`, { verdict: 'reject' }, { cookie: t.admin.cookie });
    const s2 = await (await t.request('GET', '/api/admin/stats', undefined, { cookie: t.admin.cookie })).json();
    assert.ok(s2.activity.some(a => a.type === 'audit' && a.text.includes('审核决定')), '活动流含审计事件');
  } finally { await t.close(); }
});

test('admin：审核队列 open 含 queued 项（带预览）→ approve → human_approved + pending 上线', async () => {
  const t = await adminT();
  try {
    const post = await makePost(t, t.alice.cookie);
    const q = await (await t.request('GET', '/api/admin/moderation/queue', undefined, { cookie: t.admin.cookie })).json();
    const item = q.items.find(i => i.targetId === post.id);
    assert.ok(item, '队列含该帖审核项');
    assert.strictEqual(item.status, 'queued');
    assert.ok(item.preview.includes('新国家'));
    // 模拟图像帖 pending → approve 上线
    t.db.prepare("UPDATE posts SET status = 'pending' WHERE id = ?").run(post.id);
    const r = await t.request('POST', `/api/admin/moderation/${item.id}/decide`, { verdict: 'approve' }, { cookie: t.admin.cookie });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(t.db.prepare('SELECT status FROM moderation_items WHERE id = ?').get(item.id).status, 'human_approved');
    assert.strictEqual(t.db.prepare('SELECT status FROM posts WHERE id = ?').get(post.id).status, 'visible');
    // 审计 mod_decide
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM admin_audit_log WHERE action = 'mod_decide'").get().n, 1);
  } finally { await t.close(); }
});

test('admin：reject 默认下架（decision 落 user_id + 通知 + 审计）；reject+mute 叠加阶梯', async () => {
  const t = await adminT();
  try {
    const p1 = await makePost(t, t.alice.cookie);
    const p2 = await makePost(t, t.alice.cookie, '王国新宪法草案发布，欢迎各位公民审阅讨论'); // 不同内容避开 sha1 去重
    const items = (await (await t.request('GET', '/api/admin/moderation/queue', undefined, { cookie: t.admin.cookie })).json())
      .items.filter(i => i.targetId === p1.id || i.targetId === p2.id);
    const i1 = items.find(i => i.targetId === p1.id);
    const i2 = items.find(i => i.targetId === p2.id);
    // 默认下架
    const r1 = await t.request('POST', `/api/admin/moderation/${i1.id}/decide`, { verdict: 'reject' }, { cookie: t.admin.cookie });
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(t.db.prepare('SELECT status FROM posts WHERE id = ?').get(p1.id).status, 'hidden');
    const d1 = t.db.prepare('SELECT * FROM moderation_decisions WHERE item_id = ?').get(i1.id);
    assert.strictEqual(d1.action, 'remove_content');
    assert.strictEqual(d1.user_id, t.alice.user.id);
    assert.strictEqual(d1.actor, 'admin:admin@x.com');
    assert.ok(t.db.prepare('SELECT count(*) AS n FROM notifications WHERE user_id = ?').get(t.alice.user.id).n > 0);
    // 叠加禁言
    await t.request('POST', `/api/admin/moderation/${i2.id}/decide`, { verdict: 'reject', action: 'mute' }, { cookie: t.admin.cookie });
    const alice2 = t.db.prepare('SELECT * FROM users WHERE id = ?').get(t.alice.user.id);
    assert.ok(alice2.muted_until && alice2.muted_until > new Date().toISOString());
    // 非法 verdict/action → 400
    assert.strictEqual((await t.request('POST', `/api/admin/moderation/${i1.id}/decide`, { verdict: 'x' }, { cookie: t.admin.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', `/api/admin/moderation/${i2.id}/decide`, { verdict: 'reject', action: 'nuke' }, { cookie: t.admin.cookie })).status, 400);
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM admin_audit_log WHERE action = 'mod_decide'").get().n, 2);
  } finally { await t.close(); }
});

test('admin：直接处罚 warn→ban→restore（item_id NULL + user_id 时间线 + 不能处罚管理员）', async () => {
  const t = await adminT();
  try {
    const warn = await t.request('POST', '/api/admin/penalties', { userId: t.bob.user.id, action: 'warn', reasonCode: 'abuse' }, { cookie: t.admin.cookie });
    assert.strictEqual(warn.status, 200);
    assert.strictEqual(t.db.prepare('SELECT warning_count AS n FROM users WHERE id = ?').get(t.bob.user.id).n, 1);
    const d = t.db.prepare('SELECT * FROM moderation_decisions WHERE user_id = ?').get(t.bob.user.id);
    assert.strictEqual(d.item_id, null);
    assert.strictEqual(d.action, 'warn');
    // ban 清会话
    await t.request('POST', '/api/admin/penalties', { userId: t.bob.user.id, action: 'ban' }, { cookie: t.admin.cookie });
    assert.strictEqual(t.db.prepare('SELECT status FROM users WHERE id = ?').get(t.bob.user.id).status, 'banned');
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM sessions WHERE user_id = ?').get(t.bob.user.id).n, 0);
    // restore
    await t.request('POST', '/api/admin/penalties', { userId: t.bob.user.id, action: 'restore' }, { cookie: t.admin.cookie });
    const bob2 = t.db.prepare('SELECT * FROM users WHERE id = ?').get(t.bob.user.id);
    assert.strictEqual(bob2.status, 'active');
    assert.strictEqual(bob2.warning_count, 0);
    // 不能处罚管理员
    const self = await t.request('POST', '/api/admin/penalties', { userId: t.admin.user.id, action: 'ban' }, { cookie: t.admin.cookie });
    assert.strictEqual(self.status, 403);
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM admin_audit_log WHERE action = 'penalty'").get().n, 3);
  } finally { await t.close(); }
});

test('admin：工单队列 reply（queued→in_progress + 回复 + 审计）与 close（关闭后拒绝回复）', async () => {
  const t = await adminT();
  try {
    const tk = await (await t.request('POST', '/api/tickets', {
      category: 'payment', type: 'refund', contact: 'bob@x.com',
      subject: '重复扣费', description: '被扣了两次', locale: 'zh', submittedAt: new Date().toISOString()
    })).json();
    assert.match(tk.id, /^MN-\d{4}-\d{6}$/);
    assert.strictEqual(t.db.prepare('SELECT priority FROM tickets WHERE id = ?').get(tk.id).priority, 'urgent'); // payment 自动紧急（P5 响应形状无 priority 字段）
    const list = (await (await t.request('GET', '/api/admin/tickets?status=queued', undefined, { cookie: t.admin.cookie })).json()).tickets;
    assert.ok(list.some(x => x.id === tk.id));
    const rep = await t.request('POST', `/api/admin/tickets/${tk.id}/reply`, { content: '已核查，将尽快处理' }, { cookie: t.admin.cookie });
    assert.strictEqual(rep.status, 200);
    const tk2 = (await rep.json()).ticket;
    assert.strictEqual(tk2.status, 'in_progress');
    assert.strictEqual(tk2.replies.length, 1);
    assert.strictEqual(tk2.replies[0].authorType, 'admin');
    assert.strictEqual(tk2.replies[0].authorRef, 'admin@x.com');
    const close = await t.request('POST', `/api/admin/tickets/${tk.id}/close`, {}, { cookie: t.admin.cookie });
    assert.strictEqual((await close.json()).ticket.status, 'closed');
    assert.strictEqual((await t.request('POST', `/api/admin/tickets/${tk.id}/reply`, { content: 'x' }, { cookie: t.admin.cookie })).status, 409);
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM admin_audit_log WHERE action = 'ticket_reply'").get().n, 2);
  } finally { await t.close(); }
});

test('admin：徽章签发（码形 10 位排除 0O1IL + verify 交叉验证 + 吊销后 404）', async () => {
  const t = await adminT();
  try {
    const r = await t.request('POST', '/api/admin/badge/issue', { alias: '客服小雨', role: '客服', duties: '账号安全核查' }, { cookie: t.admin.cookie });
    assert.strictEqual(r.status, 200);
    const b = await r.json();
    assert.match(b.code, /^[A-HJ-NP-Z2-9]{10}$/);
    const ttl = (new Date(b.expiresAt) - new Date(b.issuedAt)) / 3600e3;
    assert.ok(Math.abs(ttl - 12) < 0.01);
    // verify 端点交叉验证（P5 契约）
    const v = await (await t.request('POST', '/api/badge/verify', { code: b.code })).json();
    assert.strictEqual(v.status, 'valid');
    assert.strictEqual(v.alias, '客服小雨');
    // list 含之；吊销后 verify 404 + list 不含
    assert.ok((await (await t.request('GET', '/api/admin/badge/list', undefined, { cookie: t.admin.cookie })).json()).badges.some(x => x.code === b.code));
    await t.request('POST', `/api/admin/badge/${b.code}/revoke`, {}, { cookie: t.admin.cookie });
    assert.strictEqual((await t.request('POST', '/api/badge/verify', { code: b.code })).status, 404);
    assert.ok(!(await (await t.request('GET', '/api/admin/badge/list', undefined, { cookie: t.admin.cookie })).json()).badges.some(x => x.code === b.code));
    // 校验 400
    assert.strictEqual((await t.request('POST', '/api/admin/badge/issue', { alias: '' }, { cookie: t.admin.cookie })).status, 400);
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM admin_audit_log WHERE action IN ('badge_issue','badge_revoke')").get().n, 2);
  } finally { await t.close(); }
});

test('admin：用户搜索 + tier PATCH（一期唯一支付路径 + set_tier 审计）+ 详情含处罚时间线', async () => {
  const t = await adminT();
  try {
    const found = (await (await t.request('GET', '/api/admin/users?q=alice%40x.com', undefined, { cookie: t.admin.cookie })).json()).users;
    assert.strictEqual(found.length, 1);
    assert.strictEqual(found[0].displayName, 'Alice');
    assert.strictEqual(found[0].tier, 'basic');
    const patch = await t.request('PATCH', `/api/admin/users/${t.alice.user.id}`, { tier: 'premium' }, { cookie: t.admin.cookie });
    assert.strictEqual(patch.status, 200);
    assert.strictEqual(t.db.prepare('SELECT tier FROM users WHERE id = ?').get(t.alice.user.id).tier, 'premium');
    assert.strictEqual((await t.request('PATCH', `/api/admin/users/${t.alice.user.id}`, { tier: 'vip' }, { cookie: t.admin.cookie })).status, 400);
    const a = t.db.prepare("SELECT * FROM admin_audit_log WHERE action = 'set_tier'").get();
    assert.strictEqual(a.target, t.alice.user.id);
    assert.strictEqual(JSON.parse(a.detail).to, 'premium');
    // 订阅收入（一期无支付：实际收款 0，预计月收入 = tier 月价 × 数量）
    const s = await (await t.request('GET', '/api/admin/stats', undefined, { cookie: t.admin.cookie })).json();
    assert.deepStrictEqual(s.sub.tiers, { basic: 2, premium: 1, ultra: 0 });
    assert.strictEqual(s.sub.subscribers, 1);
    assert.strictEqual(s.sub.pricing.currency, 'RM');
    assert.strictEqual(s.sub.pricing.monthly.ultra, 45.5);
    assert.strictEqual(s.sub.revenue.paidMicro, 0);
    assert.strictEqual(s.sub.revenue.estimatedMonthly, 23.5);
    assert.strictEqual(s.sub.tierEvents[0].to, 'premium');
    assert.strictEqual(s.sub.tierEvents[0].from, 'basic');
    // 详情 + 时间线（先处罚一次再查）
    await t.request('POST', '/api/admin/penalties', { userId: t.alice.user.id, action: 'warn' }, { cookie: t.admin.cookie });
    const detail = await (await t.request('GET', `/api/admin/users/${t.alice.user.id}`, undefined, { cookie: t.admin.cookie })).json();
    assert.strictEqual(detail.user.tier, 'premium');
    assert.strictEqual(detail.decisions.length, 1);
    assert.strictEqual(detail.decisions[0].action, 'warn');
  } finally { await t.close(); }
});

test('admin：财务总览（全 MYR：税费/成本/净利/健康分档/季度预期）+ 参数读写审计', async () => {
  const t = await adminT();
  try {
    // 默认参数 fx 0.6（¥→RM 折算 AI 账单）/ 税率 8% / 固定成本 RM50 / 季度目标 0；全 basic → 无收入 → 危险
    let s = await (await t.request('GET', '/api/admin/stats', undefined, { cookie: t.admin.cookie })).json();
    assert.strictEqual(s.finance.health.state, 'danger');
    assert.strictEqual(s.finance.estRevenueRM, 0);
    assert.strictEqual(s.finance.totalCostRM, 50);
    assert.strictEqual(s.finance.taxRM, 0);
    assert.strictEqual(s.finance.netProfitRM, -50);
    assert.strictEqual(s.finance.health.quarter.pct, null);
    assert.strictEqual(s.finance.series[s.finance.series.length - 1].rev, 0); // 曲线末点 = 当前数字
    // alice → premium：RM23.5；税 1.88；成本 50 → 覆盖率 0.47 → 危险
    await t.request('PATCH', `/api/admin/users/${t.alice.user.id}`, { tier: 'premium' }, { cookie: t.admin.cookie });
    s = await (await t.request('GET', '/api/admin/stats', undefined, { cookie: t.admin.cookie })).json();
    assert.strictEqual(s.finance.estRevenueRM, 23.5);
    assert.strictEqual(s.finance.taxRM, 1.88);
    assert.strictEqual(s.finance.netProfitRM, -28.38);
    assert.strictEqual(s.finance.health.coverage, 0.47);
    assert.strictEqual(s.finance.health.state, 'danger');
    assert.strictEqual(s.finance.health.growth7d, 1);
    // 调参：固定成本 20 / 税率 10% / 季度目标 200 → RM23.5 覆盖 1.18 → 健康；季度 70.5/200 → 未达 35%
    const put = await t.request('PUT', '/api/admin/finance', { fixedMonthly: 20, quarterTarget: 200, taxRate: 0.1 }, { cookie: t.admin.cookie });
    assert.strictEqual(put.status, 200);
    s = await (await t.request('GET', '/api/admin/stats', undefined, { cookie: t.admin.cookie })).json();
    // 参数调整进时间线：paramEvents 含本次修改（谁/何时/从什么改成什么）
    assert.strictEqual(s.finance.paramEvents.length, 1);
    assert.strictEqual(s.finance.paramEvents[0].actor, 'admin@x.com');
    assert.strictEqual(s.finance.paramEvents[0].to.taxRate, 0.1);
    assert.strictEqual(s.finance.paramEvents[0].from.taxRate, 0.08);
    assert.strictEqual(s.finance.paramEvents[0].to.fixedMonthly, 20);
    assert.strictEqual(s.finance.paramEvents[0].from.fixedMonthly, 50);
    assert.strictEqual(s.finance.paramEvents[0].from.quarterTarget, 0);
    assert.strictEqual(s.finance.estRevenueRM, 23.5);
    assert.strictEqual(s.finance.taxRM, 2.35);
    assert.strictEqual(s.finance.netProfitRM, 1.15);
    assert.strictEqual(s.finance.health.coverage, 1.18);
    assert.strictEqual(s.finance.health.state, 'ok');
    assert.strictEqual(s.finance.health.quarter.pct, 35);
    assert.strictEqual(s.finance.health.quarter.met, false);
    // bob → ultra：RM69；覆盖 3.45 + 增长 → 最佳；季度 207/200 → 符合 103%
    await t.request('PATCH', `/api/admin/users/${t.bob.user.id}`, { tier: 'ultra' }, { cookie: t.admin.cookie });
    s = await (await t.request('GET', '/api/admin/stats', undefined, { cookie: t.admin.cookie })).json();
    assert.strictEqual(s.finance.estRevenueRM, 69);
    assert.strictEqual(s.finance.taxRM, 6.9);
    assert.strictEqual(s.finance.netProfitRM, 42.1);
    assert.strictEqual(s.finance.health.coverage, 3.45);
    assert.strictEqual(s.finance.health.state, 'best');
    assert.strictEqual(s.finance.health.growth7d, 2);
    assert.strictEqual(s.finance.health.quarter.pct, 103); // 207/200 浮点 = 103.4999… → round 103
    assert.strictEqual(s.finance.health.quarter.met, true);
    const sl = s.finance.series[s.finance.series.length - 1];
    assert.strictEqual(sl.rev, s.finance.estRevenueRM);
    assert.strictEqual(sl.tax, s.finance.taxRM);
    assert.strictEqual(sl.cost, s.finance.totalCostRM);
    assert.strictEqual(sl.net, s.finance.netProfitRM);
    assert.strictEqual(sl.paid, 0);
    // 校验 + 审计
    assert.strictEqual((await t.request('PUT', '/api/admin/finance', { fx: 0.005 }, { cookie: t.admin.cookie })).status, 400);
    assert.strictEqual((await t.request('PUT', '/api/admin/finance', {}, { cookie: t.admin.cookie })).status, 400);
    const a = t.db.prepare("SELECT * FROM admin_audit_log WHERE action = 'finance_set'").get();
    const ad = JSON.parse(a.detail);
    assert.strictEqual(ad.to.taxRate, 0.1);
    assert.strictEqual(ad.to.fixedMonthly, 20);
    assert.strictEqual(ad.from.taxRate, 0.08); // 从未设过 → 改前值回退默认
    assert.strictEqual(ad.from.fixedMonthly, 50);
    assert.strictEqual(t.db.prepare("SELECT value FROM kv WHERE key = 'finance.quarterTarget'").get().value, '200');
    assert.strictEqual(t.db.prepare("SELECT value FROM kv WHERE key = 'finance.fixedMonthly'").get().value, '20');
  } finally { await t.close(); }
});

test('admin：财务曲线序列（审计重放：跨天 tier/finance 事件 + 当月 AI 实账累计 + 末点对齐）', async () => {
  const t = await adminT();
  try {
    const ago = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
    // 3 天前 alice → premium；2 天前 taxRate 0.1；1 天前 bob → ultra + chat 实账 ¥0.20
    t.db.prepare("INSERT INTO admin_audit_log (admin_id, action, target, detail, created_at) VALUES (?, 'set_tier', ?, ?, ?)")
      .run(t.admin.user.id, t.alice.user.id, JSON.stringify({ from: 'basic', to: 'premium' }), ago(72));
    t.db.prepare("INSERT INTO admin_audit_log (admin_id, action, target, detail, created_at) VALUES (?, 'finance_set', 'finance', ?, ?)")
      .run(t.admin.user.id, JSON.stringify({ taxRate: 0.1 }), ago(48));
    t.db.prepare("INSERT INTO admin_audit_log (admin_id, action, target, detail, created_at) VALUES (?, 'set_tier', ?, ?, ?)")
      .run(t.admin.user.id, t.bob.user.id, JSON.stringify({ from: 'basic', to: 'ultra' }), ago(24));
    t.db.prepare("INSERT INTO usage_log (feature, price_snapshot, cost_micro, created_at) VALUES ('chat', '{}', 200000, ?)").run(ago(24));
    // 合成事件绕过 API → 同步当前态（users.tier / kv），使「当前数字 = 曲线末点」成立
    t.db.prepare("UPDATE users SET tier = 'premium' WHERE id = ?").run(t.alice.user.id);
    t.db.prepare("UPDATE users SET tier = 'ultra' WHERE id = ?").run(t.bob.user.id);
    t.db.prepare("INSERT INTO kv (key, value, updated_at) VALUES ('finance.taxRate', '0.1', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").run(ago(48));
    const s = await (await t.request('GET', '/api/admin/stats', undefined, { cookie: t.admin.cookie })).json();
    const se = s.finance.series;
    assert.ok(Array.isArray(se) && se.length >= 4, '跨 4 天');
    const byDay = Object.fromEntries(se.map((p) => [p.d, p]));
    const days = se.map((p) => p.d);
    assert.strictEqual(byDay[days[0]].rev, 23.5); // 首日：alice premium 生效
    assert.strictEqual(byDay[days[1]].rev, 23.5);
    assert.strictEqual(byDay[days[1]].tax, 2.35); // 次日：taxRate 0.1 生效
    assert.strictEqual(byDay[days[1]].cost, 50); // 次日：usage 未发生
    assert.strictEqual(byDay[days[2]].rev, 69); // 第三日：bob ultra 生效
    // 第三日成本 = 50 + 当日实账 ¥0.20 × fx 0.6（跨月边界时 usage 计入上月则不加）
    const usageDay = ago(24).slice(0, 10);
    const inMonth = usageDay.slice(0, 7) === days[days.length - 1].slice(0, 7);
    const mtd = inMonth ? 0.2 * 0.6 : 0;
    assert.strictEqual(byDay[usageDay].cost, Math.round((50 + mtd) * 100) / 100);
    const last = se[se.length - 1];
    assert.strictEqual(last.rev, s.finance.estRevenueRM);
    assert.strictEqual(last.tax, s.finance.taxRM);
    assert.strictEqual(last.cost, s.finance.totalCostRM);
    assert.strictEqual(last.net, s.finance.netProfitRM);
    assert.strictEqual(last.paid, 0);
  } finally { await t.close(); }
});

test('admin：流水账（CRUD/实账统计/CSV/月结锁定/审计）', async () => {
  const t = await adminT();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const led = (body) => t.request('POST', '/api/admin/ledger', body, { cookie: t.admin.cookie });
    const stats = async () => (await (await t.request('GET', '/api/admin/stats', undefined, { cookie: t.admin.cookie })).json());
    const fin = async () => (await stats()).finance;
    // 权限矩阵
    assert.strictEqual((await t.request('GET', '/api/admin/ledger')).status, 401);
    assert.strictEqual((await t.request('GET', '/api/admin/ledger', undefined, { cookie: t.alice.cookie })).status, 403);
    // 收款 RM50 → 实账 50
    const inc = await led({ kind: 'income', category: 'subscription', amount: 50, currency: 'RM', occurred_at: today, counterparty: 'alice@x.com', invoice: 'INV-1', note: '测试收款' });
    assert.strictEqual(inc.status, 200);
    const incId = (await inc.json()).id;
    assert.match(incId, /^LED-\d{6}$/);
    assert.strictEqual((await fin()).paidRM, 50);
    assert.strictEqual((await stats()).sub.revenue.paidMicro, 50000000);
    // 退款 RM10 冲减 → 40
    const ref = await led({ kind: 'refund', category: 'subscription', amount: 10, currency: 'RM', occurred_at: today });
    assert.strictEqual(ref.status, 200);
    assert.strictEqual((await fin()).paidRM, 40);
    // 支出 ¥100 × fx0.6 → expenseRM 60，不动收款
    await led({ kind: 'expense', category: 'server', amount: 100, currency: 'CNY', occurred_at: today });
    assert.strictEqual((await fin()).paidRM, 40);
    assert.strictEqual((await fin()).expenseRM, 60);
    // 曲线序列末点 paid = 流水实账
    let s = (await (await t.request('GET', '/api/admin/stats', undefined, { cookie: t.admin.cookie })).json()).finance;
    const last = s.series[s.series.length - 1];
    assert.strictEqual(last.d, today);
    assert.strictEqual(last.paid, 40);
    // 列表含行 + 录入人
    const list = await (await t.request('GET', '/api/admin/ledger', undefined, { cookie: t.admin.cookie })).json();
    assert.strictEqual(list.rows.length, 3);
    assert.strictEqual(list.rows[0].by, 'admin@x.com'); // 按 occurred_at DESC, seq DESC → 最后录入的支出在前
    assert.strictEqual(list.rows[0].kind, 'expense');
    assert.strictEqual(list.locked, null);
    // 编辑：收款 50 → 60
    const put = await t.request('PUT', `/api/admin/ledger/${incId}`, { kind: 'income', category: 'subscription', amount: 60, currency: 'RM', occurred_at: today, counterparty: 'alice@x.com', invoice: 'INV-1' }, { cookie: t.admin.cookie });
    assert.strictEqual(put.status, 200);
    assert.strictEqual((await fin()).paidRM, 50); // 60 − 10
    // 删除退款 → 60
    const list2 = await (await t.request('GET', '/api/admin/ledger', undefined, { cookie: t.admin.cookie })).json();
    const refundRow = list2.rows.find((r) => r.kind === 'refund');
    assert.strictEqual((await t.request('DELETE', `/api/admin/ledger/${refundRow.id}`, undefined, { cookie: t.admin.cookie })).status, 200);
    assert.strictEqual((await fin()).paidRM, 60);
    // 校验矩阵
    assert.strictEqual((await led({ kind: 'steal', category: 'other', amount: 1, currency: 'RM', occurred_at: today })).status, 400);
    assert.strictEqual((await led({ kind: 'income', category: 'weapons', amount: 1, currency: 'RM', occurred_at: today })).status, 400);
    assert.strictEqual((await led({ kind: 'income', category: 'other', amount: 0, currency: 'RM', occurred_at: today })).status, 400);
    assert.strictEqual((await led({ kind: 'income', category: 'other', amount: -5, currency: 'RM', occurred_at: today })).status, 400);
    assert.strictEqual((await led({ kind: 'income', category: 'other', amount: 1, currency: 'USD', occurred_at: today })).status, 400);
    assert.strictEqual((await led({ kind: 'income', category: 'other', amount: 1, currency: 'RM', occurred_at: '2026/08/01' })).status, 400);
    assert.strictEqual((await t.request('PUT', '/api/admin/ledger/LED-999999', { kind: 'income', category: 'other', amount: 1, currency: 'RM', occurred_at: today }, { cookie: t.admin.cookie })).status, 404);
    assert.strictEqual((await t.request('DELETE', '/api/admin/ledger/LED-999999', undefined, { cookie: t.admin.cookie })).status, 404);
    // CSV 导出：BOM + 中文表头 + 行数据（fetch .text() 会剥 BOM → 直接查原始字节）
    const buf = Buffer.from(await (await t.request('GET', '/api/admin/ledger/export', undefined, { cookie: t.admin.cookie })).arrayBuffer());
    assert.deepStrictEqual([buf[0], buf[1], buf[2]], [0xef, 0xbb, 0xbf]); // Excel BOM
    const csv = buf.toString('utf8');
    assert.ok(csv.includes('流水号,日期,类型,分类,金额,币种'));
    assert.ok(csv.includes(incId) && csv.includes('INV-1'));
    assert.ok(csv.includes('收款') && csv.includes('支出'));
    // 月结锁定：当前月 → 之后一切写操作 403；只可向更晚推进
    const close = await t.request('POST', '/api/admin/ledger/close', { month }, { cookie: t.admin.cookie });
    assert.strictEqual(close.status, 200);
    assert.strictEqual((await close.json()).locked, month);
    assert.strictEqual((await (await t.request('GET', '/api/admin/ledger', undefined, { cookie: t.admin.cookie })).json()).locked, month);
    assert.strictEqual((await led({ kind: 'income', category: 'other', amount: 1, currency: 'RM', occurred_at: today })).status, 403);
    assert.strictEqual((await t.request('PUT', `/api/admin/ledger/${incId}`, { kind: 'income', category: 'subscription', amount: 70, currency: 'RM', occurred_at: today }, { cookie: t.admin.cookie })).status, 403);
    assert.strictEqual((await t.request('DELETE', `/api/admin/ledger/${incId}`, undefined, { cookie: t.admin.cookie })).status, 403);
    assert.strictEqual((await t.request('POST', '/api/admin/ledger/close', { month: '2019-01' }, { cookie: t.admin.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/admin/ledger/close', { month: '2026-8' }, { cookie: t.admin.cookie })).status, 400);
    // 审计四动作
    const acts = t.db.prepare('SELECT action, COUNT(*) AS n FROM admin_audit_log WHERE action LIKE ? GROUP BY action').all('ledger_%');
    const byAct = Object.fromEntries(acts.map((r) => [r.action, r.n]));
    assert.strictEqual(byAct.ledger_add, 3); // 收款/退款/支出；校验 400 与锁定 403 不入审计
    assert.ok(byAct.ledger_edit >= 1 && byAct.ledger_delete >= 1 && byAct.ledger_close >= 1);
    const addA = t.db.prepare("SELECT * FROM admin_audit_log WHERE action = 'ledger_add' ORDER BY seq LIMIT 1").get();
    assert.strictEqual(JSON.parse(addA.detail).invoice, 'INV-1');
  } finally { await t.close(); }
});

test('admin：季度财报（一键生成：分月聚合/审计重放月末参数/月结状态/上季对比/CSV/审计）', async () => {
  const t = await adminT();
  try {
    const now = new Date();
    const y = now.getUTCFullYear(), q = Math.floor(now.getUTCMonth() / 3) + 1;
    const m1 = (q - 1) * 3 + 1, m2 = m1 + 1;
    const pq = q === 1 ? 4 : q - 1, py = q === 1 ? y - 1 : y, pm1 = (pq - 1) * 3 + 1;
    const pad = (n) => String(n).padStart(2, '0');
    const day = (yy, m, dd) => yy + '-' + pad(m) + '-' + pad(dd);
    const led = (body) => t.request('POST', '/api/admin/ledger', body, { cookie: t.admin.cookie });
    const rep = async (qs) => (await (await t.request('GET', '/api/admin/finance/report' + (qs || ''), undefined, { cookie: t.admin.cookie })).json());
    // 权限矩阵
    assert.strictEqual((await t.request('GET', '/api/admin/finance/report')).status, 401);
    assert.strictEqual((await t.request('GET', '/api/admin/finance/report', undefined, { cookie: t.alice.cookie })).status, 403);
    // 流水：本季 M1 收款 RM100 − 退款 RM20；M2 支出 ¥50；上季 M1 收款 RM10
    assert.strictEqual((await led({ kind: 'income', category: 'subscription', amount: 100, currency: 'RM', occurred_at: day(y, m1, 5) })).status, 200);
    assert.strictEqual((await led({ kind: 'refund', category: 'subscription', amount: 20, currency: 'RM', occurred_at: day(y, m1, 5) })).status, 200);
    assert.strictEqual((await led({ kind: 'expense', category: 'server', amount: 50, currency: 'CNY', occurred_at: day(y, m2, 3) })).status, 200);
    assert.strictEqual((await led({ kind: 'income', category: 'subscription', amount: 10, currency: 'RM', occurred_at: day(py, pm1, 2) })).status, 200);
    // 历史用量（M2 0.3 元）+ 历史 finance_set 事件（M1 8 日 fx 0.6→0.5，M1 月末快照 = 0.5）
    t.db.prepare("INSERT INTO usage_log (feature, price_snapshot, cost_micro, created_at) VALUES ('chat', '{}', 300000, ?)").run(day(y, m2, 10) + 'T04:00:00.000Z');
    const adminId = t.db.prepare("SELECT id FROM users WHERE email = 'admin@x.com'").get().id;
    t.db.prepare("INSERT INTO admin_audit_log (admin_id, action, target, detail, created_at) VALUES (?, 'finance_set', 'finance', ?, ?)")
      .run(adminId, JSON.stringify({ from: { fx: 0.6 }, to: { fx: 0.5 } }), day(y, m1, 8) + 'T04:00:00.000Z');
    // 无参 = 当前季度；分月口径（月末快照 fx 0.5 折 ¥）
    const r1 = await rep();
    assert.strictEqual(r1.quarter, y + '-Q' + q);
    assert.strictEqual(r1.months.length, 3);
    assert.strictEqual(r1.generatedBy, 'admin@x.com');
    assert.deepStrictEqual(r1.unclosed, r1.months);
    const mo1 = r1.monthly[0], mo2 = r1.monthly[1], mo3 = r1.monthly[2];
    assert.strictEqual(mo1.fx, 0.5); // 重放吸收 8 日事件
    assert.strictEqual(mo1.income, 100);
    assert.strictEqual(mo1.refund, 20);
    assert.strictEqual(mo1.paid, 80);
    assert.strictEqual(mo2.expense, 25); // ¥50 × 0.5
    assert.strictEqual(mo2.ai, 0.15);   // 0.3 元 × 0.5
    assert.strictEqual(mo2.fixed, 50);
    assert.strictEqual(mo2.net, -75.15);
    assert.strictEqual(mo3.net, -50);   // 无流水月份只剩固定成本
    assert.strictEqual(r1.totals.paid, 80);
    assert.strictEqual(r1.totals.expense, 25);
    assert.strictEqual(r1.totals.ai, 0.15);
    assert.strictEqual(r1.totals.fixed, 150);
    assert.strictEqual(r1.totals.net, -95.15);
    assert.strictEqual(r1.gap, -80);    // 预计 0 − 实收 80
    assert.deepStrictEqual(r1.byCategory, [{ category: 'server', amount: 25 }]);
    // 上季对比（重放口径独立：上季末 fx 仍为默认 0.6，事件在上季之后）
    assert.strictEqual(r1.prev.quarter, py + '-Q' + pq);
    assert.strictEqual(r1.prev.totals.paid, 10);
    assert.strictEqual(r1.prev.totals.net, -140); // 10 − 固定 150
    // 月结锁定 M1 → 月结状态与未月结列表联动
    assert.strictEqual((await t.request('POST', '/api/admin/ledger/close', { month: day(y, m1, 5).slice(0, 7) }, { cookie: t.admin.cookie })).status, 200);
    const r2 = await rep();
    assert.strictEqual(r2.monthly[0].locked, true);
    assert.strictEqual(r2.monthly[1].locked, false);
    assert.deepStrictEqual(r2.unclosed, [r2.months[1], r2.months[2]]);
    // 季度目标：PUT 1000 → 实收达成 8%
    assert.strictEqual((await t.request('PUT', '/api/admin/finance', { quarterTarget: 1000 }, { cookie: t.admin.cookie })).status, 200);
    const r3 = await rep();
    assert.strictEqual(r3.target, 1000);
    assert.strictEqual(r3.targetPaidPct, 8);
    // CSV：BOM + 分节表头 + 分类中文 + 合计
    const buf = Buffer.from(await (await t.request('GET', '/api/admin/finance/report/export', undefined, { cookie: t.admin.cookie })).arrayBuffer());
    assert.deepStrictEqual([buf[0], buf[1], buf[2]], [0xef, 0xbb, 0xbf]);
    const csv = buf.toString('utf8');
    assert.ok(csv.includes('M.NationWorld 季度财报'));
    assert.ok(csv.includes('月份,月结,预计收入(RM)'));
    assert.ok(csv.includes('支出分类汇总') && csv.includes('服务器'));
    assert.ok(csv.includes('合计'));
    // 参数校验 + 审计（每次生成落 ledger_report）
    assert.strictEqual((await t.request('GET', '/api/admin/finance/report?year=1999&quarter=1', undefined, { cookie: t.admin.cookie })).status, 400);
    assert.strictEqual((await t.request('GET', '/api/admin/finance/report?year=2026&quarter=5', undefined, { cookie: t.admin.cookie })).status, 400);
    assert.strictEqual((await t.request('GET', '/api/admin/finance/report?year=2026', undefined, { cookie: t.admin.cookie })).status, 400);
    const rp = t.db.prepare("SELECT * FROM admin_audit_log WHERE action = 'ledger_report'").all();
    assert.ok(rp.length >= 3);
    assert.strictEqual(rp[0].target, y + '-Q' + q);
    assert.deepStrictEqual(JSON.parse(rp[0].detail), { year: y, quarter: q });
  } finally { await t.close(); }
});

test('admin：成本看板 usage（分功能 + recent）+ budget 读写（kv + 审计 + 校验）', async () => {
  const t = await adminT();
  try {
    // 制造一条 zero-cost chat 行（FAQ 命中），供 recent 断言
    await t.request('POST', '/api/chat', { sessionId: 'adm-1', locale: 'zh', messages: [{ role: 'user', content: '你们有哪些订阅套餐？价格多少钱？' }] });
    const u = await (await t.request('GET', '/api/admin/usage', undefined, { cookie: t.admin.cookie })).json();
    for (const f of ['moderation_text', 'chat', 'moderation_image']) {
      assert.ok(f in u.byFeature && typeof u.byFeature[f].limit === 'number', f + ' 有限额');
    }
    assert.ok(u.recent.length >= 1 && u.recent[0].feature === 'chat_faq_hit');
    assert.strictEqual(u.recent[0].costMicro, 0);
    // budget 读写
    const g = await (await t.request('GET', '/api/admin/budget', undefined, { cookie: t.admin.cookie })).json();
    assert.strictEqual(g.limits.chat, 20); // 默认
    const put = await t.request('PUT', '/api/admin/budget', { feature: 'chat', yuan: 25 }, { cookie: t.admin.cookie });
    assert.strictEqual(put.status, 200);
    assert.strictEqual(t.db.prepare("SELECT value FROM kv WHERE key = 'budget.chat'").get().value, '25');
    assert.strictEqual((await t.request('PUT', '/api/admin/budget', { feature: 'nope', yuan: 1 }, { cookie: t.admin.cookie })).status, 400);
    assert.strictEqual((await t.request('PUT', '/api/admin/budget', { feature: 'chat', yuan: -1 }, { cookie: t.admin.cookie })).status, 400);
    const a = t.db.prepare("SELECT * FROM admin_audit_log WHERE action = 'budget_set'").get();
    assert.strictEqual(a.target, 'budget.chat');
    // audit 端点
    const audit = (await (await t.request('GET', '/api/admin/audit', undefined, { cookie: t.admin.cookie })).json()).audit;
    assert.ok(audit.length >= 1 && audit[0].action === 'budget_set');
  } finally { await t.close(); }
});
