// tmp-probe-sidebar-bottom.js — 一次性探针：侧栏渲染实况（亮/暗两模式）
// 用途：定位用户「左侧菜单的底部背景」真身——枚举侧栏全部元素 + computed 背景/几何
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4900 + Math.floor(Math.random() * 80);
const CDP_PORT = 5900 + Math.floor(Math.random() * 80);
const USER_DATA = path.join(os.tmpdir(), 'mn-probe-sidebar-' + Date.now());
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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, user: { id: 'USR-000001', name: 'Neo', email: 'neo@mn.world', tier: 'premium' } })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/index.html' });
    await sleep(2500);
    // 等侧栏渲染
    for (let i = 0; i < 40; i++) {
      const done = await cdp.evalJs('!!(document.getElementById("slati-sidebar") && document.getElementById("slati-sidebar").children.length > 0)');
      if (done) break;
      await sleep(200);
    }
    await sleep(800);

    const dump = `
(function () {
  var out = { innerHeight: window.innerHeight, innerWidth: window.innerWidth, theme: document.documentElement.getAttribute('data-theme') || 'light', accent: document.documentElement.getAttribute('data-accent') || 'none' };
  var sb = document.getElementById('slati-sidebar');
  function rect(el) { var r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) }; }
  function bg(el) { var c = getComputedStyle(el); return { bg: c.backgroundColor, bgi: c.backgroundImage === 'none' ? 'none' : 'IMG', bd: c.backdropFilter, filter: c.filter, opacity: c.opacity, display: c.display, z: c.zIndex }; }
  out.sidebar = { rect: rect(sb), bg: bg(sb) };
  out.children = [];
  for (var i = 0; i < sb.children.length; i++) {
    var ch = sb.children[i];
    var info = { cls: ch.className, rect: rect(ch), bg: bg(ch) };
    info.layers = [];
    for (var j = 0; j < ch.children.length; j++) {
      var l = ch.children[j];
      if (l.className && (l.className.indexOf('lg-') === 0)) info.layers.push({ cls: l.className, rect: rect(l), bg: bg(l) });
    }
    out.children.push(info);
  }
  // 侧栏内所有「非透明背景 + 位于下 40% 视口」的元素（底部背景真身候选）
  out.bottomCandidates = [];
  var all = sb.querySelectorAll('*');
  for (var k = 0; k < all.length; k++) {
    var el = all[k];
    var c = getComputedStyle(el);
    if (c.display === 'none' || c.visibility === 'hidden') continue;
    var r = el.getBoundingClientRect();
    if (r.height < 2) continue;
    if (r.bottom < window.innerHeight * 0.55) continue;
    var hasPaint = c.backgroundColor !== 'rgba(0, 0, 0, 0)' || c.backgroundImage !== 'none';
    if (hasPaint) out.bottomCandidates.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), rect: rect(el), bg: c.backgroundColor, bgi: c.backgroundImage.slice(0, 80), bd: c.backdropFilter, filter: c.filter.slice(0, 60) });
  }
  return out;
})()`;
    console.log('═══ 亮色模式 ═══');
    console.log(JSON.stringify(await cdp.evalJs(dump), null, 1));

    await cdp.evalJs('document.documentElement.setAttribute("data-theme","dark");');
    await sleep(600);
    console.log('\n═══ 暗色模式 ═══');
    console.log(JSON.stringify(await cdp.evalJs(dump), null, 1));
    cdp.close();
  } catch (e) {
    console.error('探针异常：', e && e.message);
  }
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  server.close();
  process.exit(0);
})();
