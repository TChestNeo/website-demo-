'use strict';
// 公网 auth 对等（v1 契约逐字段 + v2 增量）：email-code/verify/logout/me/PATCH/delete
// + 登录历史与风险信号（§5）+ 公网关键变更审计（§5）。

const test = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');
const { hashPassword } = require('../src/password');
const { createSession } = require('../src/middleware/auth');

async function getCode(a, email, purpose) {
  await a.request('POST', '/api/auth/email-code', { email, purpose });
  const mails = a.mails.filter((m) => m.opts && m.opts.purpose === (purpose || 'login'));
  return mails.at(-1).code;
}

test('email-code：防枚举恒 ok + 邮件桩记录（新邮箱 registered=false）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const res = await a.request('POST', '/api/auth/email-code', { email: 'new@example.com' });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.ttlMs, 10 * 60 * 1000);
  assert.strictEqual(body.resendMs, 60 * 1000);
  assert.strictEqual(a.mails.length, 1);
  assert.strictEqual(a.mails[0].opts.registered, false);
  assert.strictEqual(a.mails[0].opts.purpose, 'login');
});

test('email-code password_reset 目的：注册与否同款中性文案（防枚举不泄露、不误导）', async (t) => {
  // createMailer 的文案分支在 sendMail 前拼好 → 桩住 nodemailer.createTransport 捕获 mail 对象（测完还原）
  const nodemailer = require('nodemailer');
  const origCreateTransport = nodemailer.createTransport;
  const sent = [];
  nodemailer.createTransport = () => ({ sendMail: async (opts) => { sent.push(opts); return {}; } });
  t.after(() => { nodemailer.createTransport = origCreateTransport; });

  const { createMailer } = require('../src/email');
  const mailer = createMailer({
    mail: { smtp: { host: 'smtp.test', port: 465, secure: true, user: 'u', pass: 'p' }, from: 'M.NationWorld <test@gmail.com>' },
    adminEmail: 'a@b.c'
  });
  await mailer.sendCode('x@y.z', '123456', { purpose: 'password_reset', registered: true });
  await mailer.sendCode('x@y.z', '123456', { purpose: 'password_reset', registered: false });
  assert.strictEqual(sent.length, 2);
  assert.strictEqual(sent[0].subject, sent[1].subject); // 注册与否同款
  assert.strictEqual(sent[0].text, sent[1].text);
  assert.ok(!sent[0].subject.includes('欢迎'), '中性文案不含欢迎字样');
  assert.ok(!sent[0].text.includes('Welcome to M.NationWorld'), '中性文案不含注册欢迎句');
  assert.ok(sent[0].text.includes('123456'), '中性文案仍含验证码');
  // login 目的 registered=false 仍是欢迎文案（注册流程不受影响）
  await mailer.sendCode('x@y.z', '123456', { purpose: 'login', registered: false });
  assert.ok(sent[2].subject.includes('欢迎加入'), 'login 目的未注册仍欢迎文案');
});

test('email-code password_reset 目的：200 + 码行落库（012 放宽 CHECK 后）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const res = await a.request('POST', '/api/auth/email-code', { email: 'rp@example.com', purpose: 'password_reset' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(a.mails.at(-1).opts.purpose, 'password_reset');
  const row = a.db.prepare("SELECT purpose FROM email_codes WHERE email = 'rp@example.com'").get();
  assert.strictEqual(row.purpose, 'password_reset'); // INSERT 落库不被 CHECK 约束拒
});

test('verify-code/password-reset：password_reset 目的的码同样可验可消费', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedUser({ email: 'pr@example.com' });
  const code = await getCode(a, 'pr@example.com', 'password_reset');
  let res = await a.request('POST', '/api/auth/verify-code', { email: 'pr@example.com', code });
  assert.strictEqual(res.status, 200);
  res = await a.request('POST', '/api/auth/password-reset', { email: 'pr@example.com', code, newPassword: 'newpass123' });
  assert.strictEqual(res.status, 200);
});

test('email-code：60s 内重发 429', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  await a.request('POST', '/api/auth/email-code', { email: 'x@example.com' });
  const res = await a.request('POST', '/api/auth/email-code', { email: 'x@example.com' });
  assert.strictEqual(res.status, 429);
  assert.strictEqual((await res.json()).error.code, 'RATE_LIMITED');
});

