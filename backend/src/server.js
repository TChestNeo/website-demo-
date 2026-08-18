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
const { register: registerBadge } = require('./routes/badge');
const { register: registerDrafts } = require('./routes/drafts');
const { register: registerArticles } = require('./routes/articles');

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
  const ctx = { db, config: cfg, limiter, mailer };
  registerAuth(router, ctx);
  registerSocial(router, ctx);
  registerMessages(router, ctx);
  registerTickets(router, ctx);
  registerBadge(router, ctx);
  registerDrafts(router, ctx);
  registerArticles(router, ctx);

  const server = http.createServer((req, res) => {
    (async () => {
      try {
        const route = router.match(req);
        if (!route) {
          return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
        }
        req.params = route.params;
        await route.handler(req, res, ctx);
      } catch (err) {
        sendError(res, err);
      }
    })();
  });
  server.db = db;
  return server;
}

if (require.main === module) {
  const server = createServer();
  server.listen(config.port, config.host, () => {
    console.log(`MN backend v${VERSION} listening on http://${config.host}:${config.port}`);
  });
}

module.exports = { createServer };
