// tmp-battery-community-profile.js — v0.2.21.0 Community 个人主页 + 关注系统电池（2026-09-07；v0.2.23.0 加卡片背景液体玻璃链；v0.2.23.2 横幅/背景分开；v0.2.23.3 结构重排=横幅预设+卡身纯底色+四周 6px 光环；v0.2.24.0 独立双背景=横幅组改名+卡片背景新组、卡身纯透明+包层背景阔 6px；v0.2.24.1 卡片背景只 2 选项=默认/标准液态玻璃 glass-clear 无色+代码白边环 2px+柔影）
// 用户：「先把用户的个人主页做一下吧？」→ 钦定完整版 Twitter 式主页（头像/名字/简介/加入时间/统计 4 块 + 帖子/转发/点赞/收藏 4 tab）+ 关注系统 + 三入口。
// 本地：静态壳 + document-start fetch 罐头（每次导航新文档生效——MN_API 底层走 fetch，罐头统一从 fetch 层拦；
//   profile/posts 四 tab/follow/点赞/收藏/转发全罐头；唯一真资源 = /uploads/UPL-DEMO01.jpg 1x1 PNG 供瓦片+灯箱）。
// 线上（LIVE_BASE）：只读侧断言（hub 作者锚→profile 渲染/头部/4 tab 走查/404）+ 关注 401 回滚链 + 访客零请求链
//   ——无凭据不真写（localStorage 种子是纯客户端假登录，服务端无 cookie → follow POST 401 → 乐观回滚 + toast「登录已过期」实测）。
// 跑法：node tmp-battery-community-profile.js（LIVE_BASE=<完整站点 URL> 跑线上）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3900 + Math.floor(Math.random() * 500);
const CDP_PORT = 4900 + Math.floor(Math.random() * 500);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-' + Date.now());

// 1x1 真 PNG（媒体瓦片/灯箱用真图，防 404 图片日志污染 0-console-error 断言）
const PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const AVATAR_URI = 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2228%22%20height%3D%2228%22%3E%3Ccircle%20cx%3D%2214%22%20cy%3D%2214%22%20r%3D%2214%22%20fill%3D%22%23464dd4%22%2F%3E%3C%2Fsvg%3E';

// document-start fetch 罐头（只在本地模式挂，线上走真后端）
const DOC_START_SRC = `
(function () {
  // 自己（USR-000101 = 种子账号，isSelf → 编辑资料钮；统计 1/1/1/2/1（v0.2.22.3 +获赞 1）；2 粉丝 · 3 关注；v0.2.23.0 cardBg null=默认；v0.2.24.0 cardPlate null=无背景层）
  var ME = {
    id: 'USR-000101', displayName: '电池用户', avatarUrl: ${JSON.stringify(AVATAR_URI)},
    bio: '电池用户简介', gender: 'Male', citizenId: 'CIT-000101', createdAt: '2026-08-01T00:00:00.000Z',
    isSelf: true, followedByMe: false, followerCount: 2, followingCount: 3,
    cardBg: null, cardPlate: null,
    stats: { postCount: 1, repostCount: 1, likeReceivedCount: 1, likeCount: 2, favoriteCount: 1 }
  };
  // 他人（USR-000202，bio 空 → 兜底文案；Female → 女；零帖 → 空态；关注链目标；v0.2.23.0 cardBg='glass-rose' 公开渲染他人背景；v0.2.24.1 cardPlate='glass-clear' 标准液态玻璃（无色）独立背景层）
  var OTHER = {
    id: 'USR-000202', displayName: '电池他人', avatarUrl: null,
    bio: null, gender: 'Female', citizenId: 'CIT-000202', createdAt: '2026-07-15T00:00:00.000Z',
    isSelf: false, followedByMe: false, followerCount: 0, followingCount: 5,
    cardBg: 'glass-rose', cardPlate: 'glass-clear',
    stats: { postCount: 0, repostCount: 0, likeReceivedCount: 0, likeCount: null, favoriteCount: null }
  };
  var BASE_POST = {
    id: 'PST-000101', authorId: 'USR-000101', authorName: '电池用户', avatarUrl: ${JSON.stringify(AVATAR_URI)},
    content: '主页第一帖', createdAt: '2026-09-06T08:00:00.000Z',
    likeCount: 3, commentCount: 5, likedByMe: false, repostCount: 0, repostedByMe: false,
    viewCount: 12, favoritedByMe: false, media: ['/uploads/UPL-DEMO01.jpg'], repostOfId: null, repostOf: null
  };
  var REPOST = {
    id: 'PST-000102', authorId: 'USR-000101', authorName: '电池用户', avatarUrl: ${JSON.stringify(AVATAR_URI)},
    content: '', createdAt: '2026-09-06T09:00:00.000Z',
    likeCount: 0, commentCount: 0, likedByMe: false, repostCount: 1, repostedByMe: false,
    viewCount: 2, favoritedByMe: false, media: [], repostOfId: 'PST-000101',
    repostOf: { authorName: '电池他人', avatarUrl: null, content: '原帖内容，值得一看', createdAt: '2026-09-05T08:00:00.000Z' }
  };
  var LIKED = {
    id: 'PST-000103', authorId: 'USR-000202', authorName: '电池他人', avatarUrl: null,
    content: '被点赞的帖', createdAt: '2026-09-06T10:00:00.000Z',
    likeCount: 9, commentCount: 0, likedByMe: true, repostCount: 0, repostedByMe: false,
    viewCount: 30, favoritedByMe: false, media: [], repostOfId: null, repostOf: null
  };
  var FAVORITED = {
    id: 'PST-000104', authorId: 'USR-000202', authorName: '电池他人', avatarUrl: null,
    content: '收藏的帖', createdAt: '2026-09-06T11:00:00.000Z',
    likeCount: 1, commentCount: 0, likedByMe: false, repostCount: 0, repostedByMe: false,
    viewCount: 5, favoritedByMe: true, media: [], repostOfId: null, repostOf: null
  };
  var TABS = { posts: [BASE_POST], reposts: [REPOST], likes: [LIKED], favorites: [FAVORITED] };
  window.__fetchCalls = [];
  function res(status, body) {
    return { status: status, ok: status >= 200 && status < 300, headers: { get: function () { return null; } }, json: function () { return Promise.resolve(body); } };
  }
  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf('/api/') !== -1) {
      var method = (opts && opts.method) || 'GET';
      var rawBody = (opts && opts.body != null) ? opts.body : null;
      window.__fetchCalls.push({ url: u, method: method, body: typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody == null ? null : rawBody) });
      var key = method + ' ' + u;
      if (key === 'GET /api/health') return Promise.resolve(res(200, { status: 'ok', version: '2.0.0', tables: 58 }));
      if (key === 'GET /api/social/posts') return Promise.resolve(res(200, { posts: [BASE_POST] }));
      // profile 本体
      if (key === 'GET /api/social/users/USR-000101') return Promise.resolve(res(200, { user: ME }));
      if (key === 'GET /api/social/users/USR-000202') return Promise.resolve(res(200, { user: OTHER }));
      if (u.indexOf('/api/social/users/USR-999999') === 0) return Promise.resolve(res(404, { error: { message: '用户不存在或已注销' } }));
      // 四 tab（罐头直接回当前数组；点赞/收藏 tab 撤销后清空 → 重拉出空态，实测 maybeReloadTab）
      if (u.indexOf('/api/social/users/USR-000101/posts?tab=') === 0) {
        var tab = u.split('tab=')[1];
        return Promise.resolve(res(200, { posts: TABS[tab] || [] }));
      }
      if (u.indexOf('/api/social/users/USR-000202/posts') === 0) return Promise.resolve(res(200, { posts: [] }));
      // follow 开关（OTHER 上操作）
      if (key === 'POST /api/social/users/USR-000202/follow') { OTHER.followedByMe = true; OTHER.followerCount = 1; return Promise.resolve(res(200, { following: true, followerCount: 1 })); }
      if (key === 'DELETE /api/social/users/USR-000202/follow') { OTHER.followedByMe = false; OTHER.followerCount = 0; return Promise.resolve(res(200, { following: false, followerCount: 0 })); }
      // 点赞/收藏/转发（帖子级）
      if (key === 'POST /api/social/posts/PST-000101/like') { BASE_POST.likeCount = 4; BASE_POST.likedByMe = true; return Promise.resolve(res(200, { liked: true, likeCount: 4 })); }
      if (key === 'DELETE /api/social/posts/PST-000101/like') { BASE_POST.likeCount = 3; BASE_POST.likedByMe = false; return Promise.resolve(res(200, { liked: false, likeCount: 3 })); }
      if (key === 'DELETE /api/social/posts/PST-000103/like') { TABS.likes = []; return Promise.resolve(res(200, { liked: false, likeCount: 8 })); }
      if (key === 'DELETE /api/social/posts/PST-000104/favorite') { TABS.favorites = []; return Promise.resolve(res(200, { favorited: false })); }
      if (key === 'POST /api/social/posts/PST-000101/favorite') return Promise.resolve(res(200, { favorited: true }));
      if (key === 'POST /api/social/posts/PST-000101/repost') return Promise.resolve(res(200, { post: { status: 'visible' }, repostCount: 1, moderation: { verdict: 'pass' } }));
      // v0.2.22.0 编辑资料独立弹窗：PATCH /auth/me 罐头（有状态——保存后 ME 变 → loadProfile 重拉即见新头部）
      if (key === 'PATCH /api/auth/me') {
        if (window.__patchFail401) return Promise.resolve(res(401, { error: { code: 'UNAUTHORIZED', message: '未登录' } }));
        var pb = {};
        try { pb = JSON.parse(rawBody || '{}'); } catch (e) {}
        window.__patchedMe = pb;
        if (pb.displayName) ME.displayName = pb.displayName;
        if (pb.avatarUrl) ME.avatarUrl = pb.avatarUrl;
        if (pb.bio !== undefined) ME.bio = pb.bio;
        if (pb.gender) ME.gender = pb.gender;
        // v0.2.23.0 卡片背景（null 显式入 body → 恢复默认）
        if (pb.cardBg !== undefined) ME.cardBg = pb.cardBg;
        // v0.2.24.0 独立卡片背景（null 显式入 body → 无背景层）
        if (pb.cardPlate !== undefined) ME.cardPlate = pb.cardPlate;
        return Promise.resolve(res(200, { user: { id: ME.id, displayName: ME.displayName, avatarUrl: ME.avatarUrl, citizenId: ME.citizenId, bio: ME.bio, gender: ME.gender, createdAt: ME.createdAt } }));
      }
      // 头像直传罐头 → /uploads/UPL-DEMO01.jpg（静态壳已有真图防 404 图片日志）
      if (method === 'POST' && u.indexOf('/api/social/uploads?ext=') === 0) return Promise.resolve(res(200, { url: '/uploads/UPL-DEMO01.jpg' }));
    }
    return realFetch(url, opts);
  };
})();
`;

