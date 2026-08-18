'use strict';
// 管理端 /api/admin/*（P9）：全部 requireAdmin（会话 + role=admin，匿名 401 / 普通用户 403）。
// 五 tab 对应端点：stats、审核队列 + decide、工单（回复/关闭）、徽章码（签发/列表/吊销）、
// 用户（搜索/tier PATCH/处罚面板）、成本看板（usage + budget 读写）。私讯调阅在 routes/messages.js（P4，强制 view_dm 审计）。
// 一切写操作落 admin_audit_log（action：mod_decide/penalty/ticket_reply/badge_issue/badge_revoke/set_tier/budget_set）。
// 处罚语义统一走 pipeline.applyDecision（六级 action 阶梯，先行下架后通知）。

const crypto = require('node:crypto');
const { HttpError, sendJson, readJson } = require('../http');
const { requireAdmin } = require('../middleware/auth');
const { applyDecision, TARGET_TABLES, textOf } = require('../moderation/pipeline');

const TIERS = ['basic', 'premium', 'ultra'];
const PENALTY_ACTIONS = ['warn', 'remove_content', 'rate_limit', 'mute', 'ban', 'restore'];
const QUEUE_OPEN = ['l0_hold', 'queued', 'needs_human', 'ai_rejected'];
const BUDGET_FEATURES = ['moderation_text', 'chat', 'moderation_image', 'total'];
const BADGE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除 0O1IL（与 badge 页契约一致）
const OWNER_COLS = { post: 'author_id', article: 'author_id', nation: 'owner_id', topic: 'creator_id' };

