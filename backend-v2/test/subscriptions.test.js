'use strict';
// 订阅支付矩阵：status/checkout 契约、webhook 验签、5 类事件、幂等/降级/惰性到期。
// fetchImpl 桩记录 Stripe API 请求并返回假 session——绝不接真实网络（预算红线）。

const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { testApp } = require('./helpers');

// ── 桩：Stripe API 假响应（checkout → cs_test_N，portal → bps URL），并记录请求供形状断言 ──
function stripeStub() {
  const calls = [];
  let n = 0;
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    if (url.indexOf('/checkout/sessions') > -1) {
      const id = 'cs_test_' + (++n);
      return { ok: true, status: 200, json: async () => ({ id, url: 'https://checkout.stripe.com/c/pay/' + id }) };
    }
    if (url.indexOf('/billing_portal/sessions') > -1) {
      return { ok: true, status: 200, json: async () => ({ id: 'bps_test_' + (++n), url: 'https://billing.stripe.com/s/' + n }) };
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
      // v0.2.13.1：fpx/alipay 实证账户层不可用（available:false）→ 只留真可用（card/grabpay；钱包随卡自动出现）
      paymentMethods: ['card'], oncePaymentMethods: ['card', 'grabpay'],
      returnOrigin: '', prices: { ...PRICES }, pricesOnce: { ...PRICES_ONCE },
      ...over
    }
  };
}
const WH_SECRET = 'whsec_test';

// 独立计算 Stripe 签名（HMAC-SHA256(secret, `t.raw`)）——与 src/stripe.js 同算法
function sign(raw, secret, ts = Math.floor(Date.now() / 1000)) {
  const v1 = crypto.createHmac('sha256', secret).update(ts + '.' + raw).digest('hex');
  return 't=' + ts + ',v1=' + v1;
}
function postWebhook(t, event, opts = {}) {
  const body = opts.raw || JSON.stringify(event);
  return fetch(t.base + '/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sign(body, WH_SECRET, opts.ts) },
    body
  });
}

// 建 pending 行（走真实 checkout 路由，会话 id 取自桩）→ 返回 { user, sessionId }
async function checkoutFor(t, cookie, tierKey = 'premium') {
  const d = await (await t.request('POST', '/api/subscription/checkout', { tierKey }, { cookie })).json();
  return d;
}
function sessionEvent(type, o) {
  return { id: o.evt, type, data: { object: o } };
}
function paidSession(o) {
  return sessionEvent('checkout.session.completed', {
    evt: o.evt, id: o.id, payment_status: o.payment_status || 'paid',
    subscription: o.subscription, customer: o.customer, amount_total: o.amount_total ?? 2350,
    currency: o.currency || 'myr', mode: o.mode || 'subscription'
  });
}

// ── status ──
test('订阅状态：未配置 → enabled:false，匿名只有配置态无会话字段', async () => {
  const t = await testApp();
  try {
    const r = await t.request('GET', '/api/subscription/status');
    const d = await r.json();
    assert.strictEqual(d.enabled, false);
    assert.strictEqual(d.mode, 'hybrid');
    assert.deepStrictEqual(d.onceMethods, ['card', 'grabpay']); // v0.2.13.1：默认清单已去账户不可用的 fpx/alipay
    assert.strictEqual(d.prices.premium.hasPrice, false);
    assert.strictEqual(d.prices.premium.hasOnce, false);
    assert.strictEqual(d.prices['pkg-ultra'].hasPrice, false);
    assert.strictEqual(d.tier, undefined);
    assert.strictEqual(d.hasPortal, undefined);
  } finally { await t.close(); }
});

