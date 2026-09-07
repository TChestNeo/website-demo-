// tmp-price-gen.js — v0.2.12.0 多币种价目生成器（2026-09-04，只算输出给人审，不改任何文件）
// 钦定口径（AskUserQuestion 两轮批准）：
//   15 币 = usd eur gbp sgd aud cad jpy hkd twd thb idr vnd php krw inr（+myr 本地不动）
//   弱币 {thb,idr,vnd,php,inr}（1 USD 换得比 MYR 多）→ MYR 价档换算；其余 → USD 价档换算
//   尾数 X.99 / X.00；零小数币（jpy/krw/vnd）整百/整千；idr 千位整（Rp87,000 口径）
//   锚表逐字取自 premium.html :2277(ms-MY) / :2278(en-US) —— 不是猜的
//   MYR/USD 两行页面原样保留（myr=本地价钦定不动、usd=锚本身），生成其余 14 行
'use strict';
// ── 锚表（premium.html 现行页 literal，逐字）──
const USD = { basic: 5.99, premium: 11.99, ultra: 15.99, pkgPremium: 12.99, pkgUltra: 19.99, verify: 7.99, boost: 5.10, addonBasic: 5.50, addonPlus: 6.50, addonPremium: 7.99, addonUltra: 8.99 };
const MYR = { basic: 12.0, premium: 23.5, ultra: 45.5, pkgPremium: 29.9, pkgUltra: 60.9, verify: 32.0, boost: 8.6, addonBasic: 10.0, addonPlus: 14.0, addonPremium: 20.0, addonUltra: 24.0 };
const FIELDS = ['basic', 'premium', 'ultra', 'pkgPremium', 'pkgUltra', 'verify', 'boost', 'addonBasic', 'addonPlus', 'addonPremium', 'addonUltra'];
const SKU5 = [['basic', 'basic'], ['premium', 'premium'], ['ultra', 'ultra'], ['pkgPremium', 'pkg-premium'], ['pkgUltra', 'pkg-ultra']];
// 币种表：fx=每 1 USD；weak=true 用 MYR 档；zero=stripe 零小数；snap=整单位取整档（.00/.99 规则不适用时）
const CURR = {
  myr: { fx: 4.30, sym: 'RM' }, usd: { fx: 1.00, sym: '$' },
  eur: { fx: 0.92, sym: '€', label: 'EUR (€)' },
  gbp: { fx: 0.80, sym: '£', label: 'GBP (£)' },
  sgd: { fx: 1.32, sym: 'S$', label: 'SGD (S$)' },
  aud: { fx: 1.55, sym: 'A$', label: 'AUD (A$)' },
  cad: { fx: 1.37, sym: 'C$', label: 'CAD (C$)' },
  jpy: { fx: 150, sym: '¥', label: 'JPY (¥)', zero: true, snap: 100 },
  hkd: { fx: 7.80, sym: 'HK$', label: 'HKD (HK$)' },
  twd: { fx: 32.30, sym: 'NT$', label: 'TWD (NT$)' },
  thb: { fx: 34.20, sym: '฿', label: 'THB (฿)', weak: true },
  idr: { fx: 16000, sym: 'Rp ', label: 'IDR (Rp)', weak: true, snap: 1000 },
  vnd: { fx: 25000, sym: '₫', label: 'VND (₫)', weak: true, zero: true, snap: 1000 },
  php: { fx: 57, sym: '₱', label: 'PHP (₱)', weak: true },
  krw: { fx: 1340, sym: '₩', label: 'KRW (₩)', zero: true, snap: 1000 },
  inr: { fx: 84, sym: '₹', label: 'INR (₹)', weak: true }
};
const MYR_FX = CURR.myr.fx;
const comma = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
// 每币每档 → { units（整数主单位）, minor（stripe unit_amount）, disp（显示串） }
function calc(cur, field) {
  const c = CURR[cur];
  const anchor = c.weak ? MYR : USD;
  const amount = anchor[field] * c.fx / (c.weak ? MYR_FX : 1); // 该币主单位金额（浮点）
  if (c.zero) { // 零小数：整单位 × snap
    const s = c.snap || 1;
    const units = Math.round(amount / s) * s;
    return { units, minor: units, disp: c.sym + comma(units) };
  }
  if (c.snap) { // 2dp 但整单位档（idr 千位整）
    const units = Math.round(amount / c.snap) * c.snap;
    return { units, minor: units * 100, disp: c.sym + comma(units) };
  }
  // 常规 2dp：sen 级 .00/.99 就近
  const r = Math.round(amount * 100);
  const lo = Math.floor(r / 100) * 100;
  let best = lo, bd = Math.abs(r - lo);
  for (const cand of [lo + 99, lo + 100]) { const d = Math.abs(r - cand); if (d < bd) { bd = d; best = cand; } }
  return { units: best / 100, minor: best, disp: c.sym + comma(Math.floor(best / 100)) + '.' + String(best % 100).padStart(2, '0') };
}
const GEN = ['eur', 'gbp', 'sgd', 'aud', 'cad', 'jpy', 'hkd', 'twd', 'thb', 'idr', 'vnd', 'php', 'krw', 'inr'];

