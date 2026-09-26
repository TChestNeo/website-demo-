// tmp-probe-ttpos.js — 复现「content card 输入时工具栏跑到左上角」（实况抓位置数据）
'use strict';
const http = require('http'); const fs = require('fs'); const path = require('path'); const os = require('os');
const { spawn } = require('child_process');
const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-ttp-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') { fs.readFile(file + '.html', (e2, b2) => { if (e2) { res.writeHead(404); res.end(); return; } res.writeHead(200); res.end(b2); }); return; }
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result); }
      else if (m.method === 'Runtime.exceptionThrown') { const d = m.exceptionDetails || {}; this.errs.push(JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200)); }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej, method }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text)); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {} await sleep(120); }
  throw new Error('waitFor 超时: ' + label);
}
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  let chromePath = null;
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe']) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {} await sleep(250); }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable');
    // headless 页面未获焦 → contenteditable focus() 静默失效（电池同款配方）
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}' });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "typeof window.createContentCard === 'function'", 20000, 'editor');
    await sleep(600);

    const snap = async (tag) => {
      const v = await cdp.evalJs("(function(){ var t = document.getElementById('textToolbar'); var r = (function(){ try { var s = window.getSelection(); if (!s.rangeCount) return null; return s.getRangeAt(0).getBoundingClientRect(); } catch (e) { return null; } })(); return JSON.stringify({ tag: " + JSON.stringify(tag) + ", disp: t.style.display, vis: t.style.visibility, left: t.style.left, top: t.style.top, rect: r ? { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null, ae: document.activeElement && (document.activeElement.className || document.activeElement.nodeName) }); })()");
      console.log(v);
    };

    // 场景 1：内容卡光标（电池同款配方：addRange → focus → mouseup）
    await cdp.evalJs("(function(){ var c = window.createContentCard(0, 0, 8, 4); var tx = c.querySelector('.card-text-content'); tx.textContent = 'hello world'; return true; })()");
    await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-type=\"content\"]'); var txc = c.querySelector('.card-text-content'); var r = document.createRange(); if (txc.firstChild && txc.firstChild.nodeType === 3) { r.setStart(txc.firstChild, Math.min(1, txc.firstChild.length)); } else { r.selectNodeContents(txc); } r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); txc.focus(); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    console.log('imm-ae:', await cdp.evalJs("(function(){ var ae = document.activeElement; return JSON.stringify({ ae: ae && (ae.className || ae.nodeName), hasFocus: document.hasFocus(), selOk: !!window.getSelection().rangeCount }); })()"));
    await sleep(300);
    console.log('300ms-ae:', await cdp.evalJs("(function(){ var ae = document.activeElement; return JSON.stringify({ ae: ae && (ae.className || ae.nodeName), hasFocus: document.hasFocus(), selOk: !!window.getSelection().rangeCount }); })()"));
    await snap('caret-in-content');

    // 场景 2a：图后元素级光标（现状，预期矩形退化）
    await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-type=\"content\"]'); var tx = c.querySelector('.card-text-content'); var img = document.createElement('img'); img.className = 'tt-inline-img'; img.alt = 'flag'; img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; tx.appendChild(img); tx.appendChild(document.createTextNode(' after')); var r = document.createRange(); r.setStart(tx, tx.childNodes.length); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await sleep(300);
    await snap('caret-after-img-element');

    // 场景 2b：图后文本节点偏移 0（修复方案 B）
    await cdp.evalJs("(function(){ var tx = document.querySelector('.grid-card[data-card-type=\"content\"] .card-text-content'); var img = tx.querySelector('img.tt-inline-img'); var tn = img.nextSibling; var r = document.createRange(); r.setStart(tn, 0); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await sleep(300);
    await snap('caret-in-textnode-after-img');

    // 场景 2c：图后无文本节点 → 补空文本节点偏移 0（修复方案 C）
    await cdp.evalJs("(function(){ var tx = document.querySelector('.grid-card[data-card-type=\"content\"] .card-text-content'); var img = tx.querySelector('img.tt-inline-img'); img.parentNode.removeChild(img.nextSibling); var pad = document.createTextNode(''); tx.insertBefore(pad, img.nextSibling); var r = document.createRange(); r.setStart(pad, 0); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await sleep(300);
    await snap('caret-in-pad-textnode');

    // 场景 3：模拟打字（input 事件）后
    await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-type=\"content\"]'); var tx = c.querySelector('.card-text-content'); tx.dispatchEvent(new InputEvent('input', { bubbles: true })); document.dispatchEvent(new KeyboardEvent('keyup', { key: 'x', bubbles: true })); return true; })()");
    await sleep(300);
    await snap('after-typing');

    console.log('console errs:', JSON.stringify(cdp.errs));
  } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
  finally { try { cdp && cdp.close(); } catch (e) {} chrome.kill(); server.close(); }
})();
