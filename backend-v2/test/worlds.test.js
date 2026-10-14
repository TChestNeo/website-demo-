'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

test('worlds migration: 字段、索引与 owner/client 幂等约束就位', async () => {
  const t = await testApp();
  try {
    const cols = t.db.prepare('PRAGMA table_info(worlds)').all().map((x) => x.name);
    assert.deepStrictEqual(cols, [
      'seq', 'id', 'owner_id', 'type_key', 'name', 'description', 'metadata_json',
      'client_key', 'status', 'created_at', 'updated_at'
    ]);
    const indexes = t.db.prepare('PRAGMA index_list(worlds)').all();
    assert.ok(indexes.some((x) => x.name === 'idx_worlds_owner_created'));
    assert.ok(indexes.some((x) => x.name === 'idx_worlds_type_created'));
    assert.ok(indexes.some((x) => x.unique === 1), 'owner_id + client_key 应有唯一索引');
  } finally { await t.close(); }
});

test('worlds: 未登录不可读写；登录用户创建后只能读取自己的世界', async () => {
  const t = await testApp();
  try {
    assert.strictEqual((await t.request('GET', '/api/social/worlds')).status, 401);
    assert.strictEqual((await t.request('POST', '/api/social/worlds', {
      type: 'fantasy', name: 'No Session', clientKey: 'world-anon-0001'
    })).status, 401);

    const alice = t.loginAs('world-alice@example.com');
    const bob = t.loginAs('world-bob@example.com');
    const created = await t.request('POST', '/api/social/worlds', {
      id: 'WLD-local-should-be-overwritten',
      type: 'fantasy',
      name: '艾瑟兰大陆',
      lore: '龙与人类共存的古老大陆',
      clientKey: 'world-client-alice-0001',
      typeLabel: '奇幻世界',
      emoji: '✨',
      magic: '元素契约',
      createdAt: '2020-01-01T00:00:00.000Z',
      status: 'local'
    }, { cookie: alice.cookie });
    assert.strictEqual(created.status, 200);
    const body = await created.json();
    assert.strictEqual(body.idempotent, false);
    assert.match(body.world.id, /^WLD-\d{6}$/);
    assert.notStrictEqual(body.world.createdAt, '2020-01-01T00:00:00.000Z');
    assert.strictEqual(body.world.type, 'fantasy');
    assert.strictEqual(body.world.name, '艾瑟兰大陆');
    assert.strictEqual(body.world.description, '龙与人类共存的古老大陆');
    assert.strictEqual(body.world.lore, body.world.description);
    assert.strictEqual(body.world.typeLabel, '奇幻世界');
    assert.strictEqual(body.world.emoji, '✨');
    assert.strictEqual(body.world.magic, '元素契约');
    assert.strictEqual(body.world.metadata.magic, '元素契约');
    assert.strictEqual(body.world.status, 'active');

    const mine = await t.request('GET', '/api/social/worlds', undefined, { cookie: alice.cookie });
    assert.strictEqual(mine.status, 200);
    assert.deepStrictEqual((await mine.json()).worlds.map((w) => w.id), [body.world.id]);

    const others = await t.request('GET', '/api/social/worlds', undefined, { cookie: bob.cookie });
    assert.strictEqual(others.status, 200);
    assert.deepStrictEqual((await others.json()).worlds, []);
  } finally { await t.close(); }
});

test('worlds: 同一 owner/clientKey 重试返回原记录，不重复写入', async () => {
  const t = await testApp();
  try {
    const { cookie, user } = t.loginAs('world-idempotent@example.com');
    const payload = {
      type: 'scifi', name: '天琴殖民圈', description: '首次提交',
      clientKey: 'world-idempotent-0001', metadata: { emoji: '🚀', tech: '跃迁引擎' }
    };
    const first = await t.request('POST', '/api/social/worlds', payload, { cookie });
    const a = await first.json();
    const retry = await t.request('POST', '/api/social/worlds', {
      ...payload, name: '不应覆盖原记录', description: '重试载荷'
    }, { cookie });
    assert.strictEqual(retry.status, 200);
    const b = await retry.json();
    assert.strictEqual(b.idempotent, true);
    assert.strictEqual(b.world.id, a.world.id);
    assert.strictEqual(b.world.name, '天琴殖民圈');
    assert.strictEqual(t.db.prepare('SELECT count(*) AS n FROM worlds WHERE owner_id = ?').get(user.id).n, 1);
  } finally { await t.close(); }
});

test('worlds: 类型、名称、clientKey、简介与 metadata 校验', async () => {
  const t = await testApp();
  try {
    const { cookie } = t.loginAs('world-validation@example.com');
    const post = (body) => t.request('POST', '/api/social/worlds', body, { cookie });
    assert.strictEqual((await post({ type: 'nation', name: 'N', clientKey: 'world-valid-0001' })).status, 400);
    assert.strictEqual((await post({ type: 'bad type', name: 'N', clientKey: 'world-valid-0002' })).status, 400);
    assert.strictEqual((await post({ type: 'fantasy', name: '', clientKey: 'world-valid-0003' })).status, 400);
    assert.strictEqual((await post({ type: 'fantasy', name: 'N', clientKey: 'short' })).status, 400);
    assert.strictEqual((await post({
      type: 'fantasy', name: 'N', clientKey: 'world-valid-0004', description: 'x'.repeat(5001)
    })).status, 400);
    assert.strictEqual((await post({
      type: 'fantasy', name: 'N', clientKey: 'world-valid-0005', metadata: ['not', 'object']
    })).status, 400);
    assert.strictEqual((await post({
      type: 'fantasy', name: 'N', clientKey: 'world-valid-0006', metadata: { huge: 'x'.repeat(33 * 1024) }
    })).status, 400);
  } finally { await t.close(); }
});
