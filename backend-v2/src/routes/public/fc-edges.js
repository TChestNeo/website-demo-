'use strict';
// FC 自定义边缘仓库 API（FC v10.28.50.0）——用户「AI 生成的边缘/边框上传到仓库的时候可以选择公开/团队/好友/私人」。
// 表：031_fc_edges.sql（fc_edges；平台首个可见性模型 visibility 四值）。
// 可见性口径（GET 按 optionalViewer 过滤）：
//   public  → 所有人（含匿名）
//   friends → owner ∈ 我的好友（friend_requests status='accepted' 双向）
//   team    → owner ∈ 我所在团队的成员（team_members；Phase B 团队频道起有真实数据，空集即不可见）
//   private → 仅 owner 本人
// 好友/团队集合计算与 social.js optionalViewer 同款（cookie 缺失/坏 → viewer=null 匿名）。
// clip 入库前必过 sanitizeClip（fc-edgegen.js 服务端白名单）——AI 产物进 CSS 的唯一防线，双端复用。

const { HttpError, sendJson, readJson } = require('../../http');
const { requireSession, hashToken, readToken } = require('../../middleware/auth');
const { insertWithId, pad6 } = require('../../ids');
const { sanitizeClip } = require('./fc-edgegen');

const MAX_NAME = 30;
const MAX_EDGES_PER_USER = 200;
const VISIBILITIES = ['public', 'team', 'friends', 'private'];

// optionalViewer：公共 GET 只读识别登录态（与 social.js 同款；不调 authenticate 防污染 DAU）
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

// 我的好友集合（accepted 双向）
function friendSetOf(db, uid) {
  const s = new Set();
  for (const r of db.prepare(`
    SELECT sender_id, recipient_id FROM friend_requests
    WHERE status = 'accepted' AND (sender_id = ? OR recipient_id = ?)
  `).all(uid, uid)) {
    s.add(r.sender_id === uid ? r.recipient_id : r.sender_id);
  }
  return s;
}

// 我的团队集合（我所在团队的成员；team_members 现为种子数据，Phase B 起有真实成员）
function teamSetOf(db, uid) {
  const s = new Set();
  for (const r of db.prepare(`
    SELECT tm.user_id FROM team_members tm
    JOIN team_members mine ON mine.team_id = tm.team_id
    WHERE mine.user_id = ? AND tm.user_id != ?
  `).all(uid, uid)) s.add(r.user_id);
  return s;
}

// 可见性判定：可见性四值 + viewer/fset/tset
function isVisible(edge, viewerId, fset, tset) {
  if (edge.visibility === 'public') return true;
  if (!viewerId) return false;
  if (edge.visibility === 'private') return edge.owner_id === viewerId;
  if (edge.visibility === 'friends') return fset.has(edge.owner_id);
  if (edge.visibility === 'team') return tset.has(edge.owner_id);
  return false;
}

// GET 行形状：id/name/kind/clip/visibility/createdAt + 上传者名（仓库列表「上传者名」展示）
function edgeRow(db, r) {
  const owner = db.prepare('SELECT display_name FROM users WHERE id = ?').get(r.owner_id);
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    clip: r.clip,
    visibility: r.visibility,
    createdAt: r.created_at,
    ownerId: r.owner_id,
    authorName: owner ? owner.display_name : 'Anonymous'
  };
}

// 名称清洗：≤30 字符、控字符剥除、非空
function cleanName(raw) {
  const s = String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME);
  if (!s) throw new HttpError('VALIDATION', '名称需 1-30 字符');
  return s;
}

