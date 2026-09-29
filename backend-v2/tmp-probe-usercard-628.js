// tmp-probe-usercard-628.js — v0.2.58.22 横幅三层门禁+金罩+预设扩展线上探针（mnationworld.com）
// 注记：写路径（上传/PATCH 横幅头像/预设保存）线上无凭证不可探——由两新电池覆盖（settings-profilecust 27 项+
//   profile-subtier 27 项）。
//   S1 静态锚（settings-modal 58.22 新件 settingsBgGrid/gold-lock-group/ST_BG_DEFS/stCanGif/width: 400px+
//   58.21 回归件 sub-locked ×4/六 id；sidebar 弹窗件；common.i18n 5 新键 11 单引号+1 zh-Hant 双引号；
//   site-config 58.22/48.0+rev 终态口径（00340- 真值 ×1+00340-XXX 零残留+00341-??? ×1+00338-tj5 保留）；
//   页面件 gold-lock-group ×4/canGif ×7/680px ×1+prof 3 新键 ×11）
//   → P1 CDP seed 假 USR- session+user → 真实点击侧栏卡 → 弹窗本地渲染（不跳页）+GET 404 静默（统计 '—'）
//   → P2 CDP 点齿轮开设置弹窗 → free 层：横幅上传钮在 gold-lock-group 罩内+头像图库钮 sub-locked+移除钮隐藏+
//   #settingsBgGrid 13 swatch+mono-bw 在位+imgUpgrade 链接可见+点罩内上传钮零崩溃 → E1 零异常。
// 口径：rev 00340-XXX 终态已填真值（二次烘焙）；live 文本滞后一部署=惯例——探针跑在 deploy#2 之后。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const SITE = 'https://mnationworld.com';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-usercard-' + Date.now());
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

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
      } else if (m.method === 'Fetch.requestPaused') {
        this.onPaused(m.params);
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

(async () => {
  console.log('═══ S1 静态锚（live 页面件+site-config）═══');
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;

  const sm = await fetch(SITE + '/assets/js/settings-modal.js');
  const smSrc = norm(await sm.text());
  const smc = mk(smSrc);
  ok('S1a settings-modal 58.22 新件（settingsBgGrid ×2+settings-bg-grid ×2+settings-bg-swatch ×6+ST_BG_DEFS ×2+stCanGif ×3+stCanImg ×4+gold-lock-group ×5+gold-locked ×2+goldShimmer ×3+mono-bw ×3+toast.bannerLocked/toast.bgUpdated/imgUpgrade/premGifUpgrade 各 ×1+width: 400px ×1+repeat(4, 1fr) ×1）',
    smc('settingsBgGrid') === 2 && smc('settings-bg-grid') === 2 && smc('settings-bg-swatch') === 6 &&
    smc('ST_BG_DEFS') === 2 && smc('stCanGif') === 3 && smc('stCanImg') === 4 && smc('gold-lock-group') === 5 &&
    smc('gold-locked') === 2 && smc('goldShimmer') === 3 && smc('mono-bw') === 3 &&
    smc('settings.profile.toast.bannerLocked') === 1 && smc('settings.profile.toast.bgUpdated') === 1 &&
    smc('settings.profile.imgUpgrade') === 1 && smc('settings.profile.premGifUpgrade') === 1 &&
    smc('width: 400px') === 1 && smc('repeat(4, 1fr)') === 1,
    'grid=' + smc('settingsBgGrid') + ' gold=' + smc('gold-lock-group') + ' canGif=' + smc('stCanGif') +
    ' bw=' + smc('mono-bw') + ' w400=' + smc('width: 400px'));
  ok('S1b settings-modal 58.21 回归件（六 id ×2+横幅预览 ×4+移除钮 ×4+sub-locked ×4+stUpload 定义+stRawMergeUser 定义+slati_avatar_sync ×4+两升级链接 3/4）',
    smc('settingsAvatarBtn') === 2 && smc('settingsAvatarPreview') === 2 && smc('settingsAvatarLibBtn') === 2 &&
    smc('settingsBannerPreview') === 4 && smc('settingsBannerUploadBtn') === 2 && smc('settingsBannerLibBtn') === 2 &&
    smc('settingsBannerRemoveBtn') === 4 && smc('sub-locked') === 4 && smc('function stUpload') === 1 &&
    smc('function stRawMergeUser') === 1 && smc('slati_avatar_sync') === 4 &&
    smc('settingsAvatarGifUpgradeLink') === 3 && smc('settingsBannerGifUpgradeLink') === 4,
    'btn=' + smc('settingsAvatarBtn') + ' bprev=' + smc('settingsBannerPreview') +
    ' lock=' + smc('sub-locked') + ' up=' + smc('settingsAvatarGifUpgradeLink') + ' bup=' + smc('settingsBannerGifUpgradeLink'));

  const sb = await fetch(SITE + '/assets/js/sidebar.js');
  const sbSrc = norm(await sb.text());
  const sbc = mk(sbSrc);
  ok('S1c sidebar 弹窗件（openUserPop ×1+slati-user-pop-style ×2+preventDefault ×2+e.stopPropagation() ×1+.user-info-bar a ×1+initUserPopWiring ×2+SlatiSettings.open ×3+e.button !== 0 ×1）',
    sbc('function openUserPop') === 1 && sbc('slati-user-pop-style') === 2 && sbc('preventDefault') === 2 &&
    sbc('e.stopPropagation()') === 1 && sbc('.user-info-bar a') === 1 && sbc('initUserPopWiring') === 2 &&
    sbc('SlatiSettings.open') === 3 && sbc('e.button !== 0') === 1,
    'pop=' + sbc('function openUserPop') + ' pd=' + sbc('preventDefault') + ' stop=' + sbc('e.stopPropagation()') +
    ' wire=' + sbc('initUserPopWiring'));

  const ci = await fetch(SITE + '/assets/i18n/common.i18n.js');
  const ciSrc = norm(await ci.text());
  const cic = mk(ciSrc);
  ok('S1d common.i18n 58.22 五新键（bannerColor/imgUpgrade/premGifUpgrade/toast.bannerLocked/toast.bgUpdated 各 11 单引号+zh-Hant 双引号 ×1+生成标记 ×1）',
    cic("'settings.profile.bannerColor'") === 11 && cic("'settings.profile.imgUpgrade'") === 11 &&
    cic("'settings.profile.premGifUpgrade'") === 11 && cic("'settings.profile.toast.bannerLocked'") === 11 &&
    cic("'settings.profile.toast.bgUpdated'") === 11 && cic('"settings.profile.bannerColor"') === 1 &&
    cic('__ZH_HANT_AUTO__') === 1,
    'bc=' + cic("'settings.profile.bannerColor'") + ' dq=' + cic('"settings.profile.bannerColor"') +
    ' hant=' + cic('__ZH_HANT_AUTO__'));

  const sc = await fetch(SITE + '/assets/js/site-config.js');
  const scSrc = norm(await sc.text());
  const scCount = mk(scSrc);
  ok('S1e site-config：58.22/48.0 赋值在位 + 58.21 赋值零残留 + 58.22 changelog 标题 + FC 48.0 标题',
    scCount("window.MN_SITE_VERSION = 'v0.2.58.22';") === 1 && scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") === 1 &&
    scCount("window.MN_SITE_VERSION = 'v0.2.58.21';") === 0 && scCount('// v0.2.58.22 = ') === 1 &&
    scCount('// v10.28.48.0 = ') === 1,
    'v58.22=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.22';") + ' fc48=' +
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") + ' v58.21=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.21';") +
    ' cl=' + scCount('// v0.2.58.22 = ') + ' fcl=' + scCount('// v10.28.48.0 = '));
  ok('S1f site-config rev 终态口径：00340- 真值 ×1 + 00340-XXX 占位零残留 + 00341-??? 占位 ×1 + 58.21 条目 00338-tj5 保留',
    scCount('00340-') === 1 && scCount('00340-XXX') === 0 && scCount('00341-???') === 1 && scCount('00338-tj5') === 1,
    'r40=' + scCount('00340-') + ' x40=' + scCount('00340-XXX') + ' q41=' + scCount('00341-???') +
    ' r38=' + scCount('00338-tj5'));

  const page = await fetch(SITE + '/pages/community-profile.html');
  const pageSrc = norm(await page.text());
  const pgc = mk(pageSrc);
  ok('S1g 资料页 58.22 件：gold-lock-group ×4+gold-locked ×3+goldShimmer ×3+canGif ×7+bannerLocked ×2+imgUpgrade ×1+premGifUpgrade ×2+680px ×1+height: 80px ×1+mono-charcoal ×3',
    pgc('gold-lock-group') === 4 && pgc('gold-locked') === 3 && pgc('goldShimmer') === 3 && pgc('canGif') === 7 &&
    pgc('prof.toast.bannerLocked') === 2 && pgc('prof.edit.imgUpgrade') === 1 && pgc('prof.edit.premGifUpgrade') === 2 &&
    pgc("maxWidth = '680px'") === 1 && pgc('height: 80px') === 1 && pgc('mono-charcoal') === 3,
    'gold=' + pgc('gold-lock-group') + ' canGif=' + pgc('canGif') + ' prem=' + pgc('prof.edit.premGifUpgrade'));
  const pi = await fetch(SITE + '/assets/i18n/community-profile.i18n.js');
  const piSrc = norm(await pi.text());
  const pic = mk(piSrc);
  ok('S1h community-profile.i18n 三新键（bannerLocked/imgUpgrade/premGifUpgrade 各 11 单引号+zh-Hant 双引号 ×1+生成标记 ×1）',
    pic("'prof.toast.bannerLocked'") === 11 && pic("'prof.edit.imgUpgrade'") === 11 && pic("'prof.edit.premGifUpgrade'") === 11 &&
    pic('"prof.toast.bannerLocked"') === 1 && pic('__ZH_HANT_AUTO__') === 1,
    'sq=' + pic("'prof.toast.bannerLocked'") + ' dq=' + pic('"prof.toast.bannerLocked"'));

  console.log('═══ P1 CDP 侧栏卡点击弹窗（不跳页+本地渲染+GET 404 静默）═══');
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const SEED = `try{(function(){
    localStorage.setItem('slati_lang', 'zh-CN');
    localStorage.setItem('slati_session', '{"loggedIn":true}');
    localStorage.setItem('slati_user', JSON.stringify({ id: 'USR-PROBE-628', displayName: '探针用户', citizenId: 'CIT-PROBE-628', bio: '探针本地简介', gender: 'Male', tier: 'free' }));
  })();}catch(e){}`;
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
    const pageTab = pages.find(x => x.type === 'page');
    const cdp = new CDP(pageTab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    // Fetch 拦截：auth/me → 种子用户 200（防真实 401 清登录态）；users/USR-PROBE-628 → 404（回填静默离线面）
    cdp.onPaused = (p) => {
      const u = p.request.url;
      const fulfill = (code, body) => cdp.send('Fetch.fulfillRequest', {
        requestId: p.requestId, responseCode: code,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body: Buffer.from(body).toString('base64')
      }).catch(() => {});
      if (u.indexOf('/api/auth/me') !== -1) fulfill(200, JSON.stringify({ user: { id: 'USR-PROBE-628', displayName: '探针用户', citizenId: 'CIT-PROBE-628', bio: '探针本地简介', gender: 'Male', tier: 'free' } }));
      else if (u.indexOf('/api/social/users/USR-PROBE-628') !== -1) fulfill(404, '{}');
      else cdp.send('Fetch.continueRequest', { requestId: p.requestId }).catch(() => {});
    };
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*://mnationworld.com/api/auth/me*' }, { urlPattern: '*://mnationworld.com/api/social/users/USR-PROBE-628*' }] });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SEED });
    await cdp.send('Page.navigate', { url: SITE + '/index.html' });
    await waitFor(cdp, "document.querySelector('#slati-sidebar .user-module .user-info-bar a')", 60000, 'P1 侧栏用户锚');
    await sleep(1200);
    const href0 = await cdp.evalJs('window.location.href');
    // 真实 CDP 点击（合成 click 不受 preventDefault 约束——家规）
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
    const r = await cdp.evalJs("(function(){ var a = document.querySelector('#slati-sidebar .user-module .user-info-bar a'); var rr = a.getBoundingClientRect(); return { x: rr.left + rr.width / 2, y: rr.top + rr.height / 2 }; })()");
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', buttons: 1, clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(1000);
    const p1 = await cdp.evalJs("(function(){ var bd = document.querySelector('.slati-user-pop-backdrop'); function t(id){ var n = document.getElementById(id); return n ? n.textContent : null; } function vis(id){ var n = document.getElementById(id); return n ? getComputedStyle(n).display !== 'none' : null; } if (!bd) return null; return { open: true, name: t('userPopName'), cid: t('userPopCid'), bio: t('userPopBio'), following: t('userPopFollowing'), followers: t('userPopFollowers'), posts: t('userPopPosts'), joinedVis: vis('userPopJoined'), tier: !!bd.querySelector('.slati-user-pop-tier'), edit: !!document.getElementById('userPopEditBtn'), view: !!document.getElementById('userPopViewBtn') }; })()");
    ok('P1 点击侧栏卡：弹窗开 + 本地渲染（名字/公民号/简介）+ 统计恒 "—"（GET 404 静默）+ 加入时间隐藏 + free 无 tier 徽章 + 两按钮在位',
      p1 && p1.open && p1.name === '探针用户' && p1.cid === 'CIT-PROBE-628' && p1.bio === '探针本地简介' &&
      p1.following === '—' && p1.followers === '—' && p1.posts === '—' && p1.joinedVis === false &&
      p1.tier === false && p1.edit && p1.view, JSON.stringify(p1));
    ok('P1 不跳页（location 不变——stopPropagation 拦 transitions.js 程序化导航）',
      (await cdp.evalJs('window.location.href')) === href0,
      'href0=' + href0.slice(0, 60) + ' now=' + (await cdp.evalJs('window.location.href')).slice(0, 60));

    console.log('═══ P2 CDP 齿轮开设置弹窗（free 层金罩+预设网格）═══');
    await cdp.evalJs("(function(){ var b = document.querySelector('.slati-user-pop-close'); if (b) b.click(); })()");
    await sleep(600);
    await cdp.evalJs("(function(){ var g = document.querySelector('#slati-sidebar .settings-btn-collapsed'); if (g) g.click(); })()");
    await waitFor(cdp, "document.getElementById('settingsCard')", 20000, 'P2 settingsCard');
    await sleep(600);
    const p2 = await cdp.evalJs("(function(){ function vis(id){ var n = document.getElementById(id); return n ? getComputedStyle(n).display !== 'none' : null; } function cls(id){ var n = document.getElementById(id); return n ? n.className : null; } var up = document.getElementById('settingsBannerUploadBtn'); var lib = document.getElementById('settingsBannerLibBtn'); var g = up && up.closest('.gold-lock-group'); var grid = document.getElementById('settingsBgGrid'); var sw = grid ? grid.querySelectorAll('.settings-bg-swatch') : []; return { upInGold: !!g, libInGold: !!(lib && lib.closest('.gold-lock-group') === g), goldCount: document.querySelectorAll('#settingsCard .gold-lock-group').length, upLocked: up ? up.classList.contains('sub-locked') : null, avLibLocked: (cls('settingsAvatarLibBtn') || '').indexOf('sub-locked') !== -1, avUpFree: !!(document.getElementById('settingsAvatarBtn') && !document.getElementById('settingsAvatarBtn').closest('.gold-lock-group')), gridN: sw.length, monoBw: grid ? !!grid.querySelector('[data-bg=\"mono-bw\"]') : false, imgUpVis: vis('settingsBannerGifUpgradeLink'), removeHidden: vis('settingsBannerRemoveBtn') === false, syncToggle: (function(){ var l = document.querySelector('[data-i18n=\"settings.profile.avatarSync\"]'); return !!(l && l.parentElement && l.parentElement.querySelector('.toggle-switch')); })() }; })()");
    ok('P2 free 层：横幅 upload+lib 同金罩（goldCount 2）+ upload 带 sub-locked + 头像图库钮 sub-locked + 头像上传自由 + 移除钮隐藏 + 同步勾选在位',
      p2.upInGold && p2.libInGold && p2.goldCount === 2 && p2.upLocked === true && p2.avLibLocked &&
      p2.avUpFree && p2.removeHidden && p2.syncToggle, JSON.stringify(p2));
    ok('P2 预设网格：13 swatch + mono-bw 在位 + imgUpgrade 升级链接可见',
      p2.gridN === 13 && p2.monoBw && p2.imgUpVis === true, 'grid=' + p2.gridN + ' bw=' + p2.monoBw + ' up=' + p2.imgUpVis);
    // 点罩内横幅上传钮（金罩伪元素 pointer-events:none 点击穿透到按钮→toast 门禁零崩溃）
    await cdp.evalJs("document.getElementById('settingsBannerUploadBtn').click()");
    await sleep(600);
    const p2b = await cdp.evalJs("(function(){ return { cardOpen: !!document.getElementById('settingsCard'), href: window.location.href }; })()");
    ok('P2 点罩内横幅上传钮：零崩溃 + 弹窗仍开 + 不跳页（free 门禁 toast 拦截）',
      p2b.cardOpen && p2b.href === href0, JSON.stringify(p2b));

    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|settings-menu|Failed to load resource|\/api\/|404|429|analytics|pageview|mnationworld/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('E1 控制台零错误（噪声已滤）', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));
    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    fail++;
  }
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}

  console.log('\n═══ ' + (fail === 0 ? 'ALL GREEN' : 'FAILED') + ' — ' + pass + '/' + (pass + fail) + ' ═══');
  process.exit(fail === 0 ? 0 : 1);
})();
