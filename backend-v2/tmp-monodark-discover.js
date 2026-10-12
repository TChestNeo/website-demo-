// tmp-monodark-discover.js — v0.2.42.2 mono 暗色背景翻黑族 发现扫描（2026-09-14）
// 用户「把黑白主题的深色模式背景颜色改成黑色系的而不是原本的蓝色 + FC 深色黑白主题有白底白字按钮」
// 本脚本 = 修复前扫描：暗 mono 下找出 ①蓝 tint 深底元素 ②白底白字按钮，打印清单供逐项修。
// 跑法：node tmp-monodark-discover.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4410 + Math.floor(Math.random() * 400);
const CDP_PORT = 5410 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-monodark-' + Date.now());

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

// 页面内扫描（IIFE 返回 JSON）：蓝 tint 深底元素 + 白底白字按钮
const SCAN = `(function(){
  function rgbOf(st) {
    var m = (st.backgroundColor || '').match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }
  function hueSatLight(r, g, b) {
    r/=255; g/=255; b/=255;
    var mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx-mn;
    var h = 0;
    if (d > 0) {
      if (mx === r) h = ((g-b)/d) % 6;
      else if (mx === g) h = (b-r)/d + 2;
      else h = (r-g)/d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    var l = (mx+mn)/2, s = d === 0 ? 0 : d / (1 - Math.abs(2*l-1));
    return { h: h, s: s, l: l };
  }
  var out = { blueBgs: [], whiteBtns: [], docBg: null };
  var htmlEl = document.documentElement;
  var hb = rgbOf(getComputedStyle(htmlEl));
  out.docBg = { html: getComputedStyle(htmlEl).backgroundColor, body: getComputedStyle(document.body).backgroundColor };
  var seen = {};
  document.querySelectorAll('*').forEach(function(el){
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    var st = getComputedStyle(el);
    var c = rgbOf(st);
    var tag = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : '');
    if (tag.length > 70) tag = tag.slice(0, 70);
    if (c && c.a > 0.05) {
      var hsl = hueSatLight(c.r, c.g, c.b);
      // 蓝 tint 深底：色相 200-285、亮度 < 0.38、饱和度 > 0.12（排除纯灰黑）
      if (hsl.h >= 200 && hsl.h <= 285 && hsl.l < 0.38 && hsl.s > 0.12) {
        if (!seen['bg' + tag + hsl.h.toFixed(0)]) { seen['bg' + tag + hsl.h.toFixed(0)] = 1;
          out.blueBgs.push({ el: tag, bg: st.backgroundColor, w: Math.round(r.width), h: Math.round(r.height), hDeg: Math.round(hsl.h), L: +hsl.l.toFixed(3) }); }
      }
      // 白底白字按钮：bg 亮度 > 0.8 且 color 亮度 > 0.8
      var fg = rgbOf({ backgroundColor: st.color });
      if (fg) {
        var fhsl = hueSatLight(fg.r, fg.g, fg.b);
        if (hsl.l > 0.8 && fhsl.l > 0.8) {
          out.whiteBtns.push({ el: tag, bg: st.backgroundColor, color: st.color, text: (el.textContent || '').trim().slice(0, 24) });
        }
      }
    }
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
  await cdp.send('DOM.enable'); // 本机 Chrome 要求 DOM 先于 CSS enable
  await cdp.send('CSS.enable');

  const preset = (settings, withSession) => cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{' +
      'localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify(settings)) + ');' +
      (withSession === true ? 'localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');'
        : withSession === false ? 'localStorage.removeItem("slati_session");' : '') +
      '}catch(e){}'
  });
  const nav = async (url, waitExpr, label) => {
    await cdp.send('Page.navigate', { url });
    await waitFor(cdp, waitExpr, 15000, label);
    await sleep(800);
  };
  const scan = async () => JSON.parse(await cdp.evalJs(SCAN));

  // ── 1. FC 首页 暗 mono ──
  await preset({ theme: 'dark', accent: 'mono' }, true);
  await nav(BASE + '/pages/fluidcanvas.html', "document.querySelector('.studio-header')", 'FC 首页');
  let r = await scan();
  console.log('══ FC 首页 暗 mono（body bg=' + r.docBg.body + '）══');
  console.log('  ── 蓝 tint 深底元素 ──');
  r.blueBgs.slice(0, 30).forEach(x => console.log('   ' + x.el + '  ' + x.bg + '  h=' + x.hDeg + '° L=' + x.L + ' ' + x.w + '×' + x.h));
  console.log('  ── 白底白字按钮 ──');
  r.whiteBtns.slice(0, 30).forEach(x => console.log('   ' + x.el + '  bg=' + x.bg + ' fg=' + x.color + ' 「' + x.text + '」'));

  // ── 2. FC 编辑器 暗 mono ──
  await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.editor-toolbar') || document.querySelector('body')", 'FC 编辑器');
  r = await scan();
  console.log('══ FC 编辑器 暗 mono（body bg=' + r.docBg.body + '）══');
  console.log('  ── 蓝 tint 深底元素 ──');
  r.blueBgs.slice(0, 30).forEach(x => console.log('   ' + x.el + '  ' + x.bg + '  h=' + x.hDeg + '° L=' + x.L + ' ' + x.w + '×' + x.h));
  console.log('  ── 白底白字按钮 ──');
  r.whiteBtns.slice(0, 30).forEach(x => console.log('   ' + x.el + '  bg=' + x.bg + ' fg=' + x.color + ' 「' + x.text + '」'));

  // ── 3. console errors ──
  console.log('══ console errors: ' + cdp.errs.length + ' ══');
  cdp.errs.slice(0, 10).forEach(e => console.log('   ' + e));

  cdp.close();
  try { chrome.kill(); } catch (e) {}
  server.close();
  process.exit(0);
})().catch(e => { console.error('💥 ' + e.message); process.exit(1); });
