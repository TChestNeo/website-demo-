// tmp-probe-s24c.js — 完整复刻电池 S20→S24 序列（草稿跨场景累积），S24 拖前 dump 全景（不暂存）
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PORT = 18821, CDP_PORT = 18831;
const USER_DATA = path.join(process.env.TEMP || '/tmp', 'tmp-probe-s24c-' + crypto.randomBytes(3).toString('hex'));

class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((res, rej) => { this.ws.addEventListener('open', res); this.ws.addEventListener('error', () => rej(new Error('ws error'))); });
    this.ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data.toString());
      if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.rej(new Error(p.method + ' 失败: ' + m.error.message)) : p.res(m.result); }
    });
  }
  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.pending.set(id, { res, rej, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  evalJs(expr) { return this.send('Runtime.evaluate', { expression: expr, returnByValue: true }).then(r => r.result.value); }
  async mouse(type, x, y, clickCount) {
    await this.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: clickCount || 1 });
  }
  async trustedClick(x, y, cc) { await this.mouse('mousePressed', x, y, cc); await this.mouse('mouseReleased', x, y, cc); }
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

const server = http.createServer((req, res) => {
  let f = path.join(DOCS, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DOCS, 'index.html');
  const ext = path.extname(f).toLowerCase();
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
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
    if (!up) throw new Error('CDP 没起来');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session",' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}' });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const cen = (which) => cdp.evalJs("(function(){ var r = window.__" + which + ".getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()");
    const singleSel = async (which) => {
      await sleep(400); // 安定睡眠：等建卡动画/恢复渲染落定（S24 失败疑似竞态）
      const c = JSON.parse(await cen(which));
      await cdp.trustedClick(c.x, c.y, 1); await sleep(600);
      console.log('  [单击后] ' + await cdp.evalJs("JSON.stringify({ sel: document.querySelectorAll('.grid-card.selected').length, gs: document.querySelectorAll('.grid-card.group-single').length })"));
      await cdp.trustedClick(c.x, c.y, 1);
      await sleep(350);
      console.log('  [双击后] ' + await cdp.evalJs("JSON.stringify({ sel: document.querySelectorAll('.grid-card.selected').length, gs: document.querySelectorAll('.grid-card.group-single').length })"));
    };
    const hdlRaw = (dir) => cdp.evalJs("(function(){ var h = document.querySelector('.resize-handle[data-dir=\"" + dir + "\"]'); if (!h) return 'null'; var r = h.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }); })()");
    const drag2 = async (dir, dx, dy) => {
      const h = JSON.parse(await hdlRaw(dir));
      if (h === 'null') throw new Error('no handle ' + dir);
      await cdp.mouse('mousePressed', h.x, h.y, 1);
      for (let i = 1; i <= 4; i++) await cdp.mouse('mouseMoved', h.x + dx * i / 4, h.y + dy * i / 4);
      await cdp.mouse('mouseReleased', h.x + dx, h.y + dy, 1);
      await sleep(250);
    };
    const gL = (which) => cdp.evalJs("parseFloat(window.__" + which + ".style.left) || 0");
    const g2 = (a, b) => cdp.evalJs("(function(){ var A = window.__" + a + ", B = window.__" + b + "; var al = parseFloat(A.style.left) || 0, bl = parseFloat(B.style.left) || 0; return JSON.stringify({ gap: bl - (al + A.offsetWidth), overlap: Math.max(0, (al + A.offsetWidth) - bl) }); })()");
    const dumpCards = (label) => cdp.evalJs("(function(){ var arr = Array.prototype.slice.call(document.querySelectorAll('.grid-card')).map(function(c){ var r=c.getBoundingClientRect(); return { t:c.dataset.cardType, x:+parseFloat(c.style.left||0).toFixed(0), y:+parseFloat(c.style.top||0).toFixed(0), w:r.width, h:r.height, g:c.dataset.groupId?1:0, sel:c.classList.contains('selected')?1:0, gs:c.classList.contains('group-single')?1:0, hid:c.classList.contains('layer-hidden')?1:0 }; }); return label + ' (' + arr.length + ' 卡): ' + JSON.stringify(arr); })()");
    const dumpHandles = () => cdp.evalJs("(function(){ return 'e-handles: ' + JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('.resize-handle[data-dir=\"e\"]')).map(function(h){ var r=h.getBoundingClientRect(); return {x:+r.left.toFixed(0), y:+r.top.toFixed(0), w:r.width, h:r.height, vis:(r.width>2&&r.height>2)?1:0}; })); })()");

    // ══ 电池 S20/S21（同页两拖）══
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S20');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createContentCard(); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); window.__A = A; window.__B = B; return true; })()");
    await singleSel('A');
    await drag2('e', 60, 0);
    await drag2('e', -30, 0);
    console.log(await dumpCards('S20 后'));
    // ══ 电池 S22 ══
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S22');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 200, 200); var B = window.createContentCard(); window.moveCardPx(B, 380, 200); var C = window.createFlagCard(); window.moveCardPx(C, 560, 200); window.mergeCards(B, A, 'right'); window.mergeCards(C, B, 'right'); window.__A = A; window.__B = B; window.__C = C; return true; })()");
    await singleSel('B');
    await drag2('e', 60, 0);
    console.log(await dumpCards('S22 后'));
    // ══ 电池 S23 ══
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S23');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createContentCard(); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); window.__A = A; window.__B = B; return true; })()");
    await singleSel('B');
    await drag2('w', -40, 0);
    console.log(await dumpCards('S23 后'));
    // ══ 电池 S24 ══
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S24');
    await cdp.evalJs("(function(){ var A = window.createContentCard(); window.moveCardPx(A, 250, 350); var B = window.createFlagCard(); window.moveCardPx(B, 430, 350); window.mergeCards(B, A, 'right'); var C = window.createContentCard(); window.moveCardPx(C, 440, 520); window.mergeCards(C, B, 'bottom'); window.__A = A; window.__B = B; window.__C = C; return true; })()");
    await singleSel('A');
    console.log(await dumpCards('S24 拖前'));
    console.log('S24 sel-state=' + await cdp.evalJs("JSON.stringify({ sel: document.querySelectorAll('.grid-card.selected').length, gs: document.querySelectorAll('.grid-card.group-single').length, selTypes: Array.prototype.slice.call(document.querySelectorAll('.grid-card.selected')).map(function(c){ return c.dataset.cardType; }) })"));
    console.log(await dumpHandles());
    console.log('S24 hdl-e=' + await hdlRaw('e'));
    const bL0 = await gL('B');
    const cL0 = await gL('C');
    const cT0 = await cdp.evalJs('parseFloat(window.__C.style.top) || 0');
    const cW0 = await cdp.evalJs('window.__C.offsetWidth');
    await drag2('e', 60, 0);
    let g24 = JSON.parse(await g2('A', 'B'));
    const bL1 = await gL('B');
    const cL1 = await gL('C');
    const cT1 = await cdp.evalJs('parseFloat(window.__C.style.top) || 0');
    const cW1 = await cdp.evalJs('window.__C.offsetWidth');
    console.log('S24 拖后 → gap=' + g24.gap + ' overlap=' + g24.overlap + ' bΔ=' + (bL1 - bL0) + ' cΔL=' + (cL1 - cL0) + ' cΔT=' + (cT1 - cT0) + ' cΔW=' + (cW1 - cW0));
    console.log(await dumpCards('S24 拖后'));
    console.log('DONE');
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('FATAL', e); process.exit(1); });
