// tmp-smoke-plugins-000.js — 插件商店端到端冒烟：内存后端 + docs 静态 + /api 代理，验证列表渲染/弹窗
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { createServer } = require('./src/server');
const { openDb } = require('./src/db');

const PORT = 4800 + Math.floor(Math.random() * 400);
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-smoke-plugins-' + Date.now());
const DOCS = path.resolve(__dirname, '..', 'docs');

const backend = createServer({ db: openDb(':memory:') });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u.startsWith('/api/')) { backend.emit('request', req, res); return; }
  let f = path.join(DOCS, u === '/' ? '/index.html' : u);
  if (!fs.existsSync(f) && !path.extname(f) && fs.existsSync(f + '.html')) f += '.html';
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, e, t, l) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + e + ')')) return true; } catch (x) {} await sleep(150); } throw new Error('waitFor:' + l); }
class CDP {
  constructor(u) { this.u = u; this.id = 0; this.p = new Map(); }
  async connect() { this.w = new WebSocket(this.u); await new Promise((r, j) => { this.w.onopen = r; this.w.onerror = () => j(new Error('ws')); }); this.w.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.p.has(m.id)) { const { r, j } = this.p.get(m.id); this.p.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); } }; }
  send(m, p) { return new Promise((r, j) => { const id = ++this.id; this.p.set(id, { r, j }); this.w.send(JSON.stringify({ id, method: m, params: p || {} })); }); }
  async evalJs(x) { const r = await this.send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  // 先直接打 API 验证
  const api = await (await fetch(BASE + '/api/plugins')).json();
  console.log('API /api/plugins 返回插件数: ' + (api.plugins && api.plugins.length));

  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const chrome = spawn(chromePath, ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  let cdp = null;
  try {
    let up = false; for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    if (!up) throw new Error('CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    cdp = new CDP(page.webSocketDebuggerUrl); await cdp.connect(); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: BASE + '/pages/plugins.html' });
    await waitFor(cdp, "document.querySelectorAll('.plugin-card').length > 0", 30000, 'grid 渲染');
    await sleep(400);
    const cards = await cdp.evalJs("(function(){ var cs=document.querySelectorAll('.plugin-card'); return Array.prototype.map.call(cs, function(c){ return c.querySelector('.plugin-card-title').textContent; }); })()");
    console.log('网格卡片: ' + JSON.stringify(cards));
    // 点第一张卡 → 弹窗
    await cdp.evalJs("(function(){ document.querySelector('.plugin-card').click(); })()");
    await waitFor(cdp, "document.getElementById('pluginModal').style.display === 'flex'", 10000, '弹窗打开');
    await sleep(300);
    const modal = await cdp.evalJs("(function(){ return { name: document.getElementById('pluginName').textContent, disp: document.getElementById('pluginModal').style.display, verCount: document.querySelectorAll('.plugin-version').length, tabs: document.querySelectorAll('.plugin-modal-tabs button').length }; })()");
    console.log('弹窗: ' + JSON.stringify(modal));
  } catch (e) { console.log('  💥 ' + (e && e.message)); }
  finally {
    try { cdp && cdp.w.close(); } catch (e) {}
    try { server.close(); backend.close(); } catch (e) {}
    try { require('child_process').spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
    (() => { for (let i = 0; i < 15; i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const t = Date.now(); while (Date.now() - t < 200) {} } } })();
  }
})();
