'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

// 文章评论 + 标题搜索（v0.2.55.0 平台侧文章前端）：article_comments 独立表（028，ACM- 前缀、
// 一层无回复）；GET /api/articles?q= 标题模糊搜索（公开只搜 published，%/_ 转义）。
// 点赞/收藏在 article-interactions.test.js；article_comment 通知事件在本文件一并覆盖。
// 口径照抄帖子评论（social-interactions.test.js）：先发后审 L0、removed 不浮现、禁言/去重 403。

async function setupPair(t) {
  const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
  const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
  return { alice, bob };
}

async function makeArticle(t, actor, title) {
  const r = await t.request('POST', '/api/articles', { title, contentJson: JSON.stringify({ cards: [] }) }, { cookie: actor.cookie });
  assert.strictEqual(r.status, 200);
  return (await r.json()).article.id;
}

const CLEAN = '不错的文章，支持一下';

test('评论 pass → visible + ACM- id + 作者档案 + queued 先发后审 + 列表立即可见', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'Comment Article');
    const r = await t.request('POST', '/api/articles/' + artId + '/comments', { content: CLEAN }, { cookie: bob.cookie });
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.match(body.comment.id, /^ACM-\d{6}$/);
    assert.strictEqual(body.comment.articleId, artId);
    assert.strictEqual(body.comment.authorName, 'Bob');
    assert.ok(body.comment.avatarUrl);
    assert.strictEqual(body.comment.content, CLEAN);
    assert.strictEqual(body.comment.status, 'visible');
    assert.strictEqual(body.moderation.verdict, 'pass');
    const item = t.db.prepare('SELECT * FROM moderation_items WHERE target_id = ?').get(body.comment.id);
    assert.strictEqual(item.kind, 'text');
    assert.strictEqual(item.target_type, 'article_comment');
    assert.strictEqual(item.status, 'queued'); // 先发后审
    const list = (await (await t.request('GET', '/api/articles/' + artId + '/comments')).json()).comments;
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, body.comment.id);
  } finally { await t.close(); }
});

test('GET 列表：ASC 时间序 + 仅 visible + 匿名可读 + 未公开文 404', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'List Article');
    const iso = new Date().toISOString();
    const c1 = (await (await t.request('POST', '/api/articles/' + artId + '/comments', { content: '第一条' }, { cookie: bob.cookie })).json()).comment;
    const c2 = (await (await t.request('POST', '/api/articles/' + artId + '/comments', { content: '第二条' }, { cookie: bob.cookie })).json()).comment;
    // 直插 removed 行（绕过 L0 封号流程）
    t.db.prepare("INSERT INTO article_comments (id, article_id, author_id, content, status, created_at) VALUES ('ACM-000099', ?, ?, 'removed row', 'removed', ?)")
      .run(artId, bob.user.id, new Date(Date.now() + 5000).toISOString());

    const list = (await (await t.request('GET', '/api/articles/' + artId + '/comments')).json()).comments;
    assert.strictEqual(list.length, 2, 'removed 不出现');
    assert.deepStrictEqual(list.map((c) => c.id), [c1.id, c2.id], '时间 ASC（seq 兜底同毫秒）');
    for (const c of list) assert.strictEqual(c.authorName, 'Bob');

    t.db.prepare("UPDATE articles SET status = 'hidden' WHERE id = ?").run(artId);
    const hidden = await t.request('GET', '/api/articles/' + artId + '/comments');
    assert.strictEqual(hidden.status, 404);
    assert.strictEqual((await hidden.json()).error.code, 'NOT_FOUND');
    assert.strictEqual((await t.request('GET', '/api/articles/ART-999999/comments')).status, 404);
  } finally { await t.close(); }
});

test('评论校验/404：空 400、2001 字 400、匿名 401、未公开/不存在 POST 404', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'Guard Article');
    assert.strictEqual((await t.request('POST', '/api/articles/' + artId + '/comments', { content: '   ' }, { cookie: bob.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/articles/' + artId + '/comments', { content: 'x'.repeat(2001) }, { cookie: bob.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/articles/' + artId + '/comments', { content: '匿名评论' })).status, 401);
    t.db.prepare("UPDATE articles SET status = 'hidden' WHERE id = ?").run(artId);
    const hidden = await t.request('POST', '/api/articles/' + artId + '/comments', { content: CLEAN }, { cookie: bob.cookie });
    assert.strictEqual(hidden.status, 404);
    assert.strictEqual((await hidden.json()).error.code, 'NOT_FOUND');
    assert.strictEqual((await t.request('POST', '/api/articles/ART-999999/comments', { content: CLEAN }, { cookie: bob.cookie })).status, 404);
  } finally { await t.close(); }
});

