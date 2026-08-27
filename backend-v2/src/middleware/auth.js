'use strict';
// 公网用户会话鉴权：cookie mn_session（HttpOnly+SameSite=Lax，生产加 Secure）→ sha256 → user_sessions 表 → users。
// authenticate 未登录 401 UNAUTHORIZED；封禁/已删 403 ACCOUNT_BANNED。
// 每次成功鉴权记 activity_daily（D9 DAU 源，010 迁移未应用时静默）。
// staff 鉴权在 staff-auth.js（独立会话 sc_session，D2）。

const crypto = require('node:crypto');
const { HttpError } = require('../http');
const { recordActivity } = require('./activity');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function readToken(req, cookieName) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === cookieName) return part.slice(eq + 1).trim();
  }
  return null;
}

// 会话有效则挂 ctx.user（users 行快照），否则抛错
function authenticate(db, req, res, ctx) {
  const token = readToken(req, ctx.config.sessionCookie);
  if (!token) throw new HttpError('UNAUTHORIZED', '未登录');
  const row = db.prepare(`
    SELECT u.* FROM user_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(hashToken(token), new Date().toISOString());
  if (!row) throw new HttpError('UNAUTHORIZED', '会话已过期');
  if (row.status === 'banned') throw new HttpError('ACCOUNT_BANNED', '账号已被封禁');
  if (row.status === 'deleted') throw new HttpError('ACCOUNT_BANNED', '账号已删除');
  ctx.user = row;
  recordActivity(db, row.id);
  return row;
}

function requireSession(handler) {
  return (req, res, ctx) => {
    authenticate(ctx.db, req, res, ctx);
    return handler(req, res, ctx);
  };
}

// 会话创建/销毁
function createSession(db, userId, ttlMs, now = new Date()) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), userId, now.toISOString(), new Date(now.getTime() + ttlMs).toISOString());
  return token;
}

function destroySession(db, token) {
  if (token) db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(hashToken(token));
}

// token 为空串 + Max-Age=0 即清除 cookie
function sessionCookie(token, cfg, maxAgeSec) {
  const parts = [`${cfg.sessionCookie}=${token}`, 'HttpOnly', 'Path=/', `Max-Age=${maxAgeSec}`, 'SameSite=Lax'];
  if (cfg.nodeEnv === 'production') parts.push('Secure');
  if (cfg.cookieDomain) parts.push(`Domain=${cfg.cookieDomain}`); // 前后端分离：放大到根域供前端子域共享
  return parts.join('; ');
}

module.exports = {
  hashToken, readToken, authenticate, requireSession,
  createSession, destroySession, sessionCookie
};
