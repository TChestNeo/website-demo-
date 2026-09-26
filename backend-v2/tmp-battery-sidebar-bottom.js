// tmp-battery-sidebar-bottom.js — v0.2.53.3 左侧菜单底部空白面板去掉电池（S 静态 + B 亮色浏览器 + D 暗色浏览器）
// 用户「那个左侧菜单的底部背景能不能去掉？或者变成刚才给你的那个液态玻璃或者只保留那个用户卡片，logo卡片 还有菜单卡片？」
//   → 问询钦定「去掉空白面板（推荐）」：菜单卡不再 flex:1 拉伸到屏幕底部，高度收为内容高
// 断言：sidebar.js 菜单卡 inline style 无 flex:1 / 侧栏恰三卡（logo/用户/菜单）/ 菜单卡高度=内容高（不拖空白板）
//       / 菜单卡下方零 painted 元素（纯色侧栏底）/ 侧栏底保持上轮钦定纯色不透明 / 暗色同口径
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4950 + Math.floor(Math.random() * 80);
const CDP_PORT = 5950 + Math.floor(Math.random() * 80);
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-sidebar-bottom-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};

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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const GEOM = `(function () {
  var sb = document.getElementById('slati-sidebar');
  var nav = sb.querySelector('.nav-module');
  var navR = nav.getBoundingClientRect();
  var items = nav.querySelectorAll('.nav-item');
  var lastR = items[items.length - 1].getBoundingClientRect();
  var cs = getComputedStyle(nav);
  var padB = parseFloat(cs.paddingBottom);
  var contentH = lastR.bottom - navR.top; // 内容高（含 padding-top）
  var diff = navR.height - (contentH + padB); // 0 = 收内容高；>0 = 拉伸空白
  var sbR = sb.getBoundingClientRect();
  // 菜单卡下方（不含菜单卡自身及其子孙）零 painted 元素 → 下方只留纯色侧栏底
  var belowPainted = [];
  var all = sb.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    if (el === nav || nav.contains(el)) continue;
    if (el === sb) continue;
    var c = getComputedStyle(el);
    if (c.display === 'none' || c.visibility === 'hidden') continue;
    var r = el.getBoundingClientRect();
    if (r.height < 2 || r.top < navR.bottom - 2) continue;
    var painted = c.backgroundColor !== 'rgba(0, 0, 0, 0)' || c.backgroundImage !== 'none';
    if (painted) belowPainted.push(String(el.className).slice(0, 50) + ':' + c.backgroundColor);
  }
  return {
    innerHeight: window.innerHeight,
    theme: document.documentElement.getAttribute('data-theme') || 'light',
    kids: Array.prototype.map.call(sb.children, function (c) { return String(c.className).split(' ').slice(0, 2).join('.'); }),
    navBottom: Math.round(navR.bottom), sbBottom: Math.round(sbR.bottom),
    diff: Math.round(diff), scrollEq: nav.scrollHeight === nav.clientHeight,
    scrollPair: [nav.scrollHeight, nav.clientHeight],
    sbBg: getComputedStyle(sb).backgroundColor,
    belowPainted: belowPainted
  };
})()`;

(async () => {
  // ═══ S 静态 ═══
  console.log('═══ S. 静态（sidebar.js + site-config）═══');
  const sbSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'sidebar.js'), 'utf8');
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('S1 sidebar.js 菜单卡 inline style 无 flex:1（v0.2.53.3 收内容高）',
    sbSrc.indexOf('style="flex:1;overflow-y:auto') === -1 &&
    sbSrc.indexOf('style="overflow-y:auto;padding:var(--space-sm)"') !== -1);
  ok('S2 sidebar.js v0.2.53.3 注释含用户原话 + 问询钦定',
    sbSrc.indexOf('v0.2.53.3') !== -1 && sbSrc.indexOf('左侧菜单的底部背景能不能去掉') !== -1 &&
    sbSrc.indexOf('去掉空白面板') !== -1);
  ok('S3 site-config 版本 = v0.2.54.0', sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.58.7';") !== -1);
  ok('S4 site-config changelog 含 v0.2.54.0 条目 + FC 零改动',
    sconf.indexOf('v0.2.54.0 = 全站 12 语言 i18n') !== -1 &&
    sconf.indexOf('FC v10.28.36.1 零改动') !== -1);

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
    '--window-size=1920,1080', '--remote-debugging-port=' + CDP_PORT,
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
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, user: { id: 'USR-000001', name: 'Neo', email: 'neo@mn.world', tier: 'premium' } })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/index.html' });
    await sleep(2500);
    for (let i = 0; i < 40; i++) {
      const done = await cdp.evalJs('!!(document.querySelector(".nav-module"))');
      if (done) break;
      await sleep(200);
    }
    await sleep(800);

    // ═══ B 亮色 ═══
    console.log('═══ B. 亮色浏览器（1920×1080）═══');
    let g = await cdp.evalJs(GEOM);
    ok('B1 侧栏恰三卡且顺序 = brand/user/nav', g.kids.length === 3 &&
      g.kids[0] === 'sidebar-module.brand-module' && g.kids[1] === 'sidebar-module.user-module' && g.kids[2] === 'sidebar-module.nav-module',
      JSON.stringify(g.kids));
    ok('B2 菜单卡收内容高（高度-内容高 <= 6px；旧版拉伸会多出整块空白）', Math.abs(g.diff) <= 6,
      'diff=' + g.diff + ' navBottom=' + g.navBottom + ' sbBottom=' + g.sbBottom + ' innerH=' + g.innerHeight);
    ok('B3 菜单卡下方零 painted 元素（下方只留纯色侧栏底）', g.belowPainted.length === 0, JSON.stringify(g.belowPainted));
    ok('B4 侧栏底保持上轮钦定纯色不透明（rgba(255,255,255,0.95)）', g.sbBg === 'rgba(255, 255, 255, 0.95)', g.sbBg);

    // ═══ D 暗色 ═══
    console.log('═══ D. 暗色浏览器 ═══');
    await cdp.evalJs('document.documentElement.setAttribute("data-theme","dark");');
    await sleep(600);
    g = await cdp.evalJs(GEOM);
    ok('D1 暗色菜单卡同样收内容高（高度-内容高 <= 6px）', Math.abs(g.diff) <= 6, 'diff=' + g.diff);
    ok('D2 暗色菜单卡下方零 painted 元素', g.belowPainted.length === 0, JSON.stringify(g.belowPainted));
    ok('D3 暗色侧栏底保持纯色不透明（rgb(26, 26, 46)）', g.sbBg === 'rgb(26, 26, 46)', g.sbBg);
    cdp.close();
  } catch (e) {
    fail++;
    console.error('  ❌ 浏览器阶段异常：', e && e.message);
  }
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  server.close();
  console.log('\nsidebar-bottom：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})();
