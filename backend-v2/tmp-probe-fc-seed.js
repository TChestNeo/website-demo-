// tmp-probe-fc-seed.js — 诊断：播种草稿后重载是否有卡
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4780 + Math.floor(Math.random() * 20);
const CDP_PORT = 5780 + Math.floor(Math.random() * 20);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-seed-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => { if (e2) { res.writeHead(404); res.end(); return; } res.writeHead(200); res.end(b2); });
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
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej, method }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
    await sleep(250);
  }
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  const cdp = new CDP(pages.find(x => x.type === 'page').webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
  });

  const seedDraft = JSON.stringify({ title: '测试文章', tags: [], cards: [{ id: 'c1', type: 'flag', label: 'National Flag', col: 5, row: 5, colSpan: 5, rowSpan: 5 }] });
  // 方式 A：先访问一次空编辑器，再写入 localStorage，再重载
  await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
  await sleep(2500);
  await cdp.evalJs("localStorage.setItem('slati_fluidcanvas_draft', " + JSON.stringify(seedDraft) + "); true");
  console.log('写入后 draft:', await cdp.evalJs("localStorage.getItem('slati_fluidcanvas_draft')"));
  await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
  await sleep(2500);
  console.log('重载后 draft:', await cdp.evalJs("localStorage.getItem('slati_fluidcanvas_draft')"));
  console.log('卡片数:', await cdp.evalJs("window.getAllCards ? window.getAllCards().length : 'no export'"));
  console.log('c1 卡:', await cdp.evalJs("(function(){ var c=document.querySelector('.grid-card[data-card-id=\"c1\"]'); return c ? { label: c.querySelector('.card-label').textContent.trim(), stored: c.dataset.label } : null; })()"));
  console.log('titleInput:', await cdp.evalJs("document.getElementById('titleInput').value"));
  console.log('body 类:', await cdp.evalJs("document.body.className"));
  try { chrome.kill(); } catch (e) {}
  server.close();
  process.exit(0);
})().catch(e => { console.error('💥', e); process.exit(1); });
