// tmp-stripe-provision-student.js — v0.2.44.0 学生价 Stripe 同步（2026-09-16，一次性；tmp 绝不 commit）
// 站点学生价（用户钦定）：Basic 仅 MYR —— 月付 RM5.50（recurring month）+ 年付 RM55（one_time）。
// 生产 env STRIPE_PRICE_BASIC_STUDENT/_ONCE 两键为空 → 学生结账按钮 409（c7bbef7「Price ID 到后仅 env 合并重部署」）。
// 幂等：产品按 name='Basic' 复用；价格按 (product, currency, unit_amount, recurring interval) 查重——
// 用户在 Dashboard 手建过 RM5.50/RM55 也复用不重复建。
// 用量：$env:STRIPE_SK='sk_live_…'; node tmp-stripe-provision-student.js
// 输出：两 Price id → 传给 tmp-deploy-student.ps1。
'use strict';
const API = 'https://api.stripe.com/v1';

const TARGETS = [
  { mode: 'sub',  amount: 550,  recurring: { interval: 'month' }, nickname: 'MYR 月付（Basic 学生价）' },
  { mode: 'once', amount: 5500, recurring: null,                nickname: 'MYR 单次（Basic 学生价）' }
];

async function call(method, path, form) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(form || {})) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'object') for (const [k2, x] of Object.entries(v)) body.append(k + '[' + k2 + ']', String(x));
    else body.append(k, String(v));
  }
  const qs = method === 'GET' && body.toString() ? '?' + body.toString() : '';
  const res = await fetch(API + path + qs, {
    method,
    headers: { Authorization: 'Bearer ' + process.env.STRIPE_SK, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : body.toString()
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(method + ' ' + path + ' -> ' + res.status + ' ' + JSON.stringify(j).slice(0, 400));
  return j;
}

async function listAll(path, extra) {
  const out = [];
  let start = null;
  for (;;) {
    const page = await call('GET', path, { limit: 100, starting_after: start || undefined, ...extra });
    out.push(...page.data);
    if (!page.has_more) return out;
    start = page.data[page.data.length - 1].id;
  }
}

async function main() {
  if (!process.env.STRIPE_SK) throw new Error('STRIPE_SK missing');
  const products = await listAll('/products', { active: true });
  const prod = products.find((p) => p.name === 'Basic');
  if (!prod) throw new Error('Basic product not found');
  const prices = await listAll('/prices', { active: true });
  const out = {};
  for (const t of TARGETS) {
    const intervalOf = (p) => (p.recurring && p.recurring.interval) || null;
    const existing = prices.find((p) => p.product === prod.id && p.currency === 'myr'
      && p.unit_amount === t.amount && intervalOf(p) === intervalOf(t));
    if (existing) {
      out[t.mode] = existing.id;
      console.log('reuse ' + t.mode + ' ' + existing.id + ' RM' + (t.amount / 100).toFixed(2) + ' (exists in Stripe)');
      continue;
    }
    const form = {
      product: prod.id, currency: 'myr', unit_amount: t.amount, nickname: t.nickname,
      metadata: { mn_cur: 'myr', mn_sku: 'basic', mn_mode: t.mode, mn_student: '1' }
    };
    if (t.recurring) form.recurring = t.recurring;
    const price = await call('POST', '/prices', form);
    if (price.unit_amount !== t.amount) throw new Error('amount mismatch ' + t.mode);
    out[t.mode] = price.id;
    console.log('created ' + t.mode + ' ' + price.id + ' RM' + (t.amount / 100).toFixed(2));
  }
  console.log('==== ids ====');
  console.log('monthly=' + out.sub);
  console.log('yearly=' + out.once);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
