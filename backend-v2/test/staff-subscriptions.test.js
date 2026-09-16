'use strict';
// 订阅开放开关（platform_settings 键，运行时切换）+ staff 免付费测试发放。
// 口径：关闭只挡公开 checkout；webhook/portal/status 不受影响；前端零感知（409 复用既有分支）。
// fetchImpl 桩记录 Stripe 请求并返回假 session——绝不接真实网络（预算红线）。

const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { testApp } = require('./helpers');

// ── 桩：小份 Stripe 假响应 + 验签（同 subscriptions.test.js 算法，跨文件不 require）──
function stripeStub() {
  const calls = [];
  let n = 0;
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.indexOf('/checkout/sessions') > -1) {
      const id = 'cs_test_' + (++n);
      return { ok: true, status: 200, json: async () => ({ id, url: 'https://checkout.stripe.com/c/pay/' + id }) };
    }
    throw new Error('unexpected stripe call ' + url);
  };
  return { calls, fetchImpl };
}

const PRICES = { basic: 'price_basic', premium: 'price_premium', ultra: 'price_ultra', 'pkg-premium': 'price_pkg_premium', 'pkg-ultra': 'price_pkg_ultra' };
const PRICES_ONCE = { basic: 'price_basic_once', premium: 'price_premium_once', ultra: 'price_ultra_once', 'pkg-premium': 'price_pkg_premium_once', 'pkg-ultra': 'price_pkg_ultra_once' };
function stripeConfig(over = {}) {
  return {
    stripe: {
      enabled: true, secretKey: 'sk_test_x', webhookSecret: 'whsec_test',
      paymentMethods: ['card'], oncePaymentMethods: ['card', 'grabpay'],
      returnOrigin: '', prices: { ...PRICES }, pricesOnce: { ...PRICES_ONCE },
      ...over
    }
  };
}
const WH_SECRET = 'whsec_test';
function sign(raw, secret, ts = Math.floor(Date.now() / 1000)) {
  const v1 = crypto.createHmac('sha256', secret).update(ts + '.' + raw).digest('hex');
  return 't=' + ts + ',v1=' + v1;
}

// 到期窗口断言（日历月 UTC 加月：1 月 = 28~31 天、12 月 ≈ 364~366 天）
function inWindow(iso, minMs, maxMs) {
  const dt = Date.parse(iso) - Date.now();
  assert.ok(dt >= minMs && dt <= maxMs, `到期偏差 ${dt}ms 不在窗口内`);
}
const DAY = 24 * 3600 * 1000;

function director(t, email = 'neo@slatiworld.local') {
  return t.loginStaffAs(email, {}, ['project_director']);
}
function technician(t, email = 'tech@slatiworld.local') {
  return t.loginStaffAs(email, {}, ['technical']);
}

test('state：无 cookie 401；technical 403；director 200 种子态 open:true', async () => {
  const t = await testApp();
  try {
    assert.strictEqual((await t.request('GET', '/api/staff/subscriptions/state')).status, 401);
    const tech = technician(t);
    await t.assertDenied(await t.request('GET', '/api/staff/subscriptions/state', undefined, { cookie: tech.cookie }));
    const neo = director(t);
    const d = await (await t.request('GET', '/api/staff/subscriptions/state', undefined, { cookie: neo.cookie })).json();
    assert.strictEqual(d.open, true); // 种子行（024 INSERT OR IGNORE）
    assert.strictEqual(d.updatedBy, null);
    assert.ok(d.updatedAt);
  } finally { await t.close(); }
});

test('toggle：director 关闭 → DB 行 + 审计 + state 反映；缺布尔 400；technical 403', async () => {
  const t = await testApp();
  try {
    const neo = director(t);
    const r = await t.request('POST', '/api/staff/subscriptions/open', { open: false }, { cookie: neo.cookie });
    assert.strictEqual(r.status, 200);
    const d = await r.json();
    assert.strictEqual(d.open, false);
    assert.strictEqual(d.updatedBy, neo.staff.id);
    const row = t.db.prepare("SELECT * FROM platform_settings WHERE key = 'subscriptions.open'").get();
    assert.strictEqual(row.value, 'false');
    assert.strictEqual(row.type, 'boolean');
    assert.strictEqual(row.updated_by, neo.staff.id);
    const a = t.db.prepare("SELECT * FROM audit_log WHERE action = 'subscriptions_open' ORDER BY seq DESC LIMIT 1").get();
    assert.strictEqual(a.actor_type, 'staff');
    assert.strictEqual(a.actor_id, neo.staff.id);
    assert.strictEqual(a.target_type, 'platform_setting');
    assert.strictEqual(a.target_id, 'subscriptions.open');
    assert.deepStrictEqual(JSON.parse(a.prev_value), { open: true });
    assert.deepStrictEqual(JSON.parse(a.new_value), { open: false });
    assert.strictEqual((await (await t.request('GET', '/api/staff/subscriptions/state', undefined, { cookie: neo.cookie })).json()).open, false);
    assert.strictEqual((await t.request('POST', '/api/staff/subscriptions/open', {}, { cookie: neo.cookie })).status, 400);
    const tech = technician(t);
    await t.assertDenied(await t.request('POST', '/api/staff/subscriptions/open', { open: false }, { cookie: tech.cookie }));
    assert.ok(t.db.prepare("SELECT 1 FROM audit_log WHERE action = 'perm_denied' AND result = 'denied'").get());
  } finally { await t.close(); }
});

