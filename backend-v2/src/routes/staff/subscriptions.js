'use strict';
// 订阅开放开关 + 免付费测试发放（官方开发者测试通道；全部 subscriptions.manage——
// finance 已有，project_director 代码层全键 → 生产环境即 director Neo 专属；前端零感知）。
//   GET  /api/staff/subscriptions/state → { open, updatedAt, updatedBy }（缺行 → open:true）
//   POST /api/staff/subscriptions/open  { open:boolean } → 运行时切换（DB 键，即时生效不重启）+ 审计
//   POST /api/staff/subscriptions/grant { email, tierKey, months? } → 免付费发放（不经 Stripe、
//     不扣款、不记 payments——payments 是支付事件账）；tier 提升/到期顺延口径与 applyPaid 一致。
// 口径：关闭只挡公开 checkout；webhook/portal/status 不受影响（存量订阅照常扣款续费）。

const { HttpError, sendJson, readJson } = require('../../http');
const { requirePerm } = require('../../middleware/staff-auth');
const { audit } = require('../../audit');
const { TIER_OF, TIER_RANK, extendExpiry } = require('../public/subscriptions');

const SETTING_KEY = 'subscriptions.open';
const SETTING_DESC = '订阅开放开关：false 时公开结账关闭（官方开发者测试通道；仅订阅管理权限可切换）';

function register(router, ctx) {
  const db = ctx.db;

  router.add('GET', '/api/staff/subscriptions/state', requirePerm('subscriptions.manage')((req, res) => {
    const row = db.prepare('SELECT * FROM platform_settings WHERE key = ?').get(SETTING_KEY);
    sendJson(res, 200, {
      open: !row || row.value !== 'false',
      updatedAt: row ? row.updated_at : null,
      updatedBy: row ? row.updated_by : null
    });
  }));

  router.add('POST', '/api/staff/subscriptions/open', requirePerm('subscriptions.manage')(async (req, res) => {
    const body = await readJson(req);
    if (typeof body.open !== 'boolean') throw new HttpError('VALIDATION', 'open 必须是布尔值');
    const iso = new Date().toISOString();
    const prev = db.prepare('SELECT value FROM platform_settings WHERE key = ?').get(SETTING_KEY);
    db.prepare('INSERT INTO platform_settings (key, value, type, description, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?) '
      + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at')
      .run(SETTING_KEY, body.open ? 'true' : 'false', 'boolean', SETTING_DESC, ctx.staff.id, iso);
    audit(db, req, ctx, {
      action: 'subscriptions_open',
      targetType: 'platform_setting',
      targetId: SETTING_KEY,
      prev: { open: prev ? prev.value !== 'false' : true },
      next: { open: body.open },
      reason: 'staff_toggle'
    });
    sendJson(res, 200, { open: body.open, updatedAt: iso, updatedBy: ctx.staff.id });
  }));

  router.add('POST', '/api/staff/subscriptions/grant', requirePerm('subscriptions.manage')(async (req, res) => {
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) throw new HttpError('VALIDATION', 'email 必填');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) throw new HttpError('NOT_FOUND', '用户不存在');
    const target = TIER_OF[String(body.tierKey || '')];
    if (!target) throw new HttpError('VALIDATION', 'tierKey 非法');
    let months = 1;
    if (body.months !== undefined) {
      const n = Number(body.months);
      if (!Number.isFinite(n)) throw new HttpError('VALIDATION', 'months 非法');
      months = Math.min(12, Math.max(1, Math.trunc(n))); // 钳制 1..12
    }
    const iso = new Date().toISOString();
    // 与 applyPaid（subscriptions.js）同口径：不降级（max）、同 tier 且永久授予保持 NULL
    const newTier = TIER_RANK[user.tier] > TIER_RANK[target] ? user.tier : target;
    const expiry = (newTier === user.tier && !user.tier_expires_at)
      ? null : extendExpiry(user.tier_expires_at, months, iso);
    if (newTier !== user.tier || expiry !== user.tier_expires_at) {
      db.prepare('UPDATE users SET tier = ?, tier_expires_at = ?, updated_at = ? WHERE id = ?')
        .run(newTier, expiry, iso, user.id);
    }
    // 审计无条件记（显式 staff 写动作，即使结果无变化也要留痕）；形状映射 auditTier（public/subscriptions.js）
    audit(db, req, ctx, {
      action: 'set_tier',
      targetType: 'user',
      targetId: user.id,
      prev: { from: user.tier, via: 'staff_test_grant' },
      next: { to: newTier },
      reason: 'staff_test_grant'
    });
    sendJson(res, 200, { userId: user.id, tier: newTier, tierExpiresAt: expiry });
  }));
}

module.exports = { register };
