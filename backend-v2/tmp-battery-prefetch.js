// tmp-battery-prefetch.js — v0.2.58.24 悬停预加载电池（Round 43 新轮）
// 用户「为什么我在切换页面的时候会闪一下 然而我在抖音或者Youtube切换页面的时候并不会闪烁一下
//   是不是没有做预先加载？」→ 钦定 A=悬停预加载：悬停站内链接 65ms 后 <link rel="prefetch"
//   as="document"> 预下载目标页；点击导航命中预取缓存消除切页白闪。
// 验证：S0 静态锚（transitions.js 预取块件计数 + site-config 58.23/00344-/00345-/FC 48.0）；
//   S1 悬停内链 ≥65ms → 恰 1 link[rel=prefetch] href/as 精确；S2 快速扫过（<65ms 移开）零预取；
//   S3 外链/mailto/javascript 零预取；S4 #hash 零预取；S5 同页链接零预取（isSamePage 复用）；
//   S6 同链接再悬停仍恰 1（dataset 一次性守卫）；S7 预取后点击导航正常（切页动画/点击劫持零干扰）；
//   S8a Save-Data 覆盖零预取 / S8b (hover:hover) 假 false 覆盖零预取；E 全程零异常零 console error。
//   （house CDP 模式；判定看输出体 🎉/💔 行；悬停先 move(5,5) 再目标中心——58.15 教训）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-prefetch-' + Date.now());

// ── document-start 种子：只种登录态（仪表盘全件渲染；无 tier 需求） ──
const SEED = `try{(function(){
  localStorage.setItem('slati_session', '{"loggedIn":true}');
  localStorage.setItem('slati_user', JSON.stringify({ displayName: '电池用户', citizenId: 'CIT-000101' }));
  localStorage.setItem('slati_lang', 'zh-CN');
})();}catch(e){}`;

