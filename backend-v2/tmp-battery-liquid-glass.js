// tmp-battery-liquid-glass.js — 液态玻璃电池（v0.2.8.0 移植轮）
// 用户（2026-09-02）：「https://github.com/rdev/liquid-glass-react 这个react也安装一下」→问询钦定「移植效果到站点」。
// rdev/liquid-glass-react 是 React 组件库、站点零 React——手译成纯 CSS+JS：
//   · liquid-glass.js：共享 SVG 滤镜 #lg-glass-filter（置换图折射+三通道色散 -70/-77/-84+边缘掩膜）
//     + .lg-backdrop 折射层/.lg-specular 高光层 + rAF 逐帧 lerp 弹性跟随（rdev 公式）
//   · 挂首页访客引导卡（index.html .guest-hero）+ FC 登录引导卡（fluidcanvas.html .fc-locked-hero）
// 断言 = DOM 结构/计算样式/鼠标物理行为/可点击/零报错（截图管线断——渲染像素需用户肉眼复核）
// 跑法：node tmp-battery-liquid-glass.js（LIVE_BASE=<完整站点 URL> 跑线上）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3900 + Math.floor(Math.random() * 500);
const CDP_PORT = 4900 + Math.floor(Math.random() * 500);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-' + Date.now());

// ── 静态壳（docs/ 原样；/api 全 404 → demo 模式零请求） ──
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

// ── CDP 客户端（Node 24 全局 WebSocket） ──
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method) {
        const ls = this.listeners.get(m.method);
        if (ls) ls.forEach(fn => fn(m.params));
      }
    };
  }
  send(method, params) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  on(method, fn) { if (!this.listeners.has(method)) this.listeners.set(method, []); this.listeners.get(method).push(fn); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || 'exception'));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('waitFor 超时: ' + label);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const pass = [], fail = [];
function check(name, cond, detail) {
  const line = (cond ? '  ✅ ' : '  ❌ ') + name + (detail ? '（' + detail + '）' : '');
  console.log(line);
  (cond ? pass : fail).push(line);
}

