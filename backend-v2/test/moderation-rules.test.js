'use strict';
// L0 规则引擎纯函数测试：三级违禁词 zh/en/ms、词边界防误伤、spam 正则、去重规范化。
const { test } = require('node:test');
const assert = require('node:assert');
const { evaluateText, normalize, hashOf } = require('../src/moderation/rules');
const blocklist = require('../data/blocklist.json');

test('L0 零容忍：zh/en/ms 命中即 reject + severity 3', () => {
  assert.strictEqual(evaluateText('我这里可以帮你代开发票，联系我', blocklist).verdict, 'reject');
  assert.strictEqual(evaluateText('this person is a nigger and should leave', blocklist).verdict, 'reject');
  assert.strictEqual(evaluateText('ko pukimak la', blocklist).verdict, 'reject');
  const r = evaluateText('办假证请联系我', blocklist);
  assert.strictEqual(r.verdict, 'reject');
  assert.strictEqual(r.reasonCode, 'zero_tolerance');
  assert.strictEqual(r.severity, 3);
  assert.ok(r.hits.length > 0 && r.hits[0].tier === 'zero_tolerance');
});

test('L0 零容忍优先于 warning（同文两级命中只报 zero_tolerance）', () => {
  const r = evaluateText('傻逼滚蛋，我这里代开发票', blocklist);
  assert.strictEqual(r.verdict, 'reject');
  assert.ok(r.hits.every(h => h.tier === 'zero_tolerance'));
});

test('L0 warning：轻度违禁词 → hold 人工（severity 1）', () => {
  const r = evaluateText('你真是个傻逼', blocklist);
  assert.strictEqual(r.verdict, 'hold');
  assert.strictEqual(r.reasonCode, 'blocklist_warning');
  assert.strictEqual(r.severity, 1);
  assert.strictEqual(evaluateText('you are stupid and a jerk', blocklist).verdict, 'hold');
  assert.strictEqual(evaluateText('kau ni anjing la', blocklist).verdict, 'hold');
});

test('L0 词边界：hello 不误伤 hell；pembabitan 不误伤 babi', () => {
  assert.strictEqual(evaluateText('hello world, welcome to our nation', blocklist).verdict, 'pass');
  assert.strictEqual(evaluateText('pembabitan dalam projek ini', blocklist).verdict, 'pass');
  assert.strictEqual(evaluateText('what the hell is this', blocklist).verdict, 'hold');
  assert.strictEqual(evaluateText('babi betul la', blocklist).verdict, 'hold');
});

test('L0 spam：外链 ≥3 条 → hold；字符刷屏 ≥10 连 → hold', () => {
  const links = evaluateText('看我主页 http://a.com 和 www.b.co 还有 https://c.org', blocklist);
  assert.strictEqual(links.verdict, 'hold');
  assert.strictEqual(links.reasonCode, 'spam');
  const run = evaluateText('啊啊啊啊啊啊啊啊啊啊刷屏', blocklist);
  assert.strictEqual(run.verdict, 'hold');
  assert.strictEqual(run.reasonCode, 'spam');
  // 2 条链接不算 spam
  assert.strictEqual(evaluateText('http://a.com 和 www.b.co 欢迎', blocklist).verdict, 'pass');
});

test('L0 pass：正常内容（含虚构世界观战争/政治模拟，平台核心玩法不误伤）', () => {
  assert.strictEqual(evaluateText('我国 Aethelgard 与邻国爆发了边境冲突，已派外交使团', blocklist).verdict, 'pass');
  assert.strictEqual(evaluateText('Introducing my new micronation: a democratic republic with 50 citizens', blocklist).verdict, 'pass');
  assert.strictEqual(evaluateText('', blocklist).verdict, 'pass');
});

test('normalize/hashOf：大小写、空白、URL 归一化后同哈希', () => {
  const a = hashOf('Hello   World http://x.com');
  const b = hashOf('hello world https://y.org');
  assert.strictEqual(a, b);
  assert.notStrictEqual(a, hashOf('hello world, different'));
});
