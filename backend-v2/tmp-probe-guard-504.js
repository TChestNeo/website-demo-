// tmp-probe-guard-504.js — v0.2.50.4 守卫收窄机制探针
// 用法：node tmp-probe-guard-504.js
// 裁决实验①（机制）：包装 Element.prototype.getAnimations，当场捕获 boot pass 1 里守卫
//   每次调用时看到的动画表——证明 getAnimations() 输入里含 pre-stagger 解除触发的
//   CSSTransition（真实浏览器 phase=active → 旧守卫误判整页跳过；headless 无 phase 键、
//   flush 瞬间 progress=null → 旧守卫不误判 = 电池全绿的盲区）
// 裁决实验②（修复效果）：按新守卫逻辑（CSSTransition 构造器/transitionProperty 双重过滤）
//   重放每次捕获——would-skip 集合应只含 index 欢迎卡；且每页可见的非欢迎 CARD_SELECTOR
//   元素全部收到波浪 transitionstart（修复后动画一个不少）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4900 + Math.floor(Math.random() * 100);
const CDP_PORT = 5900 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe504-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
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

// 探针注入：包装 getAnimations 捕获守卫视角 + transitionstart 目标集 + boot 前 pre-stagger 状态
const PROBE = `(function () {
  window.__p504 = { guardCalls: [], started: [], dclPre: null };
  var origGA = Element.prototype.getAnimations;
  if (origGA) {
    Element.prototype.getAnimations = function () {
      var r = origGA.call(this);
      try {
        if (r && r.length) {
          var self = this;
          window.__p504.guardCalls.push({
            t: performance.now(),
            cls: String(self.className || '').slice(0, 36),
            list: r.map(function (a) {
              var ct = null;
              try { ct = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null; } catch (e) {}
              var kfs = '';
              try { kfs = (a.effect.getKeyframes() || []).map(function (f) { return Object.keys(f).join(','); }).join('|'); } catch (e) {}
              return {
                ctor: (a.constructor && a.constructor.name) || '',
                tp: a.transitionProperty,
                phase: ct ? ct.phase : null,
                progress: ct ? ct.progress : null,
                fill: ct ? ct.fill : null,
                kfs: kfs
              };
            })
          });
        }
      } catch (e) {}
      return r;
    };
  }
  document.addEventListener('transitionstart', function (e) { window.__p504.started.push(e.target); }, true);
  document.addEventListener('DOMContentLoaded', function () {
    // 注入脚本监听器先于页面脚本注册 → 此刻 pre-stagger 仍在、boot 未跑
    window.__p504.dclPre = document.body.classList.contains('pre-stagger');
  });
})();`;

// 按新守卫逻辑重放每次捕获：would-skip 判定（过滤 CSSTransition 后 applies + kfs 含 opacity/transform）
const REPLAY = `(function () {
  var calls = (window.__p504 && window.__p504.guardCalls) || [];
  var bootCalls = calls.filter(function (c) { return c.t < 2000; });
  var sawTransition = 0, sawCssAnim = 0, headlessPhaseActive = 0, progressNull = 0;
  var skippedCls = [];
  bootCalls.forEach(function (c) {
    var filtered = c.list.filter(function (e) {
      return !(e.ctor === 'CSSTransition' || (e.tp !== undefined && e.tp !== null));
    });
    var hasTransition = c.list.some(function (e) { return e.ctor === 'CSSTransition' || (e.tp !== undefined && e.tp !== null); });
    var hasCssAnim = c.list.some(function (e) { return e.ctor === 'CSSAnimation'; });
    if (hasTransition) sawTransition++;
    if (hasCssAnim) sawCssAnim++;
    c.list.forEach(function (e) { if (e.phase === 'active') headlessPhaseActive++; if (e.progress === null) progressNull++; });
    var applies = filtered.some(function (e) {
      return e.fill === 'forwards' || e.fill === 'both' || (e.progress !== null && e.progress !== undefined && e.progress < 1) || e.phase === 'active';
    });
    var kfsHit = filtered.some(function (e) {
      return typeof e.kfs === 'string' && (e.kfs.indexOf('opacity') !== -1 || e.kfs.indexOf('transform') !== -1);
    });
    if (applies && kfsHit) skippedCls.push(c.cls);
  });
  // 真实浏览器模拟：老守卫（不过滤过渡）在这些捕获上的判定——过渡 entry 若 phase 存在即 active
  var oldVerdictTrue = 0, oldVerdictOnlyTransition = 0;
  bootCalls.forEach(function (c) {
    var hit = c.list.some(function (e) {
      var appliesOld = e.fill === 'forwards' || e.fill === 'both' || (e.progress !== null && e.progress !== undefined && e.progress < 1) || e.phase === 'active' || e.phase === 'after';
      var kfsHitOld = typeof e.kfs === 'string' && (e.kfs.indexOf('opacity') !== -1 || e.kfs.indexOf('transform') !== -1);
      return appliesOld && kfsHitOld;
    });
    if (hit) {
      oldVerdictTrue++;
      var onlyTrans = c.list.every(function (e) { return e.ctor === 'CSSTransition' || (e.tp !== undefined && e.tp !== null); });
      if (onlyTrans) oldVerdictOnlyTransition++;
    }
  });
  var sample = bootCalls.length ? bootCalls[0].list.map(function (e) { return e.ctor + '/tp=' + e.tp + '/phase=' + e.phase + '/prog=' + e.progress + '/fill=' + e.fill; }).join(' ; ') : '(无捕获)';
  return {
    bootCalls: bootCalls.length, sawTransition: sawTransition, sawCssAnim: sawCssAnim,
    headlessPhaseActive: headlessPhaseActive, progressNull: progressNull,
    wouldSkip: skippedCls, oldVerdictTrue: oldVerdictTrue, oldVerdictOnlyTransition: oldVerdictOnlyTransition,
    sample: sample
  };
})()`;

