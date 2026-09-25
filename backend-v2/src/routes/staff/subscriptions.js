'use strict';
// 免付费测试发放（官方开发者测试通道；subscriptions.manage——finance 已有，
// project_director 代码层全键 → 生产环境即 director Neo 专属；前端零感知）。
//   POST /api/staff/subscriptions/grant { email, tierKey, months? } → 给指定用户发订阅（不经 Stripe、
//     不扣款、不记 payments——payments 是支付事件账）；tier 提升/到期顺延口径与 applyPaid 一致。
//   GET  /api/staff/subscriptions/grants/:userId → 该用户发放记录（审计链 staff_test_grant 行；排列
//     生效 · 高级——生效在前、tier 降序、同 tier 新在前）。

const { HttpError, sendJson, readJson } = require('../../http');
const { requirePerm } = require('../../middleware/staff-auth');
const { audit } = require('../../audit');
const { TIER_OF, TIER_RANK, extendExpiry } = require('../public/subscriptions');

function register(router, ctx) {
  const db = ctx.db;

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
    // 审计无条件记（显式 staff 写动作，即使结果无变化也要留痕）；形状映射 auditTier（public/subscriptions.js）；
    // prev/next 携带到期窗口+月数——发放记录卡（admin 用户详情）需要每笔的开始/结束时间
    audit(db, req, ctx, {
      action: 'set_tier',
      targetType: 'user',
      targetId: user.id,
      prev: { from: user.tier, prevExpiry: user.tier_expires_at, via: 'staff_test_grant' },
      next: { to: newTier, nextExpiry: expiry, months },
      reason: 'staff_test_grant'
    });
    sendJson(res, 200, { userId: user.id, tier: newTier, tierExpiresAt: expiry });
  }));

  // 发放记录（用户详情「订阅发放记录」卡）：从审计链读 staff_test_grant 行——每笔发放时间/开始/结束/是否生效；
  // 旧形状行（rev 00294 前：prev 只记 from/via、next 只记 to）容忍：开始退化为发放时间、结束为 null（前端显示 —）
  router.add('GET', '/api/staff/subscriptions/grants/:userId', requirePerm('subscriptions.manage')(async (req, res) => {
    const userId = String(req.params.userId || '').trim();
    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(userId)) throw new HttpError('NOT_FOUND', '用户不存在');
    const rows = db.prepare(
      "SELECT * FROM audit_log WHERE target_type = 'user' AND target_id = ? AND action = 'set_tier' AND reason = 'staff_test_grant' ORDER BY seq DESC"
    ).all(userId);
    const grants = rows.map((a) => {
      let prev = {}; let next = {};
      try { prev = JSON.parse(a.prev_value || '{}'); } catch (e) { prev = {}; }
      try { next = JSON.parse(a.new_value || '{}'); } catch (e) { next = {}; }
      const start = prev.prevExpiry && prev.prevExpiry > a.created_at ? prev.prevExpiry : a.created_at; // 口径同 extendExpiry：未到期从原到期续
      const changed = prev.from !== next.to || (next.nextExpiry !== undefined && next.nextExpiry !== prev.prevExpiry);
      return {
        id: a.id,
        grantedAt: a.created_at,
        tier: next.to || prev.from || '',
        start,
        end: next.nextExpiry !== undefined ? next.nextExpiry : undefined, // 旧形状行无此字段（JSON 省略 → 前端 —；永久授予 null → 前端「永久」）
        effect: changed ? 'applied' : 'noop'
      };
    });
    // 排列方式：生效 · 高级——生效在前，同效按 tier 等级降序（高级优先），再按发放时间新在前
    const rank = { free: 0, basic: 1, premium: 2, ultra: 3 };
    grants.sort((x, y) => (x.effect === y.effect
      ? (rank[y.tier] - rank[x.tier]) || (y.grantedAt < x.grantedAt ? -1 : 1)
      : (x.effect === 'applied' ? -1 : 1)));
    sendJson(res, 200, { grants, total: grants.length });
  }));
}

module.exports = { register };
