'use strict';
// v0.2.17.0 互动端点测试：单帖详情 GET /:id、幂等点赞 POST/DELETE /:id/like、
// 评论 GET/POST /:id/comments（一层回复 + L0 先发后审 + 去重/处罚/限流）+ 公共 GET 可选鉴权（likedByMe）。
// v0.2.49.0：获得类经验（获得赞 +15/获得评论 +10，后端实时记 users.xp_gained；自操作/removed 不记）。
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

const CLEAN = '我的新国家正式成立，欢迎各位外交官来访交流';
const CLEAN_COMMENT = '祝贺开国，期待建交';

// 建帖快捷（默认 alice；同测多帖需换内容——发帖 sha1 去重会拦重复文案）
async function makePost(t, who, content = CLEAN) {
  const r = await t.request('POST', '/api/social/posts', { content }, { cookie: who.cookie });
  assert.strictEqual(r.status, 200);
  return (await r.json()).post;
}

test('GET /:id：匿名详情 200 + avatarUrl 随行 + 计数零值', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const post = await makePost(t, alice);
    const r = await t.request('GET', '/api/social/posts/' + post.id);
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.strictEqual(body.post.id, post.id);
    assert.strictEqual(body.post.authorName, 'Alice');
    assert.strictEqual(body.post.content, CLEAN);
    assert.ok(body.post.avatarUrl, 'users.avatar_url 随行（头像零后端工作）');
    assert.strictEqual(body.post.likeCount, 0);
    assert.strictEqual(body.post.commentCount, 0);
    assert.strictEqual(body.post.likedByMe, false);
  } finally { await t.close(); }
});

test('GET /:id：hidden / removed / 不存在 → 404 NOT_FOUND', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const post = await makePost(t, alice);
    t.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('hidden', post.id);
    assert.strictEqual((await t.request('GET', '/api/social/posts/' + post.id)).status, 404);
    t.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('removed', post.id);
    const r2 = await t.request('GET', '/api/social/posts/' + post.id);
    assert.strictEqual(r2.status, 404);
    assert.strictEqual((await r2.json()).error.code, 'NOT_FOUND');
    assert.strictEqual((await t.request('GET', '/api/social/posts/PST-999999')).status, 404);
  } finally { await t.close(); }
});

test('feed 可选鉴权：匿名 false / 本人 true / 坏 cookie 匿名 / banned 匿名 / 不记 activity', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const post = await makePost(t, alice);
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    await t.request('POST', '/api/social/posts/' + post.id + '/like', undefined, { cookie: bob.cookie });
    // 匿名
    const anon = (await (await t.request('GET', '/api/social/posts')).json()).posts.find(p => p.id === post.id);
    assert.strictEqual(anon.likeCount, 1);
    assert.strictEqual(anon.likedByMe, false);
    // 本人 cookie
    const mine = (await (await t.request('GET', '/api/social/posts', undefined, { cookie: bob.cookie })).json()).posts.find(p => p.id === post.id);
    assert.strictEqual(mine.likedByMe, true);
    // 坏 cookie → 匿名化
    const bad = (await (await t.request('GET', '/api/social/posts', undefined, { cookie: 'mn_session=garbage' })).json()).posts.find(p => p.id === post.id);
    assert.strictEqual(bad.likedByMe, false);
    // banned 用户 cookie → 匿名化（不 403，公共契约不破）
    const carol = t.loginAs('carol@x.com', { displayName: 'Carol' });
    t.db.prepare('UPDATE users SET status = ? WHERE id = ?').run('banned', carol.user.id);
    const banned = (await (await t.request('GET', '/api/social/posts', undefined, { cookie: carol.cookie })).json()).posts.find(p => p.id === post.id);
    assert.strictEqual(banned.likedByMe, false);
    // 可选鉴权不记 activity：dave 只走公共 GET，activity_daily 无行（authenticate 才会记）
    const dave = t.loginAs('dave@x.com', { displayName: 'Dave' });
    await t.request('GET', '/api/social/posts', undefined, { cookie: dave.cookie });
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM activity_daily WHERE user_id = ?').get(dave.user.id).n, 0);
    // 对照：点赞走 requireSession → authenticate 记 activity
    assert.ok(t.db.prepare('SELECT count(*) AS n FROM activity_daily WHERE user_id = ?').get(bob.user.id).n > 0);
  } finally { await t.close(); }
});

