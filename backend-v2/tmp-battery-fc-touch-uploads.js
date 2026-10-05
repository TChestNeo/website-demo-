// tmp-battery-fc-touch-uploads.js — FC v10.28.48.0 触控上传修复电池
// 用户「还有平板移动端在合拼卡片之后边缘会不齐，和无法点击上传图片」——真身：
//   char-avatar（click→fi.click）/map-canvas（dblclick→fi.click）是 .grid-card 内
//   普通 div → 触控桥 classify 归 CARD 手势 → preventDefault 杀掉原生 click →
//   桥合成 click（isTrusted=false）无用户激活 → 浏览器静默拒绝 fi.click()。
// 修法：fi 透明覆盖层（.card-upload-input）直接盖住头像/空图态画布——tap 直击
//   input 本体（原生手势自带用户激活 → 选择器可开）；input 命中桥 inEditableZone
//   豁免 → fc-touch.js 零改动；地图有图态 .map-canvas:not(.map-empty) 收层，
//   画布让位拖动/双击开区域编辑器。
// 验证：S1 静态锚（site-config 44.3 + rev 00293- 占位 / 编辑器覆盖层 CSS+挂载锚
//   / fc-touch.js 零改动复用 inEditableZone input 豁免锚）/ B 触控实测（CDP iPad
//   仿真 834×1194 dsf2 + 5 触点 + 文件选择器拦截实证）：B0 门控自证；B1 头像 tap
//   → 选择器第 1 次拦截 + 桥全豁免 stats.tap=0；B2 空图态地图 tap → 第 2 次拦截；
//   B3 有图态覆盖层 display:none + tap 不再弹选择器 + 地图卡拖拽保全；B4 头像
//   覆盖层只罩头像——char 卡身拖拽保全 / E1 零异常。
// （house CDP 模式；判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4980 + Math.floor(Math.random() * 40);
const CDP_PORT = 5980 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fcuploads-' + Date.now());
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
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber, raw: JSON.stringify(d).slice(0, 600) }).slice(0, 1000));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
      } else if (m.method === 'Page.fileChooserOpened') {
        // 选择器拦截实证：页面请求打开文件选择器（fi.click 用户激活成功）→ 事件即证据。
        // 旧 div.click→fi.click 链无激活会被浏览器静默拒绝——事件恒 0 条。
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
    // 文件选择器拦截——页面请求弹选择器时收 Page.fileChooserOpened（fi.click 用户激活成功证据）
    await cdp.send('Page.setInterceptFileChooserDialog', { enabled: true });
    return cdp;
  };

  try {
    // ── S1 静态锚 ──
    const siteCfg = await (await fetch(BASE + '/assets/js/site-config.js')).text();
    const editorHtml = (await (await fetch(BASE + '/pages/fluidcanvas-editor.html')).text()).replace(/\r\n/g, '\n');
    const touchJs = await (await fetch(BASE + '/assets/js/fc-touch.js')).text();
    ok('S1 site-config 44.3 + rev 00293- 占位 + 站点恒 v0.2.58.28 + 编辑器覆盖层挂载/CSS 锚在位 + fc-touch.js 零改动（inEditableZone input 豁免复用）',
      siteCfg.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.52.0';") !== -1 &&
      siteCfg.indexOf('00293-') !== -1 && siteCfg.indexOf('v0.2.58.28') !== -1 &&
      editorHtml.split("fi.className = 'card-upload-input'").length - 1 === 2 &&
      editorHtml.indexOf('avatar.replaceChildren(fi)') !== -1 &&
      editorHtml.indexOf('avatar.appendChild(fi)') !== -1 &&
      editorHtml.indexOf('canvas.appendChild(fi)') !== -1 &&
      editorHtml.indexOf('.card-upload-input') !== -1 &&
      editorHtml.indexOf('opacity: 0') !== -1 &&
      editorHtml.indexOf('inset: 0') !== -1 &&
      editorHtml.indexOf('.map-canvas:not(.map-empty) .card-upload-input') !== -1 &&
      touchJs.indexOf("el.closest('input, textarea, select, button, a") !== -1);

    const cdp = await connectCdp(CDP_PORT);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };

    // ── 触控手势 helper（同 fc-tablet：touchStart 带全部触点/touchMove 只发移动点/touchEnd 空数组）──
    const tch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type: type, touchPoints: pts });
    const tpoint = (id, x, y) => ({ x: Math.round(x), y: Math.round(y), radiusX: 2, radiusY: 2, force: 1, id: id });
    const tapAt = async (x, y) => { await tch('touchStart', [tpoint(0, x, y)]); await sleep(50); await tch('touchEnd', []); await sleep(120); };
    const dragTouch = async (x1, y1, x2, y2, steps) => {
      await tch('touchStart', [tpoint(0, x1, y1)]);
      await sleep(30);
      for (let i = 1; i <= steps; i++) {
        await sleep(16);
        await tch('touchMove', [tpoint(0, x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps)]);
      }
      await sleep(25);
      await tch('touchEnd', []);
      await sleep(120);
    };
    // 指定卡卡面取点：扫避开输入/标签/手柄（char 卡头像内是 fi 覆盖层 input、
    // 名/衔/简介是 .card-edit-field——拖拽只走卡身 padding 区，与编辑器
    // mousedown inText 排除同口径）
    const cardBodyPt = (sel) => cdp.evalJs("(function(){ var c = document.querySelector('" + sel + "');" +
      " if (!c) return null; var r = c.getBoundingClientRect();" +
      " var bad = 'input, textarea, select, button, a, [contenteditable=\"true\"], .card-text-content, .card-edit-field, .card-label, .resize-handle, .rotate-grip';" +
      " for (var fy = 0.06; fy <= 0.94; fy += 0.04) for (var fx = 0.06; fx <= 0.94; fx += 0.04) {" +
      "  var el = document.elementFromPoint(r.left + r.width*fx, r.top + r.height*fy);" +
      "  if (el && el.closest('.grid-card') === c && !el.closest(bad)) return { x: Math.round(r.left + r.width*fx), y: Math.round(r.top + r.height*fy) };" +
      " } return null; })()");

    // ── B 触控实测 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "!!document.getElementById('gridCanvas') && !!window.createCharacterCard && !!window.createMapCard && !!window.__fcTouch", 'B 编辑器加载');

    const gate = await cdp.evalJs("(function(){ return { coarse: matchMedia('(pointer: coarse)').matches, mtp: navigator.maxTouchPoints, bridge: !!window.__fcTouch }; })()");
    ok('B0 门控自证：coarse 媒体查询翻转 + maxTouchPoints=5 + 触控桥在场',
      gate && gate.coarse === true && gate.mtp === 5 && gate.bridge, JSON.stringify(gate));

    // B1 头像 tap → 选择器第 1 次拦截 + 桥全豁免（stats.tap 不增——tap 直击 input 本体走原生）
    await cdp.evalJs('window.createCharacterCard(2, 2, 4, 5)'); await sleep(250);
    const avPt = await cdp.evalJs("(function(){ var av = document.querySelector('#gridCanvas .char-avatar');" +
      " if (!av) return null; var r = av.getBoundingClientRect(); return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()");
    await tapAt(avPt.x, avPt.y);
    await sleep(400); // 选择器拦截事件异步收
    ok('B1 头像 tap → 文件选择器弹出（第 1 次拦截）+ 桥全豁免 stats.tap=0',
      cdp.fileChoosers.length === 1 && await cdp.evalJs('window.__fcTouch.stats.tap') === 0,
      'choosers=' + cdp.fileChoosers.length);

    // B2 空图态地图画布 tap → 选择器第 2 次拦截
    await cdp.evalJs('window.createMapCard(8, 2, 8, 6)'); await sleep(250);
    const mcPt = await cdp.evalJs("(function(){ var mc = document.querySelector('#gridCanvas .map-canvas');" +
      " if (!mc) return null; var r = mc.getBoundingClientRect(); return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()");
    await tapAt(mcPt.x, mcPt.y);
    await sleep(400);
    ok('B2 空图态地图画布 tap → 文件选择器弹出（第 2 次拦截）',
      cdp.fileChoosers.length === 2, 'choosers=' + cdp.fileChoosers.length);

    // B3 有图态收层：覆盖层 display:none + tap 不再弹选择器 + 地图卡拖拽保全
    const b3disp = await cdp.evalJs("(function(){ var card = document.querySelector('#gridCanvas .map-card');" +
      " var mc = card.querySelector('.map-canvas'); card.dataset.mapImg = 'batt-fake';" +
      " mc.classList.remove('map-empty');" +
      " return getComputedStyle(mc.querySelector('.card-upload-input')).display; })()");
    await tapAt(mcPt.x, mcPt.y);
    await sleep(400);
    const b3choosers = cdp.fileChoosers.length;
    // 关吸附对齐（同 fc-tablet B2 口径）——拖拽精确位移断言
    await cdp.evalJs("(function(){ if (document.getElementById('snapToggle').classList.contains('active')) window.toggleSnap();" +
      " if (document.getElementById('alignToggle').classList.contains('active')) window.toggleAlign(); return true; })()");
    const b3before = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .map-card'); return { l: parseFloat(c.style.left) || 0, t: parseFloat(c.style.top) || 0 }; })()");
    const mcBodyPt = await cardBodyPt('#gridCanvas .map-card');
    await dragTouch(mcBodyPt.x, mcBodyPt.y, mcBodyPt.x + 40, mcBodyPt.y + 25, 10);
    const b3after = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .map-card');" +
      " return { l: parseFloat(c.style.left) || 0, t: parseFloat(c.style.top) || 0, drag: window.__fcTouch.stats.drag }; })()");
    ok('B3 有图态收层：覆盖层 display:none + tap 不再弹选择器 + 地图卡拖拽 +40/+25 ±2（stats.drag+1）',
      b3disp === 'none' && b3choosers === 2 &&
      Math.abs((b3after.l - b3before.l) - 40) <= 2 && Math.abs((b3after.t - b3before.t) - 25) <= 2 && b3after.drag === 1,
      'disp=' + b3disp + ' choosers=' + b3choosers + ' before=' + JSON.stringify(b3before) + ' after=' + JSON.stringify(b3after));

    // B4 头像覆盖层只罩头像：char 卡身拖拽保全（fi inset:0 只在 avatar 内）
    const chBefore = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .character-card'); return { l: parseFloat(c.style.left) || 0, t: parseFloat(c.style.top) || 0 }; })()");
    const chBodyPt = await cardBodyPt('#gridCanvas .character-card');
    await dragTouch(chBodyPt.x, chBodyPt.y, chBodyPt.x + 30, chBodyPt.y + 20, 10);
    const chAfter = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .character-card');" +
      " return { l: parseFloat(c.style.left) || 0, t: parseFloat(c.style.top) || 0, drag: window.__fcTouch.stats.drag }; })()");
    ok('B4 头像覆盖层只罩头像：char 卡身拖拽 +30/+20 ±2（覆盖层不挡整卡）',
      Math.abs((chAfter.l - chBefore.l) - 30) <= 2 && Math.abs((chAfter.t - chBefore.t) - 20) <= 2 && chAfter.drag === 2,
      'before=' + JSON.stringify(chBefore) + ' after=' + JSON.stringify(chAfter));

    // ── E 全程零 Runtime exception + 零 console error ──
    ok('E1 全程零 Runtime exception + 零 console error', cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      (cdp.errs.slice(0, 3).join(' | ') || '') + (cdp.consoleErrs.slice(0, 3).join(' | ') || '干净'));
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
