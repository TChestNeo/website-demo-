// tmp-probe-sheetimg.js — 线上实测「Sheet 卡插图超出表格+不能像文字一样删除」
// （用户报：一添加就超出表格、没办法像文字一样删除；无头新 profile 零缓存连线上站）
'use strict';
const fs = require('fs'); const path = require('path'); const os = require('os');
const { spawn } = require('child_process');
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-shimg-' + Date.now());
const LIVE = 'https://mnationworld.com';

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result); }
      else if (m.method === 'Runtime.exceptionThrown') { const d = m.exceptionDetails || {}; this.errs.push(JSON.stringify({ text: d.text, url: (d.url || '').slice(-60), line: d.lineNumber }).slice(0, 200)); }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej, method }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text)); return r.result.value; }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {} await sleep(150); }
  throw new Error('waitFor 超时: ' + label);
}
// 真键盘按键（合成 DOM KeyboardEvent 不会触发 contenteditable 原生编辑）
async function realKey(cdp, key, vk, code) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: key, code: code || key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: key, code: code || key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
}
// 真鼠标点击元素中心（Input 域）
async function realClick(cdp, elExpr) {
  const p = await cdp.evalJs("(function(){ var el = " + elExpr + "; if (!el) return null; var r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()");
  if (!p) return false;
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  return true;
}

