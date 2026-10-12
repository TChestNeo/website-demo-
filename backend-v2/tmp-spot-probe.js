// tmp-spot-probe.js — overview Story 卡聚光灯 CDP 断言（2026-09-10）
// 用户口径：入口卡亮光换成 SpotlightCard 组件语义——::before 白色径向光斑跟随指针，
// 悬停/聚焦才亮（opacity .6，0.5s 淡入），mousemove 写 --mouse-x/--mouse-y/--spotlight-color。
// A1 卡片与 ::before 光斑层在场；A2 悬停前光熄灭；
// A3 指针到卡中心 → --mouse-x/--mouse-y = 指针坐标 + 光 opacity .6 + --spotlight-color 0.25；
// A4 悬停时卡片自身 opacity 恒 1（全局 a:hover 变淡已覆盖）；
// A5 移出 → 光熄灭；Z 全程零 console error。
// 跑法：node tmp-spot-probe.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3910 + Math.floor(Math.random() * 400);
const CDP_PORT = 4910 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-spot-' + Date.now());

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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.listeners = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.errs.push(m.params.exceptionDetails.text || 'exception');
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + r.exceptionDetails.text);
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
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name); } };

  await new Promise(r => server.listen(PORT, r));
  let chromePath = null;
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
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
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/overview.html' });
    await waitFor(cdp, "document.querySelector('.story-spot')", 10000, 'Story 卡出现');
    // 摘掉访客门禁（mn-guest 会 display:none 整个 app-main）——模拟已登录视角测卡片本身
    await cdp.evalJs("document.documentElement.classList.remove('mn-guest'); true");

    const rect = await cdp.evalJs(`(() => { const r = document.querySelector('.story-spot').getBoundingClientRect(); return { left: r.left, top: r.top, w: r.width, h: r.height }; })()`);
    const cx = rect.left + rect.w / 2, cy = rect.top + rect.h / 2;

    ok('A1 卡片与 ::before 光斑层在场（径向渐变）', await cdp.evalJs("(() => { var c = document.querySelector('.story-spot');" +
      " return !!c && getComputedStyle(c, '::before').backgroundImage.indexOf('radial-gradient') !== -1; })()"));
    ok('A2 悬停前光熄灭 (::before opacity 0)', await cdp.evalJs("parseFloat(getComputedStyle(document.querySelector('.story-spot'), '::before').opacity) === 0"));

    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
    await waitFor(cdp, "parseFloat(getComputedStyle(document.querySelector('.story-spot'), '::before').opacity) > 0.55", 3000, '光亮起到 .6');
    const mx = await cdp.evalJs("parseFloat(getComputedStyle(document.querySelector('.story-spot')).getPropertyValue('--mouse-x'))");
    const my = await cdp.evalJs("parseFloat(getComputedStyle(document.querySelector('.story-spot')).getPropertyValue('--mouse-y'))");
    const sc = await cdp.evalJs("getComputedStyle(document.querySelector('.story-spot')).getPropertyValue('--spotlight-color').trim()");
    ok('A3 光跟随指针 (--mouse-x/--mouse-y = 卡中心坐标) + 悬停亮 .6 + spotlight-color 0.25',
      Math.abs(mx - rect.w / 2) < 2 && Math.abs(my - rect.h / 2) < 2 && sc === 'rgba(255, 255, 255, 0.25)');
    ok('A4 悬停时卡片不整卡变淡 (opacity 1)', await cdp.evalJs("parseFloat(getComputedStyle(document.querySelector('.story-spot')).opacity) === 1"));

    // 指针挪到卡内另一点——光心跟着走
    const nx = rect.left + rect.w * 0.2, ny = rect.top + rect.h * 0.3;
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: nx, y: ny });
    await sleep(120);
    const mx2 = await cdp.evalJs("parseFloat(getComputedStyle(document.querySelector('.story-spot')).getPropertyValue('--mouse-x'))");
    const my2 = await cdp.evalJs("parseFloat(getComputedStyle(document.querySelector('.story-spot')).getPropertyValue('--mouse-y'))");
    ok('A3b 光心随指针移动', Math.abs(mx2 - (nx - rect.left)) < 2 && Math.abs(my2 - (ny - rect.top)) < 2);

    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
    await waitFor(cdp, "parseFloat(getComputedStyle(document.querySelector('.story-spot'), '::before').opacity) < 0.05", 3000, '光熄灭');
    ok('A5 移出后光熄灭', true);
    ok('Z 零 console error', cdp.errs.length === 0);
  } catch (e) {
    fail++;
    console.log('  ❌ 异常: ' + e.message);
  }

  console.log('\n结果: ' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  cdp.close();
  chrome.kill();
  server.close();
  process.exit(fail ? 1 : 0);
})();
