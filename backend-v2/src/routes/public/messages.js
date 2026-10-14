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
const { membersOf, resolveTarget, findDm, createDm, acceptedFriends } = require('./dm-shared');

const MSG_MAX = 4000;
const PAGE_SIZE = 100;
const FORWARD_MAX_TARGETS = 20;

function writeLimit(ctx) {
  const w = (ctx.config.rateLimits || {}).dmWrite || { max: 30, windowMs: 60000 };
  return ctx.limiter('dm:user:' + ctx.user.id, w.max, w.windowMs);
}

function requireMember(db, convId, userId) {
  const ok = db.prepare("SELECT 1 FROM conversation_members WHERE conversation_id = ? AND actor_type = 'user' AND actor_id = ?")
    .get(convId, userId);
  if (!ok) throw new HttpError('FORBIDDEN', '无权访问该会话');
}

function lastMessageOf(db, convId) {
  const m = db.prepare(`
    SELECT m.id, m.sender_id, m.content, m.created_at FROM messages m
    WHERE m.conversation_id = ? AND m.sender_deleted_at IS NULL
    ORDER BY m.seq DESC LIMIT 1
  `).get(convId);
  return m ? { id: m.id, senderId: m.sender_id, content: m.content, createdAt: m.created_at } : undefined;
}

function unreadOf(db, convId, userId) {
  return db.prepare(`
    SELECT count(*) AS n FROM messages m
    WHERE m.conversation_id = ? AND m.sender_id != ?
      AND m.sender_deleted_at IS NULL
      AND m.seq > coalesce(
        (SELECT x.seq FROM messages x WHERE x.id = (
          SELECT last_read_at FROM conversation_members
          WHERE conversation_id = ? AND actor_type = 'user' AND actor_id = ?)), -1)
  `).get(convId, userId, convId, userId).n;
}

function nameMapFor(db, rows) {
  const ids = [...new Set(rows
    .filter((m) => m.sender_type === 'user')
    .map((m) => m.sender_id))];
  if (!ids.length) return {};
  const found = db.prepare('SELECT id, display_name FROM users WHERE id IN (' +
    ids.map(() => '?').join(',') + ')').all(...ids);
  const out = {};
  found.forEach((r) => { out[r.id] = r.display_name; });
  return out;
}

function messageShape(m, names, pinned) {
  const out = {
    id: m.id,
    senderId: m.sender_id,
    senderName: names[m.sender_id] || '?',
    content: m.content,
    createdAt: m.created_at,
    pinned: !!pinned
  };
  if (m.forwarded_from_message_id) {
    out.forwardedFrom = {
      messageId: m.forwarded_from_message_id,
      senderId: m.forwarded_from_sender_id || null,
      senderName: m.forwarded_from_sender_name || m.forwarded_from_sender_id || '?'
    };
  }
  return out;
}

function shapeMessages(db, rows, pinnedIds) {
  const names = nameMapFor(db, rows);
  return rows.map((m) => messageShape(m, names, pinnedIds && pinnedIds.has(m.id)));
}

function pinnedIdsOf(db, convId, userId) {
  return new Set(db.prepare(
    'SELECT message_id FROM message_pins WHERE conversation_id = ? AND user_id = ?'
  ).all(convId, userId).map((r) => r.message_id));
}

function sourceSenderName(db, message) {
  if (message.forwarded_from_message_id) {
    return message.forwarded_from_sender_name || message.forwarded_from_sender_id || '?';
  }
  if (message.sender_type === 'user') {
    const u = db.prepare('SELECT display_name FROM users WHERE id = ?').get(message.sender_id);
    return (u && u.display_name) || message.sender_id;
  }
  const s = db.prepare('SELECT alias, real_name FROM staff WHERE id = ?').get(message.sender_id);
  return (s && (s.alias || s.real_name)) || message.sender_id;
}

