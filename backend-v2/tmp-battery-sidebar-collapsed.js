// tmp-battery-sidebar-collapsed.js — v0.2.58.28 折叠侧栏用户卡不透明补丁电池（641 轮主电池）
//   S 静态（零浏览器）：
//     S1 site-config：58.28 赋值 ×1/58.27 赋值零残留/FC 52.1 ×1 + changelog 头 58.28 在 58.27 在 58.26 前 +
//       新轮原话 ×1 + rev 00367-4wl/00368-gmw 各 ×1（641 终态填真值口径——占位锚陈旧教训同 sidebar-opaque）；
//     S2 ethereal.css：折叠态覆盖规则（选择器 ×2：分组规则+修法规则）邻接 --sidebar-bg+blur(20px) +
//       -webkit-backdrop-filter 在位 + 新轮注释原话 ×1 + --sidebar-bg 恒 4 处 + --card-bg 恒 3 处（通用玻璃类零泄漏）；
//     S3 内联页：community-profile/index 含折叠覆盖（选择器 ×2+注释原话 ×1）+ 邻接 sbg/blur +
//       刷新统计 mark 页=41 且新轮注释页=40 + FC 编辑器页豁免（mark ×1+新轮注释零残留——页面专属 CSS 永不入内联块）；
//   B CDP（community-profile.html + index.html；localStorage 种子登录态）：
//     B1 展开态基准：user-module computed 0.95 不透明 + blur(20px)（58.27 基态不回归）；
//     B2 点 #collapseBtn 折叠：容器 .collapsed 加类 + user-module 仍 0.95 不透明 + blur(20px)（本补丁实证）；
//     B3 折叠态 58.1 不回归：.app-sidebar 容器仍全透明 rgba(0,0,0,0)；
//     B4 暗色折叠：data-theme=dark → user-module 实心 rgb(26,26,46)；
//     B5 再点按钮展开回来：user-module 仍 0.95（双向往返零回归）；
//     B6 index.html 折叠态（localStorage 预折叠流）：user-module 同款 0.95 不透明；
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
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-sbcollapsed-' + Date.now());

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

const USER_STYLE = "(function(){ var el = document.querySelector('#slati-sidebar .user-module'); " +
  " if (!el) return null; var s = getComputedStyle(el); " +
  " return { bg: s.backgroundColor, bf: s.backdropFilter }; })()";
const SIDEBAR_STYLE = "(function(){ var el = document.querySelector('#slati-sidebar'); " +
  " if (!el) return null; return getComputedStyle(el).backgroundColor; })()";
const COLLAPSED_STATE = "(function(){ var el = document.getElementById('slati-sidebar'); " +
  " return el ? el.classList.contains('collapsed') : null; })()";
const CLICK_COLLAPSE = "(function(){ var b = document.getElementById('collapseBtn'); " +
  " if (!b) return false; b.click(); return true; })()";

