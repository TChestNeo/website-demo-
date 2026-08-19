'use strict';
// Stripe 测试模式初始化（零 SDK）：给 sk_test → 建 4 个 Product + Price（recurring/monthly MYR）→ 打印 .env 配置行。
// 用法：node scripts/stripe-init.js <sk_test_xxx>
// 幂等：按 metadata[app]=mnworld + name 查已有 Product/Price，重复跑不重复建。
// 4 个价的金额是付费页口径（Overview.txt）：premium 23.50 / ultra 45.50 / pkg-premium 29.90 / pkg-ultra 60.90 MYR。

const key = process.argv[2];
if (!key || !key.startsWith('sk_')) {
  console.error('用法: node scripts/stripe-init.js <sk_test_xxx>');
  process.exit(1);
}

const API = 'https://api.stripe.com/v1';
const PLANS = [
  { key: 'premium', name: 'M.NationWorld Premium', amount: 23.50 },
  { key: 'ultra', name: 'M.NationWorld Premium Ultra', amount: 45.50 },
  { key: 'pkg-premium', name: 'M.NationWorld Premium + Team Pack', amount: 29.90 },
  { key: 'pkg-ultra', name: 'M.NationWorld Premium Ultra + Team Pack', amount: 60.90 }
];

async function call(method, path, form) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form ? new URLSearchParams(form).toString() : undefined
  });
  if (!res.ok) {
    console.error('Stripe API 失败', method, path, res.status, String(await res.text()).slice(0, 300));
    process.exit(1);
  }
  return res.json();
}

(async () => {
  // 已有 Product 全量拉一次（测试账号量小），按 metadata[app] 过滤
  const products = await call('GET', '/products?limit=100');
  const byName = new Map(products.data.map((p) => [p.name, p.id]));
  const env = {};
  for (const p of PLANS) {
    let prodId = byName.get(p.name);
    if (!prodId) {
      const prod = await call('POST', '/products', {
        name: p.name, 'metadata[app]': 'mnworld', 'metadata[sku]': p.key
      });
      prodId = prod.id;
      console.log('新建 Product:', p.key, '→', prodId);
    }
    // 已有月付价则复用，否则建
    const prices = await call('GET', '/prices?product=' + prodId + '&limit=10');
    let price = prices.data.find((x) => x.recurring && x.recurring.interval === 'month' && x.active);
    if (!price) {
      price = await call('POST', '/prices', {
        product: prodId,
        currency: 'myr',
        unit_amount: Math.round(p.amount * 100),
        'recurring[interval]': 'month'
      });
    }
    env[p.key] = price.id;
    console.log('Price 就绪:', p.key, '→', price.id, 'MYR', (price.unit_amount / 100).toFixed(2) + '/月');
  }

  console.log('\n── 粘贴进 backend/.env（.env 永不提交）──');
  console.log('STRIPE_ENABLED=true');
  console.log('STRIPE_SECRET_KEY=' + key);
  console.log('STRIPE_PRICE_PREMIUM=' + env.premium);
  console.log('STRIPE_PRICE_ULTRA=' + env.ultra);
  console.log('STRIPE_PRICE_PKG_PREMIUM=' + env['pkg-premium']);
  console.log('STRIPE_PRICE_PKG_ULTRA=' + env['pkg-ultra']);
  console.log('STRIPE_PAYMENT_METHODS=card,fpx');
  console.log('\n── webhook 密钥（本地测试）──');
  console.log('1. 装 Stripe CLI: https://stripe.com/docs/stripe-cli  （Windows: scoop install stripe / 或官网 exe）');
  console.log('2. 终端执行: stripe login');
  console.log('3. 终端执行: stripe listen --forward-to http://127.0.0.1:3000/api/webhooks/stripe');
  console.log('4. 把打印的 whsec_... 填: STRIPE_WEBHOOK_SECRET=<whsec_...>');
  console.log('\n── 然后 ──');
  console.log('重启后端 → 付费页 CTA 变「订阅 · RMxx/月」→ 点击直跳 Stripe 结账页');
  console.log('测试卡: 4242 4242 4242 4242（成功）/ 4000 0000 0000 0002（失败），任意未来有效期 + 任意 CVC');
  console.log('详细全链路与生产激活见 deploy/stripe-setup.md');
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
