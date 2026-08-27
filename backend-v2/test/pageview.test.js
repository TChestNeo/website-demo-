'use strict';
// 公网分析事件（加法端点）：POST /api/analytics/pageview → page_views（PGV-）。
// D10：GEOIP_URL 可选解析（2s 超时、失败跳过——IP 只作信号）；轻限流防刷流水表；匿名无会话。

const test = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

const BODY = {
  clientId: 'c-abc', path: '/explore', referer: 'https://m.nationworld/',
  language: 'zh', device: 'desktop', browser: 'Chrome', os: 'Windows'
};

test('pageview：合法提交 → PGV- 落库；GEO 未配置 → country null', async () => {
  const t = await testApp();
  try {
    const res = await t.request('POST', '/api/analytics/pageview', BODY);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
    assert.match(body.id, /^PGV-\d{6}$/, 'ID 前缀契约 PGV-xxxxxx');
    const row = t.db.prepare('SELECT * FROM page_views WHERE id = ?').get(body.id);
    assert.strictEqual(row.path, '/explore');
    assert.strictEqual(row.client_id, 'c-abc');
    assert.strictEqual(row.referer, 'https://m.nationworld/');
    assert.strictEqual(row.language, 'zh');
    assert.strictEqual(row.device, 'desktop');
    assert.strictEqual(row.browser, 'Chrome');
    assert.strictEqual(row.os, 'Windows');
    assert.strictEqual(row.country, null, '未配 GEOIP_URL → 跳过（D10 可选）');
    assert.ok(row.created_at);
  } finally {
    await t.close();
  }
});

test('pageview：GEOIP 桩返回国家 → 落库；URL 模板 {ip} 已替换', async () => {
  let calledUrl = '';
  const fetchImpl = async (url) => {
    calledUrl = url;
    return { ok: true, json: async () => ({ country: 'US' }) };
  };
  const t = await testApp({ fetchImpl, config: { geoIpUrl: 'https://geo.example/{ip}/json' } });
  try {
    const res = await t.request('POST', '/api/analytics/pageview', { ...BODY, clientId: 'c-geo' });
    assert.strictEqual(res.status, 200);
    const row = t.db.prepare("SELECT * FROM page_views WHERE client_id = 'c-geo'").get();
    assert.strictEqual(row.country, 'US');
    assert.ok(calledUrl.startsWith('https://geo.example/'), 'GEOIP 模板已调用');
    assert.ok(!calledUrl.includes('{ip}'), '{ip} 占位符必须替换为真实 IP');
  } finally {
    await t.close();
  }
});

test('pageview：GEOIP 失败（非 ok/抛错）→ 跳过仍 200；非法 path → 400', async () => {
  const fetchImpl = async () => { throw new Error('geo down'); };
  const t = await testApp({ fetchImpl, config: { geoIpUrl: 'https://geo.example/{ip}/json' } });
  try {
    const res = await t.request('POST', '/api/analytics/pageview', { ...BODY, clientId: 'c-fail' });
    assert.strictEqual(res.status, 200, 'GEO 失败绝不能影响主流程');
    const row = t.db.prepare("SELECT * FROM page_views WHERE client_id = 'c-fail'").get();
    assert.strictEqual(row.country, null);

    const bad = await t.request('POST', '/api/analytics/pageview', { path: 'no-slash' });
    assert.strictEqual(bad.status, 400);
    assert.strictEqual((await bad.json()).error.code, 'VALIDATION');
  } finally {
    await t.close();
  }
});

test('pageview：限流（60/min 默认可覆盖）→ 第 3 次 429', async () => {
  const t = await testApp({ config: { rateLimits: { pageview: { max: 2, windowMs: 60000 } } } });
  try {
    assert.strictEqual((await t.request('POST', '/api/analytics/pageview', BODY)).status, 200);
    assert.strictEqual((await t.request('POST', '/api/analytics/pageview', BODY)).status, 200);
    const r3 = await t.request('POST', '/api/analytics/pageview', BODY);
    assert.strictEqual(r3.status, 429);
    assert.strictEqual((await r3.json()).error.code, 'RATE_LIMITED');
  } finally {
    await t.close();
  }
});
