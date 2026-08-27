'use strict';
// Stripe 最小客户端（零 SDK）：Checkout Session / Customer Portal / webhook 验签。
// API：application/x-www-form-urlencoded + Bearer；密钥只在后端（STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET）。
// webhook 验签：Stripe-Signature "t=...,v1=..." → HMAC-SHA256(secret, `${t}.${rawBody}`)，±300s 容忍。
// 调用错误统一抛 SERVICE_UNAVAILABLE（细节打日志，不向客户端泄露）。

const crypto = require('node:crypto');
const { HttpError } = require('./http');

const API_BASE = 'https://api.stripe.com/v1';
const WEBHOOK_TOLERANCE_MS = 300 * 1000;

function formEncode(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    p.append(k, String(v));
  }
  return p.toString();
}

async function stripeCall(fetchImpl, cfg, method, path, form) {
  let res;
  try {
    res = await fetchImpl(API_BASE + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + cfg.stripe.secretKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formEncode(form)
    });
  } catch (err) {
    console.error('[stripe] fetch 失败:', err && err.message);
    throw new HttpError('SERVICE_UNAVAILABLE', '支付服务暂时不可用');
  }
  if (!res.ok) {
    console.error('[stripe]', method, path, '→', res.status, String(await res.text().catch(() => '')).slice(0, 300));
    throw new HttpError('SERVICE_UNAVAILABLE', '支付服务暂时不可用');
  }
  return res.json();
}

// 创建 Checkout Session（mode=subscription 自动续费订阅 / mode=payment 单次购买）：
// price 由调用方按通道选好（recurring / one_time）；payment_method_types 由配置列表展开 N 槽。
// 订阅模式才带 subscription_data.metadata（mode=payment 下 Stripe 会拒绝该参数）。
// 前端只拿 url 跳转，不接触任何密钥。
async function createCheckoutSession(fetchImpl, cfg, { priceId, userId, email, origin, tierKey, months, mode, paymentMethods }) {
  const successUrl = origin + '/pages/premium.html?paid=1';
  const cancelUrl = origin + '/pages/premium.html?canceled=1';
  const form = {
    mode: mode === 'payment' ? 'payment' : 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': 1,
    client_reference_id: userId,
    customer_email: email,
    'metadata[tier_key]': tierKey,
    'metadata[months]': months,
    success_url: successUrl,
    cancel_url: cancelUrl
  };
  (paymentMethods || []).forEach((m, i) => { form['payment_method_types[' + i + ']'] = m; });
  if (form.mode === 'subscription') {
    form['subscription_data[metadata][user_id]'] = userId;
    form['subscription_data[metadata][tier_key]'] = tierKey;
  }
  return stripeCall(fetchImpl, cfg, 'POST', '/checkout/sessions', form);
}

// Customer Portal（取消/换卡/看账单，Stripe 托管页面）
async function createPortalSession(fetchImpl, cfg, { customerId, origin }) {
  return stripeCall(fetchImpl, cfg, 'POST', '/billing_portal/sessions', {
    customer: customerId,
    return_url: origin + '/pages/premium.html'
  });
}

// 验签并返回事件对象；无效签名 400（Stripe 重试约定）；now 参数仅供测试注入
function verifyWebhook(rawBody, sigHeader, secret, now = Date.now()) {
  if (!sigHeader || typeof sigHeader !== 'string') {
    throw new HttpError('VALIDATION', '签名缺失');
  }
  let ts = null;
  let v1 = null;
  for (const part of sigHeader.split(',')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === 't') ts = v;
    else if (k === 'v1') v1 = v;
  }
  if (!ts || !v1 || !/^\d+$/.test(ts)) throw new HttpError('VALIDATION', '签名格式非法');
  if (Math.abs(now - Number(ts) * 1000) > WEBHOOK_TOLERANCE_MS) {
    throw new HttpError('VALIDATION', '签名已过期');
  }
  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new HttpError('VALIDATION', '签名校验失败');
  }
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new HttpError('VALIDATION', '事件体解析失败');
  }
}

module.exports = { createCheckoutSession, createPortalSession, verifyWebhook, stripeCall };
