// tmp-trace-msg-anim.js — CDP Tracing 定位滑动期间每帧到底在忙什么（Request H 侦察辅助）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-msgtrace-' + Date.now());
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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.traceEvents = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Tracing.dataCollected' && m.params && Array.isArray(m.params.value)) {
        this.traceEvents.push(...m.params.value);
        return;
      }
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
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, user: { id: 'USR-demo-local', name: 'You', email: 'you@demo.local' } })) + ');}catch(e){}'
    });

    // 追踪全程（headless 下 Tracing 需要提前开）
    await cdp.send('Tracing.start', { traceConfig: { recordMode: 'recordContinuously', includedCategories: ['devtools.timeline'] } });
    await cdp.send('Page.navigate', { url: BASE + '/pages/messages.html' });
    let ok = false;
    for (let i = 0; i < 200 && !ok; i++) {
      await sleep(150);
      try { ok = await cdp.evalJs("!!(document.querySelector('#conversationList') && document.querySelector('#conversationList').children.length > 0)"); } catch (e) {}
    }
    await sleep(600);
    // 暖机
    await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'groups\\']').click()"); await sleep(900);
    await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'announcements\\']').click()"); await sleep(900);
    await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'private\\']').click()"); await sleep(900);

    // 追踪 TS3 announce→private（最差场景）
    await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'private\\']').click()");
    await sleep(1200);
    await cdp.send('Tracing.end');
    const evts = cdp.traceEvents;
    console.log('trace 事件总数: ' + evts.length);
    if (evts.length < 10) { console.log('样本: ' + JSON.stringify(evts.slice(0, 3))); process.exit(0); }

    // 只统计点击之后 1.2s 内的主线程任务
    const t0 = evts.filter(e => e.name === 'EventDispatch' && e.args && e.args.data && e.args.data.type === 'click')[0];
    const tstart = t0 ? t0.ts : evts[Math.floor(evts.length / 2)].ts;
    const tend = tstart + 1200000; // 1.2s in µs
    const thread = (evts.find(e => e.name === 'thread_name' && e.args && e.args.name === 'CrRendererMain') || {}).tid;
    const tasks = evts.filter(e => e.tid === thread && e.ph === 'X' && e.ts >= tstart && e.ts <= tend)
      .sort((a, b) => b.dur - a.dur);
    const agg = {};
    let total = 0;
    for (const t of tasks) { agg[t.name] = (agg[t.name] || 0) + t.dur; total += t.dur; }
    console.log('TS3 窗口内主线程任务聚合（1.2s，µs）:');
    Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => console.log('  ' + k + ': ' + (v / 1000).toFixed(1) + 'ms'));
    console.log('  主线程总忙: ' + (total / 1000).toFixed(1) + 'ms / 1200ms');
    console.log('  Top 12 单任务:');
    tasks.slice(0, 12).forEach(t => console.log('    ' + t.name + ' ' + (t.dur / 1000).toFixed(1) + 'ms'));

    cdp.close();
    try { chrome.kill(); } catch (e) {}
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    server.close();
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  server.close();
  console.log('done');
})();
