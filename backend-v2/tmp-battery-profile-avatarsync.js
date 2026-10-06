// tmp-battery-profile-avatarsync.js — v0.2.58.28 个人资料头像 ↔ FC 频道主页头像双向同步电池
// 用户「还有个人资料设置里的头像你没有做更换头像是和频道主页同步的当然用户可以勾选是否要同步」
//   边界「还有用户个人资料的自我介绍和频道主页的bio是不互通的」
// 钦定：①勾选框默认勾选（键缺失=ON）②双向同步·资料页权威（FC 侧点频道卡头像可换，同 PATCH 链）③bio 绝不互通（FC PATCH 只发 avatarUrl+avatarCrop）
// 58.25：上传链加裁切弹窗（confirmCrop 不交互 rect 恒 {0,0,1,1}）；PATCH 体 keys 均 +avatarCrop
// 验证：P0 静态锚（资料页 toggle/slati_avatar_sync 计数 + 两词典键计数 + site-config 58.20/48.0/00348-/00349- + FC 页锚 + bannerUrl 零）
//   / P 组（资料页 seed session+USR-000101 avatarUrl null）：P1 缺键默认勾选｜P2 取消勾选→保存→slati_user 零写入+旗标 '0'+PATCH 恰 1（无 mirrorProfile 二写）
//       P3 默认 ON 保存→raw 合并 slati_user.avatarUrl=上传路径+其余字段保留+PATCH 恰 1+旗标键仍缺席｜P4a/P4b 重载持久化（OFF/ON）
//   / F 组（FC 页 seed avatarUrl UPL-DEMO01 tier free）：F1 默认 ON 卡内 img+editable+title 更换头像+#personalAvatar 同源
//       F2 旗标 '0' 字母卡+点击零上传零 PATCH｜F3 点卡→上传→PATCH body 恰 {avatarUrl} 无 bio→卡重渲染新 src+slati_user 更新+PATCH 恰 1
//       F4 gif+free→toast 锁+零上传零 PATCH｜F5 gif+premium 放行｜F6 团队卡点击零动作｜F7 无 session→fc-guest 隐藏
//   / E 全程零异常零 console error
// （house CDP 模式；判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-avsync-' + Date.now());
const PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

// ── document-start 种子（每文档重跑）：URL 标记矩阵 → session/user/旗标/团队 ──
//   flag0=旗标 OFF；flag1=旗标 ON；prem=订阅；nov=头像 null；team=团队卡；guest=零种子（fc-guest）
const SEED = `try{(function(){
  var q = location.search || '';
  if (q.indexOf('guest') !== -1) { // 访客：清残留会话（前序测试的 session/user 会跨导航持久化）
    try { localStorage.removeItem('slati_session'); localStorage.removeItem('slati_user'); } catch (e) {}
    return;
  }
  localStorage.setItem('slati_session', '{"loggedIn":true}');
  localStorage.setItem('slati_user', JSON.stringify({
    id: 'USR-000101', displayName: '电池用户', citizenId: 'CIT-000101',
    bio: '电池用户简介', gender: 'Male',
    tier: q.indexOf('prem') !== -1 ? 'premium' : 'free',
    avatarUrl: q.indexOf('nov') !== -1 ? null : '/uploads/UPL-DEMO01.jpg'
  }));
  if (q.indexOf('flag0') !== -1) localStorage.setItem('slati_avatar_sync', '0');
  else if (q.indexOf('flag1') !== -1) localStorage.setItem('slati_avatar_sync', '1');
  else { try { localStorage.removeItem('slati_avatar_sync'); } catch (e) {} } // 缺键=ON（默认勾选）
  if (q.indexOf('team') !== -1) {
    localStorage.setItem('slati_teams', JSON.stringify([{ id: 'team-1', name: '测试团队', avatar: 'T', role: 'Owner', members: 3 }]));
    localStorage.setItem('slati_active_account', JSON.stringify('team-1')); // storage.js get() 走 JSON.parse——裸串 'team-1' 非合法 JSON 会抛异常回落 personal
  }
})();}catch(e){}`;

