'use strict';
// SlatiDB 云同步（P3）：响应形状与 localStorage 数据结构逐字段一致，前端零适配。
// nations/topics 存 verbatim JSON（服务端只覆盖 id/createdAt/status/memberCount）；
// teams 一期只读 + 服务端种子（与 storage.js 种子同数据，本地种子保留为离线兜底）；
// following 整对象 PUT 替换（与 saveFollowing 的全量覆盖语义一致）。
// 说明：following.users 一期按显示名原文存储——计划原为「显示名 → user_id 转换」，
// 但 v1 无用户主页、本地种子是演示名，转换会静默丢数据；用户主页上线时再迁移为 id 引用。

const { HttpError, sendJson, readJson } = require('../http');
const { requireSession } = require('../middleware/auth');
const { insertWithId, pad6 } = require('../ids');
const {
  createModerationItem, l0Screen, screenTextTarget, newAccountOverLimit, isDuplicate, applyDecision
} = require('../moderation/pipeline');
const { hashOf } = require('../moderation/rules');
const queue = require('../moderation/queue');

const MAX_POST_LEN = 2000;
const MAX_MEDIA = 3;

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
  // pass 纯文字 → visible + queued（夜间批处理）；pass 带图 → pending + IMS 即时（过审才 visible）。
  // 处罚生效：禁言/发布受限用户 POST 直接 403。
  function postRow(db, row) {
    const author = db.prepare('SELECT id, display_name, avatar_url FROM users WHERE id = ?').get(row.author_id);
    return {
      id: row.id,
      authorId: row.author_id,
      authorName: author ? author.display_name : 'Anonymous',
      avatarUrl: author ? author.avatar_url : null,
      content: row.content,
      media: parseJson(row.media) || [],
      topicId: row.topic_id,
      status: row.status,
      createdAt: row.created_at
    };
  }

  router.add('GET', '/api/social/posts', (req, res, c) => {
    const rows = c.db.prepare("SELECT * FROM posts WHERE status = 'visible' ORDER BY seq DESC LIMIT 100").all();
    sendJson(res, 200, { posts: rows.map(r => postRow(c.db, r)) });
  });

  router.add('POST', '/api/social/posts', requireSession(async (req, res, c) => {
    const w = (ctx.config.rateLimits || {}).postsWrite || { max: 10, windowMs: 600000 };
    if (!ctx.limiter('pw:user:' + c.user.id, w.max, w.windowMs)) throw new HttpError('RATE_LIMITED', '发帖过于频繁');
    const body = await readJson(req, 64 * 1024);
    const content = String(body.content || '').trim();
    if (!content || content.length > MAX_POST_LEN) throw new HttpError('VALIDATION', `内容需 1-${MAX_POST_LEN} 字符`);
    const media = Array.isArray(body.media)
      ? body.media.filter(m => typeof m === 'string' && m.length > 0).slice(0, MAX_MEDIA) : [];
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
    const postStatus = l0.verdict === 'reject' ? 'removed' : (media.length ? 'pending' : 'visible');
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
      const item = c.db.prepare('SELECT * FROM moderation_items WHERE id = ?').get(itemId);
      await queue.processImageItem(c, item); // IMS 即时（未配置/失败 → needs_human，快速返回）
    } else {
      createModerationItem(c.db, {
        kind: 'text', targetType: 'post', targetId: id, contentHash: hash,
        status: 'queued', priority: 'normal', ruleHits: null
      });
    }
    const row = c.db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
    sendJson(res, 200, { post: postRow(c.db, row), moderation: { verdict: l0.verdict, reasonCode: l0.reasonCode } });
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
