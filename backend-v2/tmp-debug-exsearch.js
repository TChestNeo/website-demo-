// tmp-debug-exsearch.js — 调试 explore 搜索：打字后倒面板/错误/桩命中
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CDP_PORT = 7900 + Math.floor(Math.random() * 100);
const SRV_PORT = 9600 + Math.floor(Math.random() * 300);
const DOCS = path.resolve(__dirname, '../docs');
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-dbg-exs-' + Date.now());

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let p = path.join(DOCS, u === '/' ? '/pages/explore.html' : u);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(p).pipe(res);
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; this.consoleErrs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = (m.params && m.params.exceptionDetails) || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 500));
      } else if (m.method === 'Runtime.consoleAPICalled') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 300);
        console.log('[console.' + m.params.type + '] ' + text);
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
  await new Promise(res => server.listen(SRV_PORT, res));
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
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
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      (function () {
        window.__STUB_HITS = [];
        var FAKE = { ok: true, data: { articles: [
          { id: 'ART-000004', title: 'Testing', status: 'published', authorName: 'TChestBox_Neo', createdAt: '2026-09-20T06:01:15.434Z' }
        ] } };
        var EMPTY = { ok: true, data: { articles: [] } };
        var _f = window.fetch;
        window.fetch = function (url, opts) {
          var u = String(url);
          window.__STUB_HITS.push(u);
          if (u.indexOf('/api/articles?q=') !== -1) {
            var q = decodeURIComponent(u.split('q=')[1] || '');
            return Promise.resolve({ ok: true, status: 200, headers: { get: function () { return null; } }, json: function () { return Promise.resolve(q === 'Testing' ? FAKE : EMPTY); } });
          }
          return _f.apply(this, arguments);
        };
      })();
    ` });
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + SRV_PORT + '/pages/explore.html' });
    await sleep(6000);
    console.log('=== readyState / 元素 ===');
    console.log(await cdp.evalJs("document.readyState + ' | input=' + !!document.getElementById('exSearchInput') + ' | MN_API=' + (!!window.MN_API) + ' | BASE=' + (window.MN_API ? window.MN_API.BASE : 'n/a')"));
    console.log('=== 打字 Testing ===');
    await cdp.evalJs("(function(){ var i = document.getElementById('exSearchInput'); i.value = 'Testing'; i.dispatchEvent(new Event('input')); })()");
    await sleep(2500);
    console.log('=== 面板内容 ===');
    console.log(JSON.stringify(await cdp.evalJs("document.getElementById('exSearchPanel').innerHTML"), null, 0).slice(0, 800));
    console.log('=== 主区段 ===');
    console.log(JSON.stringify(await cdp.evalJs("document.getElementById('exArticleResults').innerHTML"), null, 0).slice(0, 400));
    console.log('=== 桩命中 ===');
    console.log(JSON.stringify(await cdp.evalJs("window.__STUB_HITS"), null, 0).slice(0, 800));
    console.log('=== exceptions ===');
    console.log(JSON.stringify(cdp.errs, null, 1).slice(0, 1500));
    cdp.close();
  } catch (e) {
    console.log('💥 ' + (e.stack || e.message));
  }
  try { chrome.kill(); } catch (e) {}
  server.close();
  process.exit(0);
})();
