'use strict';
// 官方验证码校验（P5）：契约与 badge.js 头部注释逐字一致。
// POST /api/badge/verify {code} → 200 {status:'valid', alias, role, duties, issuedAt, expiresAt}
// 无效/过期/已吊销 → 404 {status:'invalid'}（前端显示「无效的验证码」）。
// 码与当次私信事由绑定记录；过期后不再保留可反查内容（签发在 P9 管理端，写审计）。

const { HttpError, sendJson, readJson } = require('../../http');
const { ipOf } = require('../../middleware/ratelimit');

function register(router, ctx) {
  const db = ctx.db;

  router.add('POST', '/api/badge/verify', async (req, res) => {
    const w = (ctx.config.rateLimits || {}).badgeVerify || { max: 30, windowMs: 60000 };
    if (!ctx.limiter('bd:ip:' + ipOf(req), w.max, w.windowMs)) throw new HttpError('RATE_LIMITED', '验证过于频繁');
    const body = await readJson(req, 4 * 1024);
    const code = String(body.code || '').trim().toUpperCase();
    const row = code ? db.prepare('SELECT * FROM badge_codes WHERE code = ?').get(code) : null;
    const now = new Date().toISOString();
    if (!row || row.revoked_at || !row.expires_at || row.expires_at <= now) {
      sendJson(res, 404, { status: 'invalid' });
      return;
    }
    sendJson(res, 200, {
      status: 'valid',
      alias: row.alias,
      role: row.role,
      duties: row.duties,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
    });
  });
}

module.exports = { register };
