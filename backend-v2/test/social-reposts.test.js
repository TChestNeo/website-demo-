'use strict';
// v0.2.18.0 转发端点测试：POST/DELETE /api/social/posts/:id/repost（真转发——转发即发帖，同帖一次，
// 转发语可选 0-2000；先发后审同帖口径）+ postRow 转发随行（repostOfId/repostOf 浅嵌/repostCount/repostedByMe）。
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

const CLEAN = '我的新国家正式成立，欢迎各位外交官来访交流';
const QUOTE = '说得太好了，转发支持';
// 注意：转发路径刻意跳过 sha1 去重（裸转发空串哈希撞车 + 短转发语高频误伤），
// 同帖一次由 (repost_of, author_id) 守卫兜底——所以转发语可重复，同帖重复转发才是 409。

// 建帖快捷（默认 alice；同测多帖需换内容——发帖 sha1 去重会拦重复文案）
async function makePost(t, who, content = CLEAN, extra = {}) {
  const r = await t.request('POST', '/api/social/posts', { content, ...extra }, { cookie: who.cookie });
  assert.strictEqual(r.status, 200);
  return (await r.json()).post;
}

async function repost(t, who, id, body) {
  return t.request('POST', '/api/social/posts/' + id + '/repost', body, { cookie: who.cookie });
}

test('裸转发：字段全断言 + DB + 零审核项 + feed 随行 + 原帖计数/自见', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const orig = await makePost(t, alice);
    const r = await repost(t, bob, orig.id, { content: '' });
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    // 转发帖形状：content ''（裸转发）、media []、topicId 随原帖、PST- id
    const p = body.post;
    assert.match(p.id, /^PST-\d{6}$/);
    assert.notStrictEqual(p.id, orig.id);
    assert.strictEqual(p.content, '');
    assert.deepStrictEqual(p.media, []);
    assert.strictEqual(p.topicId, orig.topicId);
    assert.strictEqual(p.status, 'visible');
    // 浅嵌原帖：形状固定、无 likedByMe/repostOfId 字段（不递归）
    assert.strictEqual(p.repostOfId, orig.id);
    assert.strictEqual(p.repostOf.id, orig.id);
    assert.strictEqual(p.repostOf.authorName, 'Alice');
    assert.strictEqual(p.repostOf.content, CLEAN);
    assert.deepStrictEqual(p.repostOf.media, []);
    assert.strictEqual(p.repostOf.likeCount, 0);
    assert.strictEqual(p.repostOf.commentCount, 0);
    assert.strictEqual('likedByMe' in p.repostOf, false);
    assert.strictEqual('repostOfId' in p.repostOf, false);
    assert.ok(p.repostOf.createdAt);
    // 响应计数 + 审核口径：裸转发 pass + 零审核项
    assert.strictEqual(body.repostCount, 1);
    assert.deepStrictEqual(body.moderation, { verdict: 'pass', reasonCode: null });
    // repostedByMe = 「我是否转发了这条转发帖」——bob 是作者不是转发者 → false（原帖视角的 true 见下方 dMine）
    assert.strictEqual(p.repostedByMe, false);
    // 转发帖自身的 repostCount = 0（没人转这条转发帖）；原帖计数在响应 body.repostCount（上两行已断言）
    assert.strictEqual(p.repostCount, 0);
    // DB：repost_of 指向原帖、visible、moderation_items 零行
    const row = t.db.prepare('SELECT * FROM posts WHERE id = ?').get(p.id);
    assert.strictEqual(row.repost_of, orig.id);
    assert.strictEqual(row.status, 'visible');
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM moderation_items WHERE target_id = ?').get(p.id).n, 0);
    // feed 随行（转发行自然进信息流）
    const feed = (await (await t.request('GET', '/api/social/posts')).json()).posts;
    const fp = feed.find(x => x.id === p.id);
    assert.ok(fp, '转发帖进 feed');
    assert.strictEqual(fp.repostOfId, orig.id);
    assert.strictEqual(fp.repostOf.id, orig.id);
    // 原帖视角：计数 1、bob 自见 repostedByMe true、匿名 false
    const dMine = (await (await t.request('GET', '/api/social/posts/' + orig.id, undefined, { cookie: bob.cookie })).json()).post;
    assert.strictEqual(dMine.repostCount, 1);
    assert.strictEqual(dMine.repostedByMe, true);
    const dAnon = (await (await t.request('GET', '/api/social/posts/' + orig.id)).json()).post;
    assert.strictEqual(dAnon.repostCount, 1);
    assert.strictEqual(dAnon.repostedByMe, false);
    assert.strictEqual(dAnon.repostOfId, null);
    assert.strictEqual(dAnon.repostOf, null);
  } finally { await t.close(); }
});

