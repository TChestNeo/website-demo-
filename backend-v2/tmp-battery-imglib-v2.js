// tmp-battery-imglib-v2.js — v0.2.45.2 / FC v10.28.34.2 图片库直开+搜索栏上传+持久库+info 二级弹窗电池
// （house CDP 模式；v0.2.42.x 直开+上传+持久库验证延续，本轮新增）：
//   ⑥tile 右上角 info 图标仅 public/team 显示（private 无）→ 点击开只读二级弹窗
//     imgInfoModal（上传者/简介/上传时间/可见性/尺寸）→ closeModalOnly 只关本窗图库
//     保持开、Escape 先关 info；点 info 不触发选中（stopPropagation）
//   ⑦slati_img_library 条目 uploader 字段：自己上传=displayName（种子 Battery Tester）、
//     Wikimedia 扫描派生图='Wikimedia Commons'（src 前缀判定）；无 ts 兜底「—」。
//   截图全黑纪律，无截图依赖）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-imglibv2-' + Date.now());
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
  // ═══ F 静态检查 ═══
  const fceSrc = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('F1 版本 v0.2.45.2 / v10.28.34.2 + 进位注释（42→43/32→33）',
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.45.2';") !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.34.2';") !== -1 &&
    sconfSrc.indexOf('42→43') !== -1 && sconfSrc.indexOf('32→33') !== -1 &&
    sconfSrc.indexOf('图片库直开') !== -1 && sconfSrc.indexOf('imgInfoModal') !== -1);
  ok('F2 持久库静态钉：IMG_LIB_KEY/2.5e6 上限/导出 imgLibPut+imgLibRemove/choke point imgMetaSave→imgLibPut',
    fceSrc.indexOf("IMG_LIB_KEY = 'slati_img_library'") !== -1 &&
    fceSrc.indexOf('IMG_LIB_MAX_BYTES = 2.5e6') !== -1 &&
    fceSrc.indexOf('window.imgLibPut = imgLibPut') !== -1 &&
    fceSrc.indexOf('window.imgLibRemove = imgLibRemove') !== -1 &&
    fceSrc.indexOf('imgLibPut(p.src, meta)') !== -1 &&
    fceSrc.indexOf('IMG_META_PENDING = { apply: applyFn, close: o.close || \'self\', src: previewDataURL }') !== -1);
  ok('F3 直开图库静态钉：点卡 handler 调 openFlagBrowser（国旗+国徽）+旧选择器全删+搜索栏上传按钮+开窗 focus',
    fceSrc.indexOf('openFlagSourceModal') === -1 && fceSrc.indexOf('id="flagSourceModal"') === -1 &&
    fceSrc.indexOf('id="flagBrowserFileInput" accept="image/*"') !== -1 &&
    fceSrc.indexOf('id="flagSearchUploadBtn" title="上传图片"') !== -1 &&
    fceSrc.indexOf("onclick=\"document.getElementById('flagBrowserFileInput').click()\"") !== -1 &&
    fceSrc.indexOf('si.offsetParent !== null) si.focus()') !== -1);
  {
    // 两张卡的 click handler 都调 openFlagBrowser（国旗 createFlagCard + 国徽 createAssetCard），
    // 唯一两个调用点（旧 flagBrowseBtn 已随选择器移除）
    const n = (fceSrc.match(/openFlagBrowser\(\);/g) || []).length;
    ok('F4 openFlagBrowser 调用点恰好 2 处（国旗卡+国徽卡 click）', n === 2, 'n=' + n);
  }
  ok('F5 store↔图库钩子：collectImgLibrary store 先入（带 uploader+ts）/syncLibMeta imgLibPut/removeLibUsages imgLibRemove',
    fceSrc.indexOf('imgLibLoad().forEach(function (it) { put(it.src, it.name, it.desc, it.visibility, it.uploader, it.ts); });') !== -1 &&
    fceSrc.indexOf('imgLibPut(src, meta); // v10.28.32: 铅笔编辑同步 store') !== -1 &&
    fceSrc.indexOf('imgLibRemove(src);') !== -1);
  ok('F6 info 图标+二级弹窗静态钉：imgInfoModal/导出 showLibImgInfo/lib-info 钮+CSS/uploader 字段+Wikimedia+仅公开显示',
    fceSrc.indexOf('id="imgInfoModal"') !== -1 &&
    fceSrc.indexOf('window.showLibImgInfo = showLibImgInfo') !== -1 &&
    fceSrc.indexOf('class="lib-icon lib-info"') !== -1 &&
    fceSrc.indexOf('.lib-info { right: 52px; }') !== -1 &&
    fceSrc.indexOf('uploader: (meta && meta.uploader) || libUploaderDefault(src)') !== -1 &&
    fceSrc.indexOf("'Wikimedia Commons'") !== -1 &&
    fceSrc.indexOf("f.visibility !== 'private'") !== -1 &&
    fceSrc.indexOf('put(it.src, it.name, it.desc, it.visibility, it.uploader, it.ts)') !== -1);

  // ═══ 浏览器场景 ═══
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
    // headless 页面未获焦 → focus() 静默失效——焦点模拟（搜索框 focus 断言依赖）
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_user", ' + JSON.stringify(JSON.stringify({ id: 'USR-batt', displayName: 'Battery Tester', citizenId: 'CIT-8842', tier: 'premium' })) + ');}catch(e){}'
    });
    // 周期制 shrink 包（≥60s→150ms 真跑）+toast 历史记录（心跳 toast 会顶掉动作 toast，断言查历史）
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: "(function(){ var r = window.setTimeout.bind(window); " +
        "window.setTimeout = function(fn, d){ var a = Array.prototype.slice.call(arguments, 2); " +
        "if (typeof d === 'number' && d >= 60000) { return r(function(){ fn.apply(null, a); }, 150); } " +
        "return r.apply(null, [fn, d].concat(a)); }; " +
        "window.__toastLog = []; var __tiv = setInterval(function(){ var t = document.getElementById('toast'); if (t) { " +
        "new MutationObserver(function(ms){ ms.forEach(function(x){ var v = x.target.textContent; " +
        "if (v && window.__toastLog[window.__toastLog.length - 1] !== v) window.__toastLog.push(v); }); })" +
        ".observe(t, { childList: true, characterData: true, subtree: true }); clearInterval(__tiv); } }, 10); })();"
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const install = () => cdp.evalJs("(function(){ if (window.__batt) return true; " +
      "window.__lib = function(){ var act = function(el){ return !!(el && el.querySelector('.modal-card') && el.querySelector('.modal-card').classList.contains('active')); }; " +
      "return { browser: act(document.getElementById('flagBrowserModal')), meta: act(document.getElementById('imgMetaModal')), " +
      "info: act(document.getElementById('imgInfoModal')), " +
      "chooserGone: document.getElementById('flagSourceModal') === null, " +
      "backdrop: document.getElementById('modalBackdrop').classList.contains('active'), " +
      "tab: (document.querySelector('.flag-browser-tab.active') || { dataset: {} }).dataset.tab || null, " +
      "focusId: document.activeElement ? document.activeElement.id : null, " +
      "tiles: Array.prototype.map.call(document.querySelectorAll('#flagGrid .flag-card-item'), function(t){ return { " +
      "name: (t.querySelector('.flag-name') || {}).textContent || '', sel: t.classList.contains('selected'), " +
      "edit: !!t.querySelector('.lib-edit'), del: !!t.querySelector('.lib-del'), info: !!t.querySelector('.lib-info') }; }), " +
      "empty: (document.querySelector('#flagGrid .flag-grid-empty') || {}).textContent || '', " +
      "selCount: (document.getElementById('flagSelectCount') || {}).textContent || '', " +
      "metaName: document.getElementById('immName') ? document.getElementById('immName').value : '', " +
      "infoName: document.getElementById('iimName') ? document.getElementById('iimName').textContent : '', " +
      "infoDesc: document.getElementById('iimDesc') ? document.getElementById('iimDesc').textContent : '', " +
      "infoUploader: document.getElementById('iimUploader') ? document.getElementById('iimUploader').textContent : '', " +
      "infoTs: document.getElementById('iimTs') ? document.getElementById('iimTs').textContent : '', " +
      "infoVis: document.getElementById('iimVis') ? document.getElementById('iimVis').textContent : '', " +
      "cards: document.querySelectorAll('.grid-card').length, " +
      "store: (function(){ try { return JSON.parse(localStorage.getItem('slati_img_library') || '[]'); } catch(e){ return []; } })() }; };" +
      "window.__upFile = function(inputExpr, color, w, h, name){ return new Promise(function(res){ " +
      "var el = typeof inputExpr === 'string' ? document.querySelector(inputExpr) : inputExpr; if (!el) { res(false); return; } " +
      "var cv = document.createElement('canvas'); cv.width = w; cv.height = h; " +
      "var cx = cv.getContext('2d'); cx.fillStyle = color; cx.fillRect(0, 0, w, h); " +
      "cv.toBlob(function(blob){ var file = new File([blob], name, { type: 'image/png' }); " +
      "var dt = new DataTransfer(); dt.items.add(file); " +
      "el.files = dt.files; el.dispatchEvent(new Event('change', { bubbles: true })); res(true); }, 'image/png'); }); };" +
      "window.__fillMeta = function(name, desc, vis){ document.getElementById('immName').value = name; " +
      "document.getElementById('immDesc').value = desc; window.imgMetaRefreshCount(); " +
      "if (vis) window.imgMetaSetVisibility(vis); return true; };" +
      "window.__clickCard = function(sel){ var c = document.querySelector(sel); if (!c) return false; c.click(); return true; };" +
      "window.__tileClick = function(name, btnSel){ var t = null; document.querySelectorAll('#flagGrid .flag-card-item').forEach(function(x){ " +
      "if (!t && x.querySelector('.flag-name') && x.querySelector('.flag-name').textContent === name) t = x; }); " +
      "if (!t) return false; var b = btnSel ? t.querySelector(btnSel) : t; if (!b) return false; " +
      "b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; };" +
      "window.__confirmCapture = function(){ window.__confirms = []; window.confirm = function(m){ window.__confirms.push(m); return true; }; return true; };" +
      "window.__batt = true; return true; })()");
    const st = () => cdp.evalJs('JSON.stringify(window.__lib())');
    const META_OPEN = "document.getElementById('imgMetaModal').querySelector('.modal-card').classList.contains('active')";
    const INFO_OPEN = "document.getElementById('imgInfoModal').querySelector('.modal-card').classList.contains('active')";

    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'load');
    await install();

    // ── S1: 真实点击无图国旗卡→直开图片库（无选择器）+焦点落搜索框 ──
    await cdp.evalJs("window.createFlagCard('国旗A', 0, 12, 8, 5); true");
    await sleep(200);
    await cdp.evalJs("window.__clickCard('.grid-card[data-card-type=\"flag\"]'); true");
    await sleep(300);
    let s = JSON.parse(await st());
    ok('S1a 点国旗卡=直开图片库（旧选择器已删）+全部页签+空态',
      s.browser && s.chooserGone && s.tab === 'all' && s.tiles.length === 0 && s.selCount === '未选择',
      JSON.stringify(s).slice(0, 200));
    ok('S1b 弹窗出现=焦点落搜索框（用户「直接打开搜索」）', s.focusId === 'flagSearchInput',
      'focus=' + s.focusId);
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S2: 点无图国徽卡→同样直开（旧版国徽无浏览入口，本轮修复） ──
    await cdp.evalJs("window.createAssetCard('shield', '盾徽A', 10, 12, 5, 5); true");
    await sleep(200);
    await cdp.evalJs("window.__clickCard('.grid-card[data-card-type=\"shield\"]'); true");
    await sleep(300);
    s = JSON.parse(await st());
    ok('S2 点国徽卡=直开图片库', s.browser && s.chooserGone && s.tab === 'all', JSON.stringify(s).slice(0, 160));
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S3: 搜索栏上传→meta 保存→图落到卡+图库保持开+新格出现并选中+两页签都见 ──
    await cdp.evalJs("window.setCurrentFlagCard(document.querySelector('.grid-card[data-card-type=\"flag\"]')); window.openFlagBrowser(); true");
    await sleep(250);
    await cdp.evalJs("window.__upFile('#flagBrowserFileInput', 'rgb(0,128,0)', 800, 500, 'my-flag.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S3 meta open');
    await cdp.evalJs("window.__fillMeta('我的国旗', '描述 词', 'public'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(300);
    s = JSON.parse(await st());
    const f3 = JSON.parse(await cdp.evalJs("JSON.stringify((function(){ var c = document.querySelector('.grid-card[data-card-type=\"flag\"]'); return { imgName: c.dataset.imgName || '', hasImg: !!c.querySelector('.card-img-bg') }; })())"));
    ok('S3a 保存=图落到卡+图库保持打开（close:self）', f3.hasImg && f3.imgName === '我的国旗' && s.browser && s.backdrop,
      JSON.stringify(f3) + ' ' + JSON.stringify(s).slice(0, 140));
    ok('S3b 全部页签=新格立刻出现并选中+计数文案', s.tab === 'all' && s.tiles.length === 1 &&
      s.tiles[0].name === '我的国旗' && s.tiles[0].sel && s.selCount === '已选：我的国旗',
      JSON.stringify(s.tiles) + ' ' + s.selCount);
    await cdp.evalJs("window.switchFlagTab('mylib'); true");
    await sleep(250);
    s = JSON.parse(await st());
    ok('S3c 我的图库=同样 1 格（用户「全部/我的图库都看见」）',
      s.tiles.length === 1 && s.tiles[0].name === '我的国旗' && s.tiles[0].edit && s.tiles[0].del,
      JSON.stringify(s.tiles));
    ok('S3d 持久库已写入（store 1 条）', s.store.length === 1 && s.store[0].name === '我的国旗' &&
      s.store[0].visibility === 'public' && s.store[0].src.indexOf('data:image/png') === 0,
      JSON.stringify(s.store.map(function (x) { return { name: x.name, vis: x.visibility }; })));
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S4: 铅笔编辑→store 同步（名称/描述/可见性 upsert） ──
    await cdp.evalJs("window.openFlagBrowser(); window.switchFlagTab('mylib'); true");
    await sleep(250);
    await cdp.evalJs("window.__tileClick('我的国旗', '.lib-edit'); true");
    await waitFor(cdp, META_OPEN, 10000, 'S4 meta open');
    await cdp.evalJs("window.__fillMeta('改名了', '新描述', 'team'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(300);
    s = JSON.parse(await st());
    ok('S4 铅笔编辑=store upsert（名称/描述/可见性）+图库保持开+格名刷新',
      s.store.length === 1 && s.store[0].name === '改名了' && s.store[0].desc === '新描述' &&
      s.store[0].visibility === 'team' && s.browser && s.tiles.some(function (t) { return t.name === '改名了'; }),
      JSON.stringify(s.store.map(function (x) { return { name: x.name, desc: x.desc, vis: x.visibility }; })));
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S5: 持久化实证——删卡清画布→等 autosave→删草稿键→reload→画布空但图库图仍在 ──
    await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-type=\"flag\"]'); window.selectCard(c, true); window.deleteSelectedCard(); " +
      "var s2 = document.querySelector('.grid-card[data-card-type=\"shield\"]'); window.selectCard(s2, true); window.deleteSelectedCard(); return true; })()");
    await sleep(3600); // shrink 包 ~24 拍：autosave 把空画布落草稿（dirty 清）
    const draft5 = await cdp.evalJs("(function(){ var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}'); return JSON.stringify({ v: d.v, n: (d.cards || []).length }); })()");
    ok('S5a 删卡后 autosave=草稿已空（n=0）', draft5 === '{"v":9,"n":0}', draft5);
    await cdp.evalJs("try { localStorage.removeItem('slati_fluidcanvas_draft'); } catch(e){} true");
    await cdp.send('Page.reload', {});
    await waitFor(cdp, "typeof window.createFlagCard === 'function'", 20000, 'S5 reload');
    await sleep(500);
    await install();
    s = JSON.parse(await st());
    ok('S5b reload=画布空（无卡）', s.cards === 0, 'cards=' + s.cards);
    await cdp.evalJs('window.openFlagBrowser(); true');
    await sleep(300);
    s = JSON.parse(await st());
    ok('S5c 新画布打开图片库=上传的图仍在（跨文章可见——用户 bug 的真身修复）',
      s.browser && s.tiles.length === 1 && s.tiles[0].name === '改名了', JSON.stringify(s.tiles));
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S6: 图库删除=store 同步删（彻底删）+空态回归 ──
    await cdp.evalJs('window.__confirmCapture(); true');
    await cdp.evalJs("window.openFlagBrowser(); window.switchFlagTab('mylib'); true");
    await sleep(250);
    await cdp.evalJs("window.__tileClick('改名了', '.lib-del'); true");
    await sleep(300);
    s = JSON.parse(await st());
    ok('S6 删除=store 0 条+图库空态文案', s.store.length === 0 && s.tiles.length === 0 &&
      s.empty === '还没有上传过图片——你上传的国旗、背景、头像、地图都会出现在这里',
      JSON.stringify(s).slice(0, 200));
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S7: 上限淘汰（FIFO ts 最旧先删）+单图超限不入库 toast ──
    await cdp.evalJs("window.__toastLog.length = 0; true");
    await cdp.evalJs("(function(){ var mk = function(tag){ return 'data:image/png;base64,' + new Array(1200001).join('A') + tag; }; " +
      "window.imgLibPut(mk('x1'), { name: '巨图A' }); window.imgLibPut(mk('x2'), { name: '巨图B' }); " +
      "window.imgLibPut(mk('x3'), { name: '巨图C' }); return true; })()");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S7a 3 张 1.2MB 图=超 2.5MB 上限→FIFO 淘汰最旧 A→剩 B/C',
      s.store.length === 2 && s.store[0].name === '巨图B' && s.store[1].name === '巨图C',
      JSON.stringify(s.store.map(function (x) { return x.name; })));
    await cdp.evalJs("(function(){ var mk = 'data:image/png;base64,' + new Array(3000001).join('B'); " +
      "window.imgLibPut(mk, { name: '超大图' }); return true; })()");
    await sleep(300);
    s = JSON.parse(await st());
    ok('S7b 单图 3MB 仍超限=不入库（store 保持 B/C）+toast「图片过大…未存入我的图库」',
      s.store.length === 2 && s.store[0].name === '巨图B' && s.store[1].name === '巨图C' &&
      await cdp.evalJs("window.__toastLog.indexOf('图片过大…未存入我的图库') !== -1"),
      JSON.stringify(s.store.map(function (x) { return x.name; })));
    // 清场：合成巨图不留在 store 里（页面内直接清）
    await cdp.evalJs("(function(){ var st = JSON.parse(localStorage.getItem('slati_img_library') || '[]'); st.forEach(function(x){ window.imgLibRemove(x.src); }); return true; })()");

    // ── S8: info 图标+图片信息二级弹窗（仅 public/team 显示；uploader 落库） ──
    await cdp.evalJs("window.imgLibPut('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', { name: '公开图', desc: '公开描述', visibility: 'public' }); true");
    await cdp.evalJs("window.imgLibPut('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', { name: '私密图', visibility: 'private' }); true");
    await cdp.evalJs('window.openFlagBrowser(); true');
    await sleep(300);
    s = JSON.parse(await st());
    ok('S8a uploader 落库（=Battery Tester）+公开图有 info 图标、私密图无',
      s.store.length === 2 && s.store[0].uploader === 'Battery Tester' && s.store[1].uploader === 'Battery Tester' &&
      s.tiles.some(function (t) { return t.name === '公开图' && t.info === true; }) &&
      s.tiles.some(function (t) { return t.name === '私密图' && t.info === false; }),
      JSON.stringify({ store: s.store.map(function (x) { return { n: x.name, up: x.uploader }; }),
        tiles: s.tiles.map(function (t) { return { n: t.name, i: t.info }; }) }));
    await cdp.evalJs("window.__tileClick('公开图', '.lib-info'); true");
    await waitFor(cdp, INFO_OPEN, 5000, 'S8b info open');
    await sleep(200);
    s = JSON.parse(await st());
    ok('S8b 点 info=开二级弹窗（三层栈）+不触发选中（stopPropagation 护栏）',
      s.info && s.browser && s.backdrop && !s.tiles.some(function (t) { return t.name === '公开图' && t.sel; }),
      JSON.stringify({ info: s.info, browser: s.browser, tiles: s.tiles.map(function (t) { return { n: t.name, sel: t.sel }; }) }));
    ok('S8c 弹窗内容：名称/简介/上传者/时间格式/可见性',
      s.infoName === '公开图' && s.infoDesc === '公开描述' && s.infoUploader === 'Battery Tester' &&
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s.infoTs) && s.infoVis === 'Public',
      JSON.stringify({ n: s.infoName, d: s.infoDesc, u: s.infoUploader, ts: s.infoTs, v: s.infoVis }));
    await cdp.evalJs("closeModalOnly('imgInfoModal'); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S8d closeModalOnly=只关 info、图库+遮罩保持开', !s.info && s.browser && s.backdrop,
      JSON.stringify({ info: s.info, browser: s.browser, backdrop: s.backdrop }));
    await cdp.evalJs("window.__tileClick('公开图', '.lib-info'); true");
    await waitFor(cdp, INFO_OPEN, 5000, 'S8e info reopen');
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
    await sleep(250);
    s = JSON.parse(await st());
    ok('S8e Escape=先关 info、图库保持开', !s.info && s.browser && s.backdrop,
      JSON.stringify({ info: s.info, browser: s.browser }));
    // S8f: Wikimedia 上传者（canvas 扫描内联图路径——搜索插入的真实形态；src 前缀判定，无需网络加载）
    await cdp.evalJs("(function(){ var im = document.createElement('img'); im.className = 'tt-inline-img'; " +
      "im.src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Flag_of_Malaysia.svg/640px-Flag_of_Malaysia.svg.png'; " +
      "im.dataset.imgName = 'wm'; im.dataset.imgDesc = ''; im.dataset.imgVisibility = 'public'; " +
      "document.getElementById('gridCanvas').appendChild(im); return true; })()");
    await cdp.evalJs('window.openFlagBrowser(); true');
    await sleep(300);
    s = JSON.parse(await st());
    ok('S8f Wikimedia 扫描派生=有 info 图标（uploader 前缀判定）',
      s.tiles.some(function (t) { return t.name === 'wm' && t.info === true; }),
      JSON.stringify(s.tiles.map(function (t) { return { n: t.name, i: t.info }; })));
    await cdp.evalJs("window.__tileClick('wm', '.lib-info'); true");
    await waitFor(cdp, INFO_OPEN, 5000, 'S8g wm info open');
    await sleep(200);
    s = JSON.parse(await st());
    ok('S8g Wikimedia 弹窗=uploader Wikimedia Commons+无 ts 兜底「—」',
      s.infoUploader === 'Wikimedia Commons' && s.infoTs === '—' && s.infoVis === 'Public',
      JSON.stringify({ u: s.infoUploader, ts: s.infoTs, v: s.infoVis }));
    await cdp.evalJs("closeModalOnly('imgInfoModal'); true");
    // S8h: 重渲染路径图标保持（filterFlags/switchFlagTab 均走 renderFlagGrid）
    await cdp.evalJs("(function(){ document.getElementById('flagSearchInput').value = '公开'; window.filterFlags(); return true; })()");
    await sleep(250);
    s = JSON.parse(await st());
    ok('S8h 搜索过滤后=公开图保留 info 图标', s.tiles.length === 1 && s.tiles[0].name === '公开图' && s.tiles[0].info,
      JSON.stringify(s.tiles));
    await cdp.evalJs("window.switchFlagTab('mylib'); true");
    await sleep(250);
    s = JSON.parse(await st());
    ok('S8i 切换我的图库页签=图标保持（公开有/私密无）',
      s.tiles.some(function (t) { return t.name === '公开图' && t.info === true; }) &&
      s.tiles.some(function (t) { return t.name === '私密图' && t.info === false; }),
      JSON.stringify(s.tiles.map(function (t) { return { n: t.name, i: t.info }; })));
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S9: 版本（site v0.2.45.2 + FC v10.28.34.2 + 页面徽章） ──
    const ver9 = await cdp.evalJs("JSON.stringify({ mn: window.MN_SITE_VERSION, fc: window.FLUIDCANVAS_VERSION, badge: document.body.innerText.indexOf('v10.28.34.2') !== -1 })");
    const v9 = JSON.parse(ver9);
    ok('S9 版本 v0.2.45.2 + FC v10.28.34.2 + 徽章', v9.mn === 'v0.2.45.2' && v9.fc === 'v10.28.34.2' && v9.badge, ver9);

    // ── Z: 零 console error ──
    await sleep(400);
    ok('Z 零 console error', cdp.errs.length === 0, JSON.stringify(cdp.errs.slice(0, 3)));

    console.log('\n  ── 结果: ' + PASS + '/' + (PASS + FAIL) + (FAIL ? ' ❌' : ' 全绿 ✅'));
    await cdp.close();
    process.exitCode = FAIL ? 1 : 0;
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
