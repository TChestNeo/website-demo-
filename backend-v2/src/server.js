'use strict';
// 入口：node:http 服务器 + 路由装配 + /api/health。
// 依赖注入 createServer(deps)：deps = { db, router, config }（测试注入临时 SQLite）。
// W0 注册：health + 公网 auth + staff auth；W1 注册 routes/public/* 全部 + moderation 共享件 + cron。
// W2+ 按波追加 routes/staff/*。

const http = require('node:http');
const config = require('./config');
const { openDb } = require('./db');
const Router = require('./router');
const { sendJson, sendError } = require('./http');
const { createRateLimiter } = require('./middleware/ratelimit');
const { createMailer } = require('./email');
const { maintenanceGuard } = require('./middleware/maintenance');
const { register: registerAuth } = require('./routes/public/auth');
const { register: registerStaffAuth } = require('./routes/staff/auth');
const { register: registerSocial } = require('./routes/public/social');
const { register: registerMessages } = require('./routes/public/messages');
const { register: registerTickets } = require('./routes/public/tickets');
const { register: registerSubscriptions } = require('./routes/public/subscriptions');
const { register: registerStudentVerify } = require('./routes/public/student-verify');
const { register: registerBadge } = require('./routes/public/badge');
const { register: registerDrafts } = require('./routes/public/drafts');
const { register: registerArticles } = require('./routes/public/articles');
const { register: registerReports } = require('./routes/public/reports');
const { register: registerChat } = require('./routes/public/chat');
const { register: registerAnalyticsEvents } = require('./routes/public/analytics-events');
const { register: registerStaffDashboard } = require('./routes/staff/dashboard');
const { register: registerStaffAnalytics } = require('./routes/staff/analytics');
const { register: registerStaffUsers } = require('./routes/staff/users');
const { register: registerStaffSecurity } = require('./routes/staff/security');
const { register: registerStaffSubscriptions } = require('./routes/staff/subscriptions');
const { createBudget } = require('./moderation/budget');
const blocklist = require('../data/blocklist.json');

const VERSION = '2.0.0';

function createServer(deps = {}) {
  const cfg = deps.config || config;
  const db = deps.db || openDb(cfg.databasePath);
  const router = deps.router || new Router();
  const limiter = deps.limiter || createRateLimiter(db);
  const mailer = deps.mailer || createMailer(cfg);
  const guard = maintenanceGuard(db);

  // 健康检查：进程存活 + 数据库可查询 + 表数量（部署清单第一项）
  router.add('GET', '/api/health', (req, res) => {
    const tables = db
      .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .get().n;
    sendJson(res, 200, {
      status: 'ok',
      db: 'ok',
      tables,
      version: VERSION,
      time: new Date().toISOString()
    });
  });

  // 依赖上下文（各 routes/* 共享）
  // moderation：审核管线共享件——budget（月度硬上限）、fetchImpl（测试注入桩）、L0 词表
  // 顶层 budget = moderation.budget 同一实例——budget-alert 依赖 ctx.budget（v1 缺此键，
  // 每日 10:30 告警会 TypeError 被 cron 静默吞掉；v2 显式补齐）
  const budget = createBudget(db, cfg);
  const ctx = {
    db, config: cfg, limiter, mailer,
    budget,
    moderation: {
      budget,
      fetchImpl: deps.fetchImpl || global.fetch,
      blocklist
    }
  };
  registerAuth(router, ctx);
  registerStaffAuth(router, ctx);
  registerSocial(router, ctx);
  registerMessages(router, ctx);
  registerTickets(router, ctx);
  registerSubscriptions(router, ctx);
  registerStudentVerify(router, ctx);
  registerBadge(router, ctx);
  registerDrafts(router, ctx);
  registerArticles(router, ctx);
  registerReports(router, ctx);
  registerChat(router, ctx);
  registerAnalyticsEvents(router, ctx);
  registerStaffDashboard(router, ctx);
  registerStaffAnalytics(router, ctx);
  registerStaffUsers(router, ctx);
  registerStaffSecurity(router, ctx);
  registerStaffSubscriptions(router, ctx);

  const server = http.createServer((req, res) => {
    (async () => {
      try {
        // 维护模式：公网拒绝 503（/api/staff/*、/api/health 放行——后台必须能关掉它）
        guard(req, res, () => {});
        // CORS（前端独立托管、API 独立子域）：仅白名单 Origin 反射头；带 Origin 的预检 204 直回。
        // 无 Origin 的请求（同域/curl/服务器间）不加任何 CORS 头，行为与 v1 完全一致。
        const origin = req.headers.origin || '';
        if (origin && cfg.frontendOrigins.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          res.setHeader('Vary', 'Origin');
          if (req.method === 'OPTIONS' && req.headers['access-control-request-method']) {
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.setHeader('Access-Control-Max-Age', '86400');
            res.writeHead(204);
            res.end();
            return;
          }
        }
        const route = router.match(req);
        if (!route) {
          return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
        }
        req.params = route.params;
        req.query = {}; // ?a=1&b=2 → {a:'1',b:'2'}（管理端列表过滤用）
        for (const [k, v] of new URLSearchParams((req.url || '').split('?')[1] || '')) req.query[k] = v;
        await route.handler(req, res, ctx);
      } catch (err) {
        sendError(res, err);
      }
    })();
  });
  server.db = db;
  server.ctx = ctx;
  return server;
}

if (require.main === module) {
  const server = createServer();
  server.listen(config.port, config.host, () => {
    console.log(`MN backend v2 (${VERSION}) listening on http://${config.host}:${config.port}`);
  });
  // 审核三班 + 图像滞留兜底 + 预算日结告警 cron（仅 main 进程；测试进程不启动）
  const { startCron } = require('./cron');
  startCron(server.ctx);
}

module.exports = { createServer, VERSION };
