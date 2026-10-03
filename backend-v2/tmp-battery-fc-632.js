// tmp-battery-fc-632.js — v0.2.58.26 / FC v10.28.48.2 首页真数据+不透明卡片电池
// 用户「能不能顺便把FC的所有并非用户手动创建的测试信息都去除掉，还有把所有FC的首页卡片从玻璃变成不透明的卡片？」
// 验证：S 静态八面（版本/rev 双占位+58.25 零残留、后端 fc/overview 路由+注册、FC_OVERVIEW 数据层、
//       假数据零残留（SIMULATED_FILES/simulateFilePick/pData/sData/Founding Charter/Alex Rivera/48.2K/
//       slati_demo_article_content）、不透明 CSS 4 规则+搜索胶囊 blur 保留、访客门禁、i18n 30 新键×12、
//       上传链真数据化）/ B 云模式罐头渲染（频道卡/快统/分析/文章/上传五视图）+失败态空态链+不透明
//       实测（光/暗/滤网探针/胶囊玻璃保留）+上传 POST+删除 DELETE/ B1 访客锁屏零 API / G 零异常
// fetch 打桩：fc/overview（localStorage mn-batt-fail-overview='1' → 404 失败旗标）、health、uploads POST、
//       articles DELETE；其余放行原生（静态壳 /api 404 无碍）；__stubCalls 记录全部 /api 调用。
// （house CDP 模式；slati_lang='en' 种语言确定性；confirm 对话框自动接受防挂起）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fc632-batt-' + Date.now());
const USER_DATA_GUEST = path.join(os.tmpdir(), 'mn-cdp-fc632-guest-' + Date.now()); // B1 全新 profile 零种子
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

