'use strict';
// v0.2.21.0 用户主页 + 关注系统：GET /api/social/users/:id（头部+统计）、
// GET /api/social/users/:id/posts?tab=（帖子/转发/点赞/收藏四流）、POST/DELETE /api/social/users/:id/follow（幂等开关）。
// 口径：公共 GET 走 optionalViewer（不刷 DAU）；只认 active 用户，banned/deleted 一律 404。
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

// 建帖快捷（同测多帖需换内容——发帖 sha1 去重会拦重复文案）
async function makePost(t, who, content) {
  const r = await t.request('POST', '/api/social/posts', { content }, { cookie: who.cookie });
  assert.strictEqual(r.status, 200);
  return (await r.json()).post;
}

test('profile：匿名 GET 200 全形状（bio/gender 随行、stats 零值、isSelf/followedByMe false）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    t.db.prepare('UPDATE users SET bio = ?, gender = ? WHERE id = ?').run('热爱地理与国旗设计', 'Male', alice.user.id);
    const r = await t.request('GET', '/api/social/users/' + alice.user.id);
    assert.strictEqual(r.status, 200);
    const u = (await r.json()).user;
    assert.strictEqual(u.id, alice.user.id);
    assert.strictEqual(u.displayName, 'Alice');
    assert.ok(u.avatarUrl, 'avatar_url 随行');
    assert.strictEqual(u.bio, '热爱地理与国旗设计');
    assert.strictEqual(u.gender, 'Male');
    assert.ok(/^CIT-\d{6}$/.test(u.citizenId), 'citizenId 随行');
    assert.ok(u.createdAt, 'createdAt 随行');
    assert.strictEqual(u.isSelf, false);
    assert.strictEqual(u.followedByMe, false);
    assert.strictEqual(u.followerCount, 0);
    assert.strictEqual(u.followingCount, 0);
    assert.strictEqual(u.cardBg, null); // v0.2.23.0 卡片背景随行，默认 NULL
    assert.strictEqual(u.cardPlate, null); // v0.2.24.0 独立卡片背景随行，默认 NULL
    assert.strictEqual(u.pageBgImage, null); // v0.2.25.0 页面背景图片随行，默认 NULL
    // v0.2.22.6 点赞/收藏默认私人：非本人 likeCount/favoriteCount 为 null
    assert.deepStrictEqual(u.stats, { postCount: 0, repostCount: 0, likeReceivedCount: 0, likeCount: null, favoriteCount: null });
  } finally { await t.close(); }
});

test('profile：本人 cookie isSelf=true；他人 viewer isSelf=false', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    const mine = (await (await t.request('GET', '/api/social/users/' + alice.user.id, undefined, { cookie: alice.cookie })).json()).user;
    assert.strictEqual(mine.isSelf, true);
    const other = (await (await t.request('GET', '/api/social/users/' + alice.user.id, undefined, { cookie: bob.cookie })).json()).user;
    assert.strictEqual(other.isSelf, false);
  } finally { await t.close(); }
});

test('profile：未知/banned/deleted → 404；posts tab 同样 404', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    assert.strictEqual((await t.request('GET', '/api/social/users/USR-999999')).status, 404);
    assert.strictEqual((await t.request('GET', '/api/social/users/USR-999999/posts')).status, 404);
    const banned = t.loginAs('banned@x.com');
    t.db.prepare('UPDATE users SET status = ? WHERE id = ?').run('banned', banned.user.id);
    const rb = await t.request('GET', '/api/social/users/' + banned.user.id);
    assert.strictEqual(rb.status, 404);
    assert.strictEqual((await rb.json()).error.message, '用户不存在或已注销');
    const deleted = t.loginAs('deleted@x.com');
    t.db.prepare('UPDATE users SET status = ? WHERE id = ?').run('deleted', deleted.user.id);
    assert.strictEqual((await t.request('GET', '/api/social/users/' + deleted.user.id)).status, 404);
  } finally { await t.close(); }
});

