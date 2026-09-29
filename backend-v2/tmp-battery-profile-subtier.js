// tmp-battery-profile-subtier.js — v0.2.58.20 个人资料横幅/头像订阅分层电池（克隆 tmp-battery-profile-banner.js 壳，D 组专项）
// 用户：「能不能在个人资料设置内也添加这个功能类似discord那种分成基本和付费，还有这个和用户的频道主页的横幅是不互通的」
//   三项钦定：①分层=免费（静态图 jpg/png/webp 上传）vs 付费（gif 动图+FC 图库来源，tier∈{basic,premium,ultra}）
//   ②纯前端门禁（锁 UI+点击 toast 不生效+premium.html 升级链接；后端零改动）③资料横幅与 FC 频道主页横幅不互通（FC 零改动）。
// 判定口径=isSubscriberUser()（slati_user.tier：free/无 tier=受限）——不 stub 函数，localStorage 种/不种 tier 驱动（开弹窗即时读）。
// D 组：D0 静态锚 / D1 免费锁 UI / D2-D3 免费点图库拦截 / D4-D5 免费传 gif 拦截 / D6 免费传静态放行 / D7 订阅全解锁 / D8 祖父 / D9 FC 不互通 / D10 零异常。
// 跑法：node tmp-battery-profile-subtier.js（仅本地静态壳；门禁需登录态线上无法无凭证探——由本电池覆盖）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3900 + Math.floor(Math.random() * 500);
const CDP_PORT = 4900 + Math.floor(Math.random() * 500);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-subtier-' + Date.now());

// 1x1 真 PNG（罐头上传返回值指向的静态资源，防 404 图片日志污染 0-console-error 断言）
const PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const AVATAR_URI = 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2228%22%20height%3D%2228%22%3E%3Ccircle%20cx%3D%2214%22%20cy%3D%2214%22%20r%3D%2214%22%20fill%3D%22%23464dd4%22%2F%3E%3C%2Fsvg%3E';
// 1x1 真 GIF dataURL（图库条目/祖父横幅用真图；GRANDPA 路径由静态壳供图）
const GIF_DATAURL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

// document-start fetch 罐头：ME 横幅初值可经 localStorage __battInitBanner 注入（D8 祖父——跨 reload 持久）
const DOC_START_SRC = `
(function () {
  var initBanner = null;
  try { initBanner = localStorage.getItem('__battInitBanner'); } catch (e) {}
  var ME = {
    id: 'USR-000101', displayName: '电池用户', avatarUrl: ${JSON.stringify(AVATAR_URI)},
    bio: '电池用户简介', gender: 'Male', citizenId: 'CIT-000101', createdAt: '2026-08-01T00:00:00.000Z',
    isSelf: true, followedByMe: false, followerCount: 2, followingCount: 3,
    cardBg: null, cardPlate: null, pageBgImage: null, cardEdge: null,
    bannerUrl: initBanner, // v0.2.58.18 横幅（029 列）；__battInitBanner 注入=祖父场景
    stats: { postCount: 1, repostCount: 1, likeReceivedCount: 1, likeCount: 2, favoriteCount: 1 }
  };
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
      if (key === 'GET /api/health') return Promise.resolve(res(200, { status: 'ok', version: '2.0.0', tables: 60 }));
      if (key === 'GET /api/social/users/USR-000101') return Promise.resolve(res(200, { user: ME }));
      if (u.indexOf('/api/social/users/USR-000101/posts') === 0) return Promise.resolve(res(200, { posts: [] }));
      if (key === 'PATCH /api/auth/me') {
        if (window.__patchFail401) return Promise.resolve(res(401, { error: { code: 'UNAUTHORIZED', message: '未登录' } }));
        var pb = {};
        try { pb = JSON.parse(rawBody || '{}'); } catch (e) {}
        window.__patchedMe = pb;
        if (pb.displayName) ME.displayName = pb.displayName;
        if (pb.avatarUrl) ME.avatarUrl = pb.avatarUrl;
        if (pb.bio !== undefined) ME.bio = pb.bio;
        if (pb.gender) ME.gender = pb.gender;
        if (pb.bannerUrl !== undefined) ME.bannerUrl = pb.bannerUrl; // v0.2.58.18 横幅（null 显式=移除）
        return Promise.resolve(res(200, { user: { id: ME.id, displayName: ME.displayName, avatarUrl: ME.avatarUrl, citizenId: ME.citizenId, bio: ME.bio, gender: ME.gender, createdAt: ME.createdAt } }));
      }
      // 上传直传罐头 → /uploads/UPL-DEMO01.jpg（客户端只查扩展名+大小，罐头端点不看魔数）
      if (method === 'POST' && u.indexOf('/api/social/uploads?ext=') === 0) return Promise.resolve(res(200, { url: '/uploads/UPL-DEMO01.jpg' }));
    }
    return realFetch(url, opts);
  };
})();
`;

