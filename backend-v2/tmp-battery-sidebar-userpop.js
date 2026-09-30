// tmp-battery-sidebar-userpop.js — v0.2.58.23 侧栏用户卡片点击弹完整信息弹窗电池
// 用户「能不能点击左侧用户卡片或头像时是弹出用户完整信息弹窗而不是跳转到主页」
// 钦定：②侧栏卡片弹完整信息卡（横幅+头像+名字+公民号+性别+简介+订阅状态+关注/粉丝/帖子数+加入时间+
// 「编辑资料」「查看主页」两按钮）；锚 href 保留（中键/ctrl/新标签原生跳转）——左键 preventDefault 弹卡；
// ③「编辑资料」→ 就地打开设置弹窗 SlatiSettings.open 不跳页。数据两段式：本地 slati_user 即时渲染 +
// 异步 GET /api/social/users/:id 回填（stats/createdAt/gender/bio/bannerUrl），失败/离线=本地+统计 '—'。
// 验证：U1 静态锚（sidebar.js 弹窗件+i18n 6 键×11+site-config）；U2 真用户点击→preventDefault 不跳页+
// 弹窗 DOM 全件+tier 徽章（free 不渲染）；U3 GET 恰 1 次回填 stats+createdAt+性别/简介替换；U4 离线→本地
// 数据+统计 '—' 零异常；U5 「编辑资料」→SlatiSettings.open 被调；U6 「查看主页」href；U7 ESC/X/backdrop 关闭；
// U8 演示用户零弹窗（锚不包）；E 全程零异常。（house CDP 模式；判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-userpop-' + Date.now());
const PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

// ── document-start 种子：URL 标记矩阵 ──
//   prem=订阅 tier；off=离线（stub 404 social/users）；demo=无 USR- id（守卫零锚）；guest=登出
const SEED = `try{(function(){
  var q = location.search || '';
  localStorage.setItem('slati_lang', 'zh-CN');
  if (q.indexOf('guest') !== -1) {
    try { localStorage.removeItem('slati_session'); localStorage.removeItem('slati_user'); } catch (e) {}
    return;
  }
  localStorage.setItem('slati_session', '{"loggedIn":true}');
  var u = q.indexOf('demo') !== -1
    ? { displayName: '演示用户', citizenId: 'CIT-000099' } // 无 USR- id——isRealUser false 零锚
    : { id: 'USR-000101', displayName: '电池用户', citizenId: 'CIT-000101', bio: '本地简介', gender: 'Male',
        tier: q.indexOf('prem') !== -1 ? 'premium' : 'free',
        avatarUrl: '/uploads/UPL-DEMO01.jpg', bannerUrl: null };
  localStorage.setItem('slati_user', JSON.stringify(u));
})();}catch(e){}`;

