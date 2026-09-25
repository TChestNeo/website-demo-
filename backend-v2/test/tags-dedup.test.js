'use strict';
// 图库标签查重端点测试：POST /api/tags/dedup（FC v10.28.46.0 混合双查的后端半程）。
// 覆盖：登录门控、校验、无 key 503、DeepSeek 桩往返（model 缺省 v4-flash）、坏回复/网络故障降级 200、env model 覆写。
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

function dedupStub(replyText, calls = { n: 0, lastReq: null }) {
  return async (url, opts) => {
    calls.n++;
    calls.lastReq = JSON.parse(opts.body);
    return {
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: replyText } }] })
    };
  };
}

const BODY = (original, extra = {}) => ({
  original,
  enName: '',
  existing: [
    { id: 'sys-flag', original: '国旗', enName: 'Flag', sys: true },
    { id: 't1', original: '皇室', enName: 'Royal', sys: false }
  ],
  ...extra
});

test('tags/dedup：未登录 401', async () => {
  const t = await testApp();
  try {
    assert.strictEqual((await t.request('POST', '/api/tags/dedup', BODY('旗帜'))).status, 401);
  } finally { await t.close(); }
});

test('tags/dedup：校验 400（缺/空 original）', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('tagger@example.com');
    assert.strictEqual((await t.request('POST', '/api/tags/dedup', {}, { cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/tags/dedup', BODY('  '), { cookie })).status, 400);
  } finally { await t.close(); }
});

test('tags/dedup：无 API key → 503 {unavailable:true}（前端静默本地-only）', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('tagger@example.com');
    const r = await t.request('POST', '/api/tags/dedup', BODY('旗帜'), { cookie });
    assert.strictEqual(r.status, 503);
    assert.deepStrictEqual(await r.json(), { unavailable: true });
  } finally { await t.close(); }
});

test('tags/dedup：DeepSeek 往返——model 缺省 deepseek-v4-flash、existing 截断 40、matches/suggestedEn 透传', async () => {
  const calls = { n: 0 };
  const t = await testApp({
    config: { deepseek: { apiKey: 'test-key' } },
    fetchImpl: dedupStub('{"matches":[{"id":"sys-flag"},{"id":"不存在"}],"suggestedEn":"Flag"}', calls)
  });
  try {
    const { cookie } = t.loginAs('tagger@example.com');
    const many = [{ id: 'sys-flag', original: '国旗', enName: 'Flag', sys: true }]
      .concat(Array.from({ length: 45 }, (_, i) => ({ id: 'x' + i, original: 't' + i, enName: '', sys: false })));
    const r = await t.request('POST', '/api/tags/dedup', BODY('旗帜', { existing: many }), { cookie });
    assert.strictEqual(r.status, 200);
    const b = await r.json();
    assert.strictEqual(b.ok, true);
    // 只回 existing 里真实存在的 id；不存在者被滤
    assert.deepStrictEqual(b.matches, [{ id: 'sys-flag' }]);
    assert.strictEqual(b.suggestedEn, 'Flag');
    assert.strictEqual(calls.n, 1);
    assert.strictEqual(calls.lastReq.model, 'deepseek-v4-flash');
    assert.strictEqual(calls.lastReq.max_tokens, 120);
    assert.strictEqual(calls.lastReq.temperature, 0);
    const userMsg = JSON.parse(calls.lastReq.messages[1].content);
    assert.strictEqual(userMsg.original, '旗帜');
    assert.strictEqual(userMsg.existing.length, 40); // 截断 40
  } finally { await t.close(); }
});

test('tags/dedup：AI 回非 JSON → 200 空 matches（降级不拦创建）', async () => {
  const t = await testApp({
    config: { deepseek: { apiKey: 'test-key' } },
    fetchImpl: dedupStub('not json at all')
  });
  try {
    const { cookie } = t.loginAs('tagger@example.com');
    const r = await t.request('POST', '/api/tags/dedup', BODY('旗帜'), { cookie });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(await r.json(), { ok: true, matches: [], suggestedEn: '' });
  } finally { await t.close(); }
});

test('tags/dedup：fetch 抛错 → 200 空 matches（网络故障降级）', async () => {
  // 不传 fetchImpl：testApp 默认桩即抛错（防误连真实 DeepSeek 产生账单）
  const t = await testApp({ config: { deepseek: { apiKey: 'test-key' } } });
  try {
    const { cookie } = t.loginAs('tagger@example.com');
    const r = await t.request('POST', '/api/tags/dedup', BODY('旗帜'), { cookie });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(await r.json(), { ok: true, matches: [], suggestedEn: '' });
  } finally { await t.close(); }
});

test('tags/dedup：config.deepseek.model 覆写生效（env DEEPSEEK_MODEL 路径）', async () => {
  const calls = { n: 0 };
  const t = await testApp({
    config: { deepseek: { apiKey: 'test-key', model: 'deepseek-chat' } },
    fetchImpl: dedupStub('{"matches":[],"suggestedEn":""}', calls)
  });
  try {
    const { cookie } = t.loginAs('tagger@example.com');
    await t.request('POST', '/api/tags/dedup', BODY('旗帜'), { cookie });
    assert.strictEqual(calls.lastReq.model, 'deepseek-chat');
  } finally { await t.close(); }
});
