// tmp-probe-single-resize2.js — Round O 真身探针第 2 弹：CDP 可信输入（Input.dispatchMouseEvent，isTrusted=true）
// 覆盖：可信双击→单独选中 / 可信手柄拖→尺寸 / 慢双击（600ms 间隔）→ 是否仍能单独选中 /
// 内容卡文本工具栏是否盖住手柄 / Round N 行组几何（2列+底行）单卡缩放 / 真实拖拽合并后立即双击
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-psr2-' + Date.now());
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
    const install = () => cdp.evalJs("(function(){ if (window.__psr2) return true; " +
      "window.__center = function(el){ var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };" +
      "window.__geo = function(el){ return { l: parseFloat(el.style.left) || 0, t: parseFloat(el.style.top) || 0, w: el.offsetWidth, h: el.offsetHeight, cs: el.dataset.colSpan, rs: el.dataset.rowSpan, g: el.dataset.groupId || null, single: el.classList.contains('group-single'), sel: el.classList.contains('selected'), rowIn: el.dataset.rowInGroup || null }; };" +
      "window.__state = function(sel){ var gs = document.querySelectorAll('.grid-card.group-single').length; var selN = document.querySelectorAll('.grid-card.selected').length; return { gs: gs, sel: selN }; };" +
      "window.__handleRect = function(dir){ var h = null; document.querySelectorAll('.resize-handle').forEach(function(x){ if (x.dataset.dir === dir) h = x; }); if (!h || h.style.display === 'none') return null; var r = h.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, vis: h.style.display }; };" +
      "window.__ttRect = function(){ var t = document.querySelector('.tt-toolbar, .text-toolbar, #ttBar'); if (!t) return null; var r = t.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, disp: getComputedStyle(t).display }; };" +
      "window.__psr2 = true; return true; })()");

    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function' && typeof window.createContentCard === 'function'", 'load');
    await install();
    const log = (tag, obj) => console.log('  [' + tag + '] ' + JSON.stringify(obj));

    // ═══ T1：可信双击（flag 组成员）→ 单独选中 ═══
    let c = JSON.parse(await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 300, 200); var B = window.createFlagCard(); window.moveCardPx(B, 600, 200); window.mergeCards(B, A, 'right'); var s = document.querySelectorAll('.grid-card[data-card-type=\"flag\"]')[1]; var c = window.__center(s); return JSON.stringify(c); })()"));
    await cdp.trustedDbl(c.x, c.y);
    await sleep(200);
    let st = JSON.parse(await cdp.evalJs("JSON.stringify(window.__state())"));
    log('T1 可信双击→单独选中', st);
    console.log('  T1 结论: ' + (st.gs === 1 && st.sel === 1 ? '单独选中成功' : '❌ 未单独选中'));

    // ═══ T2：可信 e 手柄拖（mousedown 在手柄上）→ 尺寸 ═══
    let h = JSON.parse(await cdp.evalJs("JSON.stringify(window.__handleRect('e'))"));
    let before = JSON.parse(await cdp.evalJs("(function(){ var s = document.querySelectorAll('.grid-card[data-card-type=\"flag\"]')[1]; return JSON.stringify(window.__geo(s)); })()"));
    await cdp.mouse('mousePressed', h.x, h.y, 1);
    for (let i = 1; i <= 3; i++) await cdp.mouse('mouseMoved', h.x + 20 * i, h.y);
    await cdp.mouse('mouseReleased', h.x + 60, h.y, 1);
    await sleep(200);
    let after = JSON.parse(await cdp.evalJs("(function(){ var s = document.querySelectorAll('.grid-card[data-card-type=\"flag\"]')[1]; return JSON.stringify(window.__geo(s)); })()"));
    log('T2 可信 e 拖', { before: before, after: after });

    // ═══ T3：慢双击（600ms 间隔，双击阈值外）→ 还能单独选中吗 ═══
    await cdp.evalJs("gridCanvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); true");
    await cdp.trustedClick(c.x, c.y, 1); await sleep(600); await cdp.trustedClick(c.x, c.y, 1);
    await sleep(200);
    st = JSON.parse(await cdp.evalJs("JSON.stringify(window.__state())"));
    log('T3 慢双击 600ms 间隔', st);
    console.log('  T3 结论: ' + (st.gs === 1 ? '仍能单独选中' : '❌ 慢双击无法单独选中（仅整组）——双击路径对双击速度敏感'));

    // ═══ T4：内容卡组——可信双击 + 文本工具栏是否盖住手柄 ═══
    let cc = JSON.parse(await cdp.evalJs("(function(){ var A = window.createContentCard(); window.moveCardPx(A, 300, 500); var B = window.createContentCard(); window.moveCardPx(B, 600, 500); window.mergeCards(B, A, 'right'); var s = document.querySelectorAll('.grid-card[data-card-type=\"content\"]')[1]; var c = window.__center(s); return JSON.stringify(c); })()"));
    await cdp.trustedDbl(cc.x, cc.y);
    await sleep(300);
    let t4 = JSON.parse(await cdp.evalJs("(function(){ var tt = window.__ttRect(); var eh = window.__handleRect('e'); var overlap = false; if (tt && eh && tt.disp !== 'none') { overlap = eh.x > tt.x - 8 && eh.x < tt.x + tt.w + 8 && eh.y > tt.y - 8 && eh.y < tt.y + tt.h + 8; } return JSON.stringify({ state: window.__state(), tt: tt, eHandle: eh, ttCoversE: overlap }); })()"));
    log('T4 内容卡可信双击+工具栏', t4);
    if (t4.state.gs === 1) {
      h = t4.eHandle;
      before = JSON.parse(await cdp.evalJs("(function(){ var s = document.querySelectorAll('.grid-card[data-card-type=\"content\"]')[1]; return JSON.stringify(window.__geo(s)); })()"));
      await cdp.mouse('mousePressed', h.x, h.y, 1);
      for (let i = 1; i <= 3; i++) await cdp.mouse('mouseMoved', h.x + 20 * i, h.y);
      await cdp.mouse('mouseReleased', h.x + 60, h.y, 1);
      await sleep(200);
      after = JSON.parse(await cdp.evalJs("(function(){ var s = document.querySelectorAll('.grid-card[data-card-type=\"content\"]')[1]; return JSON.stringify(window.__geo(s)); })()"));
      log('T4b 内容卡可信 e 拖', { before: before, after: after });
    }

    // ═══ T5：Round N 行组几何（2列 + 底行）——列成员 / 行成员 单卡缩放 ═══
    // 全部放屏幕内（viewport 900 高）：组放 x 950-1250 / y 100-450 空区
    let t5 = JSON.parse(await cdp.evalJs("(function(){ gridCanvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); var A = window.createFlagCard(); window.moveCardPx(A, 950, 100); var B = window.createContentCard(); window.moveCardPx(B, 1130, 100); window.mergeCards(B, A, 'right'); var C = window.createContentCard(); window.moveCardPx(C, 970, 260); window.mergeCards(C, A, 'bottom'); return JSON.stringify({ row: window.__geo(C), colA: window.__geo(A), colB: window.__geo(B) }); })()"));
    log('T5 行组建立', t5);
    // T5a 行成员（本组底行）双击 → 's' 手柄下拖 → 高度
    let hc = JSON.parse(await cdp.evalJs("(function(){ var g = null; document.querySelectorAll('.grid-card').forEach(function(x){ if (x.dataset.rowInGroup === '1') g = x; }); var c = window.__center(g); return JSON.stringify(c); })()"));
    await cdp.trustedDbl(hc.x, hc.y); await sleep(200);
    st = JSON.parse(await cdp.evalJs("(function(){ var g = null; document.querySelectorAll('.grid-card').forEach(function(x){ if (x.dataset.rowInGroup === '1') g = x; }); return JSON.stringify({ state: window.__state(), rowSingle: g.classList.contains('group-single') }); })()"));
    log('T5a 行成员双击', st);
    if (st.rowSingle) {
      h = JSON.parse(await cdp.evalJs("JSON.stringify(window.__handleRect('s'))"));
      if (h) {
        before = JSON.parse(await cdp.evalJs("(function(){ var g = null; document.querySelectorAll('.grid-card').forEach(function(x){ if (x.dataset.rowInGroup === '1') g = x; }); return JSON.stringify(window.__geo(g)); })()"));
        await cdp.mouse('mousePressed', h.x, h.y, 1);
        for (let i = 1; i <= 3; i++) await cdp.mouse('mouseMoved', h.x, h.y + 15 * i);
        await cdp.mouse('mouseReleased', h.x, h.y + 45, 1);
        await sleep(200);
        after = JSON.parse(await cdp.evalJs("(function(){ var g = null; document.querySelectorAll('.grid-card').forEach(function(x){ if (x.dataset.rowInGroup === '1') g = x; }); return JSON.stringify(window.__geo(g)); })()"));
        log('T5a 行成员 s 拖', { before: before, after: after });
      }
    }
    // T5b 本行列组成员（flag）双击 → 'e' 拖 → 列成员变宽 + 行不受影响
    let fc = JSON.parse(await cdp.evalJs("(function(){ var A = null; document.querySelectorAll('.grid-card').forEach(function(x){ if (x.dataset.cardType === 'flag' && x.dataset.groupId && !x.dataset.rowInGroup) A = x; }); var c = window.__center(A); return JSON.stringify(c); })()"));
    await cdp.trustedDbl(fc.x, fc.y); await sleep(200);
    h = JSON.parse(await cdp.evalJs("JSON.stringify(window.__handleRect('e'))"));
    before = JSON.parse(await cdp.evalJs("(function(){ var A = null; document.querySelectorAll('.grid-card').forEach(function(x){ if (x.dataset.cardType === 'flag' && x.dataset.groupId && !x.dataset.rowInGroup) A = x; }); var g = null; document.querySelectorAll('.grid-card').forEach(function(x){ if (x.dataset.rowInGroup === '1') g = x; }); return JSON.stringify({ col: window.__geo(A), row: window.__geo(g), state: window.__state() }); })()"));
    await cdp.mouse('mousePressed', h.x, h.y, 1);
    for (let i = 1; i <= 3; i++) await cdp.mouse('mouseMoved', h.x + 20 * i, h.y);
    await cdp.mouse('mouseReleased', h.x + 60, h.y, 1);
    await sleep(200);
    after = JSON.parse(await cdp.evalJs("(function(){ var A = null; document.querySelectorAll('.grid-card').forEach(function(x){ if (x.dataset.cardType === 'flag' && x.dataset.groupId && !x.dataset.rowInGroup) A = x; }); var g = null; document.querySelectorAll('.grid-card').forEach(function(x){ if (x.dataset.rowInGroup === '1') g = x; }); return JSON.stringify({ col: window.__geo(A), row: window.__geo(g), state: window.__state() }); })()"));
    log('T5b 列成员 e 拖（行组内）', { before: before, after: after });

    // ═══ Z：console error ═══
    await sleep(400);
    console.log('  Z console errors: ' + (cdp.errs.length === 0 ? '零 ✅' : JSON.stringify(cdp.errs.slice(0, 5))));

    await cdp.close();
    process.exitCode = 0;
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
