// tmp-probe-fc-exc.js — 诊断 article-view 电池的空 Runtime.exceptionThrown（raw {}）：
//   复刻电池全页序（stub → list → ART-CLOUD-1 → PENDING → MISSING → ART-001 → reload），逐事件带阶段标记
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 9200 + Math.floor(Math.random() * 200);
const CDP_PORT = 9600 + Math.floor(Math.random() * 200);
const USER_DATA = path.join(os.tmpdir(), 'mn-probe-fc-' + Date.now());

const FIXTURE_CONTENT = {
  v: 9, title: 'Cloud Constitution', tags: [],
  cards: [
    { id: 'c1', type: 'content', col: 2, row: 2, colSpan: 10, rowSpan: 6, content: '<p>body</p>', bgAlpha: 0, baseFontSize: 14 },
    { id: 'c2', type: 'flag', label: 'Flag', col: 4, row: 10, colSpan: 12, rowSpan: 7, imgSrc: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22600%22%20height%3D%22360%22%20fill%3D%22%232E5BFF%22%2F%3E%3C%2Fsvg%3E' },
    { id: 'c3', type: 'text', label: 'R', col: 38, row: 3, colSpan: 12, rowSpan: 7, content: 'right', background: 'rgba(220,38,38,0.15)' },
    { id: 'c4', type: 'text', label: 'B', col: 2, row: 98, colSpan: 8, rowSpan: 8, content: 'bottom', background: 'rgba(46,91,255,0.15)' }
  ],
  settings: { snapOn: true, alignOn: true }, activePreset: '169', presets: {}, groupStyles: {}, pageBg: null, lastSaved: 1750000000000
};
const FIXTURE_LIST = { articles: [
  { id: 'ART-CLOUD-1', title: 'Cloud Constitution', status: 'published', authorId: 'USR-000042', createdAt: '2026-09-14T10:00:00.000Z', updatedAt: '2026-09-14T10:00:00.000Z' },
  { id: 'ART-PENDING-1', title: 'Draft Act', status: 'pending', authorId: 'USR-000042', createdAt: '2026-09-13T08:30:00.000Z', updatedAt: '2026-09-13T08:30:00.000Z' }
] };
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  if (u.indexOf("/articles") !== -1) {' +
  '   if (u.indexOf("/articles/") !== -1) {' +
  '    var id = decodeURIComponent(u.split("/articles/")[1].split("?")[0].split("#")[0]);' +
  '    if (id === "ART-CLOUD-1") {' +
  '     return Promise.resolve(new Response(JSON.stringify({ article: { id: id, title: "Cloud Constitution", status: "published", createdAt: "2026-09-14T10:00:00.000Z", updatedAt: "2026-09-14T10:00:00.000Z", contentJson: ' + JSON.stringify(FIXTURE_CONTENT) + ' } }), { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '    }' +
  '    return Promise.resolve(new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404, headers: { "Content-Type": "application/json" } }));' +
  '   }' +
  '   return Promise.resolve(new Response(JSON.stringify(' + JSON.stringify(FIXTURE_LIST) + '), { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => { if (err) { res.writeHead(404); res.end('{}'); return; } res.writeHead(200); res.end(buf); });
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  server.listen(PORT);
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {}
    await sleep(250);
  }
  const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' });
  const info = await r.json();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
  let id = 0; const pending = new Map();
  let phase = 'boot';
  let t0 = Date.now();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method === 'Runtime.exceptionThrown') console.log('[' + phase + ' +' + (Date.now() - t0) + 'ms] EXC ' + JSON.stringify(m.params).slice(0, 2500));
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') console.log('[' + phase + '] console.error: ' + m.params.args.map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ').slice(0, 150));
    else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') console.log('[' + phase + '] log.error: ' + (m.params.entry.text || '').slice(0, 150));
  };
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });

  const walk = async (url, ms) => { phase = url.split('?')[1] || 'list'; t0 = Date.now(); await send('Page.navigate', { url }); await sleep(ms); };
  await walk('http://127.0.0.1:' + PORT + '/pages/fluidcanvas-editor.html?view=articles', 3500);
  await walk('http://127.0.0.1:' + PORT + '/pages/fluidcanvas-editor.html?article=ART-CLOUD-1', 3500);
  await walk('http://127.0.0.1:' + PORT + '/pages/fluidcanvas-editor.html?article=ART-PENDING-1', 2500);
  await walk('http://127.0.0.1:' + PORT + '/pages/fluidcanvas-editor.html?article=ART-MISSING', 2500);
  await walk('http://127.0.0.1:' + PORT + '/pages/fluidcanvas-editor.html?article=ART-001', 3500);
  phase = 'reload'; t0 = Date.now(); await send('Page.reload', { ignoreCache: true }); await sleep(3500);
  console.log('=== 探针结束 ===');
  ws.close(); chrome.kill(); server.close(); process.exit(0);
})();
