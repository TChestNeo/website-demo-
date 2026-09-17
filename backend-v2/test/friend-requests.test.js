'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { testApp } = require('./helpers');

// 三用户矩阵：alice ↔ bob 互见；carol 全 403
async function setupTrio(t) {
  const alice = t.loginAs('alice@x.com', { displayName: 'Alice' });
  const bob = t.loginAs('bob@x.com', { displayName: 'Bob' });
  const carol = t.loginAs('carol@x.com', { displayName: 'Carol' });
  return { alice, bob, carol };
}

test('发送/列表：alice→bob 待处理；bob 列表带发送方公开档案；alice 列表为空', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupTrio(t);
    const r1 = await t.request('POST', '/api/friend-requests', { userId: bob.user.id }, { cookie: alice.cookie });
    assert.strictEqual(r1.status, 200);
    const d1 = await r1.json();
    assert.match(d1.request.id, /^FR-\d{6}$/);
    assert.strictEqual(d1.request.status, 'pending');
    assert.ok(d1.request.createdAt);

    const bobList = await (await t.request('GET', '/api/friend-requests', undefined, { cookie: bob.cookie })).json();
    assert.strictEqual(bobList.requests.length, 1);
    assert.strictEqual(bobList.requests[0].sender.id, alice.user.id);
    assert.strictEqual(bobList.requests[0].sender.displayName, 'Alice');

    const aliceList = await (await t.request('GET', '/api/friend-requests', undefined, { cookie: alice.cookie })).json();
    assert.strictEqual(aliceList.requests.length, 0);
  } finally { await t.close(); }
});

test('发送校验：自己 400；查无 404；已是好友 409；双向重复待处理 409；拒绝后可再发', async () => {
  const t = await testApp();
  try {
    const { alice, bob, carol } = await setupTrio(t);
    const self = await t.request('POST', '/api/friend-requests', { userId: alice.user.id }, { cookie: alice.cookie });
    assert.strictEqual(self.status, 400);
    assert.strictEqual((await self.json()).error.code, 'VALIDATION');
    const none = await t.request('POST', '/api/friend-requests', { email: 'nobody@x.com' }, { cookie: alice.cookie });
    assert.strictEqual(none.status, 404);

    // 已是好友（先建 DM）→ 409
    await t.request('POST', '/api/conversations', { userId: carol.user.id }, { cookie: alice.cookie });
    const friends = await t.request('POST', '/api/friend-requests', { userId: carol.user.id }, { cookie: alice.cookie });
    assert.strictEqual(friends.status, 409);

    // 待处理重复：同方向 + 反方向都 409
    await t.request('POST', '/api/friend-requests', { userId: bob.user.id }, { cookie: alice.cookie });
    const dup = await t.request('POST', '/api/friend-requests', { userId: bob.user.id }, { cookie: alice.cookie });
    assert.strictEqual(dup.status, 409);
    const rev = await t.request('POST', '/api/friend-requests', { userId: alice.user.id }, { cookie: bob.cookie });
    assert.strictEqual(rev.status, 409);

    // 拒绝后可再发（新行）
    const id = (await (await t.request('GET', '/api/friend-requests', undefined, { cookie: bob.cookie })).json()).requests[0].id;
    await t.request('POST', `/api/friend-requests/${id}/decline`, undefined, { cookie: bob.cookie });
    const again = await t.request('POST', '/api/friend-requests', { userId: bob.user.id }, { cookie: alice.cookie });
    assert.strictEqual(again.status, 200);
  } finally { await t.close(); }
});

