// tmp-battery-sidebar-opaque.js — v0.2.58.28 侧栏菜单背景卡片改不透明电池（640 轮主电池）
//   S 静态（零浏览器）：
//     S1 site-config：58.28 赋值 ×1/58.26 赋值零残留/changelog 头 58.28 在 58.26 前/用户原话 ×1/rev 终态 00365-6zb/00366-2jw 各 ×1（锚改真值）/FC 52.1 ×1；
//     S2 ethereal.css：--sidebar-bg 用法 2→3（dropdown+全站卡片+侧栏模块卡面）/新轮注释原话 ×1/旧 58.1 注释保留/铺底规则仍零残留/灭滤镜规则在位；
//     S3 内联刷新：CSS_MARK 页=41 且除编辑器豁免页外 40 页全含新轮注释/含 lg-glass-filter 页=41/community-profile 内联 --sidebar-bg ×3+原话 ×1；
//     S4 FC 编辑器页豁免血证：mark ×1+新轮注释零残留（页面专属 CSS 永不入内联块）；
//   B CDP（community-profile.html + index.html；localStorage 种子登录态）：
//     B1 亮色：nav-module 卡面 backgroundColor=rgba(255,255,255,0.95)（--sidebar-bg 近纯白）+backdropFilter blur(20px) 保留；
//     B2 暗色：html[data-theme=dark] → #1a1a2e 实心 rgb(26,26,46)；
//     B3 58.1 不回归：.app-sidebar 容器仍全透明（卡下方无面板）；
//     B4 玻璃注入层灭滤镜：nav-module 内 .lg-backdrop filter/backdrop-filter 双 none；
//     B5 index.html（个人主页）同款不透明；B6 三张卡同规则：user-module/brand-module 同 0.95；
//   E 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PORT = 4800 + Math.floor(Math.random() * 400);
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-sbopaque-' + Date.now());

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const c = (s, a) => s.split(a).length - 1;
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

