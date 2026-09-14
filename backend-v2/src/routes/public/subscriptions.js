'use strict';
// 在线支付（Stripe 混合模式）——付费页契约：
//   GET  /api/subscription/status   （公开）?currency=（缺省 myr）{ enabled, mode:'hybrid', prices{hasPrice,hasOnce}, onceMethods, ...会话态附 tier/tierExpiresAt/hasPortal }
//   POST /api/subscription/checkout （会话）{ tierKey, mode:'subscription'|'once', currency?='myr' } → { url }（Stripe Checkout 跳转，前端零密钥）
// 多币种（v0.2.12.0）：currency 由服务端解析 Price ID（前端给 price id 可伪造，永不信任）；
//   myr = legacy env Price（马来西亚本地价 RM12/23.50…）；usd+14 币 = STRIPE_CATALOG_B64 目录
//   （弱币 idr/vnd/thb/php/inr 按 MYR 价档、其余按 USD 价档，尾 X.99/.00）；非 myr 只允许卡付。
//   POST /api/subscription/portal   （会话）→ { url }（Customer Portal：取消/换卡/账单；仅订阅用户）
//   POST /api/webhooks/stripe       （Stripe 服务器→服务器，HMAC 验签）
// 混合通道：subscription = 自动续费订阅（仅卡类支撑反复扣款，Apple Pay 随卡自动出现）；
// once = 每年支付 1 年（v0.2.13.0：月价 ×10 送 2 个月，一次付清不自动续费；FPX 网银/支付宝/GrabPay
// 等一次性支付方式，webhook 以 session.mode=payment 区分，审计 via=stripe_once，到期顺延 +12 个月）。
// 口径：支付/续费 = tier 提升 + 到期顺延（tier_expires_at，NULL=管理员永久授予）；
// 取消（customer.subscription.deleted）= 立即降 free；到期惰性降级兜底（/auth/me 等读取路径）。
// 等级阶梯：free(普通用户，注册默认) < basic(学生价 RM12/月) < premium < ultra；降级一律落 free。
// 幂等：stripe_event_id 去重 + 行状态机（pending→paid 只一次）；tier_key/months 一律取本库 pending 行
// （checkout 时由服务端写入），绝不信任 webhook 事件里的 metadata/金额口径。
// 财务口径不变：payments 是支付事件账，不对接 ledger（流水账仍人工记账，Stripe 打款到账后录 income）。
// 审计口径：Stripe 触发的 tier 变更写 set_tier 审计行（actor=stripe，actor_id = 被开通用户自身 id——
// 保留 v1 财报重放 actor 口径），prev.from/next.to/via 直接映射 v1 admin_audit_log detail 形状。
// v2 差异：enforceTierExpiry 复用 src/tiers.js（审计 action=tier_expire）；auditTier → audit() 哈希链。

const { HttpError, sendJson, readJson, readRaw } = require('../../http');
const { requireSession, authenticate } = require('../../middleware/auth');
const { insertWithId, pad6 } = require('../../ids');
const { createCheckoutSession, createPortalSession, verifyWebhook } = require('../../stripe');
const { enforceTierExpiry } = require('../../tiers');
const { audit } = require('../../audit');
const { studentShape, studentRefresh } = require('../../students');

const TIER_OF = { basic: 'basic', premium: 'premium', ultra: 'ultra', 'pkg-premium': 'premium', 'pkg-ultra': 'ultra' };
const TIER_KEYS = Object.keys(TIER_OF);
const TIER_RANK = { free: 0, basic: 1, premium: 2, ultra: 3 };
const MONTHS = 1; // 订阅：月付（自动续费）
const ONCE_MONTHS = 12; // once（每年支付）= 一次付清 1 年；row.months 落 12 → applyPaid 到期顺延 12 个月

