// tmp-smoke-plugins-dev.js — 插件商店开发者模式（上传按钮 + GitHub logo + 作者行）冒烟
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
const USER_DATA = path.join(os.tmpdir(), 'mn-smoke-pdev-' + Date.now());
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
  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const chrome = spawn(chromePath, ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  let cdp = null;
  try {
    let up = false; for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    if (!up) throw new Error('CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    cdp = new CDP(page.webSocketDebuggerUrl); await cdp.connect(); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    // 开发者模式开（页面加载前落 localStorage）
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('slati_settings', JSON.stringify({developerMode:true}));}catch(e){}" });
    await cdp.send('Page.navigate', { url: BASE + '/pages/plugins.html' });
    await waitFor(cdp, "document.getElementById('pluginGrid') && document.getElementById('pluginGrid').children.length > 0", 30000, '商店网格渲染');
    await sleep(400);
    const ghCount = await cdp.evalJs("document.querySelectorAll('.plugin-gh').length");
    const authorCount = await cdp.evalJs("document.querySelectorAll('.plugin-card-author').length");
    const upBtnDisplay = await cdp.evalJs("(function(){var b=document.getElementById('pluginUploadBtn');return b?getComputedStyle(b).display:'no-btn';})()");
    const firstAuthor = await cdp.evalJs("(function(){var a=document.querySelector('.plugin-card-author');return a?a.textContent.replace(/\\s+/g,' ').trim():'none';})()");
    console.log('GitHub logo 数: ' + ghCount);
    console.log('作者行数: ' + authorCount);
    console.log('上传按钮 display: ' + upBtnDisplay);
    console.log('首张作者行: ' + firstAuthor);
  } catch (e) { console.log('  💥 ' + (e && e.message)); }
  finally {
    try { cdp && cdp.w.close(); } catch (e) {}
    try { server.close(); backend.close(); } catch (e) {}
    try { require('child_process').spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
    (() => { for (let i = 0; i < 15; i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const t = Date.now(); while (Date.now() - t < 200) {} } } })();
  }
})();
