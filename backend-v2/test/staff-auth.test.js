'use strict';
// Staff 登录（D2 sc_session / D3 /api/staff/* 前缀）：
// email-code 防枚举、verify 会话+形状、real_name 永不序列化（§17）、
// 停用拒绝、自改档案审计、DEV_LOGIN_CODE staff 分支、登出。

const test = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');
const { hashPassword } = require('../src/password');
const { createStaffSession } = require('../src/middleware/staff-auth');

async function getStaffCode(a, email) {
  await a.request('POST', '/api/staff/auth/email-code', { email });
  return a.mails.filter((m) => m.opts && m.opts.purpose === 'staff_login').at(-1).code;
}

test('staff email-code：防枚举恒 ok（无 staff 行同响应）+ 邮件桩 purpose=staff_login', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const res = await a.request('POST', '/api/staff/auth/email-code', { email: 'nobody@x.y' });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.ttlMs, 10 * 60 * 1000);
  assert.strictEqual(a.mails.length, 1);
  assert.strictEqual(a.mails[0].opts.purpose, 'staff_login');
  assert.strictEqual(a.mails[0].opts.registered, false);
});

test('staff verify：登录成功 → {staff, roles, permissions} + Set-Cookie sc_session', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedStaff({ email: 'alex@x.y', displayName: 'Alex' });
  const code = await getStaffCode(a, 'alex@x.y');
  const res = await a.request('POST', '/api/staff/auth/verify', { email: 'alex@x.y', code });
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('set-cookie'), /^sc_session=.+; HttpOnly/);
  const body = await res.json();
  assert.strictEqual(body.staff.displayName, 'Alex');
  assert.deepStrictEqual(body.roles, ['customer_support']);
  assert.ok(body.permissions.includes('cs.tickets.view'));
  assert.ok(!body.permissions.includes('finance.view'));
  // W6：旧 staff（password_hash NULL）仅码登录 + passwordSetupRequired 引导设密
  assert.strictEqual(body.staff.hasPassword, false);
  assert.strictEqual(body.passwordSetupRequired, true);
  // 登录史 staff success
  assert.ok(a.db.prepare("SELECT 1 FROM login_history WHERE actor_type = 'staff' AND result = 'success'").get());
});

test('staff verify：密码错不消费码，同码改对重试成功', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedStaff({ email: 'pw@x.y', passwordHash: await hashPassword('password123') });
  const code = await getStaffCode(a, 'pw@x.y');
  let res = await a.request('POST', '/api/staff/auth/verify', { email: 'pw@x.y', code, password: 'wrongpass1' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual((await res.json()).error.message, '密码或验证码错误');
  const row = a.db.prepare("SELECT * FROM email_codes WHERE email = 'pw@x.y'").get();
  assert.strictEqual(row.consumed_at, null);
  assert.strictEqual(row.attempts, 1);
  res = await a.request('POST', '/api/staff/auth/verify', { email: 'pw@x.y', code, password: 'password123' });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.staff.hasPassword, true);
  assert.ok(!('passwordSetupRequired' in body));
});

test('staff verify：密码连错 5 次锁码 + 登录失败史', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedStaff({ email: 'pwlock@x.y', passwordHash: await hashPassword('password123') });
  const code = await getStaffCode(a, 'pwlock@x.y');
  for (let i = 0; i < 4; i++) {
    const r = await a.request('POST', '/api/staff/auth/verify', { email: 'pwlock@x.y', code, password: 'wrongpass1' });
    assert.strictEqual(r.status, 400);
  }
  const r5 = await a.request('POST', '/api/staff/auth/verify', { email: 'pwlock@x.y', code, password: 'wrongpass1' });
  assert.strictEqual(r5.status, 400);
  assert.ok(a.db.prepare("SELECT 1 FROM login_history WHERE actor_type = 'staff' AND result = 'failed'").get());
  const r6 = await a.request('POST', '/api/staff/auth/verify', { email: 'pwlock@x.y', code, password: 'password123' });
  assert.strictEqual(r6.status, 400);
});

test('staff verify：无 staff 行 → 与错码同响应 + 登录史 no_user（防枚举但如实记录）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const code = await getStaffCode(a, 'ghost@x.y');
  const res = await a.request('POST', '/api/staff/auth/verify', { email: 'ghost@x.y', code });
  assert.strictEqual(res.status, 400);
  assert.strictEqual((await res.json()).error.code, 'VALIDATION');
  assert.ok(a.db.prepare("SELECT 1 FROM login_history WHERE result = 'no_user' AND actor_type = 'staff'").get());
});

