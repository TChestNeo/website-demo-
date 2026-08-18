'use strict';
// 邮箱验证码认证（无密码）——P2 契约：
//   POST /api/auth/email-code { email, purpose? }          → { ok, ttlMs, resendMs }（防枚举恒 ok；邮件文案按是否注册区分）
//   POST /api/auth/verify     { email, code, displayName? } → { status:'login'|'new', user, restored? } + Set-Cookie mn_session
//   POST /api/auth/logout      （无会话也 200）              → { ok }
//   GET  /api/auth/me          （会话）                      → { user }
//   PATCH /api/auth/me         （会话）{ displayName?, avatarUrl?, language?, country?, dob?, bio? } → { user }
//   POST /api/auth/delete      （会话 + delete_confirm 码）  → { ok, restoreBy }（30 天后悔期；再登录即恢复）
// user 形状与前端 slati_user 逐字段一致（displayName/email/citizenId/avatarUrl/…），零适配。

const crypto = require('node:crypto');
const { HttpError, sendJson, readJson } = require('../http');
const {
  hashToken, readToken, authenticate, requireSession,
  createSession, sessionCookie
} = require('../middleware/auth');
const { ipOf } = require('../middleware/ratelimit');
const { pad6, insertWithId } = require('../ids');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAY_MAX = 40;
const CODE_ATTEMPTS_MAX = 5;       // 单码最多错 5 次
const RESEND_MS = 60 * 1000;       // 发码重发间隔

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
}
function randomCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}
function avatarFor(name) {
  return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=4648d4&color=fff&size=80';
}

// users 行 → 前端 slati_user 形状（snake→camel）
function publicUser(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    citizenId: row.citizen_id,
    avatarUrl: row.avatar_url,
    tier: row.tier,
    role: row.role,
    status: row.status,
    createdAt: row.created_at
  };
}