// ── 多币种解析（v0.2.12.0）──
// 空/缺省 → myr（legacy env Price，向后兼容）。其余币必须出现在 catalog 才给会话；
// Price ID 一律服务端解析——前端传 id 可伪造，永不信任。
function normalizeCurrency(raw) {
  const c = String(raw || '').trim().toLowerCase();
  return c === '' ? 'myr' : c;
}
function priceIdFor(cfg, tierKey, currency, mode) {
  if (currency === 'myr') return (mode === 'once' ? cfg.stripe.pricesOnce : cfg.stripe.prices)[tierKey] || '';
  const cat = (cfg.stripe.catalog || {})[currency];
  const p = cat && cat[tierKey];
  return (p && p[mode === 'once' ? 'once' : 'sub']) || '';
}
// 支付方式：FPX/支付宝/GrabPay 是马区一次性方式，只挂 myr 会话；非 myr 一律纯卡（订阅本就只卡）。
function paymentMethodsFor(cfg, currency, mode) {
  if (currency !== 'myr') return ['card'];
  return mode === 'once' ? cfg.stripe.oncePaymentMethods : cfg.stripe.paymentMethods;
}

// 到期顺延：现有到期（未过期）→ 从它顺延；否则从 now 顺延。日历月加（对齐 Stripe 月结周期）。
function extendExpiry(existing, months, nowIso) {
  const base = existing && existing > nowIso ? new Date(existing) : new Date(nowIso);
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
}

// set_tier 审计（via 标明来源：stripe / stripe_once / stripe_cancel / stripe_expired；形状兼容现有重放口径）
function auditTier(db, user, to, via) {
  audit(db, null, {}, {
    actorType: 'stripe',
    actorId: user.id, // 被开通用户自身（v1 财报重放口径）
    action: 'set_tier',
    targetType: 'user',
    targetId: user.id,
    prev: { from: user.tier, via },
    next: { to },
    reason: 'via:' + via
  });
}

