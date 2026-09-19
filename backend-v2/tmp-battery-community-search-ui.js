// tmp-battery-community-search-ui.js — v0.2.11.1 Community 搜索胶囊 UI 适配电池（2026-09-03）
// 用户：「Community 页顶部的输入框的Ui能不能做适配」→钦定「就只是Ui适配 和手机无关」。
// 断言口径：读 computed（transition 0.2s → 状态切换后 sleep 300ms 过过渡再读）；鼠标用 CDP 真输入
//   （hover 真鼠标移入、focus 真点击输入框）。跑法：node tmp-battery-community-search-ui.js
//   （LIVE_BASE=<完整站点 URL> 跑线上）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3900 + Math.floor(Math.random() * 500);
const CDP_PORT = 4900 + Math.floor(Math.random() * 500);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-' + Date.now());

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => {
        if (e2) {
          // 根级没有 → docs/pages/ 回退（线上没有此回退——线上社区页 canonical URL 就是 /pages/community-hub，
          // entrypoint 按 docs/ 布局直接服务 docs/pages/community-hub.html；本壳只是镜像该布局）
          fs.readFile(path.join(DOCS, 'pages', f + '.html'), (e3, b3) => {
            if (e3) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b3);
          });
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b2);
      });
      return;
    }
    if (err) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method) {
        const ls = this.listeners.get(m.method);
        if (ls) ls.forEach(fn => fn(m.params));
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
  on(method, fn) { if (!this.listeners.has(method)) this.listeners.set(method, []); this.listeners.get(method).push(fn); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || 'exception'));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('waitFor 超时: ' + label);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const pass = [], fail = [];
function check(name, cond, detail) {
  const line = (cond ? '  ✅ ' : '  ❌ ') + name + (detail ? '（' + detail + '）' : '');
  console.log(line);
  (cond ? pass : fail).push(line);
}
async function nav(t, url) { await t.send('Page.navigate', { url }); await sleep(900); }

const CAP = "document.querySelector('.search-capsule')";
const STYLE = "(() => { const c = " + CAP + "; if (!c) return null; const cs = getComputedStyle(c);" +
  " return { bg: cs.backgroundColor, bd: cs.borderColor, sh: cs.boxShadow } })()";

async function main() {
  const LIVE = process.env.LIVE_BASE || '';
  const BASE = LIVE || ('http://127.0.0.1:' + PORT);
  if (!LIVE) server.listen(PORT);
  let chromePath = null;
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {}
    await sleep(250);
  }
  const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' });
  const info = await r.json();
  const t = new CDP(info.webSocketDebuggerUrl);
  await t.connect();
  await t.send('Page.enable');
  await t.send('Runtime.enable');
  const errs = [];
  t.on('Runtime.exceptionThrown', p => {
    const d = (p.exceptionDetails.exception && p.exceptionDetails.exception.description) || 'exc';
    if (d.indexOf('data:') === -1) errs.push(d);
  });
  t.on('Log.entryAdded', p => {
    if (p.entry.level === 'error' && p.entry.url && p.entry.url.indexOf('/api/') === -1 &&
        p.entry.url.indexOf('data:') === -1 && p.entry.url.indexOf('favicon') === -1) errs.push(p.entry.text);
  });
  await t.send('Log.enable');

  console.log('── U. Community 搜索胶囊 UI 适配 ──');
  // 社区页线上 canonical URL = /pages/community-hub（docs/pages/ 布局）；本地壳同路径直通
  await nav(t, BASE + '/pages/community-hub');
  await t.evalJs("localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true }))");
  await nav(t, BASE + '/pages/community-hub');
  await waitFor(t, CAP, 15000, 'capsule boot');

  // U1 版本
  const ver = await t.evalJs('window.MN_SITE_VERSION');
  check('U1 版本 v0.2.11.1', ver === 'v0.2.11.1', 'ver=' + ver);

  // U2 常态：底=--input-bg（0.6 白）非 focus 底、描边非品牌蓝
  const n0 = await t.evalJs(STYLE);
  check('U2 常态底 --input-bg + 描边非品牌蓝',
    n0 && n0.bg.indexOf('0.6') !== -1 && n0.bd.indexOf('70, 72, 212') === -1,
    JSON.stringify(n0));

  // U3 悬停（真鼠标移入中心，等 0.2s 过渡）→ 品牌蓝半透描边 + 底提亮 0.85
  const ctr = await t.evalJs("(() => { const r = " + CAP + ".getBoundingClientRect();" +
    " return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()");
  await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: ctr.x, y: ctr.y });
  await sleep(300);
  const h0 = await t.evalJs(STYLE);
  check('U3 悬停品牌蓝描边 rgba(70,72,212,0.45) + 底提亮',
    h0 && h0.bd.indexOf('70, 72, 212') !== -1 && h0.bg.indexOf('0.85') !== -1,
    JSON.stringify(h0));

  // U4 聚焦（真点击输入框）→ 品牌蓝实描边 + 0.1 蓝环 + 图标转品牌蓝；点别处失焦还原
  await t.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: ctr.x, y: ctr.y, button: 'left', clickCount: 1 });
  await t.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: ctr.x, y: ctr.y, button: 'left', clickCount: 1 });
  await sleep(300);
  const f0 = await t.evalJs(STYLE);
  const ic = await t.evalJs("getComputedStyle(document.querySelector('.search-capsule .material-symbols-outlined')).color");
  check('U4 聚焦品牌蓝实描边 + 0.1 蓝环 + 图标品牌蓝',
    f0 && f0.bd === 'rgb(70, 72, 212)' && f0.sh.indexOf('rgba(70, 72, 212, 0.1)') !== -1 && ic === 'rgb(70, 72, 212)',
    JSON.stringify(f0) + ' icon=' + ic);
  await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 40, y: 500 });
  await t.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 40, y: 500, button: 'left', clickCount: 1 });
  await t.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 40, y: 500, button: 'left', clickCount: 1 });
  await sleep(300);
  const b0 = await t.evalJs(STYLE);
  check('U4 失焦还原常态（描边非品牌蓝 + 底回 0.6）',
    b0 && b0.bd.indexOf('70, 72, 212') === -1 && b0.bg.indexOf('0.6') !== -1,
    JSON.stringify(b0));

  check('U5 全程 0 console error', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log('\n' + pass.length + ' ✅ / ' + fail.length + ' ❌');
  t.close();
  chrome.kill();
  process.exit(fail.length ? 1 : 0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