// ── v0.2.13.0 年付（2026-09-04 钦定）：每年支付 = 月价 ×10（送 2 个月，折合每月比月付便宜），
//    尾数规矩照旧 X.99/.00（零小数/整档币 ×10 后仍整档）；myr 本地月价手工 ×10 同规则。
//    calcYear(cur, field) → { units, minor, disp }（minor：zero=整数、idr=×100、2dp=×100）
function tail2dp(minor) { // 2dp 候选 [lo, lo+99, lo+100] 就近
  const lo = Math.floor(minor / 100) * 100;
  let best = lo, bd = Math.abs(minor - lo);
  for (const cand of [lo + 99, lo + 100]) { const d = Math.abs(minor - cand); if (d < bd) { bd = d; best = cand; } }
  return best;
}
function calcYear(cur, field) {
  const c = CURR[cur];
  if (cur === 'myr') { // myr 手工锚表 ×10
    const minor = tail2dp(Math.round(MYR[field] * 10 * 100));
    const units = minor / 100;
    const dd = String(minor % 100).padStart(2, '0');
    return { units, minor, disp: (minor % 100 === 0 ? 'RM' + units : 'RM' + units + '.' + dd) };
  }
  const m = calc(cur, field);
  if (c.zero || c.snap) {
    const u = m.units * 10;
    return { units: u, minor: c.zero ? u : u * 100, disp: c.sym + comma(u) };
  }
  const minor = tail2dp(m.minor * 10);
  return { units: minor / 100, minor, disp: c.sym + comma(Math.floor(minor / 100)) + '.' + String(minor % 100).padStart(2, '0') };
}
// 折合每月展示（年 minor ÷ 12；2dp 四舍五入到分、零小数整档四舍五入到主单位；myr 零分去尾）
function ymDisp(cur, field) {
  const c = CURR[cur];
  const y = calcYear(cur, field);
  if (c.zero) return c.sym + comma(Math.round(y.minor / 12));
  if (c.snap) return c.sym + comma(Math.round((y.minor / 100) / 12));
  const cents = Math.round(y.minor / 12); // minor 分 ÷12
  const dd = String(cents % 100).padStart(2, '0');
  return (cur === 'myr' && cents % 100 === 0 ? 'RM' + Math.floor(cents / 100) : (c.sym + comma(Math.floor(cents / 100)) + '.' + dd));
}

