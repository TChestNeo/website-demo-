// tmp-probe-imgsearch.js — 探针 v2：完全复刻电池 T11→T12 序列（含查询词后缀），看第二次搜索
// 坏图格为何不隐去（不暂存）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4995, CDP_PORT = 5995;
const USER_DATA = path.join(os.tmpdir(), 'mn-imgsrch-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
let hits = [];
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  hits.push(req.url.slice(0, 80));
  if (p === '/commons-api') {
    const host = req.headers.host;
    const qs = Object.fromEntries(req.url.split('?')[1].split('&').map(function (kv) { const p2 = kv.split('='); return [p2[0], decodeURIComponent(p2[1] || '')]; }));
    const suffix = qs.gsrsearch === 'emblem' ? '-2' : '';
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ query: { pages: {
      '100': { pageid: 100, index: 2, title: 'File:Crown.svg', imageinfo: [{ thumburl: 'http://' + host + '/commons-thumb1' + suffix + '.png' }] },
      '101': { pageid: 101, index: 1, title: 'File:Broken.png', imageinfo: [{ thumburl: 'http://' + host + '/commons-broken' + suffix + '.png' }] }
    } } }));
    return;
  }
  if (p.indexOf('/commons-thumb') === 0) { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(PNG); return; }
  if (p.indexOf('/commons-broken') === 0) { res.writeHead(404); res.end(); return; }
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') { fs.readFile(file + '.html', (e2, b2) => { if (e2) { res.writeHead(404); res.end(); return; } res.writeHead(200); res.end(b2); }); return; }
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); }
      else if (m.method === 'Runtime.exceptionThrown') this.errs.push(JSON.stringify((m.exceptionDetails || {}).text || '').slice(0, 300));
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej, method }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text)); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(120);
  }
  throw new Error('waitFor 超时: ' + label);
}
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version')).ok) break; } catch (e) {} await sleep(250); }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const cdp = new CDP(pages.find(x => x.type === 'page').webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}' });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "typeof window.createContentCard === 'function'", 20000, 'load');
    await sleep(600);
    await cdp.evalJs("(function(){ window.__caret = function(cc){ var txc = cc.querySelector('.card-text-content'); txc.textContent = 'Hello world'; var r = document.createRange(); r.setStart(txc.firstChild, 1); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); txc.focus(); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); }; window.__click = function(sel){ var b = document.querySelector(sel); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); }; window.FC_IMG_SEARCH_API = location.origin + '/commons-api'; return true; })()");
    const search = (q) => cdp.evalJs("(function(){ var inp = document.getElementById('ttImgSearch'); inp.value = " + JSON.stringify(q) + "; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true; })()");
    const dump = (label) => cdp.evalJs("(function(){ var ts = document.querySelectorAll('#ttImgGrid .tim-thumb-tile'); return JSON.stringify({ popActive: document.getElementById('ttImgPop').classList.contains('active'), head: document.getElementById('ttImgHead').textContent, imgs: Array.prototype.slice.call(ts).map(function (b) { var im = b.querySelector('img'); return { disp: b.style.display, complete: im.complete, nw: im.naturalWidth, src: (im.src || '').slice(-26) }; }) }); })()").then(r => console.log('  [' + label + ']', r));

    // T11 等价：卡1 光标 → 开弹层 → 搜索 slati crown
    await cdp.evalJs("(function(){ var cc = window.createContentCard(0, 14, 8, 4); window.__caret(cc); return true; })()");
    await waitFor(cdp, "document.getElementById('textToolbar').style.display !== 'none'", 3000, 'T11 show');
    await cdp.evalJs("window.__click('#ttImgBtn'); true");
    await waitFor(cdp, "document.getElementById('ttImgPop').classList.contains('active')", 3000, 'T11 pop');
    await search('slati crown');
    await waitFor(cdp, "document.querySelectorAll('#ttImgGrid .tim-thumb-tile').length === 2", 5000, 'T11 tiles');
    await waitFor(cdp, "document.querySelectorAll('#ttImgGrid .tim-thumb-tile[style*=\"display: none\"]').length >= 1", 4000, 'T11 hidden');
    await dump('search #1 (slati crown)');
    await cdp.evalJs("window.__click('#ttImgClear'); true");
    await dump('清除后');

    // T12 等价：Escape → 新卡光标 → 开弹层 → focus 搜索框 → 搜索 emblem
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
    await sleep(300);
    await cdp.evalJs("(function(){ var cc = window.createContentCard(0, 34, 8, 4); window.__caret(cc); return true; })()");
    await waitFor(cdp, "document.getElementById('textToolbar').style.display !== 'none'", 3000, 'T12 show');
    await cdp.evalJs("window.__click('#ttImgBtn'); true");
    await waitFor(cdp, "document.getElementById('ttImgPop').classList.contains('active')", 3000, 'T12 pop');
    await dump('T12 开弹层后');
    await cdp.evalJs("(function(){ var inp = document.getElementById('ttImgSearch'); inp.focus(); return true; })()");
    await sleep(300);
    await dump('T12 focus 输入框后');
    await search('emblem');
    await waitFor(cdp, "document.querySelectorAll('#ttImgGrid .tim-thumb-tile').length === 2", 5000, 'T12 tiles');
    await sleep(1500);
    await dump('search #2 (emblem) 后 1.5s');
    await sleep(3000);
    await dump('search #2 再等 3s');
    console.log('  请求记录:', JSON.stringify(hits.filter(h => h.indexOf('commons') !== -1)));
    console.log('  errs:', JSON.stringify(cdp.errs));
    await cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('PROBE FAIL:', e.message); process.exit(1); });
