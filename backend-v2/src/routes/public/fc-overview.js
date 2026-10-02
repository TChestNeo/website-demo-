'use strict';
// FC 工作台概览聚合（v0.2.58.26 Round 46：FC 演示数据全移除接真数据）：GET /api/fc/overview。
// 登录专属（requireSession）；纯读聚合零迁移；轻限流（每用户）。
// 一次请求返回工作台各区块所需全部真实数据（前端渲染器一律纯读、切 period 零重拉）：
//   stats   累计：followers/following/articles/posts/views/likes/favorites/shares/reposts/media；
//   windows 三窗口（7d/28d/month 自然月）计数 + 等长前窗对比（deltaPct 前窗零→null）+ 日序列（fillDays 补齐）；
//   articles 本人文章（全部状态，含 viewCount/likeCount/favoriteCount/shareCount/wordCount）；
//   media   本人上传（uploads 表，最新在前）；posts 本人可见帖（CL 社区条目用，media 原样数组）。
// 口径：帖子计数 status='visible'（social.js 同口径）；互动实时查 content_likes/favorites/shares（死计数列零读写）。
// wordCount=content_json 卡片正文 HTML 剥标签后词数（含 CJK 单字算词）——真实衍生值。

const { sendJson, HttpError } = require('../../http');
const { requireSession } = require('../../middleware/auth');
const { rangeWindow, fillDays } = require('../../analytics/window');

function articleWordCount(contentJson) {
  try {
    const d = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson;
    const cards = (d && d.cards) || [];
    const text = cards.map((c) => (typeof c.content === 'string' ? c.content : '')).join(' ');
    const plain = text.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ');
    const words = plain.match(/[\w一-鿿]+/g);
    return words ? words.length : 0;
  } catch (e) { return 0; }
}

function monthWindow(now) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return rangeWindow('custom', start.toISOString(), now.toISOString());
}

// 等长前窗（activity-stats 先例）：[fromMs-len, fromMs)
function prevWindowOf(wnd) {
  const len = wnd.toMs - wnd.fromMs;
  return rangeWindow('custom', new Date(wnd.fromMs - len).toISOString(), new Date(wnd.fromMs - 1).toISOString());
}

function pct(cur, prev) { return prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null; }

function count(db, sql, params) { return db.prepare(sql).get(...params).n; }

// 本人内容互动（content_likes/favorites/shares 窗口内收到）——target IN 本人帖 ∪ 本人文章
function receivedCount(db, table, userId, fromIso, toIso) {
  return count(db,
    `SELECT count(*) AS n FROM ${table} x WHERE x.created_at >= ? AND x.created_at < ?
     AND ((x.target_type = 'post' AND x.target_id IN (SELECT id FROM posts WHERE author_id = ?))
       OR (x.target_type = 'article' AND x.target_id IN (SELECT id FROM articles WHERE author_id = ?)))`,
    [fromIso, toIso, userId, userId]);
}

// 日序列起点：7d/28d → 恰好 N 个自然日（今天 + N-1 天）；month → 自然月 1 号（月内迄今）
function seriesFromDate(wnd, rangeKey) {
  if (rangeKey === 'month') return wnd.fromDate;
  const N = rangeKey === '7d' ? 7 : 28;
  const d = new Date(wnd.toDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - (N - 1));
  return d.toISOString().slice(0, 10);
}