async function main() {
  // ═══ S 静态 ═══
  console.log('═══ S 静态（零浏览器）═══');
  const sc = fs.readFileSync(path.join(DOCS, 'assets/js/site-config.js'), 'utf8');
  ok('S1a site-config：58.28 赋值 ×1 + 58.27 赋值零残留 + FC 52.1 ×1',
    c(sc, "window.MN_SITE_VERSION = 'v0.2.58.28';") === 1 && c(sc, "window.MN_SITE_VERSION = 'v0.2.58.27';") === 0 &&
    c(sc, "window.FLUIDCANVAS_VERSION = 'v10.28.53.0';") === 1,
    '28=' + c(sc, "window.MN_SITE_VERSION = 'v0.2.58.28';") + ' 27=' + c(sc, "window.MN_SITE_VERSION = 'v0.2.58.27';") +
    ' fc=' + c(sc, "window.FLUIDCANVAS_VERSION = 'v10.28.53.0';"));
  ok('S1b site-config：changelog 头 58.28 在 58.27 在 58.26 前 + 新轮原话 ×1 + rev 00367-4wl/00368-gmw 各 ×1（641 终态填真值口径）',
    sc.indexOf('// v0.2.58.28 = ') !== -1 &&
    sc.indexOf('// v0.2.58.28 = ') < sc.indexOf('// v0.2.58.27 = ') &&
    sc.indexOf('// v0.2.58.27 = ') < sc.indexOf('// v0.2.58.26 = ') &&
    c(sc, '折叠起来的时候还是一样是半透明的') === 1 && c(sc, 'rev 00367-4wl') === 1 && c(sc, '00368-gmw') === 1,
    'h28=' + sc.indexOf('// v0.2.58.28 = ') + ' h27=' + sc.indexOf('// v0.2.58.27 = ') + ' h26=' + sc.indexOf('// v0.2.58.26 = ') +
    ' q=' + c(sc, '折叠起来的时候还是一样是半透明的') + ' r=' + c(sc, 'rev 00367-4wl') + '/' + c(sc, '00368-gmw'));
  const css = fs.readFileSync(path.join(DOCS, 'assets/css/ethereal.css'), 'utf8');
  ok('S2a ethereal.css：折叠态覆盖规则（选择器 ×2：分组规则+修法规则）邻接 --sidebar-bg+blur(20px) + -webkit 前缀在位 + 新轮注释原话 ×1',
    c(css, '.app-sidebar.collapsed .user-module') === 2 &&
    /background: var\(--sidebar-bg\);\r?\n\s+backdrop-filter: blur\(20px\);/.test(css) &&
    css.indexOf('-webkit-backdrop-filter: blur(20px);') !== -1 &&
    c(css, '折叠起来的时候还是一样是半透明的') === 1,
    'sel=' + c(css, '.app-sidebar.collapsed .user-module') + ' q=' + c(css, '折叠起来的时候还是一样是半透明的'));
  ok('S2b ethereal.css：--sidebar-bg 恒 4 处 + --card-bg 恒 3 处（通用玻璃类零泄漏）',
    c(css, 'background: var(--sidebar-bg);') === 4 && c(css, 'background: var(--card-bg);') === 3,
    'sbg=' + c(css, 'background: var(--sidebar-bg);') + ' cardbg=' + c(css, 'background: var(--card-bg);'));
  const mark = '/* ethereal.css 内联（切页闪修复 08-28：样式与 HTML 同包到达——浏览器画第一帧不再等样式表往返）*/';
  const files = [];
  (function walk(d, b) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name), b + e.name + '/');
      else if (e.name.endsWith('.html')) files.push(b + e.name);
    }
  })(DOCS, '');
  let marks = 0, fresh = 0, editorMark = 0, editorQuote = 0;
  for (const f of files) {
    const h = fs.readFileSync(path.join(DOCS, f), 'utf8');
    if (h.indexOf(mark) !== -1) {
      marks++;
      if (h.indexOf('折叠起来的时候还是一样是半透明的') !== -1) fresh++;
      if (f === 'pages/fluidcanvas-editor.html') editorMark++;
    }
  }
  const ed = fs.readFileSync(path.join(DOCS, 'pages/fluidcanvas-editor.html'), 'utf8');
  editorQuote = c(ed, '折叠起来的时候还是一样是半透明的');
  ok('S3a 内联刷新：CSS_MARK 页=41 且新轮注释页=40（编辑器豁免页除外）',
    marks === 41 && fresh === 40, 'marks=' + marks + ' fresh=' + fresh);
  ok('S3b FC 编辑器页豁免血证：mark ×1 + 新轮注释零残留（页面专属 CSS 永不入内联块）',
    editorMark === 1 && editorQuote === 0, 'm=' + editorMark + ' q=' + editorQuote);
  const cp = fs.readFileSync(path.join(DOCS, 'pages/community-profile.html'), 'utf8');
  const idx = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
  ok('S3c community-profile + index 内联：折叠覆盖（选择器 ×2 + 注释原话 ×1）+ 邻接 sbg/blur',
    c(cp, '.app-sidebar.collapsed .user-module') === 2 && c(cp, '折叠起来的时候还是一样是半透明的') === 1 &&
    /background: var\(--sidebar-bg\);\r?\n\s+backdrop-filter: blur\(20px\);/.test(cp) &&
    c(idx, '.app-sidebar.collapsed .user-module') === 2 && c(idx, '折叠起来的时候还是一样是半透明的') === 1,
    'cp=' + c(cp, '.app-sidebar.collapsed .user-module') + '/' + c(cp, '折叠起来的时候还是一样是半透明的') +
    ' idx=' + c(idx, '.app-sidebar.collapsed .user-module') + '/' + c(idx, '折叠起来的时候还是一样是半透明的'));

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

    // ═══ B 社区资料页（亮色：展开→折叠→暗色→展开往返）═══
    console.log('═══ B 社区资料页 CDP（折叠态不透明实证）═══');
    await cdp.send('Page.navigate', { url: BASE + '/pages/community-profile.html?id=USR-000101' });
    await waitFor(cdp, "document.querySelector('#slati-sidebar .user-module')", 40000, '侧栏用户卡就绪');
    await sleep(700);
    const u0 = await cdp.evalJs(USER_STYLE);
    ok('B1 展开态基准：user-module 0.95 不透明 + blur(20px)（58.27 基态不回归）',
      u0 && u0.bg === 'rgba(255, 255, 255, 0.95)' && u0.bf === 'blur(20px)', JSON.stringify(u0));
    await cdp.evalJs(CLICK_COLLAPSE);
    await waitFor(cdp, COLLAPSED_STATE, 10000, '折叠类加类');
    await sleep(700);
    const u1 = await cdp.evalJs(USER_STYLE);
    ok('B2 折叠态补丁实证：user-module 仍 0.95 不透明 + blur(20px)（旧 --card-bg 半透明玻璃已灭）',
      u1 && u1.bg === 'rgba(255, 255, 255, 0.95)' && u1.bf === 'blur(20px)', JSON.stringify(u1));
    const s1 = await cdp.evalJs(SIDEBAR_STYLE);
    ok('B3 折叠态 58.1 不回归：.app-sidebar 容器仍全透明（卡下方无面板）',
      s1 === 'rgba(0, 0, 0, 0)', 'bg=' + s1);
    await cdp.evalJs("document.documentElement.setAttribute('data-theme', 'dark')");
    await sleep(400);
    const u2 = await cdp.evalJs(USER_STYLE);
    ok('B4 暗色折叠：user-module 实心 #1a1a2e（rgb(26,26,46)）+ blur 保留',
      u2 && u2.bg === 'rgb(26, 26, 46)' && u2.bf === 'blur(20px)', JSON.stringify(u2));
    await cdp.evalJs("document.documentElement.removeAttribute('data-theme')");
    await cdp.evalJs(CLICK_COLLAPSE);
    await waitFor(cdp, '!(' + COLLAPSED_STATE + ')', 10000, '展开类移除');
    await sleep(700);
    const u3 = await cdp.evalJs(USER_STYLE);
    ok('B5 展开往返零回归：user-module 仍 0.95 不透明',
      u3 && u3.bg === 'rgba(255, 255, 255, 0.95)', JSON.stringify(u3));

    // ═══ B6 index.html（个人主页；折叠后导航=localStorage 预折叠流）═══
    await cdp.evalJs(CLICK_COLLAPSE);
    await waitFor(cdp, COLLAPSED_STATE, 10000, '再折叠');
    await cdp.send('Page.navigate', { url: BASE + '/index.html' });
    await waitFor(cdp, "document.querySelector('#slati-sidebar .user-module')", 40000, 'index 侧栏用户卡就绪');
    await waitFor(cdp, COLLAPSED_STATE, 10000, 'index 预折叠类');
    await sleep(700);
    const u4 = await cdp.evalJs(USER_STYLE);
    ok('B6 index.html 折叠态（localStorage 预折叠流）：user-module 同款 0.95 不透明',
      u4 && u4.bg === 'rgba(255, 255, 255, 0.95)', JSON.stringify(u4));

    // ═══ E 零异常 ═══
    ok('E 零异常', cdp.errs.length === 0, cdp.errs.join(' | ').slice(0, 300));
  } catch (e) {
    console.log('  💔 ' + e.message);
    fail++;
  } finally {
    if (cdp) cdp.close();
    try { chrome.kill(); } catch (e) {}
    server.close();
  }
  console.log('\n🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(fail ? 1 : 0);
}

server.listen(PORT, '127.0.0.1', main);
