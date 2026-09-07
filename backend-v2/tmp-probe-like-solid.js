// tmp-probe-like-solid.js — v0.2.18.4 探针：实锤两问题
//   A) 「点击后不是实心」：Material Symbols Outlined 的 FILL 轴默认 0——'favorite' 与 'favorite_border' 渲染完全一样（都空心）
//      → canvas 像素计数实证 FILL 0 vs 1；并查 liked 态 computed font-variation-settings
//   B) 「中心没对上」：.like-burst 照搬参考 right:40px（参考容器 ~85px 宽），我们按钮 ~50px → 粒子原点在按钮左缘外
//      → 注入 like-burst 量 getBoundingClientRect 偏移
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3900 + Math.floor(Math.random() * 500);
const CDP_PORT = 4900 + Math.floor(Math.random() * 500);
const USER_DATA = path.join(os.tmpdir(), 'mn-probe-' + Date.now());

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
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
  send(method, params) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, '--no-first-run', '--window-size=1280,800',
    '--hide-scrollbars', 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80 && !up; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) up = true; } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('CDP 连不上');
    const info = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' })).json();
    const t = new CDP(info.webSocketDebuggerUrl);
    await t.connect();
    await t.send('Page.enable');
    await t.send('Runtime.enable');

    await t.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/community-hub.html' });
    await waitFor(t, "document.querySelectorAll('[data-guest-like]').length >= 1", 20000, 'hub 渲染');
    await t.evalJs("document.fonts.ready.then(function(){})");
    await waitFor(t, "document.fonts.check('16px \"Material Symbols Outlined\"')", 15000, '字体加载');

    // ── A) FILL 轴像素实证（矩阵：wght 100 vs 700 验 canvas 变体管道可用；FILL 0 vs 1 验字体是否有 FILL 轴） ──
    const px = await t.evalJs("(() => {" +
      " function count(vs, name) {" +
      "   var c = document.createElement('canvas'); c.width = 200; c.height = 200;" +
      "   var x = c.getContext('2d');" +
      "   x.font = '160px \"Material Symbols Outlined\"';" +
      "   if (vs !== null) x.fontVariationSettings = vs;" +
      "   x.fillStyle = '#000'; x.textBaseline = 'middle'; x.textAlign = 'center';" +
      "   x.fillText(name, 100, 108);" +
      "   var d = x.getImageData(0, 0, 200, 200).data, n = 0;" +
      "   for (var i = 3; i < d.length; i += 4) if (d[i] > 40) n++;" +
      "   return n;" +
      " }" +
      " return {" +
      "   w100: count(\"'wght' 100\", 'favorite'), w700: count(\"'wght' 700\", 'favorite')," +
      "   favF0: count(\"'FILL' 0\", 'favorite'), favF1: count(\"'FILL' 1\", 'favorite')," +
      "   favFull: count(\"'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24\", 'favorite')," +
      "   borderF0: count(\"'FILL' 0\", 'favorite_border')," +
      "   favDefault: count(null, 'favorite')" +
      " };" +
      "})()");
    console.log('像素计数:', JSON.stringify(px));
    console.log(px.favF1 > px.favF0 * 2.5 ? '✅ FILL 轴有效：FILL 1 是实心（FILL 0 是空心）' : '❌ FILL 轴无效或字体不支持');
    console.log(Math.abs(px.favF0 - px.borderF0) < px.favF0 * 0.1 ? '✅ 实锤：favorite 与 favorite_border 在 FILL 0 下渲染相同（图标换了等于没换）' : '⚠ favorite 与 favorite_border 渲染不同');

    // ── A2) liked 态 computed font-variation-settings ──
    const fvs = await t.evalJs("(() => {" +
      " var b = document.querySelector('[data-guest-like]');" +
      " b.classList.add('liked');" +
      " var v = getComputedStyle(b.querySelector('.material-symbols-outlined')).fontVariationSettings;" +
      " b.classList.remove('liked');" +
      " return v;" +
      "})()");
    console.log('liked 态 font-variation-settings =', JSON.stringify(fvs), fvs === 'normal' ? '→ FILL 未开启（默认 0 空心）' : '');

    // ── B) 粒子原点几何 ──
    const geo = await t.evalJs("(() => {" +
      " var b = document.querySelector('[data-guest-like]');" +
      " var s = document.createElement('span'); s.className = 'like-burst'; s.setAttribute('aria-hidden', 'true');" +
      " b.appendChild(s);" +
      " b.classList.add('liked', 'like-pop');" +
      " var br = b.querySelector('.material-symbols-outlined').getBoundingClientRect();" +
      " var sr = s.getBoundingClientRect();" +
      " var out = { iconCX: br.left + br.width / 2, iconCY: br.top + br.height / 2," +
      "   burstCX: sr.left + sr.width / 2, burstCY: sr.top + sr.height / 2," +
      "   iconW: br.width, btnW: b.getBoundingClientRect().width };" +
      " out.dx = out.burstCX - out.iconCX; out.dy = out.burstCY - out.iconCY;" +
      " b.classList.remove('liked', 'like-pop'); b.removeChild(s);" +
      " return out;" +
      "})()");
    console.log('几何:', JSON.stringify(geo));
    console.log('粒子原点偏移: dx=' + geo.dx.toFixed(1) + 'px dy=' + geo.dy.toFixed(1) + 'px（相对爱心中心）');

    await t.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