function win(db, userId, wnd, seriesFrom) {
  const from = wnd.fromIso, to = wnd.toIso;
  const prev = prevWindowOf(wnd);
  const c = (sql) => count(db, sql, [userId, from, to]);
  const cPrev = (sql) => count(db, sql, [userId, prev.fromIso, prev.toIso]);

  const newFollowers = c(`SELECT count(*) AS n FROM following WHERE target_type = 'user' AND target_id = ? AND created_at >= ? AND created_at < ?`);
  const newFollowersPrev = cPrev(`SELECT count(*) AS n FROM following WHERE target_type = 'user' AND target_id = ? AND created_at >= ? AND created_at < ?`);
  const articlesCreated = c(`SELECT count(*) AS n FROM articles WHERE author_id = ? AND created_at >= ? AND created_at < ?`);
  const articlesCreatedPrev = cPrev(`SELECT count(*) AS n FROM articles WHERE author_id = ? AND created_at >= ? AND created_at < ?`);
  const postsCreated = c(`SELECT count(*) AS n FROM posts WHERE author_id = ? AND status = 'visible' AND repost_of IS NULL AND created_at >= ? AND created_at < ?`);
  const postsCreatedPrev = cPrev(`SELECT count(*) AS n FROM posts WHERE author_id = ? AND status = 'visible' AND repost_of IS NULL AND created_at >= ? AND created_at < ?`);
  const interactions = receivedCount(db, 'content_likes', userId, from, to) + receivedCount(db, 'favorites', userId, from, to);
  const interactionsPrev = receivedCount(db, 'content_likes', userId, prev.fromIso, prev.toIso) + receivedCount(db, 'favorites', userId, prev.fromIso, prev.toIso);

  // 日序列（fillDays 零值连续；GROUP BY 日；窗口=seriesFrom..toDate 恰好 N 点）
  const dayMap = (sql) => {
    const m = new Map();
    for (const r of db.prepare(sql).all(userId, seriesFrom, to)) m.set(r.d.slice(0, 10), r.n);
    return m;
  };
  const follDays = dayMap(`SELECT date(created_at) AS d, count(*) AS n FROM following WHERE target_type = 'user' AND target_id = ? AND created_at >= ? AND created_at < ? GROUP BY d`);
  const artDays = dayMap(`SELECT date(created_at) AS d, count(*) AS n FROM articles WHERE author_id = ? AND created_at >= ? AND created_at < ? GROUP BY d`);
  const postDays = dayMap(`SELECT date(created_at) AS d, count(*) AS n FROM posts WHERE author_id = ? AND status = 'visible' AND repost_of IS NULL AND created_at >= ? AND created_at < ? GROUP BY d`);
  const days = fillDays(seriesFrom, wnd.toDate, new Map(), ['followers', 'articles', 'posts']).map((r) => ({
    date: r.date,
    followers: follDays.get(r.date) || 0,
    articles: artDays.get(r.date) || 0,
    posts: postDays.get(r.date) || 0
  }));

  return {
    from, to,
    newFollowers, newFollowersPrev, newFollowersPct: pct(newFollowers, newFollowersPrev),
    articlesCreated, articlesCreatedPrev, articlesCreatedPct: pct(articlesCreated, articlesCreatedPrev),
    postsCreated, postsCreatedPrev, postsCreatedPct: pct(postsCreated, postsCreatedPrev),
    interactionsReceived: interactions, interactionsReceivedPrev: interactionsPrev,
    interactionsReceivedPct: pct(interactions, interactionsPrev),
    days
  };
}