const OUTCOME = `(function () {
  var all = Array.prototype.slice.call(document.querySelectorAll('.card, .app-main h1, .app-main h1 + p, .app-main h2, .app-main .search-capsule, .app-main header, .auth-card'));
  var isLight = location.pathname.indexOf('messages.html') !== -1;
  var n = isLight ? Math.min(all.length, 8) : all.length;
  var expected = all.slice(0, n);
  var welcome = document.querySelector('#welcomeBanner');
  if (welcome) { welcome = welcome.closest('.card'); }
  var started = (window.__p504 && window.__p504.started) || [];
  var missing = [];
  expected.forEach(function (el) {
    if (el === welcome) return;
    if (!el.getClientRects || el.getClientRects().length === 0) return; // 隐藏卡不渲染（既有口径）
    if (started.indexOf(el) === -1) missing.push(String(el.className || el.tagName).slice(0, 36));
  });
  var w = null;
  if (welcome) {
    w = { t: welcome.style.transition || '', o: welcome.style.opacity || '', wc: welcome.style.willChange || '', anim: getComputedStyle(welcome).animationName };
  }
  return {
    total: all.length, animatedScope: n, startedUnique: started.filter(function (e, i) { return started.indexOf(e) === i; }).length,
    missing: missing, welcome: w, dclPre: (window.__p504 && window.__p504.dclPre)
  };
})()`;

(async () => {
  console.log('═══ tmp-probe-guard-504.js — v0.2.50.4 守卫收窄机制探针 ═══');
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
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, user: { id: 'USR-demo-local', name: 'You', email: 'you@demo.local' } })) + ');}catch(e){}' + PROBE
    });

    const PAGES = [
      ['/index.html', 'dashboard 欢迎卡页'],
      ['/pages/messages.html', 'Messages LIGHT'],
      ['/pages/overview.html', 'overview'],
      ['/pages/explore.html', 'explore'],
      ['/pages/guidelines.html', 'guidelines'],
      ['/pages/construction.html', 'construction'],
      ['/signup-and-login', 'signup-and-login auth'],
      ['/forgot-password', 'forgot-password auth'],
      ['/pages/help.html', 'help'],
      ['/pages/workspace.html', 'workspace'],
      ['/pages/community-hub.html', 'community-hub'],
    ];

    for (const [url, label] of PAGES) {
      await cdp.send('Page.navigate', { url: BASE + url });
      await waitFor(cdp, "document.readyState === 'complete'", 30000, label + ' ready');
      await sleep(2800);
      const r = await cdp.evalJs(REPLAY);
      const o = await cdp.evalJs(OUTCOME);
      console.log('── ' + label + ' ' + url);
      console.log('   boot 捕获：calls=' + r.bootCalls + ' 含过渡=' + r.sawTransition + ' 含CSS动画=' + r.sawCssAnim +
        ' headless相位active=' + r.headlessPhaseActive + ' progress=null=' + r.progressNull);
      console.log('   样本：' + r.sample);
      console.log('   新守卫 would-skip：' + JSON.stringify(r.wouldSkip) + ' | 老守卫真判=' + r.oldVerdictTrue + ' 其中纯过渡=' + r.oldVerdictOnlyTransition);
      console.log('   波浪结果：CARD_SELECTOR=' + o.total + ' 动画范围=' + o.animatedScope + ' transitionstart目标=' + o.startedUnique +
        ' 漏动画=' + JSON.stringify(o.missing) + ' dclPre=' + o.dclPre);
      if (o.welcome) console.log('   欢迎卡：' + JSON.stringify(o.welcome));
      if (o.total === 0) {
        console.log('   （页面无 CARD_SELECTOR 元素——切页波浪天然不作用于此页，既有设计）');
        ok(label + ' P0 页面无 CARD_SELECTOR（波浪设计外，无断言目标）', true, 'total=0');
        continue;
      }
      const isIndex = url === '/index.html';
      ok(label + ' P2 修复后每张可见非欢迎卡都收到波浪（漏动画=0）', o.missing.length === 0, o.missing.length ? 'missing=' + o.missing.join(',') : '全到');
      ok(label + ' P3 新守卫 would-skip 集合正确' + (isIndex ? '（仅欢迎卡）' : '（空）'),
        isIndex ? (r.wouldSkip.length === 1 && r.wouldSkip[0].indexOf('tilt-container') !== -1) : r.wouldSkip.length === 0,
        'skip=' + JSON.stringify(r.wouldSkip));
      if (o.welcome) {
        ok(label + ' P4 欢迎卡零内联三值 + fadeInUp 关键帧在', o.welcome.t === '' && o.welcome.o === '' && o.welcome.wc === '' && o.welcome.anim.indexOf('fadeInUp') !== -1, JSON.stringify(o.welcome));
      }
    }

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
  console.log('\n🎉 探针完成 ' + pass + '/' + (pass + fail) + (fail ? '（有失败！）' : ''));
  process.exit(fail ? 1 : 0);
})();
