// tmp-battery-tt-caret.js — v0.2.32.0 / FC v10.28.22 文字工具栏输入中恒显电池
// （house CDP 模式；用户「那个工具栏能不能在输入的时候都会一直展示」——卡内输入框
//  光标态（正在输入）也弹工具栏，框选口径不变，标题/搜索/弹层输入框打字不弹）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-ttc-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => { if (e2) { res.writeHead(404); res.end(); return; } res.writeHead(200); res.end(b2); });
      return;
    }
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
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.exceptionDetails || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 300));
      }
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
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(120);
  }
  throw new Error('waitFor 超时: ' + label);
}

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const dropAsset = (asset, label) => cdp.evalJs("(function(){ var dt = new DataTransfer(); dt.setData('text/plain', JSON.stringify({ asset: " + JSON.stringify(asset) + ", label: " + JSON.stringify(label) + " })); window.gridCanvas.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); return true; })()");
    const install = () => cdp.evalJs("(function(){ if (window.__batt) return true; " +
      "window.__ttOn = function(){ var t = document.getElementById('textToolbar'); return !!(t && t.style.display !== 'none' && t.style.visibility !== 'hidden'); };" +
      "window.__focusIn = function(el){ el.focus(); if (typeof el.setSelectionRange === 'function') el.setSelectionRange(0, 0); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; };" +
      "window.__typeIn = function(el, ch){ el.value = (el.value || '') + ch; el.dispatchEvent(new InputEvent('input', { bubbles: true })); document.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true })); return true; };" +
      "window.__selectIn = function(el, a, b){ el.focus(); el.setSelectionRange(a, b); el.dispatchEvent(new Event('select')); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; };" +
      "window.__clickBtn = function(sel){ var b = document.querySelector(sel); if (!b) return false; b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; };" +
      "window.__batt = true; return true; })()");

    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function' && typeof window.createContentCard === 'function'", 'load');
    await dropAsset('flag', 'National Flag');
    await install();
    const tt = () => cdp.evalJs("window.__ttOn()");

    // ── T1: 点进卡内标签输入框（光标态）→ 工具栏显示（本轮核心） ──
    await cdp.evalJs("(function(){ var lab = document.querySelector('.grid-card[data-card-type=\"flag\"] .card-label'); window.__focusIn(lab); return true; })()");
    ok('T1 卡内标签输入框光标态=工具栏显示', await waitFor(cdp, "window.__ttOn()", 3000, 'T1').then(() => true).catch(() => false));

    // ── T2: 连打三键 → 工具栏保持显示 ──
    await cdp.evalJs("(function(){ var lab = document.querySelector('.grid-card[data-card-type=\"flag\"] .card-label'); window.__typeIn(lab, 'x'); window.__typeIn(lab, 'y'); window.__typeIn(lab, 'z'); return true; })()");
    ok('T2 打字中工具栏保持显示', await tt());

    // ── T3: 卡内输入框框选 → 工具栏显示（旧框选口径回归） ──
    await cdp.evalJs("(function(){ var lab = document.querySelector('.grid-card[data-card-type=\"flag\"] .card-label'); window.__selectIn(lab, 0, 3); return true; })()");
    ok('T3 卡内输入框框选=工具栏显示（旧口径）', await waitFor(cdp, "window.__ttOn()", 3000, 'T3').then(() => true).catch(() => false));

    // ── T4: 标题框光标态 → 不弹（防干扰） ──
    await cdp.evalJs("(function(){ var lab = document.querySelector('.grid-card[data-card-type=\"flag\"] .card-label'); lab.blur(); var t = document.getElementById('titleInput'); window.__focusIn(t); return true; })()");
    await sleep(300);
    ok('T4 标题框光标态=不弹（防干扰）', (await tt()) === false);

    // ── T5: 标题框框选 → 弹（任意输入框框选口径不变；先有字——空框 setSelectionRange 被钳成 0..0 光标态） ──
    await cdp.evalJs("(function(){ var t = document.getElementById('titleInput'); t.value = 'Hello World'; window.__selectIn(t, 0, 5); return true; })()");
    ok('T5 标题框框选=弹（旧口径不变）', await waitFor(cdp, "window.__ttOn()", 3000, 'T5').then(() => true).catch(() => false));

    // ── T6: 点画布空白 → 收起 ──
    await cdp.evalJs("(function(){ var t = document.getElementById('titleInput'); t.blur(); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); window.gridCanvas.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()");
    await sleep(300);
    ok('T6 点画布空白=收起', (await tt()) === false);

    // ── T7: 卡内输入框光标态点 B 钮 → 整框加粗（applyInputFmt 光标态可作用） ──
    await cdp.evalJs("(function(){ var lab = document.querySelector('.grid-card[data-card-type=\"flag\"] .card-label'); window.__focusIn(lab); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'T7 show');
    await cdp.evalJs("window.__clickBtn('.text-toolbar [data-fmt=\"bold\"]'); true");
    const bold1 = await cdp.evalJs("(function(){ var lab = document.querySelector('.grid-card[data-card-type=\"flag\"] .card-label'); return parseInt(getComputedStyle(lab).fontWeight, 10) >= 600; })()");
    ok('T7a 光标态点 B 钮=整框加粗', bold1 === true);
    await cdp.evalJs("window.__clickBtn('.text-toolbar [data-fmt=\"bold\"]'); true");
    const bold2 = await cdp.evalJs("(function(){ var lab = document.querySelector('.grid-card[data-card-type=\"flag\"] .card-label'); return parseInt(getComputedStyle(lab).fontWeight, 10) < 600; })()");
    ok('T7b 再点 B 钮=恢复常规', bold2 === true && (await tt()) === true, '工具栏仍显示');

    // ── T8: 数字输入框聚焦 → 不弹（selectionStart null 路径照旧） ──
    await cdp.evalJs("(function(){ var lab = document.querySelector('.grid-card[data-card-type=\"flag\"] .card-label'); lab.blur(); var n = document.createElement('input'); n.type = 'number'; var c = document.querySelector('.grid-card[data-card-type=\"flag\"]'); c.appendChild(n); n.focus(); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await sleep(300);
    ok('T8 数字输入框聚焦=不弹', (await tt()) === false);

    // ── T9: 内容卡文字光标态 → 工具栏显示（v10.28.3.1 路径回归；先有字+显式折叠选区——
    //   空 contenteditable 直接 focus 光标可能落外层卡而非 .card-text-content 内） ──
    await cdp.evalJs("(function(){ var cc = window.createContentCard(0, 14, 8, 4); var txc = cc.querySelector('.card-text-content'); txc.textContent = 'Hello world'; var r = document.createRange(); r.setStart(txc.firstChild, 1); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); txc.focus(); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    ok('T9 内容卡文字光标态=工具栏显示（回归）', await waitFor(cdp, "window.__ttOn()", 3000, 'T9').then(() => true).catch(() => false));

    // ── T10: 版本（静态 v0.2.36.0 + v10.28.26.0 + buildDraft 链；运行时 badge） ──
    const fceSrc = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
    const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
    const verRt = await cdp.evalJs("JSON.stringify({ mn: window.MN_SITE_VERSION, fc: window.FLUIDCANVAS_VERSION, badge: document.body.innerText.indexOf('v10.28.26.0') !== -1 })");
    ok('T10 版本 v0.2.36.0 + FC v10.28.26.0 + buildDraft 链 + 页面徽章',
      sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.36.0';") !== -1 &&
      sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.26.0';") !== -1 &&
      fceSrc.indexOf('v10.28.21.2 adds NO new fields (文字工具栏输入中恒显') !== -1 &&
      JSON.parse(verRt).mn === 'v0.2.36.0' && JSON.parse(verRt).fc === 'v10.28.26.0' && JSON.parse(verRt).badge, verRt);

    // ── Z: 零 console error ──
    await sleep(400);
    ok('Z 零 console error', cdp.errs.length === 0, JSON.stringify(cdp.errs.slice(0, 3)));

    console.log('\n  ── 结果: ' + PASS + '/' + (PASS + FAIL) + (FAIL ? ' ❌' : ' 全绿 ✅'));
    await cdp.close();
    process.exitCode = FAIL ? 1 : 0;
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