test('订阅状态：已配置 + 登录 → enabled/prices 双通道/tier/tierExpiresAt/hasPortal', async () => {
  const t = await testApp({ config: stripeConfig({ prices: { ...PRICES, 'pkg-ultra': '' }, pricesOnce: { ...PRICES_ONCE, 'pkg-ultra': '' } }), fetchImpl: stripeStub().fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com', { tier: 'premium' });
    const d = await (await t.request('GET', '/api/subscription/status', undefined, { cookie: alice.cookie })).json();
    assert.strictEqual(d.enabled, true);
    assert.strictEqual(d.prices.basic.hasPrice, true); // Basic 学生价 SKU 同步进白名单
    assert.strictEqual(d.prices.basic.hasOnce, true);
    assert.strictEqual(d.prices.premium.hasPrice, true);
    assert.strictEqual(d.prices.premium.hasOnce, true);
    assert.strictEqual(d.prices['pkg-ultra'].hasPrice, false); // 缺订阅 Price ID 的 SKU 回退申请流
    assert.strictEqual(d.prices['pkg-ultra'].hasOnce, false); // 缺一次性 Price ID 同理会回退
    assert.strictEqual(d.tier, 'premium');
    assert.strictEqual(d.tierExpiresAt, null);
    assert.strictEqual(d.hasPortal, false);
  } finally { await t.close(); }
});

// ── checkout ──
test('checkout：未登录 401 / tierKey 非法 400 / 未启用或无 Price ID → 409 PAYMENTS_DISABLED', async () => {
  const t = await testApp({ config: stripeConfig(), fetchImpl: stripeStub().fetchImpl });
  try {
    assert.strictEqual((await t.request('POST', '/api/subscription/checkout', { tierKey: 'premium' })).status, 401);
    const alice = t.loginAs('alice@x.com');
    assert.strictEqual((await t.request('POST', '/api/subscription/checkout', { tierKey: 'addon' }, { cookie: alice.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/subscription/checkout', { tierKey: '' }, { cookie: alice.cookie })).status, 400);

    const t2 = await testApp({ config: stripeConfig({ enabled: false }), fetchImpl: stripeStub().fetchImpl });
    try {
      const b = t2.loginAs('bob@x.com');
      assert.strictEqual((await t2.request('POST', '/api/subscription/checkout', { tierKey: 'premium' }, { cookie: b.cookie })).status, 409);
    } finally { await t2.close(); }

    const t3 = await testApp({ config: stripeConfig({ prices: { premium: '', ultra: '', 'pkg-premium': '', 'pkg-ultra': '' } }), fetchImpl: stripeStub().fetchImpl });
    try {
      const c = t3.loginAs('carol@x.com');
      assert.strictEqual((await t3.request('POST', '/api/subscription/checkout', { tierKey: 'premium' }, { cookie: c.cookie })).status, 409);
    } finally { await t3.close(); }
  } finally { await t.close(); }
});

test('checkout：pending 行 + url + Stripe 请求形状（subscription 模式/price/回跳 URL/零前端密钥）', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stripeConfig({ returnOrigin: 'https://mn.world' }), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    const d = await (await t.request('POST', '/api/subscription/checkout', { tierKey: 'ultra' }, { cookie: alice.cookie })).json();
    assert.match(d.url, /^https:\/\/checkout\.stripe\.com\//);
    const row = t.db.prepare('SELECT * FROM payments WHERE user_id = ?').get(alice.user.id);
    assert.strictEqual(row.status, 'pending');
    assert.strictEqual(row.tier_key, 'ultra');
    assert.strictEqual(row.stripe_session_id, 'cs_test_1');
    assert.strictEqual(row.months, 1);
    assert.strictEqual(row.currency, 'myr');

    assert.strictEqual(stub.calls[0].url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.strictEqual(stub.calls[0].opts.headers.Authorization, 'Bearer sk_test_x');
    const form = Object.fromEntries(new URLSearchParams(stub.calls[0].opts.body).entries());
    assert.strictEqual(form.mode, 'subscription');
    assert.strictEqual(form['line_items[0][price]'], 'price_ultra');
    assert.strictEqual(form['line_items[0][quantity]'], '1');
    assert.strictEqual(form.client_reference_id, alice.user.id);
    assert.strictEqual(form.customer_email, 'alice@x.com');
    assert.strictEqual(form['payment_method_types[0]'], 'card');
    assert.strictEqual(form['payment_method_types[1]'], undefined); // 订阅只卡（钱包随卡自动，不列清单）
    assert.strictEqual(form['subscription_data[metadata][user_id]'], alice.user.id);
    assert.strictEqual(form['subscription_data[metadata][tier_key]'], 'ultra');
    assert.strictEqual(form['metadata[tier_key]'], 'ultra');
    assert.strictEqual(form['metadata[months]'], '1');
    assert.strictEqual(form.success_url, 'https://mn.world/pages/premium.html?paid=1');
    assert.strictEqual(form.cancel_url, 'https://mn.world/pages/premium.html?canceled=1');
  } finally { await t.close(); }
});

test('checkout once：每年支付请求形状（mode=payment/年付 Price/可用方法清单/无 subscription_data）+ pending 行 months=12', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stripeConfig({ returnOrigin: 'https://mn.world' }), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    const d = await (await t.request('POST', '/api/subscription/checkout', { tierKey: 'premium', mode: 'once' }, { cookie: alice.cookie })).json();
    assert.match(d.url, /^https:\/\/checkout\.stripe\.com\//);
    const row = t.db.prepare('SELECT * FROM payments WHERE user_id = ?').get(alice.user.id);
    assert.strictEqual(row.status, 'pending');
    assert.strictEqual(row.tier_key, 'premium');
    assert.strictEqual(row.months, 12); // v0.2.13.0：once = 年付 1 年（一次付清，月价×10）

    const form = Object.fromEntries(new URLSearchParams(stub.calls[0].opts.body).entries());
    assert.strictEqual(form.mode, 'payment');
    assert.strictEqual(form['line_items[0][price]'], 'price_premium_once');
    assert.strictEqual(form.client_reference_id, alice.user.id);
    assert.strictEqual(form['payment_method_types[0]'], 'card');
    assert.strictEqual(form['payment_method_types[1]'], 'grabpay'); // v0.2.13.1：fpx/alipay 账户不可用已去
    assert.strictEqual(form['payment_method_types[2]'], undefined);
    assert.strictEqual(form['subscription_data[metadata][user_id]'], undefined); // payment 模式禁带 subscription_data
    assert.strictEqual(form['metadata[tier_key]'], 'premium');
    assert.strictEqual(form['metadata[months]'], '12');
    assert.strictEqual(form.success_url, 'https://mn.world/pages/premium.html?paid=1');
  } finally { await t.close(); }
});

test('checkout once：mode 非法 400 / 缺一次性 Price ID → 409（回退申请流）', async () => {
  const t = await testApp({ config: stripeConfig({ pricesOnce: { premium: '', ultra: '', 'pkg-premium': '', 'pkg-ultra': '' } }), fetchImpl: stripeStub().fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    assert.strictEqual((await t.request('POST', '/api/subscription/checkout', { tierKey: 'premium', mode: 'bogus' }, { cookie: alice.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/subscription/checkout', { tierKey: 'premium', mode: 'once' }, { cookie: alice.cookie })).status, 409);
  } finally { await t.close(); }
});

// ── 多币种（v0.2.12.0）：STRIPE_CATALOG_B64 目录（usd+14 币，myr 仍走 legacy env）──
function mkCatalog(cur) {
  const c = {};
  for (const k of Object.keys(PRICES)) c[k] = { sub: 'price_' + cur + '_' + k, once: 'price_' + cur + '_' + k + '_once' };
  return c;
}
const CATALOG = { usd: mkCatalog('usd'), eur: mkCatalog('eur') };

test('status：?currency=usd/eur 命中 catalog（hasPrice/hasOnce + onceMethods 纯卡）；myr 缺省仍走 legacy env', async () => {
  const t = await testApp({ config: stripeConfig({ catalog: CATALOG }), fetchImpl: stripeStub().fetchImpl });
  try {
    const usd = await (await t.request('GET', '/api/subscription/status?currency=usd')).json();
    assert.strictEqual(usd.enabled, true);
    assert.strictEqual(usd.currency, 'usd');
    assert.strictEqual(usd.prices.basic.hasPrice, true);
    assert.strictEqual(usd.prices.premium.hasPrice, true);
    assert.strictEqual(usd.prices.premium.hasOnce, true);
    assert.strictEqual(usd.prices['pkg-ultra'].hasPrice, true); // 目录全 5 SKU
    assert.deepStrictEqual(usd.onceMethods, ['card']);           // 非 myr 只挂卡

    const eur = await (await t.request('GET', '/api/subscription/status?currency=eur')).json();
    assert.strictEqual(eur.currency, 'eur');
    assert.strictEqual(eur.prices.ultra.hasPrice, true);

    const myr = await (await t.request('GET', '/api/subscription/status')).json();
    assert.strictEqual(myr.currency, 'myr');                     // 缺省 = myr（legacy env 回归）
    assert.strictEqual(myr.prices.premium.hasPrice, true);
    assert.deepStrictEqual(myr.onceMethods, ['card', 'grabpay']); // v0.2.13.1：只留账户真可用方式

    const nope = await (await t.request('GET', '/api/subscription/status?currency=krw')).json(); // 目录外币：全假（不会崩）
    assert.strictEqual(nope.prices.premium.hasPrice, false);
    assert.strictEqual(nope.prices.premium.hasOnce, false);
  } finally { await t.close(); }
});

test('checkout：currency=eur 用 catalog Price + 纯卡 + pending 行记 eur；目录外币 400', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stripeConfig({ catalog: CATALOG }), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    assert.strictEqual((await t.request('POST', '/api/subscription/checkout', { tierKey: 'krw', currency: 'premium' }, { cookie: alice.cookie })).status, 400); // tierKey 校验先行
    assert.strictEqual((await t.request('POST', '/api/subscription/checkout', { tierKey: 'premium', currency: 'krw' }, { cookie: alice.cookie })).status, 400); // 目录外币拒绝

    const d = await (await t.request('POST', '/api/subscription/checkout', { tierKey: 'premium', currency: 'eur' }, { cookie: alice.cookie })).json();
    assert.match(d.url, /^https:\/\/checkout\.stripe\.com\//);
    const row = t.db.prepare('SELECT * FROM payments WHERE user_id = ?').get(alice.user.id);
    assert.strictEqual(row.currency, 'eur');                     // 结算币随行记录（webhook 对账用）
    const form = Object.fromEntries(new URLSearchParams(stub.calls[0].opts.body).entries());
    assert.strictEqual(form['line_items[0][price]'], 'price_eur_premium'); // 服务端解析 Price，前端给不了 id
    assert.strictEqual(form['payment_method_types[0]'], 'card');
    assert.strictEqual(form['payment_method_types[1]'], undefined); // 无 fpx/alipay/grabpay

    // 全额 webhook（session 带真实 currency=eur）→ 照常开通
    await postWebhook(t, paidSession({ evt: 'evt_eur_1', id: 'cs_test_1', subscription: 'sub_eur_1', customer: 'cus_eur_1', amount_total: 1199, currency: 'eur' }));
    const paid = t.db.prepare('SELECT * FROM payments WHERE stripe_session_id = ?').get('cs_test_1');
    assert.strictEqual(paid.status, 'paid');
    assert.strictEqual(paid.currency, 'eur');
    const me = t.db.prepare('SELECT tier FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(me.tier, 'premium');
  } finally { await t.close(); }
});

test('checkout once：currency=usd → 一次性 Price 来自目录 + 纯卡（无马区方式）', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stripeConfig({ catalog: CATALOG }), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    const d = await (await t.request('POST', '/api/subscription/checkout', { tierKey: 'ultra', mode: 'once', currency: 'usd' }, { cookie: alice.cookie })).json();
    assert.match(d.url, /^https:\/\/checkout\.stripe\.com\//);
    const row = t.db.prepare('SELECT * FROM payments WHERE user_id = ?').get(alice.user.id);
    assert.strictEqual(row.currency, 'usd');
    const form = Object.fromEntries(new URLSearchParams(stub.calls[0].opts.body).entries());
    assert.strictEqual(form.mode, 'payment');
    assert.strictEqual(form['line_items[0][price]'], 'price_usd_ultra_once');
    assert.strictEqual(form['payment_method_types[0]'], 'card');
    assert.strictEqual(form['payment_method_types[1]'], undefined);
    assert.strictEqual(form['subscription_data[metadata][user_id]'], undefined);
  } finally { await t.close(); }
});

test('checkout 限流：覆盖为 2 → 第 3 次 429', async () => {
  const t = await testApp({ config: { ...stripeConfig(), rateLimits: { checkout: { max: 2, windowMs: 600000 } } }, fetchImpl: stripeStub().fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    assert.strictEqual((await t.request('POST', '/api/subscription/checkout', { tierKey: 'premium' }, { cookie: alice.cookie })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/subscription/checkout', { tierKey: 'premium' }, { cookie: alice.cookie })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/subscription/checkout', { tierKey: 'premium' }, { cookie: alice.cookie })).status, 429);
  } finally { await t.close(); }
});

// ── webhook 验签 ──
test('webhook 验签：合法 200 / 篡改 400 / 过期 ts 400 / 未配密钥忽略 200', async () => {
  const t = await testApp({ config: stripeConfig() });
  try {
    const event = { id: 'evt_1', type: 'charge.succeeded', data: { object: {} } };
    const raw = JSON.stringify(event);
    assert.strictEqual((await postWebhook(t, event)).status, 200);
    const r2 = await fetch(t.base + '/api/webhooks/stripe', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sign(raw, WH_SECRET) }, body: raw + 'x'
    });
    assert.strictEqual(r2.status, 400);
    const r3 = await fetch(t.base + '/api/webhooks/stripe', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sign(raw, WH_SECRET, Math.floor(Date.now() / 1000) - 600) }, body: raw
    });
    assert.strictEqual(r3.status, 400);

    const t2 = await testApp({ config: stripeConfig({ webhookSecret: '' }) });
    try {
      const r4 = await fetch(t2.base + '/api/webhooks/stripe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw });
      assert.strictEqual(r4.status, 200);
      assert.strictEqual((await r4.json()).ignored, true);
    } finally { await t2.close(); }
  } finally { await t.close(); }
});

// ── 事件处理 ──
test('completed(paid)：tier 提升 + 到期顺延 + customer id 落库 + pending→paid + set_tier 审计；重放不重复开通', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stripeConfig(), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    await checkoutFor(t, alice.cookie);
    const before = Date.now();
    const evt = paidSession({ evt: 'evt_paid_1', id: 'cs_test_1', subscription: 'sub_test_1', customer: 'cus_test_1', amount_total: 2350 });
    assert.strictEqual((await postWebhook(t, evt)).status, 200);

    const row = t.db.prepare('SELECT * FROM payments WHERE stripe_session_id = ?').get('cs_test_1');
    assert.strictEqual(row.status, 'paid');
    assert.ok(row.paid_at);
    assert.strictEqual(row.stripe_event_id, 'evt_paid_1');
    assert.strictEqual(row.stripe_subscription_id, 'sub_test_1');
    assert.strictEqual(row.amount_micro, 2350);
    const u = t.db.prepare('SELECT * FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(u.tier, 'premium');
    assert.strictEqual(u.stripe_customer_id, 'cus_test_1');
    const exp = new Date(u.tier_expires_at).getTime();
    assert.ok(exp > before + 27 * 86400000, '到期至少顺延近 1 个日历月');
    assert.ok(exp < before + 33 * 86400000, '到期不超过 1 个月 + 余量');
    const aud = t.db.prepare("SELECT * FROM audit_log WHERE action = 'set_tier'").all();
    assert.strictEqual(aud.length, 1);
    assert.strictEqual(aud[0].actor_type, 'stripe');
    assert.strictEqual(aud[0].actor_id, alice.user.id); // 财报重放口径：actor = 被开通用户自身
    assert.strictEqual(aud[0].target_id, alice.user.id);
    assert.deepStrictEqual(JSON.parse(aud[0].prev_value), { from: 'free', via: 'stripe' });
    assert.deepStrictEqual(JSON.parse(aud[0].new_value), { to: 'premium' });

    await postWebhook(t, evt); // 重放
    const u2 = t.db.prepare('SELECT * FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(u2.tier_expires_at, u.tier_expires_at);
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'set_tier'").get().n, 1);
  } finally { await t.close(); }
});

test('FPX 异步：completed(unpaid) 只存 id 不开通；async_payment_succeeded 开通恰好一次', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stripeConfig(), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    await checkoutFor(t, alice.cookie);
    await postWebhook(t, paidSession({ evt: 'evt_c1', id: 'cs_test_1', payment_status: 'unpaid', subscription: 'sub_test_1', customer: 'cus_test_1', amount_total: 0 }));
    let u = t.db.prepare('SELECT * FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(u.tier, 'free'); // 未到账不开通（新用户默认 free 普通用户）
    assert.strictEqual(u.stripe_customer_id, 'cus_test_1');
    let row = t.db.prepare('SELECT * FROM payments WHERE stripe_session_id = ?').get('cs_test_1');
    assert.strictEqual(row.status, 'pending');
    assert.strictEqual(row.stripe_subscription_id, 'sub_test_1');

    const asyncOk = paidSession({ evt: 'evt_c2', id: 'cs_test_1', subscription: 'sub_test_1', customer: 'cus_test_1', amount_total: 2350 });
    asyncOk.type = 'checkout.session.async_payment_succeeded';
    await postWebhook(t, asyncOk);
    u = t.db.prepare('SELECT * FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(u.tier, 'premium');
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'set_tier'").get().n, 1);
    await postWebhook(t, asyncOk); // 事件重放 → 状态机挡住
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'set_tier'").get().n, 1);
  } finally { await t.close(); }
});

test('每年支付 webhook：mode=payment completed(paid) → 开通顺延 12 个月 + via=stripe_once 审计 + 无订阅 id + 无 portal', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stripeConfig(), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    await t.request('POST', '/api/subscription/checkout', { tierKey: 'premium', mode: 'once' }, { cookie: alice.cookie });
    const before = Date.now();
    const evt = paidSession({ evt: 'evt_once_1', id: 'cs_test_1', customer: 'cus_test_1', amount_total: 2350, mode: 'payment' });
    assert.strictEqual((await postWebhook(t, evt)).status, 200);

    const row = t.db.prepare('SELECT * FROM payments WHERE stripe_session_id = ?').get('cs_test_1');
    assert.strictEqual(row.status, 'paid');
    assert.strictEqual(row.stripe_subscription_id, null); // 每年支付无订阅（一次付清不自动续费）
    const u = t.db.prepare('SELECT * FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(u.tier, 'premium');
    assert.strictEqual(u.stripe_customer_id, 'cus_test_1');
    const exp = new Date(u.tier_expires_at).getTime();
    assert.ok(exp > before + 355 * 86400000, '到期至少顺延近 1 年（months=12 落库生效）');
    assert.ok(exp < before + 370 * 86400000, '到期不超过 1 年 + 余量');
    const aud = t.db.prepare("SELECT * FROM audit_log WHERE action = 'set_tier'").all();
    assert.strictEqual(aud.length, 1);
    assert.deepStrictEqual(JSON.parse(aud[0].prev_value), { from: 'free', via: 'stripe_once' });
    assert.deepStrictEqual(JSON.parse(aud[0].new_value), { to: 'premium' });

    // 只有 customer 无订阅 → portal 不给（portal 只管订阅取消/换卡/账单）
    const d = await (await t.request('GET', '/api/subscription/status', undefined, { cookie: alice.cookie })).json();
    assert.strictEqual(d.hasPortal, false);
    // 重放 → 状态机挡住，不重复开
    await postWebhook(t, evt);
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'set_tier'").get().n, 1);
  } finally { await t.close(); }
});

test('hasPortal 口径：有已付订阅行 → true；仅单次购买已付行 → false', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stripeConfig(), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    await checkoutFor(t, alice.cookie);
    await postWebhook(t, paidSession({ evt: 'evt_hp_1', id: 'cs_test_1', subscription: 'sub_test_1', customer: 'cus_test_1', amount_total: 2350 }));
    let d = await (await t.request('GET', '/api/subscription/status', undefined, { cookie: alice.cookie })).json();
    assert.strictEqual(d.hasPortal, true);
  } finally { await t.close(); }
});

test('invoice.paid 续费：新增行 + 从当前到期顺延；已过期 → 从 now 起算', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stripeConfig(), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    await checkoutFor(t, alice.cookie);
    await postWebhook(t, paidSession({ evt: 'evt_1', id: 'cs_test_1', subscription: 'sub_test_1', customer: 'cus_test_1', amount_total: 2350 }));
    const exp1 = t.db.prepare('SELECT tier_expires_at FROM users WHERE id = ?').get(alice.user.id).tier_expires_at;

    await postWebhook(t, sessionEvent('invoice.paid', { evt: 'evt_inv_1', id: 'inv_test_1', subscription: 'sub_test_1', customer: 'cus_test_1', amount_paid: 2350 }));
    const u = t.db.prepare('SELECT * FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(u.tier, 'premium');
    assert.ok(u.tier_expires_at > exp1, '到期从当前到期顺延');
    const rows = t.db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY seq').all(alice.user.id);
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[1].status, 'paid');
    assert.strictEqual(rows[1].stripe_invoice_id, 'inv_test_1');
    assert.strictEqual(rows[1].stripe_event_id, 'evt_inv_1');
    assert.strictEqual(rows[1].tier_key, 'premium');
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'set_tier'").get().n, 1); // 同 tier 续费不重写审计

    // 已过期 → max(now, 到期) → 从 now 起算
    t.db.prepare('UPDATE users SET tier_expires_at = ? WHERE id = ?').run(new Date(Date.now() - 10 * 86400000).toISOString(), alice.user.id);
    await postWebhook(t, sessionEvent('invoice.paid', { evt: 'evt_inv_2', id: 'inv_test_2', subscription: 'sub_test_1', customer: 'cus_test_1', amount_paid: 2350 }));
    const exp2 = new Date(t.db.prepare('SELECT tier_expires_at FROM users WHERE id = ?').get(alice.user.id).tier_expires_at).getTime();
    const now = Date.now();
    assert.ok(exp2 > now + 27 * 86400000);
    assert.ok(exp2 < now + 33 * 86400000);
  } finally { await t.close(); }
});

