// tmp-battery-fc-tablet.js — FC v10.28.48.0 iPad 触控适配电池
// 用户「能不能先对平板做一下FC的操作适配？」——触控桥（fc-touch.js 合成 MouseEvent 喂既有监听链）
//   + 粗指针 CSS（44px 按钮/手柄命中区扩 28px/菜单 60vh 内部滚动）+ 7577 组拆分计时器守卫。
// 验证：S 静态锚（site-config 44.1 + changelog + 00293- 占位 / fc-touch.js 在位可加载 / 7577 守卫
//   / 粗指针 CSS 锚）/ B 触控实测（CDP touch 仿真——iPad 竖屏 834×1194 dsf2 + 5 触点：
//   B0 门控自证 coarse+maxTouchPoints=5+桥在场；B1 tap 选中 8 手柄；B2 拖卡 60/40±2 + fc-moving
//   中途 + justDragged 盖章；B3 se 手柄缩放 +26±6；B4 长按 650ms 菜单 + 组卡 groupId 不被拆
//   （守卫证明）；B5 双指捏合 zoom 1→1.4 + 等距双指平移 scroll+75±20；B6 单指平移 scroll 增 +
//   惯性不回退 + 空画布 tap 取消选中；B7 tap 资产建卡 视口中心 + 400ms 冷却防重复）/ E 零异常。
// 鼠标路径断言不进本电池（桌面由舰队 19 套全绿证明，避开合成事件双重处理歧义）。
// （house CDP 模式；判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4900 + Math.floor(Math.random() * 80);
const CDP_PORT = 5900 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fctablet-' + Date.now());
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
    // iPad 竖屏 + 5 点触控仿真——必须先于任何 navigate（触控仿真翻转 (pointer:coarse) 媒体查询）
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 834, height: 1194, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    return cdp;
  };

  try {
    // ── S 静态锚 ──
    const siteCfg = await (await fetch(BASE + '/assets/js/site-config.js')).text();
    const editorHtml = (await (await fetch(BASE + '/pages/fluidcanvas-editor.html')).text()).replace(/\r\n/g, '\n');
    const touchJs = await (await fetch(BASE + '/assets/js/fc-touch.js')).text();
    ok('S1 site-config：FC v10.28.48.0 + changelog iPad 触控适配条目 + rev 00293- 占位 + 站点恒 v0.2.58.28',
      siteCfg.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.52.1';") !== -1 &&
      siteCfg.indexOf('iPad 触控适配') !== -1 &&
      siteCfg.indexOf('00293-') !== -1 && siteCfg.indexOf('v0.2.58.28') !== -1);
    ok('S2 fc-touch.js：本地可加载 + 粗指针门控/测试钩/守卫旗在位 + 编辑器页 script 标签在位',
      touchJs.indexOf("matchMedia('(pointer: coarse)')") !== -1 &&
      touchJs.indexOf('window.__fcTouch') !== -1 &&
      touchJs.indexOf('window.__fcTouchGesture') !== -1 &&
      editorHtml.indexOf('<script src="../assets/js/fc-touch.js"></script>') !== -1);
    ok('S3 7577 组拆分计时器守卫：新写法在场 + 旧裸写法零残留',
      editorHtml.indexOf('if (card.dataset.groupId && !window.__fcTouchGesture) {') !== -1 &&
      editorHtml.indexOf('if (card.dataset.groupId) {\n        dragState.longPressTimer') === -1);
    ok('S4 粗指针 CSS 块：门控/命中区/44px/菜单 60vh/去 callout/tap 高亮锚在场',
      editorHtml.indexOf('@media (hover: none) and (pointer: coarse)') !== -1 &&
      editorHtml.indexOf('touch-action: none; overscroll-behavior: none;') !== -1 &&
      editorHtml.indexOf('.resize-handle::after { content: \'\'; position: absolute; inset: -9px; }') !== -1 &&
      editorHtml.indexOf('.resize-handle[data-dir="nw"], .resize-handle[data-dir="ne"],') !== -1 &&
      editorHtml.indexOf('z-index: 61;') !== -1 &&
      editorHtml.indexOf('min-width: 44px; min-height: 44px') !== -1 &&
      editorHtml.indexOf('max-height: 60vh') !== -1 &&
      editorHtml.indexOf('-webkit-touch-callout: none;') !== -1 &&
      editorHtml.indexOf('touch-action: manipulation;') !== -1 &&
      editorHtml.indexOf('-webkit-tap-highlight-color: transparent;') !== -1);

    const cdp = await connectCdp(CDP_PORT);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };

    // ── 触控手势 helper（Input.dispatchTouchEvent：touchStart 带全部触点/touchMove 只发移动点/touchEnd 空数组）──
    const tch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type: type, touchPoints: pts });
    const tpoint = (id, x, y) => ({ x: Math.round(x), y: Math.round(y), radiusX: 2, radiusY: 2, force: 1, id: id });
    const tapAt = async (x, y) => { await tch('touchStart', [tpoint(0, x, y)]); await sleep(50); await tch('touchEnd', []); await sleep(100); };
    const dragTouch = async (x1, y1, x2, y2, steps, mid) => {
      await tch('touchStart', [tpoint(0, x1, y1)]);
      await sleep(30);
      for (let i = 1; i <= steps; i++) {
        await sleep(16);
        await tch('touchMove', [tpoint(0, x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps)]);
        if (mid && i === Math.floor(steps / 2)) await mid();
      }
      await sleep(25);
      await tch('touchEnd', []);
      await sleep(80);
    };
    const holdTouch = async (x, y, ms) => { await tch('touchStart', [tpoint(0, x, y)]); await sleep(ms); await tch('touchEnd', []); await sleep(120); };
    const emptyPoint = () => cdp.evalJs("(function(){ var cv = document.getElementById('gridCanvas');" +
      " for (var y = 80; y < 1150; y += 36) for (var x = 80; x < 800; x += 36) {" +
      "  var el = document.elementFromPoint(x, y);" +
      "  if (el && (el === cv || (el.closest && el.closest('.grid-group-bg')))) return { x: x, y: y }; } return null; })()");
    // 卡面取点：扫描避开可编辑区（SNE 卡中心是 sne-val 数字输入框——桌面同样
    // 不 arm 拖拽，桥豁免是正确的；手势必须落在卡身非编辑区）
    const cardPoint = () => cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card');" +
      " if (!c) return null; var r = c.getBoundingClientRect();" +
      " var bad = 'input, textarea, select, button, a, [contenteditable=\"true\"], .card-text-content, .card-edit-field, .card-label, .resize-handle, .rotate-grip, .sheet-col-grip, .sheet-row-grip';" +
      " for (var fy = 0.2; fy <= 0.85; fy += 0.15) for (var fx = 0.2; fx <= 0.85; fx += 0.15) {" +
      "  var el = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);" +
      "  if (el && el.closest('.grid-card') === c && !el.closest(bad)) return { x: Math.round(r.left + r.width * fx), y: Math.round(r.top + r.height * fy) };" +
      " } return null; })()");

    // ── B 触控实测 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "!!document.getElementById('gridCanvas') && !!window.createSneCard && !!window.__fcTouch", 'B 编辑器加载');

    const gate = await cdp.evalJs("(function(){ return { coarse: matchMedia('(pointer: coarse)').matches, mtp: navigator.maxTouchPoints, bridge: !!window.__fcTouch, stats: !!(window.__fcTouch && window.__fcTouch.stats) }; })()");
    ok('B0 门控自证：coarse 媒体查询翻转 + maxTouchPoints=5 + 触控桥在场（测试钩可断言）',
      gate && gate.coarse === true && gate.mtp === 5 && gate.bridge && gate.stats, JSON.stringify(gate));

    // B1 tap 选中（8 手柄现身）
    await cdp.evalJs('window.createSneCard(2, 2, 9, 12)');
    await sleep(200);
    const snePt = await cardPoint();
    await tapAt(snePt.x, snePt.y);
    const b1 = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card');" +
      " return { sel: c.classList.contains('selected'), handles: document.querySelectorAll('#gridCanvas .resize-handle').length," +
      " tap: window.__fcTouch.stats.tap, active: window.__fcTouch.active() }; })()");
    ok('B1 tap 选中：.selected 类 + 8 缩放手柄现身 + stats.tap=1 + 手势已结束',
      b1 && b1.sel === true && b1.handles === 8 && b1.tap === 1 && b1.active === false, JSON.stringify(b1));

    // B2 拖卡（关吸附对齐 → 精确位移；中途 fc-moving；松手 justDragged 盖章）
    await cdp.evalJs("(function(){ if (document.getElementById('snapToggle').classList.contains('active')) window.toggleSnap();" +
      " if (document.getElementById('alignToggle').classList.contains('active')) window.toggleAlign(); return true; })()");
    const beforeDrag = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); return { l: parseFloat(c.style.left) || 0, t: parseFloat(c.style.top) || 0 }; })()");
    const movedMid = { v: false };
    await dragTouch(snePt.x, snePt.y, snePt.x + 60, snePt.y + 40, 12, async () => {
      movedMid.v = await cdp.evalJs("document.body.classList.contains('fc-moving')");
    });
    await sleep(40);
    const afterDrag = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card');" +
      " return { l: parseFloat(c.style.left) || 0, t: parseFloat(c.style.top) || 0, jd: c.dataset.justDragged || '', drag: window.__fcTouch.stats.drag }; })()");
    ok('B2 拖卡：+60/+40 位移 ±2 + 手势中 fc-moving + 松手 justDragged 盖章 + stats.drag=1',
      movedMid.v === true &&
      Math.abs((afterDrag.l - beforeDrag.l) - 60) <= 2 && Math.abs((afterDrag.t - beforeDrag.t) - 40) <= 2 &&
      afterDrag.jd === '1' && afterDrag.drag === 1,
      JSON.stringify({ mid: movedMid.v, before: beforeDrag, after: afterDrag }));

    // B3 se 手柄缩放（吸附回开 → 整格 +26±6）
    await cdp.evalJs("(function(){ if (!document.getElementById('snapToggle').classList.contains('active')) window.toggleSnap(); return true; })()");
    const beforeSize = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); return { w: c.offsetWidth, h: c.offsetHeight }; })()");
    const sePt = await cdp.evalJs("(function(){ var h = document.querySelector('#gridCanvas .resize-handle[data-dir=\"se\"]'); var r = h.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    await dragTouch(sePt.x, sePt.y, sePt.x + 26, sePt.y + 26, 10);
    await sleep(120);
    const afterSize = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); return { w: c.offsetWidth, h: c.offsetHeight }; })()");
    ok('B3 se 手柄缩放：宽高各 +26±6（整格吸附）',
      Math.abs((afterSize.w - beforeSize.w) - 26) <= 6 && Math.abs((afterSize.h - beforeSize.h) - 26) <= 6,
      JSON.stringify({ before: beforeSize, after: afterSize }));

    // B4 长按 650ms → 菜单；组卡 long-press 后 groupId 仍在（7577 守卫证明）
    await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); c.dataset.groupId = 'batt-g1'; return true; })()");
    const snePt2 = await cardPoint();
    await holdTouch(snePt2.x, snePt2.y, 650);
    const b4 = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu'); var c = document.querySelector('#gridCanvas .sne-card');" +
      " return { menuOpen: !!m && getComputedStyle(m).display !== 'none', longPress: window.__fcTouch.stats.longPress," +
      " gid: c.dataset.groupId || '' }; })()");
    ok('B4 长按菜单：菜单现身 + stats.longPress=1 + 组卡 groupId 未被 600ms 计时器拆走',
      b4 && b4.menuOpen === true && b4.longPress === 1 && b4.gid === 'batt-g1', JSON.stringify(b4));
    await cdp.evalJs("var cm = document.querySelector('.context-menu'); if (cm) cm.style.display = 'none'");

    // B5 双指捏合（200→280 距离 → zoom 1→1.4）+ 等距双指平移
    const ep = await emptyPoint();
    const zoomBefore = await cdp.evalJs("(function(){ var cv = document.getElementById('gridCanvas'); return { z: parseFloat(cv.style.zoom) || 1, chip: document.getElementById('zoomChip').textContent }; })()");
    const pcx = ep.x, pcy = ep.y;
    await tch('touchStart', [tpoint(0, pcx - 100, pcy), tpoint(1, pcx + 100, pcy)]);
    for (let i = 1; i <= 4; i++) {
      await sleep(20);
      await tch('touchMove', [tpoint(0, pcx - 100 - i * 10, pcy), tpoint(1, pcx + 100 + i * 10, pcy)]);
    }
    await tch('touchEnd', []);
    await sleep(200);
    const zoomAfter = await cdp.evalJs("(function(){ var cv = document.getElementById('gridCanvas'); return { z: parseFloat(cv.style.zoom) || 1, chip: document.getElementById('zoomChip').textContent, pinch: window.__fcTouch.stats.pinch }; })()");
    ok('B5a 双指捏合：zoom 1→1.4±0.1 + zoomChip 非 100% + stats.pinch≥1',
      zoomAfter.z > 1.3 && zoomAfter.z < 1.5 && zoomAfter.chip !== '100%' && zoomAfter.pinch >= 1,
      JSON.stringify({ before: zoomBefore, after: zoomAfter }));
    // 先单指左拖建立 scrollLeft 余量（双指右移 = scrollLeft 减小，无余量会被 0 夹住）
    await dragTouch(ep.x, ep.y, ep.x - 110, ep.y, 12);
    await sleep(500); // 惯性停
    const epB = await cdp.evalJs("(function(){ var cv = document.getElementById('gridCanvas');" +
      " for (var y = 100; y < 1050; y += 28) for (var x = 240; x <= 594; x += 28) {" +
      "  if (document.elementFromPoint(x, y) === cv) return { x: x, y: y }; } return null; })()");
    const panBefore = await cdp.evalJs("(function(){ var eb = document.querySelector('.editor-body'); return { l: eb.scrollLeft, t: eb.scrollTop }; })()");
    await tch('touchStart', [tpoint(0, epB.x - 140, epB.y), tpoint(1, epB.x + 140, epB.y)]);
    for (let i = 1; i <= 3; i++) {
      await sleep(20);
      await tch('touchMove', [tpoint(0, epB.x - 140 + i * 25, epB.y), tpoint(1, epB.x + 140 + i * 25, epB.y)]);
    }
    await tch('touchEnd', []);
    await sleep(150);
    const panAfter = await cdp.evalJs("(function(){ var eb = document.querySelector('.editor-body'); return { l: eb.scrollLeft, t: eb.scrollTop }; })()");
    ok('B5b 等距双指平移：scrollLeft -75±20（余量 ' + panBefore.l + ' → ' + panAfter.l + '；手指右移 = scrollLeft 减小）',
      panBefore.l >= 90 && Math.abs((panAfter.l - panBefore.l) + 75) <= 20, JSON.stringify({ before: panBefore, after: panAfter }));
    await cdp.evalJs('window.resetViewZoom ? window.resetViewZoom() : 0');
    await sleep(200);

    // B6 单指平移 + 惯性 + 空画布 tap 取消选中
    const ep2 = await emptyPoint();
    await cdp.evalJs('window.__fcTouch.stats.pan = 0'); // 重置——B5b 余量平移已 +1
    const pan0 = await cdp.evalJs("(function(){ var eb = document.querySelector('.editor-body'); return { l: eb.scrollLeft, t: eb.scrollTop }; })()");
    await dragTouch(ep2.x, ep2.y, ep2.x - 80, ep2.y - 50, 12);
    const panRel = await cdp.evalJs("(function(){ var eb = document.querySelector('.editor-body'); return { l: eb.scrollLeft, t: eb.scrollTop, pan: window.__fcTouch.stats.pan }; })()");
    await sleep(380);
    const panMom = await cdp.evalJs("(function(){ var eb = document.querySelector('.editor-body'); return { l: eb.scrollLeft, t: eb.scrollTop }; })()");
    ok('B6a 单指平移：scrollLeft ≥+60、scrollTop ≥+30 + stats.pan=1 + 惯性不回退（380ms 后 ≥ 松手值）',
      (panRel.l - pan0.l) >= 60 && (panRel.t - pan0.t) >= 30 && panRel.pan === 1 &&
      panMom.l >= panRel.l - 1 && panMom.t >= panRel.t - 1,
      JSON.stringify({ pan0: pan0, rel: panRel, mom: panMom }));
    await sleep(650); // 惯性完全衰减后再取空点（动量拖画布会打偏）
    // 重新选中卡（B5b 余量平移落在 gridCanvas → 桥按桌面同款语义取消选中——行为正确）
    const cp2 = await cardPoint();
    await tapAt(cp2.x, cp2.y);
    const selBefore = await cdp.evalJs("document.querySelectorAll('#gridCanvas .grid-card.selected').length");
    // strict 空点：必须命中 gridCanvas 本身——B4 挂过 groupId，组背景会接住 tap 变选组
    const strictEp = await cdp.evalJs("(function(){ var cv = document.getElementById('gridCanvas');" +
      " for (var y = 100; y < 1150; y += 28) for (var x = 80; x < 800; x += 28) {" +
      "  if (document.elementFromPoint(x, y) === cv) return { x: x, y: y }; } return null; })()");
    await tapAt(strictEp.x, strictEp.y);
    const selAfter = await cdp.evalJs("document.querySelectorAll('#gridCanvas .grid-card.selected').length");
    ok('B6b 空画布 tap：选中清除（selected ' + selBefore + ' → ' + selAfter + '）',
      strictEp !== null && selBefore >= 1 && selAfter === 0, JSON.stringify({ strictEp: strictEp, selAfter: selAfter }));

    // B7 tap 资产建卡：视口中心 + 400ms 冷却防重复
    const assetPt = await cdp.evalJs("(function(){ var a = document.querySelector('.asset-panel .card[draggable][data-asset=\"flag\"]');" +
      " if (!a) return null; var r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, inView: r.top >= 0 && r.bottom <= window.innerHeight }; })()");
    const countBefore = await cdp.evalJs("document.querySelectorAll('#gridCanvas .grid-card').length");
    await tapAt(assetPt.x, assetPt.y);
    await sleep(150);
    const b7a = await cdp.evalJs("(function(){ var cards = document.querySelectorAll('#gridCanvas .grid-card'); var c = cards[cards.length - 1];" +
      " var r = c.getBoundingClientRect(); var cx = window.innerWidth / 2, cy = window.innerHeight / 2;" +
      " return { count: cards.length, center: cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom," +
      " asset: window.__fcTouch.stats.asset }; })()");
    ok('B7a tap 资产建卡：卡数 +1 + 新卡覆盖视口中心 + stats.asset=1 + 资产卡在视口内',
      assetPt && assetPt.inView && b7a.count === countBefore + 1 && b7a.center === true && b7a.asset === 1,
      JSON.stringify({ assetPt: assetPt, b7a: b7a }));
    await tapAt(assetPt.x, assetPt.y); // 400ms 冷却内第二 tap → 不建卡
    await sleep(700);
    const countAfter = await cdp.evalJs("document.querySelectorAll('#gridCanvas .grid-card').length");
    ok('B7b 冷却防重复：冷却内二 tap 不建卡 + 700ms 后仍无重复', countAfter === countBefore + 1, 'count=' + countAfter);

    ok('E1 全程零 Runtime.exceptionThrown + 零 console.error',
      cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      JSON.stringify({ errs: cdp.errs.slice(0, 3), cons: cdp.consoleErrs.slice(0, 3) }));
    cdp.close();
  } catch (e) {
    console.error('💥 电池异常: ' + (e && e.stack || e));
    FAIL++;
  } finally {
    server.close();
    try { chrome.kill(); } catch (e) {}
  }
  console.log('');
  console.log('╭────────────────────────────────────╮');
  console.log('│  🎉 ' + PASS + ' ✅ / ' + FAIL + ' ❌  (fc-tablet)       │');
  console.log('╰────────────────────────────────────╯');
  if (FAIL > 0) process.exit(1);
  else process.exit(0);
})();
