// tmp-battery-fc-viewport.js — FC v10.28.42.1 编辑视口系统电池（39.0 视口系统 + 39.1 平移掉帧修复）
// 用户「现在是我希望FC也是一样是115格横向，然后这个值是固定的不会因为窗口不够宽而
//   缩小，最多就只是变成底下有一个横向拉条可以移动然后用户可以通过Ctrl+滑鼠中键滚轮/
//   加减 来放大缩小但是默认是前面说的那个大小保持但是有横向拉条，用户可以通过长按滑鼠
//   中键进行一个视角的移动；滑鼠中建滚轮不长按的情况下滚动是纵向视角移动，如果中建滚轮
//   加上长按Shift的话就是横向移动」
// 验证：F0 静态锚（FC 39.0 + rev 00277 + 站点 58.0 不变 + width:max-content/computeCols
//         return 115/zoomChip/setViewZoom 锚）
//   / E 固定 115 格（1280/480/3840 全 115 不缩小；画布盒 2528 全覆盖；横向拉条
//         scrollWidth>clientWidth；480 可横滚；resize 不 refit 卡片位置不动）
//   / Z 缩放（Ctrl+滚轮 1.1 步进锚在光标下、缩放前后光标下画布本地坐标不变、
//         Ctrl+=/Ctrl+- 键盘、0.25–4 钳制、zoomChip 点击复位 100%）
//   / P 滚轮/平移（普通滚轮=纵向、Shift+滚轮=横向、中键长按拖=平移视口、
//         中键点按不误触取消选中）
//   / D 缩放下手势精确性（1.5× 下拖卡 +33 屏幕px=+22 画布px 吸附整格、
//         se 手柄 +33=span+1、rotate grip 改角度零异常）
//   / R 回归（撤销/恢复链、查看模式 fit1to1 零缩放守卫）
// （house CDP 模式；截图全黑纪律；断言走 offset*/style 不受 transform 干扰；
//   判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fcviewport-' + Date.now());
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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; this.consoleErrs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = (m.params && m.params.exceptionDetails) || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber, raw: JSON.stringify(d).slice(0, 600) }).slice(0, 1000));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
      } else if (m.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
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

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}

