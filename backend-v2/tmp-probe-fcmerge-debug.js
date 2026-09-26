'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4900 + Math.floor(Math.random() * 50);
const CDP_PORT = 5900 + Math.floor(Math.random() * 50);
const USER_DATA = path.join(os.tmpdir(), 'mn-probe-fcmerge-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
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
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); }
      else if (m.method === 'Runtime.exceptionThrown') { const d = m.exceptionDetails || {}; this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 400)); }
      else if (m.method === 'Runtime.consoleAPICalled') { console.log('[console.' + m.params.type + ']', (m.params.args || []).map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ').slice(0, 200)); }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej, method }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.exceptionDetails) return 'EVAL_ERR: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
  if (!up) { console.log('Chrome CDP 未就绪'); process.exit(1); }
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  const page = pages.find(x => x.type === 'page');
  console.log('page found:', !!page);
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}' });
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/fluidcanvas.html' });
  await sleep(6000);
  console.log('URL 现在:', await cdp.evalJs('location.href'));
  console.log('readyState:', await cdp.evalJs('document.readyState'));
  console.log('fc-guest?', await cdp.evalJs('document.documentElement.classList.contains("fc-guest")'));
  console.log('dashboardView className:', await cdp.evalJs('document.getElementById("dashboardView") ? document.getElementById("dashboardView").className : "NULL"'));
  console.log('switchView 类型:', await cdp.evalJs('typeof switchView'));
  console.log('FC_URL:', await cdp.evalJs('typeof window.FC_URL'));
  console.log('FC_ANALYTICS:', await cdp.evalJs('typeof window.FC_ANALYTICS'));
  console.log('initURLSync 类型:', await cdp.evalJs('typeof initURLSync'));
  console.log('错误数:', cdp.errs.length);
  cdp.errs.slice(0, 10).forEach(e => console.log('  ERR:', e));
  const scripts = await cdp.evalJs('Array.from(document.scripts).map(s => s.src || (s.id ? "#" + s.id : "INLINE")).join(" | ")');
  console.log('scripts:', scripts);
  cdp.close();
  try { chrome.kill(); } catch (e) {}
  server.close();
  process.exit(0);
})();
