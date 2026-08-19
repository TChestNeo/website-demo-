'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

// 从响应取 mn_session cookie（首个 set-cookie 头）
function cookieOf(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie()[0] : res.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : null; // 'mn_session=token'
}

async function sendCode(t, email) {
  await t.request('POST', '/api/auth/email-code', { email });
  return t.mails[t.mails.length - 1].code;
}

test('email-code：新邮箱发码 ok，邮件桩记录验证码且 registered=false（防枚举：接口响应一致）', async () => {
  const t = await testApp();
  try {
    const res = await t.request('POST', '/api/auth/email-code', { email: 'New@Example.com' });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual((await res.json()).ok, true);
    assert.strictEqual(t.mails.length, 1);
    assert.strictEqual(t.mails[0].email, 'new@example.com'); // 归一化小写
    assert.strictEqual(t.mails[0].opts.registered, false);
  } finally { await t.close(); }
});

test('email-code：邮箱格式非法 → 400 VALIDATION', async () => {
  const t = await testApp();
  try {
    const res = await t.request('POST', '/api/auth/email-code', { email: 'not-an-email' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual((await res.json()).error.code, 'VALIDATION');
  } finally { await t.close(); }
});

test('email-code：同邮箱 60s 内重发 → 429；换邮箱同 IP 不受影响', async () => {
  const t = await testApp();
  try {
    await t.request('POST', '/api/auth/email-code', { email: 'a@x.com' });
    const res = await t.request('POST', '/api/auth/email-code', { email: 'a@x.com' });
    assert.strictEqual(res.status, 429);
    assert.strictEqual((await res.json()).error.code, 'RATE_LIMITED');
    const res2 = await t.request('POST', '/api/auth/email-code', { email: 'b@x.com' });
    assert.strictEqual(res2.status, 200);
  } finally { await t.close(); }
});

test('email-code：同 IP 每小时 5 封封顶，第 6 封 429', async () => {
  const t = await testApp();
  try {
    for (let i = 0; i < 5; i++) {
      const res = await t.request('POST', '/api/auth/email-code', { email: `u${i}@x.com` });
      assert.strictEqual(res.status, 200);
    }
    const res = await t.request('POST', '/api/auth/email-code', { email: 'u9@x.com' });
    assert.strictEqual(res.status, 429);
  } finally { await t.close(); }
});

test('verify：新邮箱 → status new、CIT-/USR- 可读 ID、tier free（普通用户默认层）、cookie 可通 /me', async () => {
  const t = await testApp();
  try {
    const code = await sendCode(t, 'new@example.com');
    const res = await t.request('POST', '/api/auth/verify', { email: 'new@example.com', code, displayName: 'Ada' });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'new');
    assert.match(data.user.id, /^USR-\d{6}$/);
    assert.match(data.user.citizenId, /^CIT-\d{6}$/);
    assert.strictEqual(data.user.displayName, 'Ada');
    assert.strictEqual(data.user.tier, 'free');
    assert.ok(data.user.avatarUrl.startsWith('https://ui-avatars.com/api/?name='));
    const cookie = cookieOf(res);
    assert.ok(cookie && cookie.startsWith('mn_session='));

    const me = await t.request('GET', '/api/auth/me', undefined, { cookie });
    assert.strictEqual(me.status, 200);
    assert.strictEqual((await me.json()).user.email, 'new@example.com');
  } finally { await t.close(); }
});

test('verify：验证码一次性（复用 → 400），且老用户再次登录 status=login 同 id', async () => {
  // 放宽同邮箱重发窗口：本用例需连发两码（生产 60s 严格限流在单独用例覆盖）
  const t = await testApp({ config: { rateLimits: { emailCodeEmail: { max: 10, windowMs: 60000 } } } });
  try {
    const email = 'user@example.com';
    let code = await sendCode(t, email);
    const first = await t.request('POST', '/api/auth/verify', { email, code });
    const firstData = await first.json();
    assert.strictEqual(firstData.status, 'new');

    const reuse = await t.request('POST', '/api/auth/verify', { email, code });
    assert.strictEqual(reuse.status, 400);

    await t.request('POST', '/api/auth/logout', undefined, { cookie: cookieOf(first) });
    code = await sendCode(t, email);
    const second = await t.request('POST', '/api/auth/verify', { email, code });
    const secondData = await second.json();
    assert.strictEqual(secondData.status, 'login');
    assert.strictEqual(secondData.user.id, firstData.user.id);
    assert.strictEqual(t.mails[1].opts.registered, true); // 老用户邮件文案分支
  } finally { await t.close(); }
});

test('verify：错码 5 次锁定（第 6 次正确码也拒绝）；错码不消耗正确码', async () => {
  const t = await testApp();
  try {
    const email = 'lock@example.com';
    const code = await sendCode(t, email);
    for (let i = 0; i < 5; i++) {
      const res = await t.request('POST', '/api/auth/verify', { email, code: '000000' });
      assert.strictEqual(res.status, 400);
    }
    const res = await t.request('POST', '/api/auth/verify', { email, code });
    assert.strictEqual(res.status, 400); // attempts 已达上限
    const row = t.db.prepare("SELECT attempts FROM email_codes WHERE email = ?").get(email);
    assert.strictEqual(row.attempts, 5);
  } finally { await t.close(); }
});

test('verify：过期码无效；码不存在（未发码）无效', async () => {
  const t = await testApp();
  try {
    const email = 'exp@example.com';
    const code = await sendCode(t, email);
    t.db.prepare("UPDATE email_codes SET expires_at = ? WHERE email = ?")
      .run(new Date(Date.now() - 1000).toISOString(), email);
    const res = await t.request('POST', '/api/auth/verify', { email, code });
    assert.strictEqual(res.status, 400);
    const res2 = await t.request('POST', '/api/auth/verify', { email: 'never@example.com', code: '123456' });
    assert.strictEqual(res2.status, 400);
  } finally { await t.close(); }
});

test('logout：清会话，/me 变 401；无会话登出也 200', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('out@example.com');
    const out = await t.request('POST', '/api/auth/logout', undefined, { cookie });
    assert.strictEqual(out.status, 200);
    const me = await t.request('GET', '/api/auth/me', undefined, { cookie });
    assert.strictEqual(me.status, 401);
    const anon = await t.request('POST', '/api/auth/logout');
    assert.strictEqual(anon.status, 200);
  } finally { await t.close(); }
});