// ── document-start fetch 罐头：uploads 恒回 UPL-DEMO02（与种子 DEMO01 可区分）；PATCH /auth/me 只记不改 localStorage（页面自写）；GET 各端点从 localStorage 读（loadProfile/cloudMerge 一致性）──
const FETCH_STUB = `try{(function(){
  if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;
  var realFetch = window.fetch.bind(window);
  window.__fetchCalls = [];
  window.__patchedMe = null;
  window.__patchCount = 0;
  function readUser() { try { return JSON.parse(localStorage.getItem('slati_user') || 'null') || {}; } catch (e) { return {}; } }
  function res(status, body) {
    return { status: status, ok: status >= 200 && status < 300, headers: { get: function () { return null; } }, json: function () { return Promise.resolve(body); } };
  }
  window.fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf('/api/') !== -1) {
      var method = (opts && opts.method) || 'GET';
      var rawBody = (opts && opts.body != null) ? opts.body : null;
      window.__fetchCalls.push({ url: u, method: method, body: typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody == null ? null : rawBody) });
      if (method === 'POST' && u.indexOf('/api/social/uploads?ext=') === 0) return Promise.resolve(res(200, { url: '/uploads/UPL-DEMO02.jpg' }));
      if (method === 'PATCH' && u.indexOf('/api/auth/me') === 0) {
        window.__patchCount++;
        var pb = {}; try { pb = JSON.parse(rawBody || '{}'); } catch (e) {}
        window.__patchedMe = pb;
        var nu = {}; var base = readUser(); for (var k in base) nu[k] = base[k]; for (var k2 in pb) nu[k2] = pb[k2];
        return Promise.resolve(res(200, { user: nu }));
      }
      if (method === 'GET' && u.indexOf('/api/auth/me') === 0) return Promise.resolve(res(200, { user: readUser() }));
      if (method === 'GET' && u.indexOf('/api/health') === 0) return Promise.resolve(res(200, { status: 'ok', db: 'ok', tables: 60 }));
      if (method === 'GET' && u.indexOf('/api/social/users/USR-000101') === 0) {
        if (u.indexOf('/posts') !== -1) return Promise.resolve(res(200, { posts: [] }));
        var me = readUser();
        me.isSelf = true; me.followedByMe = false; me.followerCount = 2; me.followingCount = 3;
        me.stats = { postCount: 0, repostCount: 0, likeReceivedCount: 0, likeCount: 0, favoriteCount: 0 };
        return Promise.resolve(res(200, { user: me }));
      }
    }
    return realFetch(url, opts);
  };
})();}catch(e){}`;