test('点赞幂等：POST×2 计数不变、多用户累加、DELETE×2 归零', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const post = await makePost(t, alice);
    const l1 = await (await t.request('POST', '/api/social/posts/' + post.id + '/like', undefined, { cookie: bob.cookie })).json();
    assert.deepStrictEqual(l1, { liked: true, likeCount: 1 });
    const l2 = await (await t.request('POST', '/api/social/posts/' + post.id + '/like', undefined, { cookie: bob.cookie })).json();
    assert.deepStrictEqual(l2, { liked: true, likeCount: 1 }); // INSERT OR IGNORE 幂等
    const l3 = await (await t.request('POST', '/api/social/posts/' + post.id + '/like', undefined, { cookie: alice.cookie })).json();
    assert.deepStrictEqual(l3, { liked: true, likeCount: 2 });
    const d1 = await (await t.request('DELETE', '/api/social/posts/' + post.id + '/like', undefined, { cookie: bob.cookie })).json();
    assert.deepStrictEqual(d1, { liked: false, likeCount: 1 });
    const d2 = await (await t.request('DELETE', '/api/social/posts/' + post.id + '/like', undefined, { cookie: bob.cookie })).json();
    assert.deepStrictEqual(d2, { liked: false, likeCount: 1 }); // DELETE 幂等
    // analytics 免费联动：content_likes 按 target_type='post' 落库
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM content_likes WHERE target_type = 'post'").get().n, 1);
  } finally { await t.close(); }
});

test('点赞错误：匿名 401；hidden / removed 帖 404', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const post = await makePost(t, alice);
    assert.strictEqual((await t.request('POST', '/api/social/posts/' + post.id + '/like')).status, 401);
    assert.strictEqual((await t.request('DELETE', '/api/social/posts/' + post.id + '/like')).status, 401);
    t.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('hidden', post.id);
    assert.strictEqual((await t.request('POST', '/api/social/posts/' + post.id + '/like', undefined, { cookie: alice.cookie })).status, 404);
    t.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('removed', post.id);
    assert.strictEqual((await t.request('POST', '/api/social/posts/' + post.id + '/like', undefined, { cookie: alice.cookie })).status, 404);
  } finally { await t.close(); }
});

test('评论 pass → visible + CMT- id + 先发后审 queued', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const post = await makePost(t, alice);
    const r = await t.request('POST', '/api/social/posts/' + post.id + '/comments', { content: CLEAN_COMMENT }, { cookie: bob.cookie });
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.match(body.comment.id, /^CMT-\d{6}$/);
    assert.strictEqual(body.comment.postId, post.id);
    assert.strictEqual(body.comment.parentId, null);
    assert.strictEqual(body.comment.authorName, 'Bob');
    assert.ok(body.comment.avatarUrl);
    assert.strictEqual(body.comment.content, CLEAN_COMMENT);
    assert.strictEqual(body.moderation.verdict, 'pass');
    const item = t.db.prepare('SELECT * FROM moderation_items WHERE target_id = ?').get(body.comment.id);
    assert.strictEqual(item.kind, 'text');
    assert.strictEqual(item.status, 'queued'); // 夜间批处理先发后审
    // 列表立即可见 + 帖子计数联动
    const list = (await (await t.request('GET', '/api/social/posts/' + post.id + '/comments')).json()).comments;
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, body.comment.id);
    const detail = (await (await t.request('GET', '/api/social/posts/' + post.id)).json()).post;
    assert.strictEqual(detail.commentCount, 1);
  } finally { await t.close(); }
});

