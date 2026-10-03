'use strict';
// 私讯（P4）：明文存储 + 参与者级 ACL（用户锁定决策）。
// 设计红线：本文件不 require 任何审核模块（写入路径零审核 import）；
// 列表/消息仅会话成员可见。
// v2 差异：conversation_members/messages 多态（actor_type/sender_type user|staff，005 迁移）；
//   staff 调阅私讯不在此处——W3 staff conversations 模块（cs.conversations.* + view_dm 审计）接手。
// dm 去重：恰有两名成员且包含双方；last_read_at 存「已读到的最新消息 id」，
// 未读按 seq 比较（时间戳同毫秒也正确排序）。

const { HttpError, sendJson, readJson } = require('../../http');
const { requireSession } = require('../../middleware/auth');
const { insertWithId, pad6 } = require('../../ids');
const { membersOf, resolveTarget, createDm, acceptedFriends } = require('./dm-shared');

const MSG_MAX = 4000;
const PAGE_SIZE = 100;

function writeLimit(ctx) {
  const w = (ctx.config.rateLimits || {}).dmWrite || { max: 30, windowMs: 60000 };
  return ctx.limiter('dm:user:' + ctx.user.id, w.max, w.windowMs);
}

function requireMember(db, convId, userId) {
  const ok = db.prepare("SELECT 1 FROM conversation_members WHERE conversation_id = ? AND actor_type = 'user' AND actor_id = ?")
    .get(convId, userId);
  if (!ok) throw new HttpError('FORBIDDEN', '无权访问该会话');
}

function lastMessageOf(db, convId, userId) {
  return db.prepare(`
    SELECT m.id, m.sender_id, m.content, m.created_at FROM messages m
    WHERE m.conversation_id = ? AND (m.sender_deleted_at IS NULL OR m.sender_id != ?)
    ORDER BY m.seq DESC LIMIT 1
  `).get(convId, userId);
}

function unreadOf(db, convId, userId) {
  return db.prepare(`
    SELECT count(*) AS n FROM messages m
    WHERE m.conversation_id = ? AND m.sender_id != ?
      AND m.seq > coalesce(
        (SELECT x.seq FROM messages x WHERE x.id = (
          SELECT last_read_at FROM conversation_members
          WHERE conversation_id = ? AND actor_type = 'user' AND actor_id = ?)), -1)
  `).get(convId, userId, convId, userId).n;
}

// dm 去重/定位：见 dm-shared.js（与 friend-requests 共用同一身份逻辑）

