// tmp-battery-img-library.js — 我的图库电池（含样本旗撤除回归）；v0.2.45.2/v10.28.34.2 口径复跑：
// 注入无记录 shrink 包（setTimeout ≥60s→150ms 真跑，不记录）让周期心跳在 sleep 窗口内滴答；版本断言随版本更新
// （house CDP 模式；v10.28.32 图库=持久库 slati_img_library ∪ 画布扫描（store 权威）——上传走真实
//  File→input.change 路径（搜索栏 #flagBrowserFileInput，图源选择器已整体移除=点卡直开图片库），
//  浏览器页签全部/我的图库断言 DOM 格；编辑按 dataURL 同步 store+使用处、删除从所有
//  使用处移除（confirm 覆盖捕获消息）；截图全黑纪律，无截图依赖）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-imglib-' + Date.now());
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
  ok('F1 页签左「全部」右「我的图库」+data-tab+标题图片库+搜索 placeholder+确认添加+搜索栏上传按钮（v10.28.32 直开图库，旧副标题已随图源选择器移除）',
    fceSrc.indexOf('<h3 class="headline-md" data-i18n="fc.lib.title">图片库</h3>') !== -1 &&
    fceSrc.indexOf('<button class="flag-browser-tab active" data-tab="all" onclick="switchFlagTab(\'all\')" data-i18n="fc.lib.tabAll">全部</button>') !== -1 &&
    fceSrc.indexOf('<button class="flag-browser-tab" data-tab="mylib" onclick="switchFlagTab(\'mylib\')" data-i18n="fc.lib.tabMine">我的图库</button>') !== -1 &&
    fceSrc.indexOf('placeholder="搜索图片（名称/描述）…"') !== -1 &&
    fceSrc.indexOf('确认添加') !== -1 &&
    fceSrc.indexOf('id="flagBrowserFileInput"') !== -1 &&
    fceSrc.indexOf('id="flagSearchUploadBtn" title="上传图片"') !== -1);
  ok('F2 导出（editLibImg/delLibImg/collectImgLibrary/countLibUsages/syncLibMeta）+CSS（lib-vis/lib-icon/flag-grid-empty）+铅笔/垃圾桶 title',
    fceSrc.indexOf('window.editLibImg = editLibImg') !== -1 &&
    fceSrc.indexOf('window.delLibImg = delLibImg') !== -1 &&
    fceSrc.indexOf('window.collectImgLibrary = collectImgLibrary') !== -1 &&
    fceSrc.indexOf('window.countLibUsages = countLibUsages') !== -1 &&
    fceSrc.indexOf('window.syncLibMeta = syncLibMeta') !== -1 &&
    fceSrc.indexOf('.flag-card-item .lib-vis {') !== -1 &&
    fceSrc.indexOf('.flag-card-item .lib-icon {') !== -1 &&
    fceSrc.indexOf('.flag-grid-empty') !== -1 &&
    fceSrc.indexOf("T('fc.pbg.editMeta') || '编辑图片信息'") !== -1 &&
    fceSrc.indexOf("T('fc.lib.delTitle') || '删除（从所有使用处移除）'") !== -1);
  ok('F3 版本 v0.2.58.0 / v10.28.47.3 + 进位注释（新轮 42→43/32→33 + 旧轮 41→42/31→32 仍在）',
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.58.0';") !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.3';") !== -1 &&
    sconfSrc.indexOf('42→43') !== -1 && sconfSrc.indexOf('32→33') !== -1 &&
    sconfSrc.indexOf('41→42') !== -1 && sconfSrc.indexOf('31→32') !== -1);
  ok('F3b 持久库静态钉：IMG_LIB_KEY=slati_img_library+2.5e6 上限+imgLibPut/imgLibRemove 导出+imgMetaSave choke point+store 先入合并',
    fceSrc.indexOf("IMG_LIB_KEY = 'slati_img_library'") !== -1 &&
    fceSrc.indexOf('IMG_LIB_MAX_BYTES = 2.5e6') !== -1 &&
    fceSrc.indexOf('window.imgLibPut = imgLibPut') !== -1 &&
    fceSrc.indexOf('window.imgLibRemove = imgLibRemove') !== -1 &&
    fceSrc.indexOf('imgLibPut(p.src, meta)') !== -1 &&
    fceSrc.indexOf('imgLibLoad().forEach(function (it) { put(it.src, it.name, it.desc, it.visibility, it.uploader, it.ts); });') !== -1 &&
    fceSrc.indexOf('openFlagSourceModal') === -1 && fceSrc.indexOf('id="flagSourceModal"') === -1);
  {
    const i0 = fceSrc.indexOf('function renderFlagGrid(');
    const fnText = fceSrc.slice(i0, i0 + 2000);
    ok('F4 renderFlagGrid onclick 不含 dataURL（f.src 只进 src 属性 esc）',
      fnText.indexOf("onclick=\"selectFlag(\\'' + f.id + '\\')\"") !== -1 &&
      fnText.indexOf('src="' + "' + esc(f.src) + '") !== -1 &&
      !/onclick="[^"]*f\.src/.test(fnText), '');
  }
  ok('F5 FC_FLAG_LIBRARY=[]（样本旗全撤：SEED/MY 数组不在+空接口保留）+草稿 v 保持 9',
    fceSrc.indexOf('window.FC_FLAG_LIBRARY = [];') !== -1 &&
    fceSrc.indexOf('SEED_FLAGS = [') === -1 && fceSrc.indexOf('MY_FLAGS = [') === -1 &&
    fceSrc.indexOf('v: 9,') !== -1);

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
    // headless 页面未获焦 → contenteditable focus() 静默失效（tt-img 电池首跑真凶）——焦点模拟
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    // v10.28.31 订阅门禁激活（TEST_MODE=false）——本电池测图库（含卡图/卡背景类），按订阅用户跑
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_user", ' + JSON.stringify(JSON.stringify({ id: 'USR-batt', displayName: 'Battery Tester', citizenId: 'CIT-8842', tier: 'premium' })) + ');}catch(e){}'
    });
    // v0.2.40.0 周期制适配：shrink 包（≥60s→150ms 真跑，不记录）——心跳在 sleep(3600) 窗口内滴答；
    // 附 toast 历史记录（MutationObserver 记 #toast 每次文本→__toastLog）：加速心跳的
    // 「已保存」toast 会 150ms 内顶掉动作 toast，动作断言改查历史不查当前
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
      "backdrop: document.getElementById('modalBackdrop').classList.contains('active'), " +
      "tab: (document.querySelector('.flag-browser-tab.active') || { dataset: {} }).dataset.tab || null, " +
      "tiles: Array.prototype.map.call(document.querySelectorAll('#flagGrid .flag-card-item'), function(t){ return { " +
      "name: (t.querySelector('.flag-name') || {}).textContent || '', lib: !!t.querySelector('.lib-thumb-wrap'), " +
      "vis: (t.querySelector('.lib-vis') || {}).textContent || '', edit: !!t.querySelector('.lib-edit'), del: !!t.querySelector('.lib-del'), " +
      "sel: t.classList.contains('selected'), id: t.dataset.flagId }; }), " +
      "empty: (document.querySelector('#flagGrid .flag-grid-empty') || {}).textContent || '', " +
      "selCount: (document.getElementById('flagSelectCount') || {}).textContent || '', " +
      "metaName: document.getElementById('immName') ? document.getElementById('immName').value : '', " +
      "metaDesc: document.getElementById('immDesc') ? document.getElementById('immDesc').value : '', " +
      "metaVis: (document.querySelector('#immSeg .segmented-option.active') || { dataset: {} }).dataset.vis || null, " +
      "libLen: window.collectImgLibrary().length, " +
      "canvasBg: gridCanvas.classList.contains('has-page-bg'), " +
      "entryText: (document.getElementById('pageBgEntryState') || {}).textContent || '' }; };" +
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
      "window.__caretInContent = function(cc){ var txc = cc.querySelector('.card-text-content'); if (!txc) return false; " +
      "if (!txc.firstChild) txc.textContent = 'Hello world'; var r = document.createRange(); " +
      "if (txc.firstChild && txc.firstChild.nodeType === 3) { r.setStart(txc.firstChild, Math.min(1, txc.firstChild.length)); } else { r.selectNodeContents(txc); } " +
      "r.collapse(true); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); txc.focus(); " +
      "document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return true; };" +
      "window.__clickBtn = function(sel){ var b = document.querySelector(sel); if (!b) return false; " +
      "b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; };" +
      "window.__ttOn = function(){ var t = document.getElementById('textToolbar'); return !!(t && t.style.display !== 'none' && t.style.visibility !== 'hidden'); };" +
      "window.__popOn = function(){ var p = document.getElementById('ttImgPop'); return !!(p && p.classList.contains('active')); };" +
      "window.__search = function(q){ var el = document.getElementById('flagSearchInput'); el.value = q; " +
      "el.dispatchEvent(new Event('input', { bubbles: true })); return true; };" +
      "window.__tileClick = function(name, btnSel){ var t = null; document.querySelectorAll('#flagGrid .flag-card-item').forEach(function(x){ " +
      "if (!t && x.querySelector('.flag-name') && x.querySelector('.flag-name').textContent === name) t = x; }); " +
      "if (!t) return false; var b = btnSel ? t.querySelector(btnSel) : t; if (!b) return false; " +
      "b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; };" +
      "window.__flag = function(i){ var c = document.querySelectorAll('.grid-card[data-card-type=\"flag\"]')[i]; if (!c) return null; " +
      "var img = c.querySelector('.card-img-bg'); var icon = c.querySelector('.card-icon'); return { " +
      "imgName: c.dataset.imgName || null, imgDesc: c.dataset.imgDesc || null, imgVis: c.dataset.imgVisibility || null, " +
      "hasImg: !!img, hasBgImgClass: c.classList.contains('has-bg-img'), label: c.dataset.label, " +
      "labelVal: c.querySelector('.card-label') ? c.querySelector('.card-label').value : null, " +
      "iconHidden: !!(icon && icon.style.display === 'none'), cardBgImg: !!c.dataset.cardBgImg, cardBgName: c.dataset.cardBgName || null, " +
      "hasCardBgEl: !!c.querySelector('.card-bg-img'), hasCardBgClass: c.classList.contains('has-card-bg-img') }; };" +
      "window.__inlineProbe = function(){ var ims = document.querySelectorAll('img.tt-inline-img'); return { " +
      "count: ims.length, firstSrc: ims[0] ? ims[0].src : null, names: Array.prototype.map.call(ims, function(im){ return im.dataset.imgName || null; }) }; };" +
      "window.__confirmCapture = function(){ window.__confirms = []; window.confirm = function(m){ window.__confirms.push(m); return true; }; return true; };" +
      "window.__batt = true; return true; })()");
    const st = () => cdp.evalJs('JSON.stringify(window.__lib())');
    const META_OPEN = "document.getElementById('imgMetaModal').querySelector('.modal-card').classList.contains('active')";

    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'load');
    await install();

    // ── S1: 全新画布打开浏览器=全部页签零样本旗（空态文案）；我的图库=空态文案 ──
    await cdp.evalJs('window.openFlagBrowser(); true');
    await sleep(250);
    let s = JSON.parse(await st());
    ok('S1a 全部页签=0 格零样本旗（SEED/MY 已撤）+空态文案+未选择',
      s.browser && s.tab === 'all' && s.tiles.length === 0 &&
      s.empty === '还没有上传过图片——你上传的国旗、背景、头像、地图都会出现在这里' && s.selCount === '未选择',
      JSON.stringify(s).slice(0, 180));
    await cdp.evalJs("window.switchFlagTab('mylib'); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S1b 我的图库空态=0 格+文案「还没有上传过图片…」+未选择',
      s.tab === 'mylib' && s.tiles.length === 0 && s.selCount === '未选择' &&
      s.empty === '还没有上传过图片——你上传的国旗、背景、头像、地图都会出现在这里', JSON.stringify(s).slice(0, 180));
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S2: 上传国旗（meta 名）→ 我的图库 1 格（名称/Public 徽章/铅笔+垃圾桶） ──
    // v10.28.32: 图源选择器已移除——直开图片库，搜索栏上传（#flagBrowserFileInput）
    await cdp.evalJs("window.setCurrentFlagCard(window.createFlagCard('测试旗帜', 0, 12, 8, 5)); window.openFlagBrowser(); true");
    await sleep(200);
    await cdp.evalJs("window.__upFile('#flagBrowserFileInput', 'rgb(0,128,0)', 800, 500, 'my-flag.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S2 meta open');
    await cdp.evalJs("window.__fillMeta('我的国旗', '描述 词', 'public'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(250);
    const f2 = JSON.parse(await cdp.evalJs('JSON.stringify(window.__flag(0))'));
    ok('S2a 保存=卡图+label=名称+三 dataset（public）', f2.hasImg && f2.labelVal === '我的国旗' &&
      f2.imgName === '我的国旗' && f2.imgDesc === '描述 词' && f2.imgVis === 'public', JSON.stringify(f2));
    s = JSON.parse(await st());
    ok('S2b v10.28.32 保存后图库保持打开（close:self）+新格立刻出现并选中+计数文案',
      s.browser && s.tiles.length === 1 && s.tiles[0].name === '我的国旗' && s.tiles[0].sel &&
      s.selCount === '已选：我的国旗', JSON.stringify(s));
    await cdp.evalJs("window.openFlagBrowser(); window.switchFlagTab('mylib'); true");
    await sleep(250);
    s = JSON.parse(await st());
    ok('S2c 我的图库=1 格（名称/Public 徽章/铅笔+垃圾桶）',
      s.tiles.length === 1 && s.tiles[0].lib && s.tiles[0].name === '我的国旗' &&
      s.tiles[0].vis === 'Public' && s.tiles[0].edit && s.tiles[0].del, JSON.stringify(s.tiles));
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S3: pageBg+卡背景+内联（同 dataURL 双内容卡去重）→ 4 格 ──
    await cdp.evalJs('window.openPageBgModal(); true');
    await sleep(200);
    await cdp.evalJs("window.__upFile('#pageBgFileInput', 'rgb(200,0,0)', 1600, 900, 'red.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S3 pbg meta open');
    await cdp.evalJs("window.__fillMeta('红色背景', '背景 红色', 'team'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(200);
    await cdp.evalJs('window.closePageBgModal(); true');
    await sleep(300);
    s = JSON.parse(await st());
    ok('S3a pageBg=画布背景+入口 1 张', s.canvasBg && s.entryText === '1 张', JSON.stringify({ bg: s.canvasBg, e: s.entryText }));
    await cdp.evalJs("(function(){ var c = document.querySelectorAll('.grid-card[data-card-type=\"flag\"]')[0]; window.selectCard(c, true); window.openCardBgPopover(); return true; })()");
    await sleep(200);
    await cdp.evalJs("window.__upFile('#cardBgFileInput', 'rgb(120,120,120)', 400, 300, 'bg.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S3 cardBg meta open');
    await cdp.evalJs("window.__fillMeta('卡背景', '', 'private'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(250);
    const f3 = JSON.parse(await cdp.evalJs('JSON.stringify(window.__flag(0))'));
    ok('S3b 卡背景=cardBgImg+三 dataset', f3.cardBgImg && f3.cardBgName === '卡背景', JSON.stringify(f3));
    await cdp.evalJs('window.closeAllModals(); true');
    await cdp.evalJs("(function(){ var cc = window.createContentCard(0, 22, 8, 4); window.__caretInContent(cc); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'S3 toolbar');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'S3 pop');
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile.tim-upload'); true");
    await cdp.evalJs("window.__upFile('#ttInlineFileInput', 'rgb(0,0,255)', 1, 1, 'inline.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S3 inline meta open');
    await cdp.evalJs("window.__fillMeta('内联图', 'desc1', 'public'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(250);
    const in3 = JSON.parse(await cdp.evalJs('JSON.stringify(window.__inlineProbe())'));
    ok('S3c 内联图=插入 1 张+名称+alt', in3.count === 1 && in3.names[0] === '内联图', JSON.stringify(in3));
    // 同 src 复制进第二张内容卡（dataURL 去重=一格）
    await cdp.evalJs("(function(){ var c1 = document.querySelectorAll('.grid-card[data-card-type=\"content\"]')[0]; " +
      "var i = c1.querySelector('img.tt-inline-img'); var c2 = window.createContentCard(0, 27, 8, 4); " +
      "var im2 = document.createElement('img'); im2.className = 'tt-inline-img'; im2.src = i.src; im2.alt = i.alt; " +
      "im2.dataset.imgName = i.dataset.imgName; im2.dataset.imgDesc = i.dataset.imgDesc; im2.dataset.imgVisibility = i.dataset.imgVisibility; " +
      "c2.querySelector('.card-text-content').appendChild(im2); return true; })()");
    await sleep(200);
    const in3b = JSON.parse(await cdp.evalJs('JSON.stringify(window.__inlineProbe())'));
    const usages3 = await cdp.evalJs('window.countLibUsages(' + JSON.stringify(in3b.firstSrc) + ')');
    await cdp.evalJs("window.openFlagBrowser(); window.switchFlagTab('mylib'); true");
    await sleep(250);
    s = JSON.parse(await st());
    const names3 = s.tiles.map(function (t) { return t.name; }).sort().join('|');
    ok('S3d 我的图库=4 格去重（同 dataURL 双卡=1 格）+countLibUsages=2',
      s.tiles.length === 4 && s.libLen === 4 && usages3 === 2 && in3b.count === 2 &&
      names3 === '内联图|卡背景|我的国旗|红色背景', names3 + ' usages=' + usages3);
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S4: 搜索=按名称+按描述过滤（lib 双字段；清空恢复） ──
    await cdp.evalJs("window.openFlagBrowser(); window.switchFlagTab('mylib'); true");
    await sleep(200);
    await cdp.evalJs("window.__search('红色'); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S4a 按名称搜「红色」=1 格红色背景', s.tiles.length === 1 && s.tiles[0].name === '红色背景', JSON.stringify(s.tiles));
    await cdp.evalJs("window.__search('描述'); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S4b 按描述搜「描述」=1 格我的国旗', s.tiles.length === 1 && s.tiles[0].name === '我的国旗', JSON.stringify(s.tiles));
    await cdp.evalJs("window.__search('desc1'); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S4c 按描述搜「desc1」=1 格内联图', s.tiles.length === 1 && s.tiles[0].name === '内联图', JSON.stringify(s.tiles));
    await cdp.evalJs("window.__search(''); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S4d 清空搜索=4 格恢复', s.tiles.length === 4, JSON.stringify(s.tiles.map(function (t) { return t.name; })));
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S5: 点 lib 格=添加图片→Confirm→卡图+label=名称+三 dataset+全关+toast ──
    await cdp.evalJs("window.setCurrentFlagCard(window.createFlagCard('插入卡', 10, 12, 8, 5)); true");
    await cdp.evalJs("window.openFlagBrowser(); window.switchFlagTab('mylib'); true");
    await sleep(250);
    await cdp.evalJs("window.__tileClick('我的国旗', null); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S5a 单击选中=已选：我的国旗+格高亮（store-first 序，按名称不按索引）',
      s.selCount === '已选：我的国旗' && s.tiles.some(function (t) { return t.name === '我的国旗' && t.sel; }), JSON.stringify(s));
    await cdp.evalJs('window.__toastLog.length = 0; true');
    await cdp.evalJs('window.confirmFlagSelection(); true');
    await sleep(300);
    s = JSON.parse(await st());
    const f5 = JSON.parse(await cdp.evalJs('JSON.stringify(window.__flag(1))'));
    ok('S5b Confirm=卡 B 图+label=名称+三 dataset+双窗全关+遮罩摘',
      !s.browser && !s.backdrop &&
      f5.hasImg && f5.labelVal === '我的国旗' && f5.imgName === '我的国旗' && f5.imgDesc === '描述 词' && f5.imgVis === 'public',
      JSON.stringify(f5) + ' ' + JSON.stringify(s));
    ok('S5c toast=图片已添加', await cdp.evalJs("window.__toastLog.indexOf('图片已添加：我的国旗') !== -1"), '');

    // ── S6: 铅笔=meta 回填→改 desc→保存→同 src 全部使用处同步+格刷新+browser 保持+自动落草稿 ──
    await cdp.evalJs("window.openFlagBrowser(); window.switchFlagTab('mylib'); true");
    await sleep(250);
    await cdp.evalJs("window.__tileClick('我的国旗', '.lib-edit'); true");
    await sleep(250);
    s = JSON.parse(await st());
    ok('S6a 铅笔=meta 叠在 browser 上（双 active）+initial 回填（名称/描述/可见性）',
      s.meta && s.browser && s.backdrop && s.metaName === '我的国旗' && s.metaDesc === '描述 词' && s.metaVis === 'public',
      JSON.stringify(s));
    await cdp.evalJs("window.__fillMeta('改名的旗', '新描述 词', 'team'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(300);
    s = JSON.parse(await st());
    const f6a = JSON.parse(await cdp.evalJs('JSON.stringify(window.__flag(0))'));
    const f6b = JSON.parse(await cdp.evalJs('JSON.stringify(window.__flag(1))'));
    ok('S6b 保存=meta 关+browser 保持+格刷新（名/Team 徽章）+两卡三 dataset 同步',
      !s.meta && s.browser && s.backdrop && s.tiles.length === 4 &&
      s.tiles.some(function (t) { return t.name === '改名的旗' && t.vis === 'Team'; }) &&
      f6a.imgName === '改名的旗' && f6a.imgDesc === '新描述 词' && f6a.imgVis === 'team' &&
      f6b.imgName === '改名的旗' && f6b.imgDesc === '新描述 词' && f6b.imgVis === 'team',
      JSON.stringify(f6a) + ' ' + JSON.stringify(f6b));
    ok('S6c 卡 label 不动（卡名是卡自己的）+pageBg meta 未串味',
      f6a.labelVal === '我的国旗' && f6b.labelVal === '我的国旗' &&
      await cdp.evalJs("(function(){ var p = window.collectImgLibrary(); var it = p.find(function(x){ return x.name === '红色背景'; }); return !!(it && it.desc === '背景 红色' && it.visibility === 'team'); })()"), '');
    await sleep(3600); // 周期心跳口径（shrink 包后 ~24 拍；不靠显式 saveDraft）
    const draft6 = await cdp.evalJs("(function(){ var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}'); " +
      "var fs = (d.cards || []).filter(function(e){ return e.type === 'flag'; }); " +
      "return JSON.stringify({ v: d.v, metas: fs.map(function(e){ return e.imgMeta || null; }) }); })()");
    ok('S6d 3.6s 自动落草稿=两卡 imgMeta 新值+v 保持 9',
      draft6 === '{"v":9,"metas":[{"name":"改名的旗","desc":"新描述 词","visibility":"team"},{"name":"改名的旗","desc":"新描述 词","visibility":"team"}]}',
      draft6);
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S7: 垃圾桶（confirm 覆盖捕获）→两卡图全移除+icon 恢复+dataset 删+格减一+saveDraft→reload 图不回来 ──
    const flagSrc7 = await cdp.evalJs("document.querySelectorAll('.grid-card[data-card-type=\"flag\"]')[0].querySelector('.card-img-bg').src");
    const usages7 = await cdp.evalJs('window.countLibUsages(' + JSON.stringify(flagSrc7) + ')');
    await cdp.evalJs('window.__confirmCapture(); true');
    await cdp.evalJs("window.openFlagBrowser(); window.switchFlagTab('mylib'); true");
    await sleep(250);
    await cdp.evalJs('window.__toastLog.length = 0; true');
    await cdp.evalJs("window.__tileClick('改名的旗', '.lib-del'); true");
    await sleep(300);
    const confirms7 = JSON.parse(await cdp.evalJs('JSON.stringify(window.__confirms)'));
    const f7a = JSON.parse(await cdp.evalJs('JSON.stringify(window.__flag(0))'));
    const f7b = JSON.parse(await cdp.evalJs('JSON.stringify(window.__flag(1))'));
    s = JSON.parse(await st());
    ok('S7a confirm 报使用数（2 处）+两卡图全移除+icon 恢复+dataset 删+格减一（4→3）',
      usages7 === 2 && confirms7.length === 1 && confirms7[0].indexOf('2 处') !== -1 &&
      !f7a.hasImg && !f7a.hasBgImgClass && f7a.imgName === null && !f7a.iconHidden &&
      !f7b.hasImg && !f7b.hasBgImgClass && f7b.imgName === null && !f7b.iconHidden &&
      s.tiles.length === 3 && s.libLen === 3 && s.browser,
      'usages=' + usages7 + ' ' + JSON.stringify(confirms7) + ' ' + JSON.stringify(f7a) + ' ' + JSON.stringify(f7b));
    ok('S7b toast=已删除：改名的旗', await cdp.evalJs("window.__toastLog.indexOf('已删除：改名的旗') !== -1"), '');
    await cdp.evalJs('window.saveDraft(); true');
    await sleep(200);
    await cdp.send('Page.reload', {});
    await waitFor(cdp, "typeof window.createFlagCard === 'function'", 20000, 'S7 reload');
    await sleep(500);
    await install();
    const f7c = JSON.parse(await cdp.evalJs('JSON.stringify(window.__flag(0))'));
    const f7d = JSON.parse(await cdp.evalJs('JSON.stringify(window.__flag(1))'));
    const libLen7 = await cdp.evalJs('window.collectImgLibrary().length');
    const draft7 = await cdp.evalJs("(function(){ var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}'); " +
      "var fs = (d.cards || []).filter(function(e){ return e.type === 'flag'; }); " +
      "return JSON.stringify({ v: d.v, noImg: fs.every(function(e){ return !e.imgSrc && !e.imgMeta; }), cardBgMeta: fs[0].cardBgMeta || null }); })()");
    ok('S7c reload=图不回来+图库 3 项+草稿两 flag 条目无 imgSrc/imgMeta+v=9+卡背景 meta 保住',
      !f7c.hasImg && f7c.imgName === null && !f7c.iconHidden && f7c.cardBgImg &&
      !f7d.hasImg && f7d.imgName === null && libLen7 === 3 &&
      draft7 === '{"v":9,"noImg":true,"cardBgMeta":{"name":"卡背景","desc":"","visibility":"private"}}',
      draft7 + ' libLen=' + libLen7);

    // ── S8: 删 pageBg 图（STATE 路径）：删一→重合成保背景；删最后→全清 ──
    await cdp.evalJs('window.openPageBgModal(); true');
    await sleep(200);
    await cdp.evalJs("window.__upFile('#pageBgFileInput', 'rgb(0,0,255)', 1600, 900, 'blue.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S8 pbg meta open');
    await cdp.evalJs("window.__fillMeta('蓝色背景', '第二张', 'team'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(200);
    await cdp.evalJs('window.closePageBgModal(); true');
    await sleep(300);
    s = JSON.parse(await st());
    ok('S8a 第二张背景提交=2 张+画布背景在', s.canvasBg && s.entryText === '2 张', JSON.stringify({ bg: s.canvasBg, e: s.entryText }));
    const cloneReg = JSON.parse(await cdp.evalJs("JSON.stringify({ cloneImgs: document.querySelectorAll('#pbgCloneWrap img.tt-inline-img').length, usages: document.querySelector('#gridCanvas img.tt-inline-img') ? window.countLibUsages(document.querySelector('#gridCanvas img.tt-inline-img').src) : -1 })"));
    ok('S8a-bis 预览克隆副本在场也不虚增使用数（gridCanvas 口径回归钉）', cloneReg.cloneImgs >= 2 && cloneReg.usages === 2, JSON.stringify(cloneReg));
    await cdp.evalJs('window.__confirmCapture(); true');
    await cdp.evalJs("window.openFlagBrowser(); window.switchFlagTab('mylib'); true");
    await sleep(250);
    s = JSON.parse(await st());
    ok('S8b 图库=4 格（2 背景+卡背景+内联）', s.tiles.length === 4 && s.libLen === 4, JSON.stringify(s.tiles.map(function (t) { return t.name; })));
    await cdp.evalJs("window.__tileClick('红色背景', '.lib-del'); true");
    await sleep(400);
    s = JSON.parse(await st());
    ok('S8c 删红色背景=背景重合成保留（has-page-bg+1 张）+格 4→3+browser 保持',
      s.canvasBg && s.entryText === '1 张' && s.tiles.length === 3 && s.libLen === 3 && s.browser,
      JSON.stringify({ bg: s.canvasBg, e: s.entryText, n: s.tiles.length }));
    await cdp.evalJs("window.__tileClick('蓝色背景', '.lib-del'); true");
    await sleep(400);
    s = JSON.parse(await st());
    ok('S8d 删最后一张=背景全清（无 has-page-bg+未设置）+格 3→2',
      !s.canvasBg && s.entryText === '未设置' && s.tiles.length === 2 && s.libLen === 2,
      JSON.stringify({ bg: s.canvasBg, e: s.entryText, n: s.tiles.length }));
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S9: meta 叠层 Escape 只关 meta、browser 保持；遮罩再点关 browser ──
    await cdp.evalJs("window.openFlagBrowser(); window.switchFlagTab('mylib'); true");
    await sleep(250);
    await cdp.evalJs("window.__tileClick('卡背景', '.lib-edit'); true");
    await sleep(250);
    s = JSON.parse(await st());
    ok('S9a 铅笔=meta 叠 browser（双 active）+空描述/private 回填',
      s.meta && s.browser && s.backdrop && s.metaName === '卡背景' && s.metaDesc === '' && s.metaVis === 'private',
      JSON.stringify(s));
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S9b Escape=只关顶层 meta，browser+遮罩保持', !s.meta && s.browser && s.backdrop, JSON.stringify(s));
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S9c Escape 链不含 browser（只关 meta/pageBg——既有口径）', s.browser && s.backdrop, JSON.stringify(s));
    await cdp.evalJs("document.getElementById('modalBackdrop').click(); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S9d 遮罩点击=browser 关+遮罩摘', !s.browser && !s.backdrop, JSON.stringify(s));

    // ── S10: 删除其余全部→图库空态文案（管理=全部收口） ──
    await cdp.evalJs('window.__confirmCapture(); true');
    await cdp.evalJs("window.openFlagBrowser(); window.switchFlagTab('mylib'); true");
    await sleep(250);
    await cdp.evalJs("window.__tileClick('卡背景', '.lib-del'); true");
    await sleep(300);
    const f10 = JSON.parse(await cdp.evalJs('JSON.stringify(window.__flag(0))'));
    s = JSON.parse(await st());
    ok('S10a 删卡背景=cardBgImg 全摘（el/class/dataset）+格 2→1',
      !f10.cardBgImg && f10.cardBgName === null && !f10.hasCardBgEl && !f10.hasCardBgClass &&
      s.tiles.length === 1 && s.libLen === 1,
      JSON.stringify(f10) + ' ' + JSON.stringify(s.tiles.map(function (t) { return t.name; })));
    await cdp.evalJs("window.__tileClick('内联图', '.lib-del'); true");
    await sleep(300);
    // 全局探针会把 S8a 留下的预览克隆副本算进去（口径行为：克隆副本下次开窗重建，删除不动它）
    const in10 = JSON.parse(await cdp.evalJs("JSON.stringify((function(){ var g = document.querySelectorAll('#gridCanvas img.tt-inline-img'); " +
      "var a = document.querySelectorAll('img.tt-inline-img'); " +
      "var c = document.querySelectorAll('#pbgCloneWrap img.tt-inline-img'); " +
      "return { count: g.length, total: a.length, clone: c.length }; })())"));
    s = JSON.parse(await st());
    const confirms10 = JSON.parse(await cdp.evalJs('JSON.stringify(window.__confirms)'));
    ok('S10b 删内联图=画布两张全移除（剩余=克隆副本）+confirm 报 2 处+格 2→0',
      in10.count === 0 && in10.total === in10.clone && s.tiles.length === 0 && s.libLen === 0 &&
      confirms10.some(function (m) { return m.indexOf('内联图') !== -1 && m.indexOf('2 处') !== -1; }),
      JSON.stringify(in10) + ' ' + JSON.stringify(confirms10));
    ok('S10c 我的图库空态文案回归+未选择',
      s.empty === '还没有上传过图片——你上传的国旗、背景、头像、地图都会出现在这里' && s.selCount === '未选择',
      JSON.stringify(s).slice(0, 160));
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S12: 样本旗撤除后 tt-img-pop 库格零渲染（头=图片+仅上传格） ──
    await cdp.evalJs("(function(){ var cc = document.querySelectorAll('.grid-card[data-card-type=\"content\"]')[0]; window.__caretInContent(cc); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'S12 toolbar');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'S12 pop');
    const s12 = JSON.parse(await cdp.evalJs("JSON.stringify({ head: document.getElementById('ttImgHead').textContent, " +
      "tiles: Array.prototype.map.call(document.querySelectorAll('#ttImgGrid .tim-tile'), function(b){ return { upload: b.classList.contains('tim-upload'), title: b.title }; }), " +
      "libLen: (window.FC_FLAG_LIBRARY || []).length })"));
    ok('S12 tt-img-pop=0 样本旗（仅上传格）+头=图片+FC_FLAG_LIBRARY 空',
      s12.head === '图片' && s12.tiles.length === 1 && s12.tiles[0].upload && s12.libLen === 0,
      JSON.stringify(s12));
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
    await sleep(200);

    // ── S11: 版本（site v0.2.58.0 + FC v10.28.47.3 + 页面徽章） ──
    const ver11 = await cdp.evalJs("JSON.stringify({ mn: window.MN_SITE_VERSION, fc: window.FLUIDCANVAS_VERSION, badge: document.body.innerText.indexOf('v10.28.47.3') !== -1 })");
    const v11 = JSON.parse(ver11);
    ok('S11 版本 v0.2.58.0 + FC v10.28.47.3 + 徽章', v11.mn === 'v0.2.58.0' && v11.fc === 'v10.28.47.3' && v11.badge, ver11);

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
