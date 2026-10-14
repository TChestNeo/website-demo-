'use strict';
// P0-3 权益重算测试：逐订阅权益账本（042）。
// 核心：并存订阅取消任一保留另一；Ultra 到期回落 Premium；低档不延长高档；
// 最后来源失效才 free；年付与订阅并存；套餐团队容量重算；管理员授权不被 Stripe 取消抹掉；
// webhook 重放幂等；Team Slots 独立容量不受影响。

const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { testApp } = require('./helpers');
const { computeEntitlement, recomputeAndApply } = require('../src/entitlements');

let paySeq = 0;
// 直插已付行：sub=订阅id；active；expires=entitlement_expires_at；months 影响迁移无关（此处直给 expires）
function addPaid(db, userId, tierKey, { sub = null, active = 1, expires, createdAt } = {}) {
  const iso = createdAt || new Date().toISOString();
  const id = 'PAY-' + String(900000 + (++paySeq));
  db.prepare(`INSERT INTO payments
      (id, user_id, stripe_session_id, tier_key, amount_micro, currency, months, status, stripe_subscription_id, active, entitlement_expires_at, created_at)
    VALUES (?, ?, ?, ?, 2350, 'myr', 1, 'paid', ?, ?, ?, ?)`)
    .run(id, userId, 'cs_test_x' + paySeq, tierKey, sub, active, expires, iso);
  return { id, sub };
}

function isoPlusMonths(months) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
}
function isoMinusMonths(months) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString();
}

test('P0-3：Premium+Ultra 并存，取消任一仍保留另一项', async () => {
  const t = await testApp();
  try {
    const u = t.loginAs('ent1@x.com', {});
    const uid = u.user.id;
    addPaid(t.db, uid, 'premium', { sub: 'sub_premium', expires: isoPlusMonths(1) });
    addPaid(t.db, uid, 'ultra', { sub: 'sub_ultra', expires: isoPlusMonths(1) });

    let e = recomputeAndApply(t.db, uid, { audit: false });
    assert.strictEqual(e.tier, 'ultra', '并存取最高档');

    // 取消 Ultra → 保留 Premium
    t.db.prepare("UPDATE payments SET active = 0, entitlement_expires_at = NULL WHERE stripe_subscription_id = 'sub_ultra'").run();
    e = recomputeAndApply(t.db, uid, { audit: false });
    assert.strictEqual(e.tier, 'premium');
    assert.ok(e.tierExpiresAt > new Date().toISOString());

    // 再取消 Premium → free
    t.db.prepare("UPDATE payments SET active = 0, entitlement_expires_at = NULL WHERE stripe_subscription_id = 'sub_premium'").run();
    e = recomputeAndApply(t.db, uid, { audit: false });
    assert.strictEqual(e.tier, 'free');
    assert.strictEqual(e.tierExpiresAt, null);
  } finally { await t.close(); }
});

test('P0-3：Ultra 到期后回落仍有效的 Premium，而非直落 free', async () => {
  const t = await testApp();
  try {
    const u = t.loginAs('ent2@x.com', {});
    const uid = u.user.id;
    addPaid(t.db, uid, 'premium', { sub: null, expires: isoPlusMonths(6) }); // 年付 6 个月后到期
    addPaid(t.db, uid, 'ultra', { sub: 'sub_ultra', expires: isoMinusMonths(1) }); // Ultra 已过期周期

    const e = recomputeAndApply(t.db, uid, { audit: false });
    assert.strictEqual(e.tier, 'premium', 'Ultra 过期回落 Premium');
    assert.ok(e.tierExpiresAt > new Date().toISOString());
  } finally { await t.close(); }
});

test('P0-3：购买/续费低档不延长高档到期', async () => {
  const t = await testApp();
  try {
    const u = t.loginAs('ent3@x.com', {});
    const uid = u.user.id;
    const ultraExpires = isoPlusMonths(6);
    addPaid(t.db, uid, 'ultra', { sub: null, expires: ultraExpires });
    // 购买低档 premium（1 个月）
    addPaid(t.db, uid, 'premium', { sub: null, expires: isoPlusMonths(1) });

    const e = recomputeAndApply(t.db, uid, { audit: false });
    assert.strictEqual(e.tier, 'ultra');
    assert.strictEqual(e.tierExpiresAt, ultraExpires, '高档到期只由同档来源决定，低档不延长');
  } finally { await t.close(); }
});

test('P0-3：一次性年付与自动订阅并存，取消订阅后年付仍有效', async () => {
  const t = await testApp();
  try {
    const u = t.loginAs('ent4@x.com', {});
    const uid = u.user.id;
    const onceExpires = isoPlusMonths(12);
    addPaid(t.db, uid, 'premium', { sub: null, expires: onceExpires }); // 年付
    addPaid(t.db, uid, 'premium', { sub: 'sub_x', expires: isoPlusMonths(1) }); // 订阅

    let e = recomputeAndApply(t.db, uid, { audit: false });
    assert.strictEqual(e.tier, 'premium');
    assert.strictEqual(e.tierExpiresAt, onceExpires, '同档取最晚到期（年付 12 个月）');

    // 取消订阅 → 年付仍有效
    t.db.prepare("UPDATE payments SET active = 0, entitlement_expires_at = NULL WHERE stripe_subscription_id = 'sub_x'").run();
    e = recomputeAndApply(t.db, uid, { audit: false });
    assert.strictEqual(e.tier, 'premium');
    assert.strictEqual(e.tierExpiresAt, onceExpires);
  } finally { await t.close(); }
});