// ── 静态壳（docs/ 原样；/api 未罐头全 404） ──
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => {
        if (e2) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b2);
      });
      return;
    }
    if (err) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
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
        const d = (m.params && m.params.exceptionDetails) || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber, raw: JSON.stringify(d).slice(0, 600) }).slice(0, 1000));
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
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const cnt = (s, t) => s.split(t).length - 1;
  const get = async (p) => await (await fetch(BASE + p)).text();
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
  const connectCdp = async (port) => {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    return cdp;
  };

  try {
    // ── S0 静态锚（计数=写锚前实测口径 tmp-count-629.js） ──
    const trSrc = await get('/assets/js/transitions.js');
    const siteSrc = await get('/assets/js/site-config.js');
    ok('S0a transitions.js 预取块件：rel=prefetch ×1 + as=document ×1 + function prefetchPage ×1 + prefetchDone ×2 + clearTimeout(prefetchTimer) ×2 + prefetchTimer ×4 + (hover: hover) ×1 + saveData ×1 + ", 65)" ×1 + { once: true } ×1 + mouseover 监听 ×1 + click 劫持监听保留 ×1',
      cnt(trSrc, "l.rel = 'prefetch'") === 1 && cnt(trSrc, "l.as = 'document'") === 1 &&
      cnt(trSrc, 'function prefetchPage') === 1 && cnt(trSrc, 'prefetchDone') === 2 &&
      cnt(trSrc, 'clearTimeout(prefetchTimer)') === 2 && cnt(trSrc, 'prefetchTimer') === 4 &&
      cnt(trSrc, '(hover: hover)') === 1 && cnt(trSrc, 'saveData') === 1 &&
      cnt(trSrc, ', 65)') === 1 && cnt(trSrc, '{ once: true }') === 1 &&
      cnt(trSrc, "addEventListener('mouseover'") === 1 && cnt(trSrc, "addEventListener('click'") === 1,
      'pf=' + cnt(trSrc, "l.rel = 'prefetch'") + ' done=' + cnt(trSrc, 'prefetchDone') + ' timer=' + cnt(trSrc, 'prefetchTimer'));
    ok('S0b site-config：58.23 赋值 1 + 58.22 赋值零残留 + changelog 标题 58.23 1 + rev 00344-/00345- 各 1（占位口径）+ FC 48.0 不动',
      cnt(siteSrc, "window.MN_SITE_VERSION = 'v0.2.58.24'") === 1 && cnt(siteSrc, "window.MN_SITE_VERSION = 'v0.2.58.22'") === 0 &&
      cnt(siteSrc, '// v0.2.58.24 = ') === 1 && cnt(siteSrc, '00344-') === 1 && cnt(siteSrc, '00345-') === 1 &&
      cnt(siteSrc, "window.FLUIDCANVAS_VERSION = 'v10.28.48.0'") === 1,
      '23=' + cnt(siteSrc, "window.MN_SITE_VERSION = 'v0.2.58.24'") + ' r42=' + cnt(siteSrc, '00344-') + ' r43=' + cnt(siteSrc, '00345-'));

    const cdp = await connectCdp(CDP_PORT);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SEED });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };
    const prefetchLinks = () => cdp.evalJs("(function(){ var ls = document.head.querySelectorAll('link[rel=\"prefetch\"]'); var out = []; for (var i = 0; i < ls.length; i++) out.push({ href: ls[i].getAttribute('href'), as: ls[i].getAttribute('as') }); return out; })()");
    const hoverSelector = async (selector, dwellMs) => {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
      const r = await cdp.evalJs("(function(){ var els = document.querySelectorAll(" + JSON.stringify(selector) + "); for (var i = 0; i < els.length; i++) { var el = els[i]; var b = el.getBoundingClientRect(); if (b.width > 0 && b.height > 0) return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; } return null; })()");
      if (!r || !r.w || !r.h) throw new Error('hover 目标不可见: ' + selector);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
      if (dwellMs) await sleep(dwellMs);
      return r;
    };
    const awayPoint = () => cdp.evalJs("(function(){ for (var y = 3; y < 60; y += 11) for (var x = 3; x < 300; x += 11) { var el = document.elementFromPoint(x, y); if (!el || !el.closest('a')) return { x: x, y: y }; } return { x: 640, y: 880 }; })()");
    const moveAway = async () => { const p = await awayPoint(); await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y }); };
    const EXPLORE = 'a[href="pages/explore.html"]';

    // ── S2（先做）：快速扫过 <65ms → 零预取（timer 取消链） ──
    await nav(BASE + '/index.html', "!!document.querySelector('" + EXPLORE + "')", 'S2 主页加载');
    const s2away = await awayPoint(); // 撤离点先算好——evalJs 往返会吃掉 65ms 窗口（竞态）
    await hoverSelector(EXPLORE, 20);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: s2away.x, y: s2away.y });
    await sleep(400);
    let pf = await prefetchLinks();
    ok('S2 快速扫过（悬停 20ms 移开）：零 link[rel=prefetch]（65ms 计时器被 mouseleave 取消）', pf.length === 0, JSON.stringify(pf));

    // ── S1：悬停内链 ≥65ms → 恰 1 预取 link，href/as 精确 ──
    await hoverSelector(EXPLORE, 400);
    pf = await prefetchLinks();
    ok('S1 悬停站内链接 400ms：恰 1 link[rel=prefetch] + href="pages/explore.html" 原样 + as="document"',
      pf.length === 1 && pf[0].href === 'pages/explore.html' && pf[0].as === 'document', JSON.stringify(pf));

    // ── S3-S5：注入外链/mailto/javascript/#hash/同页 → 各悬停 200ms 零预取 ──
    await cdp.evalJs("(function(){ var h = document.createElement('div'); h.id = 'pfTestHost'; h.style.cssText = 'position:fixed;left:10px;top:70px;z-index:9999;display:flex;gap:8px'; " +
      "h.innerHTML = '<a id=\"pfExt\" href=\"https://example.com/x\">ext</a><a id=\"pfMail\" href=\"mailto:a@b.com\">mail</a><a id=\"pfJs\" href=\"javascript:void(0)\">js</a><a id=\"pfHash\" href=\"#top\">hash</a><a id=\"pfSame\" href=\"index.html\">same</a>'; document.body.appendChild(h); })()");
    await sleep(200);
    for (const id of ['pfExt', 'pfMail', 'pfJs']) { await hoverSelector('#' + id, 250); }
    pf = await prefetchLinks();
    ok('S3 外链/mailto/javascript: 悬停各 250ms → 零新增预取（仍恰 S1 的 1 条）', pf.length === 1, JSON.stringify(pf));
    await hoverSelector('#pfHash', 250);
    pf = await prefetchLinks();
    ok('S4 #hash 链接 → 零新增预取（isInternal 拦）', pf.length === 1, JSON.stringify(pf));
    await hoverSelector('#pfSame', 250);
    pf = await prefetchLinks();
    ok('S5 同页链接 index.html → 零新增预取（isSamePage 复用拦）', pf.length === 1, JSON.stringify(pf));

    // ── S6：同链接再悬停 → 仍恰 1（dataset.prefetchDone 一次性守卫） ──
    await hoverSelector(EXPLORE, 300);
    pf = await prefetchLinks();
    ok('S6 同链接再悬停 300ms → 仍恰 1（一次性守卫零重复注入）', pf.length === 1, JSON.stringify(pf));

    // ── S7：预取后点击 → 导航照常（点击劫持/切页动画零干扰） ──
    const r = await hoverSelector(EXPLORE, 0);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', buttons: 1, clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', buttons: 0, clickCount: 1 });
    await waitFor(cdp, "window.location.pathname.indexOf('explore.html') !== -1", 20000, 'S7 导航到 explore');
    await sleep(800);
    const s7 = await cdp.evalJs("(function(){ return { path: window.location.pathname, ready: document.readyState, main: !!document.querySelector('.app-main, main, .page-container') }; })()");
    ok('S7 预取后点击导航：pathname 到 /pages/explore.html + readyState complete + 主容器在位（切页动画/点击劫持零干扰）',
      s7.path === '/pages/explore.html' && s7.ready === 'complete' && s7.main, JSON.stringify(s7));

    // ── S8a：Save-Data 覆盖 → 零预取 ──
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{Object.defineProperty(Navigator.prototype, 'connection', { configurable: true, get: function(){ return { saveData: true }; } });}catch(e){}" });
    await nav(BASE + '/index.html', "!!document.querySelector('" + EXPLORE + "')", 'S8a 重载（saveData）');
    const s8aFlag = await cdp.evalJs("!!(navigator.connection && navigator.connection.saveData)");
    await hoverSelector(EXPLORE, 400);
    pf = await prefetchLinks();
    ok('S8a Save-Data 省流量模式：旗标真 + 悬停 400ms 零预取', s8aFlag === true && pf.length === 0, JSON.stringify({ flag: s8aFlag, pf: pf }));

    // ── S8b：(hover: hover) 假 false 覆盖 → 零预取 ──
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{(function(){ var mm = window.matchMedia.bind(window); window.matchMedia = function (q) { if (q === '(hover: hover)') return { matches: false, media: q, addEventListener: function(){}, removeEventListener: function(){}, addListener: function(){}, removeListener: function(){}, onchange: null, dispatchEvent: function(){ return false; } }; return mm(q); }; })();}catch(e){}" });
    await nav(BASE + '/index.html', "!!document.querySelector('" + EXPLORE + "')", 'S8b 重载（hover false）');
    const s8bFlag = await cdp.evalJs("window.matchMedia('(hover: hover)').matches");
    await hoverSelector(EXPLORE, 400);
    pf = await prefetchLinks();
    ok('S8b (hover: hover) 假 false：旗标 false + 悬停 400ms 零预取（触屏门控生效）', s8bFlag === false && pf.length === 0, JSON.stringify({ flag: s8bFlag, pf: pf }));

    // ── E：零异常 ──
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|Failed to load resource|slati_entrance|404|429/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    const realConsole = cdp.consoleErrs.filter(e => !noise.test(e));
    ok('E 全程零异常零 console error（噪声已滤）', realErrs.length === 0 && realConsole.length === 0, realErrs.slice(0, 3).join(' | ') + realConsole.slice(0, 3).join(' | '));
    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    FAIL++;
  }
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  server.close();
  console.log('\n' + (FAIL ? ('🎉 PASS ' + PASS + ' / 💔 FAIL ' + FAIL) : ('🎉 全部通过 ' + PASS + '/' + PASS)));
  process.exit(FAIL === 0 ? 0 : 1);
})();
