'use strict';
// Staff 登录（D2 独立会话 cookie sc_session；/api/staff/* 前缀，D3）：
//   POST /api/staff/auth/email-code { email }    → { ok, ttlMs, resendMs }（防枚举恒 ok）
//   POST /api/staff/auth/verify   { email, code } → { staff, roles, permissions } + Set-Cookie sc_session
//   POST /api/staff/auth/logout                   → { ok }
//   GET  /api/staff/auth/me                       → { staff, roles, permissions }
//   PATCH /api/staff/auth/me                      → 自改公开档案（审计）
// 验证码表 email_codes actor_type='staff' + purpose='staff_login'（001 迁移）。
// DEV_LOGIN_CODE 同 v1 口径：仅本地、仅已有 staff 行。
// real_name 永不序列化（publicStaff，§17）。

const crypto = require('node:crypto');
const { HttpError, sendJson, readJson } = require('../../http');
const {
  authenticateStaff, requireStaff, staffRoles, staffPermissions, publicStaff,
  createStaffSession, destroyStaffSession, staffCookie
} = require('../../middleware/staff-auth');
const { readToken, hashToken } = require('../../middleware/auth');
const { ipOf } = require('../../middleware/ratelimit');
const { audit } = require('../../audit');
const { recordLogin } = require('../../security');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_ATTEMPTS_MAX = 5;
const RESEND_MS = 60 * 1000;

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
}
function randomCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

// staff 登录态响应公共形状（/verify 与 /me 一致）
function meShape(db, staffRow) {
  return {
    staff: publicStaff(staffRow),
    roles: staffRoles(db, staffRow.id),
    permissions: staffPermissions(db, staffRow.id)
  };
}

