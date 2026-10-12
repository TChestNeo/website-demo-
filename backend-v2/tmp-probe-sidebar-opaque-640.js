// tmp-probe-sidebar-opaque-640.js — v0.2.58.27 侧栏菜单背景卡片改不透明线上探针（mnationworld.com）
//   S1a site-config：58.27 赋值 ×1 + 58.26 赋值零残留 + FC 52.0 赋值 ×1 + changelog 头 58.27/58.26 各 ×1；
//   S1b rev live 口径：rev 00365-真值 ×1 + 00365-XXX 零残留 + 00366-??? 占位 ×1 + 00366-终态零残留
//      （live 滞后一部署=惯例：工作树已填 00366-终态，live 仍二次烘焙镜像）；
//   S1c ethereal live 锚：background: var(--sidebar-bg); ×3 + 原话 ×1 + 暗色铺底规则零残留 + 灭滤镜规则在位；
//   S1d 内联页 live 锚：community-profile 内联 sbg ×3 + 原话 ×1 + index 原话 ×1；
//   S2 API：health 200 + tables:66（033 五新表回归——本轮零迁移）；
//   S3 匿名回归：fc/edges 匿名公开 200；
//   P1 CDP（假会话）：P1a 亮色 nav-module 卡面 computed rgba(255,255,255,0.95)+blur(20px)（live 实证不透明）+
//      P1b user/brand-module 同 0.95 三张卡同规则 + P1c .app-sidebar 容器仍全透明（58.1 不回归）+
//      P1d 暗色 data-theme=dark → rgb(26,26,46) + P1e index.html 同款 0.95；E1 零异常。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