test('评论偏好：allow_comments=false 拒绝他人，但作者仍可评论自己的帖子', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('comment-owner-pref@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('comment-visitor-pref@x.com', { displayName: 'Bob' });
    const post = await makePost(t, alice);
    t.db.prepare('UPDATE users SET preferences = ? WHERE id = ?')
      .run(JSON.stringify({ allow_comments: false }), alice.user.id);

    const blocked = await t.request('POST', '/api/social/posts/' + post.id + '/comments',
      { content: '这条评论应被偏好设置拦截' }, { cookie: bob.cookie });
    assert.strictEqual(blocked.status, 403);
    assert.strictEqual((await blocked.json()).error.code, 'FORBIDDEN');
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM comments WHERE post_id = ?').get(post.id).n, 0);

    const own = await t.request('POST', '/api/social/posts/' + post.id + '/comments',
      { content: '作者自己的补充说明' }, { cookie: alice.cookie });
    assert.strictEqual(own.status, 200);
  } finally { await t.close(); }
});

test('评论零容忍 → removed + 封号 + 决策/通知 + 列表不出现', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const post = await makePost(t, alice);
    const r = await t.request('POST', '/api/social/posts/' + post.id + '/comments', { content: '我这里可以代开发票，欢迎联系' }, { cookie: bob.cookie });
    const body = await r.json();
    assert.strictEqual(body.comment.status, 'removed');
    assert.strictEqual(body.moderation.reasonCode, 'zero_tolerance');
    assert.strictEqual(t.db.prepare('SELECT status FROM users WHERE id = ?').get(bob.user.id).status, 'banned');
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM user_sessions WHERE user_id = ?').get(bob.user.id).n, 0);
    const d = t.db.prepare('SELECT * FROM moderation_decisions').get();
    assert.strictEqual(d.action, 'ban');
    assert.ok(t.db.prepare('SELECT count(*) AS n FROM notifications WHERE user_id = ?').get(bob.user.id).n > 0);
    const list = (await (await t.request('GET', '/api/social/posts/' + post.id + '/comments')).json()).comments;
    assert.strictEqual(list.length, 0);
    // v0.2.49.0：removed 评论（零容忍）不记经验
    assert.strictEqual(t.db.prepare('SELECT xp_gained FROM users WHERE id = ?').get(alice.user.id).xp_gained, 0);
  } finally { await t.close(); }
});

test('评论 warning 词 → visible 先发后审 + l0_hold 人工', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const post = await makePost(t, alice);
    const body = await (await t.request('POST', '/api/social/posts/' + post.id + '/comments', { content: '你真是个傻逼' }, { cookie: bob.cookie })).json();
    assert.strictEqual(body.comment.status, 'visible');
    assert.strictEqual(body.moderation.verdict, 'hold');
    const item = t.db.prepare('SELECT * FROM moderation_items WHERE target_id = ?').get(body.comment.id);
    assert.strictEqual(item.status, 'l0_hold');
    // v0.2.49.0：hold 评论 status='visible'（先发后审）→ 照记 +10
    assert.strictEqual(t.db.prepare('SELECT xp_gained FROM users WHERE id = ?').get(alice.user.id).xp_gained, 10);
  } finally { await t.close(); }
});