test('invoice.payment_failed：failed 行 + tier/到期不动；重放去重', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stripeConfig(), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    await checkoutFor(t, alice.cookie);
    await postWebhook(t, paidSession({ evt: 'evt_1', id: 'cs_test_1', subscription: 'sub_test_1', customer: 'cus_test_1', amount_total: 2350 }));
    const exp1 = t.db.prepare('SELECT tier_expires_at FROM users WHERE id = ?').get(alice.user.id).tier_expires_at;

    await postWebhook(t, sessionEvent('invoice.payment_failed', { evt: 'evt_fail_1', id: 'inv_fail_1', subscription: 'sub_test_1', customer: 'cus_test_1', amount_due: 2350 }));
    const row = t.db.prepare("SELECT * FROM payments WHERE stripe_invoice_id = 'inv_fail_1'").get();
    assert.strictEqual(row.status, 'failed');
    assert.strictEqual(row.stripe_event_id, 'evt_fail_1');
    const u = t.db.prepare('SELECT * FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(u.tier, 'premium'); // tier 不动
    assert.strictEqual(u.tier_expires_at, exp1);
    await postWebhook(t, sessionEvent('invoice.payment_failed', { evt: 'evt_fail_1', id: 'inv_fail_1', subscription: 'sub_test_1', customer: 'cus_test_1', amount_due: 2350 }));
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM payments WHERE stripe_invoice_id = 'inv_fail_1'").get().n, 1);
  } finally { await t.close(); }
});

