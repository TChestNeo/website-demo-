// tmp-debug-w5.js — 诊断 1280×900 下 article-present 渲染成 tablet 的原因
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PORT = 4821;
const CDP_PORT = 5931;
const USER_DATA = path.join(os.tmpdir(), 'mn-debug-w5-' + Date.now());
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};
const server = require('http').createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u.indexOf('/api') === 0) { res.writeHead(404); res.end('{"error":"NOT_FOUND"}'); return; }
  if (u === '/' || u === '/dashboard') u = '/index.html';
  let f = path.join(DOCS, u);
  if (!fs.existsSync(f) && !path.extname(f)) { if (fs.existsSync(f + '.html')) f += '.html'; }
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const FLAG_SVG = 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20360%22%3E%3Crect%20width%3D%22600%22%20height%3D%22180%22%20fill%3D%22%232E5BFF%22%2F%3E%3Crect%20y%3D%22180%22%20width%3D%22600%22%20height%3D%22180%22%20fill%3D%22%23FFFFFF%22%2F%3E%3C%2Fsvg%3E';
const FIXTURE_PRESENT = {
  v: 9,
  title: 'Testing',
  tags: ['宪法', '地理'],
  activePreset: '169',
  presets: {
    '169': { cards: {
      c8: { col: 21, row: 1, colSpan: 12, rowSpan: 8, aspectLock: '1', aspectRatio: '1.5174603174603174', fitW: 264.39946285714285, fitH: 174.3470057142857 },
      c1: { col: 46, row: 1, colSpan: 11, rowSpan: 8 },
      c2: { col: 21, row: 11, colSpan: 12, rowSpan: 4 },
      s1: { col: 21, row: 15, colSpan: 18, rowSpan: 8 },
      c3: { col: 21, row: 26, colSpan: 6, rowSpan: 3 }
    } },
    half: { cards: {} }, tablet: { cards: {} }, mobile: { cards: {} }
  },
  groupStyles: {}, pageBg: null, lastSaved: 1750000000000,
  cards: [
    { id: 'c8', type: 'flag', col: 21, row: 1, x: 439, y: 8, colSpan: 12, rowSpan: 8, rotate: 0, borderRadius: 8, background: '', borderStyle: 'solid', borderColor: '', borderWidth: 2, aspectLock: '1', aspectRatio: '1.5174603174603174', fitW: 264.39946285714285, fitH: 174.3470057142857, label: '', z: 2, imgSrc: FLAG_SVG },
    { id: 'c1', type: 'content', col: 46, row: 1, x: 790, y: 8, colSpan: 11, rowSpan: 8, rotate: 0, background: '', borderWidth: 2, label: 'Constitution', baseFontSize: 14, z: 1, content: '<p>We the people…</p>' },
    { id: 'c2', type: 'content', col: 21, row: 11, x: 439, y: 220, colSpan: 12, rowSpan: 4, rotate: 0, background: '', borderWidth: 2, label: '', baseFontSize: 14, z: 1, content: '<p>Hello present</p>' },
    { id: 's1', type: 'stats', col: 21, row: 15, x: 439, y: 290, colSpan: 18, rowSpan: 8, rotate: 0, background: '', borderWidth: 2, label: 'Stats', z: 1 },
    { id: 'c3', type: 'text', col: 21, row: 26, x: 439, y: 520, colSpan: 6, rowSpan: 3, rotate: 0, background: 'rgba(46,91,255,0.15)', borderWidth: 2, label: 'Notes', z: 1, content: 'note text' }
  ]
};
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' var stubResponse = function (body, status) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status, headers: { "Content-Type": "application/json" } })); }, 0); }); };' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  if (u.indexOf("/articles/") !== -1) {' +
  '   var id = decodeURIComponent(u.split("/articles/")[1].split("?")[0].split("#")[0]);' +
  '   if (id === "ART-000004") return stubResponse(JSON.stringify({ article: { id: id, title: "Testing", status: "published", authorId: "USR-000042", authorName: "Neo", createdAt: "2026-09-20T10:00:00.000Z", updatedAt: "2026-09-20T10:00:00.000Z", viewCount: 7, likeCount: 2, likedByMe: false, favoritedByMe: false, contentJson: ' + JSON.stringify(FIXTURE_PRESENT) + ' } }), 200);' +
  '   return stubResponse(JSON.stringify({ error: "NOT_FOUND" }), 404);' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';
const SESSION_SCRIPT = 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}';
// 记录每次 renderBody 时的宽度与布局：renderBody 前先读 innerWidth
const TRACE_SCRIPT = 'try{(function(){ var w = window.__mnTrace = window.__mnTrace || [];' +
  ' window.addEventListener("resize", function(){ w.push("resize@" + window.innerWidth); });' +
  ' var last = ""; var iv = setInterval(function(){ var e = document.querySelector("#artBody .art-canvas-inner");' +
  '  if (e) { var cur = e.offsetWidth + "x" + e.offsetHeight; if (cur !== last) { last = cur; w.push("inner:" + cur + "@" + window.innerWidth); } }' +
  '  if (w.length > 40) clearInterval(iv); }, 80);' +
  ' setTimeout(function(){ clearInterval(iv); }, 15000);' +
  '})();}catch(e){}';

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let ws, id = 0, pending = new Map(), errs = [];
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej, method }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {}
    await sleep(250);
  }
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  ws = new WebSocket(pages.find(x => x.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej, method } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') { const d = m.exceptionDetails || {}; errs.push('EXC:' + JSON.stringify({ text: d.text, line: d.lineNumber }).slice(0, 200)); }
  };
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION_SCRIPT });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: TRACE_SCRIPT });
  await send('Page.navigate', { url: BASE + '/pages/article.html?id=ART-000004' });
  await sleep(7000);
  const dump = await evalJs("(function(){ var b = document.getElementById('artBody'); var e = b ? b.querySelector('.art-canvas-inner') : null;" +
    " return { innerW: window.innerWidth, clientW: document.documentElement.clientWidth," +
    "  bodyScrollW: document.documentElement.scrollWidth," +
    "  inner: e ? e.offsetWidth + 'x' + e.offsetHeight : 'none'," +
    "  lcs: window.__slatiLcs || null, trace: window.__mnTrace, forced: window.__slatiForceLayout || null }; })()");
  console.log('DUMP:', JSON.stringify(dump, null, 2));
  console.log('ERRS:', errs.slice(0, 5).join('\n') || '(零)');
  ws.close();
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  server.close();
  process.exit(0);
})();