test('profile：stats 准确（2 帖 + 1 转发 + 2 赞 + 1 收藏）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    const a1 = await makePost(t, alice, '我的第一帖');
    await makePost(t, alice, '我的第二帖');
    const bob1 = await makePost(t, bob, 'bob 帖一');
    const bob2 = await makePost(t, bob, 'bob 帖二');
    await t.request('POST', '/api/social/posts/' + bob1.id + '/repost', { content: '' }, { cookie: alice.cookie }); // 裸转发
    await t.request('POST', '/api/social/posts/' + bob1.id + '/like', undefined, { cookie: alice.cookie });
    await t.request('POST', '/api/social/posts/' + bob2.id + '/like', undefined, { cookie: alice.cookie });
    await t.request('POST', '/api/social/posts/' + bob2.id + '/favorite', undefined, { cookie: alice.cookie });
    await t.request('POST', '/api/social/posts/' + a1.id + '/like', undefined, { cookie: bob.cookie }); // bob 赞 alice 帖 → 获赞量 1
    // v0.2.22.6 点赞/收藏默认私人：本人视角才返回 likeCount/favoriteCount 实值
    const u = (await (await t.request('GET', '/api/social/users/' + alice.user.id, undefined, { cookie: alice.cookie })).json()).user;
    assert.deepStrictEqual(u.stats, { postCount: 2, repostCount: 1, likeReceivedCount: 1, likeCount: 2, favoriteCount: 1 });
  } finally { await t.close(); }
});

test('tab=posts：只本人非转发可见帖、新帖在前、likedByMe 按 viewer', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    const p1 = await makePost(t, alice, '帖一');
    const p2 = await makePost(t, alice, '帖二');
    await makePost(t, bob, '别人的帖'); // 不应出现
    await t.request('POST', '/api/social/posts/' + p2.id + '/like', undefined, { cookie: bob.cookie });
    const anon = (await (await t.request('GET', '/api/social/users/' + alice.user.id + '/posts')).json()).posts;
    assert.deepStrictEqual(anon.map((p) => p.id), [p2.id, p1.id], '新帖在前');
    assert.ok(anon.every((p) => p.authorId === alice.user.id && !p.repostOfId));
    assert.ok(anon.every((p) => p.likedByMe === false));
    assert.strictEqual(anon[0].likeCount, 1);
    const asBob = (await (await t.request('GET', '/api/social/users/' + alice.user.id + '/posts', undefined, { cookie: bob.cookie })).json()).posts;
    assert.strictEqual(asBob[0].likedByMe, true);
    assert.strictEqual(asBob[1].likedByMe, false);
  } finally { await t.close(); }
});

test('tab=reposts：只转发、repostOf 浅嵌一层', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
    const bobPost = await makePost(t, bob, '值得转发的原帖');
    await makePost(t, alice, '普通帖');
    const rp = await t.request('POST', '/api/social/posts/' + bobPost.id + '/repost', { content: '大家看看这条' }, { cookie: alice.cookie });
    assert.strictEqual(rp.status, 200);
    const reposts = (await (await t.request('GET', '/api/social/users/' + alice.user.id + '/posts?tab=reposts')).json()).posts;
    assert.strictEqual(reposts.length, 1);
    assert.strictEqual(reposts[0].repostOfId, bobPost.id);
    assert.ok(reposts[0].repostOf, 'repostOf 内嵌');
    assert.strictEqual(reposts[0].repostOf.content, '值得转发的原帖');
    assert.strictEqual(reposts[0].repostOf.authorName, 'Bob');
  } finally { await t.close(); }
});

