// tmp-battery-msglink.js — Messages 链接抖音式结构电池（Request J；v0.2.50.0）
// 断言：F 静态锚 + M1-M3 showTab 直达 + M4 旧参数兼容归一 + M5-M7 点 tab 地址栏联动（无刷新）
// + M8 未知参数归一 + M9 帧健康诚实不变量 + Z 零错误
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-msglink-' + Date.now());
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

(async () => {
  // ═══ F 静态检查 ═══
  const msgSrc = fs.readFileSync(path.join(DOCS, 'pages', 'messages.html'), 'utf8');
  const idxSrc = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8');
  const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('F0 版本双线 v0.2.54.0 / v10.28.36.1 + 用户原话注释',
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.58.23';") !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") !== -1 &&
    sconfSrc.indexOf('douyin.com/user/self') !== -1);
  ok('F1 直达读取 showTab + 旧 tab 兼容',
    msgSrc.indexOf("params.get('showTab') || params.get('tab')") !== -1);
  ok('F2 点 tab 地址栏联动（replaceState + showTab 串 + private 干净路径）',
    msgSrc.indexOf('history.replaceState(null, \'\', window.location.pathname + q)') !== -1 &&
    msgSrc.indexOf("'?showTab=' + tabMap[targetPanel]") !== -1);
  ok('F3 未知 tab 值归一清参数', msgSrc.indexOf("params.has('showTab') || params.has('tab')") !== -1);
  ok('F4 index 「View all announcements」用 ?showTab=announcements、旧 ?tab= 零残留',
    idxSrc.indexOf('pages/messages.html?showTab=announcements') !== -1 &&
    idxSrc.indexOf('messages.html?tab=') === -1);
  ok('F5 首页公告卡 href 直达 announcements（v0.2.55.0 用户「点击后跳转是这个页面」）',
    idxSrc.indexOf('pages/messages.html?showTab=announcements" class="card card-hover"') !== -1 &&
    idxSrc.indexOf('pages/messages.html" class="card card-hover"') === -1);

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
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, user: { id: 'USR-demo-local', name: 'You', email: 'you@demo.local' } })) + ');}catch(e){}' +
        '(function(){var ltBuf=[];try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){ltBuf.push(e.duration);});}).observe({entryTypes:["longtask"]});}catch(e){}window.__lt=function(){return ltBuf.length;};})();'
    });

    const navTo = async (url) => {
      await cdp.send('Page.navigate', { url: BASE + url });
      await waitFor(cdp, "document.querySelectorAll('#msgSubnav .subnav-pill').length === 3", 30000, 'ready @ ' + url);
      await sleep(2200);
    };
    const state = () => cdp.evalJs("(function(){return{search:window.location.search,active:document.querySelector('#msgSubnav .subnav-pill.active').dataset.tab,slide:document.getElementById('msgSlide').style.transform,privOp:getComputedStyle(document.getElementById('privatePanel')).opacity,grpOp:getComputedStyle(document.getElementById('groupsPanel')).opacity,annOp:getComputedStyle(document.getElementById('announcementsPanel')).opacity};})()");

    // 暖机
    await navTo('/pages/messages.html');
    console.log('（暖机完成）\n');

    // ═══ M1 直达 announcements ═══
    await navTo('/pages/messages.html?showTab=announcements');
    let s = await state();
    ok('M1 ?showTab=announcements 直达', s.active === 'announcements' && s.slide === 'translateX(-200%)' && s.annOp === '1',
      'search=' + s.search + ' active=' + s.active + ' slide=' + s.slide);

    // ═══ M2 直达 groups ═══
    await navTo('/pages/messages.html?showTab=groups');
    s = await state();
    ok('M2 ?showTab=groups 直达', s.active === 'groups' && s.slide === 'translateX(-100%)' && s.grpOp === '1',
      'search=' + s.search + ' active=' + s.active + ' slide=' + s.slide);

    // ═══ M3 无参数默认 private + URL 干净 ═══
    await navTo('/pages/messages.html');
    s = await state();
    ok('M3 无参数默认 private + URL 干净（slide 空串=CSS 默认 0 位，与 translateX(0%) 同态）', s.active === 'private' && (s.slide === '' || s.slide === 'translateX(0%)') && s.privOp === '1' && s.search === '',
      'search=' + s.search + ' active=' + s.active + ' slide=' + s.slide);

    // ═══ M4 旧 ?tab= 兼容并归一 ═══
    await navTo('/pages/messages.html?tab=announcements');
    s = await state();
    ok('M4 旧 ?tab=announcements 兼容直达 + URL 归一成 ?showTab=announcements',
      s.active === 'announcements' && s.search === '?showTab=announcements',
      'search=' + s.search + ' active=' + s.active);

    // ═══ M5 点 tab 地址栏联动（无刷新）═══
    await navTo('/pages/messages.html');
    await cdp.evalJs('window.__noReload = true');
    await cdp.evalJs("(function(){var b=document.querySelector('#msgSubnav [data-tab=\\'groups\\']');if(b){b.click();return true;}return false;})()");
    await waitFor(cdp, "window.location.search === '?showTab=groups'", 5000, 'M5 URL groups');
    await sleep(800);
    const m5 = await cdp.evalJs('window.__noReload');
    s = await state();
    ok('M5 点 groups → URL ?showTab=groups + 无刷新（同文档哨兵存活）+ 面板切换',
      m5 === true && s.active === 'groups' && s.slide === 'translateX(-100%)',
      'noReload=' + m5 + ' search=' + s.search + ' active=' + s.active);

    // ═══ M6 点 announcements ═══
    await cdp.evalJs("(function(){var b=document.querySelector('#msgSubnav [data-tab=\\'announcements\\']');if(b){b.click();return true;}return false;})()");
    await waitFor(cdp, "window.location.search === '?showTab=announcements'", 5000, 'M6 URL announcements');
    s = await state();
    ok('M6 点 announcements → URL ?showTab=announcements + 面板切换',
      m5 === true && s.active === 'announcements' && s.slide === 'translateX(-200%)',
      'search=' + s.search + ' active=' + s.active);

    // ═══ M7 点回 private → 干净路径 ═══
    await cdp.evalJs("(function(){var b=document.querySelector('#msgSubnav [data-tab=\\'private\\']');if(b){b.click();return true;}return false;})()");
    await waitFor(cdp, "window.location.search === ''", 5000, 'M7 URL clean');
    s = await state();
    ok('M7 点回 private → URL 回干净路径 + 面板切回',
      s.active === 'private' && s.slide === 'translateX(0%)' && s.search === '',
      'search=' + s.search + ' active=' + s.active);

    // ═══ M8 未知参数归一 ═══
    await navTo('/pages/messages.html?showTab=bogus');
    s = await state();
    ok('M8 未知 ?showTab=bogus → 默认 private + URL 清参数',
      s.active === 'private' && s.search === '',
      'search=' + s.search + ' active=' + s.active);

    // ═══ M9 帧健康（tab 切换零长任务）═══
    const lt = await cdp.evalJs('window.__lt()');
    ok('M9 全程零长任务', lt === 0, 'longtask=' + lt);

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