// 查看器 4 卡 fixture（同 fc-present：c3 右越界 c4 下越界 + content c1 带 label）
const FIXTURE_CONTENT = {
  v: 9,
  title: 'Cloud Constitution',
  tags: ['宪法', '官方'],
  cards: [
    { id: 'c1', type: 'content', label: 'Constitution', col: 2, row: 2, colSpan: 10, rowSpan: 6,
      content: '<p><b>Cloud Constitution</b> — fixture body text.</p>', bgAlpha: 0, baseFontSize: 14 },
    { id: 'c2', type: 'flag', label: 'Fixture Flag', col: 4, row: 10, colSpan: 12, rowSpan: 7,
      imgSrc: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20360%22%3E%3Crect%20width%3D%22600%22%20height%3D%22180%22%20fill%3D%22%232E5BFF%22%2F%3E%3Crect%20y%3D%22180%22%20width%3D%22600%22%20height%3D%22180%22%20fill%3D%22%23FFFFFF%22%2F%3E%3C%2Fsvg%3E' },
    { id: 'c3', type: 'text', label: 'OOB-Right', col: 38, row: 3, colSpan: 12, rowSpan: 7,
      content: 'right edge beyond grid (38+12 > 40 cols)', background: 'rgba(220,38,38,0.15)' },
    { id: 'c4', type: 'text', label: 'OOB-Bottom', col: 2, row: 98, colSpan: 8, rowSpan: 8,
      content: 'bottom edge beyond grid (98+8 > 100 rows)', background: 'rgba(46,91,255,0.15)' }
  ],
  settings: { snapOn: true, alignOn: true },
  activePreset: '169', presets: {}, groupStyles: {}, pageBg: null, lastSaved: 1750000000000
};
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' var stubResponse = function (body, status) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status, headers: { "Content-Type": "application/json" } })); }, 0); }); };' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  if (u.indexOf("/articles") !== -1) {' +
  '   if (u.indexOf("/articles/") !== -1) {' +
  '    var id = decodeURIComponent(u.split("/articles/")[1].split("?")[0].split("#")[0]);' +
  '    if (id === "ART-CLOUD-1") {' +
  '     return stubResponse(JSON.stringify({ article: { id: id, title: "Cloud Constitution", status: "published", createdAt: "2026-09-14T10:00:00.000Z", updatedAt: "2026-09-14T10:00:00.000Z", contentJson: ' + JSON.stringify(FIXTURE_CONTENT) + ' } }), 200);' +
  '    }' +
  '    return stubResponse(JSON.stringify({ error: "NOT_FOUND" }), 404);' +
  '   }' +
  '   return stubResponse(JSON.stringify({ articles: [] }), 200);' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';
// 固定 115 格断言体：cols 恒 115、cellSize 20、画布盒宽 115×20+124×2=2528 全覆盖
const FIXED_EXPR = "(function(){ var gc = document.getElementById('gridCanvas'); var body = gc.parentElement;" +
  " var cs = parseInt(getComputedStyle(gc).getPropertyValue('--cell-size').trim(), 10);" +
  " var cols = parseInt(getComputedStyle(gc).getPropertyValue('--grid-cols').trim(), 10);" +
  " return { cols: cols, cs: cs, canvasW: gc.offsetWidth, scrollW: body.scrollWidth, clientW: body.clientWidth, zoom: gc.style.zoom || '' }; })()";

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
  const connectCdp = async (port) => {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    return cdp;
  };
  const setWidth = async (cdp, w) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(1200);
  };

  try {
    // ── F0 静态锚：版本号 + 页面结构锚 ──
    const siteCfg = await (await fetch(BASE + '/assets/js/site-config.js')).text();
    const editorHtml = await (await fetch(BASE + '/pages/fluidcanvas-editor.html')).text();
    ok('F1 site-config：FC v10.28.47.4 + rev 00310- 占位 + 站点版本恒 v0.2.58.7',
      siteCfg.indexOf('v10.28.47.4') !== -1 && siteCfg.indexOf('00310-') !== -1 && siteCfg.indexOf('v0.2.58.7') !== -1);
    ok('F2 编辑器页静态锚：.grid-canvas width:max-content（画布盒全覆盖 115 列）+ computeCols 恒 return 115',
      editorHtml.indexOf('width: max-content') !== -1 && /function computeCols\(\)[\s\S]{0,80}return 115;/.test(editorHtml));
    ok('F3 编辑器页静态锚：zoomChip 按钮 + window.setViewZoom/resetViewZoom 导出',
      editorHtml.indexOf('id="zoomChip"') !== -1 && editorHtml.indexOf('window.setViewZoom') !== -1 && editorHtml.indexOf('window.resetViewZoom') !== -1);

    const cdp = await connectCdp(CDP_PORT);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };
    const mouse = async (type, x, y, opts) =>
      cdp.send('Input.dispatchMouseEvent', Object.assign({ type: type, x: x, y: y, button: 'none', clickCount: 1, modifiers: 0 }, opts || {}));
    const key = async (type, k, code, vk, mods) =>
      cdp.send('Input.dispatchKeyEvent', { type: type, modifiers: mods || 0, key: k, code: code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, text: '' });

    // ── E 固定 115 格：窗口任意宽恒 115 不缩小 + 横向拉条 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "document.getElementById('undoBtn') && typeof window.historyUndoAction === 'function'", 'E 编辑器加载');
    const e1 = await cdp.evalJs(FIXED_EXPR);
    ok('E1 1280 编辑态：cols 恒 115 + cellSize 20 + 画布盒 2528 全覆盖 + 横向拉条（scrollW>clientW）+ zoom 未施加 + chip 100%',
      e1.cols === 115 && e1.cs === 20 && e1.canvasW === 2528 && e1.scrollW > e1.clientW && e1.zoom === '' &&
      await cdp.evalJs("document.getElementById('zoomChip').textContent") === '100%' &&
      await cdp.evalJs("document.querySelectorAll('#gridCanvas .grid-card').length") === 0,
      JSON.stringify(e1));
    await setWidth(cdp, 480);
    const e2 = await cdp.evalJs(FIXED_EXPR);
    const e2scroll = await cdp.evalJs("(function(){ var se = document.getElementById('gridCanvas').parentElement; se.scrollLeft = 200; return se.scrollLeft; })()");
    ok('E2 480 窄窗：cols 仍恒 115 不缩小（旧自适应 12 格行为已死）+ 画布仍 2528 + 横向拉条 + 可横滚 200',
      e2.cols === 115 && e2.cs === 20 && e2.canvasW === 2528 && e2.scrollW > e2.clientW && e2scroll === 200,
      JSON.stringify(e2) + ' scrollLeft=' + e2scroll);
    await setWidth(cdp, 3840);
    const e3 = await cdp.evalJs(FIXED_EXPR);
    ok('E3 3840 超宽窗：cols 仍恒 115（不再无限增长）+ 画布 2528',
      e3.cols === 115 && e3.canvasW === 2528, JSON.stringify(e3));
    await setWidth(cdp, 1280);
    await cdp.evalJs("window.createAssetCard('content', 'T', 2, 2, 6, 4)");
    // 测试钩子建卡不触发内容变更钩子——手动触发一次历史快照提交（600ms 防抖），
    // 否则撤销栈首个快照仍是空画布基线，D 段后的首次撤销会把卡整体抹掉。
    await cdp.evalJs("window.onContentChange()");
    await sleep(900);
    const e4before = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card'); return { left: c.style.left, top: c.style.top, cards: document.querySelectorAll('#gridCanvas .grid-card').length }; })()");
    await setWidth(cdp, 480);
    const e4after = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card'); return { left: c.style.left, top: c.style.top, cards: document.querySelectorAll('#gridCanvas .grid-card').length }; })()");
    ok('E4 resize 不 refit：卡片位置/数量零变动（窗口 1280→480 卡片 left/top 不变、零自动建卡）',
      e4before.left === e4after.left && e4before.top === e4after.top && e4after.cards === 1,
      'before ' + JSON.stringify(e4before) + ' ← after ' + JSON.stringify(e4after));
    await setWidth(cdp, 1280);

    // ── Z 缩放：Ctrl+滚轮 / Ctrl+加减号 / 钳制 / chip 复位 ──
    const bodyPt = await cdp.evalJs("(function(){ var r = document.getElementById('gridCanvas').parentElement.getBoundingClientRect(); return { x: r.left + 300, y: r.top + 250 }; })()");
    await mouse('mouseWheel', bodyPt.x, bodyPt.y, { deltaX: 0, deltaY: -120, modifiers: 2 });
    await sleep(250);
    const z1 = await cdp.evalJs(FIXED_EXPR);
    ok('Z1 Ctrl+滚轮上（deltaY<0）→ 1.1 倍：style.zoom=1.1 + chip 110% + 画布盒随 zoom 放大（scrollW≈2528×1.1）',
      z1.zoom === '1.1' && await cdp.evalJs("document.getElementById('zoomChip').textContent") === '110%' &&
      z1.scrollW > 2700 && z1.scrollW < 2900,
      JSON.stringify(z1));
    const z2 = await cdp.evalJs("(function(){ var gc = document.getElementById('gridCanvas'); var se = gc.parentElement;" +
      " var r = se.getBoundingClientRect(); var cs = getComputedStyle(se);" +
      " var padL = parseInt(cs.paddingLeft, 10) || 0, padT = parseInt(cs.paddingTop, 10) || 0;" +
      " var cx = r.left + 250, cy = r.top + 250;" +
      " var z0 = parseFloat(gc.style.zoom) || 1;" +
      " var p0 = (se.scrollLeft + cx - r.left - padL) / z0;" +
      " window.setViewZoom(2.2, cx, cy);" +
      " var z1 = parseFloat(gc.style.zoom) || 1;" +
      " var p1 = (se.scrollLeft + cx - r.left - padL) / z1;" +
      " return { z0: z0, z1: z1, p0: p0, p1: p1 }; })()");
    ok('Z2 锚点平移自洽：光标下画布本地坐标缩放前后不变（setViewZoom(2.2, cx, cy) 锚定、padding 扣除）',
      z2.z1 === 2.2 && Math.abs(z2.p0 - z2.p1) <= 0.5, JSON.stringify(z2));
    await key('keyDown', '=', 'Equal', 187, 2); await key('keyUp', '=', 'Equal', 187, 2);
    await sleep(150);
    const z3a = parseFloat(await cdp.evalJs("document.getElementById('gridCanvas').style.zoom || '1'"));
    ok('Z3 Ctrl+= → 2.2×1.1=2.42（chip 242%）',
      Math.abs(z3a - 2.42) <= 0.01 && await cdp.evalJs("document.getElementById('zoomChip').textContent") === '242%',
      'zoom=' + z3a);
    await key('keyDown', '-', 'Minus', 189, 2); await key('keyUp', '-', 'Minus', 189, 2);
    await sleep(150);
    const z3b = parseFloat(await cdp.evalJs("document.getElementById('gridCanvas').style.zoom || '1'"));
    ok('Z4 Ctrl+− → 2.42÷1.1≈2.2（chip 220%）',
      Math.abs(z3b - 2.2) <= 0.01 && await cdp.evalJs("document.getElementById('zoomChip').textContent") === '220%',
      'zoom=' + z3b);
    await cdp.evalJs("window.setViewZoom(0.01)");
    ok('Z5 钳制下限：setViewZoom(0.01) → 0.25（chip 25%）',
      await cdp.evalJs("document.getElementById('gridCanvas').style.zoom") === '0.25' &&
      await cdp.evalJs("document.getElementById('zoomChip').textContent") === '25%');
    await cdp.evalJs("window.setViewZoom(99)");
    ok('Z6 钳制上限：setViewZoom(99) → 4（chip 400%）',
      await cdp.evalJs("document.getElementById('gridCanvas').style.zoom") === '4' &&
      await cdp.evalJs("document.getElementById('zoomChip').textContent") === '400%');
    await cdp.evalJs("window.setViewZoom(1.5)");
    await cdp.evalJs("document.getElementById('zoomChip').click()");
    await sleep(150);
    ok('Z7 zoomChip 点击复位 100%：zoom 移除 + chip 100%',
      await cdp.evalJs("document.getElementById('gridCanvas').style.zoom") === '' &&
      await cdp.evalJs("document.getElementById('zoomChip').textContent") === '100%');

    // ── P 滚轮/平移：普通滚轮纵向、Shift+滚轮横向、中键长按平移、中键不误触 ──
    // 滚轮落滚动是合成器异步（实测固定 300ms 读会扑空、落点落在下一窗口）——
    // 轮询等条件满足再断言
    const SCROLL_EXPR = "(function(){ var se = document.getElementById('gridCanvas').parentElement; return { st: se.scrollTop, sl: se.scrollLeft }; })()";
    const pollScroll = async (condExpr, timeout) => {
      const t0 = Date.now();
      let last = null;
      while (Date.now() - t0 < timeout) {
        last = await cdp.evalJs(SCROLL_EXPR);
        if (await cdp.evalJs(condExpr)) return last;
        await sleep(150);
      }
      return last;
    };
    const p0 = await cdp.evalJs(SCROLL_EXPR);
    await mouse('mouseWheel', bodyPt.x, bodyPt.y, { deltaX: 0, deltaY: 240, modifiers: 0 });
    const p1 = await pollScroll("(function(){ var se = document.getElementById('gridCanvas').parentElement; return se.scrollTop > " + p0.st + " + 100; })()", 2000);
    ok('P1 普通滚轮（无修饰）→ 纵向视角移动：scrollTop 增、scrollLeft 不动（浏览器原生）',
      p1.st > p0.st + 100 && p1.sl === p0.sl, 'before ' + JSON.stringify(p0) + ' ← after ' + JSON.stringify(p1));
    await mouse('mouseWheel', bodyPt.x, bodyPt.y, { deltaX: 120, deltaY: 0, modifiers: 8 });
    const p2 = await pollScroll("(function(){ var se = document.getElementById('gridCanvas').parentElement; return se.scrollLeft > " + p1.sl + " + 60; })()", 2000);
    ok('P2 Shift+滚轮（浏览器原生换算 deltaX）→ 横向视角移动：scrollLeft 增、scrollTop 不动',
      p2.sl > p1.sl + 60 && p2.st === p1.st, 'before ' + JSON.stringify(p1) + ' ← after ' + JSON.stringify(p2));
    await cdp.evalJs("(function(){ var se = document.getElementById('gridCanvas').parentElement; se.scrollLeft = 800; se.scrollTop = 400; })()");
    await mouse('mousePressed', bodyPt.x, bodyPt.y, { button: 'middle' });
    await mouse('mouseMoved', bodyPt.x + 60, bodyPt.y + 30, { button: 'middle' });
    await mouse('mouseMoved', bodyPt.x + 100, bodyPt.y + 60, { button: 'middle' });
    await sleep(120); // v10.28.42.1：rAF 合并后等落位帧再读（同 D 段纪律）
    const p3 = await cdp.evalJs("(function(){ var se = document.getElementById('gridCanvas').parentElement; return { st: se.scrollTop, sl: se.scrollLeft }; })()");
    const p5moving = await cdp.evalJs("document.body.classList.contains('fc-moving')");
    ok('P5 平移期间玻璃挂起：body.fc-moving 在场（45.2 纪律——pan 中 backdrop-filter 暂离）',
      p5moving === true, 'fc-moving=' + p5moving);
    await mouse('mouseReleased', bodyPt.x + 100, bodyPt.y + 60, { button: 'middle' });
    ok('P3 中键长按拖动 → 平移视口：右移 100 下移 60 → scrollLeft 800→700、scrollTop 400→340（反向拖动）',
      Math.abs(p3.sl - 700) <= 2 && Math.abs(p3.st - 340) <= 2, JSON.stringify(p3));
    await sleep(400); // 还原玻璃走下一帧 rAF；flush 写引发的 scroll 事件防抖 150ms 也在内
    const p6moving = await cdp.evalJs("document.body.classList.contains('fc-moving')");
    ok('P6 松手后玻璃还原：fc-moving 已移除（滚动/平移收尾不残留挂起态）',
      p6moving === false, 'fc-moving=' + p6moving);
    // 回卷原点（卡在画布左上角 44,44，P3 平移后已滚出视口）
    await cdp.evalJs("(function(){ var se = document.getElementById('gridCanvas').parentElement; se.scrollLeft = 0; se.scrollTop = 0; })()");
    await sleep(100);
    const cardRect = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card'); var r = c.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; })()");
    await mouse('mousePressed', cardRect.l + cardRect.w / 2, cardRect.t + cardRect.h / 2, { button: 'left' });
    await mouse('mouseReleased', cardRect.l + cardRect.w / 2, cardRect.t + cardRect.h / 2, { button: 'left' });
    await sleep(150);
    const selBefore = await cdp.evalJs("!!document.querySelector('#gridCanvas .grid-card.selected')");
    await mouse('mousePressed', cardRect.l + cardRect.w / 2, cardRect.t + cardRect.h / 2, { button: 'middle' });
    await mouse('mouseReleased', cardRect.l + cardRect.w / 2, cardRect.t + cardRect.h / 2, { button: 'middle' });
    await sleep(150);
    const selAfter = await cdp.evalJs("!!document.querySelector('#gridCanvas .grid-card.selected')");
    ok('P4 中键点按卡片不误触取消选中（点按前已选中、中键点按后仍选中）',
      selBefore === true && selAfter === true, 'before=' + selBefore + ' after=' + selAfter);

    // ── D 缩放下手势精确性（1.5× 下 33 屏幕px = 22 画布px = 整格）──
    // 点空白画布取消选中（手柄会盖住卡边按点，先清场）
    await mouse('mousePressed', bodyPt.x, bodyPt.y + 80, { button: 'left' });
    await mouse('mouseReleased', bodyPt.x, bodyPt.y + 80, { button: 'left' });
    await sleep(150);
    // 锚在卡中心放大（锚在别处会把卡推出视口——卡在画布左上角）
    await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card'); var r = c.getBoundingClientRect(); window.setViewZoom(1.5, r.left + r.width / 2, r.top + r.height / 2); })()");
    await sleep(150);
    const d0rect = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card'); var r = c.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; })()");
    const d0left = await cdp.evalJs("document.querySelector('#gridCanvas .grid-card').style.left");
    await mouse('mousePressed', d0rect.l + 5, d0rect.t + 5, { button: 'left' });
    await mouse('mouseMoved', d0rect.l + 5 + 11, d0rect.t + 5, { button: 'left' });
    await mouse('mouseMoved', d0rect.l + 5 + 22, d0rect.t + 5, { button: 'left' });
    await mouse('mouseMoved', d0rect.l + 5 + 33, d0rect.t + 5, { button: 'left' });
    await sleep(250); // rAF 落位帧
    await mouse('mouseReleased', d0rect.l + 5 + 33, d0rect.t + 5, { button: 'left' });
    await cdp.evalJs("window.onContentChange()"); // 确定性触发快照提交（拖拽落子是否自带钩子不定）
    await sleep(900); // 600ms 防抖历史快照按动作逐次落定（撤销链逐步断言需要）
    const d1 = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card'); return { left: parseFloat(c.style.left), top: parseFloat(c.style.top), w: c.offsetWidth }; })()");
    ok('D1 1.5× 下拖卡：+33 屏幕px = +22 画布px，吸附整格 left 22→44（top 22 不变）',
      d1.left === 44 && d1.top === 22 && d1.w === 130, 'before=' + d0left + ' after ' + JSON.stringify(d1));
    const d2h = await cdp.evalJs("(function(){ var h = document.querySelector('.resize-handle[data-dir=\"se\"]'); if (!h) return null; var r = h.getBoundingClientRect(); return { l: r.left + r.width / 2, t: r.top + r.height / 2 }; })()");
    await mouse('mousePressed', d2h.l, d2h.t, { button: 'left' });
    await mouse('mouseMoved', d2h.l + 11, d2h.t, { button: 'left' });
    await mouse('mouseMoved', d2h.l + 22, d2h.t, { button: 'left' });
    await mouse('mouseMoved', d2h.l + 33, d2h.t, { button: 'left' });
    await sleep(250);
    await mouse('mouseReleased', d2h.l + 33, d2h.t, { button: 'left' });
    await cdp.evalJs("window.onContentChange()");
    await sleep(900);
    const d2 = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card'); return { w: c.offsetWidth, span: c.dataset.colSpan }; })()");
    ok('D2 1.5× 下 se 手柄 +33 屏幕px = +22 画布px：colSpan 6→7、宽 130→152（offsetWidth 画布本地不受 zoom 污染）',
      d2.span === '7' && d2.w === 152, JSON.stringify(d2));
    const d3g = await cdp.evalJs("(function(){ var g = document.querySelector('.rotate-grip'); if (!g) return null; var r = g.getBoundingClientRect(); return { l: r.left + r.width / 2, t: r.top + r.height / 2 }; })()");
    await mouse('mousePressed', d3g.l, d3g.t, { button: 'left' });
    await mouse('mouseMoved', d3g.l - 20, d3g.t - 10, { button: 'left' });
    await mouse('mouseMoved', d3g.l - 40, d3g.t - 25, { button: 'left' });
    await sleep(250);
    await mouse('mouseReleased', d3g.l - 40, d3g.t - 25, { button: 'left' });
    await cdp.evalJs("window.onContentChange()");
    await sleep(900);
    const d3 = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card'); return { rot: parseFloat(c.dataset.rotate) || 0, tf: c.style.transform }; })()");
    ok('D3 1.5× 下 rotate grip 拖动：角度改变（≠0、transform 旋转在场、范围合理）',
      d3.rot !== 0 && d3.tf.indexOf('rotate') !== -1 && Math.abs(d3.rot) <= 90, JSON.stringify(d3));

    // ── R 回归：撤销/恢复链 + 查看模式零缩放守卫 ──
    await cdp.evalJs("window.historyUndoAction()"); await sleep(150);
    const r1a = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card'); return { rot: parseFloat(c.dataset.rotate) || 0, left: parseFloat(c.style.left), w: c.offsetWidth }; })()");
    await cdp.evalJs("window.historyUndoAction()"); await sleep(150);
    const r1b = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card'); return { rot: parseFloat(c.dataset.rotate) || 0, left: parseFloat(c.style.left), w: c.offsetWidth, span: c.dataset.colSpan }; })()");
    await cdp.evalJs("window.historyUndoAction()"); await sleep(150);
    const r1c = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card'); return { left: parseFloat(c.style.left), w: c.offsetWidth }; })()");
    ok('R1 撤销链三步：旋转归 0 → resize 还原 span6/宽130 → 拖拽还原 left 22（缩放系统未破坏历史快照链）',
      r1a.rot === 0 && r1b.span === '6' && r1b.w === 130 && r1b.left === 44 && r1c.left === 22 && r1c.w === 130,
      'a=' + JSON.stringify(r1a) + ' b=' + JSON.stringify(r1b) + ' c=' + JSON.stringify(r1c));
    await cdp.evalJs("window.historyRedoAction()"); await sleep(150);
    await cdp.evalJs("window.historyRedoAction()"); await sleep(150);
    await cdp.evalJs("window.historyRedoAction()"); await sleep(150);
    const r2 = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card'); return { rot: parseFloat(c.dataset.rotate) || 0, left: parseFloat(c.style.left), w: c.offsetWidth }; })()");
    ok('R2 恢复链三步：left 44 + span7/宽152 + 旋转回来（≠0）',
      r2.left === 44 && r2.w === 152 && r2.rot !== 0, JSON.stringify(r2));

    // ── V 查看模式：fit1to1 零缩放守卫（Ctrl+滚轮/setViewZoom 全不生效）──
    await nav(BASE + '/pages/fluidcanvas-editor.html?article=ART-CLOUD-1',
      "document.querySelectorAll('#gridCanvas .grid-card').length === 4 && !!document.getElementById('fcViewScaler')", 'V 查看器加载');
    const FIT_SELFCHECK = "(function(){ var g = document.getElementById('gridCanvas'); var s = document.getElementById('fcViewScaler'); var m = g.style.transform.match(/scale\\(([\\d.]+)\\)/); if (!m) return false; var sv = parseFloat(m[1]); var any = false, maxBY = -1e9; document.querySelectorAll('#gridCanvas .grid-card').forEach(function (e) { if (getComputedStyle(e).display === 'none') return; any = true; var rad = ((parseFloat(e.dataset.rotate || 0) * Math.PI) / 180); var rh = e.offsetWidth * Math.abs(Math.sin(rad)) + e.offsetHeight * Math.abs(Math.cos(rad)); var cy = e.offsetTop + e.offsetHeight / 2; maxBY = Math.max(maxBY, cy + rh / 2); }); var contentRows = any ? Math.max(1, Math.ceil(maxBY / 22)) : 0; var stageW = 2530, stageH = (Math.max(70, contentRows) + 25) * 22; var availW = Math.max(200, s.parentNode.clientWidth - 32); var availH = Math.max(200, s.parentNode.clientHeight - 32); var exp = Math.max(0.25, Math.min(availW / stageW, availH / stageH)); return Math.abs(sv - exp) <= 0.01 && Math.abs(s.clientWidth - Math.round(stageW * sv)) <= 2 && g.style.left === '0px'; })()";
    ok('V1 查看模式 fit1to1 完整舞台自洽（s=min(availW/2530,availH/stageH)、scaler=stage×s、canvas 0,0 零平移）',
      await cdp.evalJs(FIT_SELFCHECK) === true);
    const vPt = await cdp.evalJs("(function(){ var r = document.getElementById('gridCanvas').getBoundingClientRect(); return { x: r.left + 200, y: r.top + 200 }; })()");
    await mouse('mouseWheel', vPt.x, vPt.y, { deltaX: 0, deltaY: -120, modifiers: 2 });
    await sleep(200);
    await cdp.evalJs("window.setViewZoom(2)");
    await sleep(100);
    ok('V2 查看模式零缩放守卫：Ctrl+滚轮 + setViewZoom(2) 均不生效（zoom 恒未施加、fit 变换不动）',
      await cdp.evalJs("document.getElementById('gridCanvas').style.zoom") === '' &&
      await cdp.evalJs("document.getElementById('gridCanvas').style.transform.indexOf('scale(') !== -1"),
      await cdp.evalJs("document.getElementById('gridCanvas').style.transform"));

    // ── E 全程零 Runtime exception + 零 console error ──
    ok('E5 全程零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 5).join(' | ') || '干净');
    ok('E6 全程零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 5).join(' | ') || '干净');
    cdp.close();
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    server.close();
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  try { chrome.kill(); } catch (e) {}
  server.close();
  console.log('');
  console.log(FAIL === 0 ? '🎉 全部通过 ' + PASS + '/' + PASS : '💔 失败 ' + FAIL + ' / 共 ' + (PASS + FAIL));
  process.exit(FAIL === 0 ? 0 : 1);
})();