test('tab=likes：他人帖、按点赞时间倒序', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    const pa = await makePost(t, bob, '被赞帖 A');
    const pb = await makePost(t, bob, '被赞帖 B');
    await t.request('POST', '/api/social/posts/' + pa.id + '/like', undefined, { cookie: alice.cookie });
    await t.request('POST', '/api/social/posts/' + pb.id + '/like', undefined, { cookie: alice.cookie });
    // 同毫秒点赞可能 created_at 撞车——直接落库固定顺序：A 旧 B 新
    t.db.prepare("UPDATE content_likes SET created_at = '2026-01-01T00:00:00.000Z' WHERE user_id = ? AND target_id = ?").run(alice.user.id, pa.id);
    t.db.prepare("UPDATE content_likes SET created_at = '2026-01-02T00:00:00.000Z' WHERE user_id = ? AND target_id = ?").run(alice.user.id, pb.id);
    // v0.2.22.6 点赞/收藏默认私人：本人视角请求
    const likes = (await (await t.request('GET', '/api/social/users/' + alice.user.id + '/posts?tab=likes', undefined, { cookie: alice.cookie })).json()).posts;
    assert.deepStrictEqual(likes.map((p) => p.id), [pb.id, pa.id], '按点赞时间倒序');
    assert.ok(likes.every((p) => p.authorId === bob.user.id && p.likedByMe === true));
  } finally { await t.close(); }
});

test('tab=favorites：收藏的帖子', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    const p1 = await makePost(t, bob, '收藏目标一');
    const p2 = await makePost(t, bob, '收藏目标二');
    await t.request('POST', '/api/social/posts/' + p2.id + '/favorite', undefined, { cookie: alice.cookie });
    // v0.2.22.6 点赞/收藏默认私人：本人视角请求
    const asAlice = (await (await t.request('GET', '/api/social/users/' + alice.user.id + '/posts?tab=favorites', undefined, { cookie: alice.cookie })).json()).posts;
    assert.deepStrictEqual(asAlice.map((p) => p.id), [p2.id]);
    assert.strictEqual(asAlice[0].favoritedByMe, true);
  } finally { await t.close(); }
});

test('v0.2.22.6 点赞/收藏默认私人：tab=likes/favorites 匿名/他人 403 + 本人 200', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    const p = await makePost(t, bob, '他人帖');
    await t.request('POST', '/api/social/posts/' + p.id + '/like', undefined, { cookie: alice.cookie });
    const anonL = await t.request('GET', '/api/social/users/' + alice.user.id + '/posts?tab=likes');
    assert.strictEqual(anonL.status, 403);
    assert.strictEqual((await anonL.json()).error.code, 'FORBIDDEN');
    const bobF = await t.request('GET', '/api/social/users/' + alice.user.id + '/posts?tab=favorites', undefined, { cookie: bob.cookie });
    assert.strictEqual(bobF.status, 403);
    const selfL = await t.request('GET', '/api/social/users/' + alice.user.id + '/posts?tab=likes', undefined, { cookie: alice.cookie });
    assert.strictEqual(selfL.status, 200);
    assert.strictEqual((await selfL.json()).posts.length, 1);
  } finally { await t.close(); }
});

test('v0.2.23.0 卡片背景：PATCH /auth/me 落库 + 非法键 400 + null 恢复默认 + 主页公开渲染', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const prof = (cookie) => t.request('GET', '/api/social/users/' + alice.user.id, undefined, cookie ? { cookie } : undefined).then((r) => r.json());
    assert.strictEqual((await prof()).user.cardBg, null, '默认 NULL');
    const r1 = await t.request('PATCH', '/api/auth/me', { cardBg: 'glass-ocean' }, { cookie: alice.cookie });
    assert.strictEqual(r1.status, 200);
    assert.strictEqual((await r1.json()).user.cardBg || null, null, 'PATCH 响应经 publicUser 不含 cardBg（主页端点权威）');
    assert.strictEqual((await prof()).user.cardBg, 'glass-ocean', '本人主页返回落库键');
    const anon = await t.request('GET', '/api/social/users/' + alice.user.id);
    assert.strictEqual((await anon.json()).user.cardBg, 'glass-ocean', '他人（匿名）也看到自定义背景——公开');
    const r2 = await t.request('PATCH', '/api/auth/me', { cardBg: 'hack-bg' }, { cookie: alice.cookie });
    assert.strictEqual(r2.status, 400, '白名单外键 400');
    assert.strictEqual((await r2.json()).error.code, 'VALIDATION');
    const r3 = await t.request('PATCH', '/api/auth/me', { cardBg: null }, { cookie: alice.cookie });
    assert.strictEqual(r3.status, 200, '显式 null = 恢复默认');
    assert.strictEqual((await prof()).user.cardBg, null);
  } finally { await t.close(); }
});

