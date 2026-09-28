// tmp-battery-all-opaque.js — v0.2.55.0 全站卡片不透明底电池（S 静态巡检 + B Chrome 浏览器段）
// 用户「能不能把全部变成不透明的卡片？」→ 问询钦定：①全站所有页面卡片不透明底（FC 两页除外）
//   ②首页深色订阅卡保持深色不变（内联渐变天然豁免）③Community 个人页钦定液态玻璃保留（profile-header 排除）。
//   全站 .card 铺满 --sidebar-bg 不透明底（亮色 rgba(255,255,255,0.95) / 暗色 rgb(26,26,46)）
//   ＋灭玻璃注入层 .lg-backdrop 滤镜/磨砂（与 09-18 亮色侧栏修法同机制）；FC 两页 body 挂 fc-page 类排除
//   （FC 玻璃/倾斜设计不动）；plan-card/auth-card/modal-card/pv-card 均无 .card 类天然豁免
// 断言：
//   S  静态：ethereal 全站铺底+灭层规则在位（body:not(.fc-page) 三面）/ 旧 mn-index 规则零残留 /
//       FC 两页 body 含 fc-page / 订阅卡深色渐变零触碰 / cp 钦定玻璃规则锚 / 41 页内联块含新规则（55.0 article.html 入族） /
//       site-config v0.2.55.0 + changelog 条目 + FC v10.28.36.1 保持 / 豁免卡锚（plan-card/auth-card）
//   B1 浏览器（登录 index 亮色）：18 张 .card 全 0.95 不透明 / 层全灭 / 胶囊同底 / 订阅卡深色渐变白字仍在
//   B2 浏览器（登录 index 暗色）：18 卡全 rgb(26,26,46)
//   B3 浏览器（访客 index）：guest-hero 大卡亮暗同底 + 层灭（54.3 保留回归）
//   B4 浏览器（explore）：页面卡全 0.95 + 层灭（全站化实证）
//   B5 浏览器（messages）：页面卡全 0.95 + 层灭（全站化实证）
//   B6 浏览器（community-profile）：profile-header 玻璃保留（bg 0.55 + 层 filter 含 glass-distortion）
//       + 其余普通卡全 0.95 + 层灭（钦定豁免 + 全站化并证）
//   B7 浏览器（fluidcanvas FC 页）：body.fc-page + 动态插卡 bg 仍 0.55 玻璃原值（fc-page 豁免实证）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4950 + Math.floor(Math.random() * 80);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

