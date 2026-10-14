'use strict';
// 密码 + 每次邮箱码认证（W6）——v1 对等移植 + 双因素（公网路径逐字一致，响应形状 additive）：
//   POST /api/auth/email-code { email, purpose? }              → { ok, ttlMs, resendMs }（防枚举恒 ok；邮件文案按是否注册区分）
//   POST /api/auth/verify     { email, code, password?, displayName? } → { status:'login'|'new', user, restored?, passwordSetupRequired? } + Set-Cookie mn_session
//        （有密码账号 = 密码+码；新注册强制密码 ≥8；旧账号仅码登录 + passwordSetupRequired 引导设密）
//   POST /api/auth/password       （会话）{ newPassword }       → { ok, user }（首登设密/改密；清其他会话保当前）
//   POST /api/auth/password-reset （无会话）{ email, code, newPassword } → { ok }（复用 login 码；清全部会话强制重登）
//   POST /api/auth/verify-code （无会话）{ email, code } → { ok }（忘记密码输满先验：只验码不消费码，与 password-reset 共享 5 次锁）
//   POST /api/auth/logout      （无会话也 200）                  → { ok }
//   GET  /api/auth/me          （会话）                          → { user }
//   PATCH /api/auth/me         （会话）{ displayName?, avatarUrl?, language?, country?, dob?, bio?, gender? } → { user }
//   POST /api/auth/delete      （会话 + delete_confirm 码）      → { ok, restoreBy }（30 天后悔期；再登录即恢复）
// user 形状与前端 slati_user 逐字段一致（displayName/email/citizenId/avatarUrl/…），零适配。
// v2 增量：login_history/风险信号（§5）、PATCH/delete 审计（§5）、user_sessions、role 固定 'user'（D4）。

const crypto = require('node:crypto');
const { HttpError, sendJson, readJson } = require('../../http');
const {
  hashToken, readToken, authenticate, requireSession,
  createSession, sessionCookie
} = require('../../middleware/auth');
const { ipOf } = require('../../middleware/ratelimit');
const { pad6, insertWithId } = require('../../ids');
const { enforceTierExpiry } = require('../../tiers');
const { studentShape, studentRefresh } = require('../../students');
const { audit } = require('../../audit');
const { recordLogin, insertSecurityEvent } = require('../../security');
const { hashPassword, verifyPassword } = require('../../password');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAY_MAX = 40;
const CODE_ATTEMPTS_MAX = 5;       // 单码最多错 5 次
const RESEND_MS = 60 * 1000;       // 发码重发间隔
const PASSWORD_MIN = 8;            // W6 密码策略（路由层校验，策略是 HTTP 契约）
const PASSWORD_MAX = 72;
// v0.2.23.0 卡片背景预设白名单（迁移 018 users.card_bg；social.js 主页端点同名单校验，两处须同步）
// v0.2.58.22 追加 6 单色/黑白系预设（免费层横幅颜色：solid-* 单色 + mono-* 黑白渐变）
const CARD_BG_KEYS = ['glass-frost', 'glass-ocean', 'glass-violet', 'glass-rose', 'glass-mint', 'glass-sunset', 'glass-clear', 'solid-black', 'solid-white', 'solid-gray', 'mono-bw', 'mono-silver', 'mono-charcoal'];
// v0.2.53.0 卡片边缘主题（迁移 027 users.card_edge；FC 14 键；social.js 必须同步）
const CARD_EDGE_KEYS = ['paper', 'treasure', 'tech1', 'tech2', 'tech3', 'tech4', 'tech5', 'tech6', 'paint1', 'paint2', 'paint3', 'paint4', 'paint5', 'paint6'];