test('评论限流：commentWrite 第 5 条 429（无效尝试也占配额，防探测——与帖子评论同口径）', async () => {
  const t = await testApp({ config: { rateLimits: { commentWrite: { max: 4, windowMs: 60000 } } } });
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'Rate Article');
    assert.strictEqual((await t.request('POST', '/api/articles/' + artId + '/comments', { content: '   ' }, { cookie: bob.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/articles/' + artId + '/comments', { content: 'x'.repeat(2001) }, { cookie: bob.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/articles/' + artId + '/comments', { content: '第 1 条' }, { cookie: bob.cookie })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/articles/' + artId + '/comments', { content: '第 2 条' }, { cookie: bob.cookie })).status, 200);
    const third = await t.request('POST', '/api/articles/' + artId + '/comments', { content: '第 3 条' }, { cookie: bob.cookie });
    assert.strictEqual(third.status, 429);
    assert.strictEqual((await third.json()).error.code, 'RATE_LIMITED');
  } finally { await t.close(); }
});

test('零容忍 → removed + 封号 + 决策/通知 + 列表不出现 + 不记 XP + 事件不浮现', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'Zero Article');
    const r = await t.request('POST', '/api/articles/' + artId + '/comments', { content: '我这里可以代开发票，欢迎联系' }, { cookie: bob.cookie });
    const body = await r.json();
    assert.strictEqual(body.comment.status, 'removed');
    assert.strictEqual(body.moderation.verdict, 'reject');
    assert.strictEqual(body.moderation.reasonCode, 'zero_tolerance');
    assert.strictEqual(t.db.prepare('SELECT status FROM users WHERE id = ?').get(bob.user.id).status, 'banned');
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM user_sessions WHERE user_id = ?').get(bob.user.id).n, 0);
    const d = t.db.prepare('SELECT * FROM moderation_decisions').get();
    assert.strictEqual(d.action, 'ban');
    assert.ok(t.db.prepare('SELECT count(*) AS n FROM notifications WHERE user_id = ?').get(bob.user.id).n > 0);
    const list = (await (await t.request('GET', '/api/articles/' + artId + '/comments')).json()).comments;
    assert.strictEqual(list.length, 0);
    assert.strictEqual(t.db.prepare('SELECT xp_gained FROM users WHERE id = ?').get(alice.user.id).xp_gained, 0, 'removed 评论不记经验');
    // removed 评论不进作者通知（article_comment 事件不浮现）
    const notifs = (await (await t.request('GET', '/api/notifications', undefined, { cookie: alice.cookie })).json()).notifications;
    assert.strictEqual(notifs.filter((n) => n.type === 'article_comment').length, 0);
  } finally { await t.close(); }
});

test('hold → visible 先发后审 + l0_hold 人工 + 作者 +10', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'Hold Article');
    const body = await (await t.request('POST', '/api/articles/' + artId + '/comments', { content: '你真是个傻逼' }, { cookie: bob.cookie })).json();
    assert.strictEqual(body.comment.status, 'visible');
    assert.strictEqual(body.moderation.verdict, 'hold');
    const item = t.db.prepare('SELECT * FROM moderation_items WHERE target_id = ?').get(body.comment.id);
    assert.strictEqual(item.status, 'l0_hold');
    assert.strictEqual(t.db.prepare('SELECT xp_gained FROM users WHERE id = ?').get(alice.user.id).xp_gained, 10);
  } finally { await t.close(); }
});

test('处罚/去重：禁言 403；24h 同作者同内容 403', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'Mute Article');
    t.db.prepare('UPDATE users SET muted_until = ? WHERE id = ?').run(new Date(Date.now() + 3600000).toISOString(), bob.user.id);
    const muted = await t.request('POST', '/api/articles/' + artId + '/comments', { content: CLEAN }, { cookie: bob.cookie });
    assert.strictEqual(muted.status, 403);
    assert.strictEqual((await muted.json()).error.code, 'RESTRICTED');
    t.db.prepare('UPDATE users SET muted_until = NULL WHERE id = ?').run(bob.user.id);

    await t.request('POST', '/api/articles/' + artId + '/comments', { content: CLEAN }, { cookie: bob.cookie });
    const dup = await t.request('POST', '/api/articles/' + artId + '/comments', { content: CLEAN }, { cookie: bob.cookie });
    assert.strictEqual(dup.status, 403, '24h 同作者同内容去重');
    assert.strictEqual((await dup.json()).error.code, 'RESTRICTED');
    // 别人发相同内容不受影响（去重按作者隔离）
    const carol = t.loginAs('carol@x.com', { displayName: 'Carol' });
    assert.strictEqual((await t.request('POST', '/api/articles/' + artId + '/comments', { content: CLEAN }, { cookie: carol.cookie })).status, 200);
  } finally { await t.close(); }
});

