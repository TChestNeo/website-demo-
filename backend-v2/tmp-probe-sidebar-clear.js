// tmp-probe-sidebar-clear.js — v0.2.58.20 左侧菜单底部不透明背景完全删除 线上实机探针
// 用户「平台所有的左侧菜单底部不是有一个不透明背景吗能不能去掉他，我要完全的删除它」（注意我是指
//   Z轴最底部的那一个不是我的卡片）——09-10/09-18 两轮铺的侧栏整列不透明底 --sidebar-bg 整体移除：
//   侧栏列全透明（页面底色直接可见、卡下方不再有面板）、三张卡（logo/用户(访客)/菜单
//   .sidebar-module）零触碰、玻璃注入层灭滤镜灭磨砂规则保留、dropdown/全站卡片的 var 用法不动。
// S 静态（线上 site-config 58.1+changelog 新条目+rev 00336-+旧 58.0 赋值零残留+FC 47.4 恒；
//   index.html/ethereal.css 铺底规则零残留+新轮注释在位+--sidebar-bg 用法恒 2 处）、
// P 实机（游客路径：亮/暗两主题 .app-sidebar 计算背景 transparent、三张卡非透明背景在位）、E 零异常。
// 全 Node 内置模块：https + ws CDP（游客零播种——index 页 mn-guest 不重定向、访客模块渲染）。
'use strict';
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PASS = { n: 0 }, FAIL = { n: 0 };
const ok = (name, cond, detail) => {
  if (cond) { PASS.n++; console.log('  ✅ ' + name); }
  else { FAIL.n++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
};
const get = (url) => new Promise((resolve) => {
  const req = https.request(url, { headers: { 'User-Agent': 'mn-probe' }, timeout: 30000 }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 2000000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
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
        this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 300));
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
    try { if (await cdp.evalJs(expr)) return true; } catch (e) {}
    await sleep(200);
  }
  console.log('  ⏳ waitFor 超时: ' + label);
  return false;
}

