// tmp-battery-article-present.js — v0.2.58.0 完整格子画布镜像电池（阅读页不再 bbox 裁剪——
//   画布 = 完整格舞台：横向 115 格最大值 × 纵向 max(70,内容行)+25 行；格子线代码层面定义、
//   透明度放满读者不可见；宽窗 contain fit 投影整个舞台、窄窗回流阈值仍按内容 bbox 宽）
// 用户「你是不是只是提取了卡片而已？你能不能这样就是你把FC编辑那边的格子画布完完整整搬到
//   发布后出现的独立页面内但是透明度放满就是代码层面看是有格子的，这样应该可以直接取完整的
//   内容了把？然后16：9宽的格子数量是115个做一下这是最大值」（钦定「横向115格 长度不限」；
//   纵向三连：默认 16:9 115×70 再外加 25 行预留；卡片逼近底边按卡片底+25 行自动增长）
// 验证：F0 静态锚 / W 宽窗（标签条 2 chip、侧栏灭、TOC 5 条目列全部卡（c2 正文派生 Hello present…、c8 Flag 卡型名兜底）、点击闪烁、
//   stage 2530×2090 在场、格子层代码在场透明度 0、contain fit 自洽 s=min(availW/stageW,availH/stageH)、卡位 1:1 不动）
//   / N 窄窗回流（reflow 类、3 带 y 重叠、content 弹性收缩 vs 列表卡保自然宽、图卡等比、
//     320 最窄全部上下单列、页面无横向溢出、窄窗 TOC 可点）/ R resize 翻转往返（防抖监听）
//   / L legacy 流式兜底（无标签条无目录钮）/ E 零 Runtime exception + 零 console error
// fixture：ART-000004 tags['宪法','地理'] + c8 flag aspectLock(264.399×174.347) + c1 content(label Constitution)
//   + c2 content(无 label→正文派生 Hello present…) + s1 stats(colSpan18 列表卡) + c3 text(label Notes)；
//   纸算（cellSize=20 gap=2 M=24）：内容 bboxW=639、bboxH≈624 → contentRows=ceil((624−24)/22)=28
//   → stageRows=max(70,28)+25=95 → stageW=115×22=2530、stageH=95×22=2090；宽窗 s=min(availW/2530,availH/2090) 下限 0.25
//   带：c8/c1 同带(y8)、c2/s1 同带(220 与 290<306 重叠)、c3 独带；回流阈值 avail<639（内容宽，舞台宽恒 2530>窗口宽不能拿来判回流）
// 窄窗走 Emulation.setDeviceMetricsOverride（同 Chrome 翻转，resize 监听 200ms 防抖实测）；
//   640 带内同行（c8/c1）+ 换行下置（c2 撑满带宽 vs s1 保 394）、320 ≤560 媒体查询纵排（5 卡 offsetTop 严格递增）
// （house CDP 模式；截图全黑纪律；断言走 offset* 布局值不受 transform 缩放干扰）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-artpresent-' + Date.now());
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
const approx = (v, exp, tol) => Math.abs(v - exp) <= tol;

