// tmp-battery-605-lvpill.js — v0.2.58.2 折叠侧栏等级纵向药丸+经验环电池
//   用户「然后是平台的左侧菜单折叠起来的时候那个显示的等级我希望折叠起来是变成一个纵向的药丸形然后
//   那个显示经验的条把药丸围起来这样 然后药丸中间显示等级就就可以了，还有现在这个显示等级的在折叠的
//   情况下它挤压到了用户头像」：折叠态等级徽章改纵向药丸（.mn-lv-pill 28×48 固定，外环 conic-gradient
//   XP 进度环形包裹药丸，药丸中间只显示等级 LV+数字）；展开态 .mn-lv-normal 原徽章原样零变化。
// F 静态：site-config 58.2+changelog+rev 00305-、sidebar.js 双视图结构、ethereal.css 药丸规则+内联块同步；
// S 浏览器：展开零变化/折叠切换/药丸几何零挤压/XP 环进度刷新/满级/窄列 floating/展开恢复；E 零异常。
// /api 全 404（demo 模式，同 xp-rebalance 口径）；会话+XP 本地种子。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-lvpill-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url);
  const p = url.split('?')[0];
  if (p.indexOf('/api/') === 0) {
    const b = JSON.stringify({ error: { code: 'NOT_FOUND', message: 'offline' } });
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(b) });
    res.end(b);
    return;
  }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => { if (e2) { res.writeHead(404); res.end(); return; } res.writeHead(200); res.end(b2); });
      return;
    }
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
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
        const d = m.exceptionDetails || {};
        this.errs.push('EXC ' + JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 300));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
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
  let lastErr = '';
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; }
    catch (e) { lastErr = String(e.message || e).slice(0, 160); }
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label + (lastErr ? '（最后 eval 错误: ' + lastErr + '）' : ''));
}

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}
const cnt = (s, sub) => s.split(sub).length - 1;

