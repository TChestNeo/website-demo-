// tmp-sidebar-scan.js — 一次性侦查：暗色模式下左侧栏（#slati-sidebar）内所有「亮色元素」清单
// （2026-09-10 用户「深色模式下左侧菜单内有一个亮色的长方形能隐藏他吗」——真身定位用）
// 跑法：node tmp-sidebar-scan.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4400 + Math.floor(Math.random() * 300);
const CDP_PORT = 5400 + Math.floor(Math.random() * 300);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-sidescan-' + Date.now());

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
  const pageInfo = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' })).json();
  const cdp = new CDP(pageInfo.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  try {
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/community-hub.html' });
    await waitFor(cdp, "document.getElementById('slati-sidebar') && document.getElementById('slati-sidebar').innerHTML.length > 0", 10000, '侧栏渲染');
    await cdp.evalJs(`(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('slati_settings', JSON.stringify({ theme: 'dark' })); } catch (e) {}
    })()`);
    await sleep(600);

    const scan = await cdp.evalJs(`(() => {
      const out = [];
      const root = document.getElementById('slati-sidebar');
      const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const parse = (s) => {
        const m = s.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/);
        return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
      };
      root.querySelectorAll('*').forEach((el) => {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const c = parse(cs.backgroundColor);
        let l = -1, src = 'none';
        if (c && c.a > 0) { l = lum(c.r, c.g, c.b); src = 'bg:' + cs.backgroundColor; }
        if (cs.backgroundImage && cs.backgroundImage !== 'none') {
          src = (src === 'none' ? '' : src + ' | ') + 'img:' + cs.backgroundImage.slice(0, 90);
          const m = cs.backgroundImage.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)/);
          if (m && lum(+m[1], +m[2], +m[3]) > l) l = lum(+m[1], +m[2], +m[3]);
        }
        if (l >= 55 && rect.width > 30 && rect.height > 12) {
          out.push({ l: +l.toFixed(1), w: Math.round(rect.width), h: Math.round(rect.height),
            tag: el.tagName.toLowerCase(), cls: (el.className && String(el.className).slice(0, 60)) || '', src: src.slice(0, 150) });
        }
      });
      // 附：页面暗色令牌值 + 亮色模式对照（同一元素亮色下亮度）
      return JSON.stringify({
        darkBg: getComputedStyle(document.body).backgroundColor,
        cardBg: getComputedStyle(root.querySelector('.sidebar-module') || document.body).backgroundColor,
        bright: out
      });
    })()`);
    const res = JSON.parse(scan);
    console.log('暗色 body bg =', res.darkBg);
    console.log('暗色 sidebar-module bg =', res.cardBg);
    console.log('--- 侧栏内亮度 ≥55 的元素（w>30,h>12）---');
    if (!res.bright.length) console.log('（无）');
    res.bright.forEach((e) => console.log('L=' + e.l, e.w + '×' + e.h, '<' + e.tag + ' class="' + e.cls + '">', e.src));
  } catch (e) {
    console.error('ERR', e);
  } finally {
    cdp.close();
    chrome.kill();
    server.close();
    process.exit(0);
  }
})();
