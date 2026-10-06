// tmp-battery-notif-home.js — v0.2.52.1 通知铃铛聚合 + 文章点赞/收藏电池
// 用户「那个铃铛能不能是在Home的时候会显示所有除了公告以外的信息例如谁点赞/收藏了你的帖子，谁点赞/收藏了
// 你的文章，谁关注了你；只有在你进入特定页面时才筛选」
// 断言面：F0 双版本 → F1 首页铃铛/灵动岛 → F2 messages 零改动在位 → F3 FC 文章操作条 → F4 后端 → F5 零迁移
//        → B1 访客开窗「登录后查看通知」→ B2 登录态后端不可达「暂无通知」→ B3 fetch 桩 5 条目/红点 3/同意 → B4 Escape → B5 外点 → Z 零错误
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-notif-home-batt-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};

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
        this.errs.push(JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
      } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        this.errs.push(JSON.stringify({ text: m.params.entry.text, url: m.params.entry.url || '' }).slice(0, 200));
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
    await sleep(120);
  }
  throw new Error('waitFor 超时: ' + label);
}

// B3 fixture：5 条通知（createdAt 阶梯固定 ISO 字符串——与 lastSeen 全为构建时定值，墙钟漂移零影响）
const NOW = Date.now();
const iso = (m) => new Date(NOW - m * 60000).toISOString();
const FIXTURE_NOTIFS = { notifications: [
  { type: 'friend_request', id: 'FR-000001', targetId: 'USR-000777', actor: { id: 'USR-000777', displayName: 'Nova Prime', avatarUrl: null, citizenId: 'USR-000777' }, createdAt: iso(1) },
  { type: 'follow', id: null, targetId: 'USR-000042', actor: { id: 'USR-000042', displayName: 'Kaito Mori', avatarUrl: null, citizenId: 'USR-000042' }, createdAt: iso(2) },
  { type: 'post_comment', id: 'CMT-000123', targetId: 'PST-000001', actor: { id: 'USR-000055', displayName: 'Luna Sky', avatarUrl: null, citizenId: 'USR-000055' }, createdAt: iso(3) },
  { type: 'article_like', id: null, targetId: 'ART-000001', actor: { id: 'USR-000088', displayName: 'Mira Chen', avatarUrl: null, citizenId: 'USR-000088' }, createdAt: iso(4) },
  { type: 'post_favorite', id: null, targetId: 'PST-000002', actor: { id: 'USR-000099', displayName: 'Theo Park', avatarUrl: null, citizenId: 'USR-000099' }, createdAt: iso(5) }
] };
const SEEN_ISO = iso(3.5); // 3 条（1/2/3 分钟前）未读 → 红点 3
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  if (u.indexOf("/api/health") !== -1) {' +
  '   return Promise.resolve(new Response(JSON.stringify({ status: "ok", db: "ok", tables: 59 }), { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  if (u.indexOf("/api/notifications") !== -1) {' +
  '   return Promise.resolve(new Response(JSON.stringify(' + JSON.stringify(FIXTURE_NOTIFS) + '), { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  if (u.indexOf("/friend-requests/FR-000001/") !== -1) {' +
  '   return Promise.resolve(new Response(JSON.stringify({ accepted: true }), { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';
const SEED_LOGIN = 'try{localStorage.setItem("slati_user", ' + JSON.stringify(JSON.stringify({ id: 'USR-000123', displayName: 'You', email: 'you@demo.local' })) + ');' +
  'localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, at: new Date().toISOString() })) + ');}catch(e){}';

