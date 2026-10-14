'use strict';
// 订阅到期惰性降级（v1 口径）：认证路径检查 tier_expires_at，过期 → tier='free'。
// stripe_customer_id 保留（重订阅复用）；审计 actor=system action=tier_expire。

const { audit } = require('./audit');
const { HttpError } = require('./http');

const TIER_RANK = Object.freeze({ free: 0, basic: 1, premium: 2, ultra: 3 });

function enforceTierExpiry(db, config, user) {
  if (!user || user.tier === 'free' || !user.tier_expires_at) return user;
  const now = new Date().toISOString();
  if (user.tier_expires_at <= now) {
    // P0-3：到期不再直接落 free——由权益重算器按剩余有效来源回落
    // （Ultra 到期 → 仍有效的 Premium；一次性年付/其他订阅/管理员授权仍有效则保留）。
    const { recomputeAndApply } = require('./entitlements'); // 函数内 require：避免 tiers↔entitlements 循环
    recomputeAndApply(db, user.id, { via: 'stripe_expired', audit: false });
    const next = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    if ((next.tier !== user.tier) || (next.tier_expires_at || null) !== (user.tier_expires_at || null)) {
      audit(db, null, {}, {
        actorType: 'system',
        actorId: user.id,
        action: 'tier_expire',
        targetType: 'user',
        targetId: user.id,
        prev: { tier: user.tier, tierExpiresAt: user.tier_expires_at },
        next: { tier: next.tier, tierExpiresAt: next.tier_expires_at || null },
        reason: 'tier_expires_at 已过期（惰性重算回落）',
      });
    }
    return next;
  }
  return user;
}

// 付费能力必须在服务端再次校验，不能只相信前端隐藏按钮。
// 先执行惰性到期，避免已过期的本地会话快照继续使用订阅能力。
function requireTier(db, config, user, minimum, message) {
  const current = enforceTierExpiry(db, config, user);
  const actualRank = TIER_RANK[current && current.tier] ?? TIER_RANK.free;
  const requiredRank = TIER_RANK[minimum];
  if (requiredRank === undefined) throw new Error('Unknown minimum tier: ' + minimum);
  if (actualRank < requiredRank) {
    throw new HttpError('FORBIDDEN', message || `此功能需要 ${minimum} 或更高等级订阅`);
  }
  return current;
}

module.exports = { enforceTierExpiry, requireTier, TIER_RANK };