(async () => {
  // ═══ F 静态检查 ═══
  const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  const sidebarSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'sidebar.js'), 'utf8');
  const etherealSrc = fs.readFileSync(path.join(DOCS, 'assets', 'css', 'ethereal.css'), 'utf8');
  const indexSrc = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
  const editorSrc = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');

  ok('F1 静态：58.2 赋值 + FC 恒 47.4 + changelog 用户原话三段 + rev 00305- + 58.1 赋值零残留 + 58.1 历史条目标题保留',
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.58.2';") !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") !== -1 &&
    sconfSrc.indexOf('变成一个纵向的药丸形') !== -1 &&
    sconfSrc.indexOf('药丸中间显示等级') !== -1 &&
    sconfSrc.indexOf('挤压到了') !== -1 &&
    sconfSrc.indexOf('rev 00305-') !== -1 &&
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.58.1';") === -1 &&
    sconfSrc.indexOf('v0.2.58.1 = 左侧菜单底部不透明背景完全删除') !== -1);

  ok('F2 静态：sidebar.js 双视图结构（normal 包原徽章字节原样 + pill 四件套 + conic-gradient + ringPct）',
    cnt(sidebarSrc, "class=\"mn-lv-normal\"") === 1 &&
    cnt(sidebarSrc, "class=\"mn-lv-pill\"") === 1 &&
    cnt(sidebarSrc, "class=\"mn-lv-ring\"") === 1 &&
    cnt(sidebarSrc, "class=\"mn-lv-pill-core\"") === 1 &&
    cnt(sidebarSrc, "class=\"mn-lv-pill-tag\"") === 1 &&
    cnt(sidebarSrc, "class=\"mn-lv-pill-num\"") === 1 &&
    cnt(sidebarSrc, 'conic-gradient(var(--color-primary) \' + ringPct + \'%, rgba(128,128,140,0.25) 0)') === 1 &&
    sidebarSrc.indexOf('var ringPct = Math.round(st.progress * 100);') !== -1 &&
    sidebarSrc.indexOf('display:flex;align-items:center;justify-content:space-between;margin-bottom:4px') !== -1 &&
    sidebarSrc.indexOf('height:5px;border-radius:999px;background:rgba(128,128,140,0.25)') !== -1);

  ok('F3 静态：ethereal.css 药丸规则在位（默认隐藏/折叠三规则+keyframes+28×48+margin-top 0 !important）+ index 内联块同款同步',
    etherealSrc.indexOf('.mn-lv-badge .mn-lv-pill { display: none; }') !== -1 &&
    etherealSrc.indexOf('.app-sidebar.collapsed .mn-lv-badge { margin-top: 0 !important; }') !== -1 &&
    etherealSrc.indexOf('.app-sidebar.collapsed .mn-lv-badge .mn-lv-normal { display: none; }') !== -1 &&
    etherealSrc.indexOf('animation: mn-lv-pill-in 0.3s ease;') !== -1 &&
    etherealSrc.indexOf('@keyframes mn-lv-pill-in') !== -1 &&
    etherealSrc.indexOf('width: 28px; height: 48px; padding: 3px; border-radius: 999px;') !== -1 &&
    cnt(indexSrc, '.mn-lv-badge .mn-lv-pill { display: none; }') === 1 &&
    cnt(indexSrc, 'mn-lv-pill-in') === 2 &&
    cnt(editorSrc, 'mn-lv-pill-in') === 2,
    'index-pill=' + cnt(indexSrc, 'mn-lv-pill-in') + ' editor-pill=' + cnt(editorSrc, 'mn-lv-pill-in'));

  // ═══ 浏览器场景 ═══
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
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
    const page = pages.find(x => x.type === 'page') || pages[0];
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    await cdp.send('Page.bringToFront');

    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const setLS = async (pairs) => {
      await nav(BASE + '/index.html', "document.readyState === 'complete'", 'LS setup');
      const body = pairs.map(p => p.remove
        ? "localStorage.removeItem('" + p.k + "')"
        : "localStorage.setItem('" + p.k + "', " + JSON.stringify(p.v) + ")").join(';');
      const r = await cdp.evalJs("(function(){ try { " + body + "; return 'ok'; } catch(e){ return 'ERR ' + e.message; } })()");
      if (r !== 'ok') throw new Error('setLS 失败: ' + r);
    };
    const pillNow = () => cdp.evalJs("(function(){ var b = document.querySelector('#slati-sidebar .mn-lv-badge'); " +
      "if (!b) return JSON.stringify({ absent: true }); " +
      "var n = b.querySelector('.mn-lv-normal'); var p = b.querySelector('.mn-lv-pill'); " +
      "var ring = b.querySelector('.mn-lv-ring'); var num = b.querySelector('.mn-lv-pill-num'); " +
      "var tag = b.querySelector('.mn-lv-pill-tag'); " +
      "return JSON.stringify({ txt: b.textContent, nDisplay: n ? getComputedStyle(n).display : null, " +
      "pDisplay: p ? getComputedStyle(p).display : null, ringStyle: ring ? ring.getAttribute('style') : null, " +
      "num: num ? num.textContent : null, tag: tag ? tag.textContent : null, " +
      "barKids: n ? n.children.length : -1, xp: JSON.parse(localStorage.getItem('slati_xp') || '0') }); })()");
    const geoNow = () => cdp.evalJs("(function(){ var ring = document.querySelector('#slati-sidebar .mn-lv-ring'); " +
      "var av = document.querySelector('#slati-sidebar .user-info-bar .avatar'); " +
      "var mod = document.querySelector('#slati-sidebar .user-module'); var bd = document.querySelector('#slati-sidebar .mn-lv-badge'); " +
      "if (!ring || !av || !mod || !bd) return JSON.stringify({ absent: true }); " +
      "var r = ring.getBoundingClientRect(), a = av.getBoundingClientRect(), m = mod.getBoundingClientRect(), g = bd.getBoundingClientRect(); " +
      "var overlap = !(r.right <= a.left || r.left >= a.right || r.bottom <= a.top || r.top >= a.bottom); " +
      "return JSON.stringify({ rw: Math.round(r.width), rh: Math.round(r.height), aw: Math.round(a.width), ah: Math.round(a.height), " +
      "gap: Math.round((r.top - a.bottom) * 10) / 10, inMod: r.left >= m.left && r.right <= m.right, " +
      "overlap: overlap, badgeMarginTop: getComputedStyle(bd).marginTop }); })()");

    // ── 种子：先让页面写下每日登录日期键（+5），再固定 XP=100 ──
    await setLS([
      { k: 'slati_session', v: JSON.stringify({ loggedIn: true }) },
      { k: 'slati_user', v: JSON.stringify({ id: 'USR-batt-605', displayName: 'Pill Tester', citizenId: 'CIT-605', tier: 'free' }) },
      { k: 'slati_xp', v: '0' },
      { k: 'slati_xp_gained', remove: true },
      { k: 'slati_xp_last_login', remove: true },
      { k: 'slati_sidebar_collapsed', remove: true },
    ]);
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .mn-lv-badge')", '首页徽章就绪(种子)');
    await cdp.evalJs("localStorage.setItem('slati_xp', '100')");
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .mn-lv-badge')", '首页徽章就绪(S1)');
    let r = await pillNow();
    const s1 = JSON.parse(r);
    ok('S1 展开态零变化：原徽章可见（Lv.1·旅行者 100/1200 + 8% 条）+ 药丸默认隐藏 + 头像 40×40',
      s1.txt.indexOf('Lv.1 · 旅行者') !== -1 && s1.txt.indexOf('100 / 1200 XP') !== -1 &&
      s1.nDisplay !== 'none' && s1.pDisplay === 'none' && s1.barKids === 2 && s1.xp === 100, r);
    let g = await geoNow();
    const g1 = JSON.parse(g);
    ok('S1b 展开态头像 40×40（折叠前基准）', g1.aw === 40 && g1.ah === 40 && g1.badgeMarginTop === '8px', g);

    // ── S2 折叠切换 ──
    await cdp.evalJs("window._slatiToggleSidebar()");
    await sleep(500);
    r = await pillNow();
    const s2 = JSON.parse(r);
    ok('S2 折叠切换：normal 隐藏 + 药丸 display:flex + 环内联 conic-gradient 8% + 中间 LV/1',
      s2.nDisplay === 'none' && s2.pDisplay === 'flex' &&
      s2.ringStyle !== null && s2.ringStyle.indexOf('conic-gradient(var(--color-primary) 8%') !== -1 &&
      s2.num === '1' && s2.tag === 'LV', r);
    const clsOk = await cdp.evalJs("document.querySelector('#slati-sidebar').classList.contains('collapsed')");
    ok('S2b .app-sidebar.collapsed 类在位', clsOk === true);

    // ── S3 药丸几何零挤压 ──
    g = await geoNow();
    const g2 = JSON.parse(g);
    ok('S3 药丸几何：环 28×48 + 头像 32×32 不挤压 + 上下间距 8px（margin-top 0 生效）+ 药丸在模块内零溢出 + 零重叠',
      g2.rw === 28 && g2.rh === 48 && g2.aw === 32 && g2.ah === 32 &&
      g2.gap >= 7 && g2.gap <= 9 && g2.inMod === true && g2.overlap === false && g2.badgeMarginTop === '0px', g);

    // ── S4 XP 环进度刷新（折叠态保持）──
    await cdp.evalJs("window.SlatiDB.addXP('batt', 600)");
    await sleep(400);
    r = await pillNow();
    const s4 = JSON.parse(r);
    ok('S4 addXP +600（100→700=58%）：徽章重渲染环 58% + 折叠态与等级保持（collapsed 不丢）',
      s4.ringStyle !== null && s4.ringStyle.indexOf('conic-gradient(var(--color-primary) 58%') !== -1 &&
      s4.num === '1' && s4.xp === 700 &&
      await cdp.evalJs("document.querySelector('#slati-sidebar').classList.contains('collapsed')") === true, r);

    // ── S5 满级 ──
    await cdp.evalJs("localStorage.setItem('slati_xp', '1228800')");
    await cdp.send('Page.reload');
    await waitFor(cdp, "!!document.querySelector('#slati-sidebar .mn-lv-badge')", 20000, '满级重载');
    await sleep(700);
    r = await pillNow();
    const s5 = JSON.parse(r);
    ok('S5 满级 Lv12·传奇：展开视图无条（kids=1）+ 环 100% + 中间 12 + 折叠偏好重载保持（collapsed 在位）',
      s5.txt.indexOf('Lv.12 · 传奇') !== -1 && s5.txt.indexOf('1228800 XP') !== -1 && s5.txt.indexOf(' / ') === -1 &&
      s5.barKids === 1 && s5.ringStyle !== null && s5.ringStyle.indexOf('conic-gradient(var(--color-primary) 100%') !== -1 &&
      s5.num === '12' &&
      await cdp.evalJs("document.querySelector('#slati-sidebar').classList.contains('collapsed')") === true, r);

    // ── S6 窄列 floating（64px 列）药丸仍收得下 ──
    await cdp.evalJs("document.querySelector('#slati-sidebar').classList.add('floating')");
    await sleep(400);
    g = await geoNow();
    const g3 = JSON.parse(g);
    ok('S6 floating 折叠 64px 列：药丸 28×48 仍在模块内零溢出 + 与头像零重叠',
      g3.rw === 28 && g3.rh === 48 && g3.inMod === true && g3.overlap === false, g);

    // ── S7 展开恢复 ──
    await cdp.evalJs("document.querySelector('#slati-sidebar').classList.remove('floating'); window._slatiToggleSidebar()");
    await sleep(500);
    r = await pillNow();
    const s7 = JSON.parse(r);
    ok('S7 展开恢复：normal 复显 + 药丸回隐藏 + margin-top 回 8px',
      s7.nDisplay !== 'none' && s7.pDisplay === 'none' && s7.txt.indexOf('Lv.12 · 传奇') !== -1 &&
      await cdp.evalJs("getComputedStyle(document.querySelector('#slati-sidebar .mn-lv-badge')).marginTop") === '8px', r);

    ok('E1 全程零 Runtime exception + 零 console error',
      cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      (cdp.errs.slice(0, 3).join(' | ') + cdp.consoleErrs.slice(0, 3).join(' | ')).slice(0, 300));
    cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
  }

  console.log('\nlvpill 电池：' + PASS + ' ✅ / ' + FAIL + ' ❌');
  process.exit(FAIL ? 1 : 0);
})().catch((e) => { console.error('电池崩溃：' + (e && e.stack || e)); process.exit(1); });
