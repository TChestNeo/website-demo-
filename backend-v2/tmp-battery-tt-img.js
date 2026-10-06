// tmp-battery-tt-img.js — v0.2.35.0 / FC v10.28.25 电池（v0.2.34.1 轮 30/30 基础上：
//  新增 T23 点击内联图=整图选中+Delete 即删（用户「没办法像文字一样删除」）+
//  T24 大字号宽图不溢出表格格（用户「一添加它的大小就已经超出了表格」）；
//  v0.2.34.1 轮=扩展 T16 表格格图高=1.5em 断言 + T22 工具栏不跳左上角；
//  v0.2.34.0 轮=图像插进任何可打字处（卡内输入框第一次插图现场升级富文本 span）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-tti-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  // v0.2.33.0: 维基图库搜索罐头（window.FC_IMG_SEARCH_API 打桩指向这里）——
  // 3 页：缩略正常 / 缩略 404（坏图格自动隐去）/ 无 imageinfo（被过滤）。
  // 按查询词出不同 URL 后缀——真实维基图库不同搜索本就返回不同文件；固定 URL 会踩
  // Chrome 负面缓存（探针实证：同一坏图 URL 第二次请求根本不发出、img 永远
  // complete:false 且不触发 error，格不隐去）
  if (p === '/commons-api') {
    const host = req.headers.host;
    const qs = Object.fromEntries(req.url.split('?')[1].split('&').map(function (kv) { const p2 = kv.split('='); return [p2[0], decodeURIComponent(p2[1] || '')]; }));
    const suffix = qs.gsrsearch === 'emblem' ? '-2' : '';
    const pages = {
      '100': { pageid: 100, index: 2, title: 'File:Crown of Slati.svg', imageinfo: [{ url: 'http://' + host + '/commons-full1' + suffix + '.png', thumburl: 'http://' + host + '/commons-thumb1' + suffix + '.png' }] },
      '101': { pageid: 101, index: 1, title: 'File:Emblem Gold.png', imageinfo: [{ url: 'http://' + host + '/commons-full2' + suffix + '.png', thumburl: 'http://' + host + '/commons-broken' + suffix + '.png' }] },
      '102': { pageid: 102, index: 3, title: 'File:NoInfo page' }
    };
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ query: { pages: pages } }));
    return;
  }
  if (p.indexOf('/commons-thumb') === 0 || p.indexOf('/commons-full') === 0) {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    return;
  }
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
        this.errs.push(JSON.stringify(m.exceptionDetails || m).slice(0, 3000));
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
// 真键盘（合成 DOM KeyboardEvent 不触发 contenteditable 原生编辑——v0.2.34.2 删除断言用）
async function realKey(cdp, key, vk, code) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: key, code: code || key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: key, code: code || key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
}
// 真鼠标点元素中心（Input 域，走完整 mousedown→mouseup→click 原生管线）
async function realClickEl(cdp, elExpr) {
  const p = await cdp.evalJs("(function(){ var el = " + elExpr + "; if (!el) return null; try { el.scrollIntoView({ block: 'center' }); } catch (e) {} var r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()");
  if (!p) return false;
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  return true;
}
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(120);
  }
  throw new Error('waitFor 超时: ' + label);
}