// ═══ fixture：v0.2.57.0 呈现轮（tags + 文字卡标签 + stats 列表卡 + 图卡 aspectLock）═══
const FLAG_SVG = 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20360%22%3E%3Crect%20width%3D%22600%22%20height%3D%22180%22%20fill%3D%22%232E5BFF%22%2F%3E%3Crect%20y%3D%22180%22%20width%3D%22600%22%20height%3D%22180%22%20fill%3D%22%23FFFFFF%22%2F%3E%3C/svg%3E';
const FIXTURE_PRESENT = {
  v: 9,
  title: 'Testing',
  tags: ['宪法', '地理'],
  activePreset: '169',
  presets: {
    '169': { cards: {
      c8: { col: 21, row: 1, colSpan: 12, rowSpan: 8, aspectLock: '1', aspectRatio: '1.5174603174603174', fitW: 264.39946285714285, fitH: 174.3470057142857 },
      c1: { col: 46, row: 1, colSpan: 11, rowSpan: 8 },
      c2: { col: 21, row: 11, colSpan: 12, rowSpan: 4 },
      s1: { col: 21, row: 15, colSpan: 18, rowSpan: 8 },
      c3: { col: 21, row: 26, colSpan: 6, rowSpan: 3 }
    } },
    half: { cards: {} }, tablet: { cards: {} }, mobile: { cards: {} }
  },
  groupStyles: {}, pageBg: null, lastSaved: 1750000000000,
  cards: [
    { id: 'c8', type: 'flag', col: 21, row: 1, x: 439, y: 8, colSpan: 12, rowSpan: 8, rotate: 0, borderRadius: 8, background: '', borderStyle: 'solid', borderColor: '', borderWidth: 2, aspectLock: '1', aspectRatio: '1.5174603174603174', fitW: 264.39946285714285, fitH: 174.3470057142857, label: '', z: 2, imgSrc: FLAG_SVG },
    { id: 'c1', type: 'content', col: 46, row: 1, x: 790, y: 8, colSpan: 11, rowSpan: 8, rotate: 0, background: '', borderWidth: 2, label: 'Constitution', baseFontSize: 14, z: 1, content: '<p>We the people…</p>' },
    { id: 'c2', type: 'content', col: 21, row: 11, x: 439, y: 220, colSpan: 12, rowSpan: 4, rotate: 0, background: '', borderWidth: 2, label: '', baseFontSize: 14, z: 1, content: '<p>Hello present</p>' },
    { id: 's1', type: 'stats', col: 21, row: 15, x: 439, y: 290, colSpan: 18, rowSpan: 8, rotate: 0, background: '', borderWidth: 2, label: 'Stats', z: 1 },
    { id: 'c3', type: 'text', col: 21, row: 26, x: 439, y: 520, colSpan: 6, rowSpan: 3, rotate: 0, background: 'rgba(46,91,255,0.15)', borderWidth: 2, label: 'Notes', z: 1, content: 'note text' }
  ]
};
const FIXTURE_LEGACY = {
  v: 8,
  title: 'Legacy Draft',
  activePreset: '169',
  cards: [
    { id: 'l1', type: 'content', col: 2, row: 2, colSpan: 10, rowSpan: 6, content: '<p>legacy flow body</p>', baseFontSize: 14 },
    { id: 'l2', type: 'flag', col: 4, row: 10, colSpan: 12, rowSpan: 7, label: 'Old Flag' }
  ]
};
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' var stubResponse = function (body, status) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status, headers: { "Content-Type": "application/json" } })); }, 0); }); };' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  if (u.indexOf("/articles") !== -1) {' +
  '   if (u.indexOf("/articles/") !== -1) {' +
  '    var id = decodeURIComponent(u.split("/articles/")[1].split("?")[0].split("#")[0]);' +
  '    if (id === "ART-000004") {' +
  '     return stubResponse(JSON.stringify({ article: { id: id, title: "Testing", status: "published", authorId: "USR-000042", authorName: "Neo", createdAt: "2026-09-20T10:00:00.000Z", updatedAt: "2026-09-20T10:00:00.000Z", viewCount: 7, likeCount: 2, likedByMe: false, favoritedByMe: false, contentJson: ' + JSON.stringify(FIXTURE_PRESENT) + ' } }), 200);' +
  '    }' +
  '    if (id === "ART-LEGACY1") {' +
  '     return stubResponse(JSON.stringify({ article: { id: id, title: "Legacy Draft", status: "published", authorId: "USR-000042", authorName: "Neo", createdAt: "2026-09-19T10:00:00.000Z", updatedAt: "2026-09-19T10:00:00.000Z", contentJson: ' + JSON.stringify(FIXTURE_LEGACY) + ' } }), 200);' +
  '    }' +
  '    return stubResponse(JSON.stringify({ error: "NOT_FOUND" }), 404);' +
  '   }' +
  '   return stubResponse(JSON.stringify({ articles: [] }), 200);' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';

(async () => {
  // ═══ F0 静态检查 ═══
  const art = fs.readFileSync(path.join(DOCS, 'pages', 'article.html'), 'utf8');
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  const i18n = fs.readFileSync(path.join(DOCS, 'assets', 'i18n', 'article.i18n.js'), 'utf8');
  const fc = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  ok('F0-1 article.html 呈现件全在场（art-present + applyReflow + renderToc + resize 监听 + 560px 纵排媒体查询）',
    art.indexOf('<body class="pre-stagger art-present">') !== -1 &&
    art.indexOf('function applyReflow') !== -1 && art.indexOf('function renderToc') !== -1 &&
    art.indexOf('artResizeTimer') !== -1 && art.indexOf('max-width: 560px') !== -1);
  ok('F0-2 版本 v0.2.58.10 + changelog（58.0 rev 00276-nnx + 57.1 rev 00274-xfl 保留）+ FC v10.28.47.4',
    sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.58.10';") !== -1 &&
    sconf.indexOf('00276-nnx') !== -1 && sconf.indexOf('00274-xfl') !== -1 &&
    sconf.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") !== -1);
  ok('F0-3 i18n 新键在场（article.tags.label/article.toc.title zh + zh-Hant 目錄）',
    i18n.indexOf("article.tags.label") !== -1 && i18n.indexOf("article.toc.title") !== -1 &&
    i18n.indexOf('目錄') !== -1);
  ok('F0-4 完整格舞台 + 窄窗分支 + 宽窗 contain fit + updateWideScale 在场（58.0 舞台公式锚）',
    art.indexOf('var STAGE_COLS = 115, STAGE_BASE_ROWS = 70, STAGE_GROW = 25;') !== -1 &&
    art.indexOf('Math.max(STAGE_BASE_ROWS, contentRows) + STAGE_GROW') !== -1 &&
    art.indexOf('if (avail < bboxW) { applyReflow') !== -1 &&
    art.indexOf('var s = Math.max(0.25, Math.min(avail / stageW, availH / stageH));') !== -1 &&
    art.indexOf('function updateWideScale') !== -1 &&
    art.indexOf('--art-grid-alpha') !== -1 &&
    art.indexOf('.article-page-wrap { max-width: none;') !== -1);
  ok('F0-5 FC 镜像在场（fit1to1 + renderViewPresentation + fcViewTocBtn）+ 编辑模式恒 115 锚（39.0 computeCols 恒 return 115）',
    fc.indexOf('function fit1to1') !== -1 && fc.indexOf('function renderViewPresentation') !== -1 &&
    fc.indexOf('fcViewTocBtn') !== -1 &&
    fc.indexOf('return 115;') !== -1);

  // ═══ 浏览器场景（登录态 Chrome）═══
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
    '--user-data-dir=' + USER_DATA, '--disable-features=ScrollAnchoring', 'about:blank'
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
    await sleep(700); // 200ms 防抖 + 渲染余量
  };

  try {
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

    // ── W 宽窗（1280）：标签条 + 去侧栏 + TOC 3 条目 + contain fit 全屏投影 ──
    await nav(BASE + '/pages/article.html?id=ART-000004',
      "document.querySelectorAll('#artBody .art-card').length === 5", 'W 5 卡画布');
    ok('W1 标签条显示 2 chip 宪法/地理（顺序保留）',
      await cdp.evalJs("(function(){ var b = document.getElementById('artTags'); var chips = b.querySelectorAll('.art-tag-chip'); return b.style.display === 'flex' && chips.length === 2 && chips[0].textContent === '宪法' && chips[1].textContent === '地理'; })()") === true,
      await cdp.evalJs("(function(){ var b = document.getElementById('artTags'); return b.style.display + ' chips=' + b.querySelectorAll('.art-tag-chip').length; })()"));
    ok('W2 站点侧栏灭（display none）+ 主区无左边距',
      await cdp.evalJs("getComputedStyle(document.querySelector('.app-sidebar')).display") === 'none' &&
      await cdp.evalJs("getComputedStyle(document.querySelector('.app-main')).marginLeft") === '0px',
      await cdp.evalJs("getComputedStyle(document.querySelector('.app-sidebar')).display + '/' + getComputedStyle(document.querySelector('.app-main')).marginLeft"));
    ok('W3 目录钮在场 + 抽屉 5 条目（Flag/Constitution/Hello present…/Stats/Notes；v0.2.57.1 列全部卡——label→正文派生→卡型名兜底）',
      await cdp.evalJs("(function(){ var b = document.getElementById('artTocBtn'); var d = document.getElementById('artTocDrawer'); if (!b || !d) return false; var items = d.querySelectorAll('.art-toc-item'); return items.length === 5 && items[0].textContent === 'Flag' && items[1].textContent === 'Constitution' && items[2].textContent === 'Hello present…' && items[3].textContent === 'Stats' && items[4].textContent === 'Notes'; })()") === true,
      await cdp.evalJs("(function(){ var d = document.getElementById('artTocDrawer'); var out = []; d.querySelectorAll('.art-toc-item').forEach(function(i){ out.push(i.textContent); }); return out.join(' | '); })()"));
    ok('W4 目录钮开抽屉 + 点击条目 → 抽屉关 + 目标卡闪烁',
      await cdp.evalJs("(function(){ document.getElementById('artTocBtn').click(); return document.getElementById('artTocDrawer').classList.contains('open'); })()") === true &&
      await cdp.evalJs("(function(){ var d = document.getElementById('artTocDrawer'); d.querySelectorAll('.art-toc-item')[1].click(); var c = document.querySelector('#artBody .art-card[data-card-id=\"c1\"]'); return !d.classList.contains('open') && c.classList.contains('art-card-toc-flash'); })()") === true);
    ok('W5 宽窗完整舞台自洽：inner 逻辑 2530×2090（115×22 / 95×22）、s=min(availW/2530,availH/2090) 下限 0.25 + holder=stage×s',
      await cdp.evalJs("(function(){ var b = document.getElementById('artBody'); var h = b.querySelector('.art-canvas'); var e = h.querySelector('.art-canvas-inner'); var m = e.style.transform.match(/scale\\(([\\d.]+)\\)/); var s = m ? parseFloat(m[1]) : 0; var availH = Math.max(200, window.innerHeight - h.getBoundingClientRect().top - 24); var exp = Math.max(0.25, Math.min(b.clientWidth / e.offsetWidth, availH / e.offsetHeight)); return Math.abs(e.offsetWidth - 2530) <= 3 && Math.abs(e.offsetHeight - 2090) <= 5 && Math.abs(s - exp) <= 0.005 && Math.abs(h.clientWidth - Math.round(e.offsetWidth * s)) <= 2 && Math.abs(h.clientHeight - Math.round(e.offsetHeight * s)) <= 2; })()") === true,
      await cdp.evalJs("(function(){ var b = document.getElementById('artBody'); var h = b.querySelector('.art-canvas'); var e = h.querySelector('.art-canvas-inner'); var availH = Math.max(200, window.innerHeight - h.getBoundingClientRect().top - 24); return 'avail=' + b.clientWidth + 'x' + availH + ' inner=' + e.offsetWidth + 'x' + e.offsetHeight + ' holder=' + h.clientWidth + 'x' + h.clientHeight + ' ' + e.style.transform; })()"));
    ok('W8 格子代码层面在场 + 透明度放满（两笔 linear-gradient + alpha 0 + 22px 间隔）',
      await cdp.evalJs("(function(){ var e = document.querySelector('#artBody .art-canvas-inner'); var cs = getComputedStyle(e); var bi = cs.backgroundImage.replace(/\\s+/g, ''); var bs = cs.backgroundSize; return bi.indexOf('linear-gradient') !== -1 && bi.indexOf('rgba(120,120,120,0)') !== -1 && (bi.match(/linear-gradient/g) || []).length === 2 && bs.indexOf('22px') !== -1; })()") === true,
      await cdp.evalJs("(function(){ var e = document.querySelector('#artBody .art-canvas-inner'); var cs = getComputedStyle(e); return cs.backgroundImage.slice(0, 120) + ' | size=' + cs.backgroundSize; })()"));
    ok('W6 投影不改画布逻辑尺寸：c8 逻辑宽仍 264.4（fitW）——缩放只走 transform，卡位 1:1 不动',
      await cdp.evalJs("(function(){ var c8 = document.querySelector('#artBody .art-card[data-card-id=\"c8\"]'); return Math.abs(c8.offsetWidth - 264.4) <= 2 && Math.abs(c8.offsetHeight - 174.4) <= 2; })()") === true,
      await cdp.evalJs("(function(){ var c8 = document.querySelector('#artBody .art-card[data-card-id=\"c8\"]'); return 'c8=' + c8.offsetWidth + 'x' + c8.offsetHeight; })()"));
    // ── W7 高窗：1400 → availH 变大但宽受限（2530 舞台恒宽于窗口）——s 宽度主导、随窗自洽（resize 只重算缩放不重建）──
    // 陷阱：W4 scrollIntoView 滚动后改窗口高会触发 Chrome 滚动锚定——holder.top 漂移致 availH 两次测量不一致；
    // 先 scrollTo(0,0) 稳定再改高，落定后再派发一次 resize 让 updateWideScale 用同一稳定 top 重算
    await cdp.evalJs("window.scrollTo(0, 0)");
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1400, deviceScaleFactor: 1, mobile: false });
    await sleep(700);
    await cdp.evalJs("window.dispatchEvent(new Event('resize'))");
    await sleep(700);
    ok('W7 高窗投影自洽：s 随窗重算（宽受限≈availW/2530、铺满窗宽）且 holder=stage×s',
      await cdp.evalJs("(function(){ var b = document.getElementById('artBody'); var h = b.querySelector('.art-canvas'); var e = h.querySelector('.art-canvas-inner'); var m = e.style.transform.match(/scale\\(([\\d.]+)\\)/); var s = m ? parseFloat(m[1]) : 0; var availH = Math.max(200, window.innerHeight - h.getBoundingClientRect().top - 24); var exp = Math.max(0.25, Math.min(b.clientWidth / e.offsetWidth, availH / e.offsetHeight)); return s > 0.4 && Math.abs(s - exp) <= 0.005 && Math.abs(h.clientWidth - Math.round(e.offsetWidth * s)) <= 2; })()") === true,
      await cdp.evalJs("(function(){ var b = document.getElementById('artBody'); var h = b.querySelector('.art-canvas'); var e = h.querySelector('.art-canvas-inner'); var availH = Math.max(200, window.innerHeight - h.getBoundingClientRect().top - 24); return 'avail=' + b.clientWidth + 'x' + availH + ' s=' + e.style.transform + ' holder=' + h.clientWidth; })()"));

    // ── R1+N 窄窗 640（>560 媒体阈值）：行挤压回流 ──
    await setWidth(cdp, 640);
    ok('R1 640 窄窗 → 回流模式翻转（reflow 类 + inner transform none）',
      await cdp.evalJs("(function(){ var h = document.querySelector('#artBody .art-canvas'); var e = h.querySelector('.art-canvas-inner'); return h.classList.contains('art-canvas-reflow') && getComputedStyle(e).transform === 'none'; })()") === true,
      await cdp.evalJs("(function(){ var h = document.querySelector('#artBody .art-canvas'); return 'reflow=' + h.classList.contains('art-canvas-reflow') + ' avail=' + document.getElementById('artBody').clientWidth; })()"));
    ok('N1 3 条回流带（c8/c1 同带、c2/s1 y 重叠同带、c3 独带）',
      await cdp.evalJs("document.querySelectorAll('#artBody .art-reflow-band').length") === 3,
      await cdp.evalJs("(function(){ var bs = document.querySelectorAll('#artBody .art-reflow-band'); var out = []; for (var i = 0; i < bs.length; i++) { var ids = []; bs[i].querySelectorAll('.art-card').forEach(function(c){ ids.push(c.dataset.cardId); }); out.push(ids.join('+')); } return out.join(' | '); })()"));
    ok('N2 c2 content 弹性撑满带宽 + s1 stats 保自然宽 394 换行下置（列表卡不被挤压）',
      await cdp.evalJs("(function(){ var c2 = document.querySelector('#artBody .art-card[data-card-id=\"c2\"]'); var s1 = document.querySelector('#artBody .art-card[data-card-id=\"s1\"]'); return c2.offsetWidth > 400 && c2.offsetTop < s1.offsetTop && Math.abs(s1.offsetWidth - 394) <= 2; })()") === true,
      await cdp.evalJs("(function(){ var c2 = document.querySelector('#artBody .art-card[data-card-id=\"c2\"]'); var s1 = document.querySelector('#artBody .art-card[data-card-id=\"s1\"]'); return 'c2=' + c2.offsetWidth + '@' + c2.offsetTop + ' s1=' + s1.offsetWidth + '@' + s1.offsetTop; })()"));
    ok('N3 c8/c1 同带同行（top 相等）',
      await cdp.evalJs("(function(){ var c8 = document.querySelector('#artBody .art-card[data-card-id=\"c8\"]'); var c1 = document.querySelector('#artBody .art-card[data-card-id=\"c1\"]'); return Math.abs(c8.offsetTop - c1.offsetTop) <= 2; })()") === true,
      await cdp.evalJs("(function(){ var c8 = document.querySelector('#artBody .art-card[data-card-id=\"c8\"]'); var c1 = document.querySelector('#artBody .art-card[data-card-id=\"c1\"]'); return 'c8.top=' + c8.offsetTop + ' c1.top=' + c1.offsetTop; })()"));
    ok('N4 图卡等比收缩：c8 aspect-ratio ≈ 264.399/174.347',
      await cdp.evalJs("(function(){ var c8 = document.querySelector('#artBody .art-card[data-card-id=\"c8\"]'); var v = getComputedStyle(c8).aspectRatio; if (!v || v === 'auto') return false; var p = v.split('/'); var r = parseFloat(p[0]) / parseFloat(p[1]); return Math.abs(r - 1.5174603174603174) < 0.02; })()") === true,
      await cdp.evalJs("(function(){ var c8 = document.querySelector('#artBody .art-card[data-card-id=\"c8\"]'); return getComputedStyle(c8).aspectRatio + ' ' + c8.offsetWidth + 'x' + c8.offsetHeight; })()"));

    // ── R2 回宽窗 → R3 再窄：监听防抖往返 ──
    await setWidth(cdp, 1280);
    ok('R2 回 1280 → 全屏投影还原（reflow 灭 + transform scale 恢复 + TOC 钮重建）',
      await cdp.evalJs("(function(){ var h = document.querySelector('#artBody .art-canvas'); var e = h.querySelector('.art-canvas-inner'); var m = e.style.transform.match(/scale\\(([\\d.]+)\\)/); return !h.classList.contains('art-canvas-reflow') && m && parseFloat(m[1]) >= 0.25 && !!document.getElementById('artTocBtn'); })()") === true,
      await cdp.evalJs("(function(){ var h = document.querySelector('#artBody .art-canvas'); var e = h.querySelector('.art-canvas-inner'); return 'reflow=' + h.classList.contains('art-canvas-reflow') + ' tf=' + e.style.transform; })()"));
    await setWidth(cdp, 640);
    ok('R3 再 640 → 回流复现（监听未死、往返稳定）',
      await cdp.evalJs("(function(){ var h = document.querySelector('#artBody .art-canvas'); return h.classList.contains('art-canvas-reflow') && document.querySelectorAll('#artBody .art-reflow-band').length === 3 && !!document.getElementById('artTocBtn'); })()") === true);

    // ── N5-7 最窄 320（≤560 媒体查询纵排）──
    await setWidth(cdp, 320);
    ok('N5 320 最窄全部上下单列（5 卡 offsetTop 严格递增）',
      await cdp.evalJs("(function(){ var ids = ['c8','c1','c2','s1','c3']; var prev = -1; for (var i = 0; i < ids.length; i++) { var e = document.querySelector('#artBody .art-card[data-card-id=\"' + ids[i] + '\"]'); if (!e) return false; if (e.offsetTop <= prev) return false; prev = e.offsetTop; } return true; })()") === true,
      await cdp.evalJs("(function(){ var ids = ['c8','c1','c2','s1','c3']; var out = []; ids.forEach(function(id){ var e = document.querySelector('#artBody .art-card[data-card-id=\"' + id + '\"]'); out.push(id + '@' + e.offsetTop); }); return out.join(' '); })()"));
    ok('N6 320 页面无横向溢出（列表卡被钳住不撑破页）',
      await cdp.evalJs("(function(){ return document.documentElement.scrollWidth <= window.innerWidth + 1; })()") === true,
      await cdp.evalJs("'scrollW=' + document.documentElement.scrollWidth + ' innerW=' + window.innerWidth"));
    ok('N7 窄窗 TOC 可点（开抽屉→点第 5 条 Notes→c3 闪烁 + 抽屉关）',
      await cdp.evalJs("(function(){ var b = document.getElementById('artTocBtn'); var d = document.getElementById('artTocDrawer'); b.click(); if (!d.classList.contains('open')) return false; d.querySelectorAll('.art-toc-item')[4].click(); var c = document.querySelector('#artBody .art-card[data-card-id=\"c3\"]'); return !d.classList.contains('open') && c.classList.contains('art-card-toc-flash'); })()") === true);

    // ── L legacy 流式兜底（无标签、无目录钮）──
    await nav(BASE + '/pages/article.html?id=ART-LEGACY1',
      "document.querySelectorAll('#artBody .art-flow').length >= 1", 'L legacy 流式');
    ok('L1 legacy 草稿走流式兜底（.art-flow 在场、零 .art-canvas）',
      await cdp.evalJs("document.querySelectorAll('#artBody .art-flow').length") >= 1 &&
      await cdp.evalJs("document.querySelectorAll('#artBody .art-canvas').length") === 0);
    ok('L2 legacy 正文渲染', (await cdp.evalJs("document.getElementById('artBody').textContent")).indexOf('legacy flow body') !== -1);
    ok('L3 无标签 → 标签条隐藏',
      await cdp.evalJs("document.getElementById('artTags').style.display") === 'none');
    ok('L4 流式兜底零画布 → 零目录钮（renderToc 不跑）',
      await cdp.evalJs("document.getElementById('artTocBtn')") === null &&
      await cdp.evalJs("document.getElementById('artTocDrawer')") === null);

    // ── E 全程零 Runtime exception + 零 console error ──
    ok('E1 零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 5).join(' | ') || '干净');
    ok('E2 零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 5).join(' | ') || '干净');
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
