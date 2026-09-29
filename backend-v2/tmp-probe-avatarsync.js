// tmp-probe-avatarsync.js — v0.2.58.21 个人资料头像 ↔ FC 频道主页头像双向同步线上探针（mnationworld.com 匿名面）
// 注记：写路径（勾选旗标/上传/PATCH 头像）线上无法无凭证探——由电池 tmp-battery-profile-avatarsync.js 覆盖
//   （P 组资料页 8 项+F 组 FC 页 8 项+E 组全 25 项）。
//   S1 页面静态锚（资料页 toggle/slati_avatar_sync + FC 页 fc-avatar-editable/fcAvatarFile/fcEnsureApi/PATCH 体纯度/bannerUrl 零）+
//   site-config 58.20/48.0 赋值+旧版零残留+双 changelog 标题+rev 00338-/00339- 真值 ×2+占位零残留 →
//   S2 两词典新键在位（profile 1 键×11 单引号+zh-Hant 双引号×1、FC 六键×12、生成标记）→
//   P1 CDP 匿名 FC 渲染（fc-guest 客人英雄可见+studio-main 隐藏+零异常）→ E1 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const SITE = 'https://mnationworld.com';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-avatarsync-' + Date.now());
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
  console.log('═══ S1 页面静态锚 + site-config 版本/rev ═══');
  const page = await fetch(SITE + '/pages/community-profile.html');
  const html = (await page.text()).replace(/\r\n/g, '\n');
  const count = (s) => html.split(s).length - 1;
  ok('S1a 资料页 toggle 件（editAvatarSyncToggle ×4 + slati_avatar_sync ×2 + 58.19 sub-locked ×3 + blockGif ×1）',
    count('editAvatarSyncToggle') === 4 && count('slati_avatar_sync') === 2 &&
    count('sub-locked') === 3 && count('function blockGif') === 1,
    'toggle=' + count('editAvatarSyncToggle') + ' flag=' + count('slati_avatar_sync') +
    ' lock=' + count('sub-locked') + ' gif=' + count('function blockGif'));
  const fcPage = await fetch(SITE + '/pages/fluidcanvas.html');
  const fcHtml = (await fcPage.text()).replace(/\r\n/g, '\n');
  const fcount = (s) => fcHtml.split(s).length - 1;
  ok('S1b FC 页头像同步件（fc-avatar-editable ×6 + fcAvatarFile ×18 + fcEnsureApi ×2 + slati_avatar_sync ×1 + PATCH 体 avatarUrl: data.url ×1）',
    fcount('fc-avatar-editable') === 6 && fcount('fcAvatarFile') === 18 && fcount('fcEnsureApi') === 2 &&
    fcount('slati_avatar_sync') === 1 && fcount('avatarUrl: data.url') === 1,
    'ed=' + fcount('fc-avatar-editable') + ' file=' + fcount('fcAvatarFile') + ' api=' + fcount('fcEnsureApi') +
    ' flag=' + fcount('slati_avatar_sync') + ' patch=' + fcount('avatarUrl: data.url'));
  ok('S1c FC 页零 bannerUrl/banner_url（58.19 不互通铁证延续）',
    fcHtml.indexOf('bannerUrl') === -1 && fcHtml.indexOf('banner_url') === -1,
    'bannerUrl=' + fcHtml.indexOf('bannerUrl') + ' banner_url=' + fcHtml.indexOf('banner_url'));
  const sc = await fetch(SITE + '/assets/js/site-config.js');
  const scSrc = (await sc.text()).replace(/\r\n/g, '\n');
  const scCount = (s) => scSrc.split(s).length - 1;
  ok('S1d site-config：58.20/48.0 赋值在位 + 旧版赋值零残留 + 双 changelog 标题',
    scCount("window.MN_SITE_VERSION = 'v0.2.58.21';") === 1 && scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") === 1 &&
    scCount("window.MN_SITE_VERSION = 'v0.2.58.19';") === 0 && scCount("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") === 0 &&
    scCount('// v0.2.58.21 = ') === 1 && scCount('// v10.28.48.0 = ') === 1,
    'v58.20=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.21';") + ' fc48=' +
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") + ' v58.19=' +
    scCount("window.MN_SITE_VERSION = 'v0.2.58.19';") + ' fc47=' +
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") + ' cl=' + scCount('// v0.2.58.21 = ') +
    ' fcl=' + scCount('// v10.28.48.0 = '));
  ok('S1e site-config rev 口径：00338- 真值烘焙 ×1 + 00338-XXX 占位零残留 + 00339-??? 占位 ×1（live 文本滞后一部署=惯例）+ 58.19 条目 00334-tz6 保留',
    scCount('00338-') === 1 && scCount('00339-') === 1 && scCount('00338-XXX') === 0 &&
    scCount('00339-???') === 1 && scCount('00334-tz6') === 1,
    'r38=' + scCount('00338-') + ' r39=' + scCount('00339-') + ' x38=' + scCount('00338-XXX') +
    ' q39=' + scCount('00339-???') + ' r34=' + scCount('00334-tz6'));

  console.log('═══ S2 两词典新键在位 ═══');
  const pi = await fetch(SITE + '/assets/i18n/community-profile.i18n.js');
  const piSrc = (await pi.text()).replace(/\r\n/g, '\n');
  const piCount = (s) => piSrc.split(s).length - 1;
  ok('S2a profile 词典 prof.edit.avatarSync ×12（11 单引号手工块+1 zh-Hant 双引号）+ 生成标记 ×1',
    piCount('prof.edit.avatarSync') === 12 && piCount("'prof.edit.avatarSync'") === 11 &&
    piCount('__ZH_HANT_AUTO__') === 1,
    'all=' + piCount('prof.edit.avatarSync') + ' sq=' + piCount("'prof.edit.avatarSync'") +
    ' hant=' + piCount('__ZH_HANT_AUTO__'));
  const fci = await fetch(SITE + '/assets/i18n/fluidcanvas.i18n.js');
  const fciSrc = (await fci.text()).replace(/\r\n/g, '\n');
  const fciCount = (s) => fciSrc.split(s).length - 1;
  ok('S2b FC 词典六键 ×12 各（zh-Hant 自动块同双引号计入）+ 生成标记 ×2',
    fciCount('"fc.landing.changeAvatar"') === 12 && fciCount('"fc.toast.avatarUpdated"') === 12 &&
    fciCount('"fc.toast.avatarFailed"') === 12 && fciCount('"fc.toast.gifLocked"') === 12 &&
    fciCount('"fc.toast.imgOnly"') === 12 && fciCount('"fc.toast.imgTooBig10"') === 12 &&
    fciCount('__ZH_HANT_AUTO__') === 2,
    'ca=' + fciCount('"fc.landing.changeAvatar"') + ' up=' + fciCount('"fc.toast.avatarUpdated"') +
    ' fa=' + fciCount('"fc.toast.avatarFailed"') + ' gl=' + fciCount('"fc.toast.gifLocked"') +
    ' io=' + fciCount('"fc.toast.imgOnly"') + ' ib=' + fciCount('"fc.toast.imgTooBig10"') +
    ' hant=' + fciCount('__ZH_HANT_AUTO__'));

  console.log('═══ P1 CDP 匿名 FC 渲染（客人英雄+零异常）═══');
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
    const pageTab = pages.find(x => x.type === 'page');
    const cdp = new CDP(pageTab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    await cdp.send('Page.navigate', { url: SITE + '/pages/fluidcanvas.html' });
    await waitFor(cdp, "document.querySelector('.fc-locked-hero')", 60000, 'P1 fc-locked-hero');
    const p1 = await cdp.evalJs("(function(){var hero=document.querySelector('.fc-locked-hero');var studio=document.querySelector('.studio-main');var guest=document.documentElement.className.indexOf('fc-guest')!==-1;return {guest:guest,heroShown:hero?getComputedStyle(hero).display!=='none':false,studioHidden:studio?getComputedStyle(studio).display==='none':true,txtLen:document.body.textContent.length};})()");
    ok('P1 匿名 FC 渲染（html.fc-guest + .fc-locked-hero 可见 + .studio-main 隐藏 + 非白屏）',
      p1.guest && p1.heroShown && p1.studioHidden && p1.txtLen > 200, JSON.stringify(p1));
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|settings-menu|Failed to load resource|\/api\/|404|429/i;
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
