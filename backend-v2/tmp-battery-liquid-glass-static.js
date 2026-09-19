// tmp-battery-liquid-glass-static.js — v0.2.9.1 撤销轮电池（2026-09-03）
// 用户：「算了把前面要求要改的东西都撤销掉」+「除液态玻璃外全部还原」+「Q弹很丑」。
// 新口径：液态玻璃保留（折射+背层模糊+高光，全静态）——其余全部还原：
//   面自身 position/z-index/backdrop-filter 回到原本规则（不再 none/relative/0）、
//   弹性下线（零 .lg-active、零 inline transform 写、零鼠标监听、_els()=0）。
// 跑法：node tmp-battery-liquid-glass-static.js（LIVE_BASE=<完整站点 URL> 跑线上）
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
      fs.readFile(file + '.html', (e2, b2) => {
        if (e2) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b2);
      });
      return;
    }
    if (err) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});

// ── CDP 客户端 ──
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
  const BASE = LIVE || ('http://127.0.0.1:' + PORT);
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
  const errs = [];
  t.on('Runtime.exceptionThrown', p => {
    const d = (p.exceptionDetails.exception && p.exceptionDetails.exception.description) || 'exc';
    if (d.indexOf('data:') === -1) errs.push(d);
  });
  t.on('Log.entryAdded', p => {
    if (p.entry.level === 'error' && p.entry.url && p.entry.url.indexOf('/api/') === -1 &&
        p.entry.url.indexOf('data:') === -1 && p.entry.url.indexOf('favicon') === -1) errs.push(p.entry.text);
  });
  await t.send('Log.enable');

  /* ── A. 首页（访客）：滤镜注入 + hero 静态玻璃 + 侧栏还原 ── */
  await nav(t, BASE + '/');
  await waitFor(t, "document.querySelector('.sidebar-module') && window.LG", 15000, 'index boot');
  check('A1 双 SVG 滤镜注入（大面 -70 / 小卡 -35）',
    await t.evalJs(`(() => { const f1 = document.getElementById('lg-glass-filter'), f2 = document.getElementById('lg-glass-filter-sm'); return !!(f1 && f2 && f1.getAttribute('x') === '-35%' && f2.getAttribute('x') === '-35%'); })()`));
  const a = await t.evalJs(`(() => {
    const hero = document.querySelector('.liquid-glass');
    const sm = document.querySelector('.sidebar-module');
    return {
      heroCls: hero ? hero.className : 'none', heroLayers: hero ? hero.querySelectorAll('.lg-backdrop,.lg-specular').length : -1,
      heroRing: hero ? getComputedStyle(hero).boxShadow.indexOf('inset') > -1 : false,
      heroBox: hero ? getComputedStyle(hero).boxShadow.slice(0, 80) : '?',
      smCls: sm ? sm.className : 'none', smLayers: sm ? sm.querySelectorAll('.lg-backdrop,.lg-specular').length : -1,
      smBf: sm ? getComputedStyle(sm).backdropFilter : '?',
      smPos: sm ? getComputedStyle(sm).position : '?',
      anyActive: document.querySelectorAll('.lg-active').length,
      els: window.LG._els()
    };
  })()`);
  check('A2 hero .liquid-glass.lg-static + 双层 + 静环', a.heroCls.indexOf('lg-static') > -1 && a.heroLayers === 2 && a.heroRing, a.heroCls + '/' + a.heroLayers + ' box:' + a.heroBox);
  check('A3 侧栏模块静态玻璃 + 双层', a.smCls.indexOf('lg-static') > -1 && a.smLayers === 2, a.smCls);
  check('A4 侧栏模块自身 backdrop-filter 还原（不再 none）', a.smBf !== 'none', a.smBf);
  check('A5 全页零 .lg-active + 弹性队列 _els()=0', a.anyActive === 0 && a.els === 0, a.anyActive + '/' + a.els);

  /* A6 导航菜单不被玻璃层顶出卡片（2026-09-03 用户主诉——sticky 层占流真身） */
  const anav = await t.evalJs(`(() => {
    const nav = document.querySelector('.nav-module');
    if (!nav) return 'no-nav';
    const nr = nav.getBoundingClientRect();
    const item = nav.querySelector('.sidebar-nav a, .sidebar-nav button, .sidebar-nav .nav-item, .sidebar-nav > *');
    const ir = item ? item.getBoundingClientRect() : null;
    const bd = nav.querySelector('.lg-backdrop');
    return {
      bdPos: bd ? getComputedStyle(bd).position : '?',
      navT: Math.round(nr.top),
      itemT: ir ? Math.round(ir.top) : -1,
      scrollH: nav.scrollHeight, clientH: nav.clientHeight
    };
  })()`);
  check('A6 导航菜单在卡片内可见（层 absolute 出流，零空位零滚动）', anav !== 'no-nav' && anav.bdPos === 'absolute' && anav.itemT > -1 && anav.itemT < anav.navT + 120 && anav.scrollH <= anav.clientH + 160, JSON.stringify(anav));

  /* A7 侧栏滚动条隐藏（用户 2026-09-03「把左侧根菜单的上下滑轨隐藏」） */
  const asb = await t.evalJs(`(() => {
    const nav = document.querySelector('.nav-module');
    if (!nav) return 'no-nav';
    let ws = 'n/a';
    try { ws = getComputedStyle(nav, '::-webkit-scrollbar').display; } catch (e) { ws = 'err'; }
    return { sw: getComputedStyle(nav).scrollbarWidth, ws };
  })()`);
  check('A7 侧栏滚动条隐藏（scrollbar-width none + ::-webkit-scrollbar none）', asb !== 'no-nav' && asb.sw === 'none' && asb.ws === 'none', JSON.stringify(asb));

  /* ── B. 登录卡（signup-and-login）：z:2 原规则直接生效 ── */
  await nav(t, BASE + '/signup-and-login');
  await waitFor(t, "document.querySelector('.auth-card.lg-static')", 15000, 'auth boot');
  const b = await t.evalJs(`(() => {
    const ac = document.querySelector('.auth-card');
    const cs = getComputedStyle(ac);
    return { z: cs.zIndex, bf: cs.backdropFilter, pos: cs.position };
  })()`);
  check('B1 auth-card 原 z:2 / 原 backdrop-filter / 原 position', b.z === '2' && b.bf !== 'none' && b.pos === 'relative', b.z + '/' + b.bf + '/' + b.pos);

  /* ── C. 编辑器（登录态）：右键菜单与浮层全部原样 + 卡片静态玻璃零弹 ── */
  await t.evalJs("localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true }))");
  await nav(t, BASE + '/pages/fluidcanvas-editor.html');
  await waitFor(t, "document.querySelector('#contextMenu') && document.readyState==='complete'", 20000, 'editor boot');
  const c0 = await t.evalJs(`(() => {
    const m = document.getElementById('contextMenu');
    const cs = getComputedStyle(m);
    return { pos: cs.position, z: cs.zIndex, bf: cs.backdropFilter, cls: m.className };
  })()`);
  check('C1 右键菜单原样：fixed + z200 + 自身 blur(24px) + 静态玻璃', c0.pos === 'fixed' && c0.z === '200' && c0.bf !== 'none' && c0.cls.indexOf('lg-static') > -1, c0.pos + '/' + c0.z + '/' + c0.bf);
  const c1 = await t.evalJs(`(() => {
    const tt = document.getElementById('textToolbar'), fp = document.getElementById('fontPanel');
    const ttCs = getComputedStyle(tt), fpCs = getComputedStyle(fp);
    const ov = document.getElementById('mapRegionOverlay');
    if (ov) ov.classList.add('active'); // 覆盖层默认 display:none，激活后才能读几何
    const side = document.querySelector('.mre-side');
    const panel = document.getElementById('mrePanel');
    return { tt: ttCs.position + '/' + ttCs.zIndex, fp: fpCs.position + '/' + fpCs.zIndex,
      sideBf: getComputedStyle(side).backdropFilter, panelOp: panel.offsetParent ? panel.offsetParent.className : null };
  })()`);
  check('C2 text-toolbar / font-panel 原样 fixed 301/302', c1.tt === 'fixed/301' && c1.fp === 'fixed/302', c1.tt + ' / ' + c1.fp);
  check('C3 mre-side 原 backdrop-filter 还原 + 面板包含块机制复原（offsetParent=mre-side）', c1.sideBf !== 'none' && c1.panelOp.indexOf('mre-side') > -1, c1.sideBf + '/' + c1.panelOp);

  await t.evalJs("window.createContentCard(2, 2, 6, 6); window.createFlagCard(6, 0, 4, 4); 1");
  await sleep(800);
  const c2 = await t.evalJs(`(() => {
    const cards = document.querySelectorAll('.grid-card');
    let glass = 0, layersOk = 0, ownBfOk = 0;
    cards.forEach(c => {
      const cs = getComputedStyle(c);
      if (c.classList.contains('lg-static')) glass++;
      if (c.querySelectorAll('.lg-backdrop,.lg-specular').length === 2) layersOk++;
      if (cs.backdropFilter !== 'none') ownBfOk++;
    });
    const anyActive = document.querySelectorAll('.lg-active').length;
    return { n: cards.length, glass, layersOk, ownBfOk, anyActive, els: window.LG._els() };
  })()`);
  check('C4 编辑器卡全静态玻璃 + 双层 + 自身模糊还原', c2.glass === c2.n && c2.layersOk === c2.n && c2.ownBfOk === c2.n, JSON.stringify(c2));
  check('C5 编辑器零 .lg-active + _els()=0', c2.anyActive === 0 && c2.els === 0, c2.anyActive + '/' + c2.els);

  /* 鼠标扫过卡片：不得出现任何 transform/CSS 变量写（Q弹已死） */
  await t.evalJs(`(() => {
    const c = document.querySelector('.grid-card');
    const r = c.getBoundingClientRect();
    window.scrollTo(0, 0);
    return r.top + r.height / 2;
  })()`);
  for (let i = 0; i < 6; i++) {
    await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 400, y: 300 + i * 30 });
    await sleep(50);
  }
  await sleep(300);
  const c3 = await t.evalJs(`(() => {
    let wrote = [];
    document.querySelectorAll('.grid-card').forEach(c => {
      if (c.style.transform.indexOf('translate3d') > -1) wrote.push('transform:' + c.style.transform.slice(0, 40));
      if (c.style.getPropertyValue('--lg-tx')) wrote.push('var');
    });
    return { wrote, els: window.LG._els() };
  })()`);
  check('C6 鼠标扫过零 transform/CSS 变量写（Q弹已死）', c3.wrote.length === 0 && c3.els === 0, JSON.stringify(c3.wrote));

  /* 右键菜单真实路径：对卡派发 contextmenu → 菜单落点在光标处（用户 9-03 主诉） */
  const c4 = await t.evalJs(`(() => {
    const c = document.querySelector('.grid-card');
    const r = c.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
    c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    const m = document.getElementById('contextMenu');
    const mr = m.getBoundingClientRect();
    return { x, y, active: m.classList.contains('active'), pos: getComputedStyle(m).position,
      l: Math.round(mr.left), t: Math.round(mr.top) };
  })()`);
  check('C7 右键菜单在光标处打开（fixed 落点 x/y 吻合）', c4.active && c4.pos === 'fixed' && c4.l === c4.x && c4.t === c4.y, JSON.stringify(c4));

  /* 旋转重组：静态模式下 rotate 原样工作 */
  await t.evalJs(`(() => {
    const c = document.querySelector('.grid-card');
    c.click();
    window.rotateCard(15);
    return 1;
  })()`);
  await sleep(300);
  const c5 = await t.evalJs(`(() => {
    const c = document.querySelector('.grid-card');
    return { tr: c.style.transform, rot: c.dataset.rotate };
  })()`);
  check('C8 旋转卡片 rotate(15deg) 原样（无弹性覆盖）', c5.tr.indexOf('rotate(15deg)') > -1, c5.tr);

  /* 门控（合成卡，免订阅门槛）：非族卡层藏 / 主题卡层藏 / 族卡层显 */
  const c6 = await t.evalJs(`(() => {
    function mk(cls, type) {
      var d = document.createElement('div');
      d.className = 'grid-card ' + cls + ' lg-static';
      if (type) d.dataset.cardType = type;
      d.style.cssText = 'position:absolute;left:5000px;top:5000px;width:50px;height:50px';
      var bd = document.createElement('div'); bd.className = 'lg-backdrop'; d.appendChild(bd);
      d.appendChild(document.createElement('div')).className = 'lg-specular';
      document.body.appendChild(d);
      return d;
    }
    var text = mk('', 'text');                                  // 非玻璃族
    var edge = mk('content-card card-edge-none', 'content');    // 主题卡
    var fam = mk('content-card', 'content');                    // 玻璃族
    var out = {
      textBd: getComputedStyle(text.querySelector('.lg-backdrop')).display,
      edgeBd: getComputedStyle(edge.querySelector('.lg-backdrop')).display,
      famBd: getComputedStyle(fam.querySelector('.lg-backdrop')).display
    };
    [text, edge, fam].forEach(function (n) { n.remove(); });
    return out;
  })()`);
  check('C9 门控：非族卡层藏 / 主题卡（card-edge）层藏 / 族卡层显', c6.textBd === 'none' && c6.edgeBd === 'none' && c6.famBd !== 'none', JSON.stringify(c6));

  /* ── D. 设置弹窗（懒建）静态玻璃挂载 ── */
  await nav(t, BASE + '/pages/help.html');
  await waitFor(t, "window.SlatiSettings && window.LG", 15000, 'help boot');
  await t.evalJs("window.SlatiSettings.open(); 1");
  await sleep(500);
  const d = await t.evalJs(`(() => {
    const mc = document.querySelector('.modal-card');
    if (!mc) return 'no-modal';
    return { cls: mc.className, layers: mc.querySelectorAll('.lg-backdrop,.lg-specular').length, bf: getComputedStyle(mc).backdropFilter };
  })()`);
  check('D1 设置弹窗懒建后挂静态玻璃 + 自身模糊还原', d !== 'no-modal' && d.cls.indexOf('lg-static') > -1 && d.layers === 2 && d.bf !== 'none', JSON.stringify(d));

  /* ── E. 全局：零控制台错误 ── */
  check('E1 全程零 console error（不含 data:/favicon/api）', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log('\n===== 结果: ' + pass.length + ' 过 / ' + fail.length + ' 挂 =====');
  if (fail.length) { console.log(fail.join('\n')); }
  t.close();
  chrome.kill();
  if (!LIVE) server.close();
  process.exit(fail.length ? 1 : 0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