test('verify：新邮箱建号 status=new + user 形状（camel）+ Set-Cookie mn_session', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const code = await getCode(a, 'new@example.com');
  const res = await a.request('POST', '/api/auth/verify', { email: 'new@example.com', code, displayName: 'Neo', password: 'password123' });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'new');
  assert.deepStrictEqual(Object.keys(body.user).sort(), [
    'avatarCrop', 'avatarFrame', 'avatarUrl', 'bannerCrop', 'bio', 'citizenId', 'country', 'createdAt',
    'displayName', 'dob', 'email', 'gender', 'hasPassword', 'id', 'language', 'role', 'status', 'student',
    'preferences', 'tier', 'tierExpiresAt', 'title', 'xpGained'
  ].sort());
  assert.strictEqual(body.user.gender, null); // 013：未填写 NULL
  assert.strictEqual(body.user.displayName, 'Neo');
  assert.strictEqual(body.user.xpGained, 0); // 023：新号获得类经验 0 起步
  assert.strictEqual(body.user.role, 'user'); // D4：role 恒 user
  assert.strictEqual(body.user.hasPassword, true); // W6：新注册强制带密码，无设密过渡
  assert.ok(!('passwordSetupRequired' in body));
  assert.ok(body.user.id.startsWith('USR-'));
  assert.ok(body.user.citizenId.startsWith('USR-'));
  assert.match(res.headers.get('set-cookie'), /^mn_session=.+; HttpOnly/);
  // 登录史 success 行（§5）
  const lh = a.db.prepare("SELECT * FROM login_history WHERE email = 'new@example.com' AND result = 'success'").get();
  assert.ok(lh, '登录史应有 success 行');
  assert.strictEqual(lh.actor_type, 'user');
  // 用户行 last_login_at/login_count 回写；password_hash 已落库
  const u = a.db.prepare("SELECT * FROM users WHERE email = 'new@example.com'").get();
  assert.strictEqual(u.login_count, 1);
  assert.ok(u.last_login_at);
  assert.ok(u.password_hash);
});

test('verify：已有账号 status=login', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedUser({ email: 'old@example.com' });
  const code = await getCode(a, 'old@example.com');
  const res = await a.request('POST', '/api/auth/verify', { email: 'old@example.com', code });
  const body = await res.json();
  assert.strictEqual(body.status, 'login');
  // W6：旧账号（password_hash NULL）仅码登录 + passwordSetupRequired 引导设密
  assert.strictEqual(body.passwordSetupRequired, true);
  assert.strictEqual(body.user.hasPassword, false);
});