// ═══ fetch 打桩 fixture（fc/overview 全窗口：Prev 对比 + days 日序列——renderAnalyticsContent 的
// compare-bar 与 makeSparkline 均读取；缺一即 G 段零异常门禁红。28d=默认窗口断言值）
const FIX_OVERVIEW = {
  stats: { followers: 5, following: 1, articles: 2, articlesPublished: 1, articleViews: 1234, articleLikes: 4,
    articleFavorites: 3, articleShares: 2, posts: 3, postViews: 567, postLikes: 2, postFavorites: 1, postShares: 1,
    repostsReceived: 0, media: 1 },
  windows: {
    '7d': { from: '2026-09-26T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z',
      newFollowers: 2, newFollowersPrev: 1, newFollowersPct: 100,
      articlesCreated: 1, articlesCreatedPrev: 0, articlesCreatedPct: null,
      postsCreated: 0, postsCreatedPrev: 1, postsCreatedPct: -100,
      interactionsReceived: 3, interactionsReceivedPrev: 2, interactionsReceivedPct: 50,
      days: [{ date: '2026-09-28', followers: 0, articles: 0, posts: 0 }, { date: '2026-09-30', followers: 1, articles: 1, posts: 0 }, { date: '2026-10-01', followers: 1, articles: 0, posts: 0 }] },
    '28d': { from: '2026-09-05T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z',
      newFollowers: 5, newFollowersPrev: 2, newFollowersPct: 150,
      articlesCreated: 2, articlesCreatedPrev: 1, articlesCreatedPct: 100,
      postsCreated: 1, postsCreatedPrev: 0, postsCreatedPct: null,
      interactionsReceived: 8, interactionsReceivedPrev: 4, interactionsReceivedPct: 100,
      days: [{ date: '2026-09-10', followers: 1, articles: 0, posts: 0 }, { date: '2026-09-18', followers: 2, articles: 1, posts: 0 }, { date: '2026-09-26', followers: 2, articles: 1, posts: 1 }] },
    'month': { from: '2026-09-02T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z',
      newFollowers: 6, newFollowersPrev: 3, newFollowersPct: 100,
      articlesCreated: 2, articlesCreatedPrev: 2, articlesCreatedPct: 0,
      postsCreated: 2, postsCreatedPrev: 1, postsCreatedPct: 100,
      interactionsReceived: 10, interactionsReceivedPrev: 6, interactionsReceivedPct: 66.7,
      days: [{ date: '2026-09-08', followers: 1, articles: 0, posts: 0 }, { date: '2026-09-16', followers: 3, articles: 1, posts: 1 }, { date: '2026-09-24', followers: 2, articles: 1, posts: 1 }] }
  },
  articles: [
    { id: 'ART-FC-1', title: 'Charter of Slatia', status: 'published', createdAt: '2026-09-14T10:00:00.000Z', updatedAt: '2026-09-14T10:00:00.000Z', viewCount: 42, likeCount: 4, favoriteCount: 3, shareCount: 2, wordCount: 120 },
    { id: 'ART-FC-2', title: 'Draft Act', status: 'pending', createdAt: '2026-09-13T08:30:00.000Z', updatedAt: '2026-09-13T08:30:00.000Z', viewCount: 12, likeCount: 0, favoriteCount: 0, shareCount: 0, wordCount: 17 }
  ],
  media: [{ id: 'UPL-FC-1', ext: 'png', mime: 'image/png', bytes: 2048, createdAt: '2026-09-14T10:00:00.000Z' }],
  posts: []
};
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' var stubResponse = function (body, status) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status, headers: { "Content-Type": "application/json" } })); }, 0); }); };' +
  ' var FIX_OVERVIEW = ' + JSON.stringify(FIX_OVERVIEW) + ';' +
  ' try { window.__stubCalls = JSON.parse(localStorage.getItem("mn-batt-api-log") || "[]"); } catch(e) { window.__stubCalls = []; }' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url); var method = (opts && opts.method) || "GET";' +
  '  if (u.indexOf("/api/") !== -1 || u.indexOf("/social/") !== -1 || u.indexOf("/articles/") !== -1 || u.indexOf("/fc/") !== -1 || u.indexOf("/health") !== -1) {' +
  '   window.__stubCalls.push({ u: u, method: method });' +
  '   try { localStorage.setItem("mn-batt-api-log", JSON.stringify(window.__stubCalls)); } catch(e) {}' +
  '  }' +
  '  if (u.indexOf("/health") !== -1) return stubResponse(JSON.stringify({ status: "ok", db: "ok" }), 200);' +
  '  if (u.indexOf("/fc/overview") !== -1) {' +
  '   try { if (localStorage.getItem("mn-batt-fail-overview") === "1") return stubResponse(JSON.stringify({ error: { code: "NOT_FOUND" } }), 404); } catch (e) {}' +
  '   return stubResponse(JSON.stringify(FIX_OVERVIEW), 200);' +
  '  }' +
  '  if (u.indexOf("/social/uploads") !== -1 && method === "POST") {' +
  '   return stubResponse(JSON.stringify({ url: "/uploads/UPL-NEW.png", id: "UPL-NEW", ext: "png" }), 200);' +
  '  }' +
  '  if (u.indexOf("/articles/ART-FC-1") !== -1 && method === "DELETE") {' +
  '   return stubResponse(JSON.stringify({ deleted: true, id: "ART-FC-1" }), 200);' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';