test('v0.2.24.0 独立卡片背景：cardPlate 落库 + 非法键 400 + null 恢复 + 公开渲染 + 与 cardBg 互不干扰', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const prof = (cookie) => t.request('GET', '/api/social/users/' + alice.user.id, undefined, cookie ? { cookie } : undefined).then((r) => r.json());
    assert.strictEqual((await prof()).user.cardPlate, null, '默认 NULL');
    const r1 = await t.request('PATCH', '/api/auth/me', { cardPlate: 'glass-rose' }, { cookie: alice.cookie });
    assert.strictEqual(r1.status, 200);
    assert.strictEqual((await r1.json()).user.cardPlate || null, null, 'PATCH 响应经 publicUser 不含 cardPlate（主页端点权威）');
    assert.strictEqual((await prof()).user.cardPlate, 'glass-rose', '本人主页返回落库键');
    const anon = await t.request('GET', '/api/social/users/' + alice.user.id);
    assert.strictEqual((await anon.json()).user.cardPlate, 'glass-rose', '他人（匿名）也看到卡片背景——公开');
    const r2 = await t.request('PATCH', '/api/auth/me', { cardPlate: 'hack-plate' }, { cookie: alice.cookie });
    assert.strictEqual(r2.status, 400, '白名单外键 400');
    assert.strictEqual((await r2.json()).error.code, 'VALIDATION');
    // 与 cardBg 互不干扰：各写各的，都保留
    await t.request('PATCH', '/api/auth/me', { cardBg: 'glass-ocean' }, { cookie: alice.cookie });
    assert.strictEqual((await prof()).user.cardPlate, 'glass-rose', 'cardBg 写入不碰 cardPlate');
    assert.strictEqual((await prof()).user.cardBg, 'glass-ocean');
    const r3 = await t.request('PATCH', '/api/auth/me', { cardPlate: null }, { cookie: alice.cookie });
    assert.strictEqual(r3.status, 200, '显式 null = 无背景层');
    assert.strictEqual((await prof()).user.cardPlate, null);
    assert.strictEqual((await prof()).user.cardBg, 'glass-ocean', 'cardPlate 清空不碰 cardBg');
    // v0.2.24.1 卡片背景只留 2 选项之一：标准液态玻璃（无色）键在白名单内可落库
    const r4 = await t.request('PATCH', '/api/auth/me', { cardPlate: 'glass-clear' }, { cookie: alice.cookie });
    assert.strictEqual(r4.status, 200, 'glass-clear 标准液态玻璃在白名单');
    assert.strictEqual((await prof()).user.cardPlate, 'glass-clear');
    assert.strictEqual((await prof()).user.cardBg, 'glass-ocean', '玻璃键写入不碰 cardBg');
  } finally { await t.close(); }
});

