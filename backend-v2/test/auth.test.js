'use strict';
// 公网 auth 对等（v1 契约逐字段 + v2 增量）：email-code/verify/logout/me/PATCH/delete
// + 登录历史与风险信号（§5）+ 公网关键变更审计（§5）。

const test = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

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
  const res = await a.request('POST', '/api/auth/verify', { email: 'new@example.com', code, displayName: 'Neo' });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'new');
  assert.deepStrictEqual(Object.keys(body.user).sort(), [
    'avatarUrl', 'citizenId', 'createdAt', 'displayName', 'email', 'id', 'role', 'status', 'tier', 'tierExpiresAt'
  ].sort());
  assert.strictEqual(body.user.displayName, 'Neo');
  assert.strictEqual(body.user.role, 'user'); // D4：role 恒 user
  assert.ok(body.user.id.startsWith('USR-'));
  assert.ok(body.user.citizenId.startsWith('CIT-'));
  assert.match(res.headers.get('set-cookie'), /^mn_session=.+; HttpOnly/);
  // 登录史 success 行（§5）
  const lh = a.db.prepare("SELECT * FROM login_history WHERE email = 'new@example.com' AND result = 'success'").get();
  assert.ok(lh, '登录史应有 success 行');
  assert.strictEqual(lh.actor_type, 'user');
  // 用户行 last_login_at/login_count 回写
  const u = a.db.prepare("SELECT * FROM users WHERE email = 'new@example.com'").get();
  assert.strictEqual(u.login_count, 1);
  assert.ok(u.last_login_at);
});

test('verify：已有账号 status=login', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.seedUser({ email: 'old@example.com' });
  const code = await getCode(a, 'old@example.com');
  const res = await a.request('POST', '/api/auth/verify', { email: 'old@example.com', code });
  const body = await res.json();
  assert.strictEqual(body.status, 'login');
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
  const res = await a.request('PATCH', '/api/auth/me', { displayName: '新名字', bio: 'hi' }, { cookie });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.user.displayName, '新名字');
  const row = a.db.prepare("SELECT * FROM audit_log WHERE action = 'profile_update'").get();
  assert.ok(row, 'PATCH me 应审计');
  const prev = JSON.parse(row.prev_value);
  assert.strictEqual(prev.displayName, 'patch');
  assert.strictEqual(JSON.parse(row.new_value).displayName, '新名字');
  // dob 年龄校验
  const bad = await a.request('PATCH', '/api/auth/me', { dob: '2020-01-01' }, { cookie });
  assert.strictEqual(bad.status, 400);
});

test('logout：清 cookie + 幂等（无会话也 200）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const res = await a.request('POST', '/api/auth/logout');
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
});
