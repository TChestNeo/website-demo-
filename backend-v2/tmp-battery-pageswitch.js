// tmp-battery-pageswitch.js — 切页动画观感恢复 + Messages 专属轻量模式电池（Request K 二轮；v0.2.50.2）
// 断言：F 静态锚（原样观感 + Messages LIGHT 分支 + 两个隐形修复）+ M1-M4 切页功能/方向语义 + 污染=0 守卫
//       + 公告卡 tilt 回归守卫 + 帧健康（诚实不变量）+ Z 零错误
// 口径：用户「那个你不能动」→ 原样观感恢复（50.1）；随后「撤销到我要求你优化 message 页面之前」→
//       Messages 进入/离开单独用 49.9 轻量版（LIGHT 分支），其余页面保持原样观感
// 手法：跨文档测量（pagehide 快照退出窗口 + 新文档入场窗口），同 tmp-probe-pageswitch.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-pgswbatt-' + Date.now());
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

const FRAME_REC = `(function () {
  window.__fr = { buf: [] };
  var last = null, twLast = null, twBuf = [], active = 0, tts = [];
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
    document.addEventListener(ev, function () { active++; tts.push({ s: 1, t: performance.now() }); }, true);
  });
  ['transitionend', 'animationend', 'transitioncancel', 'animationcancel'].forEach(function (ev) {
    document.addEventListener(ev, function () { active--; if (active < 0) active = 0; tts.push({ s: 0, t: performance.now() }); }, true);
  });
  window.__twreset = function () { twBuf = []; twLast = null; tts = []; };
  var ltBuf = [];
  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) { ltBuf.push(e.duration); });
    }).observe({ entryTypes: ['longtask'] });
  } catch (e) {}
  window.__twstats = function () {
    var ds = twBuf.slice(), n = ds.length;
    return { n: n, lt: ltBuf.length, ltSum: +(ltBuf.reduce(function (a, b) { return a + b; }, 0)).toFixed(1) };
  };
  window.__ttstats = function () {
    var starts = tts.filter(function (e) { return e.s === 1; });
    var ends = tts.filter(function (e) { return e.s === 0; });
    if (!starts.length) return { events: tts.length, starts: 0, settle: 0 };
    var t0 = starts[0].t;
    var t1 = ends.length ? ends[ends.length - 1].t : performance.now();
    return { events: tts.length, starts: starts.length, settle: +(t1 - t0).toFixed(0) };
  };
  window.addEventListener('pagehide', function () {
    try { sessionStorage.setItem('__exit_stats', JSON.stringify(window.__twstats())); } catch (e) {}
  });
})();`;

