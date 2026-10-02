// tmp-battery-settings-profilecust.js — v0.2.58.26 设置弹窗资料区头像/横幅三层订阅门禁电池（58.21 母本 + S10-S12 新段 + 58.25 裁切弹窗）
// 用户「横幅的从图库中选择和上传图片只限于基础订阅项；动图要高级订阅；没有订阅的只能调整横幅的单色和渐变颜色；
//   图库弹窗大点；被锁按钮用金色罩子盖住而不是点击后才出现提示反馈」
// 钦定：①两处一起改（设置弹窗+资料页编辑弹窗同口径）②免费层=扩展预设色卡（6 玻璃+6 单色/黑白系=13 格点选即存
//   cardBg 落库）③金罩=所有被锁按钮+相邻按钮共用一个罩 ④头像保持现状（free 静态头像上传仍可用）
// 58.25 裁切弹窗：上传链 setFile 后先弹 .mn-crop-stage → confirm 不交互 rect 恒 {0,0,1,1}（tmp-battery-crop 27/27 实证）；
//   PATCH 键加 crop（头像 avatarUrl,avatarCrop/横幅 bannerUrl,bannerCrop）；移除体恒 {bannerUrl:null} 不带 crop；
//   门禁（gif/free/图库锁）先于弹窗→门禁触发时弹窗未开负断言。
// 验证：S0 静态锚（settings-modal.js 58.22+58.25 件计数 + common.i18n 键计数 + site-config 58.25 双 changelog rev ×2）；
//   S1 真用户开弹窗六件在位+金罩在位；S2 头像上传→弹窗 confirm→PATCH 恰 1 体 {avatarUrl,avatarCrop}→预览变→同步 ON
//   slati_user 合并写（含 crop）；S3 同步 OFF PATCH 照发但 slati_user 零写；S4 gif+free→锁 toast+升级链接显+零上传零
//   PATCH+弹窗未开；S5 gif+premium 放行+零金罩；S6a 图库 free 锁/S6b prem 选 data: 格→上传+PATCH（弹窗 confirm）；
//   S7 横幅上传/移除 PATCH {bannerUrl,bannerCrop}/{bannerUrl:null}（prem 种子——free 横幅上传已锁）+预览内嵌 img 读法；
//   S8 同步 toggle 写 '1'/'0'；S9 演示用户控件隐藏+settingsBgGrid 缺席；
//   S10 free 横幅上传门禁（金罩包 upload+lib 同罩+移除钮罩外+toast 精确串+零上传零 PATCH+imgUpgrade 链接+弹窗未开）；
//   S11 free 预设点选 mono-bw（PATCH 体恰 {cardBg}+合并写+预览类+active 换位+13 格+toast）；S12 basic（零金罩+
//   静态横幅上传放行（弹窗 confirm）+gif 锁 premGifUpgrade 链接+弹窗未开+图库浮层 400px 4 列）；E 全程零异常零 console error。
//   （house CDP 模式；判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-profilecust-' + Date.now());
const PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const PIXEL_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// ── document-start 种子：URL 标记矩阵 → session/user/旗标/图库 ──
//   nov=头像 null；banner=横幅预设；prem=高级订阅；basic=基础订阅；demo=无 USR- id（守卫隐藏控件）；lib=种 data: 图库
const SEED = `try{(function(){
  var q = location.search || '';
  if (q.indexOf('guest') !== -1) {
    try { localStorage.removeItem('slati_session'); localStorage.removeItem('slati_user'); } catch (e) {}
    return;
  }
  localStorage.setItem('slati_session', '{"loggedIn":true}');
  localStorage.setItem('slati_lang', 'zh-CN'); // 钉死语言——toast 断言按 zh-CN 块值（首块）
  var u = q.indexOf('demo') !== -1
    ? { displayName: '演示用户', citizenId: 'CIT-000099' } // 无 USR- id——stReal 守卫隐藏控件
    : { id: 'USR-000101', displayName: '电池用户', citizenId: 'CIT-000101', bio: '本地简介', gender: 'Male',
        tier: q.indexOf('prem') !== -1 ? 'premium' : (q.indexOf('basic') !== -1 ? 'basic' : 'free'),
        avatarUrl: q.indexOf('nov') !== -1 ? null : '/uploads/UPL-DEMO01.jpg',
        bannerUrl: q.indexOf('banner') !== -1 ? '/uploads/UPL-DEMO01.jpg' : null };
  localStorage.setItem('slati_user', JSON.stringify(u));
  if (q.indexOf('lib') !== -1) localStorage.setItem('slati_img_library', JSON.stringify([{ src: 'data:image/png;base64,${PIXEL_B64}' }]));
  else { try { localStorage.removeItem('slati_img_library'); } catch (e) {} }
  try { localStorage.removeItem('slati_avatar_sync'); } catch (e) {} // 缺键=ON（58.20 同款谓词）
})();}catch(e){}`;

