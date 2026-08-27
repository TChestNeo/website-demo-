'use strict';
// SlatiControl 总览（§1）：GET /api/staff/dashboard（dashboard.view）——六组统计卡单次聚合。
// 六组：用户（总量/新 7d/活跃 24h/封禁）、内容（帖子/待审/下架/待处理举报）、
//   社区（国家/团队/私信会话/关注）、财务（本月收入/MRR/AI 成本/付费用户）、
//   客服（待处理工单/未分配/升级中/30d 已解决）、平台（24h 注册/24h 登录/24h 失败登录/高风险）。
// 纯读端点：零写库、零审计（敏感读审计仅 view_dm/view_chat_logs 等口径）。

const { sendJson, HttpError } = require('../../http');
const { requirePerm } = require('../../middleware/staff-auth');
const { rangeWindow } = require('../../analytics/window');
const usersA = require('../../analytics/users');
const contentA = require('../../analytics/content');
const communityA = require('../../analytics/community');
const financeA = require('../../analytics/finance');

function monthWindow(now = new Date()) {
  const fromIso = now.toISOString().slice(0, 8) + '01T00:00:00.000Z';
  return { fromIso, toIso: now.toISOString(), fromDate: fromIso.slice(0, 10), toDate: now.toISOString().slice(0, 10) };
}

function buildDashboard(db) {
  const now = new Date();
  const iso = now.toISOString();
  const dayAgo = new Date(now.getTime() - 86400e3).toISOString();
  const w7 = rangeWindow('7d', null, null, now);
  const w24 = rangeWindow('today', null, null, now);
  const wm = monthWindow(now);
  const q = (sql, ...args) => db.prepare(sql).get(...args).n;

  const users = usersA.overview(db, w7);
  const finance = financeA.overview(db, wm);
  const community = communityA.overview(db, w7);

  return {
    generatedAt: iso,
    groups: {
      users: {
        total: users.total,
        new7d: users.newCount,
        active24h: q('SELECT count(DISTINCT user_id) AS n FROM activity_daily WHERE date >= ?', w24.fromDate),
        banned: q("SELECT count(*) AS n FROM users WHERE status = 'banned'")
      },
      content: {
        posts: q('SELECT count(*) AS n FROM posts'),
        pendingModeration: contentA.overview(db, w7).pendingModeration,
        hidden: q("SELECT count(*) AS n FROM posts WHERE status IN ('hidden','removed')"),
        openReports: q("SELECT count(*) AS n FROM reports WHERE status = 'open'")
      },
      community: {
        nations: community.nations,
        teams: community.teams,
        conversations: community.conversations,
        following: community.following
      },
      finance: {
        revenueMonthMicro: finance.revenueMicro,
        mrrMicro: finance.mrrMicro,
        aiCostMonthMicro: finance.aiCostMicro,
        payingUsers: finance.payingUsers
      },
      tickets: {
        open: q("SELECT count(*) AS n FROM tickets WHERE status IN ('queued','in_progress','pending_user','escalated')"),
        unassigned: q("SELECT count(*) AS n FROM tickets WHERE status IN ('queued','in_progress','pending_user','escalated') AND assigned_staff_id IS NULL"),
        escalated: q("SELECT count(*) AS n FROM tickets WHERE status = 'escalated'"),
        resolved30d: q("SELECT count(*) AS n FROM tickets WHERE status = 'resolved' AND resolved_at >= ?", dayAgo)
      },
      platform: {
        signups24h: q('SELECT count(*) AS n FROM users WHERE created_at >= ?', dayAgo),
        logins24h: q("SELECT count(*) AS n FROM login_history WHERE result = 'success' AND created_at >= ?", dayAgo),
        failedLogins24h: q("SELECT count(*) AS n FROM login_history WHERE result = 'failed' AND created_at >= ?", dayAgo),
        riskHigh: q("SELECT count(*) AS n FROM users WHERE risk_level = 'high'")
      }
    }
  };
}

function register(router, ctx) {
  router.add('GET', '/api/staff/dashboard', requirePerm('dashboard.view')((req, res) => {
    sendJson(res, 200, buildDashboard(ctx.db));
  }));
}

module.exports = { register, buildDashboard };