test('PATCH /me：displayName 生效；<13 岁 dob 拒绝；合法 dob 接受', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('p@example.com');
    const res = await t.request('PATCH', '/api/auth/me', { displayName: 'Nova Prime' }, { cookie });
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).user.displayName, 'Nova Prime');

    const kid = await t.request('PATCH', '/api/auth/me', { dob: '2015-01-01' }, { cookie });
    assert.strictEqual(kid.status, 400);
    const adult = await t.request('PATCH', '/api/auth/me', { dob: '2000-01-01' }, { cookie });
    assert.strictEqual(adult.status, 200);
  } finally { await t.close(); }
});

test('删号流程：二次验证码 → delete_pending + 会话清空；30 天内再登录自动恢复', async () => {
  // 放宽同邮箱重发窗口（生产 60s 严格限流在单独用例覆盖）
  const t = await testApp({ config: { rateLimits: { emailCodeEmail: { max: 10, windowMs: 60000 } } } });
  try {
    const { cookie } = t.loginAs('bye@example.com');

    // 无会话请求 delete_confirm 码 → 401
    const anon = await t.request('POST', '/api/auth/email-code', { purpose: 'delete_confirm', email: 'bye@example.com' });
    assert.strictEqual(anon.status, 401);

    const res = await t.request('POST', '/api/auth/email-code', { purpose: 'delete_confirm' }, { cookie });
    assert.strictEqual(res.status, 200);
    const delCode = t.mails[t.mails.length - 1].code;
    assert.strictEqual(t.mails[t.mails.length - 1].email, 'bye@example.com'); // 邮箱强制取会话用户

    const del = await t.request('POST', '/api/auth/delete', { code: delCode }, { cookie });
    assert.strictEqual(del.status, 200);
    const delData = await del.json();
    assert.ok(delData.ok && delData.restoreBy);
    assert.strictEqual(t.db.prepare("SELECT status FROM users WHERE email = ?").get('bye@example.com').status, 'delete_pending');
    assert.strictEqual((await t.request('GET', '/api/auth/me', undefined, { cookie })).status, 401); // 会话已清

    // 再登录 = 恢复
    const code = await sendCode(t, 'bye@example.com');
    const back = await t.request('POST', '/api/auth/verify', { email: 'bye@example.com', code });
    const backData = await back.json();
    assert.strictEqual(backData.status, 'login');
    assert.strictEqual(backData.restored, true);
    assert.strictEqual(t.db.prepare("SELECT status FROM users WHERE email = ?").get('bye@example.com').status, 'active');
  } finally { await t.close(); }
});

