// tmp-probe-pageswitch.js — 页面切换掉帧测量探针（Request I 侦察轮）
// 用户「在页面切换的的时候会掉帧卡顿，你再优化一下」
// 手法同 msg-anim 探针 v2：transition/animation 事件开窗只计动画进行中帧；
// 切页的退出动画窗口跨文档销毁 → pagehide 时把 __twstats 快照进 sessionStorage，
// 新文档读回；入场窗口用 document 级 capture 监听 + __tts 记录首末时间算落定时长。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-pgswitch-' + Date.now());
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

// 帧记录器（同 msg-anim v2）+ pagehide 退出快照 + __tts 动画时间戳
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
  window.__twstart = function () { active++; };   // 手动开窗
  window.__twstop = function () { active--; if (active < 0) active = 0; };
  var ltBuf = [];   // 长任务（>50ms 主线程任务）时长缓冲
  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) { ltBuf.push(e.duration); });
    }).observe({ entryTypes: ['longtask'] });
  } catch (e) {}
  window.__twstats = function () {
    var ds = twBuf.slice(), n = ds.length, sum = 0, mx = 0, long20 = 0, long34 = 0;
    for (var i = 0; i < n; i++) {
      var d = ds[i];
      if (d > mx) mx = d;
      sum += d;
      if (d > 20) long20++;
      if (d > 34) long34++;
    }
    ds.sort(function (a, b) { return a - b; });
    var q = function (p) { return n ? ds[Math.min(n - 1, Math.floor(n * p))] : 0; };
    return { n: n, mean: +((n ? sum / n : 0)).toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +mx.toFixed(2), long20: long20, long34: long34, lt: ltBuf.length, ltSum: +(ltBuf.reduce(function (a, b) { return a + b; }, 0)).toFixed(1) };
  };
  window.__ttstats = function () {
    var starts = tts.filter(function (e) { return e.s === 1; });
    var ends = tts.filter(function (e) { return e.s === 0; });
    if (!starts.length) return { events: tts.length, settle: 0 };
    var t0 = starts[0].t;
    var t1 = ends.length ? ends[ends.length - 1].t : performance.now();
    return { events: tts.length, starts: starts.length, settle: +(t1 - t0).toFixed(0) };
  };
  window.__fstats = function () {
    var ds = window.__fr.buf.slice(), n = ds.length, sum = 0, mx = 0, long20 = 0, long34 = 0;
    var kept = [], stall = 0;
    for (var i = 0; i < n; i++) {
      var d = ds[i]; if (d > mx) mx = d;
      if (d > 250) { stall++; continue; }
      kept.push(d); sum += d;
      if (d > 20) long20++;
      if (d > 34) long34++;
    }
    kept.sort(function (a, b) { return a - b; });
    var k = kept.length, q = function (p) { return k ? kept[Math.min(k - 1, Math.floor(k * p))] : 0; };
    return { n: n, mean: +((k ? sum / k : 0)).toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +mx.toFixed(2), stall: stall, long20: long20, long34: long34 };
  };
  window.addEventListener('pagehide', function () {
    try { sessionStorage.setItem('__exit_stats', JSON.stringify(window.__twstats())); } catch (e) {}
  });
})();`;

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
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

    const fmt = (s) => 'n=' + s.n + ' mean=' + s.mean + ' p50=' + s.p50 + ' p95=' + s.p95 + ' max=' + s.max + ' long20=' + s.long20 + ' long34=' + s.long34 + ' longtask=' + s.lt + '/' + s.ltSum + 'ms';
    const navTo = async (url, readyExpr) => {
      await cdp.send('Page.navigate', { url: BASE + url });
      await waitFor(cdp, readyExpr, 30000, 'ready @ ' + url);
      await sleep(2600);
    };

    // 暖机：全链走一遍（首访栅格化不进账）
    await navTo('/index.html', "document.querySelectorAll('.card').length > 3");
    await cdp.evalJs("(function(){var a=document.querySelector('a[href*=\\'messages.html\\']');if(a){a.click();return true;}return false;})()");
    await waitFor(cdp, "document.querySelector('#conversationList')", 30000, 'warm messages');
    await sleep(2600);
    await navTo('/index.html', "document.querySelectorAll('.card').length > 3");
    console.log('（暖机完成）\n');

    // 场景：仪表盘 → Messages（垂直 exit UP + 入场）
    console.log('═══ P1 dashboard → messages ═══');
    await cdp.evalJs('window.__twreset()');
    const clicked1 = await cdp.evalJs("(function(){var a=document.querySelector('a[href*=\\'messages.html\\']');if(a){a.click();return true;}return false;})()");
    if (!clicked1) throw new Error('dashboard 无 messages 链接');
    await waitFor(cdp, "document.querySelector('#conversationList')", 30000, 'P1 messages');
    await sleep(2600);
    const p1exit = await cdp.evalJs("JSON.parse(sessionStorage.getItem('__exit_stats')||'{}')");
    const p1ent = await cdp.evalJs('window.__twstats()');
    const p1tt = await cdp.evalJs('window.__ttstats()');
    const p1cards = await cdp.evalJs("document.querySelectorAll('.card').length");
    console.log('  退出窗口(dashboard pagehide 快照): ' + fmt(p1exit));
    console.log('  入场窗口(messages 落定后): ' + fmt(p1ent));
    console.log('  入场时间戳: events=' + p1tt.events + ' starts=' + p1tt.starts + ' settle=' + p1tt.settle + 'ms; 卡数=' + p1cards);
    const p1poll = await cdp.evalJs("(function(){var a=document.querySelector('.announcement-card, #announceList .card');return a?getComputedStyle(a).transition:'(无公告卡)';})()");
    console.log('  Messages 公告卡 computed transition（污染检查）: ' + p1poll);

    // 场景：Messages → 仪表盘（垂直 exit DOWN + 入场）
    console.log('═══ P2 messages → dashboard ═══');
    await cdp.evalJs('window.__twreset()');
    const clicked2 = await cdp.evalJs("(function(){var a=document.querySelector('a[href*=\\'index.html\\'], a[href=\\'../\\']');if(a){a.click();return true;}return false;})()");
    if (!clicked2) throw new Error('messages 无 dashboard 链接');
    await waitFor(cdp, "document.querySelectorAll('.card').length > 3", 30000, 'P2 dashboard');
    await sleep(2600);
    const p2exit = await cdp.evalJs("JSON.parse(sessionStorage.getItem('__exit_stats')||'{}')");
    const p2ent = await cdp.evalJs('window.__twstats()');
    const p2tt = await cdp.evalJs('window.__ttstats()');
    const p2cards = await cdp.evalJs("document.querySelectorAll('.card').length");
    console.log('  退出窗口(messages pagehide 快照): ' + fmt(p2exit));
    console.log('  入场窗口(dashboard 落定后): ' + fmt(p2ent));
    console.log('  入场时间戳: events=' + p2tt.events + ' starts=' + p2tt.starts + ' settle=' + p2tt.settle + 'ms; 卡数=' + p2cards);

    // 场景：explore → overview（水平 tab 切，exit RIGHT + 入场）
    console.log('═══ P3 explore → overview（水平）═══');
    await navTo('/pages/explore.html', "document.querySelectorAll('.card').length > 2");
    await cdp.evalJs('window.__twreset()');
    const clicked3 = await cdp.evalJs("(function(){var a=document.querySelector('a[href*=\\'overview.html\\']');if(a){a.click();return true;}return false;})()");
    if (!clicked3) throw new Error('explore 无 overview 链接');
    await waitFor(cdp, "document.querySelectorAll('.card').length > 2", 30000, 'P3 overview');
    await sleep(2600);
    const p3exit = await cdp.evalJs("JSON.parse(sessionStorage.getItem('__exit_stats')||'{}')");
    const p3ent = await cdp.evalJs('window.__twstats()');
    const p3tt = await cdp.evalJs('window.__ttstats()');
    console.log('  退出窗口(explore pagehide 快照): ' + fmt(p3exit));
    console.log('  入场窗口(overview 落定后): ' + fmt(p3ent));
    console.log('  入场时间戳: events=' + p3tt.events + ' starts=' + p3tt.starts + ' settle=' + p3tt.settle + 'ms');

    // 入场残留污染全景：落定后 .card 上仍挂着 inline transition 的占比（全站橡皮筋污染指标）
    const polluted = await cdp.evalJs("(function(){var cs=document.querySelectorAll('.card');var n=0;for(var i=0;i<cs.length;i++){if(cs[i].style.transition&&cs[i].style.transition.indexOf('cubic-bezier(0.22')!==-1)n++;}return n+'/'+cs.length;})()");
    console.log('  落定后带入场 inline transition 的卡（污染）: ' + polluted);

    // Z console errors（噪声过滤）
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|settings-menu/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    console.log('Z console errors: ' + realErrs.length + (realErrs.length ? ' ' + realErrs.slice(0, 5).join(' | ') : '（干净）'));

    cdp.close();
    try { chrome.kill(); } catch (e) {}
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    server.close();
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  server.close();
  console.log('done');
})();
