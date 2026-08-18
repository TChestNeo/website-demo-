'use strict';
// 本地联调：静态服务 docs/ + /api/* 反代到后端（零依赖，等价生产 Caddy 行为）。
// 用法：后端先 npm start（默认 :3000），再 node scripts/dev-serve.js [port]

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.argv[2] || 8080);
const DOCS = path.join(__dirname, '..', '..', 'docs');
const API_PORT = Number(process.env.API_PORT || 3000);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon'
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
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  if (p.endsWith('/')) p += 'index.html'; // 目录 → 索引文档（对齐 COS 静态网站 /admin/ → index.html）
  const file = path.join(DOCS, decodeURIComponent(p));
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`dev-serve http://127.0.0.1:${PORT} (docs/ + /api → :${API_PORT})`));