test('带转发语：content 保留 + queued 审核项 + topicId 随原帖', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    // topic_id 有 FK → 先落一条话题再发带话题帖
    const iso = new Date().toISOString();
    t.db.prepare("INSERT INTO topics (id, creator_id, data, status, created_at, updated_at) VALUES ('TOP-000001', ?, '{}', 'visible', ?, ?)")
      .run(alice.user.id, iso, iso);
    const orig = await makePost(t, alice, '关于我国宪法修订的说明', { topicId: 'TOP-000001' });
    const body = await (await repost(t, bob, orig.id, { content: QUOTE })).json();
    assert.strictEqual(body.post.content, QUOTE);
    assert.strictEqual(body.post.topicId, 'TOP-000001'); // 随原帖
    assert.strictEqual(body.moderation.verdict, 'pass');
    const item = t.db.prepare('SELECT * FROM moderation_items WHERE target_id = ?').get(body.post.id);
    assert.strictEqual(item.kind, 'text');
    assert.strictEqual(item.status, 'queued'); // 先发后审
  } finally { await t.close(); }
});

test('校验：2001 字 400；纯空白转发语 = 裸转发 200', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const orig = await makePost(t, alice);
    const long = await repost(t, bob, orig.id, { content: 'x'.repeat(2001) });
    assert.strictEqual(long.status, 400);
    assert.strictEqual((await long.json()).error.code, 'VALIDATION');
    const ws = await repost(t, bob, orig.id, { content: '   ' });
    assert.strictEqual(ws.status, 200);
    const body = await ws.json();
    assert.strictEqual(body.post.content, ''); // trim 后空 = 裸转发
    assert.strictEqual(body.moderation.verdict, 'pass');
  } finally { await t.close(); }
});

test('404：随机 id / hidden / removed 原帖均不可转', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const orig = await makePost(t, alice);
    const ghost = await repost(t, bob, 'PST-999999', { content: '' });
    assert.strictEqual(ghost.status, 404);
    assert.strictEqual((await ghost.json()).error.code, 'NOT_FOUND');
    t.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('hidden', orig.id);
    assert.strictEqual((await repost(t, bob, orig.id, { content: '' })).status, 404);
    t.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('removed', orig.id);
    assert.strictEqual((await repost(t, bob, orig.id, { content: '' })).status, 404);
  } finally { await t.close(); }
});

test('匿名 POST/DELETE 均 401', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const orig = await makePost(t, alice);
    assert.strictEqual((await t.request('POST', '/api/social/posts/' + orig.id + '/repost', { content: '' })).status, 401);
    assert.strictEqual((await t.request('DELETE', '/api/social/posts/' + orig.id + '/repost')).status, 401);
  } finally { await t.close(); }
});

test('同帖一次：重复转发 409 CONFLICT；DELETE 后可再转', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const orig = await makePost(t, alice);
    const first = await repost(t, bob, orig.id, { content: QUOTE });
    assert.strictEqual(first.status, 200);
    const dup = await repost(t, bob, orig.id, { content: '换一句转发语' });
    assert.strictEqual(dup.status, 409);
    assert.strictEqual((await dup.json()).error.code, 'CONFLICT');
    // DELETE 后同帖可再转（撤销 = 释放同帖一次名额）
    assert.strictEqual((await t.request('DELETE', '/api/social/posts/' + orig.id + '/repost', undefined, { cookie: bob.cookie })).status, 200);
    const again = await repost(t, bob, orig.id, { content: '换一句转发语' });
    assert.strictEqual(again.status, 200);
    assert.strictEqual((await again.json()).repostCount, 1);
  } finally { await t.close(); }
});