test('verify：新号无密码/短密码 400（裸 API 不能造无密码号）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const code = await getCode(a, 'nopw@example.com');
  let res = await a.request('POST', '/api/auth/verify', { email: 'nopw@example.com', code, displayName: 'X' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual((await res.json()).error.code, 'VALIDATION');
  res = await a.request('POST', '/api/auth/verify', { email: 'nopw@example.com', code, displayName: 'X', password: 'short' });
  assert.strictEqual(res.status, 400);
  // 两次 400 均未消费码、未建号：同码补合格密码成功
  res = await a.request('POST', '/api/auth/verify', { email: 'nopw@example.com', code, displayName: 'X', password: 'password123' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).status, 'new');
});

test('verify：密码错不消费码，同码改对重试成功', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedUser({ email: 'pw@example.com', passwordHash: await hashPassword('password123') });
  const code = await getCode(a, 'pw@example.com');
  let res = await a.request('POST', '/api/auth/verify', { email: 'pw@example.com', code, password: 'wrongpass1' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual((await res.json()).error.message, '密码或验证码错误');
  // 码未消费、attempts +1
  const row = a.db.prepare("SELECT * FROM email_codes WHERE email = 'pw@example.com'").get();
  assert.strictEqual(row.consumed_at, null);
  assert.strictEqual(row.attempts, 1);
  res = await a.request('POST', '/api/auth/verify', { email: 'pw@example.com', code, password: 'password123' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).user.hasPassword, true);
});

test('verify：密码连错 5 次锁码 + 登录失败史（错密码与错码共用计数器）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedUser({ email: 'pwlock@example.com', passwordHash: await hashPassword('password123') });
  const code = await getCode(a, 'pwlock@example.com');
  for (let i = 0; i < 4; i++) {
    const r = await a.request('POST', '/api/auth/verify', { email: 'pwlock@example.com', code, password: 'wrongpass1' });
    assert.strictEqual(r.status, 400);
  }
  const r5 = await a.request('POST', '/api/auth/verify', { email: 'pwlock@example.com', code, password: 'wrongpass1' });
  assert.strictEqual(r5.status, 400);
  assert.ok(a.db.prepare("SELECT 1 FROM login_history WHERE email = 'pwlock@example.com' AND result = 'failed'").get());
  // 锁后即使密码正确也 400（码已锁）
  const r6 = await a.request('POST', '/api/auth/verify', { email: 'pwlock@example.com', code, password: 'password123' });
  assert.strictEqual(r6.status, 400);
});

test('verify：错码 400 VALIDATION；连错 5 次锁定并记登录失败史', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedUser({ email: 'locked@example.com' });
  const code = await getCode(a, 'locked@example.com');
  for (let i = 0; i < 4; i++) {
    const r = await a.request('POST', '/api/auth/verify', { email: 'locked@example.com', code: '000000' });
    assert.strictEqual(r.status, 400);
  }
  // 第 5 次错 → 锁定 + failed 登录史
  const r5 = await a.request('POST', '/api/auth/verify', { email: 'locked@example.com', code: '000000' });
  assert.strictEqual(r5.status, 400);
  assert.ok(a.db.prepare("SELECT 1 FROM login_history WHERE email = 'locked@example.com' AND result = 'failed'").get());
  // 此后即使真码也 400（锁定）
  const r6 = await a.request('POST', '/api/auth/verify', { email: 'locked@example.com', code });
  assert.strictEqual(r6.status, 400);
});

test('DEV_LOGIN_CODE：dev 环境仅登录已有账号；production 双重拒绝', async (t) => {
  const a = await testApp({ config: { nodeEnv: 'development', devLoginCode: '888888' } });
  t.after(() => a.close());
  a.seedUser({ email: 'dev@example.com' });
  let res = await a.request('POST', '/api/auth/verify', { email: 'dev@example.com', code: '888888' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).status, 'login');
  // 不存在的邮箱与普通错码一致
  res = await a.request('POST', '/api/auth/verify', { email: 'ghost@example.com', code: '888888' });
  assert.strictEqual(res.status, 400);
  // production 剥离
  const b = await testApp({ config: { nodeEnv: 'production', devLoginCode: '888888' } });
  t.after(() => b.close());
  b.seedUser({ email: 'dev2@example.com' });
  res = await b.request('POST', '/api/auth/verify', { email: 'dev2@example.com', code: '888888' });
  assert.strictEqual(res.status, 400);
});

test('verify：封禁 403 + 登录史 banned 行', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedUser({ email: 'bad@example.com', status: 'banned' });
  const code = await getCode(a, 'bad@example.com');
  const res = await a.request('POST', '/api/auth/verify', { email: 'bad@example.com', code });
  assert.strictEqual(res.status, 403);
  assert.strictEqual((await res.json()).error.code, 'ACCOUNT_BANNED');
  assert.ok(a.db.prepare("SELECT 1 FROM login_history WHERE email = 'bad@example.com' AND result = 'banned'").get());
});

