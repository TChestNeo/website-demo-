// tmp-probe-msg-anim.js — Messages 页动画掉帧测量探针 v2（Request H 侦察轮）
// 用户「现在是Messages 那边的动画有明显掉帧请优化一下」
// v2 手法：headless 空闲时不产帧 → 只统计「动画进行中」的帧（document 级 capture 监听
// transitionstart/end + animationstart/end，活跃计数器 >0 期间的 rAF 帧间隔才计入）。
// 每场景 3 轮取中位，首轮前先暖机切过全部面板（首访栅格化成本不进账）。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-msganim-' + Date.now());
const NO_BLUR = process.argv[2] === 'noblur'; // 实验：禁用 .card 磨砂，验证 backdrop-filter 是否为滑动掉帧主因
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

// 帧记录器（document start 注入）：
//  - 全时缓冲（__fstats 全局统计，S1 入场用）
//  - 动画窗口缓冲（__tw：document 级 capture 监听 transition/animation start/end，
//    活跃计数>0 期间的帧进入窗口缓冲；__twreset 清空，__twstats 出统计）
const FRAME_REC = `(function () {
  window.__fr = { buf: [] };
  var last = null, twLast = null, twBuf = [], active = 0;
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
    document.addEventListener(ev, function () { active++; }, true);
  });
  ['transitionend', 'animationend', 'transitioncancel', 'animationcancel'].forEach(function (ev) {
    document.addEventListener(ev, function () { active--; if (active < 0) active = 0; }, true);
  });
  window.__twreset = function () { twBuf = []; twLast = null; ltBuf = []; };
  window.__twstart = function () { active++; };   // 手动开窗（滚动等非过渡场景）
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
})();`;