test('DELETE：幂等 + 双人计数联动（删一个不伤另一个）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const carol = t.loginAs('carol@x.com', { displayName: 'Carol' });
    const orig = await makePost(t, alice);
    await repost(t, bob, orig.id, { content: '' });
    await repost(t, carol, orig.id, { content: '' });
    const d1 = await (await t.request('DELETE', '/api/social/posts/' + orig.id + '/repost', undefined, { cookie: bob.cookie })).json();
    assert.deepStrictEqual(d1, { reposted: false, repostCount: 1 });
    const d2 = await (await t.request('DELETE', '/api/social/posts/' + orig.id + '/repost', undefined, { cookie: bob.cookie })).json();
    assert.deepStrictEqual(d2, { reposted: false, repostCount: 1 }); // 幂等 no-op
    // carol 的转发行不受影响
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM posts WHERE repost_of = ?').get(orig.id).n, 1);
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM posts WHERE repost_of = ? AND author_id = ?').get(orig.id, carol.user.id).n, 1);
    // 不存在的原帖也幂等（撤销转发不校验帖存在）
    const d3 = await (await t.request('DELETE', '/api/social/posts/PST-999999/repost', undefined, { cookie: bob.cookie })).json();
    assert.deepStrictEqual(d3, { reposted: false, repostCount: 0 });
  } finally { await t.close(); }
});

test('零容忍转发语：removed + 封号 + 决策/通知 + 不进 feed（同帖口径）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const orig = await makePost(t, alice);
    const body = await (await repost(t, bob, orig.id, { content: '我这里可以代开发票，欢迎联系' })).json();
    assert.strictEqual(body.post.status, 'removed');
    assert.strictEqual(body.moderation.verdict, 'reject');
    assert.strictEqual(body.moderation.reasonCode, 'zero_tolerance');
    assert.strictEqual(t.db.prepare('SELECT status FROM users WHERE id = ?').get(bob.user.id).status, 'banned');
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM user_sessions WHERE user_id = ?').get(bob.user.id).n, 0);
    const d = t.db.prepare('SELECT * FROM moderation_decisions').get();
    assert.strictEqual(d.action, 'ban');
    assert.ok(t.db.prepare('SELECT count(*) AS n FROM notifications WHERE user_id = ?').get(bob.user.id).n > 0);
    // removed 转发行不进信息流
    const feed = (await (await t.request('GET', '/api/social/posts')).json()).posts;
    assert.strictEqual(feed.some(x => x.id === body.post.id), false);
  } finally { await t.close(); }
});

test('warning 转发语：visible 先发后审 + l0_hold normal', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const orig = await makePost(t, alice);
    const body = await (await repost(t, bob, orig.id, { content: '你真是个傻逼' })).json();
    assert.strictEqual(body.post.status, 'visible');
    assert.strictEqual(body.moderation.verdict, 'hold');
    const item = t.db.prepare('SELECT * FROM moderation_items WHERE target_id = ?').get(body.post.id);
    assert.strictEqual(item.status, 'l0_hold');
    assert.strictEqual(item.priority, 'normal');
  } finally { await t.close(); }
});

test('处罚：禁言 / 发布受限均 403', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const orig = await makePost(t, alice);
    t.db.prepare('UPDATE users SET muted_until = ? WHERE id = ?')
      .run(new Date(Date.now() + 3600e3).toISOString(), bob.user.id);
    const muted = await repost(t, bob, orig.id, { content: '' });
    assert.strictEqual(muted.status, 403);
    assert.strictEqual((await muted.json()).error.code, 'RESTRICTED');
    t.db.prepare('UPDATE users SET muted_until = NULL, rate_limited_until = ? WHERE id = ?')
      .run(new Date(Date.now() + 3600e3).toISOString(), bob.user.id);
    const rl = await repost(t, bob, orig.id, { content: '' });
    assert.strictEqual(rl.status, 403);
    assert.strictEqual((await rl.json()).error.code, 'RESTRICTED');
  } finally { await t.close(); }
});

