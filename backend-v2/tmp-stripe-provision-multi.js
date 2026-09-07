// tmp-stripe-provision-multi.js — v0.2.12.0 多币种 Price 目录（2026-09-04，一次性；tmp 绝不 commit）
// 15 币（usd+14，myr 走 legacy env 已有不动）× 5 SKU × {sub 月付, once 单次} = 150 Price。
// 金额单一来源 = tmp-price-gen.js 的 calc()（钦定 FX 口径已抽查 14/14；同价目已落 premium.html）。
// 幂等：product 按 name 复用；price 按 metadata{mn_cur,mn_sku,mn_mode} 查重——重跑只补缺不重复建。
// 用量：$env:STRIPE_SK='sk_live_…'; node tmp-stripe-provision-multi.js
// 输出：catalog JSON（{currency:{tierKey:{sub,once}}}，price id）→ 抄去做 STRIPE_CATALOG_B64。
'use strict';
const G = require('./tmp-price-gen.js');
const API = 'https://api.stripe.com/v1';

// SKU：field = calc 锚字段；key = catalog/env tierKey；name = Stripe 产品名（与 myr 轮一致，复用幂等）
const SKUS = [
  { field: 'basic', key: 'basic', name: 'Basic' },
  { field: 'premium', key: 'premium', name: 'Premium' },
  { field: 'ultra', key: 'ultra', name: 'Premium Ultra' },
  { field: 'pkgPremium', key: 'pkg-premium', name: 'Premium Package' },
  { field: 'pkgUltra', key: 'pkg-ultra', name: 'Premium Ultra Package' }
];
const CURRENCIES = ['usd', 'eur', 'gbp', 'sgd', 'aud', 'cad', 'jpy', 'hkd', 'twd', 'thb', 'idr', 'vnd', 'php', 'krw', 'inr'];

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

async function listAll(path) {
  const out = [];
  let start = null;
  for (;;) {
    const page = await call('GET', path, { limit: 100, starting_after: start || undefined, active: true });
    out.push(...page.data);
    if (!page.has_more) return out;
    start = page.data[page.data.length - 1].id;
  }
}

async function main() {
  const products = await listAll('/products');
  const prods = {};
  for (const sku of SKUS) {
    let p = products.find((x) => x.name === sku.name);
    if (!p) p = await call('POST', '/products', { name: sku.name, metadata: { mn_tier: sku.key } });
    prods[sku.key] = p.id;
  }
  const existing = await listAll('/prices');
  const have = (cur, key, mode) => existing.some(
    (p) => (p.metadata || {}).mn_cur === cur && (p.metadata || {}).mn_sku === key && (p.metadata || {}).mn_mode === mode
  );
  const catalog = {};
  let created = 0, skipped = 0;
  for (const cur of CURRENCIES) {
    catalog[cur] = {};
    for (const sku of SKUS) {
      const minor = G.calc(cur, sku.field).minor; // calc: zero/snap/2dp 全管；sub=once 同价（MONTHS=1 口径）
      const row = {};
      for (const [mode, label] of [['sub', '月付'], ['once', '单次']]) {
        if (have(cur, sku.key, mode)) { skipped++; row[mode] = existing.find(
          (p) => (p.metadata || {}).mn_cur === cur && (p.metadata || {}).mn_sku === sku.key && (p.metadata || {}).mn_mode === mode
        ).id; continue; }
        const form = { product: prods[sku.key], currency: cur, unit_amount: minor, nickname: cur.toUpperCase() + ' ' + label + '（' + sku.name + '）', metadata: { mn_cur: cur, mn_sku: sku.key, mn_mode: mode } };
        if (mode === 'sub') form.recurring = { interval: 'month' };
        const price = await call('POST', '/prices', form);
        row[mode] = price.id;
        created++;
        if (price.unit_amount !== minor) throw new Error('金额不符 ' + cur + '/' + sku.key + '/' + mode + ' 期望 ' + minor + ' 实得 ' + price.unit_amount);
        console.log('✅ ' + cur + ' ' + sku.name + ' ' + label + ' ' + price.id + '  (' + price.unit_amount + ')');
      }
      catalog[cur][sku.key] = { sub: row.sub, once: row.once };
    }
  }
  console.log('════ 完成：新建 ' + created + '、幂等跳过 ' + skipped + ' ════');
  console.log('════ STRIPE_CATALOG_B64 内嵌 JSON（抄走）════');
  console.log(JSON.stringify(catalog));
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
