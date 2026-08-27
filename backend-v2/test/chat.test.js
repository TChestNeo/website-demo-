'use strict';
// P8 端点测试：POST /api/chat（契约、成本漏斗四级、限流）+ ai/faq.js 检索 + system 前缀哈希。
// 成本红线断言：FAQ 命中 / needsHuman 规则 / 降级路径 → fetch 桩零调用 + 零成本 usage 行。
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { testApp } = require('./helpers');
const { bestMatch, scoreEntry, normalize } = require('../src/ai/faq');
const { SYSTEM_PROMPT, MAX_TOKENS } = require('../src/ai/prompt');

// DeepSeek 桩：记录请求体（断言 system 前缀原样 + max_tokens 红线），返回固定回复 + usage
function chatStub(replyText, calls = { n: 0, lastReq: null }) {
  return async (url, opts) => {
    calls.n++;
    calls.lastReq = JSON.parse(opts.body);
    return {
      ok: true,
      text: async () => JSON.stringify({
        choices: [{ message: { content: replyText } }],
        usage: { prompt_tokens: 50, completion_tokens: 30, prompt_cache_hit_tokens: 20 }
      })
    };
  };
}

function body(messages, extra = {}) {
  return { sessionId: 'sess-test-1', locale: 'zh', messages, ...extra };
}
const Q = (text) => [{ role: 'user', content: text }];

// ── ai/faq.js 检索单元 ──
test('faq 检索：zh/en/ms 各自命中；无关文本不命中；normalize 去 URL/标点', () => {
  assert.strictEqual(bestMatch('你们有哪些订阅套餐？价格多少钱？').entry.id, 'q10');
  assert.strictEqual(bestMatch('how much does premium cost?').entry.id, 'q10');
  assert.strictEqual(bestMatch('berapa harga langganan?').entry.id, 'q10');
  assert.strictEqual(bestMatch('什么是 micronation？').entry.id, 'q1');
  assert.strictEqual(bestMatch('今天天气怎么样'), null);
  assert.strictEqual(bestMatch(''), null);
  assert.strictEqual(normalize('  Hello,   WORLD!! https://x.com/y '), 'hello world');
  // scoreEntry 阈值语义：2 个关键词 = 2/3 ≥ 0.6 命中；1 个 = 1/3 不命中
  const q13 = bestMatch('退款退钱怎么弄').entry;
  assert.strictEqual(q13.id, 'q13');
  assert.strictEqual(scoreEntry(normalize('退款退钱怎么弄'), q13), 2 / 3);
  assert.strictEqual(scoreEntry(normalize('我要退款'), q13), 1 / 3);
});

test('prompt 前缀：sha256 断言（防上线后手滑改动 = 缓存失效）', () => {
  const h = crypto.createHash('sha256').update(SYSTEM_PROMPT, 'utf8').digest('hex');
  assert.strictEqual(h, '4dfc3ffe3143172210a0bef471661d514003bd6e933dd4900c923b704c765fa4');
  assert.strictEqual(MAX_TOKENS, 80); // 计划红线：客服单条回复 ≤80 tokens
});

// ── 契约与校验 ──
test('chat：校验 400（缺 sessionId / messages 空·超 10 条·坏角色·空内容·超长）', async () => {
  const t = await testApp();
  try {
    assert.strictEqual((await t.request('POST', '/api/chat', {})).status, 400);
    assert.strictEqual((await t.request('POST', '/api/chat', body([]))).status, 400);
    const eleven = Array.from({ length: 11 }, () => ({ role: 'user', content: 'hi' }));
    assert.strictEqual((await t.request('POST', '/api/chat', body(eleven))).status, 400);
    assert.strictEqual((await t.request('POST', '/api/chat', body([{ role: 'system', content: 'x' }]))).status, 400);
    assert.strictEqual((await t.request('POST', '/api/chat', body([{ role: 'user', content: '  ' }]))).status, 400);
    assert.strictEqual((await t.request('POST', '/api/chat', body([{ role: 'user', content: 'x'.repeat(4001) }]))).status, 400);
  } finally { await t.close(); }
});