test('一层回复：回显 parentId；回复的回复 400；跨帖/不存在 parentId 400；帖不存在 404', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const carol = t.loginAs('carol@x.com', { displayName: 'Carol' });
    const post1 = await makePost(t, alice);
    const post2 = await makePost(t, alice, '第二篇公告：边境口岸下周开放');
    const c1 = (await (await t.request('POST', '/api/social/posts/' + post1.id + '/comments', { content: '顶层评论' }, { cookie: bob.cookie })).json()).comment;
    const c2 = (await (await t.request('POST', '/api/social/posts/' + post1.id + '/comments', { content: '回复顶层', parentId: c1.id }, { cookie: carol.cookie })).json()).comment;
    assert.strictEqual(c2.parentId, c1.id);
    // 回复的回复 → 400
    const deep = await t.request('POST', '/api/social/posts/' + post1.id + '/comments', { content: '二级回复', parentId: c2.id }, { cookie: bob.cookie });
    assert.strictEqual(deep.status, 400);
    assert.strictEqual((await deep.json()).error.code, 'VALIDATION');
    // 别帖的评论当 parent → 400
    const cx = (await (await t.request('POST', '/api/social/posts/' + post2.id + '/comments', { content: '别帖评论' }, { cookie: bob.cookie })).json()).comment;
    const cross = await t.request('POST', '/api/social/posts/' + post1.id + '/comments', { content: '跨帖回复', parentId: cx.id }, { cookie: carol.cookie });
    assert.strictEqual(cross.status, 400);
    // 不存在 parentId → 400；帖子不存在 → 404
    assert.strictEqual((await t.request('POST', '/api/social/posts/' + post1.id + '/comments', { content: '回复幽灵', parentId: 'CMT-999999' }, { cookie: carol.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/social/posts/PST-999999/comments', { content: '幽灵帖' }, { cookie: carol.cookie })).status, 404);
  } finally { await t.close(); }
});

test('评论校验/限流/匿名：空 400、2001 字 400、匿名 401、commentWrite 第 5 条 429', async () => {
  const t = await testApp({ config: { rateLimits: { commentWrite: { max: 4, windowMs: 60000 } } } });
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const post = await makePost(t, alice);
    assert.strictEqual((await t.request('POST', '/api/social/posts/' + post.id + '/comments', { content: '   ' }, { cookie: bob.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/social/posts/' + post.id + '/comments', { content: 'x'.repeat(2001) }, { cookie: bob.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/social/posts/' + post.id + '/comments', { content: '匿名评论' })).status, 401);
    // 限流在入口先计数（无效尝试也占配额，防探测——与发帖同口径）
    assert.strictEqual((await t.request('POST', '/api/social/posts/' + post.id + '/comments', { content: '第 1 条' }, { cookie: bob.cookie })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/social/posts/' + post.id + '/comments', { content: '第 2 条' }, { cookie: bob.cookie })).status, 200);
    const third = await t.request('POST', '/api/social/posts/' + post.id + '/comments', { content: '第 3 条' }, { cookie: bob.cookie });
    assert.strictEqual(third.status, 429);
    assert.strictEqual((await third.json()).error.code, 'RATE_LIMITED');
  } finally { await t.close(); }
});

test('评论处罚/去重：禁言 403；24h 同作者同内容 403', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const post = await makePost(t, alice);
    assert.strictEqual((await t.request('POST', '/api/social/posts/' + post.id + '/comments', { content: CLEAN_COMMENT }, { cookie: bob.cookie })).status, 200);
    // 禁言
    t.db.prepare('UPDATE users SET muted_until = ? WHERE id = ?')
      .run(new Date(Date.now() + 3600e3).toISOString(), bob.user.id);
    const muted = await t.request('POST', '/api/social/posts/' + post.id + '/comments', { content: '别的内容' }, { cookie: bob.cookie });
    assert.strictEqual(muted.status, 403);
    assert.strictEqual((await muted.json()).error.code, 'RESTRICTED');
    // 解禁后重复内容（trim 变体）→ 评论版去重 403（换表自写，与帖去重同口径）
    t.db.prepare('UPDATE users SET muted_until = NULL WHERE id = ?').run(bob.user.id);
    const dup = await t.request('POST', '/api/social/posts/' + post.id + '/comments', { content: '  ' + CLEAN_COMMENT }, { cookie: bob.cookie });
    assert.strictEqual(dup.status, 403);
    assert.strictEqual((await dup.json()).error.code, 'RESTRICTED');
  } finally { await t.close(); }
});

test('GET comments：created_at ASC + 仅 visible；hidden/removed 不出 + commentCount 只数 visible；帖非 visible 404', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const post = await makePost(t, alice);
    const ins = t.db.prepare('INSERT INTO comments (id, post_id, author_id, content, status, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    ins.run('CMT-100002', post.id, alice.user.id, '较晚的可见评论', 'visible', '2026-08-02T00:00:00Z');
    ins.run('CMT-100001', post.id, alice.user.id, '较早的可见评论', 'visible', '2026-08-01T00:00:00Z');
    ins.run('CMT-100003', post.id, alice.user.id, '被隐藏', 'hidden', '2026-08-03T00:00:00Z');
    ins.run('CMT-100004', post.id, alice.user.id, '被删除', 'removed', '2026-08-04T00:00:00Z');
    const list = (await (await t.request('GET', '/api/social/posts/' + post.id + '/comments')).json()).comments;
    assert.deepStrictEqual(list.map(c => c.id), ['CMT-100001', 'CMT-100002']);
    assert.strictEqual(list[0].content, '较早的可见评论');
    const detail = (await (await t.request('GET', '/api/social/posts/' + post.id)).json()).post;
    assert.strictEqual(detail.commentCount, 2);
    t.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('hidden', post.id);
    assert.strictEqual((await t.request('GET', '/api/social/posts/' + post.id + '/comments')).status, 404);
  } finally { await t.close(); }
});

test('v0.2.49.0 获得赞经验：新赞 +15 给作者；自赞/重复赞 0；取消赞不扣', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const post = await makePost(t, alice);
    const xp = (id) => t.db.prepare('SELECT xp_gained FROM users WHERE id = ?').get(id).xp_gained;
    await t.request('POST', '/api/social/posts/' + post.id + '/like', undefined, { cookie: bob.cookie });
    assert.strictEqual(xp(alice.user.id), 15, '新赞给作者 +15');
    assert.strictEqual(xp(bob.user.id), 0, '赞人方不记');
    await t.request('POST', '/api/social/posts/' + post.id + '/like', undefined, { cookie: bob.cookie });
    assert.strictEqual(xp(alice.user.id), 15, '重复赞不二次记');
    await t.request('DELETE', '/api/social/posts/' + post.id + '/like', undefined, { cookie: bob.cookie });
    assert.strictEqual(xp(alice.user.id), 15, '取消赞不扣回（只进不出）');
    await t.request('POST', '/api/social/posts/' + post.id + '/like', undefined, { cookie: alice.cookie });
    assert.strictEqual(xp(alice.user.id), 15, '自赞不记');
  } finally { await t.close(); }
});

test('v0.2.49.0 获得评论经验：visible 评论 +10 给作者；自评 0；多评论累加', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const post = await makePost(t, alice);
    const xp = (id) => t.db.prepare('SELECT xp_gained FROM users WHERE id = ?').get(id).xp_gained;
    await t.request('POST', '/api/social/posts/' + post.id + '/comments', { content: CLEAN_COMMENT }, { cookie: bob.cookie });
    assert.strictEqual(xp(alice.user.id), 10, '获得评论 +10');
    await t.request('POST', '/api/social/posts/' + post.id + '/comments', { content: '第二个评论：期待贵国国庆阅兵' }, { cookie: bob.cookie });
    assert.strictEqual(xp(alice.user.id), 20, '每条评论各 +10');
    // 自评（alice 评自己的帖）不记
    await t.request('POST', '/api/social/posts/' + post.id + '/comments', { content: '自己的帖自己顶' }, { cookie: alice.cookie });
    assert.strictEqual(xp(alice.user.id), 20, '自评不记');
  } finally { await t.close(); }
});