// ── 静态壳（docs/ 原样；/api 全 404 → demo 模式零请求） ──
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/uploads/UPL-DEMO01.jpg') { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(PIXEL_PNG); return; }
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => {
        if (e2) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b2);
      });
      return;
    }
    if (err) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});

// ── CDP 客户端 ──
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method) {
        const ls = this.listeners.get(m.method);
        if (ls) ls.forEach(fn => fn(m.params));
      }
    };
  }
  send(method, params) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  on(method, fn) { if (!this.listeners.has(method)) this.listeners.set(method, []); this.listeners.get(method).push(fn); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || 'exception'));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('waitFor 超时: ' + label);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const pass = [], fail = [];
function check(name, cond, detail) {
  const line = (cond ? '  ✅ ' : '  ❌ ') + name + (detail ? '（' + detail + '）' : '');
  console.log(line);
  (cond ? pass : fail).push(line);
}
async function nav(t, url) { await t.send('Page.navigate', { url }); await sleep(900); }
async function pressEsc(t) {
  await t.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await t.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await sleep(200);
}
async function seedUser(t) {
  await t.evalJs("localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true, at: new Date().toISOString() }));" +
    "localStorage.setItem('slati_user', JSON.stringify({ id: 'USR-000101', name: '电池用户', avatarUrl: null }));");
}
async function clearUser(t) {
  await t.evalJs("localStorage.removeItem('slati_session'); localStorage.removeItem('slati_user');");
}
async function patchToast(t) {
  await t.evalJs("window.__toasts = []; if (window.MN_Report && window.MN_Report.toast) { var o = MN_Report.toast.bind(MN_Report); MN_Report.toast = function (m, e) { window.__toasts.push(String(m)); return o(m, e); }; }");
}
// 线上无罐头 → 运行时包 fetch 计数（访客零请求断言用）
async function patchFetch(t) {
  await t.evalJs("window.__fetchCalls = []; (function(){ var o = window.fetch.bind(window); window.fetch = function (u, opts) { var s = String(u); if (s.indexOf('/api/') !== -1) window.__fetchCalls.push({ url: s, method: (opts && opts.method) || 'GET' }); return o(u, opts); }; })();");
}
const pathOf = t => t.evalJs('window.location.pathname + window.location.search');