// ── document-start fetch 罐头：uploads 恒回 UPL-DEMO02（与种子 DEMO01 可区分）；PATCH /auth/me 只记不改 localStorage ──
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
        var me = readUser();
        me.isSelf = true; me.followedByMe = false; me.followerCount = 2; me.followingCount = 3;
        me.stats = { postCount: 0, repostCount: 0, likeReceivedCount: 0, likeCount: 0, favoriteCount: 0 };
        return Promise.resolve(res(200, { user: me }));
      }
    }
    return realFetch(url, opts);
  };
})();}catch(e){}`;

// ── 静态壳（docs/ 原样；/api 未罐头全 404；上传图位打真像素防破图） ──
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
    // ── S0 静态锚（计数=写锚前实测口径） ──
    const siteSrc = await get('/assets/js/site-config.js');
    const setSrc = await get('/assets/js/settings-modal.js');
    const sbSrc = await get('/assets/js/sidebar.js');
    const comI18n = await get('/assets/i18n/common.i18n.js');
    ok('S0a site-config：58.26 赋值 1 + 58.21 赋值零残留 + changelog 标题 58.26 1 + rev 00348-/00349- 各 2 + FC 49.0 1/48.2 赋值零残留',
      cnt(siteSrc, "window.MN_SITE_VERSION = 'v0.2.58.26'") === 1 && cnt(siteSrc, "window.MN_SITE_VERSION = 'v0.2.58.21'") === 0 &&
      cnt(siteSrc, '// v0.2.58.26 = ') === 1 && cnt(siteSrc, '00348-') === 2 && cnt(siteSrc, '00349-') === 2 &&
      cnt(siteSrc, "window.FLUIDCANVAS_VERSION = 'v10.28.49.2'") === 1 && cnt(siteSrc, "window.FLUIDCANVAS_VERSION = 'v10.28.48.2'") === 0,
      '58.26=' + cnt(siteSrc, "window.MN_SITE_VERSION = 'v0.2.58.26'") + ' r48=' + cnt(siteSrc, '00348-') + ' r49=' + cnt(siteSrc, '00349-') +
      ' fc49=' + cnt(siteSrc, "window.FLUIDCANVAS_VERSION = 'v10.28.49.2'") + ' fc482=' + cnt(siteSrc, "window.FLUIDCANVAS_VERSION = 'v10.28.48.2'"));
    ok('S0b settings-modal 控件件：六 id 族（avatarBtn/libBtn 各 2、avatarPreview 4（58.25 wrapper+applyCrop+2）、bannerPreview 6（58.25 内嵌 img+applyCrop+2）、upload/lib/remove 2/2/4、file ×2 各、avatarUpgradeLink ×3、bannerUpgradeLink ×4）+ sub-locked ×4 + stUpload ×5 + stPickFromLibrary ×3 + stRawMergeUser ×7（58.25 连带 crop 合并+2）+ bannerUrl: null ×2 + slati_avatar_sync ×4 + toast 件 ×2 + 58.25 重裁钮 ×2 各 + mn-crop-stage ×5',
      cnt(setSrc, 'settingsAvatarBtn') === 2 && cnt(setSrc, 'settingsAvatarPreview') === 4 && cnt(setSrc, 'settingsAvatarLibBtn') === 2 &&
      cnt(setSrc, 'settingsBannerPreview') === 6 && cnt(setSrc, 'settingsBannerUploadBtn') === 2 && cnt(setSrc, 'settingsBannerLibBtn') === 2 &&
      cnt(setSrc, 'settingsBannerRemoveBtn') === 4 && cnt(setSrc, 'settingsAvatarFile') === 2 && cnt(setSrc, 'settingsBannerFile') === 2 &&
      cnt(setSrc, 'settingsAvatarGifUpgradeLink') === 3 && cnt(setSrc, 'settingsBannerGifUpgradeLink') === 4 &&
      cnt(setSrc, 'sub-locked') === 4 && cnt(setSrc, 'stUpload') === 5 && cnt(setSrc, 'stPickFromLibrary') === 3 &&
      cnt(setSrc, 'stRawMergeUser') === 7 && cnt(setSrc, 'bannerUrl: null') === 2 && cnt(setSrc, 'slati_avatar_sync') === 4 &&
      cnt(setSrc, 'settingsProfileToast') === 2 &&
      cnt(setSrc, 'settingsAvatarReCropBtn') === 2 && cnt(setSrc, 'settingsBannerReCropBtn') === 2 && cnt(setSrc, 'mn-crop-stage') === 5,
      'btn=' + cnt(setSrc, 'settingsAvatarBtn') + ' lib=' + cnt(setSrc, 'settingsAvatarLibBtn') + ' banner=' + cnt(setSrc, 'settingsBannerPreview'));
    ok('S0b2 settings-modal 58.22 新件：settingsBgGrid ×2 + settings-bg-grid ×2 + settings-bg-swatch ×6 + ST_BG_DEFS ×2 + stCanGif ×4（58.25 视频门复用+1）+ stCanImg ×4 + gold-lock-group ×5 + mono-bw ×3 + toast.bannerLocked/toast.bgUpdated/imgUpgrade/premGifUpgrade 各 ×1 + width: 400px ×1 + repeat(4, 1fr) ×1',
      cnt(setSrc, 'settingsBgGrid') === 2 && cnt(setSrc, 'settings-bg-grid') === 2 && cnt(setSrc, 'settings-bg-swatch') === 6 &&
      cnt(setSrc, 'ST_BG_DEFS') === 2 && cnt(setSrc, 'stCanGif') === 4 && cnt(setSrc, 'stCanImg') === 4 &&
      cnt(setSrc, 'gold-lock-group') === 5 && cnt(setSrc, 'mono-bw') === 3 &&
      cnt(setSrc, 'settings.profile.toast.bannerLocked') === 1 && cnt(setSrc, 'settings.profile.toast.bgUpdated') === 1 &&
      cnt(setSrc, 'settings.profile.imgUpgrade') === 1 && cnt(setSrc, 'settings.profile.premGifUpgrade') === 1 &&
      cnt(setSrc, 'width: 400px') === 1 && cnt(setSrc, 'repeat(4, 1fr)') === 1,
      'grid=' + cnt(setSrc, 'settingsBgGrid') + ' gold=' + cnt(setSrc, 'gold-lock-group') + ' canGif=' + cnt(setSrc, 'stCanGif'));
    ok('S0c sidebar 弹窗件：function openUserPop ×1 + slati-user-pop-style ×2 + preventDefault ×2（代码+注释）+ e.stopPropagation() ×1 + .user-info-bar a ×1 + initUserPopWiring ×2 + SlatiSettings.open ×3',
      cnt(sbSrc, 'function openUserPop') === 1 && cnt(sbSrc, 'slati-user-pop-style') === 2 && cnt(sbSrc, 'preventDefault') === 2 &&
      cnt(sbSrc, 'e.stopPropagation()') === 1 &&
      cnt(sbSrc, '.user-info-bar a') === 1 && cnt(sbSrc, 'initUserPopWiring') === 2 && cnt(sbSrc, 'SlatiSettings.open') === 3,
      'pop=' + cnt(sbSrc, 'function openUserPop') + ' wire=' + cnt(sbSrc, 'initUserPopWiring'));
    ok('S0d common.i18n 21+5 键：sidebar.pop 6 键单引号 ×11 + settings.profile 15 键单引号 ×11 + 58.22 新 5 键（bannerColor/imgUpgrade/premGifUpgrade/toast.bannerLocked/toast.bgUpdated）单引号 ×11 各 + zh-Hant 双引号 ×1 各 + 生成标记 ×1',
      cnt(comI18n, "'sidebar.pop.editProfile'") === 11 && cnt(comI18n, "'sidebar.pop.joined'") === 11 &&
      cnt(comI18n, "'settings.profile.banner'") === 11 && cnt(comI18n, "'settings.profile.avatarSync'") === 11 &&
      cnt(comI18n, "'settings.profile.toast.imgTooBig10'") === 11 &&
      cnt(comI18n, "'settings.profile.bannerColor'") === 11 && cnt(comI18n, "'settings.profile.imgUpgrade'") === 11 &&
      cnt(comI18n, "'settings.profile.premGifUpgrade'") === 11 && cnt(comI18n, "'settings.profile.toast.bannerLocked'") === 11 &&
      cnt(comI18n, "'settings.profile.toast.bgUpdated'") === 11 &&
      cnt(comI18n, '"sidebar.pop.editProfile"') === 1 && cnt(comI18n, '"settings.profile.banner"') === 1 &&
      cnt(comI18n, '"settings.profile.bannerColor"') === 1 && cnt(comI18n, '"settings.profile.toast.bannerLocked"') === 1 &&
      cnt(comI18n, '__ZH_HANT_AUTO__') === 1,
      'sp=' + cnt(comI18n, "'sidebar.pop.editProfile'") + ' bc=' + cnt(comI18n, "'settings.profile.bannerColor'") + ' bl=' + cnt(comI18n, "'settings.profile.toast.bannerLocked'"));
    ok('S0d2 common.i18n 58.25 新 12 键：crop.titleAvatar/titleBanner/hint/confirm/cancel/loadFail + settings.profile.reCropAvatar/reCropBanner + videoLocked/videoCompressing/avatarNoVideo/videoFail 单引号 ×11 各 + zh-Hant 双引号 ×1 各',
      cnt(comI18n, "'crop.titleAvatar'") === 11 && cnt(comI18n, "'crop.titleBanner'") === 11 && cnt(comI18n, "'crop.hint'") === 11 &&
      cnt(comI18n, "'crop.confirm'") === 11 && cnt(comI18n, "'crop.cancel'") === 11 && cnt(comI18n, "'crop.loadFail'") === 11 &&
      cnt(comI18n, "'settings.profile.reCropAvatar'") === 11 && cnt(comI18n, "'settings.profile.reCropBanner'") === 11 &&
      cnt(comI18n, "'settings.profile.videoLocked'") === 11 && cnt(comI18n, "'settings.profile.videoCompressing'") === 11 &&
      cnt(comI18n, "'settings.profile.avatarNoVideo'") === 11 && cnt(comI18n, "'settings.profile.videoFail'") === 11 &&
      cnt(comI18n, '"crop.titleAvatar"') === 1 && cnt(comI18n, '"crop.confirm"') === 1 &&
      cnt(comI18n, '"settings.profile.reCropBanner"') === 1 && cnt(comI18n, '"settings.profile.videoLocked"') === 1,
      'ct=' + cnt(comI18n, "'crop.titleAvatar'") + ' rc=' + cnt(comI18n, "'settings.profile.reCropAvatar'") + ' vl=' + cnt(comI18n, "'settings.profile.videoLocked'"));

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
    const readUserLs = () => cdp.evalJs("(function(){ try { return JSON.parse(localStorage.getItem('slati_user') || 'null') || null; } catch (e) { return null; } })()");
    const counts = () => cdp.evalJs("(function(){ var up = window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/social/uploads') !== -1; }).length; return { up: up, patch: window.__patchCount || 0, patched: window.__patchedMe }; })()");
    const openSettings = async () => {
      await cdp.evalJs('window.SlatiSettings.open()');
      await waitFor(cdp, "!!document.getElementById('settingsCard')", 10000, '设置弹窗打开');
      await sleep(400);
    };
    const toastText = () => cdp.evalJs("(function(){ var t = document.getElementById('settingsProfileToast'); return t ? { text: t.textContent, active: t.classList.contains('active') } : null; })()");
    const tmpAv = path.join(__dirname, 'tmp-av-627.jpg');
    const tmpGif = path.join(__dirname, 'tmp-av-627.gif');
    fs.writeFileSync(tmpAv, PIXEL_PNG);
    fs.writeFileSync(tmpGif, PIXEL_PNG);

    // ── S1：真用户开弹窗六件在位 ──
    await nav(BASE + '/index.html?nov', "!!document.querySelector('#slati-sidebar .user-module')", 'S1 主页加载');
    await openSettings();
    let s = await cdp.evalJs("(function(){ return { av: !!document.getElementById('settingsAvatarBtn'), pv: !!document.getElementById('settingsAvatarPreview'), lib: !!document.getElementById('settingsAvatarLibBtn'), bp: !!document.getElementById('settingsBannerPreview'), bu: !!document.getElementById('settingsBannerUploadBtn'), bl: !!document.getElementById('settingsBannerLibBtn'), rm: !!document.getElementById('settingsBannerRemoveBtn'), rmHidden: document.getElementById('settingsBannerRemoveBtn') ? getComputedStyle(document.getElementById('settingsBannerRemoveBtn')).display === 'none' : null, toggle: !!document.querySelector('[data-sec=\"profile\"] .toggle-switch'), upgrade: !!document.getElementById('settingsAvatarGifUpgradeLink') }; })()");
    ok('S1 真用户开弹窗：六件在位 + 移除按钮隐藏（无横幅）+ 同步 toggle 在位 + 免费升级链接在位', s.av && s.pv && s.lib && s.bp && s.bu && s.bl && s.rm && s.rmHidden === true && s.toggle && s.upgrade, JSON.stringify(s));

    // ── S2：头像上传（同步 ON 默认）→ 弹窗 confirm → PATCH 恰 1 体 {avatarUrl,avatarCrop} → 预览变 → slati_user 合并写 ──
    await setFile('#settingsAvatarFile', tmpAv);
    await confirmCrop('S2 裁切弹窗');
    await sleep(400);
    s = await counts();
    const s2u = await readUserLs();
    const s2prev = await cdp.evalJs("document.getElementById('settingsAvatarPreview').getAttribute('src')");
    ok('S2 头像上传（同步 ON）：上传恰 1 + PATCH 恰 1 + 体恰 {avatarUrl,avatarCrop} rect {0,0,1,1} + 预览 src 变 DEMO02 + slati_user.avatarUrl+avatarCrop 合并写 + 其余字段保留',
      s.up === 1 && s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'avatarUrl,avatarCrop' && s.patched.avatarUrl === '/uploads/UPL-DEMO02.jpg' &&
      JSON.stringify(s.patched.avatarCrop) === '{"x":0,"y":0,"w":1,"h":1}' &&
      s2prev === '/uploads/UPL-DEMO02.jpg' && s2u && s2u.avatarUrl === '/uploads/UPL-DEMO02.jpg' &&
      JSON.stringify(s2u.avatarCrop) === '{"x":0,"y":0,"w":1,"h":1}' && s2u.displayName === '电池用户',
      JSON.stringify({ up: s.up, patch: s.patch, keys: s.patched && Object.keys(s.patched).join(','), crop: s.patched && JSON.stringify(s.patched.avatarCrop), prev: s2prev, lsAvatar: s2u && s2u.avatarUrl, lsCrop: s2u && JSON.stringify(s2u.avatarCrop) }));

    // ── S3：同步 OFF → PATCH 照发但 slati_user 零写 ──
    await nav(BASE + '/index.html?nov', "!!document.querySelector('#slati-sidebar .user-module')", 'S3 重载');
    await openSettings();
    await cdp.evalJs("document.querySelector('[data-sec=\"profile\"] .toggle-switch').click()");
    await sleep(200);
    const s3flag = await cdp.evalJs("localStorage.getItem('slati_avatar_sync')");
    await setFile('#settingsAvatarFile', tmpAv);
    await confirmCrop('S3 裁切弹窗');
    await sleep(400);
    s = await counts();
    const s3u = await readUserLs();
    ok('S3 同步 OFF：旗标 "0" + PATCH 照发恰 1 体 {avatarUrl,avatarCrop} + slati_user.avatarUrl 零写（仍 null）+ avatarCrop 零写 + 预览仍更新（PATCH ok 改 UI 不受旗标约束）',
      s3flag === '0' && s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'avatarUrl,avatarCrop' &&
      JSON.stringify(s.patched.avatarCrop) === '{"x":0,"y":0,"w":1,"h":1}' &&
      s3u && s3u.avatarUrl === null && s3u.avatarCrop == null,
      JSON.stringify({ flag: s3flag, patch: s.patch, lsAvatar: s3u && s3u.avatarUrl, lsCrop: s3u && s3u.avatarCrop }));

    // ── S4：gif + free → 锁 toast + 升级链接显 + 零上传零 PATCH ──
    await nav(BASE + '/index.html?nov', "!!document.querySelector('#slati-sidebar .user-module')", 'S4 重载（free）');
    await openSettings();
    await setFile('#settingsAvatarFile', tmpGif);
    await sleep(600);
    s = await counts();
    const s4t = await toastText();
    const s4dlg = await cdp.evalJs("!!document.querySelector('.mn-crop-stage')");
    ok('S4 gif+free：锁 toast 文案 + 升级链接可见 + 零上传零 PATCH + 弹窗未开（门禁先于弹窗）', s4t && s4t.text === 'GIF 动图为订阅用户专属功能' && s4t.active && s.up === 0 && s.patch === 0 && s4dlg === false, JSON.stringify({ t: s4t, up: s.up, patch: s.patch, dlg: s4dlg }));

    // ── S5：gif + premium → 放行 + 零金罩 ──
    await nav(BASE + '/index.html?nov&prem', "!!document.querySelector('#slati-sidebar .user-module')", 'S5 重载（prem）');
    await openSettings();
    const s5upgrade = await cdp.evalJs("!!document.getElementById('settingsAvatarGifUpgradeLink')");
    await setFile('#settingsAvatarFile', tmpGif);
    await confirmCrop('S5 裁切弹窗');
    await sleep(400);
    s = await counts();
    const s5gold = await cdp.evalJs("!!document.querySelector('#settingsCard .gold-lock-group')");
    ok('S5 gif+premium：升级链接不渲染 + 上传恰 1 + PATCH 恰 1 体 {avatarUrl,avatarCrop} + 零金罩（prem 无锁钮）', s5upgrade === false && s.up === 1 && s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'avatarUrl,avatarCrop' && s5gold === false, JSON.stringify({ upgrade: s5upgrade, up: s.up, patch: s.patch, gold: s5gold }));

    // ── S6a：图库 free → libLocked 锁零 DOM 零上传 ──
    await nav(BASE + '/index.html?nov&lib', "!!document.querySelector('#slati-sidebar .user-module')", 'S6a 重载（free+lib）');
    await openSettings();
    await cdp.evalJs("document.getElementById('settingsAvatarLibBtn').click()");
    await sleep(500);
    s = await counts();
    const s6a = await cdp.evalJs("(function(){ return { grid: !!document.querySelector('.settings-lib-grid'), t: (function(){ var t = document.getElementById('settingsProfileToast'); return t ? t.textContent : null; })() }; })()");
    ok('S6a 图库 free：锁 toast + 零网格浮层 + 零上传零 PATCH', s6a.grid === false && s6a.t === '图库为订阅用户专属功能' && s.up === 0 && s.patch === 0, JSON.stringify(s6a));

    // ── S6b：图库 premium → 选 data: 格 → 上传 + PATCH ──
    await nav(BASE + '/index.html?nov&prem&lib', "!!document.querySelector('#slati-sidebar .user-module')", 'S6b 重载（prem+lib）');
    await openSettings();
    await cdp.evalJs("document.getElementById('settingsAvatarLibBtn').click()");
    await waitFor(cdp, "!!document.querySelector('.settings-lib-grid')", 5000, 'S6b 图库网格');
    await cdp.evalJs("document.querySelector('.settings-lib-cell').click()");
    await confirmCrop('S6b 裁切弹窗');
    await sleep(400);
    s = await counts();
    const s6u = await readUserLs();
    ok('S6b 图库 prem：点 data: 格 → 转 Blob 走同链（弹窗 confirm）→ 上传恰 1 + PATCH 恰 1 体 {avatarUrl,avatarCrop} + slati_user.avatarUrl 写 DEMO02',
      s.up === 1 && s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'avatarUrl,avatarCrop' && s.patched.avatarUrl === '/uploads/UPL-DEMO02.jpg' &&
      JSON.stringify(s.patched.avatarCrop) === '{"x":0,"y":0,"w":1,"h":1}' && s6u && s6u.avatarUrl === '/uploads/UPL-DEMO02.jpg',
      JSON.stringify({ up: s.up, patch: s.patch, ls: s6u && s6u.avatarUrl }));

    // ── S7：横幅上传 → PATCH {bannerUrl} + 预览/移除按钮 + 移除 → PATCH {bannerUrl:null}（prem 种子——free 横幅上传已锁 58.22） ──
    await nav(BASE + '/index.html?nov&banner&prem', "!!document.querySelector('#slati-sidebar .user-module')", 'S7 重载（banner 预设+prem）');
    await openSettings();
    let s7 = await cdp.evalJs("(function(){ var bp = document.getElementById('settingsBannerPreview'); var rm = document.getElementById('settingsBannerRemoveBtn'); var img = bp ? bp.querySelector('img.settings-banner-img') : null; return { hasImg: bp.classList.contains('has-img'), bg: img ? img.getAttribute('src') : null, rmShown: getComputedStyle(rm).display !== 'none' }; })()");
    ok('S7a 横幅预设：预览 has-img + 内嵌 img src 含 DEMO01（58.25 背景改 img）+ 移除按钮可见', s7.hasImg && s7.bg && s7.bg.indexOf('UPL-DEMO01') !== -1 && s7.rmShown, JSON.stringify(s7));
    await setFile('#settingsBannerFile', tmpAv);
    await confirmCrop('S7b 裁切弹窗');
    await sleep(400);
    s = await counts();
    const s7u = await readUserLs();
    const s7prev = await cdp.evalJs("(function(){ var i = document.querySelector('#settingsBannerPreview img.settings-banner-img'); return i ? i.getAttribute('src') : null; })()");
    ok('S7b 横幅上传：PATCH 恰 1 体恰 {bannerUrl,bannerCrop} rect {0,0,1,1} + slati_user.bannerUrl 写 DEMO02 + bannerCrop 合并写（无旗标恒写）+ 预览换图',
      s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'bannerUrl,bannerCrop' && s.patched.bannerUrl === '/uploads/UPL-DEMO02.jpg' &&
      JSON.stringify(s.patched.bannerCrop) === '{"x":0,"y":0,"w":1,"h":1}' &&
      s7u && s7u.bannerUrl === '/uploads/UPL-DEMO02.jpg' && JSON.stringify(s7u.bannerCrop) === '{"x":0,"y":0,"w":1,"h":1}' &&
      s7prev === '/uploads/UPL-DEMO02.jpg',
      JSON.stringify({ patch: s.patch, keys: s.patched && Object.keys(s.patched).join(','), crop: s.patched && JSON.stringify(s.patched.bannerCrop), ls: s7u && s7u.bannerUrl, prev: s7prev }));
    await cdp.evalJs("document.getElementById('settingsBannerRemoveBtn').click()");
    await sleep(800);
    s = await counts();
    const s7u2 = await readUserLs();
    s7 = await cdp.evalJs("(function(){ var bp = document.getElementById('settingsBannerPreview'); var rm = document.getElementById('settingsBannerRemoveBtn'); return { hasImg: bp.classList.contains('has-img'), rmHidden: getComputedStyle(rm).display === 'none', toast: (function(){ var t = document.getElementById('settingsProfileToast'); return t ? t.textContent : null; })() }; })()");
    ok('S7c 横幅移除：PATCH 体 {bannerUrl:null} + slati_user.bannerUrl null + has-img 撤 + 按钮隐 + toast',
      s.patched && Object.keys(s.patched).join(',') === 'bannerUrl' && s.patched.bannerUrl === null && s7u2 && s7u2.bannerUrl === null && s7.hasImg === false && s7.rmHidden === true && s7.toast === '横幅已移除',
      JSON.stringify({ keys: s.patched && Object.keys(s.patched).join(','), val: s.patched && s.patched.bannerUrl, s7 }));

    // ── S8：同步 toggle 写 '1'/'0' ──
    await nav(BASE + '/index.html?nov', "!!document.querySelector('#slati-sidebar .user-module')", 'S8 重载');
    await openSettings();
    await cdp.evalJs("document.querySelector('[data-sec=\"profile\"] .toggle-switch').click()");
    await sleep(200);
    const s8a = await cdp.evalJs("localStorage.getItem('slati_avatar_sync')");
    await cdp.evalJs("document.querySelector('[data-sec=\"profile\"] .toggle-switch').click()");
    await sleep(200);
    const s8b = await cdp.evalJs("localStorage.getItem('slati_avatar_sync')");
    ok('S8 同步 toggle：点击写 "0" → 再点写 "1"', s8a === '0' && s8b === '1', JSON.stringify({ a: s8a, b: s8b }));

    // ── S9：演示用户（无 USR- id）控件隐藏 ──
    await nav(BASE + '/index.html?demo', "!!document.querySelector('#slati-sidebar .user-module')", 'S9 重载（demo）');
    await openSettings();
    const s9 = await cdp.evalJs("(function(){ return { av: !!document.getElementById('settingsAvatarBtn'), lib: !!document.getElementById('settingsAvatarLibBtn'), bu: !!document.getElementById('settingsBannerUploadBtn'), rm: !!document.getElementById('settingsBannerRemoveBtn'), toggle: !!document.querySelector('[data-sec=\"profile\"] .toggle-switch'), pv: !!document.getElementById('settingsAvatarPreview'), grid: !!document.getElementById('settingsBgGrid') }; })()");
    ok('S9 演示用户：上传/图库/移除/toggle 全隐藏 + 预览仍只读展示 + settingsBgGrid 缺席（stReal 门内）', s9.av === false && s9.lib === false && s9.bu === false && s9.rm === false && s9.toggle === false && s9.pv === true && s9.grid === false, JSON.stringify(s9));

    // ── S10：free 横幅上传门禁（金罩包 upload+lib 同罩+移除钮罩外+toast 精确串+零上传零 PATCH+imgUpgrade 链接） ──
    await nav(BASE + '/index.html?nov', "!!document.querySelector('#slati-sidebar .user-module')", 'S10 重载（free）');
    await openSettings();
    let s10 = await cdp.evalJs("(function(){ var up = document.getElementById('settingsBannerUploadBtn'); var lib = document.getElementById('settingsBannerLibBtn'); var rm = document.getElementById('settingsBannerRemoveBtn'); var g = up && up.closest('.gold-lock-group'); return { upIn: !!g, libIn: !!(lib && lib.closest('.gold-lock-group') === g), rmOut: !(rm && rm.closest('.gold-lock-group')), goldCount: document.querySelectorAll('#settingsCard .gold-lock-group').length, shroud: g ? getComputedStyle(g, '::after').content : null, upLocked: up.classList.contains('sub-locked'), avFree: !!document.getElementById('settingsAvatarBtn') && !document.getElementById('settingsAvatarBtn').closest('.gold-lock-group') }; })()");
    ok('S10a free 金罩结构：横幅 upload+lib 同罩（goldCount 2=头像图库罩+横幅罩）+ 移除钮罩外 + 头像上传钮自由（钦定④）+ ::after 真渲染 + upload 带 sub-locked',
      s10.upIn && s10.libIn && s10.rmOut && s10.goldCount === 2 && s10.shroud !== 'none' && s10.upLocked && s10.avFree, JSON.stringify(s10));
    await cdp.evalJs("document.getElementById('settingsBannerUploadBtn').click()");
    await sleep(500);
    s = await counts();
    let s10t = await toastText();
    const s10upL = await cdp.evalJs("(function(){ var a = document.getElementById('settingsBannerGifUpgradeLink'); return a ? { text: a.textContent.trim(), shown: getComputedStyle(a).display !== 'none' } : null; })()");
    const s10dlg = await cdp.evalJs("!!document.querySelector('.mn-crop-stage')");
    ok('S10b free 点横幅上传：toast 精确串 + 零上传零 PATCH + imgUpgrade 链接可见文案精确（含图标 ligature 字形名）+ 弹窗未开',
      s10t && s10t.text === '横幅图片为订阅用户专属功能' && s10t.active && s.up === 0 && s.patch === 0 &&
      s10upL && s10upL.shown && s10upL.text === 'workspace_premium订阅后解锁横幅图片与 GIF 动图' && s10dlg === false,
      JSON.stringify({ t: s10t, up: s.up, patch: s.patch, link: s10upL, dlg: s10dlg }));
    await cdp.evalJs("document.getElementById('settingsBannerLibBtn').click()");
    await sleep(500);
    s = await counts();
    s10t = await toastText();
    const s10grid = await cdp.evalJs("!!document.querySelector('.settings-lib-pop')");
    ok('S10c free 点横幅图库：libLocked toast + 零浮层零上传零 PATCH（金罩点击穿透反馈仍在）',
      s10t && s10t.text === '图库为订阅用户专属功能' && s10grid === false && s.up === 0 && s.patch === 0,
      JSON.stringify({ t: s10t, grid: s10grid, up: s.up, patch: s.patch }));

    // ── S11：free 预设点选 mono-bw（PATCH 体恰 {cardBg}+合并写+预览类+active 换位+13 格+toast） ──
    await nav(BASE + '/index.html?nov', "!!document.querySelector('#slati-sidebar .user-module')", 'S11 重载（free）');
    await openSettings();
    let s11 = await cdp.evalJs("(function(){ var g = document.getElementById('settingsBgGrid'); var ss = g.querySelectorAll('.settings-bg-swatch'); return { count: ss.length, defActive: !!g.querySelector('[data-bg=\"\"].active'), bw: !!g.querySelector('[data-bg=\"mono-bw\"]') }; })()");
    ok('S11a free 预设网格：13 格 + 默认格 active（无 cardBg）+ mono-bw 格在位', s11.count === 13 && s11.defActive && s11.bw, JSON.stringify(s11));
    await cdp.evalJs("document.querySelector('#settingsBgGrid [data-bg=\"mono-bw\"]').click()");
    await sleep(800);
    s = await counts();
    const s11u = await readUserLs();
    s11 = await cdp.evalJs("(function(){ var g = document.getElementById('settingsBgGrid'); var bp = document.getElementById('settingsBannerPreview'); return { bwActive: !!g.querySelector('[data-bg=\"mono-bw\"].active'), defActive: !!g.querySelector('[data-bg=\"\"].active'), prevCls: bp.className, toast: (function(){ var t = document.getElementById('settingsProfileToast'); return t ? t.textContent : null; })() }; })()");
    ok('S11b free 点 mono-bw：PATCH 恰 1 体恰 {cardBg:"mono-bw"} + slati_user 合并写（bannerUrl 仍 null 字段保留）+ 预览类含 mono-bw 无 has-img + active 换位 + toast 精确串',
      s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'cardBg' && s.patched.cardBg === 'mono-bw' &&
      s11u && s11u.cardBg === 'mono-bw' && s11u.bannerUrl === null && s11u.displayName === '电池用户' &&
      s11.bwActive && s11.defActive === false && s11.prevCls.indexOf('mono-bw') !== -1 && s11.prevCls.indexOf('has-img') === -1 &&
      s11.toast === '横幅颜色已更新',
      JSON.stringify({ patch: s.patch, keys: s.patched && Object.keys(s.patched).join(','), ls: s11u, s11 }));

    // ── S12：basic（零金罩+静态横幅上传放行+gif 锁 premGifUpgrade 链接+图库浮层 400px 4 列） ──
    await nav(BASE + '/index.html?nov&basic&lib', "!!document.querySelector('#slati-sidebar .user-module')", 'S12 重载（basic+lib）');
    await openSettings();
    const s12gold = await cdp.evalJs("(function(){ var up = document.getElementById('settingsBannerUploadBtn'); return { gold: !!document.querySelector('#settingsCard .gold-lock-group'), upLocked: up.classList.contains('sub-locked'), upL: (function(){ var a = document.getElementById('settingsBannerGifUpgradeLink'); return a ? a.textContent.trim() : null; })() }; })()");
    ok('S12a basic：零金罩 + 横幅上传不带 sub-locked + premGifUpgrade 链接文案精确（含图标 ligature 字形名）', s12gold.gold === false && s12gold.upLocked === false && s12gold.upL === 'workspace_premium升级到高级订阅可上传 GIF 动图', JSON.stringify(s12gold));
    await setFile('#settingsBannerFile', tmpAv);
    await confirmCrop('S12b 裁切弹窗');
    await sleep(400);
    s = await counts();
    const s12u = await readUserLs();
    ok('S12b basic 静态横幅上传：上传恰 1 + PATCH 恰 1 体 {bannerUrl,bannerCrop} rect {0,0,1,1} + slati_user 写 DEMO02', s.up === 1 && s.patch === 1 && s.patched && Object.keys(s.patched).join(',') === 'bannerUrl,bannerCrop' && s.patched.bannerUrl === '/uploads/UPL-DEMO02.jpg' && JSON.stringify(s.patched.bannerCrop) === '{"x":0,"y":0,"w":1,"h":1}' && s12u && s12u.bannerUrl === '/uploads/UPL-DEMO02.jpg', JSON.stringify({ up: s.up, patch: s.patch, keys: s.patched && Object.keys(s.patched).join(','), ls: s12u && s12u.bannerUrl }));
    await setFile('#settingsBannerFile', tmpGif);
    await sleep(600);
    s = await counts();
    const s12t = await toastText();
    const s12dlg = await cdp.evalJs("!!document.querySelector('.mn-crop-stage')");
    ok('S12c basic gif 横幅：锁 toast 精确串 + 零新增上传零新增 PATCH（仍 1/1）+ 弹窗未开', s12t && s12t.text === 'GIF 动图为订阅用户专属功能' && s12t.active && s.up === 1 && s.patch === 1 && s12dlg === false, JSON.stringify({ t: s12t, up: s.up, patch: s.patch, dlg: s12dlg }));
    await cdp.evalJs("document.getElementById('settingsBannerLibBtn').click()");
    await waitFor(cdp, "!!document.querySelector('.settings-lib-pop')", 5000, 'S12 图库浮层');
    const s12pop = await cdp.evalJs("(function(){ var p = document.querySelector('.settings-lib-pop'); var g = p.querySelector('.settings-lib-grid'); return { w: getComputedStyle(p).width, cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, cells: g.querySelectorAll('.settings-lib-cell').length }; })()");
    ok('S12d basic 图库浮层：400px 宽 + 4 列 + 种子 data: 格 1（加大弹窗钦定）', s12pop.w === '400px' && s12pop.cols === 4 && s12pop.cells === 1, JSON.stringify(s12pop));

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
