// tmp-probe-single-resize4.js — Round O 真身探针第 4 弹：行组内列成员纵向放大 → 是否压到下方行卡（几何）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-psr4-' + Date.now());
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

    // 行组（屏幕内）：A flag 列 + B content 列 + C 底行
    let setup = JSON.parse(await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 350); var B = window.createContentCard(); window.moveCardPx(B, 430, 350); window.mergeCards(B, A, 'right'); var C = window.createContentCard(); window.moveCardPx(C, 270, 520); window.mergeCards(C, A, 'bottom'); window.__A = A; window.__B = B; window.__C = C; return JSON.stringify({ A: { t: parseFloat(A.style.top), h: A.offsetHeight }, B: { t: parseFloat(B.style.top), h: B.offsetHeight }, C: { t: parseFloat(C.style.top), h: C.offsetHeight } }); })()"));
    log('行组初始', setup);

    // 单卡选中 A → 's' 手柄下拖 +45px
    let ac = JSON.parse(await cdp.evalJs("(function(){ var r = window.__A.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
    await cdp.trustedDbl(ac.x, ac.y); await sleep(200);
    let h = JSON.parse(await cdp.evalJs("(function(){ var h = null; document.querySelectorAll('.resize-handle').forEach(function(x){ if (x.dataset.dir === 's') h = x; }); var r = h.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
    await cdp.mouse('mousePressed', h.x, h.y, 1);
    for (let i = 1; i <= 3; i++) await cdp.mouse('mouseMoved', h.x, h.y + 15 * i);
    await cdp.mouse('mouseReleased', h.x, h.y + 45, 1);
    await sleep(250);
    let after = JSON.parse(await cdp.evalJs("(function(){ var A = window.__A, C = window.__C; var aT = parseFloat(A.style.top) || 0, aB = aT + A.offsetHeight; var cT = parseFloat(C.style.top) || 0, cB = cT + C.offsetHeight; var overlap = aB - cT; return JSON.stringify({ A: { t: aT, b: aB, h: A.offsetHeight }, C: { t: cT, b: cB, h: C.offsetHeight }, overlapPx: overlap, colABottomVsRowTop: overlap > 0 ? 'A 底越过行顶 ' + overlap + 'px（覆盖行卡）' : 'A 底仍在行上方' }); })()"));
    log('A 单卡 s 拖 +45 后', after);

    // 行卡被覆盖处的 elementFromPoint（谁在最上层）
    let hit = JSON.parse(await cdp.evalJs("(function(){ var A = window.__A, C = window.__C; var px = parseFloat(A.style.left) + A.offsetWidth / 2; var py = parseFloat(C.style.top) + 10; var r = gridCanvas.getBoundingClientRect(); var el = document.elementFromPoint(r.left + px, r.top + py); return JSON.stringify({ el: el && (el.className && String(el.className).slice(0, 60) || el.tagName), isC: el === C, isA: el === A }); })()"));
    log('覆盖区 elementFromPoint', hit);

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
