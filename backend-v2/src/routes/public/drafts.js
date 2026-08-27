'use strict';
// 草稿同步（P6）：GET/PUT/DELETE /api/drafts/fluidcanvas/:docId（前端固定 'main'）。
// 乐观并发：PUT 携带 baseVersion（客户端上次所见服务端版本）——
// 服务端 version 更大 → 409 CONFLICT 附服务端版本（前端弹「云端较新」）；
// 首次保存（无 baseVersion）→ upsert；version 服务端递增。
// data 为整体 JSON 对象（与 localStorage 草稿零适配）。

const { HttpError, sendJson, readJson } = require('../../http');
const { requireSession } = require('../../middleware/auth');

const MAX_BYTES = 4 * 1024 * 1024;
const DOC_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function rowToDraft(row) {
  return { data: JSON.parse(row.data), version: row.version, updatedAt: row.updated_at, sizeBytes: row.size_bytes };
}

function register(router, ctx) {
  const db = ctx.db;

  router.add('GET', '/api/drafts/fluidcanvas/:docId', requireSession((req, res, c) => {
    const docId = req.params.docId;
    if (!DOC_RE.test(docId)) throw new HttpError('VALIDATION', '文档 id 无效');
    const row = db.prepare('SELECT * FROM fluidcanvas_drafts WHERE user_id = ? AND doc_id = ?').get(c.user.id, docId);
    if (!row) throw new HttpError('NOT_FOUND', '草稿不存在');
    sendJson(res, 200, { draft: rowToDraft(row) });
  }));

  router.add('PUT', '/api/drafts/fluidcanvas/:docId', requireSession(async (req, res, c) => {
    const docId = req.params.docId;
    if (!DOC_RE.test(docId)) throw new HttpError('VALIDATION', '文档 id 无效');
    const body = await readJson(req, MAX_BYTES + 1024);
    if (!body || typeof body.data !== 'object' || body.data === null || Array.isArray(body.data)) {
      throw new HttpError('VALIDATION', 'data 需为 JSON 对象');
    }
    const text = JSON.stringify(body.data);
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > MAX_BYTES) throw new HttpError('VALIDATION', '草稿超过 4MB');

    const existing = db.prepare('SELECT * FROM fluidcanvas_drafts WHERE user_id = ? AND doc_id = ?').get(c.user.id, docId);
    const baseVersion = body.baseVersion == null ? null : parseInt(body.baseVersion);
    if (existing && baseVersion != null && existing.version > baseVersion) {
      sendJson(res, 409, {
        error: { code: 'CONFLICT', message: '云端草稿较新' },
        draft: rowToDraft(existing),
      });
      return;
    }
    const iso = new Date().toISOString();
    const version = existing ? existing.version + 1 : 1;
    if (existing) {
      db.prepare('UPDATE fluidcanvas_drafts SET data = ?, version = ?, size_bytes = ?, updated_at = ? WHERE user_id = ? AND doc_id = ?')
        .run(text, version, bytes, iso, c.user.id, docId);
    } else {
      db.prepare('INSERT INTO fluidcanvas_drafts (user_id, doc_id, data, version, size_bytes, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(c.user.id, docId, text, version, bytes, iso);
    }
    sendJson(res, 200, { draft: { data: body.data, version, updatedAt: iso, sizeBytes: bytes } });
  }));

  router.add('DELETE', '/api/drafts/fluidcanvas/:docId', requireSession((req, res, c) => {
    const docId = req.params.docId;
    if (!DOC_RE.test(docId)) throw new HttpError('VALIDATION', '文档 id 无效');
    db.prepare('DELETE FROM fluidcanvas_drafts WHERE user_id = ? AND doc_id = ?').run(c.user.id, docId);
    sendJson(res, 200, { ok: true });
  }));
}

module.exports = { register };