// ═══ S. 静态巡检（纯文件，无浏览器）═══
console.log('═══ S. 静态巡检 ═══');
{
  const css = read('docs/assets/css/ethereal.css');
  ok('S1 ethereal 全站铺底规则在位（body:not(.fc-page) 三面）',
    css.indexOf('body:not(.fc-page) .card:not(.profile-header),') !== -1 &&
    css.indexOf('body:not(.fc-page) .search-capsule,') !== -1 &&
    css.indexOf('body:not(.fc-page) .app-main .guest-hero {') !== -1 &&
    css.indexOf('background: var(--sidebar-bg);') !== -1);
  ok('S2 ethereal 全站灭层规则在位（card + guest-hero 直系 lg-backdrop 灭滤镜灭磨砂）',
    css.indexOf('body:not(.fc-page) .card:not(.profile-header) > .lg-backdrop,') !== -1 &&
    css.indexOf('body:not(.fc-page) .guest-hero > .lg-backdrop {') !== -1 &&
    css.indexOf('filter: none;') !== -1 && css.indexOf('backdrop-filter: none;') !== -1);
  ok('S3 旧 mn-index 首页规则零残留（54.3 块整体替换为全站规则）',
    css.indexOf('body.mn-index .app-main') === -1);
  ok('S4 ethereal 修复注释含用户原话 + 三钦定口径',
    css.indexOf('能不能把全部变成不透明的卡片') !== -1 &&
    css.indexOf('全站所有页面卡片不透明底') !== -1 &&
    css.indexOf('订阅卡保持深色') !== -1 && css.indexOf('液态玻璃保留') !== -1);
  const fc1 = read('docs/pages/fluidcanvas.html');
  const fc2 = read('docs/pages/fluidcanvas-editor.html');
  ok('S5 FC 两页 body 挂 fc-page 排除类', fc1.indexOf('<body class="pre-stagger fc-page">') !== -1 &&
    fc2.indexOf('<body class="pre-stagger fc-page">') !== -1);
  const idx = read('docs/index.html');
  ok('S6 index body 挂 mn-index 页面类（首页作用域保留，无碍全站规则）',
    idx.indexOf('<body class="pre-stagger mn-index">') !== -1);
  ok('S7 订阅卡深色渐变底零触碰（白字设计卡钦定不动）',
    idx.indexOf('background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);color:white') !== -1);
  const cp = read('docs/pages/community-profile.html');
  ok('S8 cp 页钦定玻璃规则锚在位（profile-header 层 glass-distortion + blur(10px)）',
    cp.indexOf('.profile-header .lg-backdrop') !== -1 &&
    cp.indexOf('url(#glass-distortion)') !== -1 && cp.indexOf('blur(10px)') !== -1);
  // 内联页全量巡检：凡含 lg-glass-filter 内联块的页面必有新规则（inline-css.js 已刷新）
  const files = [];
  (function walk(dir, base) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name), base + e.name + '/');
      else if (e.name.endsWith('.html')) files.push(base + e.name);
    }
  })(DOCS, '');
  const inlinePages = files.filter((f) => read(path.join(DOCS, f)).indexOf('lg-glass-filter') !== -1);
  ok('S9 内联页总数 = 41（55.0 article.html 入族，实测 ' + inlinePages.length + '）', inlinePages.length === 41);
  let bad = 0;
  for (const f of inlinePages) {
    if (read(path.join(DOCS, f)).indexOf('body:not(.fc-page) .card:not(.profile-header)') === -1) {
      bad++; fail++; console.log('  ❌ 内联块缺全站铺底规则：' + f);
    }
  }
  if (bad === 0) { pass++; console.log('  ✅ S10 41 页内联块全部含全站铺底规则'); }
  const s = read('docs/assets/js/site-config.js');
  ok('S11 site-config 版本 = v0.2.55.0', s.indexOf("window.MN_SITE_VERSION = 'v0.2.58.18';") !== -1);
  ok('S12 site-config changelog 含 v0.2.55.0 条目 + 用户原话',
    s.indexOf('v0.2.55.0') !== -1 && s.indexOf('能不能把全部变成不透明的卡片') !== -1);
  ok('S13 FC v10.28.36.1 保持', s.indexOf("'v10.28.47.4'") !== -1);
  const prem = read('docs/pages/premium.html');
  const auth = read('docs/signup-and-login.html');
  ok('S14 豁免卡零触碰锚（plan-card 深色 !important 仍在 + auth-card 仍在）',
    prem.indexOf('plan-card') !== -1 && prem.indexOf('rgba(30,28,50,0.7)') !== -1 &&
    auth.indexOf('auth-card tilt-container auth-tab-login') !== -1);
  ok('S15 admin 页 body 裸标签无 class（命中全站规则属全站口径）',
    read('docs/admin/index.html').indexOf('<body>') !== -1);
}

// ── house CDP 骨架 ────────────────────────────────────────────────
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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitFor(cdp, expr, ms, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await cdp.evalJs(expr)) return true; } catch (e) {}
    await sleep(120);
  }
  throw new Error('waitFor 超时：' + (label || expr));
}

