'use strict';
// FC 边缘/边框 AI 生成端点测试：POST /api/fc/edge-gen（FC v10.28.50.0）。
// 覆盖：登录门控、校验 400 族、无 key 503、Gemini 桩往返（URL/x-goog-api-key/model 缺省/JSON 响应模式/
// 带图 inline_data）、垃圾回复/网络故障降级 200 ok:false、AI 产物过 sanitizeClip 白名单（拒族+evenodd 过）、
// 限流 429、预算耗尽 budget_exhausted、成功后 usage_log 记 gemini、env model 覆写。
// sanitizeClip 纯函数另测（服务端白名单+黑名单双保险——CSS 注入头号防线）。
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');
const { sanitizeClip } = require('../src/routes/public/fc-edgegen');

const GOOD_CLIP = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';

function geminiStub(reply, calls = { n: 0, lastUrl: null, lastReq: null, lastHeaders: null }) {
  return async (url, opts) => {
    calls.n++;
    calls.lastUrl = url;
    calls.lastReq = JSON.parse(opts.body);
    calls.lastHeaders = opts.headers;
    if (typeof reply === 'function') return reply(url, opts);
    if (reply instanceof Error) throw reply;
    return { ok: true, text: async () => JSON.stringify(reply) };
  };
}

const OK_REPLY = {
  candidates: [{ content: { parts: [{ text: '{"name":"撕边","clip":"' + GOOD_CLIP + '"}' }] } }],
  usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5 }
};

const BODY = (extra = {}) => ({ kind: 'edge', desc: '撕边效果', ...extra });

test('edge-gen：未登录 401', async () => {
  const t = await testApp();
  try {
    assert.strictEqual((await t.request('POST', '/api/fc/edge-gen', BODY())).status, 401);
  } finally { await t.close(); }
});

test('edge-gen：校验 400（描述与附图至少一项；附图格式白名单）', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('gen@example.com');
    assert.strictEqual((await t.request('POST', '/api/fc/edge-gen', {}, { cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/fc/edge-gen', { kind: 'edge', desc: '' }, { cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/fc/edge-gen', BODY({ image: 'data:image/svg+xml;base64,PHN2Zz4=' }), { cookie })).status, 400);
  } finally { await t.close(); }
});

test('edge-gen：无 API key → 503 {unavailable:true}（前端 toast 引导，零打扰）', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('gen@example.com');
    const r = await t.request('POST', '/api/fc/edge-gen', BODY(), { cookie });
    assert.strictEqual(r.status, 503);
    assert.deepStrictEqual(await r.json(), { unavailable: true });
  } finally { await t.close(); }
});

test('edge-gen：Gemini 往返——URL/x-goog-api-key/model 缺省 gemini-3.8-flash/JSON 响应模式/预算记账 gemini', async () => {
  const calls = { n: 0 };
  const t = await testApp({
    config: { gemini: { apiKey: 'test-key' } },
    fetchImpl: geminiStub(OK_REPLY, calls)
  });
  try {
    const { cookie } = t.loginAs('gen@example.com');
    const r = await t.request('POST', '/api/fc/edge-gen', BODY({ name: '我的撕边' }), { cookie });
    assert.strictEqual(r.status, 200);
    const b = await r.json();
    assert.strictEqual(b.ok, true);
    assert.deepStrictEqual(b.edge, { name: '撕边', clip: GOOD_CLIP });
    assert.strictEqual(calls.n, 1);
    assert.strictEqual(calls.lastUrl, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    assert.strictEqual(calls.lastHeaders['x-goog-api-key'], 'test-key');
    assert.strictEqual(calls.lastReq.generationConfig.responseMimeType, 'application/json');
    assert.strictEqual(calls.lastReq.contents[0].role, 'user');
    const allText = calls.lastReq.contents[0].parts.filter((p) => p.text).map((p) => p.text).join('\n');
    assert.ok(allText.includes('kind=edge'));
    assert.ok(allText.includes('我的撕边'));
    // 预算：usage_log 记 edgeGen/gemini + token 数
    const log = t.db.prepare("SELECT * FROM usage_log WHERE feature = 'edgeGen'").get();
    assert.ok(log, 'usage_log 无 edgeGen 行');
    assert.strictEqual(log.provider, 'gemini');
    assert.strictEqual(log.tokens_in, 12);
    assert.strictEqual(log.tokens_out, 5);
  } finally { await t.close(); }
});

test('edge-gen：带图——inline_data 进 parts（png dataURL）', async () => {
  const calls = { n: 0 };
  const t = await testApp({
    config: { gemini: { apiKey: 'test-key' } },
    fetchImpl: geminiStub(OK_REPLY, calls)
  });
  try {
    const { cookie } = t.loginAs('gen@example.com');
    const r = await t.request('POST', '/api/fc/edge-gen',
      BODY({ desc: '', image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }), { cookie });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).ok, true);
    const img = calls.lastReq.contents[0].parts.find((p) => p.inline_data);
    assert.deepStrictEqual(img.inline_data.mime_type, 'image/png');
    assert.ok(img.inline_data.data.length > 0);
  } finally { await t.close(); }
});