(async () => {
  // ═══ F0 静态清单（上下文，非断言）═══
  const msgSrc = fs.readFileSync(path.join(DOCS, 'pages', 'messages.html'), 'utf8');
  const allCount = (src, needle) => src.split(needle).length - 1;
  console.log('═══ F0 静态清单 ═══');
  console.log('  transition: all 出现: ' + allCount(msgSrc, 'transition: all'));
  console.log('  #msgSlide will-change: ' + (msgSrc.indexOf('#msgSlide { will-change: transform') !== -1 ? '有' : '无'));
  console.log('  面板 opacity 渐隐过渡: ' + (msgSrc.indexOf('transition:opacity 0.4s ease') !== -1 ? '有(未修)' : '无(已改瞬时)'));
  console.log('  msg-row fade-up will-change: ' + (msgSrc.indexOf('.msg-row.fade-up { will-change: transform, opacity') !== -1 ? '有' : '无'));
  console.log('  announceList CSS mask: ' + (msgSrc.indexOf('mask-image') !== -1 ? '有' : '无'));
  console.log('  convSidebar width 过渡: ' + (msgSrc.indexOf('transition:width 0.3s ease') !== -1 ? '有' : '无'));
  console.log('  msg-row fade-up keyframe: ' + (msgSrc.indexOf('@keyframes fadeUp') !== -1 ? '有' : '无'));
  console.log('');

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
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, user: { id: 'USR-demo-local', name: 'You', email: 'you@demo.local' } })) + ');}catch(e){}' +
        (NO_BLUR ? 'try{var __st=document.createElement("style");__st.textContent=".card{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}";document.documentElement.appendChild(__st);}catch(e){}' : '') +
        FRAME_REC
    });

    const fmt = (s) => 'n=' + s.n + ' mean=' + s.mean + ' p50=' + s.p50 + ' p95=' + s.p95 + ' max=' + s.max + ' long20=' + s.long20 + ' long34=' + s.long34 + ' longtask=' + s.lt + '/' + s.ltSum + 'ms';

    // 动画窗口场景：reset → 触发 → 等窗口结束 → 统计；重复 runs 轮取中位
    const twScenario = async (name, triggerExpr, settleMs, runs) => {
      const means = [];
      for (let i = 1; i <= runs; i++) {
        await cdp.evalJs('window.__twreset()');
        if (triggerExpr) await cdp.evalJs(triggerExpr);
        await sleep(settleMs);
        const s = await cdp.evalJs('window.__twstats()');
        console.log('  ' + name + ' 轮' + i + ': ' + fmt(s));
        means.push(s);
      }
      const sorted = means.slice().sort((a, b) => a.mean - b.mean);
      const med = sorted[Math.floor(sorted.length / 2)];
      console.log(name + ' → 中位: ' + fmt(med));
      return med;
    };

    await cdp.send('Page.navigate', { url: BASE + '/pages/messages.html' });
    await waitFor(cdp, "document.querySelector('#conversationList') && document.querySelector('#conversationList').children.length > 0 && document.querySelectorAll('#slati-sidebar .nav-item').length > 3", 30000, 'messages 页应用渲染');
    await sleep(800);

    const s1 = await cdp.evalJs('window.__fstats()');
    console.log('S1 入场(自文档起): ' + fmt(s1) + ' stall=' + s1.stall);

    // 暖机：三个面板全部切过一遍（首访栅格化不进账）
    await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'groups\\']').click()");
    await sleep(900);
    await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'announcements\\']').click()");
    await sleep(900);
    await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'private\\']').click()");
    await sleep(900);
    console.log('（暖机完成）\n');

    // ═══ 面板切换（核心场景；0.55s 滑轨 + 0.4s 面板渐隐 + subnav 滑块 + FAB）═══
    await twScenario('TS1 private→groups ', "document.querySelector('#msgSubnav [data-tab=\\'groups\\']').click()", 1000, 3);
    await twScenario('TS2 groups→announce', "document.querySelector('#msgSubnav [data-tab=\\'announcements\\']').click()", 1000, 3);
    await twScenario('TS3 announce→private', "document.querySelector('#msgSubnav [data-tab=\\'private\\']').click()", 1000, 3);

    // ═══ 侧栏折叠/恢复（0.3s width 布局动画）═══
    await twScenario('SB1 侧栏折叠      ', "document.getElementById('convCollapseBtn').click()", 800, 3);
    await twScenario('SB2 侧栏恢复      ', "document.getElementById('convCollapseBtn').click()", 800, 1);

    // ═══ 打开会话 + 气泡 fade-up（animationstart/end 窗口）═══
    await twScenario('OP 打开会话        ', "document.querySelector('#conversationList > div').click()", 1000, 2);
    await twScenario('SB 发送消息气泡    ', "document.getElementById('chatInput').value='Hi — frame test';window.sendMessage()", 1000, 3);

    // ═══ 公告展开（box-shadow 过渡）═══
    await cdp.evalJs("document.querySelector('#msgSubnav [data-tab=\\'announcements\\']').click()");
    await sleep(900);
    await twScenario('EX 公告展开        ', "document.querySelector('#announceList > div').click()", 800, 3);

    // ═══ 公告滚动（连续损伤窗口：脚本滚动期间帧持续产出）═══
    {
      const scrollable = await cdp.evalJs("(function(){var el=document.getElementById('announceList');return el.scrollHeight - el.clientHeight;})()");
      console.log('  announceList 可滚动量: ' + scrollable + 'px');
      if (scrollable > 40) {
        const scrollExpr = "(function(){var el=document.getElementById('announceList');var t=performance.now();(function step(){el.scrollTop+=5;if(performance.now()-t<900)requestAnimationFrame(step);})()})()";
        for (let i = 1; i <= 2; i++) {
          await cdp.evalJs('window.__twreset();window.__twstart()');
          await cdp.evalJs(scrollExpr);
          await sleep(1100);
          await cdp.evalJs('window.__twstop()');
          const s = await cdp.evalJs('window.__twstats()');
          console.log('  SCR 公告滚动 轮' + i + ': ' + fmt(s));
        }
      }
    }

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
