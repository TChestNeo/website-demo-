'use strict';
// SlatiControl 分析（§2）：GET /api/staff/analytics/:domain?range=…。
// 断言口径：全部读时聚合（D9）——种子数据反推 + range 窗口边界 + daily 日桶补零 + custom 收紧 + 权限。
// finance.fx 种子 0.62：AI 成本 CNY 微元 → RM 微元按 0.62 折算。

const test = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

const DAY = 86400e3;
const HOUR = 3600e3;

function iso(msAgo) {
  return new Date(Date.now() - msAgo).toISOString();
}
function day(n) {
  return new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
}
function insUser(db, id, email, over = {}) {
  db.prepare(`INSERT INTO users (id, email, display_name, tier, status, risk_level, country, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, email, over.name || email, over.tier || 'free', over.status || 'active', over.risk || 'low',
      over.country || null, over.createdAt, new Date().toISOString());
}
function dayBuckets(body, n) {
  assert.strictEqual(body.daily.length, n, `daily 应为 ${n} 桶`);
  assert.strictEqual(body.daily[0].date, body.from, '首桶 = 窗口首日');
  assert.strictEqual(body.daily[n - 1].date, body.to, '末桶 = 窗口末日（含首末日补零）');
  return Object.fromEntries(body.daily.map((r) => [r.date, r]));
}

test('users 域：total/newCount/active/retention/分层/日序列补零（7d 8 桶）', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginStaffAs('boss@slatiworld.local', {}, ['project_director']);
    const db = t.db;
    // u1 注册时间与留存行日期动态推导（与实现同口径 UTC 日期比较，防跨午夜漂移）
    const u1created = iso(3 * DAY - HOUR);
    const u1date = u1created.slice(0, 10);
    const retDate = new Date(Date.parse(u1created) + DAY).toISOString().slice(0, 10);
    insUser(db, 'USR-T1', 'u1@x.y', { tier: 'premium', risk: 'medium', country: 'CN', createdAt: u1created });
    insUser(db, 'USR-T2', 'u2@x.y', { country: 'CN', createdAt: iso(10 * DAY) });
    insUser(db, 'USR-T3', 'u3@x.y', { status: 'banned', risk: 'high', country: 'MY', createdAt: iso(40 * DAY) });

    // 活跃：u1/u2 今天各一条（DISTINCT → 2）；u1 注册日+1 天一条（留存 day1 命中）
    const act = db.prepare('INSERT INTO activity_daily (user_id, date, requests, last_seen_at) VALUES (?, ?, 1, ?)');
    act.run('USR-T1', day(0), iso(0));
    act.run('USR-T2', day(0), iso(0));
    act.run('USR-T1', retDate, iso(2 * DAY));

    const res = await t.request('GET', '/api/staff/analytics/users?range=7d', undefined, { cookie });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.domain, 'users');
    assert.strictEqual(body.range, '7d');
    assert.strictEqual(body.from, day(7));

    const o = body.overview;
    assert.strictEqual(o.total, 3);
    assert.strictEqual(o.newCount, 1, '窗口内注册 = u1（3d 前）');
    assert.strictEqual(o.active, 2, 'DISTINCT 活跃用户 u1/u2');
    assert.deepStrictEqual(o.retention, { day1: 1, day7: 0, day30: 0, cohort: 1 }, 'u1 注册日+1 有活跃 → day1=1');
    assert.deepStrictEqual(o.byTier, [{ tier: 'free', n: 2 }, { tier: 'premium', n: 1 }]);
    assert.deepStrictEqual(o.byStatus, [{ status: 'active', n: 2 }, { status: 'banned', n: 1 }]);
    assert.deepStrictEqual(Object.fromEntries(o.byRisk.map((r) => [r.risk, r.n])), { high: 1, medium: 1, low: 1 });
    assert.deepStrictEqual(o.byCountry, [{ country: 'CN', n: 2 }, { country: 'MY', n: 1 }]);

    const buckets = dayBuckets(body, 8);
    assert.strictEqual(buckets[u1date].signups, 1, 'u1 注册日 signups=1');
    assert.strictEqual(buckets[day(0)].active, 2, '今天活跃 u1+u2');
    assert.strictEqual(buckets[retDate].active, 1, '留存行计入当日活跃');
    assert.strictEqual(buckets[day(6)].signups + buckets[day(6)].active, 0, '无数据日补零');
  } finally {
    await t.close();
  }
});

test('range 边界：today 只含当日 / custom from-to 收紧窗口 / 非法 range 回退 30d / 非法 domain 400', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginStaffAs('boss@slatiworld.local', {}, ['project_director']);
    const db = t.db;
    const todayStr = new Date().toISOString().slice(0, 10);
    const inToday = (msAgo) => new Date(Date.now() - msAgo).toISOString().slice(0, 10) === todayStr;
    insUser(db, 'USR-T1', 'u1@x.y', { createdAt: iso(5 * 60e3) });  // 5 分钟前（期望按 UTC 日期动态算）
    insUser(db, 'USR-T2', 'u2@x.y', { createdAt: iso(25 * HOUR) }); // 25h 前

    const r1 = await t.request('GET', '/api/staff/analytics/users?range=today', undefined, { cookie });
    const b1 = await r1.json();
    assert.strictEqual(b1.overview.newCount, inToday(5 * 60e3) ? 1 : 0, 'today 只含当日注册（u1；若恰跨 UTC 午夜则 0）');

    // custom：from=2d 前 to=1d 前 → u2（25h）与 u3（47h）都在 [1d,2d] 窗内
    insUser(db, 'USR-T3', 'u3@x.y', { createdAt: iso(47 * HOUR) });
    insUser(db, 'USR-T4', 'u4@x.y', { createdAt: iso(12 * HOUR) }); // 12h 前：在 to 之后 → 排除
    const r2 = await t.request('GET', `/api/staff/analytics/users?range=custom&from=${encodeURIComponent(iso(2 * DAY))}&to=${encodeURIComponent(iso(1 * DAY))}`, undefined, { cookie });
    const b2 = await r2.json();
    assert.strictEqual(b2.range, 'custom');
    assert.strictEqual(b2.overview.newCount, 2, 'custom to 上界收紧（u4 排除；u2/u3 命中）');
    assert.strictEqual(b2.daily.length, 2, 'custom 两日窗口 = 2 桶');

    const r3 = await t.request('GET', '/api/staff/analytics/users?range=bogus', undefined, { cookie });
    const b3 = await r3.json();
    assert.strictEqual(b3.range, '30d', '非法 range 回退 30d');

    const r4 = await t.request('GET', '/api/staff/analytics/bogus', undefined, { cookie });
    assert.strictEqual(r4.status, 400);
    assert.strictEqual((await r4.json()).error.code, 'VALIDATION');
  } finally {
    await t.close();
  }
});

test('analytics 权限：无角色 staff → 403；无会话 → 401', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginStaffAs('ghost@slatiworld.local', {}, []);
    await t.assertDenied(await t.request('GET', '/api/staff/analytics/users', undefined, { cookie }));
    const anon = await t.request('GET', '/api/staff/analytics/users');
    assert.strictEqual(anon.status, 401);
  } finally {
    await t.close();
  }
});

test('content 域：窗口帖数/待审/判罚/举报/文章 + 日序列', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginStaffAs('boss@slatiworld.local', {}, ['project_director']);
    const db = t.db;
    insUser(db, 'USR-T1', 'u1@x.y', { createdAt: iso(1 * DAY) });
    const po = db.prepare('INSERT INTO posts (id, author_id, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    po.run('PST-1', 'USR-T1', 'a', 'visible', iso(1 * DAY), iso(1 * DAY));
    po.run('PST-2', 'USR-T1', 'b', 'pending', iso(2 * DAY), iso(2 * DAY));
    po.run('PST-3', 'USR-T1', 'c', 'visible', iso(40 * DAY), iso(40 * DAY)); // 窗口外
    db.prepare("INSERT INTO moderation_items (id, kind, target_type, target_id, content_hash, status, created_at) VALUES ('MOD-1', 'text', 'post', 'PST-1', 'h1', 'queued', ?), ('MOD-2', 'text', 'post', 'PST-2', 'h2', 'ai_approved', ?)").run(iso(1 * DAY), iso(1 * DAY));
    db.prepare("INSERT INTO moderation_decisions (user_id, action, actor_type, created_at) VALUES ('USR-T1', 'remove_content', 'staff', ?), ('USR-T1', 'warn', 'staff', ?)").run(iso(1 * DAY), iso(40 * DAY));
    db.prepare("INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, created_at) VALUES ('RPT-1', 'USR-T1', 'post', 'PST-1', 'spam', 'open', ?), ('RPT-2', 'USR-T1', 'post', 'PST-2', 'x', 'resolved', ?)").run(iso(1 * DAY), iso(1 * DAY));
    db.prepare("INSERT INTO articles (id, author_id, title, content_json, created_at, updated_at) VALUES ('ART-1', 'USR-T1', 't', '{}', ?, ?), ('ART-2', 'USR-T1', 't2', '{}', ?, ?)").run(iso(1 * DAY), iso(1 * DAY), iso(40 * DAY), iso(40 * DAY));

    const body = await (await t.request('GET', '/api/staff/analytics/content?range=7d', undefined, { cookie })).json();
    assert.strictEqual(body.overview.posts, 2, '窗口内 2 帖');
    assert.deepStrictEqual(body.overview.byStatus, [{ status: 'pending', n: 1 }, { status: 'visible', n: 1 }]);
    assert.strictEqual(body.overview.pendingModeration, 1, 'queued 1 条（ai_approved 不计）');
    assert.deepStrictEqual(body.overview.decisions, [{ action: 'remove_content', n: 1 }], '窗口内判罚');
    assert.strictEqual(body.overview.openReports, 1);
    assert.strictEqual(body.overview.articles, 1);
    const buckets = dayBuckets(body, 8);
    assert.strictEqual(buckets[day(1)].posts, 1);
    assert.strictEqual(buckets[day(2)].posts, 1);
    assert.strictEqual(buckets[day(1)].removed, 1);
    assert.strictEqual(buckets[day(1)].reports, 2, '当日举报流水两条（open+resolved 都计入日序列）');
  } finally {
    await t.close();
  }
});

test('community 域：国家/团队/话题/关注/会话/评论/点赞/私信 + 日序列', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginStaffAs('boss@slatiworld.local', {}, ['project_director']);
    const db = t.db;
    insUser(db, 'USR-T1', 'u1@x.y', { createdAt: iso(1 * DAY) });
    insUser(db, 'USR-T2', 'u2@x.y', { createdAt: iso(1 * DAY) });
    const nowIso = iso(0);
    db.prepare("INSERT INTO nations (id, owner_id, data, created_at, updated_at) VALUES ('NAT-1', 'USR-T1', '{}', ?, ?), ('NAT-2', 'USR-T2', '{}', ?, ?)").run(nowIso, nowIso, nowIso, nowIso);
    db.prepare("INSERT INTO teams (id, data, created_at) VALUES ('TEAM-1', '{}', ?)").run(nowIso);
    db.prepare("INSERT INTO topics (id, creator_id, data, created_at, updated_at) VALUES ('TOP-1', 'USR-T1', '{}', ?, ?)").run(nowIso, nowIso);
    db.prepare("INSERT INTO following (user_id, target_type, target_id, created_at) VALUES ('USR-T1', 'user', 'USR-T2', ?), ('USR-T2', 'nation', 'NAT-1', ?)").run(nowIso, nowIso);
    db.prepare("INSERT INTO conversations (id, kind, created_at) VALUES ('CONV-1', 'dm', ?)").run(nowIso);
    db.prepare("INSERT INTO posts (id, author_id, content, created_at, updated_at) VALUES ('PST-1', 'USR-T1', 'a', ?, ?)").run(nowIso, nowIso);
    db.prepare("INSERT INTO comments (id, post_id, author_id, content, created_at) VALUES ('CMT-1', 'PST-1', 'USR-T2', 'c', ?), ('CMT-2', 'PST-1', 'USR-T2', 'c2', ?)").run(iso(1 * DAY), iso(40 * DAY));
    db.prepare("INSERT INTO content_likes (user_id, target_type, target_id, created_at) VALUES ('USR-T1', 'post', 'PST-1', ?), ('USR-T2', 'post', 'PST-1', ?), ('USR-T1', 'article', 'ART-9', ?)").run(nowIso, nowIso, nowIso);
    db.prepare("INSERT INTO messages (id, conversation_id, sender_id, content, created_at) VALUES ('MSG-1', 'CONV-1', 'USR-T1', 'hi', ?), ('MSG-2', 'CONV-1', 'USR-T1', 'old', ?)").run(iso(1 * DAY), iso(40 * DAY));

    const body = await (await t.request('GET', '/api/staff/analytics/community?range=7d', undefined, { cookie })).json();
    const o = body.overview;
    assert.strictEqual(o.nations, 2);
    assert.strictEqual(o.teams, 1);
    assert.strictEqual(o.topics, 1);
    assert.strictEqual(o.following, 2);
    assert.strictEqual(o.conversations, 1);
    assert.strictEqual(o.comments, 1, '窗口内评论');
    assert.strictEqual(o.likes, 2, "content_likes 只计 target_type='post'（article 点赞排除）");
    assert.strictEqual(o.messages, 1);
    const buckets = dayBuckets(body, 8);
    assert.strictEqual(buckets[day(1)].comments, 1);
    assert.strictEqual(buckets[day(1)].messages, 1);
    assert.strictEqual(buckets[day(0)].likes, 2);
  } finally {
    await t.close();
  }
});

test('traffic 域：views/clients 去重/top10 排序 + 日序列', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginStaffAs('boss@slatiworld.local', {}, ['project_director']);
    const db = t.db;
    const pv = db.prepare(`INSERT INTO page_views (id, client_id, path, country, language, device, browser, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    pv.run('PGV-1', 'c1', '/a', 'CN', 'zh', 'desktop', 'Chrome', iso(0));
    pv.run('PGV-2', 'c2', '/a', 'CN', 'en', 'desktop', 'Edge', iso(0));
    pv.run('PGV-3', 'c1', '/b', 'MY', 'ms', 'mobile', 'Safari', iso(1 * DAY));
    pv.run('PGV-4', 'c3', '/a', 'CN', 'zh', 'desktop', 'Chrome', iso(40 * DAY)); // 窗口外

    const body = await (await t.request('GET', '/api/staff/analytics/traffic?range=7d', undefined, { cookie })).json();
    assert.strictEqual(body.overview.views, 3);
    assert.strictEqual(body.overview.clients, 2, 'client_id DISTINCT');
    assert.deepStrictEqual(body.overview.byPath, [{ name: '/a', n: 2 }, { name: '/b', n: 1 }]);
    assert.deepStrictEqual(body.overview.byCountry, [{ name: 'CN', n: 2 }, { name: 'MY', n: 1 }]);
    assert.deepStrictEqual(body.overview.byDevice, [{ name: 'desktop', n: 2 }, { name: 'mobile', n: 1 }]);
    assert.deepStrictEqual(body.overview.byBrowser, [{ name: 'Chrome', n: 1 }, { name: 'Edge', n: 1 }, { name: 'Safari', n: 1 }]);
    assert.deepStrictEqual(body.overview.byLanguage, [{ name: 'en', n: 1 }, { name: 'ms', n: 1 }, { name: 'zh', n: 1 }]);
    const buckets = dayBuckets(body, 8);
    assert.strictEqual(buckets[day(0)].views, 2);
    assert.strictEqual(buckets[day(1)].views, 1);
  } finally {
    await t.close();
  }
});