test('customer.subscription.deleted：立即降 free + 清到期 + stripe_cancel 审计', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stripeConfig(), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    await checkoutFor(t, alice.cookie);
    await postWebhook(t, paidSession({ evt: 'evt_1', id: 'cs_test_1', subscription: 'sub_test_1', customer: 'cus_test_1', amount_total: 2350 }));
    assert.strictEqual(t.db.prepare('SELECT tier FROM users WHERE id = ?').get(alice.user.id).tier, 'premium');

    await postWebhook(t, sessionEvent('customer.subscription.deleted', { evt: 'evt_del_1', id: 'sub_test_1' }));
    const u = t.db.prepare('SELECT * FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(u.tier, 'free');
    assert.strictEqual(u.tier_expires_at, null);
    const aud = t.db.prepare("SELECT * FROM audit_log WHERE action = 'set_tier' ORDER BY seq").all();
    assert.strictEqual(aud.length, 2);
    assert.deepStrictEqual(JSON.parse(aud[1].prev_value), { from: 'premium', via: 'stripe_cancel' });
    assert.deepStrictEqual(JSON.parse(aud[1].new_value), { to: 'free' });
  } finally { await t.close(); }
});

test('到期惰性降级：过期 premium 用户 /auth/me 返回 free 且落库 + tier_expire 审计', async () => {
  const t = await testApp({ config: stripeConfig() });
  try {
    const alice = t.loginAs('alice@x.com', { tier: 'premium' });
    t.db.prepare('UPDATE users SET tier_expires_at = ? WHERE id = ?').run(new Date(Date.now() - 1000).toISOString(), alice.user.id);
    const d = await (await t.request('GET', '/api/auth/me', undefined, { cookie: alice.cookie })).json();
    assert.strictEqual(d.user.tier, 'free');
    assert.strictEqual(d.user.tierExpiresAt, null);
    const u = t.db.prepare('SELECT * FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(u.tier, 'free');
    // v2：惰性降级审计 = actor system + action tier_expire（tiers.js 单点；set_tier 只留给开通/取消）
    const aud = t.db.prepare("SELECT * FROM audit_log WHERE action = 'tier_expire'").all();
    assert.strictEqual(aud.length, 1);
    assert.strictEqual(aud[0].actor_type, 'system');
    assert.strictEqual(aud[0].actor_id, alice.user.id);
    const prevVal = JSON.parse(aud[0].prev_value);
    assert.strictEqual(prevVal.tier, 'premium');
    assert.strictEqual(typeof prevVal.tierExpiresAt, 'string'); // 到期时刻（ISO）
    assert.deepStrictEqual(JSON.parse(aud[0].new_value), { tier: 'free', tierExpiresAt: null });
  } finally { await t.close(); }
});

test('Basic 学生价 SKU：free 购买 basic → 开通 + 审计；过期降 free；存量 basic 升级 premium from basic', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stripeConfig(), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    assert.strictEqual(alice.user.tier, 'free'); // 注册默认：普通用户（Basic 不再直接拥有）
    await t.request('POST', '/api/subscription/checkout', { tierKey: 'basic' }, { cookie: alice.cookie });
    const before = Date.now();
    const evt = paidSession({ evt: 'evt_basic_1', id: 'cs_test_1', subscription: 'sub_test_1', customer: 'cus_test_1', amount_total: 1200 });
    assert.strictEqual((await postWebhook(t, evt)).status, 200);
    let u = t.db.prepare('SELECT * FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(u.tier, 'basic');
    assert.ok(new Date(u.tier_expires_at).getTime() > before + 27 * 86400000, 'Basic 到期顺延 1 个日历月');
    const aud = t.db.prepare("SELECT * FROM audit_log WHERE action = 'set_tier'").all();
    assert.strictEqual(aud.length, 1);
    assert.deepStrictEqual(JSON.parse(aud[0].prev_value), { from: 'free', via: 'stripe' });
    assert.deepStrictEqual(JSON.parse(aud[0].new_value), { to: 'basic' });
    // Basic 到期 → 惰性降级落 free（等级阶梯地板 = free，不再停 basic）；v2 审计 action = tier_expire
    t.db.prepare('UPDATE users SET tier_expires_at = ? WHERE id = ?').run(new Date(Date.now() - 1000).toISOString(), alice.user.id);
    const me = await (await t.request('GET', '/api/auth/me', undefined, { cookie: alice.cookie })).json();
    assert.strictEqual(me.user.tier, 'free');
    const expAud = t.db.prepare("SELECT * FROM audit_log WHERE action = 'tier_expire' ORDER BY seq DESC").get();
    assert.strictEqual(JSON.parse(expAud.prev_value).tier, 'basic');
    assert.deepStrictEqual(JSON.parse(expAud.new_value), { tier: 'free', tierExpiresAt: null });
    // 存量 Basic（保留已拥有）升级 premium：审计 from basic 兼容
    const bob = t.loginAs('bob@x.com', { tier: 'basic' });
    await t.request('POST', '/api/subscription/checkout', { tierKey: 'premium' }, { cookie: bob.cookie });
    await postWebhook(t, paidSession({ evt: 'evt_gf_1', id: 'cs_test_2', subscription: 'sub_test_2', customer: 'cus_test_2', amount_total: 2350 }));
    const gAud = t.db.prepare("SELECT * FROM audit_log WHERE action = 'set_tier' AND target_id = ? ORDER BY seq").all(bob.user.id);
    assert.strictEqual(gAud.length, 1);
    assert.deepStrictEqual(JSON.parse(gAud[0].prev_value), { from: 'basic', via: 'stripe' });
    assert.deepStrictEqual(JSON.parse(gAud[0].new_value), { to: 'premium' });
  } finally { await t.close(); }
});