test('edge-gen：AI 回垃圾/坏 clip → 200 {ok:false}（降级不拦生成）', async () => {
  const cases = [
    geminiStub({ candidates: [{ content: { parts: [{ text: 'not json at all' }] } }] }),
    geminiStub({ candidates: [{ content: { parts: [{ text: '{"name":"x","clip":"polygon(0 0, 50px 0, 0 50)"}' }] } }] }), // px 单位拒
    geminiStub({ candidates: [] }),
    new Error('network down')
  ];
  for (const stub of cases) {
    const t = await testApp({ config: { gemini: { apiKey: 'test-key' } }, fetchImpl: stub });
    try {
      const { cookie } = t.loginAs('gen@example.com');
      const r = await t.request('POST', '/api/fc/edge-gen', BODY(), { cookie });
      assert.strictEqual(r.status, 200);
      assert.deepStrictEqual(await r.json(), { ok: false });
    } finally { await t.close(); }
  }
});

test('edge-gen：限流——config.rateLimits.edgeGen 2/min 后 429', async () => {
  const t = await testApp({
    config: { gemini: { apiKey: 'test-key' }, rateLimits: { edgeGen: { max: 2, windowMs: 60000 } } },
    fetchImpl: geminiStub(OK_REPLY)
  });
  try {
    const { cookie } = t.loginAs('gen@example.com');
    assert.strictEqual((await t.request('POST', '/api/fc/edge-gen', BODY(), { cookie })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/fc/edge-gen', BODY(), { cookie })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/fc/edge-gen', BODY(), { cookie })).status, 429);
  } finally { await t.close(); }
});

test('edge-gen：预算耗尽 → 200 {budget_exhausted:true}（零 AI 调用）', async () => {
  const calls = { n: 0 };
  const t = await testApp({
    config: { gemini: { apiKey: 'test-key' } },
    fetchImpl: geminiStub(OK_REPLY, calls)
  });
  try {
    t.db.prepare("INSERT INTO platform_settings (key, value, type, updated_at) VALUES ('budget.edgeGen', '0', 'number', ?)").run(new Date().toISOString());
    const { cookie } = t.loginAs('gen@example.com');
    const r = await t.request('POST', '/api/fc/edge-gen', BODY(), { cookie });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(await r.json(), { budget_exhausted: true });
    assert.strictEqual(calls.n, 0);
  } finally { await t.close(); }
});

test('edge-gen：config.gemini.model 覆写生效（env GEMINI_MODEL 路径）', async () => {
  const calls = { n: 0 };
  const t = await testApp({
    config: { gemini: { apiKey: 'test-key', model: 'gemini-2.5-pro' } },
    fetchImpl: geminiStub(OK_REPLY, calls)
  });
  try {
    const { cookie } = t.loginAs('gen@example.com');
    await t.request('POST', '/api/fc/edge-gen', BODY(), { cookie });
    assert.ok(calls.lastUrl.includes('/models/gemini-2.5-pro:generateContent'));
  } finally { await t.close(); }
});

