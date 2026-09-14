'use strict';
// 学生认证 + 学生价 checkout（v0.2.44.0，A 方案学校邮箱验证码）：
//   发码白名单/独立限流桶/5 次错码锁/消费码/四列落库/audit、365 天过期惰性清除、
//   status 的 student/studentPrice、checkout 学生守卫链 + 学生 Price ID + promo_id。
// 迁移 021 的结构断言在 migrations.test.js（user_version=21 + 四列 + email_codes 新枚举）。
// fetchImpl 桩记录 Stripe 请求——绝不接真实网络。

const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

// ── 桩：Stripe checkout 假会话（同 subscriptions.test.js 模式，只记录形状）──
function stripeStub() {
  const calls = [];
  let n = 0;
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    if (url.indexOf('/checkout/sessions') > -1) {
      const id = 'cs_test_' + (++n);
      return { ok: true, status: 200, json: async () => ({ id, url: 'https://checkout.stripe.com/c/pay/' + id }) };
    }
    throw new Error('unexpected stripe call ' + url);
  };
  return { calls, fetchImpl };
}

const PRICES = { basic: 'price_basic', premium: 'price_premium', ultra: 'price_ultra', 'pkg-premium': 'price_pkg_premium', 'pkg-ultra': 'price_pkg_ultra' };
const PRICES_ONCE = { basic: 'price_basic_once', premium: 'price_premium_once', ultra: 'price_ultra_once', 'pkg-premium': 'price_pkg_premium_once', 'pkg-ultra': 'price_pkg_ultra_once' };
function stuConfig(over = {}) {
  return {
    stripe: {
      enabled: true, secretKey: 'sk_test_x', webhookSecret: 'whsec_test',
      paymentMethods: ['card'], oncePaymentMethods: ['card', 'grabpay'],
      returnOrigin: '',
      prices: { ...PRICES }, pricesOnce: { ...PRICES_ONCE },
      studentPrices: { basic: 'price_stu_basic' },        // RM5.50 月付（用户 Stripe 建）
      studentPricesOnce: { basic: 'price_stu_basic_once' }, // RM55 年付
      catalog: { usd: { basic: { sub: 'p_usd_basic', once: 'p_usd_basic_once' } } },
      ...over
    },
    // 学生认证（ttl 365 天）；domains 空数组 → students.js DEFAULT_DOMAINS
    student: { ttlMs: 365 * 24 * 3600 * 1000, domains: [] },
    // 独立限流桶收窄值（与 student-verify.js 兜底同值）；checkout 放宽防多调用撞限
    rateLimits: {
      studentCodeEmail: { max: 1, windowMs: 60000 },
      studentCodeIp: { max: 5, windowMs: 3600000 },
      studentVerifyIp: { max: 10, windowMs: 60000 },
      checkout: { max: 20, windowMs: 60000 }
    }
  };
}

// 全流程快捷路径：发码（读邮件桩取码）→ 验证 → 返回 verify 响应体
async function verifyStudent(t, cookie, email) {
  const s = await t.request('POST', '/api/student-verify/email-code', { email }, { cookie });
  assert.strictEqual(s.status, 200, '发码应成功: ' + email);
  const code = t.mails[t.mails.length - 1].code;
  const v = await t.request('POST', '/api/student-verify/verify', { email, code }, { cookie });
  assert.strictEqual(v.status, 200, '验证应成功');
  return v.json();
}

// ── 发码 ──
test('email-code：无会话 401 / 坏邮箱 400 / 白名单外 gmail → 400 STUDENT_EMAIL_DOMAIN 零码零邮件', async () => {
  const t = await testApp({ config: stuConfig() });
  try {
    assert.strictEqual((await t.request('POST', '/api/student-verify/email-code', { email: 's@monash.edu.my' })).status, 401);
    const alice = t.loginAs('alice@x.com');
    assert.strictEqual((await t.request('POST', '/api/student-verify/email-code', { email: 'not-an-email' }, { cookie: alice.cookie })).status, 400);

    const r = await t.request('POST', '/api/student-verify/email-code', { email: 's@gmail.com' }, { cookie: alice.cookie });
    assert.strictEqual(r.status, 400);
    assert.strictEqual((await r.json()).error.code, 'STUDENT_EMAIL_DOMAIN');
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM email_codes').get().n, 0, '白名单拒绝不落码');
    assert.strictEqual(t.mails.length, 0, '白名单拒绝零邮件');
  } finally { await t.close(); }
});

