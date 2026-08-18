'use strict';
// 入口：node:http 服务器 + 路由装配 + /api/health。
// 依赖注入 createServer(deps)：deps = { db, router, config }（测试注入临时 SQLite）。

const http = require('node:http');
const config = require('./config');
const { openDb } = require('./db');
const Router = require('./router');
const { sendJson, sendError } = require('./http');

const VERSION = '0.1.0';

function createServer(deps = {}) {
  const cfg = deps.config || config;
  const db = deps.db || openDb(cfg.databasePath);
  const router = deps.router || new Router();

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

  const server = http.createServer((req, res) => {
    (async () => {
      try {
        const route = router.match(req);
        if (!route) {
          return sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
        }
        req.params = route.params;
        await route.handler(req, res, { db, config: cfg });
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