test('同意：自动建 DM 双方可见；重复 409 且不重复建；他人 403；查无 404', async () => {
  const t = await testApp();
  try {
    const { alice, bob, carol } = await setupTrio(t);
    await t.request('POST', '/api/friend-requests', { userId: bob.user.id }, { cookie: alice.cookie });
    const id = (await (await t.request('GET', '/api/friend-requests', undefined, { cookie: bob.cookie })).json()).requests[0].id;

    const ok = await t.request('POST', `/api/friend-requests/${id}/accept`, undefined, { cookie: bob.cookie });
    assert.strictEqual(ok.status, 200);
    const d = await ok.json();
    assert.strictEqual(d.accepted, true);
    assert.match(d.conversation.id, /^CONV-\d{6}$/);
    assert.strictEqual(d.conversation.members.length, 2);

    // 双方会话列表可见同一会话
    const aliceList = (await (await t.request('GET', '/api/conversations', undefined, { cookie: alice.cookie })).json()).conversations;
    const bobList = (await (await t.request('GET', '/api/conversations', undefined, { cookie: bob.cookie })).json()).conversations;
    assert.strictEqual(aliceList.length, 1);
    assert.strictEqual(aliceList[0].id, d.conversation.id);
    assert.strictEqual(bobList.length, 1);
    assert.strictEqual(bobList[0].id, d.conversation.id);

    // 重复 accept → 409；DM 不重复建；列表已清空
    assert.strictEqual((await t.request('POST', `/api/friend-requests/${id}/accept`, undefined, { cookie: bob.cookie })).status, 409);
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM conversations WHERE kind = 'dm'").get().n, 1);
    assert.strictEqual((await (await t.request('GET', '/api/friend-requests', undefined, { cookie: bob.cookie })).json()).requests.length, 0);

    // 他人操作 → 403；查无 → 404
    await t.request('POST', '/api/friend-requests', { userId: carol.user.id }, { cookie: alice.cookie });
    const cid = (await (await t.request('GET', '/api/friend-requests', undefined, { cookie: carol.cookie })).json()).requests[0].id;
    assert.strictEqual((await t.request('POST', `/api/friend-requests/${cid}/accept`, undefined, { cookie: bob.cookie })).status, 403);
    assert.strictEqual((await t.request('POST', '/api/friend-requests/FR-999999/accept', undefined, { cookie: carol.cookie })).status, 404);
  } finally { await t.close(); }
});

test('同意：DM 预存在时 accept 返回既有会话且不重复建（幂等）', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupTrio(t);
    const pre = (await (await t.request('POST', '/api/conversations', { userId: bob.user.id }, { cookie: alice.cookie })).json()).conversation;
    // 已是好友会 409——这里直接手插一条 pending 模拟边界（历史脏数据/并发时序）
    t.db.prepare("INSERT INTO friend_requests (id, sender_id, recipient_id, status, created_at) VALUES ('FR-000001', ?, ?, 'pending', ?)")
      .run(alice.user.id, bob.user.id, new Date().toISOString());
    const ok = await t.request('POST', '/api/friend-requests/FR-000001/accept', undefined, { cookie: bob.cookie });
    assert.strictEqual(ok.status, 200);
    const d = await ok.json();
    assert.strictEqual(d.conversation.id, pre.id);
    assert.strictEqual(t.db.prepare("SELECT count(*) AS n FROM conversations WHERE kind = 'dm'").get().n, 1);
  } finally { await t.close(); }
});

test('拒绝：declined 标记 + 列表清除；重复 409；他人 403', async () => {
  const t = await testApp();
  try {
    const { alice, bob, carol } = await setupTrio(t);
    await t.request('POST', '/api/friend-requests', { userId: bob.user.id }, { cookie: alice.cookie });
    const id = (await (await t.request('GET', '/api/friend-requests', undefined, { cookie: bob.cookie })).json()).requests[0].id;

    const ok = await t.request('POST', `/api/friend-requests/${id}/decline`, undefined, { cookie: bob.cookie });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual((await ok.json()).declined, true);
    assert.strictEqual((await (await t.request('GET', '/api/friend-requests', undefined, { cookie: bob.cookie })).json()).requests.length, 0);
    assert.strictEqual((await t.request('POST', `/api/friend-requests/${id}/decline`, undefined, { cookie: bob.cookie })).status, 409);
    // 已处理的行他人也 403（先 404 前先过归属检查口径与 accept 一致）
    assert.strictEqual((await t.request('POST', `/api/friend-requests/${id}/decline`, undefined, { cookie: carol.cookie })).status, 403);
  } finally { await t.close(); }
});

test('鉴权：四端点无 cookie 一律 401', async () => {
  const t = await testApp();
  try {
    assert.strictEqual((await t.request('POST', '/api/friend-requests', { userId: 'USR-000001' })).status, 401);
    assert.strictEqual((await t.request('GET', '/api/friend-requests')).status, 401);
    assert.strictEqual((await t.request('POST', '/api/friend-requests/FR-000001/accept')).status, 401);
    assert.strictEqual((await t.request('POST', '/api/friend-requests/FR-000001/decline')).status, 401);
  } finally { await t.close(); }
});

test('发送限流：friendRequest 覆盖为 2 → 第 3 条 429', async () => {
  const t = await testApp({ config: { rateLimits: { friendRequest: { max: 2, windowMs: 60000 } } } });
  try {
    const { alice, bob, carol } = await setupTrio(t);
    assert.strictEqual((await t.request('POST', '/api/friend-requests', { userId: bob.user.id }, { cookie: alice.cookie })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/friend-requests', { userId: carol.user.id }, { cookie: alice.cookie })).status, 200);
    assert.strictEqual((await t.request('POST', '/api/friend-requests', { email: 'dave@x.com' }, { cookie: alice.cookie })).status, 429);
  } finally { await t.close(); }
});
