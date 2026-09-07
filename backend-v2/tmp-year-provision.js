// tmp-year-provision.js — v0.2.13.0 年付 Price 落库（2026-09-04，一次性；tmp 绝不 commit）
// 钦定：每年支付 = 月价 ×10（送 2 个月）——once 语义从「1 个月」变「1 年一次付」。
//  15 非 myr 币 × 5 SKU：新建 one_time Price（unit_amount = calcYear minor，metadata 加 mn_term='year'）
//  myr legacy：只建 5 个 ONCE 年价（sub 月付 id 不动），输出 env 赋值行
//  旧「1 个月」once Price（metadata mn_mode='once' 且无 mn_term）→ active=false 停用
// 幂等：新价按 mn_cur+mn_sku+mn_mode+mn_term='year' 查重；重跑只补缺不重复建。
// 用量：$env:STRIPE_SK='sk_live_…'; node tmp-year-provision.js
'use strict';
const G = require('./tmp-price-gen.js');
const API = 'https://api.stripe.com/v1';

const SKUS = [
  ['basic', 'basic', 'Basic'],
  ['premium', 'premium', 'Premium'],
  ['ultra', 'ultra', 'Premium Ultra'],
  ['pkgPremium', 'pkg-premium', 'Premium Package'],
  ['pkgUltra', 'pkg-ultra', 'Premium Ultra Package']
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

async function listAll(path, extra) {
  const out = [];
  let start = null;
  for (;;) {
    const page = await call('GET', path, { limit: 100, starting_after: start || undefined, active: true, ...(extra || {}) });
    out.push(...page.data);
    if (!page.has_more) return out;
    start = page.data[page.data.length - 1].id;
  }
}

async function main() {
  const products = await listAll('/products');
  const prods = {};
  for (const [, key, name] of SKUS) {
    let p = products.find((x) => x.name === name);
    if (!p) p = await call('POST', '/products', { name, metadata: { mn_tier: key } });
    prods[key] = p.id;
  }
  // 全量价（含 inactive 才能停用旧 once）：listAll active 限定 true → 单独翻 inactive
  const activePrices = await listAll('/prices');
  const catalog = {};
  let created = 0;
  const have = (cur, key) => activePrices.some(
    (p) => (p.metadata || {}).mn_cur === cur && (p.metadata || {}).mn_sku === key && (p.metadata || {}).mn_mode === 'once' && (p.metadata || {}).mn_term === 'year'
  );
  for (const cur of CURRENCIES) {
    catalog[cur] = {};
    for (const [f, key] of SKUS) {
      const minor = G.calcYear(cur, f).minor;
      const row = {};
      if (have(cur, key)) {
        row.once = activePrices.find((p) => (p.metadata || {}).mn_cur === cur && (p.metadata || {}).mn_sku === key && (p.metadata || {}).mn_mode === 'once' && (p.metadata || {}).mn_term === 'year').id;
        catalog[cur][key] = { sub: G.calc(cur, f).minor, once: row.once };
        continue;
      }
      const price = await call('POST', '/prices', {
        product: prods[key], currency: cur, unit_amount: minor,
        nickname: cur.toUpperCase() + ' 年付 1 年（' + G.calcYear(cur, f).disp + '）',
        metadata: { mn_cur: cur, mn_sku: key, mn_mode: 'once', mn_term: 'year' }
      });
      if (price.unit_amount !== minor) throw new Error('金额不符 ' + cur + '/' + key + ' 期望 ' + minor + ' 实得 ' + price.unit_amount);
      catalog[cur][key] = { sub: G.calc(cur, f).minor, once: price.id };
      created++;
      console.log('✅ ' + cur + ' ' + key + ' 年付 ' + price.id + ' (' + price.unit_amount + ' = ' + G.calcYear(cur, f).disp + ')');
    }
  }
  // myr legacy ONCE 年价（sub 月付 id 不动）
  const myrOnce = {};
  for (const [f, key, name] of SKUS) {
    const minor = G.calcYear('myr', f).minor;
    let p = activePrices.find((x) => (x.metadata || {}).mn_cur === 'myr' && (x.metadata || {}).mn_sku === key && (x.metadata || {}).mn_mode === 'once' && (x.metadata || {}).mn_term === 'year');
    if (!p) {
      p = await call('POST', '/prices', {
        product: prods[key], currency: 'myr', unit_amount: minor,
        nickname: 'MYR 年付 1 年（' + G.calcYear('myr', f).disp + '）',
        metadata: { mn_cur: 'myr', mn_sku: key, mn_mode: 'once', mn_term: 'year' }
      });
      created++;
      console.log('✅ myr ' + key + ' 年付 ' + p.id + ' (' + p.unit_amount + ' = ' + G.calcYear('myr', f).disp + ')');
    }
    myrOnce[key] = p.id;
  }
  // 停用旧「1 个月」once（mn_mode='once' 且无 mn_term）
  let deact = 0;
  for (const p of activePrices) {
    const m = p.metadata || {};
    if (m.mn_mode === 'once' && !m.mn_term && !m.mn_year) {
      await call('POST', '/prices/' + p.id, { active: 'false' });
      deact++;
      console.log('🛑 停用旧 1 个月 once ' + p.id + ' (' + (m.mn_cur || '?') + '/' + (m.mn_sku || '?') + ')');
    }
  }
  console.log('════ 完成：新建 ' + created + '、停用旧 once ' + deact + ' ════');
  console.log('════ STRIPE_CATALOG_B64 内嵌 JSON（sub 月付 + once 年付，抄走 encode）════');
  console.log(JSON.stringify(catalog));
  console.log('════ myr legacy env（5 个 ONCE 换新值，sub 不动）════');
  for (const [, key, name] of SKUS) {
    console.log('STRIPE_PRICE_' + key.toUpperCase().replace('-', '_') + '_ONCE=' + myrOnce[key] + '   (' + G.calcYear('myr', key).disp + ' ' + name + ')');
  }
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
