// tmp-battery-pbg-meta.js — v0.2.45.2 / FC v10.28.34.2 上传图片信息弹窗电池
// （house CDP 模式；8 入口共用 #imgMetaModal——上传走真实 File→input.change
//  路径（v10.28.32 flag 走搜索栏 #flagBrowserFileInput，图源选择器已移除=直开图片库）；
//  叠层关闭语义用 DOM active 状态断言（同 z 110 DOM 后者在上）；
//  计数/元数据直接读 DOM/dataset/草稿。截图全黑纪律，无截图依赖）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-pbgmeta-' + Date.now());
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
  ok('F1 #imgMetaModal 在 pageBgModal 后（同 z 110 后者在上）+data-onclose+Public/Private/Team 三段',
    fceSrc.indexOf('id="imgMetaModal"') > fceSrc.indexOf('id="pageBgModal"') &&
    fceSrc.indexOf('data-onclose="imgMetaCancel"') !== -1 &&
    fceSrc.indexOf('data-vis="public"') !== -1 && fceSrc.indexOf('data-vis="private"') !== -1 && fceSrc.indexOf('data-vis="team"') !== -1);
  ok('F2 backdrop onclick=closeTopModal（单弹窗等价向后兼容）',
    fceSrc.indexOf('id="modalBackdrop" onclick="closeTopModal()"') !== -1);
  ok('F3 引擎导出：openImgMetaModal/imgMetaWordCount/closeModalOnly/closeTopModal/imgMetaSave/pbgEditImageMeta',
    fceSrc.indexOf('window.openImgMetaModal = openImgMetaModal') !== -1 &&
    fceSrc.indexOf('window.imgMetaWordCount = imgMetaWordCount') !== -1 &&
    fceSrc.indexOf('window.closeModalOnly = closeModalOnly') !== -1 &&
    fceSrc.indexOf('window.closeTopModal = closeTopModal') !== -1 &&
    fceSrc.indexOf('window.imgMetaSave = imgMetaSave') !== -1 &&
    fceSrc.indexOf('window.pbgEditImageMeta = pbgEditImageMeta') !== -1);
  ok('F4 8 入口全接 + insertInlineImage 挂 meta 参数',
    (fceSrc.match(/openImgMetaModal\(/g) || []).length >= 8 &&
    fceSrc.indexOf('function insertInlineImage(src, alt, meta)') !== -1);
  ok('F5 草稿 5 元数据字段 + pbgDeepCopy 拷贝 + fingerprint 元数据摘要',
    fceSrc.indexOf('entry.imgMeta = ') !== -1 &&
    fceSrc.indexOf('entry.cardBgMeta = ') !== -1 &&
    fceSrc.indexOf('entry.captionBgMeta = ') !== -1 &&
    fceSrc.indexOf('entry.charAvatarMeta = ') !== -1 &&
    fceSrc.indexOf('entry.mapImgMeta = ') !== -1 &&
    fceSrc.indexOf("name: im.name || ''") !== -1 &&
    fceSrc.indexOf('JSON.stringify(PAGE_BG_STATE.imgs.map') !== -1);
  ok('F6 空格分词计数 + 320 硬限 + .over 红 + IME isComposing 守卫',
    fceSrc.indexOf('t.split(/\\s+/).length') !== -1 &&
    fceSrc.indexOf('IMG_META_LIMIT = 320') !== -1 &&
    fceSrc.indexOf("toggle('over'") !== -1 &&
    fceSrc.indexOf('e.isComposing') !== -1);
  ok('F7 版本 v0.2.58.10 / v10.28.47.4 + 进位注释（新轮 41→42/31→32 + 旧轮 40→41/30→31 仍在）',
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.58.10';") !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") !== -1 &&
    sconfSrc.indexOf('41→42') !== -1 && sconfSrc.indexOf('31→32') !== -1 &&
    sconfSrc.indexOf('40→41') !== -1 && sconfSrc.indexOf('30→31') !== -1);

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
    // v10.28.31 订阅门禁激活（TEST_MODE=false）——本电池测页面背景元数据流，按订阅用户跑
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_user", ' + JSON.stringify(JSON.stringify({ id: 'USR-batt', displayName: 'Battery Tester', citizenId: 'CIT-8842', tier: 'premium' })) + ');}catch(e){}'
    });
    // v0.2.40.0 周期制适配：shrink 包（≥60s→150ms 真跑，不记录）——心跳在 sleep(3600) 窗口内滴答
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: "(function(){ var r = window.setTimeout.bind(window); " +
        "window.setTimeout = function(fn, d){ var a = Array.prototype.slice.call(arguments, 2); " +
        "if (typeof d === 'number' && d >= 60000) { return r(function(){ fn.apply(null, a); }, 150); } " +
        "return r.apply(null, [fn, d].concat(a)); }; })();"
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const install = () => cdp.evalJs("(function(){ if (window.__batt) return true; " +
      "window.__meta = function(){ var act = function(el){ return !!(el && el.querySelector('.modal-card') && el.querySelector('.modal-card').classList.contains('active')); }; " +
      "return { meta: act(document.getElementById('imgMetaModal')), pbg: act(document.getElementById('pageBgModal')), browser: act(document.getElementById('flagBrowserModal')), " +
      "name: document.getElementById('immName').value, count: document.getElementById('immCount').textContent, " +
      "over: document.getElementById('immCount').classList.contains('over'), " +
      "vis: (document.querySelector('#immSeg .segmented-option.active') || { dataset: {} }).dataset.vis || null, " +
      "prev: (document.getElementById('immPreview').src || '').slice(0, 22), " +
      "backdrop: document.getElementById('modalBackdrop').classList.contains('active'), " +
      "items: Array.prototype.map.call(document.querySelectorAll('.pbg-list-item'), function(li){ var n = li.querySelector('.pbg-name'); return n ? n.textContent : ''; }), " +
      "canvasBg: gridCanvas.style.backgroundImage.indexOf('data:image/jpeg') !== -1, " +
      "canvasClass: gridCanvas.classList.contains('has-page-bg'), " +
      "entryText: (document.getElementById('pageBgEntryState') || {}).textContent }; };" +
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
      "window.__batt = true; return true; })()");
    const st = () => cdp.evalJs('JSON.stringify(window.__meta())');
    const META_OPEN = "document.getElementById('imgMetaModal').querySelector('.modal-card').classList.contains('active')";

    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'load');
    await install();

    // ── S1: 直接开窗回填（默认名/initial 两种路径）+取消 ──
    await cdp.evalJs("window.openImgMetaModal('data:image/png;base64,AAAA', 'my-flag', function(){ return true; }); true");
    await sleep(200);
    let s = JSON.parse(await st());
    ok('S1a 直接开窗=名称回填 my-flag+计数 0 / 320+Private active+预览+遮罩',
      s.meta && s.name === 'my-flag' && s.count === '0 / 320' && s.vis === 'private' && s.prev.indexOf('data:image/png') !== -1 && s.backdrop, JSON.stringify(s));
    await cdp.evalJs("window.openImgMetaModal('data:image/jpeg;base64,BBBB', '', function(){ return true; }, { initial: { name: 'n1', desc: 'one two', visibility: 'team' } }); true");
    await sleep(150);
    s = JSON.parse(await st());
    ok('S1b 编辑回填=initial 名称/计数 2 / 320/Team active', s.meta && s.name === 'n1' && s.count === '2 / 320' && s.vis === 'team', JSON.stringify(s));
    await cdp.evalJs('window.closeImgMetaModalCancel(); true');
    await sleep(150);
    s = JSON.parse(await st());
    ok('S1c 取消=窗关+遮罩摘', !s.meta && !s.backdrop, JSON.stringify(s));

    // ── S2: 按空格分词计数（"code"=1 不是 4） ──
    const wc = await cdp.evalJs("JSON.stringify([window.imgMetaWordCount('code'), window.imgMetaWordCount('你好世界'), window.imgMetaWordCount('我的 code 很好'), window.imgMetaWordCount(''), window.imgMetaWordCount('   ')])");
    ok('S2 空格分词计数 code=1/你好世界=1/我的 code 很好=3/空=0', wc === '[1,1,3,0,0]', wc);

    // ── S3: 321 词保存阻断（不硬截断，红计数+toast+窗不关） ──
    await cdp.evalJs("window.openImgMetaModal('data:image/png;base64,CCCC', 'x', function(){ return true; }); true");
    await sleep(150);
    await cdp.evalJs("(function(){ document.getElementById('immDesc').value = new Array(321).join('w ') + 'w'; window.imgMetaRefreshCount(); return true; })()");
    await sleep(100);
    s = JSON.parse(await st());
    ok('S3a 321 词=计数 321 / 320+红 .over', s.count === '321 / 320' && s.over, JSON.stringify(s));
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(150);
    s = JSON.parse(await st());
    const bodyTxt3 = await cdp.evalJs('document.body.innerText');
    ok('S3b 超限保存被拦=窗不关+toast+红保持', s.meta && bodyTxt3.indexOf('描述超过 320 词上限，请删减') !== -1 && s.over, JSON.stringify(s));
    await cdp.evalJs("(function(){ document.getElementById('immDesc').value = 'ok word'; window.imgMetaRefreshCount(); return true; })()");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(150);
    s = JSON.parse(await st());
    ok('S3c 删减后保存=窗关+遮罩摘', !s.meta && !s.backdrop, JSON.stringify(s));

    // ── S4: pageBg 上传→meta 叠层→保存（宿主弹窗保持）→3.6s 自动落草稿 ──
    await cdp.evalJs('window.openPageBgModal(); true');
    await sleep(200);
    await cdp.evalJs("window.__upFile('#pageBgFileInput', 'rgb(200,0,0)', 1600, 900, 'red.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S4 meta open');
    await sleep(150);
    s = JSON.parse(await st());
    ok('S4a 上传后 meta 叠在 pageBgModal 上（双 active）+默认名 red+预览 JPEG',
      s.meta && s.pbg && s.name === 'red' && s.prev.indexOf('data:image/jpeg') !== -1, JSON.stringify(s));
    await cdp.evalJs("window.__fillMeta('红色背景', '背景 红色', 'team'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(200);
    s = JSON.parse(await st());
    ok('S4b 保存=meta 关+pageBgModal 仍开+列表 1 项名称行', !s.meta && s.pbg && s.items.length === 1 && s.items[0] === '红色背景', JSON.stringify(s));
    await cdp.evalJs('window.closePageBgModal(); true');
    await sleep(300);
    s = JSON.parse(await st());
    ok('S4c 保存背景=画布背景+入口 1 张', s.canvasBg && s.canvasClass && s.entryText === '1 张', JSON.stringify(s));
    await sleep(3600); // 周期心跳口径（shrink 包后 ~24 拍；不靠显式 saveDraft——S7b 同款防回归）
    const draft4 = await cdp.evalJs("(function(){ var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}'); var im = d.pageBg && d.pageBg.imgs && d.pageBg.imgs[0]; return JSON.stringify({ has: !!(d.pageBg && d.pageBg.imgs && d.pageBg.imgs.length === 1), name: im ? im.name : null, desc: im ? im.desc : null, vis: im ? im.visibility : null }); })()");
    ok('S4d 3.6s 自动落草稿=imgs[0] 三字段齐全', draft4 === '{"has":true,"name":"红色背景","desc":"背景 红色","vis":"team"}', draft4);

    // ── S5: pageBg 取消=图不落地+宿主弹窗保持 ──
    await cdp.evalJs('window.openPageBgModal(); true');
    await sleep(200);
    await cdp.evalJs("window.__upFile('#pageBgFileInput', 'rgb(0,0,255)', 1600, 900, 'blue.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S5 meta open');
    await cdp.evalJs('window.closeImgMetaModalCancel(); true');
    await sleep(200);
    s = JSON.parse(await st());
    ok('S5a 取消=图不落地（列表仍 1 项）+pageBgModal 保持', !s.meta && s.pbg && s.items.length === 1, JSON.stringify(s));
    await cdp.evalJs('window.closePageBgModalCancel(); true');
    await sleep(200);
    s = JSON.parse(await st());
    ok('S5b 宿主取消=窗关+画布背景不动', !s.pbg && s.canvasBg, JSON.stringify(s));

    // ── S6: flag 保存=图库保持开+卡图+三 dataset+label=名称（v10.28.32 直开图库口径） ──
    await cdp.evalJs("window.setCurrentFlagCard(window.createFlagCard('测试旗帜', 0, 12, 8, 5)); window.openFlagBrowser(); true");
    await sleep(200);
    await cdp.evalJs("window.__upFile('#flagBrowserFileInput', 'rgb(0,128,0)', 800, 500, 'my-flag.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S6 meta open');
    await sleep(150);
    s = JSON.parse(await st());
    ok('S6a meta 叠在图片库上（双 active）', s.meta && s.browser, JSON.stringify(s));
    await cdp.evalJs("window.__fillMeta('我的国旗', '描述 词', 'public'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(250);
    s = JSON.parse(await st());
    const flag6 = await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-type=\"flag\"]'); return JSON.stringify({ imgName: c.dataset.imgName, imgDesc: c.dataset.imgDesc, imgVis: c.dataset.imgVisibility, label: c.dataset.label, hasImg: !!(c.querySelector('.card-img-bg') || c.querySelector('.card-stripes')), labelVal: c.querySelector('.card-label').value }); })()");
    ok('S6b 保存=meta 关+图库保持开+遮罩在+卡图+三 dataset+label=名称（close:self 口径）',
      !s.meta && s.browser && s.backdrop &&
      flag6 === '{"imgName":"我的国旗","imgDesc":"描述 词","imgVis":"public","label":"我的国旗","hasImg":true,"labelVal":"我的国旗"}',
      flag6 + ' ' + JSON.stringify(s));
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S7: flag 取消=图片库保持开+卡无图无元数据 ──
    await cdp.evalJs("window.setCurrentFlagCard(window.createFlagCard('第二旗帜', 10, 12, 8, 5)); window.openFlagBrowser(); true");
    await sleep(200);
    await cdp.evalJs("window.__upFile('#flagBrowserFileInput', 'rgb(0,128,128)', 800, 500, 'other.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S7 meta open');
    await cdp.evalJs('window.closeImgMetaModalCancel(); true');
    await sleep(200);
    s = JSON.parse(await st());
    const flag7 = await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-type=\"flag\"][data-label=\"第二旗帜\"]'); return JSON.stringify({ noImg: !c.dataset.imgName, noBg: !c.querySelector('.card-img-bg') }); })()");
    ok('S7 取消=图片库保持开+卡无图无元数据', !s.meta && s.browser && flag7 === '{"noImg":true,"noBg":true}', flag7 + ' ' + JSON.stringify(s));
    await cdp.evalJs('window.closeAllModals(); true');

    // ── S8: cardBg 上传→三 dataset→草稿往返 ──
    await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-type=\"flag\"][data-label=\"我的国旗\"]'); window.selectCard(c, true); window.openCardBgPopover(); return true; })()");
    await sleep(200);
    await cdp.evalJs("window.__upFile('#cardBgFileInput', 'rgb(120,120,120)', 400, 300, 'bg.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S8 meta open');
    await cdp.evalJs("window.__fillMeta('卡背景', '', 'private'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(250);
    const bg8 = await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-type=\"flag\"][data-label=\"我的国旗\"]'); return JSON.stringify({ img: (c.dataset.cardBgImg || '').slice(0, 5), name: c.dataset.cardBgName, desc: c.dataset.cardBgDesc || '∅', vis: c.dataset.cardBgVisibility }); })()");
    ok('S8a 卡背景保存=cardBgImg+三 dataset', bg8 === '{"img":"data:","name":"卡背景","desc":"∅","vis":"private"}', bg8);
    await cdp.evalJs('window.saveDraft(); true');
    await sleep(200);
    await cdp.send('Page.reload', {});
    await waitFor(cdp, "typeof window.createFlagCard === 'function'", 20000, 'S8 reload');
    await sleep(500);
    await install();
    const bg8b = await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-type=\"flag\"][data-label=\"我的国旗\"]'); return JSON.stringify({ imgName: c.dataset.imgName, cardBgName: c.dataset.cardBgName, cardBgDesc: c.dataset.cardBgDesc || '∅', cardBgVis: c.dataset.cardBgVisibility }); })()");
    ok('S8b 草稿往返=imgMeta+cardBgMeta 数据集全恢复',
      bg8b === '{"imgName":"我的国旗","cardBgName":"卡背景","cardBgDesc":"∅","cardBgVis":"private"}', bg8b);

    // ── S9: 内联图上传→meta 保存→data-* 属性往返 ──
    await cdp.evalJs("(function(){ var cc = window.createContentCard(0, 22, 8, 4); window.__caretInContent(cc); return true; })()");
    await waitFor(cdp, "window.__ttOn()", 3000, 'S9 toolbar');
    await cdp.evalJs("window.__clickBtn('#ttImgBtn'); true");
    await waitFor(cdp, "window.__popOn()", 3000, 'S9 pop');
    await cdp.evalJs("window.__clickBtn('#ttImgGrid .tim-tile.tim-upload'); true");
    await cdp.evalJs("window.__upFile('#ttInlineFileInput', 'rgb(0,0,255)', 1, 1, 'inline.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S9 meta open');
    await cdp.evalJs("window.__fillMeta('内联图', 'desc1', 'public'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(250);
    s = JSON.parse(await st());
    const inl9 = await cdp.evalJs("(function(){ var i = document.querySelector('.grid-card[data-card-type=\"content\"] .card-text-content img.tt-inline-img'); return i ? JSON.stringify({ name: i.dataset.imgName, desc: i.dataset.imgDesc, vis: i.dataset.imgVisibility, alt: i.alt }) : 'null'; })()");
    ok('S9a 内联图保存=插入+alt=名称+三 data-*+meta 关', !s.meta && inl9 === '{"name":"内联图","desc":"desc1","vis":"public","alt":"内联图"}', inl9 + ' ' + JSON.stringify(s));
    await cdp.evalJs('window.saveDraft(); true');
    await sleep(200);
    await cdp.send('Page.reload', {});
    await waitFor(cdp, "typeof window.createFlagCard === 'function'", 20000, 'S9 reload');
    await sleep(500);
    await install();
    const inl9b = await cdp.evalJs("(function(){ var i = document.querySelector('.grid-card[data-card-type=\"content\"] .card-text-content img.tt-inline-img'); return i ? JSON.stringify({ name: i.dataset.imgName, desc: i.dataset.imgDesc, vis: i.dataset.imgVisibility, alt: i.alt }) : 'null'; })()");
    ok('S9b 重载往返=内联图 data-* 无损', inl9b === '{"name":"内联图","desc":"desc1","vis":"public","alt":"内联图"}', inl9b);

    // ── S10: 头像/地图六 dataset ──
    await cdp.evalJs("window.createCharacterCard(12, 14, 4, 5); window.createMapCard(18, 14, 8, 6); true");
    await sleep(200);
    await cdp.evalJs("window.__upFile(document.querySelector('.grid-card[data-card-type=\"character\"] input[type=file]'), 'rgb(255,100,0)', 200, 200, 'me.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S10 avatar meta open');
    await cdp.evalJs("window.__fillMeta('头像', '', 'private'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(250);
    const av10 = await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-type=\"character\"]'); var av = c.querySelector('.char-avatar'); return JSON.stringify({ name: c.dataset.charAvatarName, desc: c.dataset.charAvatarDesc || '∅', vis: c.dataset.charAvatarVisibility, bg: av.style.backgroundImage.indexOf('url(\"data:') === 0, empty: av.innerHTML === '' }); })()");
    ok('S10a 头像=charAvatar+三 dataset+背景图（fi 覆盖层在场=innerHTML 非空，v10.28.45.0 起桥口径）', av10 === '{"name":"头像","desc":"∅","vis":"private","bg":true,"empty":false}', av10);
    await cdp.evalJs("window.__upFile(document.querySelector('.grid-card[data-card-type=\"map\"] input[type=file]'), 'rgb(0,200,200)', 400, 300, 'map.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S10 map meta open');
    await cdp.evalJs("window.__fillMeta('地图', 'map desc', 'team'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(250);
    const mp10 = await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-type=\"map\"]'); var cv = c.querySelector('.map-canvas'); return JSON.stringify({ name: c.dataset.mapImgName, desc: c.dataset.mapImgDesc, vis: c.dataset.mapImgVisibility, bg: cv.style.backgroundImage.indexOf('url(\"data:') === 0, noEmpty: !cv.classList.contains('map-empty') }); })()");
    ok('S10b 地图=mapImg+三 dataset+去 map-empty', mp10 === '{"name":"地图","desc":"map desc","vis":"team","bg":true,"noEmpty":true}', mp10);

    // ── S11: Escape/遮罩叠层只关顶层（再按/再点才关底层） ──
    await cdp.evalJs('window.openPageBgModal(); true');
    await sleep(200);
    await cdp.evalJs("window.__upFile('#pageBgFileInput', 'rgb(10,10,10)', 1600, 900, 'e1.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S11 meta open');
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S11a Escape=只关顶层 meta，pageBgModal 保持', !s.meta && s.pbg && s.backdrop, JSON.stringify(s));
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S11b Escape 再按=关 pageBgModal+遮罩摘', !s.pbg && !s.backdrop, JSON.stringify(s));
    await cdp.evalJs('window.openPageBgModal(); true');
    await sleep(200);
    await cdp.evalJs("window.__upFile('#pageBgFileInput', 'rgb(20,20,20)', 1600, 900, 'e2.png')");
    await waitFor(cdp, META_OPEN, 10000, 'S11 meta open 2');
    await cdp.evalJs("document.getElementById('modalBackdrop').click(); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S11c 遮罩点击=只关顶层 meta', !s.meta && s.pbg && s.backdrop, JSON.stringify(s));
    await cdp.evalJs("document.getElementById('modalBackdrop').click(); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S11d 遮罩再点=关 pageBgModal+遮罩摘', !s.pbg && !s.backdrop, JSON.stringify(s));

    // ── S12: 列表编辑钮=initial 回填→改 meta→自动落草稿 ──
    await cdp.evalJs('window.openPageBgModal(); true');
    await sleep(200);
    await cdp.evalJs("document.querySelector('.pbg-edit').click(); true");
    await waitFor(cdp, META_OPEN, 10000, 'S12 meta open');
    await sleep(150);
    s = JSON.parse(await st());
    ok('S12a 编辑钮=initial 回填（名称/计数/可见性）', s.meta && s.name === '红色背景' && s.count === '2 / 320' && s.vis === 'team', JSON.stringify(s));
    await cdp.evalJs("window.__fillMeta('改名', 'three words now', 'private'); true");
    await cdp.evalJs('window.imgMetaSave(); true');
    await sleep(200);
    s = JSON.parse(await st());
    ok('S12b 编辑保存=meta 关+pageBgModal 开+名称行改', !s.meta && s.pbg && s.items.length === 1 && s.items[0] === '改名', JSON.stringify(s));
    await cdp.evalJs('window.closePageBgModal(); true');
    await sleep(3600); // 元数据变更触发 fingerprint 跳变 → autosave
    const draft12 = await cdp.evalJs("(function(){ var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}'); var im = d.pageBg && d.pageBg.imgs && d.pageBg.imgs[0]; return JSON.stringify({ name: im ? im.name : null, desc: im ? im.desc : null, vis: im ? im.visibility : null }); })()");
    ok('S12c 编辑自动落草稿（名称/描述/可见性）', draft12 === '{"name":"改名","desc":"three words now","vis":"private"}', draft12);

    // ── S13: 版本（site v0.2.58.10 + FC v10.28.47.4 + 页面徽章） ──
    const ver13 = await cdp.evalJs("JSON.stringify({ mn: window.MN_SITE_VERSION, fc: window.FLUIDCANVAS_VERSION, badge: document.body.innerText.indexOf('v10.28.47.4') !== -1 })");
    const v13 = JSON.parse(ver13);
    ok('S13 版本 v0.2.58.10 + FC v10.28.47.4 + 徽章', v13.mn === 'v0.2.58.10' && v13.fc === 'v10.28.47.4' && v13.badge, ver13);

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