test('finance 域：收入/MRR/付费用户/AI 成本折算/流水账 + 日序列', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginStaffAs('boss@slatiworld.local', {}, ['project_director']);
    const db = t.db;
    const nowIso = iso(0);
    insUser(db, 'USR-T1', 'u1@x.y', { tier: 'premium', createdAt: iso(1 * DAY) });
    insUser(db, 'USR-T2', 'u2@x.y', { tier: 'ultra', createdAt: iso(1 * DAY) });
    insUser(db, 'USR-T3', 'u3@x.y', { createdAt: iso(1 * DAY) });
    const pay = db.prepare('INSERT INTO payments (id, user_id, tier_key, amount_micro, status, created_at, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    pay.run('PAY-1', 'USR-T1', 'premium', 2000000, 'paid', nowIso, iso(1 * DAY));
    pay.run('PAY-2', 'USR-T2', 'ultra', 300000, 'refunded', nowIso, iso(1 * DAY));
    pay.run('PAY-3', 'USR-T3', 'basic', 500000, 'paid', nowIso, iso(40 * DAY)); // 窗口外
    db.prepare("INSERT INTO subscriptions (id, user_id, plan_key, tier_key, amount_micro, status, created_at, updated_at) VALUES ('SUB-1', 'USR-T1', 'premium', 'premium', 9900000, 'active', ?, ?), ('SUB-2', 'USR-T2', 'ultra', 'ultra', 100, 'canceled', ?, ?)").run(nowIso, nowIso, nowIso, nowIso);
    db.prepare("INSERT INTO usage_log (feature, price_snapshot, cost_micro, status, created_at) VALUES ('chat', '{}', 200000, 'ok', ?), ('chat', '{}', 300000, 'ok', ?)").run(iso(1 * DAY), iso(1 * DAY));
    db.prepare("INSERT INTO ledger (id, kind, category, amount, currency, occurred_at, created_at) VALUES ('LED-1', 'income', 'subscription', 1.50, 'RM', ?, ?), ('LED-2', 'expense', 'ai', 0.25, 'RM', ?, ?)").run(day(0), nowIso, day(0), nowIso);

    const body = await (await t.request('GET', '/api/staff/analytics/finance?range=7d', undefined, { cookie })).json();
    const o = body.overview;
    assert.strictEqual(o.revenueMicro, 2300000, 'paid + refunded 都在收入口径（按 paid_at）');
    assert.strictEqual(o.mrrMicro, 9900000);
    assert.strictEqual(o.activeSubs, 1);
    assert.strictEqual(o.payingUsers, 2);
    assert.strictEqual(o.aiCostMicro, 310000, '500000 CNY 微元 × 0.62（finance.fx 种子）');
    assert.strictEqual(o.ledgerIncomeMicro, 1500000);
    assert.strictEqual(o.ledgerExpenseMicro, 250000);
    const buckets = dayBuckets(body, 8);
    assert.strictEqual(buckets[day(1)].revenueMicro, 2300000);
    assert.strictEqual(buckets[day(1)].aiCostCnyMicro, 500000, 'AI 成本日序列保持 CNY 原币');
    assert.strictEqual(buckets[day(0)].revenueMicro, 0);
  } finally {
    await t.close();
  }
});
