// tmp-probe-realclick.js — 真实鼠标事件复刻用户点击 ttImgBtn（探针，不暂存）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4994, CDP_PORT = 5994;
const USER_DATA = path.join(os.tmpdir(), 'mn-realclick-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
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
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.exceptionDetails || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description }).slice(0, 300));
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
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run',
    '--window-size=1366,768', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {}
      await sleep(250);
    }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const cdp = new CDP(pages.find(x => x.type === 'page').webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await sleep(2500);

    console.log('FC_FLAG_LIBRARY:', await cdp.evalJs('typeof window.FC_FLAG_LIBRARY + " len=" + (window.FC_FLAG_LIBRARY ? window.FC_FLAG_LIBRARY.length : -1)'));

    // 内容卡光标态（真实用户第一步）
    await cdp.evalJs("(function(){ var cc = window.createContentCard(0, 10, 8, 4); var txc = cc.querySelector('.card-text-content'); if (!txc.firstChild) txc.textContent = 'Hello world'; var r = document.createRange(); if (txc.firstChild && txc.firstChild.nodeType === 3) { r.setStart(txc.firstChild, 1); } else { r.selectNodeContents(txc); } r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); txc.focus(); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await sleep(500);
    console.log('toolbar:', await cdp.evalJs("(function(){ var t = document.getElementById('textToolbar'); var r = t.getBoundingClientRect(); return JSON.stringify({ disp: t.style.display, left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) }); })()"));
    console.log('btn:', await cdp.evalJs("(function(){ var b = document.getElementById('ttImgBtn'); var r = b.getBoundingClientRect(); var cs = getComputedStyle(b); var el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return JSON.stringify({ left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), pe: cs.pointerEvents, disabled: b.classList.contains('tt-disabled'), hit: el ? (el.id || el.className || el.tagName) : 'none' }); })()"));

    // 真实鼠标按下/抬起点击按钮（CDP Input 域 = 浏览器级真实输入）
    const btn = JSON.parse(await cdp.evalJs("(function(){ var b = document.getElementById('ttImgBtn'); var r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }); })()"));
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btn.x, y: btn.y, button: 'left', clickCount: 1 });
    await sleep(80);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btn.x, y: btn.y, button: 'left', clickCount: 1 });
    await sleep(500);
    console.log('after real click → pop:', await cdp.evalJs("(function(){ var p = document.getElementById('ttImgPop'); return JSON.stringify({ active: p.classList.contains('active'), tiles: document.querySelectorAll('#ttImgGrid .tim-tile').length, vis: p.style.visibility, left: p.style.left, top: p.style.top }); })()"));
    console.log('errors:', JSON.stringify(cdp.errs.slice(0, 3)));
    await cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('PROBE FAIL:', e.message); process.exit(1); });
