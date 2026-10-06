// tmp-battery-cellhl-unified.js — v0.2.30.2 一体式高亮验证（2026-09-11）
// 背景：用户「那个编辑的画布是不是一体，如果是重复的一个一个就请你把他改成全部一体式的
// 不要偷懒就搞成一个一个的」→追问「我怕你又偷懒…只使用一个感应，其他都只是花瓶」。
// 画布本体本来就一体（单一 div、变长=自身长高、拖拽感应挂 document）；
// 唯一一格一格 = drawHighlightRange 一格建一个 div —— 改为整个覆盖范围只建 ONE 块矩形。
// 断言组：
//   F1-F2 静态：一体式代码/版本号/版本链；
//   B1 拖卡高亮：恰好 1 个 .cell-hl 且矩形与覆盖范围逐像素吻合（公式纸算比对）；
//   B2 松手即移除；B3 旋转卡也一体；B4 侧栏资产落点预览一体 + 离场移除；
//   B5 吸合修复回归（远处同高不吸 / 近邻照常）；B6 版本徽章；Z 零 console error。
// 跑法：node backend-v2/tmp-battery-cellhl-unified.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4600 + Math.floor(Math.random() * 300);
const CDP_PORT = 5700 + Math.floor(Math.random() * 300);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-cellhl-' + Date.now());

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
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name); } };

  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;

  // ── F1-F2 静态 ──
  const fce = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  ok('F1 静态：drawHighlightRange 一体式（ONE 块矩形代码 + 一格一 div 的旧循环已不在）',
    fce.indexOf('(c2 - c1) * step + cs') !== -1 &&
    fce.indexOf('v10.28.20.2: 一体式高亮') !== -1 &&
    fce.indexOf("for (var r = r1; r <= r2; r++)") === -1);
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('F2 静态：版本升位 v0.2.45.2 + v10.28.34.2（编辑器掉帧根治轮复跑口径；旧观感轮标记已随注释链修剪）+ buildDraft 链新条目',
    sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.45.2';") !== -1 &&
    sconf.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.34.2';") !== -1 &&
    sconf.indexOf('编辑器掉帧根治') !== -1 &&
    fce.indexOf('v10.28.20.2 adds NO new fields (一体式高亮') !== -1);

  // ── Chrome CDP ──
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1400,1000', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  try {
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
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    console.log('  ℹ CDP 就绪');

    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "typeof window.findMergeSnap === 'function'", 20000, '编辑器加载');
    await sleep(600);

    const setup = await cdp.evalJs(`(function(){
      var A1 = window.createFlagCard(); window.moveCardPx(A1, 60, 60);
      var E = window.createMapCard(); window.moveCardPx(E, 400, 60);
      E.dataset.rotate = 45; E.style.transform = 'rotate(45deg)';
      var C = window.createFlagCard(); window.moveCardPx(C, 700, 300);
      return { a: A1.dataset.cardId, e: E.dataset.cardId, c: C.dataset.cardId };
    })()`);
    console.log('  ℹ 铺卡完成:', JSON.stringify(setup));
    await sleep(300);

    const helpers = "function byId(id){ return Array.from(document.querySelectorAll('.grid-card')).find(function(c){ return c.dataset.cardId === id; }); }" +
      "function relRect(el){ var cr = document.querySelector('.grid-canvas').getBoundingClientRect(); var b = el.getBoundingClientRect(); return { left: b.left - cr.left, top: b.top - cr.top, right: b.right - cr.left, bottom: b.bottom - cr.top }; }";

    // 纸上算期望：复制 highlightCardCoverage 的范围公式（读卡实际 style/offset/旋转）
    const expectedFn = `function(card){
      var g = document.querySelector('.grid-canvas');
      var cs = parseFloat(g.style.getPropertyValue('--cell-size')) || 24;
      var cols = parseFloat(g.style.getPropertyValue('--grid-cols')) || 36;
      var gap = 2, step = cs + gap;
      var totalRows = Math.round(parseFloat(g.style.height) / step);
      var x = parseFloat(card.style.left) || 0, y = parseFloat(card.style.top) || 0;
      var w = card.offsetWidth || 0, h = card.offsetHeight || 0;
      var rad = Math.abs(parseFloat(card.dataset.rotate) || 0) * Math.PI / 180;
      var bboxW = rad ? Math.abs(w*Math.cos(rad)) + Math.abs(h*Math.sin(rad)) : w;
      var bboxH = rad ? Math.abs(w*Math.sin(rad)) + Math.abs(h*Math.cos(rad)) : h;
      var cx = x + w/2, cy = y + h/2;
      var canvasW = cols*cs + (cols-1)*gap;
      var x1 = Math.max(0, cx - bboxW/2), x2 = Math.min(canvasW, cx + bboxW/2);
      var y1 = Math.max(0, cy - bboxH/2), y2 = Math.min(totalRows*step, cy + bboxH/2);
      var c1 = Math.max(1, Math.floor(x1/step)+1), c2 = Math.min(cols, Math.floor((x2-1)/step)+1);
      var r1 = Math.max(1, Math.floor(y1/step)+1), r2 = Math.floor((y2-1)/step)+1;
      return { left: (c1-1)*step, top: (r1-1)*step, width: (c2-c1)*step + cs, height: (r2-r1)*step + cs, spanCells: (c2-c1+1)*(r2-r1+1) };
    }`;

    const dragTo = (id, tx, ty) => cdp.evalJs(helpers + `(function(){
      var card = byId('${id}');
      var rect = document.querySelector('.grid-canvas').getBoundingClientRect();
      var l = parseFloat(card.style.left) || 0, t = parseFloat(card.style.top) || 0;
      var startX = rect.left + l + 6, startY = rect.top + t + 6;
      card.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: startX, clientY: startY, bubbles: true, cancelable: true }));
      var cx = rect.left + ${tx} + 6, cy = rect.top + ${ty} + 6;
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
      return true;
    })()`);
    const dropAt = (tx, ty) => cdp.evalJs(`(function(){
      var rect = document.querySelector('.grid-canvas').getBoundingClientRect();
      var cx = rect.left + ${tx} + 6, cy = rect.top + ${ty} + 6;
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
      return true;
    })()`);

    // ── B1 拖卡高亮：恰好 1 个 .cell-hl，矩形与覆盖范围逐像素吻合 ──
    await dragTo(setup.a, 120, 160);
    // v0.2.45.2：rAF 合并后高亮在帧回调里画——--disable-gpu 环境 rAF 慢，
    // 固定 sleep 撞帧相位假红 → 收敛轮询（house 模式同 autosave S3a）
    await cdp.evalJs(`(async function(){ var t0 = Date.now(); while (Date.now() - t0 < 1200 && !document.querySelector('.cell-hl')) { await new Promise(function(r){ setTimeout(r, 50); }); } return true; })()`);
    ok('B1 拖卡高亮一体：恰好 1 个 .cell-hl（旧实现 70 个）+ 矩形与覆盖范围逐像素吻合（±1px）',
      await cdp.evalJs(helpers + `(function(){
        var hl = document.querySelectorAll('.cell-hl');
        if (hl.length !== 1) return false;
        var exp = (${expectedFn})(byId('${setup.a}'));
        var b = hl[0];
        var L = parseFloat(b.style.left), T = parseFloat(b.style.top), W = parseFloat(b.style.width), H = parseFloat(b.style.height);
        return exp.spanCells >= 2 && Math.abs(L - exp.left) <= 1 && Math.abs(T - exp.top) <= 1 && Math.abs(W - exp.width) <= 1 && Math.abs(H - exp.height) <= 1;
      })()`));
    await dropAt(120, 160);
    await sleep(300);
    ok('B2 松手即移除：mouseup 后 0 个 .cell-hl', await cdp.evalJs("document.querySelectorAll('.cell-hl').length === 0"));

    // ── B3 旋转卡也一体 ──
    await dragTo(setup.e, 500, 200);
    // 同上：收敛轮询替代固定 sleep（--disable-gpu 环境 rAF 慢，撞帧相位假红）
    await cdp.evalJs(`(async function(){ var t0 = Date.now(); while (Date.now() - t0 < 1200 && !document.querySelector('.cell-hl')) { await new Promise(function(r){ setTimeout(r, 50); }); } return true; })()`);
    ok('B3 旋转 45° 卡拖拽：仍恰好 1 个 .cell-hl 且矩形=旋转 bbox 覆盖范围（±1px）',
      await cdp.evalJs(helpers + `(function(){
        var hl = document.querySelectorAll('.cell-hl');
        if (hl.length !== 1) return false;
        var exp = (${expectedFn})(byId('${setup.e}'));
        var b = hl[0];
        return exp.spanCells >= 2 && Math.abs(parseFloat(b.style.left) - exp.left) <= 1 && Math.abs(parseFloat(b.style.top) - exp.top) <= 1 && Math.abs(parseFloat(b.style.width) - exp.width) <= 1 && Math.abs(parseFloat(b.style.height) - exp.height) <= 1;
      })()`));
    await dropAt(500, 200);
    await sleep(300);

    // ── B4 侧栏资产落点预览（dragover/dragleave）──
    ok('B4 资产落点预览一体：canvas dragover 后恰好 1 个 .cell-hl，dragleave 后 0 个',
      await cdp.evalJs(`(async function(){
        var g = document.querySelector('.grid-canvas');
        var rect = g.getBoundingClientRect();
        var dt = new DataTransfer();
        g.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX: rect.left + 300, clientY: rect.top + 200, dataTransfer: dt }));
        await new Promise(function(r){ setTimeout(r, 120); });
        var n1 = document.querySelectorAll('.cell-hl').length;
        g.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true, relatedTarget: null, dataTransfer: dt }));
        await new Promise(function(r){ setTimeout(r, 120); });
        var n2 = document.querySelectorAll('.cell-hl').length;
        return n1 === 1 && n2 === 0;
      })()`));

    // ── B5 吸合修复回归 ──
    ok('B5a 回归·远处同高不吸：拖卡上边距 C 底边 8px、x 相距 700+px → null（v10.28.20.1 守卫仍在）',
      await cdp.evalJs(helpers + "(function(){ var rc = relRect(byId('" + setup.c + "')); var m = window.findMergeSnap(byId('" + setup.a + "'), 0, rc.bottom - 8); return m === null; })()"));
    ok('B5b 回归·近邻照常：拖卡底边距 C 顶边 2px 且 x 重叠 → 命中 C',
      await cdp.evalJs(helpers + "(function(){ var A = byId('" + setup.a + "'), C = byId('" + setup.c + "'), rc = relRect(C); var m = window.findMergeSnap(A, rc.left + 10, rc.top - A.offsetHeight - 2); return !!m && m.axis === 'y' && m.target === C && Math.abs(m.d - 2) <= 1; })()"));

    ok('B6 版本徽章：右下角 badge 渲染 FC v10.28.34.2',
      await cdp.evalJs("(function(){ var ds = document.querySelectorAll('body > div'); for (var i=0;i<ds.length;i++){ if (ds[i].textContent === 'FC v10.28.34.2') return true; } return false; })()"));

    ok('Z 零 console error', cdp.errs.length === 0);
    if (cdp.errs.length) console.log('  errors:', JSON.stringify(cdp.errs).slice(0, 600));

    await cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  }
  console.log('\n  ── 结果: ' + pass + '/' + (pass + fail) + ' 全绿' + (fail === 0 ? ' ✅' : ' ❌'));
  if (fail) process.exit(1);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