let PASS = 0, FAIL = 0;
let ERRS_PROBE = null; // 调试：定位 Z 的空壳异常来自哪一步
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
  if (ERRS_PROBE && ERRS_PROBE.errs.length) console.log('    [errs ' + ERRS_PROBE.errs.length + '] ' + ERRS_PROBE.errs[ERRS_PROBE.errs.length - 1].slice(0, 1500));
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
    ERRS_PROBE = cdp;
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    // headless 页面未获焦（document.hasFocus()===false）→ contenteditable focus() 静默
    // 失效 → 工具栏 fromCaret 守卫判空不弹（T1/T3 首跑真凶，探针实证 hasFocus
    // before:false / after:true）；焦点模拟后 activeElement=卡 div（contentEditable
    // 设在卡本体上，createContentCard 6325 行）
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
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
      "window.__popOn = function(){ var p = document.getElementById('ttImgPop'); return !!(p && p.classList.contains('active')); };" +
      "window.__imgBtn = function(){ var b = document.getElementById('ttImgBtn'); return b ? { exists: true, disabled: b.classList.contains('tt-disabled') } : { exists: false }; };" +
      "window.__tileCount = function(){ return document.querySelectorAll('#ttImgGrid .tim-tile').length; };" +
      "window.__caretInContent = function(cc){ var txc = cc.querySelector('.card-text-content'); if (!txc) return false; if (!txc.firstChild) txc.textContent = 'Hello world'; var r = document.createRange(); if (txc.firstChild && txc.firstChild.nodeType === 3) { r.setStart(txc.firstChild, Math.min(1, txc.firstChild.length)); } else { r.selectNodeContents(txc); } r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); txc.focus(); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; };" +
      "window.__clickBtn = function(sel){ var b = document.querySelector(sel); if (!b) return false; b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; };" +
      "window.__firstImg = function(){ return document.querySelector('.grid-card[data-card-type=\"content\"] .card-text-content img.tt-inline-img'); };" +
      "window.__caretAfterImg = function(i){ var sel = window.getSelection(); var rg = sel && sel.rangeCount ? sel.getRangeAt(0) : null; if (!rg || !rg.collapsed) return false; var c = rg.endContainer, o = rg.endOffset; if (c.nodeType === 1) return !!(c.childNodes && c.childNodes[o - 1] === i); return c.nodeType === 3 && o === 0 && c === i.nextSibling; };" +
      "window.__batt = true; return true; })()");

    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function' && typeof window.createContentCard === 'function'", 'load');
    await dropAsset('flag', 'National Flag');
    await install();
    const tt = () => cdp.evalJs("window.__ttOn()");
    const pop = () => cdp.evalJs("window.__popOn()");

    // ── T1: 内容卡光标 → 工具栏显示 + 添加图像钮在场且未置灰 ──
    await cdp.evalJs("(function(){ var cc = window.createContentCard(0, 14, 8, 4); window.__caretInContent(cc); return true; })()");
    ok('T1 内容卡光标=工具栏显示+图像钮未置灰', await waitFor(cdp, "window.__ttOn()", 3000, 'T1').then(async () => {
      const st = await cdp.evalJs("window.__imgBtn()");
      return st.exists && !st.disabled;
    }).catch(() => false));

    // ── T2: 点图像钮 → 弹层开 + 16 格（15 国旗 + 1 上传） ──
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    ok('T2 弹层开+16 格', await waitFor(cdp, "window.__popOn()", 3000, 'T2').then(async () => {
      return (await cdp.evalJs("window.__tileCount()")) === 16;
    }).catch(() => false));

    // ── T3: 点第 1 格国旗 → 插入内联图 + 光标在图后（工具栏保持） ──
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile'); true");
    ok('T3 插入内联图（data:image/png + alt + 光标在图后）', await waitFor(cdp, "!!window.__firstImg()", 3000, 'T3').then(async () => {
      // 光标在图后 = 折叠选区端点紧跟 img：v10.28.24.1 起优先落在图后文本节点
      // 偏移 0（元素级光标矩形退化→工具栏跳左上角修复），图是末节点才回退元素级
      //（contentEditable 在卡本体，activeElement 是卡 div 而非 textEl 子 div）
      const r = await cdp.evalJs("(function(){ var i = window.__firstImg(); return JSON.stringify({ src: (i.src || '').slice(0, 22), alt: i.alt, caretAfter: window.__caretAfterImg(i), cardFocused: document.activeElement === i.closest('.grid-card') }); })()");
      const j = JSON.parse(r);
      return j.src === 'data:image/png;base64,' && j.alt === 'Tricolor Standard' && j.caretAfter && j.cardFocused && (await tt());
    }).catch(() => false));

    // ── T4: 光标态整块字号 32 → 图高 = 1.5em×32 = 48（em 等比） ──
    await cdp.evalJs("window.setFontSize(32); true");
    ok('T4 整块字号 32 → 图高 48（em 等比）', await cdp.evalJs("(function(){ var i = window.__firstImg(); var h = parseFloat(getComputedStyle(i).height); var fs = parseFloat(getComputedStyle(i.closest('.card-text-content')).fontSize); return Math.abs(h - 1.5 * fs) < 1.5 && Math.abs(fs - 32) < 1; })()"));

    // ── T5: 全选（含图）字号 24 → 图高 = 1.5em×24 = 36（span 包选区间等比） ──
    await cdp.evalJs("(function(){ var txc = window.__firstImg().closest('.card-text-content'); var r = document.createRange(); r.selectNodeContents(txc); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); window.setFontSize(24); return true; })()");
    ok('T5 选区字号 24 → 图高 36（span 包选区间等比）', await cdp.evalJs("(function(){ var i = window.__firstImg(); var h = parseFloat(getComputedStyle(i).height); var fs = parseFloat(getComputedStyle(i.parentNode).fontSize); return Math.abs(h - 1.5 * fs) < 1.5 && Math.abs(fs - 24) < 1; })()"));

    // ── T6: 草稿往返——saveDraft 内容带图 → 重载 → 图无损恢复 ──
    await cdp.evalJs("window.saveDraft(); true");
    ok('T6a 草稿内容含 tt-inline-img + data:image/png', await cdp.evalJs("(function(){ var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}'); var c = (d.cards || []).filter(function (x) { return x.type === 'content'; }); return c.some(function (x) { return (x.content || '').indexOf('tt-inline-img') !== -1 && x.content.indexOf('data:image/png') !== -1; }); })()"));
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createContentCard === 'function'", 'reload');
    await install(); // 重载抹掉页面级 helper（首跑 T7 崩溃真凶：__caretInContent 已不存在）——重装
    ok('T6b 重载后内联图无损恢复（sanitizer 放行 data:）', await waitFor(cdp, "!!(document.querySelector('.grid-card[data-card-type=\"content\"] .card-text-content img.tt-inline-img'))", 15000, 'T6b').then(() => true).catch(() => false));

    // ── T7: 上传路径——新内容卡光标 → 开弹层点「上传」格（change 监听挂在
    // buildImgPop 里，重载后必须先重建弹层——首跑真凶）→ 文件输入框 change
    // （1×1 PNG） → FileReader → 插入 ──
    await cdp.evalJs("(function(){ var cc = window.createContentCard(0, 22, 8, 4); window.__caretInContent(cc); return true; })()");
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'T7 pop');
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile.tim-upload'); true");
    await cdp.evalJs("(function(){ var fi = document.getElementById('ttInlineFileInput'); var dt = new DataTransfer(); var bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), function (c) { return c.charCodeAt(0); }); dt.items.add(new File([bytes], 'test-emblem.png', { type: 'image/png' })); fi.files = dt.files; fi.dispatchEvent(new Event('change', { bubbles: true })); return true; })()");
    ok('T7 上传路径插入内联图', await waitFor(cdp, "document.querySelectorAll('.grid-card[data-card-type=\"content\"] .card-text-content img.tt-inline-img').length >= 2", 5000, 'T7').then(() => true).catch(() => false));
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true"); // 收尾关弹层——T9 的开合是 toggle，弹层开着会被点关

    // ── T8: 弹层锚定工具栏上方（用户「弹窗是在工具栏上方的…而不是覆盖全屏」） ──
    await cdp.evalJs("(function(){ var ccs = document.querySelectorAll('.grid-card[data-card-type=\"content\"]'); window.__caretInContent(ccs[ccs.length - 1]); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'T8 show');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'T8 pop');
    ok('T8 弹层在按钮上方（右缘对齐+不超视口）', await cdp.evalJs("(function(){ var b = document.getElementById('ttImgBtn').getBoundingClientRect(); var p = document.getElementById('ttImgPop').getBoundingClientRect(); return p.bottom <= b.top - 4 && p.top < b.top && p.right <= window.innerWidth - 4; })()"));

    // ── T9: 弹层 mousedown 保光标，但搜索框/搜索钮可正常聚焦点击 ──
    ok('T9 弹层 mousedown 排除搜索框', await cdp.evalJs("(function(){ var evIn = new MouseEvent('mousedown', { bubbles: true, cancelable: true }); document.getElementById('ttImgSearch').dispatchEvent(evIn); var evPop = new MouseEvent('mousedown', { bubbles: true, cancelable: true }); document.getElementById('ttImgPop').dispatchEvent(evPop); return !evIn.defaultPrevented && evPop.defaultPrevented; })()"));

    // ── T10: 输入框态 → 钮不再置灰（v10.28.22 置灰被用户报「按钮没办法点击」）、
    // 能开弹层；v10.28.24 起点格直接插进该标签（现场升级富文本 span） ──
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
    await cdp.evalJs("(function(){ var lab = document.querySelector('.grid-card[data-card-type=\"flag\"] .card-label'); lab.focus(); lab.setSelectionRange(0, 0); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    ok('T10a 标签输入框态=图像钮不置灰', await waitFor(cdp, "window.__ttOn()", 3000, 'T10a').then(async () => {
      const st = await cdp.evalJs("window.__imgBtn()");
      return st.exists && !st.disabled;
    }).catch(() => false));
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    ok('T10b 输入框态也能开弹层', await waitFor(cdp, "window.__popOn()", 3000, 'T10b').then(() => true).catch(() => false));
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile'); true");
    ok('T10c 标签输入框点格→现场升级富文本+图插入+文字保留', await waitFor(cdp, "!!(document.querySelector('.grid-card[data-card-type=\"flag\"] .card-label[data-rich=\"1\"] img.tt-inline-img'))", 3000, 'T10c rich').then(async () => {
      return await cdp.evalJs("(function(){ var lab = document.querySelector('.grid-card[data-card-type=\"flag\"] .card-label'); return lab.dataset.rich === '1' && lab.textContent.indexOf('National Flag') !== -1 && lab.querySelector('img.tt-inline-img') && lab.parentNode && lab.parentNode.classList.contains('grid-card'); })()");
    }).catch(() => false));

    // ── T11: 网页搜索——打桩 API + Enter → 2 列缩略图网格、坏图格自动隐去、清除回国旗库 ──
    await cdp.evalJs("(function(){ var ccs = document.querySelectorAll('.grid-card[data-card-type=\"content\"]'); window.__caretInContent(ccs[ccs.length - 1]); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'T11 show');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'T11 pop');
    await cdp.evalJs("(function(){ window.FC_IMG_SEARCH_API = location.origin + '/commons-api'; var inp = document.getElementById('ttImgSearch'); inp.value = 'slati crown'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true; })()");
    ok('T11a 搜索结果=2列缩略图+坏图格自动隐去', await waitFor(cdp, "document.querySelectorAll('#ttImgGrid .tim-thumb-tile').length === 2", 5000, 'T11a tiles').then(async () => {
      // 坏图隐去是 img onerror 异步事件——先等它落定再数可见格（防竞态）
      return await waitFor(cdp, "document.querySelectorAll('#ttImgGrid .tim-thumb-tile[style*=\"display: none\"]').length >= 1", 4000, 'T11a broken hidden').then(async () => {
        return await cdp.evalJs("(function(){ var g = document.getElementById('ttImgGrid'); var head = document.getElementById('ttImgHead'); var vis = Array.prototype.slice.call(document.querySelectorAll('#ttImgGrid .tim-thumb-tile')).filter(function (b) { return b.style.display !== 'none'; }); return g.classList.contains('tim-search-mode') && head.textContent.indexOf('搜索：') === 0 && vis.length === 1 && !document.getElementById('ttImgClear').hidden; })()");
      }).catch(() => false);
    }).catch(() => false));
    await cdp.evalJs("window.__clickBtn('#ttImgClear'); true");
    ok('T11b 清除搜索→回国旗库（16 格+输入清空）', await cdp.evalJs("(function(){ var g = document.getElementById('ttImgGrid'); return !g.classList.contains('tim-search-mode') && g.querySelectorAll('.tim-tile').length === 16 && document.getElementById('ttImgHead').textContent === '国旗库' && document.getElementById('ttImgSearch').value === '' && document.getElementById('ttImgClear').hidden; })()"));

    // ── T12: 搜索结果插入 + 光标回放（搜索框抢焦点后仍插进内容卡、光标在图后） ──
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
    await cdp.evalJs("(function(){ var cc = window.createContentCard(0, 34, 8, 4); window.__caretInContent(cc); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'T12 show');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'T12 pop');
    await cdp.evalJs("(function(){ var inp = document.getElementById('ttImgSearch'); inp.focus(); return true; })()");
    await sleep(300); // 聚焦触发 selectionchange——若弹层被收（探针实况）这里就断
    ok('T12a 搜索框聚焦=弹层+工具栏保持打开（hideTextToolbar 守卫）', (await pop()) === true && (await tt()) === true);
    await cdp.evalJs("(function(){ var inp = document.getElementById('ttImgSearch'); inp.value = 'emblem'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true; })()");
    await waitFor(cdp, "document.querySelectorAll('#ttImgGrid .tim-thumb-tile').length === 2", 5000, 'T12 results');
    await waitFor(cdp, "document.querySelectorAll('#ttImgGrid .tim-thumb-tile[style*=\"display: none\"]').length >= 1", 4000, 'T12 broken hidden'); // 点可见格前先等坏图隐去
    await cdp.evalJs("(function(){ var ts = document.querySelectorAll('#ttImgGrid .tim-thumb-tile'); for (var i = 0; i < ts.length; i++) if (ts[i].style.display !== 'none') { ts[i].dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); ts[i].dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; } return false; })()");
    ok('T12b 搜索框抢焦点后仍插入（光标回放）+ 弹层关', await waitFor(cdp, "document.querySelectorAll('.grid-card[data-card-type=\"content\"] .card-text-content img.tt-inline-img').length === 3", 5000, 'T12 insert').then(async () => {
      return await cdp.evalJs("(function(){ var ccs = document.querySelectorAll('.grid-card[data-card-type=\"content\"]'); var last = ccs[ccs.length - 1]; var i = last.querySelector('.card-text-content img.tt-inline-img'); if (!i) return false; return i.src.indexOf('/commons-thumb1') !== -1 && i.alt === 'File:Crown of Slati.svg' && window.__caretAfterImg(i) && document.activeElement === last && !document.getElementById('ttImgPop').classList.contains('active'); })()");
    }).catch(() => false));

    // ── T13: 内容卡光标 → 开弹层 → Escape → 弹层关 ──
    await cdp.evalJs("(function(){ var ccs = document.querySelectorAll('.grid-card[data-card-type=\"content\"]'); window.__caretInContent(ccs[ccs.length - 1]); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'T13 show');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'T13 pop');
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
    await sleep(300);
    ok('T13 Escape=弹层关', (await pop()) === false);

    // ── T14: 内容卡失焦+点画布空白 → 工具栏+弹层收起 ──
    await cdp.evalJs("(function(){ var ccs = document.querySelectorAll('.grid-card[data-card-type=\"content\"]'); window.__caretInContent(ccs[ccs.length - 1]); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'T14 show');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'T14 pop');
    await cdp.evalJs("(function(){ var ccs = document.querySelectorAll('.grid-card[data-card-type=\"content\"]'); var txc = ccs[ccs.length - 1].querySelector('.card-text-content'); txc.blur(); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); window.gridCanvas.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()");
    await sleep(300);
    ok('T14 点画布空白=工具栏+弹层收起', (await tt()) === false && (await pop()) === false);

    // ── T16: 表格格插入——v10.28.24 任意可打字处（用户「添加在任何可以打字的地方」） ──
    await cdp.evalJs("(function(){ var sc = window.createSheetCard(0, 40, 10, 7); var cell = sc.querySelector('.sheet-body-row .sheet-cell'); cell.focus(); cell.setSelectionRange(0, 0); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'T16 show');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'T16 pop');
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile'); true");
    ok('T16 表格格插入→升级富文本+sheetData 存 HTML+图高=1.5em 随单元格字号（v10.28.24.1 修复）', await waitFor(cdp, "!!(document.querySelector('.grid-card[data-card-type=\"sheet\"] .sheet-cell[data-rich=\"1\"] img.tt-inline-img'))", 3000, 'T16 rich').then(async () => {
      return await cdp.evalJs("(function(){ var sc = document.querySelector('.grid-card[data-card-type=\"sheet\"]'); var cell = sc.querySelector('.sheet-cell[data-rich=\"1\"]'); if (!cell) return false; var img = cell.querySelector('img.tt-inline-img'); if (!img) return false; var h = parseFloat(getComputedStyle(img).height); var fs = parseFloat(getComputedStyle(cell).fontSize); return sc.dataset.sheetData.indexOf('<img') !== -1 && sc.dataset.sheetData.indexOf('tt-inline-img') !== -1 && Math.abs(h - 1.5 * fs) < 1.5 && fs > 0; })()");
    }).catch(() => false));

    // ── T17: 统计指标插入（statsRows JSON 串存 HTML） ──
    await cdp.evalJs("(function(){ var sc = window.createStatsCard(0, 48, 6, 5); var lab = sc.querySelector('.stats-label'); lab.focus(); lab.setSelectionRange(0, 0); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'T17 show');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'T17 pop');
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile'); true");
    ok('T17 统计指标插入→statsRows 存 HTML+数值照常', await waitFor(cdp, "!!(document.querySelector('.grid-card[data-card-type=\"stats\"] .stats-label[data-rich=\"1\"] img.tt-inline-img'))", 3000, 'T17 rich').then(async () => {
      return await cdp.evalJs("(function(){ var sc = document.querySelector('.grid-card[data-card-type=\"stats\"]'); var rows = JSON.parse(sc.dataset.statsRows || '[]'); return rows.length >= 3 && rows[0].label.indexOf('<img') !== -1 && rows[0].label.indexOf('tt-inline-img') !== -1 && rows[0].value === 120; })()");
    }).catch(() => false));

    // ── T18: 草稿往返——rich 标记文字随既有字段无损往返 ──
    await cdp.evalJs("window.saveDraft(); true");
    ok('T18a 草稿 label/sheetData/statsRows 都带 <img（零新字段）', await cdp.evalJs("(function(){ var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}'); var flag = (d.cards || []).filter(function (x) { return x.type === 'flag'; })[0]; var sheet = (d.cards || []).filter(function (x) { return x.type === 'sheet'; })[0]; var stats = (d.cards || []).filter(function (x) { return x.type === 'stats'; })[0]; return !!(flag && flag.label.indexOf('<img') !== -1 && sheet && sheet.sheetData.indexOf('<img') !== -1 && stats && stats.statsRows.indexOf('<img') !== -1); })()"));
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createContentCard === 'function'", 'reload2');
    await install();
    ok('T18b 重载后 rich 字段无损恢复（标签/表格格/统计指标都带图）', await waitFor(cdp, "document.querySelectorAll('.grid-card .card-label[data-rich=\"1\"] img.tt-inline-img, .grid-card .sheet-cell[data-rich=\"1\"] img.tt-inline-img, .grid-card .stats-label[data-rich=\"1\"] img.tt-inline-img').length >= 3", 15000, 'T18b').then(async () => {
      return await cdp.evalJs("(function(){ var flag = document.querySelector('.grid-card[data-card-type=\"flag\"] .card-label'); var sheet = document.querySelector('.grid-card[data-card-type=\"sheet\"] .sheet-cell[data-rich=\"1\"]'); var stats = document.querySelector('.grid-card[data-card-type=\"stats\"] .stats-label[data-rich=\"1\"]'); return flag && sheet && stats && flag.textContent.indexOf('National Flag') !== -1 && stats.textContent.indexOf('人口') !== -1; })()");
    }).catch(() => false));

    // ── T19: IMG_SAVED_INPUT——搜索框抢焦点后仍插回卡内输入框 ──
    await cdp.evalJs("(function(){ var cc = window.createCharacterCard(0, 54, 4, 5); var n = cc.querySelector('.card-label'); n.focus(); n.setSelectionRange(0, 0); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'T19 show');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'T19 pop');
    await cdp.evalJs("(function(){ document.getElementById('ttImgSearch').focus(); return true; })()");
    await sleep(300);
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile'); true");
    ok('T19 搜索框抢焦点后仍插回卡内输入框（IMG_SAVED_INPUT）', await waitFor(cdp, "!!(document.querySelector('.grid-card[data-card-type=\"character\"] .card-label[data-rich=\"1\"] img.tt-inline-img'))", 3000, 'T19 rich').then(async () => {
      return await cdp.evalJs("(function(){ var n = document.querySelector('.grid-card[data-card-type=\"character\"] .card-label'); return n.dataset.rich === '1' && n.querySelector('img.tt-inline-img') && n.textContent.indexOf('姓名') === -1; })()");
    }).catch(() => false));

    // ── T20: 数字字段——toast 引导+不升级 ──
    await cdp.evalJs("(function(){ var v = document.querySelector('.grid-card[data-card-type=\"stats\"] .stats-value'); v.focus(); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'T20 pop');
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile'); true");
    await sleep(200);
    ok('T20 数字字段→toast+保持 input 不升级', await cdp.evalJs("(function(){ var t = document.getElementById('toast'); var v = document.querySelector('.grid-card[data-card-type=\"stats\"] .stats-value'); return t.classList.contains('show') && t.textContent.indexOf('数字或年份') !== -1 && v.nodeName === 'INPUT' && !v.dataset.rich && !v.querySelector('img'); })()"));

    // ── T21: 卡外输入框（标题）——toast 引导+不插入 ──
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
    await cdp.evalJs("(function(){ var ti = document.getElementById('titleInput'); ti.focus(); ti.setSelectionRange(0, 0); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'T21 pop');
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile'); true");
    await sleep(200);
    ok('T21 标题框（卡外）→toast 引导+不插入', await cdp.evalJs("(function(){ var t = document.getElementById('toast'); var ti = document.getElementById('titleInput'); return t.classList.contains('show') && t.textContent.indexOf('图像只能插进文字里') !== -1 && ti.nodeName === 'INPUT' && !ti.dataset.rich; })()"));

    // ── T22: 工具栏不跳左上角（用户「为什么在content card输入时工具栏会跑到左上角」
    // ——真身 v10.28.24 插图后光标 setStartAfter(img) 元素级落在内联图边界，Chrome
    // 光标矩形退化（0,0,0,0）→ 工具栏锚到视口左上角；v10.28.24.1 光标优先放进图后
    // 文本节点偏移 0 + positionToolbar 退化矩形兜底锚回 textEl） ──
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
    await cdp.evalJs("(function(){ var cc = window.createContentCard(0, 6, 8, 4); window.__caretInContent(cc); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'T22 show');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'T22 pop');
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile'); true");
    ok('T22a 插图后工具栏在位且不跳左上角（图后文本节点偏移 0）', await waitFor(cdp, "(function(){ var ccs = document.querySelectorAll('.grid-card[data-card-type=\"content\"]'); var last = ccs[ccs.length - 1]; return !!(last && last.querySelector('.card-text-content img.tt-inline-img')); })()", 5000, 'T22a insert').then(async () => {
      return await cdp.evalJs("(function(){ var t = document.getElementById('textToolbar'); if (!t || t.style.display === 'none') return false; var L = parseFloat(t.style.left) || 0, Tp = parseFloat(t.style.top) || 0; return L > 50 && Tp > 50; })()");
    }).catch(() => false));
    // 图后无文本的残余情况：光标强制元素级（矩形退化）→ positionToolbar 兜底锚回
    // 文字区矩形，仍不跳左上角；再模拟打字（input+keyup）重锚
    await cdp.evalJs("(function(){ var ccs = document.querySelectorAll('.grid-card[data-card-type=\"content\"]'); var last = ccs[ccs.length - 1]; var tx = last.querySelector('.card-text-content'); var r = document.createRange(); r.setStart(tx, tx.childNodes.length); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); tx.dispatchEvent(new InputEvent('input', { bubbles: true })); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); document.dispatchEvent(new KeyboardEvent('keyup', { key: 'x', bubbles: true })); return true; })()");
    await sleep(300);
    ok('T22b 元素级光标（矩形退化）+打字→兜底锚回文字区，仍不跳左上角', await cdp.evalJs("(function(){ var t = document.getElementById('textToolbar'); if (!t || t.style.display === 'none') return false; var L = parseFloat(t.style.left) || 0, Tp = parseFloat(t.style.top) || 0; return L > 50 && Tp > 50; })()"));

    // ── T23: 点击表格格里内联图=整图选中（可视反馈）→ Delete 即删（v10.28.24.2，
    // 用户「没办法像文字一样删除」；探针实证点击图后光标落点不定、Delete/Backspace
    // 不一定命中图）——真鼠标点击走完整原生管线 ──
    const sheetImgExpr = "document.querySelector('.grid-card[data-card-type=\"sheet\"] .sheet-cell[data-rich=\"1\"] img.tt-inline-img')";
    await realClickEl(cdp, sheetImgExpr);
    await sleep(250);
    ok('T23a 点击表格格内联图→整图选中（选区含图不折叠）', await cdp.evalJs("(function(){ var s = window.getSelection(); if (!s.rangeCount || s.isCollapsed) return false; var rg = s.getRangeAt(0); var clone = rg.cloneContents(); return !!clone.querySelector && !!clone.querySelector('img.tt-inline-img'); })()"));
    await realKey(cdp, 'Delete', 46, 'Delete');
    await sleep(250);
    ok('T23b 选中图后 Delete→图删+sheetData 同步（richFieldSync）', await cdp.evalJs("(function(){ var sc = document.querySelector('.grid-card[data-card-type=\"sheet\"]'); var cell = sc.querySelector('.sheet-cell[data-rich=\"1\"]'); return cell && !cell.querySelector('img.tt-inline-img') && sc.dataset.sheetData.indexOf('tt-inline-img') === -1; })()"));

    // ── T23c: 重插图 → 光标图后 Backspace 即删（插入路径回归） ──
    await cdp.evalJs("(function(){ var cell = document.querySelector('.grid-card[data-card-type=\"sheet\"] .sheet-cell[data-rich=\"1\"]'); cell.focus(); var r = document.createRange(); r.setStart(cell, cell.childNodes.length); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'T23c show');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'T23c pop');
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile'); true");
    ok('T23c 光标图后+Backspace→图删（插入后立即删）', await waitFor(cdp, "!!(" + sheetImgExpr + ")", 3000, 'T23c img').then(async () => {
      await cdp.evalJs("(function(){ var img = " + sheetImgExpr + "; var cell = img.parentNode; cell.focus(); var r = document.createRange(); if (img.nextSibling && img.nextSibling.nodeType === 3) r.setStart(img.nextSibling, 0); else r.setStartAfter(img); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); return true; })()");
      await realKey(cdp, 'Backspace', 8, 'Backspace');
      await sleep(250);
      return await cdp.evalJs("(function(){ var cell = document.querySelector('.grid-card[data-card-type=\"sheet\"] .sheet-cell[data-rich=\"1\"]'); return cell && !cell.querySelector('img.tt-inline-img'); })()");
    }).catch(() => false));

    // ── T24: 大字号宽图不溢出表格格（v10.28.24.2——用户「一添加它的大小就已经超出
    // 了表格」；线上探针实证 font 32 国旗 1.6:1 → 77px 图 > 69px 格溢出；修法=
    // max-width:100% + object-fit:contain 按比例收进盒内不压扁） ──
    await cdp.evalJs("(function(){ var cell = document.querySelector('.grid-card[data-card-type=\"sheet\"] .sheet-cell[data-rich=\"1\"]'); cell.focus(); var r = document.createRange(); r.setStart(cell, cell.childNodes.length); r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'T24 show');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'T24 pop');
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile'); true");
    ok('T24 字号 32 宽图（国旗）不溢出表格格+图高仍 1.5em（max-width 收盒）', await waitFor(cdp, "!!(" + sheetImgExpr + ")", 3000, 'T24 img').then(async () => {
      await cdp.evalJs("(function(){ var cell = document.querySelector('.grid-card[data-card-type=\"sheet\"] .sheet-cell[data-rich=\"1\"]'); var r = document.createRange(); r.selectNodeContents(cell); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); window.setFontSize(32); return true; })()");
      await sleep(300);
      return await cdp.evalJs("(function(){ var cell = document.querySelector('.grid-card[data-card-type=\"sheet\"] .sheet-cell[data-rich=\"1\"]'); var img = cell.querySelector('img.tt-inline-img'); if (!img) return false; var ir = img.getBoundingClientRect(); var cr = cell.getBoundingClientRect(); var h = parseFloat(getComputedStyle(img).height); var fs = parseFloat(getComputedStyle(cell).fontSize); return ir.left >= cr.left - 1 && ir.right <= cr.right + 1 && Math.abs(h - 1.5 * fs) < 2 && Math.abs(fs - 32) < 1; })()");
    }).catch(() => false));

    // ── T15: 版本（静态 v0.2.36.0 + v10.28.26.0 + buildDraft 链；运行时 badge） ──
    const fceSrc = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
    const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
    const verRt = await cdp.evalJs("JSON.stringify({ mn: window.MN_SITE_VERSION, fc: window.FLUIDCANVAS_VERSION, badge: document.body.innerText.indexOf('v10.28.26.0') !== -1 })");
    ok('T15 版本 v0.2.36.0 + FC v10.28.26.0 + buildDraft 链 + 页面徽章',
      sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.36.0';") !== -1 &&
      sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.26.0';") !== -1 &&
      fceSrc.indexOf('v10.28.24.2 adds NO new fields (两个修复') !== -1 &&
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
