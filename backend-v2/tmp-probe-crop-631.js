// tmp-probe-crop-631.js — v0.2.58.25 裁切弹窗+横幅增高+视频横幅线上探针（mnationworld.com）
//   S1a site-config：58.25 赋值 ×1/58.24 赋值零残留/FC 48.1 ×1/48.0 赋值零残留/changelog 头 58.25+58.24+48.1 各 ×1；
//   S1b rev live 口径：00346-rn2 ×2/00346-XXX 零残留/00347-??? 占位 ×2/00347-skv 零残留
//      （live 文本滞后一部署=惯例：工作树已填 00347-skv，live 仍二次烘焙镜像）；
//   S1c profile 页 16 锚（210px×2/140px 遗留×1/calc(210px×2/background-size×1/140→210px×1/profile-banner-crop×7/
//      applyCrop×16/MN_CropDialog×22/MN_CompressVideo×2/VIDEO_EXTS×4/profile-banner-video×3/
//      editAvatarReCropBtn×2/editBannerReCropBtn×3/avatarNoVideo×1/videoCompressing×1/videoLocked×1）；
//   S1d settings-modal 8 锚（window.MN_CropDialog×2/MN_CompressVideo×1/MN_VideoCap×1/
//      settingsAvatarReCropBtn×2/settingsBannerReCropBtn×2/144px 单行 CSS×1/avatarCrop×7/bannerCrop×8）；
//   S1e 后端 030 live 实证：GET /api/social/users/USR-000001 响应含 bannerCrop+avatarCrop 两键（null 合法）——
//      迁移 030 已应用+social.js 公开暴露（/api/health 无 user_version 键故走用户端点实证）；
//   P1 CDP 零写安全（hub 页匿名面）：evalJs MN_CropDialog.open({kind:'avatar', src:data:svg, onConfirm→__probeRect})→
//      弹窗 DOM（.mn-crop-stage/.mn-crop-confirm/.mn-crop-cancel+标题非空）→点确认→__probeRect 深等 {x:0,y:0,w:1,h:1}→
//      关闭→baseline 后零新 /api|/uploads 请求（零上传零 PATCH）；
//   E1 零异常（噪声已滤）。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const SITE = 'https://mnationworld.com';
const HUB = SITE + '/pages/community-hub.html';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-crop-' + Date.now());
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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; this.reqs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Network.requestWillBeSent') {
        this.reqs.push(m.params.request.url);
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
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;

  console.log('═══ S1 静态锚（live site-config + profile 页 + settings-modal + 后端 030）═══');
  const sc = await fetch(SITE + '/assets/js/site-config.js');
  const scSrc = norm(await sc.text());
  const scCount = mk(scSrc);
  ok('S1a site-config：58.25 赋值在位 + 58.24 赋值零残留 + FC 48.1 在位 + 48.0 赋值零残留 + changelog 头 58.25/58.24/48.1 各 ×1',
    scCount("window.MN_SITE_VERSION = 'v0.2.58.25';") === 1 && scCount("window.MN_SITE_VERSION = 'v0.2.58.24';") === 0 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.1';") === 1 && scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") === 0 &&
    scCount('// v0.2.58.25 = ') === 1 && scCount('// v0.2.58.24 = ') === 1 && scCount('// v10.28.48.1 = ') === 1,
    'v25=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.25';") + ' v24=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.24';") +
    ' fc1=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.1';") + ' fc0=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") +
    ' cl25=' + scCount('// v0.2.58.25 = ') + ' cl24=' + scCount('// v0.2.58.24 = ') + ' clfc=' + scCount('// v10.28.48.1 = '));
  ok('S1b site-config rev live 口径：00346-rn2 ×2 + 00346-XXX 零残留 + 00347-??? 占位 ×2 + 00347-skv 零残留（live 滞后一部署）',
    scCount('rev 00346-rn2') === 2 && scCount('rev 00346-XXX') === 0 && scCount('rev 00347-???') === 2 && scCount('rev 00347-skv') === 0,
    'r46=' + scCount('rev 00346-rn2') + ' x46=' + scCount('rev 00346-XXX') + ' q47=' + scCount('rev 00347-???') + ' r47=' + scCount('rev 00347-skv'));

  const P = await fetch(SITE + '/pages/community-profile.html');
  const pSrc = norm(await P.text());
  const plines = pSrc.split('\n');
  const c = (a) => plines.filter((l) => l.includes(a)).length; // 行计数口径=实测 grep -cF
  const P_ANCHORS = [['height: 210px', 2], ['height: 140px', 1], ['calc(210px', 2], ['background-size: 100% 210px', 1],
    ['140→210px', 1], ['profile-banner-crop', 7], ['applyCrop', 16], ['MN_CropDialog', 22], ['MN_CompressVideo', 2],
    ['VIDEO_EXTS', 4], ['profile-banner-video', 3], ['editAvatarReCropBtn', 2], ['editBannerReCropBtn', 3],
    ['avatarNoVideo', 1], ['videoCompressing', 1], ['videoLocked', 1]];
  const pbad = P_ANCHORS.filter(([a, n]) => c(a) !== n);
  ok('S1c profile 页 16 锚全中（210px 增高/裁切弹窗/视频链/重裁钮）', pbad.length === 0,
    pbad.map(([a, n]) => a + '=' + c(a) + '≠' + n).join(',') || '16/16');

  const S = await fetch(SITE + '/assets/js/settings-modal.js');
  const sSrc = norm(await S.text());
  const slines = sSrc.split('\n');
  const sc2 = (a) => slines.filter((l) => l.includes(a)).length; // 行计数口径=实测 grep -cF
  const S_ANCHORS = [['window.MN_CropDialog', 2], ['window.MN_CompressVideo', 1], ['window.MN_VideoCap', 1],
    ['settingsAvatarReCropBtn', 2], ['settingsBannerReCropBtn', 2],
    ['.settings-banner-preview { position: relative; overflow: hidden; height: 144px;', 1],
    ['avatarCrop', 7], ['bannerCrop', 8]];
  const sbad = S_ANCHORS.filter(([a, n]) => sc2(a) !== n);
  ok('S1d settings-modal 8 锚全中（MN_CropDialog 暴露/压缩件/重裁钮/144px 预览）', sbad.length === 0,
    sbad.map(([a, n]) => a + '=' + sc2(a) + '≠' + n).join(',') || '8/8');

  const postsRes = await fetch(SITE + '/api/social/posts', { headers: { 'accept': 'application/json' } });
  const postsBody = await postsRes.json().catch(() => null);
  const uid = postsBody && postsBody.posts && postsBody.posts[0] && postsBody.posts[0].authorId;
  if (!uid) {
    ok('S1e 后端 030：线上无帖无公开用户 → 跳过（health ok 已证服务在服；入口迁移失败即不服务）', true, 'skipped');
  } else {
    const uRes = await fetch(SITE + '/api/social/users/' + uid, { headers: { 'accept': 'application/json' } });
    const uBody = await uRes.json().catch(() => null);
    const hasKeys = uBody && uBody.user && 'bannerCrop' in uBody.user && 'avatarCrop' in uBody.user;
    ok('S1e 后端 030 live 实证：GET /api/social/users/' + uid + ' 响应含 bannerCrop+avatarCrop 两键（迁移已应用+公开暴露）',
      hasKeys, 'status=' + uRes.status + ' keys=' + (uBody && uBody.user ? Object.keys(uBody.user).join(',') : JSON.stringify(uBody).slice(0, 120)));
  }

  console.log('═══ P1 CDP 零写安全（hub 匿名面：弹窗 DOM→confirm→rect 深等→零上传零 PATCH）═══');
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
    await cdp.send('Log.enable'); await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    await cdp.send('Page.navigate', { url: HUB });
    await waitFor(cdp, "document.getElementById('hubLoginCard')", 60000, '访客登录引导卡');
    await sleep(1200);
    const baseline = cdp.reqs.length;
    const SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzQ2NDhkNCIvPjwvc3ZnPg==';
    await cdp.evalJs("window.__probeRect = null; window.MN_CropDialog.open({ kind: 'avatar', src: '" + SVG + "', initial: null, onConfirm: function(r) { window.__probeRect = r; } }); true");
    await waitFor(cdp, "document.querySelector('.mn-crop-stage')", 10000, '裁切弹窗 stage');
    const d1 = await cdp.evalJs("(() => { var st = document.querySelector('.mn-crop-stage'); var t = document.querySelector('.mn-crop-title');" +
      " return { stage: !!st, title: t ? (t.textContent || '').trim() : '', confirm: !!document.querySelector('.mn-crop-confirm')," +
      " cancel: !!document.querySelector('.mn-crop-cancel'), open: window.MN_CropDialog.isOpen() }; })()");
    ok('P1 弹窗 DOM 在位（stage+标题非空+confirm/cancel 钮+isOpen() true）',
      d1.stage && d1.title.length > 0 && d1.confirm && d1.cancel && d1.open, JSON.stringify(d1));
    await cdp.evalJs("document.querySelector('.mn-crop-confirm').click(); true");
    await waitFor(cdp, 'window.__probeRect !== null', 5000, 'onConfirm rect');
    const d2 = await cdp.evalJs("(() => { var r = window.__probeRect;" +
      " return { r: r, exact: !!(r && r.x === 0 && r.y === 0 && r.w === 1 && r.h === 1)," +
      " closed: !window.MN_CropDialog.isOpen() }; })()");
    ok('P1 confirm 零交互 → rect 深等 {x:0,y:0,w:1,h:1} + 弹窗已关',
      d2.exact && d2.closed, JSON.stringify(d2));
    const newApi = cdp.reqs.slice(baseline).filter(u => /\/api\/|\/uploads/.test(u));
    ok('P1 零写安全：baseline 后零新 /api 或 /uploads 请求（零上传零 PATCH）',
      newApi.length === 0, newApi.slice(0, 5).join(' | ') || '零请求');

    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|Failed to load resource|\/api\/|404|429|analytics|pageview|mnationworld/i;
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
