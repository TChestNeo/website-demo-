'use strict';
// src/password.js 单元测试（W6）：格式/盐唯一/验证通过/失败/畸形串不抛/长密码。

const test = require('node:test');
const assert = require('node:assert');
const { hashPassword, verifyPassword } = require('../src/password');

test('哈希格式：32 hex 盐 + 128 hex 派生（64 字节）', async () => {
  const h = await hashPassword('password123');
  assert.match(h, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
});

test('盐唯一：同密码两次哈希存储串不同', async () => {
  const a = await hashPassword('password123');
  const b = await hashPassword('password123');
  assert.notStrictEqual(a, b);
});

test('验证通过：正确密码 true', async () => {
  const h = await hashPassword('password123');
  assert.strictEqual(await verifyPassword('password123', h), true);
});

test('验证失败：错误密码 false', async () => {
  const h = await hashPassword('password123');
  assert.strictEqual(await verifyPassword('wrong-password', h), false);
});

test('畸形存储串：false 不抛', async () => {
  assert.strictEqual(await verifyPassword('x', 'garbage'), false);
  assert.strictEqual(await verifyPassword('x', 'abc'), false); // 无冒号
  assert.strictEqual(await verifyPassword('x', ':abc'), false); // 空盐
  assert.strictEqual(await verifyPassword('x', 'abc:'), false); // 空哈希
  assert.strictEqual(await verifyPassword('x', null), false);
  assert.strictEqual(await verifyPassword('x', ''), false);
});

test('长密码：72 字符可哈希可验证', async () => {
  const long = 'x'.repeat(72);
  const h = await hashPassword(long);
  assert.strictEqual(await verifyPassword(long, h), true);
});
