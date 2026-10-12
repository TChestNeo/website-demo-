// tmp-stripe-probe-pm.js — 探测账户当前可用的 payment_method_types（2026-09-16，一次性；tmp 绝不 commit）
// 方法=逐个建 live Checkout Session（建 session 不扣款、24h 自动过期；错误信息点名不可用方式）。
// 用量：$env:STRIPE_SK='sk_live_…'; node tmp-stripe-probe-pm.js
'use strict';
const API = 'https://api.stripe.com/v1';
const PRICE = 'price_1UBeEADmkFYyemrtZgm7h9RM'; // Basic ONCE（live，单次付款列的真实价）
const CANDIDATES = ['card', 'grabpay', 'tng', 'duitnow', 'alipay', 'wechat_pay'];

async function main() {
  for (const m of CANDIDATES) {
    const body = new URLSearchParams({
      mode: 'payment',
      'line_items[0][price]': PRICE,
      'line_items[0][quantity]': '1',
      'payment_method_types[0]': m,
      success_url: 'https://mnationworld.com/pages/premium.html?paid=1',
      cancel_url: 'https://mnationworld.com/pages/premium.html?canceled=1'
    });
    const res = await fetch(API + '/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.STRIPE_SK, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    const j = await res.json().catch(() => ({}));
    const msg = res.ok ? 'OK' : (j.error && j.error.message ? j.error.message.slice(0, 160) : JSON.stringify(j).slice(0, 160));
    console.log(m + ' -> ' + res.status + ' ' + msg);
  }
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