// ── document-start fetch 罐头：记录 + social/users 罐头（prem=服务器真值回填；其余/off=404 离线面）──
const FETCH_STUB = `try{(function(){
  if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;
  var realFetch = window.fetch.bind(window);
  window.__fetchCalls = [];
  function readUser() { try { return JSON.parse(localStorage.getItem('slati_user') || 'null') || {}; } catch (e) { return {}; } }
  function res(status, body) {
    return { status: status, ok: status >= 200 && status < 300, headers: { get: function () { return null; } }, json: function () { return Promise.resolve(body); } };
  }
  window.fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf('/api/') !== -1) {
      var method = (opts && opts.method) || 'GET';
      window.__fetchCalls.push({ url: u, method: method });
      if (method === 'GET' && u.indexOf('/api/health') === 0) return Promise.resolve(res(200, { status: 'ok', db: 'ok', tables: 60 }));
      if (method === 'GET' && u.indexOf('/api/auth/me') === 0) return Promise.resolve(res(200, { user: readUser() }));
      if (method === 'GET' && u.indexOf('/api/social/users/USR-000101') === 0) {
        if (location.search.indexOf('prem') === -1) return Promise.resolve(res(404, {})); // 默认/off=离线面：本地数据零回填
        var me = readUser();
        me.isSelf = true; me.followedByMe = false;
        me.followerCount = 2; me.followingCount = 3;
        me.stats = { postCount: 5, repostCount: 0, likeReceivedCount: 0, likeCount: 0, favoriteCount: 0 };
        me.createdAt = '2026-01-15T12:30:00.000Z';
        me.bio = '服务器简介'; me.gender = 'Female'; // 与本地（本地简介/Male）不同——回填替换铁证
        return Promise.resolve(res(200, { user: me }));
      }
    }
    return realFetch(url, opts);
  };
})();}catch(e){}`;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/uploads/') === 0) { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(PIXEL_PNG); return; }
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

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const cnt = (s, t) => s.split(t).length - 1;
  const get = async (p) => await (await fetch(BASE + p)).text();
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
    // ── U1 静态锚（实测计数口径） ──
    const sbSrc = await get('/assets/js/sidebar.js');
    const comI18n = await get('/assets/i18n/common.i18n.js');
    ok('U1 静态锚：function openUserPop 1 + slati-user-pop-style 2 + preventDefault 2（代码+注释）+ e.stopPropagation() 1 + .user-info-bar a 1 + initUserPopWiring 2 + SlatiSettings.open 3 + e.button !== 0 1',
      cnt(sbSrc, 'function openUserPop') === 1 && cnt(sbSrc, 'slati-user-pop-style') === 2 && cnt(sbSrc, 'preventDefault') === 2 &&
      cnt(sbSrc, 'e.stopPropagation()') === 1 &&
      cnt(sbSrc, '.user-info-bar a') === 1 && cnt(sbSrc, 'initUserPopWiring') === 2 && cnt(sbSrc, 'SlatiSettings.open') === 3 &&
      cnt(sbSrc, 'e.button !== 0') === 1,
      'pop=' + cnt(sbSrc, 'function openUserPop') + ' wire=' + cnt(sbSrc, 'initUserPopWiring') + ' stop=' + cnt(sbSrc, 'e.stopPropagation()'));
    ok('U1 i18n 6 键：sidebar.pop 6 键单引号 ×11（66）+ zh-Hant 双引号 ×1（6）',
      cnt(comI18n, "'sidebar.pop.editProfile'") === 11 && cnt(comI18n, "'sidebar.pop.viewProfile'") === 11 &&
      cnt(comI18n, "'sidebar.pop.following'") === 11 && cnt(comI18n, "'sidebar.pop.followers'") === 11 &&
      cnt(comI18n, "'sidebar.pop.posts'") === 11 && cnt(comI18n, "'sidebar.pop.joined'") === 11 &&
      cnt(comI18n, '"sidebar.pop.editProfile"') === 1 && cnt(comI18n, '"sidebar.pop.joined"') === 1,
      'sq=' + cnt(comI18n, "'sidebar.pop.editProfile'") + ' dq=' + cnt(comI18n, '"sidebar.pop.editProfile"'));

    const cdp = await connectCdp(CDP_PORT);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SEED });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };
    const anchorRect = () => cdp.evalJs("(function(){ var a = document.querySelector('#slati-sidebar .user-module .user-info-bar a'); if (!a) return null; var r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    // 真实 CDP 点击：先 move(5,5) 再移目标中心再按下/松开（house 已知坑——无前置 mouseMoved 命中测试漂移，
    // 首跑 U2 点击落空直接导航）；合成 a.click() 的默认导航在本版 Chrome 不受 preventDefault 约束（sessionStorage
    // 诊断实证：cap dp=false→after dp=true 却仍跳页）——不可作点击载体。真实点击 preventDefault 语义正常。
    const clickAnchor = async () => {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
      const r = await anchorRect();
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', buttons: 1, clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', buttons: 0, clickCount: 1 });
      await sleep(350);
    };
    const popGone = () => cdp.evalJs("!document.querySelector('.slati-user-pop-backdrop')");
    const popState = () => cdp.evalJs("(function(){ var bd = document.querySelector('.slati-user-pop-backdrop'); if (!bd) return null; function t(id){ var n = document.getElementById(id); return n ? n.textContent : null; } function vis(id){ var n = document.getElementById(id); return n ? getComputedStyle(n).display !== 'none' : null; } return { open: true, name: t('userPopName'), cid: t('userPopCid'), bio: t('userPopBio'), bioVis: vis('userPopBio'), gender: t('userPopGender'), genderVis: vis('userPopGender'), following: t('userPopFollowing'), followers: t('userPopFollowers'), posts: t('userPopPosts'), joined: t('userPopJoined'), joinedVis: vis('userPopJoined'), tier: (function(){ var n = bd.querySelector('.slati-user-pop-tier'); return n ? n.textContent : null; })(), avatar: (function(){ var n = document.getElementById('userPopAvatar'); return n ? n.getAttribute('src') : null; })(), bannerBg: (function(){ var n = document.getElementById('userPopBanner'); return n ? n.style.backgroundImage : null; })(), edit: !!document.getElementById('userPopEditBtn'), view: !!document.getElementById('userPopViewBtn'), viewHref: (function(){ var n = document.getElementById('userPopViewBtn'); return n ? n.getAttribute('href') : null; })() }; })()");
    const fetchUserCalls = () => cdp.evalJs("window.__fetchCalls.filter(function (c) { return c.url.indexOf('/social/users/USR-000101') !== -1; }).length");
    const closePop = async () => {
      await cdp.evalJs("(function(){ var b = document.querySelector('.slati-user-pop-close'); if (b) b.click(); })()");
      await sleep(600);
    };

    // ── U2：真用户点击卡片 → 不跳页 + 弹窗 DOM 全件（free 无 tier 徽章） ──
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .user-module .user-info-bar a')", 'U2 主页加载');
    const href0 = await cdp.evalJs('window.location.href');
    const wired2 = await cdp.evalJs("!!document.querySelector('#slati-sidebar .user-module .user-info-bar a')._userPopWired");
    await clickAnchor();
    let ps = await popState();
    ok('U2 点击卡片：不跳页（location 不变）+ 弹窗全件在位（横幅/头像/名字/公民号/bio/性别/统计/两按钮）+ free 无 tier 徽章',
      wired2 && (await cdp.evalJs('window.location.href')) === href0 && ps && ps.open && ps.name === '电池用户' && ps.cid === 'CIT-000101' &&
      ps.bio === '本地简介' && ps.bioVis && ps.genderVis && ps.gender.indexOf('Male') !== -1 &&
      ps.avatar && ps.avatar.indexOf('UPL-DEMO01') !== -1 && ps.edit && ps.view && ps.tier === null,
      JSON.stringify({ wired: wired2, hrefSame: (await cdp.evalJs('window.location.href')) === href0, name: ps && ps.name, cid: ps && ps.cid, tier: ps && ps.tier }));
    await closePop();

    // ── U3：GET 恰 1 次回填 stats+createdAt+性别/简介替换（prem 徽章） ──
    await nav(BASE + '/index.html?prem', "!!document.querySelector('#slati-sidebar .user-module .user-info-bar a')", 'U3 重载（prem）');
    await clickAnchor();
    await sleep(600);
    ps = await popState();
    ok('U3 回填：GET /social/users/USR-000101 恰 1 + 关注 3/粉丝 2/帖子 5 + 加入时间 2026-01-15 + 简介/性别被服务器真值替换 + tier 徽章 premium',
      (await fetchUserCalls()) === 1 && ps && ps.following === '3' && ps.followers === '2' && ps.posts === '5' &&
      ps.joinedVis && ps.joined.indexOf('2026-01-15') !== -1 && ps.bio === '服务器简介' && ps.gender.indexOf('Female') !== -1 &&
      ps.tier === 'premium' && ps.name === '电池用户',
      JSON.stringify({ calls: await fetchUserCalls(), f: ps && ps.following, fo: ps && ps.followers, p: ps && ps.posts, joined: ps && ps.joined, joinedVis: ps && ps.joinedVis, gender: ps && ps.gender, name: ps && ps.name, bio: ps && ps.bio, tier: ps && ps.tier }));
    await closePop();

    // ── U4：离线 → 本地数据 + 统计 '—' + 零回退假数据 ──
    await nav(BASE + '/index.html?off', "!!document.querySelector('#slati-sidebar .user-module .user-info-bar a')", 'U4 重载（off）');
    await clickAnchor();
    await sleep(600);
    ps = await popState();
    ok('U4 离线：GET 尝试恰 1（404）+ 统计恒 "—" + 加入时间保持隐藏 + 简介仍本地值 + 弹窗仍开着',
      (await fetchUserCalls()) === 1 && ps && ps.open && ps.following === '—' && ps.followers === '—' && ps.posts === '—' &&
      ps.joinedVis === false && ps.bio === '本地简介',
      JSON.stringify({ calls: await fetchUserCalls(), f: ps && ps.following, bio: ps && ps.bio }));
    await closePop();

    // ── U5：「编辑资料」→ SlatiSettings.open 被调（就地开设置弹窗不跳页） ──
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .user-module .user-info-bar a')", 'U5 重载');
    await clickAnchor();
    await cdp.evalJs("window.__slatiOpenCalls = 0; var __orig = window.SlatiSettings.open; window.SlatiSettings.open = function(){ window.__slatiOpenCalls++; return __orig.apply(this, arguments); }");
    await cdp.evalJs("document.getElementById('userPopEditBtn').click()");
    await sleep(600);
    const u5 = await cdp.evalJs("(function(){ return { calls: window.__slatiOpenCalls, settings: !!document.getElementById('settingsCard'), popGone: !document.querySelector('.slati-user-pop-backdrop') }; })()");
    ok('U5 「编辑资料」：SlatiSettings.open 恰 1 + 设置弹窗在场 + 信息弹窗已关（不跳页）', u5.calls === 1 && u5.settings && u5.popGone, JSON.stringify(u5));
    await cdp.evalJs("window.SlatiSettings.close && window.SlatiSettings.close(true)");
    await sleep(400);

    // ── U6：「查看主页」href 保留（锚可新标签打开） ──
    await clickAnchor();
    ps = await popState();
    ok('U6 「查看主页」href = ../pages/community-profile.html?id=USR-000101', ps && ps.viewHref === '../pages/community-profile.html?id=USR-000101', ps && ps.viewHref);
    await closePop();

    // ── U7：ESC / X / backdrop 三路关闭 ──
    await clickAnchor();
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await sleep(600);
    const escGone = await popGone();
    await clickAnchor();
    await cdp.evalJs("document.querySelector('.slati-user-pop-close').click()");
    await sleep(600);
    const xGone = await popGone();
    await clickAnchor();
    await cdp.evalJs("document.querySelector('.slati-user-pop-backdrop').click()");
    await sleep(600);
    const bdGone = await popGone();
    ok('U7 三路关闭：ESC + X 按钮 + 点 backdrop 均移除弹窗', escGone && xGone && bdGone, JSON.stringify({ esc: escGone, x: xGone, bd: bdGone }));

    // ── U8：演示用户（无 USR- id）零锚零弹窗 ──
    await nav(BASE + '/index.html?demo', "!!document.querySelector('#slati-sidebar .user-module .user-name')", 'U8 重载（demo）');
    const u8 = await cdp.evalJs("(function(){ var a = document.querySelector('#slati-sidebar .user-module .user-info-bar a'); return { anchor: !!a, pop: !!document.querySelector('.slati-user-pop-backdrop'), name: (function(){ var n = document.querySelector('#slati-sidebar .user-module .user-name'); return n ? n.textContent : null; })() }; })()");
    ok('U8 演示用户：零锚（点不了）+ 零弹窗 + 名字仍渲染', u8.anchor === false && u8.pop === false && u8.name === '演示用户', JSON.stringify(u8));

    // ── E：零异常 ──
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|Failed to load resource|slati_entrance|404|429/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    const realConsole = cdp.consoleErrs.filter(e => !noise.test(e));
    ok('E 全程零异常零 console error（噪声已滤）', realErrs.length === 0 && realConsole.length === 0, realErrs.slice(0, 3).join(' | ') + realConsole.slice(0, 3).join(' | '));
    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    FAIL++;
  }
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  server.close();
  console.log('\n' + (FAIL ? ('🎉 PASS ' + PASS + ' / 💔 FAIL ' + FAIL) : ('🎉 全部通过 ' + PASS + '/' + PASS)));
  process.exit(FAIL === 0 ? 0 : 1);
})();
