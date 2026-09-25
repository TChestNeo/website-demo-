// tmp-battery-fadefix.js — 切页动画掉帧 + 淡入不一致根治电池（v0.2.50.3 隐形轮 → v0.2.50.4 守卫收窄修复轮；双模式 before|after）
// 用法：node tmp-battery-fadefix.js before|after
//   before = 改动前基线（期望 v0.2.50.2；新机制断言跳过；帧健康表打印供 diff）
//   after  = 改动后（期望当前版本；全部断言开）
// 断言：F 静态锚（双模式观感串/节奏/隐形修复清理链 + 新机制锚 rAF/getAnimations/willChange×4/负锚
//       + F9 守卫收窄锚 50.4）
//       + M1-M4 切页功能/方向语义/污染=0 守卫 + 公告卡 tilt 守卫（原口径不变）
//       + M1h/M2h will-change 机制（起播非空 n/n + 落定全清） + M1i/M2i 波浪覆盖（每张可见波浪头卡
//         收到内联过渡——50.4 回归网：旧阈值 starts≥24 被 pre-stagger 过渡的 transitionstart 污染，
//         50.3 守卫误判整页跳过都没被抓到）
//       + N2 欢迎卡双动画守卫 + N3 退出 will-change + A4 auth 页入场 + Z 零错误
// 口径红线（用户钦定「不可以取舍任何限制拥有的所有过渡动画」）：渐隐/全卡波浪/节奏/时长/缓动/双模式
//       逐字不动——修法全隐形：rAF 批量波浪（起播帧对齐）、动画期间 will-change 层提升、双动画守卫
// 手法：跨文档测量（pagehide 快照退出窗口 + 新文档入场窗口），同 tmp-battery-pageswitch.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const MODE = (process.argv[2] || 'after');
const IS_AFTER = MODE === 'after';
const EXPECT_VER = IS_AFTER ? 'v0.2.58.0' : 'v0.2.50.2';

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fadefix-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
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

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name + (detail !== undefined ? '  ' + detail : '')); }
  else { fail++; console.log('  ❌ ' + name + (detail !== undefined ? '  ' + detail : '')); }
}
function skip(name) { console.log('  ➖ SKIP(before) ' + name); }
function fmt(s) {
  return 'n=' + s.n + ' mean=' + s.mean + ' p50=' + s.p50 + ' p95=' + s.p95 + ' max=' + s.max +
    ' >20ms=' + s.long20 + ' >34ms=' + s.long34 + ' lt=' + s.lt;
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
    await sleep(120);
  }
  throw new Error('waitFor 超时: ' + label);
}

