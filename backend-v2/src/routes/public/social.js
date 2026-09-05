'use strict';
// SlatiDB 云同步（P3）：响应形状与 localStorage 数据结构逐字段一致，前端零适配。
// nations/topics 存 verbatim JSON（服务端只覆盖 id/createdAt/status/memberCount）；
// teams 一期只读 + 服务端种子（与 storage.js 种子同数据，本地种子保留为离线兜底）；
// following 整对象 PUT 替换（与 saveFollowing 的全量覆盖语义一致）。
// 说明：following.users 一期按显示名原文存储——计划原为「显示名 → user_id 转换」，
// 但 v1 无用户主页、本地种子是演示名，转换会静默丢数据；用户主页上线时再迁移为 id 引用。

const fs = require('node:fs');
const path = require('node:path');
const { HttpError, sendJson, readJson, readRawBuffer } = require('../../http');
const { requireSession, hashToken, readToken } = require('../../middleware/auth');
const { insertWithId, pad6 } = require('../../ids');
const {
  createModerationItem, l0Screen, screenTextTarget, newAccountOverLimit, isDuplicate, applyDecision
} = require('../../moderation/pipeline');
const { hashOf } = require('../../moderation/rules');
const queue = require('../../moderation/queue');

const MAX_POST_LEN = 2000;
const MAX_COMMENT_LEN = 2000; // comments.content ≤2000（写入层校验，同 005 注释）
const MAX_MEDIA = 3;

// ── v0.2.16.0 帖子媒体上传（社区多图/视频）──
// 大小上限：图片 10MB（腾讯 IMS base64 上限）；视频 30MB（Cloud Run 请求 32MiB 硬顶留边距）。
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
// posts.media 只收本站上传路径（历史任意字符串 URL 是洞，且无客户端在用，收紧无回归）
const MEDIA_URL_RE = /^\/uploads\/UPL-[A-Za-z0-9]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mov)$/;
const EXT_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime'
};
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

// 魔数嗅探防伪装（扩展名白名单之外再验真实内容头）
function checkMagic(ext, buf) {
  if (buf.length < 12) return false;
  switch (ext) {
    case 'jpg': case 'jpeg': return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    case 'png': return buf.readUInt32BE(0) === 0x89504E47;
    case 'gif': return buf.toString('ascii', 0, 4) === 'GIF8';
    case 'webp': return buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
    case 'mp4': case 'mov': return buf.toString('ascii', 4, 8) === 'ftyp' || buf.toString('ascii', 4, 8) === 'moov';
    case 'webm': return buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3;
    default: return false;
  }
}

const TEAM_SEED = [
  { id: 'team-1', name: 'Etheria Editorial Board', avatar: 'EE', color: '#4648d4', role: 'Admin', members: 8, nations: ['Republic of Etheria'] },
  { id: 'team-2', name: 'Cartography Guild', avatar: 'CG', color: '#8127cf', role: 'Editor', members: 15, nations: ['Kingdom of Aethelgard'] },
  { id: 'team-3', name: 'Lore Keepers', avatar: 'LK', color: '#16a34a', role: 'Contributor', members: 6, nations: ['Neo-Venice Collective'] }
];

function parseJson(v) {
  try { return JSON.parse(v); } catch { return null; }
}

// 表空则种子（幂等）
function seedTeams(db) {
  if (db.prepare('SELECT count(*) AS n FROM teams').get().n > 0) return;
  const iso = new Date().toISOString();
  const ins = db.prepare('INSERT INTO teams (id, data, created_at) VALUES (?, ?, ?)');
  for (const t of TEAM_SEED) ins.run(t.id, JSON.stringify(t), iso);
}

// 写操作限流（默认 30/min/用户，测试可覆盖 config.rateLimits.socialWrite）
function writeLimit(ctx) {
  const w = (ctx.config.rateLimits || {}).socialWrite || { max: 30, windowMs: 60000 };
  return ctx.limiter('sw:user:' + ctx.user.id, w.max, w.windowMs);
}

function requireName(body, max, label) {
  const name = String(body && body.name || '').trim();
  if (!name || name.length > max) throw new HttpError('VALIDATION', `${label}需 1-${max} 字符`);
  return name;
}

