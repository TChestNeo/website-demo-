'use strict';
// 服务器装配：health / 404 / CORS 白名单 / 维护模式放行口径 + money 金额双平面（D1）。

const test = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');
const money = require('../src/money');

test('health：200 {status,db,tables,version,time}，59 表，版本 2.0.0', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const res = await a.request('GET', '/api/health');
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'ok');
  assert.strictEqual(body.db, 'ok');
  assert.strictEqual(body.tables, 59);
  assert.strictEqual(body.version, '2.0.0');
});

test('未知路径 404 NOT_FOUND 统一错误形状', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  const res = await a.request('GET', '/api/nope');
  assert.strictEqual(res.status, 404);
  assert.deepStrictEqual((await res.json()).error, { code: 'NOT_FOUND', message: 'Not found' });
});

test('CORS：白名单 Origin 反射 ACAO+credentials；非白名单不反射；预检 204', async (t) => {
  const a = await testApp({ config: { frontendOrigins: ['https://mn.world'] } });
  t.after(() => a.close());
  const ok = await a.request('GET', '/api/health', undefined, { headers: { Origin: 'https://mn.world' } });
  assert.strictEqual(ok.headers.get('access-control-allow-origin'), 'https://mn.world');
  assert.strictEqual(ok.headers.get('access-control-allow-credentials'), 'true');
  const no = await a.request('GET', '/api/health', undefined, { headers: { Origin: 'https://evil.example' } });
  assert.strictEqual(no.headers.get('access-control-allow-origin'), null);
  const pre = await a.request('OPTIONS', '/api/auth/email-code', undefined, {
    headers: { Origin: 'https://mn.world', 'Access-Control-Request-Method': 'POST' }
  });
  assert.strictEqual(pre.status, 204);
});

test('维护模式：开启后公网 503；/api/staff/* 与 /api/health 放行', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  a.db.prepare("UPDATE platform_settings SET value = '{\"enabled\":true,\"message\":\"维护中\"}' WHERE key = 'maintenance'").run();
  const pub = await a.request('POST', '/api/auth/email-code', { email: 'x@x.y' });
  assert.strictEqual(pub.status, 503);
  assert.strictEqual((await pub.json()).error.code, 'SERVICE_UNAVAILABLE');
  assert.strictEqual((await a.request('GET', '/api/health')).status, 200);
  assert.strictEqual((await a.request('POST', '/api/staff/auth/email-code', { email: 'x@x.y' })).status, 200);
});

test('money：微元换算 + 格式化 + 汇率折算（D1 双平面统一工具）', async (t) => {
  const a = await testApp();
  t.after(() => a.close());
  assert.strictEqual(money.microToReal(1_234_567), 1.234567);
  assert.strictEqual(money.realToMicro(12.345678), 12_345_678);
  assert.strictEqual(money.fmtMicroYuan(1_234_567), '¥1.23');
  assert.strictEqual(money.fmtMicroRM(1_234_567), 'RM 1.23');
  assert.strictEqual(money.fmtRealRM(12.5), 'RM 12.50');
  // fx 默认 0.62（种子）：100 元 CNY = 62_000_000 微元 MYR
  assert.strictEqual(money.cnyMicroToRMMicro(a.db, 100_000_000), 62_000_000);
  // 改 platform_settings 生效
  a.db.prepare("UPDATE platform_settings SET value = '1.0' WHERE key = 'finance.fx'").run();
  assert.strictEqual(money.cnyMicroToRMMicro(a.db, 100_000_000), 100_000_000);
});
