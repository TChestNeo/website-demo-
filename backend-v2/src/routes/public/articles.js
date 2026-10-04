'use strict';
// 文章（P6）：POST 直接 status='published'（2026-09-15 用户令去除「提交审核」段——
// 原 P7 管线从未接文章，pending 恒卡死；遗留 pending 由迁移 022 转 published）。
// GET 列表公开仅 published + 本人全部状态（遗留 pending 防御口径保留）；
// GET /:id 完整内容仅 published 或本人。content_json 存编辑器 draft 整体 JSON（零适配）。
// v0.2.55.0（用户「把文章的前端做好……搜索不到我发布过的文章」钦定：只搜文章/首页混入/普通阅读页/
// 点赞+收藏+评论）：GET /api/articles 加 q 标题模糊搜索（公开只搜 published）；meta 加 authorName 联查；
// 新增文章评论 GET/POST /api/articles/:id/comments（独立表 article_comments，见迁移 028）。

const { HttpError, sendJson, readJson } = require('../../http');
const { requireSession, authenticate } = require('../../middleware/auth');
const { insertWithId, pad6 } = require('../../ids');
const { createModerationItem, l0Screen, applyDecision } = require('../../moderation/pipeline');
const { hashOf } = require('../../moderation/rules');
const { gainTeamXp, loseTeamXp } = require('./team-xp'); // v10.28.52.0 团队 XP（发布/删除作品）

const MAX_TITLE = 120;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_COMMENT_LEN = 2000; // 与帖子评论同口径（social.js MAX_COMMENT_LEN）

// 获得类经验（social.js 模块内同名函数的小份拷贝——文章被评论 +10 同帖子口径；amount 未配置 = 不记）
function gainXp(c, userId, key) {
  const n = (((c.config || {}).xp || {}).gained || {})[key];
  if (!userId || !n) return;
  c.db.prepare('UPDATE users SET xp_gained = xp_gained + ? WHERE id = ?').run(n, userId);
}

