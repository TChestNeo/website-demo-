// tmp-probe-fc-pillmenu.js — FC v10.28.47.2 触控长按药丸菜单进左侧菜单（面板内嵌）上线实机探针
// 用户「怎么还是一样是竖着的药丸？我要的是直接就是在左侧菜单内不是单独的弹窗！！」+「那三粒点
//   我要的是横向的不是纵向的」+「三粒点就是把左侧原本的卡片菜单折叠起来而已点击就是展开」——问询
//   钦定：底部停靠（卡片列表保持在上方，菜单从面板底部向上滑出、停靠面板最底部）；47.2 改轮：
//   用户截图钦定顶部停靠（红带=折叠三粒点位置在左侧菜单最顶、蓝区=电脑端弹窗内容）——B1/B3
//   断言随轮改首子=顶部停靠——44.2 线上实证：
//   S 静态（线上 site-config 44.2+进左侧菜单 changelog+rev 00293-+站点 58.0 恒、编辑器 ctxPillDots
//   钮+面板内嵌 CSS+横向三点 more_horiz+_lastMoveEv 守卫锚、fc-touch.js __fcTouchMenu 旗）/
//   B 实机触控（CDP iPad 仿真：长按现身菜单在面板内/药丸头首位/点 ⋯ 折叠/再点展开/空画布双消+
//   重呼出/手柄纯 tap/真 tap 删卡/面板折叠自动展开）。
// 全 Node 内置模块：https + ws CDP（登录态 stub 同 fc-tablet 探针口径）。
'use strict';
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PASS = { n: 0 }, FAIL = { n: 0 };
const ok = (name, cond, detail) => {
  if (cond) { PASS.n++; console.log('  ✅ ' + name); }
  else { FAIL.n++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
};
const get = (url) => new Promise((resolve) => {
  const req = https.request(url, { headers: { 'User-Agent': 'mn-probe' }, timeout: 30000 }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 2000000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; this.consoleErrs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = (m.params && m.params.exceptionDetails) || {};
        this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 300));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
      } else if (m.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
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
  const BASE = 'https://mnationworld.com';

  // ── S 线上静态 ──
  const sc = await get(BASE + '/assets/js/site-config.js');
  ok('S1 线上 site-config：FC v10.28.47.2 + 触控长按药丸菜单进左侧菜单 changelog + 47.2 顶部停靠 changelog + rev 00293- + 站点恒 v0.2.58.0',
    sc.status === 200 && sc.body.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.2';") !== -1 &&
    sc.body.indexOf('触控长按药丸菜单进左侧菜单') !== -1 && sc.body.indexOf('左侧菜单最顶部') !== -1 &&
    sc.body.indexOf('rev 00293-') !== -1 &&
    sc.body.indexOf('v0.2.58.0') !== -1,
    'status=' + sc.status + ' err=' + sc.error);
  const fc = await get(BASE + '/pages/fluidcanvas-editor.html');
  ok('S2 线上编辑器页：ctxPillDots 三点钮 + 横向三点 more_horiz + 面板内嵌 CSS（static/占满宽/真药丸规格/顶部停靠锚）+ ctxPillIn 顶滑入动画/内联压 !important + _lastMoveEv 守卫锚在场 + 旧底停靠锚（appendChild/ctxPillUp）零在场 + 旧左下停靠 CSS 零在场',
    fc.status === 200 &&
    fc.body.indexOf('id="ctxPillDots"') !== -1 &&
    fc.body.indexOf('more_horiz') !== -1 &&
    fc.body.indexOf('position: static;') !== -1 &&
    fc.body.indexOf('width: 100%; min-width: 0;') !== -1 &&
    fc.body.indexOf('border-radius: var(--radius-full);') !== -1 &&
    fc.body.indexOf('panel.insertBefore(contextMenu, panel.firstChild)') !== -1 &&
    fc.body.indexOf('margin-bottom: 8px;') !== -1 &&
    fc.body.indexOf('panel.appendChild(contextMenu)') === -1 &&
    fc.body.indexOf('min-height: 40px;') !== -1 &&
    fc.body.indexOf('left: 14px; top: auto; bottom: 14px;') === -1 &&
    fc.body.indexOf('@keyframes ctxPillIn') !== -1 &&
    fc.body.indexOf('translateY(-110%)') !== -1 &&
    fc.body.indexOf('@keyframes ctxPillUp') === -1 &&
    fc.body.indexOf('display: none !important;') !== -1 &&
    fc.body.indexOf('placeCtxPillDots') !== -1 &&
    fc.body.indexOf('if (_lastMoveEv) {') !== -1,
    'status=' + fc.status + ' err=' + fc.error);
  const tj = await get(BASE + '/assets/js/fc-touch.js');
  ok('S3 线上 fc-touch.js：可加载 + 长按派发前置 __fcTouchMenu 旗在位',
    tj.status === 200 &&
    tj.body.indexOf("matchMedia('(pointer: coarse)')") !== -1 &&
    tj.body.indexOf('window.__fcTouchMenu') !== -1,
    'status=' + tj.status + ' err=' + tj.error);

  // ── B 线上实机触控（iPad 仿真）──
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const CDP_PORT = 9600 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-fcpill-' + Date.now());
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
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 834, height: 1194, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "!!document.getElementById('gridCanvas') && !!window.createSneCard && !!window.__fcTouch", 30000, 'B 编辑器加载');
    await sleep(800);

    const tch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type: type, touchPoints: pts });
    const tpoint = (id, x, y) => ({ x: Math.round(x), y: Math.round(y), radiusX: 2, radiusY: 2, force: 1, id: id });
    const tapAt = async (x, y) => { await tch('touchStart', [tpoint(0, x, y)]); await sleep(50); await tch('touchEnd', []); await sleep(120); };
    const holdTouch = async (x, y, ms) => { await tch('touchStart', [tpoint(0, x, y)]); await sleep(ms); await tch('touchEnd', []); await sleep(120); };
    const cardPoint = () => cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card');" +
      " if (!c) return null; var r = c.getBoundingClientRect();" +
      " var bad = 'input, textarea, select, button, a, [contenteditable=\"true\"], .card-text-content, .card-edit-field, .card-label, .resize-handle, .rotate-grip, .sheet-col-grip, .sheet-row-grip';" +
      " for (var fy = 0.2; fy <= 0.85; fy += 0.15) for (var fx = 0.2; fx <= 0.85; fx += 0.15) {" +
      "  var el = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);" +
      "  if (el && el.closest('.grid-card') === c && !el.closest(bad)) return { x: Math.round(r.left + r.width * fx), y: Math.round(r.top + r.height * fy) };" +
      " } return null; })()");
    const menuState = () => cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " if (!m) return { open: false };" +
      " var cs = getComputedStyle(m); var vis = 0;" +
      " document.querySelectorAll('.context-menu .context-menu-item').forEach(function (it) { if (getComputedStyle(it).display !== 'none') vis++; });" +
      " var d = document.getElementById('ctxPillDots');" +
      " var inPanel = !!(m.parentNode && m.parentNode.classList && m.parentNode.classList.contains('asset-panel'));" +
      " return { open: cs.display !== 'none', pill: m.classList.contains('ctx-pill')," +
      " collapsed: m.classList.contains('ctx-collapsed'), pos: cs.position, left: cs.left, bottom: cs.bottom," +
      " radius: cs.borderRadius, w: m.offsetWidth, h: m.offsetHeight, vis: vis, dotsDisplay: d ? getComputedStyle(d).display : 'none'," +
      " dh: d ? d.offsetHeight : 0, inlineL: m.style.left, inlineT: m.style.top," +
      " inPanel: inPanel, first: inPanel && m.parentNode.firstElementChild === m," +
      " aboveSearch: inPanel && !!(m.nextElementSibling && m.nextElementSibling.classList.contains('search-capsule'))," +
      " dRadius: d ? parseFloat(getComputedStyle(d).borderRadius) : 0," +
      " dBg: d ? getComputedStyle(d).backgroundColor : '' }; })()");

    const gate = await cdp.evalJs("(function(){ return { coarse: matchMedia('(pointer: coarse)').matches, mtp: navigator.maxTouchPoints, bridge: !!window.__fcTouch }; })()");
    ok('B0 门控自证：coarse 媒体查询翻转 + maxTouchPoints=5 + 触控桥在场',
      gate && gate.coarse === true && gate.mtp === 5 && gate.bridge, JSON.stringify(gate));

    await cdp.evalJs('window.createSneCard(2, 2, 9, 12)');
    await sleep(200);
    const pt = await cardPoint();
    await holdTouch(pt.x, pt.y, 650);
    const b1 = await menuState();
    ok('B1 长按现身：菜单开 + ctx-pill 有 + 非折叠 + 在 .asset-panel 内（首子=顶部停靠+紧邻搜索框）+ static 定位 + 宽 228-242（面板内宽·滚条在时收窄）+ 横药丸头 236×40 真药丸（radius-full 大圆角 + 实底）+ ≥3 项可见',
      b1.open === true && b1.pill === true && b1.collapsed === false &&
      b1.inPanel === true && b1.first === true && b1.aboveSearch === true &&
      b1.pos === 'static' && b1.left === 'auto' && b1.bottom === 'auto' &&
      b1.w >= 228 && b1.w <= 242 && b1.dh >= 38 && b1.dh <= 48 &&
      b1.dRadius >= 100 && b1.dBg !== 'rgba(0, 0, 0, 0)' && b1.dBg !== 'transparent' && b1.vis >= 3,
      JSON.stringify(b1));

    // B2 三点钮：在菜单内 + display flex + 恒居首位（药丸头——44.1 用户修正，原中部插入作废）+ 横向三点 more_horiz
    const b2 = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " var d = document.getElementById('ctxPillDots');" +
      " var items = m.querySelectorAll('.context-menu-item'); var firstItem = null;" +
      " for (var i = 0; i < items.length; i++) if (items[i].style.display !== 'none') { firstItem = items[i]; break; }" +
      " var dd = getComputedStyle(d); var ic = d.querySelector('.material-symbols-outlined');" +
      " return { inMenu: m.contains(d), dots: dd.display, firstChild: m.firstElementChild === d," +
      " icon: ic ? ic.textContent : ''," +
      " dotsTop: d.offsetTop, dotsH: d.offsetHeight, itemTop: firstItem ? firstItem.offsetTop : -1 }; })()");
    ok('B2 药丸头首位：钮在菜单内 + display flex + 恒为首子元素 + more_horiz 横向三点 + 全部可见项在药丸下方（itemTop ≥ 药丸底）',
      b2 && b2.inMenu === true && b2.dots === 'flex' && b2.firstChild === true &&
      b2.icon === 'more_horiz' &&
      b2.itemTop >= b2.dotsTop + b2.dotsH - 1,
      JSON.stringify(b2));

    // B3 点 ⋯ → 折叠（全项 none + 容器透明化只留横药丸 236×40——不缩宽不竖缩）——原生 compat click，飘则 el.click() 兜底
    const dotsPt = await cdp.evalJs("(function(){ var d = document.getElementById('ctxPillDots'); var r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    await tapAt(dotsPt.x, dotsPt.y);
    await sleep(300);
    if (!(await cdp.evalJs("!!document.querySelector('.context-menu') && document.querySelector('.context-menu').classList.contains('ctx-collapsed')"))) {
      await cdp.evalJs("document.getElementById('ctxPillDots').click()"); // 兜底
      await sleep(150);
    }
    const b3 = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " var cs = getComputedStyle(m); var allNone = true;" +
      " document.querySelectorAll('.context-menu .context-menu-item').forEach(function (it) { if (getComputedStyle(it).display !== 'none') allNone = false; });" +
      " var d = document.getElementById('ctxPillDots');" +
      " var inPanel = !!(m.parentNode && m.parentNode.classList && m.parentNode.classList.contains('asset-panel'));" +
      " return { collapsed: m.classList.contains('ctx-collapsed'), allNone: allNone, w: m.offsetWidth," +
      " h: m.offsetHeight, dots: getComputedStyle(d).display, mBg: cs.backgroundColor, mBw: cs.borderWidth," +
      " inPanel: inPanel, first: inPanel && m.parentNode.firstElementChild === m }; })()");
    ok('B3 点 ⋯ 折叠：ctx-collapsed + 全项 display none + 横药丸 236×≤48（宽不缩、横卧）+ 容器透明化（bg 透明+边 0）只留药丸 + 三点 flex + 仍在面板顶部',
      b3 && b3.collapsed === true && b3.allNone === true && b3.w >= 228 && b3.w <= 242 &&
      b3.h >= 38 && b3.h <= 48 && b3.w > b3.h &&
      b3.mBg === 'rgba(0, 0, 0, 0)' && b3.mBw === '0px' &&
      b3.dots === 'flex' && b3.inPanel === true && b3.first === true,
      JSON.stringify(b3));

    // B4 再点 ⋮ → 重新展开（条目回到药丸下方）
    const dotsPt2 = await cdp.evalJs("(function(){ var d = document.getElementById('ctxPillDots'); var r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    await tapAt(dotsPt2.x, dotsPt2.y);
    await sleep(300);
    if (await cdp.evalJs("!!document.querySelector('.context-menu') && document.querySelector('.context-menu').classList.contains('ctx-collapsed')")) {
      await cdp.evalJs("document.getElementById('ctxPillDots').click()"); // 兜底
      await sleep(150);
    }
    const b4 = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu'); var vis = 0;" +
      " document.querySelectorAll('.context-menu .context-menu-item').forEach(function (it) { if (getComputedStyle(it).display !== 'none') vis++; });" +
      " var d = document.getElementById('ctxPillDots'); var firstItem = null;" +
      " var items = m.querySelectorAll('.context-menu-item');" +
      " for (var i = 0; i < items.length; i++) if (getComputedStyle(items[i]).display !== 'none') { firstItem = items[i]; break; }" +
      " return { collapsed: m.classList.contains('ctx-collapsed'), vis: vis, w: m.offsetWidth," +
      " itemTop: firstItem ? firstItem.offsetTop : -1, dotsTop: d.offsetTop, dotsH: d.offsetHeight }; })()");
    ok('B4 再点展开：ctx-collapsed 清 + ≥6 项可见 + 宽 ≥228 + 功能栏条目回到药丸下方（itemTop ≥ 药丸底）',
      b4 && b4.collapsed === false && b4.vis >= 6 && b4.w >= 228 &&
      b4.itemTop >= b4.dotsTop + b4.dotsH - 1, JSON.stringify(b4));

    // B5 空画布 strict 空点 tap → 双消（避开卡缘 ±60：Chrome 触控命中膨胀小目标）；再长按恒展开
    const strictEp = await cdp.evalJs("(function(){ var cv = document.getElementById('gridCanvas');" +
      " var card = document.querySelector('#gridCanvas .grid-card'); var cr = card ? card.getBoundingClientRect() : null;" +
      " var m = document.querySelector('.context-menu'); var mr = m ? m.getBoundingClientRect() : null;" +
      " for (var y = 100; y <= 650; y += 20) for (var x = 300; x < 800; x += 20) {" +
      "  if (document.elementFromPoint(x, y) !== cv) continue;" +
      "  if (cr && x > cr.left - 60 && x < cr.right + 60 && y > cr.top - 60 && y < cr.bottom + 60) continue;" +
      "  if (mr && x > mr.left - 30 && x < mr.right + 30 && y > mr.top - 30 && y < mr.bottom + 30) continue;" +
      "  return { x: x, y: y }; } return null; })()");
    await tapAt(strictEp.x, strictEp.y);
    await sleep(250);
    const b4a = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " return { open: !!m && getComputedStyle(m).display !== 'none'," +
      " sel: document.querySelectorAll('#gridCanvas .grid-card.selected').length }; })()");
    ok('B5 空画布 tap 双消：菜单关 + 选中清（' + JSON.stringify(strictEp) + '）',
      strictEp !== null && b4a.open === false && b4a.sel === 0, JSON.stringify(b4a));
    const ptR = await cardPoint();
    await holdTouch(ptR.x, ptR.y, 650);
    const b4b = await menuState();
    ok('B5b 重长按：恒展开呼出（ctx-pill 有 + ctx-collapsed 已清——hideContextMenu 清理证明）',
      b4b.open === true && b4b.pill === true && b4b.collapsed === false, JSON.stringify(b4b));

    // B6 手柄纯 tap（无移动）→ 菜单经 click 冒泡关 + 选中保持 + 卡尺寸零变化
    const hdlPt = await cdp.evalJs("(function(){ var h = document.querySelector('#gridCanvas .resize-handle');" +
      " if (!h) return null; var r = h.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()");
    const cardRectBefore = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card');" +
      " var r = c.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; })()");
    await tapAt(hdlPt.x, hdlPt.y);
    await sleep(250);
    const b5 = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " var c = document.querySelector('#gridCanvas .grid-card'); var r = c.getBoundingClientRect();" +
      " return { open: !!m && getComputedStyle(m).display !== 'none'," +
      " sel: document.querySelectorAll('#gridCanvas .grid-card.selected').length," +
      " rect: { l: r.left, t: r.top, w: r.width, h: r.height } }; })()");
    ok('B6 手柄纯 tap：菜单关（click 冒泡）+ 选中保持 + 卡尺寸零变化',
      hdlPt !== null && b5.open === false && b5.sel === 1 &&
      Math.abs(b5.rect.l - cardRectBefore.l) < 1 && Math.abs(b5.rect.t - cardRectBefore.t) < 1 &&
      b5.rect.w === cardRectBefore.w && b5.rect.h === cardRectBefore.h, JSON.stringify(b5));

    // B7 菜单开着真 tap 删除项（danger）→ 卡数 -1 + 菜单关
    const ptB6 = await cardPoint();
    await holdTouch(ptB6.x, ptB6.y, 650); // B6 手柄 tap 已关菜单——重长按再开
    const countBeforeDel = await cdp.evalJs("document.querySelectorAll('#gridCanvas .grid-card').length");
    const delPt = await cdp.evalJs("(function(){ var d = document.querySelector('.context-menu .context-menu-item.danger');" +
      " if (!d) return null; var r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    await tapAt(delPt.x, delPt.y);
    await sleep(300);
    let stillOpen = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu'); return !!m && getComputedStyle(m).display !== 'none'; })()");
    if (stillOpen) { // 兜底：原生合成 click 没接住 → 直接程序化点击
      await cdp.evalJs("(function(){ var d = document.querySelector('.context-menu .context-menu-item.danger'); if (d) d.click(); })()");
      await sleep(200);
      stillOpen = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu'); return !!m && getComputedStyle(m).display !== 'none'; })()");
    }
    const countAfterDel = await cdp.evalJs("document.querySelectorAll('#gridCanvas .grid-card').length");
    ok('B7 真 tap 删除项：卡数 ' + countBeforeDel + '→' + countAfterDel + ' + 菜单关',
      countAfterDel === countBeforeDel - 1 && stillOpen === false,
      JSON.stringify({ before: countBeforeDel, after: countAfterDel, open: stillOpen }));

    // B8 面板折叠态 → 长按 → 面板自动展开 + 菜单仍在面板内（44.2 新：菜单在内不可见故自动展开）
    await cdp.evalJs('window.createSneCard(6, 6, 9, 12)'); // B7 已删卡——先建再长按
    await sleep(200);
    await cdp.evalJs("document.querySelector('.asset-panel').classList.add('collapsed')");
    await sleep(400); // width 0.25s 过渡
    const pt8 = await cardPoint();
    await holdTouch(pt8.x, pt8.y, 650);
    await sleep(400);
    const b8 = await cdp.evalJs("(function(){ var p = document.querySelector('.asset-panel');" +
      " var m = document.querySelector('.context-menu');" +
      " return { collapsed: p.classList.contains('collapsed'), pw: p.offsetWidth," +
      " menuInPanel: !!m && m.parentNode === p, open: !!m && getComputedStyle(m).display !== 'none'," +
      " pill: !!m && m.classList.contains('ctx-pill') }; })()");
    ok('B8 面板折叠时长按：面板自动展开（无 collapsed + 宽>0）+ 菜单开且在面板内（ctx-pill）',
      b8 && b8.collapsed === false && b8.pw > 0 && b8.menuInPanel === true && b8.open === true && b8.pill === true,
      JSON.stringify(b8));

    ok('E1 实机全程零 Runtime.exceptionThrown + 零 console.error',
      cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      JSON.stringify({ errs: cdp.errs.slice(0, 3), cons: cdp.consoleErrs.slice(0, 3) }));
    cdp.close();
  } catch (e) {
    console.error('💥 探针异常: ' + (e && e.stack || e));
    FAIL.n++;
  } finally {
    try { chrome.kill(); } catch (e) {}
  }
  console.log('');
  console.log('╭──────────────────────────────────────────╮');
  console.log('│  🎉 ' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌  (fc-pillmenu-live)      │');
  console.log('╰──────────────────────────────────────────╯');
  if (FAIL.n > 0) process.exit(1);
  else process.exit(0);
})().catch((e) => { console.error('💥 探针异常: ' + (e && e.stack || e)); process.exit(1); });