// ── 漏斗第 1 级：needsHuman 规则先行（0 元，不调 AI）──
test('chat：退款/被盗等规则 → needsHuman + ticketHint，零 AI 调用零成本', async () => {
  const calls = { n: 0 };
  const t = await testApp({ fetchImpl: chatStub('x', calls) });
  try {
    const r = await t.request('POST', '/api/chat', body(Q('我要退款')));
    assert.strictEqual(r.status, 200);
    const b = await r.json();
    assert.strictEqual(b.needsHuman, true);
    assert.ok(b.ticketHint.includes('退款'));
    assert.strictEqual(calls.n, 0);
    // 规则先行：即使 FAQ 也会命中的措辞，仍走人工卡
    const r2 = await t.request('POST', '/api/chat', body(Q('我的账号被盗了怎么办')));
    assert.strictEqual((await r2.json()).needsHuman, true);
    assert.strictEqual(calls.n, 0);
    // 零成本 usage 行（可观测性）
    const rows = t.db.prepare("SELECT * FROM usage_log WHERE feature = 'chat'").all();
    assert.strictEqual(rows.length, 2);
    assert.ok(rows.every(u => u.cost_micro === 0 && u.tokens_in === 0 && u.tokens_out === 0));
  } finally { await t.close(); }
});

// ── 漏斗第 2 级：FAQ 检索（0 元直答）──
test('chat：FAQ 命中 → 原文直答 0 计费（chat_faq_hit）；needsHuman 条目附 ticketHint', async () => {
  const calls = { n: 0 };
  const t = await testApp({ fetchImpl: chatStub('x', calls) });
  try {
    const r = await t.request('POST', '/api/chat', body(Q('你们有哪些订阅套餐？价格多少钱？')));
    const b = await r.json();
    assert.strictEqual(r.status, 200);
    assert.ok(b.reply.includes('Premium Ultra'));
    assert.strictEqual(b.needsHuman, false);
    assert.strictEqual(b.ticketHint, null);
    assert.strictEqual(calls.n, 0);
    const u = t.db.prepare("SELECT * FROM usage_log WHERE feature = 'chat_faq_hit'").get();
    assert.strictEqual(u.cost_micro, 0);
    // needsHuman 条目（数据导出，措辞避开 needsHuman 先行规则）：命中 FAQ 但附人工卡
    const r2 = await t.request('POST', '/api/chat', body(Q('从哪里下载数据')));
    const b2 = await r2.json();
    assert.strictEqual(b2.needsHuman, true);
    assert.ok(b2.ticketHint && b2.ticketHint.includes('隐私请求'));
    assert.strictEqual(calls.n, 0);
  } finally { await t.close(); }
});

// ── 漏斗第 3 级：预算耗尽 → 降级 HTTP 200（不硬下线）──
test('chat：预算耗尽 → 降级 200 needsHuman，零 AI 调用', async () => {
  const calls = { n: 0 };
  const t = await testApp({ fetchImpl: chatStub('x', calls) });
  try {
    // v2 D8：预算额度在 platform_settings（kv 只留 cron.* 运行时键）——走服务器 budget 实例的
    // setLimit（ON CONFLICT upsert，004 已种子 budget.chat，裸 INSERT 会撞 UNIQUE）
    t.app.ctx.budget.setLimit('chat', 0);
    const r = await t.request('POST', '/api/chat', body(Q('今天天气怎么样')));
    assert.strictEqual(r.status, 200);
    const b = await r.json();
    assert.strictEqual(b.needsHuman, true);
    assert.ok(b.ticketHint.includes('工单'));
    assert.strictEqual(calls.n, 0);
  } finally { await t.close(); }
});