// v10.28.52.0 等级奖励装饰品白名单（033 表 user_cosmetics 稳定编码；display 名走前端 i18n 逐字表）
const FRAME_KEYS = ['rookie-frame', 'champion-frame'];
const TITLE_KEYS = ['veteran-title'];
// v0.2.25.0 页面背景图片（020 列）：仅本站直传路径（/uploads/UPL-*）或 http(s) 外链——防 CSS 注入等杂值
const PAGE_BG_IMAGE_RE = /^(\/uploads\/UPL-[A-Za-z0-9]+\.(jpg|jpeg|png|gif|webp)|https?:\/\/.)/i;
// 账号级设置使用 users.preferences（001 已预留）跨设备同步。只接受当前 UI 已展示的键，
// 避免把任意客户端对象塞进用户行；互动许可后续由各功能读同一份偏好执行。
const BOOLEAN_PREFERENCE_KEYS = new Set([
  'notify', 'private_acct', 'allow_comments', 'allow_mentions', 'allow_dm',
  'allow_derivative', 'reduce_motion',
  'topic_政治', 'topic_经济', 'topic_文化', 'topic_科技',
  'topic_军事', 'topic_体育', 'topic_娱乐', 'topic_生活'
]);
const AUDIENCE_VALUES = new Set(['public', 'followers', 'private']);

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
// v0.2.58.25 裁切矩形校验（030 列）：归一化 {x,y,w,h} 0..1（x+w≤1、y+h≤1）；写侧严格（坏值 400）、读侧宽容（坏值回 null）
function parseCrop(v) {
  if (v === null) return null;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new HttpError('VALIDATION', '裁切参数无效');
  const { x, y, w, h } = v;
  if (![x, y, w, h].every((n) => typeof n === 'number' && Number.isFinite(n))) throw new HttpError('VALIDATION', '裁切参数无效');
  if (x < 0 || y < 0 || x > 1 || y > 1 || w <= 0 || h <= 0 || w > 1 || h > 1) throw new HttpError('VALIDATION', '裁切参数无效');
  if (x + w > 1 + 1e-6 || y + h > 1 + 1e-6) throw new HttpError('VALIDATION', '裁切参数无效');
  return { x, y, w, h };
}
function parseCropSafe(raw) {
  if (raw === null || raw === undefined) return null;
  let v = raw;
  if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch (e) { return null; } }
  try { return parseCrop(v); } catch (e) { return null; }
}

function parsePreferences(raw) {
  if (!raw) return {};
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (e) { return {}; }
}

function mergePreferences(raw, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new HttpError('VALIDATION', '偏好设置需为对象');
  }
  const next = parsePreferences(raw);
  for (const [key, value] of Object.entries(patch)) {
    if (BOOLEAN_PREFERENCE_KEYS.has(key)) {
      if (typeof value !== 'boolean') throw new HttpError('VALIDATION', `${key} 需为布尔值`);
      next[key] = value;
      continue;
    }
    if (key === 'audience') {
      if (!AUDIENCE_VALUES.has(value)) throw new HttpError('VALIDATION', '观众范围无效');
      next.audience = value;
      continue;
    }
    throw new HttpError('VALIDATION', `不支持的偏好设置：${key}`);
  }
  const json = JSON.stringify(next);
  if (Buffer.byteLength(json, 'utf8') > 4096) throw new HttpError('VALIDATION', '偏好设置过大');
  return { value: next, json };
}

// users 行 → 前端 slati_user 形状（snake→camel）
function publicUser(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    citizenId: row.citizen_id,
    avatarUrl: row.avatar_url,
    language: row.language,
    country: row.country || null,
    dob: row.dob || null,
    bio: row.bio || '',
    tier: row.tier,
    tierExpiresAt: row.tier_expires_at || null, // 订阅到期（NULL = 永久/未开通）
    role: row.role,
    status: row.status,
    hasPassword: !!row.password_hash, // W6：前端据此判断是否需引导设密（additive）
    gender: row.gender || null, // 013：Male/Female/Other（注册第二页下拉），NULL = 未填写
    student: studentShape(row), // v0.2.44.0：认证有效 → {email, verifiedAt, expiresAt, source}，否则 null
    xpGained: row.xp_gained || 0, // v0.2.49.0 获得类经验（粉丝/赞/评论/收藏，后端实时累加；前端登录同步进徽章）
    // v10.28.52.0 等级奖励装饰品激活态（033 列）：头像相框/称号（未解锁时 null；PATCH 校验拥有才可设）
    avatarFrame: row.avatar_frame || null,
    title: row.title || null,
    // v0.2.58.25 裁切元数据（030 列；坏值宽容回 null——settings 弹窗全站读 slati_user 需要；mirrorProfile 白名单不含此二键）
    avatarCrop: parseCropSafe(row.avatar_crop),
    bannerCrop: parseCropSafe(row.banner_crop),
    preferences: parsePreferences(row.preferences),
    createdAt: row.created_at
  };
}

