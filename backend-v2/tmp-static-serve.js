'use strict';
// tmp-static-serve.js — 电池用极简静态服务器（tmp 绝不 commit）：docs/ 映射到根，含无扩展名回退
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..', 'docs');
const PORT = Number(process.argv[2] || 8901);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  let file = path.join(ROOT, p);
  if (!fs.existsSync(file) && path.extname(file) === '') file += '.html'; // entrypoint .html 回退
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('{}'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('static serve on', PORT, 'root', ROOT));
