// tmp-probe-single-resize6.js — Round P 真身探针：组内单卡调大小，旁列伙伴是否让位（几何取证）
// P1 2列组 A 东扩 +60 → B 动没动/重叠多少  P2 A 东收 -30 → B 拉回没
// P3 3列组 中列东扩 +60 → 右列动没动  P4 右列西扩 +40 → 左列动没动
// P5 行组 右列东扩 +60 → 行卡宽 vs 列块宽  P6 同列堆叠 上卡南扩 +45 → 下卡重叠
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-psr6-' + Date.now());
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
    // 可信 e 手柄拖（单独选中已由 selectCard(card,true) 合成建立——选中机制 S14-S19 已验）
    const dragHandle = async (dir, dx, dy) => {
      const h = JSON.parse(await cdp.evalJs("(function(){ var h = document.querySelector('.resize-handle[data-dir=\"" + dir + "\"]'); if (!h || h.style.display === 'none') return 'null'; var r = h.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
      if (h === 'null') throw new Error('no handle ' + dir);
      await cdp.mouse('mousePressed', h.x, h.y, 1);
      for (let i = 1; i <= 4; i++) await cdp.mouse('mouseMoved', h.x + dx * i / 4, h.y + dy * i / 4);
      await cdp.mouse('mouseReleased', h.x + dx, h.y + dy, 1);
      await sleep(250);
    };

    // ── P1+P2：2列组 A|B，A 东扩 +60 再东收 -30 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'load');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createContentCard(); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); window.__A = A; window.__B = B; window.selectCard(A, true); return true; })()");
    let g0 = JSON.parse(await geo('[window.__A, window.__B]'));
    await dragHandle('e', 60, 0);
    let g1 = JSON.parse(await geo('[window.__A, window.__B]'));
    const ov = (a, b) => Math.min(a.l + a.w, b.l + b.w) - Math.max(a.l, b.l);
    log('P1 A 东扩 +60', { A: g1[0], B: g1[1], B移动px: g1[1].l - g0[1].l, 重叠px: Math.max(0, ov(g1[0], g1[1])) });
    await dragHandle('e', -30, 0);
    let g2 = JSON.parse(await geo('[window.__A, window.__B]'));
    log('P2 A 东收 -30', { A: g2[0], B: g2[1], B移动px: g2[1].l - g1[1].l, 空隙px: g2[1].l - (g2[0].l + g2[0].w) });

    // ── P3：3列组 A|B|C，中列 B 东扩 +60 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'P3 load');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 200, 200); var B = window.createContentCard(); window.moveCardPx(B, 380, 200); var C = window.createFlagCard(); window.moveCardPx(C, 560, 200); window.mergeCards(B, A, 'right'); window.mergeCards(C, B, 'right'); window.__A = A; window.__B = B; window.__C = C; window.selectCard(B, true); return true; })()");
    g0 = JSON.parse(await geo('[window.__A, window.__B, window.__C]'));
    await dragHandle('e', 60, 0);
    g1 = JSON.parse(await geo('[window.__A, window.__B, window.__C]'));
    log('P3 中列 B 东扩 +60', { A移动: g1[0].l - g0[0].l, B移动: g1[1].l - g0[1].l, C移动: g1[2].l - g0[2].l, BC重叠px: Math.max(0, ov(g1[1], g1[2])) });

    // ── P4：2列组 A|B，B 西扩 +40（往 A 挤） ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'P4 load');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createContentCard(); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); window.__A = A; window.__B = B; window.selectCard(B, true); return true; })()");
    g0 = JSON.parse(await geo('[window.__A, window.__B]'));
    await dragHandle('w', 40, 0);
    g1 = JSON.parse(await geo('[window.__A, window.__B]'));
    log('P4 B 西扩 +40', { A移动: g1[0].l - g0[0].l, A右缘: g1[0].l + g1[0].w, B左缘: g1[1].l, 重叠px: Math.max(0, (g1[0].l + g1[0].w) - g1[1].l) });

    // ── P5：行组（A|B 列 + C 底行），右列 B 东扩 +60 → 行宽 vs 列块宽 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'P5 load');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 350); var B = window.createContentCard(); window.moveCardPx(B, 430, 350); window.mergeCards(B, A, 'right'); var C = window.createContentCard(); window.moveCardPx(C, 270, 520); window.mergeCards(C, A, 'bottom'); window.__A = A; window.__B = B; window.__C = C; window.selectCard(B, true); return true; })()");
    g0 = JSON.parse(await geo('[window.__A, window.__B, window.__C]'));
    await dragHandle('e', 60, 0);
    g1 = JSON.parse(await geo('[window.__A, window.__B, window.__C]'));
    const blkL = Math.min(g1[0].l, g1[1].l), blkR = Math.max(g1[0].l + g1[0].w, g1[1].l + g1[1].w);
    log('P5 行组右列东扩 +60', { 行C: g1[2], 列块: { l: blkL, r: blkR }, 行宽vs块宽差: (blkR - blkL) - g1[2].w, 行左vs块左差: g1[2].l - blkL });

    // ── P6：同列堆叠（老草稿形态），上卡南扩 +45 → 下卡 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'P6 load');
    let p6 = JSON.parse(await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createContentCard(); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); var S = window.createFlagCard(); window.moveCardPx(S, 250, 420); window.mergeCards(S, A, 'right'); window.__A = A; window.__S = S; window.selectCard(A, true); return JSON.stringify({ 堆叠建组OK: S.dataset.groupId === A.dataset.groupId, S行标: S.dataset.rowInGroup || null }); })()"));
    log('P6 建组', p6);
    g0 = JSON.parse(await geo('[window.__A, window.__S]'));
    await dragHandle('s', 0, 45);
    g1 = JSON.parse(await geo('[window.__A, window.__S]'));
    const ovV = (a, b) => Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t);
    log('P6 上卡南扩 +45', { A: g1[0], S: g1[1], S移动px: g1[1].t - g0[1].t, 重叠px: Math.max(0, ovV(g1[0], g1[1])) });

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
