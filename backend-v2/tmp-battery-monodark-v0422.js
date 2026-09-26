// tmp-battery-monodark-v0422.js — v0.2.44.1 / FC v10.28.33.1 mono 暗色背景翻黑族+白底白字按钮电池
// 2026-09-16 复跑（v0.2.49.1 切页闪修复轮）：mono 规则已自 settings-modal.js 运行时注入迁入 ethereal.css——F 静态检查改读
// ethereal.css，浏览器计算态断言不变（规则只是换了家：运行时注入 → 内联静态首帧）
// 2026-09-17 加 M5/M6（v0.2.49.2 白底白字适配轮）：messages msg-acc / explore world-code-chip / help step-num
// mono dark 深底断言 + registry/admin 全暗色修复断言（M6 暗蓝回归不误伤）
// 2026-09-17 加 F5（v0.2.49.3 白底白字第二轮）：admin 裸 .btn 泛化规则静态锚（面板 JS 渲染按钮族；
// 运行时面板态由 tmp-battery-admin-dark.js 22/22 常驻覆盖，静态壳不可达）
// 用户「把黑白主题的深色模式背景颜色改成黑色系的而不是原本的蓝色 + FC 里有一些按钮在深色的黑白主题下是白底白字」
// 验证：①暗 mono 表面令牌全中性黑族（body/卡片/网格画布/输入框/子导航/侧栏/弹窗/toast）
//      ②active 按钮族+tim-search 按钮=#32324a 白字（v0.2.28.15 用户钦定配方保留）
//      ③整页扫描零蓝 tint 深底（钦定按钮族除外）+ 零白底白字（半透明白覆层豁免）
//      ④回归：亮 mono 不变、暗蓝 #161625 不变、零 console error。
// （house CDP 模式；截图全黑纪律，无截图依赖）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-monodark-batt-' + Date.now());
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

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}

// 页面内扫描（与发现探针同款）：蓝 tint 深底 + 白底白字全量清单（豁免判定放电池侧）
const SCAN = `(function(){
  function rgbOf(st) {
    var m = (st.backgroundColor || '').match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }
  function hueSatLight(r, g, b) {
    r/=255; g/=255; b/=255;
    var mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx-mn;
    var h = 0;
    if (d > 0) {
      if (mx === r) h = ((g-b)/d) % 6;
      else if (mx === g) h = (b-r)/d + 2;
      else h = (r-g)/d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    var l = (mx+mn)/2, s = d === 0 ? 0 : d / (1 - Math.abs(2*l-1));
    return { h: h, s: s, l: l };
  }
  var out = { blueBgs: [], whiteBtns: [], tokens: {}, body: null, accent: document.documentElement.getAttribute('data-accent'),
              theme: document.documentElement.getAttribute('data-theme') };
  var cs = getComputedStyle(document.documentElement);
  ['--color-background','--card-bg','--subnav-bg','--sidebar-bg','--input-bg','--input-bg-focus','--modal-bg',
   '--color-surface','--color-surface-dim','--color-surface-bright','--color-surface-container-lowest',
   '--color-surface-container-low','--color-surface-container','--color-surface-container-high',
   '--color-surface-container-highest','--color-surface-variant','--glass-bg','--color-primary'].forEach(function(t){
    out.tokens[t] = cs.getPropertyValue(t).trim();
  });
  out.body = getComputedStyle(document.body).backgroundColor;
  document.querySelectorAll('*').forEach(function(el){
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    var st = getComputedStyle(el);
    var c = rgbOf(st);
    if (!c || c.a <= 0.05) return;
    var tag = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : '');
    if (tag.length > 70) tag = tag.slice(0, 70);
    var hsl = hueSatLight(c.r, c.g, c.b);
    if (hsl.h >= 200 && hsl.h <= 285 && hsl.l < 0.38 && hsl.s > 0.12) {
      out.blueBgs.push({ el: tag, bg: st.backgroundColor });
    }
    var fg = rgbOf({ backgroundColor: st.color });
    if (fg) {
      var fhsl = hueSatLight(fg.r, fg.g, fg.b);
      if (hsl.l > 0.8 && fhsl.l > 0.8) {
        out.whiteBtns.push({ el: tag, bg: st.backgroundColor, color: st.color, text: (el.textContent || '').trim().slice(0, 24) });
      }
    }
  });
  return JSON.stringify(out);
})()`;