// ── 漏斗第 4 级：DeepSeek 通路 ──
test('chat：DeepSeek → reply 原样 + system 前缀原样 + max_tokens 80 + 按快照记账', async () => {
  const calls = { n: 0, lastReq: null };
  const t = await testApp({ fetchImpl: chatStub('欢迎来到 M.NationWorld！', calls) });
  try {
    const r = await t.request('POST', '/api/chat', body(Q('介绍一下平台')));
    const b = await r.json();
    assert.strictEqual(r.status, 200);
    assert.strictEqual(b.reply, '欢迎来到 M.NationWorld！');
    assert.strictEqual(b.needsHuman, false);
    assert.strictEqual(b.ticketHint, null);
    assert.strictEqual(calls.n, 1);
    // 请求形状：system 字节级常量 + max_tokens 红线
    assert.strictEqual(calls.lastReq.messages[0].role, 'system');
    assert.strictEqual(calls.lastReq.messages[0].content, SYSTEM_PROMPT);
    assert.strictEqual(calls.lastReq.max_tokens, 80);
    // 记账：cost_micro 与价格快照自洽（峰谷取决于测试运行时刻，按快照复算）
    const u = t.db.prepare("SELECT * FROM usage_log WHERE feature = 'chat'").get();
    const rates = JSON.parse(u.price_snapshot).rates;
    const expected = Math.round(50 * rates.in + 30 * rates.out + 20 * rates.cached);
    assert.strictEqual(u.cost_micro, expected);
    assert.ok(u.cost_micro > 0);
  } finally { await t.close(); }
});

// ── 漏斗第 4 级：AI 失败 → 重试 2 次后降级 200（不硬下线）──
test('chat：DeepSeek 全败 → 重试 2 次 → 降级 200，零成本', async () => {
  const calls = { n: 0 };
  const t = await testApp({
    fetchImpl: async () => { calls.n++; throw new Error('network down'); }
  });
  try {
    const r = await t.request('POST', '/api/chat', body(Q('介绍一下平台')));
    assert.strictEqual(r.status, 200);
    const b = await r.json();
    assert.strictEqual(b.needsHuman, true);
    assert.strictEqual(calls.n, 2);
    const rows = t.db.prepare("SELECT * FROM usage_log WHERE feature = 'chat'").all();
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].cost_micro, 0); // 失败不记账
  } finally { await t.close(); }
});

// ── 限流 ──
test('chat：限流 429（IP 8/min + sessionId 20/min）', async () => {
  const t = await testApp({
    config: { rateLimits: { chatIp: { max: 2, windowMs: 60000 }, chatSession: { max: 3, windowMs: 60000 } } }
  });
  try {
    const q = () => t.request('POST', '/api/chat', body(Q('介绍一下平台')));
    assert.strictEqual((await q()).status, 200);
    assert.strictEqual((await q()).status, 200);
    // 第 3 次：IP 限流先触发
    const third = await q();
    assert.strictEqual(third.status, 429);
    assert.strictEqual((await third.json()).error.code, 'RATE_LIMITED');
    // 换 sessionId 但同 IP → 仍 429（IP 桶已满）
    const r2 = await t.request('POST', '/api/chat', body(Q('你好'), { sessionId: 'sess-other' }));
    assert.strictEqual(r2.status, 429);
  } finally { await t.close(); }
});

test('chat：sessionId 独立桶 20/min（IP 桶宽时不误伤）', async () => {
  const t = await testApp({
    config: { rateLimits: { chatIp: { max: 100, windowMs: 60000 }, chatSession: { max: 2, windowMs: 60000 } } }
  });
  try {
    const q = () => t.request('POST', '/api/chat', body(Q('介绍一下平台')));
    assert.strictEqual((await q()).status, 200);
    assert.strictEqual((await q()).status, 200);
    assert.strictEqual((await q()).status, 429);
  } finally { await t.close(); }
});
