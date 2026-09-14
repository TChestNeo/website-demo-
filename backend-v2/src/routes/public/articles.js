'use strict';
// 文章（P6）：POST 直接 status='published'（2026-09-15 用户令去除「提交审核」段——
// 原 P7 管线从未接文章，pending 恒卡死；遗留 pending 由迁移 022 转 published）。
// GET 列表公开仅 published + 本人全部状态（遗留 pending 防御口径保留）；
// GET /:id 完整内容仅 published 或本人。content_json 存编辑器 draft 整体 JSON（零适配）。

const { HttpError, sendJson, readJson } = require('../../http');
const { requireSession, authenticate } = require('../../middleware/auth');
const { insertWithId, pad6 } = require('../../ids');

const MAX_TITLE = 120;
const MAX_BYTES = 4 * 1024 * 1024;

function meta(row) {
  return { id: row.id, title: row.title, status: row.status, authorId: row.author_id, createdAt: row.created_at, updatedAt: row.updated_at };
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
    const iso = new Date().toISOString();
    const { id } = insertWithId(db, 'articles', ['author_id', 'title', 'content_json', 'status', 'created_at', 'updated_at'],
      [c.user.id, title, contentJson, 'published', iso, iso], (s) => 'ART-' + pad6(s));
    sendJson(res, 200, { article: { id, title, status: 'published', createdAt: iso } });
  }));

  router.add('GET', '/api/articles', (req, res) => {
    const user = softUser(db, req, res, ctx);
    const rows = user
      ? db.prepare("SELECT * FROM articles WHERE status = 'published' OR author_id = ? ORDER BY seq DESC LIMIT 100").all(user.id)
      : db.prepare("SELECT * FROM articles WHERE status = 'published' ORDER BY seq DESC LIMIT 100").all();
    sendJson(res, 200, { articles: rows.map(meta) });
  });

  router.add('GET', '/api/articles/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    if (!row) throw new HttpError('NOT_FOUND', '文章不存在');
    const user = softUser(db, req, res, ctx);
    if (row.status !== 'published' && (!user || user.id !== row.author_id)) {
      throw new HttpError('NOT_FOUND', '文章不存在'); // 未发布文章对非本人不可见（口径统一 404）
    }
    sendJson(res, 200, { article: { ...meta(row), contentJson: JSON.parse(row.content_json) } });
  });
}

module.exports = { register };