// ── 静态壳（docs/ 原样；/api 全 404 → demo 模式零请求；UPL-DEMO01.jpg + GRANDPA.gif 供真图） ──
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.gif': 'image/gif' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/uploads/UPL-DEMO01.jpg') { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(PIXEL_PNG); return; }
  if (p === '/uploads/GRANDPA.gif') { res.writeHead(200, { 'Content-Type': 'image/gif' }); res.end(PIXEL_PNG); return; }
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
let T0 = null, CHROME0 = null; // catch 清理用（UV handle 开着就 exit 会触发 Windows assert 噪音）
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
async function seedFree(t) {
  await t.evalJs("localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true, at: new Date().toISOString() }));" +
    "localStorage.setItem('slati_user', JSON.stringify({ id: 'USR-000101', name: '电池用户', avatarUrl: null }));");
}
async function seedSub(t) {
  await t.evalJs("localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true, at: new Date().toISOString() }));" +
    "localStorage.setItem('slati_user', JSON.stringify({ id: 'USR-000101', name: '电池用户', avatarUrl: null, tier: 'premium' }));");
}
async function clearUser(t) {
  await t.evalJs("localStorage.removeItem('slati_session'); localStorage.removeItem('slati_user');");
}
async function patchToast(t) {
  await t.evalJs("window.__toasts = []; if (window.MN_Report && window.MN_Report.toast) { var o = MN_Report.toast.bind(MN_Report); MN_Report.toast = function (m, e) { window.__toasts.push(String(m)); return o(m, e); }; }");
}
// 开编辑弹窗（sub 每次开弹窗即时读 localStorage——__patchedMe 置空复位 PATCH 记录）
async function openEdit(t, tab) {
  await t.evalJs("window.__patchedMe = null; document.getElementById('profileEditBtn').click()");
  await sleep(500);
  if (tab === 'custom') {
    await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
    await sleep(300);
  }
}
// 喂文件（客户端只查扩展名+大小，罐头端点不看魔数）
async function feedFile(t, selector, filePath) {
  const docNode = await t.send('DOM.getDocument', { depth: -1 });
  const fileNode = await t.send('DOM.querySelector', { nodeId: docNode.root.nodeId, selector: selector });
  await t.send('DOM.setFileInputFiles', { nodeId: fileNode.nodeId, files: [filePath] });
  await sleep(800);
}
const upCount = t => t.evalJs("window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/uploads') !== -1; }).length");
const patchCount = t => t.evalJs("window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).length");
const readNorm = f => fs.readFileSync(path.join(DOCS, f), 'utf8').replace(/\r\n/g, '\n');

