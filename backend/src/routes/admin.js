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
const { insertWithId, pad6 } = require('../ids');

const TIERS = ['free', 'basic', 'premium', 'ultra'];
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
    budget_set: '修改预算', finance_set: '调整财务参数', view_dm: '调阅私讯',
    ledger_add: '记录流水', ledger_edit: '修改流水', ledger_delete: '删除流水', ledger_close: '月结锁定', ledger_report: '生成季度财报' };
  // ¥→RM 汇率（AI 账单折算）/ 税率 / 固定月成本（RM）/ 季度目标（RM）——stats 与 finance PUT 共用
  const FIN_DEFAULTS = { fx: 0.6, taxRate: 0.08, fixedMonthly: 50, quarterTarget: 0 };
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
    // 订阅与收入（free=普通用户不计费；Basic 学生价 RM12/月；paidMicro = 本月流水实账（收款 − 退款），
    // 无流水则 0，收入按 tier 月价估算——存量 Basic 一并计费属估算口径，实账以流水为准）
    const tiers = { free: 0, basic: 0, premium: 0, ultra: 0 };
    for (const r of db.prepare("SELECT tier, count(*) AS n FROM users WHERE status = 'active' GROUP BY tier").all())
      if (r.tier in tiers) tiers[r.tier] = r.n;
    const tierPrice = { basic: 12, premium: 23.5, ultra: 45.5 }; // 对齐 docs/pages/premium.html LOCALES['ms-MY'] tier 月价（RM）
    const sub = {
      tiers,
      subscribers: tiers.basic + tiers.premium + tiers.ultra,
      pricing: { currency: 'RM', monthly: tierPrice },
      revenue: {
        paidMicro: 0,
        estimatedMonthly: Math.round((tiers.basic * tierPrice.basic + tiers.premium * tierPrice.premium + tiers.ultra * tierPrice.ultra) * 100) / 100
      },
      tierEvents: db.prepare("SELECT l.created_at AS at, u.email AS actor, l.target, l.detail FROM admin_audit_log l "
        + "LEFT JOIN users u ON u.id = l.admin_id WHERE l.action = 'set_tier' ORDER BY l.seq DESC LIMIT 20").all()
        .map((r) => { let d = null; try { d = JSON.parse(r.detail); } catch (e) {} return { at: r.at, actor: r.actor || null, target: r.target, from: (d && d.from) || null, to: (d && d.to) || null }; })
    };
    // 财务总览（全 MYR：收入 = tier 定价估算、AI 用量实账为人民币账单按汇率折算 RM、税费 = 收入 × 税率估算，口径前端全标注）
    const fin = {};
    for (const k of Object.keys(FIN_DEFAULTS)) {
      const row = db.prepare('SELECT value FROM kv WHERE key = ?').get('finance.' + k);
      const v = row ? Number(row.value) : FIN_DEFAULTS[k];
      fin[k] = Number.isFinite(v) ? v : FIN_DEFAULTS[k];
    }
    const estRevenueRM = sub.revenue.estimatedMonthly;
    const usageCostRM = Math.round(st.totalSpent / 1e6 * fin.fx * 100) / 100;
    // 流水账实账（本月）：收款 − 退款（¥ 按当前汇率折 RM）；支出单列（成本结构展示，不并入估算模型）
    let paidRM = 0, expenseRM = 0;
    for (const r of db.prepare('SELECT kind, amount, currency FROM ledger WHERE occurred_at >= ?')
      .all(new Date().toISOString().slice(0, 7) + '-01')) {
      const v = Math.round(Number(r.amount) * (r.currency === 'CNY' ? fin.fx : 1) * 100) / 100;
      if (r.kind === 'income') paidRM += v;
      else if (r.kind === 'refund') paidRM -= v;
      else if (r.kind === 'expense') expenseRM += v;
    }
    paidRM = Math.round(paidRM * 100) / 100; expenseRM = Math.round(expenseRM * 100) / 100;
    sub.revenue.paidMicro = Math.round(paidRM * 1e6); // 实际收款卡 = 流水实账（原一期恒 0）
    const totalCostRM = Math.round((fin.fixedMonthly + usageCostRM) * 100) / 100;
    const taxRM = Math.round(estRevenueRM * fin.taxRate * 100) / 100;
    const netProfitRM = Math.round((estRevenueRM - totalCostRM - taxRM) * 100) / 100;
    // 7 天订阅净增长：set_tier 事件进付费层（basic/premium/ultra）+1、出 −1（free 不计）
    let growth7d = 0;
    for (const r of db.prepare("SELECT detail FROM admin_audit_log WHERE action = 'set_tier' AND created_at >= ?").all(weekAgo)) {
      let d = null; try { d = JSON.parse(r.detail); } catch (e) {}
      if (d && d.to && d.to !== 'free') growth7d++;
      if (d && d.from && d.from !== 'free') growth7d--;
    }
    const coverage = estRevenueRM <= 0 ? 0 : Math.round(estRevenueRM / Math.max(totalCostRM, 0.01) * 100) / 100;
    let healthState, healthReason;
    if (estRevenueRM <= 0) { healthState = 'danger'; healthReason = '无收入：支付未上线或订阅用户为 0'; }
    else if (coverage < 0.5) { healthState = 'danger'; healthReason = '预计收入不足成本的 50%'; }
    else if (coverage < 1) { healthState = 'warn'; healthReason = '预计收入不抵成本（入不敷出）'; }
    else if (coverage >= 2 && growth7d >= 0) { healthState = 'best'; healthReason = '收入覆盖成本 2× 以上且订阅 7 天净增长'; }
    else { healthState = 'ok'; healthReason = coverage >= 2 ? '收入覆盖成本 2× 以上（订阅 7 天净减）' : '收入覆盖成本'; }
    const quarterEst = Math.round(estRevenueRM * 3 * 100) / 100;
    const quarterPct = fin.quarterTarget > 0 ? Math.round(quarterEst / fin.quarterTarget * 100) : null;
    fin.estRevenueRM = estRevenueRM;
    fin.usageCostRM = usageCostRM;
    fin.totalCostRM = totalCostRM;
    fin.taxRM = taxRM;
    fin.netProfitRM = netProfitRM;
    fin.health = {
      state: healthState, reason: healthReason, coverage, growth7d,
      quarter: { target: fin.quarterTarget, est: quarterEst, pct: quarterPct, met: quarterPct !== null && quarterPct >= 100 }
    };
    // 财务参数调整记录（时间线用）：新格式 {from,to} / 旧格式直接值（兼容重放前的旧审计行）
    fin.paramEvents = db.prepare('SELECT l.created_at AS at, u.email AS actor, l.detail FROM admin_audit_log l '
      + "LEFT JOIN users u ON u.id = l.admin_id WHERE l.action = 'finance_set' ORDER BY l.seq DESC LIMIT 20").all()
      .map((r) => { let d = null; try { d = JSON.parse(r.detail); } catch (e) {} return { at: r.at, actor: r.actor || null, from: (d && d.from) || null, to: (d && d.from) ? d.to : d }; });
    fin.paidRM = paidRM; fin.expenseRM = expenseRM;
    const lockedRow = db.prepare("SELECT value FROM kv WHERE key = 'ledger.closed_upto'").get();
    fin.ledgerLocked = lockedRow ? lockedRow.value : null;
    // 收入曲线序列（估算口径，供前端卡片迷你曲线/详情弹窗）：自最早审计事件（或今天）逐日推进，
    // 每天一个「月度口径」快照——收入 = tier 月价 × 当日订阅数（set_tier 事件重放，订阅数 0 起步：
    // 一期 tier 全部经由 set_tier）、税费 = 收入 × 当日税率、成本 = 当日固定成本 + 当月 AI 实账累计
    // （usage_log 按日、人民币账单按当日 fx 折算）、收款恒 0（一期无支付）。上限 400 天。
    const dayEvts = {};
    for (const e of db.prepare("SELECT created_at AS at, detail FROM admin_audit_log WHERE action = 'set_tier' ORDER BY seq ASC").all())
      (dayEvts[e.at.slice(0, 10)] = dayEvts[e.at.slice(0, 10)] || []).push(['tier', e.detail]);
    for (const e of db.prepare("SELECT created_at AS at, detail FROM admin_audit_log WHERE action = 'finance_set' ORDER BY seq ASC").all())
      (dayEvts[e.at.slice(0, 10)] = dayEvts[e.at.slice(0, 10)] || []).push(['fin', e.detail]);
    const usageByDay = {};
    for (const r of db.prepare('SELECT date(created_at) AS d, SUM(cost_micro) AS c FROM usage_log GROUP BY d').all()) usageByDay[r.d] = r.c;
    // 流水账收款/退款按日（¥ 在逐日重放内按当日汇率折 RM）
    const paidByDay = {};
    for (const r of db.prepare("SELECT kind, amount, currency, occurred_at FROM ledger WHERE kind IN ('income','refund')").all()) {
      const d = String(r.occurred_at).slice(0, 10);
      const pd = paidByDay[d] = paidByDay[d] || { rm: 0, cny: 0 };
      pd[r.currency === 'CNY' ? 'cny' : 'rm'] += r.kind === 'income' ? Number(r.amount) : -Number(r.amount);
    }
    const nowU = new Date();
    const todayU = new Date(Date.UTC(nowU.getUTCFullYear(), nowU.getUTCMonth(), nowU.getUTCDate()));
    let minD = todayU.toISOString().slice(0, 10);
    for (const d of Object.keys(dayEvts)) if (d < minD) minD = d;
    for (const d of Object.keys(usageByDay)) if (d < minD) minD = d;
    for (const d of Object.keys(paidByDay)) if (d < minD) minD = d;
    const cnt = { basic: 0, premium: 0, ultra: 0 };
    const prm = { fx: FIN_DEFAULTS.fx, taxRate: FIN_DEFAULTS.taxRate, fixedMonthly: FIN_DEFAULTS.fixedMonthly };
    const series = [];
    let mtd = 0, prevMonth = '';
    const startU = new Date(minD + 'T00:00:00Z');
    if (todayU - startU > 400 * 86400000) startU.setTime(todayU.getTime() - 400 * 86400000);
    for (let t = new Date(startU); t <= todayU; t = new Date(t.getTime() + 86400000)) {
      const d = t.toISOString().slice(0, 10);
      for (const [kind, detail] of dayEvts[d] || []) {
        let de = null; try { de = JSON.parse(detail); } catch (err) {}
        if (kind === 'tier') {
          if (de && de.from in cnt && cnt[de.from] > 0) cnt[de.from]--; // 存量 Basic 升级事件自 0 起步不减负（重放无此前 +basic 事件）
          if (de && de.to in cnt) cnt[de.to]++;
        } else {
          const src = de && de.to ? de.to : de; // 新格式 {from,to} 取 to / 旧格式直接值
          for (const k of ['fx', 'taxRate', 'fixedMonthly']) if (src && Number.isFinite(Number(src[k]))) prm[k] = Number(src[k]);
        }
      }
      const month = d.slice(0, 7);
      if (month !== prevMonth) { mtd = 0; prevMonth = month; }
      mtd += ((usageByDay[d] || 0) / 1e6) * prm.fx;
      const rev = Math.round((cnt.basic * tierPrice.basic + cnt.premium * tierPrice.premium + cnt.ultra * tierPrice.ultra) * 100) / 100;
      const tax = Math.round(rev * prm.taxRate * 100) / 100;
      const cost = Math.round((prm.fixedMonthly + mtd) * 100) / 100;
      const pd = paidByDay[d] || { rm: 0, cny: 0 };
      const paid = Math.round((pd.rm + pd.cny * prm.fx) * 100) / 100;
      series.push({ d, rev, paid, tax, cost, net: Math.round((rev - cost - tax) * 100) / 100 });
    }
    fin.series = series;
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
      sub,
      finance: fin,
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
        tier: u.tier, tierExpiresAt: u.tier_expires_at || null, role: u.role, status: u.status,
        warningCount: u.warning_count, mutedUntil: u.muted_until, rateLimitedUntil: u.rate_limited_until,
        createdAt: u.created_at, lastActiveAt: u.last_active_at
      }))
    });
  }));

  router.add('GET', '/api/admin/users/:id', requireAdmin((req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) throw new HttpError('NOT_FOUND', '用户不存在');
    const decisions = db.prepare('SELECT action, actor, reason_code AS reasonCode, notes, created_at AS createdAt '
      + 'FROM moderation_decisions WHERE user_id = ? ORDER BY seq DESC LIMIT 50').all(u.id);
    const payments = db.prepare('SELECT id, tier_key AS tierKey, amount_micro AS amountMicro, currency, months, '
      + 'status, created_at AS createdAt, paid_at AS paidAt FROM payments WHERE user_id = ? ORDER BY seq DESC LIMIT 10').all(u.id);
    sendJson(res, 200, {
      user: {
        id: u.id, email: u.email, displayName: u.display_name, citizenId: u.citizen_id,
        tier: u.tier, tierExpiresAt: u.tier_expires_at || null, role: u.role, status: u.status,
        warningCount: u.warning_count, mutedUntil: u.muted_until, rateLimitedUntil: u.rate_limited_until,
        createdAt: u.created_at, lastActiveAt: u.last_active_at
      },
      decisions,
      payments
    });
  }));

  // tier 调整：管理员手动指定（写审计）。手动授予 = 永久（清空订阅到期时间）；
  // 若用户仍有活跃订阅，后续 invoice.paid 会按支付口径重新写入到期时间。
  router.add('PATCH', '/api/admin/users/:id', requireAdmin(async (req, res) => {
    adminWrite();
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) throw new HttpError('NOT_FOUND', '用户不存在');
    const body = await readJson(req);
    if (!TIERS.includes(body.tier)) throw new HttpError('VALIDATION', 'tier 需为 free/basic/premium/ultra（free=普通用户）');
    db.prepare('UPDATE users SET tier = ?, tier_expires_at = NULL, updated_at = ? WHERE id = ?')
      .run(body.tier, new Date().toISOString(), u.id);
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

  // ── 财务参数（汇率/税率/固定月成本/季度目标：kv + 审计） ──
  const FIN_FIELDS = { fx: [0.01, 100], taxRate: [0, 1], fixedMonthly: [0, 1e6], quarterTarget: [0, 1e9] };
  router.add('PUT', '/api/admin/finance', requireAdmin(async (req, res) => {
    adminWrite();
    const body = await readJson(req);
    if (!Object.keys(FIN_FIELDS).some(k => k in body)) throw new HttpError('VALIDATION', '至少提供一个参数');
    const saved = {}, from = {};
    for (const k of Object.keys(FIN_FIELDS)) {
      if (!(k in body)) continue;
      const v = Number(body[k]);
      const [lo, hi] = FIN_FIELDS[k];
      if (!Number.isFinite(v) || v < lo || v > hi) throw new HttpError('VALIDATION', k + ' 需为 ' + lo + '-' + hi + ' 数字');
      const old = db.prepare('SELECT value FROM kv WHERE key = ?').get('finance.' + k);
      from[k] = old ? Number(old.value) : FIN_DEFAULTS[k]; // 从未设过 → 记录默认值为「改前值」
      db.prepare('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) '
        + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
        .run('finance.' + k, String(v), new Date().toISOString());
      saved[k] = v;
    }
    audit(ctx, 'finance_set', 'finance', { from, to: saved }); // 时间线可显示「谁/何时/从什么改成什么」
    sendJson(res, 200, { ok: true, saved });
  }));

  // ── 流水账（财报基础：收款/退款/支出/调整 + 月结锁定 + CSV 导出；全部写操作落审计） ──
  // 金额 REAL 2 位小数、币种 RM/CNY（人工录入的经营数据，与 usage_log 机器微元口径不同）；
  // occurred_at = 经济事件日期（期间归属），月结按它锁定；¥ 流水按汇率折 RM 入账。
  const LED_KINDS = { income: '收款', refund: '退款', expense: '支出', withdrawal: '提现', adjustment: '调整' };
  const LED_CATS = ['server', 'domain', 'saas', 'legal', 'marketing', 'tax', 'subscription', 'other'];
  const LED_CAT_ZH = { server: '服务器', domain: '域名', saas: 'SaaS 订阅', legal: '法务', marketing: '推广', tax: '税费', subscription: '订阅收款', other: '其他' };
  const LED_COLS = ['kind', 'category', 'amount', 'currency', 'occurred_at', 'counterparty', 'note', 'invoice'];
  const ledLocked = () => { const r = db.prepare("SELECT value FROM kv WHERE key = 'ledger.closed_upto'").get(); return r ? r.value : null; };
  function ledGuard(at) { const c = ledLocked(); if (c && at.slice(0, 7) <= c) throw new HttpError('RESTRICTED', '该日期所在月份已月结锁定（截至 ' + c + '），流水不可改动'); }
  function ledBody(body) {
    const kind = body.kind, cat = body.category || 'other';
    if (!(kind in LED_KINDS)) throw new HttpError('VALIDATION', 'kind 需为 income/refund/expense/adjustment');
    if (!LED_CATS.includes(cat)) throw new HttpError('VALIDATION', 'category 非法');
    const amount = Math.round(Number(body.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) throw new HttpError('VALIDATION', 'amount 需为 0-1e9 正数');
    const currency = body.currency === 'CNY' ? 'CNY' : (body.currency === 'RM' ? 'RM' : null);
    if (!currency) throw new HttpError('VALIDATION', 'currency 需为 RM/CNY');
    const at = String(body.occurred_at || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) throw new HttpError('VALIDATION', 'occurred_at 需为 YYYY-MM-DD');
    return { kind, category: cat, amount, currency, occurred_at: at,
      counterparty: String(body.counterparty || '').slice(0, 120),
      note: String(body.note || '').slice(0, 300),
      invoice: String(body.invoice || '').slice(0, 100) };
  }
  const ledRow = (r) => ({ id: r.id, kind: r.kind, category: r.category, amount: r.amount, currency: r.currency,
    occurred_at: r.occurred_at, counterparty: r.counterparty, note: r.note, invoice: r.invoice,
    by: r.by || null, createdAt: r.created_at });

  router.add('GET', '/api/admin/ledger', requireAdmin((req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const rows = db.prepare('SELECT l.*, u.email AS by FROM ledger l LEFT JOIN users u ON u.id = l.created_by '
      + 'ORDER BY l.occurred_at DESC, l.seq DESC LIMIT ?').all(limit);
    sendJson(res, 200, { rows: rows.map(ledRow), locked: ledLocked() });
  }));

  // CSV 导出（Excel 兼容：BOM + 中文表头；含全部流水）
  router.add('GET', '/api/admin/ledger/export', requireAdmin((req, res) => {
    const rows = db.prepare('SELECT l.*, u.email AS by FROM ledger l LEFT JOIN users u ON u.id = l.created_by '
      + 'ORDER BY l.occurred_at ASC, l.seq ASC').all();
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = ['﻿流水号,日期,类型,分类,金额,币种,对方,备注,发票号,录入人,录入时间'];
    for (const r of rows) lines.push([
      r.id, r.occurred_at, LED_KINDS[r.kind] || r.kind, LED_CAT_ZH[r.category] || r.category,
      r.amount, r.currency, r.counterparty, r.note, r.invoice, r.by || '', (r.created_at || '').slice(0, 19).replace('T', ' ')
    ].map(esc).join(','));
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ledger.csv"' });
    res.end(lines.join('\r\n'));
  }));

  // 月结锁定：财报出完锁定某月及更早的流水（只可向更晚月份推进；解锁需直接改 kv，走审计）
  router.add('POST', '/api/admin/ledger/close', requireAdmin(async (req, res) => {
    adminWrite();
    const body = await readJson(req);
    const month = String(body.month || '');
    if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError('VALIDATION', 'month 需为 YYYY-MM');
    const cur = ledLocked();
    if (cur && month <= cur) throw new HttpError('VALIDATION', '月结只可向更晚月份推进（当前截至 ' + cur + '）');
    db.prepare("INSERT INTO kv (key, value, updated_at) VALUES ('ledger.closed_upto', ?, ?) "
      + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
      .run(month, new Date().toISOString());
    audit(ctx, 'ledger_close', 'ledger', { month });
    sendJson(res, 200, { ok: true, locked: month });
  }));

  router.add('POST', '/api/admin/ledger', requireAdmin(async (req, res) => {
    adminWrite();
    const body = await readJson(req);
    const e = ledBody(body);
    ledGuard(e.occurred_at);
    const { id } = insertWithId(db, 'ledger', LED_COLS.concat(['created_by', 'created_at']),
      LED_COLS.map((k) => e[k]).concat([ctx.user.id, new Date().toISOString()]), (s) => 'LED-' + pad6(s));
    audit(ctx, 'ledger_add', id, e);
    sendJson(res, 200, { ok: true, id });
  }));

  router.add('PUT', '/api/admin/ledger/:id', requireAdmin(async (req, res) => {
    adminWrite();
    const old = db.prepare('SELECT * FROM ledger WHERE id = ?').get(req.params.id);
    if (!old) throw new HttpError('NOT_FOUND', '流水不存在');
    const body = await readJson(req);
    const e = ledBody(body);
    ledGuard(e.occurred_at); ledGuard(old.occurred_at); // 原日期与改后日期都不得在锁定月内
    db.prepare('UPDATE ledger SET ' + LED_COLS.map((k) => k + ' = ?').join(', ') + ' WHERE id = ?')
      .run(...LED_COLS.map((k) => e[k]), req.params.id);
    audit(ctx, 'ledger_edit', old.id, { before: { kind: old.kind, amount: old.amount, currency: old.currency, occurred_at: old.occurred_at }, after: e });
    sendJson(res, 200, { ok: true, id: old.id });
  }));

  router.add('DELETE', '/api/admin/ledger/:id', requireAdmin(async (req, res) => {
    adminWrite();
    const old = db.prepare('SELECT * FROM ledger WHERE id = ?').get(req.params.id);
    if (!old) throw new HttpError('NOT_FOUND', '流水不存在');
    ledGuard(old.occurred_at);
    db.prepare('DELETE FROM ledger WHERE id = ?').run(req.params.id);
    audit(ctx, 'ledger_delete', old.id, { kind: old.kind, amount: old.amount, currency: old.currency, occurred_at: old.occurred_at });
    sendJson(res, 200, { ok: true, id: old.id });
  }));

  // ── 季度财报（管理端一键生成：分月聚合流水/用量 + 审计重放月末参数 + 月结状态 + 上季对比；生成落审计） ──
  // 口径：权责发生制（occurred_at 期间归属）；¥ 按月末汇率（finance_set 审计重放）折 RM；
  // 税费 = 预计收入 × 月末税率（估算，与总览一致）；固定成本为估算；实际收款 = 流水收款 − 退款；
  // 未月结月份在报表中标「未锁定」——月结后重新生成即定格。
  const RPT_PRICE = { basic: 12, premium: 23.5, ultra: 45.5 }; // 对齐 docs/pages/premium.html ms-MY 月价（Basic 学生价）
  function reportMonths(y, q) {
    const out = [];
    for (let i = 0; i < 3; i++) out.push(new Date(Date.UTC(y, (q - 1) * 3 + i, 1)).toISOString().slice(0, 7));
    return out;
  }
  function buildReport(y, q) {
    const months = reportMonths(y, q);
    const events = db.prepare("SELECT created_at AS at, action, detail FROM admin_audit_log WHERE action IN ('set_tier','finance_set') ORDER BY seq ASC").all();
    const ledRows = db.prepare('SELECT kind, category, amount, currency, occurred_at FROM ledger').all();
    const usageMonths = {};
    for (const r of db.prepare("SELECT strftime('%Y-%m', created_at) AS m, SUM(cost_micro) AS c FROM usage_log GROUP BY m").all()) usageMonths[r.m] = r.c;
    const lockUpto = (db.prepare("SELECT value FROM kv WHERE key = 'ledger.closed_upto'").get() || {}).value || null;
    const cnt = { basic: 0, premium: 0, ultra: 0 };
    const prm = { fx: FIN_DEFAULTS.fx, taxRate: FIN_DEFAULTS.taxRate, fixedMonthly: FIN_DEFAULTS.fixedMonthly };
    const catSum = {};
    let evI = 0;
    const monthly = [];
    const t = { est: 0, income: 0, refund: 0, paid: 0, expense: 0, ai: 0, fixed: 0, tax: 0, net: 0, adj: 0, withdrawn: 0 };
    for (const m of months) {
      const bound = m + '-31'; // 字符串比较的月末上界（合法日期最大 31 号，各月天数无碍）
      while (evI < events.length && events[evI].at.slice(0, 10) <= bound) {
        const e = events[evI++];
        let de = null; try { de = JSON.parse(e.detail); } catch (err) {}
        if (e.action === 'set_tier') {
          if (de && de.from in cnt && cnt[de.from] > 0) cnt[de.from]--; // 存量 Basic 升级事件自 0 起步不减负（重放无此前 +basic 事件）
          if (de && de.to in cnt) cnt[de.to]++;
        } else {
          const src = de && de.to ? de.to : de; // 新格式 {from,to} 取 to / 旧格式直接值（与曲线重放同口径）
          for (const k of ['fx', 'taxRate', 'fixedMonthly']) if (src && Number.isFinite(Number(src[k]))) prm[k] = Number(src[k]);
        }
      }
      let income = 0, refund = 0, expense = 0, adj = 0, withdrawn = 0;
      for (const r of ledRows) {
        if (String(r.occurred_at).slice(0, 7) !== m) continue;
        const v = Math.round(Number(r.amount) * (r.currency === 'CNY' ? prm.fx : 1) * 100) / 100;
        if (r.kind === 'income') income += v;
        else if (r.kind === 'refund') refund += v;
        else if (r.kind === 'expense') { expense += v; catSum[r.category] = (catSum[r.category] || 0) + v; }
        else if (r.kind === 'withdrawal') withdrawn += v; // 提现转出他用：单列资金去向，不进支出/不进净利
        else adj += v;
      }
      const est = Math.round((cnt.basic * RPT_PRICE.basic + cnt.premium * RPT_PRICE.premium + cnt.ultra * RPT_PRICE.ultra) * 100) / 100;
      const ai = Math.round(((usageMonths[m] || 0) / 1e6) * prm.fx * 100) / 100;
      const paid = Math.round((income - refund) * 100) / 100;
      const tax = Math.round(est * prm.taxRate * 100) / 100;
      const net = Math.round((paid - expense - ai - prm.fixedMonthly - tax) * 100) / 100;
      monthly.push({
        month: m, locked: !!lockUpto && m <= lockUpto, fx: prm.fx, taxRate: prm.taxRate,
        est, income: Math.round(income * 100) / 100, refund: Math.round(refund * 100) / 100, paid,
        expense: Math.round(expense * 100) / 100, ai, fixed: prm.fixedMonthly, tax, net,
        adj: Math.round(adj * 100) / 100, withdrawn: Math.round(withdrawn * 100) / 100
      });
      const cur = monthly[monthly.length - 1];
      for (const k of Object.keys(t)) t[k] = Math.round((t[k] + cur[k]) * 100) / 100;
    }
    const target = Number((db.prepare("SELECT value FROM kv WHERE key = 'finance.quarterTarget'").get() || {}).value) || 0;
    t.retained = Math.round((t.net - t.withdrawn) * 100) / 100; // 留存资金：净利 − 提现（提现不计损益，只记资金去向）
    return {
      year: y, q, quarter: y + '-Q' + q, months, monthly, totals: t,
      byCategory: Object.keys(catSum).map((k) => ({ category: k, amount: Math.round(catSum[k] * 100) / 100 })).sort((a, b) => b.amount - a.amount),
      gap: Math.round((t.est - t.paid) * 100) / 100,
      target,
      targetPaidPct: target > 0 ? Math.round(t.paid / target * 100) : null,
      targetEstPct: target > 0 ? Math.round(t.est / target * 100) : null,
      unclosed: monthly.filter((mm) => !mm.locked).map((mm) => mm.month)
    };
  }
  function rptParams(query) {
    const now = new Date();
    let y = Number(query.year), q = Number(query.quarter);
    if (!query.year && !query.quarter) { y = now.getUTCFullYear(); q = Math.floor(now.getUTCMonth() / 3) + 1; }
    else {
      if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new HttpError('VALIDATION', 'year 需为 2000-2100');
      if (!Number.isInteger(q) || q < 1 || q > 4) throw new HttpError('VALIDATION', 'quarter 需为 1-4');
    }
    return { year: y, quarter: q };
  }

  router.add('GET', '/api/admin/finance/report', requireAdmin((req, res) => {
    const { year, quarter } = rptParams(req.query);
    const rp = buildReport(year, quarter);
    const pv = buildReport(quarter === 1 ? year - 1 : year, quarter === 1 ? 4 : quarter - 1);
    const emailRow = db.prepare('SELECT email FROM users WHERE id = ?').get(ctx.user.id);
    audit(ctx, 'ledger_report', rp.quarter, { year, quarter }); // 生成即落审计（谁/何时/哪一季）
    sendJson(res, 200, {
      ...rp,
      generatedAt: new Date().toISOString(),
      generatedBy: emailRow ? emailRow.email : ctx.user.id,
      prev: { quarter: pv.quarter, totals: pv.totals }
    });
  }));

  // 财报 CSV 导出（Excel 兼容：BOM + 分节；口径说明在首节）
  router.add('GET', '/api/admin/finance/report/export', requireAdmin((req, res) => {
    const { year, quarter } = rptParams(req.query);
    const rp = buildReport(year, quarter);
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const ln = [];
    ln.push(['M.LoreWorld 季度财报', rp.quarter + '（' + rp.months[0] + ' ~ ' + rp.months[2] + '）'].map(esc).join(','));
    ln.push(['口径', '权责发生制（按经济事件日期）；¥ 按月末汇率折 RM；税费 = 预计收入 × 税率（估算）；固定成本为估算；实际收款 = 流水收款 − 退款；提现转出单列（不计支出/净利），留存 = 净利 − 提现'].map(esc).join(','));
    ln.push('');
    ln.push(['月份,月结,预计收入(RM),实际收款(RM),流水支出(RM),AI 成本(RM),固定成本(RM),税费(RM),净利润(RM),调整(RM),提现转出(RM)']);
    for (const m of rp.monthly) ln.push([m.month, m.locked ? '已锁定' : '未锁定', m.est, m.paid, m.expense, m.ai, m.fixed, m.tax, m.net, m.adj, m.withdrawn].map(esc).join(','));
    ln.push(['合计', '', rp.totals.est, rp.totals.paid, rp.totals.expense, rp.totals.ai, rp.totals.fixed, rp.totals.tax, rp.totals.net, rp.totals.adj, rp.totals.withdrawn].map(esc).join(','));
    ln.push('');
    ln.push(['支出分类汇总（流水支出）']);
    ln.push(['分类,金额(RM)']);
    for (const c of rp.byCategory) ln.push([LED_CAT_ZH[c.category] || c.category, c.amount].map(esc).join(','));
    ln.push('');
    ln.push(['季度目标(RM)', rp.target, '实收达成', rp.targetPaidPct == null ? '未设置' : rp.targetPaidPct + '%'].map(esc).join(','));
    ln.push(['预计收入 − 实际收款（应收实收差）', rp.gap].map(esc).join(','));
    ln.push(['留存资金（净利 − 提现）', rp.totals.retained].map(esc).join(','));
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="quarterly-report-' + rp.quarter + '.csv"' });
    res.end('﻿' + ln.join('\r\n'));
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