test('关闭挡 checkout（SUBSCRIPTIONS_CLOSED）、webhook/portal/status 不受影响；重开恢复', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stripeConfig(), fetchImpl: stub.fetchImpl });
  try {
    const neo = director(t);
    await t.request('POST', '/api/staff/subscriptions/open', { open: false }, { cookie: neo.cookie });

    const alice = t.loginAs('alice@x.com');
    const r = await t.request('POST', '/api/subscription/checkout', { tierKey: 'premium' }, { cookie: alice.cookie });
    assert.strictEqual(r.status, 409);
    const err = (await r.json()).error;
    assert.strictEqual(err.code, 'SUBSCRIPTIONS_CLOSED'); // 区分 PAYMENTS_DISABLED

    // status 形状不变（前端零感知）
    const st = await (await t.request('GET', '/api/subscription/status', undefined, { cookie: alice.cookie })).json();
    assert.strictEqual(st.enabled, true);
    assert.strictEqual(st.prices.premium.hasPrice, true);

    // portal 路由活着（无 customer → 404，非 503）
    assert.strictEqual((await t.request('POST', '/api/subscription/portal', {}, { cookie: alice.cookie })).status, 404);

    // webhook 照常 200（存量订阅扣款续费不被中断）
    const ev = { id: 'evt_unknown', type: 'checkout.session.completed', data: { object: { id: 'cs_unknown', payment_status: 'paid' } } };
    const raw = JSON.stringify(ev);
    const w = await fetch(t.base + '/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sign(raw, WH_SECRET) },
      body: raw
    });
    assert.strictEqual(w.status, 200);

    // 重开 → 结账恢复
    await t.request('POST', '/api/staff/subscriptions/open', { open: true }, { cookie: neo.cookie });
    const ok = await (await t.request('POST', '/api/subscription/checkout', { tierKey: 'premium' }, { cookie: alice.cookie })).json();
    assert.match(ok.url, /^https:\/\/checkout\.stripe\.com\//);
  } finally { await t.close(); }
});

