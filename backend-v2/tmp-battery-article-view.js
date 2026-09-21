// tmp-battery-article-view.js — v0.2.49.0 / FC v10.28.35.3 文章查看器电池（F 轮复跑：版本断言更新 + F0-6 发布即公开）
// 用户「现在能不能做一下当我发布文章后其他用户看见这个文章的界面？我要求它的显示范围只有那个格子的范围超出格子就无法显示」
// 验证：A 列表云端合并 17 行 + View 按钮接线导航 / B 查看器渲染+只读硬化+chrome 全隐+哨兵草稿不被覆盖
//       C 格范围硬裁剪（越界卡 x/y 双侧几何 + overflow hidden）/ D pending 404 占位状态卡
//       E guest 直载查看器不跳锁屏 / F demo store 兜底（ART-001 样例）+ reload 幂等
//       G 全程零 Runtime exception + 零 console error（资源 404 豁免）
//       F0 静态：双版本串 + 查看模式 CSS/JS + 五守卫 + View 委托分支 + 样例 contentJson
// fetch 打桩：仅拦截 /articles 路径（list 2 篇：published+pending；detail：ART-CLOUD-1 带 4 卡 contentJson——
//       其中 c3 右越界、c4 下越界；其余 404），其余路径放行原生 fetch（静态壳 /api 404 无碍）。
// （house CDP 模式；截图全黑纪律，无截图依赖；confirm 对话框自动接受防挂起）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-artview-batt-' + Date.now());
const USER_DATA_GUEST = path.join(os.tmpdir(), 'mn-cdp-artview-guest-' + Date.now()); // E 场景全新 profile：同 profile localStorage 跨 target 共享会漏种子
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
        // 正确层级：异常详情挂在 m.params.exceptionDetails（v0.2.53.1 修正——旧写 m.exceptionDetails 恒 {} 丢失描述）
        const d = (m.params && m.params.exceptionDetails) || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber, raw: JSON.stringify(d).slice(0, 600) }).slice(0, 1000));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        // 静态壳 /api 404 会以 Failed to load resource 进 console——豁免；其余 console error 记作真错误
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
      } else if (m.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); // confirm() 自动接受，否则 headless 挂起
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