(async () => {
  const BASE = 'https://mnationworld.com';

  // ── S 线上静态 ──
  const sc = await get(BASE + '/assets/js/site-config.js');
  ok('S1 线上 site-config：58.1 赋值+changelog 新条目+rev 00336-+旧 58.0 赋值零残留+FC 47.4 恒',
    sc.status === 200 &&
    sc.body.indexOf("window.MN_SITE_VERSION = 'v0.2.58.20';") !== -1 &&
    sc.body.indexOf('v0.2.58.3 = 折叠侧栏等级水位环+双层水波') !== -1 &&
    sc.body.indexOf('我要完全的删除它') !== -1 &&
    sc.body.indexOf('不是我的卡片') !== -1 &&
    sc.body.indexOf('rev 00336-') !== -1 &&
    sc.body.indexOf("window.MN_SITE_VERSION = 'v0.2.58.0';") === -1 &&
    sc.body.indexOf("'v10.28.48.0'") !== -1,
    'status=' + sc.status + ' err=' + sc.error);
  const ix = await get(BASE + '/');
  ok('S2 线上 index.html：内联块已刷新（新轮注释）+铺底规则零残留',
    ix.status === 200 &&
    ix.body.indexOf('我要完全的删除它') !== -1 &&
    ix.body.indexOf(':root[data-theme="dark"] .app-sidebar {') === -1 &&
    ix.body.indexOf(':root:not([data-theme="dark"]) .app-sidebar {') === -1,
    'status=' + ix.status + ' err=' + ix.error);
  const ec = await get(BASE + '/assets/css/ethereal.css');
  const sbgCount = ec.body.split('background: var(--sidebar-bg);').length - 1;
  ok('S3 线上 ethereal.css：铺底规则零残留+灭滤镜规则在位+--sidebar-bg 用法恒 2 处',
    ec.status === 200 &&
    ec.body.indexOf(':root[data-theme="dark"] .app-sidebar {') === -1 &&
    ec.body.indexOf(':root:not([data-theme="dark"]) .app-sidebar {') === -1 &&
    ec.body.indexOf(':root[data-theme="dark"] .app-sidebar .lg-backdrop {') !== -1 &&
    ec.body.indexOf(':root:not([data-theme="dark"]) .app-sidebar .lg-backdrop {') !== -1 &&
    sbgCount === 2,
    'status=' + ec.status + ' sbg=' + sbgCount + ' err=' + ec.error);

  // ── P 实机（游客路径）──
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const CDP_PORT = 9600 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-sbclear-' + Date.now());
  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    ok('P0 Chrome CDP 就绪', up, 'port=' + CDP_PORT);
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    // 只挑真标签页（pages[0] 可能是扩展后台页——本机 Chrome 会随 headless 加载扩展）
    const tab = pages.find(p => p.type === 'page') || pages[0];
    const cdp = new CDP(tab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: BASE + '/' });
    let sidebarOk = await waitFor(cdp, 'document.querySelector(".app-sidebar") !== null', 15000, 'sidebar 渲染');
    let cardsOk = sidebarOk && await waitFor(cdp, 'document.querySelectorAll(".sidebar-module").length >= 2', 15000, '三张卡渲染');
    if (!sidebarOk || !cardsOk) {
      // 新 revision 冷启动首访竞态：诊断 + 单次 reload 重试
      try {
        const diag = await cdp.evalJs(`JSON.stringify({
          href: location.href, ready: document.readyState, title: document.title,
          cls: document.documentElement.className,
          bodyLen: document.body ? document.body.innerHTML.length : -1,
          text: document.body ? document.body.innerText.slice(0, 200) : ''
        })`);
        console.log('  诊断: ' + diag);
      } catch (e) { console.log('  诊断失败: ' + e.message); }
      await cdp.send('Page.reload');
      sidebarOk = await waitFor(cdp, 'document.querySelector(".app-sidebar") !== null', 20000, 'reload 后 sidebar 渲染');
      cardsOk = sidebarOk && await waitFor(cdp, 'document.querySelectorAll(".sidebar-module").length >= 2', 20000, 'reload 后三张卡渲染');
    }
    await sleep(500);
    if (!sidebarOk || !cardsOk) {
      ok('P1 亮色主题：侧栏列背景透明（rgba(0,0,0,0)）', false, 'sidebar 未渲染');
      ok('P2 亮色主题：三张卡在位且卡背景非透明（零触碰）', false, 'sidebar 未渲染');
      ok('P3 暗色主题：侧栏列背景透明（rgba(0,0,0,0)）', false, 'sidebar 未渲染');
      ok('P4 暗色主题：卡背景非透明（零触碰）', false, 'sidebar 未渲染');
      ok('E1 全程零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 3).join(' | '));
      ok('E2 零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 3).join(' | '));
      cdp.close();
      console.log('\nsidebar-clear 探针：' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌');
      process.exit(FAIL.n ? 1 : 0);
    }
    const light = await cdp.evalJs(`(() => {
      const sb = document.querySelector('.app-sidebar');
      const mods = Array.from(document.querySelectorAll('.sidebar-module'));
      return JSON.stringify({
        bg: getComputedStyle(sb).backgroundColor,
        modCount: mods.length,
        modBgs: mods.map(m => getComputedStyle(m).backgroundColor),
        brand: !!document.querySelector('.brand-module'),
        nav: !!document.querySelector('.nav-module'),
        guestOrUser: !!document.querySelector('.guest-module, .user-module')
      });
    })()`);
    const L = JSON.parse(light);
    ok('P1 亮色主题：侧栏列背景透明（rgba(0,0,0,0)）', L.bg === 'rgba(0, 0, 0, 0)', 'bg=' + L.bg);
    ok('P2 亮色主题：三张卡在位且卡背景非透明（零触碰）',
      L.brand && L.nav && L.guestOrUser && L.modCount >= 2 &&
      L.modBgs.every(b => b !== 'rgba(0, 0, 0, 0)'),
      'mods=' + L.modCount + ' bgs=' + L.modBgs.join(','));

    await cdp.evalJs(`document.documentElement.setAttribute('data-theme', 'dark')`);
    await sleep(400);
    const dark = await cdp.evalJs(`(() => {
      const sb = document.querySelector('.app-sidebar');
      const mods = Array.from(document.querySelectorAll('.sidebar-module'));
      return JSON.stringify({
        bg: getComputedStyle(sb).backgroundColor,
        modCount: mods.length,
        modBgs: mods.map(m => getComputedStyle(m).backgroundColor)
      });
    })()`);
    const D = JSON.parse(dark);
    ok('P3 暗色主题：侧栏列背景透明（rgba(0,0,0,0)）', D.bg === 'rgba(0, 0, 0, 0)', 'bg=' + D.bg);
    ok('P4 暗色主题：卡背景非透明（零触碰）',
      D.modCount >= 2 && D.modBgs.every(b => b !== 'rgba(0, 0, 0, 0)'),
      'mods=' + D.modCount + ' bgs=' + D.modBgs.join(','));

    await cdp.evalJs(`document.documentElement.removeAttribute('data-theme')`);
    await sleep(300);

    ok('E1 全程零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 3).join(' | '));
    ok('E2 零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 3).join(' | '));
    cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
  }

  console.log('\nsidebar-clear 探针：' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌');
  process.exit(FAIL.n ? 1 : 0);
})().catch((e) => { console.error('探针崩溃：' + (e && e.stack || e)); process.exit(1); });