function register(router, ctx) {
  const db = ctx.db;

  router.add('GET', '/api/fc/overview', requireSession((req, res, c) => {
    const w = (ctx.config.rateLimits || {}).fcOverview || { max: 30, windowMs: 60000 };
    if (!ctx.limiter('fco:user:' + c.user.id, w.max, w.windowMs)) throw new HttpError('RATE_LIMITED', '请求过于频繁');
    const me = c.user.id;
    const n = (sql) => db.prepare(sql).get(me).n;

    const stats = {
      followers: n(`SELECT count(*) AS n FROM following WHERE target_type = 'user' AND target_id = ?`),
      following: n(`SELECT count(*) AS n FROM following WHERE user_id = ? AND target_type = 'user'`),
      articles: n(`SELECT count(*) AS n FROM articles WHERE author_id = ?`),
      articlesPublished: n(`SELECT count(*) AS n FROM articles WHERE author_id = ? AND status = 'published'`),
      articleViews: n(`SELECT coalesce(sum(view_count), 0) AS n FROM articles WHERE author_id = ?`),
      articleLikes: count(db, `SELECT count(*) AS n FROM content_likes WHERE target_type = 'article' AND target_id IN (SELECT id FROM articles WHERE author_id = ?)`, [me]),
      articleFavorites: count(db, `SELECT count(*) AS n FROM favorites WHERE target_type = 'article' AND target_id IN (SELECT id FROM articles WHERE author_id = ?)`, [me]),
      articleShares: count(db, `SELECT count(*) AS n FROM shares WHERE target_type = 'article' AND target_id IN (SELECT id FROM articles WHERE author_id = ?)`, [me]),
      posts: n(`SELECT count(*) AS n FROM posts WHERE author_id = ? AND status = 'visible' AND repost_of IS NULL`),
      postViews: n(`SELECT coalesce(sum(view_count), 0) AS n FROM posts WHERE author_id = ?`),
      postLikes: count(db, `SELECT count(*) AS n FROM content_likes WHERE target_type = 'post' AND target_id IN (SELECT id FROM posts WHERE author_id = ?)`, [me]),
      postFavorites: count(db, `SELECT count(*) AS n FROM favorites WHERE target_type = 'post' AND target_id IN (SELECT id FROM posts WHERE author_id = ?)`, [me]),
      postShares: count(db, `SELECT count(*) AS n FROM shares WHERE target_type = 'post' AND target_id IN (SELECT id FROM posts WHERE author_id = ?)`, [me]),
      repostsReceived: n(`SELECT count(*) AS n FROM posts WHERE repost_of IS NOT NULL AND repost_of IN (SELECT id FROM posts WHERE author_id = ?)`),
      media: n(`SELECT count(*) AS n FROM uploads WHERE owner_id = ?`)
    };

    // 文章清单（全状态；互动实时计数 + 每篇 shares 分组查询一次摊平）
    const artRows = db.prepare(`SELECT * FROM articles WHERE author_id = ? ORDER BY seq DESC LIMIT 100`).all(me);
    const shareMap = new Map();
    for (const r of db.prepare(`SELECT target_id, count(*) AS n FROM shares WHERE target_type = 'article' AND target_id IN (SELECT id FROM articles WHERE author_id = ?) GROUP BY target_id`).all(me)) {
      shareMap.set(r.target_id, r.n);
    }
    const articles = artRows.map((r) => ({
      id: r.id, title: r.title, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
      viewCount: r.view_count,
      likeCount: db.prepare(`SELECT count(*) AS n FROM content_likes WHERE target_type = 'article' AND target_id = ?`).get(r.id).n,
      favoriteCount: db.prepare(`SELECT count(*) AS n FROM favorites WHERE target_type = 'article' AND target_id = ?`).get(r.id).n,
      shareCount: shareMap.get(r.id) || 0,
      wordCount: articleWordCount(r.content_json)
    }));

    // 媒体清单（uploads 最新在前）
    const media = db.prepare(`SELECT id, ext, mime, bytes, created_at FROM uploads WHERE owner_id = ? ORDER BY seq DESC LIMIT 100`).all(me)
      .map((r) => ({ id: r.id, ext: r.ext, mime: r.mime, bytes: r.bytes, createdAt: r.created_at }));

    // 帖子清单（CL 社区条目：content 截 80、media 原样数组）
    const posts = db.prepare(`SELECT id, content, media, view_count, created_at FROM posts WHERE author_id = ? AND status = 'visible' AND repost_of IS NULL ORDER BY seq DESC LIMIT 100`).all(me)
      .map((r) => {
        let mediaArr = [];
        try { const m = JSON.parse(r.media); if (Array.isArray(m)) mediaArr = m; } catch (e) {}
        return {
          id: r.id, content: r.content.slice(0, 80), media: mediaArr,
          viewCount: r.view_count, createdAt: r.created_at
        };
      });

    const now = new Date();
    const w7 = rangeWindow('7d', undefined, undefined, now);
    const w28 = rangeWindow('28d', undefined, undefined, now);
    const wm = monthWindow(now);
    sendJson(res, 200, {
      stats,
      windows: {
        '7d': win(db, me, w7, seriesFromDate(w7, '7d')),
        '28d': win(db, me, w28, seriesFromDate(w28, '28d')),
        'month': win(db, me, wm, seriesFromDate(wm, 'month'))
      },
      articles, media, posts
    });
  }));
}

module.exports = { register };
