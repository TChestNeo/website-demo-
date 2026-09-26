// tmp-probe-seams.js — 贴齐缝保持轮探针：对当前编辑器实测各 W 场景缝值（修前/修后同一脚本对比）
// 用法：node tmp-probe-seams.js  （不暂存；服务静态 docs/ + headless Chrome + CDP 可信输入）
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');
// WebSocket = Node 24 内置全局（undici），同 tmp-battery-*.js 口径

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PORT = 18799, CDP_PORT = 18809;
const USER_DATA = path.join(process.env.TEMP || '/tmp', 'tmp-probe-seams-' + crypto.randomBytes(3).toString('hex'));

class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((res, rej) => { this.ws.addEventListener('open', res); this.ws.addEventListener('error', () => rej(new Error('ws error'))); });
    this.ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data.toString());
      if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.rej(new Error(p.method + ' 失败: ' + m.error.message)) : p.res(m.result); }
      else if (m.method === 'Runtime.exceptionThrown') this.errs.push(m.params.exceptionDetails.text);
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
  async close() { try { this.ws.close(); } catch (e) {} }
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
  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
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
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S0');
    const cen = (which) => cdp.evalJs("(function(){ var r = window.__" + which + ".getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()");
    const wSel = async (which) => { const c = JSON.parse(await cen(which)); await cdp.mouse('mousePressed', c.x, c.y, 1); await cdp.mouse('mouseReleased', c.x, c.y, 1); await sleep(350); };
    const hdl = (dir) => cdp.evalJs("(function(){ var hs = Array.prototype.slice.call(document.querySelectorAll('.resize-handle[data-dir=\"" + dir + "\"]')).filter(function(h){ var r = h.getBoundingClientRect(); return r.width > 2 && r.height > 2; }); if (!hs.length) return 'null'; var r = hs[0].getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()");
    const drag2 = async (dir, dx, dy) => {
      const h = JSON.parse(await hdl(dir));
      if (h === 'null') throw new Error('no handle ' + dir);
      await cdp.mouse('mousePressed', h.x, h.y, 1);
      for (let i = 1; i <= 4; i++) await cdp.mouse('mouseMoved', h.x + dx * i / 4, h.y + dy * i / 4);
      await cdp.mouse('mouseReleased', h.x + dx, h.y + dy, 1);
      await sleep(250);
    };
    const g2 = (a, b) => cdp.evalJs("(function(){ var A = window.__" + a + ", B = window.__" + b + "; var al = parseFloat(A.style.left) || 0, bl = parseFloat(B.style.left) || 0; return JSON.stringify({ gap: +(bl - (al + A.offsetWidth)).toFixed(1), overlap: +Math.max(0, (al + A.offsetWidth) - bl).toFixed(1) }); })()");
    // lr2: 与成员左右顺序无关的横缝量具（旗右盾左也能量）
    const lr2 = () => cdp.evalJs("(function(){ var A = window.__A, B = window.__B; var L = parseFloat(A.style.left) <= parseFloat(B.style.left) ? A : B, R = parseFloat(A.style.left) > parseFloat(B.style.left) ? A : B; return JSON.stringify({ gap: +(parseFloat(R.style.left) - (parseFloat(L.style.left) + L.offsetWidth)).toFixed(1), overlap: +Math.max(0, (parseFloat(L.style.left) + L.offsetWidth) - parseFloat(R.style.left)).toFixed(1) }); })()");
    const vg2 = (a, b) => cdp.evalJs("(function(){ var A = window.__" + a + ", B = window.__" + b + "; var at = parseFloat(A.style.top) || 0, bt = parseFloat(B.style.top) || 0; return JSON.stringify({ gap: +(bt - (at + A.offsetHeight)).toFixed(1), overlap: +Math.max(0, (at + A.offsetHeight) - bt).toFixed(1) }); })()");
    const boxOf = () => cdp.evalJs("(function(){ var ms = [window.__A, window.__B]; if (window.__C) ms.push(window.__C); var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9; ms.forEach(function(m){ var l = parseFloat(m.style.left) || 0, t = parseFloat(m.style.top) || 0; if (l < minX) minX = l; if (t < minY) minY = t; if (l + m.offsetWidth > maxX) maxX = l + m.offsetWidth; if (t + m.offsetHeight > maxY) maxY = t + m.offsetHeight; }); return JSON.stringify({ left: minX, top: minY, w: maxX - minX, h: maxY - minY }); })()");
    const drop = (asset, label) => cdp.evalJs("(function(){ var dt = new DataTransfer(); dt.setData('text/plain', JSON.stringify({ asset: " + JSON.stringify(asset) + ", label: " + JSON.stringify(label) + " })); window.gridCanvas.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); return true; })()");
    const dump = (tag) => cdp.evalJs("(function(){ var ms = Array.prototype.slice.call(document.querySelectorAll('.grid-card')).map(function(c){ var l = parseFloat(c.style.left)||0, t = parseFloat(c.style.top)||0; return { ty: c.dataset.cardType, g: c.dataset.groupId || null, l: l, t: t, w: c.offsetWidth, h: c.offsetHeight, r: l + c.offsetWidth, b: t + c.offsetHeight }; }); return JSON.stringify({ tag: " + JSON.stringify(tag) + ", n: ms.length, ms: ms }); })()");
    const clean = async () => {
      await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'reload');
      await cdp.evalJs("localStorage.removeItem('slati_fluidcanvas_draft'); true");
      await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'clean reload');
    };
    const setupFlagShield = async () => {
      await clean();
      await drop('flag', 'National Flag');
      await drop('shield', 'Emblem');
      await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); window.mergeCards(s, f, 'right'); window.__A = f; window.__B = s; window.selectCard(f); return true; })()");
      await sleep(350);
      console.log(await dump('fs ready'));
    };
    const setupCards = async (js) => {
      await clean();
      await cdp.evalJs(js);
      await sleep(350);
    };

    // P1: 旗+盾 e+120（W1 重设计——e+60 被去重叠链救回修前 0 缝，加大拖距）
    await setupFlagShield();
    await drag2('e', 120, 0);
    console.log('P1 flag+shield e+120 → ' + await g2('A', 'B'));

    // P2: W3 原样（flag+content+flag e+60）
    await setupCards("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 200, 200); var B = window.createContentCard(); window.moveCardPx(B, 380, 200); var C = window.createFlagCard(); window.moveCardPx(C, 560, 200); window.mergeCards(B, A, 'right'); window.mergeCards(C, B, 'right'); window.__A = A; window.__B = B; window.__C = C; return true; })()");
    await wSel('B');
    await drag2('e', 60, 0);
    console.log('P2 flag+content+flag e+60 → A-B ' + await g2('A', 'B') + ' | B-C ' + await g2('B', 'C'));

    // P3: L 形 flag+shield+content(下) e+60（W5 候选——se 拖留下 B-C −8.6 重叠链未修，改用 e-only）
    await setupCards("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 350); var dt = null; var B = window.createAssetCard('shield', 'Emblem', 0, 0, 5, 5); window.moveCardPx(B, 430, 350); window.mergeCards(B, A, 'right'); var C = window.createContentCard(); window.moveCardPx(C, 440, 520); window.mergeCards(C, B, 'bottom'); window.__A = A; window.__B = B; window.__C = C; return true; })()");
    await wSel('A');
    console.log('P3a sel=' + await cdp.evalJs("JSON.stringify({ sel: document.querySelectorAll('.grid-card.selected').length, gs: document.querySelectorAll('.grid-card.group-single').length, hs: (function(){ var o = {}; document.querySelectorAll('.resize-handle').forEach(function(h){ o[h.dataset.dir] = h.style.display; }); return o; })() })"));
    console.log('P3b handles=' + await cdp.evalJs("JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('.resize-handle')).filter(function(h){ var r = h.getBoundingClientRect(); return r.width > 2; }).map(function(h){ var r = h.getBoundingClientRect(); return h.dataset.dir + '@' + Math.round(r.left + r.width / 2) + ',' + Math.round(r.top + r.height / 2); }))") + ' box=' + await boxOf());
    await drag2('e', 60, 0);
    console.log('P3c L flag+shield+content e+60 → A-B ' + await g2('A', 'B') + ' | B-C ' + await vg2('B', 'C') + ' | box ' + await boxOf());

    // P4: 等比锁旗+盾 se+120/+20（W6 重设计）
    await setupCards("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); A.dataset.aspectLock = '1'; A.dataset.aspectRatio = 1.6; var B = window.createAssetCard('shield', 'Emblem', 0, 0, 5, 5); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); window.__A = A; window.__B = B; return true; })()");
    await wSel('A');
    await drag2('se', 120, 20);
    console.log('P4 locked-flag+shield se+120/+20 → A-B ' + await g2('A', 'B'));

    // P5: 旗+盾 e-20 收缩（W7 重设计）
    await setupFlagShield();
    const w50 = await cdp.evalJs('window.__A.offsetWidth + window.__B.offsetWidth');
    await drag2('e', -20, 0);
    const w51 = await cdp.evalJs('window.__A.offsetWidth + window.__B.offsetWidth');
    console.log('P5 flag+shield e-20 → A-B ' + await g2('A', 'B') + ' | wΔ=' + (w50 - w51));

    // P6: 旗+盾 nw -40/-30（W8 重设计）
    await setupFlagShield();
    const b60 = JSON.parse(await boxOf());
    await drag2('nw', -40, -30);
    const b61 = JSON.parse(await boxOf());
    console.log('P6 flag+shield nw-40/-30 → A-B ' + await g2('A', 'B') + ' | dL=' + (b60.left - b61.left).toFixed(1) + ' dT=' + (b60.top - b61.top).toFixed(1));

    // P7: 旗+盾 se+45/+35 → saveDraft → 重载 → 缝（W9 重设计）
    await setupFlagShield();
    await drag2('se', 45, 35);
    const g7a = await g2('A', 'B');
    await cdp.evalJs("window.saveDraft(); true");
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.grid-card')", 'reload restore');
    const snap = JSON.parse(await cdp.evalJs("JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('.grid-card')).map(function(c){ return { id: c.dataset.cardId, l: parseFloat(c.style.left)||0, t: parseFloat(c.style.top)||0, w: c.offsetWidth, h: c.offsetHeight, g: c.dataset.groupId }; }).sort(function(a,b){ return a.id < b.id ? -1 : 1; }))"));
    const L = snap[0].l <= snap[1].l ? snap[0] : snap[1], R = snap[0].l > snap[1].l ? snap[0] : snap[1];
    console.log('P7 flag+shield se+45/+35 前 ' + g7a + ' → 草稿重载后 gap=' + (R.l - (L.l + L.w)).toFixed(1));

    // P0: S6/S7 同款「旗右盾左」（setupGroup 顺序 mergeCards(f,s,'right')）——测修前是否被去重叠链救回 + 尺寸增长
    await clean();
    await drop('flag', 'National Flag');
    await drop('shield', 'Emblem');
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); window.mergeCards(f, s, 'right'); window.__A = f; window.__B = s; window.selectCard(f); return true; })()");
    await sleep(350);
    const p0w0 = await cdp.evalJs("JSON.stringify({ f: window.__A.offsetWidth + 'x' + window.__A.offsetHeight, s: window.__B.offsetWidth + 'x' + window.__B.offsetHeight })");
    await drag2('e', 60, 0);
    const p0w1 = await cdp.evalJs("JSON.stringify({ f: window.__A.offsetWidth + 'x' + window.__A.offsetHeight, s: window.__B.offsetWidth + 'x' + window.__B.offsetHeight })");
    console.log('P0a flag-right e+60 → ' + await lr2() + ' | sizes ' + p0w0 + ' → ' + p0w1);
    await clean();
    await drop('flag', 'National Flag');
    await drop('shield', 'Emblem');
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); window.mergeCards(f, s, 'right'); window.__A = f; window.__B = s; window.selectCard(f); return true; })()");
    await sleep(350);
    const p0w2 = await cdp.evalJs("JSON.stringify({ f: window.__A.offsetWidth + 'x' + window.__A.offsetHeight, s: window.__B.offsetWidth + 'x' + window.__B.offsetHeight })");
    await drag2('se', 40, 30);
    const p0w3 = await cdp.evalJs("JSON.stringify({ f: window.__A.offsetWidth + 'x' + window.__A.offsetHeight, s: window.__B.offsetWidth + 'x' + window.__B.offsetHeight })");
    console.log('P0b flag-right se+40/+30 → ' + await lr2() + ' | sizes ' + p0w2 + ' → ' + p0w3);

    console.log('DONE');
    await cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('FATAL', e); process.exit(1); });
