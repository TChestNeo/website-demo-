// tmp-probe-profile-subtier.js — v0.2.58.21 个人资料横幅/头像订阅分层线上探针（mnationworld.com 匿名面）
// 注记：门禁写操作线上无法无凭证探（锁 UI/toast/上传拦截=登录态+个人数据）——由电池 tmp-battery-profile-subtier.js 覆盖
//   （D1 锁 UI/D2-D3 图库拦截/D4-D5 gif 拦截/D6 静态放行/D7 订阅全解锁/D8 祖父全 21 项）。
//   S1 页面静态锚+site-config 58.19/rev → S2 端点形状（public users 200 → 真 id 主页 GET 含 bannerUrl 键+
//   无 banner_url 蛇形泄漏）→ S3 PII（public users 条目零 bannerUrl）→ S4 FC 不互通（fluidcanvas 零 bannerUrl）→
//   P1 CDP 匿名渲染（真用户 ?id= 导航：profileMain 可见+.profile-banner 在 DOM+匿名非本人零 #profileEditBtn+非白屏）→ E1 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const SITE = 'https://mnationworld.com';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-subtier-' + Date.now());
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function get(p, opts) {
  const r = await fetch(SITE + p, opts);
  let body = null;
  try { body = await r.json(); } catch (e) { try { body = await r.text(); } catch (e2) {} }
  return { status: r.status, body };
}
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
  ok('S1 页面五 id 在位（upload/lib/remove/file/avatarLib）',
    count('id="editBannerUploadBtn"') === 1 && count('id="editBannerLibBtn"') === 1 &&
    count('id="editBannerRemoveBtn"') === 1 && count("id = 'editBannerFile'") === 1 &&
    count('id="editAvatarLibBtn"') === 1,
    'up=' + count('id="editBannerUploadBtn"') + ' lib=' + count('id="editBannerLibBtn"') +
    ' rm=' + count('id="editBannerRemoveBtn"') + ' file=' + count("id = 'editBannerFile'") +
    ' avlib=' + count('id="editAvatarLibBtn"'));
  ok('S1 页面关键件（has-img CSS + 图库选择器 + dataURL→Blob + 保存 diff）',
    count('.profile-banner.has-img') === 1 && count('function openFcLibraryPicker') === 1 &&
    count('function fcDataUrlToBlob') === 1 && count('body.bannerUrl = editBannerUrl') === 1,
    'css=' + count('.profile-banner.has-img') + ' picker=' + count('function openFcLibraryPicker') +
    ' blob=' + count('function fcDataUrlToBlob') + ' diff=' + count('body.bannerUrl = editBannerUrl'));
  ok('S1 页面 58.19 订阅分层件（sub-locked ×3 + function blockGif ×1 + 两升级链接 id + premium.html href）',
    count('sub-locked') === 3 && count('function blockGif') === 1 &&
    count('avatarGifUpgradeLink') === 1 && count('bannerGifUpgradeLink') === 1 && count('href="premium.html"') >= 3,
    'lock=' + count('sub-locked') + ' gif=' + count('function blockGif') +
    ' av=' + count('avatarGifUpgradeLink') + ' bn=' + count('bannerGifUpgradeLink') + ' pr=' + count('href="premium.html"'));
  const sc = await fetch(SITE + '/assets/js/site-config.js');
  const scSrc = (await sc.text()).replace(/\r\n/g, '\n');
  const scCount = (s) => scSrc.split(s).length - 1;
  ok('S1 site-config：58.19 赋值在位 + FC 47.4 恒 + changelog 58.19 标题 + rev 00338-/00339- 前缀 + 58.18 条目烘焙 00331-g9b 保留',
    scCount("window.MN_SITE_VERSION = 'v0.2.58.21';") === 1 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") === 1 &&
    scCount('// v0.2.58.21 = ') === 1 && scCount('00338-') >= 1 && scCount('00339-') >= 1 && scCount('00331-g9b') === 1,
    'v58.19=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.21';") + ' fc=' +
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") + ' cl=' + scCount('// v0.2.58.21 = ') +
    ' r34=' + scCount('00338-') + ' r35=' + scCount('00339-') + ' r31=' + scCount('00331-g9b'));

  console.log('═══ S2 端点形状（匿名面）═══');
  const health = await get('/api/health');
  ok('S2a /api/health 200 + status ok + 60 表', health.status === 200 && health.body && health.body.status === 'ok' && health.body.db === 'ok' && health.body.tables === 60, JSON.stringify({ s: health.status, body: health.body }));
  const pub = await get('/api/public/users');
  const pubOk = pub.status === 200 && pub.body && Array.isArray(pub.body.users);
  ok('S2b /api/public/users 200 + users 数组（匿名）', pubOk, JSON.stringify(pub.status));
  let profileOk = false;
  let realId = null;
  if (pubOk && pub.body.users.length > 0) {
    const u = pub.body.users[0];
    realId = u.id;
    const prof = await get('/api/social/users/' + u.id);
    const user = prof.body && prof.body.user;
    profileOk = prof.status === 200 && user && ('bannerUrl' in user);
    ok('S2c 真 id 主页 GET /api/social/users/:id 200 + 形状含 bannerUrl 键',
      profileOk, JSON.stringify({ s: prof.status, keys: user ? Object.keys(user) : null }));
    if (prof.status === 200) {
      const rawProf = JSON.stringify(prof.body);
      ok('S2c 主页响应无 banner_url 蛇形泄漏', rawProf.indexOf('banner_url') === -1, rawProf.slice(0, 140));
    }
  } else {
    ok('S2c 公共用户列表空——形状检查跳过（生产应有用户，空=可疑）', false, 'users 空');
  }

  console.log('═══ S3 PII 扫描（public users 零 bannerUrl）═══');
  const rawPub = JSON.stringify(pub.body || {});
  ok('S3 public users 条目零 bannerUrl 键（PII 最小口径：横幅绝不出现在发现/关注页）',
    rawPub.indexOf('bannerUrl') === -1, rawPub.slice(0, 120));

  console.log('═══ S4 FC 不互通（钦定③线上铁证：FC 频道主页零 bannerUrl）═══');
  const fcPage = await fetch(SITE + '/pages/fluidcanvas.html');
  const fcHtml = (await fcPage.text()).replace(/\r\n/g, '\n');
  ok('S4 fluidcanvas.html 源零 bannerUrl/banner_url（FC 频道主页横幅与资料横幅不互通）',
    fcHtml.indexOf('bannerUrl') === -1 && fcHtml.indexOf('banner_url') === -1,
    'bannerUrl=' + fcHtml.indexOf('bannerUrl') + ' banner_url=' + fcHtml.indexOf('banner_url'));

  console.log('═══ P1 CDP 匿名渲染（真实资料页 ?id=）═══');
  if (!realId) {
    ok('P1 无可用真 id 跳过（public users 空=可疑）', false, 'users 空');
  } else {
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
    await cdp.send('Page.navigate', { url: SITE + '/pages/community-profile.html?id=' + realId });
    await waitFor(cdp, "document.getElementById('profileMain') && document.getElementById('profileMain').style.display !== 'none' && document.querySelector('.profile-banner')", 60000, 'P1 profileMain');
    const p1 = await cdp.evalJs("(function(){var bn=document.querySelector('.profile-banner');var ed=document.getElementById('profileEditBtn');var txt=document.body.textContent;return {banner:!!bn,editBtn:!!ed,txtLen:txt.length};})()");
    ok('P1 匿名渲染（profileMain 可见 + .profile-banner 在 DOM + 匿名非本人零 #profileEditBtn + 页面非白屏）',
      p1.banner && !p1.editBtn && p1.txtLen > 200, JSON.stringify(p1));
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|settings-menu|Failed to load resource|\/api\/|404|429/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('E1 控制台零错误（噪声已滤）', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));
    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    fail++;
  }
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  }
  console.log('\n═══ ' + (fail === 0 ? 'ALL GREEN' : 'FAILED') + ' — ' + pass + '/' + (pass + fail) + ' ═══');
  process.exit(fail === 0 ? 0 : 1);
})();
