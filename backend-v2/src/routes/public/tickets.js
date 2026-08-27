'use strict';
// 工单（P5）：匿名可提交（登录则挂 user_id）；契约与 ticket-submit.js 头部注释逐字一致：
// POST /api/tickets {category,type,contact,subject,description,locale,submittedAt}
//   → {id:'MN-2026-000123', status:'queued', position}
// id = MN-年-6 位 seq；position = 同状态更早提交计数 + 1（同毫秒按 seq 决序）；
// account/payment 自动 priority=urgent；限流 3 次/10 分钟/IP（可配覆盖）。

const { HttpError, sendJson, readJson } = require('../../http');
const { authenticate } = require('../../middleware/auth');
const { insertWithId, pad6 } = require('../../ids');
const { ipOf } = require('../../middleware/ratelimit');

// v2 扩 8 类（006 迁移）：refund/privacy 对齐 AI 客服转人工话术、other 兜底（v1 的 5 类全保留）
const CATEGORIES = ['bug', 'account', 'payment', 'payout', 'refund', 'privacy', 'suggestion', 'other'];
const MAX = { contact: 254, subject: 200, description: 10000, type: 50, locale: 10 };

function ticketLimit(ctx, req) {
  const w = (ctx.config.rateLimits || {}).tickets || { max: 3, windowMs: 600000 };
  return ctx.limiter('tk:ip:' + ipOf(req), w.max, w.windowMs);
}

function register(router, ctx) {
  const db = ctx.db;

  router.add('POST', '/api/tickets', async (req, res) => {
    if (!ticketLimit(ctx, req)) throw new HttpError('RATE_LIMITED', '提交过于频繁');
    const body = await readJson(req, 32 * 1024);

    const category = String(body.category || '');
    if (!CATEGORIES.includes(category)) throw new HttpError('VALIDATION', '工单类型无效');
    const contact = String(body.contact || '').trim();
    if (!contact || contact.length > MAX.contact || contact.indexOf('@') < 0) {
      throw new HttpError('VALIDATION', '联系方式需为有效邮箱');
    }
    const subject = String(body.subject || '').trim();
    if (!subject || subject.length > MAX.subject) {
      throw new HttpError('VALIDATION', `标题不能为空且最长 ${MAX.subject} 字`);
    }
    const description = String(body.description || '').trim();
    if (!description) throw new HttpError('VALIDATION', '描述不能为空');
    if (description.length > MAX.description) throw new HttpError('VALIDATION', `描述最长 ${MAX.description} 字`);
    const type = String(body.type || '').slice(0, MAX.type);
    const locale = String(body.locale || 'zh').slice(0, MAX.locale);

    // 登录用户挂 user_id；未登录/封禁 → 匿名提交（契约允许）
    let userId = null;
    try { userId = authenticate(db, req, res, ctx).id; } catch (e) { /* 匿名 */ }

    const submittedAt = !isNaN(Date.parse(body.submittedAt))
      ? new Date(body.submittedAt).toISOString() : new Date().toISOString();
    const priority = (category === 'account' || category === 'payment') ? 'urgent' : 'normal';
    const year = new Date().getUTCFullYear();
    const { id, seq } = insertWithId(db, 'tickets',
      ['user_id', 'category', 'type', 'contact', 'subject', 'description', 'locale',
       'submitted_at', 'status', 'priority', 'created_at', 'updated_at'],
      [userId, category, type, contact, subject, description, locale,
       submittedAt, 'queued', priority, submittedAt, submittedAt],
      (s) => 'MN-' + year + '-' + pad6(s));
    const position = db.prepare(`
      SELECT count(*) AS n FROM tickets
      WHERE status = 'queued' AND (submitted_at < ? OR (submitted_at = ? AND seq < ?))
    `).get(submittedAt, submittedAt, seq).n + 1;
    sendJson(res, 200, { id, status: 'queued', position });
  });
}

module.exports = { register };
