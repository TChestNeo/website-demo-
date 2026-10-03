// tmp-battery-fc-all-opaque.js — FC v10.28.42.1 编辑器镶边全不透明电池
// 用户「我要全部 >:( 我说过了」——42.0 只把卡铺不透明，头栏/面板/浮层仍玻璃，本轮钦定全部：
//   头栏/编辑面板/右键菜单/文字工具条/字体面板（含分组头）/地图区三面/弹窗/13 弹层/查看模式
//   六件/输入框全铺不透明底+摘模糊+玻璃注入层门控收编；暗化遮罩（弹窗背底/地图区背底按设计
//   压暗不是表面）与 SNE 62% 混色（40.0 钦定）与作者自选透明度滑杆不动。
// 验证：S 静态锚（site-config 42.1 + 编辑器页各面规则铺 surface-container/surface-container-low +
//   旧玻璃写法零残留 + 门控收编八浮面 + keep 锚在位）
//   / B 浏览器实测（B1 头栏；B2 真开标签弹窗：卡面+输入框+注入层藏+背底 blur 保留；B3 选卡开
//   圆角弹层；B4 编辑面板创建即不透明+高光条已撤+注入层藏；B5 右键菜单真开；B6 查看模式标题条/
//   操作条/目录抽屉/目录钮；B7 地图区三面；B8 字体面板+分组头；B9 暗色主题黑族不透明）
//   / E 全程零异常
// （house CDP 模式；浅色 surface-container #eceef0=(236,238,240)、-low #f2f4f6=(242,244,246)、
//   暗色 #202038=(32,32,56)；判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4900 + Math.floor(Math.random() * 80);
const CDP_PORT = 5900 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fcallopaque-' + Date.now());
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
function isOpaque(s) {
  if (!s) return false;
  if (/rgba?\([\d.]+, [\d.]+, [\d.]+, (0|0\.\d+)\)/.test(s)) return false;
  if (s.indexOf('/') !== -1 && s.indexOf('color(') === 0) return false;
  return /^rgba?\(|^color\(/.test(s);
}

// 查看模式 fixture + fetch 桩（同 fc-opaque：4 卡）
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
    ok('S1 site-config：FC v10.28.48.0 + changelog 编辑器镶边玻璃全灭条目 + rev 00288- 占位 + 站点版本恒 v0.2.58.26',
      siteCfg.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.50.0';") !== -1 &&
      siteCfg.indexOf('编辑器镶边玻璃全灭') !== -1 &&
      siteCfg.indexOf('00288-') !== -1 && siteCfg.indexOf('v0.2.58.26') !== -1);
    ok('S2 编辑器头栏：铺 surface-container 不透明底 + 旧 16px 模糊写法零残留（门控死码配方除外）',
      editorHtml.indexOf('background: var(--color-surface-container); /* 42.1 全不透明：头栏铺不透明底+摘 16px 模糊 */') !== -1 &&
      editorHtml.indexOf('background: var(--card-bg);\n      backdrop-filter: blur(16px);') === -1);
    ok('S3 编辑面板：铺不透明底 + 12px 模糊/饱和与白色高光条撤下 + 6.2 磨砂玻璃轮作废注释在位',
      editorHtml.indexOf('background: var(--color-surface-container); border: 1px solid rgba(125, 130, 140, 0.38);') !== -1 &&
      editorHtml.indexOf('backdrop-filter: blur(12px) saturate(1.4);\n      -webkit-backdrop-filter: blur(12px) saturate(1.4);\n      background-image: linear-gradient(to left, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0));') === -1 &&
      editorHtml.indexOf('background-size: 45% 2px') === -1 &&
      editorHtml.indexOf('6.2 磨砂玻璃轮作废') !== -1);
    ok('S4 弹窗 .modal-card：铺不透明底 + 旧 32px 模糊写法零残留',
      editorHtml.indexOf('background: var(--color-surface-container); /* 42.1 全不透明：FC 全部浮面铺不透明底（用户「我要全部 >:( 我说过了」） */') !== -1 &&
      editorHtml.indexOf('  background: var(--modal-bg);\n  backdrop-filter: blur(32px);') === -1);
    ok('S5 右键菜单/文字工具条/字体面板/字号分组头：铺不透明底 + 旧 24px 模糊写法零残留',
      editorHtml.indexOf('.context-menu {\n      position: fixed; z-index: 200;\n      background: var(--color-surface-container);') !== -1 &&
      editorHtml.indexOf('min-width: 400px;\n      background: var(--color-surface-container);') !== -1 &&
      editorHtml.indexOf('width: 680px; max-width: calc(100vw - 16px);\n      background: var(--color-surface-container);') !== -1 &&
      editorHtml.indexOf('color: var(--color-outline);\n      background: var(--color-surface-container);') !== -1 &&
      editorHtml.indexOf('var(--modal-bg, var(--card-bg));') === -1);
    ok('S6 地图区编辑器三面：铺不透明底 + 旧 32px 模糊写法零残留（stage/side/panel 三处同款）',
      (editorHtml.match(/background: var\(--color-surface-container\); border: var\(--modal-border\)/g) || []).length === 3 &&
      editorHtml.indexOf('background: var(--modal-bg); border: var(--modal-border);') === -1);
    ok('S7 弹层族与查看模式六件：radius-popover/fcv-chip/fcv-toc-btn/fcv-toc-drawer/fcvp-card/#fcViewTitle/#fcViewActions 铺不透明底 + 14px 模糊旧写法零残留',
      editorHtml.indexOf('.radius-popover {\n      position: fixed; z-index: 201;\n      background: var(--color-surface-container);') !== -1 &&
      editorHtml.indexOf('background: var(--color-surface-container);\n  border: var(--card-border);\n  box-shadow: var(--shadow-md);\n  font-weight: 700;') !== -1 &&
      editorHtml.indexOf('backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);') === -1 &&
      editorHtml.indexOf('padding: 8px;\n  background: var(--color-surface-container);\n  border: 1px solid rgba(255, 255, 255, 0.12);') !== -1);
    ok('S8 输入框 .input-glass：铺 surface-container-low 不透明底 + 旧 12px 模糊写法零残留',
      editorHtml.indexOf('  background: var(--color-surface-container-low);\n  border: 1px solid var(--color-outline-variant);') !== -1 &&
      editorHtml.indexOf('background: var(--input-bg);\n  backdrop-filter: blur(12px);') === -1);
    ok('S9 玻璃注入层门控收编编辑器八浮面（头栏/编辑面板/右键菜单/文字工具条/字体面板/地图区三面/弹窗）',
      ['.editor-header > .lg-backdrop', '.stats-edit-panel > .lg-backdrop', '.context-menu > .lg-backdrop',
       '.text-toolbar > .lg-backdrop', '.font-panel > .lg-backdrop', '.mre-stage > .lg-backdrop',
       '.mre-side > .lg-backdrop', '.mre-panel > .lg-backdrop', '.modal-card > .lg-backdrop']
        .every((s) => editorHtml.indexOf(s) !== -1) &&
      editorHtml.indexOf('.modal-card > .lg-backdrop, .modal-card > .lg-specular {\n  display: none !important;') !== -1);
    ok('S10 keep 锚：弹窗/地图区暗化遮罩 blur 在位（按设计压暗底层不是表面）+ SNE 62% 混色不动 + 外板排除不动',
      editorHtml.indexOf('background: rgba(0, 0, 0, 0.2);\n  backdrop-filter: blur(8px);') !== -1 &&
      editorHtml.indexOf('backdrop-filter: blur(10px);') !== -1 &&
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
    const SURFACE = [236, 238, 240];      // 浅色 --color-surface-container #eceef0
    const SURFACE_LOW = [242, 244, 246];  // 浅色 --color-surface-container-low #f2f4f6
    const faceOf = (sel) => "(function(){ var c = document.querySelector('" + sel + "'); if (!c) return null; var cs = getComputedStyle(c); return { bg: cs.backgroundColor, blur: cs.backdropFilter || 'none', webkitBlur: cs.webkitBackdropFilter || 'none', bgImg: cs.backgroundImage.slice(0, 60) }; })()";

    // ── B 浏览器实测 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "!!document.getElementById('gridCanvas') && !!window.createSneCard", 'B 编辑器加载');

    let f = await cdp.evalJs(faceOf('.editor-header'));
    ok('B1 编辑器头栏（真元素）：不透明 surface-container + blur 摘除（含 -webkit）',
      f && near(parseColor(f.bg), SURFACE, 1) && isOpaque(f.bg) && f.blur === 'none' && f.webkitBlur === 'none', JSON.stringify(f));

    // 真开标签弹窗：卡面/输入框/注入层/背底四查
    await cdp.evalJs("window.openModal('tagsModal')");
    await sleep(250);
    f = await cdp.evalJs(faceOf('.modal-card'));
    const inp = await cdp.evalJs(faceOf('#tagModalInput'));
    const inj = await cdp.evalJs("(function(){ var mc = document.querySelector('.modal-card'); if (!mc) return null; var out = []; mc.querySelectorAll(':scope > .lg-backdrop, :scope > .lg-specular').forEach(function(l){ out.push(l.className + ':' + getComputedStyle(l).display); }); return out; })()");
    const backdrop = await cdp.evalJs(faceOf('#modalBackdrop'));
    ok('B2a 标签弹窗卡面（真开）：不透明 surface-container + blur 摘除', f && near(parseColor(f.bg), SURFACE, 1) && isOpaque(f.bg) && f.blur === 'none', JSON.stringify(f));
    ok('B2b 弹窗内输入框：不透明 surface-container-low + blur 摘除', inp && near(parseColor(inp.bg), SURFACE_LOW, 1) && isOpaque(inp.bg) && inp.blur === 'none', JSON.stringify(inp));
    ok('B2c 弹窗玻璃注入层：不在场或 display:none（不透明面无注入层可见）', inj && inj.every(function (s) { return s.indexOf(':none') !== -1; }), JSON.stringify(inj));
    ok('B2d 弹窗暗化背底 keep：blur(8px) 在位（按设计压暗不是表面）', backdrop && backdrop.blur.indexOf('blur') !== -1, JSON.stringify(backdrop));
    await cdp.evalJs("document.getElementById('modalBackdrop').classList.remove('active'); document.querySelectorAll('.modal-card.active').forEach(function(c){c.classList.remove('active');})");
    await sleep(120);

    // 选卡 → 真开圆角弹层（radius-popover 族代表）
    await cdp.evalJs('window.createSneCard(2, 2, 9, 12)');
    await sleep(200);
    const pt = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); var r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 30 }; })()");
    await mouse('mousePressed', pt.x, pt.y, { button: 'left' });
    await mouse('mouseReleased', pt.x, pt.y, { button: 'left' });
    await sleep(150);
    await cdp.evalJs('window.openBorderRadiusPopover()');
    await sleep(150);
    f = await cdp.evalJs(faceOf('.radius-popover'));
    ok('B3 圆角弹层（真开）：不透明 surface-container + blur 摘除', f && near(parseColor(f.bg), SURFACE, 1) && isOpaque(f.bg) && f.blur === 'none', JSON.stringify(f));
    await cdp.evalJs("var rp = document.querySelector('.radius-popover'); if (rp) rp.classList.remove('active')");

    // 编辑面板：真路径——建统计卡→选中→切图表态（selectCard/applyStatsChart 管线内 syncStatsEditPanel 真开面板）
    await cdp.evalJs("(function(){ var c = window.createStatsCard(20, 2, 8, 6); window.selectCard(c); window.applyStatsChart(c, 'bar'); return true; })()");
    await sleep(250);
    f = await cdp.evalJs(faceOf('.stats-edit-panel'));
    const pinj = await cdp.evalJs("(function(){ var p = document.querySelector('.stats-edit-panel'); if (!p) return null; var out = []; p.querySelectorAll(':scope > .lg-backdrop, :scope > .lg-specular').forEach(function(l){ out.push(l.className + ':' + getComputedStyle(l).display); }); return out; })()");
    ok('B4a 编辑面板（真开）：不透明 surface-container + blur 摘除 + 白色高光条已撤（background-image 无渐变）',
      f && near(parseColor(f.bg), SURFACE, 1) && isOpaque(f.bg) && f.blur === 'none' && f.bgImg.indexOf('linear-gradient') === -1, JSON.stringify(f));
    ok('B4b 编辑面板玻璃注入层：不在场或 display:none', pinj && pinj.every(function (s) { return s.indexOf(':none') !== -1; }), JSON.stringify(pinj));

    // 右键菜单：contextmenu 事件真开
    await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); var r = c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + 30 })); })()");
    await sleep(200);
    f = await cdp.evalJs(faceOf('.context-menu'));
    ok('B5 右键菜单（真开）：不透明 surface-container + blur 摘除', f && near(parseColor(f.bg), SURFACE, 1) && isOpaque(f.bg) && f.blur === 'none', JSON.stringify(f));
    await cdp.evalJs("var cm = document.querySelector('.context-menu'); if (cm) cm.style.display = 'none'");

    // 地图区三面（隐藏 DOM 在场；computed 样式照常解析）
    const mre = await cdp.evalJs("(function(){ return ['.mre-stage', '.mre-side', '.mre-panel'].map(function(sel){ var c = document.querySelector(sel); if (!c) return null; var cs = getComputedStyle(c); return { bg: cs.backgroundColor, blur: cs.backdropFilter || 'none' }; }); })()");
    ok('B6 地图区三面：不透明 surface-container + blur 摘除（stage/side/panel）',
      mre && mre.length === 3 && mre.every(function (m) { return m && near(parseColor(m.bg), SURFACE, 1) && isOpaque(m.bg) && m.blur === 'none'; }), JSON.stringify(mre));

    // 字体面板（隐藏 DOM 在场；.fp-group 分组头开面板时动态创建——规则同 token 由 S5 静态锚覆盖）
    f = await cdp.evalJs(faceOf('.font-panel'));
    ok('B7 字体面板：不透明 surface-container + blur 摘除（分组头 .fp-group 规则锚由 S5 覆盖）',
      f && near(parseColor(f.bg), SURFACE, 1) && isOpaque(f.bg) && f.blur === 'none', JSON.stringify(f));

    // ── 查看模式：标题条/操作条/目录抽屉/目录钮 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html?article=ART-CLOUD-1',
      "document.querySelectorAll('#gridCanvas .grid-card').length === 4 && !!document.getElementById('fcViewScaler')", 'B8 查看器加载');
    const vTitle = await cdp.evalJs(faceOf('#fcViewTitle'));
    const vActions = await cdp.evalJs(faceOf('#fcViewActions'));
    const vTocBtn = await cdp.evalJs(faceOf('.fcv-toc-btn'));
    const vTocDrawer = await cdp.evalJs(faceOf('.fcv-toc-drawer'));
    const vChip = await cdp.evalJs(faceOf('.fcv-chip'));
    ok('B8 查看模式：标题条/操作条/目录钮/目录抽屉/标签 chip 全不透明 + 14px 模糊摘除',
      [vTitle, vActions, vTocBtn, vTocDrawer].every(function (v) { return v && near(parseColor(v.bg), SURFACE, 1) && isOpaque(v.bg) && v.blur === 'none'; }) &&
      vChip && near(parseColor(vChip.bg), SURFACE, 1) && isOpaque(vChip.bg),
      JSON.stringify({ vTitle: vTitle, vActions: vActions, vTocBtn: vTocBtn, vTocDrawer: vTocDrawer, vChip: vChip }));

    // ── 暗色主题：黑族不透明（mono 覆盖口径同源） ──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "!!document.getElementById('gridCanvas') && !!window.createSneCard", 'B9 编辑器加载(暗色)');
    await cdp.evalJs("document.documentElement.setAttribute('data-theme', 'dark')");
    await sleep(200);
    const DARK = [32, 32, 56]; // --color-surface-container #202038
    f = await cdp.evalJs(faceOf('.editor-header'));
    await cdp.evalJs("window.openModal('tagsModal')");
    await sleep(200);
    const dm = await cdp.evalJs(faceOf('.modal-card'));
    ok('B9 暗色主题：头栏+弹窗卡面黑族 #202038 不透明（var() 自适应）',
      f && near(parseColor(f.bg), DARK, 1) && isOpaque(f.bg) &&
      dm && near(parseColor(dm.bg), DARK, 1) && isOpaque(dm.bg) && dm.blur === 'none',
      JSON.stringify({ header: f, modal: dm }));

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
  console.log('│  🎉 ' + PASS + ' ✅ / ' + FAIL + ' ❌  (fc-all-opaque)  │');
  console.log('╰────────────────────────────────────╯');
  if (FAIL > 0) process.exit(1);
  else process.exit(0);
})();
