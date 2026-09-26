// tmp-probe-fc-white2.js — 第二轮：①尝试截图（本机 151 曾全黑，试当前版本）②2px 网格命中点
// 精扫卡上方条带 ③扩展带内扫描（含与卡顶交叠、亮边框、伪元素）④卡内部顶部区扫描。
// 跑法：node tmp-probe-fc-white2.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4410 + Math.floor(Math.random() * 400);
const CDP_PORT = 5410 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fcwhite2-' + Date.now());
const SHOT = path.join(__dirname, 'tmp-fcwhite-shot.png');

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

// 精扫 IIFE：2px 网格命中点 + 带内亮元素（含边框/伪元素/与卡顶交叠）
const SCAN = `(function(){
  function rgbOf(s) {
    var m = (s || '').match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }
  function lum(c) { if (!c) return 0; var r=c.r/255, g=c.g/255, b=c.b/255; return 0.2126*r + 0.7152*g + 0.0722*b; }
  function tag(el) {
    var t = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
    if (el.className && typeof el.className === 'string' && el.className.trim()) t += '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.');
    return t.length > 80 ? t.slice(0, 80) : t;
  }
  var card = document.querySelector('.tilt-container');
  var cr = card.getBoundingClientRect();
  var out = { points: [], brights: [], borders: [] };
  // 1) 命中点：卡上方 0..top 每 2px 一行，x 取 60/110/160/210（卡左 41 宽 220）
  var seen = {};
  for (var y = 2; y < cr.top + 2; y += 2) {
    for (var xi = 0; xi < 4; xi++) {
      var x = cr.left + 20 + xi * 50;
      var elp = document.elementFromPoint(x, Math.min(y, window.innerHeight - 2));
      if (!elp || elp === card) continue;
      var key = tag(elp);
      if (seen[key]) continue;
      seen[key] = 1;
      var st = getComputedStyle(elp);
      var c = rgbOf(st.backgroundColor);
      out.points.push({ y: y, x: Math.round(x), el: key, bg: st.backgroundColor, img: (st.backgroundImage || 'none').slice(0, 60), borderTop: st.borderTopWidth + ' ' + st.borderTopColor, shadow: st.boxShadow.slice(0, 80), z: st.zIndex, pos: st.position });
    }
  }
  // 2) 带内亮元素：与 [cr.top-120, cr.top+4] x 左列 [cr.left-80, cr.right+80] 相交
  document.querySelectorAll('body *').forEach(function (el) {
    if (el === card) return;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    var ix = Math.min(r.right, cr.right + 80) - Math.max(r.left, cr.left - 80);
    var iy = Math.min(r.bottom, cr.top + 4) - Math.max(r.top, cr.top - 120);
    if (ix <= 0 || iy <= 0) return;
    var st = getComputedStyle(el);
    var c = rgbOf(st.backgroundColor);
    var img = st.backgroundImage || 'none';
    var hasImg = img.indexOf('url(') === 0 || img.indexOf('linear') === 0 || img.indexOf('radial') === 0;
    var btc = rgbOf(st.borderTopColor), bbc = rgbOf(st.borderBottomColor);
    var brightBorder = (btc && btc.a > 0.15 && lum(btc) > 0.55 && parseFloat(st.borderTopWidth) >= 1) || (bbc && bbc.a > 0.15 && lum(bbc) > 0.55 && parseFloat(st.borderBottomWidth) >= 1);
    var brightBg = c && c.a > 0.08 && lum(c) > 0.45;
    if (brightBg || hasImg || brightBorder) {
      out.brights.push({ el: tag(el), rect: Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height), bg: st.backgroundColor, img: img.slice(0, 80), borderTop: st.borderTopWidth + ' ' + st.borderTopColor, borderBottom: st.borderBottomWidth + ' ' + st.borderBottomColor, shadow: st.boxShadow.slice(0, 90), z: st.zIndex, pos: st.position, ope: st.pointerEvents });
    }
  });
  // 3) 伪元素检查（头部/卡/主容器）
  ['.studio-header', '.tilt-container', '.studio-main'].forEach(function (sel) {
    var el = document.querySelector(sel);
    if (!el) return;
    ['::before', '::after'].forEach(function (pe) {
      var st = getComputedStyle(el, pe);
      var c = rgbOf(st.backgroundColor);
      var img = st.backgroundImage || 'none';
      if (st.content !== 'none' && st.content !== '' && st.content !== 'normal') {
        out.borders.push({ el: sel + pe, content: String(st.content).slice(0, 20), bg: st.backgroundColor, img: img.slice(0, 60), w: st.width, h: st.height, pos: st.position });
      }
    });
  });
  return JSON.stringify(out);
})()`;

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

  // 本轮不带 --disable-gpu：赌一把截图已恢复
  const chrome = spawn(chromePath, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
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
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');

  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{' +
      'localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify({ theme: 'dark' })) + ');' +
      'localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');' +
      '}catch(e){}'
  });
  await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas.html' });
  await waitFor(cdp, "document.querySelector('.tilt-container')", 15000, 'FC 首页');
  await sleep(900);

  // ── 截图尝试 ──
  try {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));
    console.log('📸 截图已存 tmp-fcwhite-shot.png (' + fs.statSync(SHOT).size + ' bytes)');
  } catch (e) { console.log('📸 截图失败: ' + e.message); }
  try {
    const shotJ = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    fs.writeFileSync(SHOT.replace('.png', '.jpg'), Buffer.from(shotJ.data, 'base64'));
    console.log('📸 JPEG 截图已存 tmp-fcwhite-shot.jpg (' + fs.statSync(SHOT.replace('.png', '.jpg')).size + ' bytes)');
  } catch (e) { console.log('📸 JPEG 截图失败: ' + e.message); }

  // ── 精扫 ──
  const r = await JSON.parse(await cdp.evalJs(SCAN));
  console.log('════ 命中点（2px 网格，卡上方，左列 x=61..251）════');
  r.points.forEach(x => console.log('   y=' + x.y + ' x=' + x.x + '  ' + x.el + '  bg=' + x.bg + '  bt=' + x.borderTop + '  z=' + x.z + ' ' + x.pos + (x.shadow !== 'none' ? '  shadow=' + x.shadow : '') + (x.img !== 'none' ? '  img=' + x.img : '')));
  console.log('════ 带内亮元素（卡顶上方 120px 内、左列 ±80）════');
  r.brights.forEach(x => console.log('   ' + x.el + '  rect=' + x.rect + '  bg=' + x.bg + '  bt=' + x.borderTop + '  bb=' + x.borderBottom + '  z=' + x.z + ' ' + x.pos + ' ' + x.ope + (x.shadow !== 'none' ? '  shadow=' + x.shadow : '') + (x.img !== 'none' ? '  img=' + x.img : '')));
  if (!r.brights.length) console.log('   （无）');
  console.log('════ 伪元素（header/card/main）════');
  r.borders.forEach(x => console.log('   ' + x.el + '  content=' + x.content + '  bg=' + x.bg + '  img=' + x.img + '  ' + x.w + 'x' + x.h + '  ' + x.pos));
  if (!r.borders.length) console.log('   （无）');

  console.log('══ console errors: ' + cdp.errs.length + ' ══');

  cdp.close();
  try { chrome.kill(); } catch (e) {}
  server.close();
  process.exit(0);
})().catch(e => { console.error('💥 ' + e.message); process.exit(1); });
