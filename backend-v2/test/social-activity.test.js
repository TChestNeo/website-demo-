'use strict';
// v0.2.49.0 平台活跃日端点：GET /api/social/activity（话题 +25「30 天连续活跃」门禁的数据源）。
// 活跃日 = 当天 ≥ minPosters（默认 10）个不同用户发可见帖（用户钦定）；公开无鉴权；UTC 日域；缺失天补 0。
// 测试口径：先请求一次拿端点自己的窗口锚点（今天 = 数组最后一天），再按锚点日期插帖——
// 杜绝「测试进程今天」与「服务器进程今天」跨 UTC 午夜的竞态（同收敛轮询口径）。
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

async function getDays(t) {
  const res = await t.request('GET', '/api/social/activity');
  assert.strictEqual(res.status, 200);
  return (await res.json()).days;
}

test('activity：零帖 → 默认 60 天窗口全 0、逐日升序、active 全 false（公开无鉴权）', async () => {
  const t = await testApp();
  try {
    const days = await getDays(t);
    assert.strictEqual(days.length, 60);
    assert.ok(days.every((d) => d.posters === 0 && d.active === false));
    for (let i = 1; i < days.length; i++) {
      assert.strictEqual(Date.parse(days[i].date) - Date.parse(days[i - 1].date), 86400 * 1000, '逐格一天');
    }
  } finally { await t.close(); }
});

test('activity：同日 10 个不同用户 → active=true；同人多帖只算 1；removed/hidden 不计', async () => {
  const t = await testApp();
  try {
    const anchor = await getDays(t);
    const today = anchor[anchor.length - 1].date;
    const iso = (h) => today + 'T' + String(h).padStart(2, '0') + ':00:00.000Z';
    for (let i = 0; i < 10; i++) t.seedUser({ email: 'p' + i + '@x.com' });
    const users = t.db.prepare("SELECT id FROM users WHERE email LIKE 'p%@x.com' ORDER BY email").all().map((r) => r.id);
    assert.strictEqual(users.length, 10);
    const ins = t.db.prepare("INSERT INTO posts (id, author_id, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
    users.forEach((u, i) => ins.run('PST-10000' + i, u, '活跃日帖 ' + i, 'visible', iso(i + 1), iso(i + 1)));
    // 同一用户同日再发一帖：DISTINCT author_id 只算 1
    ins.run('PST-100020', users[0], '同人第二帖', 'visible', iso(13), iso(13));
    // removed/hidden 不计入
    ins.run('PST-100021', users[1], 'removed 帖', 'removed', iso(14), iso(14));
    ins.run('PST-100022', users[2], 'hidden 帖', 'hidden', iso(15), iso(15));
    const days = await getDays(t);
    const last = days[days.length - 1];
    assert.strictEqual(last.date, today);
    assert.strictEqual(last.posters, 10, '10 个不同用户（去重同人多帖）');
    assert.strictEqual(last.active, true, '≥10 → 活跃日');
    assert.strictEqual(days[days.length - 2].posters, 0, '前一天无帖');
  } finally { await t.close(); }
});

test('activity：minPosters 覆盖 3 → 2 人 active=false、3 人 active=true（config.xp.activity 生效）', async () => {
  const t = await testApp({ config: { xp: { activity: { minPosters: 3, windowDays: 60 } } } });
  try {
    const anchor = await getDays(t);
    const iso = anchor[anchor.length - 1].date + 'T05:00:00.000Z';
    for (let i = 0; i < 3; i++) t.seedUser({ email: 'm' + i + '@x.com' });
    const users = t.db.prepare("SELECT id FROM users WHERE email LIKE 'm%@x.com' ORDER BY email").all().map((r) => r.id);
    const ins = t.db.prepare("INSERT INTO posts (id, author_id, content, status, created_at, updated_at) VALUES (?, ?, ?, 'visible', ?, ?)");
    ins.run('PST-200001', users[0], 'm0 帖', iso, iso);
    ins.run('PST-200002', users[1], 'm1 帖', iso, iso);
    let days = await getDays(t);
    assert.strictEqual(days[days.length - 1].posters, 2);
    assert.strictEqual(days[days.length - 1].active, false, '2 人不足 minPosters=3');
    ins.run('PST-200003', users[2], 'm2 帖', iso, iso);
    days = await getDays(t);
    assert.strictEqual(days[days.length - 1].active, true, '3 人达标');
  } finally { await t.close(); }
});

test('activity：windowDays 覆盖 5 → 5 天窗口；窗口外旧帖不计入', async () => {
  const t = await testApp({ config: { xp: { activity: { minPosters: 10, windowDays: 5 } } } });
  try {
    const anchor = await getDays(t);
    assert.strictEqual(anchor.length, 5);
    const yesterday = anchor[anchor.length - 2].date;
    t.seedUser({ email: 'w@x.com' });
    const u = t.db.prepare("SELECT id FROM users WHERE email = 'w@x.com'").get().id;
    const ins = t.db.prepare("INSERT INTO posts (id, author_id, content, status, created_at, updated_at) VALUES (?, ?, ?, 'visible', ?, ?)");
    ins.run('PST-300001', u, '窗口内（昨天）', yesterday + 'T10:00:00.000Z', yesterday + 'T10:00:00.000Z');
    // 窗口首日的前一天 = 窗口外
    const outsideIso = new Date(Date.parse(anchor[0].date) - 86400 * 1000).toISOString();
    ins.run('PST-300002', u, '窗口外（6 天前）', outsideIso, outsideIso);
    const days = await getDays(t);
    assert.strictEqual(days.length, 5);
    assert.strictEqual(days[3].date, yesterday);
    assert.strictEqual(days[3].posters, 1, '窗口内计入');
    assert.strictEqual(days[3].active, false, '1 人不足 10');
    assert.strictEqual(days[0].posters, 0, '窗口外旧帖不计');
    assert.strictEqual(days[days.length - 1].posters, 0, '今天无帖');
  } finally { await t.close(); }
});
