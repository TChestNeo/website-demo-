// tmp-diag-merge-662.js — 验证左右合并改底对齐后，两张不同高度卡底边平齐
'use strict';
const fs = require('fs'); const path = require('path'); const os = require('os'); const { spawn } = require('child_process');
const PORT = 4800 + Math.floor(Math.random() * 400); const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-mrg-' + Date.now()); const DOCS = path.resolve(__dirname, '..', 'docs');
const EDITOR_URL_PATH = '/pages/fluidcanvas-editor.html';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, e, t, l) { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (await cdp.evalJs('!!(' + e + ')')) return true; } catch (x) {} await sleep(150); } throw new Error('waitFor:' + l); }
class CDP {
  constructor(u) { this.u = u; this.id = 0; this.p = new Map(); this.errs = []; }
  async connect() { this.w = new WebSocket(this.u); await new Promise((r, j) => { this.w.onopen = r; this.w.onerror = () => j(new Error('ws')); }); this.w.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.p.has(m.id)) { const { r, j } = this.p.get(m.id); this.p.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); } else if (m.method === 'Runtime.exceptionThrown') { this.errs.push((m.exceptionDetails && m.exceptionDetails.text) || 'exc'); } }; }
  send(m, p) { return new Promise((r, j) => { const id = ++this.id; this.p.set(id, { r, j }); this.w.send(JSON.stringify({ id, method: m, params: p || {} })); }); }
  async evalJs(x) { const r = await this.send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = require('http').createServer((req, res) => { let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html'; let f = path.join(DOCS, u); if (!fs.existsSync(f) && !path.extname(f)) { if (fs.existsSync(f + '.html')) f += '.html'; } if (!fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const SESSION = 'try{(function(){ localStorage.setItem("slati_session","{\\"loggedIn\\":true}"); localStorage.setItem("slati_user",JSON.stringify({id:"USR-000101",displayName:"探针",tier:"premium"})); localStorage.setItem("slati_lang","zh-CN"); try{localStorage.removeItem("slati_fluidcanvas_draft");}catch(e){} })();}catch(e){}';
const READY = "document.getElementById('gridCanvas') && window.createAssetCard && window.mergeCards";
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
    // 建两张不同高度的卡：A 高 4 格、B 高 6 格
    await cdp.evalJs("(function(){ window.createAssetCard('text','A',2,2,6,4); window.createAssetCard('text','B',20,20,4,6); })()"); await sleep(500);
    const before = await cdp.evalJs("(function(){ var a=document.querySelector('#gridCanvas .grid-card[data-label=\"A\"]'); var b=document.querySelector('#gridCanvas .grid-card[data-label=\"B\"]'); return { aH:a.offsetHeight, bH:b.offsetHeight, aT:parseFloat(a.style.top), bT:parseFloat(b.style.top) }; })()");
    // 直接调用合并（B 并入 A 的右侧）
    await cdp.evalJs("(function(){ var a=document.querySelector('#gridCanvas .grid-card[data-label=\"A\"]'); var b=document.querySelector('#gridCanvas .grid-card[data-label=\"B\"]'); window.mergeCards(b, a, 'right'); })()"); await sleep(500);
    const after = await cdp.evalJs("(function(){ var a=document.querySelector('#gridCanvas .grid-card[data-label=\"A\"]'); var b=document.querySelector('#gridCanvas .grid-card[data-label=\"B\"]'); var aT=parseFloat(a.style.top), aH=a.offsetHeight, bT=parseFloat(b.style.top), bH=b.offsetHeight; return { aTop:aT, aBottom:aT+aH, bTop:bT, bBottom:bT+bH, aH:aH, bH:bH, diff:Math.round((aT+aH)-(bT+bH)*100)/100 }; })()");
    console.log('合并前: ' + JSON.stringify(before));
    console.log('合并后: ' + JSON.stringify(after));
    console.log('底边差(diff, 应≈0): ' + after.diff);
    console.log('异常: ' + JSON.stringify(cdp.errs.slice(0, 3)));
  } catch (e) { console.log('  💥 ' + (e && e.message)); }
  finally { try { cdp && cdp.w.close(); } catch (e) {} try { server.close(); } catch (e) {} try { require('child_process').spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {} (() => { for (let i = 0; i < 15; i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const t = Date.now(); while (Date.now() - t < 200) {} } } })(); }
})();