test('email-code：白名单邮箱 → ok + 码行落库（purpose student_verify）+ 同邮箱 60s 内重发 429', async () => {
  const t = await testApp({ config: stuConfig() });
  try {
    const alice = t.loginAs('alice@x.com');
    const d = await (await t.request('POST', '/api/student-verify/email-code', { email: 'S@Student.Monash.EDU.MY' }, { cookie: alice.cookie })).json();
    assert.strictEqual(d.ok, true);
    assert.strictEqual(d.resendMs, 60000);
    assert.strictEqual(t.mails.length, 1);
    assert.strictEqual(t.mails[0].email, 's@student.monash.edu.my'); // normalizeEmail 小写
    assert.strictEqual(t.mails[0].opts.purpose, 'student_verify');
    const row = t.db.prepare("SELECT * FROM email_codes WHERE purpose = 'student_verify'").get();
    assert.ok(row, '码行落库');
    assert.strictEqual(row.actor_type, 'user');
    assert.strictEqual(row.consumed_at, null);

    const r2 = await t.request('POST', '/api/student-verify/email-code', { email: 's@student.monash.edu.my' }, { cookie: alice.cookie });
    assert.strictEqual(r2.status, 429, '同邮箱 60s 重发限流');
    assert.strictEqual(t.mails.length, 1, '重发被限零新邮件');
  } finally { await t.close(); }
});

test('域边界：evil.edu.my.evil.com / myedu.com / notedu.my 不被默认白名单误配', async () => {
  const t = await testApp({ config: stuConfig() });
  try {
    const alice = t.loginAs('alice@x.com');
    for (const email of ['x@evil.edu.my.evil.com', 'x@myedu.com', 'x@notedu.my', 'x@edu.com.cn', 'x@uni.edu.evil']) {
      const r = await t.request('POST', '/api/student-verify/email-code', { email }, { cookie: alice.cookie });
      assert.strictEqual(r.status, 400, email + ' 应被拒');
      assert.strictEqual((await r.json()).error.code, 'STUDENT_EMAIL_DOMAIN', email + ' 错误码');
    }
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM email_codes').get().n, 0);
  } finally { await t.close(); }
});

test('env 白名单覆盖：STUDENT_EMAIL_DOMAINS=.unimas.my → 默认 .edu.my 被拒、unimas.my 通过', async () => {
  const t = await testApp({ config: { ...stuConfig(), student: { ttlMs: 365 * 24 * 3600 * 1000, domains: ['.unimas.my'] } } });
  try {
    const alice = t.loginAs('alice@x.com');
    const r = await t.request('POST', '/api/student-verify/email-code', { email: 's@monash.edu.my' }, { cookie: alice.cookie });
    assert.strictEqual(r.status, 400, 'env 覆盖后默认域不再放行');
    const d = await (await t.request('POST', '/api/student-verify/email-code', { email: 's@unimas.my' }, { cookie: alice.cookie })).json();
    assert.strictEqual(d.ok, true);
  } finally { await t.close(); }
});

// ── 验证 ──
test('verify：错码 ×5 锁满（第 6 次正码同款 400）且码未消费', async () => {
  const t = await testApp({ config: stuConfig() });
  try {
    const alice = t.loginAs('alice@x.com');
    await t.request('POST', '/api/student-verify/email-code', { email: 's@unimas.edu.my' }, { cookie: alice.cookie });
    const code = t.mails[0].code;
    const bad = code === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) {
      const r = await t.request('POST', '/api/student-verify/verify', { email: 's@unimas.edu.my', code: bad }, { cookie: alice.cookie });
      assert.strictEqual(r.status, 400);
      assert.strictEqual((await r.json()).error.code, 'VALIDATION');
    }
    const r6 = await t.request('POST', '/api/student-verify/verify', { email: 's@unimas.edu.my', code }, { cookie: alice.cookie });
    assert.strictEqual(r6.status, 400, '锁满后正码同款中性响应');
    const row = t.db.prepare("SELECT * FROM email_codes WHERE purpose = 'student_verify'").get();
    assert.strictEqual(row.attempts, 5);
    assert.strictEqual(row.consumed_at, null);
    assert.strictEqual(t.db.prepare('SELECT student_email FROM users WHERE id = ?').get(alice.user.id).student_email, null);
  } finally { await t.close(); }
});

