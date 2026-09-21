// tmp-probe-pan-jank.js — 用户「现在是我在移动视角时有明显出现掉帧能不能处理一下？」实证：
//   种子 12 卡草稿 + dark 主题，剖析三个视口操作：
//   ① 中键平移 @zoom 1（document mousemove ×60 @125Hz 直写 scrollLeft/scrollTop——无 rAF 合并、
//     无 fc-moving 玻璃挂起，疑似每帧多写 + backdrop-filter 每帧重光栅）
//   ② 中键平移 @zoom 2（CSS zoom 光栅化成本叠加）
//   ③ 原生滚轮纵向滚动（CDP 真滚轮事件；无任何手势钩子——玻璃面每帧重光栅对照）
//   每操作计：rAF 帧间隔（max / >32ms / >50ms 帧数）+ scrollLeft/scrollTop 实例写计数
//   + 手势期间 body.fc-moving 帧数（修后应>0）+ 最终落点（平移确实发生）。
// 跑法：node tmp-probe-pan-jank.js（house CDP 模式；修前修后各跑一遍对比）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4830 + Math.floor(Math.random() * 370);
const CDP_PORT = 5830 + Math.floor(Math.random() * 370);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-panjank-' + Date.now());

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => {
        if (e2) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b2);
      });
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
        this.errs.push(JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
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
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--hide-scrollbars', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
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
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // 先落 origin 再种草稿 + 登录种子
  await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html?seedme=1' });
  await sleep(400);

  const cards = [];
  for (let i = 0; i < 12; i++) {
    cards.push({
      id: 't' + i, type: 'text', label: '卡片 ' + (i + 1),
      col: 2 + (i % 4) * 14, row: 2 + Math.floor(i / 4) * 12,
      colSpan: 12, rowSpan: 8, text: '内容 ' + (i + 1)
    });
  }
  await cdp.evalJs('localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');' +
    'localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify({ theme: 'dark' })) + ');' +
    'localStorage.setItem("slati_fluidcanvas_draft", ' + JSON.stringify(JSON.stringify({
      title: '掉帧剖析', cards: cards, settings: { snapOn: true, alignOn: true }
    })) + ');');
  await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
  await waitFor(cdp, "document.querySelectorAll('#gridCanvas .grid-card').length >= 12", 20000, '编辑器 12 卡');
  await sleep(1500);

  // 仪表：rAF 帧间隔 + scrollLeft/scrollTop 实例写计数 + fc-moving 帧计数（常驻；每操作前清零）
  await cdp.evalJs(`(function(){
    window.__jank = { frames: [], last: 0, slW: 0, stW: 0, mov: 0 };
    var el = document.getElementById('gridCanvas').parentElement;
    var dL = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollLeft');
    var dT = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    Object.defineProperty(el, 'scrollLeft', {
      get: function(){ return dL.get.call(this); },
      set: function(v){ window.__jank.slW++; dL.set.call(this, v); }, configurable: true
    });
    Object.defineProperty(el, 'scrollTop', {
      get: function(){ return dT.get.call(this); },
      set: function(v){ window.__jank.stW++; dT.set.call(this, v); }, configurable: true
    });
    function raf(t){ var d = t - window.__jank.last; if (d > 0) window.__jank.frames.push({ t: Math.round(t), d: Math.round(d * 10) / 10 }); window.__jank.last = t; if (document.body.classList.contains('fc-moving')) window.__jank.mov++; requestAnimationFrame(raf); }
    requestAnimationFrame(function(t){ window.__jank.last = t; requestAnimationFrame(raf); });
    window.__resetJank = function(){ window.__jank.frames = []; window.__jank.slW = 0; window.__jank.stW = 0; window.__jank.mov = 0; window.__jank.t0 = performance.now(); };
    window.__readJank = function(){
      var f = window.__jank.frames, max = 0, o32 = 0, o50 = 0, slow = [];
      f.forEach(function(r){
        if (r.d > max) max = r.d;
        if (r.d > 32) { o32++; slow.push(Math.round(r.t - window.__jank.t0) + ':' + r.d); }
        if (r.d > 50) o50++;
      });
      var el = document.getElementById('gridCanvas').parentElement;
      return JSON.stringify({ n: f.length, max: max, over32: o32, over50: o50, slow: slow.slice(0, 12),
        slW: window.__jank.slW, stW: window.__jank.stW, mov: window.__jank.mov,
        sl: el.scrollLeft, st: el.scrollTop, zoom: window.viewZoom || 1 });
    };
  })()`);

  // 空闲基线：什么都不干 1.5s 的帧间隔（页面静息负载定位）
  await cdp.evalJs('window.__resetJank()');
  await sleep(1500);
  console.log('── 空闲基线（1.5s 静息）：');
  console.log('   ' + await cdp.evalJs('window.__readJank()'));

  // ═══ 操作 1：中键平移 @zoom 1（60 次 mousemove @125Hz；预滚 scrollLeft=400 双向留量）═══
  await cdp.evalJs(`(function(){
    window.setViewZoom(1, null, null);
    var el = document.getElementById('gridCanvas').parentElement;
    el.scrollLeft = 400; el.scrollTop = 300;
    window.__resetJank();
    var r = document.getElementById('gridCanvas').getBoundingClientRect();
    var cx = r.left + 300, cy = r.top + 250;
    document.getElementById('gridCanvas').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 1, buttons: 4 }));
    var i = 0;
    (function step(){
      i++;
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx - i * 2, clientY: cy - i * 1.5, buttons: 4 }));
      if (i < 60) setTimeout(step, 8);
      else document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx - 120, clientY: cy - 90, button: 1 }));
    })();
    return 'ok';
  })()`);
  await sleep(1000);
  console.log('── 操作① 中键平移 @zoom1（60×mousemove，期望 sl 400→520 st 300→390）：');
  console.log('   ' + await cdp.evalJs('window.__readJank()'));

  // ═══ 操作 2：中键平移 @zoom 2（CSS zoom 光栅化成本叠加）═══
  await cdp.evalJs(`(function(){
    window.setViewZoom(2, 640, 450);
    var el = document.getElementById('gridCanvas').parentElement;
    el.scrollLeft = 400; el.scrollTop = 300;
    window.__resetJank();
    var r = document.getElementById('gridCanvas').getBoundingClientRect();
    var cx = r.left + 300, cy = r.top + 250;
    document.getElementById('gridCanvas').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 1, buttons: 4 }));
    var i = 0;
    (function step(){
      i++;
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx - i * 2, clientY: cy - i * 1.5, buttons: 4 }));
      if (i < 60) setTimeout(step, 8);
      else document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx - 120, clientY: cy - 90, button: 1 }));
    })();
    return 'ok';
  })()`);
  await sleep(1000);
  console.log('── 操作② 中键平移 @zoom2（期望 sl 400→520 st 300→390——client px 直写滚距自洽）：');
  console.log('   ' + await cdp.evalJs('window.__readJank()'));

  // ═══ 操作 3：原生滚轮纵向滚动（CDP 真滚轮 40×deltaY=24 @125Hz；无手势钩子对照）═══
  await cdp.evalJs(`(function(){
    window.setViewZoom(1, null, null);
    var el = document.getElementById('gridCanvas').parentElement;
    el.scrollLeft = 400; el.scrollTop = 300;
    window.__resetJank();
    return 'ok';
  })()`);
  for (let k = 0; k < 40; k++) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 640, y: 450, deltaX: 0, deltaY: 24 });
    await sleep(8);
  }
  await sleep(1000);
  console.log('── 操作③ 原生滚轮纵向（40×wheel，scrollTop 应 >300）：');
  console.log('   ' + await cdp.evalJs('window.__readJank()'));

  console.log('══ console errors: ' + cdp.errs.length + ' ══');
  cdp.errs.forEach(e => console.log('   ' + e));
  cdp.close();
  try { chrome.kill(); } catch (e) {}
  server.close();
  process.exit(0);
})().catch(e => { console.error('💥 ' + e.message); process.exit(1); });
