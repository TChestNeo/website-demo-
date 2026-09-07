// tmp-pm-probe.js — 探活 Stripe 账户支付方式可用性（2026-09-04，tmp 绝不 commit，零写入）
// 用量：$env:STRIPE_SK='sk_live_…'; node tmp-pm-probe.js
// 只读：/v1/account（country）+ /v1/payment_method_configurations（各方式 supported/display/币种）
'use strict';
const API = 'https://api.stripe.com/v1';

async function get(path, params) {
  const q = params ? '?' + new URLSearchParams(params) : '';
  const res = await fetch(API + path + q, {
    headers: { Authorization: 'Bearer ' + process.env.STRIPE_SK }
  });
  const j = await res.json();
  if (!res.ok) throw new Error(path + ' → ' + res.status + ' ' + JSON.stringify(j).slice(0, 300));
  return j;
}

const NON_METHOD = new Set(['id', 'object', 'application', 'created', 'updated', 'is_default', 'livemode', 'name', 'parent', 'active', 'acct_holder', 'acct_type', 'external_account_collection', 'future_off_session', 'return_url']);

async function main() {
  const acct = await get('/account');
  console.log('账户 country = ' + acct.country + ' | id = ' + acct.id);
  const cfg = await get('/payment_method_configurations');
  if (!cfg.data || cfg.data.length === 0) {
    console.log('无 PaymentMethodConfiguration 记录（legacy 模式：Dashboard 里开关）');
    return;
  }
  console.log('config 总数 = ' + cfg.data.length);
  for (const c of cfg.data) {
    console.log('\n── config ' + (c.id || '(default)') + (c.is_default ? ' [default]' : '') + ' | name=' + (c.name || ''));
    for (const [k, v] of Object.entries(c)) {
      if (NON_METHOD.has(k) || typeof v !== 'object' || v === null) continue;
      if (!('display_preference' in v)) continue;
      if (k === 'fpx' || k === 'alipay' || k === 'grabpay' || k === 'google_pay' || k === 'apple_pay' || k === 'card') {
        console.log('  ' + k + ' = ' + JSON.stringify(v));
      } else {
        const dp = (v.display_preference || {}).value;
        const mark = dp === 'on' ? '🟢' : dp === 'automatic' ? '🟡 automatic' : '⚪ off';
        console.log('  ' + k.padEnd(12) + mark + (v.supported === false ? ' !supported=false' : ''));
      }
    }
  }
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
