// tmp-stripe-provision.js — 一次性：建 M.NationWorld Stripe 目录 + webhook 端点（2026-09-03）
// 币种 MYR（用户钦定，页面 ms-MY 价目表逐字：basic RM12 / premium RM23.50 / ultra RM45.50 /
//   pkg-premium RM29.90 / pkg-ultra RM60.90——订阅与单次同价（1 个月，MONTHS=1））。
// 用量：$env:STRIPE_SK='sk_live_…'; node tmp-stripe-provision.js
// 输出：每 SKU 两个 Price id（sub 月付 + once 单次）→ 映射 STRIPE_PRICE_* env；webhook 端点 secret（只显示一次）。
'use strict';
const API = 'https://api.stripe.com/v1';

// SKU 清单：env 键名 → 产品名 → 金额（sen）
const SKUS = [
  { key: 'basic',      name: 'Basic',                  amount: 1200 },
  { key: 'premium',    name: 'Premium',                amount: 2350 },
  { key: 'ultra',      name: 'Premium Ultra',          amount: 4550 },
  { key: 'pkg-premium',name: 'Premium Package',        amount: 2990 },
  { key: 'pkg-ultra',  name: 'Premium Ultra Package',  amount: 6090 }
];

async function call(method, path, form) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(form || {})) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x) => body.append(k, x));
    else if (typeof v === 'object') for (const [k2, x] of Object.entries(v)) body.append(k + '[' + k2 + ']', String(x));
    else body.append(k, String(v));
  }
  const qs = method === 'GET' && body.toString() ? '?' + body.toString() : '';
  const res = await fetch(API + path + qs, {
    method,
    headers: { Authorization: 'Bearer ' + process.env.STRIPE_SK, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : body.toString()
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(method + ' ' + path + ' → ' + res.status + ' ' + JSON.stringify(j).slice(0, 400));
  return j;
}

async function main() {
  const out = [];
  for (const sku of SKUS) {
    // 同名产品已存在则复用（幂等重跑）
    let prod = (await call('GET', '/products?active=true&limit=100', {})).data.find((p) => p.name === sku.name);
    if (!prod) prod = await call('POST', '/products', { name: sku.name, metadata: { mn_tier: sku.key } });
    const sub = await call('POST', '/prices', {
      product: prod.id, currency: 'myr', unit_amount: sku.amount,
      nickname: 'MYR 月付（' + sku.name + '）', recurring: { interval: 'month' }
    });
    const once = await call('POST', '/prices', {
      product: prod.id, currency: 'myr', unit_amount: sku.amount, nickname: 'MYR 单次（' + sku.name + '）'
    });
    out.push('STRIPE_PRICE_' + sku.key.toUpperCase().replace(/-/g, '_') + '=' + sub.id);
    out.push('STRIPE_PRICE_' + sku.key.toUpperCase().replace(/-/g, '_') + '_ONCE=' + once.id);
    console.log('✅ ' + sku.name + ' (RM' + (sku.amount / 100).toFixed(2) + ')  sub=' + sub.id + '  once=' + once.id);
  }
  const wh = await call('POST', '/webhook_endpoints', {
    url: 'https://mnationworld.com/api/webhooks/stripe',
    enabled_events: [
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'invoice.paid',
      'invoice.payment_failed',
      'customer.subscription.deleted'
    ],
    description: 'M.NationWorld production webhook'
  });
  console.log('✅ webhook endpoint ' + wh.id);
  console.log('⚠  STRIPE_WEBHOOK_SECRET=' + wh.secret + '  （只显示这一次，立即抄走）');
  console.log('\n── env 速抄 ──');
  console.log(out.join('\n'));
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