test('delete：delete_confirm 需会话；删号 30 天后悔期；再登录恢复', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const { user, cookie } = a.loginAs('bye@example.com');
  // 无会话发 delete_confirm 码 → 401
  let res = await a.request('POST', '/api/auth/email-code', { email: 'bye@example.com', purpose: 'delete_confirm' });
  assert.strictEqual(res.status, 401);
  // 有会话（邮箱强制取当前用户，随便填也按会话用户发）
  await a.request('POST', '/api/auth/email-code', { email: 'other@x.y', purpose: 'delete_confirm' }, { cookie });
  const code = a.mails.filter((m) => m.opts && m.opts.purpose === 'delete_confirm').at(-1).code;
  res = await a.request('POST', '/api/auth/delete', { code }, { cookie });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.ok(body.restoreBy);
  assert.strictEqual(a.db.prepare('SELECT status FROM users WHERE id = ?').get(user.id).status, 'delete_pending');
  // 审计：account_delete_request（公网关键变更）
  assert.ok(a.db.prepare("SELECT 1 FROM audit_log WHERE action = 'account_delete_request'").get());
  // 再登录 = 恢复（delete_confirm 码与 login 码共用按邮箱计 60s 重发窗口，清桶模拟时间流逝）
  a.db.prepare("DELETE FROM rate_limits WHERE bucket = 'ec:email:bye@example.com'").run();
  const code2 = await getCode(a, 'bye@example.com');
  res = await a.request('POST', '/api/auth/verify', { email: 'bye@example.com', code: code2 });
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).restored, true);
});

test('password：设密清其他会话保当前；此后登录必须密码+码；password_change 事件+审计', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const { user, cookie } = a.loginAs('set@example.com');
  const otherToken = createSession(a.db, user.id, 30 * 24 * 3600 * 1000);
  // 策略：短密码 400（路由层）
  let res = await a.request('POST', '/api/auth/password', { newPassword: 'short' }, { cookie });
  assert.strictEqual(res.status, 400);
  res = await a.request('POST', '/api/auth/password', { newPassword: 'password123' }, { cookie });
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).user.hasPassword, true);
  // 其他会话失效、当前会话无缝保留
  assert.strictEqual((await a.request('GET', '/api/auth/me', undefined, { cookie: 'mn_session=' + otherToken })).status, 401);
  assert.strictEqual((await a.request('GET', '/api/auth/me', undefined, { cookie })).status, 200);
  // security_events password_change + 审计
  assert.ok(a.db.prepare("SELECT 1 FROM security_events WHERE event_type = 'password_change' AND actor_id = ?").get(user.id));
  assert.ok(a.db.prepare("SELECT 1 FROM audit_log WHERE action = 'user_password_change'").get());
  // 此后无密码 400、密码+码 200（旧账号过渡期结束）
  const code = await getCode(a, 'set@example.com');
  assert.strictEqual((await a.request('POST', '/api/auth/verify', { email: 'set@example.com', code })).status, 400);
  assert.strictEqual((await a.request('POST', '/api/auth/verify', { email: 'set@example.com', code, password: 'password123' })).status, 200);
});

test('password-reset：成功重置 → 清全部会话、旧密码失效、新密码可登、account_recovery 事件', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const { user, cookie } = a.loginAs('reset@example.com', { passwordHash: await hashPassword('oldpass123') });
  const code = await getCode(a, 'reset@example.com');
  const res = await a.request('POST', '/api/auth/password-reset', { email: 'reset@example.com', code, newPassword: 'newpass123' });
  assert.strictEqual(res.status, 200);
  // 全部会话失效（强制重登）
  assert.strictEqual(a.db.prepare('SELECT count(*) AS n FROM user_sessions WHERE user_id = ?').get(user.id).n, 0);
  assert.strictEqual((await a.request('GET', '/api/auth/me', undefined, { cookie })).status, 401);
  // 事件 + 审计
  assert.ok(a.db.prepare("SELECT 1 FROM security_events WHERE event_type = 'account_recovery' AND actor_id = ?").get(user.id));
  assert.ok(a.db.prepare("SELECT 1 FROM audit_log WHERE action = 'user_password_reset'").get());
  // 旧密码失效、新密码可登（清桶模拟 60s 重发窗口）
  a.db.prepare("DELETE FROM rate_limits WHERE bucket = 'ec:email:reset@example.com'").run();
  const code2 = await getCode(a, 'reset@example.com');
  assert.strictEqual((await a.request('POST', '/api/auth/verify', { email: 'reset@example.com', code: code2, password: 'oldpass123' })).status, 400);
  assert.strictEqual((await a.request('POST', '/api/auth/verify', { email: 'reset@example.com', code: code2, password: 'newpass123' })).status, 200);
});