function register(router, deps) {
  const { db, config } = deps;
  const limit = (key, max, windowMs) => deps.limiter(key, max, windowMs);

  // ── 发码（防枚举：staff 行不存在也返回相同响应）──
  router.add('POST', '/api/staff/auth/email-code', async (req, res, ctx) => {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    if (!EMAIL_RE.test(email)) throw new HttpError('VALIDATION', '邮箱格式不正确');
    if (!limit('ec:staff:' + email, 1, RESEND_MS))
      throw new HttpError('RATE_LIMITED', '发送过于频繁，请稍后再试');
    if (!limit('ec:staff:ip:' + ipOf(req), 5, 3600 * 1000))
      throw new HttpError('RATE_LIMITED', '本机请求过于频繁，请稍后再试');

    const code = randomCode();
    const now = Date.now();
    db.prepare("INSERT INTO email_codes (code_hash, email, purpose, actor_type, created_at, expires_at) VALUES (?, ?, 'staff_login', 'staff', ?, ?)")
      .run(hashCode(code), email, new Date(now).toISOString(),
        new Date(now + config.emailCodeTtlMs).toISOString());
    const registered = !!db.prepare('SELECT 1 FROM staff WHERE email = ?').get(email);
    await deps.mailer.sendCode(email, code, { registered, purpose: 'staff_login' });
    sendJson(res, 200, { ok: true, ttlMs: config.emailCodeTtlMs, resendMs: RESEND_MS });
  });

  // ── 验证 + 建立 staff 会话 ──
  router.add('POST', '/api/staff/auth/verify', async (req, res, ctx) => {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const code = String(body.code || '').trim();
    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code))
      throw new HttpError('VALIDATION', '请输入 6 位验证码');
    if (!limit('vf:staff:ip:' + ipOf(req), 10, 60 * 1000))
      throw new HttpError('RATE_LIMITED', '尝试过于频繁，请稍后再试');

    const now = Date.now();
    const staffRow = db.prepare('SELECT * FROM staff WHERE email = ?').get(email);

    if (config.devLoginCode && config.nodeEnv !== 'production' && code === config.devLoginCode) {
      // 开发模式固定登录码：仅已有 staff 行（不存在与普通错码响应一致）
      if (!staffRow) throw new HttpError('VALIDATION', '验证码无效或已过期');
    } else {
      const recent = db.prepare(
        "SELECT * FROM email_codes WHERE email = ? AND purpose = 'staff_login' AND actor_type = 'staff' AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
      ).get(email, new Date(now).toISOString());
      const row = recent && recent.code_hash === hashCode(code) ? recent : null;
      if (!row || recent.attempts >= CODE_ATTEMPTS_MAX) {
        if (recent && recent.attempts < CODE_ATTEMPTS_MAX)
          db.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE code_hash = ?').run(recent.code_hash);
        throw new HttpError('VALIDATION', '验证码无效或已过期');
      }
      db.prepare('UPDATE email_codes SET consumed_at = ? WHERE code_hash = ?')
        .run(new Date(now).toISOString(), row.code_hash);
    }

    // 防枚举：码对了但无 staff 行 / 已停用 → 与错码同响应，但登录史如实记录（§5）
    if (!staffRow) {
      recordLogin(db, req, { actorType: 'staff', actorId: '', email, result: 'no_user' });
      throw new HttpError('VALIDATION', '验证码无效或已过期');
    }
    if (!staffRow.is_active) {
      recordLogin(db, req, { actorType: 'staff', actorId: staffRow.id, email, result: 'failed' });
      throw new HttpError('FORBIDDEN', '账号已停用');
    }

    const token = createStaffSession(db, staffRow.id, config.sessionTtlMs);
    recordLogin(db, req, { actorType: 'staff', actorId: staffRow.id, email, result: 'success', sessionId: token });
    res.setHeader('Set-Cookie', staffCookie(token, config, Math.floor(config.sessionTtlMs / 1000)));
    sendJson(res, 200, meShape(db, staffRow));
  });

  // ── 登出（幂等）──
  router.add('POST', '/api/staff/auth/logout', (req, res, ctx) => {
    const token = readToken(req, ctx.config.staffCookie);
    if (token) destroyStaffSession(ctx.db, token);
    res.setHeader('Set-Cookie', staffCookie('', ctx.config, 0));
    sendJson(res, 200, { ok: true });
  });

  // ── 当前 staff ──
  router.add('GET', '/api/staff/auth/me', requireStaff((req, res, ctx) => {
    sendJson(res, 200, meShape(ctx.db, ctx.staff));
  }));

  // ── 自改公开档案（§17 公开字段；审计）──
  router.add('PATCH', '/api/staff/auth/me', requireStaff(async (req, res, ctx) => {
    const body = await readJson(req);
    const sets = [];
    const vals = [];
    const prev = {};

    if (body.displayName !== undefined) {
      const name = String(body.displayName).trim();
      if (!name || name.length > 40) throw new HttpError('VALIDATION', '显示名需 1-40 字符');
      prev.displayName = ctx.staff.display_name;
      sets.push('display_name = ?'); vals.push(name);
    }
    if (body.alias !== undefined) {
      prev.alias = ctx.staff.alias;
      sets.push('alias = ?'); vals.push(String(body.alias).trim().slice(0, 40) || null);
    }
    if (body.position !== undefined) {
      prev.position = ctx.staff.position;
      sets.push('position = ?'); vals.push(String(body.position).trim().slice(0, 60));
    }
    if (body.timezone !== undefined) {
      const tz = String(body.timezone).trim().slice(0, 20);
      if (!tz) throw new HttpError('VALIDATION', '时区不能为空');
      prev.timezone = ctx.staff.timezone;
      sets.push('timezone = ?'); vals.push(tz);
    }
    if (body.workingHours !== undefined) {
      const wh = typeof body.workingHours === 'string' ? JSON.parse(body.workingHours) : body.workingHours;
      if (!wh || !wh.start || !wh.end) throw new HttpError('VALIDATION', '工作时间需 {start,end}');
      prev.workingHours = ctx.staff.working_hours;
      sets.push('working_hours = ?'); vals.push(JSON.stringify({ start: wh.start, end: wh.end }));
    }
    if (body.languages !== undefined) {
      const langs = typeof body.languages === 'string' ? JSON.parse(body.languages) : body.languages;
      if (!Array.isArray(langs) || !langs.length) throw new HttpError('VALIDATION', '语言需非空数组');
      prev.languages = ctx.staff.languages;
      sets.push('languages = ?'); vals.push(JSON.stringify(langs.map((s) => String(s).slice(0, 10))));
    }
    if (body.nationality !== undefined) {
      prev.nationality = ctx.staff.nationality;
      sets.push('nationality = ?'); vals.push(String(body.nationality).trim().slice(0, 40) || null);
    }

    if (sets.length) {
      sets.push('updated_at = ?'); vals.push(new Date().toISOString());
      ctx.db.prepare(`UPDATE staff SET ${sets.join(', ')} WHERE id = ?`).run(...vals, ctx.staff.id);
      const next = ctx.db.prepare('SELECT * FROM staff WHERE id = ?').get(ctx.staff.id);
      audit(ctx.db, req, ctx, {
        action: 'staff_profile_update',
        targetType: 'staff',
        targetId: ctx.staff.id,
        prev,
        next: publicStaff(next)
      });
      sendJson(res, 200, meShape(ctx.db, next));
      return;
    }
    sendJson(res, 200, meShape(ctx.db, ctx.staff));
  }));
}

module.exports = { register, meShape };