test('P0-3：Premium/Ultra 套餐团队容量按剩余有效来源重算', async () => {
  const t = await testApp();
  try {
    const u = t.loginAs('ent5@x.com', {});
    const uid = u.user.id;
    addPaid(t.db, uid, 'pkg-premium', { sub: null, expires: isoPlusMonths(3) });
    addPaid(t.db, uid, 'pkg-ultra', { sub: 'sub_pkg_ultra', expires: isoPlusMonths(1) });

    let e = recomputeAndApply(t.db, uid, { audit: false });
    assert.strictEqual(e.teamPackageCap, 'ultra', '套餐容量取最高档');

    // 取消 ultra 套餐订阅 → 回落 premium 套餐（3 个月）
    t.db.prepare("UPDATE payments SET active = 0, entitlement_expires_at = NULL WHERE stripe_subscription_id = 'sub_pkg_ultra'").run();
    e = recomputeAndApply(t.db, uid, { audit: false });
    assert.strictEqual(e.teamPackageCap, 'premium');
    assert.ok(e.teamPackageExpiresAt > new Date().toISOString());

    // 全过期 → 容量清空
    t.db.prepare("UPDATE payments SET entitlement_expires_at = NULL WHERE user_id = ?").run(uid);
    e = recomputeAndApply(t.db, uid, { audit: false });
    assert.strictEqual(e.teamPackageCap, '');
  } finally { await t.close(); }
});

test('P0-3：有限与永久管理员授权不被 Stripe 取消事件抹掉', async () => {
  const t = await testApp();
  try {
    const u = t.loginAs('ent6@x.com', {});
    const uid = u.user.id;
    // 永久授权（admin_tier=ultra 无到期）
    t.db.prepare('UPDATE users SET admin_tier = ?, admin_tier_expires_at = NULL WHERE id = ?').run('ultra', uid);
    // Stripe 订阅也买了 premium，然后取消
    addPaid(t.db, uid, 'premium', { sub: 'sub_grant', expires: isoPlusMonths(1) });

    let e = recomputeAndApply(t.db, uid, { audit: false });
    assert.strictEqual(e.tier, 'ultra', '永久授权压过限时订阅');

    t.db.prepare("UPDATE payments SET active = 0, entitlement_expires_at = NULL WHERE stripe_subscription_id = 'sub_grant'").run();
    e = recomputeAndApply(t.db, uid, { audit: false });
    assert.strictEqual(e.tier, 'ultra', 'Stripe 取消不抹永久授权');
    assert.strictEqual(e.tierExpiresAt, null);

    // 有限授权：到期后回落（无其他来源 → free）
    t.db.prepare('UPDATE users SET admin_tier_expires_at = ? WHERE id = ?').run(isoMinusMonths(1), uid);
    e = recomputeAndApply(t.db, uid, { audit: false });
    assert.strictEqual(e.tier, 'free', '有限授权过期后回落');
  } finally { await t.close(); }
});

test('P0-3：webhook 取消重放幂等 + Team Slots 独立容量不受影响', async () => {
  const t = await testApp({
    config: {
      stripe: {
        enabled: true, secretKey: 'sk_test_x', webhookSecret: 'whsec_test',
        paymentMethods: ['card'], oncePaymentMethods: ['card'],
        returnOrigin: '', prices: { premium: 'price_premium' }, pricesOnce: {},
      },
    },
  });
  try {
    const u = t.loginAs('ent7@x.com', {});
    const uid = u.user.id;
    // 直接置 tier/expiry + 直插订阅行，模拟已开通状态
    t.db.prepare("UPDATE users SET tier = 'premium', tier_expires_at = ? WHERE id = ?").run(isoPlusMonths(1), uid);
    addPaid(t.db, uid, 'premium', { sub: 'sub_replay', expires: isoPlusMonths(1) });
    // Team Slots 独立（team_cap_addon）——重算不得触碰
    t.db.prepare('UPDATE users SET team_cap_addon = ?, team_cap_expires_at = ? WHERE id = ?').run('ultra', isoPlusMonths(1), uid);

    const WH = 'whsec_test';
    const sign = (raw, ts = Math.floor(Date.now() / 1000)) =>
      't=' + ts + ',v1=' + crypto.createHmac('sha256', WH).update(ts + '.' + raw).digest('hex');
    const delEvent = { id: 'evt_del', type: 'customer.subscription.deleted', data: { object: { id: 'sub_replay' } } };
    const raw = JSON.stringify(delEvent);

    for (let i = 0; i < 2; i++) {
      const r = await fetch(t.base + '/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sign(raw) },
        body: raw,
      });
      assert.strictEqual(r.status, 200, 'webhook 幂等 200');
    }
    const row = t.db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
    assert.strictEqual(row.tier, 'free', '取消后回落 free（无其他来源）');
    assert.strictEqual(row.team_cap_addon, 'ultra', 'Team Slots 独立容量不受 tier 重算影响');
  } finally { await t.close(); }
});

test('P0-3：042 迁移回填（历史 tier 无支付行 → admin_tier 基线；支付行推到期）', async () => {
  const t = await testApp();
  try {
    // 老数据模拟：tier 非 free 但无 paid 行（迁移回填成 admin 基线）——直接验证回填后行为
    const u = t.loginAs('ent8@x.com', {});
    const uid = u.user.id;
    t.db.prepare("UPDATE users SET admin_tier = 'basic', admin_tier_expires_at = ? WHERE id = ?").run(isoPlusMonths(2), uid);
    const e = computeEntitlement(t.db, uid, new Date().toISOString());
    assert.strictEqual(e.tier, 'basic', '管理员基线参与重算');
  } finally { await t.close(); }
});
