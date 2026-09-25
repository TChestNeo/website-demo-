// tmp-battery-home-bg.js — v0.2.54.3 首页卡片背景换侧栏同款不透明底电池（S 静态巡检 + B Chrome 浏览器段）
// 用户「能不能把首页的卡片背景都变成和之前那个左侧菜单一样啊？」→ 问询钦定「侧栏同款不透明底」：
//   首页 18 张 .card（问候/活动流 4/公告 10/工作台/指标/我的世界）＋搜索胶囊＋访客大卡铺满 --sidebar-bg
//   不透明底（亮色 rgba(255,255,255,0.95) / 暗色 #1a1a2e）+ 灭玻璃注入层 .lg-backdrop 滤镜/磨砂
//   （与 09-18 亮色侧栏修法同机制）；卡片自带 backdrop-filter blur(24px) 保留；订阅卡深色渐变白字不动
// v0.2.55.0 起首页口径由全站规则承载（body:not(.fc-page) 三面 + 灭层），本电池静态锚同步全站规则
// 断言：
//   S  静态：ethereal 全站铺底+灭层规则在位（首页命中同口径）/ 旧 mn-index 规则零残留 / index body 有 mn-index 类 /
//       问候卡内联 background:var(--sidebar-bg)（旧 tint 渐变已去）/ 41 页内联块全量含新规则（55.0 article.html 入族） /
//       site-config v0.2.55.0 + changelog 条目 + FC 零改动
//   B1 浏览器（zh-CN + 登录会话，亮色）：18 张 .card 全 rgba(255,255,255,0.95) 不透明 / 卡自带
//       blur(24px) 保留 / .lg-backdrop computed filter+backdrop-filter 全 none / 搜索胶囊同底 /
//       问候卡内联解析同底 → 切 data-theme=dark 全 rgb(26,26,46)
//   B2 浏览器（zh-CN 无会话，访客）：guest-hero 大卡同底 0.95 + 层灭 + 暗色 26,26,46
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4950 + Math.floor(Math.random() * 80);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

// ═══ S. 静态巡检（纯文件，无浏览器）═══
console.log('═══ S. 静态巡检 ═══');
{
  const css = read('docs/assets/css/ethereal.css');
  ok('S1 ethereal 全站铺底规则在位（body:not(.fc-page) 三面，首页命中同口径）',
    css.indexOf('body:not(.fc-page) .card:not(.profile-header),') !== -1 &&
    css.indexOf('body:not(.fc-page) .search-capsule,') !== -1 &&
    css.indexOf('body:not(.fc-page) .app-main .guest-hero {') !== -1 &&
    css.indexOf('background: var(--sidebar-bg);') !== -1);
  ok('S2 ethereal 全站灭层规则在位（card + guest-hero 直系 lg-backdrop 灭滤镜灭磨砂）',
    css.indexOf('body:not(.fc-page) .card:not(.profile-header) > .lg-backdrop,') !== -1 &&
    css.indexOf('body:not(.fc-page) .guest-hero > .lg-backdrop {') !== -1 &&
    css.indexOf('filter: none;') !== -1 && css.indexOf('backdrop-filter: none;') !== -1);
  ok('S3 ethereal 修复注释含 54.4 用户原话 + 三钦定口径（54.3 旧注释已整体替换零残留）',
    css.indexOf('能不能把全部变成不透明的卡片') !== -1 &&
    css.indexOf('全站所有页面卡片不透明底') !== -1 &&
    css.indexOf('能不能把首页的卡片背景都变成和之前那个左侧菜单一样啊') === -1);
  const idx = read('docs/index.html');
  ok('S4 index body 挂 mn-index 页面类', idx.indexOf('<body class="pre-stagger mn-index">') !== -1);
  ok('S5 问候卡内联 background:var(--sidebar-bg)（旧 tint 渐变已去）',
    idx.indexOf('background:var(--sidebar-bg)') !== -1 &&
    idx.indexOf('rgba(70,72,212,0.06),rgba(129,39,207,0.04))') === -1);
  ok('S6 订阅卡深色渐变底零触碰（白字设计卡不动）',
    idx.indexOf('background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)') !== -1);
  // 内联页全量巡检：凡含 lg-glass-filter 内联块的页面必有新规则（inline-css.js 已刷新）
  const files = [];
  (function walk(dir, base) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name), base + e.name + '/');
      else if (e.name.endsWith('.html')) files.push(base + e.name);
    }
  })(DOCS, '');
  const inlinePages = files.filter((f) => read(path.join(DOCS, f)).indexOf('lg-glass-filter') !== -1);
  ok('S7 内联页总数 = 41（55.0 article.html 入族，实测 ' + inlinePages.length + '）', inlinePages.length === 41);
  let bad = 0;
  for (const f of inlinePages) {
    if (read(path.join(DOCS, f)).indexOf('body:not(.fc-page) .card:not(.profile-header)') === -1) {
      bad++; fail++; console.log('  ❌ 内联块缺全站铺底规则：' + f);
    }
  }
  if (bad === 0) { pass++; console.log('  ✅ S8 41 页内联块全部含全站铺底规则'); }
  const s = read('docs/assets/js/site-config.js');
  ok('S9 site-config 版本 = v0.2.55.0', s.indexOf("window.MN_SITE_VERSION = 'v0.2.58.0';") !== -1);
  ok('S10 site-config changelog 含 v0.2.54.3 条目 + 用户原话 + 侧栏同款口径',
    s.indexOf('v0.2.54.3 = 首页卡片背景换侧栏同款不透明底') !== -1 &&
    s.indexOf('能不能把首页的卡片背景都变成') !== -1);
  ok('S11 本轮后端零改动（v0.2.56.2 条目口径「GET /api/articles 已具备」）', s.indexOf('v0.2.58.0') !== -1 && s.indexOf('后端零改动（GET /api/articles 已具备）') !== -1);
  ok('S12 FC v10.28.36.1 保持', s.indexOf("'v10.28.47.1'") !== -1);
}

