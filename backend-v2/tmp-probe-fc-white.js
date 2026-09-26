// tmp-probe-fc-white.js — 用户「FC 首页左侧菜单上方有一个白白的东西？深色模式才看得见」
// 扫描探针：暗色（蓝暗 + mono 暗双跑）下加载 FC 首页，枚举左侧菜单卡（.tilt-container）
// 上方条带 + 重叠区 + 元素命中点的亮色元素（白/近白/高亮度），打印清单定位真身。
// 跑法：node tmp-probe-fc-white.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4410 + Math.floor(Math.random() * 400);
const CDP_PORT = 5410 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fcwhite-' + Date.now());

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

// 扫描 IIFE：菜单卡上方条带亮元素 + 重叠卡亮元素 + 命中点 + 卡片自身全量样式
const SCAN = `(function(){
  function rgbOf(s) {
    var m = (s || '').match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }
  function lum(r, g, b) { r/=255; g/=255; b/=255; return 0.2126*r + 0.7152*g + 0.0722*b; }
  function tag(el) {
    var t = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
    if (el.className && typeof el.className === 'string' && el.className.trim()) t += '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.');
    return t.length > 76 ? t.slice(0, 76) : t;
  }
  function rectStr(r) { return Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }
  var card = document.querySelector('.tilt-container');
  var cr = card.getBoundingClientRect();
  var out = {
    theme: document.documentElement.getAttribute('data-theme'),
    scrollY: window.scrollY,
    card: {}, above: [], overlap: [], points: [], lgLayers: []
  };
  var cs = getComputedStyle(card);
  out.card = {
    rect: rectStr(cr), bg: cs.backgroundColor,
    bgImage: (cs.backgroundImage || 'none').slice(0, 140),
    shadow: cs.boxShadow, transform: cs.transform,
    z: cs.zIndex, pos: cs.position, overflow: cs.overflow
  };
  // 1) 卡上方条带（y < card.top，x 左列 ± 80）：任何不透明且亮（L>0.5 或近白）的元素
  document.querySelectorAll('body *').forEach(function (el) {
    if (el === card) return;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    if (r.bottom <= cr.top + 1 && r.right > cr.left - 80 && r.left < cr.right + 80) {
      var st = getComputedStyle(el);
      var c = rgbOf(st.backgroundColor);
      var img = (st.backgroundImage || 'none');
      var hasImg = img.indexOf('url(') === 0 || img.indexOf('linear') === 0 || img.indexOf('radial') === 0;
      var bright = c && c.a > 0.1 && lum(c.r, c.g, c.b) > 0.5;
      if (bright || hasImg) {
        out.above.push({ el: tag(el), rect: rectStr(r), bg: st.backgroundColor, img: img.slice(0, 90), shadow: st.boxShadow.slice(0, 90), z: st.zIndex, pos: st.position });
      }
    }
  });
  // 2) 与卡重叠（含 z 覆盖与亮底）：x/y 交叠 > 6px 的元素
  document.querySelectorAll('body *').forEach(function (el) {
    if (el === card || el.closest('.tilt-container')) return;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    var ox = Math.min(r.right, cr.right) - Math.max(r.left, cr.left);
    var oy = Math.min(r.bottom, cr.bottom) - Math.max(r.top, cr.top);
    if (ox > 6 && oy > 6) {
      var st = getComputedStyle(el);
      var c = rgbOf(st.backgroundColor);
      var z = parseInt(st.zIndex, 10) || 0;
      if (z >= 0 && st.position !== 'static' || (c && c.a > 0.1 && lum(c.r, c.g, c.b) > 0.5)) {
        out.overlap.push({ el: tag(el), rect: rectStr(r), bg: st.backgroundColor, z: st.zIndex, pos: st.position, ope: st.pointerEvents });
      }
    }
  });
  // 3) 命中点网格：卡上缘上方 0-70px 中轴向下采样实际绘制元素
  for (var y = Math.max(0, cr.top - 70); y < cr.top + 12; y += 14) {
    var elp = document.elementFromPoint(cr.left + 100, Math.min(y, window.innerHeight - 2));
    if (elp) {
      var pst = getComputedStyle(elp);
      out.points.push({ y: Math.round(y), el: tag(elp), bg: pst.backgroundColor, img: (pst.backgroundImage || 'none').slice(0, 60) });
    }
  }
  // 4) 页内全部 lg-backdrop / lg-specular（卡附近）
  document.querySelectorAll('.lg-backdrop, .lg-specular').forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    if (r.bottom < cr.top - 200 || r.top > cr.top + 600) return;
    var st = getComputedStyle(el);
    out.lgLayers.push({ el: tag(el.parentElement || el), self: tag(el), rect: rectStr(r), bg: st.backgroundColor, filter: st.filter.slice(0, 40), bf: st.backdropFilter || st.webkitBackdropFilter, display: st.display });
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

  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
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

  const preset = (settings) => cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{' +
      'localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify(settings)) + ');' +
      'localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');' +
      '}catch(e){}'
  });
  const nav = async (url, waitExpr, label) => {
    await cdp.send('Page.navigate', { url });
    await waitFor(cdp, waitExpr, 15000, label);
    await sleep(900);
  };
  const scan = async () => JSON.parse(await cdp.evalJs(SCAN));
  const dump = (r, title) => {
    console.log('════ ' + title + '（theme=' + r.theme + ' scrollY=' + r.scrollY + '）════');
    console.log('  [菜单卡] rect=' + r.card.rect + ' bg=' + r.card.bg + ' img=' + r.card.bgImage);
    console.log('           shadow=' + r.card.shadow);
    console.log('           transform=' + r.card.transform + ' z=' + r.card.z + ' pos=' + r.card.pos);
    console.log('  ── 卡上方条带亮元素 ──');
    r.above.forEach(x => console.log('   ' + x.el + '  rect=' + x.rect + '  bg=' + x.bg + '  img=' + (x.img !== 'none' ? x.img : '') + '  z=' + x.z + ' ' + x.pos + (x.shadow !== 'none' ? '  shadow=' + x.shadow : '')));
    if (!r.above.length) console.log('   （无）');
    console.log('  ── 与卡重叠元素 ──');
    r.overlap.forEach(x => console.log('   ' + x.el + '  rect=' + x.rect + '  bg=' + x.bg + '  z=' + x.z + ' ' + x.pos + ' ' + x.ope));
    if (!r.overlap.length) console.log('   （无）');
    console.log('  ── 命中点采样（y → 实际绘制元素）──');
    r.points.forEach(x => console.log('   y=' + x.y + '  ' + x.el + '  bg=' + x.bg + (x.img !== 'none' ? '  img=' + x.img : '')));
    console.log('  ── 卡附近 lg 玻璃层 ──');
    r.lgLayers.forEach(x => console.log('   ' + x.self + ' (父 ' + x.el + ')  rect=' + x.rect + '  bg=' + x.bg + '  filter=' + x.filter + '  bf=' + x.bf + '  display=' + x.display));
  };

  // ── 1. 默认蓝暗 ──
  await preset({ theme: 'dark' });
  await nav(BASE + '/pages/fluidcanvas.html', "document.querySelector('.tilt-container')", 'FC 首页');
  dump(await scan(), '① FC 首页 暗（蓝）· scroll 0');

  await cdp.evalJs('window.scrollTo(0, 400)');
  await sleep(400);
  dump(await scan(), '② FC 首页 暗（蓝）· scroll 400（sticky）');

  // ── 2. mono 暗（黑白主题）──
  await preset({ theme: 'dark', accent: 'mono' });
  await nav(BASE + '/pages/fluidcanvas.html', "document.querySelector('.tilt-container')", 'FC 首页 mono');
  dump(await scan(), '③ FC 首页 mono 暗 · scroll 0');

  console.log('══ console errors: ' + cdp.errs.length + ' ══');
  cdp.errs.slice(0, 8).forEach(e => console.log('   ' + e));

  cdp.close();
  try { chrome.kill(); } catch (e) {}
  server.close();
  process.exit(0);
})().catch(e => { console.error('💥 ' + e.message); process.exit(1); });