async function main() {
  const LIVE = process.env.LIVE_BASE || '';
  if (!LIVE) server.listen(PORT);
  let chromePath = null;
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });

  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {}
    await sleep(250);
  }

  const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' });
  const info = await r.json();
  const t = new CDP(info.webSocketDebuggerUrl);
  await t.connect();
  await t.send('Page.enable');
  await t.send('Runtime.enable');
  await t.send('Log.enable');
  await t.send('DOM.enable');
  await t.send('CSS.enable');

  const exc = [], err = [];
  t.on('Runtime.exceptionThrown', p => exc.push((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || '?'));
  t.on('Log.entryAdded', p => {
    const e = p.entry;
    if (e.level === 'error' && e.url && e.url.indexOf('/api') === -1 && e.url.indexOf('favicon') === -1) err.push(e.url + ' :: ' + e.text);
  });

  const BASE = LIVE || ('http://127.0.0.1:' + PORT);
  // 访客态：全新临时 profile 无 localStorage → mn-guest / fc-guest 自然成立，零播种

  // ════ A：首页访客引导卡（结构 + 滤镜 + 计算样式） ════
  await t.send('Page.navigate', { url: BASE + '/' });
  await waitFor(t, "document.querySelector('.guest-hero.liquid-glass.lg-active')", 10000, '首页 hero 液态玻璃激活');
  await sleep(400); // 首帧把静止值写进 CSS 变量

  check('A0 站点号 v0.2.8.0', (await t.evalJs('window.MN_SITE_VERSION')) === 'v0.2.8.0',
    String(await t.evalJs('window.MN_SITE_VERSION')));
  const struct = JSON.parse(await t.evalJs(`(function () {
    var hero = document.querySelector('.guest-hero');
    var bd = hero.querySelector('.lg-backdrop');
    var sp = hero.querySelector('.lg-specular');
    var bcs = bd ? getComputedStyle(bd) : null;
    var scs = sp ? getComputedStyle(sp) : null;
    var hcs = getComputedStyle(hero);
    var inner = getComputedStyle(hero.querySelector('.guest-hero-inner'));
    return JSON.stringify({
      cls: hero.className,
      bdCount: hero.querySelectorAll('.lg-backdrop').length,
      spCount: hero.querySelectorAll('.lg-specular').length,
      bdFilter: bcs ? bcs.filter : null,
      bdBackdrop: bcs ? bcs.backdropFilter : null,
      bdPE: bcs ? bcs.pointerEvents : null,
      spPE: scs ? scs.pointerEvents : null,
      hPos: hcs.position, hTransform: hcs.transform,
      innerZ: inner.zIndex
    });
  })()`));
  check('A1 hero 双类（liquid-glass + lg-active）', struct.cls.indexOf('liquid-glass') > -1 && struct.cls.indexOf('lg-active') > -1, struct.cls);
  check('A2 折射/高光层各注入一枚', struct.bdCount === 1 && struct.spCount === 1, struct.bdCount + '/' + struct.spCount);
  check('A3 折射层 filter 挂 SVG 滤镜（url(#lg-glass-filter)）', struct.bdFilter.indexOf('lg-glass-filter') > -1, struct.bdFilter);
  check('A4 折射层 backdrop-filter blur(6px)+saturate', struct.bdBackdrop.indexOf('blur(6px)') > -1 && struct.bdBackdrop.indexOf('saturate') > -1, struct.bdBackdrop);
  check('A5 两层均 pointer-events none（不挡点击）', struct.bdPE === 'none' && struct.spPE === 'none', struct.bdPE + '/' + struct.spPE);
  check('A6 hero 定位 relative（折射层锚点）+ 静止 transform 单位阵', struct.hPos === 'relative' && struct.hTransform === 'matrix(1, 0, 0, 1, 0, 0)',
    struct.hPos + '/' + struct.hTransform);
  check('A7 内容层 z-index 1（文字压在玻璃层上）', struct.innerZ === '1', String(struct.innerZ));

  const svg = JSON.parse(await t.evalJs(`(function () {
    var f = document.getElementById('lg-glass-filter');
    if (!f) return JSON.stringify({ absent: true });
    var imgs = f.querySelectorAll('feImage');
    var dms = f.querySelectorAll('feDisplacementMap');
    var blends = f.querySelectorAll('feBlend');
    var blur = f.querySelector('feGaussianBlur');
    var funcs = f.querySelectorAll('feFuncA');
    return JSON.stringify({
      feImage: imgs.length === 1 && (imgs[0].getAttribute('href') || '').indexOf('data:image/jpeg;base64') === 0,
      scales: Array.prototype.map.call(dms, function (n) { return n.getAttribute('scale'); }),
      xy: Array.prototype.map.call(dms, function (n) { return n.getAttribute('xChannelSelector') + '/' + n.getAttribute('yChannelSelector'); }),
      blends: Array.prototype.map.call(blends, function (n) { return n.getAttribute('mode'); }),
      blurDev: blur ? blur.getAttribute('stdDeviation') : null,
      funcTables: Array.prototype.map.call(funcs, function (n) { return n.getAttribute('type') + ':' + n.getAttribute('tableValues'); })
    });
  })()`));
  check('A8 SVG 滤镜注入（feImage=置换图 data URI）', svg.feImage === true, JSON.stringify(svg));
  check('A9 三通道色散 scale -70/-77/-84（rdev standard 公式）', JSON.stringify(svg.scales) === JSON.stringify(['-70', '-77', '-84']), JSON.stringify(svg.scales));
  check('A10 位移采样 R/B + 双 screen 混合 + 0.3 柔化 + 边缘掩膜 discrete/反掩膜 table',
    svg.xy.every(x => x === 'R/B') && JSON.stringify(svg.blends) === JSON.stringify(['screen', 'screen']) && svg.blurDev === '0.3' &&
    JSON.stringify(svg.funcTables) === JSON.stringify(['discrete:0 0.1 1', 'table:1 0']),
    JSON.stringify(svg.xy) + ' / ' + JSON.stringify(svg.blends) + ' / ' + svg.blurDev + ' / ' + JSON.stringify(svg.funcTables));

  // ════ B：静止 CSS 变量（首帧写入确定初始值） ════
  const rest = JSON.parse(await t.evalJs(`(function () {
    var st = document.querySelector('.guest-hero').style;
    return JSON.stringify({
      tx: st.getPropertyValue('--lg-tx'), ty: st.getPropertyValue('--lg-ty'),
      sx: st.getPropertyValue('--lg-sx'), sy: st.getPropertyValue('--lg-sy'),
      px: st.getPropertyValue('--lg-px'), py: st.getPropertyValue('--lg-py')
    });
  })()`));
  check('B1 静止变量（tx/ty=0.00px，sx/sy=1.000，px/py=50.00%）',
    rest.tx === '0.00px' && rest.ty === '0.00px' && rest.sx === '1.000' && rest.sy === '1.000' &&
    rest.px === '50.00%' && rest.py === '50.00%', JSON.stringify(rest));

  // ════ C：弹性跟随（鼠标偏右下 → 拉伸/位移；移远 → 衰减回静止） ════
  const pt = await t.evalJs(`(function () { var r = document.querySelector('.guest-hero').getBoundingClientRect(); return { x: r.left + r.width * 0.75, y: r.top + r.height * 0.25 }; })()`);
  await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y });
  await waitFor(t, "parseFloat(document.querySelector('.guest-hero').style.getPropertyValue('--lg-tx')) > 1.5", 3000, '弹性位移跟上（tx>1.5）');
  const moved = JSON.parse(await t.evalJs(`(function () {
    var st = document.querySelector('.guest-hero').style;
    return JSON.stringify({
      tx: parseFloat(st.getPropertyValue('--lg-tx')), ty: parseFloat(st.getPropertyValue('--lg-ty')),
      sx: parseFloat(st.getPropertyValue('--lg-sx')), sy: parseFloat(st.getPropertyValue('--lg-sy'))
    });
  })()`));
  check('C1 鼠标偏右下 → 弹性位移（tx>0, ty<0 朝鼠标方向）', moved.tx > 1.5 && moved.ty < -1,
    'tx=' + moved.tx.toFixed(2) + ' ty=' + moved.ty.toFixed(2));
  check('C2 方向拉伸（sx>1.005, sy>1.005，rdev 公式）', moved.sx > 1.005 && moved.sy > 1.005,
    'sx=' + moved.sx.toFixed(4) + ' sy=' + moved.sy.toFixed(4));
  check('C3 拉伸不超上限（sx/sy ≤ 1.05 理论上限）', moved.sx < 1.05 && moved.sy < 1.05,
    'sx=' + moved.sx.toFixed(4) + ' sy=' + moved.sy.toFixed(4));

  await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
  await waitFor(t, "parseFloat(document.querySelector('.guest-hero').style.getPropertyValue('--lg-tx')) < 0.5 && Math.abs(parseFloat(document.querySelector('.guest-hero').style.getPropertyValue('--lg-sx')) - 1) < 0.005", 4000, '鼠标移远衰减回静止');
  const decayed = JSON.parse(await t.evalJs(`(function () {
    var st = document.querySelector('.guest-hero').style;
    return JSON.stringify({ tx: parseFloat(st.getPropertyValue('--lg-tx')), sx: parseFloat(st.getPropertyValue('--lg-sx')) });
  })()`));
  check('C4 移远衰减回静止（tx≈0, sx≈1）', Math.abs(decayed.tx) < 0.5 && Math.abs(decayed.sx - 1) < 0.005,
    'tx=' + decayed.tx.toFixed(3) + ' sx=' + decayed.sx.toFixed(4));

  // ════ D：可点击（折射/高光层不挡 CTA） ════
  const cta = await t.evalJs(`(function () { var a = document.querySelector('.guest-hero-cta .btn-primary'); var r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const hit = JSON.parse(await t.evalJs(`(function () {
    var el = document.elementFromPoint(${cta.x}, ${cta.y});
    var a = el ? el.closest('a') : null;
    return JSON.stringify({ tag: el ? el.tagName : '?', isCta: !!(a && a.getAttribute('href') === 'signup-and-login') });
  })()`));
  check('D1 CTA 命中可点击（命中元素属 CTA 链，非玻璃层）', hit.isCta, JSON.stringify(hit));

  // ════ E：FC 登录引导卡（fc-guest 态 + 同款激活） ════
  await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas.html' });
  await waitFor(t, "document.querySelector('.fc-locked-hero.liquid-glass.lg-active')", 10000, 'FC 引导卡液态玻璃激活');
  await sleep(300);
  const fc = JSON.parse(await t.evalJs(`(function () {
    var hero = document.querySelector('.fc-locked-hero');
    var cs = getComputedStyle(hero);
    var cta = hero.querySelector('a.btn');
    var ctar = cta.getBoundingClientRect();
    var el = document.elementFromPoint(ctar.left + ctar.width / 2, ctar.top + ctar.height / 2);
    var a = el ? el.closest('a') : null;
    var st = hero.style;
    return JSON.stringify({
      fcGuest: document.documentElement.classList.contains('fc-guest'),
      display: cs.display, layers: hero.querySelectorAll('.lg-backdrop').length + '/' + hero.querySelectorAll('.lg-specular').length,
      filter: !!document.getElementById('lg-glass-filter'),
      ctaHit: !!(a && a.getAttribute('href').indexOf('signup-and-login') > -1),
      tx: st.getPropertyValue('--lg-tx')
    });
  })()`));
  check('E1 fc-guest 态 + 引导卡 display flex + 双类激活', fc.fcGuest && fc.display === 'flex', fc.fcGuest + '/' + fc.display);
  check('E2 折射/高光层注入 + 滤镜注入', fc.layers === '1/1' && fc.filter, fc.layers + '/' + fc.filter);
  check('E3 CTA 可点击（next 回跳链接）', fc.ctaHit, String(fc.ctaHit));
  check('E4 静止变量写入', fc.tx === '0.00px', String(fc.tx));

  // ════ F：零报错 ════
  check('F1 零 JS 异常', exc.length === 0, exc.slice(0, 3).join(' | '));
  check('F2 零 console error（/api、favicon 过滤）', err.length === 0, err.slice(0, 3).join(' | '));

  console.log('\n═══ 液态玻璃电池 ' + (fail.length === 0 ? '全绿' : '有红') + '：' + pass.length + '/' + (pass.length + fail.length) + ' ═══');
  t.close();
  chrome.kill();
  try { server.close(); } catch (e) {}
  process.exit(fail.length === 0 ? 0 : 1);
}

main().catch(e => { console.error('电池崩了：', e); process.exit(2); });