test('password-reset：策略失败不消费码 + 防枚举（不存在/错码同款 400）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedUser({ email: 'rz@example.com', passwordHash: await hashPassword('oldpass123') });
  const code = await getCode(a, 'rz@example.com');
  // 短密码 → 400 且码不消费
  let res = await a.request('POST', '/api/auth/password-reset', { email: 'rz@example.com', code, newPassword: 'short' });
  assert.strictEqual(res.status, 400);
  const row = a.db.prepare("SELECT * FROM email_codes WHERE email = 'rz@example.com'").get();
  assert.strictEqual(row.consumed_at, null);
  // 同码合格密码成功（证明未消费）
  res = await a.request('POST', '/api/auth/password-reset', { email: 'rz@example.com', code, newPassword: 'newpass123' });
  assert.strictEqual(res.status, 200);
  // 防枚举：不存在的邮箱——重置与错码同款 400、码不消费
  const ghostCode = await getCode(a, 'ghost-rz@example.com');
  let bad = await a.request('POST', '/api/auth/password-reset', { email: 'ghost-rz@example.com', code: '000000', newPassword: 'newpass123' });
  assert.strictEqual(bad.status, 400);
  assert.strictEqual((await bad.json()).error.message, '验证码无效或已过期');
  bad = await a.request('POST', '/api/auth/password-reset', { email: 'ghost-rz@example.com', code: ghostCode, newPassword: 'newpass123' });
  assert.strictEqual(bad.status, 400);
  assert.strictEqual((await bad.json()).error.message, '验证码无效或已过期');
  assert.strictEqual(a.db.prepare("SELECT consumed_at FROM email_codes WHERE email = 'ghost-rz@example.com'").get().consumed_at, null);
});

test('verify-code：正确码 200 且不消费码（同码 password-reset 仍可走通）；无码邮箱同款 400', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedUser({ email: 'vz@example.com', passwordHash: await hashPassword('oldpass123') });
  const code = await getCode(a, 'vz@example.com');
  // 正确码 → 200 且码不消费
  let res = await a.request('POST', '/api/auth/verify-code', { email: 'vz@example.com', code });
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).ok, true);
  assert.strictEqual(a.db.prepare("SELECT consumed_at FROM email_codes WHERE email = 'vz@example.com'").get().consumed_at, null);
  // 同码最终 password-reset 仍可走通（验码不占码）
  res = await a.request('POST', '/api/auth/password-reset', { email: 'vz@example.com', code, newPassword: 'newpass123' });
  assert.strictEqual(res.status, 200);
  // 防枚举：从未发码的邮箱 → 同款 400
  res = await a.request('POST', '/api/auth/verify-code', { email: 'never-vz@example.com', code: '000000' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual((await res.json()).error.message, '验证码无效或已过期');
});

test('verify-code：错码计入共享 5 次锁（锁满后正确码 verify-code/password-reset 同拒）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedUser({ email: 'vl@example.com', passwordHash: await hashPassword('oldpass123') });
  const code = await getCode(a, 'vl@example.com');
  for (let i = 0; i < 5; i++) {
    const r = await a.request('POST', '/api/auth/verify-code', { email: 'vl@example.com', code: '000000' });
    assert.strictEqual(r.status, 400);
    assert.strictEqual((await r.json()).error.message, '验证码无效或已过期');
  }
  // 锁满：正确码 verify-code 也拒（共享锁，输入段错码消耗预算）
  let r = await a.request('POST', '/api/auth/verify-code', { email: 'vl@example.com', code });
  assert.strictEqual(r.status, 400);
  // password-reset 同步拒（同一锁）
  r = await a.request('POST', '/api/auth/password-reset', { email: 'vl@example.com', code, newPassword: 'newpass123' });
  assert.strictEqual(r.status, 400);
  // 码仍未被消费（锁满不消费）
  assert.strictEqual(a.db.prepare("SELECT consumed_at FROM email_codes WHERE email = 'vl@example.com'").get().consumed_at, null);
});

test('me：无会话 401；有会话返回 user（含订阅降级惰性检查）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  assert.strictEqual((await a.request('GET', '/api/auth/me')).status, 401);
  const { cookie } = a.loginAs('me@example.com');
  const res = await a.request('GET', '/api/auth/me', undefined, { cookie });
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).user.email, 'me@example.com');
});

