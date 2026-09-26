// tmp-probe-editor-jank.js — 用户「连文章编辑那边的操作都有明显的掉帧」实证：
//   种 12 张文本卡草稿（对齐/吸附默认开，与用户真实配置一致），剖析三个操作：
//   ① 卡片拖拽（document mousemove × 60：findMergeSnap/computeAlignSnap 每事件扫全卡 offsetWidth/Height
//     —— 写在读前的 layout thrash 嫌疑）② se 手柄缩放（beginResize/onResizeMove 读 selectedCard rect）
//   ③ 文本卡打字（Input.insertText × 10）。
//   每操作计：rAF 帧间隔（max / >32ms / >50ms 帧数）+ 三种布局读取次数（getBoundingClientRect /
//   offsetWidth / offsetHeight，Element.prototype 包装计数）。
// 跑法：node tmp-probe-editor-jank.js（house CDP 模式）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4830 + Math.floor(Math.random() * 370);
const CDP_PORT = 5830 + Math.floor(Math.random() * 370);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-editjank-' + Date.now());

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => {
        if (e2) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b2);
      });
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
        this.errs.push(JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
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
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
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
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--hide-scrollbars', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
    await sleep(250);
  }
  if (!up) throw new Error('CDP 没起来');
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  const page = pages.find(x => x.type === 'page');
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // 先落 origin 再种草稿 + 登录种子
  await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html?seedme=1' });
  await sleep(400);

  const cards = [];
  for (let i = 0; i < 12; i++) {
    cards.push({
      id: 't' + i, type: 'text', label: '卡片 ' + (i + 1),
      col: 2 + (i % 4) * 14, row: 2 + Math.floor(i / 4) * 12,
      colSpan: 12, rowSpan: 8, text: '内容 ' + (i + 1)
    });
  }
  await cdp.evalJs('localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');' +
    'localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify({ theme: 'dark' })) + ');' +
    'localStorage.setItem("slati_fluidcanvas_draft", ' + JSON.stringify(JSON.stringify({
      title: '掉帧剖析', cards: cards, settings: { snapOn: true, alignOn: true }
    })) + ');');
  await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
  await waitFor(cdp, "document.querySelectorAll('#gridCanvas .grid-card').length >= 12", 20000, '编辑器 12 卡');
  await sleep(1500);

  // 仪表：布局读取计数 + rAF 帧间隔（常驻；每操作前清零）
  // 包装族：rect/offsetWidth/offsetHeight + scrollHeight/clientWidth/clientHeight + innerText（get）
  await cdp.evalJs(`(function(){
    window.__jank = { rect: 0, ow: 0, oh: 0, sh: 0, cw: 0, ch: 0, it: 0, frames: [], last: 0 };
    var P = Element.prototype;
    var r0 = P.getBoundingClientRect;
    P.getBoundingClientRect = function(){ window.__jank.rect++; return r0.apply(this, arguments); };
    ['offsetWidth','offsetHeight','scrollHeight','clientWidth','clientHeight'].forEach(function(k){
      var d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, k);
      Object.defineProperty(HTMLElement.prototype, k, { get: function(){ window.__jank[k === 'offsetWidth' ? 'ow' : k === 'offsetHeight' ? 'oh' : k === 'scrollHeight' ? 'sh' : k === 'clientWidth' ? 'cw' : 'ch']++; return d.get.call(this); }, configurable: true });
    });
    var itd = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText');
    if (itd && itd.get) Object.defineProperty(HTMLElement.prototype, 'innerText', { get: function(){ window.__jank.it++; return itd.get.call(this); }, configurable: true });
    function raf(t){ var d = t - window.__jank.last; if (d > 0) window.__jank.frames.push({ t: Math.round(t), d: Math.round(d * 10) / 10 }); window.__jank.last = t; requestAnimationFrame(raf); }
    requestAnimationFrame(function(t){ window.__jank.last = t; requestAnimationFrame(raf); });
    window.__resetJank = function(){ window.__jank.rect = 0; window.__jank.ow = 0; window.__jank.oh = 0; window.__jank.sh = 0; window.__jank.cw = 0; window.__jank.ch = 0; window.__jank.it = 0; window.__jank.frames = []; window.__jank.t0 = performance.now(); };
    window.__readJank = function(){
      var f = window.__jank.frames, max = 0, o32 = 0, o50 = 0, slow = [];
      f.forEach(function(r){
        if (r.d > max) max = r.d;
        if (r.d > 32) { o32++; slow.push(Math.round(r.t - window.__jank.t0) + ':' + r.d); }
        if (r.d > 50) o50++;
      });
      return JSON.stringify({ n: f.length, max: max, over32: o32, over50: o50, slow: slow.slice(0, 14),
        rect: window.__jank.rect, ow: window.__jank.ow, oh: window.__jank.oh,
        sh: window.__jank.sh, cw: window.__jank.cw, ch: window.__jank.ch, it: window.__jank.it });
    };
  })()`);

  // 空闲基线：什么都不干 1.5s 的帧间隔（页面静息负载定位）
  await cdp.evalJs('window.__resetJank()');
  await sleep(1500);
  console.log('── 空闲基线（1.5s 静息）：');
  console.log('   ' + await cdp.evalJs('window.__readJank()'));

  // 常驻动画清单：谁在无限动画（float/pulse-glow/spin…）吃每帧主线程
  console.log('── 常驻动画（getAnimations，无限迭代）：');
  console.log('   ' + await cdp.evalJs(`(function(){
    var list = [];
    document.getAnimations().forEach(function(a){
      var el = a.effect && a.effect.target;
      if (!el) return;
      var name = a.animationName || (a.effect.animationName);
      list.push({ name: name, cls: (el.className || '').toString().slice(0, 60), id: el.id || '', tag: el.tagName,
        it: (a.effect.getTiming().iterations === Infinity) ? 'inf' : String(a.effect.getTiming().iterations || 1) });
    });
    return JSON.stringify(list.slice(0, 40));
  })()`));

  // ═══ 操作 1：拖拽第一张卡（125Hz 真实节奏——8ms 间隔异步派发，帧间隔反映每帧真实开销）═══
  await cdp.evalJs(`(function(){
    window.__resetJank();
    var card = document.querySelector('#gridCanvas .grid-card');
    var r = card.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
    var i = 0;
    (function step(){
      i++;
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + i * 2, clientY: cy + i * 1.5 }));
      if (i < 60) setTimeout(step, 8);
      else document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx + 120, clientY: cy + 90, button: 0 }));
    })();
    return 'ok';
  })()`);
  await sleep(1000);
  console.log('── 操作① 拖拽（60 次 mousemove @125Hz，吸附/对齐开）：');
  console.log('   ' + await cdp.evalJs('window.__readJank()'));

  // ═══ 操作 2：se 手柄缩放 ═══
  await cdp.evalJs(`(function(){
    window.__resetJank();
    var h = document.querySelector('.resize-handle[data-dir="se"]');
    if (!h) return 'no-handle';
    var r = h.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    h.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
    for (var i = 1; i <= 40; i++) {
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + i * 1.5, clientY: cy + i }));
    }
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx + 60, clientY: cy + 40, button: 0 }));
    return 'ok';
  })()`);
  await sleep(1200);
  console.log('── 操作② se 手柄缩放（40 次 mousemove）：');
  console.log('   ' + await cdp.evalJs('window.__readJank()'));

  // ═══ 操作 3：文本卡打字 ═══
  await cdp.evalJs(`(function(){
    window.__resetJank();
    var card = document.querySelector('#gridCanvas .grid-card');
    card.focus();
    var sel = window.getSelection();
    var range = document.createRange();
    range.selectNodeContents(card); range.collapse(false);
    sel.removeAllRanges(); sel.addRange(range);
    return 'ok';
  })()`);
  await sleep(200);
  for (let k = 0; k < 10; k++) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', text: '测', unmodifiedText: '测', windowsVirtualKeyCode: 65 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
    await sleep(60);
  }
  await sleep(1000);
  console.log('── 操作③ 文本卡打字（真实按键管线 × 10）：');
  console.log('   ' + await cdp.evalJs('window.__readJank()'));

  // ═══ 操作 3b：合成 input 事件 × 10（确定性测每键处理器开销——绕过浏览器管线）═══
  await cdp.evalJs(`(function(){
    window.__resetJank();
    var card = document.querySelector('#gridCanvas .grid-card');
    for (var k = 0; k < 10; k++) {
      card.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return 'ok';
  })()`);
  await sleep(800);
  console.log('── 操作③b 合成 input × 10（处理器纯开销）：');
  console.log('   ' + await cdp.evalJs('window.__readJank()'));
  // ═══ 微基准 1：onContentChange × 10（单次同步处理器：字数+手柄+fingerprint+调度 600ms 快照）═══
  console.log('── 微基准① onContentChange ×10（单次 ms）：');
  console.log('   ' + await cdp.evalJs(`(function(){
    var out = [];
    for (var k = 0; k < 10; k++) {
      var a = performance.now();
      window.onContentChange();
      out.push(Math.round((performance.now() - a) * 100) / 100);
    }
    return JSON.stringify({ per: out });
  })()`));

  // ═══ 微基准 2：saveDraft × 5（buildDraft 全量序列化 + JSON.stringify + localStorage 写 + toast）═══
  console.log('── 微基准② saveDraft ×5（单次 ms）+ 草稿长度：');
  console.log('   ' + await cdp.evalJs(`(function(){
    var out = [];
    for (var k = 0; k < 5; k++) {
      var a = performance.now();
      window.saveDraft();
      out.push(Math.round((performance.now() - a) * 100) / 100);
    }
    return JSON.stringify({ per: out, draftLen: (localStorage.getItem('slati_fluidcanvas_draft') || '').length });
  })()`));

  // ═══ 微基准 3：撤销链 debounce 全链（reset → onContentChange → 等 800ms 越过 600ms 快照 debounce → 帧间隔）═══
  await cdp.evalJs('window.__resetJank(); window.onContentChange();');
  await sleep(800);
  console.log('── 微基准③ 撤销链（编辑后 0.8s，含 600ms debounce 快照+stringify，帧间隔）：');
  console.log('   ' + await cdp.evalJs('window.__readJank()'));

  // ═══ 微基准 4：JSON.stringify 带模拟 pageBg（2× ~270KB dataURL——真背景图时的序列化成本）═══
  console.log('── 微基准④ stringify 带/不带 pageBg dataURL（单次 ms）：');
  console.log('   ' + await cdp.evalJs(`(function(){
    var raw = localStorage.getItem('slati_fluidcanvas_draft');
    if (!raw) return 'no-draft';
    var d = JSON.parse(raw);
    var fake = 'data:image/jpeg;base64,' + new Array(273100).join('A');
    var plain = JSON.stringify(d);
    var t0 = performance.now();
    for (var k = 0; k < 3; k++) JSON.stringify(d);
    var base = (performance.now() - t0) / 3;
    d.pageBg = { imgs: [fake, fake], order: [0, 1], feathers: { mode: 'soft' } };
    t0 = performance.now();
    for (var k2 = 0; k2 < 3; k2++) JSON.stringify(d);
    var heavy = (performance.now() - t0) / 3;
    return JSON.stringify({ plainLen: plain.length, plain: Math.round(base * 100) / 100, heavy: Math.round(heavy * 100) / 100 });
  })()`));

  // ═══ 微基准 5：MutationObserver 抓编辑后 800ms 内的全部 DOM 变更 + 新起动画
  //（微基准③ 的 77-477ms 周期慢帧是谁在每帧动？按选择器+属性归组点名）═══
  console.log('── 微基准⑤ 编辑后 0.8s DOM 变更归组（selector | attr | 次数 | 末次ms）+ 动画：');
  console.log('   ' + await cdp.evalJs(`(function(){
    var recs = [];
    var mo = new MutationObserver(function (list) {
      var t = performance.now() - window.__t0;
      list.forEach(function (mr) {
        var el = mr.target;
        var cls = el.className ? String(el.className).split(' ')[0] : '';
        var sel = (el.id ? '#' + el.id : el.tagName.toLowerCase() + (cls ? '.' + cls : ''));
        if (mr.type === 'attributes') {
          recs.push({ sel: sel, what: mr.attributeName, t: Math.round(t) });
        } else if (mr.type === 'characterData') {
          recs.push({ sel: sel + '@text', what: 'data', t: Math.round(t) });
        } else {
          var adds = mr.addedNodes.length, dels = mr.removedNodes.length;
          if (adds) recs.push({ sel: sel, what: '+child×' + adds, t: Math.round(t) });
          if (dels) recs.push({ sel: sel, what: '-child×' + dels, t: Math.round(t) });
        }
      });
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    window.__t0 = performance.now();
    window.onContentChange();
    setTimeout(function () {
      mo.disconnect();
      var groups = {};
      recs.forEach(function (r) {
        var k = r.sel + ' | ' + r.what;
        if (!groups[k]) groups[k] = { n: 0, last: 0, sel: r.sel, what: r.what };
        groups[k].n++; groups[k].last = Math.max(groups[k].last, r.t);
      });
      var out = Object.keys(groups).map(function (k) {
        var g = groups[k];
        return g.sel + ' | ' + g.what + ' | ×' + g.n + ' | last=' + g.last + 'ms';
      }).sort(function (a, b) { return b.split('|')[2].trim().slice(1).split(' ')[0] - a.split('|')[2].trim().slice(1).split(' ')[0]; });
      var anims = document.getAnimations().map(function (a) {
        var el = a.effect && a.effect.target;
        return (el ? (el.className || '').toString().split(' ')[0] : '?') + ':' + (a.animationName || '');
      }).filter(function (s) { return s !== 'dots_border:rotate'; });
      window.__moResult = JSON.stringify({ mutations: out.slice(0, 25), totalRecs: recs.length, newAnims: anims.slice(0, 15) });
    }, 800);
    return 'armed';
  })()`));
  await sleep(900);
  console.log('   ' + await cdp.evalJs('window.__moResult || "no-result"'));

  // ═══ 微基准 6：暂停全部动画后重跑编辑链（转圈 tick 是否驱动玻璃重光栅循环）═══
  await cdp.evalJs(`(function(){
    document.getAnimations().forEach(function (a) { a.pause(); });
    return document.getAnimations().length;
  })()`);
  await cdp.evalJs('window.__resetJank(); window.onContentChange();');
  await sleep(800);
  console.log('── 微基准⑥ 暂停全部动画后编辑链（对照③）：');
  console.log('   ' + await cdp.evalJs('window.__readJank()'));
  await cdp.evalJs(`(function(){
    document.getAnimations().forEach(function (a) { a.play(); });
    return 1;
  })()`);

  // ═══ 微基准 7：编辑后挂 fc-moving 整窗（验证延长玻璃暂离的修法方向）═══
  await cdp.evalJs(`(function(){
    window.__resetJank();
    document.body.classList.add('fc-moving');
    window.onContentChange();
    setTimeout(function () { document.body.classList.remove('fc-moving'); }, 750);
    return 1;
  })()`);
  await sleep(800);
  console.log('── 微基准⑦ 编辑后整窗 fc-moving（对照③）：');
  console.log('   ' + await cdp.evalJs('window.__readJank()'));

  // ═══ A/B：全页禁用 backdrop-filter 后重跑拖拽（玻璃重光栅 vs 主线程——拖拽中 66.7ms 帧的归属）═══
  await cdp.evalJs(`(function(){
    var st = document.createElement('style'); st.id = 'jank-no-bf';
    st.textContent = '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
    document.head.appendChild(st); return 1;
  })()`);
  await cdp.evalJs(`(function(){
    window.__resetJank();
    var card = document.querySelector('#gridCanvas .grid-card');
    var r = card.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
    var i = 0;
    (function step(){
      i++;
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + i * 2, clientY: cy + i * 1.5 }));
      if (i < 60) setTimeout(step, 8);
      else document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx + 120, clientY: cy + 90, button: 0 }));
    })();
    return 'ok';
  })()`);
  await sleep(1000);
  console.log('── A/B 拖拽（全页 backdrop-filter 禁用，对照操作①）：');
  console.log('   ' + await cdp.evalJs('window.__readJank()'));
  await cdp.evalJs(`(function(){ var s = document.getElementById('jank-no-bf'); if (s) s.remove(); return 1; })()`);

  // ── 静息负载归因：Performance.getMetrics 两个采样点差值（Script/Layout/Recalc/Paint 各阶段耗时）
  const m1 = await cdp.send('Performance.getMetrics');
  await sleep(1500);
  const m2 = await cdp.send('Performance.getMetrics');
  const pick = (ms, k) => { const a = ms.metrics.find(x => x.name === k); return a ? a.value : NaN; };
  console.log('── 编辑器静息 1.5s 主线程分相耗时（ms）：');
  for (const k of ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'LayoutCount', 'RecalcStyleCount']) {
    console.log('   ' + k + ': ' + Math.round((pick(m2, k) - pick(m1, k)) * 100) / 100);
  }

  // ── 静息负载二分定位：逐个摘除嫌疑对象，各测 1s 空闲帧间隔 ──
  const bisectStep = async (label, js) => {
    await cdp.evalJs('window.__resetJank(); (' + js + ')');
    await sleep(1000);
    const r = JSON.parse(await cdp.evalJs(`(function(){
      var f = window.__jank.frames, max = 0, o32 = 0;
      f.forEach(function(d){ if (d > max) max = d; if (d > 32) o32++; });
      return JSON.stringify({ n: f.length, max: max, over32: o32 });
    })()`));
    console.log('   [' + label + '] 帧数=' + r.n + ' 最大=' + r.max + 'ms  >32ms=' + r.over32);
  };
  await bisectStep('基线（不动）', '0');
  await bisectStep('摘 .migrate-pill 转圈', `(function(){
    var m = document.querySelector('.migrate-pill'); if (m) m.remove(); return 1; })()`);
  await bisectStep('全页动画/过渡禁用', `(function(){
    var st = document.createElement('style'); st.id = 'jank-kill-anim';
    st.textContent = '*{animation:none!important;transition:none!important}';
    document.head.appendChild(st); return 1; })()`);
  await bisectStep('摘全部 lg 玻璃层', `(function(){
    document.querySelectorAll('.lg-backdrop,.lg-specular').forEach(function(n){ n.remove(); }); return 1; })()`);
  await bisectStep('隐 #gridCanvas', `(function(){
    var g = document.getElementById('gridCanvas'); if (g) g.style.display = 'none'; return 1; })()`);
  await bisectStep('隐 .editor-header', `(function(){
    var h = document.querySelector('.editor-header'); if (h) h.style.display = 'none'; return 1; })()`);

  // ── 对照：同环境 dashboard 页空闲基线（判断 65ms/帧 是编辑器独有还是 headless 常态）
  await cdp.evalJs('localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify({ theme: 'dark' })) + ');' +
    'localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');' +
    'localStorage.setItem("slati_teams", ' + JSON.stringify(JSON.stringify([
      { id: 'team-alpha', name: 'Alpha Wing', role: 'Commander', members: 12, color: '#4648d4', avatar: 'A' }
    ])) + ');');
  await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas.html' });
  await waitFor(cdp, "document.getElementById('channelOverview') && document.getElementById('channelOverview').children.length > 0", 15000, 'dashboard load');
  await sleep(1500);
  await cdp.evalJs(`(function(){
    window.__jank = { frames: [], last: 0 };
    function raf(t){ var d = t - window.__jank.last; if (d > 0) window.__jank.frames.push(Math.round(d * 10) / 10); window.__jank.last = t; requestAnimationFrame(raf); }
    requestAnimationFrame(function(t){ window.__jank.last = t; requestAnimationFrame(raf); });
  })()`);
  await sleep(1500);
  console.log('── dashboard 空闲基线（1.5s 静息，同环境对照）：');
  console.log('   ' + await cdp.evalJs(`(function(){
    var f = window.__jank.frames, max = 0, o32 = 0, o50 = 0;
    f.forEach(function(d){ if (d > max) max = d; if (d > 32) o32++; if (d > 50) o50++; });
    return JSON.stringify({ n: f.length, max: max, over32: o32, over50: o50 });
  })()`));

  console.log('══ console errors: ' + cdp.errs.length + ' ══');
  cdp.errs.forEach(e => console.log('   ' + e));
  cdp.close();
  try { chrome.kill(); } catch (e) {}
  server.close();
  process.exit(0);
})().catch(e => { console.error('💥 ' + e.message); process.exit(1); });
