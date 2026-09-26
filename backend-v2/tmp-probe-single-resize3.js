// tmp-probe-single-resize3.js — Round O 真身探针第 3 弹：行成员双击零选中的现场取证
// elementFromPoint / 事件计数 / 异常捕获 / 合成 dblclick 对照
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-psr3-' + Date.now());
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
  async trustedClick(x, y, cc) { await this.mouse('mousePressed', x, y, cc); await this.mouse('mouseReleased', x, y, cc); }
  async trustedDbl(x, y) { await this.trustedClick(x, y, 1); await sleep(80); await this.trustedClick(x, y, 2); }
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
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function' && typeof window.createContentCard === 'function'", 'load');
    const log = (tag, obj) => console.log('  [' + tag + '] ' + JSON.stringify(obj));

    // 建 T5 同款行组（屏幕内）
    let t5 = JSON.parse(await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 350); var B = window.createContentCard(); window.moveCardPx(B, 430, 350); window.mergeCards(B, A, 'right'); var C = window.createContentCard(); window.moveCardPx(C, 270, 520); window.mergeCards(C, A, 'bottom'); var g = null; document.querySelectorAll('.grid-card').forEach(function(x){ if (x.dataset.rowInGroup === '1') g = x; }); var r = g.getBoundingClientRect(); return JSON.stringify({ rowRect: { x: r.left, y: r.top, w: r.width, h: r.height }, rowG: g.dataset.groupId, rowIn: g.dataset.rowInGroup }); })()"));
    log('T5 行组', t5);
    const cx = t5.rowRect.x + t5.rowRect.w / 2, cy = t5.rowRect.y + t5.rowRect.h / 2;
    console.log('  行卡中心: ' + cx + ',' + cy);

    // 命中测试：真实鼠标会点到谁
    let hit = JSON.parse(await cdp.evalJs("(function(){ var el = document.elementFromPoint(" + cx + ", " + cy + "); return JSON.stringify({ tag: el.tagName, cls: el.className && String(el.className).slice(0, 80), cardType: el.dataset && el.dataset.cardType, rowIn: el.dataset && el.dataset.rowInGroup }); })()"));
    log('elementFromPoint@行卡中心', hit);

    // 事件计数 + 合成 dblclick 对照（直接调 selectCard(card,true)）
    let counters = JSON.parse(await cdp.evalJs("(function(){ var g = null; document.querySelectorAll('.grid-card').forEach(function(x){ if (x.dataset.rowInGroup === '1') g = x; }); window.__ev = { md: 0, mu: 0, cl: 0, dbl: 0 }; g.addEventListener('mousedown', function(){ window.__ev.md++; }); g.addEventListener('mouseup', function(){ window.__ev.mu++; }); g.addEventListener('click', function(){ window.__ev.cl++; }); g.addEventListener('dblclick', function(){ window.__ev.dbl++; }); window.__rowCard = g; window.selectCard(g, true); var sel = document.querySelectorAll('.grid-card.selected').length; var gs = document.querySelectorAll('.grid-card.group-single').length; var hv = []; document.querySelectorAll('.resize-handle').forEach(function(h){ if (h.style.display !== 'none') hv.push(h.dataset.dir); }); return JSON.stringify({ afterSelectCardSingle: { sel: sel, gs: gs, handles: hv } }); })()"));
    log('合成 selectCard(row,true) 对照', counters);

    // 清空再真实可信双击
    await cdp.evalJs("gridCanvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); window.__ev = { md: 0, mu: 0, cl: 0, dbl: 0 }; true");
    await cdp.trustedDbl(cx, cy);
    await sleep(250);
    let ev = JSON.parse(await cdp.evalJs("(function(){ var g = window.__rowCard; return JSON.stringify({ ev: window.__ev, sel: document.querySelectorAll('.grid-card.selected').length, gs: document.querySelectorAll('.grid-card.group-single').length, gGroup: !!g.dataset.groupId, rowIn: g.dataset.rowInGroup || null }); })()"));
    log('可信双击后', ev);

    // 合成 dblclick 事件（非可信，直接 dispatch）对照
    await cdp.evalJs("gridCanvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); window.__ev = { md: 0, mu: 0, cl: 0, dbl: 0 }; true");
    let ev2 = JSON.parse(await cdp.evalJs("(function(){ var g = window.__rowCard; g.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: " + cx + ", clientY: " + cy + ", button: 0, detail: 2 })); return JSON.stringify({ ev: window.__ev, sel: document.querySelectorAll('.grid-card.selected').length, gs: document.querySelectorAll('.grid-card.group-single').length }); })()"));
    log('合成 dblclick 事件对照', ev2);

    await sleep(300);
    console.log('  Z console errors: ' + (cdp.errs.length === 0 ? '零 ✅' : JSON.stringify(cdp.errs.slice(0, 5))));

    await cdp.close();
    process.exitCode = 0;
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
