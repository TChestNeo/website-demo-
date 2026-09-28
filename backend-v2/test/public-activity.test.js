'use strict';
// 公网活动页聚合（v0.2.58.16 动态页真实数据接入）：GET /api/public/activity。
// 口径：nations/citizens 全量总数+窗口增量趋势；newCitizens/articles/activity 窗口计数；
// trends 恒 30 天日序列；heatmap 7 完整 UTC 日×6 时段；leaderboard 零分不上榜；citizen 里程碑 title 恒 null（PII 禁令）。

const test = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

const isoAgo = (d) => new Date(Date.now() - d * 86400e3).toISOString();
const isoHoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function seedUser(t, id, createdIso) {
  t.db.prepare('INSERT INTO users (id, email, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, id + '@test.local', 'active', createdIso, createdIso);
}
function seedNation(t, id, ownerId, dataJson, createdIso, status = 'visible') {
  t.db.prepare('INSERT INTO nations (id, owner_id, data, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, ownerId, dataJson, status, createdIso, createdIso);
}

test('public-activity：30d 形状与数值全对 + 无需鉴权', async () => {
  const t = await testApp();
  try {
    // 用户：u1/u2 窗口内新公民，u3-u5 老用户（100d 前）
    seedUser(t, 'u1', isoAgo(2));
    seedUser(t, 'u2', isoAgo(4));
    for (const id of ['u3', 'u4', 'u5']) seedUser(t, id, isoAgo(100));
    // 国家：nat1 窗口内成立（🪐），nat2 老国家，nat3 hidden（排除）
    seedNation(t, 'NAT-000001', 'u1', '{"name":"Nova Terra","emoji":"🪐"}', isoAgo(1));
    seedNation(t, 'NAT-000002', 'u2', '{"name":"Königreich Aethel","emoji":"👑"}', isoAgo(100));
    seedNation(t, 'NAT-000003', 'u3', '{"name":"Hidden Land"}', isoAgo(1), 'hidden');
    // 团队今天成立（trends.teams 末位=1）
    t.db.prepare('INSERT INTO teams (id, data, created_at) VALUES (?, ?, ?)').run('team1', '{"name":"T1"}', isoHoursAgo(1));
    // 文章：2 published 窗口内 + pending + removed（排除）
    const insArt = t.db.prepare('INSERT INTO articles (id, author_id, title, content_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insArt.run('ART-000001', 'u1', 'Charter', '[]', 'published', isoHoursAgo(12), isoHoursAgo(12));
    insArt.run('ART-000002', 'u2', 'Second', '[]', 'published', isoAgo(3), isoAgo(3));
    insArt.run('ART-000003', 'u3', 'Pending', '[]', 'pending', isoAgo(1), isoAgo(1));
    insArt.run('ART-000004', 'u4', 'Removed', '[]', 'removed', isoAgo(1), isoAgo(1));
    // 帖子：3 visible + 1 removed
    const insPost = t.db.prepare('INSERT INTO posts (id, author_id, topic_id, content, status, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?)');
    insPost.run('PST-000001', 'u1', 'p1', 'visible', isoAgo(5), isoAgo(5));
    insPost.run('PST-000002', 'u2', 'p2', 'visible', isoAgo(6), isoAgo(6));
    insPost.run('PST-000003', 'u3', 'p3', 'visible', isoAgo(7), isoAgo(7));
    insPost.run('PST-000004', 'u4', 'p4', 'removed', isoAgo(5), isoAgo(5));
    // 评论：4 visible（挂 p1）
    const insCmt = t.db.prepare('INSERT INTO comments (id, post_id, author_id, content, status, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (let i = 1; i <= 4; i++) insCmt.run('CMT-00000' + i, 'PST-000001', 'u1', 'c' + i, 'visible', isoAgo(5));
    // 点赞：5 post + 2 article（后者排除）
    const insLike = t.db.prepare('INSERT INTO content_likes (user_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)');
    for (let i = 1; i <= 5; i++) insLike.run('u' + ((i % 3) + 1), 'post', 'PST-00000' + i, isoAgo(5));
    insLike.run('u1', 'article', 'ART-000001', isoAgo(5));
    insLike.run('u2', 'article', 'ART-000001', isoAgo(5));
    // 私信：2（挂 conv1）
    t.db.prepare('INSERT INTO conversations (id, created_at) VALUES (?, ?)').run('CONV-000001', isoAgo(6));
    const insMsg = t.db.prepare('INSERT INTO messages (id, conversation_id, sender_id, content, created_at) VALUES (?, ?, ?, ?, ?)');
    insMsg.run('MSG-000001', 'CONV-000001', 'u1', 'm1', isoAgo(5));
    insMsg.run('MSG-000002', 'CONV-000001', 'u2', 'm2', isoAgo(5));
    // 活跃度：nations 两个 owner 今天各 10/5 请求
    const insAd = t.db.prepare('INSERT INTO activity_daily (user_id, date, requests, last_seen_at) VALUES (?, ?, ?, ?)');
    insAd.run('u1', today(), 10, isoHoursAgo(1));
    insAd.run('u2', today(), 5, isoHoursAgo(1));

    const res = await t.request('GET', '/api/public/activity?range=30d');
    assert.strictEqual(res.status, 200, '无鉴权 200');
    const b = await res.json();
    assert.strictEqual(b.range, '30d');
    assert.ok(b.from < b.to, '窗口 from/to 有序 ISO');

    // KPI
    assert.strictEqual(b.kpi.nations.value, 2, 'visible 全量（hidden 排除）');
    assert.strictEqual(b.kpi.citizens.value, 5, 'active 全量');
    assert.strictEqual(b.kpi.newCitizens.value, 2);
    assert.strictEqual(b.kpi.articles.value, 2, 'published 窗口内（pending/removed 排除）');
    assert.strictEqual(b.kpi.activity.value, 11, '2 私信 + 4 评论 + 5 帖赞');

    // trends 恒 30 天
    for (const k of ['users', 'nations', 'articles', 'teams']) {
      assert.strictEqual(b.trends[k].length, 30);
      assert.strictEqual(b.trends[k][0].date < b.trends[k][29].date, true, k + ' 升序');
    }
    assert.strictEqual(b.trends.users.reduce((s, r) => s + r.value, 0), 2, '窗口内 2 新用户');
    assert.strictEqual(b.trends.teams[29].value, 1, '今天 1 队');

    // 内容类型
    assert.deepStrictEqual(b.contentTypes, { articles: 2, posts: 3, comments: 4, likes: 5 });

    // 排行榜（score=活动日请求和，零分不上榜）
    assert.strictEqual(b.leaderboard.length, 2);
    assert.strictEqual(b.leaderboard[0].name, 'Nova Terra');
    assert.strictEqual(b.leaderboard[0].flag, '🪐');
    assert.strictEqual(b.leaderboard[0].score, 10);
    assert.strictEqual(b.leaderboard[1].name, 'Königreich Aethel');

    // 里程碑（at DESC；citizen 匿名）
    assert.strictEqual(b.milestones.length, 5);
    assert.strictEqual(b.milestones[0].type, 'article');
    assert.strictEqual(b.milestones[0].title, 'Charter');
    assert.strictEqual(b.milestones[1].type, 'nation');
    assert.strictEqual(b.milestones[1].title, 'Nova Terra');
    assert.strictEqual(b.milestones[2].type, 'citizen');
    assert.strictEqual(b.milestones[2].title, null, 'PII 禁令');

    // 热力图形状（无 page_views → 全零）
    assert.strictEqual(b.heatmap.days.length, 7);
    assert.ok(b.heatmap.days.every((d) => d.cells.length === 6));
    assert.strictEqual(b.heatmap.maxCell, 0);
  } finally {
    await t.close();
  }
});

test('public-activity：trend 前窗（deltaPct=100）；空前窗 → null', async () => {
  const t = await testApp();
  try {
    seedUser(t, 'u1', isoAgo(2));
    seedUser(t, 'u2', isoAgo(4));
    seedUser(t, 'u6', isoAgo(40)); // 在前窗 [60d,30d) 内
    const b = await (await t.request('GET', '/api/public/activity?range=30d')).json();
    assert.strictEqual(b.kpi.newCitizens.value, 2);
    assert.strictEqual(b.kpi.newCitizens.prev, 1);
    assert.strictEqual(b.kpi.newCitizens.deltaPct, 100);
    assert.strictEqual(b.kpi.citizens.value, 3, 'active 全量含 u6');

    // 'all'：前窗为空（2000 之前）→ deltaPct 全 null
    const all = await (await t.request('GET', '/api/public/activity?range=all')).json();
    assert.strictEqual(all.from, '2000-01-01T00:00:00.000Z');
    assert.strictEqual(all.kpi.newCitizens.value, 3);
    assert.strictEqual(all.kpi.newCitizens.deltaPct, null);
  } finally {
    await t.close();
  }
});

test('public-activity：range 切换 7d/90d/all + 未知回退 30d', async () => {
  const t = await testApp();
  try {
    seedUser(t, 'u1', isoAgo(2));
    seedUser(t, 'u7', isoAgo(10));
    seedUser(t, 'u6', isoAgo(40));
    const get = async (range) => (await t.request('GET', '/api/public/activity?range=' + range)).json();
    assert.strictEqual((await get('7d')).kpi.newCitizens.value, 1, '10d 前 u7 出窗');
    assert.strictEqual((await get('30d')).kpi.newCitizens.value, 2);
    assert.strictEqual((await get('90d')).kpi.newCitizens.value, 3, '40d 前 u6 入 90d 窗');
    const all = await get('all');
    assert.strictEqual(all.kpi.newCitizens.value, 3);
    assert.strictEqual((await get('bogus')).range, '30d', '白名单外回退');
  } finally {
    await t.close();
  }
});

test('public-activity：heatmap 分桶（周一 02:00 → 桶0；今天 23:00 → 桶5）', async () => {
  const t = await testApp();
  try {
    const toDate = today();
    const fromMs = Date.parse(toDate + 'T00:00:00Z') - 6 * 86400e3;
    const fromDate = new Date(fromMs).toISOString().slice(0, 10);
    const col0 = (new Date(fromDate + 'T00:00:00Z').getUTCDay() + 6) % 7; // 窗口首日列
    const col6 = (new Date(toDate + 'T00:00:00Z').getUTCDay() + 6) % 7; // 今天列（今天未必是周日）
    const insPv = t.db.prepare('INSERT INTO page_views (id, client_id, path, created_at) VALUES (?, ?, ?, ?)');
    insPv.run('PGV-000001', 'c-a', '/a', fromDate + 'T02:00:00.000Z');
    insPv.run('PGV-000002', 'c-b', '/b', toDate + 'T23:00:00.000Z'); // < 明日 00:00 在窗内
    const b = await (await t.request('GET', '/api/public/activity?range=30d')).json();
    assert.strictEqual(b.heatmap.days[col0].cells[0], 1, '02:00 → 00-04 桶');
    assert.strictEqual(b.heatmap.days[col6].cells[5], 1, '23:00 → 20-24 桶');
    assert.strictEqual(b.heatmap.days[col0].total, 1);
    assert.strictEqual(b.heatmap.days[col6].total, 1);
    assert.strictEqual(b.heatmap.maxCell, 1);
  } finally {
    await t.close();
  }
});

test('public-activity：leaderboard 上限 5/排序/零分排除/缺名回退', async () => {
  const t = await testApp();
  try {
    const insAd = t.db.prepare('INSERT INTO activity_daily (user_id, date, requests, last_seen_at) VALUES (?, ?, ?, ?)');
    for (let i = 1; i <= 7; i++) {
      seedUser(t, 'lu' + i, isoAgo(50));
      seedNation(t, 'NAT-00012' + i, 'lu' + i, i === 3 ? '{}' : '{"name":"Land ' + i + '"}', isoAgo(50));
      if (i <= 6) insAd.run('lu' + i, today(), i * 10, isoHoursAgo(1)); // 60..10；lu7 零活跃
    }
    const b = await (await t.request('GET', '/api/public/activity?range=30d')).json();
    assert.strictEqual(b.leaderboard.length, 5, 'LIMIT 5 + 零分排除');
    assert.strictEqual(b.leaderboard[0].score, 60);
    assert.strictEqual(b.leaderboard[4].score, 20);
    assert.ok(!b.leaderboard.some((r) => r.name === 'Land 7'), '零活跃不上榜');
    assert.strictEqual(b.leaderboard.find((r) => r.rank === 4).name, 'Nation 000123', '缺 name 回退 id 尾段（lu3 分数 30 位第 4）');
  } finally {
    await t.close();
  }
});

test('public-activity：里程碑 PII 禁令（无 @ 无 display_name）', async () => {
  const t = await testApp();
  try {
    seedUser(t, 'priv-user', isoAgo(1)); // email priv-user@test.local 绝不外泄
    const b = await (await t.request('GET', '/api/public/activity?range=30d')).json();
    assert.strictEqual(b.milestones[0].type, 'citizen');
    assert.strictEqual(b.milestones[0].title, null);
    const s = JSON.stringify(b);
    assert.ok(!s.includes('@'), '响应无邮箱');
    assert.ok(!s.includes('display_name'), '响应无 display_name');
  } finally {
    await t.close();
  }
});

test('public-activity：限流（30/min 默认可覆盖）→ 第 3 次 429', async () => {
  const t = await testApp({ config: { rateLimits: { publicActivity: { max: 2, windowMs: 60000 } } } });
  try {
    assert.strictEqual((await t.request('GET', '/api/public/activity?range=7d')).status, 200);
    assert.strictEqual((await t.request('GET', '/api/public/activity?range=7d')).status, 200);
    const r3 = await t.request('GET', '/api/public/activity?range=7d');
    assert.strictEqual(r3.status, 429);
    assert.strictEqual((await r3.json()).error.code, 'RATE_LIMITED');
  } finally {
    await t.close();
  }
});

test('public-activity：零数据形状（空库全零/空数组/空态友好）', async () => {
  const t = await testApp();
  try {
    const b = await (await t.request('GET', '/api/public/activity?range=30d')).json();
    assert.deepStrictEqual(b.kpi.nations, { value: 0, prev: 0, deltaPct: null });
    assert.strictEqual(b.kpi.newCitizens.value, 0);
    assert.strictEqual(b.kpi.newCitizens.deltaPct, null);
    for (const k of ['users', 'nations', 'articles', 'teams']) {
      assert.strictEqual(b.trends[k].length, 30);
      assert.ok(b.trends[k].every((r) => r.value === 0));
    }
    assert.deepStrictEqual(b.contentTypes, { articles: 0, posts: 0, comments: 0, likes: 0 });
    assert.deepStrictEqual(b.leaderboard, []);
    assert.deepStrictEqual(b.milestones, []);
    assert.strictEqual(b.heatmap.maxCell, 0);
    assert.ok(b.heatmap.days.every((d) => d.total === 0 && d.cells.every((c) => c === 0)));
  } finally {
    await t.close();
  }
});