const REAL65 = '00365-6zb'; // deploy#1 实得 rev（部署后填真）
const REAL66 = '00366-2jw'; // deploy#2 实得 rev（部署后填真；live 断言=零残留）
const SITE = 'https://mnationworld.com';
const REAL_PROFILE = SITE + '/pages/community-profile.html?id=USR-000001'; // live 真实种子用户（Neo）；匿名视角
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-sb640-' + Date.now());
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
const hget = (url, opts) => new Promise((resolve) => {
  opts = opts || {};
  const req = https.request(url, Object.assign({ method: opts.method || 'GET', headers: Object.assign({}, opts.headers), timeout: 25000 }), (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 12000000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  if (opts.body) req.write(opts.body);
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
});

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
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        const txt = (m.params.args || []).map(a => a.value || a.description || '').join(' ');
        if (txt.indexOf('Failed to load resource') === -1) this.errs.push('CON:' + txt.slice(0, 200));
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

const SESSION_SCRIPT = 'try{(function(){ localStorage.setItem("slati_session", "{\\"loggedIn\\":true}");' +
  ' localStorage.setItem("slati_user", JSON.stringify({ id: "USR-000101", displayName: "探针用户", tier: "free" }));' +
  ' localStorage.setItem("slati_lang", "zh-CN"); })();}catch(e){}';

(async () => {
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;
  const lc = (src, a) => src.split('\n').filter((l) => l.includes(a)).length; // 行计数口径=实测 grep -cF

  console.log('═══ S1 静态锚（live）═══');
  const sc = await hget(SITE + '/assets/js/site-config.js');
  const scSrc = norm(sc.body);
  const scCount = mk(scSrc);
  ok('S1a site-config：58.27 赋值 ×1 + 58.26 赋值零残留 + FC 52.0 赋值 ×1 + changelog 头 58.27/58.26 各 ×1',
    scCount("window.MN_SITE_VERSION = 'v0.2.58.27';") === 1 &&
    scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") === 0 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.52.0';") === 1 &&
    scCount('// v0.2.58.27 = ') === 1 && scCount('// v0.2.58.26 = ') === 1,
    'v27=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.27';") +
    ' v26=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") +
    ' fc520=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.52.0';") +
    ' cl27=' + scCount('// v0.2.58.27 = ') + ' cl26=' + scCount('// v0.2.58.26 = '));
  ok('S1b site-config rev live 口径：rev ' + REAL65 + ' ×1 + 00365-XXX 零残留 + 00366-??? 占位 ×1 + ' + REAL66 + ' 零残留',
    scCount('rev ' + REAL65) === 1 && scCount('00365-XXX') === 0 && scCount('00366-???') === 1 && scCount(REAL66) === 0,
    'r65=' + scCount('rev ' + REAL65) + ' x65=' + scCount('00365-XXX') + ' q66=' + scCount('00366-???') + ' r66=' + scCount(REAL66));

  const ethSrc = norm((await hget(SITE + '/assets/css/ethereal.css')).body);
  ok('S1c ethereal live：sbg ×3 + 原话 ×1 + 暗色铺底规则零残留 + 灭滤镜规则在位',
    lc(ethSrc, 'background: var(--sidebar-bg);') === 3 &&
    lc(ethSrc, '那个在个人主页') === 1 &&
    lc(ethSrc, ':root[data-theme="dark"] .app-sidebar {') === 0 &&
    lc(ethSrc, ':root[data-theme="dark"] .app-sidebar .lg-backdrop {') === 1,
    'sbg=' + lc(ethSrc, 'background: var(--sidebar-bg);') + ' q=' + lc(ethSrc, '那个在个人主页') +
    ' pad=' + lc(ethSrc, ':root[data-theme="dark"] .app-sidebar {') +
    ' kill=' + lc(ethSrc, ':root[data-theme="dark"] .app-sidebar .lg-backdrop {'));

  const cpSrc = norm((await hget(SITE + '/pages/community-profile.html')).body);
  const idxSrc = norm((await hget(SITE + '/index.html')).body);
  ok('S1d 内联页 live：community-profile 内联 sbg ×3 + 原话 ×1 + index 内联 原话 ×1',
    lc(cpSrc, 'background: var(--sidebar-bg);') === 3 && lc(cpSrc, '那个在个人主页') === 1 &&
    lc(idxSrc, '那个在个人主页') === 1,
    'cp=' + lc(cpSrc, 'background: var(--sidebar-bg);') + '/' + lc(cpSrc, '那个在个人主页') +
    ' idx=' + lc(idxSrc, '那个在个人主页'));

  console.log('═══ S2 API（匿名口径）═══');
  const health = await hget(SITE + '/api/health');
  let healthJson = null; try { healthJson = JSON.parse(health.body); } catch (e) {}
  ok('S2 /api/health 200 + tables:66（033 五新表回归——本轮零迁移）', health.status === 200 && healthJson && healthJson.status === 'ok' && healthJson.tables === 66,
    JSON.stringify({ status: health.status, tables: healthJson && healthJson.tables }));

  console.log('═══ S3 匿名回归 ═══');
  const edges = await hget(SITE + '/api/fc/edges?scope=all');
  ok('S3 fc/edges 匿名公开 200（回归）', edges.status === 200, 'status=' + edges.status);

  console.log('═══ P1 CDP（假会话；live computed 实证）═══');
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
  let cdp = null;
  const NAV_STYLE = "(function(){ var el = document.querySelector('#slati-sidebar .nav-module'); " +
    " if (!el) return null; var s = getComputedStyle(el); " +
    " return { bg: s.backgroundColor, bf: s.backdropFilter }; })()";
  const USER_STYLE = "(function(){ var el = document.querySelector('#slati-sidebar .user-module'); " +
    " if (!el) return null; return getComputedStyle(el).backgroundColor; })()";
  const BRAND_STYLE = "(function(){ var el = document.querySelector('#slati-sidebar .brand-module'); " +
    " if (!el) return null; return getComputedStyle(el).backgroundColor; })()";
  const SIDEBAR_STYLE = "(function(){ var el = document.querySelector('#slati-sidebar'); " +
    " if (!el) return null; return getComputedStyle(el).backgroundColor; })()";
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION_SCRIPT });
    const origHandler = cdp.ws.onmessage;
    cdp.ws.onmessage = (ev) => {
      origHandler(ev);
      try {
        const m = JSON.parse(ev.data);
        if (m.method === 'Page.javascriptDialogOpening') cdp.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      } catch (e) {}
    };

    // P1a-d 资料页（真实用户匿名视角）——侧栏三张卡 computed 不透明实证
    await cdp.send('Page.navigate', { url: REAL_PROFILE });
    await waitFor(cdp, "document.querySelector('#slati-sidebar .nav-module')", 40000, '资料页侧栏就绪');
    await sleep(1200);
    const n1 = await cdp.evalJs(NAV_STYLE);
    ok('P1a 亮色 nav-module 卡面 live computed 不透明 rgba(255,255,255,0.95) + blur(20px) 保留',
      n1 && n1.bg === 'rgba(255, 255, 255, 0.95)' && n1.bf === 'blur(20px)', JSON.stringify(n1));
    const u1 = await cdp.evalJs(USER_STYLE);
    const b1 = await cdp.evalJs(BRAND_STYLE);
    ok('P1b 三张卡同规则：user/brand-module 同 0.95 不透明',
      u1 === 'rgba(255, 255, 255, 0.95)' && b1 === 'rgba(255, 255, 255, 0.95)',
      JSON.stringify({ u: u1, b: b1 }));
    const s1 = await cdp.evalJs(SIDEBAR_STYLE);
    ok('P1c 58.1 不回归：.app-sidebar 容器仍全透明（卡下方无面板）',
      s1 === 'rgba(0, 0, 0, 0)', 'bg=' + s1);
    await cdp.evalJs("document.documentElement.setAttribute('data-theme', 'dark')");
    await sleep(400);
    const n2 = await cdp.evalJs(NAV_STYLE);
    ok('P1d 暗色 nav-module 卡面实心 #1a1a2e（rgb(26,26,46)）+ blur 保留',
      n2 && n2.bg === 'rgb(26, 26, 46)' && n2.bf === 'blur(20px)', JSON.stringify(n2));

    // P1e index.html（个人主页）
    await cdp.evalJs("document.documentElement.removeAttribute('data-theme')");
    await cdp.send('Page.navigate', { url: SITE + '/index.html' });
    await waitFor(cdp, "document.querySelector('#slati-sidebar .nav-module')", 40000, 'index 侧栏就绪');
    await sleep(1200);
    const n3 = await cdp.evalJs(NAV_STYLE);
    ok('P1e index.html（个人主页）nav-module 卡面同款 0.95 不透明',
      n3 && n3.bg === 'rgba(255, 255, 255, 0.95)', JSON.stringify(n3));
  } catch (e) {
    console.log('  💔 ' + e.message);
    fail++;
  }
  console.log('═══ E1 零异常 ═══');
  const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
  const rawErrs = cdp ? cdp.errs : [];
  const errs = rawErrs.filter(e => !noise.test(e));
  ok('E1 零异常（' + rawErrs.length + ' 原始 / ' + errs.length + ' 噪声后）', errs.length === 0, errs.slice(0, 5).join(' || '));
  try { cdp && cdp.close(); } catch (e) {}
  try { spawn('taskkill', ['/pid', String(chrome.pid), '/t', '/f'], { stdio: 'ignore' }); } catch (e) {}

  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  process.exit(fail === 0 ? 0 : 1);
})();
