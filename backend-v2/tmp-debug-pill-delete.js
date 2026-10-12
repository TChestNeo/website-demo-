// tmp-debug-pill-delete.js — B6 删除 tap 落点调试（临时，不入 commit）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4955;
const CDP_PORT = 5955;
const USER_DATA = path.join(os.tmpdir(), 'mn-dbg-pilldel-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
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
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
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

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
    await sleep(250);
  }
  if (!up) throw new Error('Chrome CDP 未就绪');
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  const page = pages.find(x => x.type === 'page');
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Page.bringToFront');
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 834, height: 1194, deviceScaleFactor: 2, mobile: true });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
  });
  await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
  await waitFor(cdp, "!!document.getElementById('gridCanvas') && !!window.createSneCard && !!window.__fcTouch", 20000, '加载');
  await sleep(700);

  const tch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type: type, touchPoints: pts });
  const tpoint = (id, x, y) => ({ x: Math.round(x), y: Math.round(y), radiusX: 2, radiusY: 2, force: 1, id: id });
  const tapAt = async (x, y) => { await tch('touchStart', [tpoint(0, x, y)]); await sleep(50); await tch('touchEnd', []); await sleep(120); };
  const holdTouch = async (x, y, ms) => { await tch('touchStart', [tpoint(0, x, y)]); await sleep(ms); await tch('touchEnd', []); await sleep(120); };
  const cardPoint = () => cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card');" +
    " if (!c) return null; var r = c.getBoundingClientRect();" +
    " var bad = 'input, textarea, select, button, a, [contenteditable=\"true\"], .card-text-content, .card-edit-field, .card-label, .resize-handle, .rotate-grip, .sheet-col-grip, .sheet-row-grip';" +
    " for (var fy = 0.2; fy <= 0.85; fy += 0.15) for (var fx = 0.2; fx <= 0.85; fx += 0.15) {" +
    "  var el = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);" +
    "  if (el && el.closest('.grid-card') === c && !el.closest(bad)) return { x: Math.round(r.left + r.width * fx), y: Math.round(r.top + r.height * fy) };" +
    " } return null; })()");

  await cdp.evalJs('window.createSneCard(2, 2, 9, 12)');
  await sleep(200);
  const pt = await cardPoint();
  console.log('cardPoint:', JSON.stringify(pt));
  await holdTouch(pt.x, pt.y, 650);
  await sleep(500);
  const info = await cdp.evalJs(`(function(){
    var m = document.querySelector('.context-menu');
    var d = document.querySelector('.context-menu .context-menu-item.danger');
    var p = document.querySelector('.asset-panel');
    var dr = d.getBoundingClientRect();
    var mr = m.getBoundingClientRect();
    var pr = p.getBoundingClientRect();
    var cs = getComputedStyle(m);
    var dcs = getComputedStyle(d);
    var cx = dr.left + dr.width / 2, cy = dr.top + dr.height / 2;
    var el = document.elementFromPoint(cx, cy);
    var desc = function(e){ if(!e) return 'null'; var t=e.tagName;
      if(e.classList && e.classList.length) t += '.' + Array.from(e.classList).join('.');
      return t; };
    var chain = [];
    var cur = el; while (cur && chain.length < 6) { chain.push(desc(cur)); cur = cur.parentElement; }
    var anc = []; cur = m; while (cur && anc.length < 8) {
      var c2 = getComputedStyle(cur);
      anc.push(desc(cur) + ' pos:' + c2.position + ' tf:' + c2.transform.slice(0, 30) + ' of:' + c2.overflow + ' oy:' + c2.overflowY);
      cur = cur.parentElement;
    }
    var itemRects = [];
    var items = m.querySelectorAll('.context-menu-item');
    for (var i = 0; i < items.length; i++) {
      var ir = items[i].getBoundingClientRect();
      itemRects.push({ i: i, disp: getComputedStyle(items[i]).display, t: ir.top, h: ir.height, txt: (items[i].textContent || '').slice(0, 12) });
    }
    return {
      menuOpen: getComputedStyle(m).display !== 'none',
      menuCS: { display: cs.display, pos: cs.position, h: cs.height, maxH: cs.maxHeight, ofY: cs.overflowY, tf: cs.transform, anim: cs.animationName, flex: cs.display },
      menuRect: { l: mr.left, t: mr.top, w: mr.width, h: mr.height },
      mScroll: { oh: m.offsetHeight, sh: m.scrollHeight, ch: m.clientHeight },
      dangerRect: { l: dr.left, t: dr.top, w: dr.width, h: dr.height },
      dangerCS: { pos: dcs.position, disp: dcs.display, tf: dcs.transform },
      panelRect: { l: pr.left, t: pr.top, w: pr.width, h: pr.height },
      panelScroll: p.scrollTop, panelScrollH: p.scrollHeight, panelClientH: p.clientHeight,
      tapPt: { x: cx, y: cy }, atPoint: chain.join(' > '),
      ancestors: anc, itemRects: itemRects,
      cardsBefore: document.querySelectorAll('#gridCanvas .grid-card').length,
      dangerTopOffset: d.offsetTop
    };
  })()`);
  console.log('info:', JSON.stringify(info, null, 1));
  await tapAt(info.tapPt.x, info.tapPt.y);
  await sleep(400);
  const after = await cdp.evalJs(`(function(){
    var m = document.querySelector('.context-menu');
    return { cards: document.querySelectorAll('#gridCanvas .grid-card').length,
      menuOpen: !!m && getComputedStyle(m).display !== 'none',
      types: Array.from(document.querySelectorAll('#gridCanvas .grid-card')).map(function(c){ return c.dataset.cardType; }) };
  })()`);
  console.log('after:', JSON.stringify(after));
  cdp.close();
  server.close();
  try { chrome.kill(); } catch (e) {}
  process.exit(0);
})();