function register(router, ctx) {
  // ── GET /api/fc/edges/scopes —— 圆球显隐依据（必须先于 /api/fc/edges/:id 注册！注册序=匹配序）──
  router.add('GET', '/api/fc/edges/scopes', (req, res, c) => {
    const viewerId = optionalViewer(req, c);
    if (!viewerId) { sendJson(res, 200, { hasFriends: false, hasTeam: false }); return; }
    const fset = friendSetOf(c.db, viewerId);
    const tset = teamSetOf(c.db, viewerId);
    sendJson(res, 200, { hasFriends: fset.size > 0, hasTeam: tset.size > 0 });
  });

  // ── POST /api/fc/edges —— 上传仓库（AI 产物/本地自制入库共享）──
  router.add('POST', '/api/fc/edges', requireSession(async (req, res, c) => {
    const w = (ctx.config.rateLimits || {}).fcEdgesWrite || { max: 20, windowMs: 60000 };
    if (!ctx.limiter('few:user:' + c.user.id, w.max, w.windowMs)) {
      throw new HttpError('RATE_LIMITED', '上传过于频繁');
    }
    const body = await readJson(req, 64 * 1024);
    const name = cleanName(body.name);
    const kind = body.kind === 'border' ? 'border' : 'edge';
    const clip = sanitizeClip(body.clip);
    if (!clip) throw new HttpError('VALIDATION', '边缘数据未通过安全校验');
    const visibility = body.visibility;
    if (!VISIBILITIES.includes(visibility)) throw new HttpError('VALIDATION', '可见性无效');

    const cnt = c.db.prepare('SELECT COUNT(*) AS n FROM fc_edges WHERE owner_id = ?').get(c.user.id).n;
    if (cnt >= MAX_EDGES_PER_USER) throw new HttpError('CONFLICT', '边缘仓库已达上限（200 条）');

    const now = new Date().toISOString();
    const { id, seq } = insertWithId(c.db, 'fc_edges',
      ['owner_id', 'name', 'kind', 'clip', 'visibility', 'created_at'],
      [c.user.id, name, kind, clip, visibility, now],
      (s) => 'EDG-' + pad6(s));
    const row = c.db.prepare('SELECT * FROM fc_edges WHERE seq = ?').get(seq);
    sendJson(res, 200, { edge: edgeRow(c.db, row) });
  }));

  // ── GET /api/fc/edges?scope=all|friends|team|mine&limit=100 —— 匿名可见公开（全部 tab 访客兜底）──
  router.add('GET', '/api/fc/edges', (req, res, c) => {
    const viewerId = optionalViewer(req, c);
    let scope = req.query.scope || 'all';
    if (!['all', 'friends', 'team', 'mine'].includes(scope)) scope = 'all';
    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit < 1 || limit > 100) limit = 100;
    if (scope === 'mine' && !viewerId) { sendJson(res, 200, { edges: [] }); return; }

    const fset = viewerId ? friendSetOf(c.db, viewerId) : new Set();
    const tset = viewerId ? teamSetOf(c.db, viewerId) : new Set();
    const rows = c.db.prepare('SELECT * FROM fc_edges ORDER BY seq DESC').all();
    const out = [];
    for (const r of rows) {
      if (scope === 'mine') {
        // 我的库：本人条目全部可见（不套可见性过滤——friends/team 款也照收）
        if (r.owner_id !== viewerId) continue;
      } else {
        if (scope === 'friends' && !fset.has(r.owner_id)) continue;
        if (scope === 'team' && !tset.has(r.owner_id)) continue;
        if (!isVisible(r, viewerId, fset, tset)) continue;
      }
      out.push(edgeRow(c.db, r));
      if (out.length >= limit) break;
    }
    sendJson(res, 200, { edges: out });
  });

  // ── PUT /api/fc/edges/:id —— 本人改可见性/名称（修改入口）──
  router.add('PUT', '/api/fc/edges/:id', requireSession(async (req, res, c) => {
    const row = c.db.prepare('SELECT * FROM fc_edges WHERE id = ?').get(req.params.id);
    if (!row) throw new HttpError('NOT_FOUND', '边缘不存在');
    if (row.owner_id !== c.user.id) throw new HttpError('FORBIDDEN', '只能修改自己的边缘');
    const body = await readJson(req, 64 * 1024);
    const name = cleanName(body.name == null ? row.name : body.name);
    let visibility = row.visibility;
    if (body.visibility != null) {
      if (!VISIBILITIES.includes(body.visibility)) throw new HttpError('VALIDATION', '可见性无效');
      visibility = body.visibility;
    }
    let clip = row.clip;
    if (body.clip != null) {
      const cleaned = sanitizeClip(body.clip);
      if (!cleaned) throw new HttpError('VALIDATION', '边缘数据未通过安全校验');
      clip = cleaned;
    }
    c.db.prepare('UPDATE fc_edges SET name = ?, visibility = ?, clip = ? WHERE id = ?').run(name, visibility, clip, row.id);
    sendJson(res, 200, { edge: edgeRow(c.db, c.db.prepare('SELECT * FROM fc_edges WHERE id = ?').get(row.id)) });
  }));

  // ── DELETE /api/fc/edges/:id —— 本人删除 ──
  router.add('DELETE', '/api/fc/edges/:id', requireSession(async (req, res, c) => {
    const row = c.db.prepare('SELECT * FROM fc_edges WHERE id = ?').get(req.params.id);
    if (!row) throw new HttpError('NOT_FOUND', '边缘不存在');
    if (row.owner_id !== c.user.id) throw new HttpError('FORBIDDEN', '只能删除自己的边缘');
    c.db.prepare('DELETE FROM fc_edges WHERE id = ?').run(row.id);
    sendJson(res, 200, { ok: true });
  }));
}

module.exports = { register };
