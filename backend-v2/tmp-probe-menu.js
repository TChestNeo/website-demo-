// tmp-probe-menu.js — 右键菜单跑到下方 bug 实证探针（2026-09-03）
// 读 #contextMenu 计算样式 + 祖先包含块扫描 + 派发 contextmenu 事件看落点
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
        if (e2) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
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

async function main() {
  server.listen(PORT);
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
  t.on('Runtime.exceptionThrown', p => { errs.push((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || 'exc'); });

  // 登录态（编辑器有未登录门禁）——先落 localStorage 再导航，避免被门禁送返
  await t.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/index.html' });
  await sleep(600);
  await t.evalJs("localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true }))");
  await t.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/fluidcanvas-editor.html' });
  try {
    await waitFor(t, "document.querySelector('#contextMenu') && document.readyState==='complete'", 20000, 'editor boot');
  } catch (e) {
    console.log('诊断:', await t.evalJs("JSON.stringify({url: location.href, rs: document.readyState, guest: document.documentElement.className, hasMenu: !!document.querySelector('#contextMenu')})"));
    throw e;
  }

  const info1 = await t.evalJs(`(() => {
    const m = document.getElementById('contextMenu');
    const cs = getComputedStyle(m);
    // 祖先包含块扫描：transform/filter/backdrop-filter/will-change/contain 会劫持 fixed
    const bad = [];
    let a = m.parentElement;
    while (a && a !== document.documentElement) {
      const acs = getComputedStyle(a);
      if (acs.transform !== 'none' || acs.filter !== 'none' || (acs.backdropFilter && acs.backdropFilter !== 'none') || acs.willChange !== 'auto' || (acs.contain && acs.contain !== 'none')) {
        bad.push({ tag: a.tagName, id: a.id, cls: a.className, t: acs.transform, f: acs.filter, bf: acs.backdropFilter, wc: acs.willChange, c: acs.contain });
      }
      a = a.parentElement;
    }
    return {
      position: cs.position, zIndex: cs.zIndex, display: cs.display,
      cls: m.className, hasLayers: !!m.querySelector('.lg-backdrop'),
      parent: m.parentElement.tagName + '.' + m.parentElement.className,
      badAncestors: bad
    };
  })()`);
  console.log('静止态:', JSON.stringify(info1, null, 1));

  // 建卡后对卡派发 contextmenu（编辑器菜单监听挂在卡/cv 上，不是 document）
  await t.evalJs("window.createContentCard(2, 2, 6, 6); 1");
  await sleep(600);
  const cardInfo = await t.evalJs(`(() => {
    const c = document.querySelector('.grid-card');
    if (!c) return 'no-card';
    const r = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: Math.round(r.left + r.width / 2), clientY: Math.round(r.top + r.height / 2) }));
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  console.log('卡右键坐标:', JSON.stringify(cardInfo));
  await sleep(400);
  const info2 = await t.evalJs(`(() => {
    const m = document.getElementById('contextMenu');
    const cs = getComputedStyle(m);
    const rect = m.getBoundingClientRect();
    return { position: cs.position, zIndex: cs.zIndex, display: cs.display, active: m.classList.contains('active'), left: cs.left, top: cs.top, rect: { l: rect.left, t: rect.top, r: rect.right, b: rect.bottom } };
  })()`);
  console.log('右键后:', JSON.stringify(info2, null, 1));

  // 也直接测点击路径：mousedown 走编辑器卡上右键的真实事件流
  await t.evalJs("window.hideContextMenu ? hideContextMenu() : 0");
  await t.evalJs(`(() => {
    // 编辑器卡右键由 mousedown(button===2) 触发（大概率）——直接对 body 派发
    const e = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 2, buttons: 2, clientX: 500, clientY: 300 });
    document.body.dispatchEvent(e);
    return 1;
  })()`);
  await sleep(400);
  const info3 = await t.evalJs(`(() => {
    const m = document.getElementById('contextMenu');
    const cs = getComputedStyle(m);
    const rect = m.getBoundingClientRect();
    return { position: cs.position, display: cs.display, active: m.classList.contains('active'), rect: { l: rect.left, t: rect.top, r: rect.right, b: rect.bottom } };
  })()`);
  console.log('mousedown 右键后:', JSON.stringify(info3, null, 1));

  console.log('console errors:', errs.length);

  // ── MRE 覆盖层几何探针：blanket 把 .mre-side 的 backdrop-filter 干掉了，
  //    它曾是 #mrePanel absolute 定位的包含块（mrePanelOrigin 注释明言）
  const mre = await t.evalJs(`(() => {
    const ov = document.getElementById('mapRegionOverlay');
    ov.classList.add('active');
    const side = document.querySelector('.mre-side');
    const panel = document.getElementById('mrePanel');
    const sideCs = getComputedStyle(side);
    const panelCs = getComputedStyle(panel);
    panel.classList.add('active');
    const pr = panel.getBoundingClientRect();
    const sr = side.getBoundingClientRect();
    const sh = document.querySelector('.mre-shell').getBoundingClientRect();
    return {
      sideBf: sideCs.backdropFilter, sidePos: sideCs.position,
      sideRect: { l: Math.round(sr.left), t: Math.round(sr.top), r: Math.round(sr.right), b: Math.round(sr.bottom) },
      shellRect: { l: Math.round(sh.left), t: Math.round(sh.top), r: Math.round(sh.right), b: Math.round(sh.bottom) },
      panelRect: { l: Math.round(pr.left), t: Math.round(pr.top), r: Math.round(pr.right), b: Math.round(pr.bottom) },
      panelOffsetParent: panel.offsetParent ? panel.offsetParent.className : null,
      panelPos: panelCs.position, panelTop: panelCs.top, panelBottom: panelCs.bottom
    };
  })()`);
  console.log('MRE 几何:', JSON.stringify(mre, null, 1));

  // 对照：手动恢复 .mre-side 的 backdrop-filter（模拟修复后）
  const mre2 = await t.evalJs(`(() => {
    const side = document.querySelector('.mre-side');
    side.style.backdropFilter = 'blur(32px)';
    side.style.webkitBackdropFilter = 'blur(32px)';
    const panel = document.getElementById('mrePanel');
    const pr = panel.getBoundingClientRect();
    return {
      panelRectRestored: { l: Math.round(pr.left), t: Math.round(pr.top), r: Math.round(pr.right), b: Math.round(pr.bottom) },
      offsetParentRestored: panel.offsetParent ? panel.offsetParent.className : null
    };
  })()`);
  console.log('恢复 backdrop-filter 后:', JSON.stringify(mre2, null, 1));

  console.log('console errors:', errs.length);
  t.close();
  chrome.kill();
  server.close();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
