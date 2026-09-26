// tmp-probe-dblmodal.js — Round F 修复轮诊断：组内国旗/国徽卡单击弹图源弹窗
// 劫持双击 → 单独选中失效（用户「选中整体后再选单独的不让选 / 再点击一次就打开了」）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-dbm-' + Date.now());
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
      try {
        await waitFor(cdp, waitExpr, 20000, label);
      } catch (err) {
        console.log('诊断:', JSON.stringify(await cdp.evalJs('JSON.stringify({ href: location.href, title: document.title, ready: document.readyState, cards: document.querySelectorAll(".grid-card").length, ts: { cf: typeof window.createFlagCard, sc: typeof window.selectCard, mc: typeof window.mergeCards, om: typeof window.openModal, cc: typeof window.closeAllModals, mn: typeof window.MN_SITE_VERSION } })')));
        console.log('errors:', JSON.stringify(cdp.errs));
        throw err;
      }
      await sleep(600);
    };
    const dropAsset = (asset, label) => cdp.evalJs("(function(){ var dt = new DataTransfer(); dt.setData('text/plain', JSON.stringify({ asset: " + JSON.stringify(asset) + ", label: " + JSON.stringify(label) + " })); window.gridCanvas.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); return true; })()");
    const install = () => cdp.evalJs("(function(){ if (window.__batt) return true; " +
      "window.__modalOpen = function(){ return document.getElementById('modalBackdrop') && document.getElementById('modalBackdrop').classList.contains('active'); };" +
      "window.__state = function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); return { flagSel: !!(f && f.classList.contains('selected')), shieldSel: !!(s && s.classList.contains('selected')), flagSingle: !!(f && f.classList.contains('group-single')), flagGroup: !!(f && f.dataset.groupId), modal: window.__modalOpen() }; };" +
      "window.__clickAt = function(el, cx, cy, detail){ el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0 })); el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx, clientY: cy, button: 0 })); el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy, button: 0, detail: detail || 1 })); return true; };" +
      "window.__dblclickAt = function(el, cx, cy){ window.__clickAt(el, cx, cy, 1); window.__clickAt(el, cx, cy, 2); el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: cx, clientY: cy, button: 0, detail: 2 })); return true; };" +
      "window.__center = function(el){ var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };" +
      "window.__batt = true; return true; })()");

    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'load');
    await dropAsset('flag', 'National Flag');
    await dropAsset('shield', 'Emblem');
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); window.mergeCards(f, s, 'right'); return true; })()");
    await install();

    // ── A. 单击组成员 → 整组选中 + 弹窗是否被打开（用户「再点击一次就打开了」） ──
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var c = window.__center(f); window.__clickAt(f, c.x, c.y, 1); return true; })()");
    console.log('A 单击组成员后:', JSON.stringify(await cdp.evalJs('JSON.stringify(window.__state())')));

    // ── B. 弹窗开着时双击 → 单独选中能否发生（劫持证据） ──
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var c = window.__center(f); window.__dblclickAt(f, c.x, c.y); return true; })()");
    console.log('B 弹窗未关双击后:', JSON.stringify(await cdp.evalJs('JSON.stringify(window.__state())')));

    // ── C. 关掉弹窗再双击 → 单独选中（对照：弹窗是元凶） ──
    await cdp.evalJs("window.closeAllModals(); true");
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var c = window.__center(f); window.__dblclickAt(f, c.x, c.y); return true; })()");
    console.log('C 关弹窗双击后:', JSON.stringify(await cdp.evalJs('JSON.stringify(window.__state())')));

    // ── D. 单独选中后再次双击 → 现状是否弹图源 ──
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var c = window.__center(f); window.__dblclickAt(f, c.x, c.y); return true; })()");
    console.log('D 单独选中再双击后:', JSON.stringify(await cdp.evalJs('JSON.stringify(window.__state())')));

    // ── E. 单独选中后拖出 → 拆分 ──
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var c = window.__center(f); f.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: c.x, clientY: c.y, button: 0 })); for (var i = 1; i <= 6; i++) { document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: c.x + i * 40, clientY: c.y + i * 20 })); } document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: c.x + 240, clientY: c.y + 120 })); return true; })()");
    console.log('E 拖出后:', JSON.stringify(await cdp.evalJs('JSON.stringify(window.__state())')));

    console.log('errors:', JSON.stringify(cdp.errs));
    await cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
