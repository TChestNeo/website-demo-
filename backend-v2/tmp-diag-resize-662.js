// tmp-diag-resize-662.js — 复现左边缘手柄(w)拖拽：看宽度/高度如何变化 + 手柄可见性
'use strict';
const fs = require('fs'); const path = require('path'); const os = require('os'); const { spawn } = require('child_process');
const PORT = 4800 + Math.floor(Math.random() * 400); const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-rs-' + Date.now()); const DOCS = path.resolve(__dirname, '..', 'docs');
const EDITOR_URL_PATH = '/pages/fluidcanvas-editor.html';
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, e, t, l) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + e + ')')) return true; } catch (x) {} await sleep(150); } throw new Error('waitFor:' + l); }
class CDP {
  constructor(u) { this.u = u; this.id = 0; this.p = new Map(); }
  async connect() { this.w = new WebSocket(this.u); await new Promise((r, j) => { this.w.onopen = r; this.w.onerror = () => j(new Error('ws')); }); this.w.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.p.has(m.id)) { const { r, j } = this.p.get(m.id); this.p.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); } }; }
  send(m, p) { return new Promise((r, j) => { const id = ++this.id; this.p.set(id, { r, j }); this.w.send(JSON.stringify({ id, method: m, params: p || {} })); }); }
  async evalJs(x) { const r = await this.send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = require('http').createServer((req, res) => { let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html'; let f = path.join(DOCS, u); if (!fs.existsSync(f) && !path.extname(f)) { if (fs.existsSync(f + '.html')) f += '.html'; } if (!fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const SESSION = 'try{(function(){ localStorage.setItem("slati_session","{\\"loggedIn\\":true}"); localStorage.setItem("slati_user",JSON.stringify({id:"USR-000101",displayName:"探针",tier:"premium"})); localStorage.setItem("slati_lang","zh-CN"); try{localStorage.removeItem("slati_fluidcanvas_draft");}catch(e){} })();}catch(e){}';
const READY = "document.getElementById('gridCanvas') && window.createAssetCard && window.beginResize && window.isAspectLocked";
const FAKE = "{clientX:0,clientY:0,button:0,stopPropagation:function(){},preventDefault:function(){}}";
(async () => {
  await new Promise(r => server.listen(PORT, r)); const BASE = 'http://127.0.0.1:' + PORT;
  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const chrome = spawn(chromePath, ['--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  let cdp = null;
  try {
    let up = false; for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    if (!up) throw new Error('CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json(); const page = pages.find(x => x.type === 'page');
    cdp = new CDP(page.webSocketDebuggerUrl); await cdp.connect(); await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION }); await cdp.send('Page.navigate', { url: BASE + EDITOR_URL_PATH + '?prem' });
    await waitFor(cdp, READY, 40000, 'ready'); await sleep(900);
    // 单张文本卡（非锁定）——左边缘 w 拖拽
    await cdp.evalJs("(function(){ window.createAssetCard('text','A',2,2,6,4); })()"); await sleep(400);
    await cdp.evalJs("(function(){ var c=document.querySelector('#gridCanvas .grid-card[data-label=\"A\"]'); window.selectCard(c,true); })()"); await sleep(300);
    const vis1 = await cdp.evalJs("(function(){ var hs=document.querySelectorAll('.resize-handle'); var o={}; hs.forEach(function(h){ o[h.dataset.dir]=getComputedStyle(h).display; }); return o; })()");
    const sz1 = await cdp.evalJs("(function(){ var c=document.querySelector('#gridCanvas .grid-card[data-label=\"A\"]'); return {w:c.offsetWidth,h:c.offsetHeight}; })()");
    await cdp.evalJs("(function(){ window.beginResize(" + FAKE + ", 'w'); })()");
    await cdp.evalJs("document.dispatchEvent(new MouseEvent('mousemove', {clientX: 100, clientY: 0}));"); await sleep(200);
    const sz1b = await cdp.evalJs("(function(){ var c=document.querySelector('#gridCanvas .grid-card[data-label=\"A\"]'); return {w:c.offsetWidth,h:c.offsetHeight}; })()");
    await cdp.evalJs("document.dispatchEvent(new MouseEvent('mouseup', {}));"); await sleep(200);
    console.log('单文本卡 手柄可见: ' + JSON.stringify(vis1));
    console.log('单文本卡 w 拖拽: 前 ' + JSON.stringify(sz1) + ' → 后 ' + JSON.stringify(sz1b));
    // 单张国旗卡带图（锁定）——手柄可见性
    await cdp.evalJs("(function(){ window.createAssetCard('flag','F',2,8,4,4); })()"); await sleep(400);
    await cdp.evalJs("(function(){ var c=document.querySelector('#gridCanvas .grid-card[data-label=\"F\"]'); window.setCardImage(c," + JSON.stringify(PNG_1PX) + ",'F'); })()"); await sleep(600);
    await cdp.evalJs("(function(){ var c=document.querySelector('#gridCanvas .grid-card[data-label=\"F\"]'); window.selectCard(c,true); })()"); await sleep(300);
    const lock = await cdp.evalJs("(function(){ var c=document.querySelector('#gridCanvas .grid-card[data-label=\"F\"]'); var hs=document.querySelectorAll('.resize-handle'); var o={locked:window.isAspectLocked(c)}; hs.forEach(function(h){ o[h.dataset.dir]=getComputedStyle(h).display; }); return o; })()");
    console.log('国旗卡(带图) 锁定/手柄: ' + JSON.stringify(lock));
  } catch (e) { console.log('  💥 ' + (e && e.message)); }
  finally { try { cdp && cdp.w.close(); } catch (e) {} try { server.close(); } catch (e) {} try { require('child_process').spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {} (() => { for (let i = 0; i < 15; i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const t = Date.now(); while (Date.now() - t < 200) {} } } })(); }
})();
