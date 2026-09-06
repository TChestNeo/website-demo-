'use strict';
// snapshot-catchup.test.js — v0.2.20.4 部署丢点赞修复回归：catch-up 追恢复合并（scripts/snapshot-catchup.js）
// 场景复刻：部署瞬间新实例冷启动恢复 = 旧实例上一次定时快照（点赞之前）；旧实例 SIGTERM 临终快照
// 晚 ~6s 落地含最后写入（点赞+收藏）。catchupMerge 应把临终快照并回活库——写入回来、append-only
// audit_log 不动、FK 校验零违例、合并后继续可用。
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { testApp } = require('./helpers');
const { openDb } = require('../src/db');
const { catchupMerge, findNewerSnap } = require('../scripts/snapshot-catchup');

test('catch-up 追恢复：临终快照并回活库（部署丢点赞回归）', async () => {
  const t = await testApp();
  try {
    const { user: alice, cookie } = t.loginAs('alice@example.com');
    const post = (await (await t.request('POST', '/api/social/posts', { content: 'hello' }, { cookie })).json()).post;

    // 启动恢复口径：boot 快照 = 旧实例上一次定时快照（点赞之前）
    const bootSnap = path.join(t.dir, 'boot.sqlite');
    await t.db.backup(bootSnap);

    // 旧实例最后 ≤interval 的写入：点赞 + 收藏（+audit 各一条）
    await t.request('POST', '/api/social/posts/' + post.id + '/like', undefined, { cookie });
    await t.request('POST', '/api/social/posts/' + post.id + '/favorite', undefined, { cookie });

    // 临终快照 = SIGTERM 落盘（含最后写入）
    const sigSnap = path.join(t.dir, 'sigterm.sqlite');
    await t.db.backup(sigSnap);

    // 新实例活库 = 从 boot 快照恢复（openDb 同入口跑迁移，同版本 no-op）
    const liveDb = openDb(bootSnap);
    const before = {
      likes: liveDb.prepare('SELECT COUNT(*) AS n FROM content_likes').get().n,
      favs: liveDb.prepare('SELECT COUNT(*) AS n FROM favorites').get().n,
      audits: liveDb.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n,
      ver: liveDb.prepare('PRAGMA user_version').get().user_version
    };
    assert.strictEqual(before.likes, 0, 'boot 快照在点赞之前');
    assert.strictEqual(before.favs, 0, 'boot 快照在收藏之前');

    const { tables, fkBad } = catchupMerge(liveDb, sigSnap);

    // 表清单：排除 sqlite_sequence 与 append-only audit_log；核心表必须在内
    assert.ok(tables.length >= 50, '表数 ≥50，实际 ' + tables.length);
    for (const must of ['users', 'posts', 'content_likes', 'favorites']) assert.ok(tables.includes(must), must + ' 在合并清单');
    assert.ok(!tables.includes('audit_log'), 'audit_log 跳过（append-only）');
    assert.ok(!tables.some((x) => x.startsWith('sqlite_')), 'sqlite_* 不入清单');

    // 最后写入并回：点赞+收藏回来、作者仍在、帖子完好
    assert.strictEqual(liveDb.prepare('SELECT COUNT(*) AS n FROM content_likes WHERE target_id = ?').get(post.id).n, 1, '点赞回来');
    assert.strictEqual(liveDb.prepare("SELECT COUNT(*) AS n FROM favorites WHERE target_type = 'post' AND target_id = ?").get(post.id).n, 1, '收藏回来');
    assert.strictEqual(liveDb.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1, '用户完好');
    assert.strictEqual(liveDb.prepare('SELECT id FROM posts').get().id, post.id, '帖子完好');
    assert.strictEqual(fkBad.length, 0, 'FK 校验零违例');
    assert.strictEqual(liveDb.prepare('PRAGMA user_version').get().user_version, before.ver, 'user_version 不变');
    assert.strictEqual(liveDb.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n, before.audits, 'audit_log 未动（新写入的 audit 不入活库）');

    // 合并后活库继续可用：FK 已重开 + 新用户 ID 不与已有撞车（sqlite_sequence 单调性）
    const { createUser } = require('../src/routes/public/auth');
    const bob = createUser(liveDb, { email: 'bob@example.com' });
    assert.notStrictEqual(bob.id, alice.id, '新用户 ID 不与存量撞车');
    assert.strictEqual(liveDb.prepare('PRAGMA foreign_keys').get().foreign_keys, 1, 'FK 已复原开启');

    liveDb.close();
  } finally {
    await t.close();
  }
});

test('catch-up 候选选择：只追晚于启动恢复的其他实例快照（本实例/.tmp/旧文件排除）', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mn2-snap-'));
  const touch = (name, mtimeMs) => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, 'x');
    fs.utimesSync(p, new Date(mtimeMs), new Date(mtimeMs));
  };
  touch('mn-v2.sqlite.snap.oldboot', 1000);        // 早于启动恢复 → 排除
  touch('mn-v2.sqlite.snap.sigterm', 3000);        // 晚于启动恢复 → 选中
  touch('mn-v2.sqlite.snap.sigterm.tmp', 9000);    // .tmp 中途文件 → 排除
  touch('mn-v2.sqlite.snap.self', 8000);           // 本实例文件 → 排除
  touch('unrelated.txt', 9999);                    // 非快照基名 → 排除

  const got = findNewerSnap(dir, 'mn-v2.sqlite.snap', 'mn-v2.sqlite.snap.self', 2000);
  assert.strictEqual(got.f, 'mn-v2.sqlite.snap.sigterm', '只选中 sigterm 快照');
  assert.strictEqual(got.m, 3000);
  assert.strictEqual(findNewerSnap(dir, 'mn-v2.sqlite.snap', 'mn-v2.sqlite.snap.self', 5000), null, '无晚于阈值 → null');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('catch-up 追恢复：坏文件抛错不污染活库（FK 复原）', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('alice@example.com');
    await t.request('POST', '/api/social/posts', { content: 'hello' }, { cookie });
    const bad = path.join(t.dir, 'bad.sqlite');
    const fs = require('node:fs');
    fs.writeFileSync(bad, 'not a sqlite file');
    assert.throws(() => catchupMerge(t.db, bad), /file is not a database|malformed/i, '坏快照抛错');
    assert.strictEqual(t.db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1, '抛错后 FK 仍开启');
    assert.strictEqual(t.db.prepare('SELECT COUNT(*) AS n FROM posts').get().n, 1, '活库数据未动');
  } finally {
    await t.close();
  }
});
