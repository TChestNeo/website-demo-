'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

const TICKET = {
  category: 'bug', type: 'display', contact: 'u@x.com',
  subject: '页面白屏', description: '打开地图页白屏', locale: 'zh',
  submittedAt: '2026-08-18T03:00:00.000Z',
};

test('工单：匿名提交契约形状（MN-年-6位seq/queued/position 递增）', async () => {
  const t = await testApp();
  try {
    const r1 = await t.request('POST', '/api/tickets', TICKET);
    assert.strictEqual(r1.status, 200);
    const d1 = await r1.json();
    assert.match(d1.id, /^MN-\d{4}-\d{6}$/);
    assert.strictEqual(d1.status, 'queued');
    assert.strictEqual(d1.position, 1);

    const d2 = await (await t.request('POST', '/api/tickets', TICKET)).json();
    assert.strictEqual(d2.position, 2);
    assert.ok(d1.id !== d2.id);

    // 更早提交的排前面（submittedAt 更早 → 新单 position 让位）
    const d3 = await (await t.request('POST', '/api/tickets', { ...TICKET, submittedAt: '2026-08-17T00:00:00.000Z' })).json();
    assert.strictEqual(d3.position, 1);
  } finally { await t.close(); }
});

test('工单：account/payment 自动 urgent；校验 400（category/contact/空描述）', async () => {
  const t = await testApp({ config: { rateLimits: { tickets: { max: 10, windowMs: 60000 } } } });
  try {
    const d = await (await t.request('POST', '/api/tickets', { ...TICKET, category: 'payment' })).json();
    const row = t.db.prepare('SELECT priority FROM tickets WHERE id = ?').get(d.id);
    assert.strictEqual(row.priority, 'urgent');

    assert.strictEqual((await t.request('POST', '/api/tickets', { ...TICKET, category: 'nope' })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/tickets', { ...TICKET, contact: 'no-at' })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/tickets', { ...TICKET, description: '  ' })).status, 400);
    // 契约允许缺失 submittedAt → 服务端当前时间兜底
    const d2 = await (await t.request('POST', '/api/tickets', { ...TICKET, submittedAt: undefined })).json();
    assert.ok(d2.id);
  } finally { await t.close(); }
});

test('工单：登录用户挂 user_id；未登录为 NULL', async () => {
  const t = await testApp();
  try {
    const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
    const d1 = await (await t.request('POST', '/api/tickets', TICKET, { cookie: alice.cookie })).json();
    assert.strictEqual(t.db.prepare('SELECT user_id FROM tickets WHERE id = ?').get(d1.id).user_id, alice.user.id);
    const d2 = await (await t.request('POST', '/api/tickets', TICKET)).json();
    assert.strictEqual(t.db.prepare('SELECT user_id FROM tickets WHERE id = ?').get(d2.id).user_id, null);
  } finally { await t.close(); }
});

test('工单限流：tickets 覆盖为 2 → 第 3 次 429', async () => {
  const t = await testApp({ config: { rateLimits: { tickets: { max: 2, windowMs: 600000 } } } });
  try {
    assert.strictEqual((await t.request('POST', '/api/tickets', TICKET)).status, 200);
    assert.strictEqual((await t.request('POST', '/api/tickets', TICKET)).status, 200);
    assert.strictEqual((await t.request('POST', '/api/tickets', TICKET)).status, 429);
  } finally { await t.close(); }
});

function insertBadge(db, code, over = {}) {
  const now = Date.now();
  db.prepare(`INSERT INTO badge_codes (code, alias, role, duties, bound_incident, issued_at, expires_at, revoked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(code, over.alias || '云雀', over.role || '客服专员', over.duties || '账号安全核查',
      over.bound_incident || 'DM-123', new Date(now - 60000).toISOString(),
      over.expires_at || new Date(now + 3600000).toISOString(), over.revoked_at || null);
}

test('徽章验证：有效码 200 全字段；错码/过期/吊销 404 invalid', async () => {
  const t = await testApp();
  try {
    insertBadge(t.db, 'A7K2Q9', { expires_at: new Date(Date.now() + 3600000).toISOString() });
    insertBadge(t.db, 'B8L3R0', { expires_at: new Date(Date.now() - 1000).toISOString() }); // 过期
    insertBadge(t.db, 'C9M4S1', { revoked_at: new Date().toISOString() }); // 吊销

    const ok = await t.request('POST', '/api/badge/verify', { code: 'a7k2q9' }); // 小写也过（归一化）
    assert.strictEqual(ok.status, 200);
    const d = await ok.json();
    assert.strictEqual(d.status, 'valid');
    assert.strictEqual(d.alias, '云雀');
    assert.strictEqual(d.role, '客服专员');
    assert.ok(d.duties && d.issuedAt && d.expiresAt);

    const bad = await t.request('POST', '/api/badge/verify', { code: 'ZZZZZZ' });
    assert.strictEqual(bad.status, 404);
    assert.deepStrictEqual(await bad.json(), { status: 'invalid' });
    assert.strictEqual((await t.request('POST', '/api/badge/verify', { code: 'B8L3R0' })).status, 404);
    assert.strictEqual((await t.request('POST', '/api/badge/verify', { code: 'C9M4S1' })).status, 404);
  } finally { await t.close(); }
});

test('徽章限流：badgeVerify 覆盖为 1 → 第 2 次 429', async () => {
  const t = await testApp({ config: { rateLimits: { badgeVerify: { max: 1, windowMs: 60000 } } } });
  try {
    insertBadge(t.db, 'A7K2Q9');
    assert.strictEqual((await t.request('POST', '/api/badge/verify', { code: 'A7K2Q9' })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/badge/verify', { code: 'A7K2Q9' })).status, 429);
  } finally { await t.close(); }
});