test('XP：异人评论作者 +10；自评不记', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'XP Article');
    await t.request('POST', '/api/articles/' + artId + '/comments', { content: CLEAN }, { cookie: bob.cookie });
    assert.strictEqual(t.db.prepare('SELECT xp_gained FROM users WHERE id = ?').get(alice.user.id).xp_gained, 10);
    await t.request('POST', '/api/articles/' + artId + '/comments', { content: '自己的文章自己评' }, { cookie: alice.cookie });
    assert.strictEqual(t.db.prepare('SELECT xp_gained FROM users WHERE id = ?').get(alice.user.id).xp_gained, 10, '自评不记');
    // 反向：alice 评 bob 的文章 → bob +10
    const bobArt = await makeArticle(t, bob, 'Bob Article');
    await t.request('POST', '/api/articles/' + bobArt + '/comments', { content: CLEAN }, { cookie: alice.cookie });
    assert.strictEqual(t.db.prepare('SELECT xp_gained FROM users WHERE id = ?').get(bob.user.id).xp_gained, 10);
  } finally { await t.close(); }
});

test('article_comment 通知：作者收到事件（形状/targetId/ACM- id）；自评不浮现', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupPair(t);
    const artId = await makeArticle(t, alice, 'Notif Article');
    const body = await (await t.request('POST', '/api/articles/' + artId + '/comments', { content: CLEAN }, { cookie: bob.cookie })).json();

    const notifs = (await (await t.request('GET', '/api/notifications', undefined, { cookie: alice.cookie })).json()).notifications;
    assert.strictEqual(notifs.length, 1);
    const n = notifs[0];
    assert.strictEqual(n.type, 'article_comment');
    assert.strictEqual(n.id, body.comment.id);
    assert.strictEqual(n.targetId, artId);
    assert.strictEqual(n.actor.id, bob.user.id);
    assert.strictEqual(n.actor.displayName, 'Bob');
    assert.ok(n.createdAt);

    await t.request('POST', '/api/articles/' + artId + '/comments', { content: '自评不浮现' }, { cookie: alice.cookie });
    assert.strictEqual((await (await t.request('GET', '/api/notifications', undefined, { cookie: alice.cookie })).json()).notifications.length, 1);
  } finally { await t.close(); }
});

test('q 搜索：大小写不敏感 + %/_ 转义 + 只搜 published + authorName + 匿名可用', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const carol = t.loginAs('carol@x.com', { displayName: 'Carol' });
    await makeArticle(t, alice, 'Flags of My Nation');
    await makeArticle(t, bob, 'National Flags History');
    await makeArticle(t, carol, 'Cooking Tips');
    await makeArticle(t, carol, '100% Complete Guide');
    await makeArticle(t, carol, 'a_b');
    await makeArticle(t, carol, 'axb');

    const q = (s) => t.request('GET', '/api/articles?q=' + encodeURIComponent(s));
    const lower = await (await q('flag')).json();
    assert.strictEqual(lower.articles.length, 2, '大小写不敏感');
    assert.deepStrictEqual(lower.articles.map((a) => a.title).sort(), ['Flags of My Nation', 'National Flags History']);
    const upper = await (await q('FLAGS')).json();
    assert.strictEqual(upper.articles.length, 2);
    assert.strictEqual(upper.articles[0].authorName, 'Bob', 'authorName 联查（seq DESC 最新在前）');

    const pct = await (await q('100%')).json();
    assert.strictEqual(pct.articles.length, 1, '% 转义不当地变为通配');
    assert.strictEqual(pct.articles[0].title, '100% Complete Guide');
    assert.strictEqual((await (await q('a_b')).json()).articles.length, 1, '_ 转义不当地变为通配');
    assert.strictEqual((await (await q('a_b')).json()).articles[0].title, 'a_b');

    assert.strictEqual((await (await q('zzz')).json()).articles.length, 0);
    // 只搜 published：隐藏后搜不到
    t.db.prepare("UPDATE articles SET status = 'hidden' WHERE title = 'Cooking Tips'").run();
    assert.strictEqual((await (await q('cooking')).json()).articles.length, 0);
    // 无 q 的列表也带 authorName
    const list = (await (await t.request('GET', '/api/articles')).json()).articles;
    for (const a of list) assert.ok(a.authorName !== undefined);
  } finally { await t.close(); }
});
