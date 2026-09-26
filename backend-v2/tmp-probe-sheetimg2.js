// tmp-probe-sheetimg2.js — 本地（同盘文件=部署代码）实测 Sheet 格插图删除 + 大字溢出
// 加固：CDP.send 每条 20s 超时（上次挂死=send 无超时）；全局 150s watchdog 强制退出
// 主逻辑全住页面侧 helper（避免 Node 侧字符串拼接出错——A 段已证页面侧模式可靠）
'use strict';
const http = require('http'); const fs = require('fs'); const path = require('path'); const os = require('os');
const { spawn } = require('child_process');
const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4951, CDP_PORT = 5951;
const USER_DATA = path.join(os.tmpdir(), 'mn-shimg2-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
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
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method, timer } = this.pending.get(m.id); this.pending.delete(m.id); clearTimeout(timer);
        m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.exceptionDetails || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description }).slice(0, 300));
      }
    };
  }
  send(method, params, t) {
    t = t || 20000;
    return new Promise((res, rej) => {
      const id = ++this.id;
      const timer = setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('TIMEOUT ' + method)); } }, t);
      this.pending.set(id, { res, rej, method, timer });
      try { this.ws.send(JSON.stringify({ id, method, params: params || {} })); } catch (e) { clearTimeout(timer); this.pending.delete(id); rej(e); }
    });
  }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {} await sleep(150); }
  throw new Error('waitFor 超时: ' + label);
}
async function realKey(cdp, key, vk, code) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: key, code: code || key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: key, code: code || key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
}
async function realClick(cdp, x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x, y: y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x, y: y, button: 'left', clickCount: 1 });
}