function register(router, ctx) {
  // ── nations ──
  router.add('GET', '/api/social/nations', (req, res, c) => {
    const rows = c.db.prepare("SELECT data FROM nations WHERE status = 'visible' ORDER BY seq").all();
    sendJson(res, 200, { nations: rows.map(r => parseJson(r.data)) });
  });

  router.add('POST', '/api/social/nations', requireSession(async (req, res, c) => {
    if (!writeLimit(c)) throw new HttpError('RATE_LIMITED', '操作过于频繁');
    const body = await readJson(req, 64 * 1024);
    const name = requireName(body, 60, '国名');
    const lore = String(body.lore || '');
    if (lore.length > 2000) throw new HttpError('VALIDATION', '介绍最长 2000 字符');
    const iso = new Date().toISOString();
    const nation = { ...body, name, lore, id: '', createdAt: iso, status: 'active' };
    const { id } = insertWithId(c.db, 'nations', ['owner_id', 'data', 'status', 'created_at', 'updated_at'],
      [c.user.id, JSON.stringify(nation), 'visible', iso, iso], (s) => 'NAT-' + pad6(s));
    nation.id = id;
    c.db.prepare('UPDATE nations SET data = ? WHERE id = ?').run(JSON.stringify(nation), id);
    // L0 门禁（0 元）：零容忍 → 下架+封号；warning/spam → l0_hold 人工；pass → 夜间批处理
    screenTextTarget(c.db, ctx.config, ctx.moderation.blocklist, {
      targetType: 'nation', targetId: id, text: name + ' ' + lore,
      hash: hashOf(name + ' ' + lore), userId: c.user.id, table: 'nations'
    });
    sendJson(res, 200, { nation });
  }));

  // ── topics ──
  router.add('GET', '/api/social/topics', (req, res, c) => {
    const rows = c.db.prepare("SELECT data FROM topics WHERE status = 'visible' ORDER BY seq").all();
    sendJson(res, 200, { topics: rows.map(r => parseJson(r.data)) });
  });

  router.add('POST', '/api/social/topics', requireSession(async (req, res, c) => {
    if (!writeLimit(c)) throw new HttpError('RATE_LIMITED', '操作过于频繁');
    const body = await readJson(req, 64 * 1024);
    const name = requireName(body, 60, '话题名');
    const description = String(body.description || '');
    if (description.length > 500) throw new HttpError('VALIDATION', '简介最长 500 字符');
    const iso = new Date().toISOString();
    const topic = { ...body, name, description, id: '', createdAt: iso, memberCount: 1 };
    const { id } = insertWithId(c.db, 'topics', ['creator_id', 'data', 'status', 'created_at', 'updated_at'],
      [c.user.id, JSON.stringify(topic), 'visible', iso, iso], (s) => 'TOP-' + pad6(s));
    topic.id = id;
    c.db.prepare('UPDATE topics SET data = ? WHERE id = ?').run(JSON.stringify(topic), id);
    screenTextTarget(c.db, ctx.config, ctx.moderation.blocklist, {
      targetType: 'topic', targetId: id, text: name + ' ' + description,
      hash: hashOf(name + ' ' + description), userId: c.user.id, table: 'topics'
    });
    sendJson(res, 200, { topic });
  }));

  // ── teams（只读 + 种子）──
  router.add('GET', '/api/social/teams', (req, res, c) => {
    seedTeams(c.db);
    const rows = c.db.prepare('SELECT data FROM teams ORDER BY seq').all();
    sendJson(res, 200, { teams: rows.map(r => parseJson(r.data)) });
  });

  // ── posts（P7：先发后审）──
  // L0 门禁同步：零容忍 → status removed + 直接封号（跳过阶梯）；warning/spam → visible + l0_hold 人工；
  // pass 纯文字 → visible + queued（夜间批处理）。
  // pass 带媒体（v0.2.16.0 收紧为本站 /uploads/ 上传）：IMS 已配置且首图为图片 → pending + IMS 即时（过审才 visible）；
  //   其余（IMS 未配置 / 首图为视频——视频 base64 必超 IMS 10MB）→ visible + queued 先发后审
  //   （queued 滞留无害：cron 生产不跑，仅当 IMS+cron 启用后才被处理）。
  // 处罚生效：禁言/发布受限用户 POST 直接 403。
  function postRow(db, row, viewerId) {
    const author = db.prepare('SELECT id, display_name, avatar_url FROM users WHERE id = ?').get(row.author_id);
    // v0.2.17.0：计数随行（索引 idx_likes_target / idx_comments_post 命中，微秒级）
    const likeCount = db.prepare("SELECT count(*) AS n FROM content_likes WHERE target_type = 'post' AND target_id = ?").get(row.id).n;
    const commentCount = db.prepare("SELECT count(*) AS n FROM comments WHERE post_id = ? AND status = 'visible'").get(row.id).n;
    const likedByMe = viewerId
      ? !!db.prepare("SELECT 1 FROM content_likes WHERE user_id = ? AND target_type = 'post' AND target_id = ?").get(viewerId, row.id)
      : false;
    return {
      id: row.id,
      authorId: row.author_id,
      authorName: author ? author.display_name : 'Anonymous',
      avatarUrl: author ? author.avatar_url : null,
      content: row.content,
      media: parseJson(row.media) || [],
      topicId: row.topic_id,
      status: row.status,
      createdAt: row.created_at,
      likeCount, commentCount, likedByMe
    };
  }

  // 评论行映射（头像随行，前端零适配）
  function commentRow(db, row) {
    const author = db.prepare('SELECT id, display_name, avatar_url FROM users WHERE id = ?').get(row.author_id);
    return {
      id: row.id,
      postId: row.post_id,
      parentId: row.parent_id || null,
      authorName: author ? author.display_name : 'Anonymous',
      avatarUrl: author ? author.avatar_url : null,
      content: row.content,
      status: row.status, // 前端据此提示「内容违反社区规则，已被拦截」
      createdAt: row.created_at
    };
  }

  // v0.2.17.0 可选鉴权：公共 GET 只读识别登录态（不调 authenticate——那会抛 401 且 recordActivity 污染 DAU）。
  // cookie 缺失/坏/过期、账号 banned/deleted → 一律匿名；只返回 user id 供 likedByMe 用。
  function optionalViewer(req, c) {
    const token = readToken(req, c.config.sessionCookie);
    if (!token) return null;
    try {
      const row = c.db.prepare(`
        SELECT u.id FROM user_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ? AND u.status NOT IN ('banned','deleted')
      `).get(hashToken(token), new Date().toISOString());
      return row ? row.id : null;
    } catch { return null; }
  }

  router.add('GET', '/api/social/posts', (req, res, c) => {
    const viewerId = optionalViewer(req, c);
    const rows = c.db.prepare("SELECT * FROM posts WHERE status = 'visible' ORDER BY seq DESC LIMIT 100").all();
    sendJson(res, 200, { posts: rows.map(r => postRow(c.db, r, viewerId)) });
  });

  router.add('POST', '/api/social/posts', requireSession(async (req, res, c) => {
    const w = (ctx.config.rateLimits || {}).postsWrite || { max: 10, windowMs: 600000 };
    if (!ctx.limiter('pw:user:' + c.user.id, w.max, w.windowMs)) throw new HttpError('RATE_LIMITED', '发帖过于频繁');
    const body = await readJson(req, 64 * 1024);
    const content = String(body.content || '').trim();
    if (!content || content.length > MAX_POST_LEN) throw new HttpError('VALIDATION', `内容需 1-${MAX_POST_LEN} 字符`);
    const media = Array.isArray(body.media)
      ? body.media.filter(m => typeof m === 'string' && m.length > 0).slice(0, MAX_MEDIA) : [];
    // v0.2.16.0：media 只收本站 /uploads/ 白名单路径（防任意 URL/穿越注入卡片 HTML）
    if (media.some(m => !MEDIA_URL_RE.test(m))) throw new HttpError('VALIDATION', '媒体地址无效');
    const topicId = body.topicId ? String(body.topicId).slice(0, 64) : null;

    const iso = new Date().toISOString();
    // 处罚生效：禁言 / 发布受限
    if (c.user.muted_until && c.user.muted_until > iso) throw new HttpError('RESTRICTED', '你已被禁言，暂时无法发帖');
    if (c.user.rate_limited_until && c.user.rate_limited_until > iso) throw new HttpError('RESTRICTED', '发布频率受限，请稍后再试');
    // 新号频控：注册 N 天内 24h ≤maxPosts（L0，0 元）
    const mc = (ctx.config.moderation || {});
    const newSince = new Date(new Date(iso).getTime() - (mc.newAccountDays || 7) * 86400 * 1000).toISOString();
    if (c.user.created_at > newSince && newAccountOverLimit(c.db, c.user.id, mc.newAccountDailyPosts || 5, iso)) {
      throw new HttpError('RESTRICTED', '新账号每日最多发 5 帖，请明天再来');
    }
    // sha1 精确去重（24h 内同内容）
    const hash = hashOf(content);
    if (isDuplicate(c.db, c.user.id, hash, iso)) throw new HttpError('RESTRICTED', '请勿重复发布相同内容');

    const l0 = l0Screen(content, ctx.moderation.blocklist);
    // v0.2.16.0：只有「IMS 已配置且首图为图片」才 pending 先审后发；其余先发后审（见上方注释）
    const imsOn = Boolean(c.config.tencent && c.config.tencent.secretId && c.config.tencent.secretKey);
    const firstIsImage = media.length > 0 && /\.(jpg|jpeg|png|gif|webp)$/i.test(media[0]);
    const mediaNeedsIms = media.length > 0 && firstIsImage && imsOn;
    const postStatus = l0.verdict === 'reject' ? 'removed' : (mediaNeedsIms ? 'pending' : 'visible');
    const { id } = insertWithId(c.db, 'posts', ['author_id', 'topic_id', 'content', 'media', 'status', 'created_at', 'updated_at'],
      [c.user.id, topicId, content, JSON.stringify(media), postStatus, iso, iso], (s) => 'PST-' + pad6(s));

    if (l0.verdict === 'reject') {
      const itemId = createModerationItem(c.db, {
        kind: 'text', targetType: 'post', targetId: id, contentHash: hash,
        status: 'l0_hold', priority: 'high', ruleHits: l0.hits
      });
      applyDecision(c.db, ctx.config, { itemId, action: 'ban', actor: 'system', reasonCode: 'zero_tolerance', userId: c.user.id });
    } else if (l0.verdict === 'hold') {
      createModerationItem(c.db, {
        kind: 'text', targetType: 'post', targetId: id, contentHash: hash,
        status: 'l0_hold', priority: 'normal', ruleHits: l0.hits
      });
    } else if (media.length) {
      const itemId = createModerationItem(c.db, {
        kind: 'image', targetType: 'post', targetId: id, contentHash: hash,
        status: 'queued', priority: 'normal', ruleHits: null
      });
      if (mediaNeedsIms) {
        const item = c.db.prepare('SELECT * FROM moderation_items WHERE id = ?').get(itemId);
        await queue.processImageItem(c, item); // IMS 即时（过审才 visible；未配置/失败 → needs_human）
      }
    } else {
      createModerationItem(c.db, {
        kind: 'text', targetType: 'post', targetId: id, contentHash: hash,
        status: 'queued', priority: 'normal', ruleHits: null
      });
    }
    const row = c.db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
    sendJson(res, 200, { post: postRow(c.db, row), moderation: { verdict: l0.verdict, reasonCode: l0.reasonCode } });
  }));

  // ── 单帖详情（v0.2.17.0：Twitter 式点帖看评论，独立帖页数据源）──
  router.add('GET', '/api/social/posts/:id', (req, res, c) => {
    const row = c.db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!row || row.status !== 'visible') throw new HttpError('NOT_FOUND', '帖子不存在或已下架');
    sendJson(res, 200, { post: postRow(c.db, row, optionalViewer(req, c)) });
  });

  // ── 点赞（v0.2.17.0：幂等开关；content_likes 自然主键去重）──
  router.add('POST', '/api/social/posts/:id/like', requireSession((req, res, c) => {
    if (!writeLimit(c)) throw new HttpError('RATE_LIMITED', '操作过于频繁');
    const post = c.db.prepare('SELECT id, status FROM posts WHERE id = ?').get(req.params.id);
    if (!post || post.status !== 'visible') throw new HttpError('NOT_FOUND', '帖子不存在或已下架');
    c.db.prepare("INSERT OR IGNORE INTO content_likes (user_id, target_type, target_id, created_at) VALUES (?, 'post', ?, ?)")
      .run(c.user.id, post.id, new Date().toISOString());
    const likeCount = c.db.prepare("SELECT count(*) AS n FROM content_likes WHERE target_type = 'post' AND target_id = ?").get(post.id).n;
    sendJson(res, 200, { liked: true, likeCount });
  }));

  router.add('DELETE', '/api/social/posts/:id/like', requireSession((req, res, c) => {
    if (!writeLimit(c)) throw new HttpError('RATE_LIMITED', '操作过于频繁');
    // 不校验帖子存在：对已下架帖取消点赞 = 无害 no-op（幂等）
    c.db.prepare("DELETE FROM content_likes WHERE user_id = ? AND target_type = 'post' AND target_id = ?")
      .run(c.user.id, req.params.id);
    const likeCount = c.db.prepare("SELECT count(*) AS n FROM content_likes WHERE target_type = 'post' AND target_id = ?").get(req.params.id).n;
    sendJson(res, 200, { liked: false, likeCount });
  }));

  // ── 评论（v0.2.17.0：一层回复，先发后审同帖口径）──
  router.add('GET', '/api/social/posts/:id/comments', (req, res, c) => {
    const post = c.db.prepare('SELECT id, status FROM posts WHERE id = ?').get(req.params.id);
    if (!post || post.status !== 'visible') throw new HttpError('NOT_FOUND', '帖子不存在或已下架');
    // 分页本轮不做（LIMIT 200 兜底）
    const rows = c.db.prepare("SELECT * FROM comments WHERE post_id = ? AND status = 'visible' ORDER BY created_at ASC, seq ASC LIMIT 200").all(post.id);
    sendJson(res, 200, { comments: rows.map(r => commentRow(c.db, r)) });
  });

  router.add('POST', '/api/social/posts/:id/comments', requireSession(async (req, res, c) => {
    const w = (ctx.config.rateLimits || {}).commentWrite || { max: 20, windowMs: 60000 };
    if (!ctx.limiter('cw:user:' + c.user.id, w.max, w.windowMs)) throw new HttpError('RATE_LIMITED', '评论过于频繁');
    const body = await readJson(req, 64 * 1024);
    const content = String(body.content || '').trim();
    if (!content || content.length > MAX_COMMENT_LEN) throw new HttpError('VALIDATION', `内容需 1-${MAX_COMMENT_LEN} 字符`);
    const post = c.db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!post || post.status !== 'visible') throw new HttpError('NOT_FOUND', '帖子不存在或已下架');
    // 一层回复：parentId 必须属于本帖且自身无 parent（杜绝深链）
    let parentId = null;
    if (body.parentId) {
      const parent = c.db.prepare('SELECT id, post_id, parent_id FROM comments WHERE id = ?').get(String(body.parentId));
      if (!parent || parent.post_id !== post.id) throw new HttpError('VALIDATION', '回复的评论不存在');
      if (parent.parent_id) throw new HttpError('VALIDATION', '仅支持一级回复');
      parentId = parent.id;
    }
    const iso = new Date().toISOString();
    // 处罚生效：禁言 / 发布受限（与发帖同口径）
    if (c.user.muted_until && c.user.muted_until > iso) throw new HttpError('RESTRICTED', '你已被禁言，暂时无法评论');
    if (c.user.rate_limited_until && c.user.rate_limited_until > iso) throw new HttpError('RESTRICTED', '发布频率受限，请稍后再试');
    // sha1 精确去重（24h 同作者同内容）——pipeline.isDuplicate 硬编码 posts 子查询，
    // 评论必须换表自写（复用会静默错查为帖重复）
    const hash = hashOf(content);
    const since = new Date(new Date(iso).getTime() - 24 * 3600 * 1000).toISOString();
    const dupN = c.db.prepare("SELECT count(*) AS n FROM moderation_items WHERE kind = 'text' AND content_hash = ? AND created_at > ? "
      + "AND target_id IN (SELECT id FROM comments WHERE author_id = ?)").get(hash, since, c.user.id).n;
    if (dupN > 0) throw new HttpError('RESTRICTED', '请勿重复发布相同内容');
    // L0 门禁同帖纯文字口径：reject → removed+封号；hold → visible+l0_hold；pass → visible+queued 先发后审
    const l0 = l0Screen(content, ctx.moderation.blocklist);
    const commentStatus = l0.verdict === 'reject' ? 'removed' : 'visible';
    const { id } = insertWithId(c.db, 'comments', ['post_id', 'author_id', 'parent_id', 'content', 'status', 'created_at'],
      [post.id, c.user.id, parentId, content, commentStatus, iso], (s) => 'CMT-' + pad6(s));
    if (l0.verdict === 'reject') {
      const itemId = createModerationItem(c.db, {
        kind: 'text', targetType: 'comment', targetId: id, contentHash: hash,
        status: 'l0_hold', priority: 'high', ruleHits: l0.hits
      });
      applyDecision(c.db, ctx.config, { itemId, action: 'ban', actor: 'system', reasonCode: 'zero_tolerance', userId: c.user.id });
    } else if (l0.verdict === 'hold') {
      createModerationItem(c.db, {
        kind: 'text', targetType: 'comment', targetId: id, contentHash: hash,
        status: 'l0_hold', priority: 'normal', ruleHits: l0.hits
      });
    } else {
      createModerationItem(c.db, {
        kind: 'text', targetType: 'comment', targetId: id, contentHash: hash,
        status: 'queued', priority: 'normal', ruleHits: null
      });
    }
    const row = c.db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
    sendJson(res, 200, { comment: commentRow(c.db, row), moderation: { verdict: l0.verdict, reasonCode: l0.reasonCode } });
  }));

  // ── 媒体上传（v0.2.16.0：社区帖子多图/视频）──
  // 二进制 body（fetch/XMLHttpRequest 直传文件字节），?ext= 指定扩展名（白名单 + 魔数双校验）；
  // 文件写 UPLOADS_DIR（生产 = GCS FUSE 挂载盘，跨实例持久），posts.media 只存 '/uploads/UPL-xxxxxx.<ext>' 字符串。
  router.add('POST', '/api/social/uploads', requireSession(async (req, res, c) => {
    const u = (ctx.config.rateLimits || {}).uploads || { max: 20, windowMs: 600000 };
    if (!ctx.limiter('up:user:' + c.user.id, u.max, u.windowMs)) throw new HttpError('RATE_LIMITED', '上传过于频繁');
    const ext = String(req.query.ext || '').toLowerCase().replace(/^\./, '');
    const mime = EXT_MIME[ext];
    if (!mime) throw new HttpError('VALIDATION', '不支持的媒体格式');
    const cap = IMAGE_EXTS.includes(ext) ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    const buf = await readRawBuffer(req, cap);
    if (!buf.length) throw new HttpError('VALIDATION', '文件为空');
    if (!checkMagic(ext, buf)) throw new HttpError('VALIDATION', '文件内容与扩展名不符');
    const iso = new Date().toISOString();
    const { id } = insertWithId(c.db, 'uploads', ['owner_id', 'ext', 'mime', 'bytes', 'created_at'],
      [c.user.id, ext, mime, buf.length, iso], (s) => 'UPL-' + pad6(s));
    const dir = c.config.uploadDir || '/mnt/data/uploads';
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, id + '.' + ext), buf);
    } catch (err) {
      c.db.prepare('DELETE FROM uploads WHERE id = ?').run(id); // 落盘失败回滚记录，不悬空
      console.error('[uploads] 文件保存失败:', err.message);
      throw new HttpError('INTERNAL', '文件保存失败');
    }
    sendJson(res, 200, { url: '/uploads/' + id + '.' + ext });
  }));

  // ── following（整对象替换，与 saveFollowing 语义一致）──
  router.add('GET', '/api/social/following', requireSession((req, res, c) => {
    const rows = c.db.prepare('SELECT target_type, target_id FROM following WHERE user_id = ?').all(c.user.id);
    const out = { nations: [], topics: [], users: [] };
    for (const r of rows) {
      const key = r.target_type + 's'; // nation→nations / topic→topics / user→users
      if (out[key]) out[key].push(r.target_id);
    }
    sendJson(res, 200, out);
  }));

  router.add('PUT', '/api/social/following', requireSession(async (req, res, c) => {
    if (!writeLimit(c)) throw new HttpError('RATE_LIMITED', '操作过于频繁');
    const body = await readJson(req, 16 * 1024);
    const clean = { nations: [], topics: [], users: [] };
    ['nations', 'topics', 'users'].forEach((k) => {
      if (Array.isArray(body[k])) clean[k] = body[k].map(String).filter(Boolean).slice(0, 200);
    });
    const iso = new Date().toISOString();
    c.db.transaction(() => {
      c.db.prepare('DELETE FROM following WHERE user_id = ?').run(c.user.id);
      const ins = c.db.prepare('INSERT INTO following (user_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)');
      ['nations', 'topics', 'users'].forEach((k) =>
        clean[k].forEach((t) => ins.run(c.user.id, k.slice(0, -1), t, iso)));
    })();
    sendJson(res, 200, clean);
  }));
}

module.exports = { register, TEAM_SEED };
