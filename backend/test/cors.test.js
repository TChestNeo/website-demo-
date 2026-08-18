'use strict';
// 前后端分离（前端独立托管 + API 子域）：CORS 白名单反射 + 预检 204；session cookie 域放大（COOKIE_DOMAIN）。

const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');
const { sessionCookie } = require('../src/middleware/auth');

const ORIGIN = 'https://mn.world';

test('CORS：白名单 Origin 反射头；白名单外/无 Origin 无头', async () => {
  const t = await testApp({ config: { frontendOrigins: [ORIGIN, 'https://www.mn.world'] } });
  try {
    let res = await t.request('GET', '/api/health', undefined, { headers: { Origin: ORIGIN } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(res.headers.get('vary'), 'Origin');

    res = await t.request('GET', '/api/health', undefined, { headers: { Origin: 'https://evil.example' } });
    assert.equal(res.headers.get('access-control-allow-origin'), null);

    res = await t.request('GET', '/api/health');
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  } finally {
    await t.close();
  }
});

test('CORS 预检：白名单 204 + 方法/请求头；白名单外走正常路由', async () => {
  const t = await testApp({ config: { frontendOrigins: [ORIGIN] } });
  try {
    let res = await t.request('OPTIONS', '/api/reports', undefined, {
      headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' }
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
    assert.match(res.headers.get('access-control-allow-methods'), /POST/);
    assert.match(res.headers.get('access-control-allow-headers'), /Content-Type/);
    assert.equal(res.headers.get('access-control-max-age'), '86400');

    res = await t.request('OPTIONS', '/api/reports', undefined, {
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' }
    });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
    assert.equal(res.status, 404); // 无此路由的 OPTIONS，照常 404
  } finally {
    await t.close();
  }
});

test('sessionCookie：配 COOKIE_DOMAIN 加 Domain=；未配不加；生产加 Secure', () => {
  const base = { sessionCookie: 'mn_session', nodeEnv: 'development' };
  assert.match(sessionCookie('tok', { ...base, cookieDomain: 'mn.world' }, 100), /Domain=mn\.world/);
  assert.doesNotMatch(sessionCookie('tok', { ...base, cookieDomain: '' }, 100), /Domain=/);
  assert.match(sessionCookie('tok', { ...base, cookieDomain: 'mn.world', nodeEnv: 'production' }, 100), /Secure/);
});

test('端到端：COOKIE_DOMAIN 配置的登录响应 set-cookie 带 Domain', async () => {
  const t = await testApp({ config: { cookieDomain: 'mn.world', frontendOrigins: [ORIGIN] } });
  try {
    await t.seedUser({ email: 'u@mn.test' });
    const res = await t.request('POST', '/api/auth/email-code', { email: 'u@mn.test' });
    assert.equal(res.status, 200);
    const { code } = t.mails[t.mails.length - 1];
    const v = await t.request('POST', '/api/auth/verify', { email: 'u@mn.test', code });
    assert.equal(v.status, 200);
    assert.match(v.headers.get('set-cookie'), /Domain=mn\.world/);
  } finally {
    await t.close();
  }
});
