'use strict';
// SlatiControl 安全中心（§5）：security.view_all / security.manage / users.view。
//   GET  /api/staff/security/logins?userId&result&page  —— 全局登录史（security.view_all；IP 按角色掩码）
//   GET  /api/staff/security/events?userId&eventType&page —— 全局安全事件（security.view_all）
//   GET  /api/staff/users/:id/security  —— 单用户登录史+安全事件（users.view：用户档案工作流的一部分，
//      cs 也可见但按 §28 掩码——前两段+近 10 条；moderation 无 IP 能力 → ip null）
//   POST /api/staff/security/events/:id/flag {note}  —— 标记事件跟进（security.manage，写 → 审计）
// IP 只作风险信号不单独判盗号（§5）；maskLoginHistory 在序列化层应用（§28）。

const { sendJson, HttpError, readJson } = require('../../http');
const { requirePerm, staffRoles } = require('../../middleware/staff-auth');
const { capabilities, maskIp, maskLoginHistory } = require('../../middleware/mask');
const { audit } = require('../../audit');

const PAGE_SIZE_MAX = 100;
const EVENT_TYPES = ['password_change', 'email_change', '2fa_change', 'new_device', 'new_session',
  'suspicious_login', 'account_recovery', 'security_settings_change'];

function loginsList(db, qp) {
  const page = Math.max(1, Number(qp.page) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(qp.pageSize) || 20));
  const where = [];
  const args = [];
  if (qp.userId) { where.push('actor_id = ?'); args.push(qp.userId); }
  if (qp.result) { where.push('result = ?'); args.push(qp.result); }
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const total = db.prepare('SELECT count(*) AS n FROM login_history' + whereSql).get(...args).n;
  const rows = db.prepare(`SELECT id, actor_type, actor_id, email, ip, country, device, browser, os, result, risk_flags, created_at
    FROM login_history${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, pageSize, (page - 1) * pageSize);
  return { rows, total, page, pageSize };
}

function eventsList(db, qp) {
  const page = Math.max(1, Number(qp.page) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(qp.pageSize) || 20));
  const where = [];
  const args = [];
  if (qp.userId) { where.push('actor_id = ?'); args.push(qp.userId); }
  if (qp.eventType && EVENT_TYPES.includes(qp.eventType)) { where.push('event_type = ?'); args.push(qp.eventType); }
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const total = db.prepare('SELECT count(*) AS n FROM security_events' + whereSql).get(...args).n;
  const rows = db.prepare(`SELECT * FROM security_events${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...args, pageSize, (page - 1) * pageSize);
  return { rows, total, page, pageSize };
}

function register(router, ctx) {
  const db = ctx.db;

  router.add('GET', '/api/staff/security/logins', requirePerm('security.view_all')((req, res) => {
    const c = capabilities(staffRoles(db, ctx.staff.id));
    const { rows, total, page, pageSize } = loginsList(db, req.query);
    sendJson(res, 200, { logins: maskLoginHistory(c, rows), total, page, pageSize });
  }));

  router.add('GET', '/api/staff/security/events', requirePerm('security.view_all')((req, res) => {
    const c = capabilities(staffRoles(db, ctx.staff.id));
    const { rows, total, page, pageSize } = eventsList(db, req.query);
    // 事件不含 IP 权限阶梯之外的列；ip 仍按掩码（partialIp → 前两段）
    sendJson(res, 200, { events: rows.map((r) => ({ ...r, ip: maskIp(c, r.ip) })), total, page, pageSize });
  }));

  router.add('GET', '/api/staff/users/:id/security', requirePerm('users.view')((req, res) => {
    const userId = req.params.id;
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) throw new HttpError('NOT_FOUND', '用户不存在');
    const c = capabilities(staffRoles(db, ctx.staff.id));
    const logins = db.prepare("SELECT id, actor_type, actor_id, email, ip, country, device, browser, os, result, risk_flags, created_at FROM login_history WHERE actor_id = ? ORDER BY created_at DESC LIMIT 100")
      .all(userId);
    const events = db.prepare('SELECT * FROM security_events WHERE actor_id = ? ORDER BY created_at DESC LIMIT 100').all(userId);
    const flagged = db.prepare('SELECT count(*) AS n FROM security_events WHERE actor_id = ? AND flagged = 1').get(userId).n;
    sendJson(res, 200, {
      loginHistory: maskLoginHistory(c, logins),
      events: events.map((r) => ({ ...r, ip: maskIp(c, r.ip) })),
      flagged
    });
  }));

  // 标记安全事件跟进（写 → 审计；AI 无认证主体，无法触达本路径，§29）
  router.add('POST', '/api/staff/security/events/:id/flag', requirePerm('security.manage')(async (req, res) => {
    const ev = db.prepare('SELECT * FROM security_events WHERE id = ?').get(req.params.id);
    if (!ev) throw new HttpError('NOT_FOUND', '事件不存在');
    const body = await readJson(req);
    const note = String(body.note || '').trim().slice(0, 500);
    db.prepare('UPDATE security_events SET flagged = 1, flagged_by = ?, flagged_at = ? WHERE id = ?')
      .run(ctx.staff.id, new Date().toISOString(), ev.id);
    audit(db, req, ctx, {
      action: 'security_event_flag',
      targetType: 'security_event',
      targetId: ev.id,
      prev: { flagged: 0 },
      next: { flagged: 1, by: ctx.staff.id },
      reason: note || null
    });
    sendJson(res, 200, { flagged: true });
  }));
}

module.exports = { register };