(async () => {
  // ═══ F 静态 ═══
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  const idx = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
  const msgs = fs.readFileSync(path.join(DOCS, 'pages', 'messages.html'), 'utf8');
  const editor = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  const serverSrc = fs.readFileSync(path.join(ROOT, 'backend-v2', 'src', 'server.js'), 'utf8');
  const socialSrc = fs.readFileSync(path.join(ROOT, 'backend-v2', 'src', 'routes', 'public', 'social.js'), 'utf8');
  const notifSrc = fs.readFileSync(path.join(ROOT, 'backend-v2', 'src', 'routes', 'public', 'notifications.js'), 'utf8');
  const articlesSrc = fs.readFileSync(path.join(ROOT, 'backend-v2', 'src', 'routes', 'public', 'articles.js'), 'utf8');
  const healthTest = fs.readFileSync(path.join(ROOT, 'backend-v2', 'test', 'health.test.js'), 'utf8');
  const count = (s, n) => s.split(n).length - 1;

  console.log('═══ F0 双版本 + changelog ═══');
  ok('F0-1 site-config 双版本 v0.2.54.0 / v10.28.36.1 + changelog 标记',
    count(sconf, "window.MN_SITE_VERSION = 'v0.2.58.28';") === 1 &&
    count(sconf, "window.FLUIDCANVAS_VERSION = 'v10.28.62.0';") === 1 &&
    sconf.indexOf('通知铃铛聚合') !== -1 && sconf.indexOf('文章查看模式点赞/收藏操作条') !== -1,
    'site=' + count(sconf, "window.MN_SITE_VERSION = 'v0.2.58.28';") + ' fc=' + count(sconf, "window.FLUIDCANVAS_VERSION = 'v10.28.62.0';"));

  console.log('═══ F1 index.html 铃铛/灵动岛 ═══');
  ok('F1-1 铃铛按钮+红点徽章（唯一性 + search-capsule position:relative + 徽章在铃铛后）',
    count(idx, 'id="dashBellBtn"') === 1 && count(idx, 'onclick="toggleDashNotifPopup()"') === 1 &&
    count(idx, 'id="dashBellBadge"') === 1 &&
    count(idx, 'class="search-capsule" style="position:relative"') === 1 &&
    idx.indexOf('id="dashBellBtn"') < idx.indexOf('id="dashBellBadge"'),
    'btn=' + count(idx, 'id="dashBellBtn"') + ' badge=' + count(idx, 'id="dashBellBadge"') +
    ' rel=' + count(idx, 'class="search-capsule" style="position:relative"'));
  ok('F1-2 灵动岛弹窗 DOM + api.js 引入',
    count(idx, 'id="dashNotifPopup"') === 1 && count(idx, 'id="dashNotifListView"') === 1 &&
    count(idx, 'id="dashNotifDecisionView"') === 1 && count(idx, 'id="dashNotifTitle"') === 1 &&
    count(idx, 'assets/js/api.js') === 1,
    'pop=' + count(idx, 'id="dashNotifPopup"') + ' api=' + count(idx, 'assets/js/api.js'));
  ok('F1-3 灵动岛动画规则 + 页面专属 CSS 在外（内联块首个 </style> 之前零 dash 规则）',
    count(idx, '@keyframes dashNotifIslandIn') === 1 && count(idx, '#dashNotifPopup.island-open') === 2 &&
    count(idx, '#dashNotifPopup.show-decision') === 2 &&
    count(idx, 'transition: height 0.28s cubic-bezier(0.22, 0.61, 0.36, 1)') === 1 &&
    count(idx, 'transform-origin: top right') === 1 &&
    idx.indexOf('dashNotifIslandIn') > idx.indexOf('</style>'),
    'kf=' + count(idx, '@keyframes dashNotifIslandIn') + ' open=' + count(idx, '#dashNotifPopup.island-open') +
    ' dec=' + count(idx, '#dashNotifPopup.show-decision') +
    ' h=' + count(idx, 'transition: height 0.28s cubic-bezier(0.22, 0.61, 0.36, 1)') +
    ' outside=' + (idx.indexOf('dashNotifIslandIn') > idx.indexOf('</style>')));
  ok('F1-4 聚合通知 JS 骨架（轮询/文案/决定药丸/登录提示/空态）',
    count(idx, 'MN_API.get(\'/notifications\')') === 1 && count(idx, 'setInterval(refreshDashNotifs, 15000)') === 1 &&
    count(idx, '登录后查看通知') === 1 && count(idx, '暂无通知') === 2 &&
    count(idx, '>不同意</button>') === 1 && count(idx, '>同意</button>') === 1 &&
    count(idx, 'function toggleDashNotifPopup') === 1 && count(idx, 'function renderDashNotifPopup') === 1 &&
    count(idx, 'function refreshDashNotifs') === 1 && count(idx, 'function openDashDecision') === 1 &&
    count(idx, 'function acceptDashInvite') === 1 && count(idx, 'function declineDashInvite') === 1 &&
    count(idx, 'function morphDashView') === 1 && count(idx, 'function closeDashNotifPopup') === 1 &&
    count(idx, 'function updateDashBadge') === 1 && count(idx, 'function dashNotifJump') === 1 &&
    count(idx, 'function timeAgo') === 1,
    'get=' + count(idx, 'MN_API.get(\'/notifications\')') + ' poll=' + count(idx, 'setInterval(refreshDashNotifs, 15000)') +
    ' guest=' + count(idx, '登录后查看通知') + ' empty=' + count(idx, '暂无通知'));
  ok('F1-5 跳转分发三类目标（帖子/文章/主页）——v0.2.55.0 文章跳转改阅读页 article.html（4 处：搜索行/最新文章/通知/活动流混入卡 v0.2.56.2）',
    count(idx, "pages/community-post.html?id=") === 1 &&
    count(idx, "pages/article.html?id=") === 4 &&
    count(idx, "pages/community-profile.html?id=") === 1,
    'post=' + count(idx, "pages/community-post.html?id=") + ' art=' + count(idx, "pages/article.html?id=") +
    ' prof=' + count(idx, "pages/community-profile.html?id="));

  console.log('═══ F2 messages.html 零改动在位 ═══');
  ok('F2-1 messages 铃铛/弹窗/好友请求管线原样（特定页面筛选=零改动证）',
    count(msgs, 'id="bellBtn"') === 1 && count(msgs, 'id="notifPopup"') === 1 &&
    count(msgs, '@keyframes notifIslandIn') === 1 &&
    count(msgs, "MN_API.post('/friend-requests', body)") === 1,
    'bell=' + count(msgs, 'id="bellBtn"') + ' pop=' + count(msgs, 'id="notifPopup"') +
    ' frpost=' + count(msgs, "MN_API.post('/friend-requests', body)"));

  console.log('═══ F3 fluidcanvas-editor.html 文章操作条 ═══');
  ok('F3-1 操作条构建+样式+点击管线（fcViewActions/renderArticleActions/fcvaToggle/端点串）',
    count(editor, "bar.id = 'fcViewActions';") === 1 && count(editor, '#fcViewActions {') === 1 &&
    count(editor, 'renderArticleActions(art)') === 2 && // 定义 + initArticleView 调用
    count(editor, 'function fcvaToggle') === 1 &&
    count(editor, "'/social/articles/'") === 1 &&
    count(editor, "window.showToast((window.__fcT('fc.viewer.toastLogin') || '登录后才能%s'") === 1,
    'bar=' + count(editor, "bar.id = 'fcViewActions';") + ' css=' + count(editor, '#fcViewActions {') +
    ' fn=' + count(editor, 'renderArticleActions(art)') + ' ep=' + count(editor, "'/social/articles/'"));
  ok('F3-2 demo 种子/404 路径不建条 + 查看模式守卫/标题保留',
    count(editor, '{ renderArticleDraft(dd); return; }') === 1 &&
    count(editor, 'showArticlePlaceholder(art ? art.title : id, reason);') === 1 &&
    count(editor, "chip.id = 'fcViewTitle';") === 1 &&
    (editor.match(/contains\('fc-viewmode'\)\) return;/g) || []).length >= 5,
    'demo=' + count(editor, '{ renderArticleDraft(dd); return; }') + ' title=' + count(editor, "chip.id = 'fcViewTitle';") +
    ' guards=' + (editor.match(/contains\('fc-viewmode'\)\) return;/g) || []).length);

  console.log('═══ F4 后端 ═══');
  ok('F4-1 server.js 装配 + social.js 文章四端点',
    count(serverSrc, 'registerNotifications') === 2 &&
    count(socialSrc, "'/api/social/articles/:id/like'") === 2 &&
    count(socialSrc, "'/api/social/articles/:id/favorite'") === 2,
    'reg=' + count(serverSrc, 'registerNotifications') + ' like=' + count(socialSrc, "'/api/social/articles/:id/like'") +
    ' fav=' + count(socialSrc, "'/api/social/articles/:id/favorite'"));
  ok('F4-2 notifications.js 八类聚合（每类 push 恰 1 + article target_type 恰 2；v0.2.55.0 加 article_comment）',
    ['post_like', 'post_favorite', 'article_like', 'article_favorite', 'post_comment', 'follow', 'friend_request', 'article_comment']
      .every((t) => count(notifSrc, "push('" + t + "'") === 1) &&
    count(notifSrc, "target_type = 'article'") === 2 &&
    notifSrc.indexOf("require('../auth')") === -1 && notifSrc.indexOf("require('../moderation')") === -1,
    'pushes=' + ['post_like', 'post_favorite', 'article_like', 'article_favorite', 'post_comment', 'follow', 'friend_request', 'article_comment']
      .map((t) => count(notifSrc, "push('" + t + "'")).join('/'));
  ok('F4-3 articles.js 互动字段 + 浏览自增',
    count(articlesSrc, 'likeCount') >= 2 && count(articlesSrc, 'favoritedByMe') >= 2 &&
    count(articlesSrc, 'view_count = view_count + 1') === 1,
    'like=' + count(articlesSrc, 'likeCount') + ' fav=' + count(articlesSrc, 'favoritedByMe'));

  console.log('═══ F5 零迁移 ═══');
  ok('F5-1 health.test.js 钉 66 表 / user_version 33（033 迁移升级；两处钉）',
    count(healthTest, 'data.tables, 66') === 1 &&
    count(healthTest, "user_version', { simple: true }), 33") === 2,
    'tables=' + count(healthTest, 'data.tables, 66') + ' uv=' + count(healthTest, "user_version', { simple: true }), 33"));
  console.log('');

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
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Log.enable'); await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });

    const DASH_READY = "document.querySelector('#slati-sidebar') && document.querySelectorAll('#slati-sidebar .nav-item').length > 3 && document.getElementById('dashBellBtn')";
    const POPUP_OPEN = "document.getElementById('dashNotifPopup') && document.getElementById('dashNotifPopup').style.display === 'flex' && getComputedStyle(document.getElementById('dashNotifPopup')).opacity === '1'";

    // ═══ B1 访客开窗（无 seed：不登录 → 「登录后查看通知」+ 红点隐藏）═══
    console.log('═══ B 浏览器流程 ═══');
    await cdp.send('Page.navigate', { url: BASE + '/index.html' });
    await waitFor(cdp, DASH_READY, 30000, 'B1 dashboard 渲染');
    await cdp.evalJs("document.getElementById('dashBellBtn').click()");
    await waitFor(cdp, POPUP_OPEN, 8000, 'B1 弹窗展开落定');
    const b1 = await cdp.evalJs("(function(){var l=document.getElementById('dashNotifListView');var link=l.querySelector('a');return {txt:l.textContent,linkHref:link?link.getAttribute('href'):null,badge:getComputedStyle(document.getElementById('dashBellBadge')).display,entries:document.querySelectorAll('#dashNotifListView .dash-notif-entry').length};})()");
    ok('B1 访客开窗（登录后查看通知 + 去登录链接 + 红点隐藏 + 零条目）',
      b1.txt.indexOf('登录后查看通知') !== -1 && b1.linkHref === 'pages/signup-and-login.html' &&
      b1.badge === 'none' && b1.entries === 0, JSON.stringify(b1));
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
    ok('B1b Escape 关闭即时生效', await cdp.evalJs("document.getElementById('dashNotifPopup').style.display") === 'none');

    // ═══ B2 登录态但后端不可达（静态服务器 /api/* 恒 404 → 「暂无通知」）═══
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SEED_LOGIN });
    await cdp.send('Page.navigate', { url: BASE + '/index.html' });
    await waitFor(cdp, DASH_READY, 30000, 'B2 dashboard 渲染');
    await cdp.evalJs("document.getElementById('dashBellBtn').click()");
    await waitFor(cdp, POPUP_OPEN, 8000, 'B2 弹窗展开落定');
    const b2 = await cdp.evalJs("(function(){var l=document.getElementById('dashNotifListView');return {txt:l.textContent,badge:getComputedStyle(document.getElementById('dashBellBadge')).display};})()");
    ok('B2 登录态后端不可达（暂无通知 + 无登录提示 + 红点隐藏）',
      b2.txt.indexOf('暂无通知') !== -1 && b2.txt.indexOf('登录后查看通知') === -1 && b2.badge === 'none', JSON.stringify(b2));
    await cdp.evalJs("document.getElementById('dashBellBtn').click()"); // 当前开着 → 关

    // ═══ B3 fetch 桩：5 条 fixture + lastSeen 定值 → 红点 3 → 开窗 → morph 同意 → 4 条 ═══
    await cdp.evalJs("localStorage.setItem('mn_notif_seen_USR-000123', " + JSON.stringify(SEEN_ISO) + ")");
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    await cdp.send('Page.navigate', { url: BASE + '/index.html' });
    await waitFor(cdp, DASH_READY, 30000, 'B3 dashboard 渲染');
    await waitFor(cdp, "document.getElementById('dashBellBadge').style.display === 'block' && document.getElementById('dashBellBadge').textContent === '3'", 10000, 'B3 红点 3');
    const b3badge = await cdp.evalJs("document.getElementById('dashBellBadge').textContent");
    ok('B3-1 未读红点 3（lastSeen 之后 3 条新事件）', b3badge === '3', 'badge=' + b3badge);
    await cdp.evalJs("document.getElementById('dashBellBtn').click()");
    await waitFor(cdp, POPUP_OPEN, 8000, 'B3 弹窗展开落定');
    const b3a = await cdp.evalJs("(function(){var es=document.querySelectorAll('#dashNotifListView .dash-notif-entry');return {n:es.length,first:es.length?es[0].textContent:'',badge:getComputedStyle(document.getElementById('dashBellBadge')).display};})()");
    ok('B3-2 开窗 5 条目（FR 在最前）+ 开窗即读（红点清隐藏）',
      b3a.n === 5 && b3a.first.indexOf('Nova Prime') !== -1 && b3a.first.indexOf('想加你为好友') !== -1 &&
      b3a.badge === 'none', JSON.stringify(b3a));
    await cdp.evalJs("document.querySelector('#dashNotifListView .dash-notif-entry').click()");
    await waitFor(cdp, "getComputedStyle(document.getElementById('dashNotifDecisionView')).opacity === '1' && getComputedStyle(document.getElementById('dashNotifListView')).opacity === '0'", 8000, 'B3 morph 决定视图');
    const b3b = await cdp.evalJs("(function(){var p=document.getElementById('dashNotifPopup');var bs=Array.prototype.map.call(document.querySelectorAll('#dashNotifDecisionView button'),function(b){return b.textContent;});return {name:document.getElementById('dashNotifDecisionName').textContent,id:document.getElementById('dashNotifDecisionId').textContent,btns:bs.join('|'),cls:p.classList.contains('show-decision'),title:document.getElementById('dashNotifTitle').textContent,bh:document.getElementById('dashNotifBody').getBoundingClientRect().height};})()");
    ok('B3-3 点 FR 整窗 morph 决定视图（名字/ID 居中 + 不同意|同意 + show-decision + 标题 + 高度>0）',
      b3b.name === 'Nova Prime' && b3b.id === 'USR-000777' && b3b.btns === '不同意|同意' &&
      b3b.cls && b3b.title === '好友请求' && b3b.bh > 0, JSON.stringify(b3b));
    await cdp.evalJs("(function(){document.querySelectorAll('#dashNotifDecisionView button')[1].click();})()");
    await waitFor(cdp, "getComputedStyle(document.getElementById('dashNotifListView')).opacity === '1' && document.querySelectorAll('#dashNotifListView .dash-notif-entry').length === 4", 8000, 'B3 同意 morph 回列表 4 条');
    const b3c = await cdp.evalJs("(function(){return {n:document.querySelectorAll('#dashNotifListView .dash-notif-entry').length,fr:document.getElementById('dashNotifListView').textContent.indexOf('Nova Prime') !== -1,title:document.getElementById('dashNotifTitle').textContent};})()");
    ok('B3-4 同意（FR 摘除 → 4 条 + 标题回通知）', b3c.n === 4 && !b3c.fr && b3c.title === '通知', JSON.stringify(b3c));

    // ═══ B4 Escape / B5 外点 ═══
    await cdp.evalJs("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
    ok('B4 Escape 关闭即时生效（display none）', await cdp.evalJs("document.getElementById('dashNotifPopup').style.display") === 'none');
    await cdp.evalJs("document.getElementById('dashBellBtn').click()");
    await waitFor(cdp, POPUP_OPEN, 8000, 'B5 弹窗再开');
    await cdp.evalJs("document.body.click()");
    ok('B5 外点关闭即时生效（display none）', await cdp.evalJs("document.getElementById('dashNotifPopup').style.display") === 'none');

    // ═══ Z 控制台零错误 ═══
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|settings-menu|\/api\//i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('Z 控制台零错误（噪声已滤）', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));

    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    fail++;
  }
  try { require('child_process').spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  server.close();
  console.log('\n═══ ' + (fail === 0 ? 'ALL GREEN' : 'FAILED') + ' — ' + pass + '/' + (pass + fail) + ' ═══');
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(fail === 0 ? 0 : 1);
})();
