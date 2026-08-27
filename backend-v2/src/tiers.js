'use strict';
// 订阅到期惰性降级（v1 口径）：认证路径检查 tier_expires_at，过期 → tier='free'。
// stripe_customer_id 保留（重订阅复用）；审计 actor=system action=tier_expire。

const { audit } = require('./audit');

function enforceTierExpiry(db, config, user) {
  if (!user || user.tier === 'free' || !user.tier_expires_at) return user;
  const now = new Date().toISOString();
  if (user.tier_expires_at <= now) {
    db.prepare("UPDATE users SET tier = 'free', tier_expires_at = NULL, updated_at = ? WHERE id = ?")
      .run(now, user.id);
    audit(db, null, {}, {
      actorType: 'system',
      actorId: user.id,
      action: 'tier_expire',
      targetType: 'user',
      targetId: user.id,
      prev: { tier: user.tier, tierExpiresAt: user.tier_expires_at },
      next: { tier: 'free', tierExpiresAt: null },
      reason: 'tier_expires_at 已过期（惰性降级）'
    });
    return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  }
  return user;
}

module.exports = { enforceTierExpiry };
