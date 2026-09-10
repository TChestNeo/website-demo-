// tmp-outline-src-scan.js — 一次性侦查：侧栏元素 outline:3px currentColor 的规则来源
// （2026-09-10 阴影扫描发现每个元素都有 outline:3px 且颜色=元素文字色，静态 CSS 里查无此规则
//   → 必是运行时注入；本探针走查全部 stylesheet 找 outline 规则 + 打印 style 标签清单）
// 跑法：node tmp-outline-src-scan.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4400 + Math.floor(Math.random() * 300);
const CDP_PORT = 5400 + Math.floor(Math.random() * 300);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-outsrc-' + Date.now());

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
      // 1) 所有 style 标签清单
      const styles = Array.from(document.querySelectorAll('style')).map((s) => ({
        id: s.id || '(无id)', len: s.textContent.length,
        head: s.textContent.slice(0, 120).replace(/\\n/g, ' ')
      }));
      // 2) 所有含 outline 的规则
      for (let i = 0; i < document.styleSheets.length; i++) {
        const sh = document.styleSheets[i];
        const src = sh.href || (sh.ownerNode && (sh.ownerNode.id || sh.ownerNode.tagName + '(无id)')) || '?';
        let rules;
        try { rules = sh.cssRules; } catch (e) { out.push('UNREADABLE ' + src); continue; }
        const walk = (list) => {
          for (let j = 0; j < list.length; j++) {
            const r = list[j];
            if (r.cssRules) { walk(r.cssRules); continue; }
            if (r.cssText && r.cssText.indexOf('outline') !== -1) {
              out.push('[' + src + '] ' + r.selectorText + ' { ' + r.style.outline + ' ' + r.style.outlineWidth + ' ' + r.style.outlineColor + ' }');
            }
          }
        };
        walk(rules);
      }
      // 3) 样本元素 computed
      const el = document.querySelector('.sidebar-module');
      const cs = getComputedStyle(el);
      return JSON.stringify({
        styleCount: styles.length,
        styles: styles,
        outlineRules: out,
        sample: { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor, offset: cs.outlineOffset }
      });
    })()`);
    const res = JSON.parse(scan);
    console.log('style 标签数 =', res.styleCount);
    res.styles.forEach((s, i) => console.log('style[' + i + '] id=' + s.id, 'len=' + s.len, '→', s.head.slice(0, 100)));
    console.log('--- 含 outline 的规则 ---');
    if (!res.outlineRules.length) console.log('（无）');
    res.outlineRules.forEach((r) => console.log(r));
    console.log('--- 样本 .sidebar-module computed outline ---', JSON.stringify(res.sample));
  } catch (e) {
    console.error('ERR', e);
  } finally {
    cdp.close();
    chrome.kill();
    server.close();
    process.exit(0);
  }
})();