console.log('\n════ ④ v0.2.13.0 年付页内 literal（yP 年总价 / ymP 折合每月，逐字抄 premium.html）════');
console.log('var yP = {');
for (const cur of ['myr', 'usd', ...GEN]) {
  const f = {};
  for (const k of FIELDS) if (SKU5.some(([fld]) => fld === k)) f[k] = calcYear(cur, k).disp;
  console.log("  '" + cur + "':{" + FIELDS.filter((k) => SKU5.some(([fld]) => fld === k)).map((k) => k + ":'" + f[k] + "'").join(',') + '},');
}
console.log('};\nvar ymP = {');
for (const cur of ['myr', 'usd', ...GEN]) {
  const f = {};
  for (const k of FIELDS) if (SKU5.some(([fld]) => fld === k)) f[k] = ymDisp(cur, k);
  console.log("  '" + cur + "':{" + FIELDS.filter((k) => SKU5.some(([fld]) => fld === k)).map((k) => k + ":'" + f[k] + "'").join(',') + '},');
}
console.log('};\n════ ⑤ v0.2.13.0 Stripe 年价 minor（15 币 catalog 换 once + myr legacy ONCE env）════');
const ycat = {};
for (const cur of Object.keys(CURR)) {
  if (cur === 'myr') continue;
  ycat[cur] = {};
  for (const [f, key] of SKU5) ycat[cur][key] = { sub: calc(cur, f).minor, once: calcYear(cur, f).minor };
}
console.log('catalog=' + JSON.stringify(ycat));
for (const [f, key] of SKU5) console.log('myr ' + key + ' ONCE minor=' + calcYear('myr', f).minor + ' disp=' + calcYear('myr', f).disp);
console.log('\n════ ⑥ 年付抽查（×10 后应便宜又守规矩）════');
for (const [cur, f] of [['usd', 'premium'], ['myr', 'premium'], ['eur', 'premium'], ['jpy', 'premium'], ['php', 'premium'], ['krw', 'premium'], ['thb', 'premium'], ['usd', 'basic']]) {
  console.log('  ' + cur + ' ' + f + ' 年付=' + calcYear(cur, f).disp + ' 折合/月=' + ymDisp(cur, f) + '（月付 ' + (cur === 'myr' ? (function () { const dd = String(Math.round(MYR[f] * 100) % 100).padStart(2, '0'); return (Math.round(MYR[f] * 100) % 100 === 0 ? 'RM' + MYR[f] : 'RM' + MYR[f] + ''); })() : calc(cur, f).disp) + '）');
}
console.log('\n════ ① premium.html 14 行生成 literal（字段序与现值目一致）════');
for (const cur of GEN) {
  const c = CURR[cur];
  const f = {};
  for (const k of FIELDS) f[k] = calc(cur, k).disp;
  const parts = FIELDS.map(k => k + ":'" + f[k] + "'").join(',');
  console.log("  '" + cur + "':{label:'" + c.label + "'," + parts + '},');
}
console.log('\n════ ② Stripe catalog（15 币×5 SKU，sub=once 同价；myr 走 legacy env 不含）════');
const cat = {};
for (const cur of Object.keys(CURR)) {
  if (cur === 'myr') continue;
  cat[cur] = {};
  for (const [f, key] of SKU5) cat[cur][key] = { sub: calc(cur, f).minor, once: calc(cur, f).minor };
}
console.log(JSON.stringify(cat));
console.log('\n════ ③ 抽查对照（应命中的批准网格值）════');
for (const [cur, f] of [['eur', 'premium'], ['gbp', 'premium'], ['sgd', 'premium'], ['aud', 'premium'], ['cad', 'premium'], ['jpy', 'premium'], ['krw', 'premium'], ['twd', 'premium'], ['hkd', 'premium'], ['thb', 'premium'], ['idr', 'premium'], ['vnd', 'premium'], ['php', 'premium'], ['inr', 'premium']]) {
  console.log('  ' + cur + ' ' + f + ' → ' + calc(cur, f).disp);
}
module.exports = { calc, calcYear, ymDisp, CURR, USD, MYR, FIELDS, SKU5 };