// ═══ fetch 打桩 fixture（模拟后端口径：list {articles:[meta]}；detail {article:{...,contentJson:对象}}；
// 非公开/不存在一律 404。ART-CLOUD-1 的 contentJson 4 卡：c3 右越界（col38+span12>40）、
// c4 下越界（row98+span8>100）→ C 场景格裁剪实证；格=40 列×100 行×cellSize20(gap2)=880×2200）
const FIXTURE_CONTENT = {
  v: 9,
  title: 'Cloud Constitution',
  tags: ['宪法', '官方'], // v10.28.37.0 查看镜像：标签条 2 chip
  cards: [
    { id: 'c1', type: 'content', label: 'Constitution', col: 2, row: 2, colSpan: 10, rowSpan: 6,
      content: '<p><b>Cloud Constitution</b> — fixture body text for the article viewer battery.</p>', bgAlpha: 0, baseFontSize: 14 },
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
const FIXTURE_LIST = { articles: [
  { id: 'ART-CLOUD-1', title: 'Cloud Constitution', status: 'published', authorId: 'USR-000042', createdAt: '2026-09-14T10:00:00.000Z', updatedAt: '2026-09-14T10:00:00.000Z' },
  { id: 'ART-PENDING-1', title: 'Draft Act', status: 'pending', authorId: 'USR-000042', createdAt: '2026-09-13T08:30:00.000Z', updatedAt: '2026-09-13T08:30:00.000Z' }
] };
// v0.2.53.1 时序修正：stub 响应改为 setTimeout(0) 宏任务解析（生产对齐）。
// 旧写 Promise.resolve 即时解析 → microtask 在页面两个 <script> 块之间排空，
// 而 renderArticleActions/fcvaToggle（v10.28.36.1）定义在第二个块——回调先跑即幽灵
// ReferenceError（探针实证 fluidcanvas-editor.html:14494）。真实网络 fetch 必跨 task
// 边界（整页解析完后才 resolve），setTimeout(0) 忠实复刻生产时序。
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
  '    return stubResponse(JSON.stringify({ error: "NOT_FOUND" }), 404);' +
  '   }' +
  '   return stubResponse(JSON.stringify(' + JSON.stringify(FIXTURE_LIST) + '), 200);' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';

(async () => {
  // ═══ F0 静态检查 ═══
  const main = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas.html'), 'utf8');
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  const editor = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  ok('F0-1 版本双线 v0.2.58.0 / v10.28.39.1（changelog rev 00276-nnx）+ 文章查看器注释块 + 直接发布注释块',
    sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.58.0';") !== -1 &&
    sconf.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.39.1';") !== -1 &&
    sconf.indexOf('00276-nnx') !== -1 &&
    sconf.indexOf('文章查看器') !== -1 && sconf.indexOf('提交审核') !== -1);
  ok('F0-2 编辑器查看模式在场（CSS + isArticleView + initArticleView + fcViewScaler + 门禁跳过）',
    editor.indexOf('body.fc-viewmode') !== -1 && editor.indexOf('id="fcViewScaler"') === -1 && editor.indexOf("#fcViewScaler") !== -1 &&
    editor.indexOf('function isArticleView') !== -1 && editor.indexOf('function initArticleView') !== -1 &&
    editor.indexOf('function enterViewLayout') !== -1 && editor.indexOf("!/[?&]article=/.test(window.location.search)") !== -1);
  ok('F0-3 编辑器五守卫在场（saveDraft/putCloudDraft/syncCloudDraft/keydown/refit resize 全挡 viewmode）',
    (editor.match(/contains\('fc-viewmode'\)\) return;/g) || []).length >= 5);
  ok('F0-4 列表接云端在场（View 委托分支 + cloudArticles + loadCloudArticles + api.js 动态注入 + demo store）',
    main.indexOf(".art-action-btn[title=\"View\"]") !== -1 && main.indexOf('var cloudArticles') !== -1 &&
    main.indexOf('function loadCloudArticles') !== -1 && main.indexOf("s.src = '../assets/js/api.js'") !== -1 &&
    main.indexOf('slati_demo_article_content') !== -1);
  ok('F0-5 ART-001 样例 contentJson 在场（正文卡 + flag + text，标题一致）',
    main.indexOf('articles[0].contentJson') !== -1 && main.indexOf('The Founding Charter') !== -1 &&
    main.indexOf("type: 'content'") !== -1 && main.indexOf("type: 'flag'") !== -1 && main.indexOf("type: 'text'") !== -1);
  ok('F0-6 发布即公开在场（badge-success Published + 已发布 toast + 占位文案无「审核中」）',
    editor.indexOf("headerStatus.className = 'badge badge-success'") !== -1 &&
    editor.indexOf("showToast('已发布')") !== -1 &&
    editor.indexOf('可能仍在审核中') === -1 && editor.indexOf('已提交审核') === -1);

  // ═══ 浏览器场景（登录态 Chrome #1）═══
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }

  const spawnChrome = (port, profile) => spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile, 'about:blank'
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

  let chrome = spawnChrome(CDP_PORT, USER_DATA);
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

    // ── A 列表云端合并 17 行（15 种子 + 2 云端）+ View 按钮接线导航 ──
    await nav(BASE + '/pages/fluidcanvas.html?view=articles', "document.querySelectorAll('#artList .art-row').length === 17", 'A articles 17 行');
    ok('A1 17 行（15 种子+2 云端）', await cdp.evalJs("document.querySelectorAll('#artList .art-row').length") === 17);
    ok('A2 云端行置顶（首行 ART-CLOUD-1）', await cdp.evalJs("document.querySelector('#artList .art-row').dataset.id") === 'ART-CLOUD-1');
    ok('A3 云端行与种子行均有删除钮（v0.2.55.1 起云端行可删）',
      await cdp.evalJs("document.querySelector('#artList .art-row[data-id=\"ART-CLOUD-1\"] .art-action-btn.danger')") !== null &&
      await cdp.evalJs("document.querySelector('#artList .art-row[data-id=\"ART-001\"] .art-action-btn.danger')") !== null);
    ok('A4 pending 云端行徽章 In Review', (await cdp.evalJs("document.querySelector('#artList .art-row[data-id=\"ART-PENDING-1\"] .art-badge').className")).indexOf('review') !== -1);
    // v0.2.56.2：View 按钮按云端/本地分流——云端（已发布）→ 平台阅读页（「FC只是一个编辑器」口径）；
    // 本地草稿 → 编辑器 ?article= 网格裁剪预览（v10.28.35.0 保留，编辑器本职）
    await cdp.evalJs("document.querySelector('#artList .art-row[data-id=\"ART-CLOUD-1\"] .art-action-btn[title=\"View\"]').click()");
    await waitFor(cdp, "location.pathname.indexOf('article.html') !== -1", 20000, 'A5 云端 View → 平台阅读页');
    ok('A5 云端 View → 平台阅读页 article.html?id=ART-CLOUD-1', (await cdp.evalJs('location.href')).indexOf('article.html?id=ART-CLOUD-1') !== -1);
    await nav(BASE + '/pages/fluidcanvas.html?view=articles', "document.querySelectorAll('#artList .art-row').length === 17", 'A 列表回来');
    await cdp.evalJs("document.querySelector('#artList .art-row[data-id=\"ART-001\"] .art-action-btn[title=\"View\"]').click()");
    await waitFor(cdp, "location.pathname.indexOf('fluidcanvas-editor.html') !== -1 && location.search.indexOf('article=ART-001') !== -1", 20000, 'A5b 种子行 View → 编辑器');
    ok('A5b 本地草稿 View → 编辑器 ?article=ART-001（预览保留）', (await cdp.evalJs('location.search')).indexOf('article=ART-001') !== -1);

    // ── B 查看器渲染 + 只读硬化 + chrome 全隐 + 哨兵（直载 ?article=ART-CLOUD-1——
    // 云端 id 直链查看仍保留，仅列表 View 按钮分流）──
    // 哨兵草稿：查看器绝不能覆盖本地草稿（B8 断言读取）
    await cdp.evalJs('localStorage.setItem("slati_fluidcanvas_draft", JSON.stringify({ sentinel: true }))');
    await nav(BASE + '/pages/fluidcanvas-editor.html?article=ART-CLOUD-1', "document.body.classList.contains('fc-viewmode') && document.querySelectorAll('.grid-card').length === 4", 'B 查看器直载');
    await sleep(800);
    ok('B1 body.fc-viewmode 在场', await cdp.evalJs("document.body.classList.contains('fc-viewmode')") === true);
    ok('B2 fixture 4 卡全渲染', await cdp.evalJs("document.querySelectorAll('.grid-card').length") === 4);
    ok('B3 chrome 全隐（header/侧栏/状态栏/标题框）',
      await cdp.evalJs("getComputedStyle(document.querySelector('.editor-header')).display") === 'none' &&
      await cdp.evalJs("getComputedStyle(document.querySelector('.asset-panel')).display") === 'none' &&
      await cdp.evalJs("getComputedStyle(document.querySelector('.editor-statusbar')).display") === 'none' &&
      await cdp.evalJs("getComputedStyle(document.getElementById('titleInput')).display") === 'none');
    ok('B4 #fcViewScaler 在场且 overflow hidden', await cdp.evalJs("(function(){ var s = document.getElementById('fcViewScaler'); return !!s && getComputedStyle(s).overflow === 'hidden'; })()") === true);
    ok('B5 完整舞台 contain fit 投影（v10.28.39.0：s=min(availW/2750,availH/stageH) 随查看窗铺满、下限 0.25）',
      await cdp.evalJs("(function(){ var g = document.getElementById('gridCanvas'); var s = document.getElementById('fcViewScaler'); var m = g.style.transform.match(/scale\\(([\\d.]+)\\)/); if (!m) return false; var sv = parseFloat(m[1]); var any = false, maxBY = -1e9; document.querySelectorAll('#gridCanvas .grid-card').forEach(function (e) { if (getComputedStyle(e).display === 'none') return; any = true; var rad = ((parseFloat(e.dataset.rotate || 0) * Math.PI) / 180); var rh = e.offsetWidth * Math.abs(Math.sin(rad)) + e.offsetHeight * Math.abs(Math.cos(rad)); var cy = e.offsetTop + e.offsetHeight / 2; maxBY = Math.max(maxBY, cy + rh / 2); }); var contentRows = any ? Math.max(1, Math.ceil(maxBY / 22)) : 0; var stageW = 2750, stageH = (Math.max(70, contentRows) + 25) * 22; var availW = Math.max(200, s.parentNode.clientWidth - 32); var availH = Math.max(200, s.parentNode.clientHeight - 32); var exp = Math.max(0.25, Math.min(availW / stageW, availH / stageH)); return Math.abs(sv - exp) <= 0.01 && sv >= 0.25 && Math.abs(g.offsetWidth - stageW) <= 3 && Math.abs(g.offsetHeight - stageH) <= 5; })()") === true,
      await cdp.evalJs("(function(){ var g = document.getElementById('gridCanvas'); var s = document.getElementById('fcViewScaler'); return g.style.transform + ' avail=' + (s.parentNode.clientWidth - 32) + 'x' + (s.parentNode.clientHeight - 32) + ' canvas=' + g.offsetWidth + 'x' + g.offsetHeight + ' scaler=' + s.clientWidth + 'x' + s.clientHeight; })()"));
    ok('B6 卡内零交互（pointer-events none）', await cdp.evalJs("getComputedStyle(document.querySelector('.grid-card')).pointerEvents") === 'none');
    ok('B7 contentEditable 关闭 + Tab 序移除', await cdp.evalJs("(function(){ var c = document.querySelector('[contenteditable]'); return !!c && c.getAttribute('contenteditable') === 'false' && c.tabIndex === -1; })()") === true);
    ok('B8 哨兵本地草稿未被覆盖（saveDraft/自动保存守卫实证）', await cdp.evalJs('localStorage.getItem("slati_fluidcanvas_draft")') === '{"sentinel":true}',
      await cdp.evalJs('localStorage.getItem("slati_fluidcanvas_draft")'));
    ok('B9 标题芯片 #fcViewTitle = fixture 标题', await cdp.evalJs("document.getElementById('fcViewTitle') !== null && document.getElementById('fcViewTitle').textContent") === 'Cloud Constitution');

    // ── C 完整格舞台：旧 40×100 格（880×2200）外的越界卡在新 125×131 舞台内完整可见（不再 bbox 裁剪）──
    // 舞台=125×22=2750 横；c3 右缘 1076>880、c4 下缘 2330>2200 → contentRows=ceil(2330/22)=106 → stageRows=131（=2882px）
    ok('C1 旧右越界卡（880 格宽外）在新 125 格舞台内完整可见且不超舞台右缘',
      await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-id=\"c3\"]'); var s = document.getElementById('fcViewScaler'); var g = document.getElementById('gridCanvas'); var m = g.style.transform.match(/scale\\(([\\d.]+)\\)/); var sv = parseFloat(m[1]); var r = c.getBoundingClientRect(); var sr = s.getBoundingClientRect(); var gridRight = sr.left + (parseFloat(g.style.left) + g.offsetWidth) * sv; return r.right <= sr.right + 0.5 && r.right <= gridRight + 1 && r.right > (sr.left + 880 * sv) + 1; })()") === true,
      await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-id=\"c3\"]'); var s = document.getElementById('fcViewScaler'); return 'card.right=' + c.getBoundingClientRect().right.toFixed(1) + ' scaler.right=' + s.getBoundingClientRect().right.toFixed(1); })()"));
    ok('C2 旧下越界卡（2200 格高外）在新 max(70,内容行)+25 舞台内完整可见且不超舞台下缘',
      await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-id=\"c4\"]'); var s = document.getElementById('fcViewScaler'); var g = document.getElementById('gridCanvas'); var m = g.style.transform.match(/scale\\(([\\d.]+)\\)/); var sv = parseFloat(m[1]); var r = c.getBoundingClientRect(); var sr = s.getBoundingClientRect(); var gridBottom = sr.top + (parseFloat(g.style.top) + g.offsetHeight) * sv; return r.bottom <= sr.bottom + 0.5 && r.bottom <= gridBottom + 1 && r.bottom > (sr.top + 2200 * sv) + 1; })()") === true,
      await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-id=\"c4\"]'); var s = document.getElementById('fcViewScaler'); return 'card.bottom=' + c.getBoundingClientRect().bottom.toFixed(1) + ' scaler.bottom=' + s.getBoundingClientRect().bottom.toFixed(1); })()"));
    ok('C3 界内卡完整可见（c1 不越界）', await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-id=\"c1\"]'); var s = document.getElementById('fcViewScaler'); var r = c.getBoundingClientRect(); return r.right <= s.getBoundingClientRect().right + 0.5 && r.bottom <= s.getBoundingClientRect().bottom + 0.5; })()") === true);
    ok('C4 scaler 收成缩放后完整舞台（≈2750×s；canvas 0,0 零平移——不再 bbox 裁剪）', await cdp.evalJs("(function(){ var s = document.getElementById('fcViewScaler'); var g = document.getElementById('gridCanvas'); var m = g.style.transform.match(/scale\\(([\\d.]+)\\)/); var sv = parseFloat(m[1]); return Math.abs(s.clientWidth - 2750 * sv) <= 6 && g.style.left === '0px' && g.style.top === '0px'; })()") === true,
      await cdp.evalJs("(function(){ var s = document.getElementById('fcViewScaler'); var g = document.getElementById('gridCanvas'); return 'scaler.w=' + s.clientWidth + ' canvas.left=' + g.style.left + ' ' + g.style.transform; })()"));

    // ── V v10.28.39.0 查看模式呈现镜像（格子线代码在场透明度 0 + 标签条 + 目录抽屉 label 优先/正文派生）──
    ok('V1 格子线代码层面在场 + 透明度放满（background-image 两笔 linear-gradient + alpha 0、非 none）', await cdp.evalJs("(function(){ var bi = getComputedStyle(document.getElementById('gridCanvas')).backgroundImage; var t = bi.replace(/\\s+/g, ''); return bi !== 'none' && t.indexOf('linear-gradient') !== -1 && t.indexOf('rgba(120,120,120,0)') !== -1; })()") === true,
      await cdp.evalJs("getComputedStyle(document.getElementById('gridCanvas')).backgroundImage"));
    ok('V2 标签条 #fcViewTags 2 chip 宪法/官方', await cdp.evalJs("(function(){ var b = document.getElementById('fcViewTags'); if (!b) return false; var chips = b.querySelectorAll('.fcv-chip'); return chips.length === 2 && chips[0].textContent === '宪法' && chips[1].textContent === '官方'; })()") === true);
    ok('V3 目录抽屉 4 条目（v0.2.57.1 列全部卡：c1 正文 + flag c2 + c3/c4 文字卡）', await cdp.evalJs("(function(){ var d = document.getElementById('fcViewTocDrawer'); return !!d && d.querySelectorAll('.fcv-toc-item').length === 4; })()") === true);
    await cdp.evalJs("document.getElementById('fcViewTocBtn').click()");
    ok('V4 目录钮开抽屉（.open）', await cdp.evalJs("document.getElementById('fcViewTocDrawer').classList.contains('open')") === true);
    await cdp.evalJs("document.getElementById('fcViewTocDrawer').querySelectorAll('.fcv-toc-item')[0].click()");
    ok('V5 点击条目 → 目标卡闪烁 + 抽屉关闭', await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-id=\"c1\"]'); var d = document.getElementById('fcViewTocDrawer'); return c.classList.contains('fcv-toc-flash') && !d.classList.contains('open'); })()") === true);
    ok('V6 投影铺满不滚动：scaler=stage×s 收进 editor-body 内容区（scrollHeight 不超 clientHeight+40）', await cdp.evalJs("(function(){ var b = document.querySelector('.editor-body'); return b.scrollHeight <= b.clientHeight + 40 && b.scrollWidth <= b.clientWidth + 40; })()") === true,
      await cdp.evalJs("(function(){ var b = document.querySelector('.editor-body'); return 'scroll=' + b.scrollWidth + 'x' + b.scrollHeight + ' client=' + b.clientWidth + 'x' + b.clientHeight; })()"));

    // ── D 非公开/404 → 占位状态卡 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html?article=ART-PENDING-1', "document.getElementById('fcViewPlaceholder') !== null", 'D pending 占位');
    ok('D1 pending 文章占位卡在场', await cdp.evalJs("document.getElementById('fcViewPlaceholder') !== null") === true);
    ok('D2 占位态零卡零 scaler', await cdp.evalJs("document.querySelectorAll('.grid-card').length") === 0 &&
      await cdp.evalJs("document.getElementById('fcViewScaler')") === null);
    ok('D3 占位卡含返回列表链接', await cdp.evalJs("(function(){ var a = document.querySelector('#fcViewPlaceholder a'); return !!a && a.getAttribute('href').indexOf('?view=articles') !== -1; })()") === true);
    await nav(BASE + '/pages/fluidcanvas-editor.html?article=ART-MISSING', "document.getElementById('fcViewPlaceholder') !== null", 'D 404 占位');
    ok('D4 404 文章占位卡在场', await cdp.evalJs("document.getElementById('fcViewPlaceholder') !== null") === true);

    // ── F demo store 兜底（ART-001 样例，云端 404 → 本地种子内容）+ reload 幂等 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html?article=ART-001', "document.body.classList.contains('fc-viewmode') && document.querySelectorAll('.grid-card').length === 3", 'F demo 兜底');
    ok('F1 demo 兜底 3 卡渲染（云端 404 → 本地样例）', await cdp.evalJs("document.querySelectorAll('.grid-card').length") === 3);
    ok('F2 标题芯片 = 样例标题', await cdp.evalJs("document.getElementById('fcViewTitle') !== null && document.getElementById('fcViewTitle').textContent") === 'The Founding Charter of Etheria');
    ok('F3 样例 flag 卡图已挂（img 在场）', await cdp.evalJs("document.querySelectorAll('#gridCanvas .grid-card img').length") >= 1);
    await cdp.send('Page.reload', { ignoreCache: true });
    await waitFor(cdp, "document.body.classList.contains('fc-viewmode') && document.querySelectorAll('.grid-card').length === 3", 20000, 'F reload');
    await sleep(500);
    ok('F4 reload 后仍 view mode + 3 卡（幂等）', await cdp.evalJs("document.body.classList.contains('fc-viewmode')") === true &&
      await cdp.evalJs("document.querySelectorAll('.grid-card').length") === 3);
    ok('F5 reload 后哨兵仍未被覆盖', await cdp.evalJs('localStorage.getItem("slati_fluidcanvas_draft")') === '{"sentinel":true}');

    // ── G 全程零 Runtime exception + 零 console error（资源 404 豁免）──
    ok('G1 零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 5).join(' | ') || '干净');
    ok('G2 零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 5).join(' | ') || '干净');
    cdp.close();
    try { chrome.kill(); } catch (e) {}

    // ── E guest 直载查看器（全新 profile 无种子 → 门禁跳过 redirect、文章照常渲染）──
    const chromeG = spawnChrome(CDP_PORT + 1, USER_DATA_GUEST);
    try {
      const cdpG = await connectCdp(CDP_PORT + 1);
      await cdpG.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
      await cdpG.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html?article=ART-CLOUD-1' });
      await waitFor(cdpG, "document.body.classList.contains('fc-viewmode') && document.querySelectorAll('.grid-card').length === 4", 20000, 'E guest viewer');
      await sleep(600);
      ok('E1 guest 未被送回锁屏（pathname 仍 editor）', (await cdpG.evalJs('location.pathname')).indexOf('fluidcanvas-editor.html') !== -1);
      ok('E2 guest 文章照常渲染 4 卡', await cdpG.evalJs("document.querySelectorAll('.grid-card').length") === 4);
      ok('E3 guest 零 Runtime exception', cdpG.errs.length === 0, cdpG.errs.slice(0, 5).join(' | ') || '干净');
      cdpG.close();
    } finally { try { chromeG.kill(); } catch (e) {} }
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    server.close();
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  server.close();
  console.log('');
  console.log(FAIL === 0 ? '🎉 全部通过 ' + PASS + '/' + PASS : '💔 失败 ' + FAIL + ' / 共 ' + (PASS + FAIL));
  process.exit(FAIL === 0 ? 0 : 1);
})();
