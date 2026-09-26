// tmp-probe-single-resize8.js — Round P 补证：旗卡叠堆南扩级联 + 内容卡框真生长推送
// Q1 右列旗卡 B 上 + 旗卡 S 下：B 南扩+45 → S 让位 44 flush
// Q2 右列 3 叠（B/S/T 旗卡）：B 南扩+45 → S、T 同时下移 44 全 flush
// Q3 内容卡框真生长：B 文本高 100 < minHeight 130，南扩+45 → 框 174，S 让位 44 flush
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5900 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-psr8-' + Date.now());
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
    const geo = (expr) => cdp.evalJs("(function(){ var els = " + expr + "; return JSON.stringify(els.map(function(c){ return { l: parseFloat(c.style.left) || 0, t: parseFloat(c.style.top) || 0, w: c.offsetWidth, h: c.offsetHeight, rowIn: c.dataset.rowInGroup || null }; })); })()");
    const dragHandle = async (dir, dx, dy) => {
      const h = JSON.parse(await cdp.evalJs("(function(){ var h = document.querySelector('.resize-handle[data-dir=\"" + dir + "\"]'); if (!h || h.style.display === 'none') return 'null'; var r = h.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
      if (h === 'null') throw new Error('no handle ' + dir);
      await cdp.mouse('mousePressed', h.x, h.y, 1);
      for (let i = 1; i <= 4; i++) await cdp.mouse('mouseMoved', h.x + dx * i / 4, h.y + dy * i / 4);
      await cdp.mouse('mouseReleased', h.x + dx, h.y + dy, 1);
      await sleep(250);
    };
    const ovV = (a, b) => ((a.l < b.l + b.w && a.l + a.w > b.l) ? Math.max(0, Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t)) : 0);

    // ── Q1：右列旗卡 B 上 + 旗卡 S 下，B 南扩 +45 → S 让位 44 flush ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'Q1 load');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createFlagCard(); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); var S = window.createFlagCard(); window.moveCardPx(S, 250, 420); window.mergeCards(S, A, 'right'); window.__A = A; window.__B = B; window.__S = S; window.selectCard(B, true); return true; })()");
    let g0 = JSON.parse(await geo('[window.__A, window.__B, window.__S]'));
    await dragHandle('s', 0, 45);
    let g1 = JSON.parse(await geo('[window.__A, window.__B, window.__S]'));
    log('Q1 旗卡叠堆南扩+45', { B高: g1[1].h, S移: g1[2].t - g0[2].t, 重叠: ovV(g1[1], g1[2]), 缝: g1[2].t - (g1[1].t + g1[1].h) });

    // ── Q2：右列 3 叠（B/S/T 旗卡），B 南扩 +45 → S、T 同时下移 44 全 flush ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'Q2 load');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 140); var B = window.createFlagCard(); window.moveCardPx(B, 430, 140); window.mergeCards(B, A, 'right'); var S = window.createFlagCard(); window.moveCardPx(S, 250, 420); window.mergeCards(S, A, 'right'); var T = window.createFlagCard(); window.moveCardPx(T, 250, 600); window.mergeCards(T, A, 'right'); window.__A = A; window.__B = B; window.__S = S; window.__T = T; window.selectCard(B, true); return true; })()");
    g0 = JSON.parse(await geo('[window.__A, window.__B, window.__S, window.__T]'));
    await dragHandle('s', 0, 45);
    g1 = JSON.parse(await geo('[window.__A, window.__B, window.__S, window.__T]'));
    log('Q2 三叠级联南扩+45', { S移: g1[2].t - g0[2].t, T移: g1[3].t - g0[3].t, 缝BS: g1[2].t - (g1[1].t + g1[1].h), 缝ST: g1[3].t - (g1[2].t + g1[2].h) });

    // ── Q3：内容卡框真生长（文本 100 < minHeight 130），南扩+45 → 框 174、S 让位 44 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'Q3 load');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createContentCard(); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); var S = window.createFlagCard(); window.moveCardPx(S, 250, 420); window.mergeCards(S, A, 'right'); var te = B.querySelector('.card-text') || B; te.textContent = '短'; B.style.minHeight = '130px'; window.__A = A; window.__B = B; window.__S = S; window.selectCard(B, true); return true; })()");
    g0 = JSON.parse(await geo('[window.__A, window.__B, window.__S]'));
    await dragHandle('s', 0, 45);
    g1 = JSON.parse(await geo('[window.__A, window.__B, window.__S]'));
    log('Q3 内容卡框真生长南扩+45', { B高: g1[1].h, S移: g1[2].t - g0[2].t, 重叠: ovV(g1[1], g1[2]), 缝: g1[2].t - (g1[1].t + g1[1].h) });

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