test('v0.2.25.0 页面背景图片：pageBgImage 落库 + 非法值 400 + null 恢复 + 公开渲染', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const prof = (cookie) => t.request('GET', '/api/social/users/' + alice.user.id, undefined, cookie ? { cookie } : undefined).then((r) => r.json());
    assert.strictEqual((await prof()).user.pageBgImage, null, '默认 NULL');
    const r1 = await t.request('PATCH', '/api/auth/me', { pageBgImage: '/uploads/UPL-X0001.jpg' }, { cookie: alice.cookie });
    assert.strictEqual(r1.status, 200, '本站上传路径合法');
    assert.strictEqual((await prof()).user.pageBgImage, '/uploads/UPL-X0001.jpg', '本人主页返回落库值');
    const anon = await t.request('GET', '/api/social/users/' + alice.user.id);
    assert.strictEqual((await anon.json()).user.pageBgImage, '/uploads/UPL-X0001.jpg', '他人（匿名）也看到整页背景——公开');
    const r2 = await t.request('PATCH', '/api/auth/me', { pageBgImage: 'https://img.example.com/bg.jpg' }, { cookie: alice.cookie });
    assert.strictEqual(r2.status, 200, 'https 外链合法');
    assert.strictEqual((await prof()).user.pageBgImage, 'https://img.example.com/bg.jpg');
    const r3 = await t.request('PATCH', '/api/auth/me', { pageBgImage: 'javascript:alert(1)' }, { cookie: alice.cookie });
    assert.strictEqual(r3.status, 400, 'javascript: 伪协议 400');
    assert.strictEqual((await r3.json()).error.code, 'VALIDATION');
    assert.strictEqual((await prof()).user.pageBgImage, 'https://img.example.com/bg.jpg', '非法值不落库');
    const r4 = await t.request('PATCH', '/api/auth/me', { pageBgImage: null }, { cookie: alice.cookie });
    assert.strictEqual(r4.status, 200, '显式 null = 无整页背景');
    assert.strictEqual((await prof()).user.pageBgImage, null);
  } finally { await t.close(); }
});

test('tab=bogus → 400 VALIDATION；缺省 tab 同 posts', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    await makePost(t, alice, '默认 tab 帖');
    const r = await t.request('GET', '/api/social/users/' + alice.user.id + '/posts?tab=bogus');
    assert.strictEqual(r.status, 400);
    assert.strictEqual((await r.json()).error.code, 'VALIDATION');
    const def = (await (await t.request('GET', '/api/social/users/' + alice.user.id + '/posts')).json()).posts;
    assert.strictEqual(def.length, 1, '缺省 tab=posts');
  } finally { await t.close(); }
});

test('hidden/removed 帖从全部 tab 排除（含被赞帖被下架）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    const ok = await makePost(t, alice, '可见帖');
    const hidden = await makePost(t, alice, '被隐藏帖');
    const removed = await makePost(t, alice, '被下架帖');
    const likedGone = await makePost(t, bob, '被赞后被下架');
    await t.request('POST', '/api/social/posts/' + likedGone.id + '/like', undefined, { cookie: alice.cookie });
    t.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('hidden', hidden.id);
    t.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('removed', removed.id);
    t.db.prepare('UPDATE posts SET status = ? WHERE id = ?').run('removed', likedGone.id);
    const base = '/api/social/users/' + alice.user.id + '/posts?tab=';
    for (const tab of ['posts', 'reposts', 'likes', 'favorites']) {
      const ids = (await (await t.request('GET', base + tab, undefined, { cookie: alice.cookie })).json()).posts.map((p) => p.id);
      assert.ok(!ids.includes(hidden.id) && !ids.includes(removed.id) && !ids.includes(likedGone.id), tab + ' 排除隐藏/下架');
      if (tab === 'posts') assert.deepStrictEqual(ids, [ok.id]);
    }
  } finally { await t.close(); }
});

test('follow：POST 200 + 幂等；DELETE 幂等；followerCount 同步', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    const r1 = await t.request('POST', '/api/social/users/' + alice.user.id + '/follow', undefined, { cookie: bob.cookie });
    assert.strictEqual(r1.status, 200);
    assert.deepStrictEqual(await r1.json(), { following: true, followerCount: 1 });
    const r2 = await t.request('POST', '/api/social/users/' + alice.user.id + '/follow', undefined, { cookie: bob.cookie });
    assert.deepStrictEqual(await r2.json(), { following: true, followerCount: 1 }, '重复关注幂等');
    const r3 = await t.request('DELETE', '/api/social/users/' + alice.user.id + '/follow', undefined, { cookie: bob.cookie });
    assert.deepStrictEqual(await r3.json(), { following: false, followerCount: 0 });
    const r4 = await t.request('DELETE', '/api/social/users/' + alice.user.id + '/follow', undefined, { cookie: bob.cookie });
    assert.deepStrictEqual(await r4.json(), { following: false, followerCount: 0 }, '重复取关幂等');
  } finally { await t.close(); }
});

