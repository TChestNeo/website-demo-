// tmp-debug-1to1-legacy.js — 调试 ARTLEGACY1 流式兜底 404：dump 桩拦截 URL/id 流水 + 404 文案
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4900 + Math.floor(Math.random() * 50);
const CDP_PORT = 5900 + Math.floor(Math.random() * 50);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-legacy-dbg2-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { console.log('[static server saw api call]', p); res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') { fs.readFile(file + '.html', (e2, b2) => { if (e2) { res.writeHead(404); res.end(); return; } res.writeHead(200); res.end(b2); }); return; }
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});
const FIXTURE_LEGACY = { v: 8, title: 'Legacy Draft', activePreset: '169', cards: [
  { id: 'l1', type: 'content', col: 2, row: 2, colSpan: 10, rowSpan: 6, content: '<p>legacy flow body</p>', baseFontSize: 14 },
  { id: 'l2', type: 'flag', col: 4, row: 10, colSpan: 12, rowSpan: 7, label: 'Old Flag' }
]};
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' var stubResponse = function (body, status) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status, headers: { "Content-Type": "application/json" } })); }, 0); }); };' +
  ' window.__stubLog = [];' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  if (u.indexOf("/articles") !== -1) {' +
  '   if (u.indexOf("/articles/") !== -1) {' +
  '    var id = decodeURIComponent(u.split("/articles/")[1].split("?")[0].split("#")[0]);' +
  '    window.__stubLog.push("detail:" + id);' +
  '    if (id === "ARTLEGACY1") {' +
  '     window.__stubLog.push("matched LEGACY");' +
  '     return stubResponse(JSON.stringify({ article: { id: id, title: "Legacy Draft", status: "published", authorId: "USR-000042", authorName: "Neo", createdAt: "2026-09-19T10:00:00.000Z", updatedAt: "2026-09-19T10:00:00.000Z", contentJson: ' + JSON.stringify(FIXTURE_LEGACY) + ' } }), 200);' +
  '    }' +
  '    return stubResponse(JSON.stringify({ error: "NOT_FOUND" }), 404);' +
  '   }' +
  '   window.__stubLog.push("list");' +
  '   return stubResponse(JSON.stringify({ articles: [] }), 200);' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){ window.__stubLog.push("stub error: " + e.message); }';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise(r => server.listen(PORT, r));
  let chromePath = null;
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe']) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
  if (!up) throw new Error('no cdp');
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  const page = pages.find(x => x.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
  let id = 0; const pending = new Map(); const errs = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    else if (m.method === 'Runtime.exceptionThrown') { const d = (m.params && m.params.exceptionDetails) || {}; errs.push((d.exception && d.exception.description || d.text || '').slice(0, 400)); }
    else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') { const a = m.params.args || []; errs.push('console: ' + a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200)); }
  };
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const evalJs = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text); return r.result.value; };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
  await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/article.html?id=ARTLEGACY1' });
  await sleep(4500);
  console.log('stubLog:', JSON.stringify(await evalJs('window.__stubLog || ["undefined"]')));
  console.log('404 display:', await evalJs('document.getElementById("articleState404").style.display'));
  console.log('404 msg:', await evalJs('document.getElementById("article404Msg").textContent'));
  console.log('detail display:', await evalJs('document.getElementById("articleDetail").style.display'));
  console.log('artBody len:', await evalJs('document.getElementById("artBody").innerHTML.length'));
  console.log('errs:', JSON.stringify(errs.slice(0, 6)));
  ws.close(); try { chrome.kill(); } catch (e) {}
  server.close();
  process.exit(0);
})().catch(e => { console.error('💥', e.stack || e); process.exit(1); });