test('real_name 永不序列化（§17 硬性）：verify/me 响应均无此键', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedStaff({ email: 'alex@x.y', displayName: 'Alex', realName: 'SECRET REAL NAME' });
  const code = await getStaffCode(a, 'alex@x.y');
  const res = await a.request('POST', '/api/staff/auth/verify', { email: 'alex@x.y', code });
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.ok(!JSON.stringify(body).includes('SECRET REAL NAME'));
  assert.strictEqual(body.staff.realName, undefined);
  const cookie = res.headers.get('set-cookie').split(';')[0];
  const me = await a.request('GET', '/api/staff/auth/me', undefined, { cookie });
  assert.ok(!(await me.text()).includes('SECRET REAL NAME'));
});

test('staff verify：停用 staff 403 FORBIDDEN + 登录史 failed', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedStaff({ email: 'off@x.y' });
  a.db.prepare("UPDATE staff SET is_active = 0 WHERE email = 'off@x.y'").run();
  const code = await getStaffCode(a, 'off@x.y');
  const res = await a.request('POST', '/api/staff/auth/verify', { email: 'off@x.y', code });
  assert.strictEqual(res.status, 403);
  assert.strictEqual((await res.json()).error.code, 'FORBIDDEN');
  assert.ok(a.db.prepare("SELECT 1 FROM login_history WHERE result = 'failed' AND actor_type = 'staff'").get());
});

test('staff me：未登录 401；登录返回 roles+permissions', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  assert.strictEqual((await a.request('GET', '/api/staff/auth/me')).status, 401);
  const { cookie } = a.loginStaffAs('alex@x.y', { displayName: 'Alex' });
  const res = await a.request('GET', '/api/staff/auth/me', undefined, { cookie });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.staff.displayName, 'Alex');
  assert.deepStrictEqual(body.roles, ['customer_support']);
});

test('staff me：无效会话 401', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const res = await a.request('GET', '/api/staff/auth/me', undefined, { cookie: 'sc_session=garbage' });
  assert.strictEqual(res.status, 401);
});

test('PATCH staff me：自改公开档案 + 审计；坏 workingHours 400', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const { cookie } = a.loginStaffAs('alex@x.y');
  const res = await a.request('PATCH', '/api/staff/auth/me', {
    displayName: 'Alex Chen', alias: '小A', workingHours: { start: '10:00', end: '19:00' }, languages: ['zh', 'ms']
  }, { cookie });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.staff.displayName, 'Alex Chen');
  assert.strictEqual(body.staff.workingHours.start, '10:00');
  assert.deepStrictEqual(body.staff.languages, ['zh', 'ms']);
  assert.ok(a.db.prepare("SELECT 1 FROM audit_log WHERE action = 'staff_profile_update'").get());
  const bad = await a.request('PATCH', '/api/staff/auth/me', { workingHours: { start: 'x' } }, { cookie });
  assert.strictEqual(bad.status, 400);
});

test('DEV_LOGIN_CODE：staff 分支 dev 仅已有 staff 行；production 剥离', async (t) => {
  const a = await testApp({ config: { nodeEnv: 'development', devLoginCode: '888888' } });
  t.after(() => a.close());
  a.seedStaff({ email: 'alex@x.y' });
  let res = await a.request('POST', '/api/staff/auth/verify', { email: 'alex@x.y', code: '888888' });
  assert.strictEqual(res.status, 200);
  res = await a.request('POST', '/api/staff/auth/verify', { email: 'ghost@x.y', code: '888888' });
  assert.strictEqual(res.status, 400);
  const b = await testApp({ config: { nodeEnv: 'production', devLoginCode: '888888' } });
  t.after(() => b.close());
  b.seedStaff({ email: 'alex@x.y' });
  res = await b.request('POST', '/api/staff/auth/verify', { email: 'alex@x.y', code: '888888' });
  assert.strictEqual(res.status, 400);
});

test('staff logout：清 cookie + 幂等', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const res = await a.request('POST', '/api/staff/auth/logout');
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('set-cookie'), /sc_session=;.*Max-Age=0/);
});

test('staff email-code：错码锁定（5 次后真码也 400）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedStaff({ email: 'alex@x.y' });
  const code = await getStaffCode(a, 'alex@x.y');
  for (let i = 0; i < 5; i++) {
    const r = await a.request('POST', '/api/staff/auth/verify', { email: 'alex@x.y', code: '000000' });
    assert.strictEqual(r.status, 400);
  }
  const r = await a.request('POST', '/api/staff/auth/verify', { email: 'alex@x.y', code });
  assert.strictEqual(r.status, 400);
});

