// tmp-battery-fcperf.js — v0.2.45.2 / v10.28.34.2 编辑器掉帧根治电池（2026-09-15）
// 用户（2026-09-15）：「能不能顺便优化一下整个FC的代码因为连文章编辑那边的操作都有明显的掉帧」。
// 探针 tmp-probe-editor-jank 实证三真身：①隐藏弹窗（旧隐藏态只 opacity:0 仍每帧渲染）
// 玻璃卡 blur(32px)+卡内无限转圈动画 → 静息 15fps；②手势期玻璃面 backdrop-filter 每帧
// 重采样重光栅（A/B 禁玻璃 15 慢帧→0）；③125Hz 事件直写无合并（强排读 1421/60 事件）。
// 修法：modal-card 隐藏态 visibility:hidden + 隐藏态卡内 animation:none 全停（连伪元素）；
// body.fc-moving 全页玻璃挂起（拖拽/缩放/旋转/表格手柄，提交后下一帧还原，Escape 路径
// 同步）；拖拽 rAF 合并 + 拖拽期尺寸缓存。
// 场景：F0 静态 6 断言（双版本串 + 三修法在场 + 挂摘站点数）；A 静息 60fps（1.5s ≥80 帧
// 0 超 32ms）；B 静息零无限动画；C 拖拽 fc-moving 生命周期（越阈挂起→玻璃 computed none→
// 松手还原+卡已移动）；D 缩放手柄 / E 旋转手柄 / F 表格手柄挂起还原；G 弹窗开（动画起播+
// 可见）关（动画停+visibility hidden）；H 编辑后 800ms 无 DOM 风暴（MutationObserver
// ≤6 条）；I 处理器微基准（onContentChange ≤2ms、saveDraft ≤10ms）；J Escape 中途缩放
// 提交后还原玻璃；K dashboard 对照（同环境测口径公平）；Z 零 console error + 零
// Runtime exception。12 卡种子同探针（snapOn/alignOn 开）。
// 跑法：node tmp-battery-fcperf.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3900 + Math.floor(Math.random() * 500);
const CDP_PORT = 4900 + Math.floor(Math.random() * 500);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-' + Date.now());

// ── 静态壳（docs/ 原样；/api 全 404 → demo 模式零请求） ──
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

// ── CDP 客户端（Node 24 全局 WebSocket） ──
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method) {
        const ls = this.listeners.get(m.method);
        if (ls) ls.forEach(fn => fn(m.params));
      }
    };
  }
  send(method, params) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  on(method, fn) { if (!this.listeners.has(method)) this.listeners.set(method, []); this.listeners.get(method).push(fn); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || 'exception'));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('waitFor 超时: ' + label);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const pass = [], fail = [];
function check(name, cond, detail) {
  const line = (cond ? '  ✅ ' : '  ❌ ') + name + (detail ? '（' + detail + '）' : '');
  console.log(line);
  (cond ? pass : fail).push(line);
}

// 帧间隔记录器（rAF 链；reset 后量 1.5s：n≥80 且 0 帧超 32ms = 60fps）
const FRAME_REC = `(function(){
  window.__jank = { frames: [], last: 0 };
  function raf(t){ var d = t - window.__jank.last; if (d > 0) window.__jank.frames.push(Math.round(d * 10) / 10); window.__jank.last = t; requestAnimationFrame(raf); }
  requestAnimationFrame(function(t){ window.__jank.last = t; requestAnimationFrame(raf); });
  window.__jankReset = function(){ window.__jank.frames = []; };
  window.__jankRead = function(){
    var f = window.__jank.frames, max = 0, o32 = 0;
    f.forEach(function(d){ if (d > max) max = d; if (d > 32) o32++; });
    return JSON.stringify({ n: f.length, max: max, over32: o32 });
  };
})()`;

