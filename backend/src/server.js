'use strict';
// 入口：node:http 服务器 + 路由装配 + /api/health。
// 依赖注入 createServer(deps)：deps = { db, router, config }（测试注入临时 SQLite）。

const http = require('node:http');
const config = require('./config');
const { openDb } = require('./db');
const Router = require('./router');
const { sendJson, sendError } = require('./http');
const { createRateLimiter } = require('./middleware/ratelimit');
const { createMailer } = require('./email');
const { register: registerAuth } = require('./routes/auth');
const { register: registerSocial } = require('./routes/social');
const { register: registerMessages } = require('./routes/messages');
const { register: registerTickets } = require('./routes/tickets');
const { register: registerSubscriptions } = require('./routes/subscriptions');
const { register: registerBadge } = require('./routes/badge');
const { register: registerDrafts } = require('./routes/drafts');
const { register: registerArticles } = require('./routes/articles');
const { register: registerReports } = require('./routes/reports');
const { register: registerChat } = require('./routes/chat');
const { register: registerAdmin } = require('./routes/admin');
const { createBudget } = require('./moderation/budget');
const blocklist = require('../data/blocklist.json');

const VERSION = '0.1.0';

function createServer(deps = {}) {
  const cfg = deps.config || config;
  const db = deps.db || openDb(cfg.databasePath);
  const router = deps.router || new Router();
  const limiter = deps.limiter || createRateLimiter();
  const mailer = deps.mailer || createMailer(cfg);

  // 健康检查：进程存活 + 数据库可查询 + 用户表数量（部署清单第一项）
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
  const ctx = {
    db, config: cfg, limiter, mailer,
    moderation: {
      budget: createBudget(db, cfg),
      fetchImpl: deps.fetchImpl || global.fetch,
      blocklist
    }
  };
  registerAuth(router, ctx);
  registerSocial(router, ctx);
  registerMessages(router, ctx);
  registerTickets(router, ctx);
  registerSubscriptions(router, ctx);
  registerBadge(router, ctx);
  registerDrafts(router, ctx);
  registerArticles(router, ctx);
  registerReports(router, ctx);
  registerChat(router, ctx);
  registerAdmin(router, ctx);

  const server = http.createServer((req, res) => {
    (async () => {
      try {
        // CORS（前端独立托管、API 独立子域）：仅白名单 Origin 反射头；带 Origin 的预检 204 直回。
        // 无 Origin 的请求（同域/curl/服务器间）不加任何 CORS 头，行为与之前完全一致。
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
        req.query = {}; // ?a=1&b=2 → {a:'1',b:'2'}（P9 管理端列表过滤用）
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
    console.log(`MN backend v${VERSION} listening on http://${config.host}:${config.port}`);
  });
  // 审核三班 cron（仅 main 进程；测试进程不启动）
  const { startCron } = require('./cron');
  startCron(server.ctx);
}

module.exports = { createServer };
