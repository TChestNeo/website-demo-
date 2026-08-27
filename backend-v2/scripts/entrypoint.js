'use strict';
// Cloud Run 容器入口（部署专用脚本，不参与 npm test）：
//   1) SEED_ON_BOOT=1 → 先跑 seed.js（ADMIN_EMAIL 必配，按邮箱幂等；缺 ADMIN_EMAIL 直接 exit 1）
//   2) API 起在容器内网 127.0.0.1:API_PORT（不直接对外）
//   3) 对外 PORT（Cloud Run 注入，默认 8080）跑 dev-serve 同款静态服务：docs/ 静态 + /api/* 反代
// 一个 URL = 公网站点 + /admin/ 管理后台 + /api 全链路；COOKIE_DOMAIN/CORS 留空（同源）。
// cron 不启动（server.js 的 startCron 只在直接 node src/server.js 时挂；scale-to-zero 下进程内定时无意义）。

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

if (process.env.SEED_ON_BOOT === '1') require('./seed.js');

const config = require('../src/config');
const { createServer } = require('../src/server');

const API_PORT = Number(process.env.API_PORT || 8081);
const api = createServer();
api.listen(API_PORT, '127.0.0.1', () => {
  console.log(`[entrypoint] API  http://127.0.0.1:${API_PORT}`);
});

const DOCS = path.resolve(process.env.STATIC_DIR || path.join(__dirname, '..', '..', 'docs'));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json'
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    const proxy = http.request({
      host: '127.0.0.1', port: API_PORT,
      path: url.pathname + url.search, method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${API_PORT}` }
    }, (pr) => {
      res.writeHead(pr.statusCode, pr.headers);
      pr.pipe(res);
    });
    proxy.on('error', () => { res.writeHead(502); res.end('backend down'); });
    req.pipe(proxy);
    return;
  }
  let p;
  try { p = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname); }
  catch { res.writeHead(400); res.end('Bad request'); return; }
  if (p.endsWith('/')) p += 'index.html'; // 目录 → 索引文档（对齐 COS 静态网站 /admin/ → index.html）
  const file = path.normalize(path.join(DOCS, p));
  if (!file.startsWith(DOCS + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    // 试用期：强制每次校验（无 ETag 时浏览器会对 HTML 启发式缓存 → 可能看到旧页面）
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(buf);
  });
}).listen(config.port, '0.0.0.0', () => {
  console.log(`[entrypoint] front http://0.0.0.0:${config.port} (docs/ + /api → :${API_PORT})`);
});

// Cloud Run scale-down 发 SIGTERM：优雅关 API，5s 兜底强退
process.on('SIGTERM', () => {
  console.log('[entrypoint] SIGTERM：关闭 API');
  api.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
});
