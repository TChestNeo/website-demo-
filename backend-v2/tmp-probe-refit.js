// tmp-probe-refit.js — 探针：Emulation 480 后 --grid-cols 时间序列（排查 E2 未更新）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4900 + Math.floor(Math.random() * 20);
const CDP_PORT = 5900 + Math.floor(Math.random() * 20);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-refit-' + Date.now());
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') { fs.readFile(file + '.html', (e2, b2) => { if (e2) { res.writeHead(404); res.end(); return; } res.writeHead(200); res.end(b2); }); return; }
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200); res.end(buf);
  });
});
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && this.pending.has(m.id)) { const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SNAP = "(function(){ var gc = document.getElementById('gridCanvas'); return 'innerW=' + window.innerWidth + ' bodyW=' + gc.parentElement.clientWidth + ' cols=' + getComputedStyle(gc).getPropertyValue('--grid-cols').trim() + ' cs=' + getComputedStyle(gc).getPropertyValue('--cell-size').trim(); })()";
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  let chromePath = null;
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe']) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80 && !up; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) up = true; } catch (e) {} await sleep(250); }
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  const cdp = new CDP(pages.find(x => x.type === 'page').webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}' });
  await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
  for (let i = 0; i < 100; i++) { try { if (await cdp.evalJs("!!document.getElementById('undoBtn')")) break; } catch (e) {} await sleep(150); }
  await sleep(1000);
  console.log('初始: ' + await cdp.evalJs(SNAP));
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 480, height: 900, deviceScaleFactor: 1, mobile: false });
  for (let i = 1; i <= 8; i++) { await sleep(400); console.log('480 +' + (i * 400) + 'ms: ' + await cdp.evalJs(SNAP)); }
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  for (let i = 1; i <= 4; i++) { await sleep(400); console.log('1280 +' + (i * 400) + 'ms: ' + await cdp.evalJs(SNAP)); }
  try { chrome.kill(); } catch (e) {}
  server.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