test('staff password：设密清其他会话保当前；此后登录必须密码+码；password_change 事件+审计', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const { staff, cookie } = a.loginStaffAs('set@x.y');
  const otherToken = createStaffSession(a.db, staff.id, 30 * 24 * 3600 * 1000);
  // 策略：短密码 400（路由层）
  let res = await a.request('POST', '/api/staff/auth/password', { newPassword: 'short' }, { cookie });
  assert.strictEqual(res.status, 400);
  res = await a.request('POST', '/api/staff/auth/password', { newPassword: 'password123' }, { cookie });
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).staff.hasPassword, true);
  // 其他会话失效、当前会话无缝保留
  assert.strictEqual((await a.request('GET', '/api/staff/auth/me', undefined, { cookie: 'sc_session=' + otherToken })).status, 401);
  assert.strictEqual((await a.request('GET', '/api/staff/auth/me', undefined, { cookie })).status, 200);
  // security_events password_change + 审计 staff_password_change
  assert.ok(a.db.prepare("SELECT 1 FROM security_events WHERE event_type = 'password_change' AND actor_type = 'staff' AND actor_id = ?").get(staff.id));
  assert.ok(a.db.prepare("SELECT 1 FROM audit_log WHERE action = 'staff_password_change'").get());
  // 此后无密码 400、密码+码 200（旧 staff 过渡期结束）
  const code = await getStaffCode(a, 'set@x.y');
  assert.strictEqual((await a.request('POST', '/api/staff/auth/verify', { email: 'set@x.y', code })).status, 400);
  assert.strictEqual((await a.request('POST', '/api/staff/auth/verify', { email: 'set@x.y', code, password: 'password123' })).status, 200);
});

test('staff password-reset：成功重置 → 清全部会话、旧密码失效、新密码可登、account_recovery 事件+审计', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const { staff, cookie } = a.loginStaffAs('reset@x.y', { passwordHash: await hashPassword('oldpass123') });
  const code = await getStaffCode(a, 'reset@x.y');
  const res = await a.request('POST', '/api/staff/auth/password-reset', { email: 'reset@x.y', code, newPassword: 'newpass123' });
  assert.strictEqual(res.status, 200);
  // 全部会话失效（强制重登）
  assert.strictEqual(a.db.prepare('SELECT count(*) AS n FROM staff_sessions WHERE staff_id = ?').get(staff.id).n, 0);
  assert.strictEqual((await a.request('GET', '/api/staff/auth/me', undefined, { cookie })).status, 401);
  // 事件 + 审计
  assert.ok(a.db.prepare("SELECT 1 FROM security_events WHERE event_type = 'account_recovery' AND actor_type = 'staff' AND actor_id = ?").get(staff.id));
  assert.ok(a.db.prepare("SELECT 1 FROM audit_log WHERE action = 'staff_password_reset'").get());
  // 旧密码失效、新密码可登（清桶模拟 60s 重发窗口）
  a.db.prepare("DELETE FROM rate_limits WHERE bucket = 'ec:staff:reset@x.y'").run();
  const code2 = await getStaffCode(a, 'reset@x.y');
  assert.strictEqual((await a.request('POST', '/api/staff/auth/verify', { email: 'reset@x.y', code: code2, password: 'oldpass123' })).status, 400);
  assert.strictEqual((await a.request('POST', '/api/staff/auth/verify', { email: 'reset@x.y', code: code2, password: 'newpass123' })).status, 200);
});

test('staff password-reset：策略失败不消费码 + 防枚举（不存在/错码同款 400）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedStaff({ email: 'rz@x.y', passwordHash: await hashPassword('oldpass123') });
  const code = await getStaffCode(a, 'rz@x.y');
  // 短密码 → 400 且码不消费
  let res = await a.request('POST', '/api/staff/auth/password-reset', { email: 'rz@x.y', code, newPassword: 'short' });
  assert.strictEqual(res.status, 400);
  const row = a.db.prepare("SELECT * FROM email_codes WHERE email = 'rz@x.y'").get();
  assert.strictEqual(row.consumed_at, null);
  // 同码合格密码成功（证明未消费）
  res = await a.request('POST', '/api/staff/auth/password-reset', { email: 'rz@x.y', code, newPassword: 'newpass123' });
  assert.strictEqual(res.status, 200);
  // 防枚举：不存在的 staff 邮箱——重置与错码同款 400、码不消费
  const ghostCode = await getStaffCode(a, 'ghost-rz@x.y');
  let bad = await a.request('POST', '/api/staff/auth/password-reset', { email: 'ghost-rz@x.y', code: '000000', newPassword: 'newpass123' });
  assert.strictEqual(bad.status, 400);
  assert.strictEqual((await bad.json()).error.message, '验证码无效或已过期');
  bad = await a.request('POST', '/api/staff/auth/password-reset', { email: 'ghost-rz@x.y', code: ghostCode, newPassword: 'newpass123' });
  assert.strictEqual(bad.status, 400);
  assert.strictEqual((await bad.json()).error.message, '验证码无效或已过期');
  assert.strictEqual(a.db.prepare("SELECT consumed_at FROM email_codes WHERE email = 'ghost-rz@x.y'").get().consumed_at, null);
});
