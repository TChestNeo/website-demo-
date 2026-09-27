// tmp-probe-605-lvpill.js — v0.2.58.13 折叠侧栏等级纵向药丸+经验环 线上实机探针
// 用户「然后是平台的左侧菜单折叠起来的时候那个显示的等级我希望折叠起来是变成一个纵向的药丸形然后
//   那个显示经验的条把药丸围起来这样 然后药丸中间显示等级就就可以了，还有现在这个显示等级的在折叠的
//   情况下它挤压到了用户头像」。S 静态（线上 site-config 58.2+changelog+rev 00321-+旧 58.1 赋值零残留
//   +FC 47.4 恒；ethereal.css/index.html 药丸规则在位）；P 实机（demo 用户种子——id 无 USR- 前缀 →
//   hasCloudUser false 零 API 调用，杜绝服务端 401 清会话；每日登录日期键预写今天 → +5 不触发；
//   展开药丸隐藏/折叠药丸上阵/几何零挤压/满级环 100%/窄列零溢出）；E 零异常。
// 收尾：清种子键零污染（一次性 profile 双保险）。全 Node 内置模块：https + ws CDP。
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
    const chunks = [];
    let len = 0;
    res.on('data', (c) => { chunks.push(c); len += c.length; if (len > 2000000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
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
  ok('S1 线上 site-config：58.2 赋值+changelog 标题/用户原话+rev 00321-+旧 58.1 赋值零残留+FC 47.4 恒',
    sc.status === 200 &&
    sc.body.indexOf("window.MN_SITE_VERSION = 'v0.2.58.13';") !== -1 &&
    sc.body.indexOf('v0.2.58.3 = 折叠侧栏等级水位环+双层水波') !== -1 &&
    sc.body.indexOf('变成一个纵向的药丸形') !== -1 &&
    sc.body.indexOf('挤压到了') !== -1 &&
    sc.body.indexOf('rev 00321-') !== -1 &&
    sc.body.indexOf("window.MN_SITE_VERSION = 'v0.2.58.1';") === -1 &&
    sc.body.indexOf("'v10.28.47.4'") !== -1,
    'status=' + sc.status + ' err=' + sc.error);
  const ec = await get(BASE + '/assets/css/ethereal.css');
  ok('S2 线上 ethereal.css：药丸规则在位（默认隐藏+折叠切换+28×48+动画×2+锚内 margin 归零+新轮注释）',
    ec.status === 200 &&
    ec.body.indexOf('.mn-lv-badge .mn-lv-pill { display: none; }') !== -1 &&
    ec.body.indexOf('.app-sidebar.collapsed .mn-lv-badge .mn-lv-normal { display: none; }') !== -1 &&
    ec.body.indexOf('width: 28px; height: 48px; padding: 3px; border-radius: 999px;') !== -1 &&
    ec.body.split('mn-lv-pill-in').length - 1 === 2 &&
    ec.body.indexOf('.app-sidebar.collapsed .user-info-bar > a:first-child > div:first-child {') !== -1 &&
    ec.body.indexOf('挤压到了') !== -1,
    'status=' + ec.status + ' err=' + ec.error);
  const ix = await get(BASE + '/');
  ok('S3 线上 index.html：内联块药丸规则同步在位',
    ix.status === 200 &&
    ix.body.indexOf('.mn-lv-badge .mn-lv-pill { display: none; }') !== -1 &&
    ix.body.split('mn-lv-pill-in').length - 1 === 2,
    'status=' + ix.status + ' err=' + ix.error);

  // ── P 实机（demo 用户种子——零 API 调用零 401）──
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const CDP_PORT = 9600 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-lvpill-' + Date.now());
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
    // 只挑真标签页（pages[0] 可能是扩展后台页）
    const tab = pages.find(p => p.type === 'page') || pages[0];
    const cdp = new CDP(tab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: BASE + '/' });
    let sbOk = await waitFor(cdp, 'document.querySelector(".app-sidebar") !== null', 15000, 'sidebar 渲染');
    if (!sbOk) {
      await cdp.send('Page.reload');
      sbOk = await waitFor(cdp, 'document.querySelector(".app-sidebar") !== null', 20000, 'reload 后 sidebar 渲染');
    }
    if (!sbOk) {
      ok('P1 折叠药丸上阵（环+LV+数字）', false, 'sidebar 未渲染');
      ok('P2 药丸几何零挤压', false, 'sidebar 未渲染');
      ok('P3 满级环 100%', false, 'sidebar 未渲染');
      ok('P4 窄列 floating 零溢出', false, 'sidebar 未渲染');
      ok('E1 全程零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 3).join(' | '));
      ok('E2 零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 3).join(' | '));
      cdp.close();
      console.log('\nlvpill 探针：' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌');
      process.exit(FAIL.n ? 1 : 0);
    }
    // 种子（两段式——日期键交给页面自己写，杜绝 storage.get() 语义差异漏挡每日 +5）：
    // ①demo 用户（无 USR- → hasCloudUser false 零 API）+ 清 XP 键 → 重载（页面发 +5 并自写日期键）
    // ②覆写 xp=100 → 再重载（页面自写键命中 → +5 跳过 → XP 恒 100 → 环 8%）
    await cdp.evalJs(`(function(){
      localStorage.setItem('slati_session', JSON.stringify({loggedIn:true}));
      localStorage.setItem('slati_user', JSON.stringify({id:'demo-probe-605', displayName:'Pill Probe', citizenId:'CIT-P605'}));
      ['slati_xp','slati_xp_last_login','slati_xp_gained'].forEach(function(k){ localStorage.removeItem(k); });
      localStorage.setItem('slati_sidebar_collapsed', '0');
    })()`);
    await cdp.send('Page.reload');
    await waitFor(cdp, 'document.querySelector("#slati-sidebar .mn-lv-badge") !== null', 20000, '徽章渲染（页面发 +5）');
    await cdp.evalJs(`localStorage.setItem('slati_xp', '100')`);
    await cdp.send('Page.reload');
    await waitFor(cdp, 'document.querySelector("#slati-sidebar .mn-lv-badge") !== null', 20000, '徽章渲染（XP=100 恒）');
    await sleep(800);

    // P1 折叠切换：药丸上阵
    const pillBefore = await cdp.evalJs(`(function(){
      var b = document.querySelector('#slati-sidebar .mn-lv-badge');
      if (!b) return JSON.stringify({absent:true});
      var n = b.querySelector('.mn-lv-normal'), p = b.querySelector('.mn-lv-pill');
      return JSON.stringify({nDisplay: getComputedStyle(n).display, pDisplay: getComputedStyle(p).display});
    })()`);
    await cdp.evalJs(`window._slatiToggleSidebar()`);
    await sleep(500);
    const pillAfter = await cdp.evalJs(`(function(){
      var b = document.querySelector('#slati-sidebar .mn-lv-badge');
      var ring = b.querySelector('.mn-lv-ring'), num = b.querySelector('.mn-lv-pill-num'), tag = b.querySelector('.mn-lv-pill-tag');
      var n = b.querySelector('.mn-lv-normal'), p = b.querySelector('.mn-lv-pill');
      return JSON.stringify({nDisplay: getComputedStyle(n).display, pDisplay: getComputedStyle(p).display,
        ringStyle: ring.getAttribute('style'), num: num.textContent, tag: tag.textContent,
        collapsed: document.querySelector('#slati-sidebar').classList.contains('collapsed')});
    })()`);
    const before = JSON.parse(pillBefore), after = JSON.parse(pillAfter);
    ok('P1 折叠药丸上阵：展开药丸隐藏 → 折叠 normal 隐藏+药丸 flex+环 conic 8%+中间 LV/1+collapsed 在位',
      before.nDisplay !== 'none' && before.pDisplay === 'none' &&
      after.nDisplay === 'none' && after.pDisplay === 'flex' &&
      after.ringStyle.indexOf('conic-gradient(var(--color-primary) 8%') !== -1 &&
      after.num === '1' && after.tag === 'LV' && after.collapsed === true,
      'before=' + pillBefore + ' after=' + pillAfter);

    // P2 几何零挤压
    const geo = await cdp.evalJs(`(function(){
      var ring = document.querySelector('#slati-sidebar .mn-lv-ring');
      var av = document.querySelector('#slati-sidebar .user-info-bar .avatar');
      var mod = document.querySelector('#slati-sidebar .user-module');
      var r = ring.getBoundingClientRect(), a = av.getBoundingClientRect(), m = mod.getBoundingClientRect();
      var overlap = !(r.right <= a.left || r.left >= a.right || r.bottom <= a.top || r.top >= a.bottom);
      return JSON.stringify({rw: Math.round(r.width), rh: Math.round(r.height), aw: Math.round(a.width), ah: Math.round(a.height),
        gap: Math.round((r.top - a.bottom) * 10) / 10, inMod: r.left >= m.left && r.right <= m.right, overlap: overlap});
    })()`);
    const G = JSON.parse(geo);
    ok('P2 药丸几何：环 28×48 + 头像 32×32 不挤压 + 间距 8px + 模块内零溢出 + 零重叠',
      G.rw === 28 && G.rh === 48 && G.aw === 32 && G.ah === 32 &&
      G.gap >= 7 && G.gap <= 9 && G.inMod === true && G.overlap === false, geo);

    // P3 满级环 100%
    await cdp.evalJs(`localStorage.setItem('slati_xp', '1228800')`);
    await cdp.send('Page.reload');
    await waitFor(cdp, 'document.querySelector("#slati-sidebar .mn-lv-ring") !== null', 20000, '满级重载');
    await sleep(800);
    const max = await cdp.evalJs(`(function(){
      var b = document.querySelector('#slati-sidebar .mn-lv-badge');
      var ring = b.querySelector('.mn-lv-ring'), num = b.querySelector('.mn-lv-pill-num');
      return JSON.stringify({ringStyle: ring.getAttribute('style'), num: num.textContent,
        txt: b.textContent, collapsed: document.querySelector('#slati-sidebar').classList.contains('collapsed')});
    })()`);
    const M = JSON.parse(max);
    ok('P3 满级 Lv12：环 100% + 中间 12 + 折叠偏好重载保持',
      M.ringStyle.indexOf('conic-gradient(var(--color-primary) 100%') !== -1 &&
      M.num === '12' && M.txt.indexOf('Lv.12 · 传奇') !== -1 && M.collapsed === true, max);

    // P4 窄列 floating 零溢出
    await cdp.evalJs(`document.querySelector('#slati-sidebar').classList.add('floating')`);
    await sleep(400);
    const floatGeo = await cdp.evalJs(`(function(){
      var ring = document.querySelector('#slati-sidebar .mn-lv-ring');
      var mod = document.querySelector('#slati-sidebar .user-module');
      var r = ring.getBoundingClientRect(), m = mod.getBoundingClientRect();
      return JSON.stringify({rw: Math.round(r.width), rh: Math.round(r.height), inMod: r.left >= m.left && r.right <= m.right});
    })()`);
    const F = JSON.parse(floatGeo);
    ok('P4 窄列 floating（64px）：药丸 28×48 仍在模块内零溢出', F.rw === 28 && F.rh === 48 && F.inMod === true, floatGeo);

    // 收尾：清种子键零污染（一次性 profile 双保险）
    await cdp.evalJs(`(function(){ ['slati_session','slati_user','slati_xp','slati_xp_last_login','slati_xp_gained','slati_sidebar_collapsed'].forEach(function(k){ localStorage.removeItem(k); }); })()`);

    ok('E1 全程零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 3).join(' | '));
    ok('E2 零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 3).join(' | '));
    cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
  }

  console.log('\nlvpill 探针：' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌');
  process.exit(FAIL.n ? 1 : 0);
})().catch((e) => { console.error('探针崩溃：' + (e && e.stack || e)); process.exit(1); });