function meta(db, row) {
  const author = db.prepare('SELECT display_name FROM users WHERE id = ?').get(row.author_id);
  return {
    id: row.id, title: row.title, status: row.status, authorId: row.author_id,
    authorName: author ? author.display_name : 'Anonymous',
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function commentRow(db, row) {
  const author = db.prepare('SELECT id, display_name, avatar_url FROM users WHERE id = ?').get(row.author_id);
  return {
    id: row.id,
    articleId: row.article_id,
    authorId: row.author_id,
    authorName: author ? author.display_name : 'Anonymous',
    avatarUrl: author ? author.avatar_url : null,
    content: row.content,
    status: row.status, // 前端据此提示「内容违反社区规则，已被拦截」
    createdAt: row.created_at,
  };
}

// 静默鉴权：登录返回用户行，未登录/封禁返回 null（匿名可读公开列表）
function softUser(db, req, res, ctx) {
  try { return authenticate(db, req, res, ctx); } catch (e) { return null; }
}

function register(router, ctx) {
  const db = ctx.db;

  router.add('POST', '/api/articles', requireSession(async (req, res, c) => {
    const w = (ctx.config.rateLimits || {}).articleWrite || { max: 10, windowMs: 3600000 };
    if (!ctx.limiter('art:user:' + c.user.id, w.max, w.windowMs)) throw new HttpError('RATE_LIMITED', '发布过于频繁');
    const body = await readJson(req, MAX_BYTES + 1024);
    const title = String(body.title || '').trim();
    if (!title || title.length > MAX_TITLE) throw new HttpError('VALIDATION', `标题需 1-${MAX_TITLE} 字`);
    const contentJson = typeof body.contentJson === 'string'
      ? body.contentJson : JSON.stringify(body.contentJson || {});
    if (Buffer.byteLength(contentJson, 'utf8') > MAX_BYTES) throw new HttpError('VALIDATION', '内容超过 4MB');
    // v10.28.52.0 团队频道发布（团队模式发布云端文章）：teamId 需为本人所在团队（团队成员校验）；计入团队 XP upload（+24）
    const teamId = body.teamId ? String(body.teamId).slice(0, 64) : null;
    if (teamId && !db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, c.user.id)) {
      throw new HttpError('FORBIDDEN', '你不是该团队成员，无法发布到团队频道');
    }
    const iso = new Date().toISOString();
    const { id } = insertWithId(db, 'articles', ['author_id', 'team_id', 'title', 'content_json', 'status', 'created_at', 'updated_at'],
      [c.user.id, teamId, title, contentJson, 'published', iso, iso], (s) => 'ART-' + pad6(s));
    if (teamId) gainTeamXp(c, teamId, 'upload'); // 团队作品上传 +24（删除作品同额扣回）
    sendJson(res, 200, { article: { id, title, status: 'published', createdAt: iso } });
  }));

  router.add('GET', '/api/articles', (req, res) => {
    const user = softUser(db, req, res, ctx);
    const q = String(req.query.q || '').trim().slice(0, 120);
    if (q) {
      // v0.2.55.0：标题模糊搜索（LIKE 大小写不敏感；% 与 _ 通配转义防注入语义）。公开只搜 published。
      const like = '%' + q.replace(/[%_\\]/g, (ch) => '\\' + ch) + '%';
      const rows = user
        ? db.prepare("SELECT * FROM articles WHERE status = 'published' AND title LIKE ? ESCAPE '\\' ORDER BY seq DESC LIMIT 50").all(like)
        : db.prepare("SELECT * FROM articles WHERE status = 'published' AND title LIKE ? ESCAPE '\\' ORDER BY seq DESC LIMIT 50").all(like);
      sendJson(res, 200, { articles: rows.map((r) => meta(db, r)) });
      return;
    }
    const rows = user
      ? db.prepare("SELECT * FROM articles WHERE status = 'published' OR author_id = ? ORDER BY seq DESC LIMIT 100").all(user.id)
      : db.prepare("SELECT * FROM articles WHERE status = 'published' ORDER BY seq DESC LIMIT 100").all();
    sendJson(res, 200, { articles: rows.map((r) => meta(db, r)) });
  });

  router.add('GET', '/api/articles/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    if (!row) throw new HttpError('NOT_FOUND', '文章不存在');
    const user = softUser(db, req, res, ctx);
    if (row.status !== 'published' && (!user || user.id !== row.author_id)) {
      throw new HttpError('NOT_FOUND', '文章不存在'); // 未发布文章对非本人不可见（口径统一 404）
    }
    // v0.2.52.0：浏览自增（镜像 posts 口径）+ 实时互动字段。死计数列 like_count/favorite_count
    // 继续零读写（实时 count 与帖子口径一致，不双账）；likedByMe 复用 softUser，匿名恒 false。
    db.prepare('UPDATE articles SET view_count = view_count + 1 WHERE id = ?').run(row.id);
    const fresh = db.prepare('SELECT * FROM articles WHERE id = ?').get(row.id);
    const likeCount = db.prepare("SELECT count(*) AS n FROM content_likes WHERE target_type = 'article' AND target_id = ?").get(row.id).n;
    const favoriteCount = db.prepare("SELECT count(*) AS n FROM favorites WHERE target_type = 'article' AND target_id = ?").get(row.id).n;
    const likedByMe = user
      ? !!db.prepare("SELECT 1 FROM content_likes WHERE user_id = ? AND target_type = 'article' AND target_id = ?").get(user.id, row.id)
      : false;
    const favoritedByMe = user
      ? !!db.prepare("SELECT 1 FROM favorites WHERE user_id = ? AND target_type = 'article' AND target_id = ?").get(user.id, row.id)
      : false;
    sendJson(res, 200, {
      article: {
        ...meta(db, fresh), contentJson: JSON.parse(fresh.content_json),
        viewCount: fresh.view_count, likeCount, favoriteCount, likedByMe, favoritedByMe,
      },
    });
  });

  // v0.2.55.1: PUT 更新（本人）——编辑器「已发布文章再发布 = 更新原文章」，不再重复建文
  // （用户「为什么我点击public时他只是复制出新的一个文章？而不是发布？」）
  router.add('PUT', '/api/articles/:id', requireSession(async (req, res, c) => {
    const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    if (!row) throw new HttpError('NOT_FOUND', '文章不存在');
    if (row.author_id !== c.user.id) throw new HttpError('FORBIDDEN', '只能修改自己的文章');
    const body = await readJson(req, MAX_BYTES + 1024);
    const title = String(body.title || '').trim();
    if (!title || title.length > MAX_TITLE) throw new HttpError('VALIDATION', `标题需 1-${MAX_TITLE} 字`);
    const contentJson = typeof body.contentJson === 'string'
      ? body.contentJson : JSON.stringify(body.contentJson || {});
    if (Buffer.byteLength(contentJson, 'utf8') > MAX_BYTES) throw new HttpError('VALIDATION', '内容超过 4MB');
    const iso = new Date().toISOString();
    db.prepare('UPDATE articles SET title = ?, content_json = ?, updated_at = ? WHERE id = ?')
      .run(title, contentJson, iso, row.id);
    sendJson(res, 200, { article: { id: row.id, title, status: row.status, updatedAt: iso } });
  }));

  // v0.2.55.1: DELETE 删除（本人）——FC 列表云端文章删除按钮（用户「我在FC里无法删除我创建的文章没有删除按钮」）。
  // article_comments FK 级联随删；content_likes/favorites 无 FK 的互动行顺手清（防孤儿脏数据）。
  router.add('DELETE', '/api/articles/:id', requireSession((req, res, c) => {
    const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    if (!row) throw new HttpError('NOT_FOUND', '文章不存在');
    if (row.author_id !== c.user.id) throw new HttpError('FORBIDDEN', '只能删除自己的文章');
    db.transaction(() => {
      db.prepare("DELETE FROM content_likes WHERE target_type = 'article' AND target_id = ?").run(row.id);
      db.prepare("DELETE FROM favorites WHERE target_type = 'article' AND target_id = ?").run(row.id);
      db.prepare('DELETE FROM articles WHERE id = ?').run(row.id);
      if (row.team_id) loseTeamXp(c, row.team_id, 'upload'); // 删除团队作品 -24（少一个就收走）
    })();
    sendJson(res, 200, { deleted: true, id: row.id });
  }));

  // ── 文章评论（v0.2.55.0：一层结构无回复；先发后审 L0 同帖子评论口径）──
  router.add('GET', '/api/articles/:id/comments', (req, res) => {
    const art = db.prepare('SELECT id, status FROM articles WHERE id = ?').get(req.params.id);
    if (!art || art.status !== 'published') throw new HttpError('NOT_FOUND', '文章不存在或未公开');
    // 分页本轮不做（LIMIT 200 兜底，同帖子评论）
    const rows = db.prepare("SELECT * FROM article_comments WHERE article_id = ? AND status = 'visible' ORDER BY created_at ASC, seq ASC LIMIT 200").all(art.id);
    sendJson(res, 200, { comments: rows.map((r) => commentRow(db, r)) });
  });

  router.add('POST', '/api/articles/:id/comments', requireSession(async (req, res, c) => {
    const w = (ctx.config.rateLimits || {}).commentWrite || { max: 20, windowMs: 60000 };
    if (!ctx.limiter('acw:user:' + c.user.id, w.max, w.windowMs)) throw new HttpError('RATE_LIMITED', '评论过于频繁');
    const body = await readJson(req, 64 * 1024);
    const content = String(body.content || '').trim();
    if (!content || content.length > MAX_COMMENT_LEN) throw new HttpError('VALIDATION', `内容需 1-${MAX_COMMENT_LEN} 字符`);
    const art = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    if (!art || art.status !== 'published') throw new HttpError('NOT_FOUND', '文章不存在或未公开');
    const iso = new Date().toISOString();
    // 处罚生效：禁言 / 发布受限（与帖子评论同口径）
    if (c.user.muted_until && c.user.muted_until > iso) throw new HttpError('RESTRICTED', '你已被禁言，暂时无法评论');
    if (c.user.rate_limited_until && c.user.rate_limited_until > iso) throw new HttpError('RESTRICTED', '发布频率受限，请稍后再试');
    // sha1 精确去重（24h 同作者同内容）——pipeline.isDuplicate 硬编码 posts 子查询，
    // 文章评论必须换表自写（复用会静默错查为帖重复）
    const hash = hashOf(content);
    const since = new Date(new Date(iso).getTime() - 24 * 3600 * 1000).toISOString();
    const dupN = db.prepare("SELECT count(*) AS n FROM moderation_items WHERE kind = 'text' AND content_hash = ? AND created_at > ? "
      + "AND target_id IN (SELECT id FROM article_comments WHERE author_id = ?)").get(hash, since, c.user.id).n;
    if (dupN > 0) throw new HttpError('RESTRICTED', '请勿重复发布相同内容');
    // L0 门禁同帖子纯文字口径：reject → removed+封号；hold → visible+l0_hold；pass → visible+queued 先发后审
    const l0 = l0Screen(content, ctx.moderation.blocklist);
    const commentStatus = l0.verdict === 'reject' ? 'removed' : 'visible';
    const { id } = insertWithId(db, 'article_comments', ['article_id', 'author_id', 'content', 'status', 'created_at'],
      [art.id, c.user.id, content, commentStatus, iso], (s) => 'ACM-' + pad6(s));
    // 获得评论 +10（removed 不记；自评不记）
    if (commentStatus !== 'removed' && art.author_id !== c.user.id) gainXp(c, art.author_id, 'comment');
    if (l0.verdict === 'reject') {
      const itemId = createModerationItem(db, {
        kind: 'text', targetType: 'article_comment', targetId: id, contentHash: hash,
        status: 'l0_hold', priority: 'high', ruleHits: l0.hits
      });
      applyDecision(db, ctx.config, { itemId, action: 'ban', actor: 'system', reasonCode: 'zero_tolerance', userId: c.user.id });
    } else if (l0.verdict === 'hold') {
      createModerationItem(db, {
        kind: 'text', targetType: 'article_comment', targetId: id, contentHash: hash,
        status: 'l0_hold', priority: 'normal', ruleHits: l0.hits
      });
    } else {
      createModerationItem(db, {
        kind: 'text', targetType: 'article_comment', targetId: id, contentHash: hash,
        status: 'queued', priority: 'normal', ruleHits: null
      });
    }
    const row = db.prepare('SELECT * FROM article_comments WHERE id = ?').get(id);
    sendJson(res, 200, { comment: commentRow(db, row), moderation: { verdict: l0.verdict, reasonCode: l0.reasonCode } });
  }));
}

module.exports = { register };
