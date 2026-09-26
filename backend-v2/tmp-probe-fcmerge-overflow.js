'use strict';
// 探针：390×844 下 dashboard 溢出元素溯源（merged 页）。用法：node tmp-probe-fcmerge-overflow.js [merged|head] [viewQuery]
// head 模式会先 git checkout HEAD 覆盖 docs/pages/fluidcanvas.html，测完用 --restore 还原。
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PAGE = path.join(DOCS, 'pages', 'fluidcanvas.html');
const PORT = 4910 + Math.floor(Math.random() * 50);
const CDP_PORT = 5910 + Math.floor(Math.random() * 50);
const USER_DATA = path.join(os.tmpdir(), 'mn-probe-overflow-' + Date.now());
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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const mode = process.argv[2] || 'merged';
  const query = process.argv[3] || '';
  const backup = path.join(os.tmpdir(), 'fc-merged-backup.html');
  if (mode === 'head') { fs.copyFileSync(PAGE, backup); execSync('git checkout HEAD -- docs/pages/fluidcanvas.html', { cwd: path.resolve(__dirname, '..') }); }
  await new Promise(r => server.listen(PORT, r));
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
  if (!up) { console.log('Chrome 未就绪'); process.exit(1); }
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  const page = pages.find(x => x.type === 'page');
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}' });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/fluidcanvas.html' + query });
  await sleep(4000);
  console.log('scrollWidth:', await cdp.evalJs('document.documentElement.scrollWidth'));
  console.log('body width:', await cdp.evalJs('document.body.getBoundingClientRect().width'));
  // 找所有超出视口右边界的可见元素（自上而下前 15 个）
  const scopeSel = process.argv[3] || '';
  const res = await cdp.evalJs(`(function(){
    var out = [];
    var scope = ${scopeSel ? "document.getElementById('" + scopeSel + "')" : 'document.body'};
    var all = scope ? scope.querySelectorAll('*') : [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (r.right > 391 || r.left < -1) {
        out.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          cls: (typeof el.className === 'string' ? el.className : '').slice(0, 60),
          left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width)
        });
        if (out.length >= 15) break;
      }
    }
    return out;
  })()`);
  console.log('溢出元素:');
  res.forEach(x => console.log('  ', JSON.stringify(x)));
  cdp.close();
  try { chrome.kill(); } catch (e) {}
  server.close();
  if (mode === 'head') { fs.copyFileSync(backup, PAGE); fs.unlinkSync(backup); console.log('-- 已还原 merged 工作树文件'); }
  process.exit(0);
})();
