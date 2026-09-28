// tmp-probe-fc-44x3-live.js — FC v10.28.47.4 上线实机探针（合拼边缘不齐修复 + 触控上传修复 + 125→115 格宽）
// 用户「平板移动端在合拼卡片之后边缘会不齐，和无法点击上传图片」+「把125格宽减少一个10格」——44.3 线上实证：
//   S 静态（线上 site-config 44.3 + 平板合拼/触控上传 changelog + rev 00293- + 站点 58.0 恒、
//   编辑器 bbox 落位锚+computeCols 115+覆盖层挂载/CSS 锚、article.html STAGE_COLS 115、
//   fc-touch.js 在位）/ B 实机（CDP iPad 仿真 + 文件选择器拦截 + 桌面鼠标拖拽：
//   B0 门控；B1 编辑态 115 格 2528 全覆盖+拉条；B2 浮点 zoom 1.2347 旋转目标 30° 左并
//   bbox flush ≤0.5（bug 判别项）；B3 头像 tap → 选择器第 1 次拦截；B4 空图态地图 tap →
//   第 2 次拦截；B5 有图态收层 display:none + tap 不再弹）/ E1 零异常。
// 全 Node 内置模块：https + ws CDP（登录态 stub 同 fc-tablet 探针口径）。
'use strict';
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PASS = { n: 0 }, FAIL = { n: 0 };
const ok = (name, cond, detail) => {
  if (cond) { PASS.n++; console.log('  ✅ ' + name); }
  else { FAIL.n++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
};
const get = (url) => new Promise((resolve) => {
  const req = https.request(url, { headers: { 'User-Agent': 'mn-probe' }, timeout: 30000 }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 800000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; this.consoleErrs = []; this.fileChoosers = []; }
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
        this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 300));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
      } else if (m.method === 'Page.fileChooserOpened') {
        this.fileChoosers.push(m.params);
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

(async () => {
  const BASE = 'https://mnationworld.com';

  // ── S 线上静态 ──
  const sc = await get(BASE + '/assets/js/site-config.js');
  ok('S1 线上 site-config：FC v10.28.47.4 + 平板合拼边缘不齐/触控上传 changelog + rev 00293- + 站点恒 v0.2.58.15',
    sc.status === 200 && sc.body.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") !== -1 &&
    sc.body.indexOf('平板合拼边缘不齐') !== -1 && sc.body.indexOf('触控上传修复') !== -1 &&
    sc.body.indexOf('rev 00293-') !== -1 && sc.body.indexOf('v0.2.58.15') !== -1,
    'status=' + sc.status + ' err=' + sc.error);
  const fc = await get(BASE + '/pages/fluidcanvas-editor.html');
  ok('S2 线上编辑器页：bbox 落位锚（tbb/cb0 面并集）+ 旧 offsetWidth 落位零在场 + computeCols 115 + STAGE_COLS 115 + 覆盖层挂载/CSS 锚在位',
    fc.status === 200 &&
    fc.body.indexOf('var tbb = cardBBox(target, tL, tT);') !== -1 &&
    fc.body.indexOf('tbb.right - cb0.left') !== -1 &&
    fc.body.indexOf('fL - cb0.left') !== -1 &&
    fc.body.indexOf('tL + target.offsetWidth') === -1 &&
    /function computeCols\(\)[\s\S]{0,80}return 115;/.test(fc.body) &&
    fc.body.indexOf('var STAGE_COLS = 115, STAGE_BASE_ROWS = 70, STAGE_GROW = 25;') !== -1 &&
    fc.body.indexOf("fi.className = 'card-upload-input'") !== -1 &&
    fc.body.indexOf('avatar.replaceChildren(fi)') !== -1 &&
    fc.body.indexOf('canvas.appendChild(fi)') !== -1 &&
    fc.body.indexOf('.map-canvas:not(.map-empty) .card-upload-input') !== -1,
    'status=' + fc.status + ' err=' + fc.error);
  const art = await get(BASE + '/pages/article.html');
  ok('S3 线上阅读页：STAGE_COLS = 115（115×22=2530 与编辑/查看同源）',
    art.status === 200 &&
    art.body.indexOf('var STAGE_COLS = 115, STAGE_BASE_ROWS = 70, STAGE_GROW = 25;') !== -1,
    'status=' + art.status + ' err=' + art.error);
  const tj = await get(BASE + '/assets/js/fc-touch.js');
  ok('S4 线上 fc-touch.js：可加载 + inEditableZone input 豁免（覆盖层直击原生路径的桥零拦截依据）',
    tj.status === 200 &&
    tj.body.indexOf("matchMedia('(pointer: coarse)')") !== -1 &&
    tj.body.indexOf("el.closest('input, textarea, select, button, a") !== -1,
    'status=' + tj.status + ' err=' + tj.error);

  // ── B 线上实机（iPad 仿真 + 文件选择器拦截 + 桌面鼠标拖拽混用）──
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const CDP_PORT = 9700 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-fc44x3-' + Date.now());
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
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 834, height: 1194, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.send('Page.setInterceptFileChooserDialog', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "!!document.getElementById('gridCanvas') && !!window.createSneCard && !!window.__fcTouch", 30000, 'B 编辑器加载');
    await sleep(800);

    const mouse = async (type, x, y, opts) =>
      cdp.send('Input.dispatchMouseEvent', Object.assign({ type: type, x: x, y: y, button: 'none', clickCount: 1, modifiers: 0 }, opts || {}));
    const tch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type: type, touchPoints: pts });
    const tpoint = (id, x, y) => ({ x: Math.round(x), y: Math.round(y), radiusX: 2, radiusY: 2, force: 1, id: id });
    const tapAt = async (x, y) => { await tch('touchStart', [tpoint(0, x, y)]); await sleep(50); await tch('touchEnd', []); await sleep(120); };
    const dragMouse = async (x1, y1, x2, y2, steps) => {
      await mouse('mousePressed', x1, y1, { button: 'left' });
      await sleep(30);
      for (let i = 1; i <= steps; i++) {
        await sleep(16);
        await mouse('mouseMoved', x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps, { button: 'left' });
      }
      await sleep(250);
      await mouse('mouseReleased', x2, y2, { button: 'left' });
      await sleep(200);
    };

    const gate = await cdp.evalJs("(function(){ return { coarse: matchMedia('(pointer: coarse)').matches, mtp: navigator.maxTouchPoints, bridge: !!window.__fcTouch }; })()");
    ok('B0 门控自证：coarse 媒体查询翻转 + maxTouchPoints=5 + 触控桥在场',
      gate && gate.coarse === true && gate.mtp === 5 && gate.bridge, JSON.stringify(gate));

    // B1 编辑态 115 格：--grid-cols=115 + 画布盒 2528 全覆盖 + 横向拉条（线上）
    const b1 = await cdp.evalJs("(function(){ var gc = document.getElementById('gridCanvas'); var body = gc.parentElement;" +
      " var cols = parseInt(getComputedStyle(gc).getPropertyValue('--grid-cols').trim(), 10);" +
      " var cs = parseInt(getComputedStyle(gc).getPropertyValue('--cell-size').trim(), 10);" +
      " return { cols: cols, cs: cs, canvasW: gc.offsetWidth, scrollW: body.scrollWidth, clientW: body.clientWidth }; })()");
    ok('B1 编辑态 115 格：cols=115 + cellSize 20 + 画布盒 2528（115×20+114×2）全覆盖 + 横向拉条（scrollW>clientW）',
      b1 && b1.cols === 115 && b1.cs === 20 && b1.canvasW === 2528 && b1.scrollW > b1.clientW,
      JSON.stringify(b1));

    // B2 浮点 zoom 1.2347 + 旋转目标 30° 左并 → bbox flush ≤0.5（旧整数边落位 ~52px 错开的 bug 判别项）
    await cdp.evalJs("window.setViewZoom(1.2347)"); await sleep(150);
    await cdp.evalJs("window.createSneCard(2, 2, 9, 12)"); await sleep(200);
    await cdp.evalJs("window.createSneCard(14, 2, 9, 12)"); await sleep(200);
    await cdp.evalJs("(function(){ var b = document.querySelectorAll('#gridCanvas .grid-card')[1]; b.dataset.rotate = 30; b.style.transform = 'rotate(30deg)'; return true; })()");
    await sleep(150);
    await cdp.evalJs("(function(){ window.__bb = function(c){ var l = parseFloat(c.style.left)||0, t = parseFloat(c.style.top)||0;" +
      " var w = c.offsetWidth, h = c.offsetHeight;" +
      " var rad = Math.abs(parseFloat(c.dataset.rotate)||0) * Math.PI / 180;" +
      " var bw = Math.abs(w*Math.cos(rad)) + Math.abs(h*Math.sin(rad));" +
      " var bh = Math.abs(w*Math.sin(rad)) + Math.abs(h*Math.cos(rad));" +
      " var cx = l + w/2, cy = t + h/2;" +
      " return { left: cx-bw/2, top: cy-bh/2, right: cx+bw/2, bottom: cy+bh/2, w: w, h: h }; }; return true; })()");
    const b2pt = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card');" +
      " if (!c) return null; var r = c.getBoundingClientRect();" +
      " var bad = 'input, textarea, select, button, a, [contenteditable=\"true\"], .card-text-content, .card-edit-field, .card-label, .resize-handle, .rotate-grip';" +
      " for (var fy = 0.15; fy <= 0.85; fy += 0.1) for (var fx = 0.15; fx <= 0.85; fx += 0.1) {" +
      "  var el = document.elementFromPoint(r.left + r.width*fx, r.top + r.height*fy);" +
      "  if (el && el.closest('.grid-card') === c && !el.closest(bad)) return { x: Math.round(r.left + r.width*fx), y: Math.round(r.top + r.height*fy) };" +
      " } return null; })()");
    const b2tg = await cdp.evalJs("(function(){ var z = parseFloat(document.getElementById('gridCanvas').style.zoom)||1;" +
      " var cards = document.querySelectorAll('#gridCanvas .grid-card'); var a = cards[0], b = cards[1];" +
      " var bbB = window.__bb(b); var wantLeft = bbB.left - a.offsetWidth;" +
      " return { dx: (wantLeft - (parseFloat(a.style.left)||0)) * z }; })()");
    await dragMouse(b2pt.x, b2pt.y, b2pt.x + b2tg.dx, b2pt.y, 8);
    const b2 = await cdp.evalJs("(function(){ var cards = document.querySelectorAll('#gridCanvas .grid-card');" +
      " var a = cards[0], b = cards[1]; var bbA = window.__bb(a), bbB = window.__bb(b);" +
      " return { fl: Math.abs(bbA.right - bbB.left), gidA: a.dataset.groupId || '', gidB: b.dataset.groupId || '' }; })()");
    ok('B2 浮点 zoom 1.2347 + 旋转目标 30° 左并：bbox 贴齐 ≤0.5 + 同组（线上实证 bbox 落位）',
      b2 && b2.fl <= 0.5 && b2.gidA && b2.gidA === b2.gidB, JSON.stringify(b2));

    // B3 头像 tap → 文件选择器第 1 次拦截（原生 input 直击用户激活实证）
    await cdp.evalJs('window.createCharacterCard(2, 18, 4, 5)'); await sleep(250);
    const avPt = await cdp.evalJs("(function(){ var av = document.querySelector('#gridCanvas .char-avatar');" +
      " if (!av) return null; var r = av.getBoundingClientRect(); return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()");
    await tapAt(avPt.x, avPt.y);
    await sleep(400);
    ok('B3 头像 tap → 文件选择器弹出（第 1 次拦截）', cdp.fileChoosers.length === 1, 'choosers=' + cdp.fileChoosers.length);

    // B4 空图态地图画布 tap → 文件选择器第 2 次拦截
    await cdp.evalJs('window.createMapCard(8, 18, 8, 6)'); await sleep(250);
    const mcPt = await cdp.evalJs("(function(){ var mc = document.querySelector('#gridCanvas .map-canvas');" +
      " if (!mc) return null; var r = mc.getBoundingClientRect(); return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()");
    await tapAt(mcPt.x, mcPt.y);
    await sleep(400);
    ok('B4 空图态地图画布 tap → 文件选择器弹出（第 2 次拦截）', cdp.fileChoosers.length === 2, 'choosers=' + cdp.fileChoosers.length);

    // B5 有图态收层：覆盖层 display:none + tap 不再弹选择器
    const b5disp = await cdp.evalJs("(function(){ var card = document.querySelector('#gridCanvas .map-card');" +
      " var mc = card.querySelector('.map-canvas'); card.dataset.mapImg = 'probe-fake';" +
      " mc.classList.remove('map-empty');" +
      " return getComputedStyle(mc.querySelector('.card-upload-input')).display; })()");
    await tapAt(mcPt.x, mcPt.y);
    await sleep(400);
    ok('B5 有图态收层：覆盖层 display:none + tap 不再弹选择器（仍 ' + cdp.fileChoosers.length + ' 次）',
      b5disp === 'none' && cdp.fileChoosers.length === 2,
      'disp=' + b5disp + ' choosers=' + cdp.fileChoosers.length);

    ok('E1 实机全程零 Runtime.exceptionThrown + 零 console.error',
      cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      JSON.stringify({ errs: cdp.errs.slice(0, 3), cons: cdp.consoleErrs.slice(0, 3) }));
    cdp.close();
  } catch (e) {
    console.error('💥 探针异常: ' + (e && e.stack || e));
    FAIL.n++;
  } finally {
    try { chrome.kill(); } catch (e) {}
  }
  console.log('');
  console.log('╭──────────────────────────────────────────╮');
  console.log('│  🎉 ' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌  (fc-44x3-live)           │');
  console.log('╰──────────────────────────────────────────╯');
  if (FAIL.n > 0) process.exit(1);
  else process.exit(0);
})().catch((e) => { console.error('💥 探针异常: ' + (e && e.stack || e)); process.exit(1); });
