// tmp-morph-probe.js — 一次性诊断：融变区滚动位置与三行点亮状态（逐步快照）
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3950 + Math.floor(Math.random() * 100);
const CDP_PORT = 5950 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-probe-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') { fs.readFile(file + '.html', (e2, b2) => { if (e2) { res.writeHead(404); res.end('{}'); return; } res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b2); }); return; }
    if (err) { res.writeHead(404); res.end('{}'); return; }
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
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || 'exception'));
    return r.result.value;
  }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  server.listen(PORT);
  let chromePath = null;
  for (const p of ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {} await sleep(250); }
  const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' });
  const info = await r.json();
  const t = new CDP(info.webSocketDebuggerUrl);
  await t.connect();
  await t.send('Page.enable');
  await t.send('Runtime.enable');

  await t.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/story/wip' });
  await sleep(3500);

  const SNAP = "(() => { var tr = document.querySelector('[data-scene=\"ch1-00\"] .ms-track');" +
    " function st(i) { var l = document.querySelectorAll('[data-scene=\"ch1-00\"] .line')[i];" +
    "   var fls = l.querySelectorAll('.mw-fill'); var full = 0, zero = 0;" +
    "   for (var k = 0; k < fls.length; k++) { var o = parseFloat(fls[k].style.opacity); if (o >= 0.99) full++; if (o <= 0.01) zero++; }" +
    "   return { n: fls.length, full: full, zero: zero }; }" +
    " return { scrollY: window.scrollY, trackTop: Math.round(tr.getBoundingClientRect().top), vh: window.innerHeight," +
    "  morph: { idx: window.storyMorph.idx, local: window.storyMorph.local, progress: window.storyMorph.progress }," +
    "  L: [st(0), st(1), st(2)] }; })()";

  await t.evalJs("document.querySelector('[data-scene=\"ch1-00\"]').scrollIntoView({ block: 'start' })");
  await sleep(600);
  console.log('SNAP start:', JSON.stringify(await t.evalJs(SNAP)));
  await t.evalJs('window.scrollBy(0, 400)');
  await sleep(600);
  console.log('SNAP +400:', JSON.stringify(await t.evalJs(SNAP)));
  await t.evalJs('window.scrollBy(0, 900)');
  await sleep(800);
  console.log('SNAP +1300:', JSON.stringify(await t.evalJs(SNAP)));
  await t.evalJs('window.scrollBy(0, 600)');
  await sleep(800);
  console.log('SNAP +1900:', JSON.stringify(await t.evalJs(SNAP)));
  t.close();
  chrome.kill();
  process.exit(0);
}
main().catch(e => { console.error('probe err', e.message); process.exit(1); });