// 全局 watchdog：无论卡哪都 150s 后强制收尾退出
const watchdog = setTimeout(() => { console.error('FAIL: 全局 150s watchdog'); process.exit(1); }, 150000);

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1366,768',
    '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let cdp;
  try {
    for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {} await sleep(250); }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    cdp = new CDP(pages.find(x => x.type === 'page').webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}' });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "typeof window.createSheetCard === 'function' && typeof window.createContentCard === 'function'", 30000, 'editor load');
    await sleep(600);

    // 页面侧 helper 全家（主逻辑全住页面，Node 侧只调函数）
    await cdp.evalJs("(function(){ " +
      "window.__clickBtn = function(sel){ var b = document.querySelector(sel); if (!b) return false; b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }; " +
      "window.__SHEET = '.grid-card[data-card-type=\"sheet\"]'; window.__CONTENT = '.grid-card[data-card-type=\"content\"]'; " +
      "window.__sh = {}; " +
      "window.__sh.card = function(k){ var all = document.querySelectorAll(k === 'sheet' ? window.__SHEET : window.__CONTENT); return all[all.length - 1]; }; " +
      "window.__sh.host = function(k){ var sc = window.__sh.card(k); var img = sc.querySelector('img.tt-inline-img'); if (img) return img.parentNode; return sc.querySelector('.sheet-body-row .sheet-cell') || sc.querySelector('.card-text-content'); }; " +
      "window.__sh.hostInfo = function(k){ var h = window.__sh.host(k); return JSON.stringify({ tag: h.tagName, cls: h.className, ceAttr: h.getAttribute('contenteditable'), isCE: !!h.isContentEditable, inDoc: !!h.isConnected, aeTag: document.activeElement ? document.activeElement.tagName : null, aeCls: document.activeElement ? (document.activeElement.className || '') : null }); }; " +
      "window.__sh.count = function(k){ var sc = window.__sh.card(k); return sc.querySelectorAll('img.tt-inline-img').length; }; " +
      "window.__sh.reset = function(k){ var host = window.__sh.host(k); var imgs = host.querySelectorAll('img.tt-inline-img'); for (var i = 0; i < imgs.length; i++) imgs[i].parentNode.removeChild(imgs[i]); while (host.firstChild) host.removeChild(host.firstChild); var img = document.createElement('img'); img.className = 'tt-inline-img'; img.alt = 't'; img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; host.appendChild(document.createTextNode('X')); host.appendChild(img); host.appendChild(document.createTextNode('Y')); host.focus(); return true; }; " +
      "window.__sh.caretAfterImg = function(k){ var host = window.__sh.host(k); var img = host.querySelector('img.tt-inline-img'); host.focus(); var r = document.createRange(); r.setStart(img.nextSibling, 0); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); return true; }; " +
      "window.__sh.caretBeforeImg = function(k){ var host = window.__sh.host(k); var img = host.querySelector('img.tt-inline-img'); host.focus(); var kids = host.childNodes; var idx = 0; while (kids[idx] !== img) idx++; var r = document.createRange(); r.setStart(host, idx); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); return true; }; " +
      "window.__sh.imgOnlyCaretAfter = function(k){ var host = window.__sh.host(k); var imgs = host.querySelectorAll('img.tt-inline-img'); for (var i = 0; i < imgs.length; i++) imgs[i].parentNode.removeChild(imgs[i]); while (host.firstChild) host.removeChild(host.firstChild); var img = document.createElement('img'); img.className = 'tt-inline-img'; img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; host.appendChild(img); host.focus(); var r = document.createRange(); r.setStartAfter(img); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); return true; }; " +
      "window.__sh.aeInfo = function(){ var ae = document.activeElement; return JSON.stringify({ tag: ae ? ae.tagName : null, cls: ae ? (ae.className || '') : null, isCE: ae ? !!ae.isContentEditable : false }); }; " +
      "window.__sh.hostHtml = function(k){ var h = window.__sh.host(k); return h.innerHTML.slice(0, 120); }; " +
      "window.__sh.imgCenter = function(k){ var sc = window.__sh.card(k); var el = sc.querySelector('img.tt-inline-img'); if (!el) return null; var r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }; " +
      "window.__sh.selInfo = function(k){ var s = window.getSelection(); var rg = s.rangeCount ? s.getRangeAt(0) : null; return JSON.stringify({ aeIsHost: document.activeElement === window.__sh.host(k), collapsed: !!(rg && rg.collapsed), sc: rg && rg.startContainer ? (rg.startContainer.nodeName || '') : null }); }; " +
      "window.__sh.meas = function(k){ var sc = window.__sh.card(k); var img = sc.querySelector('img.tt-inline-img'); if (!img) return null; var ir = img.getBoundingClientRect(); var cell = img.closest('.sheet-cell'); var cr = cell.getBoundingClientRect(); return JSON.stringify({ imgW: Math.round(ir.width), imgH: Math.round(ir.height), cellW: Math.round(cr.width), cellH: Math.round(cr.height), overflowX: ir.left < cr.left - 1 || ir.right > cr.right + 1, font: getComputedStyle(cell).fontSize }); }; " +
      "return true; })()");

    // 插入一张图进 sheet 卡正文格（走真实按钮路径）
    const insertIntoSheet = async (label) => {
      await cdp.evalJs("(function(){ var sc = window.createSheetCard(0, 0, 10, 7); var cell = sc.querySelector('.sheet-body-row .sheet-cell'); cell.value = 'hello'; cell.focus(); cell.setSelectionRange(0, 0); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
      await waitFor(cdp, "document.getElementById('textToolbar') && document.getElementById('textToolbar').style.display !== 'none'", 4000, label + ' toolbar');
      await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
      await waitFor(cdp, "document.getElementById('ttImgPop') && document.getElementById('ttImgPop').classList.contains('active')", 4000, label + ' pop');
      await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile'); true");
      await waitFor(cdp, "window.__sh.count('sheet') >= 1", 5000, label + ' img');
    };

    // ── A: sheet 格默认字号插图 → 测量 ──
    console.log('── A sheet 默认字号插图 ──');
    await insertIntoSheet('A');
    await sleep(300);
    console.log('  A 测量:', await cdp.evalJs("window.__sh.meas('sheet')"));

    // ── B: 删除矩阵（真键盘） ──
    console.log('── B 删除矩阵 ──');
    const delTest = async (label, k) => {
      const out = [];
      await cdp.evalJs("window.__sh.reset('" + k + "')");
      console.log('    hostInfo: ' + await cdp.evalJs("window.__sh.hostInfo('" + k + "')"));
      await cdp.evalJs("window.__sh.caretAfterImg('" + k + "')");
      console.log('    ae after focus: ' + await cdp.evalJs("window.__sh.aeInfo()"));
      await cdp.evalJs("document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); true");
      console.log('    ae after mouseup: ' + await cdp.evalJs("window.__sh.aeInfo()"));
      await realKey(cdp, 'Backspace', 8, 'Backspace'); await sleep(250);
      const n1 = await cdp.evalJs("window.__sh.count('" + k + "')");
      out.push('V1图后+Backspace:' + (n1 === 0 ? '✅删' : '❌在') + ' html=' + await cdp.evalJs("window.__sh.hostHtml('" + k + "')"));
      await cdp.evalJs("window.__sh.reset('" + k + "')");
      await cdp.evalJs("window.__sh.caretBeforeImg('" + k + "')");
      await cdp.evalJs("document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); true");
      await realKey(cdp, 'Delete', 46, 'Delete'); await sleep(250);
      out.push('V2图前+Delete:' + (await cdp.evalJs("window.__sh.count('" + k + "')") === 0 ? '✅删' : '❌在'));
      await cdp.evalJs("window.__sh.reset('" + k + "')");
      const p = await cdp.evalJs("window.__sh.imgCenter('" + k + "')");
      await realClick(cdp, p.x, p.y); await sleep(250);
      const selInfo = await cdp.evalJs("window.__sh.selInfo('" + k + "')");
      await realKey(cdp, 'Backspace', 8, 'Backspace'); await sleep(250);
      const afterBk = await cdp.evalJs("window.__sh.count('" + k + "')");
      await realKey(cdp, 'Delete', 46, 'Delete'); await sleep(250);
      const afterDel = await cdp.evalJs("window.__sh.count('" + k + "')");
      out.push('V3点图+Back/Delete:' + (afterBk === 0 ? '✅删' : (afterDel === 0 ? '✅删(Delete)' : '❌在')) + ' 焦点/选区=' + selInfo);
      await cdp.evalJs("window.__sh.imgOnlyCaretAfter('" + k + "')");
      await realKey(cdp, 'Backspace', 8, 'Backspace'); await sleep(250);
      out.push('V5仅图+Backspace:' + (await cdp.evalJs("window.__sh.count('" + k + "')") === 0 ? '✅删' : '❌在'));
      console.log('  ' + label + ': ' + out.join(' | '));
    };
    await delTest('B sheet 格', 'sheet');

    // ── C: content 卡对照（同样矩阵） ──
    console.log('── C content 卡对照 ──');
    await cdp.evalJs("(function(){ var cc = window.createContentCard(0, 14, 8, 4); var tx = cc.querySelector('.card-text-content'); tx.textContent = 'hello'; var r = document.createRange(); r.setStart(tx.firstChild, 0); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); tx.focus(); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await waitFor(cdp, "document.getElementById('textToolbar') && document.getElementById('textToolbar').style.display !== 'none'", 4000, 'C toolbar');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "document.getElementById('ttImgPop') && document.getElementById('ttImgPop').classList.contains('active')", 4000, 'C pop');
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile'); true");
    await waitFor(cdp, "window.__sh.count('content') >= 1", 5000, 'C img');
    await delTest('C content 卡', 'content');

    // ── D: 大字溢出复现（font 32 选区改字号；先补回一张图） ──
    console.log('── D 大字溢出 ──');
    await cdp.evalJs("window.__sh.reset('sheet')");
    await cdp.evalJs("(function(){ var scs = document.querySelectorAll(window.__SHEET); var rich = scs[scs.length - 1].querySelector('.sheet-cell[data-rich=\"1\"]'); var r = document.createRange(); r.selectNodeContents(rich); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); window.setFontSize(32); return true; })()");
    await sleep(300);
    console.log('  D 测量:', await cdp.evalJs("window.__sh.meas('sheet')"));

    console.log('  console errs:', cdp.errs.length ? JSON.stringify(cdp.errs.slice(0, 5)) : '0');
  } catch (e) { console.error('FAIL:', e.message); process.exitCode = 1; }
  finally {
    clearTimeout(watchdog);
    try { cdp && cdp.close(); } catch (e) {}
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
    server.close();
  }
})();