function audit(ctx, action, target, detail) {
  ctx.db.prepare('INSERT INTO admin_audit_log (admin_id, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(ctx.user.id, action, target || null, detail ? JSON.stringify(detail) : null, new Date().toISOString());
}

function targetUser(db, item) {
  if (item.target_type === 'user') return item.target_id;
  const col = OWNER_COLS[item.target_type];
  const table = TARGET_TABLES[item.target_type];
  if (!col || !table) return null;
  const row = db.prepare(`SELECT ${col} AS uid FROM ${table} WHERE id = ?`).get(item.target_id);
  return row ? row.uid : null;
}

function itemRow(db, item) {
  const preview = String(textOf(db, item.target_type, item.target_id) || '').slice(0, 200);
  return {
    id: item.id, kind: item.kind, targetType: item.target_type, targetId: item.target_id,
    status: item.status, priority: item.priority,
    ruleHits: item.rule_hits ? JSON.parse(item.rule_hits) : null,
    aiResult: item.ai_result ? JSON.parse(item.ai_result) : null,
    preview,
    createdAt: item.created_at, resolvedAt: item.resolved_at
  };
}

function ticketRow(db, row) {
  return {
    id: row.id, category: row.category, type: row.type, contact: row.contact,
    subject: row.subject, description: row.description, locale: row.locale,
    status: row.status, priority: row.priority, submittedAt: row.submitted_at,
    replies: db.prepare('SELECT author_type AS authorType, author_ref AS authorRef, body, created_at AS createdAt '
      + 'FROM ticket_replies WHERE ticket_id = ? ORDER BY seq').all(row.id)
  };
}

function genBadgeCode() {
  let s = '';
  for (let i = 0; i < 10; i++) s += BADGE_CHARS[crypto.randomInt(BADGE_CHARS.length)];
  return s;
}

function register(router, ctx) {
  const db = ctx.db;
  const budget = ctx.moderation.budget;

  // 写操作统一轻限流（30/min/管理员；测试可覆盖 config.rateLimits.adminWrite）
  function adminWrite() {
    const w = (ctx.config.rateLimits || {}).adminWrite || { max: 30, windowMs: 60000 };
    if (!ctx.limiter('adm:w:' + ctx.user.id, w.max, w.windowMs)) {
      throw new HttpError('RATE_LIMITED', '操作过于频繁');
    }
  }

  // ── 总览（管理首页）── 一次请求聚合全站统计 + 分项预算 + 最近动态
  const AUDIT_ZH = { mod_decide: '审核决定', penalty: '执行处罚', ticket_reply: '工单回复',
    badge_issue: '签发徽章码', badge_revoke: '吊销徽章码', set_tier: '调整 tier',
    budget_set: '修改预算', view_dm: '调阅私讯' };
  router.add('GET', '/api/admin/stats', requireAdmin((req, res) => {
    const iso = new Date().toISOString();
    const n = (sql, ...args) => db.prepare(sql).get(...args).n;
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const items = {};
    for (const st of QUEUE_OPEN) items[st] = n("SELECT count(*) AS n FROM moderation_items WHERE status = '" + st + "'");
    const st = budget.status('total', iso);
    // 分项预算进度（status 自带分项/总额 ratio 取大）
    const features = {};
    for (const f of BUDGET_FEATURES) {
      if (f === 'total') continue;
      const s = budget.status(f, iso);
      features[f] = { spent: s.spent, limit: s.limit, ratio: s.ratio, state: s.state };
    }
    // 最近动态：注册/发帖/工单/举报/管理操作 五路合并按时间倒序取 15 条
    const act = [];
    for (const r of db.prepare('SELECT display_name AS d, email AS e, created_at AS at FROM users ORDER BY seq DESC LIMIT 6').all())
      act.push({ at: r.at, type: 'user', text: '新用户注册：' + r.d + '（' + r.e + '）' });
    for (const r of db.prepare('SELECT content AS c, created_at AS at FROM posts ORDER BY seq DESC LIMIT 6').all())
      act.push({ at: r.at, type: 'post', text: '新帖：' + String(r.c).replace(/\s+/g, ' ').slice(0, 60) });
    for (const r of db.prepare('SELECT subject AS s, created_at AS at FROM tickets ORDER BY seq DESC LIMIT 6').all())
      act.push({ at: r.at, type: 'ticket', text: '新工单：' + r.s });
    for (const r of db.prepare('SELECT target_type AS tt, target_id AS ti, reason AS rs, created_at AS at FROM reports ORDER BY seq DESC LIMIT 6').all())
      act.push({ at: r.at, type: 'report', text: '新举报：' + r.tt + ' ' + r.ti + '（' + r.rs + '）' });
    for (const r of db.prepare('SELECT action AS a, target AS t, created_at AS at FROM admin_audit_log ORDER BY seq DESC LIMIT 6').all())
      act.push({ at: r.at, type: 'audit', text: (AUDIT_ZH[r.a] || r.a) + '：' + (r.t || '—') });
    act.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
    sendJson(res, 200, {
      users: n('SELECT count(*) AS n FROM users'),
      users7d: n('SELECT count(*) AS n FROM users WHERE created_at >= ?', weekAgo),
      usersActive24h: n('SELECT count(*) AS n FROM users WHERE last_active_at >= ?', dayAgo),
      posts: n('SELECT count(*) AS n FROM posts'),
      posts24h: n('SELECT count(*) AS n FROM posts WHERE created_at >= ?', dayAgo),
      nations: n('SELECT count(*) AS n FROM nations'),
      topics: n('SELECT count(*) AS n FROM topics'),
      articles: n('SELECT count(*) AS n FROM articles'),
      moderationItems: items,
      openTickets: n("SELECT count(*) AS n FROM tickets WHERE status IN ('queued','in_progress')"),
      openReports: n("SELECT count(*) AS n FROM reports WHERE status = 'open'"),
      badgeActive: n('SELECT count(*) AS n FROM badge_codes WHERE revoked_at IS NULL AND expires_at > ?', iso),
      sessionsActive: n('SELECT count(*) AS n FROM sessions WHERE expires_at > ?', iso),
      monthCostMicro: st.totalSpent,
      budgetState: st.state,
      budget: { total: { spent: st.spent, limit: st.limit, ratio: st.ratio, state: st.state }, features },
      activity: act.slice(0, 15)
    });
  }));

  // ── 审核队列 + decide ──
  router.add('GET', '/api/admin/moderation/queue', requireAdmin((req, res) => {
    const status = String(req.query.status || 'open');
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    let rows;
    if (status === 'all') {
      rows = db.prepare('SELECT * FROM moderation_items ORDER BY seq DESC LIMIT ?').all(limit);
    } else if (status === 'open') {
      rows = db.prepare(`SELECT * FROM moderation_items WHERE status IN (${QUEUE_OPEN.map(() => '?').join(',')}) `
        + 'ORDER BY (priority = \'high\') DESC, seq DESC LIMIT ?').all(...QUEUE_OPEN, limit);
    } else {
      rows = db.prepare('SELECT * FROM moderation_items WHERE status = ? ORDER BY seq DESC LIMIT ?').all(status, limit);
    }
    sendJson(res, 200, { items: rows.map(r => itemRow(db, r)) });
  }));

  router.add('POST', '/api/admin/moderation/:id/decide', requireAdmin(async (req, res) => {
    adminWrite();
    const item = db.prepare('SELECT * FROM moderation_items WHERE id = ?').get(req.params.id);
    if (!item) throw new HttpError('NOT_FOUND', '审核项不存在');
    const body = await readJson(req);
    const verdict = body.verdict === 'approve' ? 'approve' : body.verdict === 'reject' ? 'reject' : null;
    if (!verdict) throw new HttpError('VALIDATION', 'verdict 需为 approve/reject');
    const iso = new Date().toISOString();

    if (verdict === 'approve') {
      // 放行：人工通过；pending 的帖子/文章上线（其余目标本来就可见）
      if (item.target_type === 'post' || item.target_type === 'article') {
        db.prepare(`UPDATE ${TARGET_TABLES[item.target_type]} SET status = 'visible' WHERE id = ? AND status = 'pending'`)
          .run(item.target_id);
      }
      db.prepare("UPDATE moderation_items SET status = 'human_approved', resolved_at = ? WHERE id = ?").run(iso, item.id);
      audit(ctx, 'mod_decide', item.id, { verdict: 'approve' });
      sendJson(res, 200, { item: { id: item.id, status: 'human_approved' } });
      return;
    }

    // 拒绝：默认下架（可叠加阶梯处罚五级）
    const action = body.action || 'remove_content';
    if (!PENALTY_ACTIONS.includes(action)) throw new HttpError('VALIDATION', 'action 非法');
    const userId = targetUser(db, item);
    if (!userId && action !== 'remove_content') {
      throw new HttpError('CONFLICT', '该目标无归属用户，无法叠加该处罚（可仅下架）');
    }
    applyDecision(db, ctx.config, {
      itemId: item.id, action, userId,
      actor: 'admin:' + ctx.user.email,
      reasonCode: body.reasonCode || null, notes: body.notes || null
    });
    db.prepare("UPDATE moderation_items SET status = 'human_rejected', resolved_at = ? WHERE id = ?").run(iso, item.id);
    audit(ctx, 'mod_decide', item.id, { verdict: 'reject', action, reasonCode: body.reasonCode || null });
    sendJson(res, 200, { item: { id: item.id, status: 'human_rejected', action } });
  }));

  // ── 处罚面板（直接处罚，无审核项）──
  router.add('POST', '/api/admin/penalties', requireAdmin(async (req, res) => {
    adminWrite();
    const body = await readJson(req);
    if (!PENALTY_ACTIONS.includes(body.action)) throw new HttpError('VALIDATION', 'action 非法');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(body.userId);
    if (!user) throw new HttpError('NOT_FOUND', '用户不存在');
    if (user.role === 'admin') throw new HttpError('FORBIDDEN', '不能处罚管理员');
    applyDecision(db, ctx.config, {
      itemId: null, action: body.action, userId: user.id,
      actor: 'admin:' + ctx.user.email,
      reasonCode: body.reasonCode || null, notes: body.notes || null
    });
    audit(ctx, 'penalty', user.id, { action: body.action, reasonCode: body.reasonCode || null });
    sendJson(res, 200, { ok: true });
  }));

  // ── 工单 ──
  router.add('GET', '/api/admin/tickets', requireAdmin((req, res) => {
    const status = String(req.query.status || 'queued');
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = status === 'all'
      ? db.prepare('SELECT * FROM tickets ORDER BY seq DESC LIMIT ?').all(limit)
      : db.prepare('SELECT * FROM tickets WHERE status = ? ORDER BY seq DESC LIMIT ?').all(status, limit);
    sendJson(res, 200, { tickets: rows.map(r => ticketRow(db, r)) });
  }));

  router.add('POST', '/api/admin/tickets/:id/reply', requireAdmin(async (req, res) => {
    adminWrite();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    if (!ticket) throw new HttpError('NOT_FOUND', '工单不存在');
    if (ticket.status === 'closed') throw new HttpError('CONFLICT', '工单已关闭');
    const body = await readJson(req);
    const content = String(body.content || '').trim();
    if (!content || content.length > 4000) throw new HttpError('VALIDATION', '回复需 1-4000 字');
    const iso = new Date().toISOString();
    db.prepare('INSERT INTO ticket_replies (ticket_id, author_type, author_ref, body, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(ticket.id, 'admin', ctx.user.email, content, iso);
    db.prepare("UPDATE tickets SET status = CASE WHEN status = 'queued' THEN 'in_progress' ELSE status END, updated_at = ? WHERE id = ?")
      .run(iso, ticket.id);
    audit(ctx, 'ticket_reply', ticket.id, { len: content.length });
    sendJson(res, 200, { ticket: ticketRow(db, db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticket.id)) });
  }));

  router.add('POST', '/api/admin/tickets/:id/close', requireAdmin((req, res) => {
    adminWrite();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    if (!ticket) throw new HttpError('NOT_FOUND', '工单不存在');
    const iso = new Date().toISOString();
    db.prepare("UPDATE tickets SET status = 'closed', updated_at = ? WHERE id = ?").run(iso, ticket.id);
    audit(ctx, 'ticket_reply', ticket.id, { close: true });
    sendJson(res, 200, { ticket: ticketRow(db, db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticket.id)) });
  }));

  // ── 徽章码（签发码只在响应中出现一次）──
  router.add('POST', '/api/admin/badge/issue', requireAdmin(async (req, res) => {
    adminWrite();
    const body = await readJson(req);
    const alias = String(body.alias || '').trim();
    const role = String(body.role || '').trim();
    const duties = String(body.duties || '').trim();
    if (!alias || !role || !duties || alias.length > 100 || role.length > 100 || duties.length > 500) {
      throw new HttpError('VALIDATION', 'alias/role/duties 必填且长度合法');
    }
    const ttlHours = Math.min(Math.max(Number(body.ttlHours) || 12, 1), 72);
    const iso = new Date().toISOString();
    const expires = new Date(new Date(iso).getTime() + ttlHours * 3600 * 1000).toISOString();
    const code = genBadgeCode();
    db.prepare('INSERT INTO badge_codes (code, alias, role, duties, bound_incident, issued_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(code, alias, role, duties, String(body.boundIncident || 'manual'), iso, expires);
    audit(ctx, 'badge_issue', code, { alias, role });
    sendJson(res, 200, { code, alias, role, duties, issuedAt: iso, expiresAt: expires });
  }));

  router.add('GET', '/api/admin/badge/list', requireAdmin((req, res) => {
    const now = new Date().toISOString();
    const rows = db.prepare('SELECT * FROM badge_codes WHERE revoked_at IS NULL AND expires_at > ? ORDER BY issued_at DESC').all(now);
    sendJson(res, 200, {
      badges: rows.map(r => ({
        code: r.code, alias: r.alias, role: r.role, duties: r.duties,
        issuedAt: r.issued_at, expiresAt: r.expires_at
      }))
    });
  }));

  router.add('POST', '/api/admin/badge/:code/revoke', requireAdmin((req, res) => {
    adminWrite();
    const code = String(req.params.code || '').toUpperCase();
    const row = db.prepare('SELECT * FROM badge_codes WHERE code = ?').get(code);
    if (!row) throw new HttpError('NOT_FOUND', '验证码不存在');
    db.prepare('UPDATE badge_codes SET revoked_at = ? WHERE code = ?').run(new Date().toISOString(), code);
    audit(ctx, 'badge_revoke', code, {});
    sendJson(res, 200, { ok: true });
  }));

  // ── 用户 ──
  router.add('GET', '/api/admin/users', requireAdmin((req, res) => {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const like = '%' + q + '%';
    const rows = q
      ? db.prepare('SELECT * FROM users WHERE email LIKE ? OR display_name LIKE ? OR citizen_id LIKE ? ORDER BY seq DESC LIMIT ?')
        .all(like, like, like, limit)
      : db.prepare('SELECT * FROM users ORDER BY seq DESC LIMIT ?').all(limit);
    sendJson(res, 200, {
      users: rows.map(u => ({
        id: u.id, email: u.email, displayName: u.display_name, citizenId: u.citizen_id,
        tier: u.tier, role: u.role, status: u.status, warningCount: u.warning_count,
        mutedUntil: u.muted_until, rateLimitedUntil: u.rate_limited_until,
        createdAt: u.created_at, lastActiveAt: u.last_active_at
      }))
    });
  }));

  router.add('GET', '/api/admin/users/:id', requireAdmin((req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) throw new HttpError('NOT_FOUND', '用户不存在');
    const decisions = db.prepare('SELECT action, actor, reason_code AS reasonCode, notes, created_at AS createdAt '
      + 'FROM moderation_decisions WHERE user_id = ? ORDER BY seq DESC LIMIT 50').all(u.id);
    sendJson(res, 200, {
      user: {
        id: u.id, email: u.email, displayName: u.display_name, citizenId: u.citizen_id,
        tier: u.tier, role: u.role, status: u.status, warningCount: u.warning_count,
        mutedUntil: u.muted_until, rateLimitedUntil: u.rate_limited_until,
        createdAt: u.created_at, lastActiveAt: u.last_active_at
      },
      decisions
    });
  }));

  // 一期唯一「支付」路径：tier 由管理员手动指定（写审计）
  router.add('PATCH', '/api/admin/users/:id', requireAdmin(async (req, res) => {
    adminWrite();
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) throw new HttpError('NOT_FOUND', '用户不存在');
    const body = await readJson(req);
    if (!TIERS.includes(body.tier)) throw new HttpError('VALIDATION', 'tier 需为 basic/premium/ultra');
    db.prepare('UPDATE users SET tier = ?, updated_at = ? WHERE id = ?').run(body.tier, new Date().toISOString(), u.id);
    audit(ctx, 'set_tier', u.id, { from: u.tier, to: body.tier });
    sendJson(res, 200, { user: { id: u.id, tier: body.tier } });
  }));

  // ── 成本看板 ──
  router.add('GET', '/api/admin/usage', requireAdmin((req, res) => {
    const iso = new Date().toISOString();
    const byFeature = {};
    for (const f of budget.FEATURES) {
      const s = budget.status(f, iso);
      byFeature[f] = { limit: s.limit, spent: s.spent, ratio: s.ratio, state: s.state };
    }
    const total = budget.status('total', iso);
    const recent = db.prepare('SELECT feature, tokens_in AS tokensIn, tokens_out AS tokensOut, tokens_cached AS tokensCached, '
      + 'cost_micro AS costMicro, price_snapshot AS priceSnapshot, batch_id AS batchId, latency_ms AS latencyMs, created_at AS createdAt '
      + 'FROM usage_log ORDER BY seq DESC LIMIT 50').all();
    sendJson(res, 200, { byFeature, total: { limit: total.limit, spent: total.spent, ratio: total.ratio, state: total.state }, recent });
  }));

  router.add('GET', '/api/admin/budget', requireAdmin((req, res) => {
    const limits = {};
    for (const f of BUDGET_FEATURES) limits[f] = budget.limitOf(f);
    sendJson(res, 200, { limits });
  }));

  router.add('PUT', '/api/admin/budget', requireAdmin(async (req, res) => {
    adminWrite();
    const body = await readJson(req);
    if (!BUDGET_FEATURES.includes(body.feature)) throw new HttpError('VALIDATION', 'feature 非法');
    const yuan = Number(body.yuan);
    if (!Number.isFinite(yuan) || yuan < 0 || yuan > 1e6) throw new HttpError('VALIDATION', 'yuan 需为 0-1000000 数字');
    budget.setLimit(body.feature, yuan);
    audit(ctx, 'budget_set', 'budget.' + body.feature, { yuan });
    sendJson(res, 200, { ok: true, feature: body.feature, yuan });
  }));

  // ── 审计 ──
  router.add('GET', '/api/admin/audit', requireAdmin((req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = db.prepare('SELECT admin_id AS adminId, action, target, detail, created_at AS createdAt '
      + 'FROM admin_audit_log ORDER BY seq DESC LIMIT ?').all(limit);
    sendJson(res, 200, {
      audit: rows.map(r => ({ ...r, detail: r.detail ? JSON.parse(r.detail) : null }))
    });
  }));
}

module.exports = { register, TIERS, PENALTY_ACTIONS, BUDGET_FEATURES };
