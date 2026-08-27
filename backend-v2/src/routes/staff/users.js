'use strict';
// SlatiControl 用户中心（§3/§4）：users.view。
//   GET /api/staff/users?q&filter&sort&page&pageSize —— 列表（搜索/筛选/排序/分页），逐行按角色掩码（§28）
//   GET /api/staff/users/:id —— 详情（掩码档案 + 活动聚合 + 支付摘要按 payments 能力掩码）
// 掩码口径：capabilities(ctx.staff 角色) → maskUserRow/maskPayments；纯读零审计。

const { sendJson, HttpError } = require('../../http');
const { requirePerm, staffRoles } = require('../../middleware/staff-auth');
const { capabilities, maskUserRow, maskPayments } = require('../../middleware/mask');

const PAGE_SIZE_MAX = 100;
const FILTERS = ['all', 'active', 'banned', 'delete_pending', 'risk'];
const SORTS = ['created_desc', 'created_asc', 'last_active_desc', 'risk_desc'];

function listUsers(db, qp) {
  const filter = FILTERS.includes(qp.filter) ? qp.filter : 'all';
  const sort = SORTS.includes(qp.sort) ? qp.sort : 'created_desc';
  const page = Math.max(1, Number(qp.page) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(qp.pageSize) || 20));
  const q = String(qp.q || '').trim().slice(0, 64);

  const where = [];
  const args = [];
  if (filter === 'active') where.push("status = 'active'");
  if (filter === 'banned') where.push("status = 'banned'");
  if (filter === 'delete_pending') where.push("status = 'delete_pending'");
  if (filter === 'risk') where.push("risk_level != 'low'");
  if (q) {
    where.push('(email LIKE ? OR display_name LIKE ? OR citizen_id LIKE ? OR id LIKE ?)');
    const like = `%${q}%`;
    args.push(like, like, like, like);
  }
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const orderSql = {
    created_desc: 'ORDER BY created_at DESC',
    created_asc: 'ORDER BY created_at ASC',
    last_active_desc: 'ORDER BY last_active_at DESC NULLS LAST',
    risk_desc: "ORDER BY CASE risk_level WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC, created_at DESC"
  }[sort];

  const total = db.prepare('SELECT count(*) AS n FROM users' + whereSql).get(...args).n;
  const rows = db.prepare(`SELECT * FROM users${whereSql} ${orderSql} LIMIT ? OFFSET ?`)
    .all(...args, pageSize, (page - 1) * pageSize);
  return { rows, total, page, pageSize };
}

function userDetail(db, userId) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!u) throw new HttpError('NOT_FOUND', '用户不存在');
  const stats = {
    posts: db.prepare('SELECT count(*) AS n FROM posts WHERE author_id = ?').get(userId).n,
    comments: db.prepare('SELECT count(*) AS n FROM comments WHERE author_id = ?').get(userId).n,
    following: db.prepare("SELECT count(*) AS n FROM following WHERE user_id = ? AND target_type = 'user'").get(userId).n,
    conversations: db.prepare('SELECT count(*) AS n FROM conversation_members WHERE actor_type = ? AND actor_id = ?').get('user', userId).n,
    tickets: db.prepare('SELECT count(*) AS n FROM tickets WHERE user_id = ?').get(userId).n,
    lastLoginAt: u.last_login_at,
    loginCount: u.login_count
  };
  const payments = db.prepare("SELECT id, tier_key, amount_micro, currency, status, paid_at FROM payments WHERE user_id = ? ORDER BY seq DESC LIMIT 20").all(userId);
  return { user: u, stats, payments };
}

function register(router, ctx) {
  const db = ctx.db;

  router.add('GET', '/api/staff/users', requirePerm('users.view')((req, res) => {
    const c = capabilities(staffRoles(db, ctx.staff.id));
    const { rows, total, page, pageSize } = listUsers(db, req.query);
    sendJson(res, 200, { users: rows.map((u) => maskUserRow(c, u)), total, page, pageSize });
  }));

  router.add('GET', '/api/staff/users/:id', requirePerm('users.view')((req, res) => {
    const c = capabilities(staffRoles(db, ctx.staff.id));
    const { user, stats, payments } = userDetail(db, req.params.id);
    sendJson(res, 200, { user: maskUserRow(c, user), stats, payments: maskPayments(c, payments) });
  }));
}

module.exports = { register, listUsers, userDetail };
