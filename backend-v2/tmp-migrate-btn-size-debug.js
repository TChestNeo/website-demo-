// tmp-migrate-btn-size-debug.js — S1 尺寸对齐诊断（临时）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4410 + Math.floor(Math.random() * 400);
const CDP_PORT = 5410 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-sizedbg-' + Date.now());

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => {
        if (e2) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b2);
      });
      return;
    }
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
    await sleep(250);
  }
  if (!up) throw new Error('CDP 没起来');
  const pageInfo = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' })).json();
  const cdp = new CDP(pageInfo.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/fluidcanvas.html' });
  await waitFor(cdp, "document.readyState === 'complete'", 10000, 'FC 首页就绪');
  await cdp.evalJs(`(() => {
    localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true, user: { id: 'USR-TEST', displayName: 'Probe' } }));
    return true;
  })()`);
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/fluidcanvas-editor.html' });
  await waitFor(cdp, "document.querySelector('.migrate-btn') && document.getElementById('migrateModal')", 15000, '编辑器页就绪');
  await sleep(800);

  const out = await cdp.evalJs(`(() => {
    var m = document.querySelector('.migrate-btn');
    var ms = m.querySelector('span');
    var n = document.querySelector('.editor-header .btn-outline.btn-sm');
    var icon = n.querySelector('.material-symbols-outlined');
    var cs = getComputedStyle, p = function (x) { return cs(x); };
    return JSON.stringify({
      migrate: { h: p(m).height, w: p(m).width, fs: p(m).fontSize, lh: p(m).lineHeight, disp: p(m).display },
      migrateSpan: { h: p(ms).height, pad: p(ms).padding, fs: p(ms).fontSize, lh: p(ms).lineHeight, disp: p(ms).display },
      migrateSvg: { w: m.querySelector('svg').getBoundingClientRect().width, h: m.querySelector('svg').getBoundingClientRect().height },
      neighbor: { h: p(n).height, fs: p(n).fontSize, lh: p(n).lineHeight, pad: p(n).padding, disp: p(n).display },
      neighborIcon: { fs: p(icon).fontSize, lh: p(icon).lineHeight, font: p(icon).fontFamily.slice(0, 40), rectH: icon.getBoundingClientRect().height },
      neighborTextH: Array.from(n.childNodes).filter(function (c) { return c.nodeType === 3 || (c.nodeType === 1 && !c.classList.contains('material-symbols-outlined')); }).map(function (c) { return c.getBoundingClientRect ? c.getBoundingClientRect().height : 0; }),
      fsLabelSm: p(document.documentElement).getPropertyValue('--fs-label-sm'),
      radiusFull: p(document.documentElement).getPropertyValue('--radius-full'),
      fontsLoaded: document.fonts ? document.fonts.status : 'n/a'
    });
  })()`);
  console.log(JSON.stringify(JSON.parse(out), null, 2));

  cdp.close();
  chrome.kill();
  server.close();
  process.exit(0);
})();
