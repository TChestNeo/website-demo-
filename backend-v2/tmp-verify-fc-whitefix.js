// tmp-verify-fc-whitefix.js — 验证 v0.2.45.1 白顶线修复：
//   暗蓝 / 暗 mono / 亮色三态各查 .tilt-container computed box-shadow（含 hover 模拟）
//   断言：暗两态无 inset、无 255,255,255；亮色保留 inset 白线（零触碰）。暗两态截图供像素分析。
// 跑法：node tmp-verify-fc-whitefix.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4810 + Math.floor(Math.random() * 400);
const CDP_PORT = 5810 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fcwhitefix-' + Date.now());

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

const CHECK = `(function(){
  var card = document.querySelector('.tilt-container');
  if (!card) return JSON.stringify({ err: 'no card' });
  var cs = getComputedStyle(card);
  var sh = cs.boxShadow;
  var r = card.getBoundingClientRect();
  return JSON.stringify({
    theme: document.documentElement.getAttribute('data-theme'),
    shadow: sh,
    hasInset: sh.indexOf('inset') !== -1,
    hasWhite: sh.indexOf('255, 255, 255') !== -1,
    hasWhite08: sh.indexOf('rgba(255, 255, 255, 0.8') !== -1,
    rect: Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)
  });
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

  // 先落 origin 再种 localStorage（首页脚本 parse 时就读，必须先种后载）
  await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas.html?seedme=1' });
  await sleep(400);

  const SCENARIOS = [
    { name: '暗蓝主题', seed: { theme: 'dark' }, shot: 'tmp-fcwhite-fix-dark.png', hover: true },
    { name: '暗 mono 主题', seed: { theme: 'dark', accent: 'mono' }, shot: 'tmp-fcwhite-fix-mono.png', hover: false },
    { name: '亮色主题（零触碰）', seed: { theme: 'light' }, shot: null, hover: false }
  ];

  let pass = 0, fail = 0;
  for (const sc of SCENARIOS) {
    await cdp.evalJs('localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify(sc.seed)) + '); localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');');
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas.html' });
    await waitFor(cdp, "document.querySelector('.tilt-container')", 15000, sc.name);
    await sleep(900);
    const rest = JSON.parse(await cdp.evalJs(CHECK));
    console.log('══ ' + sc.name + ' ══');
    console.log('   shadow=' + rest.shadow);
    console.log('   rect=' + rest.rect);

    if (sc.name.indexOf('亮色') === -1) {
      const ok = !rest.hasInset && !rest.hasWhite;
      console.log('   [断言] 无 inset、无白：' + (ok ? '✅ PASS' : '❌ FAIL'));
      ok ? pass++ : fail++;
    } else {
      const ok = rest.hasInset && rest.hasWhite08;
      console.log('   [断言] 亮色仍保留 inset 白线（零触碰）：' + (ok ? '✅ PASS' : '❌ FAIL'));
      ok ? pass++ : fail++;
    }

    // hover 模拟：inline onmouseenter 会把白线加亮到 0.9，!important 应继续压住
    if (sc.hover) {
      await cdp.evalJs(`(function(){
        var card = document.querySelector('.tilt-container');
        card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      })()`);
      await sleep(250);
      const h = JSON.parse(await cdp.evalJs(CHECK));
      console.log('   [hover 后] shadow=' + h.shadow);
      const ok = !h.hasInset && !h.hasWhite;
      console.log('   [断言] hover 后仍无白：' + (ok ? '✅ PASS' : '❌ FAIL'));
      ok ? pass++ : fail++;
    }

    if (sc.shot) {
      try {
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        const f = path.join(__dirname, sc.shot);
        fs.writeFileSync(f, Buffer.from(shot.data, 'base64'));
        console.log('   📸 ' + sc.shot + ' (' + fs.statSync(f).size + ' bytes)');
      } catch (e) { console.log('   📸 截图失败: ' + e.message); }
    }
  }

  console.log('══ console errors: ' + cdp.errs.length + ' ══');
  cdp.errs.forEach(e => console.log('   ' + e));
  console.log('════ 总断言：' + pass + ' PASS / ' + fail + ' FAIL ════');
  cdp.close();
  try { chrome.kill(); } catch (e) {}
  server.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('💥 ' + e.message); process.exit(1); });
