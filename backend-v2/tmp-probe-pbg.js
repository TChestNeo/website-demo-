// tmp-probe-pbg.js — 页面背景上传路径探针（诊断 __upload 静默失败）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-pbgp-' + Date.now());
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
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.exceptionDetails || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description }).slice(0, 400));
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {}
      await sleep(250);
    }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/fluidcanvas-editor.html' });
    for (let i = 0; i < 120; i++) {
      await sleep(250);
      try { if (await cdp.evalJs("typeof window.createFlagCard === 'function'")) break; } catch (e) {}
    }
    await sleep(600);
    // 1) File/DataTransfer 基础能力
    let r = await cdp.evalJs("(function(){ try { var cv = document.createElement('canvas'); cv.width = 4; cv.height = 4; var cx = cv.getContext('2d'); cx.fillStyle = '#f00'; cx.fillRect(0,0,4,4); return 'canvas ok ' + cv.toDataURL().slice(0, 30); } catch (e) { return 'canvas ERR ' + e.message; } })()");
    console.log('canvas:', r);
    r = await cdp.evalJs("(async function(){ try { var cv = document.createElement('canvas'); cv.width = 4; cv.height = 4; var blob = await new Promise(function(res){ cv.toBlob(res, 'image/png'); }); var file = new File([blob], 'x.png', { type: 'image/png' }); var dt = new DataTransfer(); dt.items.add(file); var input = document.getElementById('pageBgFileInput'); input.files = dt.files; return 'file path ok size=' + file.size + ' files=' + input.files.length; } catch (e) { return 'file ERR ' + e.message; } })()");
    console.log('file:', r);
    // 2) 开窗+真实上传
    r = await cdp.evalJs("(function(){ window.openPageBgModal(); return document.getElementById('modalBackdrop').classList.contains('active'); })()");
    console.log('modal:', r);
    r = await cdp.evalJs("(async function(){ try { var cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900; var cx = cv.getContext('2d'); cx.fillStyle = 'rgb(255,0,0)'; cx.fillRect(0,0,1600,900); var blob = await new Promise(function(res){ cv.toBlob(res, 'image/png'); }); var file = new File([blob], 'red.png', { type: 'image/png' }); var dt = new DataTransfer(); dt.items.add(file); var input = document.getElementById('pageBgFileInput'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(function(r2){ setTimeout(r2, 500); }); return 'after upload items=' + document.querySelectorAll('.pbg-list-item').length; } catch (e) { return 'upload ERR ' + e.message + ' | ' + e.stack; } })()");
    console.log('upload:', r);
    console.log('errs:', JSON.stringify(cdp.errs));
    try { chrome.kill(); } catch (e) {}
    process.exit(0);
  } finally {
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('FATAL', e); process.exit(1); });
