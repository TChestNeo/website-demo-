// tmp-battery-liquid-glass-v2.js — 全站液态玻璃 v2 电池（v0.2.9.0 轮）
// 用户（2026-09-02）：「那么把全部旧的液态玻璃换成新的这个液态玻璃react」→问询钦定：
//   ①全站所有磨砂玻璃面 ②卡片弹性、大面板静态。
// 断言 = 双滤镜定义/静态-弹性双模式/层结构 z:-1/父模糊移交/配方表/transition 守卫/
//   编辑器门控与旋转重组/暗色 token/reduced-motion/零报错（截图管线断——像素需用户肉眼）
// 跑法：node tmp-battery-liquid-glass-v2.js（LIVE_BASE=<完整站点 URL> 跑线上）
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
    if (err && path.extname(file) === '') {
      // entrypoint .html 回退（真实部署规则：/signup-and-login → signup-and-login.html）
      fs.readFile(file + '.html', (e2, b2) => {
        if (e2) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(b2);
      });
      return;
    }
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
async function nav(t, url) { await t.send('Page.navigate', { url }); await sleep(700); }

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
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
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
    if (e.level === 'error' && e.url && e.url.indexOf('/api') === -1 && e.url.indexOf('favicon') === -1 && e.url.indexOf('data:') === -1) err.push(e.url + ' :: ' + e.text);
  });

  const BASE = LIVE || ('http://127.0.0.1:' + PORT);
  // 访客态：全新临时 profile 无 localStorage → mn-guest / fc-guest 自然成立，零播种

  // ════ A：首页访客（hero 弹性 + 侧栏静态 + 双滤镜） ════
  await nav(t, BASE + '/');
  await waitFor(t, "document.querySelector('.guest-hero.liquid-glass.lg-active')", 10000, '首页 hero 液态玻璃激活');
  await sleep(400); // 首帧把静止值写进 CSS 变量

  check('A0 站点号 v0.2.9.0', (await t.evalJs('window.MN_SITE_VERSION')) === 'v0.2.9.0',
    String(await t.evalJs('window.MN_SITE_VERSION')));
  check('A0b FC 线 v10.28.18', (await t.evalJs('window.FLUIDCANVAS_VERSION')) === 'v10.28.18',
    String(await t.evalJs('window.FLUIDCANVAS_VERSION')));

  const struct = JSON.parse(await t.evalJs(`(function () {
    var hero = document.querySelector('.guest-hero');
    var bd = hero.querySelector('.lg-backdrop');
    var sp = hero.querySelector('.lg-specular');
    var bcs = getComputedStyle(bd), scs = getComputedStyle(sp), hcs = getComputedStyle(hero);
    var inner = getComputedStyle(hero.querySelector('.guest-hero-inner'));
    return JSON.stringify({
      cls: hero.className,
      bdCount: hero.querySelectorAll('.lg-backdrop').length,
      spCount: hero.querySelectorAll('.lg-specular').length,
      bdZ: bcs.zIndex, spZ: scs.zIndex,
      bdFilter: bcs.filter, bdBackdrop: bcs.backdropFilter,
      bdPE: bcs.pointerEvents, spPE: scs.pointerEvents,
      hBackdrop: hcs.backdropFilter, hTransform: hcs.transform, hZ: hcs.zIndex,
      innerZ: inner.zIndex
    });
  })()`));
  check('A1 hero 双类 + 层各 1', struct.cls.indexOf('liquid-glass') > -1 && struct.cls.indexOf('lg-active') > -1 && struct.bdCount === 1 && struct.spCount === 1, struct.cls + ' / ' + struct.bdCount + '/' + struct.spCount);
  check('A2 两层 z-index -1（垫父半透明底之上、内容之下）', struct.bdZ === '-1' && struct.spZ === '-1', struct.bdZ + '/' + struct.spZ);
  check('A3 折射层 filter=url(#lg-glass-filter) + backdrop blur(6px) saturate', struct.bdFilter.indexOf('lg-glass-filter') > -1 && struct.bdBackdrop.indexOf('blur(6px)') > -1 && struct.bdBackdrop.indexOf('saturate') > -1, struct.bdFilter + ' / ' + struct.bdBackdrop);
  check('A4 hero 父 backdrop-filter none（模糊移交背层防双层）', struct.hBackdrop === 'none', String(struct.hBackdrop));
  check('A5 hero 静止 transform 单位阵（JS 逐帧 inline 写）', struct.hTransform === 'matrix(1, 0, 0, 1, 0, 0)', struct.hTransform);
  check('A6 内容层 z auto（旧提层规则已删，负 z 层自然垫底）', struct.innerZ === 'auto', String(struct.innerZ));
  check('A7 两层 pointer-events none', struct.bdPE === 'none' && struct.spPE === 'none', struct.bdPE + '/' + struct.spPE);

  const filters = JSON.parse(await t.evalJs(`(function () {
    function grab(id) {
      var f = document.getElementById(id);
      if (!f) return null;
      var dms = f.querySelectorAll('feDisplacementMap');
      var imgs = f.querySelectorAll('feImage');
      return {
        scales: Array.prototype.map.call(dms, function (n) { return n.getAttribute('scale'); }),
        xy: Array.prototype.map.call(dms, function (n) { return n.getAttribute('xChannelSelector') + '/' + n.getAttribute('yChannelSelector'); }),
        feImage: imgs.length === 1 && (imgs[0].getAttribute('href') || '').indexOf('data:image/jpeg;base64') === 0
      };
    }
    return JSON.stringify({ big: grab('lg-glass-filter'), sm: grab('lg-glass-filter-sm') });
  })()`));
  check('A8 双滤镜实例注入（大 70 + 小 35）', !!(filters.big && filters.sm), JSON.stringify(filters));
  check('A9 大滤镜三通道 -70/-77/-84 + R/B 采样', JSON.stringify(filters.big.scales) === JSON.stringify(['-70', '-77', '-84']) && filters.big.xy.every(x => x === 'R/B'), JSON.stringify(filters.big.scales));
  check('A10 小滤镜三通道 -35/-38.5/-42（小卡等比缩幅）', JSON.stringify(filters.sm.scales) === JSON.stringify(['-35', '-38.5', '-42']), JSON.stringify(filters.sm.scales));
  check('A11 双滤镜共用置换图 data URI', filters.big.feImage && filters.sm.feImage, String(filters.big.feImage) + '/' + String(filters.sm.feImage));

  const side = JSON.parse(await t.evalJs(`(function () {
    var mods = document.querySelectorAll('.sidebar-module');
    var out = [];
    for (var i = 0; i < mods.length; i++) {
      var m = mods[i];
      var bd = m.querySelector('.lg-backdrop');
      var bcs = bd ? getComputedStyle(bd) : null;
      out.push({
        cls: m.className,
        layers: m.querySelectorAll('.lg-backdrop').length + '/' + m.querySelectorAll('.lg-specular').length,
        parentBf: getComputedStyle(m).backdropFilter,
        layerBf: bcs ? bcs.backdropFilter : null,
        layerPos: bcs ? bcs.position : null,
        transform: m.style.transform || ''
      });
    }
    return JSON.stringify(out);
  })()`));
  check('A12 侧栏三模块（brand/nav/user）全静态玻璃各 2 层', side.length === 3 && side.every(s => s.cls.indexOf('lg-static') > -1 && s.layers === '1/1'), JSON.stringify(side.map(s => s.cls + ':' + s.layers)));
  check('A13 侧栏父 blur none + 层 blur(14px) saturate(1.4)', side.every(s => s.parentBf === 'none' && s.layerBf.indexOf('blur(14px)') > -1 && s.layerBf.indexOf('saturate(1.4)') > -1), JSON.stringify(side.map(s => s.parentBf + '/' + s.layerBf)));
  check('A14 nav-module 层 position sticky（内滚钉视口）', side.some(s => s.cls.indexOf('nav-module') > -1 && s.layerPos === 'sticky'), JSON.stringify(side.map(s => s.cls + ':' + s.layerPos)));
  check('A15 静态模块零 transform 写（面板自身动画无损）', side.every(s => s.transform === ''), JSON.stringify(side.map(s => s.transform)));

  // hero 弹性（rdev 物理）
  const pt = await t.evalJs(`(function () { var r = document.querySelector('.guest-hero').getBoundingClientRect(); return { x: r.left + r.width * 0.75, y: r.top + r.height * 0.25 }; })()`);
  await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y });
  await waitFor(t, "parseFloat(document.querySelector('.guest-hero').style.getPropertyValue('--lg-tx')) > 1.5", 3000, 'hero 弹性位移跟上');
  const moved = JSON.parse(await t.evalJs(`(function () {
    var st = document.querySelector('.guest-hero').style;
    return JSON.stringify({
      tx: parseFloat(st.getPropertyValue('--lg-tx')), ty: parseFloat(st.getPropertyValue('--lg-ty')),
      sx: parseFloat(st.getPropertyValue('--lg-sx')), sy: parseFloat(st.getPropertyValue('--lg-sy'))
    });
  })()`));
  check('A16 hero 弹性位移（tx>0, ty<0 朝鼠标）+ 方向拉伸', moved.tx > 1.5 && moved.ty < -1 && moved.sx > 1.005 && moved.sy > 1.005, 'tx=' + moved.tx.toFixed(2) + ' ty=' + moved.ty.toFixed(2) + ' sx=' + moved.sx.toFixed(4) + ' sy=' + moved.sy.toFixed(4));
  await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
  await waitFor(t, "parseFloat(document.querySelector('.guest-hero').style.getPropertyValue('--lg-tx')) < 0.5 && Math.abs(parseFloat(document.querySelector('.guest-hero').style.getPropertyValue('--lg-sx')) - 1) < 0.005", 4000, 'hero 衰减回静止');
  check('A17 移远衰减回静止', true, 'tx/sx 收敛');

  const cta = await t.evalJs(`(function () { var a = document.querySelector('.guest-hero-cta .btn-primary'); var r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const hit = JSON.parse(await t.evalJs(`(function () {
    var el = document.elementFromPoint(${cta.x}, ${cta.y});
    var a = el ? el.closest('a') : null;
    return JSON.stringify({ isCta: !!(a && a.getAttribute('href') === 'signup-and-login') });
  })()`));
  check('A18 CTA 命中可点击（玻璃层不挡）', hit.isCta, JSON.stringify(hit));

  // ════ B：help 页（tilt 豁免 + settings modal 静态无损） ════
  await nav(t, BASE + '/pages/help.html');
  await waitFor(t, "document.querySelectorAll('.sidebar-module.lg-static').length === 3", 10000, 'help 侧栏静态玻璃');
  const help = JSON.parse(await t.evalJs(`(function () {
    var tilt = document.querySelector('.tilt-container');
    return JSON.stringify({
      tiltLayers: tilt.querySelectorAll('.lg-backdrop').length + '/' + tilt.querySelectorAll('.lg-specular').length
    });
  })()`));
  check('B1 tilt-container 卡豁免（倾斜特效与弹性互斥，零层）', help.tiltLayers === '0/0', String(help.tiltLayers));

  // modal 是 lazy build → 真实打开路径（window.SlatiSettings.open）
  await t.evalJs('window.SlatiSettings.open()');
  await waitFor(t, "document.querySelector('.modal-card.lg-static')", 5000, 'modal 动态 build 挂静态玻璃');
  await sleep(350); // active 动画入场
  const modalOpen = JSON.parse(await t.evalJs(`(function () {
    var mc = document.querySelector('.modal-card');
    var cs = getComputedStyle(mc);
    var lb = getComputedStyle(mc.querySelector('.lg-backdrop'));
    var out = {
      cls: mc.className, display: cs.display, transform: cs.transform,
      layerBf: lb.backdropFilter, parentBf: cs.backdropFilter,
      transition: mc.style.transition,
      layers: mc.querySelectorAll('.lg-backdrop').length + '/' + mc.querySelectorAll('.lg-specular').length
    };
    return JSON.stringify(out);
  })()`));
  check('B2 modal 动态 build 后静态玻璃 + 层 1/1（钩子生效）', modalOpen.cls.indexOf('lg-static') > -1 && modalOpen.layers === '1/1', modalOpen.cls + ' / ' + modalOpen.layers);
  check('B3 modal 打开动画无损（active → transform 单位阵，JS 未插手）', modalOpen.display !== 'none' && modalOpen.transform === 'matrix(1, 0, 0, 1, 0, 0)', modalOpen.display + '/' + modalOpen.transform);
  check('B4 modal 父 blur none + 层 blur(24px) saturate(1.4)', modalOpen.parentBf === 'none' && modalOpen.layerBf.indexOf('blur(24px)') > -1 && modalOpen.layerBf.indexOf('saturate(1.4)') > -1, modalOpen.parentBf + '/' + modalOpen.layerBf);
  check('B5 静态面板 transition 未被守卫改写（inline 保持空）', modalOpen.transition === '', String(modalOpen.transition));
  await t.evalJs('window.SlatiSettings.close()');

  // ════ C：登录态首页（播种 loggedIn → 工作台卡弹性 + transition 守卫） ════
  await t.evalJs("localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true }))");
  await nav(t, BASE + '/');
  await waitFor(t, "document.querySelectorAll('.card').length > 0 && getComputedStyle(document.querySelector('.card')).display !== 'none'", 10000, '登录态工作台卡可见');
  await sleep(1200); // transitions.js 入场动画（0.4s+stagger）落定，rect 才稳定
  const cardIdx = await t.evalJs(`(function () {
    var cards = document.querySelectorAll('.card');
    var i = 0;
    for (; i < cards.length; i++) {
      var c = cards[i];
      if (!c.classList.contains('lg-active') || c.closest('.tilt-container') || c.offsetWidth === 0) continue;
      var r = c.getBoundingClientRect();
      if (r.bottom >= 800 || r.top <= 0) { window.scrollTo(0, r.top - 300); r = c.getBoundingClientRect(); }
      if (r.bottom < 800 && r.top > 0) break; // 必须整个落在 900 高视口内（出屏坐标 mousemove 被丢弃）
    }
    if (i >= cards.length) return -1;
    cards[i].dataset.lgTest = '1';
    return i;
  })()`);
  check('C1 登录态非 tilt 工作台卡已挂弹性玻璃（lg-active）', cardIdx > -1, 'cardIdx=' + cardIdx);
  if (cardIdx > -1) {
    const card = JSON.parse(await t.evalJs(`(function () {
      var c = document.querySelector('.card[data-lg-test="1"]');
      var cs = getComputedStyle(c);
      var lb = getComputedStyle(c.querySelector('.lg-backdrop'));
      return JSON.stringify({
        layers: c.querySelectorAll('.lg-backdrop').length + '/' + c.querySelectorAll('.lg-specular').length,
        z: cs.zIndex, parentBf: cs.backdropFilter, layerBf: lb.backdropFilter
      });
    })()`));
    check('C2 卡层 1/1 + z-index 0 层叠上下文 + 父 blur none + 层 6px sat 140%',
      card.layers === '1/1' && card.z === '0' && card.parentBf === 'none' && card.layerBf.indexOf('blur(6px)') > -1 && card.layerBf.indexOf('saturate') > -1,
      JSON.stringify(card));

    const rc = await t.evalJs(`(function () { var r = document.querySelector('.card[data-lg-test="1"]').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 }; })()`);
    await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rc.x, y: rc.y });
    await waitFor(t, "document.querySelector('.card[data-lg-test=\"1\"]').style.transform.indexOf('translate3d') > -1", 3000, '卡弹性 transform 写上');
    const cardEl = JSON.parse(await t.evalJs(`(function () {
      var c = document.querySelector('.card[data-lg-test="1"]');
      return JSON.stringify({ transform: c.style.transform, transition: c.style.transition });
    })()`));
    check('C3 卡弹性 inline transform 含 translate3d', cardEl.transform.indexOf('translate3d') > -1, cardEl.transform);
    check('C4 transition 守卫：首次交互追加 transform 0s（transitions.js 遗留橡皮筋已断；Chrome 省略 0s 序列化成裸 transform）',
      cardEl.transition.split(',').pop().trim() === 'transform' && cardEl.transition.indexOf('opacity 0.4s') > -1, cardEl.transition);

    // 点击解守卫（document 捕获）→ 出场过渡恢复 → 再 mousemove 重守卫
    await t.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 20, button: 'left', clickCount: 1 });
    await t.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 20, button: 'left', clickCount: 1 });
    await sleep(200);
    const unguarded = await t.evalJs("document.querySelector('.card[data-lg-test=\"1\"]').style.transition");
    check('C5 点击解守卫恢复原过渡（出场动画不残）', unguarded.indexOf('transform 0s') === -1 && unguarded.indexOf('opacity 0.4s') > -1, String(unguarded));
    await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rc.x, y: rc.y });
    await waitFor(t, "document.querySelector('.card[data-lg-test=\"1\"]').style.transition.split(',').pop().trim() === 'transform'", 3000, '再交互重守卫');
    check('C6 再交互自动重守卫', true, 'transform 0s 回归');

    // 外部 transform 组合（模拟 transitions.js 出场目标）
    await t.evalJs("document.querySelector('.card[data-lg-test=\"1\"]').style.transform = 'translateX(-24px)'");
    await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rc.x + 3, y: rc.y + 3 });
    await waitFor(t, "document.querySelector('.card[data-lg-test=\"1\"]').style.transform.indexOf('translate3d') > -1", 3000, '外部 transform 组合');
    const composed = await t.evalJs("document.querySelector('.card[data-lg-test=\"1\"]').style.transform");
    check('C7 外部 transform 保底组合（translateX(-24px) 开头 + translate3d 追加）', composed.indexOf('translateX(-24px)') === 0 && composed.indexOf('translate3d') > -1, String(composed));
    await t.evalJs("document.querySelector('.card[data-lg-test=\"1\"]').style.transform = ''");
  }

  // ════ D：signup-and-login（auth-card 静态 + z 补回；登录态会被送回 dashboard → 先退登） ════
  await t.evalJs("localStorage.removeItem('slati_session')");
  await nav(t, BASE + '/signup-and-login');
  await waitFor(t, "document.querySelector('.auth-card.lg-static')", 10000, 'auth-card 静态玻璃');
  const auth = JSON.parse(await t.evalJs(`(function () {
    var a = document.querySelector('.auth-card');
    var tabs = document.querySelector('.auth-tabs');
    var cs = getComputedStyle(a);
    var lb = getComputedStyle(a.querySelector('.lg-backdrop'));
    return JSON.stringify({
      layers: a.querySelectorAll('.lg-backdrop').length + '/' + a.querySelectorAll('.lg-specular').length,
      z: cs.zIndex, tabsZ: tabs ? getComputedStyle(tabs).zIndex : '?',
      parentBf: cs.backdropFilter, layerBf: lb.backdropFilter,
      transform: a.style.transform
    });
  })()`));
  check('D1 auth-card 静态玻璃层 1/1', auth.layers === '1/1', auth.layers);
  check('D2 auth-card z:2 补回（原层叠关系无损）', auth.z === '2', String(auth.z));
  check('D3 auth-tabs z 2 原规则无损', auth.tabsZ === '2', String(auth.tabsZ));
  check('D4 auth 父 blur none + 层 blur(24px) saturate(1.4) + LG 零 transform 写（translate3d 签名不在；transitions.js 入场残留归它自己）', auth.parentBf === 'none' && auth.layerBf.indexOf('blur(24px)') > -1 && auth.layerBf.indexOf('saturate(1.4)') > -1 && auth.transform.indexOf('translate3d') === -1, auth.parentBf + '/' + auth.layerBf + '/' + auth.transform);

  // ════ E：transitioning 倒计时卡（仅加脚本即生效） ════
  await nav(t, BASE + '/pages/transitioning.html');
  await waitFor(t, "document.querySelector('.countdown-card.liquid-glass.lg-active')", 10000, '倒计时卡激活');
  const cd = JSON.parse(await t.evalJs(`(function () {
    var c = document.querySelector('.countdown-card');
    return JSON.stringify({ layers: c.querySelectorAll('.lg-backdrop').length + '/' + c.querySelectorAll('.lg-specular').length, bf: getComputedStyle(c).backdropFilter });
  })()`));
  check('E1 countdown-card 弹性玻璃（脚本链自动生效）', cd.layers === '1/1' && cd.bf === 'none', JSON.stringify(cd));

  // ════ F：premium plan-card 静态 ════
  await nav(t, BASE + '/pages/premium.html');
  await waitFor(t, "document.querySelector('.plan-card.lg-static')", 10000, 'plan-card 静态玻璃');
  const plan = JSON.parse(await t.evalJs(`(function () {
    var p = document.querySelector('.plan-card');
    var lb = getComputedStyle(p.querySelector('.lg-backdrop'));
    return JSON.stringify({ transform: p.style.transform, layerBf: lb.backdropFilter, parentBf: getComputedStyle(p).backdropFilter });
  })()`));
  check('F1 plan-card 静态零 transform 写（hover 上移归 CSS）+ 层 24px saturate(1.4)', plan.transform === '' && plan.parentBf === 'none' && plan.layerBf.indexOf('blur(24px)') > -1, JSON.stringify(plan));

  // ════ G：about team-modal（透明度 token + 暗色） ════
  await nav(t, BASE + '/pages/about.html');
  await waitFor(t, "document.querySelector('.team-modal-card.lg-static')", 10000, 'team-modal 静态玻璃');
  const team = JSON.parse(await t.evalJs(`(function () {
    var m = document.querySelector('.team-modal-card');
    var light = getComputedStyle(m).backgroundColor;
    document.documentElement.setAttribute('data-theme', 'dark');
    var dark = getComputedStyle(m).backgroundColor;
    document.documentElement.removeAttribute('data-theme');
    return JSON.stringify({ light: light, dark: dark, bf: getComputedStyle(m).backdropFilter });
  })()`));
  check('G1 team-modal 亮色 0.75 半透明', team.light === 'rgba(255, 255, 255, 0.75)', team.light);
  check('G2 team-modal 暗色 rgba(43,43,74,0.75)', team.dark === 'rgba(43, 43, 74, 0.75)', team.dark);
  check('G3 team-modal 父 blur none（移交 20px 层）', team.bf === 'none', String(team.bf));

  // ════ H：编辑器（D 段已清 session → 重新播种；boot 零卡是正常态 → 钩子建 3 张玻璃族卡） ════
  await t.evalJs("localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true }))");
  await nav(t, BASE + '/pages/fluidcanvas-editor.html');
  try {
    await waitFor(t, "typeof window.createContentCard === 'function' && typeof window.createFlagCard === 'function'", 15000, '编辑器 boot 完成（钩子暴露）');
  } catch (e) {
    console.log('  ── 编辑器诊断：exc=' + JSON.stringify(exc.slice(0, 5)) + ' err=' + JSON.stringify(err.slice(0, 5)) + ' url=' + (await t.evalJs('location.pathname')) + ' cards=' + (await t.evalJs("document.querySelectorAll('.grid-card').length")));
    throw e;
  }
  await t.evalJs("window.createContentCard(0, 0, 6, 6); window.createFlagCard(6, 0, 4, 4); window.createAssetCard(0, 6, 4, 4)");
  await waitFor(t, "document.querySelectorAll('.grid-card.lg-active').length >= 3", 8000, '钩子建卡已挂液态玻璃');
  await sleep(300);
  check('H1 编辑器不重定向（门禁放行登录态）', (await t.evalJs('location.pathname')).indexOf('fluidcanvas-editor') > -1, String(await t.evalJs('location.pathname')));

  const ed = JSON.parse(await t.evalJs(`(function () {
    var cards = document.querySelectorAll('.grid-card');
    var fam = 0, allOk = true;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (c.querySelectorAll('.lg-backdrop').length !== 1 || c.querySelectorAll('.lg-specular').length !== 1) allOk = false;
      if (c.classList.contains('content-card') || c.classList.contains('stats-card') || c.classList.contains('asset-card') || c.dataset.cardType === 'flag') fam++;
    }
    var bd = cards.length ? cards[0].querySelector('.lg-backdrop') : null;
    return JSON.stringify({
      total: cards.length, fam: fam, allOk: allOk,
      smFilter: bd ? (bd.style.filter || '') : '',
      bdBackdrop: bd ? getComputedStyle(bd).backdropFilter : '',
      version: window.FLUIDCANVAS_VERSION
    });
  })()`));
  check('H2 钩子建卡全部挂层（各 1/1）', ed.total >= 3 && ed.allOk, ed.total + ' 卡 / allOk=' + ed.allOk);
  check('H3 卡层 sm 滤镜内联（url(#lg-glass-filter-sm)）+ 12px 配方', ed.smFilter.indexOf('lg-glass-filter-sm') > -1 && ed.bdBackdrop.indexOf('blur(12px)') > -1, ed.smFilter + '/' + ed.bdBackdrop);
  check('H4 编辑器版本 v10.28.18', ed.version === 'v10.28.18', String(ed.version));

  // 门控：合成非族卡层藏 / 族卡层显 / card-edge 层藏 / 组内成员层藏
  const gate = JSON.parse(await t.evalJs(`(function () {
    function mk(cls, type) {
      var d = document.createElement('div');
      d.className = 'grid-card ' + cls + ' lg-active';
      if (type) d.dataset.cardType = type;
      d.style.cssText = 'position:absolute;left:5000px;top:5000px;width:50px;height:50px';
      d.appendChild(document.createElement('div')).className = 'lg-backdrop';
      d.appendChild(document.createElement('div')).className = 'lg-specular';
      document.body.appendChild(d);
      return d;
    }
    var text = mk('', 'text');               // 非玻璃族
    var content = mk('content-card', 'content'); // 玻璃族
    var edge = mk('content-card card-edge-none', 'content'); // 主题卡
    var fam = document.querySelector('.grid-card.content-card'); // 真实族卡
    var fb = fam.querySelector('.lg-backdrop');
    var out = {
      textBd: getComputedStyle(text.querySelector('.lg-backdrop')).display,
      contentBd: getComputedStyle(content.querySelector('.lg-backdrop')).display,
      edgeBd: getComputedStyle(edge.querySelector('.lg-backdrop')).display,
      famBd: getComputedStyle(fb).display,
      famParentBf: getComputedStyle(fam).backdropFilter
    };
    [text, content, edge].forEach(function (n) { n.remove(); });
    return JSON.stringify(out);
  })()`));
  check('H5 门控：非族卡层藏 / 族卡层显 / 主题卡层藏', gate.textBd === 'none' && gate.contentBd !== 'none' && gate.edgeBd === 'none' && gate.famBd !== 'none', JSON.stringify(gate));
  check('H6 族卡父 blur none（移交 12px 层）', gate.famParentBf === 'none', String(gate.famParentBf));

  // 旋转重组（真实路径：点击选中 → rotateCard → 弹性重组）
  const rotCard = await t.evalJs(`(function () {
    var cards = document.querySelectorAll('.grid-card.content-card');
    if (!cards.length) return -1;
    var c = cards[0];
    c.dataset.lgTest = '1';
    var r = c.getBoundingClientRect();
    return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
  })()`);
  await t.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rotCard.x, y: rotCard.y, button: 'left', clickCount: 1 });
  await t.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rotCard.x, y: rotCard.y, button: 'left', clickCount: 1 });
  await sleep(250); // 选中态落定
  await t.evalJs('window.rotateCard(15)');
  await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rotCard.x, y: rotCard.y });
  await waitFor(t, "document.querySelector('.grid-card[data-lg-test=\"1\"]').style.transform.indexOf('translate3d') > -1 && document.querySelector('.grid-card[data-lg-test=\"1\"]').style.transform.indexOf('rotate(') === 0", 4000, '旋转重组 transform');
  const rot = await t.evalJs("document.querySelector('.grid-card[data-lg-test=\"1\"]').style.transform");
  check('H7 rotateCard 后弹性重组（rotate 前缀 + translate3d 并存，旋转不丢）', rot.indexOf('rotate(') === 0 && rot.indexOf('translate3d') > -1, String(rot));

  // 组内成员：层藏 + 变形复位（v10.28.17.2 独立背景不回归）
  const grp = await t.evalJs(`(function () {
    var cards = document.querySelectorAll('.grid-card.lg-active');
    if (cards.length < 2) return -1;
    var c1 = cards[0], c2 = cards[1];
    c1.dataset.groupId = 'gtest'; c2.dataset.groupId = 'gtest';
    var r = c1.getBoundingClientRect();
    return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5, n1: cards.length };
  })()`);
  if (grp > -1) {
    await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: grp.x, y: grp.y });
    await sleep(500);
    const g = JSON.parse(await t.evalJs(`(function () {
      var c1 = document.querySelectorAll('.grid-card.lg-active')[0];
      var c2 = document.querySelectorAll('.grid-card.lg-active')[1];
      var b1 = getComputedStyle(c1.querySelector('.lg-backdrop')).display;
      var b2 = getComputedStyle(c2.querySelector('.lg-backdrop')).display;
      var t1 = c1.style.transform;
      c1.classList.add('group-single');
      var bs = getComputedStyle(c1.querySelector('.lg-backdrop')).display;
      c1.classList.remove('group-single');
      return JSON.stringify({ b1: b1, b2: b2, t1: t1, singleShows: bs });
    })()`));
    check('H8 组内成员层藏（独立背景不回归）+ 变形复位（transform 无 translate3d）', g.b1 === 'none' && g.b2 === 'none' && g.t1.indexOf('translate3d') === -1, JSON.stringify(g));
    check('H9 .group-single 单独选中层回归', g.singleShows !== 'none', String(g.singleShows));
    await t.evalJs("document.querySelectorAll('.grid-card.lg-active').forEach(function (c) { delete c.dataset.groupId; })");
  }

  // 组背景 + stats-edit-panel 合成（LG.apply 公共 API 真实路径）
  const dyn = JSON.parse(await t.evalJs(`(function () {
    var bg = document.createElement('div');
    bg.className = 'grid-group-bg';
    bg.style.cssText = 'position:absolute;left:6000px;top:6000px;width:100px;height:60px';
    document.body.appendChild(bg);
    LG.apply(bg, { mode: 'static', filterId: 'lg-glass-filter-sm' });
    var pn = document.createElement('div');
    pn.className = 'stats-edit-panel';
    pn.style.cssText = 'position:absolute;left:6200px;top:6000px;width:100px;height:60px';
    document.body.appendChild(pn);
    LG.apply(pn, { mode: 'static', filterId: 'lg-glass-filter-sm' });
    var bbg = getComputedStyle(bg), pnp = getComputedStyle(pn);
    var out = {
      bgStatic: bg.classList.contains('lg-static'), bgSm: (bg.querySelector('.lg-backdrop').style.filter || '').indexOf('lg-glass-filter-sm') > -1,
      pnStatic: pn.classList.contains('lg-static'), pnSm: (pn.querySelector('.lg-backdrop').style.filter || '').indexOf('lg-glass-filter-sm') > -1,
      bgZ: bbg.zIndex, pnZ: pnp.zIndex, bgTf: bg.style.transform, pnTf: pn.style.transform,
      bgBf: bbg.backdropFilter, pnBf: pnp.backdropFilter
    };
    bg.remove(); pn.remove();
    return JSON.stringify(out);
  })()`));
  check('H10 组背景/stats 面板静态+sm 滤镜挂载（公共 API）', dyn.bgStatic && dyn.bgSm && dyn.pnStatic && dyn.pnSm, JSON.stringify(dyn));
  check('H11 动态静态面零 transform 写 + 父 blur none + 层叠上下文（bg 新 z:0；pn 保留编辑器内联 z:100）', dyn.bgTf === '' && dyn.pnTf === '' && dyn.bgBf === 'none' && dyn.pnBf === 'none' && dyn.bgZ === '0' && dyn.pnZ !== 'auto', dyn.bgZ + '/' + dyn.pnZ + '/' + dyn.bgBf + '/' + dyn.pnBf);

  // 删卡 → frame 剪枝
  const n0 = await t.evalJs('window.LG._els()');
  await t.evalJs("window.createContentCard(2, 2, 8, 4)");
  await sleep(200);
  const n1 = await t.evalJs('window.LG._els()');
  await t.evalJs("var cs = document.querySelectorAll('.grid-card'); var c = cs[cs.length - 1]; c.remove()");
  await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 640, y: 450 });
  await waitFor(t, "window.LG._els() < " + n1, 4000, '删卡后 _els 剪枝');
  const n2 = await t.evalJs('window.LG._els()');
  check('H12 删卡 → frame 反向 isConnected 剪枝（_els 回降）', n1 > n0 && n2 < n1, n0 + '→' + n1 + '→' + n2);

  // ════ I：fluidcanvas 首页（登录态 metric-card + 版本） ════
  await nav(t, BASE + '/pages/fluidcanvas.html');
  await waitFor(t, "document.querySelectorAll('.card.metric-card .lg-backdrop').length > 0", 15000, 'metric-card 挂液态玻璃');
  const fc = JSON.parse(await t.evalJs(`(function () {
    var v = document.getElementById('fcVersion');
    var mc = document.querySelector('.card.metric-card');
    return JSON.stringify({
      vText: v ? v.textContent : '?', guest: document.documentElement.classList.contains('fc-guest'),
      mcLayers: mc.querySelectorAll('.lg-backdrop').length + '/' + mc.querySelectorAll('.lg-specular').length
    });
  })()`));
  check('I1 fcVersion v10.28.18', fc.vText === 'v10.28.18', fc.vText);
  check('I2 登录态无 fc-guest + metric-card 层 1/1（renderContent 的 LG.scan 生效）', !fc.guest && fc.mcLayers === '1/1', fc.guest + '/' + fc.mcLayers);

  // ════ J：暗色 token ════
  await t.evalJs("document.documentElement.setAttribute('data-theme', 'dark')");
  const dark = JSON.parse(await t.evalJs(`(function () {
    var mc = document.querySelector('.card.metric-card');
    var root = getComputedStyle(document.documentElement);
    return JSON.stringify({
      cardBg: getComputedStyle(mc).backgroundColor,
      modalBg: root.getPropertyValue('--modal-bg').trim(),
      cardBgTok: root.getPropertyValue('--card-bg').trim()
    });
  })()`));
  check('J1 暗色卡面 rgba(30,30,50,0.55)（实心假玻璃改半透明）', dark.cardBg === 'rgba(30, 30, 50, 0.55)', dark.cardBg);
  check('J2 暗色 token --card-bg 0.55 / --modal-bg 0.75', dark.cardBgTok === 'rgba(30, 30, 50, 0.55)' && dark.modalBg === 'rgba(30, 30, 55, 0.75)', dark.cardBgTok + '/' + dark.modalBg);
  await t.evalJs("document.documentElement.removeAttribute('data-theme')");

  // ════ K：reduced-motion 全静（H/I 播种的 loggedIn 会藏 hero → 先清回访客态） ════
  await t.evalJs("localStorage.removeItem('slati_session')");
  await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await nav(t, BASE + '/');
  await waitFor(t, "document.querySelector('.guest-hero')", 10000, 'reduce 态首页加载');
  await sleep(600); // 等脚本链执行完（waitFor 只保证 HTML 解析到 hero）
  const rm = JSON.parse(await t.evalJs(`(function () {
    var h = document.querySelector('.guest-hero');
    return JSON.stringify({
      active: h.classList.contains('lg-active'), stat: h.classList.contains('lg-static'),
      els: window.LG._els(), tx: h.style.getPropertyValue('--lg-tx'),
      layers: h.querySelectorAll('.lg-backdrop').length,
      readyState: document.readyState, hasLG: !!window.LG,
      reduce: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    });
  })()`));
  check('K1 reduced-motion → 全静态（无 lg-active、els=0、零变量写、层仍注入）', !rm.active && rm.stat && rm.els === 0 && rm.tx === '' && rm.layers === 1, JSON.stringify(rm));
  await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

  // ════ L：零报错 ════
  check('L1 零 JS 异常', exc.length === 0, exc.slice(0, 3).join(' | '));
  check('L2 零 console error（/api、favicon 过滤）', err.length === 0, err.slice(0, 3).join(' | '));

  console.log('\n═══ 液态玻璃 v2 电池 ' + (fail.length === 0 ? '全绿' : '有红') + '：' + pass.length + '/' + (pass.length + fail.length) + ' ═══');
  t.close();
  chrome.kill();
  try { server.close(); } catch (e) {}
  process.exit(fail.length === 0 ? 0 : 1);
}

main().catch(e => { console.error('电池崩了：', e); process.exit(2); });
