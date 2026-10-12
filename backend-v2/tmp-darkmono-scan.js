// tmp-darkmono-scan.js — 深色模式侧边栏/发白元素定位（2026-09-10 v2）
// 用户「按钮怎么变成灰色的了 + 卡片中间那个白色还是一样」→「侧边栏选中态白色 + 侧边栏容器白边框/阴影」。
// v2：不开弹窗扫主页面；深色蓝 / 深色 mono 双模式各扫一遍；
// 直接 dump 侧边栏相关计算样式（bg/color/border/shadow/animation），并列出所有发白元素 + ghost 按钮。
// 跑法：node tmp-darkmono-scan.js [pages/overview.html]
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3910 + Math.floor(Math.random() * 400);
const CDP_PORT = 4910 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-darkmono-' + Date.now());
const TARGET = (process.argv[2] && process.argv[2][0] === '/' ? process.argv[2] : '/' + (process.argv[2] || '')) || '/pages/overview.html';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => {
        if (e2) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b2);
      });
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
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.errs.push(m.params.exceptionDetails.text || 'exception');
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + r.exceptionDetails.text);
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => server.listen(PORT, r));
  let chromePath = null;
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
    await sleep(250);
  }
  if (!up) throw new Error('CDP 没起来');
  const pageInfo = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' })).json();
  const cdp = new CDP(pageInfo.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const DUMP = `(() => {
    var r = {};
    var gs = function (el) { return el ? getComputedStyle(el) : null; };
    var sb = document.getElementById('slati-sidebar');
    var cs = gs(sb);
    r.theme = document.documentElement.getAttribute('data-theme');
    r.accent = document.documentElement.getAttribute('data-accent');
    r.vars = {};
    ['--card-bg','--card-border','--shadow-md','--sidebar-bg','--sidebar-border','--color-primary','--btn-ghost-hover'].forEach(function(v){ r.vars[v] = gs(document.documentElement).getPropertyValue(v).trim(); });
    r.sidebar = cs ? { bg: cs.backgroundColor, bgImg: cs.backgroundImage.slice(0,50), border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor, shadow: cs.boxShadow.slice(0,60) } : null;
    r.modules = Array.from(document.querySelectorAll('#slati-sidebar .sidebar-module')).map(function(m){
      var c = gs(m);
      return { cls: m.className, bg: c.backgroundColor, border: c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + c.borderTopColor, shadow: c.boxShadow.slice(0,50) };
    });
    r.active = (function(){
      var a = document.querySelector('#slati-sidebar .nav-item.active');
      if (!a) return null;
      var c = gs(a);
      return { label: a.textContent.trim().slice(0,12), bg: c.backgroundColor, color: c.color, border: c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + c.borderTopColor, anim: c.animationName, animFill: c.animationFillMode };
    })();
    r.navItems = Array.from(document.querySelectorAll('#slati-sidebar .nav-item')).map(function(n){
      var c = gs(n); return { label: n.textContent.trim().slice(0,12), bg: c.backgroundColor, color: c.color, cls: n.className };
    });
    // 白系元素扫描（rgb 通道 ≥200 且 alpha>0.3 的背景，≥4px）
    r.white = [];
    var all = document.querySelectorAll('body *');
    for (var i = 0; i < all.length; i++) {
      var el = all[i]; var rc = el.getBoundingClientRect();
      if (rc.width < 4 || rc.height < 4) continue;
      var c = gs(el); var s = c.backgroundColor + ' ' + c.backgroundImage;
      var m = s.match(/rgba?\\(([^)]+)\\)/g) || [];
      var whiteish = m.filter(function (x) {
        var n = x.match(/[\\d.]+/g).map(Number);
        return n.length >= 3 && n[0] >= 200 && n[1] >= 200 && n[2] >= 200 && (n[3] === undefined || n[3] > 0.3);
      }).length > 0;
      if (whiteish) r.white.push((el.id ? '#' + el.id : '') + (typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : '') + ' [' + el.tagName.toLowerCase() + ' ' + Math.round(rc.width) + 'x' + Math.round(rc.height) + '] bgc=' + c.backgroundColor + (c.backgroundImage !== 'none' ? ' bgi=' + c.backgroundImage.slice(0,60) : ''));
    }
    r.white = r.white.slice(0, 25);
    // ghost 按钮
    r.ghost = Array.from(document.querySelectorAll('.btn-ghost.btn-icon.btn-sm')).map(function(b){
      var c = gs(b);
      return { id: b.id, bg: c.backgroundColor, html: b.outerHTML.slice(0,120) };
    });
    // btn-primary / toggle 实际计算值
    var bt = document.createElement('button'); bt.className = 'btn-primary';
    document.body.appendChild(bt);
    var bcs = gs(bt);
    r.btn = { bg: bcs.backgroundImage.replace(/\\s+/g, '').slice(0, 60), color: bcs.color, shadow: bcs.boxShadow.slice(0, 40) };
    bt.remove();
    var tog = document.querySelector('.toggle-switch.active');
    r.toggle = tog ? { bg: gs(tog).backgroundColor } : null;
    // 白→紫渐变元凶定位：所有背景含紫 129,39,207 的元素 + 所有 mn-ai-* 元素
    r.purple = [];
    var all2 = document.querySelectorAll('body *');
    for (var j = 0; j < all2.length; j++) {
      var e2 = all2[j]; var c2 = gs(e2);
      var bgi2 = c2.backgroundImage || '';
      var hit2 = bgi2.indexOf('129, 39, 207') !== -1 || bgi2.indexOf('rgb(129,39,207)') !== -1 || (typeof e2.className === 'string' && e2.className.indexOf('mn-ai') !== -1);
      if (hit2) {
        var rc2 = e2.getBoundingClientRect();
        r.purple.push({ tag: e2.tagName.toLowerCase(), cls: typeof e2.className === 'string' ? e2.className : '', id: e2.id, size: Math.round(rc2.width) + 'x' + Math.round(rc2.height), bgi: bgi2.slice(0,70), html: e2.outerHTML.slice(0,150) });
      }
    }
    // 弹窗打开后重扫 ghost（定位 28x28 神秘按钮）
    if (window.SlatiSettings && window.SlatiSettings.open) window.SlatiSettings.open();
    // 白光真身取证：lg-specular（镜面高光层，默认圆心=卡正中 rgba(255,255,255,0.16)）
    // 与 lg-backdrop、lg-orb-field——全站玻璃卡通用层，含设置弹窗 modal-card
    r.spec = Array.from(document.querySelectorAll('.lg-specular')).slice(0, 12).map(function (s) {
      var c = gs(s);
      var rc = s.getBoundingClientRect();
      var host = s.parentElement ? (s.parentElement.id ? '#' + s.parentElement.id : (typeof s.parentElement.className === 'string' ? s.parentElement.className.split(' ').slice(0, 2).join('.') : '')) : '';
      return { host: host, size: Math.round(rc.width) + 'x' + Math.round(rc.height), bg: c.backgroundImage.slice(0, 90), disp: c.display };
    });
    r.orb = Array.from(document.querySelectorAll('.lg-orb-field')).slice(0, 6).map(function (s) {
      var c = gs(s);
      return { bg: c.backgroundImage.slice(0, 90), disp: c.display };
    });
    return r;
  })()`;

  const MODES = [
    { theme: 'dark', accent: 'blue' },
    { theme: 'dark', accent: 'mono' }
  ];
  for (const mode of MODES) {
    const st = JSON.stringify({ theme: mode.theme, fontSize: 'medium', accent: mode.accent });
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + TARGET });
    await sleep(2000);
    await cdp.evalJs("localStorage.setItem('slati_settings', '" + st.replace(/'/g, "\\'") + "'); true");
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + TARGET });
    await sleep(2500);
    console.log('\n======== ' + mode.theme + '+' + mode.accent + ' ========');
    const wrapped = "(function(){ try { return " + DUMP + " } catch (e) { return { __err: e.message + ' @ ' + (e.stack || '').split(String.fromCharCode(10))[1] }; } })()";
    fs.writeFileSync(path.join(__dirname, 'tmp-dump-debug.js'), wrapped);
    const r = await cdp.evalJs(wrapped);
    console.log('vars: ' + JSON.stringify(r.vars));
    console.log('sidebar: ' + JSON.stringify(r.sidebar));
    console.log('modules: ' + JSON.stringify(r.modules));
    console.log('active: ' + JSON.stringify(r.active));
    console.log('navItems: ' + JSON.stringify(r.navItems));
    console.log('white-ish (' + r.white.length + '):');
    r.white.forEach(function (w) { console.log('  ' + w); });
    console.log('ghost btns: ' + JSON.stringify(r.ghost));
    console.log("purple/mn-ai: " + JSON.stringify(r.purple));
    console.log("btn: " + JSON.stringify(r.btn));
    console.log("specular: " + JSON.stringify(r.spec));
    console.log("orb: " + JSON.stringify(r.orb));
    console.log("toggle: " + JSON.stringify(r.toggle));
    console.log('console errors: ' + cdp.errs.length);
  }

  cdp.close();
  chrome.kill();
  server.close();
  process.exit(0);
})();
