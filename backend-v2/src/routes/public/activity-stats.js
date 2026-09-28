'use strict';
// 公网活动页聚合（v0.2.58.16 动态页真实数据接入）：GET /api/public/activity?range=7d|30d|90d|all。
// 匿名公开（social.js 先例，无会话）；轻限流防刷；纯读聚合零迁移。
// range 白名单外一律回退 30d；'all' → custom 窗自 2000-01-01（rangeWindow custom 分支吃日期串）。
// 'all' 前窗为空 → 全部 deltaPct null（前端渲染 '—'，语义可接受已注释）。

const { sendJson, HttpError } = require('../../http');
const { ipOf } = require('../../middleware/ratelimit');
const { rangeWindow } = require('../../analytics/window');
const pa = require('../../analytics/public-activity');

function register(router, ctx) {
  router.add('GET', '/api/public/activity', (req, res) => {
    const w = (ctx.config.rateLimits || {}).publicActivity || { max: 30, windowMs: 60000 };
    if (!ctx.limiter('pa:ip:' + ipOf(req), w.max, w.windowMs)) throw new HttpError('RATE_LIMITED', '请求过于频繁');
    let range = String(req.query.range || '30d');
    if (['7d', '30d', '90d', 'all'].indexOf(range) === -1) range = '30d';
    const wnd = range === 'all'
      ? rangeWindow('custom', '2000-01-01', new Date().toISOString())
      : rangeWindow(range);
    const len = wnd.toMs - wnd.fromMs;
    // to=fromMs-1ms：custom 分支要求 t>fromMs 才采纳（等长前窗 [fromMs-len, fromMs)；'all' 同理）
    const prevWnd = rangeWindow('custom', new Date(wnd.fromMs - len).toISOString(), new Date(wnd.fromMs - 1).toISOString());
    sendJson(res, 200, {
      range,
      from: wnd.fromIso,
      to: wnd.toIso,
      kpi: pa.kpi(ctx.db, wnd, prevWnd),
      trends: pa.trends(ctx.db),
      contentTypes: pa.contentTypes(ctx.db, wnd),
      heatmap: pa.heatmap(ctx.db),
      leaderboard: pa.leaderboard(ctx.db, wnd),
      milestones: pa.milestones(ctx.db, wnd)
    });
  });
}

module.exports = { register };
