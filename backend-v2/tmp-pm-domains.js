// tmp-pm-domains.js — 探活 PaymentMethodDomain（Apple/Google Pay/Link 域名注册验证状态，2026-09-04，tmp 绝不 commit，零写入）
// 用法：$env:STRIPE_SK='sk_live_…'; node tmp-pm-domains.js
'use strict';
const API = 'https://api.stripe.com/v1';
async function get(path) {
  const res = await fetch(API + path, { headers: { Authorization: 'Bearer ' + process.env.STRIPE_SK } });
  const j = await res.json();
  if (!res.ok) throw new Error(path + ' → ' + res.status + ' ' + JSON.stringify(j).slice(0, 300));
  return j;
}
async function main() {
  const d = await get('/payment_method_domains?limit=100');
  console.log('payment_method_domains 总数 = ' + d.data.length);
  for (const x of d.data) {
    const enabled = Object.keys(x.enabled_payment_methods || {}).join(',') || '(空)';
    const statuses = Object.entries(x.payment_method_statuses || {})
      .filter(([, v]) => v && typeof v === 'object')
      .map(([k, v]) => k + ':' + (v.status || '?')).join(' ');
    console.log((x.id || '') + ' | domain=' + (x.domain_name || '') + ' | enabled=[' + enabled + '] | ' + statuses + (x.google_pay && x.google_pay.status ? ' | gp=' + x.google_pay.status : ''));
  }
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