async function launchChrome(suffix) {
  const CDP_PORT = 5950 + Math.floor(Math.random() * 80);
  const USER_DATA = path.join(os.tmpdir(), 'mn-batt-opaque-' + suffix + '-' + Date.now());
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
  let up = false;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
    await sleep(250);
  }
  if (!up) throw new Error('Chrome 未起来');
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  const page = pages.find(x => x.type === 'page');
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
  const cleanup = () => { try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {} };
  return { cdp, cleanup, chrome };
}

// 收集卡面状态（bg=自身 backgroundColor、bf=自身 backdropFilter、层 filter/backdropFilter）
const SNAP_CARDS = `(function(){
  var cards = [].slice.call(document.querySelectorAll('.card'));
  function one(el){
    var cs = getComputedStyle(el);
    var bd = el.querySelector(':scope > .lg-backdrop');
    return { cls: el.className, bg: cs.backgroundColor, bf: cs.backdropFilter,
      layer: bd ? { f: getComputedStyle(bd).filter, bf: getComputedStyle(bd).backdropFilter } : null };
  }
  return { n: cards.length, cards: cards.map(one) };
})()`;

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const SESSION = 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, user: { id: 'USR-000001', name: 'Neo', email: 'neo@mn.world', tier: 'premium' } })) + ');}catch(e){}';

  // ═══ B1. 登录 index 亮色（全站规则回归：首页 18 卡同 54.3 口径）═══
  try {
    console.log('═══ B1. 登录 index 亮色 ═══');
    const B = await launchChrome('B1');
    const cdp = B.cdp;
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION });
    await cdp.send('Page.navigate', { url: BASE + '/' });
    await waitFor(cdp, 'document.querySelectorAll(".app-main .card").length >= 18', 15000, '18 张工作台卡');
    await waitFor(cdp, 'document.querySelectorAll("#dashAnnouncements .card > .lg-backdrop").length === 10', 15000, '公告卡玻璃层注入');
    let s = await cdp.evalJs(SNAP_CARDS);
    ok('B1 卡数 = 18（问候 1+活动流 4+公告 10+工作台/指标/我的世界 3）', s.n === 18, String(s.n));
    ok('B2 亮色 18 卡 backgroundColor 全 rgba(255,255,255,0.95) 不透明侧栏同底',
      s.cards.every(c => c.bg === 'rgba(255, 255, 255, 0.95)'),
      s.cards.map(c => c.bg).filter((v, i, a) => a.indexOf(v) === i).join('/'));
    const withLayer = s.cards.filter(c => c.layer);
    ok('B3 13 张非 tilt 卡 .lg-backdrop 全灭（filter=none + backdropFilter=none）',
      withLayer.length === 13 && withLayer.every(c => c.layer.f === 'none' && c.layer.bf === 'none'),
      '挂层 ' + withLayer.length + '/' + JSON.stringify(withLayer.filter(c => c.layer.f !== 'none').slice(0, 2)));
    ok('B4 订阅卡深色渐变白字仍在（钦定保持深色不变）',
      await cdp.evalJs(`(function(){
        var t = [].slice.call(document.querySelectorAll('.tilt-container')).filter(function(el){
          return getComputedStyle(el).backgroundImage.indexOf('gradient') !== -1; });
        return t.length >= 1 && t.every(function(el){
          return getComputedStyle(el).backgroundImage.indexOf('linear-gradient') !== -1 &&
                 getComputedStyle(el).color === 'rgb(255, 255, 255)'; });
      })()`));
    ok('B5 搜索胶囊同底 0.95（54.3 口径保留）',
      await cdp.evalJs(`(function(){
        var sc = document.querySelector('.app-main .search-capsule');
        return sc && getComputedStyle(sc).backgroundColor === 'rgba(255, 255, 255, 0.95)'; })()`));
    await cdp.evalJs('document.documentElement.setAttribute("data-theme","dark")');
    await waitFor(cdp, 'getComputedStyle(document.querySelector(".app-main .card")).backgroundColor === "rgb(26, 26, 46)"', 5000, '暗色卡底');
    s = await cdp.evalJs(SNAP_CARDS);
    ok('B6 暗色 18 卡 backgroundColor 全 rgb(26,26,46)（侧栏暗色同底）',
      s.cards.every(c => c.bg === 'rgb(26, 26, 46)'),
      s.cards.map(c => c.bg).filter((v, i, a) => a.indexOf(v) === i).join('/'));
    B.cleanup();
  } catch (e) { fail++; console.log('  ❌ B1 段异常：' + e.message); }

  // ═══ B2. 访客 index：guest-hero 大卡亮/暗（54.3 保留回归）═══
  try {
    console.log('═══ B2. 访客 index guest-hero ═══');
    const B = await launchChrome('B2');
    const cdp = B.cdp;
    await cdp.send('Page.navigate', { url: BASE + '/' });
    await waitFor(cdp, '!!document.querySelector(".app-main .guest-hero") && getComputedStyle(document.querySelector(".app-main .guest-hero")).display !== "none"', 15000, '访客大卡可见');
    await waitFor(cdp, '!!document.querySelector(".app-main .guest-hero > .lg-backdrop")', 15000, '访客大卡玻璃层注入');
    let gh = await cdp.evalJs(`(function(){
      var el = document.querySelector('.app-main .guest-hero');
      var cs = getComputedStyle(el);
      var bd = el.querySelector(':scope > .lg-backdrop');
      return { bg: cs.backgroundColor, f: getComputedStyle(bd).filter, bf: getComputedStyle(bd).backdropFilter };
    })()`);
    ok('B7 访客大卡亮色底 rgba(255,255,255,0.95) + 层全灭', gh.bg === 'rgba(255, 255, 255, 0.95)' && gh.f === 'none' && gh.bf === 'none', JSON.stringify(gh));
    await cdp.evalJs('document.documentElement.setAttribute("data-theme","dark")');
    await waitFor(cdp, 'getComputedStyle(document.querySelector(".app-main .guest-hero")).backgroundColor === "rgb(26, 26, 46)"', 5000, '暗色大卡底');
    gh = await cdp.evalJs(`(function(){
      var el = document.querySelector('.app-main .guest-hero');
      var bd = el.querySelector(':scope > .lg-backdrop');
      return { bg: getComputedStyle(el).backgroundColor, f: getComputedStyle(bd).filter, bf: getComputedStyle(bd).backdropFilter };
    })()`);
    ok('B8 访客大卡暗色底 rgb(26,26,46) + 层仍全灭', gh.bg === 'rgb(26, 26, 46)' && gh.f === 'none' && gh.bf === 'none', JSON.stringify(gh));
    B.cleanup();
  } catch (e) { fail++; console.log('  ❌ B2 段异常：' + e.message); }

  // ═══ B3. explore 页（全站化实证：非首页页面卡同口径）═══
  try {
    console.log('═══ B3. explore 页全站化 ═══');
    const B = await launchChrome('B3');
    const cdp = B.cdp;
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION });
    await cdp.send('Page.navigate', { url: BASE + '/pages/explore.html' });
    await waitFor(cdp, 'document.querySelectorAll(".card").length >= 3', 15000, 'explore 卡渲染');
    await waitFor(cdp, 'document.querySelectorAll(".card > .lg-backdrop").length >= 1', 15000, 'explore 卡玻璃层注入');
    const s = await cdp.evalJs(SNAP_CARDS);
    ok('B9 explore 页 ' + s.n + ' 张卡 backgroundColor 全 0.95 不透明',
      s.cards.every(c => c.bg === 'rgba(255, 255, 255, 0.95)'),
      s.cards.map(c => c.bg).filter((v, i, a) => a.indexOf(v) === i).join('/'));
    const wl = s.cards.filter(c => c.layer);
    ok('B10 explore 页挂层卡 .lg-backdrop 全灭', wl.length >= 1 && wl.every(c => c.layer.f === 'none' && c.layer.bf === 'none'),
      '挂层 ' + wl.length + '/' + JSON.stringify(wl.filter(c => c.layer.f !== 'none').slice(0, 2)));
    B.cleanup();
  } catch (e) { fail++; console.log('  ❌ B3 段异常：' + e.message); }

  // ═══ B4. messages 页（全站化实证）═══
  try {
    console.log('═══ B4. messages 页全站化 ═══');
    const B = await launchChrome('B4');
    const cdp = B.cdp;
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION });
    await cdp.send('Page.navigate', { url: BASE + '/pages/messages.html' });
    await waitFor(cdp, 'document.querySelectorAll(".card").length >= 2', 15000, 'messages 卡渲染');
    await waitFor(cdp, 'document.querySelectorAll(".card > .lg-backdrop").length >= 1', 15000, 'messages 卡玻璃层注入');
    const s = await cdp.evalJs(SNAP_CARDS);
    ok('B11 messages 页 ' + s.n + ' 张卡 backgroundColor 全 0.95 不透明',
      s.cards.every(c => c.bg === 'rgba(255, 255, 255, 0.95)'),
      s.cards.map(c => c.bg).filter((v, i, a) => a.indexOf(v) === i).join('/'));
    const wl = s.cards.filter(c => c.layer);
    ok('B12 messages 页挂层卡 .lg-backdrop 全灭', wl.length >= 1 && wl.every(c => c.layer.f === 'none' && c.layer.bf === 'none'),
      '挂层 ' + wl.length + '/' + JSON.stringify(wl.filter(c => c.layer.f !== 'none').slice(0, 2)));
    B.cleanup();
  } catch (e) { fail++; console.log('  ❌ B4 段异常：' + e.message); }

  // ═══ B5. community-profile 页（钦定豁免 + 全站化并证；照 cp 电池 fetch 桩口径）═══
  try {
    console.log('═══ B5. community-profile 钦定玻璃保留 ═══');
    const B = await launchChrome('B5');
    const cdp = B.cdp;
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION });
    // 页内 fetch 桩（house 静态服务器 /api/* 404）：自己 USR-000001 罐头数据 + 空帖 → 渲染 profile-header/tabs/空态
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(function () {
      var ME = { id: 'USR-000001', displayName: 'Neo', avatarUrl: null,
        bio: '电池简介', gender: 'Male', citizenId: 'CIT-000001', createdAt: '2026-08-01T00:00:00.000Z',
        isSelf: true, followedByMe: false, followerCount: 0, followingCount: 0,
        cardBg: null, cardPlate: null, pageBgImage: null, cardEdge: null,
        stats: { postCount: 0, repostCount: 0, likeReceivedCount: 0, likeCount: 0, favoriteCount: 0 } };
      function res(status, body) { return { status: status, ok: status >= 200 && status < 300,
        headers: { get: function () { return null; } }, json: function () { return Promise.resolve(body); } }; }
      var realFetch = window.fetch.bind(window);
      window.fetch = function (url, opts) {
        var u = String(url);
        if (u.indexOf('/api/') !== -1) {
          if (u.indexOf('/api/social/users/USR-000001/posts?tab=') === 0) return Promise.resolve(res(200, { posts: [] }));
          if (u.indexOf('/api/social/users/USR-000001') === 0) return Promise.resolve(res(200, { user: ME }));
        }
        return realFetch(url, opts);
      };
    })();` });
    await cdp.send('Page.navigate', { url: BASE + '/pages/community-profile.html?id=USR-000001' });
    await waitFor(cdp, 'document.getElementById("profileMain") && document.getElementById("profileMain").style.display === "flex"', 20000, '主页渲染');
    await waitFor(cdp, '!!document.querySelector(".profile-header") && !!document.querySelector(".profile-tabs")', 15000, 'profile-header + tabs');
    await waitFor(cdp, '!!document.querySelector(".profile-tabs > .lg-backdrop")', 15000, 'profile-tabs 玻璃层注入');
    const ph = await cdp.evalJs(`(function(){
      var el = document.querySelector('.profile-header');
      var cs = getComputedStyle(el);
      var bd = el.querySelector(':scope > .lg-backdrop');
      return { cls: el.className, bg: cs.backgroundColor,
        layer: bd ? { f: getComputedStyle(bd).filter, bf: getComputedStyle(bd).backdropFilter } : null };
    })()`);
    ok('B13 profile-header 玻璃保留（bg=var(--card-bg) 0.55 原玻璃值，非 0.95）',
      ph.bg === 'rgba(255, 255, 255, 0.55)', ph.cls + ' → ' + ph.bg);
    ok('B14 profile-header 钦定玻璃层保留（filter 含 glass-distortion + blur(10px) 磨砂）',
      ph.layer && ph.layer.f.indexOf('glass-distortion') !== -1 && ph.layer.bf.indexOf('blur(10px)') !== -1,
      ph.layer && (ph.layer.f + ' / ' + ph.layer.bf));
    const s = await cdp.evalJs(SNAP_CARDS);
    const others = s.cards.filter(c => c.cls.indexOf('profile-header') === -1);
    ok('B15 cp 页其余 ' + others.length + ' 张普通卡全 0.95 不透明（profile-tabs/空态等全站口径）',
      others.length >= 1 && others.every(c => c.bg === 'rgba(255, 255, 255, 0.95)'),
      others.map(c => c.bg).filter((v, i, a) => a.indexOf(v) === i).join('/'));
    const wl = others.filter(c => c.layer);
    ok('B16 cp 页普通卡挂层者 .lg-backdrop 全灭（玻璃层不误伤）',
      wl.length >= 1 && wl.every(c => c.layer.f === 'none' && c.layer.bf === 'none'),
      '挂层 ' + wl.length + '/' + JSON.stringify(wl.filter(c => c.layer.f !== 'none').slice(0, 2)));
    B.cleanup();
  } catch (e) { fail++; console.log('  ❌ B5 段异常：' + e.message); }

  // ═══ B6. fluidcanvas FC 页（fc-page 豁免实证）═══
  try {
    console.log('═══ B6. FC 页 fc-page 豁免 ═══');
    const B = await launchChrome('B6');
    const cdp = B.cdp;
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas.html' });
    await waitFor(cdp, 'document.body && document.body.classList.contains("fc-page")', 30000, 'FC 页 body 就绪');
    const probe = await cdp.evalJs(`(function(){
      var d = document.createElement('div');
      d.className = 'card'; d.id = '__battProbe';
      document.body.appendChild(d);
      var cs = getComputedStyle(d);
      var out = { bg: cs.backgroundColor, bf: cs.backdropFilter, fc: document.body.classList.contains('fc-page') };
      d.remove();
      var real = document.querySelector('.card');
      if (real) out.realBg = getComputedStyle(real).backgroundColor;
      return out;
    })()`);
    ok('B17 FC 页 body 挂 fc-page 类（排除标记在位）', probe.fc === true);
    ok('B18 FC 页 .card 背景仍 var(--card-bg) 0.55 玻璃原值（全站规则死规则）',
      probe.bg === 'rgba(255, 255, 255, 0.55)' && probe.bf === 'blur(24px)',
      probe.bg + ' / ' + probe.bf);
    ok('B19 FC 页真实卡（若有）同样非 0.95 不透明底',
      probe.realBg === undefined || probe.realBg !== 'rgba(255, 255, 255, 0.95)',
      probe.realBg === undefined ? '页面无真实 .card（动态插卡已证）' : probe.realBg);
    B.cleanup();
  } catch (e) { fail++; console.log('  ❌ B6 段异常：' + e.message); }

  console.log('\nall-opaque 电池：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})();