test('封禁账号：/me 403 ACCOUNT_BANNED；verify 登录也 403', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('bad@example.com', { status: 'banned' });
    const me = await t.request('GET', '/api/auth/me', undefined, { cookie });
    assert.strictEqual(me.status, 403);
    assert.strictEqual((await me.json()).error.code, 'ACCOUNT_BANNED');

    const code = await sendCode(t, 'bad@example.com');
    const res = await t.request('POST', '/api/auth/verify', { email: 'bad@example.com', code });
    assert.strictEqual(res.status, 403);
  } finally { await t.close(); }
});

test('会话过期：过期 token 401；未登录 PATCH /me 401', async () => {
  const t = await testApp();
  try {
    const { user, cookie } = t.loginAs('exp@example.com');
    t.db.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?')
      .run(new Date(Date.now() - 1000).toISOString(), user.id);
    assert.strictEqual((await t.request('GET', '/api/auth/me', undefined, { cookie })).status, 401);
    assert.strictEqual((await t.request('PATCH', '/api/auth/me', { displayName: 'X' })).status, 401);
  } finally { await t.close(); }
});

test('开发固定登录码：devLoginCode 直登已有账号（免邮件码）；不存在邮箱与错码响应一致', async () => {
  const t = await testApp({ config: { devLoginCode: '888888' } });
  try {
    await t.seedUser({ email: 'dev@mn.test' });
    const res = await t.request('POST', '/api/auth/verify', { email: 'dev@mn.test', code: '888888' });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.user.email, 'dev@mn.test');
    assert.ok(res.headers.get('set-cookie'));

    const noUser = await t.request('POST', '/api/auth/verify', { email: 'ghost@mn.test', code: '888888' });
    assert.strictEqual(noUser.status, 400); // 不暴露魔码，与普通错码一致
  } finally { await t.close(); }
});

test('开发固定登录码：未配置时 888888 只是普通错码；nodeEnv=production 配置也强制忽略', async () => {
  const t1 = await testApp();
  try {
    await t1.seedUser({ email: 'p@mn.test' });
    const res = await t1.request('POST', '/api/auth/verify', { email: 'p@mn.test', code: '888888' });
    assert.strictEqual(res.status, 400);
  } finally { await t1.close(); }

  const t2 = await testApp({ config: { devLoginCode: '888888', nodeEnv: 'production' } });
  try {
    // testApp 的 config 会整体替换 nodeEnv？直接断言 config.js 的生产强制逻辑：
    // 传入 production 时 testApp 应已按 config 语义忽略（见 config.js devLoginCode 行）
    await t2.seedUser({ email: 'p@mn.test' });
    const res = await t2.request('POST', '/api/auth/verify', { email: 'p@mn.test', code: '888888' });
    assert.strictEqual(res.status, 400);
  } finally { await t2.close(); }
});