(async () => {
  // ═══ F 静态检查 ═══
  const ethSrc = fs.readFileSync(path.join(DOCS, 'assets', 'css', 'ethereal.css'), 'utf8');
  const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('F1 版本双线 v0.2.54.0 / v10.28.36.1 + 注释块（49.2→49.3 白底白字第二轮·按钮）',
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.58.9';") !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") !== -1 &&
    sconfSrc.indexOf('黑白主题') !== -1 && sconfSrc.indexOf('深色模式背景') !== -1 &&
    sconfSrc.indexOf('白底白字') !== -1 && sconfSrc.indexOf('msg-acc') !== -1 &&
    sconfSrc.indexOf('尤其是按钮') !== -1);
  ok('F2 暗 mono 黑族令牌规则（ethereal.css）：selector + 中性黑值（#0b0b0d 家族，蓝 tint 已除）',
    ethSrc.indexOf('html[data-accent="mono"][data-theme="dark"] { --color-background: #0b0b0d') !== -1 &&
    ethSrc.indexOf('--card-bg: rgba(21, 21, 25, 0.55)') !== -1 &&
    ethSrc.indexOf('--input-bg: #121215') !== -1 &&
    ethSrc.indexOf('--modal-bg: rgba(21, 21, 26, 0.75)') !== -1 &&
    ethSrc.indexOf('--color-surface-container-lowest: #0a0a0c') !== -1 &&
    ethSrc.indexOf('v0.2.44.1') !== -1);
  ok('F3 白底白字按钮族规则（ethereal.css）：active 族+tim-search+lib-icon:hover → #32324a 白字（钦定配方）',
    ethSrc.indexOf('.grid-controls .col-btn.active') !== -1 &&
    ethSrc.indexOf('.vp-presets .vp-btn.active') !== -1 &&
    ethSrc.indexOf('.pbg-ratio-btn.active') !== -1 &&
    ethSrc.indexOf('.caption-pos-btn.active') !== -1 &&
    ethSrc.indexOf('.caption-vertical-toggle.active') !== -1 &&
    ethSrc.indexOf('.caption-tab.active') !== -1 &&
    ethSrc.indexOf('.caption-edge-btn.active') !== -1 &&
    ethSrc.indexOf('.tim-search-btn') !== -1 &&
    ethSrc.indexOf('.flag-card-item .lib-icon:hover') !== -1 &&
    ethSrc.indexOf('background: #32324a; color: #ffffff') !== -1);
  ok('F4 进度圆点+toast 翻黑族规则（ethereal.css）（#32324a 圆点 / #1a1a1e toast 白字）',
    ethSrc.indexOf('.progress-step.active .dot') !== -1 &&
    ethSrc.indexOf('.progress-step.completed .dot') !== -1 &&
    ethSrc.indexOf('.toast { background: #1a1a1e; color: #ffffff; }') !== -1);
  const admSrc = fs.readFileSync(path.join(DOCS, 'admin', 'index.html'), 'utf8');
  ok('F5 admin 裸 .btn 泛化规则（v0.2.49.3 第二轮：面板 JS 渲染按钮族全盖；:not 排除变体不盖 btn-primary 暗色规则）',
    admSrc.indexOf(':root[data-theme="dark"] .btn:not(.btn-primary):not(.btn-secondary):not(.btn-outline):not(.btn-ghost)') !== -1 &&
    admSrc.indexOf('background: var(--color-surface-container-high)') !== -1 &&
    admSrc.indexOf('尤其是按钮') !== -1);

  // ═══ 浏览器场景 ═══
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
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    // 每次调用追加一条预置脚本（新脚本后跑=后写者胜），换主题/换 accent 只需再调一次
    const preset = (settings) => cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_settings", ' + JSON.stringify(JSON.stringify(settings)) + ');}catch(e){}'
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };
    const scan = async () => JSON.parse(await cdp.evalJs(SCAN));
    const EXEMPT_WHITE = ['divider', 'nav-item', 'snap-dot', 'badge']; // 半透明白覆层+近白指示点=有意设计
    const whiteOffenders = (s) => s.whiteBtns.filter(x => !EXEMPT_WHITE.some(e => x.el.indexOf(e) !== -1));

    // ── M1 FC 首页 暗 mono ──
    await preset({ theme: 'dark', accent: 'mono' });
    await nav(BASE + '/pages/fluidcanvas.html', "document.querySelector('.studio-header')", 'FC 首页');
    let s = await scan();
    ok('M1a html 暗 mono 生效', s.accent === 'mono' && s.theme === 'dark', 'accent=' + s.accent + ' theme=' + s.theme);
    ok('M1b 令牌全翻黑族', s.tokens['--color-background'] === '#0b0b0d' &&
      s.tokens['--card-bg'] === 'rgba(21, 21, 25, 0.55)' &&
      s.tokens['--subnav-bg'] === '#141418' && s.tokens['--sidebar-bg'] === '#101013' &&
      s.tokens['--input-bg'] === '#121215' && s.tokens['--modal-bg'] === 'rgba(21, 21, 26, 0.75)' &&
      s.tokens['--color-surface-container-lowest'] === '#0a0a0c' &&
      s.tokens['--glass-bg'] === '#141418',
      'bg=' + s.tokens['--color-background'] + ' card=' + s.tokens['--card-bg']);
    ok('M1c body 中性黑 rgb(11,11,13)', s.body === 'rgb(11, 11, 13)', s.body);
    {
      const card = await cdp.evalJs("(function(){var c=document.querySelector('.card');return c?getComputedStyle(c).backgroundColor:null;})()");
      ok('M1d 卡片计算态 rgba(21,21,25,0.55)', card === 'rgba(21, 21, 25, 0.55)', String(card));
    }
    {
      const toast = await cdp.evalJs("(function(){var t=document.getElementById('toast');return t?getComputedStyle(t).backgroundColor:null;})()");
      ok('M1e toast 翻黑族 rgb(26,26,30)', toast === 'rgb(26, 26, 30)', String(toast));
    }
    ok('M1f 整页零蓝 tint 深底', s.blueBgs.length === 0, s.blueBgs.map(x => x.el + ':' + x.bg).join(', ') || '干净');
    ok('M1g 整页零白底白字（半透明覆层豁免）', whiteOffenders(s).length === 0,
      whiteOffenders(s).map(x => x.el + ' 「' + x.text + '」').join(', ') || '干净');

    // ── M2 FC 编辑器 暗 mono ──
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.editor-toolbar') || document.querySelector('body')", 'FC 编辑器');
    s = await scan();
    ok('M2a 网格画布翻黑族 rgb(10,10,12)', (await cdp.evalJs("(function(){var g=document.getElementById('gridCanvas');return g?getComputedStyle(g).backgroundColor:null;})()")) === 'rgb(10, 10, 12)');
    ok('M2b col-btn.active = #32324a 白字', (await cdp.evalJs("(function(){var b=document.querySelector('.grid-controls .col-btn.active');return b?getComputedStyle(b).backgroundColor+'|'+getComputedStyle(b).color:null;})()")) === 'rgb(50, 50, 74)|rgb(255, 255, 255)');
    ok('M2c tim-search-btn = #32324a 白字', (await cdp.evalJs("(function(){var b=document.querySelector('.tim-search-btn');return b?getComputedStyle(b).backgroundColor+'|'+getComputedStyle(b).color:null;})()")) === 'rgb(50, 50, 74)|rgb(255, 255, 255)');
    ok('M2d pbg-ratio-btn.active = #32324a 白字', (await cdp.evalJs("(function(){var b=document.querySelector('.pbg-ratio-btn.active');return b?getComputedStyle(b).backgroundColor+'|'+getComputedStyle(b).color:null;})()")) === 'rgb(50, 50, 74)|rgb(255, 255, 255)');
    {
      const toast = await cdp.evalJs("(function(){var t=document.getElementById('toast');return t?getComputedStyle(t).backgroundColor:null;})()");
      ok('M2e 编辑器 toast 翻黑族 rgb(26,26,30)', toast === 'rgb(26, 26, 30)', String(toast));
    }
    ok('M2f 蓝 tint 仅钦定按钮族 #32324a（无其他蓝底）', s.blueBgs.every(x => x.bg === 'rgb(50, 50, 74)'),
      s.blueBgs.map(x => x.el + ':' + x.bg).join(', ') || '干净');
    ok('M2g 整页零白底白字（半透明覆层豁免）', whiteOffenders(s).length === 0,
      whiteOffenders(s).map(x => x.el + ' 「' + x.text + '」').join(', ') || '干净');

    // ── M5 白底白字修复族（2026-09-17 Request F：v0.2.49.2）──
    // messages msg-acc / explore world-code-chip / help step-num / registry+admin 全暗色修复
    await preset({ theme: 'dark', accent: 'mono' });
    await nav(BASE + '/pages/messages.html', "document.getElementById('fabBtn')", 'messages');
    {
      const r = await cdp.evalJs("(function(){var els=document.querySelectorAll('.msg-acc:not(.msg-avatar)');var bad=[];for(var i=0;i<els.length;i++){var s=getComputedStyle(els[i]);if(s.backgroundColor!=='rgb(50, 50, 74)'||s.color!=='rgb(255, 255, 255)')bad.push(els[i].id||els[i].className)}var avs=document.querySelectorAll('.msg-avatar');var abad=[];for(var j=0;j<avs.length;j++){var a=getComputedStyle(avs[j]);if(a.backgroundColor!=='rgb(70, 72, 212)'&&a.backgroundColor!=='rgb(129, 39, 207)')abad.push(avs[j].id||avs[j].className)}return {n:els.length,bad:bad,an:avs.length,abad:abad};})()");
      ok('M5a messages 按钮/气泡族翻 #32324a 白字（≥4 个）+ msg-avatar 头像族恒亮固定色（4 个）',
        r.n >= 4 && r.bad.length === 0 && r.an === 4 && r.abad.length === 0,
        'n=' + r.n + (r.bad.length ? ' bad:' + r.bad.join(',') : '') + ' an=' + r.an + (r.abad.length ? ' abad:' + r.abad.join(',') : ''));
    }
    await nav(BASE + '/pages/explore.html', "document.querySelector('.world-code-chip')", 'explore');
    {
      const r = await cdp.evalJs("(function(){var els=document.querySelectorAll('.world-code-chip');var bad=[];for(var i=0;i<els.length;i++){var s=getComputedStyle(els[i]);if(s.backgroundImage.indexOf('rgb(50, 50, 74)')<0||s.color!=='rgb(255, 255, 255)')bad.push(i)}return {n:els.length,bad:bad};})()");
      ok('M5b explore .world-code-chip 深灰渐变白字（≥2 个）', r.n >= 2 && r.bad.length === 0,
        'n=' + r.n + (r.bad.length ? ' bad:' + r.bad.join(',') : ''));
    }
    await nav(BASE + '/pages/help.html', "document.querySelector('.step-num')", 'help');
    {
      const r = await cdp.evalJs("(function(){var els=document.querySelectorAll('.step-num');var bad=[];for(var i=0;i<els.length;i++){var s=getComputedStyle(els[i]);if(s.backgroundImage.indexOf('rgb(50, 50, 74)')<0||s.color!=='rgb(255, 255, 255)')bad.push(i)}return {n:els.length,bad:bad};})()");
      ok('M5c help .step-num 深灰渐变白字（4 个）', r.n === 4 && r.bad.length === 0,
        'n=' + r.n + (r.bad.length ? ' bad:' + r.bad.join(',') : ''));
    }
    await nav(BASE + '/pages/registry-step-3.html', "document.querySelector('.stepper-btn')", 'registry-step-3');
    {
      const r = await cdp.evalJs("(function(){var els=document.querySelectorAll('.stepper-btn');var bad=[];for(var i=0;i<els.length;i++){var s=getComputedStyle(els[i]);if(s.backgroundColor!=='rgb(29, 29, 32)'||s.color!=='rgb(226, 226, 232)')bad.push(i)}return {n:els.length,bad:bad};})()");
      ok('M5d registry .stepper-btn 暗 mono 深面浅字（≥4 个）', r.n >= 4 && r.bad.length === 0,
        'n=' + r.n + (r.bad.length ? ' bad:' + r.bad.join(',') : ''));
    }
    await nav(BASE + '/admin/index.html', "document.getElementById('adminGate') && document.getElementById('adminGate').style.display !== 'none'", 'admin 门禁');
    {
      const r = await cdp.evalJs("(function(){var b=document.getElementById('gateLogoutBtn');if(!b)return null;var s=getComputedStyle(b);return {bg:s.backgroundColor,color:s.color};})()");
      ok('M5e admin 裸 .btn 退出登录 暗色翻深面（白底白字全暗修复）',
        r && r.bg === 'rgb(29, 29, 32)' && r.color === 'rgb(226, 226, 232)', JSON.stringify(r));
    }

    // ── M6 暗蓝回归：registry .stepper-btn（全暗色修复不误伤蓝暗）──
    await preset({ theme: 'dark' });
    await nav(BASE + '/pages/registry-step-3.html', "document.querySelector('.stepper-btn')", 'registry-step-3 暗蓝');
    {
      const r = await cdp.evalJs("(function(){var els=document.querySelectorAll('.stepper-btn');var bad=[];for(var i=0;i<els.length;i++){var s=getComputedStyle(els[i]);if(s.backgroundColor!=='rgb(40, 40, 72)'||s.color!=='rgb(226, 226, 232)')bad.push(i)}return {n:els.length,bad:bad};})()");
      ok('M6a 暗蓝 .stepper-btn 深面 #282848 浅字（无 mono 不误伤）', r.n >= 4 && r.bad.length === 0,
        'n=' + r.n + (r.bad.length ? ' bad:' + r.bad.join(',') : ''));
    }

    // ── M3 亮 mono 回归（背景保持亮、不被暗规则污染）──
    await preset({ theme: 'light', accent: 'mono' });
    await nav(BASE + '/pages/fluidcanvas.html', "document.querySelector('.studio-header')", 'FC 首页 亮 mono');
    s = await scan();
    {
      const m = s.body.replace(/[^\d.,]/g, '').split(',').map(Number);
      const l = m.length >= 3 ? (Math.max(m[0], m[1], m[2]) + Math.min(m[0], m[1], m[2])) / 510 : 0;
      ok('M3a 亮 mono body 保持亮底', s.theme === 'light' && l > 0.9 && s.tokens['--color-background'] !== '#0b0b0d', s.body + ' L=' + l.toFixed(3));
    }
    ok('M3b 亮 mono 令牌不受暗黑族污染', s.tokens['--color-background'] !== '#0b0b0d' && s.tokens['--card-bg'] !== 'rgba(21, 21, 25, 0.55)',
      'bg=' + s.tokens['--color-background']);

    // ── M4 暗蓝回归（无 mono accent → 原蓝紫家族原样）──
    await preset({ theme: 'dark' });
    await nav(BASE + '/pages/fluidcanvas.html', "document.querySelector('.studio-header')", 'FC 首页 暗蓝');
    s = await scan();
    ok('M4a 无 mono accent 时蓝家族原样 #161625', s.accent !== 'mono' && s.tokens['--color-background'] === '#161625' && s.body === 'rgb(22, 22, 37)',
      'accent=' + s.accent + ' bg=' + s.body);

    // ── Z console errors ──
    ok('Z 全程零 console error', cdp.errs.length === 0, cdp.errs.slice(0, 5).join(' | ') || '干净');

    cdp.close();
    try { chrome.kill(); } catch (e) {}
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    server.close();
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  server.close();
  console.log('');
  console.log(FAIL === 0 ? '🎉 全部通过 ' + PASS + '/' + PASS : '💔 失败 ' + FAIL + ' / 共 ' + (PASS + FAIL));
  process.exit(FAIL === 0 ? 0 : 1);
})();