test('grant 基础流：free → basic、到期 ~1 月、落库、/auth/me 即时生效、审计、零 payments 行', async () => {
  const t = await testApp({ config: stripeConfig(), fetchImpl: stripeStub().fetchImpl });
  try {
    const neo = director(t);
    const alice = t.loginAs('alice@x.com');
    const r = await t.request('POST', '/api/staff/subscriptions/grant', { email: 'alice@x.com', tierKey: 'basic' }, { cookie: neo.cookie });
    assert.strictEqual(r.status, 200);
    const d = await r.json();
    assert.strictEqual(d.userId, alice.user.id);
    assert.strictEqual(d.tier, 'basic');
    inWindow(d.tierExpiresAt, 27 * DAY, 33 * DAY);
    const user = t.db.prepare('SELECT * FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(user.tier, 'basic');
    assert.strictEqual(user.tier_expires_at, d.tierExpiresAt);
    // /auth/me 即时反映（publicUser 读行）
    const me = await (await t.request('GET', '/api/auth/me', undefined, { cookie: alice.cookie })).json();
    assert.strictEqual(me.user.tier, 'basic');
    assert.strictEqual(me.user.tierExpiresAt, d.tierExpiresAt);
    // 审计：staff actor、set_tier、形状映射 auditTier
    const a = t.db.prepare("SELECT * FROM audit_log WHERE action = 'set_tier' ORDER BY seq DESC LIMIT 1").get();
    assert.strictEqual(a.actor_type, 'staff');
    assert.strictEqual(a.actor_id, neo.staff.id);
    assert.strictEqual(a.target_id, alice.user.id);
    assert.deepStrictEqual(JSON.parse(a.prev_value), { from: 'free', via: 'staff_test_grant' });
    assert.deepStrictEqual(JSON.parse(a.new_value), { to: 'basic' });
    assert.strictEqual(a.reason, 'staff_test_grant');
    // 免付费：不记 payments（支付事件账口径）
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM payments').get().n, 0);
  } finally { await t.close(); }
});

test('grant 升级保高：premium grant basic 仍 premium + 到期顺延；grant ultra → ultra', async () => {
  const t = await testApp({ config: stripeConfig(), fetchImpl: stripeStub().fetchImpl });
  try {
    const neo = director(t);
    const base = new Date(Date.now() + 10 * DAY).toISOString();
    const bob = t.loginAs('bob@x.com', { tier: 'premium' });
    t.db.prepare('UPDATE users SET tier_expires_at = ? WHERE id = ?').run(base, bob.user.id); // createUser 不认 tier_expires_at，直接落库
    const d1 = await (await t.request('POST', '/api/staff/subscriptions/grant', { email: 'bob@x.com', tierKey: 'basic' }, { cookie: neo.cookie })).json();
    assert.strictEqual(d1.tier, 'premium'); // 不降级
    inWindow(d1.tierExpiresAt, 10 * DAY + 27 * DAY, 10 * DAY + 33 * DAY); // 原到期 +1 月
    const d2 = await (await t.request('POST', '/api/staff/subscriptions/grant', { email: 'bob@x.com', tierKey: 'ultra' }, { cookie: neo.cookie })).json();
    assert.strictEqual(d2.tier, 'ultra');
  } finally { await t.close(); }
});

test('grant 同 tier 无到期 → 保持 NULL（永久授予不转限时）', async () => {
  const t = await testApp({ config: stripeConfig(), fetchImpl: stripeStub().fetchImpl });
  try {
    const neo = director(t);
    const carol = t.loginAs('carol@x.com', { tier: 'premium' });
    const d = await (await t.request('POST', '/api/staff/subscriptions/grant', { email: 'carol@x.com', tierKey: 'premium', months: 6 }, { cookie: neo.cookie })).json();
    assert.strictEqual(d.tier, 'premium');
    assert.strictEqual(d.tierExpiresAt, null);
  } finally { await t.close(); }
});

test('grant 参数校验：tierKey 400 / email 404 / months 非法 400、0→1 月、24→钳 12 月、6→6 月', async () => {
  const t = await testApp({ config: stripeConfig(), fetchImpl: stripeStub().fetchImpl });
  try {
    const neo = director(t);
    const dave = t.loginAs('dave@x.com');
    assert.strictEqual((await t.request('POST', '/api/staff/subscriptions/grant', { email: 'dave@x.com', tierKey: 'addon' }, { cookie: neo.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/staff/subscriptions/grant', { email: 'nobody@x.com', tierKey: 'basic' }, { cookie: neo.cookie })).status, 404);
    assert.strictEqual((await t.request('POST', '/api/staff/subscriptions/grant', { tierKey: 'basic' }, { cookie: neo.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/staff/subscriptions/grant', { email: 'dave@x.com', tierKey: 'basic', months: 'abc' }, { cookie: neo.cookie })).status, 400);
    const m0 = await (await t.request('POST', '/api/staff/subscriptions/grant', { email: 'dave@x.com', tierKey: 'basic', months: 0 }, { cookie: neo.cookie })).json();
    inWindow(m0.tierExpiresAt, 27 * DAY, 33 * DAY); // 0 → 钳 1 月
    const m24 = await (await t.request('POST', '/api/staff/subscriptions/grant', { email: 'dave@x.com', tierKey: 'basic', months: 24 }, { cookie: neo.cookie })).json();
    // 24 → 钳 12 月；连续 grant 从前一次到期顺延（口径同 applyPaid），按差值断言
    const dt24 = Date.parse(m24.tierExpiresAt) - Date.parse(m0.tierExpiresAt);
    assert.ok(dt24 >= 355 * DAY && dt24 <= 370 * DAY, `24 月差值 ${dt24}ms 不在窗口内`);
    const m6 = await (await t.request('POST', '/api/staff/subscriptions/grant', { email: 'dave@x.com', tierKey: 'basic', months: 6 }, { cookie: neo.cookie })).json();
    const dt6 = Date.parse(m6.tierExpiresAt) - Date.parse(m24.tierExpiresAt);
    assert.ok(dt6 >= 175 * DAY && dt6 <= 192 * DAY, `6 月差值 ${dt6}ms 不在窗口内`);
    assert.strictEqual(t.db.prepare('SELECT tier FROM users WHERE id = ?').get(dave.user.id).tier, 'basic');
  } finally { await t.close(); }
});