(async () => {
  let chromePath = null;
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe']) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + USER_DATA, 'about:blank'], { stdio: 'ignore' });
  let cdp;
  try {
    for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {} await sleep(250); }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}' });
    await cdp.send('Page.navigate', { url: LIVE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "typeof window.createSheetCard === 'function' && typeof window.createContentCard === 'function'", 30000, 'editor load');
    await sleep(800);

    // 现场 helper
    await cdp.evalJs("(function(){ window.__ttOn = function(){ var t = document.getElementById('textToolbar'); return !!(t && t.style.display !== 'none' && t.style.visibility !== 'hidden'); }; " +
      "window.__popOn = function(){ var p = document.getElementById('ttImgPop'); return !!(p && p.classList.contains('active')); }; " +
      "window.__clickBtn = function(sel){ var b = document.querySelector(sel); if (!b) return false; b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }; " +
      "window.__meas = function(){ var sc = document.querySelectorAll('.grid-card[data-card-type=\"sheet\"]'); var last = sc[sc.length - 1]; var img = last && last.querySelector('img.tt-inline-img'); if (!img) return null; var ir = img.getBoundingClientRect(); var cell = img.closest('.sheet-cell'); var cr = cell.getBoundingClientRect(); var td = img.closest('.sheet-cell-td'); var tr = td.getBoundingClientRect(); var cs = getComputedStyle(img); var cfs = getComputedStyle(cell); return JSON.stringify({ imgW: Math.round(ir.width), imgH: Math.round(ir.height), cellW: Math.round(cr.width), cellH: Math.round(cr.height), tdH: Math.round(tr.height), overflowX: ir.left < cr.left - 1 || ir.right > cr.right + 1, overflowY: ir.top < cr.top - 1 || ir.bottom > cr.bottom + 1, imgCsH: cs.height, imgCsW: cs.width, cellFont: cfs.fontSize, ver: window.FLUIDCANVAS_VERSION }); }; " +
      "window.__imgCount = function(){ return document.querySelectorAll('.grid-card img.tt-inline-img').length; }; " +
      "return true; })()");

    // ── S1: 新 Sheet 卡 → 点进正文格 → 弹层点国旗格插图 → 量矩形 ──
    console.log('── S1 表格格插图（默认字号）──');
    await cdp.evalJs("(function(){ var sc = window.createSheetCard(0, 0, 10, 7); var cell = sc.querySelector('.sheet-body-row .sheet-cell'); cell.value = 'hello'; cell.focus(); cell.setSelectionRange(0, 0); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 4000, 'S1 toolbar');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 4000, 'S1 pop');
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile'); true");
    await waitFor(cdp, "!!(document.querySelector('.grid-card[data-card-type=\"sheet\"] img.tt-inline-img'))", 5000, 'S1 img');
    await sleep(400);
    console.log('  S1 测量:', await cdp.evalJs("window.__meas()"));

    // ── S2: 删除测试矩阵（真键盘事件）——表格格 vs 内容卡各 3 种姿势 ──
    console.log('── S2 删除测试矩阵 ──');
    const delTest = async (label, scope) => {
      // 前置：确保 scope 里正好 1 张图（多张时先清到剩 0 再插 1）
      const n0 = await cdp.evalJs("(function(){ return " + scope + ".querySelectorAll('img.tt-inline-img').length; })()");
      await cdp.evalJs("(function(){ var imgs = " + scope + ".querySelectorAll('img.tt-inline-img'); for (var i = 0; i < imgs.length; i++) imgs[i].parentNode.removeChild(imgs[i]); return true; })()");
      // 插入一张新图（走真实 insertInlineImage 路径需要弹层——直接程序化插同结构图）
      await cdp.evalJs("(function(){ var sc = " + scope + "; var host = sc.querySelector('.sheet-cell') || sc.querySelector('.card-text-content'); var img = document.createElement('img'); img.className = 'tt-inline-img'; img.alt = 't'; img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; host.appendChild(document.createTextNode('X')); host.appendChild(img); host.appendChild(document.createTextNode('Y')); return true; })()");
      const count = () => cdp.evalJs("(function(){ return " + scope + ".querySelectorAll('img.tt-inline-img').length; })()");
      let out = [];
      // V1: 光标图后（文本节点偏移 0）→ Backspace
      await cdp.evalJs("(function(){ var sc = " + scope + "; var host = sc.querySelector('.sheet-cell') || sc.querySelector('.card-text-content'); var img = host.querySelector('img.tt-inline-img'); host.focus(); var r = document.createRange(); r.setStart(img.nextSibling, 0); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
      await realKey(cdp, 'Backspace', 8, 'Backspace'); await sleep(300);
      out.push('V1 光标图后+Backspace: ' + (await count() === 0 ? '✅删' : '❌在'));
      if (await count() !== 0) await cdp.evalJs("(function(){ var imgs = " + scope + ".querySelectorAll('img.tt-inline-img'); for (var i = 0; i < imgs.length; i++) imgs[i].parentNode.removeChild(imgs[i]); return true; })()");
      // V2: 光标图前（元素级 endOffset=img 前一位）→ Delete
      await cdp.evalJs("(function(){ var sc = " + scope + "; var host = sc.querySelector('.sheet-cell') || sc.querySelector('.card-text-content'); var img = host.querySelector('img.tt-inline-img'); host.focus(); var kids = host.childNodes; var idx = 0; while (kids[idx] !== img) idx++; var r = document.createRange(); r.setStart(host, idx); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
      await realKey(cdp, 'Delete', 46, 'Delete'); await sleep(300);
      out.push('V2 光标图前+Delete: ' + (await count() === 0 ? '✅删' : '❌在'));
      if (await count() !== 0) await cdp.evalJs("(function(){ var imgs = " + scope + ".querySelectorAll('img.tt-inline-img'); for (var i = 0; i < imgs.length; i++) imgs[i].parentNode.removeChild(imgs[i]); return true; })()");
      // V3: 真鼠标点图中心 → 看选区/焦点 → Backspace → 再 Delete
      await realClick(cdp, scope + ".querySelector('img.tt-inline-img')");
      await sleep(300);
      const selInfo = await cdp.evalJs("(function(){ var s = window.getSelection(); var rg = s.rangeCount ? s.getRangeAt(0) : null; return JSON.stringify({ collapsed: !!(rg && rg.collapsed), ae: document.activeElement && (document.activeElement.className || document.activeElement.nodeName), selNode: rg && rg.startContainer ? (rg.startContainer.nodeName || '') : null }); })()");
      await realKey(cdp, 'Backspace', 8, 'Backspace'); await sleep(250);
      const afterBk = await count();
      await realKey(cdp, 'Delete', 46, 'Delete'); await sleep(250);
      const afterDel = await count();
      out.push('V3 点图+Backspace/Delete: ' + (afterBk === 0 ? '✅删' : (afterDel === 0 ? '✅删(Delete)' : '❌在')) + ' 选区=' + selInfo);
      console.log('  ' + label + ':', out.join(' | '));
    };
    await delTest('S2 表格格', "document.querySelector('.grid-card[data-card-type=\"sheet\"]')");

    // ── S3: 内容卡对照——插图 + Backspace ──
    console.log('── S3 内容卡对照 ──');
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
    await cdp.evalJs("(function(){ var cc = window.createContentCard(0, 14, 8, 4); var tx = cc.querySelector('.card-text-content'); tx.textContent = 'hello'; var r = document.createRange(); if (tx.firstChild && tx.firstChild.nodeType === 3) r.setStart(tx.firstChild, 0); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); tx.focus(); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 4000, 'S3 toolbar');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 4000, 'S3 pop');
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile'); true");
    await waitFor(cdp, "!!(document.querySelector('.grid-card[data-card-type=\"content\"] img.tt-inline-img'))", 5000, 'S3 img');
    await delTest('S3 内容卡对照', "document.querySelector('.grid-card[data-card-type=\"content\"]')");

    // ── S4: 表格格先把字号调大（24）再插图 → 图高应 36 → 溢出测量 ──
    console.log('── S4 格字号 24 后插图 ──');
    await cdp.evalJs("(function(){ var sc = window.createSheetCard(0, 22, 10, 7); var cell = sc.querySelector('.sheet-body-row .sheet-cell'); cell.value = 'big text'; cell.focus(); cell.setSelectionRange(0, 0); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 4000, 'S4 toolbar');
    await cdp.evalJs("window.setFontSize(24); true");
    await sleep(200);
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 4000, 'S4 pop');
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile'); true");
    await waitFor(cdp, "document.querySelectorAll('.grid-card[data-card-type=\"sheet\"] img.tt-inline-img').length >= 2", 5000, 'S4 img');
    await sleep(400);
    console.log('  S4 测量:', await cdp.evalJs("window.__meas()"));

    // ── S5: 富文本格选区改字号（24→32）→ 图应 48（跟随文本大小） ──
    console.log('── S5 插图后选区改字号 ──');
    await cdp.evalJs("(function(){ var scs = document.querySelectorAll('.grid-card[data-card-type=\"sheet\"]'); var rich = scs[scs.length - 1].querySelector('.sheet-cell[data-rich=\"1\"]'); var r = document.createRange(); r.selectNodeContents(rich); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); window.setFontSize(32); return true; })()");
    await sleep(400);
    console.log('  S5 测量:', await cdp.evalJs("window.__meas()"));

    console.log('  console errs:', cdp.errs.length ? JSON.stringify(cdp.errs.slice(0, 5)) : '0');
  } catch (e) { console.error('FAIL:', e.message); process.exitCode = 1; }
  finally { try { cdp && cdp.close(); } catch (e) {} chrome.kill(); try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {} }
})();
