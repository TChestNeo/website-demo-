'use strict';
// FC 工作台概览聚合（v0.2.58.26 Round 46）：GET /api/fc/overview。
// 口径：登录专属 401；累计 stats 全真；7d/28d 窗口计数+前窗 deltaPct+日序列（恰好 7/28 点）；
// month 自然月窗口结构断言；articles 含互动实时计数+wordCount（HTML 剥标签）；media 最新在前；
// posts content 截 80+media 原样数组；限流每用户。

const test = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

const isoAgo = (d) => new Date(Date.now() - d * 86400e3).toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function seedFollowing(t, userId, targetId, createdIso) {
  t.db.prepare(`INSERT INTO following (user_id, target_type, target_id, created_at) VALUES (?, 'user', ?, ?)`)
    .run(userId, targetId, createdIso);
}
function seedArticle(t, id, authorId, title, contentJson, status, createdIso) {
  t.db.prepare('INSERT INTO articles (id, author_id, title, content_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, authorId, title, contentJson, status, createdIso, createdIso);
}
function seedPost(t, id, authorId, content, status, createdIso, repostOf = null) {
  t.db.prepare('INSERT INTO posts (id, author_id, topic_id, content, media, status, created_at, updated_at, repost_of) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)')
    .run(id, authorId, content, '[]', status, createdIso, createdIso, repostOf);
}
function seedLike(t, userId, targetType, targetId, createdIso) {
  t.db.prepare('INSERT INTO content_likes (user_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, targetType, targetId, createdIso);
}
function seedFav(t, userId, targetType, targetId, createdIso) {
  t.db.prepare('INSERT INTO favorites (user_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, targetType, targetId, createdIso);
}
function seedShare(t, userId, targetType, targetId, createdIso) {
  t.db.prepare('INSERT INTO shares (user_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, targetType, targetId, createdIso);
}

test('fc-overview：无鉴权 401', async () => {
  const t = await testApp();
  try {
    const res = await t.request('GET', '/api/fc/overview');
    assert.strictEqual(res.status, 401);
  } finally {
    await t.close();
  }
});

test('fc-overview：零数据形状（空库全零/空数组/日序列补齐/pct 全 null）', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('empty@example.com');
    const res = await t.request('GET', '/api/fc/overview', undefined, { cookie });
    assert.strictEqual(res.status, 200);
    const b = await res.json();
    for (const k of ['followers', 'following', 'articles', 'articlesPublished', 'articleViews', 'articleLikes',
      'articleFavorites', 'articleShares', 'posts', 'postViews', 'postLikes', 'postFavorites', 'postShares',
      'repostsReceived', 'media']) {
      assert.strictEqual(b.stats[k], 0, k + ' 零');
    }
    assert.deepStrictEqual(b.articles, []);
    assert.deepStrictEqual(b.media, []);
    assert.deepStrictEqual(b.posts, []);
    assert.deepStrictEqual(Object.keys(b.windows), ['7d', '28d', 'month']);
    assert.strictEqual(b.windows['7d'].days.length, 7);
    assert.strictEqual(b.windows['28d'].days.length, 28);
    assert.ok(b.windows['month'].days.length >= 1 && b.windows['month'].days.length <= 31, '自然月内天数');
    assert.ok(b.windows['month'].from.endsWith('-01T00:00:00.000Z'), 'month from=1 号零时');
    for (const w of Object.values(b.windows)) {
      assert.strictEqual(w.newFollowers, 0);
      assert.strictEqual(w.newFollowersPct, null, '前窗零 → pct null');
      assert.strictEqual(w.interactionsReceived, 0);
      assert.ok(w.days.every((d) => d.followers === 0 && d.articles === 0 && d.posts === 0));
      assert.ok(w.days.every((d, i, a) => i === 0 || d.date > a[i - 1].date), '日期升序');
    }
    assert.strictEqual(b.windows['7d'].days[6].date, today(), '末位=今天');
  } finally {
    await t.close();
  }
});

test('fc-overview：累计 stats + 清单 + 窗口计数/前窗/deltaPct/日序列全对', async () => {
  const t = await testApp();
  try {
    const { user, cookie } = t.loginAs('me@example.com');
    const me = user.id;
    const f2 = t.loginAs('f@example.com').user.id;
    const f3 = t.loginAs('g@example.com').user.id;
    const f4 = t.loginAs('h@example.com').user.id;
    // 粉丝：窗内 2（isoAgo(2)/isoAgo(5)）+ 7d 前窗 1（f4 @ isoAgo(10) ∈ [14d,7d)）
    seedFollowing(t, f2, me, isoAgo(2));
    seedFollowing(t, f3, me, isoAgo(5));
    seedFollowing(t, f4, me, isoAgo(10));
    seedFollowing(t, f2, f3, isoAgo(10)); // 指向别人不计
    // 我关注 1
    seedFollowing(t, me, f2, isoAgo(3));
    // 文章：published ×2 + pending ×1（未发布）；views 30/20/5
    seedArticle(t, 'ART-000001', me, 'Charter', '{"v":9,"cards":[{"type":"content","content":"<h2>Hi</h2><p>Hello <b>World</b> 世界</p>"}]}', 'published', isoAgo(2));
    t.db.prepare('UPDATE articles SET view_count = 30 WHERE id = ?').run('ART-000001');
    seedArticle(t, 'ART-000002', me, 'Second', '[]', 'published', isoAgo(6));
    t.db.prepare('UPDATE articles SET view_count = 20 WHERE id = ?').run('ART-000002');
    seedArticle(t, 'ART-000003', me, 'Drafty', '[]', 'pending', isoAgo(6));
    t.db.prepare('UPDATE articles SET view_count = 5 WHERE id = ?').run('ART-000003');
    // 帖：visible ×2 + removed ×1 + 转发我帖 ×1；views 7/3
    seedPost(t, 'PST-000001', me, 'hello post', 'visible', isoAgo(2));
    seedPost(t, 'PST-000002', me, 'second', 'visible', isoAgo(3));
    seedPost(t, 'PST-000003', me, 'removed one', 'removed', isoAgo(2));
    seedPost(t, 'PST-000004', f2, 'repost of mine', 'visible', isoAgo(1), 'PST-000001');
    t.db.prepare('UPDATE posts SET view_count = 7 WHERE id = ?').run('PST-000001');
    t.db.prepare('UPDATE posts SET view_count = 3 WHERE id = ?').run('PST-000002');
    // 互动：窗内 帖赞 1+文赞 1+文藏 1；前窗 帖赞 1（isoAgo(10)）；他人帖赞 1（排除）；文转 2
    seedLike(t, f2, 'post', 'PST-000001', isoAgo(2));
    seedLike(t, f3, 'article', 'ART-000001', isoAgo(2));
    seedFav(t, f2, 'article', 'ART-000001', isoAgo(2));
    seedLike(t, f2, 'post', 'PST-000002', isoAgo(10));
    seedLike(t, f2, 'post', 'PST-000004', isoAgo(2));
    seedShare(t, f2, 'article', 'ART-000001', isoAgo(2));
    seedShare(t, f3, 'article', 'ART-000001', isoAgo(3));
    // 上传：2 条（后插最新）
    const webmAt = isoAgo(1);
    t.db.prepare('INSERT INTO uploads (id, owner_id, ext, mime, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('UPL-000001', me, 'png', 'image/png', 100, isoAgo(5));
    t.db.prepare('INSERT INTO uploads (id, owner_id, ext, mime, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('UPL-000002', me, 'webm', 'video/webm', 999, webmAt);

    const b = await (await t.request('GET', '/api/fc/overview', undefined, { cookie })).json();

    // 累计
    assert.strictEqual(b.stats.followers, 3, 'f2/f3/f4（f2→f3 不计）');
    assert.strictEqual(b.stats.following, 1);
    assert.strictEqual(b.stats.articles, 3);
    assert.strictEqual(b.stats.articlesPublished, 2);
    assert.strictEqual(b.stats.articleViews, 55);
    assert.strictEqual(b.stats.articleLikes, 1);
    assert.strictEqual(b.stats.articleFavorites, 1);
    assert.strictEqual(b.stats.articleShares, 2);
    assert.strictEqual(b.stats.posts, 2, 'visible 非转发（removed/转发排除）');
    assert.strictEqual(b.stats.postViews, 10);
    assert.strictEqual(b.stats.postLikes, 2, '我的两帖各 1（他人帖赞排除）');
    assert.strictEqual(b.stats.repostsReceived, 1);
    assert.strictEqual(b.stats.media, 2);

    // 文章清单（seq DESC 最新在前）+ wordCount
    assert.strictEqual(b.articles.length, 3);
    assert.strictEqual(b.articles[0].id, 'ART-000003');
    assert.strictEqual(b.articles[2].id, 'ART-000001');
    assert.strictEqual(b.articles[2].viewCount, 30);
    assert.strictEqual(b.articles[2].likeCount, 1);
    assert.strictEqual(b.articles[2].favoriteCount, 1);
    assert.strictEqual(b.articles[2].shareCount, 2);
    assert.strictEqual(b.articles[2].wordCount, 4, 'Hi/Hello/World/世界');
    assert.strictEqual(b.articles[0].wordCount, 0);

    // 媒体清单最新在前
    assert.strictEqual(b.media.length, 2);
    assert.strictEqual(b.media[0].id, 'UPL-000002');
    assert.deepStrictEqual(b.media[0], { id: 'UPL-000002', ext: 'webm', mime: 'video/webm', bytes: 999, createdAt: webmAt });

    // 帖子清单
    assert.strictEqual(b.posts.length, 2);
    assert.strictEqual(b.posts[0].id, 'PST-000002');
    assert.strictEqual(b.posts[0].content, 'second');
    assert.deepStrictEqual(b.posts[0].media, []);
    assert.strictEqual(b.posts[0].viewCount, 3);

    // 7d 窗口
    const w7 = b.windows['7d'];
    assert.strictEqual(w7.newFollowers, 2);
    assert.strictEqual(w7.newFollowersPrev, 1, 'isoAgo(10) 落在 [14d,7d) 前窗');
    assert.strictEqual(w7.newFollowersPct, 100);
    assert.strictEqual(w7.articlesCreated, 3, '2/6/6 天前三篇全落 7d 窗（pending 也算创建）');
    assert.strictEqual(w7.postsCreated, 2, 'removed 排除、转发排除');
    assert.strictEqual(w7.interactionsReceived, 3, '2 赞 + 1 藏（他人帖赞排除）');
    assert.strictEqual(w7.interactionsReceivedPrev, 1, 'isoAgo(10) 帖赞');
    assert.strictEqual(w7.interactionsReceivedPct, 200);
    assert.strictEqual(w7.days.length, 7);
    assert.strictEqual(w7.days.reduce((s, d) => s + d.followers, 0), 2, '序列和=窗内新粉');
    assert.strictEqual(w7.days.reduce((s, d) => s + d.articles, 0), 3);
    assert.strictEqual(w7.days.reduce((s, d) => s + d.posts, 0), 2);
    assert.strictEqual(w7.days[6].date, today());

    // 28d 窗口（含 7d 前窗行）
    const w28 = b.windows['28d'];
    assert.strictEqual(w28.newFollowers, 3, '2+isoAgo(10) 入 28d 窗');
    assert.strictEqual(w28.articlesCreated, 3);
    assert.strictEqual(w28.postsCreated, 2);
    assert.strictEqual(w28.interactionsReceived, 4);
    assert.strictEqual(w28.days.length, 28);

    // month 窗口：结构 + 与 from/to 一致性（月首起）
    const wm = b.windows['month'];
    assert.ok(wm.from.endsWith('-01T00:00:00.000Z'));
    assert.strictEqual(wm.to.slice(0, 10), today());
    assert.strictEqual(wm.days.length, wm.days.filter((d) => d.date >= wm.from.slice(0, 10) && d.date <= today()).length);
  } finally {
    await t.close();
  }
});

test('fc-overview：posts content 截 80 字 + media JSON 原样透传', async () => {
  const t = await testApp();
  try {
    const { user, cookie } = t.loginAs('long@example.com');
    const me = user.id;
    const long = '字'.repeat(120);
    t.db.prepare('INSERT INTO posts (id, author_id, topic_id, content, media, status, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)')
      .run('PST-000009', me, long, JSON.stringify([{ url: '/uploads/UPL-000099.jpg', type: 'image' }]), 'visible', isoAgo(1), isoAgo(1));
    const b = await (await t.request('GET', '/api/fc/overview', undefined, { cookie })).json();
    assert.strictEqual(b.posts.length, 1);
    assert.strictEqual(b.posts[0].content.length, 80, '截 80');
    assert.deepStrictEqual(b.posts[0].media, [{ url: '/uploads/UPL-000099.jpg', type: 'image' }]);
  } finally {
    await t.close();
  }
});

test('fc-overview：限流（30/min 默认可覆盖）→ 第 3 次 429', async () => {
  const t = await testApp({ config: { rateLimits: { fcOverview: { max: 2, windowMs: 60000 } } } });
  try {
    const { cookie } = t.loginAs('rl@example.com');
    assert.strictEqual((await t.request('GET', '/api/fc/overview', undefined, { cookie })).status, 200);
    assert.strictEqual((await t.request('GET', '/api/fc/overview', undefined, { cookie })).status, 200);
    const r3 = await t.request('GET', '/api/fc/overview', undefined, { cookie });
    assert.strictEqual(r3.status, 429);
    assert.strictEqual((await r3.json()).error.code, 'RATE_LIMITED');
  } finally {
    await t.close();
  }
});
