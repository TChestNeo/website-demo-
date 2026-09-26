// tmp-probe-s28-debug.js — S28 草稿往返失败真身取证：行宽跟随列块是否持久
// 步骤：2列组+行 → 选 B → e 东扩+60 → dump 几何/colSpan/style.width → saveDraft → dump 草稿行 → 重载 → dump 恢复后
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5900 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-s28dbg-' + Date.now());
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
  async mouse(type, x, y, clickCount) {
    await this.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: clickCount || 1 });
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

const dump = () => "(function(){ var A = window.__A, B = window.__B, C = window.__C; var one = function(c){ return { l: parseFloat(c.style.left) || 0, t: parseFloat(c.style.top) || 0, w: c.offsetWidth, h: c.offsetHeight, sw: c.style.width, cs: c.dataset.colSpan, rs: c.dataset.rowSpan, rowIn: c.dataset.rowInGroup || null, gid: c.dataset.groupId || null }; }; var bL = Math.min(parseFloat(A.style.left) || 0, parseFloat(B.style.left) || 0); var bR = Math.max((parseFloat(A.style.left) || 0) + A.offsetWidth, (parseFloat(B.style.left) || 0) + B.offsetWidth); return JSON.stringify({ A: one(A), B: one(B), C: one(C), bw: bR - bL }); })()";

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
    const log = (tag, obj) => console.log('  [' + tag + '] ' + JSON.stringify(obj));

    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'load');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 350); var B = window.createContentCard(); window.moveCardPx(B, 430, 350); window.mergeCards(B, A, 'right'); var C = window.createContentCard(); window.moveCardPx(C, 270, 520); window.mergeCards(C, A, 'bottom'); window.__A = A; window.__B = B; window.__C = C; window.selectCard(B, true); return true; })()");
    await sleep(300);
    log('建组后', JSON.parse(await cdp.evalJs(dump())));
    const h = JSON.parse(await cdp.evalJs("(function(){ var h = document.querySelector('.resize-handle[data-dir=\"e\"]'); var r = h.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
    await cdp.mouse('mousePressed', h.x, h.y, 1);
    for (let i = 1; i <= 4; i++) await cdp.mouse('mouseMoved', h.x + 60 * i / 4, h.y);
    await cdp.mouse('mouseReleased', h.x + 60, h.y, 1);
    await sleep(250);
    log('东扩+60 后', JSON.parse(await cdp.evalJs(dump())));
    await cdp.evalJs("window.saveDraft(); true");
    await sleep(300);
    const draftCards = await cdp.evalJs("(function(){ var k = Object.keys(localStorage).filter(function(x){ return x.indexOf('raft') !== -1 || x.indexOf('canvas') !== -1; }); var o = {}; k.forEach(function(x){ o[x] = localStorage.getItem(x).slice(0, 200); }); return JSON.stringify(o); })()");
    log('localStorage keys', JSON.parse(draftCards));
    const draftEntry = await cdp.evalJs("(function(){ var raw = null; Object.keys(localStorage).forEach(function(k){ if (k.indexOf('raft') !== -1) raw = localStorage.getItem(k); }); if (!raw) return 'null'; var d = JSON.parse(raw); var arr = d.cards || d; return JSON.stringify(arr.filter(function(c){ return c.id === window.__C.dataset.cardId || c.id === window.__B.dataset.cardId; }).map(function(c){ return { id: c.id, type: c.type, x: c.x, y: c.y, colSpan: c.colSpan, rowSpan: c.rowSpan, w: c.w, groupId: c.groupId, rowInGroup: c.rowInGroup }; })); })()");
    log('草稿 B/C 条目', JSON.parse(draftEntry));
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.grid-card')", 'reload');
    const all = await cdp.evalJs("(function(){ var cards = Array.prototype.slice.call(document.querySelectorAll('.grid-card')); return JSON.stringify(cards.map(function(c){ return { t: c.dataset.cardType, l: parseFloat(c.style.left) || 0, t: parseFloat(c.style.top) || 0, w: c.offsetWidth, sw: c.style.width, cs: c.dataset.colSpan, rowIn: c.dataset.rowInGroup || null, gid: c.dataset.groupId || null }; })); })()");
    log('重载后全部卡', JSON.parse(all));
    await sleep(300);
    console.log('  Z console errors: ' + (cdp.errs.length === 0 ? '零 ✅' : JSON.stringify(cdp.errs.slice(0, 5))));
    await cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
