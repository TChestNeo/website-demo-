// tmp-stripe-wh.js — 补建 webhook 端点（价格已建，勿重跑 provision 防重复）
'use strict';
const API = 'https://api.stripe.com/v1';
const EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.deleted'
];
async function main() {
  const body = new URLSearchParams();
  body.append('url', 'https://mnationworld.com/api/webhooks/stripe');
  body.append('description', 'M.NationWorld production webhook');
  EVENTS.forEach((e) => body.append('enabled_events[]', e));
  const res = await fetch(API + '/webhook_endpoints', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.STRIPE_SK, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { console.error('FATAL', res.status, JSON.stringify(j).slice(0, 400)); process.exit(1); }
  console.log('✅ webhook endpoint ' + j.id);
  console.log('⚠  STRIPE_WEBHOOK_SECRET=' + j.secret + '  （只显示这一次，立即抄走）');
}
main();