// FRAME_REC：rAF 帧间隔记录（动画窗口门控）+ 帧健康分布 + will-change 起播旁路记录
const FRAME_REC = `(function () {
  window.__fr = { buf: [] };
  var last = null, twLast = null, twBuf = [], active = 0, tts = [], wcBuf = [];
  (function loop(t) {
    if (last !== null) {
      window.__fr.buf.push(t - last);
      if (window.__fr.buf.length > 8000) window.__fr.buf.splice(0, 2000);
      if (active > 0) { if (twLast !== null) twBuf.push(t - twLast); twLast = t; }
      else twLast = null;
    }
    last = t;
    requestAnimationFrame(loop);
  })(0);
  ['transitionstart', 'animationstart'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      active++; tts.push({ s: 1, t: performance.now() });
      if (ev === 'transitionstart') wcBuf.push({ t: e.target, w: (e.target.style && e.target.style.willChange) || '', it: (e.target.style && e.target.style.transition) || '' });
    }, true);
  });
  ['transitionend', 'animationend', 'transitioncancel', 'animationcancel'].forEach(function (ev) {
    document.addEventListener(ev, function () { active--; if (active < 0) active = 0; tts.push({ s: 0, t: performance.now() }); }, true);
  });
  window.__twreset = function () { twBuf = []; twLast = null; tts = []; wcBuf = []; };
  var ltBuf = [];
  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) { ltBuf.push(e.duration); });
    }).observe({ entryTypes: ['longtask'] });
  } catch (e) {}
  window.__twstats = function () {
    var ds = twBuf.slice(), n = ds.length;
    if (!n) return { n: 0, mean: 0, p50: 0, p95: 0, max: 0, long20: 0, long34: 0, lt: ltBuf.length, ltSum: 0 };
    var s = ds.slice().sort(function (a, b) { return a - b; });
    return {
      n: n,
      mean: +(ds.reduce(function (a, b) { return a + b; }, 0) / n).toFixed(1),
      p50: +s[Math.floor(n * 0.5)].toFixed(1),
      p95: +s[Math.min(n - 1, Math.floor(n * 0.95))].toFixed(1),
      max: +s[n - 1].toFixed(1),
      long20: ds.filter(function (d) { return d > 20; }).length,
      long34: ds.filter(function (d) { return d > 34; }).length,
      lt: ltBuf.length,
      ltSum: +(ltBuf.reduce(function (a, b) { return a + b; }, 0)).toFixed(1)
    };
  };
  window.__ttstats = function () {
    var starts = tts.filter(function (e) { return e.s === 1; });
    var ends = tts.filter(function (e) { return e.s === 0; });
    if (!starts.length) return { events: tts.length, starts: 0, settle: 0 };
    var t0 = starts[0].t;
    var t1 = ends.length ? ends[ends.length - 1].t : performance.now();
    return { events: tts.length, starts: starts.length, settle: +(t1 - t0).toFixed(0) };
  };
  window.__wcstats = function () {
    var targets = [];
    wcBuf.forEach(function (e) { if (targets.indexOf(e.t) === -1) targets.push(e.t); });
    var withWC = wcBuf.filter(function (e) { return e.w !== ''; }).length;
    var cleared = targets.filter(function (t) { return t.style.willChange === ''; }).length;
    var vals = [];
    wcBuf.forEach(function (e) { if (e.w !== '' && vals.indexOf(e.w) === -1) vals.push(e.w); });
    // 波浪覆盖统计（v0.2.50.4 回归网）：transitionstart 瞬间 inline 含 cubic-bezier(0.22 的目标数——
    // 守卫误判跳过的卡不会有波浪内联过渡（pre-stagger 过渡被同 tick 内联写取消，不进此集）
    var itTargets = [];
    wcBuf.forEach(function (e) { if (e.it.indexOf('cubic-bezier(0.22') !== -1 && itTargets.indexOf(e.t) === -1) itTargets.push(e.t); });
    return { n: wcBuf.length, withWC: withWC, allWC: wcBuf.length > 0 && withWC === wcBuf.length, cleared: cleared, targets: targets.length, vals: vals, itTargets: itTargets.length };
  };
  window.addEventListener('pagehide', function () {
    try { sessionStorage.setItem('__exit_stats', JSON.stringify(window.__twstats())); } catch (e) {}
  });
})();`;

