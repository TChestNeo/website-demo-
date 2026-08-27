'use strict';
// SlatiControl 分析（§2）：GET /api/staff/analytics/:domain（analytics.view）。
//   domain ∈ users|content|community|traffic|finance；range = today|7d|30d|90d|1y|custom（custom 带 from/to）。
// 响应 { domain, range, from, to, overview, daily }——全部读时聚合（D9），零写库。

const { sendJson, HttpError } = require('../../http');
const { requirePerm } = require('../../middleware/staff-auth');
const { rangeWindow, RANGES } = require('../../analytics/window');

const DOMAINS = {
  users: require('../../analytics/users'),
  content: require('../../analytics/content'),
  community: require('../../analytics/community'),
  traffic: require('../../analytics/traffic'),
  finance: require('../../analytics/finance')
};

function register(router, ctx) {
  router.add('GET', '/api/staff/analytics/:domain', requirePerm('analytics.view')((req, res) => {
    const domain = req.params.domain;
    const builder = DOMAINS[domain];
    if (!builder) throw new HttpError('VALIDATION', 'domain 非法（users|content|community|traffic|finance）');
    const qp = req.query;
    const range = RANGES.includes(qp.range) ? qp.range : '30d';
    const w = rangeWindow(range, qp.from, qp.to);
    sendJson(res, 200, {
      domain, range, from: w.fromDate, to: w.toDate,
      overview: builder.overview(ctx.db, w),
      daily: builder.daily(ctx.db, w)
    });
  }));
}

module.exports = { register };
