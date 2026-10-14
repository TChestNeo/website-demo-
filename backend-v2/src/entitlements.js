'use strict';
// 权益重算（P0-3）：tier / team_package 的唯一权威推导器。
// 有效来源三类：
//   ① Stripe 活跃订阅——payments 行 status='paid' 且 stripe_subscription_id 非空且 active=1（权益随订阅存续，无到期）
//   ② 一次性年付——payments 行 status='paid' 且 entitlement_expires_at > now
//   ③ 管理员授权——users.admin_tier（admin_tier_expires_at NULL=永久）
// 规则：
//   - tier 取仍有效来源中的最高档；到期只由同档来源决定（低档不得延长高档）；
//   - 同档多来源取最晚到期；永久来源（NULL 到期）压过限时来源；
//   - 无有效来源 → free（Ultra 到期自动回落仍有效的 Premium，而非直落 free）；
//   - team_package_cap 同理按 pkg-premium/pkg-ultra 来源重算；slots-*（team_cap_addon）独立不参与。
// 调用点：subscriptions.js 的 applyPaid / handleInvoicePaid / handleSubDeleted、
//   tiers.js 的惰性到期（enforceTierExpiry）、staff 授权（staff/subscriptions.js）。

const { audit } = require('./audit');

const TIER_RANK = Object.freeze({ free: 0, basic: 1, premium: 2, ultra: 3 });
// tierKey → 用户 tier（slots-* 不在 TIER_OF，走独立 team_cap_addon 链）
const TIER_OF = Object.freeze({ basic: 'basic', premium: 'premium', ultra: 'ultra', 'pkg-premium': 'premium', 'pkg-ultra': 'ultra' });
const TIER_KEYS = Object.keys(TIER_OF);
const TEAM_PACKAGE_OF = Object.freeze({ 'pkg-premium': 'premium', 'pkg-ultra': 'ultra' });
const TEAM_PACKAGE_RANK = Object.freeze({ premium: 1, ultra: 2 });

// 纯计算：不写库。返回 { tier, tierExpiresAt, teamPackageCap, teamPackageExpiresAt }。
// 有效来源判定统一：entitlement_expires_at > now（订阅行=当前周期结束，续费顺延；
//   once 行=付款+months；取消的订阅行被清 NULL 立即失效；管理员授权=admin_tier_expires_at 或永久）。
function computeEntitlement(db, userId, nowIso) {
  const tiers = []; // { tier, expires }  expires=null 表示永久（仅管理员永久授权）
  const pkgs = [];
  const rows = db.prepare(
    "SELECT tier_key, entitlement_expires_at FROM payments WHERE user_id = ? AND status = 'paid'"
  ).all(userId);
  for (const r of rows) {
    if (!r.entitlement_expires_at || r.entitlement_expires_at <= nowIso) continue;
    const tier = TIER_OF[r.tier_key];
    const pkg = TEAM_PACKAGE_OF[r.tier_key];
    if (tier) tiers.push({ tier, expires: r.entitlement_expires_at });
    if (pkg) pkgs.push({ cap: pkg, expires: r.entitlement_expires_at });
  }
  const u = db.prepare('SELECT admin_tier, admin_tier_expires_at FROM users WHERE id = ?').get(userId);
  if (u && u.admin_tier && (TIER_RANK[u.admin_tier] || 0) > 0 &&
    (!u.admin_tier_expires_at || u.admin_tier_expires_at > nowIso)) {
    tiers.push({ tier: u.admin_tier, expires: u.admin_tier_expires_at || null });
  }

  const bestTier = pickBest(tiers, (s) => TIER_RANK[s.tier] || 0);
  const bestPkg = pickBest(pkgs, (s) => TEAM_PACKAGE_RANK[s.cap] || 0);
  return {
    tier: bestTier ? bestTier.tier : 'free',
    tierExpiresAt: bestTier ? bestTier.expires : null,
    teamPackageCap: bestPkg ? bestPkg.cap : '',
    teamPackageExpiresAt: bestPkg ? bestPkg.expires : null,
  };
}

// 取最高档；同档取最晚到期；永久（null）压过限时。
function pickBest(list, rankOf) {
  let best = null;
  for (const s of list) {
    const rank = rankOf(s);
    if (!best || rank > best.rank) {
      best = { ...s, rank };
    } else if (rank === best.rank) {
      if (s.expires === null) best = { ...s, rank };
      else if (best.expires !== null && s.expires > best.expires) best = { ...s, rank };
    }
  }
  return best;
}

// 重算并落库（tier/expires/team_package 三列与计算结果不同才写）。
// opts.via：审计来源标记（stripe / stripe_once / stripe_cancel / stripe_expired / recompute）。
function recomputeAndApply(db, userId, opts) {
  const now = new Date().toISOString();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return null;
  const e = computeEntitlement(db, userId, now);
  const prevTier = user.tier;
  const prevExpiry = user.tier_expires_at || null;
  if (e.tier !== prevTier || e.tierExpiresAt !== prevExpiry) {
    db.prepare('UPDATE users SET tier = ?, tier_expires_at = ?, updated_at = ? WHERE id = ?')
      .run(e.tier, e.tierExpiresAt, now, userId);
    if (e.tier !== prevTier && opts && opts.audit !== false) {
      audit(db, null, {}, {
        actorType: 'stripe',
        actorId: userId,
        action: 'set_tier',
        targetType: 'user',
        targetId: userId,
        prev: { from: prevTier, via: opts.via || 'recompute' },
        next: { to: e.tier },
        reason: 'via:' + (opts.via || 'recompute'),
      });
    }
  }
  if ((e.teamPackageCap || '') !== (user.team_package_cap || '') ||
    (e.teamPackageExpiresAt || null) !== (user.team_package_expires_at || null)) {
    db.prepare('UPDATE users SET team_package_cap = ?, team_package_expires_at = ?, updated_at = ? WHERE id = ?')
      .run(e.teamPackageCap, e.teamPackageExpiresAt, now, userId);
  }
  return e;
}

module.exports = {
  computeEntitlement, recomputeAndApply, pickBest,
  TIER_RANK, TIER_OF, TIER_KEYS, TEAM_PACKAGE_OF, TEAM_PACKAGE_RANK,
};