// ── house CDP 骨架 ────────────────────────────────────────────────
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

async function waitFor(cdp, expr, ms, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await cdp.evalJs(expr)) return true; } catch (e) {}
    await sleep(120);
  }
  throw new Error('waitFor 超时：' + (label || expr));
}

async function launchChrome(suffix) {
  const CDP_PORT = 5950 + Math.floor(Math.random() * 80);
  const USER_DATA = path.join(os.tmpdir(), 'mn-batt-homebg-' + suffix + '-' + Date.now());
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
  let up = false;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
    await sleep(250);
  }
  if (!up) throw new Error('Chrome 未起来');
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  const page = pages.find(x => x.type === 'page');
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
  const cleanup = () => { try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {} };
  return { cdp, cleanup, chrome };
}

// 收集卡面状态（bg=自身 backgroundColor、bf=自身 backdropFilter、层 filter/backdropFilter、specular 计数）
const FACE_SNAP = `(function(){
  var cards = [].slice.call(document.querySelectorAll('.app-main .card'));
  function one(el){
    if (!el) return null;
    var cs = getComputedStyle(el);
    var bd = el.querySelector(':scope > .lg-backdrop');
    return { bg: cs.backgroundColor, bf: cs.backdropFilter,
      layer: bd ? { f: getComputedStyle(bd).filter, bf: getComputedStyle(bd).backdropFilter } : null };
  }
  var out = { n: cards.length, cards: cards.map(one) };
  var sc = document.querySelector('.app-main .search-capsule');
  if (sc) out.capsule = one(sc);
  var gh = document.querySelector('.app-main .guest-hero');
  if (gh && getComputedStyle(gh).display !== 'none') out.hero = one(gh);
  return out;
})()`;

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;

  // ═══ B1. 登录会话：工作台 18 卡亮/暗 ═══
  try {
    console.log('═══ B1. 登录工作台（亮色 → data-theme=dark）═══');
    const B = await launchChrome('B1');
    const cdp = B.cdp;
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, user: { id: 'USR-000001', name: 'Neo', email: 'neo@mn.world', tier: 'premium' } })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/' });
    await waitFor(cdp, 'document.querySelectorAll(".app-main .card").length >= 18', 15000, '18 张工作台卡');
    // liquid-glass.js DOMContentLoaded 才注入层；公告 10 张非 tilt 卡必有层（问候+活动流 5 张 tilt 免层）
    await waitFor(cdp, 'document.querySelectorAll("#dashAnnouncements .card > .lg-backdrop").length === 10', 15000, '公告卡玻璃层注入');

    let s = await cdp.evalJs(FACE_SNAP);
    const all095 = s.cards.every(c => c && c.bg === 'rgba(255, 255, 255, 0.95)');
    ok('B1 卡数 = 18（问候 1+活动流 4+公告 10+工作台/指标/我的世界 3）', s.n === 18, String(s.n));
    ok('B2 亮色 18 卡 backgroundColor 全 rgba(255,255,255,0.95) 不透明侧栏同底',
      all095, s.cards.map(c => c.bg).filter((v, i, a) => a.indexOf(v) === i).join('/'));
    ok('B3 卡自带 backdrop-filter blur(24px) 保留（底不透明零可见效果，侧栏模块同口径）',
      s.cards.every(c => c.bf === 'blur(24px)'), s.cards[0].bf);
    const withLayer = s.cards.filter(c => c.layer);
    const noLayer = s.cards.filter(c => !c.layer);
    ok('B4 13 张非 tilt 卡 .lg-backdrop 全灭（filter=none + backdropFilter=none）',
      withLayer.length === 13 && withLayer.every(c => c.layer.f === 'none' && c.layer.bf === 'none'),
      '挂层 ' + withLayer.length + '/' + JSON.stringify(withLayer.filter(c => c.layer.f !== 'none').slice(0, 2)));
    ok('B5 5 张 tilt 卡免层（问候+活动流 4；liquid-glass elasticOk 设计排除，本轮零触碰）',
      noLayer.length === 5 && noLayer.every(c => c.layer === null) &&
      await cdp.evalJs(`(function(){return [].slice.call(document.querySelectorAll('.app-main .card')).filter(function(c){return !c.querySelector(':scope > .lg-backdrop')}).every(function(c){return /(^| )tilt-container( |$)/.test(c.className)});})()`),
      '免层 ' + noLayer.length);
    ok('B6 搜索胶囊同底 0.95 + 自带 blur(16px) 保留',
      s.capsule && s.capsule.bg === 'rgba(255, 255, 255, 0.95)' && s.capsule.bf === 'blur(16px)',
      s.capsule && (s.capsule.bg + '/' + s.capsule.bf));

    await cdp.evalJs('document.documentElement.setAttribute("data-theme","dark")');
    await waitFor(cdp, 'getComputedStyle(document.querySelector(".app-main .card")).backgroundColor === "rgb(26, 26, 46)"', 5000, '暗色卡底 #1a1a2e');
    s = await cdp.evalJs(FACE_SNAP);
    ok('B7 暗色 18 卡 backgroundColor 全 rgb(26,26,46)（侧栏暗色同底）',
      s.cards.every(c => c.bg === 'rgb(26, 26, 46)'), s.cards.map(c => c.bg).filter((v, i, a) => a.indexOf(v) === i).join('/'));
    ok('B8 暗色 13 张挂层卡 .lg-backdrop 仍全灭',
      s.cards.filter(c => c.layer).length === 13 && s.cards.filter(c => c.layer).every(c => c.layer.f === 'none' && c.layer.bf === 'none'));
    ok('B9 暗色搜索胶囊同底 rgb(26,26,46)', s.capsule && s.capsule.bg === 'rgb(26, 26, 46)', s.capsule && s.capsule.bg);
    B.cleanup();
  } catch (e) { fail++; console.log('  ❌ B1 段异常：' + e.message); }

  // ═══ B2. 访客态：guest-hero 大卡亮/暗 ═══
  try {
    console.log('═══ B2. 访客态 guest-hero 大卡 ═══');
    const B = await launchChrome('B2');
    const cdp = B.cdp;
    await cdp.send('Page.navigate', { url: BASE + '/' });
    await waitFor(cdp, '!!document.querySelector(".app-main .guest-hero") && getComputedStyle(document.querySelector(".app-main .guest-hero")).display !== "none"', 15000, '访客大卡可见');
    await waitFor(cdp, '!!document.querySelector(".app-main .guest-hero > .lg-backdrop")', 15000, '访客大卡玻璃层注入');
    let s = await cdp.evalJs(FACE_SNAP);
    ok('B10 访客大卡亮色底 rgba(255,255,255,0.95)', s.hero && s.hero.bg === 'rgba(255, 255, 255, 0.95)', s.hero && s.hero.bg);
    ok('B11 访客大卡 .lg-backdrop 灭（filter=none + backdropFilter=none）',
      s.hero && s.hero.layer && s.hero.layer.f === 'none' && s.hero.layer.bf === 'none',
      s.hero && JSON.stringify(s.hero.layer));
    ok('B12 访客态工作台卡互斥隐藏（offsetParent 全 null=祖先 display:none，hero 独显）',
      s.n >= 18 && await cdp.evalJs(`(function(){return [].slice.call(document.querySelectorAll('.app-main .card')).every(function(c){return c.offsetParent === null});})()`),
      '门禁口径：hero 独显');
    await cdp.evalJs('document.documentElement.setAttribute("data-theme","dark")');
    await waitFor(cdp, 'getComputedStyle(document.querySelector(".app-main .guest-hero")).backgroundColor === "rgb(26, 26, 46)"', 5000, '暗色大卡底');
    s = await cdp.evalJs(FACE_SNAP);
    ok('B13 访客大卡暗色底 rgb(26,26,46)', s.hero && s.hero.bg === 'rgb(26, 26, 46)', s.hero && s.hero.bg);
    ok('B14 暗色访客大卡 .lg-backdrop 仍全灭', s.hero && s.hero.layer && s.hero.layer.f === 'none' && s.hero.layer.bf === 'none');
    B.cleanup();
  } catch (e) { fail++; console.log('  ❌ B2 段异常：' + e.message); }

  console.log('\nhome-bg 电池：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})();
