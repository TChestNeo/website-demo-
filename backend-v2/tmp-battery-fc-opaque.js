// tmp-battery-fc-opaque.js — FC v10.28.42.1 全卡不透明电池（42.0 全卡 + 42.1 编辑器镶边全不透明）
// 用户「把FC内的所有卡片变成不透明」→ 42.0 磨砂玻璃轮（v10.27 55% 半透+blur）结束、
//   08-17「100% 不透明」口径复活；42.1 用户「我要全部 >:( 我说过了」→ 头栏/面板/浮层同铺不透明底
// 验证：S 静态锚（FC 42.1 + 42.0/42.1 changelog 条目 + rev 00282-/00288- 占位 + 站点 58.0 恒；
//   普通卡/组背景 55% 混色与 blur 撤下直用 --card-bg-color；主题卡 blur 规则摘除；.card-tint 与油漆
//   ::before opacity 0.55 撤下（全文件只剩 caption-edge-btn.locked 一处）；注入层门控收编全卡族+
//   42.1 编辑器八浮面（头栏/编辑面板/右键菜单/文字工具条/字体面板/地图区三面/弹窗）+旧选择式门控
//   零残留；12px 配方已成死码；fc-moving 挂起只剩组背景 filter 描边一个作用面；SNE 62% 混色与
//   外板 :not 排除不动）
//   / B 浏览器建卡实测（B1 SNE 卡面不透明+blur none；B2 内容卡同；B3 选色纯色
//   不透明；B4 纸主题 tint 层 opacity 1+底色不透明；B5 油漆 ::before opacity 1；
//   B6 组背景不透明+blur none+成员透明一体回归（mergeCards 真合并）；B7 fc-moving
//   挂起卡面逐字节不变（拖动时背景不再「消失」）；B8 查看模式 4 卡不透明；B9 注入层
//   不在场/已藏）
//   / E 全程零异常
// （house CDP 模式；浅色主题 surface-container #eceef0=(236,238,240)；
//   判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4900 + Math.floor(Math.random() * 80);
const CDP_PORT = 5900 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fcopaque-' + Date.now());
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
// 解析 computed 颜色串（rgb/rgba/color(srgb …) 三型通吃）→ [r,g,b]（0-255）
function parseColor(s) {
  if (!s) return null;
  let m = s.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/);
  if (m) return [parseFloat(m[1]) * 255, parseFloat(m[2]) * 255, parseFloat(m[3]) * 255];
  m = s.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)/);
  if (m) return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
  return null;
}
function near(a, b, tol) {
  if (!a || !b) return false;
  return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
}
// computed 颜色串是否不透明（无 alpha 段 / 无 color() alpha）
function isOpaque(s) {
  if (!s) return false;
  if (/rgba?\([\d.]+, [\d.]+, [\d.]+, (0|0\.\d+)\)/.test(s)) return false;
  if (s.indexOf('/') !== -1 && s.indexOf('color(') === 0) return false;
  return /^rgba?\(|^color\(/.test(s);
}

// 查看模式 fixture + fetch 桩（同 fc-sne-canvas：4 卡）
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
  '   }' +
  '   return stubResponse(JSON.stringify({ articles: [] }), 200);' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';

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

  try {
    // ── S 静态锚 ──
    const siteCfg = await (await fetch(BASE + '/assets/js/site-config.js')).text();
    const editorHtml = (await (await fetch(BASE + '/pages/fluidcanvas-editor.html')).text()).replace(/\r\n/g, '\n'); // CRLF 归一（多行锚）
    ok('S1 site-config：FC v10.28.48.0 + changelog 42.0 全卡条目与 42.1 镶边全不透明条目 + rev 00282-/00288- 占位 + 站点版本恒 v0.2.58.22',
      siteCfg.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") !== -1 &&
      siteCfg.indexOf('把FC内的所有卡片变成不透明') !== -1 &&
      siteCfg.indexOf('编辑器镶边玻璃全灭') !== -1 &&
      siteCfg.indexOf('00282-') !== -1 && siteCfg.indexOf('00288-') !== -1 && siteCfg.indexOf('v0.2.58.22') !== -1);
    ok('S2 普通卡面：55% 混色撤下直用 --card-bg-color + 卡身 blur 摘除（规则内无 backdrop-filter）',
      editorHtml.indexOf('color-mix(in srgb, var(--card-bg-color) 55%, transparent)') === -1 &&
      editorHtml.indexOf('--card-border-color: var(--divider-line);\n      background-color: var(--card-bg-color);\n    }') !== -1);
    ok('S3 组背景卡面：不透明 --card-bg-color + blur 摘除 + 兄弟节点双定义注释保留',
      editorHtml.indexOf('--card-bg-color: var(--color-surface-container);\n      background-color: var(--card-bg-color);') !== -1 &&
      editorHtml.indexOf('组背景是卡的兄弟节点继承不到') !== -1);
    ok('S4 主题卡卡身 blur 规则整体摘除（6.2 玻璃感轮结束注释在位）',
      editorHtml.indexOf('card-edge-paint {\n      backdrop-filter') === -1 &&
      editorHtml.indexOf('主题卡卡身玻璃感（用户「背景边缘的也是…检查一下是否') !== -1);
    ok('S5 填充层半透明化撤下：全文件 opacity: 0.55 只剩 caption-edge-btn.locked 一处',
      (editorHtml.match(/opacity: 0\.55/g) || []).length === 1 &&
      editorHtml.indexOf('.caption-edge-btn.locked') !== -1);
    ok('S6 .card-tint 注释含 42.0 不透明口径（层 opacity 回 1=6.2 前口径）',
      editorHtml.indexOf('v10.28.42.0: 全卡不透明——层 opacity 0.55 撤下回 1') !== -1);
    ok('S7 注入层门控收编全卡族 + 42.1 收编编辑器八浮面（blanket 规则在位 + 旧选择式门控零残留）',
      editorHtml.indexOf('.grid-card > .lg-backdrop, .grid-card > .lg-specular,') !== -1 &&
      editorHtml.indexOf('.grid-group-bg > .lg-backdrop, .grid-group-bg > .lg-specular,') !== -1 &&
      editorHtml.indexOf('.editor-header > .lg-backdrop, .editor-header > .lg-specular,') !== -1 &&
      editorHtml.indexOf('.modal-card > .lg-backdrop, .modal-card > .lg-specular {\n  display: none !important;') !== -1 &&
      editorHtml.indexOf('.grid-card.lg-static:not(.content-card)') === -1);
    ok('S8 12px 玻璃配方已成死码（42.1 编辑面板同轮铺不透明底、门控先行收编）',
      editorHtml.indexOf('.stats-edit-panel .lg-backdrop {') !== -1 &&
      editorHtml.indexOf('.stats-edit-panel > .lg-backdrop, .stats-edit-panel > .lg-specular,') !== -1 &&
      editorHtml.indexOf('此配方已成死码') !== -1 &&
      editorHtml.indexOf('.grid-card .lg-backdrop, .stats-edit-panel') === -1);
    ok('S9 fc-moving 挂起保留（对卡/镶边已全 no-op、只剩组背景 filter 描边一个作用面）',
      editorHtml.indexOf('body.fc-moving *') !== -1 &&
      editorHtml.indexOf('backdrop-filter: none !important;') !== -1 &&
      editorHtml.indexOf('body.fc-moving .grid-group-bg') !== -1 &&
      editorHtml.indexOf('42.1 全不透明：头栏/面板/浮层模糊同轮摘除——本挂起只剩') !== -1);
    ok('S10 不动锚：SNE 格底 62% 混色保留 + 外板/图底/主题排除仍在普通卡规则（外板不透明口径 v10.21 不动）',
      editorHtml.indexOf('color-mix(in srgb, var(--sne-cell-tint') !== -1 &&
      editorHtml.indexOf('.grid-card.asset-card:not(.has-outer-bg):not(.has-card-bg-img):not([class*="card-edge-"])') !== -1);

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

    // ── B 浏览器建卡实测 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "!!document.getElementById('gridCanvas') && !!window.createSneCard", 'B 编辑器加载');
    const SURFACE = [236, 238, 240]; // 浅色主题 --color-surface-container #eceef0（纸面常量）
    const faceOf = (sel) => "(function(){ var c = document.querySelector('" + sel + "'); if (!c) return null; var cs = getComputedStyle(c); return { bg: cs.backgroundColor, blur: cs.backdropFilter || 'none', webkitBlur: cs.webkitBackdropFilter || 'none', op: cs.opacity }; })()";

    await cdp.evalJs('window.createSneCard(2, 2, 9, 12)');
    await sleep(200);
    let f = await cdp.evalJs(faceOf('#gridCanvas .sne-card'));
    ok('B1 SNE 卡：卡面不透明 surface-container + backdrop blur 摘除（含 -webkit）',
      f && near(parseColor(f.bg), SURFACE, 1) && isOpaque(f.bg) && f.blur === 'none' && f.webkitBlur === 'none', JSON.stringify(f));

    await cdp.evalJs('window.createContentCard(2, 12, 8, 4)');
    await sleep(200);
    f = await cdp.evalJs(faceOf('#gridCanvas .content-card'));
    ok('B2 内容卡：卡面不透明 surface-container + blur 摘除',
      f && near(parseColor(f.bg), SURFACE, 1) && isOpaque(f.bg) && f.blur === 'none', JSON.stringify(f));

    // 选色路径：点选卡 + 订阅锁测试态 + 设纯色 → 卡面=纯色不透明
    const pt = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); var r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 30 }; })()");
    await mouse('mousePressed', pt.x, pt.y, { button: 'left' });
    await mouse('mouseReleased', pt.x, pt.y, { button: 'left' });
    await sleep(150);
    await cdp.evalJs('window.setSubscriptionTestMode(true)');
    await cdp.evalJs("window.setCardBgColor('#d43c3c')");
    await sleep(150);
    f = await cdp.evalJs(faceOf('#gridCanvas .sne-card'));
    ok('B3 选色 #d43c3c：卡面=纯色 rgb(212,60,60) 不透明 + blur 仍无',
      f && near(parseColor(f.bg), [212, 60, 60], 1) && isOpaque(f.bg) && f.blur === 'none', JSON.stringify(f));

    // 纸主题：卡身透明（剪影设计）、不透明面由 tint 层承担——tint opacity 1 + 底色 base 不透明
    await cdp.evalJs("window.setCardEdge('paper')");
    await sleep(150);
    const paper = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); if (!c) return null; var t = c.querySelector('.card-tint'); if (!t) return null; var cts = getComputedStyle(t); var ccs = getComputedStyle(c); return { face: ccs.backgroundColor, blur: ccs.backdropFilter || 'none', tintOp: cts.opacity, tintBg: cts.backgroundColor, tintImg: cts.backgroundImage.slice(0, 40), edge: c.className.indexOf('card-edge-paper') !== -1 }; })()");
    ok('B4 纸主题：卡身 blur 摘除 + tint 层 opacity 1 + 底色 base 不透明 surface + 渐变层在位',
      paper && paper.edge && paper.blur === 'none' && paper.tintOp === '1' &&
      near(parseColor(paper.tintBg), SURFACE, 1) && isOpaque(paper.tintBg) &&
      paper.tintImg.indexOf('linear-gradient') !== -1, JSON.stringify(paper));

    // 油漆主题：填充在 ::before——opacity 1 + 不透明双停渐变
    await cdp.evalJs("window.setCardEdge('paint1')");
    await sleep(150);
    const paint = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); if (!c) return null; var p = getComputedStyle(c, '::before'); return { op: p.opacity, bg: p.backgroundColor, img: p.backgroundImage.slice(0, 40), edge: c.className.indexOf('card-edge-paint') !== -1 }; })()");
    ok('B5 油漆主题：::before 填充 opacity 1 + 渐变在位（6.2 前口径复活）',
      paint && paint.edge && paint.op === '1' && paint.img.indexOf('linear-gradient') !== -1, JSON.stringify(paint));

    // fc-moving 挂起：独立卡卡面逐字节不变（拖动时背景不再「消失」——用户前问根源）
    const before = await cdp.evalJs(faceOf('#gridCanvas .content-card'));
    await cdp.evalJs("document.body.classList.add('fc-moving')");
    await sleep(60);
    const during = await cdp.evalJs(faceOf('#gridCanvas .content-card'));
    await cdp.evalJs("document.body.classList.remove('fc-moving')");
    await sleep(60);
    const after = await cdp.evalJs(faceOf('#gridCanvas .content-card'));
    ok('B7 fc-moving 挂起：独立卡卡面/模糊 before=during=after 逐字节一致（不透明面无玻璃可挂）',
      JSON.stringify(before) === JSON.stringify(during) && JSON.stringify(before) === JSON.stringify(after),
      JSON.stringify({ before: before, during: during, after: after }));

    // 组背景：真合并两卡 → 组背景卡面不透明 + blur 摘除 + 成员透明一体回归（17.2 口径）
    await cdp.evalJs('window.createSneCard(14, 2, 9, 12)');
    await sleep(200);
    const mk = await cdp.evalJs("(function(){ var cards = document.querySelectorAll('#gridCanvas .grid-card'); if (cards.length < 2) return null; window.mergeCards(cards[cards.length - 1], cards[cards.length - 2], 'right'); return true; })()");
    await sleep(250);
    const grp = await cdp.evalJs("(function(){ var gb = document.querySelector('.grid-group-bg'); if (!gb) return null; var gcs = getComputedStyle(gb); var memberFaces = []; document.querySelectorAll('.grid-card[data-group-id]').forEach(function(c){ if (c.dataset.groupId) memberFaces.push({ id: c.dataset.cardId, bg: getComputedStyle(c).backgroundColor, blur: getComputedStyle(c).backdropFilter || 'none' }); }); return { gb: gcs.backgroundColor, gblur: gcs.backdropFilter || 'none', members: memberFaces }; })()");
    ok('B6 组背景：卡面不透明 surface-container + blur 摘除 + 成员面透明一体回归（不透明由组背景承担）',
      grp && near(parseColor(grp.gb), SURFACE, 1) && isOpaque(grp.gb) && grp.gblur === 'none' &&
      grp.members.length >= 2 && grp.members.every(function (m) { return m.bg === 'rgba(0, 0, 0, 0)' && m.blur === 'none'; }),
      JSON.stringify(grp));

    // fc-moving 下组背景：底色逐字节不变（卡面不消失）、filter 描边挂起=45.2 预期
    const gbBefore = await cdp.evalJs("(function(){ var gb = document.querySelector('.grid-group-bg'); var cs = getComputedStyle(gb); return { bg: cs.backgroundColor, filter: cs.filter }; })()");
    await cdp.evalJs("document.body.classList.add('fc-moving')");
    await sleep(60);
    const gbDuring = await cdp.evalJs("(function(){ var gb = document.querySelector('.grid-group-bg'); var cs = getComputedStyle(gb); return { bg: cs.backgroundColor, filter: cs.filter }; })()");
    await cdp.evalJs("document.body.classList.remove('fc-moving')");
    await sleep(60);
    const gbAfter = await cdp.evalJs("(function(){ var gb = document.querySelector('.grid-group-bg'); var cs = getComputedStyle(gb); return { bg: cs.backgroundColor, filter: cs.filter }; })()");
    ok('B7b fc-moving 挂起：组背景底色 before=during=after 不变（面不消失）、filter 描边挂起为 none=45.2 纪律',
      gbBefore && gbDuring && gbAfter &&
      gbBefore.bg === gbDuring.bg && gbDuring.bg === gbAfter.bg &&
      gbBefore.filter !== 'none' && gbDuring.filter === 'none' && gbAfter.filter === gbBefore.filter,
      JSON.stringify({ before: gbBefore, during: gbDuring, after: gbAfter }));

    // 注入层：不在场或已藏（liquid-glass 注入与否两种路径都不该可见）
    const inj = await cdp.evalJs("(function(){ var out = []; document.querySelectorAll('#gridCanvas .grid-card > .lg-backdrop, #gridCanvas .grid-card > .lg-specular').forEach(function(l){ out.push(l.className + ':' + getComputedStyle(l).display); }); var gb = document.querySelector('.grid-group-bg'); if (gb) gb.querySelectorAll(':scope > .lg-backdrop, :scope > .lg-specular').forEach(function(l){ out.push(l.className + ':' + getComputedStyle(l).display); }); return out; })()");
    ok('B8 玻璃注入层：卡/组背景上不在场或 display:none（零可见注入层）',
      inj.every(function (s) { return s.indexOf(':none') !== -1; }), JSON.stringify(inj));

    // ── 查看模式：fixture 4 卡不透明 + blur 摘除 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html?article=ART-CLOUD-1',
      "document.querySelectorAll('#gridCanvas .grid-card').length === 4 && !!document.getElementById('fcViewScaler')", 'B9 查看器加载');
    const vm = await cdp.evalJs("(function(){ var out = []; document.querySelectorAll('#gridCanvas .grid-card').forEach(function(c){ var cs = getComputedStyle(c); out.push({ id: c.dataset.cardId, bg: cs.backgroundColor, blur: cs.backdropFilter || 'none' }); }); return out; })()");
    const vmById = {}; vm.forEach(function (c) { vmById[c.id] = c; });
    ok('B9 查看模式：默认卡 c1/c2 不透明 + 全卡 blur 摘除 + 作者自选半透背景 c3/c4 原样保留（0.15 不受玻璃轮影响）',
      vm.length === 4 && vm.every(function (c) { return c.blur === 'none'; }) &&
      vmById.c1 && isOpaque(vmById.c1.bg) && vmById.c2 && isOpaque(vmById.c2.bg) &&
      vmById.c3 && vmById.c3.bg === 'rgba(220, 38, 38, 0.15)' && vmById.c4 && vmById.c4.bg === 'rgba(46, 91, 255, 0.15)',
      JSON.stringify(vm));

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
  console.log('╭──────────────────────────────╮');
  console.log('│  🎉 ' + PASS + ' ✅ / ' + FAIL + ' ❌  (fc-opaque)  │');
  console.log('╰──────────────────────────────╯');
  if (FAIL > 0) process.exit(1);
  else process.exit(0);
})();