// ── portal ──
test('portal：无 customer → 404；有 → url + 请求形状', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stripeConfig({ returnOrigin: 'https://mn.world' }), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    assert.strictEqual((await t.request('POST', '/api/subscription/portal', {}, { cookie: alice.cookie })).status, 404);
    t.db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run('cus_x', alice.user.id);
    const d = await (await t.request('POST', '/api/subscription/portal', {}, { cookie: alice.cookie })).json();
    assert.match(d.url, /^https:\/\/billing\.stripe\.com\//);
    assert.strictEqual(stub.calls[0].url, 'https://api.stripe.com/v1/billing_portal/sessions');
    const form = Object.fromEntries(new URLSearchParams(stub.calls[0].opts.body).entries());
    assert.strictEqual(form.customer, 'cus_x');
    assert.strictEqual(form.return_url, 'https://mn.world/pages/premium.html');
  } finally { await t.close(); }
});

// ── 容错 ──
test('webhook 容错：未知事件/未知会话/未知 tier_key → 200 忽略，绝不开通', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stripeConfig(), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    assert.strictEqual((await postWebhook(t, { id: 'evt_x', type: 'charge.succeeded', data: { object: {} } })).status, 200);
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM payments').get().n, 0);

    await checkoutFor(t, alice.cookie);
    assert.strictEqual((await postWebhook(t, paidSession({ evt: 'evt_y', id: 'cs_test_999', subscription: 'sub_999', customer: 'cus_999', amount_total: 1 }))).status, 200);
    assert.strictEqual(t.db.prepare('SELECT tier FROM users WHERE id = ?').get(alice.user.id).tier, 'free');

    // 脏数据：pending 行 tier_key 非法 → 200 忽略、不崩、不误开
    t.db.prepare('UPDATE payments SET tier_key = ? WHERE stripe_session_id = ?').run('bogus', 'cs_test_1');
    assert.strictEqual((await postWebhook(t, paidSession({ evt: 'evt_z', id: 'cs_test_1', subscription: 'sub_test_1', customer: 'cus_test_1', amount_total: 2350 }))).status, 200);
    assert.strictEqual(t.db.prepare('SELECT tier FROM users WHERE id = ?').get(alice.user.id).tier, 'free');
    assert.strictEqual(t.db.prepare('SELECT status FROM payments WHERE stripe_session_id = ?').get('cs_test_1').status, 'pending');
  } finally { await t.close(); }
});