// 建号（verify 与测试共用）：返回完整 users 行
function createUser(db, { email, displayName, tier = 'basic', role = 'user', status = 'active' }) {
  const iso = new Date().toISOString();
  let name = String(displayName || '').trim() || normalizeEmail(email).split('@')[0] || 'Sovereign';
  if (name.length > DISPLAY_MAX) name = name.slice(0, DISPLAY_MAX);
  const { id, seq } = insertWithId(
    db, 'users',
    ['email', 'display_name', 'avatar_url', 'language', 'tier', 'role', 'status', 'created_at', 'updated_at'],
    [normalizeEmail(email), name, avatarFor(name), 'zh', tier, role, status, iso, iso],
    (s) => 'USR-' + pad6(s)
  );
  const citizenId = 'CIT-' + pad6(seq);
  db.prepare('UPDATE users SET citizen_id = ? WHERE id = ?').run(citizenId, id);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function register(router, deps) {
  const { db, config } = deps;

  const limit = (kind, key, fallback) => {
    const w = (config.rateLimits || {})[kind] || fallback;
    return deps.limiter(key, w.max, w.windowMs);
  };

  // ── 发码 ──
  router.add('POST', '/api/auth/email-code', async (req, res, ctx) => {
    const body = await readJson(req);
    const purpose = body.purpose === 'delete_confirm' ? 'delete_confirm' : 'login';
    let email = normalizeEmail(body.email);
    if (purpose === 'delete_confirm') {
      email = authenticate(ctx.db, req, res, ctx).email; // 需会话，邮箱强制取当前用户
    }
    if (!EMAIL_RE.test(email)) throw new HttpError('VALIDATION', '邮箱格式不正确');
    if (!limit('emailCodeEmail', 'ec:email:' + email, { max: 1, windowMs: RESEND_MS }))
      throw new HttpError('RATE_LIMITED', '发送过于频繁，请稍后再试');
    if (!limit('emailCodeIp', 'ec:ip:' + ipOf(req), { max: 5, windowMs: 3600 * 1000 }))
      throw new HttpError('RATE_LIMITED', '本机请求过于频繁，请稍后再试');

    const code = randomCode();
    const now = Date.now();
    db.prepare('INSERT INTO email_codes (code_hash, email, purpose, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(hashCode(code), email, purpose, new Date(now).toISOString(),
        new Date(now + config.emailCodeTtlMs).toISOString());
    const registered = !!db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
    await deps.mailer.sendCode(email, code, { registered, purpose });
    sendJson(res, 200, { ok: true, ttlMs: config.emailCodeTtlMs, resendMs: RESEND_MS });
  });

  // ── 验证 + 登录/建号 ──
  router.add('POST', '/api/auth/verify', async (req, res, ctx) => {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const code = String(body.code || '').trim();
    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code))
      throw new HttpError('VALIDATION', '请输入 6 位验证码');
    if (!limit('verifyIp', 'vf:ip:' + ipOf(req), { max: 10, windowMs: 60 * 1000 }))
      throw new HttpError('RATE_LIMITED', '尝试过于频繁，请稍后再试');

    const now = Date.now();
    // 爆破防护按「邮箱」计失败次数（错码不匹配 code_hash，不能按码查）
    const recent = db.prepare(
      "SELECT * FROM email_codes WHERE email = ? AND purpose = 'login' AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
    ).get(email, new Date(now).toISOString());
    const row = recent && recent.code_hash === hashCode(code) ? recent : null;
    if (!row || recent.attempts >= CODE_ATTEMPTS_MAX) {
      // 失败计数封顶在 MAX（锁定后不再递增）
      if (recent && recent.attempts < CODE_ATTEMPTS_MAX)
        db.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE code_hash = ?').run(recent.code_hash);
      throw new HttpError('VALIDATION', '验证码无效或已过期');
    }
    db.prepare('UPDATE email_codes SET consumed_at = ? WHERE code_hash = ?')
      .run(new Date(now).toISOString(), row.code_hash);

    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    let status = 'login';
    let restored = false;
    if (!user) {
      user = createUser(db, { email, displayName: body.displayName });
      status = 'new';
    } else if (user.status === 'banned') {
      throw new HttpError('ACCOUNT_BANNED', '账号已被封禁');
    } else if (user.status === 'deleted') {
      throw new HttpError('ACCOUNT_BANNED', '账号已删除');
    } else if (user.status === 'delete_pending') {
      // 30 天后悔期内再登录 = 恢复账号
      db.prepare("UPDATE users SET status = 'active', delete_requested_at = NULL, updated_at = ? WHERE id = ?")
        .run(new Date(now).toISOString(), user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      restored = true;
    }

    const token = createSession(db, user.id, config.sessionTtlMs);
    db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').run(new Date(now).toISOString(), user.id);
    res.setHeader('Set-Cookie', sessionCookie(token, config, Math.floor(config.sessionTtlMs / 1000)));
    sendJson(res, 200, { status, user: publicUser(user), ...(restored ? { restored: true } : {}) });
  });

  // ── 登出（幂等）──
  router.add('POST', '/api/auth/logout', (req, res, ctx) => {
    const token = readToken(req, ctx.config.sessionCookie);
    if (token) ctx.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    res.setHeader('Set-Cookie', sessionCookie('', ctx.config, 0));
    sendJson(res, 200, { ok: true });
  });

  // ── 当前用户 ──
  router.add('GET', '/api/auth/me', requireSession((req, res, ctx) => {
    const now = Date.now();
    // 活跃时间 1 小时刷新一次，避免每请求写库
    if (!ctx.user.last_active_at || now - new Date(ctx.user.last_active_at).getTime() > 3600 * 1000) {
      ctx.db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?')
        .run(new Date(now).toISOString(), ctx.user.id);
    }
    sendJson(res, 200, { user: publicUser(ctx.user) });
  }));

  router.add('PATCH', '/api/auth/me', requireSession(async (req, res, ctx) => {
    const body = await readJson(req);
    const sets = [];
    const vals = [];
    const push = (sql, v) => { sets.push(sql); vals.push(v); };

    if (body.displayName !== undefined) {
      const name = String(body.displayName).trim();
      if (!name || name.length > DISPLAY_MAX) throw new HttpError('VALIDATION', '显示名需 1-40 字符');
      push('display_name = ?', name);
      if (!ctx.user.avatar_url) push('avatar_url = ?', avatarFor(name));
    }
    if (body.avatarUrl !== undefined) push('avatar_url = ?', String(body.avatarUrl).slice(0, 500));
    if (body.language !== undefined) push('language = ?', String(body.language).slice(0, 10));
    if (body.country !== undefined) push('country = ?', String(body.country).slice(0, 60));
    if (body.bio !== undefined) push('bio = ?', String(body.bio).slice(0, 500));
    if (body.dob !== undefined) {
      const dob = String(body.dob);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) throw new HttpError('VALIDATION', '出生日期格式应为 YYYY-MM-DD');
      const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
      if (age < 13) throw new HttpError('VALIDATION', '必须年满 13 周岁');
      push('dob = ?', dob);
    }
    if (sets.length) {
      push('updated_at = ?', new Date().toISOString());
      ctx.db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, ctx.user.id);
    }
    sendJson(res, 200, { user: publicUser(ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(ctx.user.id)) });
  }));

  // ── 删号（30 天后悔期）──
  router.add('POST', '/api/auth/delete', requireSession(async (req, res, ctx) => {
    const body = await readJson(req);
    const code = String(body.code || '').trim();
    const now = Date.now();
    const recent = ctx.db.prepare(
      "SELECT * FROM email_codes WHERE email = ? AND purpose = 'delete_confirm' AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
    ).get(ctx.user.email, new Date(now).toISOString());
    const row = recent && recent.code_hash === hashCode(code) ? recent : null;
    if (!row || recent.attempts >= CODE_ATTEMPTS_MAX) {
      if (recent && recent.attempts < CODE_ATTEMPTS_MAX)
        ctx.db.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE code_hash = ?').run(recent.code_hash);
      throw new HttpError('VALIDATION', '验证码无效或已过期');
    }
    ctx.db.prepare('UPDATE email_codes SET consumed_at = ? WHERE code_hash = ?')
      .run(new Date(now).toISOString(), row.code_hash);

    ctx.db.prepare("UPDATE users SET status = 'delete_pending', delete_requested_at = ?, updated_at = ? WHERE id = ?")
      .run(new Date(now).toISOString(), new Date(now).toISOString(), ctx.user.id);
    ctx.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(ctx.user.id);
    res.setHeader('Set-Cookie', sessionCookie('', ctx.config, 0));
    sendJson(res, 200, { ok: true, restoreBy: new Date(now + 30 * 24 * 3600 * 1000).toISOString() });
  }));
}

module.exports = { register, createUser, publicUser };
