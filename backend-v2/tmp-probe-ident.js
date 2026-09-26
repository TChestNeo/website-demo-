// tmp-probe-ident.js — onboarding-identity 白卡探针：mono dark 下 .auth-left/.auth-card/.card/.dot/h2 计算样式全链
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4857, CDP_PORT = 5857;
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-ident-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  fs.readFile(path.join(DOCS, f), (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(buf);
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

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
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
    const cdp = new CDP(pages.find(x => x.type === 'page').webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify({ theme: 'dark', accent: 'mono' })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/onboarding-identity.html' });
    await sleep(1200);
    const out = await cdp.evalJs(`(function(){
      var o = {};
      o.htmlAccent = document.documentElement.getAttribute('data-accent');
      o.htmlTheme = document.documentElement.getAttribute('data-theme');
      o.primary = getComputedStyle(document.documentElement).getPropertyValue('--color-primary');
      o.cardBg = getComputedStyle(document.documentElement).getPropertyValue('--card-bg');
      function st(sel) {
        var el = document.querySelector(sel);
        if (!el) return sel + ' NOT FOUND';
        var s = getComputedStyle(el);
        return { color: s.color, backgroundColor: s.backgroundColor, backgroundImage: s.backgroundImage.slice(0,110), filter: s.filter };
      }
      o.authLeft = st('.auth-left');
      o.authCard = st('.auth-card');
      o.stepCard = st('.auth-left .card');
      o.h2 = st('.auth-left h2');
      o.logoSpan = st('.auth-left span[style*="font-weight:700"]');
      o.pTag = st('.auth-left p');
      o.dotActive = st('.progress-step.active .dot');
      o.dotPending = st('.progress-step.pending .dot');
      o.spanCreate = st('.progress-step.completed > span:not(.dot)');
      // 祖先链（h2 起）
      var chain = [];
      var a = document.querySelector('.auth-left h2');
      while (a) { var s = getComputedStyle(a); chain.push((a.className&&a.className.baseVal!==undefined?a.className.baseVal:a.className)||a.tagName + ' | ' + s.backgroundColor + ' | ' + (s.backgroundImage==='none'?'none':s.backgroundImage.slice(0,80))); a = a.parentElement; }
      o.h2Chain = chain;
      return JSON.stringify(o, null, 1);
    })()`);
    console.log(out);
    cdp.close();
    chrome.kill();
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  server.close();
})();
