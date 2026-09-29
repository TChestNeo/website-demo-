// tmp-probe-usercard-627.js — v0.2.58.21 侧栏用户卡片弹窗+设置弹窗头像/横幅控件线上探针（mnationworld.com）
// 注记：写路径（上传/PATCH 头像横幅/同步旗标）线上无凭证不可探——由两新电池覆盖（settings-profilecust 17 项+
//   sidebar-userpop 10 项）。
//   S1 静态锚（settings-modal 六 id+sub-locked+stUpload+stRawMergeUser+slati_avatar_sync+升级链接×3；
//   sidebar 弹窗件 openUserPop/preventDefault 2/stopPropagation/user-info-bar a/SlatiSettings.open；
//   common.i18n 新键 11 单引号+1 zh-Hant 双引号+生成标记；site-config 58.21/48.0+rev 口径）
//   → P1 CDP seed 假 USR- session+user → 真实点击侧栏卡 → 弹窗本地渲染（不跳页=stopPropagation 拦 transitions.js）+
//   GET 404 静默（统计 '—'）→ P2 CDP 点齿轮开设置弹窗 → 头像/横幅控件在位+免费层 sub-locked → E1 零异常。
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
  ok('S1a settings-modal 头像/横幅控件件（六 id ×2+横幅预览 ×3+移除钮 ×4+sub-locked ×3+stUpload 定义+stRawMergeUser 定义+slati_avatar_sync ×4+两升级链接 ×3）',
    smc('settingsAvatarBtn') === 2 && smc('settingsAvatarPreview') === 2 && smc('settingsAvatarLibBtn') === 2 &&
    smc('settingsBannerPreview') === 3 && smc('settingsBannerUploadBtn') === 2 && smc('settingsBannerLibBtn') === 2 &&
    smc('settingsBannerRemoveBtn') === 4 && smc('sub-locked') === 3 && smc('function stUpload') === 1 &&
    smc('function stRawMergeUser') === 1 && smc('slati_avatar_sync') === 4 &&
    smc('settingsAvatarGifUpgradeLink') === 3 && smc('settingsBannerGifUpgradeLink') === 3,
    'btn=' + smc('settingsAvatarBtn') + ' prev=' + smc('settingsAvatarPreview') + ' bprev=' + smc('settingsBannerPreview') +
    ' rm=' + smc('settingsBannerRemoveBtn') + ' lock=' + smc('sub-locked') + ' flag=' + smc('slati_avatar_sync') +
    ' up=' + smc('settingsAvatarGifUpgradeLink'));

  const sb = await fetch(SITE + '/assets/js/sidebar.js');
  const sbSrc = norm(await sb.text());
  const sbc = mk(sbSrc);
  ok('S1b sidebar 弹窗件（openUserPop ×1+slati-user-pop-style ×2+preventDefault ×2+e.stopPropagation() ×1+.user-info-bar a ×1+initUserPopWiring ×2+SlatiSettings.open ×3+e.button !== 0 ×1）',
    sbc('function openUserPop') === 1 && sbc('slati-user-pop-style') === 2 && sbc('preventDefault') === 2 &&
    sbc('e.stopPropagation()') === 1 && sbc('.user-info-bar a') === 1 && sbc('initUserPopWiring') === 2 &&
    sbc('SlatiSettings.open') === 3 && sbc('e.button !== 0') === 1,
    'pop=' + sbc('function openUserPop') + ' pd=' + sbc('preventDefault') + ' stop=' + sbc('e.stopPropagation()') +
    ' wire=' + sbc('initUserPopWiring'));

  const ci = await fetch(SITE + '/assets/i18n/common.i18n.js');
  const ciSrc = norm(await ci.text());
  const cic = mk(ciSrc);
  ok('S1c common.i18n 新键（editProfile/banner/avatarSync/toast.avatarUpdated 各 11 单引号+zh-Hant 双引号 ×1+生成标记 ×1）',
    cic("'sidebar.pop.editProfile'") === 11 && cic("'settings.profile.banner'") === 11 &&
    cic("'settings.profile.avatarSync'") === 11 && cic("'settings.profile.toast.avatarUpdated'") === 11 &&
    cic('"sidebar.pop.editProfile"') === 1 && cic('__ZH_HANT_AUTO__') === 1,
    'sq=' + cic("'sidebar.pop.editProfile'") + ' dq=' + cic('"sidebar.pop.editProfile"') +
    ' hant=' + cic('__ZH_HANT_AUTO__'));

  const sc = await fetch(SITE + '/assets/js/site-config.js');
  const scSrc = norm(await sc.text());
  const scCount = mk(scSrc);
  ok('S1d site-config：58.21/48.0 赋值在位 + 58.20 赋值零残留 + 58.21 changelog 标题 + FC 48.0 标题',
    scCount("window.MN_SITE_VERSION = 'v0.2.58.21';") === 1 && scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") === 1 &&
    scCount("window.MN_SITE_VERSION = 'v0.2.58.20';") === 0 && scCount('// v0.2.58.21 = ') === 1 &&
    scCount('// v10.28.48.0 = ') === 1,
    'v58.21=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.21';") + ' fc48=' +
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") + ' v58.20=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.20';") +
    ' cl=' + scCount('// v0.2.58.21 = ') + ' fcl=' + scCount('// v10.28.48.0 = '));
  ok('S1e site-config rev 口径：00338- 真值 ×1 + 00338-XXX 占位零残留 + 00339-??? 占位 ×1（live 文本滞后一部署=惯例）+ 58.19 条目 00334-tz6 保留',
    scCount('00338-') === 1 && scCount('00338-XXX') === 0 && scCount('00339-???') === 1 && scCount('00334-tz6') === 1,
    'r38=' + scCount('00338-') + ' x38=' + scCount('00338-XXX') + ' q39=' + scCount('00339-???') +
    ' r34=' + scCount('00334-tz6'));

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
    localStorage.setItem('slati_user', JSON.stringify({ id: 'USR-PROBE-627', displayName: '探针用户', citizenId: 'CIT-PROBE-627', bio: '探针本地简介', gender: 'Male', tier: 'free' }));
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
    // Fetch 拦截：auth/me → 种子用户 200（防真实 401 清登录态）；users/USR-PROBE-627 → 404（回填静默离线面）
    cdp.onPaused = (p) => {
      const u = p.request.url;
      const fulfill = (code, body) => cdp.send('Fetch.fulfillRequest', {
        requestId: p.requestId, responseCode: code,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body: Buffer.from(body).toString('base64')
      }).catch(() => {});
      if (u.indexOf('/api/auth/me') !== -1) fulfill(200, JSON.stringify({ user: { id: 'USR-PROBE-627', displayName: '探针用户', citizenId: 'CIT-PROBE-627', bio: '探针本地简介', gender: 'Male', tier: 'free' } }));
      else if (u.indexOf('/api/social/users/USR-PROBE-627') !== -1) fulfill(404, '{}');
      else cdp.send('Fetch.continueRequest', { requestId: p.requestId }).catch(() => {});
    };
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*://mnationworld.com/api/auth/me*' }, { urlPattern: '*://mnationworld.com/api/social/users/USR-PROBE-627*' }] });
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
      p1 && p1.open && p1.name === '探针用户' && p1.cid === 'CIT-PROBE-627' && p1.bio === '探针本地简介' &&
      p1.following === '—' && p1.followers === '—' && p1.posts === '—' && p1.joinedVis === false &&
      p1.tier === false && p1.edit && p1.view, JSON.stringify(p1));
    ok('P1 不跳页（location 不变——stopPropagation 拦 transitions.js 程序化导航）',
      (await cdp.evalJs('window.location.href')) === href0,
      'href0=' + href0.slice(0, 60) + ' now=' + (await cdp.evalJs('window.location.href')).slice(0, 60));

    console.log('═══ P2 CDP 齿轮开设置弹窗（头像/横幅控件+免费层门禁）═══');
    await cdp.evalJs("(function(){ var b = document.querySelector('.slati-user-pop-close'); if (b) b.click(); })()");
    await sleep(600);
    await cdp.evalJs("(function(){ var g = document.querySelector('#slati-sidebar .settings-btn-collapsed'); if (g) g.click(); })()");
    await waitFor(cdp, "document.getElementById('settingsCard')", 20000, 'P2 settingsCard');
    await sleep(600);
    const p2 = await cdp.evalJs("(function(){ function vis(id){ var n = document.getElementById(id); return n ? getComputedStyle(n).display !== 'none' : null; } function cls(id){ var n = document.getElementById(id); return n ? n.className : null; } var syncLabel = document.querySelector('[data-i18n=\"settings.profile.avatarSync\"]'); var syncSw = syncLabel && syncLabel.parentElement ? syncLabel.parentElement.querySelector('.toggle-switch') : null; return { av: vis('settingsAvatarBtn'), avPrev: vis('settingsAvatarPreview'), avLib: vis('settingsAvatarLibBtn'), avLibLocked: (cls('settingsAvatarLibBtn') || '').indexOf('sub-locked') !== -1, gifUp: vis('settingsAvatarGifUpgradeLink'), ban: vis('settingsBannerUploadBtn'), banPrev: vis('settingsBannerPreview'), banRemove: vis('settingsBannerRemoveBtn'), banLib: vis('settingsBannerLibBtn'), sync: !!syncSw, bannerGrp: (function(){ var b = document.getElementById('settingsBannerRemoveBtn'); var g = b ? b.closest('.form-group') : null; return g ? getComputedStyle(g).display !== 'none' : null; })() }; })()");
    ok('P2 设置弹窗资料区：头像上传/预览/图库钮可见 + 图库钮 free 层 sub-locked + gif 升级链接可见 + 横幅上传/预览/图库可见 + 横幅组在位',
      p2.av && p2.avPrev && p2.avLib && p2.avLibLocked && p2.gifUp && p2.ban && p2.banPrev && p2.banLib && p2.bannerGrp === true,
      JSON.stringify(p2));
    ok('P2 移除按钮隐藏（bannerUrl null）+ 同步勾选在位', p2.banRemove === false && p2.sync, 'rm=' + p2.banRemove + ' sync=' + p2.sync);

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