// ── 本地静态服务器 ──
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};
const server = require('http').createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u.indexOf('/api') === 0) { res.writeHead(404); res.end('{"error":"NOT_FOUND"}'); return; }
  if (u === '/' || u === '/dashboard') u = '/index.html';
  let f = path.join(DOCS, u);
  if (!fs.existsSync(f) && !path.extname(f)) { if (fs.existsSync(f + '.html')) f += '.html'; }
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
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
        this.errs.push('EXC:' + JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
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

const SEED_SCRIPT = 'try{(function(){' +
  ' localStorage.setItem("slati_session", "{\\"loggedIn\\":true}");' +
  ' localStorage.setItem("slati_user", JSON.stringify({ id: "USR-000101", displayName: "电池用户", citizenId: "CIT-000101", bio: "电池用户简介", gender: "Male", tier: "free" }));' +
  ' localStorage.setItem("slati_lang", "zh-CN");' +
  '})();}catch(e){}';

const NAV_STYLE = "(function(){ var el = document.querySelector('#slati-sidebar .nav-module'); " +
  " if (!el) return null; var s = getComputedStyle(el); " +
  " return { bg: s.backgroundColor, bf: s.backdropFilter }; })()";
const USER_STYLE = "(function(){ var el = document.querySelector('#slati-sidebar .user-module'); " +
  " if (!el) return null; var s = getComputedStyle(el); " +
  " return { bg: s.backgroundColor, bf: s.backdropFilter }; })()";
const BRAND_STYLE = "(function(){ var el = document.querySelector('#slati-sidebar .brand-module'); " +
  " if (!el) return null; var s = getComputedStyle(el); " +
  " return { bg: s.backgroundColor, bf: s.backdropFilter }; })()";
const SIDEBAR_STYLE = "(function(){ var el = document.querySelector('#slati-sidebar'); " +
  " if (!el) return null; return getComputedStyle(el).backgroundColor; })()";
const BACKDROP_STYLE = "(function(){ var el = document.querySelector('#slati-sidebar .nav-module .lg-backdrop'); " +
  " if (!el) return null; var s = getComputedStyle(el); " +
  " return { f: s.filter, bf: s.backdropFilter }; })()";

async function main() {
  // ═══ S 静态 ═══
  console.log('═══ S 静态（零浏览器）═══');
  const sc = fs.readFileSync(path.join(DOCS, 'assets/js/site-config.js'), 'utf8');
  ok('S1a site-config：58.28 赋值 ×1 + 58.26 赋值零残留',
    c(sc, "window.MN_SITE_VERSION = 'v0.2.58.28';") === 1 && c(sc, "window.MN_SITE_VERSION = 'v0.2.58.26';") === 0,
    '27=' + c(sc, "window.MN_SITE_VERSION = 'v0.2.58.28';") + ' 26=' + c(sc, "window.MN_SITE_VERSION = 'v0.2.58.26';"));
  ok('S1b site-config：changelog 头 58.28 在 58.26 前 + 用户原话 ×1 + rev 终态 00365-6zb/00366-2jw 各 ×1（锚改真值）+ FC 52.1 ×1',
    sc.indexOf('// v0.2.58.28 = ') !== -1 && sc.indexOf('// v0.2.58.28 = ') < sc.indexOf('// v0.2.58.26 = ') &&
    c(sc, '那个在个人主页') === 1 && c(sc, 'rev 00365-6zb') === 1 && c(sc, 'rev 00366-2jw') === 1 &&
    c(sc, "window.FLUIDCANVAS_VERSION = 'v10.28.52.3';") === 1,
    'head=' + sc.indexOf('// v0.2.58.28 = ') + ' q=' + c(sc, '那个在个人主页') + ' r=' + c(sc, 'rev 00365-6zb') + '/' + c(sc, 'rev 00366-2jw'));
  const css = fs.readFileSync(path.join(DOCS, 'assets/css/ethereal.css'), 'utf8');
  ok('S2a ethereal.css：--sidebar-bg 用法 3→4 处（dropdown+全站卡片+侧栏模块卡面+折叠态 user-module 覆盖）',
    c(css, 'background: var(--sidebar-bg);') === 4, 'n=' + c(css, 'background: var(--sidebar-bg);'));
  ok('S2b ethereal.css：新轮注释原话 ×1 + 旧 58.1 注释保留 + 铺底规则仍零残留 + 灭滤镜规则在位',
    c(css, '那个在个人主页') === 1 && c(css, '我要完全的删除它') === 1 &&
    c(css, ':root[data-theme="dark"] .app-sidebar {') === 0 &&
    c(css, ':root[data-theme="dark"] .app-sidebar .lg-backdrop {') === 1,
    'q=' + c(css, '那个在个人主页') + ' old=' + c(css, '我要完全的删除它') + ' pad=' + c(css, ':root[data-theme="dark"] .app-sidebar {'));
  const mark = '/* ethereal.css 内联（切页闪修复 08-28：样式与 HTML 同包到达——浏览器画第一帧不再等样式表往返）*/';
  const files = [];
  (function walk(d, b) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name), b + e.name + '/');
      else if (e.name.endsWith('.html')) files.push(b + e.name);
    }
  })(DOCS, '');
  let marks = 0, lgfs = 0, fresh = 0, editorMark = 0, editorQuote = 0;
  for (const f of files) {
    const h = fs.readFileSync(path.join(DOCS, f), 'utf8');
    if (h.indexOf(mark) !== -1) {
      marks++;
      if (h.indexOf('那个在个人主页') !== -1) fresh++;
      if (f === 'pages/fluidcanvas-editor.html') editorMark++;
    }
    if (h.indexOf('lg-glass-filter') !== -1) lgfs++;
  }
  const ed = fs.readFileSync(path.join(DOCS, 'pages/fluidcanvas-editor.html'), 'utf8');
  editorQuote = c(ed, '那个在个人主页');
  ok('S3a 内联刷新：CSS_MARK 页=41 且新轮注释页=40（编辑器豁免页除外）+ lg-glass-filter 页=41',
    marks === 41 && fresh === 40 && lgfs === 41, 'marks=' + marks + ' fresh=' + fresh + ' lgf=' + lgfs);
  ok('S4 FC 编辑器页豁免血证：mark ×1 + 新轮注释零残留（页面专属 CSS 永不入内联块）',
    editorMark === 1 && editorQuote === 0, 'm=' + editorMark + ' q=' + editorQuote);
  const cp = fs.readFileSync(path.join(DOCS, 'pages/community-profile.html'), 'utf8');
  ok('S3b community-profile 内联：--sidebar-bg ×4 + 原话 ×1 + 模块规则邻接（bg 下一行 blur(20px)）',
    c(cp, 'background: var(--sidebar-bg);') === 4 && c(cp, '那个在个人主页') === 1 &&
    /background: var\(--sidebar-bg\);\r?\n\s+backdrop-filter: blur\(20px\);/.test(cp),
    'sbg=' + c(cp, 'background: var(--sidebar-bg);') + ' q=' + c(cp, '那个在个人主页'));

  // ═══ Chrome ═══
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
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SEED_SCRIPT });

    const BASE = 'http://127.0.0.1:' + PORT;

    // ═══ B 社区资料页（亮色）═══
    console.log('═══ B 社区资料页 CDP（亮色/暗色）═══');
    await cdp.send('Page.navigate', { url: BASE + '/pages/community-profile.html?id=USR-000101' });
    await waitFor(cdp, "document.querySelector('#slati-sidebar .nav-module')", 40000, '侧栏菜单卡就绪');
    await sleep(700);
    const n1 = await cdp.evalJs(NAV_STYLE);
    ok('B1 亮色 nav-module 卡面不透明（rgba(255,255,255,0.95)）+ blur(20px) 保留',
      n1 && n1.bg === 'rgba(255, 255, 255, 0.95)' && n1.bf === 'blur(20px)', JSON.stringify(n1));
    const u1 = await cdp.evalJs(USER_STYLE);
    const b1 = await cdp.evalJs(BRAND_STYLE);
    ok('B6 三张卡同规则：user-module/brand-module 同 0.95 不透明',
      u1 && u1.bg === 'rgba(255, 255, 255, 0.95)' && b1 && b1.bg === 'rgba(255, 255, 255, 0.95)',
      JSON.stringify({ u: u1, b: b1 }));
    const s1 = await cdp.evalJs(SIDEBAR_STYLE);
    ok('B3 58.1 不回归：.app-sidebar 容器仍全透明（卡下方无面板）',
      s1 === 'rgba(0, 0, 0, 0)', 'bg=' + s1);
    const g1 = await cdp.evalJs(BACKDROP_STYLE);
    ok('B4 玻璃注入层灭滤镜：.lg-backdrop filter/backdrop-filter 双 none',
      g1 && g1.f === 'none' && g1.bf === 'none', JSON.stringify(g1));
    await cdp.evalJs("document.documentElement.setAttribute('data-theme', 'dark')");
    await sleep(300);
    const n2 = await cdp.evalJs(NAV_STYLE);
    ok('B2 暗色 nav-module 卡面实心 #1a1a2e（rgb(26,26,46)）+ blur 保留',
      n2 && n2.bg === 'rgb(26, 26, 46)' && n2.bf === 'blur(20px)', JSON.stringify(n2));

    // ═══ B5 index.html（个人主页）═══
    await cdp.evalJs("document.documentElement.removeAttribute('data-theme')");
    await cdp.send('Page.navigate', { url: BASE + '/index.html' });
    await waitFor(cdp, "document.querySelector('#slati-sidebar .nav-module')", 40000, 'index 侧栏菜单卡就绪');
    await sleep(700);
    const n3 = await cdp.evalJs(NAV_STYLE);
    ok('B5 index.html（个人主页）nav-module 卡面同款 0.95 不透明',
      n3 && n3.bg === 'rgba(255, 255, 255, 0.95)', JSON.stringify(n3));

    // ═══ E 零异常 ═══
    ok('E 零异常', cdp.errs.length === 0, cdp.errs.join(' | ').slice(0, 300));
  } finally {
    if (cdp) cdp.close();
    try { chrome.kill(); } catch (e) {}
    server.close();
  }
  console.log('\n🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  process.exit(fail ? 1 : 0);
}

server.listen(PORT, '127.0.0.1', main);
