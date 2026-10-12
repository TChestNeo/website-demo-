// tmp-fc-accent-v02816-probe.js — v0.2.28.16 FluidCanvas 主题色适配验证（2026-09-11）
// 背景：用户「FuildCanvas怎么还没做主题色的适配？我现在明明设置是黑白主题」——真身=FC 两页从未加载
//   settings-modal.js → data-accent 不落、mono 规则从未注入。本轮：两页接入 + FC 组件硬编码蓝紫翻黑白。
// 断言组：
//   F1-F3 静态：settings-modal.js 新 mono 规则在 + 两页 script 标签在 + JS 模板 var 化在；
//   M1 亮 mono（FC 首页）：data-accent=mono/light + 主次色令牌 + 各组件翻近黑族 + channelOverview 去蓝；
//   M2 暗 mono（FC 首页）：近白族 + 纯黑族覆写 + 悬停/拖拽态 + guest-module btn-primary mono 赢（0,4,1>0,3,1）；
//   M3/M4 编辑器亮/暗 mono：migrate-btn 黑灰/纯黑族渐变 + Draft badge + 药丸悬停灰层；
//   M5 亮 blue 回归：data-accent 不在 + 令牌原蓝紫 + 组件原蓝；
//   M6 暗 blue 回归：data-theme=dark + guest-module btn-primary 深靛蓝渐变（原覆写不被 mono 抢）；
//   M7 访客门禁回归：无 session → fc-guest + guest-hero 显示；
//   M8 overview mono 回归：既有页面行为不受新规则影响；
//   Z 全程零 console error。
// 跑法：node tmp-fc-accent-v02816-probe.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4410 + Math.floor(Math.random() * 400);
const CDP_PORT = 5410 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fcaccent16-' + Date.now());

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
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.exceptionDetails || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 300));
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

