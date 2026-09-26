// tmp-probe-single-resize7.js — Round P 修复验证探针：挤压让位 + 回贴 + 行宽跟随（几何取证）
// P1 2列组 A 东扩+60 → B 让位 66 重叠0   P2 A 东收-30 → B 回贴 空隙0
// P3 3列组 中列东扩+60 → 右列让位 0   P4 右列西扩-40 → 左列让位 0
// P5 行组右列东扩+60 → 行宽跟随列块（差0）   P6 同列叠堆上卡南扩+45 → 下卡让位 0
// P7 同列叠堆下卡北扩-25 → 上卡让位 0   P8 自定义窄行不被抢回
// P9 独立卡缩放不推任何卡（画布自由）   P10 Escape 提交同样让位
// P11 行组列成员南扩 → 行卡贴回 flush（Round O 回归）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-psr7-' + Date.now());
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
    const setup2col = (ax, ay) => cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, " + ax + ", " + ay + "); var B = window.createContentCard(); window.moveCardPx(B, " + (ax + 180) + ", " + ay + "); window.mergeCards(B, A, 'right'); window.__A = A; window.__B = B; return true; })()");
    const ovH = (a, b) => Math.max(0, Math.min(a.l + a.w, b.l + b.w) - Math.max(a.l, b.l)); // 只算 x 相交下的水平重叠
    const xOver = (a, b) => a.l < b.l + b.w && a.l + a.w > b.l;
    const ovV = (a, b) => (xOver(a, b) ? Math.max(0, Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t)) : 0);
    const hov = (g, i, j) => ovH(g[i], g[j]), vov = (g, i, j) => ovV(g[i], g[j]);

    // ── P1+P2：2列组 A|B，A 东扩 +60 再东收 -30 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'load');
    await setup2col(250, 200);
    await cdp.evalJs("window.selectCard(window.__A, true); true;");
    let g0 = JSON.parse(await geo('[window.__A, window.__B]'));
    await dragHandle('e', 60, 0);
    let g1 = JSON.parse(await geo('[window.__A, window.__B]'));
    log('P1 A东扩+60', { B移: g1[1].l - g0[1].l, 重叠: hov(g1, 0, 1), 缝: g1[1].l - (g1[0].l + g1[0].w) });
    await dragHandle('e', -30, 0);
    let g2 = JSON.parse(await geo('[window.__A, window.__B]'));
    log('P2 A东收-30', { B移: g2[1].l - g1[1].l, 重叠: hov(g2, 0, 1), 缝: g2[1].l - (g2[0].l + g2[0].w) });

    // ── P3：3列组 A|B|C，中列 B 东扩 +60 → C 让位、A 不动 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'P3 load');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 200, 200); var B = window.createContentCard(); window.moveCardPx(B, 380, 200); var C = window.createFlagCard(); window.moveCardPx(C, 560, 200); window.mergeCards(B, A, 'right'); window.mergeCards(C, B, 'right'); window.__A = A; window.__B = B; window.__C = C; window.selectCard(B, true); return true; })()");
    g0 = JSON.parse(await geo('[window.__A, window.__B, window.__C]'));
    await dragHandle('e', 60, 0);
    g1 = JSON.parse(await geo('[window.__A, window.__B, window.__C]'));
    log('P3 中列东扩+60', { A移: g1[0].l - g0[0].l, C移: g1[1].l - g0[1].l, 重叠: hov(g1, 1, 2), 缝BC: g1[2].l - (g1[1].l + g1[1].w) });

    // ── P4：2列组 A|B，B 西扩（w 柄 dx=-40，真西扩）→ A 让位左移 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'P4 load');
    await setup2col(250, 200);
    await cdp.evalJs("window.selectCard(window.__B, true); true;");
    g0 = JSON.parse(await geo('[window.__A, window.__B]'));
    await dragHandle('w', -40, 0);
    g1 = JSON.parse(await geo('[window.__A, window.__B]'));
    log('P4 B西扩-40', { A移: g1[0].l - g0[0].l, 重叠: hov(g1, 0, 1), 缝: g1[1].l - (g1[0].l + g1[0].w) });

    // ── P5：行组（A|B 列 + C 底行），右列 B 东扩 +60 → 行宽跟随列块 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'P5 load');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 350); var B = window.createContentCard(); window.moveCardPx(B, 430, 350); window.mergeCards(B, A, 'right'); var C = window.createContentCard(); window.moveCardPx(C, 270, 520); window.mergeCards(C, A, 'bottom'); window.__A = A; window.__B = B; window.__C = C; window.selectCard(B, true); return true; })()");
    g0 = JSON.parse(await geo('[window.__A, window.__B, window.__C]'));
    await dragHandle('e', 60, 0);
    g1 = JSON.parse(await geo('[window.__A, window.__B, window.__C]'));
    const blkL = Math.min(g1[0].l, g1[1].l), blkR = Math.max(g1[0].l + g1[0].w, g1[1].l + g1[1].w);
    log('P5 行宽跟随', { 行宽: g1[2].w, 列块宽: blkR - blkL, 差: (blkR - blkL) - g1[2].w, 行左: g1[2].l, 块左: blkL });

    // ── P6：同列叠堆（右列 B 上 S 下），B 南扩 +45 → S 让位下移 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'P6 load');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createContentCard(); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); var S = window.createFlagCard(); window.moveCardPx(S, 250, 420); window.mergeCards(S, A, 'right'); window.__A = A; window.__B = B; window.__S = S; window.selectCard(B, true); return true; })()");
    g0 = JSON.parse(await geo('[window.__A, window.__B, window.__S]'));
    await dragHandle('s', 0, 45);
    g1 = JSON.parse(await geo('[window.__A, window.__B, window.__S]'));
    log('P6 同列上卡南扩+45', { S移: g1[2].t - g0[2].t, 重叠: vov(g1, 1, 2), 缝: g1[2].t - (g1[1].t + g1[1].h) });

    // ── P7：同列叠堆，S 北扩（n 柄 dy=-25，真北扩）→ B 让位上移 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'P7 load');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createContentCard(); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); var S = window.createFlagCard(); window.moveCardPx(S, 250, 420); window.mergeCards(S, A, 'right'); window.__A = A; window.__B = B; window.__S = S; window.selectCard(S, true); return true; })()");
    g0 = JSON.parse(await geo('[window.__A, window.__B, window.__S]'));
    await dragHandle('n', 0, -25);
    g1 = JSON.parse(await geo('[window.__A, window.__B, window.__S]'));
    log('P7 同列下卡北扩-25', { B移: g1[1].t - g0[1].t, 重叠: vov(g1, 1, 2), 缝: g1[2].t - (g1[1].t + g1[1].h) });

    // ── P8：自定义窄行不被抢回（行先东收 -60，再列东扩 +60 → 行宽保持自定义） ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'P8 load');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 350); var B = window.createContentCard(); window.moveCardPx(B, 430, 350); window.mergeCards(B, A, 'right'); var C = window.createContentCard(); window.moveCardPx(C, 270, 520); window.mergeCards(C, A, 'bottom'); window.__A = A; window.__B = B; window.__C = C; window.selectCard(C, true); return true; })()");
    g0 = JSON.parse(await geo('[window.__A, window.__B, window.__C]'));
    await dragHandle('e', -60, 0); // 行自定义收窄
    let g1b = JSON.parse(await geo('[window.__A, window.__B, window.__C]'));
    await cdp.evalJs("window.selectCard(window.__B, true); true;");
    await dragHandle('e', 60, 0); // 右列东扩
    let g2b = JSON.parse(await geo('[window.__A, window.__B, window.__C]'));
    log('P8 自定义行不抢回', { 行收窄后宽: g1b[2].w, 列扩后行宽: g2b[2].w, 保持自定义: Math.abs(g2b[2].w - g1b[2].w) < 0.5 });

    // ── P9：独立卡缩放不推任何卡（画布自由） ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'P9 load');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createContentCard(); window.moveCardPx(B, 430, 200); window.__A = A; window.__B = B; window.selectCard(A, true); return true; })()");
    g0 = JSON.parse(await geo('[window.__A, window.__B]'));
    await dragHandle('e', 60, 0);
    g1 = JSON.parse(await geo('[window.__A, window.__B]'));
    log('P9 独立卡自由缩放', { B移: g1[1].l - g0[1].l, B仍原位: Math.abs(g1[1].l - g0[1].l) < 0.5 });

    // ── P10：Escape 提交同样让位 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'P10 load');
    await setup2col(250, 200);
    await cdp.evalJs("window.selectCard(window.__A, true); true;");
    g0 = JSON.parse(await geo('[window.__A, window.__B]'));
    await cdp.evalJs("(function(){ var h = document.querySelector('.resize-handle[data-dir=\"e\"]'); var r = h.getBoundingClientRect(); window.__hx = r.left + r.width / 2; window.__hy = r.top + r.height / 2; return true; })()");
    const hp = JSON.parse(await cdp.evalJs('JSON.stringify({ x: window.__hx, y: window.__hy })'));
    await cdp.mouse('mousePressed', hp.x, hp.y, 1);
    for (let i = 1; i <= 4; i++) await cdp.mouse('mouseMoved', hp.x + 60 * i / 4, hp.y);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await sleep(250);
    g1 = JSON.parse(await geo('[window.__A, window.__B]'));
    log('P10 Escape 提交', { B移: g1[1].l - g0[1].l, 重叠: hov(g1, 0, 1), 缝: g1[1].l - (g1[0].l + g1[0].w) });

    // ── P11：行组列成员南扩 → 行卡贴回 flush（Round O 回归，实读行高） ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'P11 load');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 350); var B = window.createContentCard(); window.moveCardPx(B, 430, 350); window.mergeCards(B, A, 'right'); var C = window.createContentCard(); window.moveCardPx(C, 270, 520); window.mergeCards(C, A, 'bottom'); window.__A = A; window.__B = B; window.__C = C; window.selectCard(B, true); return true; })()");
    g0 = JSON.parse(await geo('[window.__A, window.__B, window.__C]'));
    await dragHandle('s', 0, 45);
    g1 = JSON.parse(await geo('[window.__A, window.__B, window.__C]'));
    const blkB = Math.max(g1[0].t + g1[0].h, g1[1].t + g1[1].h);
    log('P11 行卡贴回', { 行顶: g1[2].t, 列块底: blkB, 缝: g1[2].t - blkB });

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
