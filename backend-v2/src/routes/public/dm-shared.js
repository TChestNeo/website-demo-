'use strict';
// dm 共享件（v0.2.51.0 从 messages.js 提取）：目标定位 / dm 去重 / 建会话——身份逻辑单一来源，
// messages.js 与 friend-requests.js 共用（好友请求 accept 自动建 DM 复用同一条去重路径）。
// 设计红线沿用：本文件不 require 任何审核模块（写入路径零审核 import）。

const { HttpError } = require('../../http');
const { insertWithId, pad6 } = require('../../ids');

function publicUser(row) {
  return { id: row.id, displayName: row.display_name, avatarUrl: row.avatar_url };
}

function membersOf(db, convId) {
  return db.prepare(`
    SELECT u.id, u.display_name, u.avatar_url FROM conversation_members m
    JOIN users u ON u.id = m.actor_id
    WHERE m.conversation_id = ? AND m.actor_type = 'user' ORDER BY m.joined_at
  `).all(convId).map(publicUser);
}

// 好友清单（FC v10.28.51.0 团队向导/建群共用）：accepted 好友（任一方向）——
// 与 fc-edges.js 好友集同口径（friend_requests status='accepted'，非 DM 存在即好友）。
function acceptedFriends(db, uid) {
  return db.prepare(`
    SELECT u.id, u.display_name, u.avatar_url, u.citizen_id FROM friend_requests fr
    JOIN users u ON u.id = CASE WHEN fr.sender_id = ? THEN fr.recipient_id ELSE fr.sender_id END
    WHERE fr.status = 'accepted' AND (fr.sender_id = ? OR fr.recipient_id = ?)
    ORDER BY fr.seq
  `).all(uid, uid, uid).map((r) => ({ id: r.id, displayName: r.display_name, avatarUrl: r.avatar_url, citizenId: r.citizen_id }));
}

// dm 去重：恰有两名成员且包含双方
function findDm(db, a, b) {
  return db.prepare(`
    SELECT c.id FROM conversations c
    JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.actor_type = 'user' AND m1.actor_id = ?
    JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.actor_type = 'user' AND m2.actor_id = ?
    WHERE c.kind = 'dm'
      AND (SELECT count(*) FROM conversation_members x WHERE x.conversation_id = c.id) = 2
    LIMIT 1
  `).get(a, b);
}

// 按 userId 或 email 定位目标用户（email 归一化精确匹配；查无 → 404 防枚举口径统一）
function resolveTarget(db, body) {
  let row = null;
  if (body.userId) row = db.prepare('SELECT * FROM users WHERE id = ?').get(String(body.userId));
  else if (body.email) {
    row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(body.email).trim().toLowerCase());
  }
  if (!row) throw new HttpError('NOT_FOUND', '找不到该用户');
  return row;
}

// 建/取 dm（幂等）：已有 → { id, created:false }；否则 CONV- 可读 id + 双成员（发起方已读、对方未读）
function createDm(db, a, b) {
  const existing = findDm(db, a, b);
  if (existing) return { id: existing.id, created: false };
  const iso = new Date().toISOString();
  const { id } = insertWithId(db, 'conversations', ['kind', 'created_at'], ['dm', iso], (s) => 'CONV-' + pad6(s));
  const ins = db.prepare("INSERT INTO conversation_members (conversation_id, actor_type, actor_id, last_read_at, joined_at) VALUES (?, 'user', ?, ?, ?)");
  ins.run(id, a, iso, iso);
  ins.run(id, b, null, iso);
  return { id, created: true };
}

module.exports = { publicUser, membersOf, findDm, resolveTarget, createDm, acceptedFriends };