(async () => {
  // ═══ S 静态八面 ═══
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  const fc = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas.html'), 'utf8');
  const fcOv = fs.readFileSync(path.join(__dirname, 'src', 'routes', 'public', 'fc-overview.js'), 'utf8');
  const serverJs = fs.readFileSync(path.join(__dirname, 'src', 'server.js'), 'utf8');
  const fci18n = fs.readFileSync(path.join(DOCS, 'assets', 'i18n', 'fluidcanvas.i18n.js'), 'utf8');
  const cnt = (s, needle) => s.split(needle).length - 1;

  // S1 rev 口径：632 终态烘焙已填真值——00348-t8b/00349-hgc 各 ×2（633 轮改锚）
  ok('S1 site-config 版本双线 58.26/49.0 + rev 真值 ×2 + 58.25/48.1/48.2 赋值零残留',
    cnt(sconf, "window.MN_SITE_VERSION = 'v0.2.58.26';") === 1 &&
    cnt(sconf, "window.FLUIDCANVAS_VERSION = 'v10.28.50.0';") === 1 &&
    cnt(sconf, '00348-t8b') === 2 && cnt(sconf, '00349-hgc') === 2 &&
    cnt(sconf, "window.MN_SITE_VERSION = 'v0.2.58.25';") === 0 &&
    cnt(sconf, "window.FLUIDCANVAS_VERSION = 'v10.28.48.1';") === 0 &&
    cnt(sconf, "window.FLUIDCANVAS_VERSION = 'v10.28.48.2';") === 0,
    '58.26=' + cnt(sconf, "window.MN_SITE_VERSION = 'v0.2.58.26';") + ' 49.0=' + cnt(sconf, "window.FLUIDCANVAS_VERSION = 'v10.28.50.0';") +
    ' 00348-t8b=' + cnt(sconf, '00348-t8b') + ' 00349-hgc=' + cnt(sconf, '00349-hgc') +
    ' 58.25=' + cnt(sconf, "window.MN_SITE_VERSION = 'v0.2.58.25';") +
    ' 48.1=' + cnt(sconf, "window.FLUIDCANVAS_VERSION = 'v10.28.48.1';") +
    ' 48.2=' + cnt(sconf, "window.FLUIDCANVAS_VERSION = 'v10.28.48.2';"));

  ok('S2 后端 fc-overview 路由（GET /api/fc/overview+requireSession+wordCount）+ server.js 挂载（require 解构+调用）',
    cnt(fcOv, "'/api/fc/overview'") >= 1 && cnt(fcOv, 'requireSession') >= 1 && cnt(fcOv, 'wordCount') >= 1 &&
    cnt(serverJs, "require('./routes/public/fc-overview')") === 1 && cnt(serverJs, 'registerFcOverview') === 2,
    'route=' + cnt(fcOv, "'/api/fc/overview'") + ' session=' + cnt(fcOv, 'requireSession') +
    ' wordCount=' + cnt(fcOv, 'wordCount') + ' reg=' + cnt(serverJs, 'registerFcOverview'));

  ok('S3 FC_OVERVIEW 数据层（cloudMode/空态/fcNum/fcCompact/fcOverviewStats/fcOverviewWindow/loadFcOverview/refreshDataViews/boot 调用）',
    cnt(fc, "String(user.id || '').indexOf('USR-') === 0") === 1 &&
    cnt(fc, 'var FC_OVERVIEW = null;') === 1 &&
    cnt(fc, 'function fcNum(') === 1 && cnt(fc, 'function fcCompact(') === 1 &&
    cnt(fc, 'function fcOverviewStats(') === 1 && cnt(fc, 'function fcOverviewWindow(') === 1 &&
    cnt(fc, 'function loadFcOverview(') === 1 && cnt(fc, 'function refreshDataViews()') === 1 &&
    cnt(fc, '  loadFcOverview();') === 1,
    'cloudMode=' + cnt(fc, "String(user.id || '').indexOf('USR-') === 0") + ' FC_OVERVIEW=null=' + cnt(fc, 'var FC_OVERVIEW = null;') +
    ' boot=' + cnt(fc, '  loadFcOverview();'));

  // 可执行体形式（注释提及「已撤」不算残留——写锚前实测：注释 3 处 48.2K/SIMULATED_FILES/simulateFilePick 属删改注记）
  const RESIDUE = ['var SIMULATED_FILES', 'const SIMULATED_FILES', 'window.SIMULATED_FILES',
    'function simulateFilePick', 'var simulateFilePick', 'window.simulateFilePick',
    "'48.2K'", '"48.2K"', 'var pData', 'const pData', 'window.pData',
    'var sData', 'const sData', 'window.sData', 'Founding Charter', 'Alex Rivera',
    'slati_demo_article_content'];
  const residueHits = RESIDUE.filter(r => fc.indexOf(r) !== -1);
  ok('S4 演示假数据零残留（模拟文件选择器/假统计/假名假数/样例文章种子全撤）',
    residueHits.length === 0, residueHits.length ? '命中: ' + residueHits.join(' | ') : '13 标识全零');

  ok('S5 不透明 CSS 四规则（.card var(--sidebar-bg)+.lg-backdrop 滤网全摘+channel !important 渐变+mono 同构）+搜索胶囊 blur(16px) 保留',
    cnt(fc, 'body.fc-page .card:not(.profile-header) { background: var(--sidebar-bg); }') === 1 &&
    cnt(fc, 'body.fc-page .card:not(.profile-header) > .lg-backdrop { filter: none; backdrop-filter: none; }') === 1 &&
    cnt(fc, '#channelOverview, #channelSummary { background: linear-gradient(135deg, rgba(70,72,212,0.04), rgba(129,39,207,0.02)), var(--sidebar-bg) !important; }') === 1 &&
    cnt(fc, "html[data-accent=\"mono\"] #channelOverview, html[data-accent=\"mono\"] #channelSummary") === 1 &&
    cnt(fc, '.search-capsule {') === 1 && cnt(fc, 'backdrop-filter: blur(16px);') >= 1,
    'card=' + cnt(fc, 'body.fc-page .card:not(.profile-header) { background: var(--sidebar-bg); }') +
    ' lg=' + cnt(fc, 'body.fc-page .card:not(.profile-header) > .lg-backdrop') +
    ' blur16=' + cnt(fc, 'backdrop-filter: blur(16px);'));

  ok('S6 访客门禁（head 挂 fc-guest+CSS 互斥+locked-hero 登录引导卡）',
    cnt(fc, "document.documentElement.classList.add('fc-guest')") === 1 &&
    cnt(fc, 'html.fc-guest .studio-main') === 1 &&
    cnt(fc, 'class="fc-locked-hero liquid-glass"') === 1 &&
    cnt(fc, 'data-i18n="fc.landing.loginTitle"') === 1,
    'gate=' + cnt(fc, "document.documentElement.classList.add('fc-guest')") +
    ' hero=' + cnt(fc, 'class="fc-locked-hero liquid-glass"'));

  // 58.26 新增 30 键 ×12 语（comm -13 vs f0e71a7 实测）
  const NEW_KEYS = ['fc.analytics.date', 'fc.analytics.interactions', 'fc.analytics.newArticles',
    'fc.analytics.newFollowers', 'fc.analytics.newPosts', 'fc.analytics.noData', 'fc.analytics.noDataHint',
    'fc.analytics.windowText', 'fc.articles.thisWeek', 'fc.articles.toastPublishInEditor',
    'fc.landing.changeAvatar', 'fc.landing.emptyArticles', 'fc.landing.emptyArticlesHint',
    'fc.landing.emptyMedia', 'fc.landing.emptyMediaHint', 'fc.landing.myStudio', 'fc.landing.recentMedia',
    'fc.landing.untitled', 'fc.metrics.size', 'fc.toast.avatarFailed', 'fc.toast.avatarUpdated',
    'fc.toast.gifLocked', 'fc.toast.imgOnly', 'fc.upload.emptyHint', 'fc.upload.emptyTitle',
    'fc.upload.needLogin', 'fc.upload.statusUploaded', 'fc.upload.toastNoFile', 'fc.upload.toastUploadFail',
    'fc.upload.toastUploaded'];
  const badKeys = NEW_KEYS.filter(k => cnt(fci18n, '"' + k + '"') !== 12);
  ok('S7 i18n 30 新键 ×12 语（comm -13 实测清单）', badKeys.length === 0,
    badKeys.length ? '异常键: ' + badKeys.map(k => k + '=' + cnt(fci18n, '"' + k + '"')).join(' | ') : '30×12 全齐');

  ok('S8 上传链真数据化（POST /social/uploads+loadFcOverview(true)×2+真 file input+needLogin 门）',
    cnt(fc, "'/social/uploads?ext=.' + encodeURIComponent(ext)") === 1 &&
    cnt(fc, 'loadFcOverview(true)') === 2 &&
    cnt(fc, 'fileInput.type = \'file\';') === 1 &&
    cnt(fc, 'zone.addEventListener(\'click\', function() { fileInput.click(); })') === 1 &&
    cnt(fc, "FT('fc.upload.needLogin')") === 1,
    'post=' + cnt(fc, "'/social/uploads?ext=.' + encodeURIComponent(ext)") +
    ' refresh=' + cnt(fc, 'loadFcOverview(true)') + ' input=' + cnt(fc, 'fileInput.type = \'file\';'));

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

  const fcCalls = (cdp) => cdp.evalJs('window.__stubCalls.filter(function(c){return c.u.indexOf("/fc/overview")!==-1;}).length');
  const artCalls = (cdp) => cdp.evalJs('window.__stubCalls.filter(function(c){return c.u.indexOf("/articles")!==-1;}).length');

  let chrome = spawnChrome(CDP_PORT, USER_DATA);
  try {
    const cdp = await connectCdp(CDP_PORT);
    // slati_lang='en'：i18n 确定性（订阅/徽章/空态串全走 en 字典）
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_lang", "en");}catch(e){}'
    });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", \'{"loggedIn":true}\');}catch(e){}'
    });
    // cloudMode=isLoggedIn()&&USR- 前缀——单编码 session（storage.js 单次 JSON.parse）
    // + fluidcanvas.html 专属 slati_user 种子（编辑器页路径不含 'fluidcanvas.html' 子串，天然豁免）
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{(function(){ if (location.pathname.indexOf("fluidcanvas.html") !== -1) { localStorage.setItem("slati_user", JSON.stringify({ id: "USR-000001", displayName: "Batt Tester", citizenId: "CIT-000001", avatarUrl: null })); } })();}catch(e){}'
    });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };
    const url = BASE + '/pages/fluidcanvas.html';

    // ── B2 仪表盘罐头渲染（频道卡+快统四卡；恰 1 次 fc/overview 零 articles 调用）──
    await nav(url, 'document.getElementById("channelOverview") && document.getElementById("channelOverview").textContent.indexOf("1.8K") !== -1', 'B2 频道卡渲染');
    ok('B2a 频道卡真聚合（Article 2 · Media 1 / 1.8K / interactions 13；en 字典单数口径）',
      await cdp.evalJs('document.getElementById("channelOverview").textContent.indexOf("Article 2") !== -1') === true &&
      await cdp.evalJs('document.getElementById("channelOverview").textContent.indexOf("Media 1") !== -1') === true &&
      await cdp.evalJs('document.getElementById("channelOverview").textContent.indexOf("1.8K") !== -1') === true &&
      await cdp.evalJs('document.getElementById("channelOverview").textContent.indexOf("13") !== -1') === true,
      await cdp.evalJs('document.getElementById("channelOverview").textContent'));
    ok('B2b 快统四卡精确值 [1.8K, 4, 3, 5]（浏览和/收藏和/分享和/粉丝真聚合）',
      JSON.stringify(await cdp.evalJs('Array.prototype.map.call(document.querySelectorAll("#quickStats .metric-value"), function(e){return e.textContent;})')) ===
      JSON.stringify(['1.8K', '4', '3', '5']),
      JSON.stringify(await cdp.evalJs('Array.prototype.map.call(document.querySelectorAll("#quickStats .metric-value"), function(e){return e.textContent;})')));
    ok('B2c 恰 1 次 fc/overview + 零 articles 调用',
      await fcCalls(cdp) === 1 && await artCalls(cdp) === 0,
      'fc=' + await fcCalls(cdp) + ' articles=' + await artCalls(cdp));

    // ── B2d 分析视图（28d 默认窗口：4 卡+4 对比条+3 迷你趋势+窗口区间）──
    await nav(url + '?view=analytics', 'document.getElementById("overviewCards").querySelectorAll(".metric-card").length === 4', 'B2d 分析视图');
    ok('B2d 分析四卡精确值 [5, 2, 1, 8]（28d 窗口）+ 4 对比条 + 3 迷你趋势 + 区间 2026-09-05 → 2026-10-02',
      JSON.stringify(await cdp.evalJs('Array.prototype.map.call(document.querySelectorAll("#overviewCards .metric-value"), function(e){return e.textContent;})')) ===
      JSON.stringify(['5', '2', '1', '8']) &&
      await cdp.evalJs('document.querySelectorAll("#channelSummary .compare-bar").length === 4') === true &&
      await cdp.evalJs('document.querySelectorAll("#channelSummary .sparkline").length === 3') === true &&
      await cdp.evalJs('document.getElementById("channelSummary").textContent.indexOf("2026-09-05") !== -1') === true &&
      await cdp.evalJs('document.getElementById("channelSummary").textContent.indexOf("2026-10-02") !== -1') === true,
      JSON.stringify(await cdp.evalJs('Array.prototype.map.call(document.querySelectorAll("#overviewCards .metric-value"), function(e){return e.textContent;})')));
    ok('B2e 分析视图 fc 计数 =2', await fcCalls(cdp) === 2, 'fc=' + await fcCalls(cdp));

    // ── B2f 文章视图（FC_OVERVIEW.articles 驱动：2 行+徽章分流+删除/编辑/查看三钮）──
    await nav(url + '?view=articles', 'document.querySelectorAll("#artList .art-row").length === 2', 'B2f 文章视图');
    ok('B2f 文章列表 2 行全云端（published/In Review 徽章+三钮+零演示 ID）',
      JSON.stringify(await cdp.evalJs('Array.prototype.map.call(document.querySelectorAll("#artList .art-row"), function(r){return r.dataset.id;})')) ===
      JSON.stringify(['ART-FC-1', 'ART-FC-2']) &&
      await cdp.evalJs('document.querySelector(\'#artList .art-row[data-id="ART-FC-1"] .art-badge\').textContent.indexOf("Published") !== -1') === true &&
      await cdp.evalJs('document.querySelector(\'#artList .art-row[data-id="ART-FC-2"] .art-badge\').textContent.indexOf("In Review") !== -1') === true &&
      await cdp.evalJs('document.querySelector(\'#artList .art-row[data-id="ART-FC-1"] .art-action-btn.danger\') !== null') === true &&
      await cdp.evalJs('document.querySelector(\'#artList .art-row[data-id="ART-FC-1"] .art-action-btn[title="Edit"]\') !== null') === true &&
      await cdp.evalJs('document.querySelector(\'#artList .art-row[data-id="ART-FC-1"] .art-action-btn[title="View"]\') !== null') === true &&
      await cdp.evalJs('document.querySelector(\'#artList .art-row[data-id="ART-001"]\') === null') === true,
      JSON.stringify(await cdp.evalJs('Array.prototype.map.call(document.querySelectorAll("#artList .art-row"), function(r){return r.dataset.id;})')));

    // ── B2g 上传视图（recentList 真媒体列表）──
    await nav(url + '?view=upload', 'document.getElementById("recentList").textContent.indexOf("UPL-FC-1.png") !== -1', 'B2g 上传视图');
    ok('B2g 最近上传=FC_OVERVIEW.media（UPL-FC-1.png 恰 1 行）',
      await cdp.evalJs('document.querySelectorAll("#recentList .recent-item").length === 1') === true &&
      await cdp.evalJs('document.getElementById("recentList").textContent.indexOf("UPL-FC-1.png") !== -1') === true);
    ok('B2h 上传视图 fc 计数 =4', await fcCalls(cdp) === 4, 'fc=' + await fcCalls(cdp));

    // ── B3 失败态（404 → FC_OVERVIEW=null → 全 — / 空态卡，绝不回退假数据）──
    await cdp.evalJs('localStorage.setItem("mn-batt-fail-overview", "1"); true');
    await nav(url, 'document.getElementById("quickStats").textContent.indexOf("—") !== -1', 'B3 失败态仪表盘');
    ok('B3a 失败态仪表盘（快统全 — + 频道卡 — + 内容表空态）',
      JSON.stringify(await cdp.evalJs('Array.prototype.map.call(document.querySelectorAll("#quickStats .metric-value"), function(e){return e.textContent;})')) ===
      JSON.stringify(['—', '—', '—', '—']) &&
      await cdp.evalJs('document.getElementById("channelOverview").textContent.indexOf("—") !== -1') === true &&
      await cdp.evalJs('document.getElementById("slideTrack").querySelector(".cl-empty") !== null') === true,
      JSON.stringify(await cdp.evalJs('Array.prototype.map.call(document.querySelectorAll("#quickStats .metric-value"), function(e){return e.textContent;})')));
    await nav(url + '?view=analytics', 'document.getElementById("overviewCards").querySelectorAll(".metric-card").length === 1', 'B3 失败态分析');
    ok('B3b 失败态分析（noData 卡 + channelSummary 全空）',
      await cdp.evalJs('document.getElementById("overviewCards").textContent.indexOf("No analytics data yet") !== -1') === true &&
      await cdp.evalJs('document.getElementById("channelSummary").innerHTML === ""') === true);
    await nav(url + '?view=articles', 'document.querySelector("#artList .art-empty") !== null', 'B3 失败态文章');
    ok('B3c 失败态文章（art-empty 空态）', await cdp.evalJs('document.querySelector("#artList .art-empty") !== null') === true);
    await cdp.evalJs('localStorage.removeItem("mn-batt-fail-overview"); true');

    // ── B4 不透明实测（清旗标重载；光 0.95/暗 rgb(26,26,46)/滤网全摘/搜索胶囊玻璃保留）──
    await nav(url, 'document.getElementById("channelOverview").textContent.indexOf("1.8K") !== -1', 'B4 不透明重载');
    const bg = (sel) => cdp.evalJs('getComputedStyle(document.querySelector(' + JSON.stringify(sel) + ')).backgroundColor');
    ok('B4a 光主题频道卡不透明 rgb 0.95', await bg('#channelOverview') === 'rgba(255, 255, 255, 0.95)', await bg('#channelOverview'));
    ok('B4b 光主题快统卡同不透明', await bg('#quickStats .metric-card') === 'rgba(255, 255, 255, 0.95)', await bg('#quickStats .metric-card'));
    ok('B4c 玻璃浮面探针（.card>.lg-backdrop 滤网全摘）',
      JSON.stringify(await cdp.evalJs('(function(){ var c=document.createElement("div"); c.className="card"; var b=document.createElement("div"); b.className="lg-backdrop"; c.appendChild(b); document.body.appendChild(c); var cs=getComputedStyle(b); var r=[cs.filter, cs.backdropFilter]; c.remove(); return r; })()')) ===
      JSON.stringify(['none', 'none']),
      JSON.stringify(await cdp.evalJs('(function(){ var c=document.createElement("div"); c.className="card"; var b=document.createElement("div"); b.className="lg-backdrop"; c.appendChild(b); document.body.appendChild(c); var cs=getComputedStyle(b); var r=[cs.filter, cs.backdropFilter]; c.remove(); return r; })()')));
    ok('B4d 搜索胶囊玻璃保留（blur(16px) 仍生效；计算样式对隐藏元素同样可用）',
      await cdp.evalJs('getComputedStyle(document.querySelector(".search-capsule")).backdropFilter').then(v => v.indexOf('blur(16px)') !== -1) === true,
      await cdp.evalJs('getComputedStyle(document.querySelector(".search-capsule")).backdropFilter'));
    await cdp.evalJs('document.documentElement.setAttribute("data-theme", "dark"); true');
    await sleep(400);
    ok('B4e 暗主题频道卡不透明 rgb(26, 26, 46)', await bg('#channelOverview') === 'rgb(26, 26, 46)', await bg('#channelOverview'));
    await cdp.evalJs('document.documentElement.setAttribute("data-theme", "light"); true');
    await sleep(400);

    // ── B5 上传链（drop 真文件→选目标→发布→POST /social/uploads+刷新 FC_OVERVIEW）──
    await nav(url + '?view=upload', 'document.getElementById("uploadZone").offsetParent !== null', 'B5 上传视图');
    await cdp.evalJs('(function(){ var dt=new DataTransfer(); dt.items.add(new File(["batt"], "batt-upload.png", {type:"image/png"})); var ev=new Event("drop", {bubbles:true, cancelable:true}); Object.defineProperty(ev, "dataTransfer", {value:dt}); document.getElementById("uploadZone").dispatchEvent(ev); return true; })()');
    await waitFor(cdp, 'document.getElementById("fileInfoName").textContent === "batt-upload.png"', 10000, 'B5 文件信息条');
    ok('B5a drop 真文件→信息条就绪', await cdp.evalJs('document.getElementById("fileInfoName").textContent') === 'batt-upload.png');
    await cdp.evalJs('document.querySelector("#targetGrid .target-card").click(); true');
    await waitFor(cdp, 'document.getElementById("publishBtn").disabled === false', 10000, 'B5 发布钮启用');
    await cdp.evalJs('document.getElementById("publishBtn").click(); true');
    await waitFor(cdp, 'window.__stubCalls.filter(function(c){return c.u.indexOf("/social/uploads")!==-1 && c.method==="POST";}).length === 1', 15000, 'B5 上传 POST');
    await waitFor(cdp, 'document.getElementById("publishBtn").disabled === true', 10000, 'B5 发布完成复位');
    ok('B5b POST /social/uploads?ext=.png 恰 1 + 发布后复位 + fc/overview 刷新（9→10）',
      await cdp.evalJs('window.__stubCalls.some(function(c){return c.u.indexOf("/social/uploads")!==-1 && c.method==="POST" && c.u.indexOf("ext=.png")!==-1;})') === true &&
      await fcCalls(cdp) === 10,
      'fc=' + await fcCalls(cdp));

    // ── B6 删除文章（confirm 自动接受→DELETE→本地过滤重渲染，零重拉）──
    await nav(url + '?view=articles', 'document.querySelectorAll("#artList .art-row").length === 2', 'B6 文章视图');
    await cdp.evalJs('document.querySelector(\'#artList .art-row[data-id="ART-FC-1"] .art-action-btn.danger\').click(); true');
    await waitFor(cdp, 'document.querySelectorAll("#artList .art-row").length === 1', 10000, 'B6 行移除');
    ok('B6 DELETE /articles/ART-FC-1 + 行移除 + ART-FC-2 幸存 + 零重拉（fc 仍 11）',
      await cdp.evalJs('window.__stubCalls.some(function(c){return c.u.indexOf("/articles/ART-FC-1")!==-1 && c.method==="DELETE";})') === true &&
      await cdp.evalJs('document.querySelector(\'#artList .art-row[data-id="ART-FC-1"]\') === null') === true &&
      await cdp.evalJs('document.querySelector(\'#artList .art-row[data-id="ART-FC-2"]\') !== null') === true &&
      await fcCalls(cdp) === 11,
      'fc=' + await fcCalls(cdp));

    // ── B7 DOM 假数据零残留（渲染面；body.textContent 会含内联脚本注释——克隆后剥 script/style 再查）──
    ok('B7 渲染面零残留（Founding Charter/Alex Rivera/48.2K/ART-001 全无）',
      await cdp.evalJs('(function(){ var c=document.body.cloneNode(true); var s=c.querySelectorAll("script,style,link,template"); for (var i=0;i<s.length;i++) s[i].remove(); var t=c.textContent; return t.indexOf("Founding Charter")===-1 && t.indexOf("Alex Rivera")===-1 && t.indexOf("48.2K")===-1; })()') === true &&
      await cdp.evalJs('document.querySelectorAll(\'[data-id="ART-001"]\').length === 0') === true);

    // ── G 零异常 ──
    ok('G 零 Runtime exception + 零 console error（资源 404 豁免）',
      cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      (cdp.errs.length ? 'errs: ' + cdp.errs[0] : '') + (cdp.consoleErrs.length ? ' console: ' + cdp.consoleErrs[0] : ''));
    cdp.close(); chrome.kill();
  } catch (e) {
    console.log('  ❌ 登录态场景异常: ' + e.message);
    FAIL++;
    try { chrome.kill(); } catch (e2) {}
  }

  // ── B1 访客锁屏（零种子全新 profile；零 API 调用）──
  const chromeG = spawnChrome(CDP_PORT + 1, USER_DATA_GUEST);
  try {
    const cdpG = await connectCdp(CDP_PORT + 1);
    await cdpG.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_lang", "en");}catch(e){}'
    });
    await cdpG.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    await cdpG.send('Page.navigate', { url: BASE + '/pages/fluidcanvas.html' });
    await waitFor(cdpG, 'document.documentElement.classList.contains("fc-guest")', 20000, 'B1 访客挂类');
    await sleep(700);
    ok('B1 访客锁屏（locked-hero flex + studio-main/accountBar 隐 + 零 /api 调用）',
      await cdpG.evalJs('getComputedStyle(document.querySelector(".fc-locked-hero")).display === "flex"') === true &&
      await cdpG.evalJs('getComputedStyle(document.querySelector(".studio-main")).display === "none"') === true &&
      await cdpG.evalJs('getComputedStyle(document.getElementById("accountBar")).display === "none"') === true &&
      await cdpG.evalJs('window.__stubCalls.length') === 0,
      'apiCalls=' + await cdpG.evalJs('window.__stubCalls.length'));
    ok('G1 访客零 Runtime exception + 零 console error',
      cdpG.errs.length === 0 && cdpG.consoleErrs.length === 0,
      (cdpG.errs.length ? 'errs: ' + cdpG.errs[0] : '') + (cdpG.consoleErrs.length ? ' console: ' + cdpG.consoleErrs[0] : ''));
    cdpG.close(); chromeG.kill();
  } catch (e) {
    console.log('  ❌ 访客场景异常: ' + e.message);
    FAIL++;
    try { chromeG.kill(); } catch (e2) {}
  }

  server.close();
  // 总结行条件输出（FAIL>0 才印——舰队 runner 💔 计数口径：绿电池不得含 💔 字样）
  console.log(FAIL > 0 ? ('  PASS ' + PASS + ' / 💔 FAIL ' + FAIL) : ('🎉 全部通过 ' + PASS + '/' + PASS));
  process.exit(FAIL > 0 ? 1 : 0);
})().catch(e => { console.error('电池崩: ' + e.stack); process.exit(1); });