async function main() {
  server.listen(PORT);
  const BASE = 'http://127.0.0.1:' + PORT;

  // ── D0 静态锚（磁盘源，CRLF 归一）──
  console.log('── D0. 静态锚（页面/i18n/site-config/FC 不互通）──');
  const pageSrc = readNorm('pages/community-profile.html');
  const cnt = (s, sub) => s.split(sub).length - 1;
  check('D0 页面 58.19 件：sub-locked ×3（F1 头像钮+F3 横幅钮+CSS）+ blockGif ×4（声明+三拦截）+ 两升级链接 id ×1 + premium.html href ≥3',
    cnt(pageSrc, 'sub-locked') === 3 && cnt(pageSrc, 'blockGif') === 4 &&
    cnt(pageSrc, 'avatarGifUpgradeLink') === 1 && cnt(pageSrc, 'bannerGifUpgradeLink') === 1 && cnt(pageSrc, 'href="premium.html"') >= 3,
    'sub-locked=' + cnt(pageSrc, 'sub-locked') + ' blockGif=' + cnt(pageSrc, 'blockGif') +
    ' avLink=' + cnt(pageSrc, 'avatarGifUpgradeLink') + ' bnLink=' + cnt(pageSrc, 'bannerGifUpgradeLink') +
    ' premium=' + cnt(pageSrc, 'href="premium.html"'));
  const i18nSrc = readNorm('assets/i18n/community-profile.i18n.js');
  check('D0 i18n 3 新键 × 12 语块（gifLocked/libLocked/gifUpgrade 各 12）',
    cnt(i18nSrc, 'prof.toast.gifLocked') === 12 && cnt(i18nSrc, 'prof.toast.libLocked') === 12 && cnt(i18nSrc, 'prof.edit.gifUpgrade') === 12,
    'gifLocked=' + cnt(i18nSrc, 'prof.toast.gifLocked') + ' libLocked=' + cnt(i18nSrc, 'prof.toast.libLocked') + ' gifUpgrade=' + cnt(i18nSrc, 'prof.edit.gifUpgrade'));
  const siteSrc = readNorm('assets/js/site-config.js');
  check('D0 site-config：版本赋值 v0.2.58.20 + FC 48.0 在位 + changelog rev 00336- 前缀 ×2（站点+FC 双条目）',
    cnt(siteSrc, "window.MN_SITE_VERSION = 'v0.2.58.20'") === 1 && cnt(siteSrc, "window.FLUIDCANVAS_VERSION = 'v10.28.48.0'") === 1 && cnt(siteSrc, '00336-') === 2,
    'v58.20=' + cnt(siteSrc, "window.MN_SITE_VERSION = 'v0.2.58.20'") + ' fc48=' + cnt(siteSrc, "window.FLUIDCANVAS_VERSION = 'v10.28.48.0'") + ' r36=' + cnt(siteSrc, '00336-'));
  const fcSrc = readNorm('pages/fluidcanvas.html');
  check('D9 FC 不互通（钦定③铁证）：fluidcanvas.html 源零 bannerUrl/banner_url（FC 频道主页不读 users.banner_url）',
    fcSrc.indexOf('bannerUrl') === -1 && fcSrc.indexOf('banner_url') === -1, 'bannerUrl=' + fcSrc.indexOf('bannerUrl') + ' banner_url=' + fcSrc.indexOf('banner_url'));

  // ── CDP boot ──
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
  CHROME0 = chrome;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {}
    await sleep(250);
  }
  const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' });
  const info = await r.json();
  const t = new CDP(info.webSocketDebuggerUrl);
  T0 = t;
  await t.connect();
  await t.send('Page.enable');
  await t.send('Runtime.enable');
  await t.send('Page.addScriptToEvaluateOnNewDocument', { source: DOC_START_SRC });
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

  // 先 nav 拿到 http origin 再碰 localStorage（about:blank 透明 origin 读 localStorage 会 SecurityError）
  await nav(t, BASE + '/pages/community-profile.html?id=USR-000101');
  await t.evalJs("localStorage.clear()");
  await seedFree(t);
  await t.send('Page.reload');
  await sleep(900);
  await waitFor(t, "document.getElementById('profileMain').style.display === 'flex'", 15000, '主页渲染');
  await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
  await patchToast(t);
  await waitFor(t, "document.getElementById('profileEditBtn')", 10000, '编辑钮就位');

  // ── D1 免费锁 UI（basic + custom 两 tab）──
  console.log('── D1. 免费锁 UI ──');
  await openEdit(t);
  const d1a = await t.evalJs("(() => { var b = document.getElementById('editAvatarLibBtn'); var l = document.getElementById('avatarGifUpgradeLink');" +
    " var up = document.getElementById('editAvatarBtn');" +
    " return { locked: b.classList.contains('sub-locked'), title: b.getAttribute('title'), icon: b.querySelector('.material-symbols-outlined').textContent," +
    " linkVis: getComputedStyle(l).display, linkHref: l.getAttribute('href'), upLocked: up.classList.contains('sub-locked') }; })()");
  check('D1 basic tab：头像图库钮锁态（sub-locked+title 订阅后可用+lock 图标）+ 升级链接可见（href premium.html）+ 上传钮零锁',
    d1a.locked && d1a.title === '订阅后可用' && d1a.icon === 'lock' && d1a.linkVis === 'inline-block' &&
    d1a.linkHref === 'premium.html' && !d1a.upLocked, JSON.stringify(d1a));
  await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"custom\"]').click()");
  await sleep(300);
  const d1b = await t.evalJs("(() => { var b = document.getElementById('editBannerLibBtn'); var l = document.getElementById('bannerGifUpgradeLink');" +
    " var up = document.getElementById('editBannerUploadBtn'); var rm = document.getElementById('editBannerRemoveBtn');" +
    " return { locked: b.classList.contains('sub-locked'), title: b.getAttribute('title'), icon: b.querySelector('.material-symbols-outlined').textContent," +
    " badge: b.textContent.indexOf('订阅') !== -1, linkVis: getComputedStyle(l).display," +
    " upLocked: up.classList.contains('sub-locked'), rmLocked: rm.classList.contains('sub-locked') }; })()");
  check('D1 custom tab：横幅图库钮锁态（sub-locked+title 订阅后可用+lock 图标+订阅徽标）+ 升级链接可见 + 上传/移除钮零锁',
    d1b.locked && d1b.title === '订阅后可用' && d1b.icon === 'lock' && d1b.badge && d1b.linkVis === 'inline-block' &&
    !d1b.upLocked && !d1b.rmLocked, JSON.stringify(d1b));
  await pressEsc(t);

  // ── D2/D3 免费点图库 → toast 不生效（选择器绝不打开：DOM 零构建+零上传+零 PATCH）──
  console.log('── D2/D3. 免费点图库拦截 ──');
  await openEdit(t, 'custom');
  const d2Before = { up: await upCount(t), pt: await patchCount(t) };
  await t.evalJs("document.getElementById('editBannerLibBtn').click()");
  await sleep(500);
  const d2 = await t.evalJs("(() => { return { toasts: window.__toasts.join('|')," +
    " picker: !!(document.querySelector('.fc-lib-pick-modal') || document.querySelector('.fc-lib-pick-grid') || document.querySelector('.fc-lib-pick-empty'))," +
    " ups: window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/uploads') !== -1; }).length," +
    " pts: window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).length }; })()");
  check('D2 免费点横幅图库：toast「图库为订阅用户专属功能」+ 选择器零构建 + 零上传 + 零 PATCH',
    d2.toasts.indexOf('图库为订阅用户专属功能') !== -1 && !d2.picker && d2.ups === d2Before.up && d2.pts === d2Before.pt, JSON.stringify(d2));
  await pressEsc(t);
  // 弹窗已关（Esc）——重开即初始 basic tab，零 nav 点击
  await openEdit(t);
  const d3Before = { up: await upCount(t), pt: await patchCount(t) };
  await t.evalJs("document.getElementById('editAvatarLibBtn').click()");
  await sleep(500);
  const d3 = await t.evalJs("(() => { return { toasts: window.__toasts.join('|')," +
    " picker: !!(document.querySelector('.fc-lib-pick-modal') || document.querySelector('.fc-lib-pick-grid') || document.querySelector('.fc-lib-pick-empty'))," +
    " ups: window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/uploads') !== -1; }).length," +
    " pts: window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).length }; })()");
  check('D3 免费点头像图库：toast「图库为订阅用户专属功能」+ 选择器零构建 + 零上传 + 零 PATCH',
    d3.toasts.indexOf('图库为订阅用户专属功能') !== -1 && !d3.picker && d3.ups === d3Before.up && d3.pts === d3Before.pt, JSON.stringify(d3));
  await pressEsc(t);

  // ── D4/D5 免费传 gif → toast 拦截（零上传+零 PATCH+零 state 变化）──
  console.log('── D4/D5. 免费传 gif 拦截 ──');
  const tmpBgif = path.join(__dirname, 'tmp-subtier-banner.gif');
  fs.writeFileSync(tmpBgif, PIXEL_PNG); // 客户端只查扩展名，罐头端点不看魔数
  await openEdit(t, 'custom');
  const d4Before = { up: await upCount(t), pt: await patchCount(t) };
  await feedFile(t, '#editBannerFile', tmpBgif);
  const d4 = await t.evalJs("(() => { var pv = document.getElementById('editBannerPreview');" +
    " return { toasts: window.__toasts.join('|'), state: document.getElementById('editBannerState').textContent, pvBg: pv.style.backgroundImage," +
    " ups: window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/uploads') !== -1; }).length," +
    " pts: window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).length }; })()");
  check('D4 免费传 gif 横幅：toast「GIF 动图为订阅用户专属功能」+ 零上传 + 零 PATCH + state 无「上传中/已就绪」+ 预览不变',
    d4.toasts.indexOf('GIF 动图为订阅用户专属功能') !== -1 && d4.ups === d4Before.up && d4.pts === d4Before.pt &&
    d4.state.indexOf('上传中') === -1 && d4.state.indexOf('已就绪') === -1 && d4.pvBg === '', JSON.stringify(d4));
  await pressEsc(t);
  const tmpAgif = path.join(__dirname, 'tmp-subtier-avatar.gif');
  fs.writeFileSync(tmpAgif, PIXEL_PNG);
  const d5Before = { up: await upCount(t), pt: await patchCount(t) };
  await openEdit(t);
  await feedFile(t, '#editAvatarFile', tmpAgif);
  const d5 = await t.evalJs("(() => { var img = document.getElementById('editAvatarPreview');" +
    " return { toasts: window.__toasts.join('|'), state: document.getElementById('editSaveState').textContent, src: img.getAttribute('src')," +
    " ups: window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/uploads') !== -1; }).length," +
    " pts: window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).length }; })()");
  check('D5 免费传 gif 头像：toast「GIF 动图为订阅用户专属功能」+ 零上传 + 零 PATCH + state 无「上传中/已就绪」+ 头像预览不变',
    d5.toasts.indexOf('GIF 动图为订阅用户专属功能') !== -1 && d5.ups === d5Before.up && d5.pts === d5Before.pt &&
    d5.state.indexOf('上传中') === -1 && d5.state.indexOf('已就绪') === -1 && d5.src === AVATAR_URI, JSON.stringify(d5));
  await pressEsc(t);

  // ── D6 免费核心功能回归：静态 jpg 横幅上传放行 → 保存 → 头部 has-img ──
  console.log('── D6. 免费传静态放行（核心功能回归）──');
  const tmpJpg = path.join(__dirname, 'tmp-subtier-banner.jpg');
  fs.writeFileSync(tmpJpg, PIXEL_PNG);
  await openEdit(t, 'custom');
  const d6UpBefore = await upCount(t);
  await feedFile(t, '#editBannerFile', tmpJpg);
  const d6a = await t.evalJs("(() => { var pv = document.getElementById('editBannerPreview');" +
    " return { state: document.getElementById('editBannerState').textContent, pvBg: pv.style.backgroundImage," +
    " ups: window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/uploads') !== -1; }).length }; })()");
  check('D6 免费传静态 jpg 横幅：上传恰 1 次 + 预览挂图 + 就绪文案「横幅已就绪，点保存生效」',
    d6a.ups === d6UpBefore + 1 && d6a.pvBg.indexOf('UPL-DEMO01') !== -1 && d6a.state.indexOf('横幅已就绪') !== -1, JSON.stringify(d6a));
  await t.evalJs("document.getElementById('editSaveBtn').click()");
  await sleep(800);
  const d6b = await t.evalJs("(() => { var bn = document.querySelector('.profile-banner');" +
    " var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
    " return { rawCalls: rawCalls, hasImg: bn.classList.contains('has-img'), bnBg: getComputedStyle(bn).backgroundImage," +
    " cardGone: !document.querySelector('.modal-card') || !document.querySelector('.modal-card').parentNode }; })()");
  console.log('D6 raw PATCH bodies:', JSON.stringify(d6b.rawCalls));
  const d6BannerCalls = d6b.rawCalls.filter(function (b) { return b.indexOf('bannerUrl') !== -1; });
  check('D6 保存 → PATCH 含 bannerUrl 恰 1 次且 body 精确 ={"bannerUrl":"/uploads/UPL-DEMO01.jpg"} + 弹窗关 + 头部 has-img（含 UPL-DEMO01）',
    d6BannerCalls.length === 1 && d6BannerCalls[0] === '{"bannerUrl":"/uploads/UPL-DEMO01.jpg"}' && d6b.cardGone &&
    d6b.hasImg && d6b.bnBg.indexOf('UPL-DEMO01') !== -1, JSON.stringify(d6BannerCalls));
  fs.unlinkSync(tmpBgif); fs.unlinkSync(tmpAgif); fs.unlinkSync(tmpJpg);

  // ── D7 订阅全解锁：两钮零锁+链接隐藏+图库 gif 条目放行+文件 gif 放行 ──
  console.log('── D7. 订阅全解锁 ──');
  await seedSub(t);
  await openEdit(t, 'custom');
  const d7a = await t.evalJs("(() => { var b = document.getElementById('editBannerLibBtn'); var l = document.getElementById('bannerGifUpgradeLink');" +
    " var av = document.getElementById('editAvatarLibBtn'); var al = document.getElementById('avatarGifUpgradeLink');" +
    " return { bLocked: b.classList.contains('sub-locked'), bIconEl: b.querySelector('.material-symbols-outlined'), bBadge: b.querySelector('.label-sm')," +
    " lVis: getComputedStyle(l).display, avLocked: av.classList.contains('sub-locked'), avIcon: av.querySelector('.material-symbols-outlined').textContent," +
    " alVis: getComputedStyle(al).display }; })()");
  check('D7 订阅会话：横幅/头像图库钮零锁 + 横幅钮无锁图标无徽标（sub 分支整体不渲染）+ 头像钮 icon photo_library + 两升级链接 display:none',
    !d7a.bLocked && d7a.bIconEl === null && d7a.bBadge === null && d7a.lVis === 'none' && !d7a.avLocked && d7a.avIcon === 'photo_library' && d7a.alVis === 'none', JSON.stringify(d7a));
  await pressEsc(t);
  const d7UpBase = await upCount(t);
  await t.evalJs("localStorage.setItem('slati_img_library', JSON.stringify([{ src: '" + GIF_DATAURL + "', name: '电池动图' }]))");
  await openEdit(t, 'custom');
  await t.evalJs("document.getElementById('editBannerLibBtn').click()");
  await sleep(500);
  const d7b = await t.evalJs("(() => { var g = document.querySelector('.fc-lib-pick-grid'); var it = g ? g.querySelector('.fc-lib-pick-item') : null;" +
    " return { itemN: g ? g.children.length : 0, img: it ? it.querySelector('img').getAttribute('src') : null, label: it ? it.querySelector('.label-sm').textContent : null }; })()");
  check('D7 订阅开横幅图库：选择器开 + 预种 1 gif 条目（缩略图+名称）', d7b.itemN === 1 && d7b.img === GIF_DATAURL && d7b.label === '电池动图', JSON.stringify(d7b));
  await t.evalJs("document.querySelector('.fc-lib-pick-item').click()");
  await sleep(800);
  const d7c = await t.evalJs("(() => { var pv = document.getElementById('editBannerPreview');" +
    " return { state: document.getElementById('editBannerState').textContent, pvBg: pv.style.backgroundImage," +
    " ups: window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/uploads') !== -1; }).length }; })()");
  check('D7 图库 gif 条目点选 → 上传恰 1 次（gif 对订阅放行）+ 预览挂图 + 就绪文案',
    d7c.ups === d7UpBase + 1 && d7c.pvBg.indexOf('UPL-DEMO01') !== -1 && d7c.state.indexOf('横幅已就绪') !== -1, JSON.stringify(d7c));
  const tmpBgif2 = path.join(__dirname, 'tmp-subtier-banner2.gif');
  fs.writeFileSync(tmpBgif2, PIXEL_PNG);
  await feedFile(t, '#editBannerFile', tmpBgif2);
  const tmpAgif2 = path.join(__dirname, 'tmp-subtier-avatar2.gif');
  fs.writeFileSync(tmpAgif2, PIXEL_PNG);
  await t.evalJs("document.querySelector('#editNavBtns [data-edit-tab=\"basic\"]').click()");
  await sleep(300);
  await feedFile(t, '#editAvatarFile', tmpAgif2);
  const d7d = await t.evalJs("(() => { var img = document.getElementById('editAvatarPreview');" +
    " return { ups: window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/uploads') !== -1; }).length," +
    " avSrc: img.getAttribute('src'), avState: document.getElementById('editSaveState').textContent }; })()");
  check('D7 订阅传 gif 文件（横幅+头像）→ 共 +2 上传 + 头像预览换图 + 就绪文案',
    d7d.ups === d7UpBase + 3 && d7d.avSrc === '/uploads/UPL-DEMO01.jpg' && d7d.avState.indexOf('新头像已就绪') !== -1, JSON.stringify(d7d));
  await pressEsc(t);
  fs.unlinkSync(tmpBgif2); fs.unlinkSync(tmpAgif2);

  // ── D8 祖父：免费用户已有 gif 横幅继续显示；预览预填原图；锁 UI 在位；移除+保存 null → 回渐变 ──
  console.log('── D8. 祖父（免费用户已有 gif 横幅）──');
  await t.evalJs("localStorage.setItem('__battInitBanner', '/uploads/GRANDPA.gif')");
  await clearUser(t);
  await seedFree(t);
  await t.send('Page.reload');
  await sleep(800);
  await waitFor(t, "document.getElementById('profileMain').style.display === 'flex'", 15000, '主页渲染（祖父）');
  await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
  await patchToast(t);
  await waitFor(t, "document.getElementById('profileEditBtn')", 10000, '编辑钮就位');
  const d8a = await t.evalJs("(() => { var bn = document.querySelector('.profile-banner');" +
    " return { hasImg: bn.classList.contains('has-img'), bnBg: getComputedStyle(bn).backgroundImage }; })()");
  check('D8 祖父显示：免费用户已有 gif 横幅 → 头部仍 has-img + computed 背景含 GRANDPA（渲染无 tier 检查）',
    d8a.hasImg && d8a.bnBg.indexOf('GRANDPA') !== -1, JSON.stringify(d8a));
  await openEdit(t, 'custom');
  const d8b = await t.evalJs("(() => { var pv = document.getElementById('editBannerPreview'); var b = document.getElementById('editBannerLibBtn');" +
    " var l = document.getElementById('bannerGifUpgradeLink');" +
    " return { pvBg: pv.style.backgroundImage, locked: b.classList.contains('sub-locked'), linkVis: getComputedStyle(l).display }; })()");
  check('D8 祖父编辑：预览预填原图（GRANDPA）+ 免费锁 UI 在位（sub-locked+升级链接可见）',
    d8b.pvBg.indexOf('GRANDPA') !== -1 && d8b.locked && d8b.linkVis === 'inline-block', JSON.stringify(d8b));
  await t.evalJs("document.getElementById('editBannerRemoveBtn').click()");
  await sleep(300);
  const d8c0 = await t.evalJs("(() => { var pv = document.getElementById('editBannerPreview');" +
    " return { pvBg: pv.style.backgroundImage, state: document.getElementById('editBannerState').textContent }; })()");
  check('D8 点移除 → 预览清图 + 提示文案「上传图片或从图库选择，点保存生效」（移除按钮永可用）',
    d8c0.pvBg === '' && d8c0.state.indexOf('上传图片或从图库选择') !== -1, JSON.stringify(d8c0));
  await t.evalJs("document.getElementById('editSaveBtn').click()");
  await sleep(800);
  const d8c = await t.evalJs("(() => { var bn = document.querySelector('.profile-banner');" +
    " var rawCalls = window.__fetchCalls.filter(function (c) { return c.method === 'PATCH'; }).map(function (c) { return c.body; });" +
    " return { rawCalls: rawCalls, hasImg: bn.classList.contains('has-img'), bnBg: getComputedStyle(bn).backgroundImage }; })()");
  console.log('D8 raw PATCH bodies:', JSON.stringify(d8c.rawCalls));
  const d8BannerCalls = d8c.rawCalls.filter(function (b) { return b.indexOf('bannerUrl') !== -1; });
  check('D8 保存 → PATCH 含 bannerUrl 恰 1 次且 body 精确 ={"bannerUrl":null}（显式移除语义）+ 头部回渐变（无 has-img/无 GRANDPA/linear-gradient 在）',
    d8BannerCalls.length === 1 && d8BannerCalls[0] === '{"bannerUrl":null}' && !d8c.hasImg &&
    d8c.bnBg.indexOf('GRANDPA') === -1 && d8c.bnBg.indexOf('linear-gradient') !== -1, JSON.stringify(d8BannerCalls));

  check('D10 全链 0 console error', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log('\n' + pass.length + ' ✅ / ' + fail.length + ' ❌');
  t.close();
  chrome.kill();
  process.exit(fail.length ? 1 : 0);
}
main().catch(async e => {
  console.error('💥', e.stack || e.message);
  try { if (T0) T0.close(); } catch (x) {}
  try { if (CHROME0) CHROME0.kill(); } catch (x) {}
  try { server.close(); } catch (x) {}
  await sleep(300);
  process.exit(1);
});
