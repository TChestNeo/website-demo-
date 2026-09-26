// tmp-probe-imglib-dupe.js — 内联图草稿往返是否翻倍探针（S10b 真凶定位）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-dupe-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
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
        this.errs.push(JSON.stringify((m.exceptionDetails || {}).text || '').slice(0, 200));
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
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "typeof window.createFlagCard === 'function'", 20000, 'load');
    await sleep(600);
    await cdp.evalJs("(function(){ " +
      "window.__upFile = function(inputExpr, color, w, h, name){ return new Promise(function(res){ " +
      "var el = typeof inputExpr === 'string' ? document.querySelector(inputExpr) : inputExpr; if (!el) { res(false); return; } " +
      "var cv = document.createElement('canvas'); cv.width = w; cv.height = h; " +
      "var cx = cv.getContext('2d'); cx.fillStyle = color; cx.fillRect(0, 0, w, h); " +
      "cv.toBlob(function(blob){ var file = new File([blob], name, { type: 'image/png' }); " +
      "var dt = new DataTransfer(); dt.items.add(file); el.files = dt.files; " +
      "el.dispatchEvent(new Event('change', { bubbles: true })); res(true); }, 'image/png'); }); };" +
      "window.__fillMeta = function(name, desc, vis){ document.getElementById('immName').value = name; " +
      "document.getElementById('immDesc').value = desc; window.imgMetaRefreshCount(); " +
      "if (vis) window.imgMetaSetVisibility(vis); return true; };" +
      "window.__caretInContent = function(cc){ var txc = cc.querySelector('.card-text-content'); if (!txc) return false; " +
      "if (!txc.firstChild) txc.textContent = 'Hello world'; var r = document.createRange(); " +
      "if (txc.firstChild && txc.firstChild.nodeType === 3) { r.setStart(txc.firstChild, Math.min(1, txc.firstChild.length)); } else { r.selectNodeContents(txc); } " +
      "r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); txc.focus(); " +
      "document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; };" +
      "window.__clickBtn = function(sel){ var b = document.querySelector(sel); if (!b) return false; " +
      "b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; };" +
      "window.__ttOn = function(){ var t = document.getElementById('textToolbar'); return !!(t && t.style.display !== 'none' && t.style.visibility !== 'hidden'); };" +
      "window.__popOn = function(){ var p = document.getElementById('ttImgPop'); return !!(p && p.classList.contains('active')); };" +
      "window.__dump = function(){ var cs = document.querySelectorAll('.grid-card[data-card-type=\"content\"]'); " +
      "return JSON.stringify({ n: cs.length, per: Array.prototype.map.call(cs, function(c){ " +
      "var t = c.querySelector('.card-text-content'); return { imgs: t ? t.querySelectorAll('img.tt-inline-img').length : -1, html: t ? t.innerHTML.slice(0, 400) : '' }; }), " +
      "totalImgs: document.querySelectorAll('img.tt-inline-img').length, usages: window.countLibUsages(document.querySelector('img.tt-inline-img').src) }); };" +
      "window.__batt = true; return true; })()");
    const META_OPEN = "document.getElementById('imgMetaModal').querySelector('.modal-card').classList.contains('active')";

    await cdp.evalJs("(function(){ var cc = window.createContentCard(0, 22, 8, 4); window.__caretInContent(cc); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'toolbar');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'pop');
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile.tim-upload'); true");
    await cdp.evalJs("window.__upFile('#ttInlineFileInput', 'rgb(0,0,255)', 1, 1, 'inline.png')");
    await waitFor(cdp, META_OPEN, 10000, 'meta open');
    await cdp.evalJs("window.__fillMeta('内联图', 'desc1', 'public'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(300);
    console.log('A 上传后: ' + await cdp.evalJs('window.__dump()'));

    await cdp.evalJs("(function(){ var c1 = document.querySelectorAll('.grid-card[data-card-type=\"content\"]')[0]; " +
      "var i = c1.querySelector('img.tt-inline-img'); var c2 = window.createContentCard(0, 27, 8, 4); " +
      "var im2 = document.createElement('img'); im2.className = 'tt-inline-img'; im2.src = i.src; im2.alt = i.alt; " +
      "im2.dataset.imgName = i.dataset.imgName; im2.dataset.imgDesc = i.dataset.imgDesc; im2.dataset.imgVisibility = i.dataset.imgVisibility; " +
      "c2.querySelector('.card-text-content').appendChild(im2); return true; })()");
    await sleep(200);
    console.log('B 克隆后: ' + await cdp.evalJs('window.__dump()'));

    await cdp.evalJs('window.saveDraft(); true');
    await sleep(300);
    console.log('C 草稿: ' + await cdp.evalJs("(function(){ var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}'); " +
      "return JSON.stringify((d.cards || []).filter(function(e){ return e.type === 'content'; }).map(function(e){ " +
      "return { imgs: (e.content.match(/tt-inline-img/g) || []).length, len: e.content.length }; })); })()"));

    await cdp.send('Page.reload', {});
    await waitFor(cdp, "typeof window.createFlagCard === 'function'", 20000, 'reload');
    await sleep(800);
    await cdp.evalJs("(function(){ if (window.__dump) return true; " +
      "window.__dump = function(){ var cs = document.querySelectorAll('.grid-card[data-card-type=\"content\"]'); " +
      "return JSON.stringify({ n: cs.length, per: Array.prototype.map.call(cs, function(c){ " +
      "var t = c.querySelector('.card-text-content'); return { imgs: t ? t.querySelectorAll('img.tt-inline-img').length : -1, html: t ? t.innerHTML.slice(0, 300) : '' }; }), " +
      "totalImgs: document.querySelectorAll('img.tt-inline-img').length, " +
      "usages: document.querySelector('img.tt-inline-img') ? window.countLibUsages(document.querySelector('img.tt-inline-img').src) : -1, " +
      "cards: document.querySelectorAll('.grid-card').length }); }; return true; })()");
    console.log('D 重载后: ' + await cdp.evalJs('window.__dump()'));
    console.log('E errs: ' + JSON.stringify(cdp.errs));
    await cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
