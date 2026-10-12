// tmp-house-server.js — 一次性静态 server（探针专用，用后即删）
// 用法：node tmp-house-server.js <port>（root=../docs）
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..', 'docs');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const port = Number(process.argv[2] || 8154);
http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); return res.end('{"error":"not found"}'); }
  let f = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
  if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log('house server on :' + port));