test('tier 到期惰性降级：登录即降 free + 审计 tier_expire', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedUser({ email: 'tier@example.com', tier: 'premium' });
  a.db.prepare("UPDATE users SET tier_expires_at = ? WHERE email = 'tier@example.com'")
    .run(new Date(Date.now() - 1000).toISOString());
  const code = await getCode(a, 'tier@example.com');
  const res = await a.request('POST', '/api/auth/verify', { email: 'tier@example.com', code });
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).user.tier, 'free');
  assert.ok(a.db.prepare("SELECT 1 FROM audit_log WHERE action = 'tier_expire' AND actor_type = 'system'").get());
});

test('PATCH me：更新资料 + profile_update 审计（prev/next 差异）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const { cookie } = a.loginAs('patch@example.com');
  const res = await a.request('PATCH', '/api/auth/me', {
    displayName: '新名字', bio: 'hi', language: 'zh', country: 'Malaysia', dob: '1990-01-01'
  }, { cookie });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.user.displayName, '新名字');
  assert.strictEqual(body.user.bio, 'hi');
  assert.strictEqual(body.user.language, 'zh');
  assert.strictEqual(body.user.country, 'Malaysia');
  assert.strictEqual(body.user.dob, '1990-01-01');
  const row = a.db.prepare("SELECT * FROM audit_log WHERE action = 'profile_update'").get();
  assert.ok(row, 'PATCH me 应审计');
  const prev = JSON.parse(row.prev_value);
  assert.strictEqual(prev.displayName, 'patch');
  assert.strictEqual(JSON.parse(row.new_value).displayName, '新名字');
  // dob 年龄校验
  const bad = await a.request('PATCH', '/api/auth/me', { dob: '2020-01-01' }, { cookie });
  assert.strictEqual(bad.status, 400);
  // gender（013）：合法值入库 + 审计 next 含 gender；非法值 400
  const g = await a.request('PATCH', '/api/auth/me', { gender: 'Female' }, { cookie });
  assert.strictEqual(g.status, 200);
  assert.strictEqual((await g.json()).user.gender, 'Female');
  assert.strictEqual(a.db.prepare("SELECT gender FROM users WHERE email = 'patch@example.com'").get().gender, 'Female');
  const gAudit = a.db.prepare("SELECT * FROM audit_log WHERE action = 'profile_update' ORDER BY seq DESC LIMIT 1").get();
  assert.strictEqual(JSON.parse(gAudit.new_value).gender, 'Female');
  const badG = await a.request('PATCH', '/api/auth/me', { gender: 'Helicopter' }, { cookie });
  assert.strictEqual(badG.status, 400);
});

test('PATCH me：账号偏好跨设备持久化、增量合并并拒绝未知键', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const { cookie } = a.loginAs('preferences@example.com');

  let res = await a.request('PATCH', '/api/auth/me', {
    preferences: { allow_dm: false, reduce_motion: true, audience: 'followers', 'topic_科技': true }
  }, { cookie });
  assert.strictEqual(res.status, 200);
  let user = (await res.json()).user;
  assert.deepStrictEqual(user.preferences, {
    allow_dm: false, reduce_motion: true, audience: 'followers', 'topic_科技': true
  });

  res = await a.request('PATCH', '/api/auth/me', {
    preferences: { allow_dm: true }
  }, { cookie });
  assert.strictEqual(res.status, 200);
  user = (await res.json()).user;
  assert.strictEqual(user.preferences.allow_dm, true);
  assert.strictEqual(user.preferences.reduce_motion, true, '增量更新不能覆盖其他设备偏好');
  assert.strictEqual((await (await a.request('GET', '/api/auth/me', undefined, { cookie })).json()).user.preferences.audience, 'followers');

  assert.strictEqual((await a.request('PATCH', '/api/auth/me', {
    preferences: { allow_dm: 'yes' }
  }, { cookie })).status, 400);
  assert.strictEqual((await a.request('PATCH', '/api/auth/me', {
    preferences: { admin_mode: true }
  }, { cookie })).status, 400);
  assert.strictEqual((await a.request('PATCH', '/api/auth/me', {
    preferences: { audience: 'everyone' }
  }, { cookie })).status, 400);
});

test('logout：清 cookie + 幂等（无会话也 200）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const res = await a.request('POST', '/api/auth/logout');
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
});
