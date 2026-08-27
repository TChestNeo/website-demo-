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

test('dm 创建：按 userId；去重返回同一会话；email 同样可定位；自己/查无 400/404', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupTrio(t);
    const r1 = await t.request('POST', '/api/conversations', { userId: bob.user.id }, { cookie: alice.cookie });
    assert.strictEqual(r1.status, 200);
    const d1 = await r1.json();
    assert.match(d1.conversation.id, /^CONV-\d{6}$/);
    assert.strictEqual(d1.created, true);
    assert.strictEqual(d1.conversation.members.length, 2);

    const r2 = await t.request('POST', '/api/conversations', { email: 'bob@x.com' }, { cookie: alice.cookie });
    const d2 = await r2.json();
    assert.strictEqual(d2.created, false);
    assert.strictEqual(d2.conversation.id, d1.conversation.id);

    const self = await t.request('POST', '/api/conversations', { userId: alice.user.id }, { cookie: alice.cookie });
    assert.strictEqual(self.status, 400);
    const none = await t.request('POST', '/api/conversations', { email: 'nobody@x.com' }, { cookie: alice.cookie });
    assert.strictEqual(none.status, 404);
  } finally { await t.close(); }
});

test('消息发送/读取：A↔B 互见且 senderName 内联；C 列表 403；未读数正确', async () => {
  const t = await testApp();
  try {
    const { alice, bob, carol } = await setupTrio(t);
    const conv = (await (await t.request('POST', '/api/conversations', { userId: bob.user.id }, { cookie: alice.cookie })).json()).conversation;

    const s1 = await t.request('POST', `/api/conversations/${conv.id}/messages`, { content: 'hi bob' }, { cookie: alice.cookie });
    assert.strictEqual(s1.status, 200);
    assert.match((await s1.json()).message.id, /^MSG-\d{6}$/);

    // bob 看得到 + 未读 1；carol 403
    const bobList = (await (await t.request('GET', '/api/conversations', undefined, { cookie: bob.cookie })).json()).conversations;
    assert.strictEqual(bobList.length, 1);
    assert.strictEqual(bobList[0].unreadCount, 1);
    assert.strictEqual(bobList[0].lastMessage.content, 'hi bob');
    assert.strictEqual((await t.request('GET', `/api/conversations/${conv.id}/messages`, undefined, { cookie: carol.cookie })).status, 403);

    // bob 回复：发送即已读（回复方未读归零）；未读落在收件人侧（读取前断言）
    await t.request('POST', `/api/conversations/${conv.id}/messages`, { content: 'hey alice' }, { cookie: bob.cookie });
    const bobList2 = (await (await t.request('GET', '/api/conversations', undefined, { cookie: bob.cookie })).json()).conversations;
    assert.strictEqual(bobList2[0].unreadCount, 0);
    const aliceList2 = (await (await t.request('GET', '/api/conversations', undefined, { cookie: alice.cookie })).json()).conversations;
    assert.strictEqual(aliceList2[0].unreadCount, 1);

    // alice 读 → 两方向 senderName 内联；未读清零
    const aliceMsgs = (await (await t.request('GET', `/api/conversations/${conv.id}/messages`, undefined, { cookie: alice.cookie })).json()).messages;
    assert.strictEqual(aliceMsgs.length, 2);
    assert.strictEqual(aliceMsgs[0].senderName, 'Alice');
    assert.strictEqual(aliceMsgs[1].senderName, 'Bob');
    assert.strictEqual(aliceMsgs[1].content, 'hey alice');
    const aliceList3 = (await (await t.request('GET', '/api/conversations', undefined, { cookie: alice.cookie })).json()).conversations;
    assert.strictEqual(aliceList3[0].unreadCount, 0);
  } finally { await t.close(); }
});

test('消息校验：空/超长 400；非成员发送 403；无会话 401', async () => {
  const t = await testApp();
  try {
    const { alice, bob } = await setupTrio(t);
    const conv = (await (await t.request('POST', '/api/conversations', { userId: bob.user.id }, { cookie: alice.cookie })).json()).conversation;
    const empty = await t.request('POST', `/api/conversations/${conv.id}/messages`, { content: '   ' }, { cookie: alice.cookie });
    assert.strictEqual(empty.status, 400);
    const long = await t.request('POST', `/api/conversations/${conv.id}/messages`, { content: 'x'.repeat(4001) }, { cookie: alice.cookie });
    assert.strictEqual(long.status, 400);
    const anon = await t.request('POST', `/api/conversations/${conv.id}/messages`, { content: 'hi' });
    assert.strictEqual(anon.status, 401);
  } finally { await t.close(); }
});

test('分页：before 游标 + hasMore（每页 100）', async () => {
  const t = await testApp({ config: { rateLimits: { dmWrite: { max: 200, windowMs: 60000 } } } });
  try {
    const { alice, bob } = await setupTrio(t);
    const conv = (await (await t.request('POST', '/api/conversations', { userId: bob.user.id }, { cookie: alice.cookie })).json()).conversation;
    for (let i = 1; i <= 150; i++) {
      await t.request('POST', `/api/conversations/${conv.id}/messages`, { content: 'm' + i }, { cookie: alice.cookie });
    }
    const p1 = (await (await t.request('GET', `/api/conversations/${conv.id}/messages`, undefined, { cookie: bob.cookie })).json());
    assert.strictEqual(p1.messages.length, 100);
    assert.strictEqual(p1.messages[0].content, 'm51'); // 新→旧取 100 再反转为旧→新
    assert.strictEqual(p1.messages[99].content, 'm150');
    assert.strictEqual(p1.hasMore, true);

    const p2 = (await (await t.request('GET', `/api/conversations/${conv.id}/messages?before=${p1.messages[0].id}`, undefined, { cookie: bob.cookie })).json());
    assert.strictEqual(p2.messages.length, 50);
    assert.strictEqual(p2.messages[0].content, 'm1');
    assert.strictEqual(p2.messages[49].content, 'm50');
    assert.strictEqual(p2.hasMore, false);
  } finally { await t.close(); }
});

// v2 注：staff 调阅私讯推迟到 W3 staff conversations 模块（cs.conversations.* + view_dm 审计），
// 公网 messages.js 不再有 /api/admin/* 路由——该测试随模块在 W3 以 staff 会话形态重建。

test('写限流：dmWrite 覆盖为 2 → 第 3 条 429', async () => {
  const t = await testApp({ config: { rateLimits: { dmWrite: { max: 2, windowMs: 60000 } } } });
  try {
    const { alice, bob } = await setupTrio(t);
    const conv = (await (await t.request('POST', '/api/conversations', { userId: bob.user.id }, { cookie: alice.cookie })).json()).conversation;
    assert.strictEqual((await t.request('POST', `/api/conversations/${conv.id}/messages`, { content: 'a' }, { cookie: alice.cookie })).status, 200);
    assert.strictEqual((await t.request('POST', `/api/conversations/${conv.id}/messages`, { content: 'b' }, { cookie: alice.cookie })).status, 200);
    assert.strictEqual((await t.request('POST', `/api/conversations/${conv.id}/messages`, { content: 'c' }, { cookie: alice.cookie })).status, 429);
  } finally { await t.close(); }
});
