// tmp-probe-artview.js — C1 红排查探针：dump 查看器几何实况（临时，不入库）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-probe-artview-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  const file = path.join(DOCS, p === '/' ? '/index.html' : p);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
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
      if (m.id && this.pending.has(m.id)) { const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); }
      else if (m.method === 'Page.javascriptDialogOpening') { this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); }
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
const FIXTURE_CONTENT = {
  v: 9, title: 'Cloud Constitution', tags: [],
  cards: [
    { id: 'c1', type: 'content', col: 2, row: 2, colSpan: 10, rowSpan: 6, content: '<p><b>Cloud Constitution</b> — body.</p>', bgAlpha: 0, baseFontSize: 14 },
    { id: 'c2', type: 'flag', label: 'Fixture Flag', col: 4, row: 10, colSpan: 12, rowSpan: 7, imgSrc: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20360%22%3E%3Crect%20width%3D%22600%22%20height%3D%22180%22%20fill%3D%22%232E5BFF%22%2F%3E%3Crect%20y%3D%22180%22%20width%3D%22600%22%20height%3D%22180%22%20fill%3D%22%23FFFFFF%22%2F%3E%3C%2Fsvg%3E' },
    { id: 'c3', type: 'text', label: 'OOB-Right', col: 38, row: 3, colSpan: 12, rowSpan: 7, content: 'right edge beyond grid', background: 'rgba(220,38,38,0.15)' },
    { id: 'c4', type: 'text', label: 'OOB-Bottom', col: 2, row: 98, colSpan: 8, rowSpan: 8, content: 'bottom edge beyond grid', background: 'rgba(46,91,255,0.15)' }
  ],
  settings: { snapOn: true, alignOn: true }, activePreset: '169', presets: {}, groupStyles: {}, pageBg: null, lastSaved: 1750000000000
};
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
  '   return Promise.resolve(new Response(JSON.stringify({ articles: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80 && !up; i++) { try { if ((await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version')).ok) up = true; } catch (e) {} await sleep(250); }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const cdp = new CDP(pages.find(x => x.type === 'page').webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}' });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html?article=ART-CLOUD-1' });
    await sleep(3500);
    console.log(await cdp.evalJs('JSON.stringify({ cols: (window.currentCols !== undefined ? window.currentCols : "私有"), cell: (typeof getCellSize === "function" ? getCellSize() : "私有"), bodyRect: (function(){var b=document.querySelector(".editor-body");var r=b.getBoundingClientRect();return {w:r.width,h:r.height};})(), scalerRect: (function(){var s=document.getElementById("fcViewScaler");var r=s.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,w:r.width,h:r.height};})(), scalerStyle: (function(){var s=document.getElementById("fcViewScaler");return {w:s.style.width,h:s.style.height};})(), canvasStyle: (function(){var c=document.getElementById("gridCanvas");return {w:c.style.width,h:c.style.height,transform:c.style.transform,left:c.style.left,top:c.style.top};})(), canvasRect: (function(){var r=document.getElementById("gridCanvas").getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};})(), cards: Array.prototype.map.call(document.querySelectorAll(".grid-card"), function(c){var r=c.getBoundingClientRect();return {id:c.dataset.cardId,left:c.style.left,top:c.style.top,w:c.style.width,h:c.style.height,rectL:r.left.toFixed(1),rectR:r.right.toFixed(1),rectT:r.top.toFixed(1),rectB:r.bottom.toFixed(1)};}) }, null, 1)'));
    cdp.close();
  } catch (e) { console.error('💥 ' + (e.stack || e.message)); process.exitCode = 1; }
  try { chrome.kill(); } catch (e) {}
  server.close();
})();
