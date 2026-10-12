// tmp-debug-c1.js — 诊断 C1 阅读页渲染失败
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PORT = 4812;
const CDP_PORT = 5922;
const USER_DATA = path.join(os.tmpdir(), 'mn-debug-c1-' + Date.now());
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

const CARD_BASE = { rotate: 0, borderRadius: 8, background: '', borderStyle: 'solid', borderColor: '', borderWidth: 2, z: 1 };
const FLAG_SVG = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#4a7fd4"/><rect y="200" width="800" height="200" fill="#e0e6f0"/></svg>'
).toString('base64');
const FIXTURE = {
  v: 9, title: 'Cloud Constitution', activePreset: '169', lastSaved: 1750000000000,
  presets: { '169': { cards: {} }, half: { cards: {} }, tablet: { cards: {} }, 'tablet-p': { cards: {} }, mobile: { cards: {} } },
  cards: [
    Object.assign({ id: 'c1', type: 'content', col: 2, row: 2, colSpan: 6, rowSpan: 4, x: 0, y: 0, w: 300, label: 'Body', baseFontSize: 14, content: '<p>Cloud Constitution</p>' }, CARD_BASE),
    Object.assign({ id: 'c2', type: 'text', col: 2, row: 11, colSpan: 12, rowSpan: 4, x: 0, y: 220, label: 'N2', content: 'note two' }, CARD_BASE),
    Object.assign({ id: 'c3', type: 'text', col: 14, row: 11, colSpan: 6, rowSpan: 4, x: 264, y: 220, label: 'N3', content: 'note three' }, CARD_BASE),
    Object.assign({ id: 'c4', type: 'text', col: 26, row: 11, colSpan: 12, rowSpan: 4, x: 528, y: 220, label: 'N4', content: 'note four' }, CARD_BASE),
    Object.assign({ id: 'c5', type: 'content', col: 2, row: 31, colSpan: 8, rowSpan: 8, x: 0, y: 638, label: 'Late', baseFontSize: 14, content: '<p>appended later</p>' }, CARD_BASE),
    Object.assign({ id: 'c6', type: 'flag', col: 2, row: 44, colSpan: 8, rowSpan: 5, x: 0, y: 878, aspectLock: '1', aspectRatio: '2', fitW: 200, fitH: 100, imgSrc: FLAG_SVG, label: 'Flag' }, CARD_BASE)
  ]
};
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window); window.__fetched = [];' +
  ' var stubResponse = function (body, status) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status, headers: { "Content-Type": "application/json" } })); }, 0); }); };' +
  ' var CLOUD1 = ' + JSON.stringify(FIXTURE) + ';' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url); window.__fetched.push(u);' +
  '  if (u.indexOf("/articles") !== -1) {' +
  '   if (u.indexOf("/articles/") !== -1) {' +
  '    var id = decodeURIComponent(u.split("/articles/")[1].split("?")[0].split("#")[0]);' +
  '    if (id === "ART-CLOUD-1") return stubResponse(JSON.stringify({ article: { id: id, title: CLOUD1.title, status: "published", authorId: "USR-000042", authorName: "Neo", createdAt: "2026-09-20T10:00:00.000Z", updatedAt: "2026-09-20T10:00:00.000Z", viewCount: 7, likeCount: 2, likedByMe: false, favoritedByMe: false, contentJson: CLOUD1 } }), 200);' +
  '    return stubResponse(JSON.stringify({ error: "NOT_FOUND" }), 404);' +
  '   }' +
  '   return stubResponse(JSON.stringify({ articles: [] }), 200);' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';
const SESSION_SCRIPT = 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}';
const SEED_SCRIPT = 'try{(function(){ var n = window.name || "";' +
  ' if (n.indexOf("__FCSEED__") === 0) { localStorage.setItem("slati_fluidcanvas_draft", n.slice(10)); }' +
  ' else if (n.indexOf("__FCXLAYOUT__") === 0) { window.__slatiForceLayout = n.slice(13); }' +
  ' else { localStorage.removeItem("slati_fluidcanvas_draft"); }' +
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
    if (m.method === 'Runtime.exceptionThrown') { const d = m.exceptionDetails || {}; errs.push('EXC:' + JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 250)); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      const txt = (m.params.args || []).map(a => a.value || a.description || '').join(' ');
      if (txt.indexOf('Failed to load resource') === -1) errs.push('CON:' + txt.slice(0, 250));
    }
  };
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION_SCRIPT });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SEED_SCRIPT });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false, screenOrientation: { type: 'landscapePrimary', angle: 0 } });
  await send('Page.navigate', { url: BASE + '/pages/article.html?id=ART-CLOUD-1' });
  await sleep(6000);
  const dump = await evalJs("(function(){ var ab = document.getElementById('artBody'); var s404 = document.getElementById('articleState404');" +
    " var q = new URLSearchParams(window.location.search).get('id');" +
    " return { href: window.location.href, title: document.title," +
    "  artBodyLen: ab ? ab.innerHTML.length : -1," +
    "  artBody: ab ? ab.innerHTML.slice(0, 500) : 'NO artBody'," +
    "  s404: s404 ? getComputedStyle(s404).display : 'none'," +
    "  fetched: window.__fetched || []," +
    "  cards: ab ? ab.querySelectorAll('.art-card').length : -1," +
    "  hasCanvas: ab ? !!ab.querySelector('.art-canvas') : false," +
    "  queryId: q, regexPass: q ? /^ART-[A-Za-z0-9]+$/.test(q) : 'noq'," +
    "  mnApi: typeof window.MN_API, slatiDb: typeof window.SlatiDB, mnI18n: typeof window.MN_I18N," +
    "  stubActive: !!window.__slatiFetchStub, scriptCount: document.querySelectorAll('script').length," +
    "  s404Html: s404 ? s404.querySelector('p') ? s404.querySelector('p').textContent : '' : '' }; })()");
  console.log('DUMP:', JSON.stringify(dump, null, 2));
  console.log('ERRS:', errs.slice(0, 10).join('\n') || '(零)');
  ws.close();
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  server.close();
  process.exit(0);
})();
