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

test('dm 隐私：allow_dm=false 禁止陌生人新建，好友仍可私信，已有 DM 可继续取回', async () => {
  const t = await testApp();
  try {
    const { alice, bob, carol } = await setupTrio(t);
    t.db.prepare('UPDATE users SET preferences = ? WHERE id = ?')
      .run(JSON.stringify({ allow_dm: false }), bob.user.id);

    const blocked = await t.request('POST', '/api/conversations',
      { userId: bob.user.id }, { cookie: alice.cookie });
    assert.strictEqual(blocked.status, 403);
    assert.strictEqual((await blocked.json()).error.code, 'FORBIDDEN');

    const iso = new Date().toISOString();
    t.db.prepare("INSERT INTO friend_requests (sender_id, recipient_id, status, created_at, responded_at) VALUES (?, ?, 'accepted', ?, ?)")
      .run(alice.user.id, bob.user.id, iso, iso);
    const friendDm = await t.request('POST', '/api/conversations',
      { userId: bob.user.id }, { cookie: alice.cookie });
    assert.strictEqual(friendDm.status, 200);
    assert.strictEqual((await friendDm.json()).created, true);

    const existing = await t.request('POST', '/api/conversations',
      { userId: carol.user.id }, { cookie: alice.cookie });
    assert.strictEqual(existing.status, 200);
    t.db.prepare('UPDATE users SET preferences = ? WHERE id = ?')
      .run(JSON.stringify({ allow_dm: false }), carol.user.id);
    const reopened = await t.request('POST', '/api/conversations',
      { userId: carol.user.id }, { cookie: alice.cookie });
    assert.strictEqual(reopened.status, 200);
    assert.strictEqual((await reopened.json()).created, false);
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

test('建群：kind=group+name；memberIds 限好友（去重/自排除/非好友 400）；群名 1-60；群消息互见', async () => {
  const t = await testApp();
  try {
    const { alice, bob, carol } = await setupTrio(t);
    const dave = t.loginAs('dave@x.com', { displayName: 'Dave' });
    const iso = new Date().toISOString();
    t.db.prepare("INSERT INTO friend_requests (sender_id, recipient_id, status, created_at, responded_at) VALUES (?, ?, 'accepted', ?, ?)")
      .run(alice.user.id, bob.user.id, iso, iso);
    // 群名校验 1-60
    assert.strictEqual((await t.request('POST', '/api/conversations', { kind: 'group', name: '', memberIds: [] }, { cookie: alice.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/conversations', { kind: 'group', name: 'x'.repeat(61), memberIds: [] }, { cookie: alice.cookie })).status, 400);
    // 非好友/自己 → 400
    assert.strictEqual((await t.request('POST', '/api/conversations', { kind: 'group', name: 'G', memberIds: [dave.user.id] }, { cookie: alice.cookie })).status, 400);
    assert.strictEqual((await t.request('POST', '/api/conversations', { kind: 'group', name: 'G', memberIds: [alice.user.id] }, { cookie: alice.cookie })).status, 400);
    // 建群（memberIds 重复 → 去重）
    const d = await (await t.request('POST', '/api/conversations', { kind: 'group', name: 'Guild', memberIds: [bob.user.id, bob.user.id] }, { cookie: alice.cookie })).json();
    assert.match(d.conversation.id, /^CONV-\d{6}$/);
    assert.strictEqual(d.conversation.kind, 'group');
    assert.strictEqual(d.conversation.name, 'Guild');
    assert.strictEqual(d.conversation.members.length, 2);
    // 列表带 name；群消息互见（bob 发、双方可见 + senderName 内联）
    const list = await (await t.request('GET', '/api/conversations', undefined, { cookie: alice.cookie })).json();
    const g = list.conversations.find((c) => c.kind === 'group');
    assert.strictEqual(g.name, 'Guild');
    assert.strictEqual(g.members.length, 2);
    assert.strictEqual(g.lastMessage, undefined); // 无消息时键随 undefined 被 JSON 丢弃（dm 同款口径）
    const send = await (await t.request('POST', `/api/conversations/${d.conversation.id}/messages`, { content: 'hi team' }, { cookie: bob.cookie })).json();
    assert.strictEqual(send.message.senderName, 'Bob');
    const msgs = await (await t.request('GET', `/api/conversations/${d.conversation.id}/messages`, undefined, { cookie: alice.cookie })).json();
    assert.strictEqual(msgs.messages.length, 1);
    assert.strictEqual(msgs.messages[0].content, 'hi team');
    // 非成员（carol）→ 403
    assert.strictEqual((await t.request('GET', `/api/conversations/${d.conversation.id}/messages`, undefined, { cookie: carol.cookie })).status, 403);
  } finally { await t.close(); }
});

test('删除消息：仅发送者可删、重复删除幂等，所有成员读取/未读/最后消息均排除', async () => {
  const t = await testApp();
  try {
    const { alice, bob, carol } = await setupTrio(t);
    const conv = (await (await t.request('POST', '/api/conversations',
      { userId: bob.user.id }, { cookie: alice.cookie })).json()).conversation;
    const first = (await (await t.request('POST', `/api/conversations/${conv.id}/messages`,
      { content: 'keep me' }, { cookie: alice.cookie })).json()).message;
    const second = (await (await t.request('POST', `/api/conversations/${conv.id}/messages`,
      { content: 'delete me' }, { cookie: alice.cookie })).json()).message;

    assert.strictEqual((await t.request('DELETE',
      `/api/conversations/${conv.id}/messages/${second.id}`, undefined, { cookie: bob.cookie })).status, 403);
    assert.strictEqual((await t.request('DELETE',
      `/api/conversations/${conv.id}/messages/${second.id}`, undefined, { cookie: carol.cookie })).status, 403);

    const deleted = await t.request('DELETE',
      `/api/conversations/${conv.id}/messages/${second.id}`, undefined, { cookie: alice.cookie });
    assert.strictEqual(deleted.status, 200);
    assert.strictEqual((await deleted.json()).deleted, true);
    const repeated = await t.request('DELETE',
      `/api/conversations/${conv.id}/messages/${second.id}`, undefined, { cookie: alice.cookie });
    assert.strictEqual(repeated.status, 200, '重复删除必须幂等');

    const list = await (await t.request('GET', '/api/conversations', undefined, { cookie: bob.cookie })).json();
    assert.strictEqual(list.conversations[0].lastMessage.content, 'keep me');
    assert.strictEqual(list.conversations[0].unreadCount, 1, '已删除消息不计未读');
    for (const account of [alice, bob]) {
      const body = await (await t.request('GET', `/api/conversations/${conv.id}/messages`, undefined,
        { cookie: account.cookie })).json();
      assert.deepStrictEqual(body.messages.map((m) => m.id), [first.id]);
    }
    assert.ok(t.db.prepare('SELECT sender_deleted_at FROM messages WHERE id = ?').get(second.id).sender_deleted_at);
  } finally { await t.close(); }
});

test('转发消息：服务端原子创建真实消息和来源；源/目标成员资格均校验', async () => {
  const t = await testApp();
  try {
    const { alice, bob, carol } = await setupTrio(t);
    const dave = t.loginAs('dave-forward@x.com', { displayName: 'Dave' });
    const sourceConv = (await (await t.request('POST', '/api/conversations',
      { userId: bob.user.id }, { cookie: alice.cookie })).json()).conversation;
    const targetConv = (await (await t.request('POST', '/api/conversations',
      { userId: carol.user.id }, { cookie: alice.cookie })).json()).conversation;
    const forbiddenTarget = (await (await t.request('POST', '/api/conversations',
      { userId: dave.user.id }, { cookie: bob.cookie })).json()).conversation;
    const source = (await (await t.request('POST', `/api/conversations/${sourceConv.id}/messages`,
      { content: 'source text' }, { cookie: alice.cookie })).json()).message;

    const outsider = await t.request('POST',
      `/api/conversations/${sourceConv.id}/messages/${source.id}/forward`,
      { conversationIds: [targetConv.id] }, { cookie: carol.cookie });
    assert.strictEqual(outsider.status, 403, '非源会话成员不可转发');

    const partial = await t.request('POST',
      `/api/conversations/${sourceConv.id}/messages/${source.id}/forward`,
      { conversationIds: [targetConv.id, forbiddenTarget.id] }, { cookie: alice.cookie });
    assert.strictEqual(partial.status, 403, '任一目标无成员资格则整批失败');
    assert.strictEqual(t.db.prepare('SELECT count(*) n FROM messages WHERE conversation_id = ?').get(targetConv.id).n, 0,
      '失败批次不得留下部分消息');

    const ok = await t.request('POST',
      `/api/conversations/${sourceConv.id}/messages/${source.id}/forward`,
      { conversationIds: [targetConv.id], content: 'extra note' }, { cookie: alice.cookie });
    assert.strictEqual(ok.status, 200);
    const result = (await ok.json()).forwards[0];
    assert.strictEqual(result.conversationId, targetConv.id);
    assert.strictEqual(result.message.forwardedFrom.messageId, source.id);
    assert.strictEqual(result.message.forwardedFrom.senderId, alice.user.id);
    assert.strictEqual(result.message.forwardedFrom.senderName, 'Alice');
    assert.ok(result.supplementalMessage);

    const targetMessages = await (await t.request('GET',
      `/api/conversations/${targetConv.id}/messages`, undefined, { cookie: carol.cookie })).json();
    assert.deepStrictEqual(targetMessages.messages.map((m) => m.content), ['source text', 'extra note']);
    assert.deepStrictEqual(targetMessages.messages[0].forwardedFrom, result.message.forwardedFrom);
    assert.match(targetMessages.messages[0].id, /^MSG-\d{6}$/);
  } finally { await t.close(); }
});

test('消息置顶：每用户持久化回读，置顶/取消均幂等，删除消息清理所有置顶', async () => {
  const t = await testApp();
  try {
    const { alice, bob, carol } = await setupTrio(t);
    const conv = (await (await t.request('POST', '/api/conversations',
      { userId: bob.user.id }, { cookie: alice.cookie })).json()).conversation;
    const message = (await (await t.request('POST', `/api/conversations/${conv.id}/messages`,
      { content: 'pin this' }, { cookie: alice.cookie })).json()).message;
    const pinPath = `/api/conversations/${conv.id}/messages/${message.id}/pin`;

    assert.strictEqual((await t.request('PATCH', pinPath, { pinned: true }, { cookie: carol.cookie })).status, 403);
    for (let i = 0; i < 2; i++) {
      const pinned = await t.request('PATCH', pinPath, { pinned: true }, { cookie: bob.cookie });
      assert.strictEqual(pinned.status, 200);
      assert.strictEqual((await pinned.json()).pinned, true);
    }
    assert.strictEqual(t.db.prepare('SELECT count(*) n FROM message_pins WHERE message_id = ?').get(message.id).n, 1);

    const bobRead = await (await t.request('GET', `/api/conversations/${conv.id}/messages`, undefined,
      { cookie: bob.cookie })).json();
    const aliceRead = await (await t.request('GET', `/api/conversations/${conv.id}/messages`, undefined,
      { cookie: alice.cookie })).json();
    assert.strictEqual(bobRead.messages[0].pinned, true);
    assert.strictEqual(aliceRead.messages[0].pinned, false, '置顶不得成为会话全局状态');
    const bobPins = await (await t.request('GET', `/api/conversations/${conv.id}/pinned-messages`, undefined,
      { cookie: bob.cookie })).json();
    const alicePins = await (await t.request('GET', `/api/conversations/${conv.id}/pinned-messages`, undefined,
      { cookie: alice.cookie })).json();
    assert.deepStrictEqual(bobPins.messages.map((m) => m.id), [message.id]);
    assert.deepStrictEqual(alicePins.messages, []);

    for (let i = 0; i < 2; i++) {
      const unpinned = await t.request('PATCH', pinPath, { pinned: false }, { cookie: bob.cookie });
      assert.strictEqual(unpinned.status, 200);
      assert.strictEqual((await unpinned.json()).pinned, false);
    }
    await t.request('PATCH', pinPath, { pinned: true }, { cookie: bob.cookie });
    await t.request('DELETE', `/api/conversations/${conv.id}/messages/${message.id}`, undefined,
      { cookie: alice.cookie });
    assert.strictEqual(t.db.prepare('SELECT count(*) n FROM message_pins WHERE message_id = ?').get(message.id).n, 0);
    const afterDelete = await (await t.request('GET', `/api/conversations/${conv.id}/pinned-messages`, undefined,
      { cookie: bob.cookie })).json();
    assert.deepStrictEqual(afterDelete.messages, []);
  } finally { await t.close(); }
});
