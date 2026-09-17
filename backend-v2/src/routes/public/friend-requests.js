'use strict';
// 好友请求（v0.2.51.0 灵动岛通知 + 真实好友系统；friend_requests 表，025 迁移）。
// 设计：待处理重复守卫在应用层（任一方向仅一条 pending——同步单进程 check-then-insert 原子，
// 拒绝后可再请求）；accept 复用 dm-shared.createDm 自动建 DM（幂等防重）；
// 响应「恰好一次成功」——重复 accept/decline 一律 409。
// 红线沿用：零审核 import。

const { HttpError, sendJson, readJson } = require('../../http');
const { requireSession } = require('../../middleware/auth');
const { insertWithId, pad6 } = require('../../ids');
const { findDm, resolveTarget, membersOf, createDm } = require('./dm-shared');

function writeLimit(ctx) {
  const w = (ctx.config.rateLimits || {}).friendRequest || { max: 20, windowMs: 3600000 }; // 20/小时
  return ctx.limiter('fr:user:' + ctx.user.id, w.max, w.windowMs);
}

// 任一方向已有待处理请求（防止 A→B 与 B→A 双挂）
function pendingBetween(db, a, b) {
  return db.prepare(`
    SELECT id FROM friend_requests WHERE status = 'pending'
      AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
    LIMIT 1
  `).get(a, b, b, a);
}

function register(router, ctx) {
  const db = ctx.db;

  // ── 发送好友请求（{userId} 或 {email}；自己/已是好友/重复待处理 → 400/409）──
  router.add('POST', '/api/friend-requests', requireSession(async (req, res, c) => {
    if (!writeLimit(c)) throw new HttpError('RATE_LIMITED', '操作过于频繁');
    const body = await readJson(req, 16 * 1024);
    const target = resolveTarget(c.db, body);
    if (target.id === c.user.id) throw new HttpError('VALIDATION', '不能给自己发送好友请求');
    if (findDm(c.db, c.user.id, target.id)) throw new HttpError('CONFLICT', '你们已经是好友了');
    if (pendingBetween(c.db, c.user.id, target.id)) throw new HttpError('CONFLICT', '已有待处理的好友请求');
    const iso = new Date().toISOString();
    const { id } = insertWithId(c.db, 'friend_requests',
      ['sender_id', 'recipient_id', 'status', 'created_at'],
      [c.user.id, target.id, 'pending', iso], (s) => 'FR-' + pad6(s));
    sendJson(res, 200, { request: { id, status: 'pending', createdAt: iso } });
  }));

  // ── 待处理列表（新→旧）+ 发送方公开档案 ──
  router.add('GET', '/api/friend-requests', requireSession((req, res, c) => {
    const rows = c.db.prepare(`
      SELECT fr.id, fr.created_at, u.id AS sender_id, u.display_name, u.avatar_url, u.citizen_id
      FROM friend_requests fr JOIN users u ON u.id = fr.sender_id
      WHERE fr.recipient_id = ? AND fr.status = 'pending'
      ORDER BY fr.seq DESC`).all(c.user.id);
    sendJson(res, 200, {
      requests: rows.map((r) => ({
        id: r.id, createdAt: r.created_at,
        sender: { id: r.sender_id, displayName: r.display_name, avatarUrl: r.avatar_url, citizenId: r.citizen_id },
      })),
    });
  }));

  // accept/decline 共用守卫：存在 / 本人是收件人 / 仍待处理
  function guardAction(id, c) {
    const row = db.prepare('SELECT * FROM friend_requests WHERE id = ?').get(id);
    if (!row) throw new HttpError('NOT_FOUND', '好友请求不存在');
    if (row.recipient_id !== c.user.id) throw new HttpError('FORBIDDEN', '无权操作该好友请求');
    if (row.status !== 'pending') throw new HttpError('CONFLICT', '该请求已处理');
    return row;
  }

  // ── 同意：自动建 DM（幂等）→ 标记 accepted ──
  router.add('POST', '/api/friend-requests/:id/accept', requireSession((req, res, c) => {
    const row = guardAction(req.params.id, c);
    const conv = createDm(c.db, row.sender_id, c.user.id);
    c.db.prepare("UPDATE friend_requests SET status = 'accepted', responded_at = ? WHERE id = ?")
      .run(new Date().toISOString(), row.id);
    sendJson(res, 200, { accepted: true, conversation: { id: conv.id, kind: 'dm', members: membersOf(c.db, conv.id) } });
  }));

  // ── 拒绝：仅标记 declined ──
  router.add('POST', '/api/friend-requests/:id/decline', requireSession((req, res, c) => {
    const row = guardAction(req.params.id, c);
    c.db.prepare("UPDATE friend_requests SET status = 'declined', responded_at = ? WHERE id = ?")
      .run(new Date().toISOString(), row.id);
    sendJson(res, 200, { declined: true });
  }));
}

module.exports = { register };