test('sanitizeClip：合法族（百分比/evenodd 双环/nonzero/小数两点/51.1 裸值放宽）', () => {
  assert.strictEqual(sanitizeClip(GOOD_CLIP), GOOD_CLIP);
  assert.strictEqual(sanitizeClip('polygon(0 0, 100 0, 100 100, 0 100)'), 'polygon(0 0, 100 0, 100 100, 0 100)');
  assert.strictEqual(sanitizeClip('polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 90% 100%, 90% 10%, 10% 10%, 10% 90%, 0% 90%)'),
    'polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 90% 100%, 90% 10%, 10% 10%, 10% 90%, 0% 90%)');
  assert.strictEqual(sanitizeClip('  polygon(nonzero , 0% 0%, 100% 0%, 50.55% 100%)  '),
    'polygon(nonzero, 0% 0%, 100% 0%, 50.55% 100%)');
  // v10.28.51.1: 裸值放宽 ±100 全收——border 内环 3-12% 内缩 Gemini 常输出裸值
  // （51.1 前只许 0/100 → 「边框生成失败」而 edge 满盒只用 0/100 故「边缘成功边框失败」）
  assert.strictEqual(sanitizeClip('polygon(0 0, 50 0, 0 50)'), 'polygon(0 0, 50 0, 0 50)');
  assert.strictEqual(sanitizeClip('polygon(evenodd, 0 0, 100 0, 100 100, 8 100, 8 8, 92 8, 92 92, 0 92)'),
    'polygon(evenodd, 0 0, 100 0, 100 100, 8 100, 8 8, 92 8, 92 92, 0 92)');
  assert.strictEqual(sanitizeClip('polygon(0 0, 100 0, 12.5 75.25)'), 'polygon(0 0, 100 0, 12.5 75.25)');
});

test('sanitizeClip：拒族（注入面全拒）', () => {
  const rejects = [
    '', '  ', null, undefined, 'not a polygon',
    'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%) extra',
    'polygon(0% 0%, 100% 0%)',                                  // <3 顶点
    'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 25% 25%); drop-shadow(0 0)', // 分号
    'polygon(0% 0%, 100% 0%, url(https://evil))',               // url(
    'polygon(0% 0%, 100% 0%, expression(alert(1)))',           // expression(
    'polygon(0% 0%, 100% 0%, calc(100% - 10px))',              // calc(
    'polygon(0% 0%, 100% 0%, var(--x))',                       // var(
    'polygon(0% 0%, 100% 0%, javascript:alert(1))',            // javascript:
    'polygon(0% 0%, 100% 0%, "100%")',                         // 引号
    "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%')",            // 引号
    'polygon(0% 0%, 100% 0%, <svg>)',                          // 尖括号
    'polygon(0% 0%, 100% 0%, 100\\% 100%)',                    // 反斜杠
    'polygon(0% 0%, 150% 0%, 100% 100%)',                      // %>100
    'polygon(0% 0%, -1% 0%, 100% 100%)',                       // %<0
    'polygon(0 0, 150 0, 0 50)',                               // 裸值 >100
    'polygon(0 0, -101 0, 0 50)',                              // 裸值 <-100
    'polygon(0% 0% 100% 0% 100% 100%)',                        // 单点四数
    'polygon(0% 0%, 100% 0%, 100%)',                           // 单数点
    'polygon(0% 0%, 100% 0%, 1e2% 100%)',                      // 科学计数法
    'a'.repeat(2001)                                           // 超长（不过此串不匹配 polygon 外壳，双重覆盖）
  ];
  for (const s of rejects) assert.strictEqual(sanitizeClip(s), null, '应拒：' + String(s).slice(0, 60));
});

test('sanitizeClip：80 顶点上限', () => {
  const pts = Array.from({ length: 80 }, (_, i) => `${i}% ${i}%`);
  assert.ok(sanitizeClip('polygon(' + pts.join(', ') + ')'), '80 顶点应过');
  const pts81 = Array.from({ length: 81 }, (_, i) => `${i}% ${i}%`);
  assert.strictEqual(sanitizeClip('polygon(' + pts81.join(', ') + ')'), null, '81 顶点应拒');
});
