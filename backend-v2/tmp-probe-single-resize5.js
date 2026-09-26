// tmp-probe-single-resize5.js — 慢双击容错修复验证（可信输入）
// 1) 慢双击（两击 600ms，detail 各 1）→ 单独选中  2) 慢双击后 e 手柄拖 → 尺寸粘住
// 3) 孤立单击 → 仍整组（不误配对）  4) 快双击 → 单独选中 + 组内无图国旗不弹图源（无回归）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-psr5-' + Date.now());
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
    const st = () => cdp.evalJs("(function(){ return JSON.stringify({ gs: document.querySelectorAll('.grid-card.group-single').length, sel: document.querySelectorAll('.grid-card.selected').length, modal: !!(document.getElementById('modalBackdrop') && document.getElementById('modalBackdrop').classList.contains('active')) }); })()");

    // 建组（flag + content 屏幕内）
    let c = JSON.parse(await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createContentCard(); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); var s = document.querySelector('.grid-card[data-card-type=\"content\"]'); var r = s.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));

    // V1：慢双击（600ms 两击）→ 单独选中
    await cdp.trustedClick(c.x, c.y, 1); await sleep(600); await cdp.trustedClick(c.x, c.y, 1);
    await sleep(350);
    log('V1 慢双击 600ms', JSON.parse(await st()));
    console.log('  V1 结论: ' + ((JSON.parse(await st())).gs === 1 ? '✅ 慢双击也能单独选中' : '❌ 仍失败'));

    // V2：慢双击后 e 手柄拖 +60 → 尺寸粘住
    let h = JSON.parse(await cdp.evalJs("(function(){ var h = null; document.querySelectorAll('.resize-handle').forEach(function(x){ if (x.dataset.dir === 'e') h = x; }); var r = h.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
    let before = JSON.parse(await cdp.evalJs("(function(){ var s = document.querySelector('.grid-card[data-card-type=\"content\"]'); return JSON.stringify({ w: s.offsetWidth }); })()"));
    await cdp.mouse('mousePressed', h.x, h.y, 1);
    for (let i = 1; i <= 3; i++) await cdp.mouse('mouseMoved', h.x + 20 * i, h.y);
    await cdp.mouse('mouseReleased', h.x + 60, h.y, 1);
    await sleep(250);
    let after = JSON.parse(await cdp.evalJs("(function(){ var s = document.querySelector('.grid-card[data-card-type=\"content\"]'); return JSON.stringify({ w: s.offsetWidth, g: !!s.dataset.groupId }); })()"));
    log('V2 慢双击后 e 拖', { before: before, after: after });

    // V3：孤立单击 → 整组（不误配对）。清空后单击一次，等 900ms（>800 窗口），再单击一次 → 仍整组
    await cdp.evalJs("gridCanvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); true");
    await cdp.trustedClick(c.x, c.y, 1); await sleep(900); await cdp.trustedClick(c.x, c.y, 1);
    await sleep(350);
    let v3 = JSON.parse(await st());
    log('V3 两击隔 900ms（窗口外）', v3);
    console.log('  V3 结论: ' + (v3.gs === 0 && v3.sel === 2 ? '✅ 窗口外不误配对，仍整组' : '❌ 误配对'));

    // V4：快双击 → 单独选中 + 组内国旗（无图）不弹图源（dblmodal 回归）
    await cdp.evalJs("gridCanvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); true");
    let fc = JSON.parse(await cdp.evalJs("(function(){ var s = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var r = s.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
    await cdp.trustedDbl(fc.x, fc.y);
    await sleep(350);
    let v4 = JSON.parse(await st());
    log('V4 快双击国旗成员', v4);
    console.log('  V4 结论: ' + (v4.gs === 1 && v4.sel === 1 && !v4.modal ? '✅ 快双击单独选中+不弹图源' : '❌ 回归'));

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