test('postsWrite 限流：转发共享发帖配额（max:1 撤销后再转 429）', async () => {
  const t = await testApp({ config: { rateLimits: { postsWrite: { max: 1, windowMs: 60000 } } } });
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const orig = await makePost(t, alice);
    // bob 没发过帖：第 1 条转发占满 pw:user:bob 配额
    assert.strictEqual((await repost(t, bob, orig.id, { content: '' })).status, 200);
    // 撤销走 writeLimit（sw: 预算），不耗发帖配额
    assert.strictEqual((await t.request('DELETE', '/api/social/posts/' + orig.id + '/repost', undefined, { cookie: bob.cookie })).status, 200);
    const second = await repost(t, bob, orig.id, { content: '' });
    assert.strictEqual(second.status, 429);
    assert.strictEqual((await second.json()).error.code, 'RATE_LIMITED');
  } finally { await t.close(); }
});

test('转发的转发：浅嵌一层不递归（repostOf.content = 中间帖转发语）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const carol = t.loginAs('carol@x.com', { displayName: 'Carol' });
    const orig = await makePost(t, alice);
    const mid = (await (await repost(t, bob, orig.id, { content: '中间层转发语' })).json()).post;
    const top = (await (await repost(t, carol, mid.id, { content: '顶层转发语' })).json()).post;
    assert.strictEqual(top.repostOfId, mid.id);
    assert.strictEqual(top.repostOf.id, mid.id);
    assert.strictEqual(top.repostOf.content, '中间层转发语'); // 浅嵌：看到的原帖是中间转发帖本体
    assert.strictEqual(top.repostOf.authorName, 'Bob');
    assert.strictEqual('repostOfId' in top.repostOf, false); // 不递归嵌原始帖
  } finally { await t.close(); }
});

test('原帖下架后：转发帖详情/feed 仍 200 + repostOfId 有值 + repostOf null', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const orig = await makePost(t, alice);
    const p = (await (await repost(t, bob, orig.id, { content: QUOTE })).json()).post;
    t.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('removed', orig.id);
    const detail = await t.request('GET', '/api/social/posts/' + p.id);
    assert.strictEqual(detail.status, 200);
    const dp = (await detail.json()).post;
    assert.strictEqual(dp.repostOfId, orig.id); // 指向保留（前端据此渲染占位）
    assert.strictEqual(dp.repostOf, null);
    const feed = (await (await t.request('GET', '/api/social/posts')).json()).posts;
    const fp = feed.find(x => x.id === p.id);
    assert.ok(fp, '转发帖自身仍进 feed');
    assert.strictEqual(fp.repostOfId, orig.id);
    assert.strictEqual(fp.repostOf, null);
  } finally { await t.close(); }
});

test('自转允许；转发帖详情 GET 随行 + 可点赞/可评论计数', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const carol = t.loginAs('carol@x.com', { displayName: 'Carol' });
    const orig = await makePost(t, alice);
    const self = await repost(t, alice, orig.id, { content: '我自己顶一下' });
    assert.strictEqual(self.status, 200);
    const sp = (await self.json()).post;
    // 转发帖详情：匿名 GET 随行 + 计数零值
    const detail = (await (await t.request('GET', '/api/social/posts/' + sp.id)).json()).post;
    assert.strictEqual(detail.repostOfId, orig.id);
    assert.strictEqual(detail.repostOf.authorName, 'Alice');
    assert.strictEqual(detail.likeCount, 0);
    assert.strictEqual(detail.commentCount, 0);
    assert.strictEqual(detail.repostCount, 0);
    // 转发帖可点赞（点赞/评论天然作用于转发帖）
    const like = await t.request('POST', '/api/social/posts/' + sp.id + '/like', undefined, { cookie: carol.cookie });
    assert.strictEqual(like.status, 200);
    assert.deepStrictEqual(await like.json(), { liked: true, likeCount: 1 });
  } finally { await t.close(); }
});