// ── 静态壳（docs/ 原样；/api 未罐头全 404；两上传图位打真像素防破图） ──
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/uploads/UPL-DEMO01.jpg' || p === '/uploads/UPL-DEMO02.jpg') { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(PIXEL_PNG); return; }
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
    // ── P0 静态锚（计数=写锚前实测；58.20 实测口径） ──
    const siteSrc = await get('/assets/js/site-config.js');
    const profileSrc = await get('/pages/community-profile.html');
    const fcSrc = await get('/pages/fluidcanvas.html');
    const profI18n = await get('/assets/i18n/community-profile.i18n.js');
    const fcI18n = await get('/assets/i18n/fluidcanvas.i18n.js');
    ok('P0 site-config：版本赋值 58.25/48.1 各 1 + rev 00348-/00349- 各 2（58.25 双 changelog 条目：站点+FC 48.1 同轮）',
      cnt(siteSrc, "window.MN_SITE_VERSION = 'v0.2.58.28'") === 1 && cnt(siteSrc, "window.FLUIDCANVAS_VERSION = 'v10.28.57.0'") === 1 &&
      cnt(siteSrc, '00348-') === 2 && cnt(siteSrc, '00349-') === 2,
      '58.25=' + cnt(siteSrc, "window.MN_SITE_VERSION = 'v0.2.58.28'") + ' 48.1=' + cnt(siteSrc, "window.FLUIDCANVAS_VERSION = 'v10.28.57.0'") + ' r36=' + cnt(siteSrc, '00348-') + ' r37=' + cnt(siteSrc, '00349-'));
    ok('P0 资料页静态锚：toggle id ×4（模板+label for+F3+F4 选择器）+ slati_avatar_sync ×2（F1 读+F3 写）+ T 调用 ×2（label+aria-label）',
      cnt(profileSrc, 'editAvatarSyncToggle') === 4 && cnt(profileSrc, 'slati_avatar_sync') === 2 && cnt(profileSrc, "T('prof.edit.avatarSync')") === 2,
      'toggle=' + cnt(profileSrc, 'editAvatarSyncToggle') + ' key=' + cnt(profileSrc, 'slati_avatar_sync'));
    ok('P0 资料页 i18n：prof.edit.avatarSync 单引号 ×11 手工块 + 双引号 ×1（zh-Hant OpenCC 自动块）',
      cnt(profI18n, "'prof.edit.avatarSync'") === 11 && cnt(profI18n, '"prof.edit.avatarSync"') === 1,
      "single=" + cnt(profI18n, "'prof.edit.avatarSync'") + ' double=' + cnt(profI18n, '"prof.edit.avatarSync"'));
    ok('P0 FC 页静态锚：fc-avatar-editable ×5 + fcAvatarFile ×19 + fcEnsureApi ×6（51.0 团队向导新增+3）+ slati_avatar_sync ×1 + PATCH 体锚 avatarUrl: data.url ×1 + bannerUrl ×0（58.19 边界保留）+ bio ×4（48.1 注释——体仍绝不入包）',
      cnt(fcSrc, 'fc-avatar-editable') === 5 && cnt(fcSrc, 'fcAvatarFile') === 19 && cnt(fcSrc, 'fcEnsureApi') === 6 &&
      cnt(fcSrc, 'slati_avatar_sync') === 1 && cnt(fcSrc, 'avatarUrl: data.url') === 1 &&
      cnt(fcSrc, 'bannerUrl') === 0 && cnt(fcSrc, 'bio') === 4,
      'editable=' + cnt(fcSrc, 'fc-avatar-editable') + ' file=' + cnt(fcSrc, 'fcAvatarFile') + ' bannerUrl=' + cnt(fcSrc, 'bannerUrl') + ' bio=' + cnt(fcSrc, 'bio'));
    ok('P0 FC i18n：六新键双引号 ×12 各（11 手工块+zh-Hant 自动块；625 教训实测口径）',
      cnt(fcI18n, '"fc.landing.changeAvatar"') === 12 && cnt(fcI18n, '"fc.toast.avatarUpdated"') === 12 &&
      cnt(fcI18n, '"fc.toast.avatarFailed"') === 12 && cnt(fcI18n, '"fc.toast.gifLocked"') === 12 &&
      cnt(fcI18n, '"fc.toast.imgOnly"') === 12 && cnt(fcI18n, '"fc.toast.imgTooBig10"') === 12,
      'changeAvatar=' + cnt(fcI18n, '"fc.landing.changeAvatar"') + ' gifLocked=' + cnt(fcI18n, '"fc.toast.gifLocked"'));

    const cdp = await connectCdp(CDP_PORT);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SEED });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };
    const setFile = async (selector, tmpFile) => {
      await cdp.send('DOM.enable');
      const docNode = await cdp.send('DOM.getDocument', { depth: -1 });
      const fileNode = await cdp.send('DOM.querySelector', { nodeId: docNode.root.nodeId, selector: selector });
      await cdp.send('DOM.setFileInputFiles', { nodeId: fileNode.nodeId, files: [tmpFile] });
    };
    // 58.25 裁切弹窗：上传链先弹 .mn-crop-stage → confirm 不交互 rect 恒 {0,0,1,1}（tmp-battery-crop 27/27 实证）
    const confirmCrop = async (label) => {
      await waitFor(cdp, "!!document.querySelector('.mn-crop-stage')", 25000, label);
      await cdp.evalJs("document.querySelector('.mn-crop-confirm').click()");
      await sleep(500);
    };
    const readLs = (k) => cdp.evalJs("(function(){ try { return localStorage.getItem(" + JSON.stringify(k) + "); } catch (e) { return null; } })()");
    const readUserLs = () => cdp.evalJs("(function(){ try { return JSON.parse(localStorage.getItem('slati_user') || 'null') || null; } catch (e) { return null; } })()");
    const counts = () => cdp.evalJs("(function(){ var up = window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/social/uploads') !== -1; }).length; return { up: up, patch: window.__patchCount || 0, patched: window.__patchedMe }; })()");
    // 头像/横幅上传临时文件（客户端只查扩展名+大小，罐头端点不看魔数）
    const tmpAv = path.join(__dirname, 'tmp-av-626.jpg');
    const tmpGif = path.join(__dirname, 'tmp-av-626.gif');
    fs.writeFileSync(tmpAv, PIXEL_PNG);
    fs.writeFileSync(tmpGif, PIXEL_PNG);

    // ── P 组：资料页（seed &nov：avatarUrl null、tier free、缺键=ON）──
    await nav(BASE + '/pages/community-profile.html?id=USR-000101&nov', "!!document.getElementById('profileEditBtn')", 'P 资料页加载');
    const openModal = async () => {
      await cdp.evalJs("document.getElementById('profileEditBtn').click()");
      // 资料页 toast 走 MN_Report（无 #toast 元素）→ 每文档重挂记录器（profile-banner 233 同款）
      await cdp.evalJs("window.__toasts = []; if (window.MN_Report && window.MN_Report.toast) { var o = MN_Report.toast.bind(MN_Report); MN_Report.toast = function (m, e) { window.__toasts.push(String(m)); return o(m, e); }; }");
      await sleep(500);
    };
    await openModal();
    let s = await cdp.evalJs("(function(){ var t = document.getElementById('editAvatarSyncToggle'); return { active: t && t.classList.contains('active'), checked: t && t.getAttribute('aria-checked'), flag: localStorage.getItem('slati_avatar_sync') }; })()");
    ok('P1 缺键默认勾选：toggle active + aria-checked true + 旗标键缺席', s.active === true && s.checked === 'true' && s.flag === null, JSON.stringify(s));

    // P2：取消勾选 → 上传 → 保存 → slati_user 零写入 + 旗标 '0' + PATCH 恰 1
    await cdp.evalJs("document.getElementById('editAvatarSyncToggle').click()");
    await sleep(200);
    s = await cdp.evalJs("(function(){ var t = document.getElementById('editAvatarSyncToggle'); return { active: t.classList.contains('active'), checked: t.getAttribute('aria-checked'), flag: localStorage.getItem('slati_avatar_sync') }; })()");
    ok('P2 取消勾选：即时落 localStorage 旗标 "0"（权威设置，不经保存事务）+ 类/aria 同步', s.active === false && s.checked === 'false' && s.flag === '0', JSON.stringify(s));
    await setFile('#editAvatarFile', tmpAv);
    await confirmCrop('P2 裁切弹窗');
    await sleep(400);
    s = await cdp.evalJs("(function(){ var img = document.getElementById('editAvatarPreview'); return { src: img.getAttribute('src'), st: document.getElementById('editSaveState').textContent }; })()");
    ok('P2 上传预览：裁切弹窗 confirm → 直传罐头 → 预览 /uploads/UPL-DEMO02.jpg（与种子 DEMO01 可区分）', s.src === '/uploads/UPL-DEMO02.jpg' && s.st.indexOf('就绪') !== -1, JSON.stringify(s));
    await cdp.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    s = await counts();
    const p2u = await readUserLs();
    const p2flag = await readLs('slati_avatar_sync');
    ok('P2 保存（旗标 OFF）：PATCH 恰 1 次（无 mirrorProfile 二写）+ body 恰 {avatarUrl,avatarCrop}（58.25 裁切）+ slati_user 零写入（avatarUrl 仍 null）+ 旗标仍 "0"',
      s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'avatarUrl,avatarCrop' && s.patched.avatarUrl === '/uploads/UPL-DEMO02.jpg' &&
      JSON.stringify(s.patched.avatarCrop) === '{"x":0,"y":0,"w":1,"h":1}' &&
      p2u && p2u.avatarUrl === null && p2flag === '0',
      JSON.stringify({ patch: s.patch, keys: s.patched && Object.keys(s.patched).join(','), lsAvatar: p2u && p2u.avatarUrl, flag: p2flag }));

    // P3：默认 ON 保存 → raw 合并写
    await nav(BASE + '/pages/community-profile.html?id=USR-000101&nov', "!!document.getElementById('profileEditBtn')", 'P3 资料页重载（缺键默认 ON）');
    await openModal();
    await setFile('#editAvatarFile', tmpAv);
    await confirmCrop('P3 裁切弹窗');
    await sleep(400);
    await cdp.evalJs("document.getElementById('editSaveBtn').click()");
    await sleep(800);
    s = await counts();
    const p3u = await readUserLs();
    const p3flag = await readLs('slati_avatar_sync');
    const p3toast = await cdp.evalJs("window.__toasts.join('|')");
    ok('P3 保存（默认 ON）：raw 合并写 slati_user.avatarUrl=上传路径 + 其余字段保留 + PATCH 恰 1 + 旗标键仍缺席（保存不写旗标）',
      s.patch === 1 && p3u && p3u.avatarUrl === '/uploads/UPL-DEMO02.jpg' && p3u.displayName === '电池用户' && p3u.id === 'USR-000101' && p3u.bio === '电池用户简介' && p3flag === null,
      JSON.stringify({ patch: s.patch, ls: p3u, flag: p3flag }));
    ok('P3 保存 toast 资料已保存', p3toast.indexOf('资料已保存') !== -1, p3toast);

    // P4a/P4b：旗标重载持久化
    await openModal();
    await cdp.evalJs("document.getElementById('editAvatarSyncToggle').click()"); // ON→OFF（'0'）
    await sleep(200);
    await nav(BASE + '/pages/community-profile.html?id=USR-000101&nov&flag0', "!!document.getElementById('profileEditBtn')", 'P4a 重载');
    await openModal();
    s = await cdp.evalJs("(function(){ var t = document.getElementById('editAvatarSyncToggle'); return { active: t.classList.contains('active'), checked: t.getAttribute('aria-checked') }; })()");
    ok('P4a 旗标 "0" 重载持久化：弹窗 toggle 不勾选 + aria false', s.active === false && s.checked === 'false', JSON.stringify(s));
    await cdp.evalJs("document.getElementById('editAvatarSyncToggle').click()"); // OFF→ON（'1'）
    await sleep(200);
    await nav(BASE + '/pages/community-profile.html?id=USR-000101&nov&flag1', "!!document.getElementById('profileEditBtn')", 'P4b 重载');
    await openModal();
    s = await cdp.evalJs("(function(){ var t = document.getElementById('editAvatarSyncToggle'); return { active: t.classList.contains('active'), checked: t.getAttribute('aria-checked'), flag: localStorage.getItem('slati_avatar_sync') }; })()");
    ok('P4b 旗标 "1" 重载持久化：弹窗 toggle 勾选 + aria true + 键 "1"', s.active === true && s.checked === 'true' && s.flag === '1', JSON.stringify(s));

    // ── F 组：FC 页 ──
    await nav(BASE + '/pages/fluidcanvas.html',
      "!!document.querySelector('#channelOverview .channel-avatar') && document.querySelector('#channelOverview .channel-avatar').title === '更换头像'",
      'F1 FC 页加载（i18n apply 后 onChange 重渲染=中文 title）');
    s = await cdp.evalJs("(function(){ var av = document.querySelector('#channelOverview .channel-avatar'); var img = av ? av.querySelector('img.fc-ch-avatar-img') : null; var pa = document.getElementById('personalAvatar'); return { editable: av && av.classList.contains('fc-avatar-editable'), imgSrc: img ? img.getAttribute('src') : null, title: av ? av.title : null, paSrc: pa.getAttribute('src') }; })()");
    ok('F1 默认 ON：卡内 img + fc-avatar-editable + title 更换头像 + #personalAvatar 同源 DEMO01',
      s.editable === true && s.imgSrc === '/uploads/UPL-DEMO01.jpg' && s.title === '更换头像' && s.paSrc === '/uploads/UPL-DEMO01.jpg', JSON.stringify(s));

    // F2：旗标 '0' → 字母卡 + 点击零动作
    await nav(BASE + '/pages/fluidcanvas.html?flag0', "!!document.querySelector('#channelOverview .channel-avatar')", 'F2 FC 页加载');
    s = await cdp.evalJs("(function(){ var av = document.querySelector('#channelOverview .channel-avatar'); return { text: av.textContent.trim(), img: !!av.querySelector('img.fc-ch-avatar-img'), editable: av.classList.contains('fc-avatar-editable') }; })()");
    ok('F2 旗标 "0"：字母卡（首字 电）+ 零 img + 零 editable', s.text === '电' && s.img === false && s.editable === false, JSON.stringify(s));
    await cdp.evalJs("document.querySelector('#channelOverview .channel-avatar').click()");
    await sleep(400);
    const f2c = await counts();
    ok('F2 字母卡点击零动作：零上传零 PATCH', f2c.up === 0 && f2c.patch === 0, JSON.stringify({ up: f2c.up, patch: f2c.patch }));

    // F3：点卡 → 上传 → PATCH 体纯度 → 卡重渲染新 src + slati_user 更新
    await nav(BASE + '/pages/fluidcanvas.html', "!!document.querySelector('#channelOverview .channel-avatar')", 'F3 FC 页加载');
    await cdp.evalJs("document.querySelector('#channelOverview .channel-avatar').click()");
    await sleep(200);
    await setFile('#fcAvatarFile', tmpAv);
    await confirmCrop('F3 裁切弹窗');
    await sleep(400);
    s = await counts();
    const f3u = await readUserLs();
    const f3dom = await cdp.evalJs("(function(){ var av = document.querySelector('#channelOverview .channel-avatar'); var img = av ? av.querySelector('img.fc-ch-avatar-img') : null; return { imgSrc: img ? img.getAttribute('src') : null, paSrc: document.getElementById('personalAvatar').getAttribute('src'), toast: document.getElementById('toast').textContent }; })()");
    ok('F3 点卡换头像：上传恰 1 + PATCH 恰 1 + body 恰 {avatarUrl,avatarCrop} 无 bio（边界铁证：48.1 追加 avatarCrop 仍绝不入 bio）',
      s.up === 1 && s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'avatarUrl,avatarCrop' && s.patched.avatarUrl === '/uploads/UPL-DEMO02.jpg' &&
      JSON.stringify(s.patched.avatarCrop) === '{"x":0,"y":0,"w":1,"h":1}',
      JSON.stringify({ up: s.up, patch: s.patch, keys: s.patched && Object.keys(s.patched).join(',') }));
    ok('F3 成功态：卡重渲染新 src DEMO02 + #personalAvatar 同源 + slati_user raw 合并（其余字段保留）+ toast 头像已更新',
      f3dom.imgSrc === '/uploads/UPL-DEMO02.jpg' && f3dom.paSrc === '/uploads/UPL-DEMO02.jpg' &&
      f3u && f3u.avatarUrl === '/uploads/UPL-DEMO02.jpg' && f3u.displayName === '电池用户' && f3u.id === 'USR-000101' &&
      f3dom.toast.indexOf('头像已更新') !== -1,
      JSON.stringify({ img: f3dom.imgSrc, pa: f3dom.paSrc, ls: f3u && f3u.avatarUrl, toast: f3dom.toast }));

    // F4：gif + free → 锁 toast + 零上传零 PATCH（门禁在弹窗前——零弹窗）
    await nav(BASE + '/pages/fluidcanvas.html', "!!document.querySelector('#channelOverview .channel-avatar')", 'F4 FC 页加载');
    await setFile('#fcAvatarFile', tmpGif);
    await sleep(400);
    s = await counts();
    const f4toast = await cdp.evalJs("document.getElementById('toast').textContent");
    const f4dlg = await cdp.evalJs("!!document.querySelector('.mn-crop-stage')");
    ok('F4 gif+free：toast 锁文案 + 零上传零 PATCH + 弹窗未开（门禁先于裁切弹窗）', f4toast.indexOf('GIF 动图为订阅用户专属功能') !== -1 && s.up === 0 && s.patch === 0 && f4dlg === false, JSON.stringify({ toast: f4toast, up: s.up, patch: s.patch, dlg: f4dlg }));

    // F5：gif + premium 放行（走裁切弹窗）
    await nav(BASE + '/pages/fluidcanvas.html?prem', "!!document.querySelector('#channelOverview .channel-avatar')", 'F5 FC 页加载');
    await setFile('#fcAvatarFile', tmpGif);
    await confirmCrop('F5 裁切弹窗');
    await sleep(400);
    s = await counts();
    const f5dom = await cdp.evalJs("(function(){ var av = document.querySelector('#channelOverview .channel-avatar'); var img = av ? av.querySelector('img.fc-ch-avatar-img') : null; return { imgSrc: img ? img.getAttribute('src') : null, toast: document.getElementById('toast').textContent }; })()");
    ok('F5 gif+premium：放行（上传 1 + PATCH 1 + 卡换 DEMO02 + toast 头像已更新）',
      s.up === 1 && s.patch === 1 && f5dom.imgSrc === '/uploads/UPL-DEMO02.jpg' && f5dom.toast.indexOf('头像已更新') !== -1,
      JSON.stringify({ up: s.up, patch: s.patch, img: f5dom.imgSrc }));

    // F6：团队卡零动作
    await nav(BASE + '/pages/fluidcanvas.html?team', "!!document.querySelector('#channelOverview .channel-avatar')", 'F6 FC 页加载');
    s = await cdp.evalJs("(function(){ var av = document.querySelector('#channelOverview .channel-avatar'); return { text: av.textContent.trim(), img: !!av.querySelector('img'), editable: av.classList.contains('fc-avatar-editable') }; })()");
    ok('F6 团队卡：文本头像 T + 零 img + 零 editable', s.text === 'T' && s.img === false && s.editable === false, JSON.stringify(s));
    await cdp.evalJs("document.querySelector('#channelOverview .channel-avatar').click()");
    await sleep(400);
    const f6c = await counts();
    ok('F6 团队卡点击零动作：零上传零 PATCH', f6c.up === 0 && f6c.patch === 0, JSON.stringify({ up: f6c.up, patch: f6c.patch }));

    // F7：无 session → fc-guest
    await nav(BASE + '/pages/fluidcanvas.html?guest', "!!document.querySelector('.fc-locked-hero')", 'F7 FC 页访客加载');
    s = await cdp.evalJs("(function(){ var sm = document.querySelector('.studio-main'); return { guest: document.documentElement.classList.contains('fc-guest'), smDisplay: sm ? getComputedStyle(sm).display : null, heroDisplay: getComputedStyle(document.querySelector('.fc-locked-hero')).display }; })()");
    ok('F7 访客：html.fc-guest + 工作台隐藏 + 登录引导卡显示', s.guest === true && s.smDisplay === 'none' && s.heroDisplay === 'flex', JSON.stringify(s));

    // ── E 全程零 Runtime exception + 零 console error ──
    ok('E1 全程零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 5).join(' | ') || '干净');
    ok('E2 全程零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 5).join(' | ') || '干净');
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
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(FAIL === 0 ? 0 : 1);
})();