function allowsNewDm(target) {
  if (!target || !target.preferences) return true;
  try {
    const preferences = JSON.parse(target.preferences);
    return !preferences || preferences.allow_dm !== false;
  } catch {
    return true; // 历史坏值按默认允许处理，避免意外锁死账号
  }
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
        lastMessage: lastMessageOf(c.db, row.id),
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

    const existing = findDm(c.db, c.user.id, target.id);
    if (!existing && !allowsNewDm(target)) {
      const isFriend = acceptedFriends(c.db, c.user.id).some((f) => f.id === target.id);
      if (!isFriend) throw new HttpError('FORBIDDEN', '对方已关闭陌生人私信');
    }

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
      const anchor = c.db.prepare('SELECT seq FROM messages WHERE id = ? AND conversation_id = ?')
        .get(before, req.params.id);
      if (!anchor) throw new HttpError('NOT_FOUND', '游标消息不存在');
      rows = c.db.prepare(`
        SELECT * FROM messages
        WHERE conversation_id = ? AND seq < ?
          AND sender_deleted_at IS NULL
        ORDER BY seq DESC LIMIT ?
      `).all(req.params.id, anchor.seq, PAGE_SIZE + 1);
    } else {
      rows = c.db.prepare(`
        SELECT * FROM messages
        WHERE conversation_id = ? AND sender_deleted_at IS NULL
        ORDER BY seq DESC LIMIT ?
      `).all(req.params.id, PAGE_SIZE + 1);
    }
    const hasMore = rows.length > PAGE_SIZE;
    const page = rows.slice(0, PAGE_SIZE).reverse();
    if (page.length) {
      c.db.prepare("UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND actor_type = 'user' AND actor_id = ?")
        .run(page[page.length - 1].id, req.params.id, c.user.id);
    }
    sendJson(res, 200, {
      messages: shapeMessages(c.db, page, pinnedIdsOf(c.db, req.params.id, c.user.id)),
      hasMore,
    });
  }));

  // ── 每用户置顶列表：与聊天信息页一致，其他成员的置顶互不影响 ──
  router.add('GET', '/api/conversations/:id/pinned-messages', requireSession((req, res, c) => {
    requireMember(c.db, req.params.id, c.user.id);
    const rows = c.db.prepare(`
      SELECT m.* FROM message_pins p
      JOIN messages m ON m.id = p.message_id
      WHERE p.conversation_id = ? AND p.user_id = ? AND m.sender_deleted_at IS NULL
      ORDER BY p.pinned_at DESC
    `).all(req.params.id, c.user.id);
    sendJson(res, 200, { messages: shapeMessages(c.db, rows, new Set(rows.map((m) => m.id))) });
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
      message: { id, senderId: c.user.id, senderName: c.user.display_name, content, createdAt: iso, pinned: false },
    });
  }));

  // ── 删除自己的消息：幂等软删；所有成员的列表/未读/最后一条消息都立即忽略 ──
  router.add('DELETE', '/api/conversations/:id/messages/:messageId', requireSession((req, res, c) => {
    requireMember(c.db, req.params.id, c.user.id);
    const message = c.db.prepare('SELECT * FROM messages WHERE id = ? AND conversation_id = ?')
      .get(req.params.messageId, req.params.id);
    if (!message) throw new HttpError('NOT_FOUND', '消息不存在');
    if (message.sender_type !== 'user' || message.sender_id !== c.user.id) {
      throw new HttpError('FORBIDDEN', '只能删除自己发送的消息');
    }
    const iso = message.sender_deleted_at || new Date().toISOString();
    c.db.transaction(() => {
      if (!message.sender_deleted_at) {
        c.db.prepare('UPDATE messages SET sender_deleted_at = ? WHERE id = ? AND sender_deleted_at IS NULL')
          .run(iso, message.id);
      }
      c.db.prepare('DELETE FROM message_pins WHERE message_id = ?').run(message.id);
    })();
    sendJson(res, 200, { deleted: true, messageId: message.id, deletedAt: iso });
  }));

  // ── 每用户置顶/取消置顶：PATCH {pinned:boolean}，重复调用保持幂等 ──
  router.add('PATCH', '/api/conversations/:id/messages/:messageId/pin', requireSession(async (req, res, c) => {
    requireMember(c.db, req.params.id, c.user.id);
    const body = await readJson(req, 1024);
    if (typeof body.pinned !== 'boolean') throw new HttpError('VALIDATION', 'pinned 必须是布尔值');
    const message = c.db.prepare(`SELECT id FROM messages
      WHERE id = ? AND conversation_id = ? AND sender_deleted_at IS NULL`)
      .get(req.params.messageId, req.params.id);
    if (!message) throw new HttpError('NOT_FOUND', '消息不存在');
    let pinnedAt = null;
    if (body.pinned) {
      const iso = new Date().toISOString();
      c.db.prepare(`INSERT OR IGNORE INTO message_pins
        (conversation_id, message_id, user_id, pinned_at) VALUES (?, ?, ?, ?)`)
        .run(req.params.id, message.id, c.user.id, iso);
      const row = c.db.prepare('SELECT pinned_at FROM message_pins WHERE user_id = ? AND message_id = ?')
        .get(c.user.id, message.id);
      pinnedAt = row && row.pinned_at;
    } else {
      c.db.prepare('DELETE FROM message_pins WHERE user_id = ? AND message_id = ?')
        .run(c.user.id, message.id);
    }
    sendJson(res, 200, { messageId: message.id, pinned: body.pinned, pinnedAt });
  }));

  // ── 转发：一次请求原子写入全部目标；任何成员校验失败都不会产生部分成功 ──
  router.add('POST', '/api/conversations/:id/messages/:messageId/forward', requireSession(async (req, res, c) => {
    requireMember(c.db, req.params.id, c.user.id);
    if (!writeLimit(c)) throw new HttpError('RATE_LIMITED', '操作过于频繁');
    const source = c.db.prepare(`SELECT * FROM messages
      WHERE id = ? AND conversation_id = ? AND sender_deleted_at IS NULL`)
      .get(req.params.messageId, req.params.id);
    if (!source) throw new HttpError('NOT_FOUND', '原消息不存在或已删除');
    const body = await readJson(req, 16 * 1024);
    if (!Array.isArray(body.conversationIds)) throw new HttpError('VALIDATION', 'conversationIds 必须是数组');
    const targetIds = [...new Set(body.conversationIds.map((x) => String(x || '').trim()).filter(Boolean))];
    if (!targetIds.length || targetIds.length > FORWARD_MAX_TARGETS) {
      throw new HttpError('VALIDATION', `每次可转发到 1-${FORWARD_MAX_TARGETS} 个会话`);
    }
    const extra = String(body.content || '');
    if (extra.length > MSG_MAX) throw new HttpError('VALIDATION', `补充消息最长 ${MSG_MAX} 字符`);
    targetIds.forEach((id) => requireMember(c.db, id, c.user.id));

    const provenance = source.forwarded_from_message_id ? {
      messageId: source.forwarded_from_message_id,
      senderId: source.forwarded_from_sender_id || null,
      senderName: source.forwarded_from_sender_name || source.forwarded_from_sender_id || '?'
    } : {
      messageId: source.id,
      senderId: source.sender_id,
      senderName: sourceSenderName(c.db, source)
    };
    const results = c.db.transaction(() => targetIds.map((conversationId) => {
      const iso = new Date().toISOString();
      const forwarded = insertWithId(c.db, 'messages',
        ['conversation_id', 'sender_type', 'sender_id', 'content', 'created_at',
          'forwarded_from_message_id', 'forwarded_from_sender_id', 'forwarded_from_sender_name'],
        [conversationId, 'user', c.user.id, source.content, iso,
          provenance.messageId, provenance.senderId, provenance.senderName],
        (s) => 'MSG-' + pad6(s));
      const message = {
        id: forwarded.id, senderId: c.user.id, senderName: c.user.display_name,
        content: source.content, createdAt: iso, pinned: false, forwardedFrom: provenance
      };
      let supplementalMessage = null;
      let lastId = forwarded.id;
      if (extra.trim()) {
        const extraIso = new Date().toISOString();
        const supplemental = insertWithId(c.db, 'messages',
          ['conversation_id', 'sender_type', 'sender_id', 'content', 'created_at'],
          [conversationId, 'user', c.user.id, extra, extraIso], (s) => 'MSG-' + pad6(s));
        lastId = supplemental.id;
        supplementalMessage = {
          id: supplemental.id, senderId: c.user.id, senderName: c.user.display_name,
          content: extra, createdAt: extraIso, pinned: false
        };
      }
      c.db.prepare("UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND actor_type = 'user' AND actor_id = ?")
        .run(lastId, conversationId, c.user.id);
      return { conversationId, message, supplementalMessage };
    }))();
    sendJson(res, 200, { forwards: results });
  }));
}

module.exports = { register };