(async () => {
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name); } };

  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;

  // ── F1 静态：settings-modal.js 新 mono 规则在 ──
  const sm = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'settings-modal.js'), 'utf8');
  ok('F1 静态：settings-modal.js 新 mono 规则（次色家族/FC 组件/迁移钮/药丸/channelOverview）',
    sm.indexOf('--color-secondary: #4a4a56') !== -1 &&
    sm.indexOf('--color-secondary: #b0b0c2') !== -1 &&
    sm.indexOf('html[data-accent="mono"] .publish-btn { background: linear-gradient(135deg, #1c1c22, #3a3a46); }') !== -1 &&
    sm.indexOf('html[data-accent="mono"][data-theme="dark"] .publish-btn { background: linear-gradient(135deg, #1e1e2d, #32324a); color: #ffffff; }') !== -1 &&
    sm.indexOf('html[data-accent="mono"][data-theme="light"] .migrate-btn { background: linear-gradient(to right, #1c1c22, #3a3a46); }') !== -1 &&
    sm.indexOf('html[data-accent="mono"][data-theme="dark"] .migrate-btn { background: linear-gradient(to right, #1e1e2d, #32324a); }') !== -1 &&
    sm.indexOf('html[data-accent="mono"][data-theme="dark"] .channel-avatar') !== -1 &&
    sm.indexOf('html[data-accent="mono"] .cl-badge.article') !== -1 &&
    sm.indexOf('html[data-accent="mono"] .upload-zone.drag-over') !== -1 &&
    sm.indexOf('html[data-accent="mono"] #channelOverview') !== -1 &&
    sm.indexOf('html[data-accent="mono"] .migrate-pill::after { background-color: hsla(0 0% 45% / 0.75)') !== -1 &&
    sm.indexOf('html[data-accent="mono"][data-theme="dark"] .migrate-pill .sparkle .path { color: hsl(0 0% 40%)') !== -1);

  // ── F2/F3 静态：两页接入 + JS 模板 var 化 ──
  const fch = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas.html'), 'utf8');
  const fce = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  ok('F2 静态：FC 两页均接入 settings-modal.js',
    fch.indexOf('<script src="../assets/js/settings-modal.js"></script>') !== -1 &&
    fce.indexOf('<script src="../assets/js/settings-modal.js"></script>') !== -1);
  ok('F3 静态：JS 模板 var 化（TYPE_META.article 颜色+color-mix 底、Articles 指标、channel-avatar 类）',
    fch.indexOf("article:   { icon:'article',   color:'var(--color-primary)', bg:'color-mix(in srgb, var(--color-primary) 8%, transparent)'") !== -1 &&
    fch.indexOf("style=\"color:var(--color-primary)\">' + articles +") !== -1 &&
    fch.indexOf('class="channel-avatar"') !== -1);

  // ── Chrome CDP ──
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
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
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  const page = pages.find(x => x.type === 'page');
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable'); // 本机 Chrome 要求 DOM 先于 CSS enable，否则 CSS.enable 报「DOM agent needs to be enabled first」
  await cdp.send('CSS.enable');
  console.log('  ℹ CDP 就绪（Page/Runtime/DOM/CSS 均已 enable）');

  // 预置 localStorage（每轮导航前注册脚本，后注册者覆盖前者；try/catch 防 about:blank 无源报错）
  const preset = (settings, withSession) => cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{' +
      'localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify(settings)) + ');' +
      (withSession === true ? 'localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');'
        : withSession === false ? 'localStorage.removeItem("slati_session");' : '') +
      '}catch(e){}'
  });
  const nav = async (url, waitExpr, label) => {
    await cdp.send('Page.navigate', { url });
    await waitFor(cdp, waitExpr, 15000, label);
    await sleep(500);
  };
  const cs = (sel, prop, pseudo) => cdp.evalJs(
    '(() => { var el = document.querySelector(' + JSON.stringify(sel) + '); if (!el) return null;' +
    ' var st = getComputedStyle(el' + (pseudo ? ', ' + JSON.stringify(pseudo) : '') + '); return st.' + prop + '; })()');
  const cvar = (name) => cdp.evalJs('getComputedStyle(document.documentElement).getPropertyValue(' + JSON.stringify(name) + ').trim()');
  const docAttr = (name) => cdp.evalJs('document.documentElement.getAttribute(' + JSON.stringify(name) + ')');

  // ── M1 亮 mono（FC 首页）──
  await preset({ theme: 'light', accent: 'mono' }, true);
  await nav(BASE + '/pages/fluidcanvas.html', "document.querySelector('.studio-header')", 'M1 页面加载');
  let a = await docAttr('data-accent'), th = await docAttr('data-theme');
  ok('M1 亮 mono：data-accent=mono + data-theme=light', a === 'mono' && th === 'light');
  ok('M1 亮 mono：令牌主色 #1c1c22 次色 #4a4a56', (await cvar('--color-primary')) === '#1c1c22' && (await cvar('--color-secondary')) === '#4a4a56');
  let bg = await cs('.publish-btn', 'backgroundImage');
  ok('M1 亮 mono：publish-btn 黑灰渐变（#1c1c22→#3a3a46）', bg !== null && bg.indexOf('rgb(28, 28, 34)') !== -1 && bg.indexOf('rgb(58, 58, 70)') !== -1);
  await cdp.evalJs('document.querySelector(".upload-zone").classList.add("drag-over")');
  await sleep(350);
  ok('M1 亮 mono：upload-zone drag-over 边框+图标近黑',
    (await cs('.upload-zone.drag-over', 'borderTopColor')) === 'rgb(28, 28, 34)' &&
    (await cs('.upload-zone.drag-over .upload-zone-icon', 'color')) === 'rgb(28, 28, 34)');
  ok('M1 亮 mono：file-info-bar 中性底+边框',
    (await cs('#fileInfoBar', 'borderTopColor')) === 'rgba(28, 28, 34, 0.12)');
  ok('M1 亮 mono：channel-avatar 黑灰渐变（#1c1c22→#4a4a56）',
    (await cs('.channel-avatar', 'backgroundImage')) !== null && (await cs('.channel-avatar', 'backgroundImage')).indexOf('rgb(28, 28, 34)') !== -1 && (await cs('.channel-avatar', 'backgroundImage')).indexOf('rgb(74, 74, 86)') !== -1);
  ok('M1 亮 mono：channelOverview 去蓝（!important 压内联）',
    (await cs('#channelOverview', 'backgroundImage')).indexOf('70, 72, 212') === -1);
  // 点 Upload 导航初始化（renderTargets + renderRecentUploads 只在首次进视图跑）
  await cdp.evalJs("document.querySelector('.nav-item[data-view=\"upload\"]').click()");
  await waitFor(cdp, "document.querySelector('#uploadView .target-card')", 4000, 'M1 上传视图初始化');
  await sleep(1200); // 等切换动画收尾 + _switchLock 释放，防下一视图点击被吞
  await cdp.evalJs("document.querySelector('#uploadView .target-card').classList.add('selected')");
  await sleep(300); // border-color 0.15s 过渡竞态
  ok('M1 亮 mono：target-card.selected 近黑边框+图标',
    (await cs('.target-card.selected', 'borderTopColor')) === 'rgb(28, 28, 34)' &&
    (await cs('.target-card.selected .target-icon', 'color')) === 'rgb(28, 28, 34)');
  ok('M1 亮 mono：recent-target-badge 近黑字',
    (await cs('.recent-target-badge', 'color')) === 'rgb(28, 28, 34)');
  // 点 Content 导航初始化（renderCLStats + renderCLList）
  await cdp.evalJs("document.querySelector('.nav-item[data-view=\"content\"]').click()");
  await waitFor(cdp, "document.querySelector('#clList .cl-badge.article')", 4000, 'M1 内容库初始化');
  ok('M1 亮 mono：cl-badge.article 近黑字',
    (await cs('.cl-badge.article', 'color')) === 'rgb(28, 28, 34)');
  ok('M1 亮 mono：cl-type-icon（inline var 化）近黑字',
    (await cdp.evalJs('(function(){ var els = document.querySelectorAll("#clList .cl-type-icon"); for (var i=0;i<els.length;i++){ if ((els[i].getAttribute("style")||"").indexOf("var(--color-primary)") !== -1) return getComputedStyle(els[i]).color; } return null; })()')) === 'rgb(28, 28, 34)');
  ok('M1 亮 mono：clStats Articles 指标近黑字（var 化）',
    (await cdp.evalJs('(function(){ var els = document.querySelectorAll("#clStats .metric-value"); for (var i=0;i<els.length;i++){ if ((els[i].getAttribute("style")||"").indexOf("var(--color-primary)") !== -1) return getComputedStyle(els[i]).color; } return null; })()')) === 'rgb(28, 28, 34)');

  // ── M2 暗 mono（FC 首页）──
  await preset({ theme: 'dark', accent: 'mono' }, true);
  await nav(BASE + '/pages/fluidcanvas.html', "document.querySelector('.studio-header')", 'M2 页面加载');
  a = await docAttr('data-accent'); th = await docAttr('data-theme');
  ok('M2 暗 mono：data-accent=mono + data-theme=dark', a === 'mono' && th === 'dark');
  ok('M2 暗 mono：令牌主色 #ececf2 次色 #b0b0c2', (await cvar('--color-primary')) === '#ececf2' && (await cvar('--color-secondary')) === '#b0b0c2');
  bg = await cs('.publish-btn', 'backgroundImage');
  ok('M2 暗 mono：publish-btn 纯黑族渐变+白字（#1e1e2d→#32324a）',
    bg !== null && bg.indexOf('rgb(30, 30, 45)') !== -1 && bg.indexOf('rgb(50, 50, 74)') !== -1 &&
    (await cs('.publish-btn', 'color')) === 'rgb(255, 255, 255)');
  // 悬停态：CSS.forcePseudoState
  let doc = await cdp.send('DOM.getDocument', { depth: -1 });
  let qr = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '.upload-zone' });
  await cdp.send('CSS.forcePseudoState', { nodeId: qr.nodeId, forcedPseudoClasses: ['hover'] });
  await sleep(350);
  ok('M2 暗 mono：upload-zone 悬停近白边框（rgba(236,236,242,0.35)）',
    (await cs('.upload-zone', 'borderTopColor')) === 'rgba(236, 236, 242, 0.35)');
  await cdp.evalJs('document.querySelector(".upload-zone").classList.add("drag-over")');
  await sleep(350);
  ok('M2 暗 mono：upload-zone drag-over 边框+图标近白',
    (await cs('.upload-zone.drag-over', 'borderTopColor')) === 'rgb(236, 236, 242)' &&
    (await cs('.upload-zone.drag-over .upload-zone-icon', 'color')) === 'rgb(236, 236, 242)');
  ok('M2 暗 mono：file-info-bar 中性底+边框',
    (await cs('#fileInfoBar', 'borderTopColor')) === 'rgba(255, 255, 255, 0.12)');
  ok('M2 暗 mono：channel-avatar 纯黑族渐变（!important 压内联 var 渐变）',
    (await cs('.channel-avatar', 'backgroundImage')).indexOf('rgb(30, 30, 45)') !== -1 &&
    (await cs('.channel-avatar', 'backgroundImage')).indexOf('rgb(50, 50, 74)') !== -1);
  ok('M2 暗 mono：channelOverview 去蓝（!important 压内联）',
    (await cs('#channelOverview', 'backgroundImage')).indexOf('70, 72, 212') === -1);
  // guest-module 是访客门禁组件，登录态不渲染 → 注入 fixture 验证特异性链（0,4,1 > 0,3,1）
  await cdp.evalJs('(function(){ var d = document.createElement("div"); d.className = "guest-module"; d.innerHTML = \'<button class="btn-primary">x</button>\'; document.body.appendChild(d); })()');
  ok('M2 暗 mono：guest-module btn-primary mono 黑族赢（0,4,1 > 0,3,1）',
    (await cs('.guest-module .btn-primary', 'backgroundImage')) !== null &&
    (await cs('.guest-module .btn-primary', 'backgroundImage')).indexOf('rgb(30, 30, 45)') !== -1);
  await cdp.evalJs("document.querySelector('.nav-item[data-view=\"upload\"]').click()");
  await waitFor(cdp, "document.querySelector('#uploadView .target-card')", 4000, 'M2 上传视图初始化');
  await sleep(1200); // 等切换动画收尾 + _switchLock 释放
  await cdp.evalJs("document.querySelector('#uploadView .target-card').classList.add('selected')");
  await sleep(300); // border-color 0.15s 过渡竞态
  ok('M2 暗 mono：target-card.selected 近白边框+图标',
    (await cs('.target-card.selected', 'borderTopColor')) === 'rgb(236, 236, 242)' &&
    (await cs('.target-card.selected .target-icon', 'color')) === 'rgb(236, 236, 242)');
  ok('M2 暗 mono：recent-target-badge 近白字',
    (await cs('.recent-target-badge', 'color')) === 'rgb(236, 236, 242)');
  await cdp.evalJs("document.querySelector('.nav-item[data-view=\"content\"]').click()");
  await waitFor(cdp, "document.querySelector('#clList .cl-badge.article')", 4000, 'M2 内容库初始化');
  ok('M2 暗 mono：cl-badge.article 近白字',
    (await cs('.cl-badge.article', 'color')) === 'rgb(236, 236, 242)');
  ok('M2 暗 mono：cl-type-icon（inline var 化）近白字',
    (await cdp.evalJs('(function(){ var els = document.querySelectorAll("#clList .cl-type-icon"); for (var i=0;i<els.length;i++){ if ((els[i].getAttribute("style")||"").indexOf("var(--color-primary)") !== -1) return getComputedStyle(els[i]).color; } return null; })()')) === 'rgb(236, 236, 242)');

  // ── M3/M4 编辑器 mono ──
  await preset({ theme: 'light', accent: 'mono' }, true);
  await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn')", 'M3 编辑器加载');
  ok('M3 亮 mono 编辑器：data-accent=mono + migrate-btn 黑灰渐变',
    (await docAttr('data-accent')) === 'mono' &&
    (await cs('.migrate-btn', 'backgroundImage')).indexOf('rgb(28, 28, 34)') !== -1 &&
    (await cs('.migrate-btn', 'backgroundImage')).indexOf('rgb(58, 58, 70)') !== -1);
  ok('M3 亮 mono 编辑器：Draft badge 灰字（次色 #4a4a56）+ 中性底',
    (await cs('.badge-secondary', 'color')) === 'rgb(74, 74, 86)');
  ok('M3 亮 mono 编辑器：migrate 弹窗药丸悬停灰层（紫层翻灰）',
    (await (async () => {
      const d2 = await cdp.send('DOM.getDocument', { depth: -1 });
      const q2 = await cdp.send('DOM.querySelector', { nodeId: d2.root.nodeId, selector: '.migrate-pill' });
      if (!q2.nodeId) return false;
      await cdp.send('CSS.forcePseudoState', { nodeId: q2.nodeId, forcedPseudoClasses: ['hover'] });
      await sleep(350);
      const v = await cs('.migrate-pill', 'backgroundColor', '::after');
      return v !== null && v.indexOf('115, 115, 115') !== -1;
    })()));

  await preset({ theme: 'dark', accent: 'mono' }, true);
  await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn')", 'M4 编辑器加载');
  ok('M4 暗 mono 编辑器：migrate-btn 纯黑族渐变',
    (await cs('.migrate-btn', 'backgroundImage')).indexOf('rgb(30, 30, 45)') !== -1 &&
    (await cs('.migrate-btn', 'backgroundImage')).indexOf('rgb(50, 50, 74)') !== -1);
  ok('M4 暗 mono 编辑器：Draft badge 亮灰字（次色 #b0b0c2）',
    (await cs('.badge-secondary', 'color')) === 'rgb(176, 176, 194)');
  ok('M4 暗 mono 编辑器：药丸星芒深紫翻灰（hsl(0 0% 40%)）',
    (await cs('.migrate-pill .sparkle .path', 'color')) === 'rgb(102, 102, 102)');

  // ── M5 亮 blue 回归 ──
  await preset({ theme: 'light', accent: 'blue' }, true);
  await nav(BASE + '/pages/fluidcanvas.html', "document.querySelector('.studio-header')", 'M5 页面加载');
  ok('M5 亮 blue：data-accent 不在 + 令牌原蓝紫',
    (await docAttr('data-accent')) === null &&
    (await cvar('--color-primary')) === '#4648d4' && (await cvar('--color-secondary')) === '#8127cf');
  ok('M5 亮 blue：publish-btn 原蓝渐变',
    (await cs('.publish-btn', 'backgroundImage')).indexOf('rgb(70, 72, 212)') !== -1);
  await cdp.evalJs("document.querySelector('.nav-item[data-view=\"content\"]').click()");
  await waitFor(cdp, "document.querySelector('#clList .cl-badge.article')", 4000, 'M5 内容库初始化');
  ok('M5 亮 blue：cl-badge.article 原蓝字',
    (await cs('.cl-badge.article', 'color')) === 'rgb(70, 72, 212)');
  ok('M5 亮 blue：channelOverview 原蓝紫渐变（内联不受影响）',
    (await cs('#channelOverview', 'backgroundImage')).indexOf('70, 72, 212') !== -1);

  // ── M6 暗 blue 回归 ──
  await preset({ theme: 'dark', accent: 'blue' }, true);
  await nav(BASE + '/pages/fluidcanvas.html', "document.querySelector('.studio-header')", 'M6 页面加载');
  ok('M6 暗 blue：data-theme=dark + data-accent 不在 + 页面深底',
    (await docAttr('data-theme')) === 'dark' && (await docAttr('data-accent')) === null &&
    (await cs('body', 'backgroundColor')) === 'rgb(22, 22, 37)');
  await cdp.evalJs('(function(){ var d = document.createElement("div"); d.className = "guest-module"; d.innerHTML = \'<button class="btn-primary">x</button>\'; document.body.appendChild(d); })()');
  ok('M6 暗 blue：guest-module btn-primary 原深靛蓝渐变（mono 不抢）',
    (await cs('.guest-module .btn-primary', 'backgroundImage')).indexOf('rgb(35, 35, 58)') !== -1);

  // ── M7 访客门禁回归（无 session）──
  await preset({ theme: 'light', accent: 'mono' }, false);
  await nav(BASE + '/pages/fluidcanvas.html', "document.querySelector('.fc-locked-hero')", 'M7 页面加载');
  ok('M7 访客门禁：fc-guest 类 + fc-locked-hero 显示 + studio-main 隐藏',
    (await cdp.evalJs('document.documentElement.classList.contains("fc-guest")')) === true &&
    (await cs('.fc-locked-hero', 'display')) !== 'none' &&
    (await cs('.studio-main', 'display')) === 'none');

  // ── M8 overview mono 回归 ──
  await preset({ theme: 'light', accent: 'mono' }, true);
  await nav(BASE + '/pages/overview.html', "document.documentElement.getAttribute('data-accent') === 'mono'", 'M8 overview 加载');
  ok('M8 overview mono 回归：data-accent=mono + 主色 #1c1c22 + 页面正常',
    (await docAttr('data-accent')) === 'mono' && (await cvar('--color-primary')) === '#1c1c22');

  // ── Z 零 console error ──
  ok('Z 全程零 console error（' + cdp.errs.length + ' 条）', cdp.errs.length === 0);
  if (cdp.errs.length) console.log(cdp.errs.slice(0, 8).join('\n'));

  console.log('\n========== 结果：' + pass + ' 过 / ' + fail + ' 挂 ==========');
  cdp.close();
  chrome.kill();
  server.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('💥 探针异常：', e); process.exit(2); });
