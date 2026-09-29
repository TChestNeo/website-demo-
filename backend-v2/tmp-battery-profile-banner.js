// tmp-battery-profile-banner.js — v0.2.58.18 个人资料自定义横幅/头像电池（克隆 tmp-battery-community-profile.js 全套 S/G/E/E6/E7/T/C/O/Q + runLive L，另加 B 组 58.18 横幅新链）
// 用户：「能不能把个人资料的自定义横幅/头像做一下」→ 六项钦定：①编辑权限=仅本人（u.isSelf 门控）②图片来源=本地上传+FC 图库双来源（无 URL 输入）
//   ③自动适配零裁剪（横幅约 3:1 宽条居中裁切、头像正方形）④≤10MB 含 gif（jpg/png/webp/gif）⑤头像本轮也加图库入口 ⑥横幅在资料页顶部、头像叠其上（经典布局）。
// 本地：静态壳 + document-start fetch 罐头（每次导航新文档生效——MN_API 底层走 fetch，罐头统一从 fetch 层拦；
//   profile/posts 四 tab/follow/点赞/收藏/转发全罐头；唯一真资源 = /uploads/UPL-DEMO01.jpg 1x1 PNG 供瓦片+灯箱）。
// 线上（LIVE_BASE）：只读侧断言（hub 作者锚→profile 渲染/头部/4 tab 走查/404）+ 关注 401 回滚链 + 访客零请求链
//   ——无凭据不真写（localStorage 种子是纯客户端假登录，服务端无 cookie → follow POST 401 → 乐观回滚 + toast「登录已过期」实测）。
// 58.18 改造点：ME 夹具加 bannerUrl:null；PATCH 罐头加 bannerUrl 同步；S1/L1 版本锚 58.17→58.18；
//   G2/L2 头像几何断言改叠横幅口径（bnB-avT≈36）；E6b labels 加「横幅图片」组；新增 B 组（静态锚/图库空态/图库横幅/移除/上传横幅/图库头像/叠放几何/仅本人/零异常）。
// 跑法：node tmp-battery-profile-banner.js（LIVE_BASE=<完整站点 URL> 跑线上）
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
    cardBg: null, cardPlate: null, pageBgImage: null, cardEdge: null, bannerUrl: null, // v0.2.25.0 页面背景图片（null = 无整页背景）；v0.2.53.1 卡片边缘（null = 默认圆角卡）；v0.2.58.18 横幅图片（029 列，null = 预设渐变）
    stats: { postCount: 1, repostCount: 1, likeReceivedCount: 1, likeCount: 2, favoriteCount: 1 }
  };
  // 他人（USR-000202，bio 空 → 兜底文案；Female → 女；零帖 → 空态；关注链目标；v0.2.23.0 cardBg='glass-rose' 公开渲染他人背景；v0.2.24.1/2 cardPlate='glass-clear' 标准液态玻璃（纯透明）独立背景层）
  var OTHER = {
    id: 'USR-000202', displayName: '电池他人', avatarUrl: null,
    bio: null, gender: 'Female', citizenId: 'CIT-000202', createdAt: '2026-07-15T00:00:00.000Z',
    isSelf: false, followedByMe: false, followerCount: 0, followingCount: 5,
    cardBg: 'glass-rose', cardPlate: 'glass-clear',
    pageBgImage: '/uploads/UPL-DEMO01.jpg', // v0.2.25.0 他人主页公开渲染整页背景（访客也看到本人设置的图）
    stats: { postCount: 0, repostCount: 0, likeReceivedCount: 0, likeCount: null, favoriteCount: null }
  };
  // 他人二（USR-000303，v0.2.53.1 cardEdge='paper' 破旧的纸——访客可见链目标；OTHER 保持不动保护 O1 断言）
  var OTHER2 = {
    id: 'USR-000303', displayName: '边缘访客', avatarUrl: ${JSON.stringify(AVATAR_URI)},
    bio: '边缘主题访客', gender: 'Other', citizenId: 'CIT-000303', createdAt: '2026-06-01T00:00:00.000Z',
    isSelf: false, followedByMe: false, followerCount: 0, followingCount: 0,
    cardBg: null, cardPlate: null, pageBgImage: null,
    cardEdge: 'paper', // v0.2.53.1 他人主页公开渲染边缘剪影（访客也看到本人设置的主题）
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
      if (key === 'GET /api/social/users/USR-000303') return Promise.resolve(res(200, { user: OTHER2 }));
      if (u.indexOf('/api/social/users/USR-999999') === 0) return Promise.resolve(res(404, { error: { message: '用户不存在或已注销' } }));
      // 四 tab（罐头直接回当前数组；点赞/收藏 tab 撤销后清空 → 重拉出空态，实测 maybeReloadTab）
      if (u.indexOf('/api/social/users/USR-000101/posts?tab=') === 0) {
        var tab = u.split('tab=')[1];
        return Promise.resolve(res(200, { posts: TABS[tab] || [] }));
      }
      if (u.indexOf('/api/social/users/USR-000202/posts') === 0) return Promise.resolve(res(200, { posts: [] }));
      if (u.indexOf('/api/social/users/USR-000303/posts') === 0) return Promise.resolve(res(200, { posts: [] }));
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
        // v0.2.25.0 页面背景图片（null 显式入 body → 恢复无整页背景）
        if (pb.pageBgImage !== undefined) ME.pageBgImage = pb.pageBgImage;
        // v0.2.53.1 卡片边缘（null 显式入 body → 恢复默认圆角卡）
        if (pb.cardEdge !== undefined) ME.cardEdge = pb.cardEdge;
        // v0.2.58.18 横幅图片（null 显式入 body → 移除恢复预设渐变）
        if (pb.bannerUrl !== undefined) ME.bannerUrl = pb.bannerUrl;
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
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
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
    check('S1 版本 v0.2.58.19', ver === 'v0.2.58.19', 'ver=' + ver);
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
    check('G2 v0.2.58.18 横排几何：名字列在头像右侧（nmL≥avR-1）+ 名称块自头像下方起行（nmT≥avB-1——头像上移叠横幅后不再垂直同带）', g2.nmL >= g2.avR - 1 && g2.nmT >= g2.avB - 1, 'avR=' + g2.avR + ' nmL=' + g2.nmL + ' avB=' + g2.avB + ' nmT=' + g2.nmT + ' nmB=' + g2.nmB);
    check('G2 v0.2.22.3 粉丝关注贴 .profile-top 行最右缘（rightEdge≤1）+ 在头像右侧（pcL>avR）', g2.ptR - g2.pcR <= 1 && g2.pcL > g2.avR, 'ptR=' + g2.ptR + ' pcR=' + g2.pcR + ' pcL=' + g2.pcL + ' avR=' + g2.avR);
    check('G2 v0.2.58.18 头像叠横幅（经典布局）：横幅可见（h≥100）+ 分割线 1px + 头像顶叠横幅下缘 36px（bnB-avT≈36±16）+ 半身入行内（avB>bnB）', g2.bnH >= 100 && g2.bb === '1px' && g2.avT < g2.bnB && (g2.bnB - g2.avT) >= 20 && (g2.bnB - g2.avT) <= 52 && g2.avB > g2.bnB, 'bnH=' + g2.bnH + ' bb=' + g2.bb + ' avT=' + g2.avT + ' avB=' + g2.avB + ' bnB=' + g2.bnB);

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
      " var pgSw = document.querySelectorAll('#editPageBgGrid [data-pagebg]');" +
      " var flat = document.querySelector('#editTabCustom .edit-bg-flat'); var pv = document.getElementById('editPlatePreview');" +
      " var pvCard = pv.querySelector('.pv-card');" +
      " return { active: document.querySelector('#editNavBtns [data-edit-tab].active').getAttribute('data-edit-tab')," +
      " basicVis: getComputedStyle(basic).display, customVis: getComputedStyle(custom).display, labels: labels," +
      " bgN: bgSw.length, bgLabels: Array.prototype.map.call(bgSw, function (x) { return x.querySelector('.swatch-label').textContent; }).join('|')," +
      " bgFirstActive: bgSw[0].classList.contains('active'), flatCls: flat.className, flatBg: getComputedStyle(flat).backgroundImage," +
      " plN: plSw.length, plLabels: Array.prototype.map.call(plSw, function (x) { return x.querySelector('.swatch-label').textContent; }).join('|')," +
      " plFirstActive: plSw[0].classList.contains('active'), pvCls: pv.className, pvBg: getComputedStyle(pv).backgroundImage," +
      " pvCardBgColor: getComputedStyle(pvCard).backgroundColor," +
      " pgN: pgSw.length, pgLabels: Array.prototype.map.call(pgSw, function (x) { return x.querySelector('.swatch-label').textContent; }).join('|')," +
      " pgFirstActive: pgSw[0].classList.contains('active') }; })()");
    check('E6 切自定义：互斥显示 + 五组（横幅（液体玻璃）|横幅图片|卡片背景|边缘|页面背景——v0.2.58.18 新横幅图片组）+ 横幅 7 预设 + v0.2.24.1 卡片背景只 2 选项（默认|标准液态玻璃）默认选中 + v0.2.25.0 页面背景 2 选项（默认|自定义图片）默认选中', e6b.active === 'custom' && e6b.basicVis === 'none' && e6b.customVis !== 'none' && e6b.labels === '横幅（液体玻璃）|横幅图片|卡片背景|边缘|页面背景' && e6b.bgN === 7 && e6b.bgLabels === '默认|磨砂|深海|薰衣草|樱花|薄荷|落日' && e6b.bgFirstActive && e6b.plN === 2 && e6b.plLabels === '默认|标准液态玻璃' && e6b.plFirstActive && e6b.pgN === 2 && e6b.pgLabels === '默认|自定义图片' && e6b.pgFirstActive, JSON.stringify(e6b));
    check('E6 v0.2.24.0 预览默认：横幅条=品牌渐变 + 卡片背景预览无 has-plate 无背景 + 迷你透明卡身', e6b.flatCls === 'edit-bg-flat bg-default' && e6b.flatBg.indexOf('linear-gradient') !== -1 && e6b.pvCls === 'edit-bg-preview' && e6b.pvBg === 'none' && e6b.pvCardBgColor === 'rgba(0, 0, 0, 0)', 'flat=' + e6b.flatCls + ' pvCls=' + e6b.pvCls + ' pvBg=' + e6b.pvBg + ' pvCard=' + e6b.pvCardBgColor);

    // E6c 横幅组点深海：active 唯一互斥 + 横幅条换类换渐变
    await t.evalJs("document.querySelector('#editBgGrid [data-bg=\"glass-ocean\"]').click()");
    await sleep(300);
    const e6c = await t.evalJs("(() => { var active = document.querySelectorAll('#editBgGrid [data-bg].active');" +
      " var flat = document.querySelector('#editTabCustom .edit-bg-flat');" +
      " return { activeCount: active.length, activeBg: active[0] ? active[0].getAttribute('data-bg') : null," +
      " flatCls: flat.className, flatBg: getComputedStyle(flat).backgroundImage }; })()");
    check('E6 横幅组点深海：active 唯一互斥 + 横幅条同步深海渐变', e6c.activeCount === 1 && e6c.activeBg === 'glass-ocean' && e6c.flatCls === 'edit-bg-flat glass-ocean' && e6c.flatBg.indexOf('linear-gradient') !== -1 && e6c.flatBg.indexOf('rgba(30, 90, 200') !== -1, JSON.stringify(e6c));

    // E6c2 v0.2.24.1/2 卡片背景组点标准液态玻璃（两组各选各的互不影响）：包层预览 has-plate 纯透明填充（v0.2.24.2 白磨砂移除）+ 代码白边环 2px + 柔影 + 透明卡身透出
    await t.evalJs("document.querySelector('#editPlateGrid [data-plate=\"glass-clear\"]').click()");
    await sleep(300);
    const e6c2 = await t.evalJs("(() => { var active = document.querySelectorAll('#editPlateGrid [data-plate].active');" +
      " var pv = document.getElementById('editPlatePreview'); var pvCard = pv.querySelector('.pv-card');" +
      " var flat = document.querySelector('#editTabCustom .edit-bg-flat');" +
      " var sw = document.querySelector('#editPlateGrid [data-plate=\"glass-clear\"] .swatch-fill');" +
      " return { activeCount: active.length, activePlate: active[0] ? active[0].getAttribute('data-plate') : null," +
      " pvCls: pv.className, pvBg: getComputedStyle(pv).backgroundImage, pvBgColor: getComputedStyle(pv).backgroundColor, pvShadow: getComputedStyle(pv).boxShadow," +
      " pvCardBgColor: getComputedStyle(pvCard).backgroundColor, flatCls: flat.className," +
      " pvOrbB: getComputedStyle(pvCard, '::before').backgroundImage, pvOrbA: getComputedStyle(pvCard, '::after').backgroundImage," +
      " pvShMix: getComputedStyle(pv, '::before').mixBlendMode, pvShBg: getComputedStyle(pv, '::before').backgroundImage, pvShTop: getComputedStyle(pv, '::before').top," +
      " swShadow: getComputedStyle(sw).boxShadow }; })()");
    check('E6 卡片背景组点标准液态玻璃：active 唯一互斥 + 包层预览 has-plate glass-clear 真液态玻璃霜体（无色极轻白霜 gradient 在 + 三色相 30,90,200/232,110,160/96,100,230 均不在）+ 透明卡身透出 + 横幅组不受影响（仍深海）+ v0.2.25.2 预览无默认底色', e6c2.activeCount === 1 && e6c2.activePlate === 'glass-clear' && e6c2.pvCls === 'edit-bg-preview has-plate glass-clear' && e6c2.pvBg.indexOf('linear-gradient') !== -1 && e6c2.pvBg.indexOf('rgba(255, 255, 255') !== -1 && e6c2.pvBg.indexOf('30, 90, 200') === -1 && e6c2.pvBg.indexOf('232, 110, 160') === -1 && e6c2.pvBg.indexOf('96, 100, 230') === -1 && e6c2.pvBgColor === 'rgba(0, 0, 0, 0)' && e6c2.pvCardBgColor === 'rgba(0, 0, 0, 0)' && e6c2.flatCls === 'edit-bg-flat glass-ocean', JSON.stringify(e6c2));
    check('E6 v0.2.24.1 标准液态玻璃预览=代码白边环 2px（rgba(255,255,255,0.8) inset）+ 柔影（0 4px 12px rgba(0,0,0,0.4)）', e6c2.pvShadow.indexOf('rgba(255, 255, 255, 0.8)') !== -1 && e6c2.pvShadow.indexOf('inset') !== -1 && e6c2.pvShadow.indexOf('rgba(0, 0, 0, 0.4)') !== -1, e6c2.pvShadow);
    check('E6 v0.2.24.2 标准液态玻璃色块=透明填充+白边环 2px+柔影（代码同款示意）', e6c2.swShadow.indexOf('rgba(255, 255, 255, 0.8)') !== -1 && e6c2.swShadow.indexOf('inset') !== -1 && e6c2.swShadow.indexOf('rgba(0, 0, 0, 0.4)') !== -1, e6c2.swShadow);
    check('E6 v0.2.24.4 预览玻璃光球：无色双白光球在透明卡身内（玻璃后面有光的示意；用户「为什么这个玻璃会有蓝色和紫色在背面能不能去掉」→光球去色纯白，蓝紫色值均不在）', e6c2.pvOrbB.indexOf('255, 255, 255') !== -1 && e6c2.pvOrbA.indexOf('255, 255, 255') !== -1 && e6c2.pvOrbB.indexOf('96, 165, 250') === -1 && e6c2.pvOrbA.indexOf('167, 139, 250') === -1, e6c2.pvOrbB + ' | ' + e6c2.pvOrbA);
    check('E6 v0.2.25.1 预览迷你双层环形高光（与大卡同配方缩小版：screen 混合+135° 白渐变+环贴卡缘 top=6px）', e6c2.pvShMix === 'screen' && e6c2.pvShBg.indexOf('135deg') !== -1 && e6c2.pvShTop === '6px', JSON.stringify({ mix: e6c2.pvShMix, bg: e6c2.pvShBg.slice(0, 60), top: e6c2.pvShTop }));

    // E6d 保存 → PATCH 带 cardBg+cardPlate 双字段 + 弹窗关 → 头部双背景重拉（横幅=卡上深海、卡片背景=包层标准液态玻璃无色、卡身纯透明）
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const e6d = await t.evalJs("(() => { var w = document.getElementById('profileHeader');" +
      " var h = w.querySelector('.profile-header'); var card = document.querySelector('.modal-card');" +
      " var haloBack = w.querySelector(':scope > .lg-backdrop');" +
      " var orb = w.querySelector(':scope > .lg-orb-field'); var sp = w.querySelector(':scope > .lg-specular');" +
      " var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " return { cardGone: !card || !card.parentNode, rawCalls: rawCalls," +
      " glass: h.classList.contains('liquid-glass'), cls: h.className, attr: h.getAttribute('data-card-bg')," +
      " layer: !!h.querySelector('.lg-backdrop'), spec: !!h.querySelector('.lg-specular')," +
      " layerFilter: h.querySelector('.lg-backdrop') ? (getComputedStyle(h.querySelector('.lg-backdrop')).backdropFilter || getComputedStyle(h.querySelector('.lg-backdrop')).webkitBackdropFilter) : null," +
      " layerFilterUrl: h.querySelector('.lg-backdrop') ? getComputedStyle(h.querySelector('.lg-backdrop')).filter : null," +
      " cardBgColor: getComputedStyle(h).backgroundColor, bannerBgImg: getComputedStyle(h.querySelector('.profile-banner')).backgroundImage," +
      " wrapCls: w.className, wrapBg: getComputedStyle(w).backgroundImage, wrapBgColor: getComputedStyle(w).backgroundColor," +
      " wrapShadow: getComputedStyle(w).boxShadow," +
      " wrapLg: w.classList.contains('lg-static'), wrapLayer: !!haloBack, wrapSpec: !!sp," +
      " haloLayerFilter: haloBack ? (getComputedStyle(haloBack).backdropFilter || getComputedStyle(haloBack).webkitBackdropFilter) : null," +
      " haloLayerFilterUrl: haloBack ? getComputedStyle(haloBack).filter : null," +
      " orb: !!orb, orbVis: orb ? getComputedStyle(orb).display : null," +
      " orbB: orb ? getComputedStyle(orb, '::before').backgroundImage : null, orbA: orb ? getComputedStyle(orb, '::after').backgroundImage : null," +
      " specBg: sp ? getComputedStyle(sp).backgroundImage : null," +
      " shBefMix: getComputedStyle(w, '::before').mixBlendMode, shAftMix: getComputedStyle(w, '::after').mixBlendMode," +
      " shBefBg: getComputedStyle(w, '::before').backgroundImage, shAftBg: getComputedStyle(w, '::after').backgroundImage," +
      " shBefTop: getComputedStyle(w, '::before').top, shBefPad: getComputedStyle(w, '::before').paddingTop," +
      " shMask: (getComputedStyle(w, '::before').webkitMaskComposite || getComputedStyle(w, '::before').maskComposite)," +
      " shBefContent: getComputedStyle(w, '::before').content," +
      " toasts: window.__toasts.join('|') }; })()");
    console.log('E6d raw PATCH bodies:', JSON.stringify(e6d.rawCalls));
    // 全会话累积的 PATCH 里，含 cardBg 的恰 1 次且 body 精确双字段（无 avatarUrl/语言/国家回流）
    const e6dCardBgCalls = e6d.rawCalls.filter(function (b) { return b.indexOf('cardBg') !== -1; });
    check('E6 保存 → PATCH 含 cardBg 恰 1 次且 body 精确 ={"cardBg":"glass-ocean","cardPlate":"glass-clear"}+ 弹窗关 + toast', e6dCardBgCalls.length === 1 && e6dCardBgCalls[0] === '{"cardBg":"glass-ocean","cardPlate":"glass-clear"}' && e6d.cardGone && e6d.toasts.indexOf('资料已保存') !== -1, JSON.stringify(e6dCardBgCalls));
    check('E6 头部重拉挂液体玻璃：liquid-glass + glass-ocean 类 + data-card-bg + 折射/高光双层', e6d.glass && e6d.cls.indexOf('glass-ocean') !== -1 && e6d.attr === 'glass-ocean' && e6d.layer && e6d.spec, JSON.stringify({ glass: e6d.glass, cls: e6d.cls, attr: e6d.attr, layer: e6d.layer, spec: e6d.spec }));
    check('E6 玻璃层 backdrop-filter 生效（blur 10px + saturate；v0.2.53.2 生成器代码口径 14→10）+ v0.2.53.2 折射滤镜=url("#glass-distortion")（噪点波动折射，覆盖引擎三通道色散——无色散不发黄）', e6d.layerFilter && e6d.layerFilter.indexOf('blur(10px)') !== -1 && e6d.layerFilter.indexOf('saturate') !== -1 && e6d.layerFilterUrl && e6d.layerFilterUrl.indexOf('url("#glass-distortion")') !== -1, JSON.stringify({ layerFilter: e6d.layerFilter, layerFilterUrl: e6d.layerFilterUrl }));
    check('E6 v0.2.24.3 独立双背景：横幅=卡上深海渐变 + 卡片背景=包层 card-halo glass-clear lg-static（引擎类在）+ 真液态玻璃霜体（无色极轻白霜 gradient 在 + 三色相均不在）+ 卡身纯透明直透页面', e6d.bannerBgImg.indexOf('linear-gradient') !== -1 && e6d.bannerBgImg.indexOf('rgba(30, 90, 200') !== -1 && e6d.wrapCls === 'card-halo glass-clear lg-static' && e6d.wrapBg.indexOf('linear-gradient') !== -1 && e6d.wrapBg.indexOf('rgba(255, 255, 255') !== -1 && e6d.wrapBg.indexOf('30, 90, 200') === -1 && e6d.wrapBg.indexOf('232, 110, 160') === -1 && e6d.wrapBg.indexOf('96, 100, 230') === -1 && e6d.cardBgColor === 'rgba(0, 0, 0, 0)', 'banner=' + e6d.bannerBgImg.slice(0, 50) + ' wrapCls=' + e6d.wrapCls + ' wrapBg=' + e6d.wrapBg.slice(0, 80) + ' card=' + e6d.cardBgColor);
    check('E6 v0.2.25.2 默认底色移除：包层背景色透明（横幅以外彻底透到页面——用户「默认的那个背景你也没在标准液态玻璃背景的情况下除了横幅以外的移除啊」）', e6d.wrapBgColor === 'rgba(0, 0, 0, 0)', 'wrapBgColor=' + e6d.wrapBgColor);
    check('E6 v0.2.24.3 真液态玻璃引擎挂包层：lg-static 类 + 折射层 .lg-backdrop + 镜面高光 .lg-specular 双注入 + 层磨砂 10px saturate（v0.2.53.2 生成器代码口径 24→10）+ 同款波动折射滤镜 url("#glass-distortion")', e6d.wrapLg && e6d.wrapLayer && e6d.wrapSpec && e6d.haloLayerFilter && e6d.haloLayerFilter.indexOf('blur(10px)') !== -1 && e6d.haloLayerFilter.indexOf('saturate') !== -1 && e6d.haloLayerFilterUrl && e6d.haloLayerFilterUrl.indexOf('url("#glass-distortion")') !== -1, JSON.stringify({ wrapLg: e6d.wrapLg, wrapLayer: e6d.wrapLayer, wrapSpec: e6d.wrapSpec, haloLayerFilter: e6d.haloLayerFilter, haloLayerFilterUrl: e6d.haloLayerFilterUrl }));
    check('E6 v0.2.24.4 玻璃光场亮起：.lg-orb-field 在包层内 display=block + 无色双白光球（蓝紫 96,165,250/167,139,250 均不在——用户去色）+ 高光层斜向流光', e6d.orb && e6d.orbVis === 'block' && e6d.orbB.indexOf('255, 255, 255') !== -1 && e6d.orbA.indexOf('255, 255, 255') !== -1 && e6d.orbB.indexOf('96, 165, 250') === -1 && e6d.orbA.indexOf('167, 139, 250') === -1 && e6d.specBg.indexOf('linear-gradient') !== -1, JSON.stringify({ orb: e6d.orb, orbVis: e6d.orbVis, orbB: e6d.orbB, orbA: e6d.orbA, specBg: e6d.specBg.slice(0, 60) }));
    check('E6 v0.2.24.1 标准液态玻璃包层=代码白边环 2px（rgba(255,255,255,0.8) inset）+ 柔影（0 4px 12px rgba(0,0,0,0.4)）', e6d.wrapShadow.indexOf('rgba(255, 255, 255, 0.8)') !== -1 && e6d.wrapShadow.indexOf('inset') !== -1 && e6d.wrapShadow.indexOf('rgba(0, 0, 0, 0.4)') !== -1, e6d.wrapShadow);
    check('E6 v0.2.25.1 rdev 双层环形高光原值移植：::before screen 0.2 / ::after overlay（index.tsx Border layer 1/2 原值）+ 白渐变 135° 双环 + 1.5px 异或环贴卡缘（top=6px=包层 padding）+ 光球提亮 0.85/0.75（用户「还是一样没有」——任何背景下可见的玻璃招牌层）', e6d.shBefContent !== 'none' && e6d.shBefMix === 'screen' && e6d.shAftMix === 'overlay' && e6d.shBefBg.indexOf('linear-gradient') !== -1 && e6d.shAftBg.indexOf('linear-gradient') !== -1 && e6d.shBefBg.indexOf('135deg') !== -1 && e6d.shBefTop === '6px' && e6d.shBefPad === '1.5px' && (e6d.shMask.indexOf('xor') !== -1 || e6d.shMask.indexOf('exclude') !== -1) && e6d.orbB.indexOf('0.85') !== -1 && e6d.orbA.indexOf('0.75') !== -1, JSON.stringify({ bMix: e6d.shBefMix, aMix: e6d.shAftMix, bBg: e6d.shBefBg.slice(0, 60), top: e6d.shBefTop, pad: e6d.shBefPad, mask: e6d.shMask, content: e6d.shBefContent, orbB: e6d.orbB.slice(0, 60), orbA: e6d.orbA.slice(0, 60) }));

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
    const e6f = await t.evalJs("(() => { var w = document.getElementById('profileHeader');" +
      " var h = w.querySelector('.profile-header');" +
      " var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " return { rawCalls: rawCalls, glass: h.classList.contains('liquid-glass'), attr: h.hasAttribute('data-card-bg'), cls: h.className," +
      " cardBgColor: getComputedStyle(h).backgroundColor, bannerBgImg: getComputedStyle(h.querySelector('.profile-banner')).backgroundImage," +
      " wrapCls: w.className, wrapLg: w.classList.contains('lg-static'), wrapLayer: !!w.querySelector(':scope > .lg-backdrop')," +
      " orbVis: w.querySelector(':scope > .lg-orb-field') ? getComputedStyle(w.querySelector(':scope > .lg-orb-field')).display : null }; })()");
    console.log('E6f raw PATCH bodies:', JSON.stringify(e6f.rawCalls));
    // 含 cardBg 的调用共 2 次（双设 → 双 null），最后一次 body 精确 ={"cardBg":null,"cardPlate":null}
    const e6fCardBgCalls = e6f.rawCalls.filter(function (b) { return b.indexOf('cardBg') !== -1; });
    check('E6 双双选默认 → 保存 → 最后 PATCH body 精确 ={"cardBg":null,"cardPlate":null} + 头部回默认（无 liquid-glass/无 data-card-bg/无预设类）', e6fCardBgCalls.length === 2 && e6fCardBgCalls[e6fCardBgCalls.length - 1] === '{"cardBg":null,"cardPlate":null}' && !e6f.glass && !e6f.attr && e6f.cls.indexOf('glass-') === -1, JSON.stringify(e6fCardBgCalls));
    check('E6 v0.2.24.0 回默认 → 包层类清空（无 card-halo）+ 卡身回实底（非透明）+ 横幅回品牌渐变 + v0.2.24.3 引擎层已卸载（无 lg-static/无 .lg-backdrop）+ v0.2.24.4 光场灭（orb display=none）', e6f.wrapCls === '' && !e6f.wrapLg && !e6f.wrapLayer && e6f.orbVis === 'none' && e6f.cardBgColor !== 'rgba(0, 0, 0, 0)' && e6f.bannerBgImg !== 'none' && e6f.bannerBgImg.indexOf('linear-gradient') !== -1, 'wrapCls=' + e6f.wrapCls + ' wrapLg=' + e6f.wrapLg + ' wrapLayer=' + e6f.wrapLayer + ' orbVis=' + e6f.orbVis + ' card=' + e6f.cardBgColor + ' banner=' + e6f.bannerBgImg.slice(0, 60));

    // E6f2 v0.2.53.2 液态玻璃换代（用户贴的生成器代码）：横幅单独玻璃——无包层、卡身白霜 0.34、层折射滤镜=glass-distortion、磨砂 10px → 恢复默认
    await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
    await t.evalJs("document.querySelector('#editBgGrid [data-bg=\"glass-ocean\"]').click()");
    await sleep(300);
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const e6f2 = await t.evalJs("(() => { var w = document.getElementById('profileHeader');" +
      " var h = w.querySelector('.profile-header'); var back = h.querySelector('.lg-backdrop');" +
      " var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " return { rawCalls: rawCalls, wrapCls: w.className, cls: h.className, glass: h.classList.contains('liquid-glass')," +
      " attr: h.getAttribute('data-card-bg'), layer: !!back," +
      " layerFilter: back ? (getComputedStyle(back).backdropFilter || getComputedStyle(back).webkitBackdropFilter) : null," +
      " layerFilterUrl: back ? getComputedStyle(back).filter : null," +
      " cardBgColor: getComputedStyle(h).backgroundColor, orbVis: w.querySelector(':scope > .lg-orb-field') ? getComputedStyle(w.querySelector(':scope > .lg-orb-field')).display : null }; })()");
    console.log('E6f2 raw PATCH bodies:', JSON.stringify(e6f2.rawCalls));
    const e6f2CardBgCalls = e6f2.rawCalls.filter(function (b) { return b.indexOf('cardBg') !== -1; });
    check('E6f2 v0.2.53.2 横幅单独玻璃保存：最后 PATCH body 精确 ={"cardBg":"glass-ocean"}（cardPlate 未动不入 body）', e6f2CardBgCalls.length >= 1 && e6f2CardBgCalls[e6f2CardBgCalls.length - 1] === '{"cardBg":"glass-ocean"}', JSON.stringify(e6f2CardBgCalls));
    check('E6f2 v0.2.53.2 横幅单独玻璃渲染：无 card-halo 包层 + liquid-glass + glass-ocean + 引擎折射层在 + 磨砂 blur 10px saturate（生成器代码口径）+ 折射滤镜=url("#glass-distortion")（低频噪点+高斯模糊+标准双通道位移，无色散）+ 光场灭（无包层）', e6f2.wrapCls === '' && e6f2.glass && e6f2.cls.indexOf('glass-ocean') !== -1 && e6f2.attr === 'glass-ocean' && e6f2.layer && e6f2.layerFilter.indexOf('blur(10px)') !== -1 && e6f2.layerFilter.indexOf('saturate') !== -1 && e6f2.layerFilterUrl.indexOf('url("#glass-distortion")') !== -1 && e6f2.orbVis === 'none', JSON.stringify({ wrapCls: e6f2.wrapCls, cls: e6f2.cls, layerFilter: e6f2.layerFilter, layerFilterUrl: e6f2.layerFilterUrl, orbVis: e6f2.orbVis }));
    check('E6f2 v0.2.53.2 卡身白霜 rgba(255, 255, 255, 0.34)（生成器 ::before 白 tint 同思路，卡身有实底调高到 0.34 才透出磨砂折射层见玻璃；暗色 0.58 见 Q 静态锚）', e6f2.cardBgColor === 'rgba(255, 255, 255, 0.34)', e6f2.cardBgColor);
    // 恢复默认（重开 → 横幅默认 → 保存 → 最后 PATCH cardBg:null；E6g 起的后续阶段不受污染）
    await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
    await t.evalJs("document.querySelector('#editBgGrid [data-bg=\"\"]').click()");
    await sleep(300);
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const e6f2r = await t.evalJs("(() => { var h = document.querySelector('#profileHeader .profile-header');" +
      " var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " return { rawCalls: rawCalls, glass: h.classList.contains('liquid-glass'), cls: h.className, cardBgColor: getComputedStyle(h).backgroundColor }; })()");
    const e6f2rCardBgCalls = e6f2r.rawCalls.filter(function (b) { return b.indexOf('cardBg') !== -1; });
    check('E6f2 v0.2.53.2 恢复默认：最后 PATCH body 精确 ={"cardBg":null} + 头部回默认（无 liquid-glass/无预设类）+ 卡身回实底（白霜卸下）', e6f2rCardBgCalls[e6f2rCardBgCalls.length - 1] === '{"cardBg":null}' && !e6f2r.glass && e6f2r.cls.indexOf('glass-') === -1 && e6f2r.cardBgColor !== 'rgba(255, 255, 255, 0.34)', JSON.stringify({ calls: e6f2rCardBgCalls, cls: e6f2r.cls, cardBgColor: e6f2r.cardBgColor }));

    // E6g v0.2.25.0 页面背景组（独立弹窗会话——E6d/E6f 的 cardBg PATCH 精确断言不受 pageBgImage 污染）：
    //   弹窗放大 1 倍 → 默认选中 → 点自定义 → 网址非法警告 → 合法网址预览 → 保存 → body 整页背景 → 重开预填 → 默认 → 保存恢复
    await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
    const e6g = await t.evalJs("(() => { var card = document.querySelector('.modal-card');" +
      " return { modalMw: getComputedStyle(card).maxWidth, modalCls: card.className," +
      " rowVis: getComputedStyle(document.getElementById('editPageBgRow')).display," +
      " innerBg: document.getElementById('editPageBgInner').style.backgroundImage," +
      " hasUploadBtn: !!document.getElementById('editPageBgUploadBtn'), hasUrlInput: !!document.getElementById('editPageBgUrlInput')," +
      " hasFile: !!document.getElementById('editPageBgFile')," +
      " pvHasCard: !!document.getElementById('editPageBgInner').querySelector('.pv-card') }; })()");
    check('E6 v0.2.25.0 编辑资料弹窗放大 1 倍：modal-card max-width=1120px（560→1120；页级类 edit-profile-card 不污染灯箱/分享弹窗）', e6g.modalMw === '1120px' && e6g.modalCls.indexOf('edit-profile-card') !== -1, 'mw=' + e6g.modalMw + ' cls=' + e6g.modalCls);
    check('E6 v0.2.25.0 页面背景组默认态：上传按钮/网址框/隐藏 file input/迷你整页预览就位 + 无图时行隐藏预览空', e6g.hasUploadBtn && e6g.hasUrlInput && e6g.hasFile && e6g.pvHasCard && e6g.rowVis === 'none' && e6g.innerBg === '', JSON.stringify(e6g));
    // 点自定义图片 → 行亮起 + 提示
    await t.evalJs("document.querySelector('#editPageBgGrid [data-pagebg=\"custom\"]').click()");
    await sleep(300);
    const e6g1 = await t.evalJs("(() => { var row = document.getElementById('editPageBgRow');" +
      " return { rowVis: getComputedStyle(row).display, hint: document.getElementById('editPageBgState').textContent," +
      " customActive: document.querySelector('#editPageBgGrid [data-pagebg].active').getAttribute('data-pagebg') }; })()");
    check('E6 v0.2.25.0 点自定义图片：行亮起 + 提示「上传图片或粘贴网址，点保存生效」+ 自定义 active 唯一', e6g1.rowVis !== 'none' && e6g1.hint.indexOf('上传图片或粘贴网址') !== -1 && e6g1.customActive === 'custom', JSON.stringify(e6g1));
    // 网址非法（javascript:）→ 警告 + 预览不挂图（防 CSS 注入）
    await t.evalJs("var inp = document.getElementById('editPageBgUrlInput'); inp.value = 'javascript:alert(1)'; inp.dispatchEvent(new Event('input'))");
    await sleep(300);
    const e6g2 = await t.evalJs("(() => { return { warn: document.getElementById('editPageBgState').textContent, innerBg: document.getElementById('editPageBgInner').style.backgroundImage }; })()");
    check('E6 v0.2.25.0 网址非法（javascript:）→ 警告「网址需以 http:// 或 https:// 开头」+ 预览不挂图', e6g2.warn.indexOf('http://') !== -1 && e6g2.innerBg === '', JSON.stringify(e6g2));
    // 合法网址 → 预览挂图 → 保存 → PATCH body 精确 ={"pageBgImage":"https://example.com/bg.jpg"} → 弹窗关 → body 整页背景
    await t.evalJs("var inp = document.getElementById('editPageBgUrlInput'); inp.value = 'https://example.com/bg.jpg'; inp.dispatchEvent(new Event('input'))");
    await sleep(300);
    const e6g3 = await t.evalJs("(() => { var inner = document.getElementById('editPageBgInner');" +
      " return { innerBg: inner.style.backgroundImage, state: document.getElementById('editPageBgState').textContent }; })()");
    check('E6 v0.2.25.0 合法网址：预览挂图 url("https://example.com/bg.jpg") + 就绪文案', e6g3.innerBg.indexOf('url("https://example.com/bg.jpg")') !== -1 && e6g3.state.indexOf('就绪') !== -1, JSON.stringify(e6g3));
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const e6g4 = await t.evalJs("(() => { var card = document.querySelector('.modal-card');" +
      " var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " var cs = getComputedStyle(document.body);" +
      " return { cardGone: !card || !card.parentNode, rawCalls: rawCalls," +
      " cls: document.body.className, bodyBg: cs.backgroundImage, cssVar: cs.getPropertyValue('--page-bg-image') }; })()");
    console.log('E6g4 raw PATCH bodies:', JSON.stringify(e6g4.rawCalls));
    const e6g4PgCalls = e6g4.rawCalls.filter(function (b) { return b.indexOf('pageBgImage') !== -1; });
    check('E6 v0.2.25.0 保存 → PATCH 含 pageBgImage 恰 1 次且 body 精确 ={"pageBgImage":"https://example.com/bg.jpg"} + 弹窗关', e6g4PgCalls.length === 1 && e6g4PgCalls[0] === '{"pageBgImage":"https://example.com/bg.jpg"}' && e6g4.cardGone, JSON.stringify(e6g4PgCalls));
    check('E6 v0.2.25.0 整页背景渲染：body 挂 page-bg-active + 背景=深色蒙层渐变 rgba(10, 10, 16, 0.38)+图（用户「这个就是整个页面的背景的图片」）', e6g4.cls.indexOf('page-bg-active') !== -1 && e6g4.bodyBg.indexOf('rgba(10, 10, 16, 0.38)') !== -1 && e6g4.bodyBg.indexOf('url("https://example.com/bg.jpg")') !== -1 && e6g4.cssVar.indexOf('url("https://example.com/bg.jpg")') !== -1, 'cls=' + e6g4.cls + ' bg=' + e6g4.bodyBg.slice(0, 150) + ' var=' + e6g4.cssVar);
    // 重开 → 页面背景组预填（自定义 active + 网址框预填 + 预览挂图）→ 点默认 → 保存 → PATCH ={"pageBgImage":null} → body 恢复
    await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
    const e6g5 = await t.evalJs("(() => { var active = document.querySelector('#editPageBgGrid [data-pagebg].active');" +
      " return { activePg: active ? active.getAttribute('data-pagebg') : null," +
      " urlVal: document.getElementById('editPageBgUrlInput').value," +
      " innerBg: document.getElementById('editPageBgInner').style.backgroundImage," +
      " rowVis: getComputedStyle(document.getElementById('editPageBgRow')).display }; })()");
    check('E6 v0.2.25.0 重开预填：自定义 active + 网址框预填 https 值 + 预览挂图 + 行亮起', e6g5.activePg === 'custom' && e6g5.urlVal === 'https://example.com/bg.jpg' && e6g5.innerBg.indexOf('url("https://example.com/bg.jpg")') !== -1 && e6g5.rowVis !== 'none', JSON.stringify(e6g5));
    await t.evalJs("document.querySelector('#editPageBgGrid [data-pagebg=\"\"]').click()");
    await sleep(300);
    const e6g6 = await t.evalJs("(() => { return { rowVis: getComputedStyle(document.getElementById('editPageBgRow')).display, innerBg: document.getElementById('editPageBgInner').style.backgroundImage }; })()");
    check('E6 v0.2.25.0 点默认：行隐藏 + 预览清空', e6g6.rowVis === 'none' && e6g6.innerBg === '', JSON.stringify(e6g6));
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const e6g7 = await t.evalJs("(() => { var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " var cs = getComputedStyle(document.body);" +
      " return { rawCalls: rawCalls, cls: document.body.className, bodyBg: cs.backgroundImage, cssVar: cs.getPropertyValue('--page-bg-image') }; })()");
    console.log('E6g7 raw PATCH bodies:', JSON.stringify(e6g7.rawCalls));
    const e6g7PgCalls = e6g7.rawCalls.filter(function (b) { return b.indexOf('pageBgImage') !== -1; });
    check('E6 v0.2.25.0 选默认保存 → 最后 PATCH body 精确 ={"pageBgImage":null}（共 2 次 pageBgImage 调用）+ body 恢复（无 page-bg-active 类/变量空/无图）', e6g7PgCalls.length === 2 && e6g7PgCalls[e6g7PgCalls.length - 1] === '{"pageBgImage":null}' && e6g7.cls.indexOf('page-bg-active') === -1 && e6g7.cssVar === '' && e6g7.bodyBg.indexOf('example.com') === -1, JSON.stringify(e6g7PgCalls) + ' cls=' + e6g7.cls + ' var=' + e6g7.cssVar);

    // ── E7 v0.2.53.1 卡片边缘主题（订阅专属 + 编辑流程；独立弹窗会话——新断言按 body 键过滤保护 E6 精确 PATCH 断言）──
    //   free 会话（seedUser 无 tier）：锁链 → 点 paper 只 toast 不生效；subscriber 会话（slati_user 加 tier）：无锁 → paper/tech1/paint5/默认 全链
    await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
    const e7a = await t.evalJs("(() => { var grid = document.getElementById('editEdgeGrid');" +
      " var locked = grid.querySelectorAll('[data-edge].edge-locked');" +
      " var link = document.getElementById('cardEdgeUpgradeLink');" +
      " var active = grid.querySelector('[data-edge].active');" +
      " return { n: grid.querySelectorAll('[data-edge]').length, lockedN: locked.length," +
      " lockedTitle: locked.length ? locked[0].getAttribute('title') : null," +
      " badge: locked.length ? locked[0].querySelector('.swatch-label').textContent : ''," +
      " hasLockIcon: locked.length ? !!locked[0].querySelector('.material-symbols-outlined') : false," +
      " linkVis: getComputedStyle(link).display," +
      " shapes: Array.prototype.map.call(grid.querySelectorAll('[data-edge]:not([data-edge=\"\"]) .swatch-shape'), function (s) { return getComputedStyle(s).clipPath; }).join('|')," +
      " active: active ? active.getAttribute('data-edge') : null, pv: document.getElementById('editEdgePreview').className }; })()");
    check('E7 v0.2.53.1 免费会话：边缘组 15 swatch（默认+14 款）+ 14 非空款全锁（edge-locked+title 订阅后可用+lock 图标+订阅徽标）+ 升级链接可见 + 默认 active + 预览默认', e7a.n === 15 && e7a.lockedN === 14 && e7a.lockedTitle === '订阅后可用' && e7a.badge.indexOf('订阅') !== -1 && e7a.hasLockIcon && e7a.linkVis !== 'none' && e7a.active === '' && e7a.pv === 'pv-card', JSON.stringify(e7a));
    check('E7 v0.2.53.1 swatch 真实剪影：14 款 .swatch-shape computed clip-path 各含对应 defs（纸/藏宝图/科技1-6/油漆1-6）', e7a.shapes === ['url("#paper-edge-clip")', 'url("#map-wave-clip")', 'url("#hud-frame-1")', 'url("#hud-frame-2")', 'url("#hud-frame-3")', 'url("#hud-frame-4")', 'url("#hud-frame-5")', 'url("#hud-frame-6")', 'url("#mn-paint-clip-1")', 'url("#mn-paint-clip-2")', 'url("#mn-paint-clip-3")', 'url("#mn-paint-clip-4")', 'url("#mn-paint-clip-5")', 'url("#mn-paint-clip-6")'].join('|'), e7a.shapes);
    // 免费点 paper → toast 专属功能 + 零 cardEdge PATCH + 不选中 + 预览不换
    await t.evalJs("document.querySelector('#editEdgeGrid [data-edge=\"paper\"]').click()");
    await sleep(400);
    const e7b = await t.evalJs("(() => { var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " var active = document.querySelector('#editEdgeGrid [data-edge].active');" +
      " return { toasts: window.__toasts.join('|')," +
      " edgeCalls: rawCalls.filter(function (b) { return b.indexOf('cardEdge') !== -1; }).length," +
      " active: active ? active.getAttribute('data-edge') : null, pv: document.getElementById('editEdgePreview').className," +
      " headCls: document.querySelector('#profileHeader .profile-header').className }; })()");
    check('E7 v0.2.53.1 免费点 paper：toast 背景边缘为订阅用户专属功能 + 零 cardEdge PATCH + 仍默认 active + 预览未换 + 头卡无 card-edge-*', e7b.toasts.indexOf('背景边缘为订阅用户专属功能') !== -1 && e7b.edgeCalls === 0 && e7b.active === '' && e7b.pv === 'pv-card' && e7b.headCls.indexOf('card-edge-') === -1, JSON.stringify(e7b));
    await pressEsc(t);
    await sleep(300);
    // subscriber 会话：slati_user 加 tier（isSubscriberUser 每次开弹窗即时读 localStorage，无需重载）
    await t.evalJs("localStorage.setItem('slati_user', JSON.stringify({ id: 'USR-000101', name: '电池用户', avatarUrl: null, tier: 'premium' }));");
    await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
    const e7c = await t.evalJs("(() => { var grid = document.getElementById('editEdgeGrid');" +
      " var link = document.getElementById('cardEdgeUpgradeLink');" +
      " var active = grid.querySelector('[data-edge].active');" +
      " return { lockedN: grid.querySelectorAll('[data-edge].edge-locked').length, linkVis: getComputedStyle(link).display," +
      " active: active ? active.getAttribute('data-edge') : null }; })()");
    check('E7 v0.2.53.1 订阅会话：0 锁 + 升级链接隐藏 + 默认 active（预填 null）', e7c.lockedN === 0 && e7c.linkVis === 'none' && e7c.active === '', JSON.stringify(e7c));
    // 点 paper → active 互斥 + 迷你剪影预览 → 保存 → PATCH 恰 1 次 cardEdge 且 body 精确
    await t.evalJs("document.querySelector('#editEdgeGrid [data-edge=\"paper\"]').click()");
    await sleep(300);
    const e7d0 = await t.evalJs("(() => { var b = document.querySelector('#editEdgeGrid [data-edge].active'); var pv = document.getElementById('editEdgePreview');" +
      " return { active: b ? b.getAttribute('data-edge') : null, pv: pv.className, clip: pv.style.clipPath, bg: pv.style.background }; })()");
    check('E7 v0.2.53.1 点 paper：active 互斥 + 预览真实剪影（inline clip-path=paper-edge-clip + 纸底色渐变）', e7d0.active === 'paper' && e7d0.pv === 'pv-card' && e7d0.clip === 'url("#paper-edge-clip")' && e7d0.bg.indexOf('gradient') !== -1, JSON.stringify(e7d0));
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const e7d = await t.evalJs("(() => { var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " var card = document.querySelector('#profileHeader .profile-header'); var w = document.getElementById('profileHeader');" +
      " var bn = card.querySelector('.profile-banner'); var modal = document.querySelector('.modal-card');" +
      " return { rawCalls: rawCalls, cls: card.className, attr: card.getAttribute('data-card-edge')," +
      " hasTint: !!card.querySelector('.card-tint'), hasBand: !!card.querySelector('.card-outer-band')," +
      " clip: getComputedStyle(card).getPropertyValue('--card-clip')," +
      " wrapCls: w.className, glass: card.classList.contains('liquid-glass')," +
      " bannerClip: getComputedStyle(bn).clipPath, cardGone: !modal || !modal.parentNode }; })()");
    console.log('E7d raw PATCH bodies:', JSON.stringify(e7d.rawCalls));
    const e7dEdgeCalls = e7d.rawCalls.filter(function (b) { return b.indexOf('cardEdge') !== -1; });
    check('E7 paper 保存 → PATCH 含 cardEdge 恰 1 次且 body 精确 ={"cardEdge":"paper"} + 弹窗关', e7dEdgeCalls.length === 1 && e7dEdgeCalls[0] === '{"cardEdge":"paper"}' && e7d.cardGone, JSON.stringify(e7dEdgeCalls));
    check('E7 paper 渲染：card-edge-paper has-outer-bg + data-card-edge=paper + tint/band 子层 + --card-clip=url(#paper-edge-clip) + 无 card-halo/liquid-glass + 横幅剪影非 none', e7d.cls.indexOf('card-edge-paper') !== -1 && e7d.cls.indexOf('has-outer-bg') !== -1 && e7d.attr === 'paper' && e7d.hasTint && e7d.hasBand && e7d.clip === 'url(#paper-edge-clip)' && e7d.wrapCls === '' && !e7d.glass && e7d.bannerClip !== 'none', JSON.stringify({ cls: e7d.cls, attr: e7d.attr, clip: e7d.clip, wrapCls: e7d.wrapCls, glass: e7d.glass, bannerClip: e7d.bannerClip }));
    // tech1 → 科技族折叠类 + 外板保留 + hud-frame-1
    await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
    await t.evalJs("document.querySelector('#editEdgeGrid [data-edge=\"tech1\"]').click()");
    await sleep(300);
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const e7e = await t.evalJs("(() => { var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " var card = document.querySelector('#profileHeader .profile-header');" +
      " return { rawCalls: rawCalls, cls: card.className, attr: card.getAttribute('data-card-edge')," +
      " clip: getComputedStyle(card).getPropertyValue('--card-clip'), hasTint: !!card.querySelector('.card-tint') }; })()");
    const e7eEdgeCalls = e7e.rawCalls.filter(function (b) { return b.indexOf('cardEdge') !== -1; });
    check('E7 tech1：PATCH 第 2 次 cardEdge body 精确 ={"cardEdge":"tech1"} + card-edge-tech has-outer-bg + data-card-edge=tech1 + --card-clip=hud-frame-1 + tint 在', e7eEdgeCalls.length === 2 && e7eEdgeCalls[e7eEdgeCalls.length - 1] === '{"cardEdge":"tech1"}' && e7e.cls.indexOf('card-edge-tech') !== -1 && e7e.cls.indexOf('has-outer-bg') !== -1 && e7e.attr === 'tech1' && e7e.clip === 'url(#hud-frame-1)' && e7e.hasTint, JSON.stringify({ cls: e7e.cls, attr: e7e.attr, clip: e7e.clip }));
    // paint5 → 油漆族：无外板/无 tint/band 子层 + 卡级撕裂滤镜 + container-type + --paint-pad + 横幅 mn-paint-clip-5
    await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
    await t.evalJs("document.querySelector('#editEdgeGrid [data-edge=\"paint5\"]').click()");
    await sleep(300);
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const e7f = await t.evalJs("(() => { var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " var card = document.querySelector('#profileHeader .profile-header'); var bn = card.querySelector('.profile-banner');" +
      " return { rawCalls: rawCalls, cls: card.className, attr: card.getAttribute('data-card-edge')," +
      " hasTint: !!card.querySelector('.card-tint'), hasBand: !!card.querySelector('.card-outer-band')," +
      " filter: getComputedStyle(card).filter, beforeFilter: getComputedStyle(card, '::before').filter, afterFilter: getComputedStyle(card, '::after').filter," +
      " containerType: getComputedStyle(card).containerType," +
      " pad: getComputedStyle(card).getPropertyValue('--paint-pad')," +
      " bannerClip: getComputedStyle(bn).clipPath, clip: getComputedStyle(card).getPropertyValue('--card-clip') }; })()");
    const e7fEdgeCalls = e7f.rawCalls.filter(function (b) { return b.indexOf('cardEdge') !== -1; });
    check('E7 paint5：PATCH 第 3 次 cardEdge body 精确 ={"cardEdge":"paint5"} + card-edge-paint 无 has-outer-bg 无 tint/band + 卡级 filter 零 url 只留 drop-shadow + ::before/::after 各挂 mn-paint-filter-5（v0.2.53.1 内容零位移修法）+ container-type=inline-size + --paint-pad=12cqi + 横幅/卡剪影 mn-paint-clip-5', e7fEdgeCalls.length === 3 && e7fEdgeCalls[e7fEdgeCalls.length - 1] === '{"cardEdge":"paint5"}' && e7f.cls.indexOf('card-edge-paint') !== -1 && e7f.cls.indexOf('has-outer-bg') === -1 && !e7f.hasTint && !e7f.hasBand && e7f.filter.indexOf('url(') === -1 && e7f.filter.indexOf('drop-shadow') !== -1 && e7f.beforeFilter.indexOf('url("#mn-paint-filter-5")') !== -1 && e7f.afterFilter.indexOf('url("#mn-paint-filter-5")') !== -1 && e7f.containerType === 'inline-size' && e7f.pad === '12cqi' && e7f.bannerClip !== 'none' && e7f.clip === 'url(#mn-paint-clip-5)', JSON.stringify({ cls: e7f.cls, filter: e7f.filter, beforeFilter: e7f.beforeFilter, afterFilter: e7f.afterFilter, containerType: e7f.containerType, pad: e7f.pad, bannerClip: e7f.bannerClip, clip: e7f.clip }));
    // 选默认 → PATCH cardEdge:null → 类清零
    await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
    await t.evalJs("document.querySelector('#editEdgeGrid [data-edge=\"\"]').click()");
    await sleep(300);
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const e7g = await t.evalJs("(() => { var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " var card = document.querySelector('#profileHeader .profile-header'); var w = document.getElementById('profileHeader');" +
      " return { rawCalls: rawCalls, cls: card.className, wrapCls: w.className }; })()");
    const e7gEdgeCalls = e7g.rawCalls.filter(function (b) { return b.indexOf('cardEdge') !== -1; });
    check('E7 选默认 → PATCH 第 4 次 cardEdge body 精确 ={"cardEdge":null} + 头卡类清零（无 card-edge-*）+ 包层类空（ME 回 null）', e7gEdgeCalls.length === 4 && e7gEdgeCalls[e7gEdgeCalls.length - 1] === '{"cardEdge":null}' && e7g.cls.indexOf('card-edge-') === -1 && e7g.wrapCls === '', JSON.stringify({ cls: e7g.cls, wrapCls: e7g.wrapCls }));

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
      " wrapCls: h.className, wrapBg: getComputedStyle(h).backgroundImage, wrapBgColor: getComputedStyle(h).backgroundColor, wrapShadow: getComputedStyle(h).boxShadow," +
      " wrapLg: h.classList.contains('lg-static'), wrapLayer: !!h.querySelector(':scope > .lg-backdrop'), wrapSpec: !!h.querySelector(':scope > .lg-specular')," +
      " orbVis: h.querySelector(':scope > .lg-orb-field') ? getComputedStyle(h.querySelector(':scope > .lg-orb-field')).display : null," +
      " orbB: h.querySelector(':scope > .lg-orb-field') ? getComputedStyle(h.querySelector(':scope > .lg-orb-field'), '::before').backgroundImage : null," +
      " orbA: h.querySelector(':scope > .lg-orb-field') ? getComputedStyle(h.querySelector(':scope > .lg-orb-field'), '::after').backgroundImage : null," +
      " cardBgColor: getComputedStyle(hc).backgroundColor," +
      " wrapAttach: getComputedStyle(h).backgroundAttachment," +
      " shBefMix: getComputedStyle(h, '::before').mixBlendMode, shAftMix: getComputedStyle(h, '::after').mixBlendMode," +
      " shBefBg: getComputedStyle(h, '::before').backgroundImage, shBefTop: getComputedStyle(h, '::before').top, shBefPad: getComputedStyle(h, '::before').paddingTop," +
      " shMask: (getComputedStyle(h, '::before').webkitMaskComposite || getComputedStyle(h, '::before').maskComposite)," +
      " bodyCls: document.body.className, bodyBg: getComputedStyle(document.body).backgroundImage }; })()");
    check('O1 他人主页：名字/♀svg/兜底简介/加入于 + 关注钮（未关注态）+ 无编辑资料钮 + 空态', o1.text.indexOf('电池他人') !== -1 && o1.badgeSrc && o1.badgeSrc.indexOf('female_24dp_F18AFF') !== -1 && o1.text.indexOf('这个人很懒，还没有简介') !== -1 && o1.text.indexOf('加入于 2026年7月15日') !== -1 && o1.hasFollow && o1.pressed === 'false' && o1.btnText === '关注' && !o1.hasEdit && o1.empty, o1.btnText);
    check('O1 粉丝数初始 0', o1.follower === '0', o1.follower);
    check('O1 v0.2.22.6 点赞/收藏默认私人：他人主页只 2 tab（帖子/转发）+ 无点赞/收藏统计块', o1.tabs === 2 && o1.statTabs === 'posts,reposts', 'tabs=' + o1.tabs + ' stats=' + o1.statTabs);
    check('O1 v0.2.24.3/4 他人双背景公开渲染：卡=横幅预设 glass-rose（liquid-glass+data-card-bg+玻璃层）+ 包层=卡片背景 card-halo glass-clear 真液态玻璃（无色极轻白霜 gradient 在+三色相均不在+引擎 lg-static/折射层/高光层全挂）+ 卡身纯透明 + v0.2.24.4 光场亮起（orb display=block + 无色白光球 蓝紫均不在）', o1.glass && o1.bgAttr === 'glass-rose' && o1.lgLayer && o1.wrapCls.indexOf('card-halo') !== -1 && o1.wrapCls.indexOf('glass-clear') !== -1 && o1.wrapBg.indexOf('linear-gradient') !== -1 && o1.wrapBg.indexOf('rgba(255, 255, 255') !== -1 && o1.wrapBg.indexOf('30, 90, 200') === -1 && o1.wrapBg.indexOf('232, 110, 160') === -1 && o1.wrapBg.indexOf('96, 100, 230') === -1 && o1.wrapLg && o1.wrapLayer && o1.wrapSpec && o1.cardBgColor === 'rgba(0, 0, 0, 0)' && o1.orbVis === 'block' && o1.orbB.indexOf('255, 255, 255') !== -1 && o1.orbB.indexOf('96, 165, 250') === -1, JSON.stringify({ glass: o1.glass, attr: o1.bgAttr, layer: o1.lgLayer, wrapCls: o1.wrapCls, wrapBg: o1.wrapBg.slice(0, 60), wrapLg: o1.wrapLg, wrapLayer: o1.wrapLayer, wrapSpec: o1.wrapSpec, cardBgColor: o1.cardBgColor, orbVis: o1.orbVis, orbB: o1.orbB.slice(0, 60) }));
    check('O1 v0.2.24.1/2 标准液态玻璃=代码白边环 2px + 柔影', o1.wrapShadow.indexOf('rgba(255, 255, 255, 0.8)') !== -1 && o1.wrapShadow.indexOf('inset') !== -1 && o1.wrapShadow.indexOf('rgba(0, 0, 0, 0.4)') !== -1, o1.wrapShadow);
    check('O1 v0.2.25.0 整页背景公开渲染：他人主页也渲染本人设置的图（body page-bg-active + 背景含 UPL-DEMO01.jpg + 深色蒙层；计算样式把相对路径解析为绝对 URL 属正常）', o1.bodyCls.indexOf('page-bg-active') !== -1 && o1.bodyBg.indexOf('UPL-DEMO01.jpg') !== -1 && o1.bodyBg.indexOf('rgba(10, 10, 16, 0.38)') !== -1, 'cls=' + o1.bodyCls + ' bg=' + o1.bodyBg.slice(0, 150));
    check('O1 v0.2.25.1 玻璃体可见化：包层背景复刻页面背景图（含 UPL-DEMO01.jpg + attachment 含 fixed=与 body 同参数对齐，磨砂层直采样包层→demo 同款玻璃后有场景必现）+ rdev 双层环形高光（::before screen/::after overlay+135° 白渐变+1.5px 环贴卡缘 top=6px）+ 光球提亮 0.85/0.75', o1.wrapBg.indexOf('UPL-DEMO01.jpg') !== -1 && o1.wrapAttach.indexOf('fixed') !== -1 && o1.shBefMix === 'screen' && o1.shAftMix === 'overlay' && o1.shBefBg.indexOf('135deg') !== -1 && o1.shBefTop === '6px' && o1.shBefPad === '1.5px' && (o1.shMask.indexOf('xor') !== -1 || o1.shMask.indexOf('exclude') !== -1) && o1.orbB.indexOf('0.85') !== -1 && o1.orbA.indexOf('0.75') !== -1, JSON.stringify({ wrapBg: o1.wrapBg.slice(0, 120), attach: o1.wrapAttach, bMix: o1.shBefMix, aMix: o1.shAftMix, bBg: o1.shBefBg.slice(0, 60), top: o1.shBefTop, pad: o1.shBefPad, mask: o1.shMask, orbB: o1.orbB.slice(0, 60), orbA: o1.orbA.slice(0, 60) }));
    check('O1 v0.2.25.2 默认底色移除：包层背景色透明 + 复刻层含与 body 同款深色蒙层 rgba(10,10,16,0.38)（玻璃看穿页面=页面本来样子，无接缝、白字可读）', o1.wrapBgColor === 'rgba(0, 0, 0, 0)' && o1.wrapBg.indexOf('rgba(10, 10, 16, 0.38)') !== -1, 'wrapBgColor=' + o1.wrapBgColor + ' wrapBg=' + o1.wrapBg.slice(0, 120));

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

    // O5 v0.2.53.1 访客可见：OTHER2（USR-000303）cardEdge='paper' 公开渲染（边缘剪影 + 无编辑钮；O3 清账号后持续访客态）
    await nav(t, BASE + '/pages/community-profile.html?id=USR-000303');
    await waitFor(t, "document.getElementById('profileMain').style.display === 'flex'", 10000, '边缘访客主页渲染');
    const o5 = await t.evalJs("(() => { var h = document.getElementById('profileHeader');" +
      " var card = h.querySelector('.profile-header');" +
      " return { cls: card.className, attr: card.getAttribute('data-card-edge')," +
      " hasTint: !!card.querySelector('.card-tint'), hasBand: !!card.querySelector('.card-outer-band')," +
      " clip: getComputedStyle(card).getPropertyValue('--card-clip')," +
      " hasEdit: !!document.getElementById('profileEditBtn')," +
      " text: h.textContent.slice(0, 60) }; })()");
    check('O5 v0.2.53.1 访客可见：他人主页公开渲染 cardEdge=paper（card-edge-paper has-outer-bg + data-card-edge + tint/band 子层 + --card-clip=paper-edge-clip）+ 无编辑钮', o5.cls.indexOf('card-edge-paper') !== -1 && o5.cls.indexOf('has-outer-bg') !== -1 && o5.attr === 'paper' && o5.hasTint && o5.hasBand && o5.clip === 'url(#paper-edge-clip)' && !o5.hasEdit, JSON.stringify({ cls: o5.cls, attr: o5.attr, clip: o5.clip, hasEdit: o5.hasEdit, text: o5.text }));

    check('O5 全程 0 console error', errs.length === 0, errs.slice(0, 3).join(' | '));

    // Q v0.2.53.1 静态锚：页面/后端双白名单/迁移文件逐键在场（v0.2.53.2 加 glass-distortion 折射滤镜 + 暗色卡身白霜）
    console.log('── Q. 静态锚（v0.2.53.1 卡片边缘主题 + v0.2.53.2 液态玻璃换代）──');
    const pageSrc = fs.readFileSync(path.join(DOCS, 'pages', 'community-profile.html'), 'utf8');
    const qMissing = ['paper-edge-clip', 'hud-frame-4', 'mn-paint-clip-5', 'mn-paint-filter-5', 'data-card-edge', 'applyCardEdge', 'EDGE_DEFS', 'SUBSCRIPTION_TEST_MODE', 'swatch-shape', 'glass-distortion', 'rgba(26, 26, 46, 0.58)'].filter(function (k) { return pageSrc.indexOf(k) === -1; });
    check('Q 页面静态锚：SVG defs（paper-edge-clip/hud-frame-4/mn-paint-clip-5/mn-paint-filter-5/glass-distortion）+ data-card-edge + applyCardEdge + EDGE_DEFS + SUBSCRIPTION_TEST_MODE + swatch-shape + v0.2.53.2 暗色卡身白霜 0.58', qMissing.length === 0, '缺=' + qMissing.join(','));
    const authSrc = fs.readFileSync(path.join(__dirname, 'src', 'routes', 'public', 'auth.js'), 'utf8');
    const socialSrc = fs.readFileSync(path.join(__dirname, 'src', 'routes', 'public', 'social.js'), 'utf8');
    check('Q 后端白名单双份同步：auth.js + social.js 各含 CARD_EDGE_KEYS', authSrc.indexOf('CARD_EDGE_KEYS') !== -1 && socialSrc.indexOf('CARD_EDGE_KEYS') !== -1, '');
    const migSrc = fs.readFileSync(path.join(__dirname, 'migrations', '027_card_edge.sql'), 'utf8');
    check('Q 迁移 027_card_edge.sql 含 card_edge', migSrc.indexOf('card_edge') !== -1, '');

    console.log('── B. v0.2.58.18 横幅图片/头像图库（B1 静态锚/B2 空态/B3 图库横幅/B4 移除/B5 上传横幅/B6 图库头像/B7 几何/B8 仅本人）──');

    // B1 静态锚：后端三处 + 页面五 id + i18n 11 键×11 语 + site-config 版本/changelog（CRLF 归一化家规）
    const b1Auth = fs.readFileSync(path.join(__dirname, 'src', 'routes', 'public', 'auth.js'), 'utf8').replace(/\r\n/g, '\n');
    const b1Social = fs.readFileSync(path.join(__dirname, 'src', 'routes', 'public', 'social.js'), 'utf8').replace(/\r\n/g, '\n');
    const b1Mig = fs.readFileSync(path.join(__dirname, 'migrations', '029_user_banner.sql'), 'utf8').replace(/\r\n/g, '\n');
    const b1I18n = fs.readFileSync(path.join(DOCS, 'assets', 'i18n', 'community-profile.i18n.js'), 'utf8').replace(/\r\n/g, '\n');
    const b1Site = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8').replace(/\r\n/g, '\n');
    const b1PageSrc = pageSrc; // Q 段已读（同一页面源）
    check('B1 后端锚：auth.js PATCH `banner_url = ?` 分支 ×1 + social.js GET `bannerUrl:` 守卫行 ×1', (b1Auth.match(/banner_url = \?/g) || []).length === 1 && (b1Social.match(/bannerUrl: /g) || []).length === 1, 'auth=' + (b1Auth.match(/banner_url = \?/g) || []).length + ' social=' + (b1Social.match(/bannerUrl: /g) || []).length);
    check('B1 迁移 029_user_banner.sql：`ADD COLUMN banner_url` ×1', (b1Mig.match(/ADD COLUMN banner_url/g) || []).length === 1, '');
    check('B1 页面五 id 在位（editBannerUploadBtn/editBannerLibBtn/editBannerRemoveBtn/editBannerFile/editAvatarLibBtn）', ['editBannerUploadBtn', 'editBannerLibBtn', 'editBannerRemoveBtn', 'editBannerFile', 'editAvatarLibBtn'].filter(function (id) { return b1PageSrc.indexOf(id) === -1; }).length === 0, '');
    check('B1 页面 58.18 关键件：renderHeader has-img + openFcLibraryPicker + fcDataUrlToBlob + 保存 diff body.bannerUrl', b1PageSrc.indexOf('has-img') !== -1 && b1PageSrc.indexOf('function openFcLibraryPicker') !== -1 && b1PageSrc.indexOf('function fcDataUrlToBlob') !== -1 && b1PageSrc.indexOf('body.bannerUrl = editBannerUrl') !== -1, '');
    const b1Keys = ['bannerImg', 'bannerUpload', 'bannerLib', 'bannerRemove', 'bannerReady', 'bannerUploading', 'bannerUploadFail', 'bannerHint', 'avatarLib', 'libTitle', 'libEmpty'];
    const b1BadKeys = b1Keys.filter(function (k) { var re = new RegExp("'prof\\.edit\\." + k + "'", 'g'); return (b1I18n.match(re) || []).length !== 11; });
    check('B1 i18n 11 新键 × 11 语块全在位（与老键 imgTooBig 同 11 语块口径）', b1BadKeys.length === 0 && (b1I18n.match(/'prof\.edit\.imgTooBig'/g) || []).length === 11, '缺=' + b1BadKeys.join(','));
    check('B1 site-config：版本赋值 v0.2.58.19 + changelog rev 00334- 前缀', b1Site.indexOf("window.MN_SITE_VERSION = 'v0.2.58.19'") !== -1 && b1Site.indexOf('00334-') !== -1, '');

    // B 组前置：O 段末尾停在他人主页（USR-000303）且账号已清 → 回自己主页 + 种子登录（isSelf 门控）
    await nav(t, BASE + '/pages/community-profile.html?id=USR-000101');
    await waitFor(t, "document.getElementById('profileMain').style.display === 'flex'", 10000, '自己主页渲染');
    await seedUser(t);
    // v0.2.58.19 订阅分层：B 组图库链（B2/B3/B6）需订阅身份解锁——种 tier（isSubscriberUser 每次开弹窗即时读）
    await t.evalJs("localStorage.setItem('slati_user', JSON.stringify({ id: 'USR-000101', name: '电池用户', avatarUrl: null, tier: 'premium' }));");
    await waitFor(t, "document.getElementById('profileEditBtn')", 10000, '编辑钮就位');

    // B2 图库空态：无 slati_img_library → 选择器空态文案 + 零上传调用
    await t.evalJs("localStorage.removeItem('slati_img_library'); window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
    const b2UpBefore = await t.evalJs("window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/uploads') !== -1; }).length");
    await t.evalJs("document.getElementById('editBannerLibBtn').click()");
    await sleep(500);
    const b2 = await t.evalJs("(() => { var e = document.querySelector('.fc-lib-pick-empty'); var g = document.querySelector('.fc-lib-pick-grid');" +
      " return { empty: e ? e.textContent : null, grid: !!g, uploads: window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/uploads') !== -1; }).length }; })()");
    check('B2 图库空态：无 slati_img_library → 空态文案「图库是空的」+ 零网格 + 零上传调用', b2.empty && b2.empty.indexOf('图库是空的') !== -1 && !b2.grid && b2.uploads === b2UpBefore, JSON.stringify(b2));
    await pressEsc(t);
    await sleep(300);

    // B3 图库选横幅：预种 dataURL 图库 → 选择器 1 项 → 点选 → 上传恰 1 次 → 预览挂图+就绪 → 保存 PATCH 精确 bannerUrl → 头部 has-img
    const LIB_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    await t.evalJs("localStorage.setItem('slati_img_library', JSON.stringify([{ src: '" + LIB_PNG + "', name: '电池图库图' }])); window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
    const b3UpBefore = await t.evalJs("window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/uploads') !== -1; }).length");
    await t.evalJs("document.getElementById('editBannerLibBtn').click()");
    await sleep(500);
    const b3a = await t.evalJs("(() => { var g = document.querySelector('.fc-lib-pick-grid'); var it = g ? g.querySelector('.fc-lib-pick-item') : null;" +
      " return { itemN: g ? g.children.length : 0, img: it ? it.querySelector('img').getAttribute('src') : null, label: it ? it.querySelector('.label-sm').textContent : null }; })()");
    check('B3 图库选择器：预种 1 dataURL 项 → 网格 1 项 + 缩略图 + 名称', b3a.itemN === 1 && b3a.img === LIB_PNG && b3a.label === '电池图库图', JSON.stringify(b3a));
    await t.evalJs("document.querySelector('.fc-lib-pick-item').click()");
    await sleep(800);
    const b3b = await t.evalJs("(() => { var pv = document.getElementById('editBannerPreview');" +
      " return { state: document.getElementById('editBannerState').textContent, pvBg: pv.style.backgroundImage," +
      " uploads: window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/uploads') !== -1; }).length }; })()");
    check('B3 点选 → 上传恰 1 次 + 预览挂图 + 就绪文案「横幅已就绪，点保存生效」', b3b.uploads === b3UpBefore + 1 && b3b.pvBg.indexOf('UPL-DEMO01') !== -1 && b3b.state.indexOf('横幅已就绪') !== -1, JSON.stringify(b3b));
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const b3c = await t.evalJs("(() => { var h = document.getElementById('profileHeader'); var bn = h.querySelector('.profile-banner');" +
      " var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " return { rawCalls: rawCalls, hasImg: bn.classList.contains('has-img'), bnBg: getComputedStyle(bn).backgroundImage," +
      " cardGone: !document.querySelector('.modal-card') || !document.querySelector('.modal-card').parentNode }; })()");
    console.log('B3 raw PATCH bodies:', JSON.stringify(b3c.rawCalls));
    const b3BannerCalls = b3c.rawCalls.filter(function (b) { return b.indexOf('bannerUrl') !== -1; });
    check('B3 保存 → PATCH 含 bannerUrl 恰 1 次且 body 精确 ={"bannerUrl":"/uploads/UPL-DEMO01.jpg"} + 弹窗关', b3BannerCalls.length === 1 && b3BannerCalls[0] === '{"bannerUrl":"/uploads/UPL-DEMO01.jpg"}' && b3c.cardGone, JSON.stringify(b3BannerCalls));
    check('B3 头部横幅有图：.profile-banner.has-img + computed 背景=图（含 UPL-DEMO01 且无 linear-gradient——内联图盖过预设渐变）', b3c.hasImg && b3c.bnBg.indexOf('UPL-DEMO01') !== -1 && b3c.bnBg.indexOf('linear-gradient') === -1, b3c.bnBg);

    // B4 移除横幅：重开 → 自定义 → 点移除 → 预览回渐变+提示 → 保存 PATCH bannerUrl:null → 头部无 has-img 回渐变
    await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
    await t.evalJs("document.getElementById('editBannerRemoveBtn').click()");
    await sleep(300);
    const b4a = await t.evalJs("(() => { var pv = document.getElementById('editBannerPreview');" +
      " return { state: document.getElementById('editBannerState').textContent, pvBg: pv.style.backgroundImage }; })()");
    check('B4 点移除 → 预览清图回渐变 + 提示文案「上传图片或从图库选择，点保存生效」', b4a.pvBg === '' && b4a.state.indexOf('上传图片或从图库选择') !== -1, JSON.stringify(b4a));
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const b4b = await t.evalJs("(() => { var h = document.getElementById('profileHeader'); var bn = h.querySelector('.profile-banner');" +
      " var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " return { rawCalls: rawCalls, hasImg: bn.classList.contains('has-img'), bnBg: getComputedStyle(bn).backgroundImage }; })()");
    console.log('B4 raw PATCH bodies:', JSON.stringify(b4b.rawCalls));
    const b4BannerCalls = b4b.rawCalls.filter(function (b) { return b.indexOf('bannerUrl') !== -1; });
    check('B4 保存 → PATCH 含 bannerUrl 共 2 次且最后 body 精确 ={"bannerUrl":null}（移除语义显式入 body）', b4BannerCalls.length === 2 && b4BannerCalls[b4BannerCalls.length - 1] === '{"bannerUrl":null}', JSON.stringify(b4BannerCalls));
    check('B4 头部回默认：无 has-img + 背景回品牌渐变（linear-gradient 在，UPL-DEMO01 不在）', !b4b.hasImg && b4b.bnBg.indexOf('linear-gradient') !== -1 && b4b.bnBg.indexOf('UPL-DEMO01') === -1, b4b.bnBg);

    // B5 上传横幅链（本地文件 → setFileInputFiles #editBannerFile → 直传 → 保存 → 头部 has-img）
    const tmpBn = path.join(__dirname, 'tmp-banner-test.jpg');
    fs.writeFileSync(tmpBn, PIXEL_PNG); // 客户端只查扩展名+大小，罐头端点不看魔数
    await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
    const docNodeB = await t.send('DOM.getDocument', { depth: -1 });
    const fileNodeB = await t.send('DOM.querySelector', { nodeId: docNodeB.root.nodeId, selector: '#editBannerFile' });
    await t.send('DOM.setFileInputFiles', { nodeId: fileNodeB.nodeId, files: [tmpBn] });
    await sleep(800);
    const b5a = await t.evalJs("(() => { var pv = document.getElementById('editBannerPreview');" +
      " return { state: document.getElementById('editBannerState').textContent, pvBg: pv.style.backgroundImage }; })()");
    check('B5 选横幅文件 → 直传 + 预览挂图 + 就绪文案', b5a.pvBg.indexOf('UPL-DEMO01') !== -1 && b5a.state.indexOf('横幅已就绪') !== -1, JSON.stringify(b5a));
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const b5b = await t.evalJs("(() => { var h = document.getElementById('profileHeader'); var bn = h.querySelector('.profile-banner');" +
      " var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " return { patched: window.__patchedMe ? window.__patchedMe.bannerUrl : null, hasImg: bn.classList.contains('has-img')," +
      " rawCalls: rawCalls, inlineBg: bn.getAttribute('style') }; })()");
    console.log('B5 raw PATCH bodies:', JSON.stringify(b5b.rawCalls));
    const b5BannerCalls = b5b.rawCalls.filter(function (b) { return b.indexOf('bannerUrl') !== -1; });
    check('B5 保存 → PATCH 含 bannerUrl 共 3 次（B3 设/B4 删/B5 再设）且最后 body 精确 ={"bannerUrl":"/uploads/UPL-DEMO01.jpg"} + __patchedMe.bannerUrl 同步', b5BannerCalls.length === 3 && b5BannerCalls[b5BannerCalls.length - 1] === '{"bannerUrl":"/uploads/UPL-DEMO01.jpg"}' && b5b.patched === '/uploads/UPL-DEMO01.jpg', JSON.stringify(b5BannerCalls));
    check('B5 头部横幅再挂图：has-img + 内联 background-image 含 UPL-DEMO01（escapeHtml 包裹）', b5b.hasImg && b5b.inlineBg.indexOf('UPL-DEMO01') !== -1, b5b.inlineBg);
    fs.unlinkSync(tmpBn);

    // B6 图库选头像（钦定⑤）：基本 tab → #editAvatarLibBtn → 选择器 → 点选 → editPendingAvatar → 预览换图 → 保存 PATCH 含 avatarUrl
    await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
    await sleep(500);
    const b6UpBefore = await t.evalJs("window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/uploads') !== -1; }).length");
    await t.evalJs("document.getElementById('editAvatarLibBtn').click()");
    await sleep(500);
    const b6a = await t.evalJs("(() => { var g = document.querySelector('.fc-lib-pick-grid');" +
      " return { itemN: g ? g.children.length : 0, itemImg: g ? g.querySelector('.fc-lib-pick-item img').getAttribute('src') : null }; })()");
    check('B6 头像图库入口：选择器开 + 预种 1 项在', b6a.itemN === 1 && b6a.itemImg === LIB_PNG, JSON.stringify(b6a));
    await t.evalJs("document.querySelector('.fc-lib-pick-item').click()");
    await sleep(800);
    const b6b = await t.evalJs("(() => { var img = document.getElementById('editAvatarPreview');" +
      " return { src: img ? img.getAttribute('src') : null, st: document.getElementById('editSaveState').textContent," +
      " uploads: window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/uploads') !== -1; }).length }; })()");
    check('B6 点选 → 上传恰 1 次 + 头像预览换图 + 就绪文案「新头像已就绪」', b6b.uploads === b6UpBefore + 1 && b6b.src === '/uploads/UPL-DEMO01.jpg' && b6b.st.indexOf('新头像已就绪') !== -1, JSON.stringify(b6b));
    await t.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    const b6c = await t.evalJs("(() => { var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
      " return { rawCalls: rawCalls, cardGone: !document.querySelector('.modal-card') || !document.querySelector('.modal-card').parentNode }; })()");
    console.log('B6 raw PATCH bodies:', JSON.stringify(b6c.rawCalls));
    const b6AvatarCalls = b6c.rawCalls.filter(function (b) { return b.indexOf('avatarUrl') !== -1; });
    check('B6 保存 → PATCH 含 avatarUrl 且值=/uploads/UPL-DEMO01.jpg（最后一条）+ 弹窗关', b6AvatarCalls.length >= 1 && b6AvatarCalls[b6AvatarCalls.length - 1].indexOf('"avatarUrl":"/uploads/UPL-DEMO01.jpg"') !== -1 && b6c.cardGone, JSON.stringify(b6AvatarCalls));

    // B7 叠放几何（P1）：横幅底 - 头像顶 ≈ 36；名称块在横幅下方；头像半身入行内
    const b7 = await t.evalJs("(() => { var h = document.getElementById('profileHeader');" +
      " var av = h.querySelector('.profile-avatar').getBoundingClientRect(); var bn = h.querySelector('.profile-banner').getBoundingClientRect();" +
      " var nm = h.querySelector('h2').getBoundingClientRect();" +
      " return { bnB: bn.bottom, avT: av.top, avB: av.bottom, nmT: nm.top, avPos: getComputedStyle(h.querySelector('.profile-avatar')).position }; })()");
    check('B7 叠放几何：头像绝对定位叠横幅（bnB-avT≈36±16）+ 半身入行内（avB>bnB）+ 名称块在横幅下方（nmT≥bnB）', b7.avPos === 'absolute' && (b7.bnB - b7.avT) >= 20 && (b7.bnB - b7.avT) <= 52 && b7.avB > b7.bnB && b7.nmT >= b7.bnB, JSON.stringify(b7));

    // B8 仅本人（P2）：他人主页零编辑入口（无编辑钮/无横幅/头像图库钮）
    await nav(t, BASE + '/pages/community-profile.html?id=USR-000202');
    await waitFor(t, "document.getElementById('profileMain').style.display === 'flex'", 10000, '他人主页渲染');
    const b8 = await t.evalJs("!document.getElementById('profileEditBtn') && !document.getElementById('editBannerLibBtn') && !document.getElementById('editAvatarLibBtn') && !document.getElementById('editBannerUploadBtn')");
    check('B8 仅本人：他人主页零编辑入口（无 profileEditBtn/editBannerLibBtn/editAvatarLibBtn/editBannerUploadBtn）', b8, String(b8));

    check('B9 全链 0 console error', errs.length === 0, errs.slice(0, 3).join(' | '));
  }

  // ──────────────────────────────────────────────
  // 线上：只读侧 + 401 回滚链 + 访客零请求（无凭据不真写）
  // ──────────────────────────────────────────────
  async function runLive(t) {
    console.log('── L. 线上（hub 作者锚 → profile 渲染 → 401 回滚链）──');

    // L1 hub 首卡作者锚 → 个人主页（href 形状断言）
    const l1 = await t.evalJs("(() => { var c = document.querySelector('[data-cloud-id]'); var a = c ? c.querySelector('.post-author-link') : null;" +
      " return { ver: window.MN_SITE_VERSION, href: a ? a.getAttribute('href') : null, wrapped: a ? (!!a.querySelector('img.avatar') && a.textContent.length > 0) : false }; })()");
    check('L1 版本 v0.2.58.19', l1.ver === 'v0.2.58.19', 'ver=' + l1.ver);
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
      " avR: h.querySelector('.profile-avatar').getBoundingClientRect().right, avT: h.querySelector('.profile-avatar').getBoundingClientRect().top, nmL: h.querySelector('h2').getBoundingClientRect().left," +
      " avB: h.querySelector('.profile-avatar').getBoundingClientRect().bottom, nmT: h.querySelector('h2').getBoundingClientRect().top," +
      " pcR: h.querySelector('.profile-counts').getBoundingClientRect().right, ptR: h.querySelector('.profile-top').getBoundingClientRect().right," +
      " bnH: h.querySelector('.profile-banner').getBoundingClientRect().height, bnB: h.querySelector('.profile-banner').getBoundingClientRect().bottom," +
      " bb: getComputedStyle(h.querySelector('.profile-top')).borderBottomWidth," +
      " glassCls: h.querySelector('.profile-header').classList.contains('liquid-glass'), cardLayer: !!h.querySelector('.profile-header > .lg-backdrop')," +
      " wrapCls: h.className, wrapLg: h.classList.contains('lg-static'), wrapLayer: !!h.querySelector(':scope > .lg-backdrop')," +
      " orbVis: h.querySelector(':scope > .lg-orb-field') ? getComputedStyle(h.querySelector(':scope > .lg-orb-field')).display : null," +
      " cardBgColor: getComputedStyle(h.querySelector('.profile-header')).backgroundColor, wrapBgColor: getComputedStyle(h).backgroundColor }; })()");
    check('L2 主页渲染：非 404 + 头部高度 > 100 + v0.2.22.6 非本人只 2 tab（帖子/转发）+ 统计 2 块 + counts 含获赞', l2.s404 === 'none' && l2.hH > 100 && l2.tabs === 2 && l2.nums.split('/').length === 2 && l2.text.indexOf('获赞') !== -1, 'h=' + l2.hH + ' nums=' + l2.nums + ' text=' + l2.text.slice(0, 80));
    check('L2 头部真数据：名字 + @CIT- + 简介或兜底 + 加入于', l2.text.indexOf('@CIT-') !== -1 && (l2.text.indexOf('这个人很懒，还没有简介') !== -1 || l2.text.indexOf('加入于') !== -1) && l2.text.indexOf('加入于') !== -1, l2.text.slice(0, 100));
    check('L2 关注钮存在（未关注态）+ 侧栏 + 返回链', l2.hasFollow && l2.pressed === 'false' && l2.sLen > 50 && l2.backHref === 'community-hub.html', 'pressed=' + l2.pressed);
    check('L2 v0.2.22.0 非本人主页无编辑资料钮（编辑钮 isSelf 专属）', !l2.hasEdit, 'hasEdit=' + l2.hasEdit);
    check('L2 v0.2.58.18 横排几何：名字列在头像右侧 + 名称块自头像下方起行', l2.nmL >= l2.avR - 1 && l2.nmT >= l2.avB - 1, 'avR=' + l2.avR + ' nmL=' + l2.nmL + ' avB=' + l2.avB + ' nmT=' + l2.nmT);
    check('L2 v0.2.22.3 粉丝关注贴行最右缘（rightEdge≤1）', l2.ptR - l2.pcR <= 1, 'ptR=' + l2.ptR + ' pcR=' + l2.pcR);
    check('L2 v0.2.58.18 横幅可见 + 分割线 1px + 名称块在横幅下方（nmT≥bnB）', l2.bnH >= 100 && l2.bb === '1px' && l2.nmT >= l2.bnB, 'bnH=' + l2.bnH + ' bb=' + l2.bb + ' nmT=' + l2.nmT + ' bnB=' + l2.bnB);
    check('L2 v0.2.58.18 头像叠横幅：avT < bnB 且重叠≈36（bnB-avT≈36±16）', l2.avT < l2.bnB && (l2.bnB - l2.avT) >= 20 && (l2.bnB - l2.avT) <= 52, 'avT=' + l2.avT + ' bnB=' + l2.bnB);
    check('L2 v0.2.23.0 玻璃类与卡玻璃层一致（默认卡无层 / 有背景则有层；v0.2.24.3 层口径收窄到卡自身，不受包层引擎层干扰）', (l2.glassCls && l2.cardLayer) || (!l2.glassCls && !l2.cardLayer), 'glass=' + l2.glassCls + ' cardLayer=' + l2.cardLayer);
    check('L2 v0.2.24.3 包层引擎与 card-halo 一致（有 halo ⇔ 引擎 lg-static+折射层挂包层；无 halo ⇔ 引擎不挂）', (l2.wrapCls.indexOf('card-halo') !== -1 && l2.wrapLg && l2.wrapLayer) || (l2.wrapCls.indexOf('card-halo') === -1 && !l2.wrapLg && !l2.wrapLayer), 'wrapCls=' + l2.wrapCls + ' wrapLg=' + l2.wrapLg + ' wrapLayer=' + l2.wrapLayer);
    check('L2 v0.2.24.4 玻璃光场与卡片背景一致（有 halo ⇔ 光场 display=block；无 halo ⇔ 光场 display=none）', (l2.wrapCls.indexOf('card-halo') !== -1 && l2.orbVis === 'block') || (l2.wrapCls.indexOf('card-halo') === -1 && l2.orbVis === 'none'), 'wrapCls=' + l2.wrapCls + ' orbVis=' + l2.orbVis);
    check('L2 v0.2.24.0 卡片背景层与卡透明一致（card-halo 在 ⇔ 卡身纯透明；无 halo ⇔ 卡回实底）', (l2.wrapCls.indexOf('card-halo') !== -1 && l2.cardBgColor === 'rgba(0, 0, 0, 0)') || (l2.wrapCls.indexOf('card-halo') === -1 && l2.cardBgColor !== 'rgba(0, 0, 0, 0)'), 'wrapCls=' + l2.wrapCls + ' card=' + l2.cardBgColor);
    check('L2 v0.2.25.2 默认底色移除：包层背景色透明（有 halo ⇔ 横幅以外无默认底色直透页面；无 halo 跳过）', (l2.wrapCls.indexOf('card-halo') !== -1 && l2.wrapBgColor === 'rgba(0, 0, 0, 0)') || l2.wrapCls.indexOf('card-halo') === -1, 'wrapCls=' + l2.wrapCls + ' wrapBgColor=' + l2.wrapBgColor);

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
