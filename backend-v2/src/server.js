'use strict';
// 入口：node:http 服务器 + 路由装配 + /api/health。
// 依赖注入 createServer(deps)：deps = { db, router, config }（测试注入临时 SQLite）。
// W0 注册：health + 公网 auth + staff auth；W1+ 按波追加 routes/public/*、routes/staff/*。

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

  // 依赖上下文（各 routes/* 共享；W1 起追加 moderation/ai/stripe 等）
  const ctx = {
    db, config: cfg, limiter, mailer
  };
  registerAuth(router, ctx);
  registerStaffAuth(router, ctx);

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
  // W1：审核三班 cron（仅 main 进程；测试进程不启动）
}

module.exports = { createServer, VERSION };
