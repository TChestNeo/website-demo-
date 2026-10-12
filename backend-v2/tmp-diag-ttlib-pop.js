// tmp-diag-ttlib-pop.js — 定位弹层上传流中 ttImgPop 何时失去 active / 网格何时被清（本地静态服务器）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');

const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.startsWith('/api/')) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"error":"not found"}'); return; }
  const f = path.join(DOCS, p === '/' ? '/index.html' : p);
  if (!f.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, buf) => {
    if (e) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(f).toLowerCase();
    const t = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': t + '; charset=utf-8' });
    res.end(buf);
  });
});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
      else if (m.method === 'Runtime.exceptionThrown') { const d = (m.params && m.params.exceptionDetails) || {}; this.errs.push(String(d.text || '').slice(0, 200)); }
      else if (m.method === 'Page.javascriptDialogOpening') { this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text)); return r.result.value; }
}
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { if (await cdp.evalJs('!!(' + expr + ')')) return; } catch (e) {} await sleep(120); }
  throw new Error('waitFor 超时: ' + label);
}
(async () => {
  await new Promise(r => srv.listen(4829, r));
  const BASE = 'http://127.0.0.1:4829';
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-diag-ttlib-' + Date.now());
  let chromePath = null;
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe']) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const cdp = new CDP(pages.find(x => x.type === 'page').webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}' });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "!!window.showImgPop && !!window.imgMetaSave && !!document.getElementById('gridCanvas')", 30000, 'load');
    await sleep(700);
    await cdp.evalJs(`(function(){
      window.__mkImgPop = function (name) {
        var cv = document.createElement('canvas'); cv.width = 8; cv.height = 6;
        var ctx = cv.getContext('2d'); ctx.fillStyle = '#5a5'; ctx.fillRect(0, 0, 8, 6);
        var url = cv.toDataURL('image/png');
        var bin = atob(url.split(',')[1]);
        var u8 = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        var dt = new DataTransfer();
        dt.items.add(new File([u8], name, { type: 'image/png' }));
        var fi = document.getElementById('ttInlineFileInput');
        fi.files = dt.files;
        fi.dispatchEvent(new Event('change', { bubbles: true }));
        return url;
      };
      window.__st = function () { return { pop: document.getElementById('ttImgPop').classList.contains('active'),
        grid: document.getElementById('ttImgGrid').textContent.slice(0, 80),
        mode: document.getElementById('ttImgGrid').className }; };
    })()`);
    await cdp.evalJs("window.__card = window.createCharacterCard(2, 2, 4, 5); var inp = window.__card.querySelector('input.card-label') || window.__card.querySelector('input'); inp.focus(); true");
    await cdp.evalJs("window.showImgPop(); true");
    await sleep(300);
    console.log('step1 开弹层后:', JSON.stringify(await cdp.evalJs("window.__st()")));
    // 装代理：抓 'active' remove 的调用栈
    await cdp.evalJs("(function(){ window.__popStack = null; var el = document.getElementById('ttImgPop'); var orig = el.classList; var prox = new Proxy(orig, { get: function (t, k) { if (k === 'remove') { return function (v) { if (v === 'active') window.__popStack = new Error('POP-remove').stack; return t.remove(v); }; } return (typeof t[k] === 'function') ? t[k].bind(t) : t[k]; } }); try { Object.defineProperty(el, 'classList', { get: function () { return prox; } }); } catch (e) {} })()");
    const u = await cdp.evalJs("window.__mkImgPop('diag1.png')");
    await waitFor(cdp, "!!document.querySelector('#imgMetaModal .modal-card.active')", 8000, 'meta open');
    console.log('step2 meta 弹窗开后:', JSON.stringify(await cdp.evalJs("window.__st()")));
    await cdp.evalJs("(function(){ var c = document.querySelectorAll('#immTagChips .imm-tag-chip')[0]; c.click(); })()");
    await sleep(200);
    console.log('step3 点 tag chip 后:', JSON.stringify(await cdp.evalJs("window.__st()")));
    console.log('remove 栈:', JSON.stringify(await cdp.evalJs("window.__popStack || '(未捕获)'")));
    await cdp.evalJs("window.imgMetaSave()");
    await sleep(500);
    console.log('step4 imgMetaSave 后:', JSON.stringify(await cdp.evalJs("window.__st()")));
    console.log('errs:', JSON.stringify(cdp.errs));
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
  }
  try { chrome.kill(); } catch (e) {}
  srv.close();
  process.exit(0);
})();