// 支付落账 + tier 生效（row 必须是本库 pending 行：tier_key/months 可信）。幂等：event 已处理 / 行已 paid → false。
function applyPaid(db, cfg, row, opts) {
  if (row.status === 'paid') return false;
  if (db.prepare("SELECT 1 FROM payments WHERE stripe_event_id = ? AND status = 'paid'").get(opts.eventId)) return false;
  const target = TIER_OF[row.tier_key];
  if (!target) { console.log('[webhook] 未知 tier_key ' + row.tier_key + '，忽略'); return false; } // 绝不信任行外输入
  const iso = new Date().toISOString();
  db.prepare("UPDATE payments SET status = 'paid', paid_at = ?, stripe_event_id = ?, "
    + 'stripe_invoice_id = COALESCE(stripe_invoice_id, ?), stripe_subscription_id = COALESCE(stripe_subscription_id, ?), '
    + 'amount_micro = ?, currency = ? WHERE id = ? AND status = \'pending\'')
    .run(iso, opts.eventId, opts.invoiceId || null, opts.subscriptionId || null,
      opts.amountMicro, opts.currency || 'myr', row.id);
  if (opts.customerId) {
    db.prepare('UPDATE users SET stripe_customer_id = COALESCE(stripe_customer_id, ?) WHERE id = ?')
      .run(opts.customerId, row.user_id);
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  if (!user) return false;
  const newTier = TIER_RANK[user.tier] > TIER_RANK[target] ? user.tier : target;
  // 同 tier 且当前为管理员永久授予（无到期）→ 保持永久，不把永久转成限时
  const expiry = (newTier === user.tier && !user.tier_expires_at)
    ? null : extendExpiry(user.tier_expires_at, row.months || 1, iso);
  if (newTier !== user.tier || expiry !== user.tier_expires_at) {
    db.prepare('UPDATE users SET tier = ?, tier_expires_at = ?, updated_at = ? WHERE id = ?')
      .run(newTier, expiry, iso, user.id);
    if (newTier !== user.tier) auditTier(db, user, newTier, opts.via || 'stripe');
  }
  return true;
}

// 支付成功回跳/取消回跳的页面 URL 前缀：请求 Origin（白名单内）→ STRIPE_RETURN_ORIGIN → 白名单首项 → 本地默认
function returnOrigin(ctx, req) {
  const cfg = ctx.config;
  if (cfg.stripe.returnOrigin) return cfg.stripe.returnOrigin;
  const o = req.headers.origin || '';
  if (o && cfg.frontendOrigins.includes(o)) return o;
  if (cfg.frontendOrigins[0]) return cfg.frontendOrigins[0];
  return 'http://127.0.0.1:8080';
}

// checkout 会话事件（completed / async_payment_succeeded）：落 customer/subscription id；
// payment_status=paid 才开通（FPX 异步到账时 completed 为 unpaid，等 async 事件）
function handleSession(db, cfg, event) {
  const s = event.data.object || {};
  const row = db.prepare('SELECT * FROM payments WHERE stripe_session_id = ?').get(s.id);
  if (!row) { console.log('[webhook] 未知会话 ' + s.id); return; }
  if (s.subscription) {
    db.prepare('UPDATE payments SET stripe_subscription_id = ? WHERE id = ? AND stripe_subscription_id IS NULL')
      .run(s.subscription, row.id);
  }
  if (s.customer) {
    db.prepare('UPDATE users SET stripe_customer_id = COALESCE(stripe_customer_id, ?) WHERE id = ?')
      .run(s.customer, row.user_id);
  }
  if (s.payment_status !== 'paid') return;
  // 年付 once（mode=payment）无 subscription，审计 via=stripe_once 与订阅区分（财报口径可追溯）
  applyPaid(db, cfg, row, {
    eventId: event.id, subscriptionId: s.subscription || null, customerId: s.customer || null,
    amountMicro: s.amount_total || 0, currency: (s.currency || 'myr').toLowerCase(),
    via: s.mode === 'payment' ? 'stripe_once' : 'stripe'
  });
}

// 发票已付：首期 = pending 行转 paid（与 session 事件二选一先到者生效）；续费 = 新增一行 + 到期顺延
function handleInvoicePaid(db, cfg, event) {
  const inv = event.data.object || {};
  if (!inv.subscription) return;
  if (db.prepare('SELECT 1 FROM payments WHERE stripe_event_id = ? OR stripe_invoice_id = ?').get(event.id, inv.id)) return;
  const pending = db.prepare("SELECT * FROM payments WHERE stripe_subscription_id = ? AND status = 'pending' ORDER BY seq DESC LIMIT 1")
    .get(inv.subscription);
  const opts = {
    eventId: event.id, invoiceId: inv.id, customerId: inv.customer || null,
    amountMicro: inv.amount_paid || 0, currency: (inv.currency || 'myr').toLowerCase()
  };
  if (pending) { applyPaid(db, cfg, pending, opts); return; }
  const subRow = db.prepare('SELECT * FROM payments WHERE stripe_subscription_id = ? ORDER BY seq DESC LIMIT 1')
    .get(inv.subscription);
  if (!subRow) { console.log('[webhook] 未知订阅 ' + inv.subscription); return; }
  const iso = new Date().toISOString();
  const { id } = insertWithId(db, 'payments',
    ['user_id', 'stripe_subscription_id', 'stripe_invoice_id', 'tier_key', 'amount_micro', 'currency', 'months', 'status', 'created_at'],
    [subRow.user_id, inv.subscription, inv.id, subRow.tier_key, inv.amount_paid || 0,
      (inv.currency || 'myr').toLowerCase(), subRow.months || 1, 'pending', iso],
    (s) => 'PAY-' + pad6(s));
  applyPaid(db, cfg, db.prepare('SELECT * FROM payments WHERE id = ?').get(id), opts);
}

// 扣款失败：记 failed 行，tier 不动（Stripe 催款重试；最终失败会发 subscription.deleted）
function handleInvoiceFailed(db, cfg, event) {
  const inv = event.data.object || {};
  if (!inv.subscription) return;
  if (db.prepare('SELECT 1 FROM payments WHERE stripe_event_id = ? OR stripe_invoice_id = ?').get(event.id, inv.id)) return;
  const subRow = db.prepare('SELECT * FROM payments WHERE stripe_subscription_id = ? ORDER BY seq DESC LIMIT 1')
    .get(inv.subscription);
  if (!subRow) { console.log('[webhook] 未知订阅 ' + inv.subscription); return; }
  const iso = new Date().toISOString();
  insertWithId(db, 'payments',
    ['user_id', 'stripe_subscription_id', 'stripe_invoice_id', 'stripe_event_id', 'tier_key', 'amount_micro', 'currency', 'months', 'status', 'created_at'],
    [subRow.user_id, inv.subscription, inv.id, event.id, subRow.tier_key, inv.amount_due || 0,
      (inv.currency || 'myr').toLowerCase(), subRow.months || 1, 'failed', iso],
    (s) => 'PAY-' + pad6(s));
}

// 订阅终止（取消/催款耗尽）：立即降 free + 清到期（订阅多并存属一期可接受范围）
function handleSubDeleted(db, cfg, event) {
  const sub = event.data.object || {};
  const row = db.prepare('SELECT * FROM payments WHERE stripe_subscription_id = ? ORDER BY seq DESC LIMIT 1').get(sub.id);
  if (!row) { console.log('[webhook] 未知订阅 ' + sub.id); return; }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  if (!user || user.tier === 'free') return;
  db.prepare("UPDATE users SET tier = 'free', tier_expires_at = NULL, updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), user.id);
  auditTier(db, user, 'free', 'stripe_cancel');
}

function register(router, ctx) {
  const db = ctx.db;
  const cfg = ctx.config;

  // 订阅状态（公开；带会话则附 tier/到期/portal 可用性——前端据此切支付态 vs 申请流）
  // ?currency=：缺省 myr（legacy env）；非 myr 币查 catalog——hasPrice/hasOnce 反映该币实际可买通道
  router.add('GET', '/api/subscription/status', (req, res) => {
    const currency = normalizeCurrency(req.query && req.query.currency);
    const prices = {};
    for (const k of TIER_KEYS) prices[k] = {
      hasPrice: !!priceIdFor(cfg, k, currency, 'subscription'), // 订阅通道（自动续费，卡类）
      hasOnce: !!priceIdFor(cfg, k, currency, 'once')           // 每年支付通道（一次性方式）
    };
    const out = {
      enabled: !!(cfg.stripe.enabled && cfg.stripe.secretKey),
      mode: 'hybrid', // subscription（自动续费，卡类）+ once（每年支付 1 年，一次付清）
      currency,
      prices,
      onceMethods: paymentMethodsFor(cfg, currency, 'once'),
      // v0.2.44.0 学生价（仅 Basic × 仅 myr）：前端据此门学生 CTA/年付按钮
      studentPrice: currency === 'myr' && !!((cfg.stripe.studentPrices || {}).basic),
      studentHasOnce: currency === 'myr' && !!((cfg.stripe.studentPricesOnce || {}).basic)
    };
    let user = null;
    try { user = authenticate(ctx.db, req, res, ctx); } catch (e) { /* 匿名：只给配置态 */ }
    if (user) {
      user = studentRefresh(db, enforceTierExpiry(ctx.db, cfg, user));
      out.tier = user.tier;
      out.tierExpiresAt = user.tier_expires_at || null;
      out.student = studentShape(user);
      // portal 只管订阅（取消/换卡/账单）；年付 once 用户有 customer id 但无订阅，不给 portal
      out.hasPortal = !!db.prepare(
        "SELECT 1 FROM payments WHERE user_id = ? AND status = 'paid' AND stripe_subscription_id IS NOT NULL LIMIT 1"
      ).get(user.id);
    }
    sendJson(res, 200, out);
  });

  // 创建 Checkout Session（前端拿 url 跳转；对应通道 Price ID 未配 → PAYMENTS_DISABLED，前端回退申请流）
  // mode：subscription（默认，自动续费订阅，卡类）/ once（每年支付 1 年，一次性支付方式，月价×10）
  // currency：缺省 myr；非 myr 必须命中 catalog（Price ID 服务端解析，防伪造）
  router.add('POST', '/api/subscription/checkout', requireSession(async (req, res) => {
    const w = (cfg.rateLimits || {}).checkout || { max: 5, windowMs: 60000 };
    if (!ctx.limiter('pay:u:' + ctx.user.id, w.max, w.windowMs)) throw new HttpError('RATE_LIMITED', '操作过于频繁');
    const body = await readJson(req);
    const tierKey = String(body.tierKey || '');
    if (!TIER_OF[tierKey]) throw new HttpError('VALIDATION', 'tierKey 非法');
    let mode = 'subscription';
    if (body.mode === 'once') mode = 'once';
    else if (body.mode !== undefined && body.mode !== 'subscription') throw new HttpError('VALIDATION', 'mode 非法');
    const currency = normalizeCurrency(body.currency);
    if (currency !== 'myr' && !(cfg.stripe.catalog || {})[currency]) throw new HttpError('VALIDATION', 'currency 暂不支持');
    // v0.2.44.0 学生价（仅 Basic SKU × 仅 myr）：守卫在限流后、建会话前；认证缺失 → STUDENT_REQUIRED（前端走重新认证弹窗）
    const student = body.student === true;
    if (student) {
      if (tierKey !== 'basic') throw new HttpError('VALIDATION', '学生价仅适用于 Basic 方案');
      if (currency !== 'myr') throw new HttpError('VALIDATION', '学生价仅限 MYR 结算');
      if (!studentRefresh(db, ctx.user).student_email) throw new HttpError('STUDENT_REQUIRED', '请先完成学生邮箱认证');
    }
    const priceId = student
      ? (mode === 'once' ? (cfg.stripe.studentPricesOnce || {}).basic : (cfg.stripe.studentPrices || {}).basic)
      : priceIdFor(cfg, tierKey, currency, mode);
    if (!cfg.stripe.enabled || !cfg.stripe.secretKey || !priceId) {
      throw new HttpError('PAYMENTS_DISABLED', '在线支付未开通，请通过申请流程开通');
    }
    const session = await createCheckoutSession(ctx.moderation.fetchImpl, cfg, {
      priceId, userId: ctx.user.id, email: ctx.user.email,
      origin: returnOrigin(ctx, req), tierKey, months: mode === 'once' ? ONCE_MONTHS : MONTHS,
      mode: mode === 'once' ? 'payment' : 'subscription',
      paymentMethods: paymentMethodsFor(cfg, currency, mode)
    });
    insertWithId(db, 'payments',
      ['user_id', 'stripe_session_id', 'tier_key', 'amount_micro', 'currency', 'months', 'status', 'promo_id', 'created_at'],
      [ctx.user.id, session.id, tierKey, 0, currency, mode === 'once' ? ONCE_MONTHS : MONTHS, 'pending',
        student ? 'student' : null, new Date().toISOString()],
      (s) => 'PAY-' + pad6(s));
    sendJson(res, 200, { url: session.url });
  }));

  // Customer Portal（管理订阅：取消/换卡/账单）
  router.add('POST', '/api/subscription/portal', requireSession(async (req, res) => {
    if (!ctx.user.stripe_customer_id) throw new HttpError('NOT_FOUND', '尚无订阅记录');
    const s = await createPortalSession(ctx.moderation.fetchImpl, cfg, {
      customerId: ctx.user.stripe_customer_id, origin: returnOrigin(ctx, req)
    });
    sendJson(res, 200, { url: s.url });
  }));

  // Stripe webhook（原始体 + HMAC 验签；未配置密钥时忽略——防盲端）
  router.add('POST', '/api/webhooks/stripe', async (req, res) => {
    if (!cfg.stripe.webhookSecret) {
      console.log('[webhook] 未配置 STRIPE_WEBHOOK_SECRET，事件忽略');
      return sendJson(res, 200, { received: true, ignored: true });
    }
    const raw = await readRaw(req);
    const event = verifyWebhook(raw, req.headers['stripe-signature'], cfg.stripe.webhookSecret);
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      handleSession(db, cfg, event);
    } else if (event.type === 'invoice.paid') {
      handleInvoicePaid(db, cfg, event);
    } else if (event.type === 'invoice.payment_failed') {
      handleInvoiceFailed(db, cfg, event);
    } else if (event.type === 'customer.subscription.deleted') {
      handleSubDeleted(db, cfg, event);
    } else {
      console.log('[webhook] 忽略事件 ' + event.type);
    }
    sendJson(res, 200, { received: true });
  });
}

module.exports = { register, enforceTierExpiry, TIER_OF, TIER_KEYS };