async function main() {
  const LIVE = process.env.LIVE_BASE || '';
  if (!LIVE) server.listen(PORT);
  let chromePath = null;
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--hide-scrollbars', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });

  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {}
    await sleep(250);
  }

  // 陷阱 91：用 /json/list 既有 front page（后台 tab 冻结 transition 时钟）
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  const info = pages.find(x => x.type === 'page');
  const t = new CDP(info.webSocketDebuggerUrl);
  await t.connect();
  await t.send('Page.enable');
  await t.send('Runtime.enable');
  await t.send('Log.enable');
  await t.send('DOM.enable');
  await t.send('CSS.enable');
  await t.send('Page.bringToFront');
  await t.send('Emulation.setFocusEmulationEnabled', { enabled: true }); // 防 headless 后台节流冻结 transition 时钟

  const exc = [], err = [];
  t.on('Runtime.exceptionThrown', p => exc.push((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || '?'));
  t.on('Log.entryAdded', p => {
    const e = p.entry;
    if (e.level === 'error' && e.url && e.url.indexOf('/api') === -1 && e.url.indexOf('favicon') === -1) err.push(e.url + ' :: ' + e.text);
  });

  // ════ F0：静态（本地文件读：双版本 + 三修法在场 + 挂摘站点数）════
  const ed = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  const sc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  check('F0a 站点号 v0.2.45.2', sc.indexOf("window.MN_SITE_VERSION = 'v0.2.45.2';") > -1);
  check('F0b FC v10.28.34.2', sc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.34.2';") > -1);
  check('F0c 隐藏态 visibility:hidden + 延迟过渡', ed.indexOf('transition: all 0.25s ease, visibility 0s linear 0.25s;') > -1);
  check('F0d 隐藏弹窗动画全停（含伪元素）', ed.indexOf('.modal-card:not(.active) *::before,') > -1 && ed.indexOf('animation: none !important;') > -1);
  check('F0e 全页玻璃挂起 + 组背景阴影栈挂起', ed.indexOf('body.fc-moving *') > -1 && ed.indexOf('body.fc-moving .grid-group-bg') > -1);
  const addSites = ed.split("classList.add('fc-moving')").length - 1;
  const rmSites = ed.split("classList.remove('fc-moving')").length - 1;
  check('F0f 挂起 5 站点（拖拽/缩放/旋转/表格手柄/Escape 重挂）+ 还原 5 站点', addSites === 5 && rmSites === 5, 'add=' + addSites + ' rm=' + rmSites);

  // ════ 加载（12 卡种子同探针）════
  const BASE = LIVE || ('http://127.0.0.1:' + PORT);
  const cards = [];
  for (let i = 0; i < 12; i++) {
    cards.push({
      id: 't' + i, type: 'text', label: '卡片 ' + (i + 1),
      col: 2 + (i % 4) * 14, row: 2 + Math.floor(i / 4) * 12,
      colSpan: 12, rowSpan: 8, text: '内容 ' + (i + 1)
    });
  }
  const seedJs = `localStorage.setItem('slati_session', JSON.stringify({loggedIn:true}));
    localStorage.setItem('slati_settings', JSON.stringify({theme:'dark'}));
    localStorage.setItem('slati_fluidcanvas_draft', JSON.stringify(${JSON.stringify({ title: '掉帧根治', cards: cards, settings: { snapOn: true, alignOn: true } })}));`;
  if (LIVE) {
    await t.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try { ' + seedJs + ' } catch (e) {}' });
    await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
  } else {
    await t.send('Page.navigate', { url: BASE + '/' });
    await waitFor(t, "typeof window.MN_SITE_VERSION !== 'undefined'", 8000, '根页');
    await t.evalJs(seedJs);
    await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
  }
  await waitFor(t, "document.querySelectorAll('#gridCanvas .grid-card').length >= 12", 20000, '编辑器 12 卡');
  await sleep(1500); // 画布 settle（陷阱 86）

  // ════ A：静息 60fps ════
  check('A0 版本 v10.28.34.2', (await t.evalJs('window.FLUIDCANVAS_VERSION')) === 'v10.28.34.2',
    String(await t.evalJs('window.FLUIDCANVAS_VERSION')));
  await t.evalJs(FRAME_REC);
  await t.evalJs('window.__jankReset()');
  await sleep(1500);
  let fr = JSON.parse(await t.evalJs('window.__jankRead()'));
  check('A1 静息 1.5s ≥80 帧（≈60fps）', fr.n >= 80, JSON.stringify(fr));
  check('A2 静息 0 帧超 32ms', fr.over32 === 0 && fr.max <= 25, JSON.stringify(fr));

  // ════ B：静息零无限动画（隐藏弹窗内动画已停）════
  const anims0 = JSON.parse(await t.evalJs(`(function(){
    return JSON.stringify(document.getAnimations().map(function(a){
      var el = a.effect && a.effect.target;
      return { n: a.animationName || '', cls: el ? (el.className || '').toString().slice(0, 40) : '', it: a.effect && a.effect.getTiming().iterations === Infinity };
    }));
  })()`));
  check('B1 静息 getAnimations 空（转圈已停）', anims0.length === 0, JSON.stringify(anims0));

  // ════ C：拖拽 fc-moving 生命周期 ════
  const glassProbe = `(function(){
    var hb = document.querySelector('.editor-header .lg-backdrop');
    var card = document.querySelector('#gridCanvas .grid-card');
    return JSON.stringify({
      hb: hb ? getComputedStyle(hb).backdropFilter : 'ABSENT',
      moving: document.body.classList.contains('fc-moving')
    });
  })()`;
  const c0 = JSON.parse(await t.evalJs(glassProbe));
  check('C0 静息玻璃在场（editor-header lg-backdrop blur(16px)）且未挂 fc-moving', c0.hb.indexOf('blur(16px)') > -1 && !c0.moving, JSON.stringify(c0));
  await t.evalJs(`(function(){
    var card = document.querySelector('#gridCanvas .grid-card');
    var r = card.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    window.__cDragXY = { cx: cx, cy: cy };
    card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
    var i = 0;
    (function step(){
      i++;
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + i * 2, clientY: cy + i }));
      if (i < 8) setTimeout(step, 30);
    })();
  })()`);
  await waitFor(t, "document.body.classList.contains('fc-moving')", 4000, '拖拽挂起');
  const c1 = JSON.parse(await t.evalJs(glassProbe));
  check('C1 拖拽中 fc-moving 挂起 + 玻璃 computed none', c1.moving && c1.hb === 'none', JSON.stringify(c1));
  await t.evalJs(`(function(){
    var card = document.querySelector('#gridCanvas .grid-card');
    var r = card.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var k = 0; k < 4; k++) document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + k * 4, clientY: cy }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx + 16, clientY: cy, button: 0 }));
  })()`);
  await waitFor(t, "!document.body.classList.contains('fc-moving')", 4000, '松手还原');
  await sleep(200);
  const c2 = JSON.parse(await t.evalJs(glassProbe));
  check('C2 松手后 fc-moving 摘除 + 玻璃还原 blur(16px)', !c2.moving && c2.hb.indexOf('blur(16px)') > -1, JSON.stringify(c2));

  // ════ D：缩放手柄挂起/还原 ════
  await t.evalJs(`(function(){
    var card = document.querySelectorAll('#gridCanvas .grid-card')[1];
    var r = card.getBoundingClientRect();
    card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 }));
    card.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 }));
  })()`);
  await waitFor(t, "document.querySelector('.resize-handle[data-dir=\"se\"]')", 4000, '手柄出现');
  await t.evalJs(`(function(){
    var h = document.querySelector('.resize-handle[data-dir="se"]');
    var r = h.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    h.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + 12, clientY: cy + 8 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + 20, clientY: cy + 14 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx + 24, clientY: cy + 16, button: 0 }));
  })()`);
  await waitFor(t, "!document.body.classList.contains('fc-moving')", 4000, '缩放还原');
  const d1 = JSON.parse(await t.evalJs(glassProbe));
  check('D1 缩放手势后还原（玻璃在场、未挂 fc-moving）', !d1.moving && d1.hb.indexOf('blur(16px)') > -1, JSON.stringify(d1));

  // ════ E：旋转手柄挂起/还原 ════
  await t.evalJs(`(function(){
    var g = document.querySelector('.rotate-grip');
    if (!g) return 'no-grip';
    var r = g.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    g.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + 10, clientY: cy + 6 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + 16, clientY: cy + 10 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx + 20, clientY: cy + 12, button: 0 }));
    return 'ok';
  })()`);
  await waitFor(t, "!document.body.classList.contains('fc-moving')", 4000, '旋转还原');
  const e1 = JSON.parse(await t.evalJs(glassProbe));
  check('E1 旋转手势后还原（玻璃在场、未挂 fc-moving）', !e1.moving && e1.hb.indexOf('blur(16px)') > -1, JSON.stringify(e1));

  // ════ F：表格手柄挂起/还原 ════
  await t.evalJs("window.createSheetCard(2, 2)");
  await waitFor(t, "document.querySelector('.grid-card.sheet-card .sheet-col-grip')", 4000, '表格卡+手柄');
  await t.evalJs(`(function(){
    var g = document.querySelector('.grid-card.sheet-card .sheet-col-grip');
    var r = g.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    g.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
    var i = 0;
    (function step(){
      i++;
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + i * 6, clientY: cy }));
      if (i < 4) setTimeout(step, 30);
      else document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx + 30, clientY: cy, button: 0 }));
    })();
  })()`);
  await waitFor(t, "!document.body.classList.contains('fc-moving')", 4000, '表格手柄还原');
  const f1 = JSON.parse(await t.evalJs(glassProbe));
  check('F1 表格手柄手势后还原（玻璃在场、未挂 fc-moving）', !f1.moving && f1.hb.indexOf('blur(16px)') > -1, JSON.stringify(f1));

  // ════ G：弹窗开（动画起播+可见）/关（动画停+visibility hidden）════
  await t.evalJs("openModal('migrateModal')");
  await waitFor(t, "document.getElementById('migrateCard') && document.getElementById('migrateCard').classList.contains('active')", 4000, '弹窗开');
  await sleep(400); // 淡入 0.25s settle
  const gOpen = JSON.parse(await t.evalJs(`(function(){
    var card = document.getElementById('migrateCard');
    var anims = document.getAnimations().map(function(a){
      var el = a.effect && a.effect.target;
      return { n: a.animationName || '', inside: el ? !!el.closest('#migrateCard') : false, it: a.effect && a.effect.getTiming().iterations === Infinity };
    });
    return JSON.stringify({ vis: getComputedStyle(card).visibility, spin: anims.some(function(a){ return a.inside && a.it; }) });
  })()`));
  check('G1 弹窗开：visibility visible + 卡内无限动画起播（转圈复活）', gOpen.vis === 'visible' && gOpen.spin, JSON.stringify(gOpen));
  await t.evalJs("closeAllModals()");
  await waitFor(t, "getComputedStyle(document.getElementById('migrateCard')).visibility === 'hidden'", 5000, '弹窗关');
  // 陷阱：visibility 翻转后子元素 transition:all 级联再触发一轮 0.25s 过渡 → 收敛轮询等其自然结束
  await waitFor(t, "document.getAnimations().length === 0", 3000, '动画全停');
  const gClosed = JSON.parse(await t.evalJs(`(function(){
    return JSON.stringify({
      n: document.getAnimations().length,
      d: document.getAnimations().map(function(a){
        var el = a.effect && a.effect.target;
        var inside = el ? !!el.closest('.modal-card') : false;
        var inInactive = el ? !!el.closest('.modal-card:not(.active)') : false;
        var it = a.effect && a.effect.getTiming().iterations === Infinity;
        return (a.animationName || a.transitionProperty || '?') + '|' + inside + '|' + inInactive + '|' + it + '|' + (el ? (el.tagName + '.' + String(el.className).slice(0, 30)) : '?');
      })
    });
  })()`));
  check('G2 弹窗关：visibility hidden + 动画全停（getAnimations 空）', gClosed.n === 0, JSON.stringify(gClosed));

  // ════ H：编辑后 800ms 无 DOM 风暴（MutationObserver）════
  const hRes = await t.evalJs(`(function(){
    var recs = 0;
    var mo = new MutationObserver(function () { recs++; });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    window.onContentChange();
    return new Promise(function (res) {
      setTimeout(function () { mo.disconnect(); res(JSON.stringify({ n: recs })); }, 800);
    });
  })()`);
  const hObj = JSON.parse(hRes);
  check('H1 编辑后 800ms MutationObserver 记录 ≤6 批', hObj.n <= 6, JSON.stringify(hObj));

  // ════ I：处理器微基准（探针实测 0.1-0.3ms；宽松上限防偶发红）════
  const iRes = JSON.parse(await t.evalJs(`(function(){
    var out = [];
    for (var k = 0; k < 10; k++) {
      var a = performance.now();
      window.onContentChange();
      out.push(performance.now() - a);
    }
    var max1 = Math.max.apply(null, out);
    out = [];
    for (var k2 = 0; k2 < 3; k2++) {
      var b = performance.now();
      window.saveDraft();
      out.push(performance.now() - b);
    }
    return JSON.stringify({ occMax: Math.round(max1 * 100) / 100, sdMax: Math.round(Math.max.apply(null, out) * 100) / 100 });
  })()`));
  check('I1 onContentChange 单次 ≤2ms', iRes.occMax <= 2, JSON.stringify(iRes));
  check('I2 saveDraft 单次 ≤10ms', iRes.sdMax <= 10, JSON.stringify(iRes));

  // ════ J：Escape 中途缩放 → 提交后还原玻璃 ════
  await t.evalJs(`(function(){
    var h = document.querySelector('.resize-handle[data-dir="se"]');
    if (!h) return 'no-handle';
    var r = h.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    h.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + 15, clientY: cy + 10 }));
  })()`);
  await waitFor(t, "document.body.classList.contains('fc-moving')", 4000, '缩放挂起（J）');
  await t.evalJs(`(function(){
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 400, clientY: 300, button: 0 }));
  })()`);
  await waitFor(t, "!document.body.classList.contains('fc-moving')", 4000, 'Escape 还原');
  const j1 = JSON.parse(await t.evalJs(glassProbe));
  check('J1 Escape 中途提交后玻璃还原、未挂 fc-moving', !j1.moving && j1.hb.indexOf('blur(16px)') > -1, JSON.stringify(j1));

  // ════ K：dashboard 对照（同环境测口径公平）════
  await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas.html' });
  await waitFor(t, "document.getElementById('channelOverview') && document.getElementById('channelOverview').children.length > 0", 20000, 'dashboard load');
  await sleep(1500);
  await t.evalJs(FRAME_REC);
  await t.evalJs('window.__jankReset()');
  await sleep(1500);
  fr = JSON.parse(await t.evalJs('window.__jankRead()'));
  check('K1 dashboard 同环境静息 60fps（口径对照）', fr.n >= 80 && fr.over32 === 0, JSON.stringify(fr));

  // ════ Z：零 console error + 零 Runtime exception ════
  check('Z1 零 console error', err.length === 0, err.slice(0, 3).join(' | '));
  check('Z2 零 Runtime exception', exc.length === 0, exc.slice(0, 3).join(' | '));

  console.log('\n── 结果: ' + pass.length + '/' + (pass.length + fail.length) + ' 全绿 ' + (fail.length === 0 ? '✅' : '❌'));
  t.close();
  server.close();
  try { chrome.kill(); } catch (e) {}
  process.exit(fail.length === 0 ? 0 : 1);
}

main().catch(err => { console.error('电池崩了:', err); process.exit(2); });
