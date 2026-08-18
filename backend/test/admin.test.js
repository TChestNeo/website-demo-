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
