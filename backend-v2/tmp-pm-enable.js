// tmp-pm-enable.js — 开启支付方式 + 会话验证（2026-09-04，tmp 绝不 commit）
// ① PM config 开 alipay/fpx/grabpay/google_pay ② 回读状态 ③ Checkout 会话三探：
//   myr × 年付 once [card,fpx,alipay,grabpay] 应 200；usd × alipay 应 400（币种绑定实证）；
//   myr × 月付 sub [card] 应 200。价格读本地 tmp-catalog-v013.json（含真 ID，零写）。
// 用量：$env:STRIPE_SK='sk_live_…'; node tmp-pm-enable.js
'use strict';
const fs = require('fs');
const API = 'https://api.stripe.com/v1';

async function call(method, path, params) {
  const init = { method, headers: { Authorization: 'Bearer ' + process.env.STRIPE_SK } };
  if (params) {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(params).toString();
  }
  const res = await fetch(API + path, init);
  const j = await res.json();
  if (!res.ok) throw new Error(path + ' → ' + res.status + ' ' + JSON.stringify(j).slice(0, 400));
  return j;
}
async function getCfg() {
  const c = await call('GET', '/payment_method_configurations?limit=1');
  return c.data[0];
}
function state(c, k) { const v = c[k]; return v ? (v.display_preference || {}).value : '(无)'; }

async function main() {
  const cfg = await getCfg();
  console.log('config = ' + cfg.id);
  console.log('前：alipay=' + state(cfg, 'alipay') + ' fpx=' + state(cfg, 'fpx') + ' grabpay=' + state(cfg, 'grabpay') + ' google_pay=' + state(cfg, 'google_pay') + ' apple_pay=' + state(cfg, 'apple_pay') + ' card=' + state(cfg, 'card') + ' link=' + state(cfg, 'link'));
  const up = await call('POST', '/payment_method_configurations/' + cfg.id, {
    'alipay[display_preference][preference]': 'on',
    'fpx[display_preference][preference]': 'on',
    'grabpay[display_preference][preference]': 'on',
    'google_pay[display_preference][preference]': 'on'
  });
  console.log('后：alipay=' + state(up, 'alipay') + ' fpx=' + state(up, 'fpx') + ' grabpay=' + state(up, 'grabpay') + ' google_pay=' + state(up, 'google_pay'));
  const cat = JSON.parse(fs.readFileSync(__dirname + '/tmp-catalog-v013.json', 'utf8'));
  // myr 走 legacy env 价（不在 catalog 内）；由外层从线上 env 注入，usd 走 catalog
  const myrOnce = process.env.MYR_ONCE, myrSub = process.env.MYR_SUB, usdOnce = cat.usd.premium.once;
  console.log('myrOnce=' + myrOnce + ' myrSub=' + myrSub + ' usdOnce=' + usdOnce);
  const mk = async (mode, price, currency, types) => {
    const p = new URLSearchParams();
    p.set('mode', mode); p.set('currency', currency);
    p.set('line_items[0][price]', price); p.set('line_items[0][quantity]', '1');
    p.set('success_url', 'https://mnationworld.com/thanks'); p.set('cancel_url', 'https://mnationworld.com/pages/premium');
    for (const t of types) p.append('payment_method_types[]', t); // URLSearchParams 会并数组，逐项 append
    const res = await fetch(API + '/checkout/sessions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + process.env.STRIPE_SK, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: p.toString()
    });
    const j = await res.json();
    if (!res.ok) throw new Error(res.status + ' ' + JSON.stringify(j));
    return j;
  };
  for (const t of ['fpx', 'alipay']) {
    try { const s = await mk('payment', myrOnce, 'myr', [t]); console.log('✅ myr 年付 once × ' + t + ' → 200 session ' + s.id); }
    catch (e) { console.log('❌ myr 年付 once × ' + t + ' → ' + e.message); }
  }
  try { await mk('payment', usdOnce, 'usd', ['alipay']); console.log('❌ usd × alipay 竟然 200（预期 400）'); }
  catch (e) { console.log('✅ usd × alipay 拒（币种绑定实证）：' + e.message.slice(0, 180)); }
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