test('follow：自关 400；banned/未知目标 404；无 cookie 401', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const self = await t.request('POST', '/api/social/users/' + alice.user.id + '/follow', undefined, { cookie: alice.cookie });
    assert.strictEqual(self.status, 400);
    assert.strictEqual((await self.json()).error.message, '不能关注自己');
    const banned = t.loginAs('banned@x.com');
    t.db.prepare('UPDATE users SET status = ? WHERE id = ?').run('banned', banned.user.id);
    assert.strictEqual((await t.request('POST', '/api/social/users/' + banned.user.id + '/follow', undefined, { cookie: alice.cookie })).status, 404);
    assert.strictEqual((await t.request('POST', '/api/social/users/USR-999999/follow', undefined, { cookie: alice.cookie })).status, 404);
    const noCookie = await t.request('POST', '/api/social/users/' + banned.user.id + '/follow');
    assert.strictEqual(noCookie.status, 401);
  } finally { await t.close(); }
});

test('follow：写限流（socialWrite 覆盖 2 → 第 3 次 429）', async () => {
  const t = await testApp({ config: { rateLimits: { socialWrite: { max: 2, windowMs: 60000 } } } });
  try {
    const alice = t.loginAs('alice@x.com');
    const b = t.loginAs('b@x.com');
    const c2 = t.loginAs('c@x.com');
    const d = t.loginAs('d@x.com');
    assert.strictEqual((await t.request('POST', '/api/social/users/' + b.user.id + '/follow', undefined, { cookie: alice.cookie })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/social/users/' + c2.user.id + '/follow', undefined, { cookie: alice.cookie })).status, 200);
    const third = await t.request('POST', '/api/social/users/' + d.user.id + '/follow', undefined, { cookie: alice.cookie });
    assert.strictEqual(third.status, 429);
    assert.strictEqual((await third.json()).error.code, 'RATE_LIMITED');
  } finally { await t.close(); }
});

test('follow 后 profile 反映 followedByMe/followerCount/followingCount（匿名无 followedByMe）', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com');
    await t.request('POST', '/api/social/users/' + alice.user.id + '/follow', undefined, { cookie: bob.cookie });
    await t.request('POST', '/api/social/users/' + bob.user.id + '/follow', undefined, { cookie: alice.cookie });
    const asBob = (await (await t.request('GET', '/api/social/users/' + alice.user.id, undefined, { cookie: bob.cookie })).json()).user;
    assert.strictEqual(asBob.followedByMe, true);
    assert.strictEqual(asBob.followerCount, 1);
    assert.strictEqual(asBob.followingCount, 1);
    const anon = (await (await t.request('GET', '/api/social/users/' + alice.user.id)).json()).user;
    assert.strictEqual(anon.followerCount, 1, '匿名也能看粉丝数');
    assert.strictEqual(anon.followedByMe, false);
  } finally { await t.close(); }
});

test('可选鉴权不记 activity：公共 profile/tab GET 不刷 DAU', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com');
    const bob = t.loginAs('bob@x.com'); // bob 零写入，纯公共 GET 观察者
    await makePost(t, alice, 'DAU 检查帖');
    const before = t.db.prepare('SELECT count(*) AS n FROM activity_daily WHERE user_id = ?').get(bob.user.id).n;
    await t.request('GET', '/api/social/users/' + alice.user.id, undefined, { cookie: bob.cookie });
    await t.request('GET', '/api/social/users/' + alice.user.id + '/posts', undefined, { cookie: bob.cookie });
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM activity_daily WHERE user_id = ?').get(bob.user.id).n, before);
  } finally { await t.close(); }
});
