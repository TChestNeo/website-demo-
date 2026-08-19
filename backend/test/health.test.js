'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

test('GET /api/health 返回 db ok，且迁移 001+002+003 全部 25 张表就位', async () => {
  const t = await testApp();
  try {
    const res = await t.request('GET', '/api/health');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.db, 'ok');
    assert.strictEqual(data.tables, 25);
    assert.strictEqual(t.db.pragma('user_version', { simple: true }), 3); // 001_init + 002_admin_decisions + 003_ledger
  } finally {
    await t.close();
  }
});

test('未知路径返回 404 + 统一错误形状', async () => {
  const t = await testApp();
  try {
    const res = await t.request('GET', '/api/nope');
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.deepStrictEqual(Object.keys(data.error).sort(), ['code', 'message']);
    assert.strictEqual(data.error.code, 'NOT_FOUND');
  } finally {
    await t.close();
  }
});

test('重复打开同一数据库不重复执行迁移（user_version 幂等）', async () => {
  const t = await testApp();
  try {
    const { openDb } = require('../src/db');
    openDb(t.dir + '/test.sqlite'); // 同文件再开一次，不抛错即幂等
    assert.strictEqual(t.db.pragma('user_version', { simple: true }), 3);
  } finally {
    await t.close();
  }
});
