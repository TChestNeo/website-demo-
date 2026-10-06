// tmp-battery-page-bg.js — v0.2.37.0 / FC v10.28.27.0 自定义页面背景电池
// （house CDP 模式；上传走真实 File→input.change 路径；拼接/换序/缝区渐变
//  用 renderPageBgComposite 解码回 canvas getImageData 像素实证——本机截图
//  全黑纪律，合成断言不依赖截图）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-pbg-' + Date.now());
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
  const entryLine = fceSrc.split(/\r?\n/).find(l => l.indexOf('asset-custom-entry') !== -1 && l.indexOf('<div') !== -1);
  ok('F1 资产面板「自定义」入口（非 .card/无 draggable/onclick+状态位）',
    !!entryLine && entryLine.indexOf('onclick="openPageBgModal()"') !== -1 && entryLine.indexOf('draggable') === -1 &&
    fceSrc.indexOf('id="pageBgEntryState"') !== -1);
  ok('F2 CSS：.grid-canvas.has-page-bg + .modal-card-preview',
    fceSrc.indexOf('.grid-canvas.has-page-bg') !== -1 && fceSrc.indexOf('.modal-card-preview') !== -1);
  ok('F3 合成引擎：destination-in+createLinearGradient+主题底色预填+JPEG',
    fceSrc.indexOf("'destination-in'") !== -1 && fceSrc.indexOf('createLinearGradient') !== -1 &&
    fceSrc.indexOf('getComputedStyle(gridCanvas).backgroundColor') !== -1 &&
    fceSrc.indexOf("toDataURL('image/jpeg'") !== -1);
  ok('F4 草稿：buildDraft pageBg 字段 + 注释链 + applyDraft 清场/恢复',
    fceSrc.indexOf('pageBg: PAGE_BG_STATE') !== -1 &&
    fceSrc.indexOf('v10.28.27 adds additive pageBg') !== -1 &&
    fceSrc.indexOf('restorePageBg(draft.pageBg)') !== -1);
  ok('F5 版本 v0.2.45.2 / v10.28.34.2 + 进位注释（新轮 40→41/30→31 + 旧轮 39→40/29→30 仍在）',
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.45.2';") !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.34.2';") !== -1 &&
    sconfSrc.indexOf('40→41') !== -1 && sconfSrc.indexOf('30→31') !== -1 &&
    sconfSrc.indexOf('39→40') !== -1 && sconfSrc.indexOf('29→30') !== -1);
  ok('F6 data-onclose 关闭钩子 + 电池驱动导出',
    fceSrc.indexOf("getAttribute('data-onclose')") !== -1 &&
    fceSrc.indexOf('window.renderPageBgComposite = renderPageBgComposite') !== -1 &&
    fceSrc.indexOf('window.pbgSetFeather = pbgSetFeather') !== -1 &&
    fceSrc.indexOf('window.handlePageBgUpload = handlePageBgUpload') !== -1);

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
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    // v10.28.31 订阅门禁激活（TEST_MODE=false）——本电池测页面背景，按订阅用户跑
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
      "window.__state = function(){ var list = document.getElementById('pbgList'); " +
      "var items = list ? Array.prototype.map.call(list.querySelectorAll('.pbg-list-item'), function(li){ return li.dataset.pbgId; }) : []; " +
      "var clone = document.getElementById('pbgCloneWrap') && document.getElementById('pbgCloneWrap').firstChild; " +
      "var modal = document.getElementById('pageBgModal'); " +
      "var frame = document.getElementById('pbgFrame'); " +
      "return { items: items, modalActive: !!(modal && modal.querySelector('.modal-card.active')), " +
      "backdrop: document.getElementById('modalBackdrop').classList.contains('active'), " +
      "frameRatio: frame ? frame.style.aspectRatio.replace(/\\s+/g, '') : null, " +
      "cloneBg: !!(clone && clone.style.backgroundImage && clone.style.backgroundImage.indexOf('data:image/jpeg') !== -1), " +
      "canvasBg: gridCanvas.style.backgroundImage.indexOf('data:image/jpeg') !== -1, " +
      "canvasClass: gridCanvas.classList.contains('has-page-bg'), " +
      "hintShow: !!(document.getElementById('pbgRatioHint') && document.getElementById('pbgRatioHint').classList.contains('show')), " +
      "entryText: (document.getElementById('pageBgEntryState') || {}).textContent, " +
      "minH: parseInt(gridCanvas.style.minHeight) || 0, offsetH: gridCanvas.offsetHeight }; };" +
      "window.__upload = function(color, w, h, name){ return new Promise(function(res){ " +
      "var cv = document.createElement('canvas'); cv.width = w; cv.height = h; " +
      "var cx = cv.getContext('2d'); cx.fillStyle = color; cx.fillRect(0, 0, w, h); " +
      "cv.toBlob(function(blob){ var file = new File([blob], name, { type: 'image/png' }); " +
      "var dt = new DataTransfer(); dt.items.add(file); " +
      "var input = document.getElementById('pageBgFileInput'); " +
      "input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); res(true); }, 'image/png'); }); };" +
      "window.__sample = function(){ return new Promise(function(res){ " +
      "var c = window.renderPageBgComposite(); if (!c) { res(null); return; } " +
      "var img = new Image(); img.onload = function(){ " +
      "var cv = document.createElement('canvas'); cv.width = c.w; cv.height = c.h; " +
      "var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); " +
      "var px = function(x, y){ var d = cx.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; }; " +
      "res({ w: c.w, h: c.h, top: px(800, 40), bottom: px(800, c.h - 140), row: (function(){ " +
      "var pts = []; for (var k = 0; k < 10; k++) pts.push(px(800, 672 + 24 * k)); return pts; })() }); }; " +
      "img.src = c.dataURL; }); };" +
      "window.__batt = true; return true; })()");
    const st = () => cdp.evalJs('JSON.stringify(window.__state())');
    // v10.28.28+：上传读图后先开图片信息弹窗，保存才入工作副本——
    // 上传后等 meta 弹窗 active → imgMetaSave（默认名/空描述/Private 直接存）
    const uploadAndMeta = async (color, w, h, name, label) => {
      await cdp.evalJs("window.__upload(" + JSON.stringify(color) + ", " + w + ", " + h + ", " + JSON.stringify(name) + "); true");
      await waitFor(cdp, "document.getElementById('imgMetaModal').querySelector('.modal-card.active')", 8000, 'meta-' + label);
      await cdp.evalJs('window.imgMetaSave(); true');
    };

    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'load');
    await install();

    // ── S1: 资产面板入口开窗（backdrop+modal active+默认 16:9 帧） ──
    await cdp.evalJs('window.openPageBgModal(); true');
    await sleep(200);
    let s = JSON.parse(await st());
    ok('S1 开窗=遮罩+弹窗 active+默认帧 16:9（1.778）+空列表', s.modalActive && s.backdrop && s.frameRatio === '1.778/1' && s.items.length === 0, JSON.stringify(s));

    // ── S2: 上传红/蓝两纯色图（真实 File→input.change 路径）→ 列表 2 项+克隆背景在场 ──
    await uploadAndMeta('rgb(255,0,0)', 1600, 900, 'red.png', 'u1');
    await waitFor(cdp, "document.querySelectorAll('.pbg-list-item').length === 1", 10000, 'upload1');
    await uploadAndMeta('rgb(0,0,255)', 1600, 900, 'blue.png', 'u2');
    await waitFor(cdp, "document.querySelectorAll('.pbg-list-item').length === 2", 10000, 'upload2');
    await sleep(200);
    s = JSON.parse(await st());
    ok('S2 两图上传=列表 2 项+预览克隆背景在场', s.items.length === 2 && s.cloneBg, JSON.stringify(s));

    // ── S3: 拼接顺序像素实证（顶≈红/底≈蓝，JPEG ±20） ──
    let sm = await cdp.evalJs('window.__sample()');
    ok('S3 纵向拼接：顶=红 底=蓝（composite ' + sm.w + '×' + sm.h + '）',
      sm.top[0] > 235 && sm.top[1] < 20 && sm.top[2] < 20 && sm.bottom[2] > 235 && sm.bottom[0] < 20 && sm.bottom[1] < 20,
      'top=' + sm.top + ' bottom=' + sm.bottom);

    // ── S4: DragEvent+DataTransfer 换序 → 顶蓝底红 ──
    await cdp.evalJs("(function(){ var items = document.querySelectorAll('.pbg-list-item'); " +
      "var dt = new DataTransfer(); " +
      "items[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); " +
      "var r = items[1].getBoundingClientRect(); " +
      "items[1].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: r.bottom - 1, dataTransfer: dt })); " +
      "items[0].dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt })); return true; })()");
    await sleep(200);
    s = JSON.parse(await st());
    sm = await cdp.evalJs('window.__sample()');
    ok('S4 拖拽换序=DOM 序 [bg2,bg1]+顶蓝底红',
      s.items.join(',') === 'bg2,bg1' && sm.top[2] > 235 && sm.bottom[0] > 235 && sm.bottom[2] < 20,
      JSON.stringify(s) + ' top=' + sm.top + ' bottom=' + sm.bottom);

    // ── S5: 缝区渐变像素实证（上图底=下图顶=120 → 240px 交叉淡化带） ──
    await cdp.evalJs("window.pbgSetFeather('bg2', 'bottom', 120); window.pbgSetFeather('bg1', 'top', 120); true");
    await sleep(300);
    sm = await cdp.evalJs('window.__sample()');
    const mono = sm.row.every((p, i) => i === 0 || (p[0] >= sm.row[i - 1][0] - 6 && p[2] <= sm.row[i - 1][2] + 6));
    const jump = Math.max.apply(null, sm.row.map((p, i) => i === 0 ? 0 : Math.abs(p[0] - sm.row[i - 1][0])));
    ok('S5 缝区 240px 交叉淡化（10 点 R 单调升/B 单调降/无硬跳）',
      sm.row[0][0] < 60 && sm.row[9][0] > 195 && sm.row[0][2] > 195 && sm.row[9][2] < 60 && mono && jump < 60,
      JSON.stringify(sm.row) + ' maxJump=' + jump);

    // ── S6: 16:9 最低拦截（2.67:1 单图 → 保存被拦：弹窗未关+画布无背景+红提示+toast） ──
    await cdp.evalJs('window.closePageBgModalCancel(); true');
    await sleep(100);
    await cdp.evalJs('window.openPageBgModal(); true');
    await sleep(200);
    await uploadAndMeta('rgb(0,255,0)', 1600, 600, 'short.png', 'u3');
    await waitFor(cdp, "document.querySelectorAll('.pbg-list-item').length === 1", 10000, 'upload-short');
    await sleep(200);
    await cdp.evalJs('window.closePageBgModal(); true');
    await sleep(200);
    s = JSON.parse(await st());
    const bodyTxt = await cdp.evalJs('document.body.innerText');
    ok('S6 16:9 拦截：保存被拦（弹窗未关+画布无背景+红提示+toast）',
      s.modalActive && !s.canvasBg && s.hintShow && bodyTxt.indexOf('背景高度不足 16:9') !== -1,
      JSON.stringify(s));

    // ── S7: 达标保存应用（画布 backgroundImage+has-page-bg+网格线灭+minHeight+草稿 pageBg） ──
    await cdp.evalJs('window.closePageBgModalCancel(); true');
    await sleep(100);
    await cdp.evalJs('window.openPageBgModal(); true');
    await sleep(200);
    await uploadAndMeta('rgb(255,0,0)', 1600, 900, 'red.png', 'u4');
    await waitFor(cdp, "document.querySelectorAll('.pbg-list-item').length === 1", 10000, 'upload-red');
    await uploadAndMeta('rgb(0,0,255)', 1600, 900, 'blue.png', 'u5');
    await waitFor(cdp, "document.querySelectorAll('.pbg-list-item').length === 2", 10000, 'upload-blue');
    await sleep(200);
    const exp = await cdp.evalJs("(function(){ var c = window.renderPageBgComposite(); " +
      "var e = Math.round(gridCanvas.clientWidth * c.h / 1600); window.closePageBgModal(); return JSON.stringify({ h: c.h, exp: e }); })()");
    await sleep(300);
    s = JSON.parse(await st());
    const e2 = JSON.parse(exp);
    const compBg = await cdp.evalJs("getComputedStyle(gridCanvas).backgroundImage");
    // S7b: 不靠显式 saveDraft——autosave 周期心跳（shrink 加速）后草稿必须自动含 pageBg
    // （线上电池 draftHas:false 的根因回归：指纹曾不含 pageBg → autosave 守卫
    // fp!==lastSavedContent 永不跳变 → 草稿/云端 PUT 永不写 → 刷新丢背景）
    await sleep(3600);
    const autoDraft = await cdp.evalJs("(function(){ var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}'); return !!(d.pageBg && d.pageBg.imgs && d.pageBg.imgs.length === 2 && d.pageBg.order.length === 2); })()");
    ok('S7b 自动保存：保存后 3.6s 草稿自动含 pageBg（无需显式 saveDraft）', autoDraft === true, 'autoDraft=' + autoDraft);
    await cdp.evalJs('window.saveDraft(); true');
    await sleep(200);
    const draft1 = await cdp.evalJs("(function(){ var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}'); return JSON.stringify({ has: !!d.pageBg, imgs: d.pageBg ? d.pageBg.imgs.length : -1, order: d.pageBg ? d.pageBg.order.length : -1, feath: d.pageBg ? Object.keys(d.pageBg.feathers).length : -1 }); })()");
    ok('S7 保存应用：画布背景+类+网格线灭+minHeight≈宽×h/1600+offsetHeight≥minH+入口「2 张」+草稿 pageBg 形状齐全',
      !s.modalActive && s.canvasBg && s.canvasClass &&
      compBg.indexOf('data:image/jpeg') !== -1 && compBg.indexOf('linear-gradient') === -1 &&
      Math.abs(s.minH - e2.exp) <= 2 && s.offsetH >= s.minH &&
      s.entryText === '2 张' &&
      JSON.parse(draft1).has && JSON.parse(draft1).imgs === 2 && JSON.parse(draft1).order === 2 && JSON.parse(draft1).feath === 2,
      JSON.stringify(s) + ' comp=' + compBg.slice(0, 40) + ' exp=' + e2.exp + ' draft=' + draft1);

    // ── S13（提前）：撤销/重做背景（快照经 applyDraft 清场/恢复往返） ──
    await sleep(800); // onContentChange 600ms 快照防抖落定
    await cdp.evalJs('window.historyUndoAction(); true');
    await sleep(300);
    s = JSON.parse(await st());
    ok('S13a 撤销=背景移除（canvasBg false+入口未设置）', !s.canvasBg && !s.canvasClass && s.entryText === '未设置', JSON.stringify(s));
    await cdp.evalJs('window.historyRedoAction(); true');
    await sleep(300);
    s = JSON.parse(await st());
    ok('S13b 重做=背景恢复（canvasBg true+入口 2 张）', s.canvasBg && s.canvasClass && s.entryText === '2 张', JSON.stringify(s));

    // ── S8: 点画布空白取消选中（背景不是事件目标——pointer-events 回归） ──
    await cdp.evalJs("(function(){ var card = window.createContentCard(); " +
      "var r = card.getBoundingClientRect(); " +
      "card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 })); " +
      "card.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 })); " +
      "card.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 })); return true; })()");
    await sleep(100);
    let sel1 = await cdp.evalJs("document.querySelectorAll('.grid-card.selected').length");
    await cdp.evalJs("gridCanvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 300 })); true");
    await sleep(100);
    let sel2 = await cdp.evalJs("document.querySelectorAll('.grid-card.selected').length");
    ok('S8 点画布空白取消选中（背景不吞事件）', sel1 > 0 && sel2 === 0, 'sel1=' + sel1 + ' sel2=' + sel2);

    // ── S9: 草稿往返（重载恢复背景） ──
    await cdp.send('Page.reload', {});
    await waitFor(cdp, "typeof window.createFlagCard === 'function'", 20000, 'reload');
    await waitFor(cdp, "gridCanvas.classList.contains('has-page-bg')", 15000, 'restore bg');
    await sleep(300);
    await install();
    s = JSON.parse(await st());
    sm = await cdp.evalJs('window.__sample()');
    ok('S9 重载恢复：背景+入口 2 张+顶≈红', s.canvasBg && s.canvasClass && s.entryText === '2 张' && sm.top[0] > 235, JSON.stringify(s) + ' top=' + sm.top);

    // ── S10: 取消语义（画布未动+重开列表回 STATE） ──
    await cdp.evalJs('window.openPageBgModal(); true');
    await sleep(200);
    await uploadAndMeta('rgb(0,255,0)', 1600, 900, 'green.png', 'u6');
    await waitFor(cdp, "document.querySelectorAll('.pbg-list-item').length === 3", 10000, 'upload-green');
    await cdp.evalJs('window.closePageBgModalCancel(); true');
    await sleep(200);
    s = JSON.parse(await st());
    ok('S10a 取消=画布背景不动+弹窗关', !s.modalActive && s.canvasBg, JSON.stringify(s));
    await cdp.evalJs('window.openPageBgModal(); true');
    await sleep(200);
    s = JSON.parse(await st());
    ok('S10b 重开=工作副本回 STATE（第 3 张丢弃，列表 2 项）', s.items.length === 2, JSON.stringify(s));

    // ── S11: 遮罩取消 + Escape 取消 ──
    await cdp.evalJs("document.getElementById('modalBackdrop').click(); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S11a 遮罩取消=关窗+画布不动', !s.modalActive && s.canvasBg, JSON.stringify(s));
    await cdp.evalJs('window.openPageBgModal(); true');
    await sleep(200);
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
    await sleep(200);
    s = JSON.parse(await st());
    ok('S11b Escape=取消关窗', !s.modalActive, JSON.stringify(s));

    // ── S12: 克隆保真（无手柄/对齐线/编辑态）+比例切换 ──
    await cdp.evalJs('window.openPageBgModal(); true');
    await sleep(300);
    const cloneChk = await cdp.evalJs("(function(){ var wrap = document.getElementById('pbgCloneWrap'); " +
      "var cl = wrap.firstChild; if (!cl) return JSON.stringify({ has: false }); " +
      "return JSON.stringify({ has: true, noId: !cl.id, " +
      "handles: cl.querySelectorAll('.resize-handle, .align-guide-v, .align-guide-h, .boundary-guide, .cell-hl').length, " +
      "editable: cl.querySelectorAll('[contenteditable]').length, cloneBg: cl.style.backgroundImage.indexOf('data:image/jpeg') !== -1, " +
      "cloneClass: cl.classList.contains('has-page-bg') }); })()");
    await cdp.evalJs("window.pbgSetRatio('2.333', null); true");
    await sleep(100);
    s = JSON.parse(await st());
    const r1 = s.frameRatio;
    await cdp.evalJs("window.pbgSetRatio('1', null); true");
    await sleep(100);
    s = JSON.parse(await st());
    const cc = JSON.parse(cloneChk);
    ok('S12 克隆保真（无手柄/对齐线/编辑态+背景在场）+20:9 与 1:1 切换',
      cc.has && cc.noId && cc.handles === 0 && cc.editable === 0 && cc.cloneBg && cc.cloneClass && r1 === '2.333/1' && s.frameRatio === '1/1',
      cloneChk + ' r20=' + r1 + ' r11=' + s.frameRatio);
    await cdp.evalJs('window.closePageBgModalCancel(); true');
    await sleep(100);

    // ── S14: 移除背景（confirm→全清+草稿 null+网格线回归） ──
    await cdp.evalJs("window.confirm = function(){ return true; }; window.pbgRemoveAll(); true");
    await sleep(300);
    await cdp.evalJs('window.saveDraft(); true');
    await sleep(200);
    s = JSON.parse(await st());
    const compBg2 = await cdp.evalJs("getComputedStyle(gridCanvas).backgroundImage");
    const draft2 = await cdp.evalJs("JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}').pageBg === null");
    ok('S14 移除背景=画布清空+入口未设置+草稿 null+网格线回归',
      !s.canvasBg && !s.canvasClass && s.entryText === '未设置' && draft2 === true && compBg2.indexOf('linear-gradient') !== -1,
      JSON.stringify(s) + ' draft2=' + draft2);

    // ── S15: 虚化 clamp（999→400 且值 span 同步） ──
    await cdp.evalJs('window.openPageBgModal(); true');
    await sleep(200);
    await uploadAndMeta('rgb(255,0,0)', 1600, 900, 'red.png', 'u7');
    await waitFor(cdp, "document.querySelectorAll('.pbg-list-item').length === 1", 10000, 'upload-clamp');
    await sleep(200);
    const id1 = await cdp.evalJs("document.querySelector('.pbg-list-item').dataset.pbgId");
    await cdp.evalJs("window.pbgSetFeather('" + id1 + "', 'top', 999); true");
    await sleep(100);
    const fv = await cdp.evalJs("document.querySelector('.pbg-list-item').querySelectorAll('.pbg-fv')[0].textContent");
    ok('S15 虚化 clamp：999→400（滑块值 span 同步）', fv === '400', 'fv=' + fv);
    await cdp.evalJs('window.closePageBgModalCancel(); true');
    await sleep(100);

    // ── S16: 版本（site v0.2.45.2 + FC v10.28.34.2 + 页面徽章） ──
    const verRt = await cdp.evalJs("JSON.stringify({ mn: window.MN_SITE_VERSION, fc: window.FLUIDCANVAS_VERSION, badge: document.body.innerText.indexOf('v10.28.34.2') !== -1 })");
    const vr = JSON.parse(verRt);
    ok('S16 版本 v0.2.45.2 + FC v10.28.34.2 + 徽章', vr.mn === 'v0.2.45.2' && vr.fc === 'v10.28.34.2' && vr.badge, verRt);

    // ── Z: 零 console error ──
    await sleep(400);
    ok('Z 零 console error', cdp.errs.length === 0, JSON.stringify(cdp.errs.slice(0, 3)));

    console.log('\n  ── 结果: ' + PASS + '/' + (PASS + FAIL) + (FAIL ? ' ❌' : ' 全绿 ✅'));
    await cdp.close();
    process.exitCode = FAIL ? 1 : 0;
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
