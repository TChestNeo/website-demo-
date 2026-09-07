// tmp-year-catalog.js — v0.2.13.0 年付 catalog 组装（2026-09-04，tmp 绝不 commit，只读 Stripe）
// 正确 catalog = 旧 tmp-catalog.json（sub 月付 ID 原样不动）+ once 换成新建年付 Price ID
// （metadata mn_mode='once' && mn_term='year' 按 cur+sku 查）。零写入。输出写入 tmp-catalog-v013.json/.b64。
// 用量：$env:STRIPE_SK='sk_live_…'; node tmp-year-catalog.js
'use strict';
const fs = require('fs');
const API = 'https://api.stripe.com/v1';
const old = JSON.parse(fs.readFileSync(__dirname + '/tmp-catalog.json', 'utf8'));

async function listAll(path) {
  const out = [];
  let start = null;
  for (;;) {
    const body = new URLSearchParams({ limit: '100', active: 'true' });
    if (start) body.set('starting_after', start);
    const res = await fetch(API + path + '?' + body, {
      headers: { Authorization: 'Bearer ' + process.env.STRIPE_SK }
    });
    const j = await res.json();
    if (!res.ok) throw new Error(path + ' → ' + res.status + ' ' + JSON.stringify(j).slice(0, 300));
    out.push(...j.data);
    if (!j.has_more) return out;
    start = j.data[j.data.length - 1].id;
  }
}

async function main() {
  const prices = await listAll('/prices');
  const yearById = {}; // cur|key → price
  for (const p of prices) {
    const m = p.metadata || {};
    if (m.mn_mode === 'once' && m.mn_term === 'year' && !p.recurring) yearById[m.mn_cur + '|' + m.mn_sku] = p;
  }
  const cat = {};
  let bad = 0;
  for (const [cur, tiers] of Object.entries(old)) {
    cat[cur] = {};
    for (const [key, row] of Object.entries(tiers)) {
      const np = yearById[cur + '|' + key];
      if (!np) { bad++; console.log('🛑 缺年付 ID ' + cur + '/' + key); continue; }
      cat[cur][key] = { sub: row.sub, once: np.id }; // sub 沿用旧值、once 换年付
    }
  }
  if (bad) throw new Error(bad + ' 个币/档缺年付价');
  const json = JSON.stringify(cat);
  const b64 = Buffer.from(json).toString('base64url');
  fs.writeFileSync(__dirname + '/tmp-catalog-v013.json', json);
  fs.writeFileSync(__dirname + '/tmp-catalog-v013.b64', b64);
  // 校验：解回原串一致 + 旧 once 一个都没混入
  const back = Buffer.from(b64, 'base64').toString('utf8');
  const n = Object.keys(cat).length;
  const oldOnce = new Set();
  for (const t of Object.values(old)) for (const r of Object.values(t)) oldOnce.add(r.once);
  const leaks = JSON.stringify(cat).split('"once":"').slice(1).filter((s) => oldOnce.has(s.slice(0, s.indexOf('"')))).length;
  console.log('════ catalog 组装完成：' + n + ' 币 × 5 SKU，once 全换年付 ID ════');
  console.log('roundtrip=' + (back === json ? 'OK' : 'FAIL') + ' 旧 once 混入=' + leaks + ' json ' + json.length + ' 字符 b64 ' + b64.length + ' 字符');
  console.log('抽查 usd.basic=' + cat.usd.basic.once + ' inr.pkg-ultra=' + cat.inr['pkg-ultra'].once);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