function register(router, ctx) {
  const db = ctx.db;

  // ── 会话列表 ──
  router.add('GET', '/api/conversations', requireSession((req, res, c) => {
    const rows = c.db.prepare(`
      SELECT c.id, c.kind, c.name, c.created_at FROM conversations c
      JOIN conversation_members m ON m.conversation_id = c.id AND m.actor_type = 'user' AND m.actor_id = ?
      ORDER BY c.seq DESC
    `).all(c.user.id);
    sendJson(res, 200, {
      conversations: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        name: row.name || null, // kind='group' 群名（032 列；dm 恒 null）
        createdAt: row.created_at,
        members: membersOf(c.db, row.id),
        lastMessage: lastMessageOf(c.db, row.id, c.user.id),
        unreadCount: unreadOf(c.db, row.id, c.user.id),
      })),
    });
  }));

  // ── 建/取 dm（{userId} 或 {email}；去重；自己 → 400）──
  // FC v10.28.51.0 扩展：{kind:'group', name, memberIds} 建群（成员限好友，服务端校验；群名 1-60）
  router.add('POST', '/api/conversations', requireSession(async (req, res, c) => {
    const body = await readJson(req, 16 * 1024);
    if (body.kind === 'group') {
      const name = String(body.name || '').trim();
      if (!name || name.length > 60) throw new HttpError('VALIDATION', '群名需 1-60 字符');
      const ids = Array.isArray(body.memberIds) ? body.memberIds.map((x) => String(x || '')) : [];
      const friends = new Set(acceptedFriends(c.db, c.user.id).map((f) => f.id));
      const invitees = [];
      const seen = new Set();
      for (const id of ids) {
        if (!id || id === c.user.id) throw new HttpError('VALIDATION', '不能拉自己进群');
        if (seen.has(id)) continue;
        seen.add(id);
        if (!friends.has(id)) throw new HttpError('VALIDATION', '只能邀请你的好友进群');
        invitees.push(id);
      }
      const iso = new Date().toISOString();
      const { id } = insertWithId(c.db, 'conversations', ['kind', 'name', 'created_at'], ['group', name, iso], (s) => 'CONV-' + pad6(s));
      const ins = c.db.prepare("INSERT INTO conversation_members (conversation_id, actor_type, actor_id, last_read_at, joined_at) VALUES (?, 'user', ?, ?, ?)");
      ins.run(id, c.user.id, iso, iso);
      for (const uid of invitees) ins.run(id, uid, null, iso);
      sendJson(res, 200, { conversation: { id, kind: 'group', name, members: membersOf(c.db, id) }, created: true });
      return;
    }
    const target = resolveTarget(c.db, body);
    if (target.id === c.user.id) throw new HttpError('VALIDATION', '不能与自己私聊');

    const { id, created } = createDm(c.db, c.user.id, target.id);
    const row = c.db.prepare('SELECT kind, created_at FROM conversations WHERE id = ?').get(id);
    sendJson(res, 200, {
      conversation: { id, kind: row.kind, createdAt: row.created_at, members: membersOf(c.db, id) },
      created,
    });
  }));

  // ── 消息分页（?before=消息 id 游标，新→旧取 100 再反转；读取即标记已读）──
  router.add('GET', '/api/conversations/:id/messages', requireSession((req, res, c) => {
    requireMember(c.db, req.params.id, c.user.id);
    const before = new URLSearchParams((req.url || '').split('?')[1] || '').get('before');
    let rows;
    if (before) {
      const anchor = c.db.prepare('SELECT seq FROM messages WHERE id = ?').get(before);
      if (!anchor) throw new HttpError('NOT_FOUND', '游标消息不存在');
      rows = c.db.prepare(`
        SELECT * FROM messages
        WHERE conversation_id = ? AND seq < ?
          AND (sender_deleted_at IS NULL OR sender_id != ?)
        ORDER BY seq DESC LIMIT ?
      `).all(req.params.id, anchor.seq, c.user.id, PAGE_SIZE + 1);
    } else {
      rows = c.db.prepare(`
        SELECT * FROM messages
        WHERE conversation_id = ? AND (sender_deleted_at IS NULL OR sender_id != ?)
        ORDER BY seq DESC LIMIT ?
      `).all(req.params.id, c.user.id, PAGE_SIZE + 1);
    }
    const hasMore = rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE).reverse();
    const names = {};
    page.forEach((m) => { if (m.sender_type === 'user' && !names[m.sender_id]) names[m.sender_id] = true; });
    const nameRows = Object.keys(names).length
      ? c.db.prepare('SELECT id, display_name FROM users WHERE id IN (' +
        Object.keys(names).map(() => '?').join(',') + ')').all(...Object.keys(names)) : [];
    const nameOf = {};
    nameRows.forEach((r) => { nameOf[r.id] = r.display_name; });
    if (page.length) {
      c.db.prepare("UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND actor_type = 'user' AND actor_id = ?")
        .run(page[page.length - 1].id, req.params.id, c.user.id);
    }
    sendJson(res, 200, {
      messages: page.map((m) => ({ id: m.id, senderId: m.sender_id, senderName: nameOf[m.sender_id] || '?', content: m.content, createdAt: m.created_at })),
      hasMore,
    });
  }));

  // ── 发送（≤4000 字；零审核 import）──
  router.add('POST', '/api/conversations/:id/messages', requireSession(async (req, res, c) => {
    requireMember(c.db, req.params.id, c.user.id);
    if (!writeLimit(c)) throw new HttpError('RATE_LIMITED', '操作过于频繁');
    const body = await readJson(req, 8 * 1024);
    const content = String(body.content || '');
    if (!content.trim()) throw new HttpError('VALIDATION', '消息不能为空');
    if (content.length > MSG_MAX) throw new HttpError('VALIDATION', `消息最长 ${MSG_MAX} 字符`);
    const iso = new Date().toISOString();
    const { id } = insertWithId(c.db, 'messages', ['conversation_id', 'sender_type', 'sender_id', 'content', 'created_at'],
      [req.params.id, 'user', c.user.id, content, iso], (s) => 'MSG-' + pad6(s));
    c.db.prepare("UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND actor_type = 'user' AND actor_id = ?")
      .run(id, req.params.id, c.user.id);
    sendJson(res, 200, {
      message: { id, senderId: c.user.id, senderName: c.user.display_name, content, createdAt: iso },
    });
  }));
}

module.exports = { register };
