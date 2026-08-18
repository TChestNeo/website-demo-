'use strict';
// 私讯（P4）：明文存储 + 参与者级 ACL（用户锁定决策）。
// 设计红线：本文件不 require 任何审核模块（写入路径零审核 import）；
// 列表/消息仅会话成员可见；管理调阅走 /api/admin/conversations/:id/messages，
// 查询前强制写 admin_audit_log('view_dm')。
// dm 去重：恰有两名成员且包含双方；last_read_at 存「已读到的最新消息 id」，
// 未读按 seq 比较（时间戳同毫秒也正确排序）。

const { HttpError, sendJson, readJson } = require('../http');
const { requireSession, requireAdmin } = require('../middleware/auth');
const { insertWithId, pad6 } = require('../ids');

const MSG_MAX = 4000;
const PAGE_SIZE = 100;

function writeLimit(ctx) {
  const w = (ctx.config.rateLimits || {}).dmWrite || { max: 30, windowMs: 60000 };
  return ctx.limiter('dm:user:' + ctx.user.id, w.max, w.windowMs);
}

function requireMember(db, convId, userId) {
  const ok = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(convId, userId);
  if (!ok) throw new HttpError('FORBIDDEN', '无权访问该会话');
}

function publicUser(row) {
  return { id: row.id, displayName: row.display_name, avatarUrl: row.avatar_url };
}

function membersOf(db, convId) {
  return db.prepare(`
    SELECT u.id, u.display_name, u.avatar_url FROM conversation_members m
    JOIN users u ON u.id = m.user_id WHERE m.conversation_id = ? ORDER BY m.joined_at
  `).all(convId).map(publicUser);
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
          SELECT last_read_at FROM conversation_members WHERE conversation_id = ? AND user_id = ?)), -1)
  `).get(convId, userId, convId, userId).n;
}

// dm 去重：恰有两名成员且包含双方
function findDm(db, a, b) {
  return db.prepare(`
    SELECT c.id FROM conversations c
    JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
    JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
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

function register(router, ctx) {
  const db = ctx.db;

  // ── 会话列表 ──
  router.add('GET', '/api/conversations', requireSession((req, res, c) => {
    const rows = c.db.prepare(`
      SELECT c.id, c.kind, c.created_at FROM conversations c
      JOIN conversation_members m ON m.conversation_id = c.id AND m.user_id = ?
      ORDER BY c.seq DESC
    `).all(c.user.id);
    sendJson(res, 200, {
      conversations: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        createdAt: row.created_at,
        members: membersOf(c.db, row.id),
        lastMessage: lastMessageOf(c.db, row.id, c.user.id),
        unreadCount: unreadOf(c.db, row.id, c.user.id),
      })),
    });
  }));

  // ── 建/取 dm（{userId} 或 {email}；去重；自己 → 400）──
  router.add('POST', '/api/conversations', requireSession(async (req, res, c) => {
    const body = await readJson(req, 16 * 1024);
    const target = resolveTarget(c.db, body);
    if (target.id === c.user.id) throw new HttpError('VALIDATION', '不能与自己私聊');

    const existing = findDm(c.db, c.user.id, target.id);
    if (existing) {
      const row = c.db.prepare('SELECT kind, created_at FROM conversations WHERE id = ?').get(existing.id);
      sendJson(res, 200, {
        conversation: { id: existing.id, kind: row.kind, createdAt: row.created_at, members: membersOf(c.db, existing.id) },
        created: false,
      });
      return;
    }
    const iso = new Date().toISOString();
    const { id } = insertWithId(c.db, 'conversations', ['kind', 'created_at'], ['dm', iso], (s) => 'CONV-' + pad6(s));
    const ins = c.db.prepare('INSERT INTO conversation_members (conversation_id, user_id, last_read_at, joined_at) VALUES (?, ?, ?, ?)');
    ins.run(id, c.user.id, iso, iso);
    ins.run(id, target.id, null, iso);
    sendJson(res, 200, {
      conversation: { id, kind: 'dm', createdAt: iso, members: membersOf(c.db, id) },
      created: true,
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
    page.forEach((m) => { if (!names[m.sender_id]) names[m.sender_id] = true; });
    const nameRows = c.db.prepare('SELECT id, display_name FROM users WHERE id IN (' +
      Object.keys(names).map(() => '?').join(',') + ')').all(...Object.keys(names));
    const nameOf = {};
    nameRows.forEach((r) => { nameOf[r.id] = r.display_name; });
    if (page.length) {
      c.db.prepare('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?')
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
    const { id } = insertWithId(c.db, 'messages', ['conversation_id', 'sender_id', 'content', 'created_at'],
      [req.params.id, c.user.id, content, iso], (s) => 'MSG-' + pad6(s));
    c.db.prepare('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?')
      .run(id, req.params.id, c.user.id);
    sendJson(res, 200, {
      message: { id, senderId: c.user.id, senderName: c.user.display_name, content, createdAt: iso },
    });
  }));

  // ── 管理调阅：强制审计（先写日志再查询）──
  router.add('GET', '/api/admin/conversations/:id/messages', requireAdmin((req, res, c) => {
    const convId = req.params.id;
    const conv = c.db.prepare('SELECT id FROM conversations WHERE id = ?').get(convId);
    if (!conv) throw new HttpError('NOT_FOUND', '会话不存在');
    const count = c.db.prepare('SELECT count(*) AS n FROM messages WHERE conversation_id = ?').get(convId).n;
    c.db.prepare('INSERT INTO admin_audit_log (admin_id, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(c.user.id, 'view_dm', convId, JSON.stringify({ messageCount: count }), new Date().toISOString());
    const rows = c.db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY seq').all(convId);
    sendJson(res, 200, { conversationId: convId, members: membersOf(c.db, convId), messages: rows.map((m) => ({ id: m.id, senderId: m.sender_id, content: m.content, createdAt: m.created_at })) });
  }));
}

module.exports = { register };
