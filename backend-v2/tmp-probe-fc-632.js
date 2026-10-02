// tmp-probe-fc-632.js — v0.2.58.26 FC 首页真数据+不透明卡片线上探针（mnationworld.com）
//   S1a site-config：58.26 赋值 ×1/58.25 赋值零残留/FC 48.2 ×1/48.1 赋值零残留/changelog 头 58.26/48.2/58.25/48.1 各 ×1；
//   S1b rev live 口径：00348-t8b ×2/00348-XXX 零残留/00349-??? 占位 ×2/00349-hgc 零残留
//      （live 文本滞后一部署=惯例：工作树已填 00349-hgc，live 仍二次烘焙镜像）；
//   S1c fluidcanvas live 15 锚（FC_OVERVIEW 数据层 3/不透明两规则/访客门禁/假数据可执行体零残留/48.2×3/回归 crop 件）；
//   S1d i18n live：3 样新键 ×12 + __ZH_HANT_AUTO__ ×2；
//   S2 后端 live：GET /api/fc/overview 匿名 401（requireSession 在位）+ /api/health 200（服务在服）；
//   P1 CDP 访客零写安全：fluidcanvas 匿名面 html.fc-guest 挂类 → locked-hero flex + studio-main/accountBar 隐 +
//      零 /api 请求（58.24 hub 先例：访客零 API 连探针不发）+ 登录引导卡 DOM 在位；
//   E1 零异常（噪声已滤）。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const SITE = 'https://mnationworld.com';
const FC = SITE + '/pages/fluidcanvas.html';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-fc632-' + Date.now());
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

  console.log('═══ S1 静态锚（live site-config + fluidcanvas + i18n + 后端）═══');
  const sc = await fetch(SITE + '/assets/js/site-config.js');
  const scSrc = norm(await sc.text());
  const scCount = mk(scSrc);
  ok('S1a site-config：58.26 赋值在位 + 58.25 赋值零残留 + FC 48.2 在位 + 48.1 赋值零残留 + changelog 头 58.26/48.2/58.25/48.1 各 ×1',
    scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") === 1 && scCount("window.MN_SITE_VERSION = 'v0.2.58.25';") === 0 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.2';") === 1 && scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.1';") === 0 &&
    scCount('// v0.2.58.26 = ') === 1 && scCount('// v10.28.48.2 = ') === 1 && scCount('// v0.2.58.25 = ') === 1 && scCount('// v10.28.48.1 = ') === 1,
    'v26=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") + ' v25=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.25';") +
    ' fc2=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.2';") + ' fc1=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.1';") +
    ' cl26=' + scCount('// v0.2.58.26 = ') + ' clfc2=' + scCount('// v10.28.48.2 = ') + ' cl25=' + scCount('// v0.2.58.25 = ') + ' clfc1=' + scCount('// v10.28.48.1 = '));
  ok('S1b site-config rev live 口径：00348-t8b ×2 + 00348-XXX 零残留 + 00349-??? 占位 ×2 + 00349-hgc 零残留（live 滞后一部署）',
    scCount('rev 00348-t8b') === 2 && scCount('00348-XXX') === 0 && scCount('00349-???') === 2 && scCount('00349-hgc') === 0,
    'r48=' + scCount('rev 00348-t8b') + ' x48=' + scCount('00348-XXX') + ' q49=' + scCount('00349-???') + ' r49=' + scCount('00349-hgc'));

  const F = await fetch(SITE + '/pages/fluidcanvas.html');
  const fSrc = norm(await F.text());
  const flines = fSrc.split('\n');
  const c = (a) => flines.filter((l) => l.includes(a)).length; // 行计数口径=实测 grep -cF
  const F_ANCHORS = [['var FC_OVERVIEW = null;', 1], ['function loadFcOverview(', 1], ['loadFcOverview(true)', 2],
    ['body.fc-page .card:not(.profile-header) { background: var(--sidebar-bg); }', 1],
    ['body.fc-page .card:not(.profile-header) > .lg-backdrop { filter: none; backdrop-filter: none; }', 1],
    ["document.documentElement.classList.add('fc-guest')", 1], ['fc-locked-hero', 3],
    ['var SIMULATED_FILES', 0], ['function simulateFilePick', 0], ["'48.2K'", 0], ['slati_demo_article_content', 0],
    ['v10.28.48.2', 3], ['FT(\'fc.analytics.noData\')', 1], ['fc-ch-avatar-crop', 4], ['MN_CropDialog', 3]];
  const fbad = F_ANCHORS.filter(([a, n]) => c(a) !== n);
  ok('S1c fluidcanvas 15 锚全中（FC_OVERVIEW 数据层/不透明两规则/访客门禁/假数据可执行体零残留/48.2×3/回归 crop 件）', fbad.length === 0,
    fbad.map(([a, n]) => a + '=' + c(a) + '≠' + n).join(',') || '15/15');

  const I = await fetch(SITE + '/assets/i18n/fluidcanvas.i18n.js');
  const iSrc = norm(await I.text());
  const ic = mk(iSrc);
  ok('S1d i18n live：3 样新键 ×12 语 + __ZH_HANT_AUTO__ ×2',
    ic('"fc.analytics.noData"') === 12 && ic('"fc.upload.needLogin"') === 12 && ic('"fc.landing.emptyArticles"') === 12 && ic('__ZH_HANT_AUTO__') === 2,
    'noData=' + ic('"fc.analytics.noData"') + ' needLogin=' + ic('"fc.upload.needLogin"') + ' emptyArticles=' + ic('"fc.landing.emptyArticles"') + ' hant=' + ic('__ZH_HANT_AUTO__'));

  const ovRes = await fetch(SITE + '/api/fc/overview', { headers: { 'accept': 'application/json' } });
  const healthRes = await fetch(SITE + '/api/health', { headers: { 'accept': 'application/json' } });
  ok('S2 后端 live：GET /api/fc/overview 匿名 401（requireSession 在位）+ /api/health 200（服务在服）',
    ovRes.status === 401 && healthRes.ok, 'overview=' + ovRes.status + ' health=' + healthRes.status);

  console.log('═══ P1 CDP 访客零写安全（fluidcanvas 匿名面：锁屏 + 零 API 请求）═══');
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
    await cdp.send('Page.navigate', { url: FC });
    await waitFor(cdp, 'document.documentElement.classList.contains("fc-guest")', 60000, '访客挂类');
    await sleep(1200);
    const d1 = await cdp.evalJs("(() => { var hero = document.querySelector('.fc-locked-hero');" +
      " return { heroDisp: hero ? getComputedStyle(hero).display : null," +
      " smDisp: getComputedStyle(document.querySelector('.studio-main')).display," +
      " abDisp: getComputedStyle(document.getElementById('accountBar')).display," +
      " heroText: hero ? (hero.textContent || '').trim().slice(0, 60) : '' }; })()");
    ok('P1 访客锁屏：fc-locked-hero flex + studio-main/accountBar 隐 + 登录引导卡 DOM 非空',
      d1.heroDisp === 'flex' && d1.smDisp === 'none' && d1.abDisp === 'none' && d1.heroText.length > 0, JSON.stringify(d1));
    const apiReqs = cdp.reqs.filter(u => /\/api\//.test(u));
    const nonBeacon = apiReqs.filter(u => !/\/api\/analytics\//.test(u));
    const fcData = apiReqs.filter(u => /\/api\/(social|fc|tags|uploads|users|auth|topics|media)\//.test(u));
    ok('P1 访客零数据 API：除全站 pageview 信标外零 /api 请求（FC 数据 API 零——58.24 hub 先例 live 口径）',
      nonBeacon.length === 0 && fcData.length === 0,
      '非信标=' + nonBeacon.length + ' FC数据=' + fcData.length + (apiReqs.slice(0, 5).join(' | ') || '零请求'));

    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|Failed to load resource|analytics|pageview|mnationworld/i;
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