(async () => {
  console.log('═══ tmp-battery-fadefix.js ═══ mode=' + MODE + ' 期望版本 ' + EXPECT_VER);
  // ═══ F 静态检查 ═══
  const trSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'transitions.js'), 'utf8');
  const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('F0 版本双线 ' + EXPECT_VER + ' / v10.28.36.1 + changelog 标记',
    sconfSrc.indexOf("window.MN_SITE_VERSION = '" + EXPECT_VER + "';") !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.0';") !== -1 &&
    (IS_AFTER ? sconfSrc.indexOf('进场帧健康隐形修复') !== -1 && sconfSrc.indexOf('守卫收窄修复') !== -1 : true));
  ok('F1 双模式入场串：原样渐隐+位移全串 + 轻量 transform-only 串都在',
    trSrc.indexOf("'opacity 0.4s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1)'") !== -1 &&
    trSrc.indexOf("'transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1)'") !== -1);
  ok('F2 原节奏 stagger 60 + 轻量 40/上限 8 + LIGHT 按 messages.html 判定',
    trSrc.indexOf('STAGGER_DELAY = 60') !== -1 &&
    trSrc.indexOf('LIGHT_STAGGER_DELAY = 40') !== -1 &&
    trSrc.indexOf('STAGGER_CAP = 8') !== -1 &&
    trSrc.indexOf("getFilename(window.location.pathname) === 'messages.html'") !== -1);
  if (IS_AFTER) {
    ok('F3 隐形修复保留（prevOpacity 记/transitionend+cancel 双监听/恢复三值/清 transform/兜底公式）+ will-change 写前记/还原',
      trSrc.indexOf('el.style.opacity = prevOpacity') !== -1 &&
      trSrc.indexOf("el.addEventListener('transitionend', cleanup)") !== -1 &&
      trSrc.indexOf("el.addEventListener('transitioncancel', cleanup)") !== -1 &&
      trSrc.indexOf('el.style.transition = prevTransition') !== -1 &&
      trSrc.indexOf('el.style.transitionDelay = prevDelay') !== -1 &&
      trSrc.indexOf("el.style.transform = ''") !== -1 &&
      trSrc.indexOf('setTimeout(cleanup, 400 + i * delay + 200)') !== -1 &&
      trSrc.indexOf('var prevWillChange') !== -1 &&
      trSrc.indexOf('el.style.willChange = prevWillChange') !== -1);
  } else {
    ok('F3 隐形修复保留（写前记 prevOpacity、transitionend+cancel 双监听、恢复三值、清 transform、隐藏卡兜底定时）',
      trSrc.indexOf('el.style.opacity = prevOpacity') !== -1 &&
      trSrc.indexOf("el.addEventListener('transitionend', cleanup)") !== -1 &&
      trSrc.indexOf("el.addEventListener('transitioncancel', cleanup)") !== -1 &&
      trSrc.indexOf('el.style.transition = prevTransition') !== -1 &&
      trSrc.indexOf('el.style.transitionDelay = prevDelay') !== -1 &&
      trSrc.indexOf("el.style.transform = ''") !== -1 &&
      trSrc.indexOf('setTimeout(cleanup, 400 + i * delay + 200)') !== -1);
  }
  ok('F4 退出双模式：原样渐隐串 + 轻量 transform-only 串都在',
    trSrc.indexOf("'opacity 0.22s ease, transform 0.22s ease'") !== -1 &&
    trSrc.indexOf("'opacity 0.25s ease, transform 0.25s ease'") !== -1 &&
    trSrc.indexOf("'transform 0.22s ease'") !== -1);
  ok('F5 导航计时双模式（原样 280/240 + 轻量 240/220）',
    trSrc.indexOf('LIGHT ? 240 : 280') !== -1 && trSrc.indexOf('LIGHT ? 220 : 240') !== -1);
  if (IS_AFTER) {
    ok('F6 rAF 批量波浪（requestAnimationFrame 在 + 旧逐卡 setTimeout 模式不在 + 兜底公式在）',
      trSrc.indexOf('requestAnimationFrame') !== -1 &&
      trSrc.indexOf('}, i * delay);') === -1 &&
      trSrc.indexOf('setTimeout(cleanup, 400 + i * delay + 200)') !== -1);
    ok('F7 双动画守卫 getAnimations 在', trSrc.indexOf('getAnimations') !== -1);
    const wcCount = trSrc.split('style.willChange =').length - 1;
    ok('F8 will-change 写点 ≥4 处（入场/还原/水平退出/垂直退出）', wcCount >= 4, 'count=' + wcCount);
    ok('F9 守卫收窄只认 CSS 关键帧动画（CSSTransition 构造器 + transitionProperty 双重过滤；v0.2.50.4）',
      trSrc.indexOf("ctorName === 'CSSTransition'") !== -1 &&
      trSrc.indexOf('a.transitionProperty !== undefined') !== -1);
  } else {
    skip('F6 rAF 批量波浪锚（before 无）'); skip('F7 getAnimations 锚（before 无）'); skip('F8 will-change 锚（before 无）');
    skip('F9 守卫收窄锚（before 无）');
  }

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
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, user: { id: 'USR-demo-local', name: 'You', email: 'you@demo.local' } })) + ');}catch(e){}' + FRAME_REC
    });

    const pollutionExpr = "(function(){var cs=document.querySelectorAll('.card');var n=0;for(var i=0;i<cs.length;i++){if(cs[i].style.transition&&cs[i].style.transition.indexOf('cubic-bezier(0.22')!==-1)n++;}return n+'/'+cs.length;})()";
    const pollDetailExpr = "(function(){var cs=document.querySelectorAll('.card');var o=[];for(var i=0;i<cs.length;i++){if(cs[i].style.transition&&cs[i].style.transition.indexOf('cubic-bezier(0.22')!==-1)o.push((cs[i].id?'#'+cs[i].id:cs[i].className.toString().slice(0,40)));}return o.join(',');})()";
    const welcomeExpr = "(function(){var w=document.querySelector('#welcomeBanner');return w?w.closest('.card'):null;})()";
    // 波浪覆盖（v0.2.50.4 回归网）：可见波浪头卡（LIGHT=前8，原样=全部，欢迎卡除外）必须全部收到
    // 波浪内联过渡——itTargets 与可见数严格相等；守卫误判跳过任何一张都会破等
    const waveCoverageExpr = "(function(){var all=Array.prototype.slice.call(document.querySelectorAll('.card, .app-main h1, .app-main h1 + p, .app-main h2, .app-main .search-capsule, .app-main header, .auth-card'));var isL=location.pathname.indexOf('messages.html')!==-1;var n=isL?Math.min(all.length,8):all.length;var scope=all.slice(0,n);var w=document.querySelector('#welcomeBanner');w=w?w.closest('.card'):null;var vis=0;scope.forEach(function(el){if(el===w)return;if(el.getClientRects().length===0)return;vis++;});var s=window.__wcstats();return {vis:vis,it:s.itTargets};})()";
    const navTo = async (url, readyExpr) => {
      await cdp.send('Page.navigate', { url: BASE + url });
      await waitFor(cdp, readyExpr, 30000, 'ready @ ' + url);
      await sleep(2600);
    };

    // 暖机（首访栅格化不进账）
    await navTo('/index.html', "document.querySelectorAll('.card').length > 3");
    await cdp.evalJs("(function(){var a=document.querySelector('a[href*=\\'messages.html\\']');if(a){a.click();return true;}return false;})()");
    await waitFor(cdp, "document.querySelector('#conversationList')", 30000, 'warm messages');
    await sleep(2600);
    await navTo('/index.html', "document.querySelectorAll('.card').length > 3");

    // ═══ M1 dashboard → messages（垂直向下，exit UP / entrance TOP）═══
    await cdp.evalJs('window.__twreset()');
    const m1clicked = await cdp.evalJs("(function(){var a=document.querySelector('a[href*=\\'messages.html\\']');if(a){a.click();return true;}return false;})()");
    const m1wc = IS_AFTER ? await cdp.evalJs("(function(){var m=document.querySelector('.app-main');return m?m.style.willChange:'(无 .app-main)';})()") : null;
    const m1dir = await cdp.evalJs("sessionStorage.getItem('slati_entrance_dir')");
    ok('M1a 点击 nav 即写入口方向 top', m1clicked === true && m1dir === 'top', 'dir=' + m1dir);
    if (IS_AFTER) ok('N3v 垂直退出 .app-main 同步写 will-change（层提升）', m1wc.indexOf('opacity, transform') !== -1, 'will=' + m1wc);
    await waitFor(cdp, "document.querySelector('#conversationList')", 30000, 'M1 messages');
    await sleep(3000); // 轻量入场末张 transitionend ≈ 7*40+400=680ms，3000 足够落定
    const m1exit = await cdp.evalJs("JSON.parse(sessionStorage.getItem('__exit_stats')||'{}')");
    const m1ent = await cdp.evalJs('window.__twstats()');
    const m1tt = await cdp.evalJs('window.__ttstats()');
    const m1poll = await cdp.evalJs(pollutionExpr);
    const m1acc = await cdp.evalJs("(function(){var a=document.querySelector('#announceList .card');return a?getComputedStyle(a).transition:'(无公告卡)';})()");
    ok('M1b 退出窗口帧流+零长任务（诚实不变量）', m1exit.n >= 1 && m1exit.lt === 0, 'exit ' + fmt(m1exit));
    ok('M1c 入场窗口帧流+零长任务', m1ent.n >= 4 && m1ent.lt === 0, 'ent ' + fmt(m1ent));
    console.log('  📊 M1 Messages LIGHT 入场帧健康：' + fmt(m1ent) + ' | settle=' + m1tt.settle + 'ms');
    ok('M1d Messages 专属轻量入场（starts ≤ 24：8 张波浪头 + 页内 fade-up 动画；全卡波浪应 ~73）+落定 < 2200ms（8 卡波浪物理 680ms 落定，尾长含页内原生动画、运行方差 ±150ms）', m1tt.starts <= 24 && m1tt.starts >= 1 && m1tt.settle < 2200, 'starts=' + m1tt.starts + ' settle=' + m1tt.settle + 'ms');
    ok('M1e 落定后零 inline 污染', m1poll === '0/' + m1poll.split('/')[1], m1poll + (m1poll.indexOf('0/') === 0 ? '' : ' ← ' + (await cdp.evalJs(pollDetailExpr))));
    ok('M1f 公告卡 computed 恢复 box-shadow（tilt 橡皮筋修复守卫）',
      m1acc.indexOf('box-shadow') !== -1 && m1acc.indexOf('transform 0.4s') === -1, m1acc);
    const m1accInline = await cdp.evalJs("(function(){var a=document.querySelector('#announceList .card');return a?a.getAttribute('style'):'';})()");
    ok('M1g 公告卡 inline 含 box-shadow 过渡属性（未被破坏）', m1accInline.indexOf('box-shadow') !== -1);
    if (IS_AFTER) {
      const m1wcstats = await cdp.evalJs('window.__wcstats()');
      const m1wcAllT = m1wcstats.vals.length > 0 && m1wcstats.vals.every(v => v.indexOf('transform') !== -1);
      ok('M1h LIGHT 入场 will-change 机制（波浪卡起播均带 will-change ≥3 + 值全含 transform + 落定全清）',
        m1wcstats.withWC >= 3 && m1wcAllT && m1wcstats.cleared === m1wcstats.targets,
        'n=' + m1wcstats.n + ' withWC=' + m1wcstats.withWC + ' cleared=' + m1wcstats.cleared + '/' + m1wcstats.targets + ' vals=' + m1wcstats.vals.join('|'));
      const m1cov = await cdp.evalJs(waveCoverageExpr);
      ok('M1i Messages LIGHT 波浪覆盖（≥5 张波浪头卡收到内联过渡；50.4 守卫收窄回归网——messages 守卫输入为空已由探针证明，≤3 张差额 = 页内原生入场动画抢先改 transform，startCard 写入即终值无新过渡可起（tmp-probe-msg-preempt.js 快照实证 8 张全被写入），观感无损）',
        m1cov.it >= 5 && m1cov.it <= m1cov.vis, 'itTargets=' + m1cov.it + ' vis=' + m1cov.vis);
    }

    // ═══ M2 messages → dashboard（exit DOWN / entrance BOTTOM）═══
    await cdp.evalJs('window.__twreset()');
    const m2clicked = await cdp.evalJs("(function(){var a=document.querySelector('a[href*=\\'index.html\\'], a[href=\\'../\\']');if(a){a.click();return true;}return false;})()");
    const m2dir = await cdp.evalJs("sessionStorage.getItem('slati_entrance_dir')");
    ok('M2a 点击 nav 即写入口方向 bottom', m2clicked === true && m2dir === 'bottom', 'dir=' + m2dir);
    // ready 信号 = 波浪进行中的物理状态（自定位，对导航时序/渲染负载免疫）：≥3 张卡带
    // cubic-bezier 内联过渡（t≈230ms 起真、持续到末张清理 ≈1720ms；渲染负载下 rAF 批量
    // 起播也不影响此判定）。旧页 messages 的退出串无 cubic-bezier、从不中
    const midWaveExpr = "(function(){var cs=document.querySelectorAll('.card');var mid=0;for(var i=0;i<cs.length;i++){if((cs[i].style.transition||'').indexOf('cubic-bezier(0.22')!==-1)mid++;}return mid>=3;})()";
    await waitFor(cdp, midWaveExpr, 15000, 'M2 dashboard mid-wave');
    const m2mid = IS_AFTER ? await cdp.evalJs("(function(){var w=document.querySelector('#welcomeBanner');w=w?w.closest('.card'):null;var cs=document.querySelectorAll('.card');var mid=0;for(var i=0;i<cs.length;i++){if(cs[i]===w)continue;if((cs[i].style.transition||'').indexOf('cubic-bezier(0.22')!==-1)mid++;}return {w: w?(w.style.transition||''):'(无欢迎卡)', mid: mid};})()") : null;
    if (IS_AFTER) ok('N2b 中场快照：欢迎卡零内联过渡（守卫跳过）而波浪其他卡 ≥3 张进行中', m2mid.w === '' && m2mid.mid >= 3, 'welcome.t=' + JSON.stringify(m2mid.w) + ' mid=' + m2mid.mid);
    await sleep(4300); // 中场快照（t≤~1020ms）后等波浪+尾事件全落定，再查污染与 settle
    const m2ent = await cdp.evalJs('window.__twstats()');
    const m2tt = await cdp.evalJs('window.__ttstats()');
    const m2poll = await cdp.evalJs(pollutionExpr);
    ok('M2b 入场帧流+零长任务', m2ent.n >= 4 && m2ent.lt === 0, 'n=' + m2ent.n + ' lt=' + m2ent.lt);
    console.log('  📊 M2 dashboard 原样全卡波浪入场帧健康：' + fmt(m2ent) + ' | settle=' + m2tt.settle + 'ms');
    ok('M2c dashboard 原样全卡波浪（starts ≥ 24）+原节奏落定 ≥ 1100ms 且 < 3000ms（~1931ms 口径）', m2tt.starts >= 24 && m2tt.settle >= 1100 && m2tt.settle < 3000, 'starts=' + m2tt.starts + ' settle=' + m2tt.settle + 'ms');
    ok('M2d 零 inline 污染', m2poll === '0/' + m2poll.split('/')[1], m2poll + (m2poll.indexOf('0/') === 0 ? '' : ' ← ' + (await cdp.evalJs(pollDetailExpr))));
    const m2pre = await cdp.evalJs("document.body.classList.contains('pre-stagger')");
    ok('M2e pre-stagger 类已解除（1.6s 兜底兼容）', m2pre === false);
    if (IS_AFTER) {
      const m2wcstats = await cdp.evalJs('window.__wcstats()');
      const m2wcAllO = m2wcstats.vals.length > 0 && m2wcstats.vals.every(v => v.indexOf('opacity') !== -1);
      ok('M2h 原样入场 will-change 机制（波浪卡起播均带 will-change ≥20 + 值全含 opacity + 落定全清）',
        m2wcstats.withWC >= 20 && m2wcAllO && m2wcstats.cleared === m2wcstats.targets,
        'n=' + m2wcstats.n + ' withWC=' + m2wcstats.withWC + ' cleared=' + m2wcstats.cleared + '/' + m2wcstats.targets + ' vals=' + m2wcstats.vals.join('|'));
      const m2cov = await cdp.evalJs(waveCoverageExpr);
      ok('M2i dashboard 波浪覆盖（每张可见非欢迎卡收到内联过渡；50.4 守卫收窄回归网）',
        m2cov.it === m2cov.vis, 'itTargets=' + m2cov.it + ' vis=' + m2cov.vis);
      const n2 = await cdp.evalJs("(function(){var w=document.querySelector('#welcomeBanner');w=w?w.closest('.card'):null;if(!w)return '(无欢迎卡)';return {t:(w.style.transition||''),o:(w.style.opacity||''),wc:(w.style.willChange||''),anim:getComputedStyle(w).animationName,ga:w.getAnimations().length};})()");
      ok('N2 欢迎卡双动画守卫（零内联三值 + 关键帧 fadeInUp 照常淡入 + fill forwards 仍挂动画）',
        n2.t === '' && n2.o === '' && n2.wc === '' && n2.anim.indexOf('fadeInUp') !== -1 && n2.ga >= 1,
        't=' + JSON.stringify(n2.t) + ' o=' + JSON.stringify(n2.o) + ' wc=' + JSON.stringify(n2.wc) + ' anim=' + n2.anim + ' ga=' + n2.ga);
    }

    // ═══ M3 explore → overview（水平，exit RIGHT / entrance LEFT）═══
    await navTo('/pages/explore.html', "document.querySelectorAll('.card').length > 2");
    await cdp.evalJs('window.__twreset()');
    const m3clicked = await cdp.evalJs("(function(){var a=document.querySelector('a[href*=\\'overview.html\\']');if(a){a.click();return true;}return false;})()");
    const m3wc = IS_AFTER ? await cdp.evalJs("(function(){var cs=document.querySelectorAll('.card');var hit=0;for(var i=0;i<cs.length;i++){if((cs[i].style.willChange||'').indexOf('opacity')!==-1)hit++;}return hit;})()") : null;
    const m3dir = await cdp.evalJs("sessionStorage.getItem('slati_entrance_dir')");
    ok('M3a 水平切写入口方向 left', m3clicked === true && m3dir === 'left', 'dir=' + m3dir);
    if (IS_AFTER) ok('N3h 水平退出逐卡同步写 will-change（层提升）', m3wc >= 1, 'hit=' + m3wc);
    await waitFor(cdp, "document.querySelectorAll('.card').length > 2", 30000, 'M3 overview');
    await sleep(5000); // overview 原样全卡波浪：等末张落定再查污染
    const m3exit = await cdp.evalJs("JSON.parse(sessionStorage.getItem('__exit_stats')||'{}')");
    const m3ent = await cdp.evalJs('window.__twstats()');
    const m3poll = await cdp.evalJs(pollutionExpr);
    console.log('  📊 M3 explore→overview 水平退出帧健康：' + fmt(m3exit));
    ok('M3b 入场帧流+零长任务', m3ent.n >= 4 && m3ent.lt === 0, 'n=' + m3ent.n + ' lt=' + m3ent.lt);
    ok('M3c 零 inline 污染', m3poll === '0/' + m3poll.split('/')[1], m3poll + (m3poll.indexOf('0/') === 0 ? '' : ' ← ' + (await cdp.evalJs(pollDetailExpr))));

    // ═══ M4 反向导航（overview → explore，entrance RIGHT）功能回归 ═══
    await cdp.evalJs('window.__twreset()');
    const m4clicked = await cdp.evalJs("(function(){var a=document.querySelector('a[href*=\\'explore.html\\']');if(a){a.click();return true;}return false;})()");
    const m4dir = await cdp.evalJs("sessionStorage.getItem('slati_entrance_dir')");
    await waitFor(cdp, "document.querySelectorAll('.card').length > 2", 30000, 'M4 explore');
    await sleep(2600);
    ok('M4a 反向水平切写 right + 到达 explore', m4clicked === true && m4dir === 'right');

    // ═══ A4 auth 页入场（.auth-card blur 32px 最重磨砂目标）═══
    await cdp.send('Page.navigate', { url: BASE + '/signup-and-login' });
    await waitFor(cdp, "document.querySelector('.auth-card')", 30000, 'A4 auth');
    await sleep(2600);
    const a4ent = await cdp.evalJs('window.__twstats()');
    const a4tt = await cdp.evalJs('window.__ttstats()');
    const a4wc = await cdp.evalJs("(function(){var a=document.querySelector('.auth-card');return a?(a.style.willChange||''):'(无)';})()");
    const a4poll = await cdp.evalJs(pollutionExpr);
    console.log('  📊 A4 auth 入场帧健康：' + fmt(a4ent) + ' | settle=' + a4tt.settle + 'ms');
    ok('A4 auth 入场（starts ≥1 + 帧流 ≥1 + 零长任务 + will-change 落定清净 + 污染 0/N）',
      a4tt.starts >= 1 && a4ent.n >= 1 && a4ent.lt === 0 && a4wc === '' && a4poll === '0/' + a4poll.split('/')[1],
      'starts=' + a4tt.starts + ' n=' + a4ent.n + ' lt=' + a4ent.lt + ' will=' + JSON.stringify(a4wc) + ' poll=' + a4poll);

    // ═══ Z console errors（噪声过滤）═══
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|settings-menu/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('Z 全程零 console error', realErrs.length === 0, realErrs.length ? realErrs.slice(0, 3).join(' | ') : '干净');

    cdp.close();
    try { chrome.kill(); } catch (e) {}
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    server.close();
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  server.close();
  console.log('\n🎉 mode=' + MODE + ' 全部通过 ' + pass + '/' + (pass + fail) + (fail ? '（有失败！）' : ''));
  process.exit(fail ? 1 : 0);
})();