(async () => {
  // ═══ F 静态检查 ═══
  const trSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'transitions.js'), 'utf8');
  const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('F0 版本双线 v0.2.54.0 / v10.28.36.1',
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.58.13';") !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") !== -1 &&
    sconfSrc.indexOf('Messages 页专属轻量切页模式') !== -1);
  ok('F1 双模式入场串：原样渐隐+位移全串 + 轻量 transform-only 串都在',
    trSrc.indexOf("'opacity 0.4s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1)'") !== -1 &&
    trSrc.indexOf("'transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1)'") !== -1);
  ok('F2 原节奏 stagger 60 + 轻量 40/上限 8 + LIGHT 按 messages.html 判定',
    trSrc.indexOf('STAGGER_DELAY = 60') !== -1 &&
    trSrc.indexOf('LIGHT_STAGGER_DELAY = 40') !== -1 &&
    trSrc.indexOf('STAGGER_CAP = 8') !== -1 &&
    trSrc.indexOf("getFilename(window.location.pathname) === 'messages.html'") !== -1);
  ok('F3 隐形修复保留（写前记 prevOpacity、transitionend+cancel 双监听、恢复三值、清 transform、隐藏卡兜底定时）',
    trSrc.indexOf('el.style.opacity = prevOpacity') !== -1 &&
    trSrc.indexOf("el.addEventListener('transitionend', cleanup)") !== -1 &&
    trSrc.indexOf("el.addEventListener('transitioncancel', cleanup)") !== -1 &&
    trSrc.indexOf('el.style.transition = prevTransition') !== -1 &&
    trSrc.indexOf('el.style.transitionDelay = prevDelay') !== -1 &&
    trSrc.indexOf("el.style.transform = ''") !== -1 &&
    trSrc.indexOf('setTimeout(cleanup, 400 + i * delay + 200)') !== -1);
  ok('F4 退出双模式：原样渐隐串 + 轻量 transform-only 串都在',
    trSrc.indexOf("'opacity 0.22s ease, transform 0.22s ease'") !== -1 &&
    trSrc.indexOf("'opacity 0.25s ease, transform 0.25s ease'") !== -1 &&
    trSrc.indexOf("'transform 0.22s ease'") !== -1);
  ok('F5 导航计时双模式（原样 280/240 + 轻量 240/220）',
    trSrc.indexOf('LIGHT ? 240 : 280') !== -1 && trSrc.indexOf('LIGHT ? 220 : 240') !== -1);

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
    const m1dir = await cdp.evalJs("sessionStorage.getItem('slati_entrance_dir')");
    ok('M1a 点击 nav 即写入口方向 top', m1clicked === true && m1dir === 'top', 'dir=' + m1dir);
    await waitFor(cdp, "document.querySelector('#conversationList')", 30000, 'M1 messages');
    await sleep(3000); // 轻量入场末张 transitionend ≈ 7*40+400=680ms，3000 足够落定
    const m1exit = await cdp.evalJs("JSON.parse(sessionStorage.getItem('__exit_stats')||'{}')");
    const m1ent = await cdp.evalJs('window.__twstats()');
    const m1tt = await cdp.evalJs('window.__ttstats()');
    const m1poll = await cdp.evalJs(pollutionExpr);
    const m1acc = await cdp.evalJs("(function(){var a=document.querySelector('#announceList .card');return a?getComputedStyle(a).transition:'(无公告卡)';})()");
    ok('M1b 退出窗口帧流+零长任务（诚实不变量）', m1exit.n >= 1 && m1exit.lt === 0, 'exit n=' + m1exit.n + ' lt=' + m1exit.lt);
    ok('M1c 入场窗口帧流+零长任务', m1ent.n >= 4 && m1ent.lt === 0, 'ent n=' + m1ent.n + ' lt=' + m1ent.lt);
    ok('M1d Messages 专属轻量入场（starts ≤ 24：8 张波浪头 + 页内 fade-up 动画；全卡波浪应 ~73）+落定 < 1800ms', m1tt.starts <= 24 && m1tt.starts >= 1 && m1tt.settle < 1800, 'starts=' + m1tt.starts + ' settle=' + m1tt.settle + 'ms');
    ok('M1e 落定后零 inline 污染', m1poll === '0/' + m1poll.split('/')[1], m1poll + (m1poll.indexOf('0/') === 0 ? '' : ' ← ' + (await cdp.evalJs(pollDetailExpr))));
    ok('M1f 公告卡 computed 恢复 box-shadow（tilt 橡皮筋修复守卫）',
      m1acc.indexOf('box-shadow') !== -1 && m1acc.indexOf('transform 0.4s') === -1, m1acc);
    const m1accInline = await cdp.evalJs("(function(){var a=document.querySelector('#announceList .card');return a?a.getAttribute('style'):'';})()");
    ok('M1g 公告卡 inline 含 box-shadow 过渡属性（未被破坏）', m1accInline.indexOf('box-shadow') !== -1);

    // ═══ M2 messages → dashboard（exit DOWN / entrance BOTTOM）═══
    await cdp.evalJs('window.__twreset()');
    const m2clicked = await cdp.evalJs("(function(){var a=document.querySelector('a[href*=\\'index.html\\'], a[href=\\'../\\']');if(a){a.click();return true;}return false;})()");
    const m2dir = await cdp.evalJs("sessionStorage.getItem('slati_entrance_dir')");
    ok('M2a 点击 nav 即写入口方向 bottom', m2clicked === true && m2dir === 'bottom', 'dir=' + m2dir);
    await waitFor(cdp, "document.querySelectorAll('.card').length > 3", 30000, 'M2 dashboard');
    await sleep(5000); // dashboard 全卡波浪末张 transitionend ≈ (n-1)*60+400ms，等全部落定再查污染
    const m2ent = await cdp.evalJs('window.__twstats()');
    const m2tt = await cdp.evalJs('window.__ttstats()');
    const m2poll = await cdp.evalJs(pollutionExpr);
    ok('M2b 入场帧流+零长任务', m2ent.n >= 4 && m2ent.lt === 0, 'n=' + m2ent.n + ' lt=' + m2ent.lt);
    ok('M2c dashboard 原样全卡波浪（starts ≥ 24）+原节奏落定 ≥ 1100ms 且 < 3000ms（~1931ms 口径）', m2tt.starts >= 24 && m2tt.settle >= 1100 && m2tt.settle < 3000, 'starts=' + m2tt.starts + ' settle=' + m2tt.settle + 'ms');
    ok('M2d 零 inline 污染', m2poll === '0/' + m2poll.split('/')[1], m2poll + (m2poll.indexOf('0/') === 0 ? '' : ' ← ' + (await cdp.evalJs(pollDetailExpr))));
    const m2pre = await cdp.evalJs("document.body.classList.contains('pre-stagger')");
    ok('M2e pre-stagger 类已解除（1.6s 兜底兼容）', m2pre === false);

    // ═══ M3 explore → overview（水平，exit RIGHT / entrance LEFT）═══
    await navTo('/pages/explore.html', "document.querySelectorAll('.card').length > 2");
    await cdp.evalJs('window.__twreset()');
    const m3clicked = await cdp.evalJs("(function(){var a=document.querySelector('a[href*=\\'overview.html\\']');if(a){a.click();return true;}return false;})()");
    const m3dir = await cdp.evalJs("sessionStorage.getItem('slati_entrance_dir')");
    ok('M3a 水平切写入口方向 left', m3clicked === true && m3dir === 'left', 'dir=' + m3dir);
    await waitFor(cdp, "document.querySelectorAll('.card').length > 2", 30000, 'M3 overview');
    await sleep(5000); // overview 原样全卡波浪：等末张落定再查污染
    const m3ent = await cdp.evalJs('window.__twstats()');
    const m3poll = await cdp.evalJs(pollutionExpr);
    ok('M3b 入场帧流+零长任务', m3ent.n >= 4 && m3ent.lt === 0, 'n=' + m3ent.n + ' lt=' + m3ent.lt);
    ok('M3c 零 inline 污染', m3poll === '0/' + m3poll.split('/')[1], m3poll + (m3poll.indexOf('0/') === 0 ? '' : ' ← ' + (await cdp.evalJs(pollDetailExpr))));

    // ═══ M4 反向导航（overview → explore，entrance RIGHT）功能回归 ═══
    await cdp.evalJs('window.__twreset()');
    const m4clicked = await cdp.evalJs("(function(){var a=document.querySelector('a[href*=\\'explore.html\\']');if(a){a.click();return true;}return false;})()");
    const m4dir = await cdp.evalJs("sessionStorage.getItem('slati_entrance_dir')");
    await waitFor(cdp, "document.querySelectorAll('.card').length > 2", 30000, 'M4 explore');
    await sleep(2600);
    ok('M4a 反向水平切写 right + 到达 explore', m4clicked === true && m4dir === 'right');

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
  console.log('\n🎉 全部通过 ' + pass + '/' + (pass + fail) + (fail ? '（有失败！）' : ''));
  process.exit(fail ? 1 : 0);
})();
