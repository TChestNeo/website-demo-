'use strict';
// 学生认证（v0.2.44.0 A 方案：学校邮箱验证码全自动；B 学生证人工审核留待 W3 tickets 轮）：
//   POST /api/student-verify/email-code { email } → { ok, ttlMs, resendMs }（requireSession；域名白名单外 → STUDENT_EMAIL_DOMAIN 显式 400）
//   POST /api/student-verify/verify    { email, code } → { ok, student }（5 次错码锁；成功写 users 四列 + audit）
// 复用 W6 email_codes 基础设施（purpose 'student_verify'；60s 重发；中性防枚举响应）与独立限流桶
// （sv:email/sv:ip/svf:ip——学生邮箱 ≠ 账号邮箱，不占登录码配额）。有效期 365 天（config.student.ttlMs），
// 过期读取路径惰性清除（students.js studentRefresh，同 tier 惰性降级口径）。

const crypto = require('node:crypto');
const { HttpError, sendJson, readJson } = require('../../http');
const { requireSession } = require('../../middleware/auth');
const { ipOf } = require('../../middleware/ratelimit');
const { audit } = require('../../audit');
const { domainAllowed, studentShape } = require('../../students');
const { EMAIL_RE, normalizeEmail, randomCode, hashCode, CODE_ATTEMPTS_MAX, RESEND_MS } = require('./auth');

function register(router, deps) {
  const { db, config } = deps;

  const limit = (kind, key, fallback) => {
    const w = (config.rateLimits || {})[kind] || fallback;
    return deps.limiter(key, w.max, w.windowMs);
  };
  const domains = config.student && config.student.domains && config.student.domains.length
    ? config.student.domains : null; // null → students.js DEFAULT_DOMAINS

  // ── 发码（会话内；学校邮箱可与登录邮箱不同）──
  router.add('POST', '/api/student-verify/email-code', requireSession(async (req, res, ctx) => {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    if (!EMAIL_RE.test(email)) throw new HttpError('VALIDATION', '邮箱格式不正确');
    // 白名单先于限流与落库：拒绝零码行零邮件；域名拒绝是显式错误（白名单本是公开口径，不泄露用户数据）
    if (!domainAllowed(email, domains))
      throw new HttpError('STUDENT_EMAIL_DOMAIN', '该邮箱域名不在学校邮箱白名单，暂不支持自动认证');
    if (!limit('studentCodeEmail', 'sv:email:' + email, { max: 1, windowMs: RESEND_MS }))
      throw new HttpError('RATE_LIMITED', '发送过于频繁，请稍后再试');
    if (!limit('studentCodeIp', 'sv:ip:' + ipOf(req), { max: 5, windowMs: 3600 * 1000 }))
      throw new HttpError('RATE_LIMITED', '本机请求过于频繁，请稍后再试');

    const code = randomCode();
    const now = Date.now();
    db.prepare('INSERT INTO email_codes (code_hash, email, purpose, actor_type, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(hashCode(code), email, 'student_verify', 'user', new Date(now).toISOString(),
        new Date(now + config.emailCodeTtlMs).toISOString());
    await ctx.mailer.sendCode(email, code, { registered: true, purpose: 'student_verify' });
    sendJson(res, 200, { ok: true, ttlMs: config.emailCodeTtlMs, resendMs: RESEND_MS });
  }));

  // ── 验证（会话内；成功落 users 四列 + 消费码）──
  router.add('POST', '/api/student-verify/verify', requireSession(async (req, res, ctx) => {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const code = String(body.code || '').trim();
    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code))
      throw new HttpError('VALIDATION', '请输入 6 位验证码');
    if (!domainAllowed(email, domains))
      throw new HttpError('STUDENT_EMAIL_DOMAIN', '该邮箱域名不在学校邮箱白名单，暂不支持自动认证');
    if (!limit('studentVerifyIp', 'svf:ip:' + ipOf(req), { max: 10, windowMs: 60 * 1000 }))
      throw new HttpError('RATE_LIMITED', '尝试过于频繁，请稍后再试');

    const now = Date.now();
    // 爆破防护按「邮箱」计失败次数（错码不匹配 code_hash，不能按码查）——同 auth verify-code 语义
    const recent = db.prepare(
      "SELECT * FROM email_codes WHERE email = ? AND purpose = 'student_verify' AND actor_type = 'user' AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
    ).get(email, new Date(now).toISOString());
    const row = recent && recent.code_hash === hashCode(code) ? recent : null;
    if (!row || recent.attempts >= CODE_ATTEMPTS_MAX) {
      if (recent && recent.attempts < CODE_ATTEMPTS_MAX)
        db.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE code_hash = ?').run(recent.code_hash);
      throw new HttpError('VALIDATION', '验证码无效或已过期'); // 防枚举：不存在/错码/过期/锁满同款响应
    }

    db.prepare('UPDATE email_codes SET consumed_at = ? WHERE code_hash = ?')
      .run(new Date(now).toISOString(), row.code_hash);
    const iso = new Date(now).toISOString();
    const expIso = new Date(now + (config.student ? config.student.ttlMs : 365 * 24 * 3600 * 1000)).toISOString();
    db.prepare('UPDATE users SET student_email = ?, student_verified_at = ?, student_expires_at = ?, '
      + "student_source = 'email_code', updated_at = ? WHERE id = ?")
      .run(email, iso, expIso, iso, ctx.user.id);
    const next = db.prepare('SELECT * FROM users WHERE id = ?').get(ctx.user.id);
    audit(db, null, {}, {
      // audit_log actor_type CHECK 只收 staff/system/stripe/cron——用户自助操作按既有口径记 system + 用户 id
      //（同 password_reset 约定；action/reason 区分行为主体）
      actorType: 'system',
      actorId: ctx.user.id,
      action: 'student_verify',
      targetType: 'user',
      targetId: ctx.user.id,
      prev: {},
      next: { email, expiresAt: expIso, source: 'email_code' },
      reason: 'via:email_code'
    });
    sendJson(res, 200, { ok: true, student: studentShape(next) });
  }));
}

module.exports = { register };
