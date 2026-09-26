// tmp-probe-grpz.js — Round F 诊断：S8 提交后状态 + S11 草稿往返差异（一次性探针）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-prb-' + Date.now());
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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.exceptionDetails || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 300));
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
  const BASE = 'http://127.0.0.1:' + PORT;
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
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const dropAsset = (asset, label) => cdp.evalJs("(function(){ var dt = new DataTransfer(); dt.setData('text/plain', JSON.stringify({ asset: " + JSON.stringify(asset) + ", label: " + JSON.stringify(label) + " })); window.gridCanvas.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); return true; })()");
    const install = () => cdp.evalJs("(function(){ if (window.__batt) return true; " +
      "window.__members = function(){ return Array.prototype.slice.call(document.querySelectorAll('.grid-card[data-group-id]')).map(function(c){ return { t: c.dataset.cardType, x: parseFloat(c.style.left) || 0, y: parseFloat(c.style.top) || 0, w: c.offsetWidth, h: c.offsetHeight, cs: c.dataset.colSpan, rs: c.dataset.rowSpan, sw: c.style.width, sh: c.style.height }; }); };" +
      "window.__groupBox = function(){ var ms = window.__members(), minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9; ms.forEach(function(m){ if (m.x < minX) minX = m.x; if (m.y < minY) minY = m.y; if (m.x + m.w > maxX) maxX = m.x + m.w; if (m.y + m.h > maxY) maxY = m.y + m.h; }); return { left: minX, top: minY, right: maxX, bottom: maxY, w: maxX - minX, h: maxY - minY }; };" +
      "window.__dragHandle = function(dir, dx, dy){ var h = document.querySelector('.resize-handle[data-dir=\"' + dir + '\"]'); if (!h) return 'no handle'; var r = h.getBoundingClientRect(); var cx = r.left + r.width / 2, cy = r.top + r.height / 2; h.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0 })); for (var i = 1; i <= 5; i++) { document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + dx * i / 5, clientY: cy + dy * i / 5 })); } document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx + dx, clientY: cy + dy })); return true; };" +
      "window.__batt = true; return true; })()");

    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'load');
    await dropAsset('flag', 'National Flag');
    await dropAsset('shield', 'Emblem');
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); window.mergeCards(f, s, 'right'); return true; })()");
    await install();
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); window.selectCard(f); return true; })()");
    console.log('── 合并后 ──');
    console.log('members:', JSON.stringify(await cdp.evalJs('JSON.stringify(window.__members())')));
    console.log('box:', JSON.stringify(await cdp.evalJs('JSON.stringify(window.__groupBox())')));
    await cdp.evalJs("window.__dragHandle('e', 60, 0); true");
    console.log('── e+60 后 ──');
    console.log('members:', JSON.stringify(await cdp.evalJs('JSON.stringify(window.__members())')));
    console.log('box:', JSON.stringify(await cdp.evalJs('JSON.stringify(window.__groupBox())')));
    console.log('bg:', JSON.stringify(await cdp.evalJs("(function(){ var b = document.querySelector('.grid-group-bg'); return b ? { left: b.style.left, top: b.style.top, w: b.style.width, h: b.style.height } : null; })()")));
    await cdp.evalJs("window.__dragHandle('se', 40, 30); true");
    console.log('── se+40,+30 后 ──');
    console.log('members:', JSON.stringify(await cdp.evalJs('JSON.stringify(window.__members())')));
    console.log('bg:', JSON.stringify(await cdp.evalJs("(function(){ var b = document.querySelector('.grid-group-bg'); return b ? { left: b.style.left, top: b.style.top, w: b.style.width, h: b.style.height } : null; })()")));
    const draft = await cdp.evalJs("window.saveDraft(); (function(){ var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft')); return JSON.stringify(d.cards.map(function(c){ return { t: c.type, x: c.x, y: c.y, cs: c.colSpan, rs: c.rowSpan, g: c.groupId }; })); })()");
    console.log('── 草稿 cards ──');
    console.log(draft);
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.grid-card[data-card-type=\"shield\"]')", 'reload');
    await install();
    console.log('── 重载后 ──');
    console.log('members:', JSON.stringify(await cdp.evalJs('JSON.stringify(window.__members())')));
    console.log('bg:', JSON.stringify(await cdp.evalJs("(function(){ var b = document.querySelector('.grid-group-bg'); return b ? { left: b.style.left, top: b.style.top, w: b.style.width, h: b.style.height } : null; })()")));
    console.log('errors:', JSON.stringify(cdp.errs));
    await cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