async function main() {
  const LIVE = process.env.LIVE_BASE || '';
  const BASE = LIVE || ('http://127.0.0.1:' + PORT);
  if (!LIVE) server.listen(PORT);
  let chromePath = null;
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {}
    await sleep(250);
  }
  const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' });
  const info = await r.json();
  const t = new CDP(info.webSocketDebuggerUrl);
  await t.connect();
  await t.send('Page.enable');
  await t.send('Runtime.enable');
  if (!LIVE) await t.send('Page.addScriptToEvaluateOnNewDocument', { source: DOC_START_SRC });
  const errs = [];
  t.on('Runtime.exceptionThrown', p => {
    const d = (p.exceptionDetails.exception && p.exceptionDetails.exception.description) || 'exc';
    if (d.indexOf('data:') === -1) errs.push(d);
  });
  t.on('Log.entryAdded', p => {
    if (p.entry.level === 'error' && p.entry.url && p.entry.url.indexOf('/api/') === -1 &&
        p.entry.url.indexOf('data:') === -1 && p.entry.url.indexOf('favicon') === -1) errs.push(p.entry.text);
  });
  await t.send('Log.enable');

  async function bootHub() {
    await nav(t, BASE + '/pages/community-hub.html');
    await seedUser(t);
    await t.send('Page.reload');
    await sleep(800);
    await waitFor(t, "document.querySelectorAll('[data-cloud-id]').length >= 1", LIVE ? 30000 : 20000, 'hub 云卡渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
  }

  await bootHub();
  if (LIVE) await runLive(t);
  else await runLocal(t);

  console.log('\n' + pass.length + ' ✅ / ' + fail.length + ' ❌');
  t.close();
  chrome.kill();
  process.exit(fail.length ? 1 : 0);

  // ──────────────────────────────────────────────
  // 本地：罐头全矩阵（自己主页编辑资料 / 他人主页关注链 / 4 tab / 空态 / 404）
  // ──────────────────────────────────────────────
  async function runLocal(t) {
    console.log('── S. 侧栏入口（hub 上）──');

    // S1 版本 + 侧栏用户模块头像锚 → 自己主页
    const ver = await t.evalJs('window.MN_SITE_VERSION');
    const s1 = await t.evalJs("(() => { var a = document.querySelector('.user-module a[href*=\"community-profile.html\"]');" +
      " return { href: a ? a.getAttribute('href') : null, wrapped: a ? (!!a.querySelector('img.avatar') && !!a.querySelector('.user-name')) : false }; })()");
    check('S1 版本 v0.2.24.1', ver === 'v0.2.24.1', 'ver=' + ver);
    check('S1 侧栏用户模块锚 → 自己主页（USR id + 头像+名字在内）', s1.href === '../pages/community-profile.html?id=USR-000101' && s1.wrapped, s1.href);

    // S2 点侧栏锚 → 真导航到自己主页
    await t.evalJs("document.querySelector('.user-module a[href*=\"community-profile.html\"]').click()");
    await waitFor(t, "window.location.pathname.indexOf('community-profile.html') !== -1", 10000, '侧栏锚跳转');
    await waitFor(t, "document.getElementById('profileMain').style.display === 'flex'", 10000, '主页渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);

    console.log('── G. 自己主页（USR-000101，isSelf）──');

    // G1 几何：主页可见/头部高度/4 tab/侧栏渲染/返回链
    const g1 = await t.evalJs("(() => { var h = document.getElementById('profileHeader');" +
      " var s = document.getElementById('slati-sidebar'); var back = document.querySelector('.back-link');" +
      " return { mainVis: document.getElementById('profileMain').style.display, hH: h.offsetHeight," +
      " tabs: document.querySelectorAll('#profileTabs [data-tab]').length, sLen: s.textContent.length," +
      " backHref: back ? back.getAttribute('href') : null, tabsVisible: (function(){ var el = document.getElementById('profileTabs'); return el && getComputedStyle(el).display !== 'none'; })() }; })()");
    check('G1 主页可见 + 头部高度 > 0', g1.mainVis === 'flex' && g1.hH > 100, 'h=' + g1.hH);
    check('G1 4 个 tab 药丸 + tabs 容器可见', g1.tabs === 4 && g1.tabsVisible, 'n=' + g1.tabs);
    check('G1 侧栏已渲染 + 返回链回 hub', g1.sLen > 50 && g1.backHref === 'community-hub.html', 'sLen=' + g1.sLen);

    // G2 头部渲染：名字/@公民号/性别徽章♂图标/简介/加入于/统计 1/1/2/1/2 粉丝 · 3 关注/编辑资料钮（isSelf）
    const g2 = await t.evalJs("(() => { var h = document.getElementById('profileHeader');" +
      " var nums = Array.prototype.map.call(h.querySelectorAll('.profile-stat-num'), function (e) { return e.textContent; }).join('/');" +
      " var counts = h.querySelector('.profile-counts').textContent;" +
      " var bImg = h.querySelector('.label-sm img');" +
      " var av = h.querySelector('.profile-avatar').getBoundingClientRect(); var nm = h.querySelector('h2').getBoundingClientRect();" +
      " var pc = h.querySelector('.profile-counts').getBoundingClientRect(); var pt = h.querySelector('.profile-top').getBoundingClientRect();" +
      " var bn = h.querySelector('.profile-banner'); var bnR = bn ? bn.getBoundingClientRect() : null;" +
      " var ptEl = h.querySelector('.profile-top'); var bb = ptEl ? getComputedStyle(ptEl).borderBottomWidth : null;" +
      " return { text: h.textContent, nums: nums, counts: counts, badgeSrc: bImg ? bImg.getAttribute('src') : null," +
      " hasEdit: !!document.getElementById('profileEditBtn'), hasFollow: !!document.getElementById('profileFollowBtn')," +
      " avatar: h.querySelector('.profile-avatar').getAttribute('src')," +
      " avL: av.left, avR: av.right, avT: av.top, avB: av.bottom, nmL: nm.left, nmT: nm.top, nmB: nm.bottom," +
      " pcL: pc.left, pcR: pc.right, ptR: pt.right," +
      " bnH: bnR ? bnR.height : 0, bnB: bnR ? bnR.bottom : 0, bb: bb }; })()");
    check('G2 名字/公民号/性别徽章=♂svg/简介/加入时间', g2.text.indexOf('电池用户') !== -1 && g2.text.indexOf('@CIT-000101') !== -1 && g2.badgeSrc && g2.badgeSrc.indexOf('male_24dp_7CA7D8') !== -1 && g2.text.indexOf('电池用户简介') !== -1 && g2.text.indexOf('加入于 2026年8月1日') !== -1, (g2.badgeSrc || '') + ' ' + g2.text.slice(0, 60));
    check('G2 统计四块 1/1/2/1 + counts 并排 2 粉丝 · 3 关注 · 1 获赞', g2.nums === '1/1/2/1' && g2.counts.indexOf('2') !== -1 && g2.counts.indexOf('粉丝') !== -1 && g2.counts.indexOf('3') !== -1 && g2.counts.indexOf('关注') !== -1 && g2.counts.indexOf('1') !== -1 && g2.counts.indexOf('获赞') !== -1, g2.nums + ' / ' + g2.counts);
    check('G2 isSelf → 编辑资料钮（非关注钮）+ 真头像', g2.hasEdit && !g2.hasFollow && g2.avatar.indexOf('data:image/svg') === 0, 'edit=' + g2.hasEdit);
    check('G2 v0.2.22.2 横排几何：名字列在头像右侧（nmL≥avR-1）+ 垂直同带重叠', g2.nmL >= g2.avR - 1 && g2.nmT < g2.avB && g2.nmB > g2.avT, 'avR=' + g2.avR + ' nmL=' + g2.nmL + ' avB=' + g2.avB + ' nmT=' + g2.nmT + ' nmB=' + g2.nmB);
    check('G2 v0.2.22.3 粉丝关注贴 .profile-top 行最右缘（rightEdge≤1）+ 在头像右侧（pcL>avR）', g2.ptR - g2.pcR <= 1 && g2.pcL > g2.avR, 'ptR=' + g2.ptR + ' pcR=' + g2.pcR + ' pcL=' + g2.pcL + ' avR=' + g2.avR);
    check('G2 v0.2.22.5 横幅可见（h≥100）+ 分割线 1px + 头像在横幅下方（avT≥bnB）', g2.bnH >= 100 && g2.bb === '1px' && g2.avT >= g2.bnB, 'bnH=' + g2.bnH + ' bb=' + g2.bb + ' avT=' + g2.avT + ' bnB=' + g2.bnB);

    // G2b v0.2.23.0 种子 cardBg=null → 默认头部：无 liquid-glass 类/无 data-card-bg/无 glass-* 预设类（品牌横幅不动；
    //   注意：站内引擎 scan 给所有 .card 挂 lg-static 静态玻璃层，层有无不是区分信号——区分信号是 liquid-glass 类 + data-card-bg + 预设类）
    // v0.2.24.0 cardPlate=null → 包层无 card-halo 类（无独立背景层）
    const g2b = await t.evalJs("(() => { var h = document.getElementById('profileHeader').querySelector('.profile-header');" +
      " return { glass: h.classList.contains('liquid-glass'), attr: h.hasAttribute('data-card-bg'), cls: h.className," +
      " wrapCls: document.getElementById('profileHeader').className }; })()");
    check('G2 v0.2.23.0 cardBg null → 默认头部（无 liquid-glass/无 data-card-bg/无 glass-* 预设类）+ v0.2.24.0 cardPlate null → 包层无 card-halo', !g2b.glass && !g2b.attr && g2b.cls.indexOf('glass-') === -1 && g2b.wrapCls === '', JSON.stringify(g2b));

    // G3 v0.2.22.0 编辑资料 → 独立弹窗（可见性断言：card+backdrop 计算 opacity=1——隐形弹窗教训）+ 不再开设置弹窗
    await t.evalJs("document.getElementById('profileEditBtn').click()");
    await sleep(600);
    const g3a = await t.evalJs("(() => { var card = document.querySelector('.modal-card'); var bd = document.querySelector('.modal-backdrop');" +
      " var name = document.getElementById('editNameInput'); var bio = document.getElementById('editBioInput');" +
      " var pills = Array.prototype.map.call(document.querySelectorAll('#editGenderRow [data-gender]'), function (b) {" +
      "   var im = b.querySelector('img'); return b.getAttribute('data-gender') + ':' + (im ? im.getAttribute('src') : b.textContent); }).join('|');" +
      " return { bd: !!bd, bdOp: bd ? getComputedStyle(bd).opacity : null, card: !!card, cardOp: card ? getComputedStyle(card).opacity : null," +
      " hasSettings: !!document.getElementById('settingsBackdrop'), name: name ? name.value : null, bio: bio ? bio.value : null, pills: pills," +
      " maleActive: (function(){ var b = document.querySelector('#editGenderRow [data-gender=\"Male\"]'); return b ? b.classList.contains('active') : false; })() }; })()");
    check('G3 编辑资料开独立弹窗：card+backdrop 计算 opacity=1 + 不开设置弹窗', g3a.bd && g3a.bdOp === '1' && g3a.card && g3a.cardOp === '1' && !g3a.hasSettings, JSON.stringify(g3a));
    check('G3 字段预填：名字 电池用户/简介 电池用户简介/性别男高亮', g3a.name === '电池用户' && g3a.bio === '电池用户简介' && g3a.maleActive, g3a.name + '/' + g3a.maleActive);
    check('G3 v0.2.22.1 性别药丸=图标：♂ 蓝 svg + ♀ 粉 svg + Other 文字', g3a.pills.indexOf('Male:../assets/image/male_24dp_7CA7D8') !== -1 && g3a.pills.indexOf('Female:../assets/image/female_24dp_F18AFF') !== -1 && g3a.pills.indexOf('Other:其他') !== -1, g3a.pills);
    await pressEsc(t);
    const g3b = await t.evalJs("(() => { var card = document.querySelector('.modal-card'); return { gone: !card || !card.parentNode }; })()");
    check('G3 Escape 关弹窗 → 卡片移除', g3b.gone, JSON.stringify(g3b));

    console.log('── E. 编辑资料独立弹窗（自己主页，v0.2.22.0）──');

    // E1 改名+改简介+换性别 → 保存 → PATCH body 精确 + 头部重拉更新 + 弹窗关 + 侧栏同页同步
    await t.evalJs("document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.getElementById('editNameInput').value = '电池用户改'; document.getElementById('editBioInput').value = '新简介';" +
      " document.querySelector('#editGenderRow [data-gender=\"Female\"]').click();");
    await sleep(200);
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const e1 = await t.evalJs("(() => { var card = document.querySelector('.modal-card'); var h = document.getElementById('profileHeader');" +
      " var side = document.querySelector('#slati-sidebar .user-module .user-name');" +
      " var bImg = h.querySelector('.label-sm img');" +
      " var pc = window.__patchedMe; var toasts = window.__toasts.join('|');" +
      " var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " return { patched: pc, cardGone: !card || !card.parentNode, hText: h.textContent, badgeSrc: bImg ? bImg.getAttribute('src') : null, sideName: side ? side.textContent : null, toasts: toasts, rawCalls: rawCalls }; })()");
    console.log('E1 raw PATCH bodies:', JSON.stringify(e1.rawCalls));
    // 单次写入守卫：modal PATCH 恰 1 次且 body 恰 3 字段无 avatarUrl——
    // 曾实测 saveUser→mirrorProfile 触发第二次全字段 PATCH（含语言/国家/生日回流风险），已改本页零 localStorage
    check('E1 保存 → PATCH /auth/me 单次且 body 精确（名字/简介/性别 Female，无 avatarUrl）',
      e1.rawCalls.length === 1 && e1.rawCalls[0].indexOf('"avatarUrl"') === -1 &&
      e1.patched && e1.patched.displayName === '电池用户改' && e1.patched.bio === '新简介' && e1.patched.gender === 'Female' && e1.patched.avatarUrl === undefined,
      JSON.stringify(e1.rawCalls));
    check('E1 保存 → 弹窗关 + toast 资料已保存 + 头部重拉（改名/♀svg/新简介）', e1.cardGone && e1.toasts.indexOf('资料已保存') !== -1 && e1.hText.indexOf('电池用户改') !== -1 && e1.badgeSrc && e1.badgeSrc.indexOf('female_24dp_F18AFF') !== -1 && e1.hText.indexOf('新简介') !== -1, (e1.badgeSrc || '') + ' ' + e1.hText.slice(0, 70));
    check('E1 侧栏同页即时更新为 电池用户改', e1.sideName === '电池用户改', 'side=' + e1.sideName);

    // E2 头像上传：CDP setFileInputFiles → 直传罐头 → 预览换图 → 保存 PATCH 带 avatarUrl → 头部头像换新
    const tmpAv = path.join(__dirname, 'tmp-avatar-test.jpg');
    fs.writeFileSync(tmpAv, PIXEL_PNG); // 客户端只查扩展名+大小，罐头端点不看魔数
    await t.evalJs("document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.send('DOM.enable');
    const docNode = await t.send('DOM.getDocument', { depth: -1 });
    const fileNode = await t.send('DOM.querySelector', { nodeId: docNode.root.nodeId, selector: '#editAvatarFile' });
    await t.send('DOM.setFileInputFiles', { nodeId: fileNode.nodeId, files: [tmpAv] });
    await sleep(700);
    const e2a = await t.evalJs("(() => { var img = document.getElementById('editAvatarPreview');" +
      " var st = document.getElementById('editSaveState'); return { src: img ? img.getAttribute('src') : null, st: st ? st.textContent : null }; })()");
    check('E2 选头像 → 直传 + 预览换图 + 状态提示', e2a.src === '/uploads/UPL-DEMO01.jpg' && e2a.st.indexOf('新头像已就绪') !== -1, JSON.stringify(e2a));
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const e2b = await t.evalJs("(() => { var h = document.getElementById('profileHeader');" +
      " return { patchedAvatar: window.__patchedMe ? window.__patchedMe.avatarUrl : null, hAvatar: h.querySelector('.profile-avatar').getAttribute('src')," +
      " uploadCalls: window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/uploads') !== -1; }).length }; })()");
    check('E2 保存 → PATCH 带 avatarUrl + 头部头像换新 + 直传调用 1 次', e2b.patchedAvatar === '/uploads/UPL-DEMO01.jpg' && e2b.hAvatar === '/uploads/UPL-DEMO01.jpg' && e2b.uploadCalls === 1, JSON.stringify(e2b));
    fs.unlinkSync(tmpAv);

    // E3 空显示名拦截：不发 PATCH + toast + 弹窗还在
    await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.getElementById('editNameInput').value = '   '; document.getElementById('editSaveBtn').click()");
    await sleep(400);
    const e3 = await t.evalJs("(() => { var card = document.querySelector('.modal-card');" +
      " return { patched: window.__patchedMe, stillOpen: card && !!card.parentNode, toasts: window.__toasts.join('|') }; })()");
    check('E3 空显示名 → 拦截（无 PATCH + toast 显示名不能为空 + 弹窗还在）', e3.stillOpen && !e3.patched && e3.toasts.indexOf('显示名不能为空') !== -1, JSON.stringify(e3));
    await pressEsc(t);

    // E4 保存 401 → toast 登录已过期 + 弹窗关（罐头 401）
    await t.evalJs("window.__patchFail401 = true; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.getElementById('editNameInput').value = '电池用户401'; document.getElementById('editSaveBtn').click()");
    await sleep(500);
    const e4 = await t.evalJs("(() => { var card = document.querySelector('.modal-card');" +
      " return { gone: !card || !card.parentNode, toasts: window.__toasts.join('|') }; })()");
    check('E4 保存 401 → toast 登录已过期 + 弹窗关', e4.gone && e4.toasts.indexOf('登录已过期') !== -1, JSON.stringify(e4));
    await t.evalJs("window.__patchFail401 = false");

    // E5 无改动保存 → 直接关不发 PATCH
    await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(400);
    const e5 = await t.evalJs("(() => { var card = document.querySelector('.modal-card');" +
      " return { patched: window.__patchedMe, gone: !card || !card.parentNode }; })()");
    check('E5 无改动保存 → 直接关不发 PATCH', e5.gone && !e5.patched, JSON.stringify(e5));

    console.log('── E6. 编辑资料弹窗 基础/自定义 导航 + 卡片背景液体玻璃（v0.2.23.0）──');

    // E6a 导航：2 药丸 基础 active + 基础 tab 可见 + 自定义 tab 藏
    await t.evalJs("document.getElementById('profileEditBtn').click()");
    await sleep(500);
    const e6a = await t.evalJs("(() => { var ns = document.querySelectorAll('#editNavBtns [data-edit-tab]');" +
      " var basic = document.getElementById('editTabBasic'); var custom = document.getElementById('editTabCustom');" +
      " return { n: ns.length, labels: Array.prototype.map.call(ns, function (x) { return x.textContent; }).join('|')," +
      " active: document.querySelector('#editNavBtns [data-edit-tab].active').getAttribute('data-edit-tab')," +
      " basicVis: getComputedStyle(basic).display, customVis: getComputedStyle(custom).display, hasGrid: !!document.getElementById('editBgGrid') }; })()");
    check('E6 弹窗顶部导航：基础/自定义 2 药丸 + 基础 active + 基础可见自定义藏', e6a.n === 2 && e6a.labels === '基础|自定义' && e6a.active === 'basic' && e6a.basicVis !== 'none' && e6a.customVis === 'none' && e6a.hasGrid, JSON.stringify(e6a));

    // E6b v0.2.24.0 切自定义：双组（横幅组改名「横幅（液体玻璃）」+ 卡片背景新组）双网格 7+7 + 预览默认
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
    const e6b = await t.evalJs("(() => { var basic = document.getElementById('editTabBasic'); var custom = document.getElementById('editTabCustom');" +
      " var labels = Array.prototype.map.call(custom.querySelectorAll('.form-label'), function (x) { return x.textContent; }).join('|');" +
      " var bgSw = document.querySelectorAll('#editBgGrid [data-bg]'); var plSw = document.querySelectorAll('#editPlateGrid [data-plate]');" +
      " var flat = document.querySelector('#editTabCustom .edit-bg-flat'); var pv = document.getElementById('editPlatePreview');" +
      " var pvCard = pv.querySelector('.pv-card');" +
      " return { active: document.querySelector('#editNavBtns [data-edit-tab].active').getAttribute('data-edit-tab')," +
      " basicVis: getComputedStyle(basic).display, customVis: getComputedStyle(custom).display, labels: labels," +
      " bgN: bgSw.length, bgLabels: Array.prototype.map.call(bgSw, function (x) { return x.querySelector('.swatch-label').textContent; }).join('|')," +
      " bgFirstActive: bgSw[0].classList.contains('active'), flatCls: flat.className, flatBg: getComputedStyle(flat).backgroundImage," +
      " plN: plSw.length, plLabels: Array.prototype.map.call(plSw, function (x) { return x.querySelector('.swatch-label').textContent; }).join('|')," +
      " plFirstActive: plSw[0].classList.contains('active'), pvCls: pv.className, pvBg: getComputedStyle(pv).backgroundImage," +
      " pvCardBgColor: getComputedStyle(pvCard).backgroundColor }; })()");
    check('E6 切自定义：互斥显示 + 双组改名（横幅（液体玻璃）|卡片背景）+ 横幅 7 预设 + v0.2.24.1 卡片背景只 2 选项（默认|标准液态玻璃）默认选中', e6b.active === 'custom' && e6b.basicVis === 'none' && e6b.customVis !== 'none' && e6b.labels === '横幅（液体玻璃）|卡片背景' && e6b.bgN === 7 && e6b.bgLabels === '默认|磨砂|深海|薰衣草|樱花|薄荷|落日' && e6b.bgFirstActive && e6b.plN === 2 && e6b.plLabels === '默认|标准液态玻璃' && e6b.plFirstActive, JSON.stringify(e6b));
    check('E6 v0.2.24.0 预览默认：横幅条=品牌渐变 + 卡片背景预览无 has-plate 无背景 + 迷你透明卡身', e6b.flatCls === 'edit-bg-flat bg-default' && e6b.flatBg.indexOf('linear-gradient') !== -1 && e6b.pvCls === 'edit-bg-preview' && e6b.pvBg === 'none' && e6b.pvCardBgColor === 'rgba(0, 0, 0, 0)', 'flat=' + e6b.flatCls + ' pvCls=' + e6b.pvCls + ' pvBg=' + e6b.pvBg + ' pvCard=' + e6b.pvCardBgColor);

    // E6c 横幅组点深海：active 唯一互斥 + 横幅条换类换渐变
    await t.evalJs("document.querySelector('#editBgGrid [data-bg=\"glass-ocean\"]').click()");
    await sleep(300);
    const e6c = await t.evalJs("(() => { var active = document.querySelectorAll('#editBgGrid [data-bg].active');" +
      " var flat = document.querySelector('#editTabCustom .edit-bg-flat');" +
      " return { activeCount: active.length, activeBg: active[0] ? active[0].getAttribute('data-bg') : null," +
      " flatCls: flat.className, flatBg: getComputedStyle(flat).backgroundImage }; })()");
    check('E6 横幅组点深海：active 唯一互斥 + 横幅条同步深海渐变', e6c.activeCount === 1 && e6c.activeBg === 'glass-ocean' && e6c.flatCls === 'edit-bg-flat glass-ocean' && e6c.flatBg.indexOf('linear-gradient') !== -1 && e6c.flatBg.indexOf('rgba(30, 90, 200') !== -1, JSON.stringify(e6c));

    // E6c2 v0.2.24.1 卡片背景组点标准液态玻璃（两组各选各的互不影响）：包层预览 has-plate 无色磨砂 + 代码白边环 2px + 柔影 + 透明卡身透出
    await t.evalJs("document.querySelector('#editPlateGrid [data-plate=\"glass-clear\"]').click()");
    await sleep(300);
    const e6c2 = await t.evalJs("(() => { var active = document.querySelectorAll('#editPlateGrid [data-plate].active');" +
      " var pv = document.getElementById('editPlatePreview'); var pvCard = pv.querySelector('.pv-card');" +
      " var flat = document.querySelector('#editTabCustom .edit-bg-flat');" +
      " return { activeCount: active.length, activePlate: active[0] ? active[0].getAttribute('data-plate') : null," +
      " pvCls: pv.className, pvBg: getComputedStyle(pv).backgroundImage, pvShadow: getComputedStyle(pv).boxShadow," +
      " pvCardBgColor: getComputedStyle(pvCard).backgroundColor, flatCls: flat.className }; })()");
    check('E6 卡片背景组点标准液态玻璃：active 唯一互斥 + 包层预览 has-plate glass-clear 无色纯白磨砂（无任何色相）+ 透明卡身透出 + 横幅组不受影响（仍深海）', e6c2.activeCount === 1 && e6c2.activePlate === 'glass-clear' && e6c2.pvCls === 'edit-bg-preview has-plate glass-clear' && e6c2.pvBg.indexOf('linear-gradient') !== -1 && e6c2.pvBg.indexOf('rgba(255, 255, 255') !== -1 && e6c2.pvBg.indexOf('rgba(232, 110, 160') === -1 && e6c2.pvBg.indexOf('rgba(30, 90, 200') === -1 && e6c2.pvBg.indexOf('rgba(96, 100, 230') === -1 && e6c2.pvCardBgColor === 'rgba(0, 0, 0, 0)' && e6c2.flatCls === 'edit-bg-flat glass-ocean', JSON.stringify(e6c2));
    check('E6 v0.2.24.1 标准液态玻璃预览=代码白边环 2px（rgba(255,255,255,0.8) inset）+ 柔影（0 4px 12px rgba(0,0,0,0.4)）', e6c2.pvShadow.indexOf('rgba(255, 255, 255, 0.8)') !== -1 && e6c2.pvShadow.indexOf('inset') !== -1 && e6c2.pvShadow.indexOf('rgba(0, 0, 0, 0.4)') !== -1, e6c2.pvShadow);

    // E6d 保存 → PATCH 带 cardBg+cardPlate 双字段 + 弹窗关 → 头部双背景重拉（横幅=卡上深海、卡片背景=包层标准液态玻璃无色、卡身纯透明）
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const e6d = await t.evalJs("(() => { var h = document.getElementById('profileHeader').querySelector('.profile-header');" +
      " var card = document.querySelector('.modal-card');" +
      " var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " return { cardGone: !card || !card.parentNode, rawCalls: rawCalls," +
      " glass: h.classList.contains('liquid-glass'), cls: h.className, attr: h.getAttribute('data-card-bg')," +
      " layer: !!h.querySelector('.lg-backdrop'), spec: !!h.querySelector('.lg-specular')," +
      " layerFilter: h.querySelector('.lg-backdrop') ? (getComputedStyle(h.querySelector('.lg-backdrop')).backdropFilter || getComputedStyle(h.querySelector('.lg-backdrop')).webkitBackdropFilter) : null," +
      " cardBgColor: getComputedStyle(h).backgroundColor, bannerBgImg: getComputedStyle(h.querySelector('.profile-banner')).backgroundImage," +
      " wrapCls: document.getElementById('profileHeader').className, wrapBg: getComputedStyle(document.getElementById('profileHeader')).backgroundImage," +
      " wrapShadow: getComputedStyle(document.getElementById('profileHeader')).boxShadow, toasts: window.__toasts.join('|') }; })()");
    console.log('E6d raw PATCH bodies:', JSON.stringify(e6d.rawCalls));
    // 全会话累积的 PATCH 里，含 cardBg 的恰 1 次且 body 精确双字段（无 avatarUrl/语言/国家回流）
    const e6dCardBgCalls = e6d.rawCalls.filter(function (b) { return b.indexOf('cardBg') !== -1; });
    check('E6 保存 → PATCH 含 cardBg 恰 1 次且 body 精确 ={"cardBg":"glass-ocean","cardPlate":"glass-clear"}+ 弹窗关 + toast', e6dCardBgCalls.length === 1 && e6dCardBgCalls[0] === '{"cardBg":"glass-ocean","cardPlate":"glass-clear"}' && e6d.cardGone && e6d.toasts.indexOf('资料已保存') !== -1, JSON.stringify(e6dCardBgCalls));
    check('E6 头部重拉挂液体玻璃：liquid-glass + glass-ocean 类 + data-card-bg + 折射/高光双层', e6d.glass && e6d.cls.indexOf('glass-ocean') !== -1 && e6d.attr === 'glass-ocean' && e6d.layer && e6d.spec, JSON.stringify({ glass: e6d.glass, cls: e6d.cls, attr: e6d.attr, layer: e6d.layer, spec: e6d.spec }));
    check('E6 玻璃层 backdrop-filter 生效（blur 14px + saturate）', e6d.layerFilter && e6d.layerFilter.indexOf('blur(14px)') !== -1 && e6d.layerFilter.indexOf('saturate') !== -1, String(e6d.layerFilter));
    check('E6 v0.2.24.1 独立双背景：横幅=卡上深海渐变 + 卡片背景=包层 card-halo glass-clear 无色纯白磨砂（无任何色相）+ 卡身纯透明透出背景层', e6d.bannerBgImg.indexOf('linear-gradient') !== -1 && e6d.bannerBgImg.indexOf('rgba(30, 90, 200') !== -1 && e6d.wrapCls === 'card-halo glass-clear' && e6d.wrapBg.indexOf('linear-gradient') !== -1 && e6d.wrapBg.indexOf('rgba(255, 255, 255') !== -1 && e6d.wrapBg.indexOf('rgba(232, 110, 160') === -1 && e6d.wrapBg.indexOf('rgba(30, 90, 200') === -1 && e6d.wrapBg.indexOf('rgba(96, 100, 230') === -1 && e6d.cardBgColor === 'rgba(0, 0, 0, 0)', 'banner=' + e6d.bannerBgImg.slice(0, 50) + ' wrapCls=' + e6d.wrapCls + ' wrapBg=' + e6d.wrapBg.slice(0, 50) + ' card=' + e6d.cardBgColor);
    check('E6 v0.2.24.1 标准液态玻璃包层=代码白边环 2px（rgba(255,255,255,0.8) inset）+ 柔影（0 4px 12px rgba(0,0,0,0.4)）', e6d.wrapShadow.indexOf('rgba(255, 255, 255, 0.8)') !== -1 && e6d.wrapShadow.indexOf('inset') !== -1 && e6d.wrapShadow.indexOf('rgba(0, 0, 0, 0.4)') !== -1, e6d.wrapShadow);

    // E6e 重开 → 自定义 tab 双组预填当前背景（横幅 glass-ocean + 卡片背景 glass-rose 各选中各预览）→ 双双选默认 → 保存 → PATCH 双 null → 头部回默认
    await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
    const e6e = await t.evalJs("(() => { var bgActive = document.querySelector('#editBgGrid [data-bg].active');" +
      " var plActive = document.querySelector('#editPlateGrid [data-plate].active');" +
      " var flat = document.querySelector('#editTabCustom .edit-bg-flat'); var pv = document.getElementById('editPlatePreview');" +
      " return { bgActive: bgActive ? bgActive.getAttribute('data-bg') : null, plActive: plActive ? plActive.getAttribute('data-plate') : null," +
      " flatCls: flat.className, pvCls: pv.className }; })()");
    check('E6 重开弹窗 → 双组预填当前背景（横幅 glass-ocean + 卡片背景 glass-clear 各选中各预览）', e6e.bgActive === 'glass-ocean' && e6e.plActive === 'glass-clear' && e6e.flatCls === 'edit-bg-flat glass-ocean' && e6e.pvCls === 'edit-bg-preview has-plate glass-clear', JSON.stringify(e6e));
    await t.evalJs("document.querySelector('#editBgGrid [data-bg=\"\"]').click(); document.querySelector('#editPlateGrid [data-plate=\"\"]').click()");
    await sleep(300);
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const e6f = await t.evalJs("(() => { var h = document.getElementById('profileHeader').querySelector('.profile-header');" +
      " var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " return { rawCalls: rawCalls, glass: h.classList.contains('liquid-glass'), attr: h.hasAttribute('data-card-bg'), cls: h.className," +
      " cardBgColor: getComputedStyle(h).backgroundColor, bannerBgImg: getComputedStyle(h.querySelector('.profile-banner')).backgroundImage," +
      " wrapCls: document.getElementById('profileHeader').className }; })()");
    console.log('E6f raw PATCH bodies:', JSON.stringify(e6f.rawCalls));
    // 含 cardBg 的调用共 2 次（双设 → 双 null），最后一次 body 精确 ={"cardBg":null,"cardPlate":null}
    const e6fCardBgCalls = e6f.rawCalls.filter(function (b) { return b.indexOf('cardBg') !== -1; });
    check('E6 双双选默认 → 保存 → 最后 PATCH body 精确 ={"cardBg":null,"cardPlate":null} + 头部回默认（无 liquid-glass/无 data-card-bg/无预设类）', e6fCardBgCalls.length === 2 && e6fCardBgCalls[e6fCardBgCalls.length - 1] === '{"cardBg":null,"cardPlate":null}' && !e6f.glass && !e6f.attr && e6f.cls.indexOf('glass-') === -1, JSON.stringify(e6fCardBgCalls));
    check('E6 v0.2.24.0 回默认 → 包层类清空（无 card-halo）+ 卡身回实底（非透明）+ 横幅回品牌渐变', e6f.wrapCls === '' && e6f.cardBgColor !== 'rgba(0, 0, 0, 0)' && e6f.bannerBgImg !== 'none' && e6f.bannerBgImg.indexOf('linear-gradient') !== -1, 'wrapCls=' + e6f.wrapCls + ' card=' + e6f.cardBgColor + ' banner=' + e6f.bannerBgImg.slice(0, 60));

    console.log('── T. 四 tab 走查（自己主页）──');
    // T1 默认 posts tab：1 卡（主页第一帖 + 媒体瓦片）
    const t1 = await t.evalJs("(() => { var l = document.getElementById('profileList');" +
      " return { cards: l.querySelectorAll('[data-cloud-id]').length, text: l.textContent," +
      " tiles: l.querySelectorAll('.pm-tile').length, activeTab: document.querySelector('#profileTabs [data-tab].active').getAttribute('data-tab') }; })()");
    check('T1 默认 posts tab：1 卡 + 内容 + 媒体瓦片 + active=posts', t1.cards === 1 && t1.text.indexOf('主页第一帖') !== -1 && t1.tiles === 1 && t1.activeTab === 'posts', 'cards=' + t1.cards);
    // T1b 灯箱：点瓦片开 → Escape 关
    await t.evalJs("document.querySelector('#profileList .pm-tile').click()");
    await sleep(400);
    const t1b = await t.evalJs("!!document.querySelector('.modal-backdrop.active')");
    await pressEsc(t);
    const t1c = await t.evalJs("!!document.querySelector('.modal-backdrop.active')");
    check('T1b 灯箱点开 + Escape 关', t1b && !t1c, t1b + ' → ' + t1c);

    // T2 转发 tab：转发了徽章 + .repost-embedded 内嵌原帖
    await t.evalJs("document.querySelector('#profileTabs [data-tab=\"reposts\"]').click()");
    await sleep(500);
    const t2 = await t.evalJs("(() => { var l = document.getElementById('profileList');" +
      " return { cards: l.querySelectorAll('[data-cloud-id]').length, hasBadge: l.querySelector('.badge-success') ? l.querySelector('.badge-success').textContent : null," +
      " hasEmbed: !!l.querySelector('.repost-embedded'), embedText: l.querySelector('.repost-embedded') ? l.querySelector('.repost-embedded').textContent : '' }; })()");
    check('T2 转发 tab：1 卡 + 「转发了」徽章 + 内嵌原帖盒', t2.cards === 1 && t2.hasBadge === '转发了' && t2.hasEmbed && t2.embedText.indexOf('原帖内容') !== -1, JSON.stringify(t2));

    // T3 点赞 tab：被点赞的帖（他人作者 → 作者锚指向 USR-000202）
    await t.evalJs("document.querySelector('#profileTabs [data-tab=\"likes\"]').click()");
    await sleep(500);
    const t3 = await t.evalJs("(() => { var l = document.getElementById('profileList');" +
      " var a = l.querySelector('.post-author-link');" +
      " return { text: l.textContent, anchorHref: a ? a.getAttribute('href') : null }; })()");
    check('T3 点赞 tab：被点赞的帖 + 作者锚 → 他人主页', t3.text.indexOf('被点赞的帖') !== -1 && t3.anchorHref === 'community-profile.html?id=USR-000202', t3.anchorHref);

    // T4 收藏 tab + 统计块点击切 tab（data-goto-tab）
    await t.evalJs("document.querySelector('#profileHeader [data-goto-tab=\"favorites\"]').click()");
    await sleep(500);
    const t4 = await t.evalJs("(() => { var l = document.getElementById('profileList');" +
      " return { text: l.textContent, activeTab: document.querySelector('#profileTabs [data-tab].active').getAttribute('data-tab') }; })()");
    check('T4 统计块点击切 favorites tab + 收藏的帖渲染', t4.text.indexOf('收藏的帖') !== -1 && t4.activeTab === 'favorites', t4.activeTab);

    // T5 maybeReloadTab：收藏 tab 撤销星 → 重拉空态；点赞 tab 撤销赞 → 重拉空态
    await t.evalJs("document.querySelector('#profileList [data-favorite-post]').click()");
    await sleep(700);
    const t5a = await t.evalJs("(() => { var l = document.getElementById('profileList');" +
      " var delCalls = window.__fetchCalls.filter(function (c) { return c.method === 'DELETE' && c.url.indexOf('/favorite') !== -1; }).length;" +
      " return { empty: l.textContent.indexOf('还没有收藏的帖子') !== -1, cards: l.querySelectorAll('[data-cloud-id]').length, delCalls: delCalls }; })()");
    check('T5 收藏 tab 撤销星 → DELETE 捕获 + 卡片出列 → 空态「还没有收藏的帖子」', t5a.delCalls >= 1 && t5a.cards === 0 && t5a.empty, JSON.stringify(t5a));
    await t.evalJs("document.querySelector('#profileTabs [data-tab=\"likes\"]').click()");
    await sleep(500);
    await t.evalJs("document.querySelector('#profileList [data-like-post]').click()");
    await sleep(700);
    const t5b = await t.evalJs("(() => { var l = document.getElementById('profileList');" +
      " return { empty: l.textContent.indexOf('还没有点赞的内容') !== -1, cards: l.querySelectorAll('[data-cloud-id]').length }; })()");
    check('T5 点赞 tab 撤销赞 → 卡片出列 → 空态「还没有点赞的内容」', t5b.cards === 0 && t5b.empty, JSON.stringify(t5b));

    console.log('── C. 卡操作（posts tab）──');
    await t.evalJs("document.querySelector('#profileTabs [data-tab=\"posts\"]').click()");
    await sleep(500);
    // C1 点赞链（乐观 + 罐头真值）
    await t.evalJs("document.querySelector('#profileList [data-like-post]').click()");
    await sleep(400);
    const c1 = await t.evalJs("(() => { var b = document.querySelector('#profileList [data-like-post]');" +
      " return { pressed: b.getAttribute('aria-pressed'), count: b.querySelector('[data-like-count]').textContent," +
      " postCalls: window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/like') !== -1; }).length }; })()");
    check('C1 点赞：POST 捕获 + 计数 4 + 已赞态', c1.postCalls >= 1 && c1.count === '4' && c1.pressed === 'true', JSON.stringify(c1));
    // C2 转发 → toast 已转发到你的主页
    await t.evalJs("document.querySelector('#profileList [data-repost-post]').click()");
    await sleep(500);
    const c2 = await t.evalJs("window.__toasts.join('|')");
    check('C2 转发：POST 捕获 + toast 已转发到你的主页', c2.indexOf('已转发到你的主页') !== -1, c2.slice(0, 60));
    // C3 分享弹窗：可见性断言 + URL 是帖页规范链接 + 关闭
    await t.evalJs("document.querySelector('#profileList [data-share-post]').click()");
    await sleep(500);
    const c3 = await t.evalJs("(() => { var bd = document.querySelector('.modal-backdrop.active'); var card = bd ? bd.querySelector('.modal-card.active') : null;" +
      " var inp = document.getElementById('shareUrlInput');" +
      " return { bdOp: bd ? getComputedStyle(bd).opacity : null, cardOp: card ? getComputedStyle(card).opacity : null, val: inp ? inp.value : '' }; })()");
    check('C3 分享弹窗可见（opacity=1）+ 链接 = 帖页规范 URL', c3.bdOp === '1' && c3.cardOp === '1' && c3.val.indexOf('/pages/community-post.html?id=PST-000101') !== -1, c3.val.slice(-50));
    await t.evalJs("document.getElementById('shareClose').click()");
    await sleep(200);
    // C4 举报旗点击不导航 + 整卡点击 → 帖页
    await t.evalJs("document.querySelector('#profileList [data-cloud-post]').click()");
    await sleep(500);
    const afterFlag = await pathOf(t);
    check('C4 举报旗点击仍在主页（不跳帖页）', afterFlag.indexOf('community-profile.html') !== -1, afterFlag);
    await pressEsc(t);
    await t.evalJs("document.querySelector('#profileList [data-cloud-id]').click()"); // 短文案卡无 h4，点卡片本体
    await waitFor(t, "window.location.pathname.indexOf('community-post.html') !== -1", 10000, '整卡跳转');
    const navPath = await pathOf(t);
    check('C4 整卡点击真导航到帖页（含 id 参数）', navPath.indexOf('/pages/community-post.html') !== -1 && navPath.indexOf('PST-000101') !== -1, navPath);

    console.log('── O. 他人主页（USR-000202，关注链 + 空态）──');
    await nav(t, BASE + '/pages/community-profile.html?id=USR-000202');
    await waitFor(t, "document.getElementById('profileMain').style.display === 'flex'", 10000, '他人主页渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);
    const o1 = await t.evalJs("(() => { var h = document.getElementById('profileHeader');" +
      " var b = document.getElementById('profileFollowBtn'); var l = document.getElementById('profileList');" +
      " var bImg = h.querySelector('.label-sm img'); var hc = h.querySelector('.profile-header');" +
      " var statTabs = Array.prototype.map.call(h.querySelectorAll('[data-goto-tab]'), function (e) { return e.getAttribute('data-goto-tab'); }).join(',');" +
      " return { text: h.textContent, badgeSrc: bImg ? bImg.getAttribute('src') : null, hasFollow: !!b, pressed: b ? b.getAttribute('aria-pressed') : null, btnText: b ? b.textContent : null," +
      " hasEdit: !!document.getElementById('profileEditBtn'), empty: l.textContent.indexOf('还没有发过帖子') !== -1," +
      " follower: (document.getElementById('profileFollowerCount') || {}).textContent || null," +
      " tabs: document.querySelectorAll('#profileTabs [data-tab]').length, statTabs: statTabs," +
      " glass: hc.classList.contains('liquid-glass'), bgAttr: hc.getAttribute('data-card-bg'), lgLayer: !!hc.querySelector('.lg-backdrop')," +
      " wrapCls: h.className, wrapBg: getComputedStyle(h).backgroundImage, wrapShadow: getComputedStyle(h).boxShadow," +
      " cardBgColor: getComputedStyle(hc).backgroundColor }; })()");
    check('O1 他人主页：名字/♀svg/兜底简介/加入于 + 关注钮（未关注态）+ 无编辑资料钮 + 空态', o1.text.indexOf('电池他人') !== -1 && o1.badgeSrc && o1.badgeSrc.indexOf('female_24dp_F18AFF') !== -1 && o1.text.indexOf('这个人很懒，还没有简介') !== -1 && o1.text.indexOf('加入于 2026年7月15日') !== -1 && o1.hasFollow && o1.pressed === 'false' && o1.btnText === '关注' && !o1.hasEdit && o1.empty, o1.btnText);
    check('O1 粉丝数初始 0', o1.follower === '0', o1.follower);
    check('O1 v0.2.22.6 点赞/收藏默认私人：他人主页只 2 tab（帖子/转发）+ 无点赞/收藏统计块', o1.tabs === 2 && o1.statTabs === 'posts,reposts', 'tabs=' + o1.tabs + ' stats=' + o1.statTabs);
    check('O1 v0.2.24.1 他人双背景公开渲染：卡=横幅预设 glass-rose（liquid-glass+data-card-bg+玻璃层）+ 包层=卡片背景 card-halo glass-clear 无色纯白磨砂 + 卡身纯透明', o1.glass && o1.bgAttr === 'glass-rose' && o1.lgLayer && o1.wrapCls.indexOf('card-halo') !== -1 && o1.wrapCls.indexOf('glass-clear') !== -1 && o1.wrapBg.indexOf('linear-gradient') !== -1 && o1.wrapBg.indexOf('rgba(255, 255, 255') !== -1 && o1.wrapBg.indexOf('rgba(30, 90, 200') === -1 && o1.wrapBg.indexOf('rgba(232, 110, 160') === -1 && o1.cardBgColor === 'rgba(0, 0, 0, 0)', JSON.stringify({ glass: o1.glass, attr: o1.bgAttr, layer: o1.lgLayer, wrapCls: o1.wrapCls, wrapBg: o1.wrapBg.slice(0, 50), cardBgColor: o1.cardBgColor }));
    check('O1 v0.2.24.1 标准液态玻璃=代码白边环 2px + 柔影', o1.wrapShadow.indexOf('rgba(255, 255, 255, 0.8)') !== -1 && o1.wrapShadow.indexOf('inset') !== -1 && o1.wrapShadow.indexOf('rgba(0, 0, 0, 0.4)') !== -1, o1.wrapShadow);

    // O2 关注链：点击 → 乐观已关注 + POST 捕获 → 罐头回程 followerCount 1 + toast；再点 → DELETE → 取消
    await t.evalJs("document.getElementById('profileFollowBtn').click()");
    await sleep(400);
    const o2a = await t.evalJs("(() => { var b = document.getElementById('profileFollowBtn');" +
      " var postCalls = window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url === '/api/social/users/USR-000202/follow'; }).length;" +
      " return { pressed: b.getAttribute('aria-pressed'), text: b.textContent, follower: document.getElementById('profileFollowerCount').textContent," +
      " toasts: window.__toasts.join('|'), postCalls: postCalls }; })()");
    check('O2 关注：POST 捕获 + 已关注态 + 粉丝数 0→1 + toast 已关注', o2a.postCalls >= 1 && o2a.pressed === 'true' && o2a.text === '已关注' && o2a.follower === '1' && o2a.toasts.indexOf('已关注') !== -1, JSON.stringify(o2a));
    await t.evalJs("document.getElementById('profileFollowBtn').click()");
    await sleep(400);
    const o2b = await t.evalJs("(() => { var b = document.getElementById('profileFollowBtn');" +
      " var delCalls = window.__fetchCalls.filter(function (c) { return c.method === 'DELETE' && c.url === '/api/social/users/USR-000202/follow'; }).length;" +
      " return { pressed: b.getAttribute('aria-pressed'), text: b.textContent, follower: document.getElementById('profileFollowerCount').textContent," +
      " toasts: window.__toasts.join('|'), delCalls: delCalls }; })()");
    check('O2 再点取关：DELETE 捕获 + 回关注态 + 粉丝数 0 + toast 已取消关注', o2b.delCalls >= 1 && o2b.pressed === 'false' && o2b.text === '关注' && o2b.follower === '0' && o2b.toasts.indexOf('已取消关注') !== -1, JSON.stringify(o2b));

    // O3 访客：清账号 → 重载 → 关注钮点击 → toast 登录后才能关注 + 零 /follow 请求
    await clearUser(t);
    await t.send('Page.reload');
    await sleep(1500);
    await waitFor(t, "document.getElementById('profileMain').style.display === 'flex'", 10000, '访客重载渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);
    await t.evalJs("window.__fetchCalls = [];");
    await t.evalJs("document.getElementById('profileFollowBtn').click()");
    await sleep(400);
    const o3 = await t.evalJs("(() => { var b = document.getElementById('profileFollowBtn');" +
      " return { toasts: window.__toasts.join('|'), followCalls: window.__fetchCalls.filter(function (c) { return c.url.indexOf('/follow') !== -1; }).length," +
      " guestAttr: b.hasAttribute('data-guest-follow') }; })()");
    check('O3 访客：关注 → toast 登录后才能关注 + 零 /follow 请求', o3.toasts.indexOf('登录后才能关注') !== -1 && o3.followCalls === 0 && o3.guestAttr, JSON.stringify(o3));

    // O4 404：未知 id + 非法格式 id
    await nav(t, BASE + '/pages/community-profile.html?id=USR-999999');
    await sleep(1200);
    const o4 = await t.evalJs("(() => { var b = document.getElementById('profileState404'); var m = document.getElementById('profileMain');" +
      " return { s404: b.style.display, main: m.style.display, text: b.querySelector('p').textContent }; })()");
    check('O4 404 态（未知 id）：提示可见 + 主页藏', o4.s404 === 'block' && o4.main === 'none' && o4.text.length > 0, o4.text);
    await nav(t, BASE + '/pages/community-profile.html?id=PST-000101');
    await sleep(1200);
    const o4b = await t.evalJs("document.getElementById('profileState404').style.display");
    check('O4 非法格式 id（非 USR-）→ 前端拦截 404', o4b === 'block', o4b);

    check('O5 全程 0 console error', errs.length === 0, errs.slice(0, 3).join(' | '));
  }

  // ──────────────────────────────────────────────
  // 线上：只读侧 + 401 回滚链 + 访客零请求（无凭据不真写）
  // ──────────────────────────────────────────────
  async function runLive(t) {
    console.log('── L. 线上（hub 作者锚 → profile 渲染 → 401 回滚链）──');

    // L1 hub 首卡作者锚 → 个人主页（href 形状断言）
    const l1 = await t.evalJs("(() => { var c = document.querySelector('[data-cloud-id]'); var a = c ? c.querySelector('.post-author-link') : null;" +
      " return { ver: window.MN_SITE_VERSION, href: a ? a.getAttribute('href') : null, wrapped: a ? (!!a.querySelector('img.avatar') && a.textContent.length > 0) : false }; })()");
    check('L1 版本 v0.2.24.1', l1.ver === 'v0.2.24.1', 'ver=' + l1.ver);
    check('L1 云卡作者锚 → profile（id=USR- 形状 + 头像+名字在内）', l1.href && /^community-profile\.html\?id=USR-\d{6}$/.test(l1.href) && l1.wrapped, l1.href);

    // L2 点作者锚 → 真导航 → 头部渲染（真数据）+ 几何 + 关注钮
    await t.evalJs("document.querySelector('[data-cloud-id] .post-author-link').click()");
    await waitFor(t, "window.location.pathname.indexOf('community-profile.html') !== -1", 15000, '作者锚跳转');
    await waitFor(t, "(document.getElementById('profileMain').style.display === 'flex') || (document.getElementById('profileState404').style.display === 'block')", 20000, '主页渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);
    const l2 = await t.evalJs("(() => { var h = document.getElementById('profileHeader'); var b = document.getElementById('profileFollowBtn');" +
      " var s = document.getElementById('slati-sidebar'); var back = document.querySelector('.back-link');" +
      " return { s404: document.getElementById('profileState404').style.display, text: h.textContent.slice(0, 200), hH: h.offsetHeight," +
      " tabs: document.querySelectorAll('#profileTabs [data-tab]').length, hasFollow: !!b, pressed: b ? b.getAttribute('aria-pressed') : null," +
      " hasEdit: !!document.getElementById('profileEditBtn')," +
      " sLen: s.textContent.length, backHref: back ? back.getAttribute('href') : null," +
      " nums: Array.prototype.map.call(h.querySelectorAll('.profile-stat-num'), function (e) { return e.textContent; }).join('/')," +
      " avR: h.querySelector('.profile-avatar').getBoundingClientRect().right, nmL: h.querySelector('h2').getBoundingClientRect().left," +
      " avB: h.querySelector('.profile-avatar').getBoundingClientRect().bottom, nmT: h.querySelector('h2').getBoundingClientRect().top," +
      " pcR: h.querySelector('.profile-counts').getBoundingClientRect().right, ptR: h.querySelector('.profile-top').getBoundingClientRect().right," +
      " bnH: h.querySelector('.profile-banner').getBoundingClientRect().height, bnB: h.querySelector('.profile-banner').getBoundingClientRect().bottom," +
      " bb: getComputedStyle(h.querySelector('.profile-top')).borderBottomWidth," +
      " glassCls: h.querySelector('.profile-header').classList.contains('liquid-glass'), lgLayer: !!h.querySelector('.lg-backdrop')," +
      " wrapCls: h.className, cardBgColor: getComputedStyle(h.querySelector('.profile-header')).backgroundColor }; })()");
    check('L2 主页渲染：非 404 + 头部高度 > 100 + v0.2.22.6 非本人只 2 tab（帖子/转发）+ 统计 2 块 + counts 含获赞', l2.s404 === 'none' && l2.hH > 100 && l2.tabs === 2 && l2.nums.split('/').length === 2 && l2.text.indexOf('获赞') !== -1, 'h=' + l2.hH + ' nums=' + l2.nums + ' text=' + l2.text.slice(0, 80));
    check('L2 头部真数据：名字 + @CIT- + 简介或兜底 + 加入于', l2.text.indexOf('@CIT-') !== -1 && (l2.text.indexOf('这个人很懒，还没有简介') !== -1 || l2.text.indexOf('加入于') !== -1) && l2.text.indexOf('加入于') !== -1, l2.text.slice(0, 100));
    check('L2 关注钮存在（未关注态）+ 侧栏 + 返回链', l2.hasFollow && l2.pressed === 'false' && l2.sLen > 50 && l2.backHref === 'community-hub.html', 'pressed=' + l2.pressed);
    check('L2 v0.2.22.0 非本人主页无编辑资料钮（编辑钮 isSelf 专属）', !l2.hasEdit, 'hasEdit=' + l2.hasEdit);
    check('L2 v0.2.22.2 横排几何：名字列在头像右侧 + 垂直同带', l2.nmL >= l2.avR - 1 && l2.nmT < l2.avB, 'avR=' + l2.avR + ' nmL=' + l2.nmL + ' avB=' + l2.avB + ' nmT=' + l2.nmT);
    check('L2 v0.2.22.3 粉丝关注贴行最右缘（rightEdge≤1）', l2.ptR - l2.pcR <= 1, 'ptR=' + l2.ptR + ' pcR=' + l2.pcR);
    check('L2 v0.2.22.5 横幅可见 + 分割线 1px + 头像行在横幅下方（nmT≥bnB）', l2.bnH >= 100 && l2.bb === '1px' && l2.nmT >= l2.bnB, 'bnH=' + l2.bnH + ' bb=' + l2.bb + ' nmT=' + l2.nmT + ' bnB=' + l2.bnB);
    check('L2 v0.2.23.0 玻璃类与玻璃层一致（默认卡无层 / 有背景则有层）', (l2.glassCls && l2.lgLayer) || (!l2.glassCls && !l2.lgLayer), 'glass=' + l2.glassCls + ' layer=' + l2.lgLayer);
    check('L2 v0.2.24.0 卡片背景层与卡透明一致（card-halo 在 ⇔ 卡身纯透明；无 halo ⇔ 卡回实底）', (l2.wrapCls.indexOf('card-halo') !== -1 && l2.cardBgColor === 'rgba(0, 0, 0, 0)') || (l2.wrapCls.indexOf('card-halo') === -1 && l2.cardBgColor !== 'rgba(0, 0, 0, 0)'), 'wrapCls=' + l2.wrapCls + ' card=' + l2.cardBgColor);

    // L3 关注 401 回滚链：点击 → 服务端 401 → 乐观回滚 + toast 登录已过期
    await t.evalJs("document.getElementById('profileFollowBtn').click()");
    await sleep(800);
    const l3 = await t.evalJs("(() => { var b = document.getElementById('profileFollowBtn');" +
      " return { pressed: b.getAttribute('aria-pressed'), text: b.textContent, toasts: window.__toasts.join('|') }; })()");
    check('L3 关注 401 回滚：回未关注态 + toast 登录已过期', l3.pressed === 'false' && l3.text === '关注' && l3.toasts.indexOf('登录已过期') !== -1, JSON.stringify(l3));

    // L4 tab 走查（真后端；卡片或空态均可，不许 404 报错）——v0.2.22.6 线上恒非本人视角：只走帖子/转发（4 tab 全链本地 G 组自测）
    for (const tab of ['posts', 'reposts']) {
      await t.evalJs("document.querySelector('#profileTabs [data-tab=\"" + tab + "\"]').click()");
      await sleep(900);
      const ok = await t.evalJs("(() => { var l = document.getElementById('profileList');" +
        " return { active: document.querySelector('#profileTabs [data-tab].active').getAttribute('data-tab')," +
        " has: l.querySelectorAll('[data-cloud-id]').length > 0 || l.querySelector('.profile-empty') !== null }; })()");
      check('L4 tab=' + tab + ' 渲染（卡片或空态）', ok.active === tab && ok.has, ok.active);
    }

    // L5 访客零请求：包 fetch 计数 → 清账号重载 → 点关注 → toast + 零 /follow 请求
    await patchFetch(t);
    await clearUser(t);
    await t.send('Page.reload');
    await sleep(1800);
    await waitFor(t, "(document.getElementById('profileMain').style.display === 'flex') || (document.getElementById('profileState404').style.display === 'block')", 20000, '访客重载渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);
    await t.evalJs("window.__fetchCalls = [];");
    await t.evalJs("document.getElementById('profileFollowBtn').click()");
    await sleep(500);
    const l5 = await t.evalJs("(() => { var b = document.getElementById('profileFollowBtn');" +
      " return { toasts: window.__toasts.join('|'), followCalls: window.__fetchCalls.filter(function (c) { return c.url.indexOf('/follow') !== -1; }).length," +
      " guestAttr: b.hasAttribute('data-guest-follow') }; })()");
    check('L5 访客：关注 → toast 登录后才能关注 + 零 /follow 请求', l5.toasts.indexOf('登录后才能关注') !== -1 && l5.followCalls === 0 && l5.guestAttr, JSON.stringify(l5));

    // L6 404（真后端）：未知 id → 404 态
    await nav(t, BASE + '/pages/community-profile.html?id=USR-999999');
    await sleep(1500);
    const l6 = await t.evalJs("(() => { var b = document.getElementById('profileState404'); var m = document.getElementById('profileMain');" +
      " return { s404: b.style.display, main: m.style.display, text: b.querySelector('p').textContent }; })()");
    check('L6 404 态：提示可见 + 主页藏', l6.s404 === 'block' && l6.main === 'none' && l6.text.length > 0, l6.text);

    check('L7 全程 0 console error', errs.length === 0, errs.slice(0, 3).join(' | '));
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