test('verify：成功 → 四列落库 + 码消费 + audit + 响应 student 形状（expires≈now+365d）', async () => {
  const t = await testApp({ config: stuConfig() });
  try {
    const alice = t.loginAs('alice@x.com');
    const before = Date.now();
    const d = await verifyStudent(t, alice.cookie, 's@monash.edu.my');
    assert.strictEqual(d.ok, true);
    assert.strictEqual(d.student.email, 's@monash.edu.my');
    assert.strictEqual(d.student.source, 'email_code');
    assert.ok(Math.abs(Date.now() - new Date(d.student.verifiedAt).getTime()) < 120000, 'verifiedAt 为当下时间');
    assert.ok(Math.abs(new Date(d.student.expiresAt).getTime() - (before + 365 * 24 * 3600 * 1000)) < 120000, '365 天有效期');

    const row = t.db.prepare('SELECT * FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(row.student_email, 's@monash.edu.my');
    assert.strictEqual(row.student_source, 'email_code');
    assert.ok(new Date(row.student_expires_at).getTime() > before + 364 * 24 * 3600 * 1000);
    const c = t.db.prepare("SELECT * FROM email_codes WHERE purpose = 'student_verify'").get();
    assert.ok(c.consumed_at, '码已消费');

    const a = t.db.prepare("SELECT * FROM audit_log WHERE action = 'student_verify' ORDER BY seq DESC LIMIT 1").get();
    assert.ok(a, 'audit 落库');
    assert.strictEqual(a.actor_type, 'system'); // audit_log CHECK 不收 user——自助操作记 system + 用户 id
    assert.strictEqual(a.actor_id, alice.user.id);
    assert.strictEqual(a.target_id, alice.user.id);
    assert.strictEqual(a.reason, 'via:email_code');
  } finally { await t.close(); }
});

test('verify：再次认证另一邮箱 → 四列覆盖替换', async () => {
  const t = await testApp({ config: stuConfig() });
  try {
    const alice = t.loginAs('alice@x.com');
    await verifyStudent(t, alice.cookie, 's@monash.edu.my');
    const d2 = await verifyStudent(t, alice.cookie, 's@utm.edu.my');
    assert.strictEqual(d2.student.email, 's@utm.edu.my');
    const row = t.db.prepare('SELECT * FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(row.student_email, 's@utm.edu.my');
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM email_codes WHERE purpose = 'student_verify'").get().n, 2, '两次发码两行');
  } finally { await t.close(); }
});

// ── 过期惰性清除 ──
test('过期惰性清除：过期学生态 → /auth/me 与 status 都返回 student:null 且库四列清空；有效期内原样', async () => {
  const t = await testApp({ config: stuConfig() });
  try {
    const alice = t.loginAs('alice@x.com');
    const past = new Date(Date.now() - 1000).toISOString();
    t.db.prepare("UPDATE users SET student_email = 's@monash.edu.my', student_verified_at = ?, student_expires_at = ?, student_source = 'email_code' WHERE id = ?")
      .run(past, past, alice.user.id);
    const d = await (await t.request('GET', '/api/auth/me', undefined, { cookie: alice.cookie })).json();
    assert.strictEqual(d.user.student, null, '过期 → null');
    const st = await (await t.request('GET', '/api/subscription/status', undefined, { cookie: alice.cookie })).json();
    assert.strictEqual(st.student, null, 'status 路径同步惰性清');
    const row = t.db.prepare('SELECT * FROM users WHERE id = ?').get(alice.user.id);
    assert.strictEqual(row.student_email, null, '四列已清');

    // 有效期内原样返回（嵌套形状）
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    t.db.prepare("UPDATE users SET student_email = 's@monash.edu.my', student_verified_at = ?, student_expires_at = ?, student_source = 'email_code' WHERE id = ?")
      .run(now, future, alice.user.id);
    const d2 = await (await t.request('GET', '/api/auth/me', undefined, { cookie: alice.cookie })).json();
    assert.strictEqual(d2.user.student.email, 's@monash.edu.my');
    assert.strictEqual(d2.user.student.verifiedAt, now);
    assert.strictEqual(d2.user.student.expiresAt, future);
    assert.strictEqual(d2.user.student.source, 'email_code');
  } finally { await t.close(); }
});

// ── status ──
test('status：myr → studentPrice/studentHasOnce true；认证后 out.student 形状；非 myr → false', async () => {
  const t = await testApp({ config: stuConfig(), fetchImpl: stripeStub().fetchImpl });
  try {
    const anon = await (await t.request('GET', '/api/subscription/status')).json();
    assert.strictEqual(anon.studentPrice, true);
    assert.strictEqual(anon.studentHasOnce, true);
    assert.strictEqual(anon.student, undefined, '匿名无 student 字段');

    const alice = t.loginAs('alice@x.com');
    const d = await (await t.request('GET', '/api/subscription/status', undefined, { cookie: alice.cookie })).json();
    assert.strictEqual(d.student, null, '未认证 → null');
    assert.strictEqual(d.tier, 'free');

    await verifyStudent(t, alice.cookie, 's@monash.edu.my');
    const d2 = await (await t.request('GET', '/api/subscription/status', undefined, { cookie: alice.cookie })).json();
    assert.strictEqual(d2.student.email, 's@monash.edu.my');
    assert.strictEqual(d2.student.source, 'email_code');

    const usd = await (await t.request('GET', '/api/subscription/status?currency=usd', undefined, { cookie: alice.cookie })).json();
    assert.strictEqual(usd.studentPrice, false, '学生价仅 MYR');
    assert.strictEqual(usd.studentHasOnce, false);
  } finally { await t.close(); }
});

// ── checkout 守卫链 ──
test('checkout：student:true 未认证 → 403 STUDENT_REQUIRED；premium → 400；usd → 400（守卫零 payments 行）', async () => {
  const t = await testApp({ config: stuConfig(), fetchImpl: stripeStub().fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    const r = await t.request('POST', '/api/subscription/checkout', { tierKey: 'basic', student: true }, { cookie: alice.cookie });
    assert.strictEqual(r.status, 403);
    assert.strictEqual((await r.json()).error.code, 'STUDENT_REQUIRED');

    assert.strictEqual((await t.request('POST', '/api/subscription/checkout', { tierKey: 'premium', student: true }, { cookie: alice.cookie })).status, 400, '学生价仅 Basic');
    assert.strictEqual((await t.request('POST', '/api/subscription/checkout', { tierKey: 'basic', currency: 'usd', student: true }, { cookie: alice.cookie })).status, 400, '学生价仅 MYR');
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM payments').get().n, 0);
  } finally { await t.close(); }
});

test('checkout：已认证 student:true → 学生月付 Price + promo_id=student + metadata（普通购买 promo_id=null 回归）', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stuConfig(), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    await verifyStudent(t, alice.cookie, 's@monash.edu.my');
    const d = await (await t.request('POST', '/api/subscription/checkout', { tierKey: 'basic', student: true }, { cookie: alice.cookie })).json();
    assert.match(d.url, /^https:\/\/checkout\.stripe\.com\//);
    const row = t.db.prepare('SELECT * FROM payments WHERE user_id = ?').get(alice.user.id);
    assert.strictEqual(row.tier_key, 'basic');
    assert.strictEqual(row.promo_id, 'student');
    assert.strictEqual(row.status, 'pending');
    assert.strictEqual(row.months, 1);
    assert.strictEqual(row.currency, 'myr');
    const form = Object.fromEntries(new URLSearchParams(stub.calls[0].opts.body).entries());
    assert.strictEqual(form['line_items[0][price]'], 'price_stu_basic');
    assert.strictEqual(form['metadata[tier_key]'], 'basic');

    // 同用户普通购买（不带 student 旗）→ 常规 Price + promo_id null（回归）
    const d2 = await (await t.request('POST', '/api/subscription/checkout', { tierKey: 'basic' }, { cookie: alice.cookie })).json();
    assert.match(d2.url, /^https:\/\/checkout\.stripe\.com\//);
    const form2 = Object.fromEntries(new URLSearchParams(stub.calls[1].opts.body).entries());
    assert.strictEqual(form2['line_items[0][price]'], 'price_basic');
    const row2 = t.db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(alice.user.id);
    assert.strictEqual(row2.promo_id, null);
  } finally { await t.close(); }
});

test('checkout once：学生年付 Price + months=12 + promo_id=student', async () => {
  const stub = stripeStub();
  const t = await testApp({ config: stuConfig(), fetchImpl: stub.fetchImpl });
  try {
    const alice = t.loginAs('alice@x.com');
    await verifyStudent(t, alice.cookie, 's@monash.edu.my');
    const d = await (await t.request('POST', '/api/subscription/checkout', { tierKey: 'basic', mode: 'once', student: true }, { cookie: alice.cookie })).json();
    assert.match(d.url, /^https:\/\/checkout\.stripe\.com\//);
    const form = Object.fromEntries(new URLSearchParams(stub.calls[0].opts.body).entries());
    assert.strictEqual(form.mode, 'payment');
    assert.strictEqual(form['line_items[0][price]'], 'price_stu_basic_once');
    const row = t.db.prepare('SELECT * FROM payments WHERE user_id = ?').get(alice.user.id);
    assert.strictEqual(row.months, 12);
    assert.strictEqual(row.promo_id, 'student');
  } finally { await t.close(); }
});

test('checkout：缺学生 Price env → 学生购买 409 PAYMENTS_DISABLED（前端如实 toast）', async () => {
  const t = await testApp({
    config: stuConfig({ studentPrices: { basic: '' }, studentPricesOnce: { basic: '' } }),
    fetchImpl: stripeStub().fetchImpl
  });
  try {
    const alice = t.loginAs('alice@x.com');
    await verifyStudent(t, alice.cookie, 's@monash.edu.my');
    const r = await t.request('POST', '/api/subscription/checkout', { tierKey: 'basic', student: true }, { cookie: alice.cookie });
    assert.strictEqual(r.status, 409);
    assert.strictEqual((await r.json()).error.code, 'PAYMENTS_DISABLED');
  } finally { await t.close(); }
});