// 建号（verify 与测试共用）：返回完整 users 行。v2：role 恒 'user'（CHECK 约束，D4）。
// W6：passwordHash 默认为 null（测试可直传已哈希串）
function createUser(db, { email, displayName, tier = 'free', status = 'active', passwordHash = null }) {
  const iso = new Date().toISOString();
  let name = String(displayName || '').trim() || normalizeEmail(email).split('@')[0] || 'Sovereign';
  if (name.length > DISPLAY_MAX) name = name.slice(0, DISPLAY_MAX);
  const { id, seq } = insertWithId(
    db, 'users',
    ['email', 'display_name', 'avatar_url', 'language', 'tier', 'status', 'password_hash', 'created_at', 'updated_at'],
    [normalizeEmail(email), name, avatarFor(name), 'zh', tier, status, passwordHash, iso, iso],
    (s) => 'USR-' + pad6(s)
  );
  const citizenId = id; // v0.2.51.1：公民号与用户 ID 统一（USR- 口径；原 CIT- 前缀撤除）
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
    // password_reset：忘记密码发码（注册与否同款中性文案——不泄露注册状态；其余目的默认 login）
    const purpose = body.purpose === 'delete_confirm' ? 'delete_confirm'
      : body.purpose === 'password_reset' ? 'password_reset' : 'login';
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
    db.prepare('INSERT INTO email_codes (code_hash, email, purpose, actor_type, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(hashCode(code), email, purpose, 'user', new Date(now).toISOString(),
        new Date(now + config.emailCodeTtlMs).toISOString());
    const registered = !!db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
    await deps.mailer.sendCode(email, code, { registered, purpose });
    sendJson(res, 200, { ok: true, ttlMs: config.emailCodeTtlMs, resendMs: RESEND_MS });
  });

  // ── 验证 + 登录/建号（W6 三段：码校验 → 密码校验 → 消费码）──
  router.add('POST', '/api/auth/verify', async (req, res, ctx) => {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const code = String(body.code || '').trim();
    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code))
      throw new HttpError('VALIDATION', '请输入 6 位验证码');
    if (!limit('verifyIp', 'vf:ip:' + ipOf(req), { max: 10, windowMs: 60 * 1000 }))
      throw new HttpError('RATE_LIMITED', '尝试过于频繁，请稍后再试');

    const now = Date.now();
    if (config.devLoginCode && config.nodeEnv !== 'production' && code === config.devLoginCode) {
      // 开发模式固定登录码：跳过邮件码与密码校验（仅登录已有账号；不存在的邮箱与普通错码响应一致）
      // nodeEnv 生产双重拒绝——config.js 已按 NODE_ENV 剥离，此处再兜底（测试可注入 nodeEnv 验证）
      if (!db.prepare('SELECT 1 FROM users WHERE email = ?').get(email))
        throw new HttpError('VALIDATION', '验证码无效或已过期');
    } else {
      // 爆破防护按「邮箱」计失败次数（错码不匹配 code_hash，不能按码查）
      const recent = db.prepare(
        "SELECT * FROM email_codes WHERE email = ? AND purpose = 'login' AND actor_type = 'user' AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
      ).get(email, new Date(now).toISOString());
      const row = recent && recent.code_hash === hashCode(code) ? recent : null;
      if (!row || recent.attempts >= CODE_ATTEMPTS_MAX) {
        // 失败计数封顶在 MAX（锁定后不再递增）；耗尽即记登录失败史（§5）
        if (recent && recent.attempts < CODE_ATTEMPTS_MAX) {
          db.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE code_hash = ?').run(recent.code_hash);
          if (recent.attempts + 1 >= CODE_ATTEMPTS_MAX) {
            const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
            if (u) recordLogin(db, req, { actorType: 'user', actorId: u.id, email, result: 'failed' });
          }
        }
        throw new HttpError('VALIDATION', '验证码无效或已过期');
      }
      // 码通过 → 密码校验（W6）：有密码的账号在此验密码，新注册必须先过密码策略。
      // 两处失败均不消费码（可同码改对重试）；错密码与码错共用 attempts 计数；
      // 旧账号（password_hash NULL）忽略密码参数放行。
      const user0 = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (user0 && user0.password_hash) {
        if (!(await verifyPassword(String(body.password || ''), user0.password_hash))) {
          db.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE code_hash = ?').run(row.code_hash);
          if (row.attempts + 1 >= CODE_ATTEMPTS_MAX)
            recordLogin(db, req, { actorType: 'user', actorId: user0.id, email, result: 'failed' });
          throw new HttpError('VALIDATION', '密码或验证码错误');
        }
      } else if (!user0) {
        const pw = String(body.password || '');
        if (pw.length < PASSWORD_MIN || pw.length > PASSWORD_MAX)
          throw new HttpError('VALIDATION', '密码长度需 8-72 字符');
      }
      db.prepare('UPDATE email_codes SET consumed_at = ? WHERE code_hash = ?')
        .run(new Date(now).toISOString(), row.code_hash);
    }

    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    let status = 'login';
    let restored = false;
    if (!user) {
      // W6：新注册必须带密码（8-72，码通过段已校验不消费码）——裸 API 不带密码不能造无密码号
      user = createUser(db, { email, displayName: body.displayName, passwordHash: await hashPassword(String(body.password || '')) });
      status = 'new';
    } else if (user.status === 'banned') {
      recordLogin(db, req, { actorType: 'user', actorId: user.id, email, result: 'banned' });
      throw new HttpError('ACCOUNT_BANNED', '账号已被封禁');
    } else if (user.status === 'deleted') {
      recordLogin(db, req, { actorType: 'user', actorId: user.id, email, result: 'deleted' });
      throw new HttpError('ACCOUNT_BANNED', '账号已删除');
    } else if (user.status === 'delete_pending') {
      // 30 天后悔期内再登录 = 恢复账号
      db.prepare("UPDATE users SET status = 'active', delete_requested_at = NULL, updated_at = ? WHERE id = ?")
        .run(new Date(now).toISOString(), user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      restored = true;
    }
    // 订阅到期惰性降级（登录即生效）
    user = enforceTierExpiry(db, config, user);

    const token = createSession(db, user.id, config.sessionTtlMs);
    db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').run(new Date(now).toISOString(), user.id);
    recordLogin(db, req, { actorType: 'user', actorId: user.id, email, result: 'success', sessionId: token });
    res.setHeader('Set-Cookie', sessionCookie(token, config, Math.floor(config.sessionTtlMs / 1000)));
    sendJson(res, 200, {
      status, user: publicUser(user),
      ...(restored ? { restored: true } : {}),
      ...(!user.password_hash ? { passwordSetupRequired: true } : {}) // W6：旧账号引导设密
    });
  });

  // ── 登出（幂等）──
  router.add('POST', '/api/auth/logout', (req, res, ctx) => {
    const token = readToken(req, ctx.config.sessionCookie);
    if (token) ctx.db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(hashToken(token));
    res.setHeader('Set-Cookie', sessionCookie('', ctx.config, 0));
    sendJson(res, 200, { ok: true });
  });

  // ── 当前用户 ──
  router.add('GET', '/api/auth/me', requireSession((req, res, ctx) => {
    const now = Date.now();
    // 订阅到期惰性降级（webhook 断链/扣款失败的最终兜底）
    const user = studentRefresh(ctx.db, enforceTierExpiry(ctx.db, ctx.config, ctx.user));
    // 活跃时间 1 小时刷新一次，避免每请求写库
    if (!user.last_active_at || now - new Date(user.last_active_at).getTime() > 3600 * 1000) {
      ctx.db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?')
        .run(new Date(now).toISOString(), user.id);
    }
    sendJson(res, 200, { user: publicUser(user) });
  }));

  router.add('PATCH', '/api/auth/me', requireSession(async (req, res, ctx) => {
    const body = await readJson(req);
    const sets = [];
    const vals = [];
    const push = (sql, v) => { sets.push(sql); vals.push(v); };
    const prev = {};

    if (body.displayName !== undefined) {
      const name = String(body.displayName).trim();
      if (!name || name.length > DISPLAY_MAX) throw new HttpError('VALIDATION', '显示名需 1-40 字符');
      push('display_name = ?', name);
      prev.displayName = ctx.user.display_name;
      if (!ctx.user.avatar_url) push('avatar_url = ?', avatarFor(name));
    }
    // v0.2.58.18 加固（029 轮）：null = 清除头像，显式 null 合法（修 String(null) 写 "null" 串缺陷）；
    // 仅本站上传路径或 http(s) 外链（PAGE_BG_IMAGE_RE 同款）——注册默认 ui-avatars https / 上传路径全过验
    if (body.avatarUrl !== undefined) {
      const avatarUrl = body.avatarUrl === null ? null : String(body.avatarUrl).slice(0, 500);
      if (avatarUrl !== null && !PAGE_BG_IMAGE_RE.test(avatarUrl)) {
        throw new HttpError('VALIDATION', '头像需为 http(s) 链接或本站上传图片');
      }
      push('avatar_url = ?', avatarUrl);
      prev.avatarUrl = ctx.user.avatar_url;
      // v0.2.58.25 连带清（030 列）：url 变更未带新裁切（含置 null）→ 裁切重置（防旧裁切错配新图）
      if (body.avatarCrop === undefined || avatarUrl === null) { push('avatar_crop = ?', null); prev.avatarCrop = ctx.user.avatar_crop; }
    }
    // v0.2.58.25 头像裁切（030 列；null = 恢复默认整图 cover，显式 null 合法；url 置 null 时不落裁切——连带清已收编）
    if (body.avatarCrop !== undefined && !(body.avatarUrl !== undefined && body.avatarUrl === null)) {
      const crop = body.avatarCrop === null ? null : parseCrop(body.avatarCrop);
      push('avatar_crop = ?', crop ? JSON.stringify(crop) : null);
      prev.avatarCrop = ctx.user.avatar_crop;
    }
    if (body.language !== undefined) {
      push('language = ?', String(body.language).slice(0, 10));
      prev.language = ctx.user.language;
    }
    if (body.country !== undefined) {
      push('country = ?', String(body.country).slice(0, 60));
      prev.country = ctx.user.country;
    }
    if (body.bio !== undefined) {
      push('bio = ?', String(body.bio).slice(0, 500));
      prev.bio = ctx.user.bio;
    }
    if (body.dob !== undefined) {
      const dob = String(body.dob);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) throw new HttpError('VALIDATION', '出生日期格式应为 YYYY-MM-DD');
      const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
      if (age < 13) throw new HttpError('VALIDATION', '必须年满 13 周岁');
      push('dob = ?', dob);
      prev.dob = ctx.user.dob;
    }
    if (body.preferences !== undefined) {
      const merged = mergePreferences(ctx.user.preferences, body.preferences);
      push('preferences = ?', merged.json);
      prev.preferences = parsePreferences(ctx.user.preferences);
    }
    if (body.gender !== undefined) {
      const gender = String(body.gender).trim();
      if (!['Male', 'Female', 'Other'].includes(gender)) throw new HttpError('VALIDATION', '性别需为 Male / Female / Other');
      push('gender = ?', gender);
      prev.gender = ctx.user.gender;
    }
    // v0.2.23.0 卡片背景（018 列；null = 恢复默认品牌横幅，显式 null 合法）
    if (body.cardBg !== undefined) {
      const cardBg = body.cardBg === null ? null : String(body.cardBg);
      if (cardBg !== null && !CARD_BG_KEYS.includes(cardBg)) throw new HttpError('VALIDATION', '卡片背景样式无效');
      push('card_bg = ?', cardBg);
      prev.cardBg = ctx.user.card_bg;
    }
    // v0.2.24.0 独立卡片背景（019 列；null = 无背景层，显式 null 合法；白名单与 cardBg 同）
    if (body.cardPlate !== undefined) {
      const cardPlate = body.cardPlate === null ? null : String(body.cardPlate);
      if (cardPlate !== null && !CARD_BG_KEYS.includes(cardPlate)) throw new HttpError('VALIDATION', '卡片背景样式无效');
      push('card_plate = ?', cardPlate);
      prev.cardPlate = ctx.user.card_plate;
    }
    // v0.2.25.0 页面背景图片（020 列；null = 无背景，显式 null 合法；仅本站上传路径或 http(s) 外链）
    if (body.pageBgImage !== undefined) {
      const pageBgImage = body.pageBgImage === null ? null : String(body.pageBgImage).slice(0, 2048);
      if (pageBgImage !== null && !PAGE_BG_IMAGE_RE.test(pageBgImage)) {
        throw new HttpError('VALIDATION', '页面背景图片需为 http(s) 链接或本站上传图片');
      }
      push('page_bg_image = ?', pageBgImage);
      prev.pageBgImage = ctx.user.page_bg_image;
    }
    // v0.2.58.18 个人资料横幅（029 列；null = 移除恢复默认预设渐变，显式 null 合法；仅本站上传路径或 http(s) 外链）
    if (body.bannerUrl !== undefined) {
      const bannerUrl = body.bannerUrl === null ? null : String(body.bannerUrl).slice(0, 500);
      if (bannerUrl !== null && !PAGE_BG_IMAGE_RE.test(bannerUrl)) {
        throw new HttpError('VALIDATION', '横幅需为 http(s) 链接或本站上传图片');
      }
      push('banner_url = ?', bannerUrl);
      prev.bannerUrl = ctx.user.banner_url;
      // v0.2.58.25 连带清（030 列）：url 变更未带新裁切（含置 null）→ 裁切重置（防旧裁切错配新图）
      if (body.bannerCrop === undefined || bannerUrl === null) { push('banner_crop = ?', null); prev.bannerCrop = ctx.user.banner_crop; }
    }
    // v0.2.58.25 横幅裁切（030 列；null = 恢复默认整图 cover，显式 null 合法；url 置 null 时不落裁切——连带清已收编）
    if (body.bannerCrop !== undefined && !(body.bannerUrl !== undefined && body.bannerUrl === null)) {
      const crop = body.bannerCrop === null ? null : parseCrop(body.bannerCrop);
      push('banner_crop = ?', crop ? JSON.stringify(crop) : null);
      prev.bannerCrop = ctx.user.banner_crop;
    }
    // v0.2.53.0 卡片边缘主题（027 列；null = 恢复默认圆角卡，显式 null 合法；白名单 14 键）
    if (body.cardEdge !== undefined) {
      const cardEdge = body.cardEdge === null ? null : String(body.cardEdge);
      if (cardEdge !== null && !CARD_EDGE_KEYS.includes(cardEdge)) throw new HttpError('VALIDATION', '卡片边缘样式无效');
      // v10.28.52.0 Lv.2 免费名片边缘解锁：免费用户非 null 边缘需先领奖（user_cosmetics edge/free-edge）；
      // null 恒放行（祖父条款：已设边缘的既有行不因本门被卡）；付费订阅恒放行
      if (cardEdge !== null && (!ctx.user.tier || ctx.user.tier === 'free')) {
        const unlocked = ctx.db.prepare("SELECT 1 FROM user_cosmetics WHERE user_id = ? AND kind = 'edge' AND value = 'free-edge'").get(ctx.user.id);
        if (!unlocked) throw new HttpError('FORBIDDEN', '免费用户需达到 Lv.2 解锁名片边缘（订阅或领取奖励后可用）');
      }
      push('card_edge = ?', cardEdge);
      prev.cardEdge = ctx.user.card_edge;
    }
    // v10.28.52.0 等级奖励装饰品激活（033 列）：null = 卸下（恒放行）；非 null 必须白名单内
    // 且已拥有（user_cosmetics 行）——装饰品只能戴已领的，防止伪造字段
    if (body.avatarFrame !== undefined) {
      const frame = body.avatarFrame === null ? null : String(body.avatarFrame);
      if (frame !== null) {
        if (!FRAME_KEYS.includes(frame)) throw new HttpError('VALIDATION', '头像相框样式无效');
        if (!ctx.db.prepare('SELECT 1 FROM user_cosmetics WHERE user_id = ? AND kind = ? AND value = ?').get(ctx.user.id, 'frame', frame)) {
          throw new HttpError('FORBIDDEN', '尚未解锁该头像相框');
        }
      }
      push('avatar_frame = ?', frame);
      prev.avatarFrame = ctx.user.avatar_frame;
    }
    if (body.title !== undefined) {
      const title = body.title === null ? null : String(body.title);
      if (title !== null) {
        if (!TITLE_KEYS.includes(title)) throw new HttpError('VALIDATION', '称号样式无效');
        if (!ctx.db.prepare('SELECT 1 FROM user_cosmetics WHERE user_id = ? AND kind = ? AND value = ?').get(ctx.user.id, 'title', title)) {
          throw new HttpError('FORBIDDEN', '尚未解锁该称号');
        }
      }
      push('title = ?', title);
      prev.title = ctx.user.title;
    }
    if (sets.length) {
      push('updated_at = ?', new Date().toISOString());
      ctx.db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, ctx.user.id);
      const next = ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(ctx.user.id);
      // 公网关键变更审计（§5）：actor=system（用户本人操作，无 staff 主体）
      audit(ctx.db, req, ctx, {
        actorType: 'system',
        actorId: ctx.user.id,
        action: 'profile_update',
        targetType: 'user',
        targetId: ctx.user.id,
        prev,
        next: {
          displayName: next.display_name, avatarUrl: next.avatar_url, language: next.language,
          country: next.country, bio: next.bio, dob: next.dob, gender: next.gender, cardBg: next.card_bg,
          cardPlate: next.card_plate, pageBgImage: next.page_bg_image, bannerUrl: next.banner_url, cardEdge: next.card_edge,
          avatarCrop: next.avatar_crop, bannerCrop: next.banner_crop, avatarFrame: next.avatar_frame, title: next.title,
          preferences: parsePreferences(next.preferences)
        }
      });
      sendJson(res, 200, { user: publicUser(next) });
      return;
    }
    sendJson(res, 200, { user: publicUser(ctx.user) });
  }));

  // ── 删号（30 天后悔期）──
  router.add('POST', '/api/auth/delete', requireSession(async (req, res, ctx) => {
    const body = await readJson(req);
    const code = String(body.code || '').trim();
    const now = Date.now();
    const recent = ctx.db.prepare(
      "SELECT * FROM email_codes WHERE email = ? AND purpose = 'delete_confirm' AND actor_type = 'user' AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
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
    ctx.db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(ctx.user.id);
    // 账号删除审计（§5 公网关键变更）
    audit(ctx.db, req, ctx, {
      actorType: 'system',
      actorId: ctx.user.id,
      action: 'account_delete_request',
      targetType: 'user',
      targetId: ctx.user.id,
      prev: { status: ctx.user.status },
      next: { status: 'delete_pending', restoreBy: new Date(now + 30 * 24 * 3600 * 1000).toISOString() }
    });
    res.setHeader('Set-Cookie', sessionCookie('', ctx.config, 0));
    sendJson(res, 200, { ok: true, restoreBy: new Date(now + 30 * 24 * 3600 * 1000).toISOString() });
  }));

  // ── 首登设密 / 改密（W6：会话内；旧账号 passwordSetupRequired 引导落点）──
  router.add('POST', '/api/auth/password', requireSession(async (req, res, ctx) => {
    const body = await readJson(req);
    const pw = String(body.newPassword || '');
    if (pw.length < PASSWORD_MIN || pw.length > PASSWORD_MAX)
      throw new HttpError('VALIDATION', '密码长度需 8-72 字符');
    const now = new Date().toISOString();
    ctx.db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(await hashPassword(pw), now, ctx.user.id);
    // 其他会话全部失效（当前会话保留，无缝继续）
    const token = readToken(req, ctx.config.sessionCookie);
    if (token) ctx.db.prepare('DELETE FROM user_sessions WHERE user_id = ? AND token_hash != ?')
      .run(ctx.user.id, hashToken(token));
    insertSecurityEvent(ctx.db, 'user', ctx.user.id, 'password_change', { method: 'set' }, ipOf(req), 'medium');
    // 公网关键变更审计（§5）：actor=system（用户本人操作，无 staff 主体）
    audit(ctx.db, req, ctx, {
      actorType: 'system',
      actorId: ctx.user.id,
      action: 'user_password_change',
      targetType: 'user',
      targetId: ctx.user.id
    });
    const next = ctx.db.prepare('SELECT * FROM users WHERE id = ?').get(ctx.user.id);
    sendJson(res, 200, { ok: true, user: publicUser(next) });
  }));

  // ── 忘记密码验码（W6 增量：无会话；只验码不消费码——前端输满六位先验，最终 password-reset 再合验消费）──
  // 与 password-reset 共享 attempts 计数（同一码同一爆破预算：输入段错码同样计入 5 次锁，锁满后两端同拒）
  router.add('POST', '/api/auth/verify-code', async (req, res, ctx) => {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const code = String(body.code || '').trim();
    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code))
      throw new HttpError('VALIDATION', '请输入 6 位验证码');
    if (!limit('verifyIp', 'vf:ip:' + ipOf(req), { max: 10, windowMs: 60 * 1000 }))
      throw new HttpError('RATE_LIMITED', '尝试过于频繁，请稍后再试');

    const now = Date.now();
    const recent = db.prepare(
      // v0.2.5.3：忘记密码发码 purpose 已是 password_reset——与历史 login 码同验（取最新一枚）
      "SELECT * FROM email_codes WHERE email = ? AND purpose IN ('login','password_reset') AND actor_type = 'user' AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
    ).get(email, new Date(now).toISOString());
    const row = recent && recent.code_hash === hashCode(code) ? recent : null;
    if (!row || recent.attempts >= CODE_ATTEMPTS_MAX) {
      if (recent && recent.attempts < CODE_ATTEMPTS_MAX)
        db.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE code_hash = ?').run(recent.code_hash);
      throw new HttpError('VALIDATION', '验证码无效或已过期'); // 防枚举：不存在/错码/过期/锁满同款响应
    }
    sendJson(res, 200, { ok: true }); // 不消费码：最终 password-reset 仍验码+消费，一次流程只收一次码
  });

  // ── 忘记密码重置（W6：无会话；login/password_reset 码同验——邮箱所有权即权威，两类码安全等价）──
  router.add('POST', '/api/auth/password-reset', async (req, res, ctx) => {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const code = String(body.code || '').trim();
    const pw = String(body.newPassword || '');
    // 密码策略失败与码无关（不泄漏账号存在性），且不消费码
    if (pw.length < PASSWORD_MIN || pw.length > PASSWORD_MAX)
      throw new HttpError('VALIDATION', '密码长度需 8-72 字符');
    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code))
      throw new HttpError('VALIDATION', '请输入 6 位验证码');
    if (!limit('verifyIp', 'vf:ip:' + ipOf(req), { max: 10, windowMs: 60 * 1000 }))
      throw new HttpError('RATE_LIMITED', '尝试过于频繁，请稍后再试');

    const now = Date.now();
    const recent = db.prepare(
      // v0.2.5.3：忘记密码发码 purpose 已是 password_reset——与历史 login 码同验（取最新一枚）
      "SELECT * FROM email_codes WHERE email = ? AND purpose IN ('login','password_reset') AND actor_type = 'user' AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
    ).get(email, new Date(now).toISOString());
    const row = recent && recent.code_hash === hashCode(code) ? recent : null;
    if (!row || recent.attempts >= CODE_ATTEMPTS_MAX) {
      if (recent && recent.attempts < CODE_ATTEMPTS_MAX)
        db.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE code_hash = ?').run(recent.code_hash);
      throw new HttpError('VALIDATION', '验证码无效或已过期');
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) throw new HttpError('VALIDATION', '验证码无效或已过期'); // 防枚举：不存在同款响应（不消费码）
    db.prepare('UPDATE email_codes SET consumed_at = ? WHERE code_hash = ?')
      .run(new Date(now).toISOString(), row.code_hash);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(await hashPassword(pw), new Date(now).toISOString(), user.id);
    // 全部会话失效：改密后强制重登
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(user.id);
    insertSecurityEvent(db, 'user', user.id, 'account_recovery', { method: 'reset' }, ipOf(req), 'medium');
    audit(db, req, ctx, {
      actorType: 'system',
      actorId: user.id,
      action: 'user_password_reset',
      targetType: 'user',
      targetId: user.id
    });
    sendJson(res, 200, { ok: true });
  });
}

// v0.2.44.0：student-verify 端点复用同一套邮箱码基建（码格式/哈希/规范化/重发间隔）
module.exports = { register, createUser, publicUser, EMAIL_RE, normalizeEmail, randomCode, hashCode, CODE_ATTEMPTS_MAX, RESEND_MS };
