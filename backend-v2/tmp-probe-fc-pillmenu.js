// tmp-probe-fc-pillmenu.js — FC v10.28.47.4 平板端触控长按药丸菜单·平滑折叠+白底列表上线实机探针
// 用户「折叠的过渡动画不顺畅 很割裂」+「列表的背景能不能是白色的？」——47.3 两卡结构保持（药丸=
//   独立卡片①面板首子、弹窗=独立卡片②面板次子，ctxPillRise translateY(110%)→0 从下向上滑出）；
//   47.4 折叠/展开/关窗全走过渡（fc-pill-fold-prep 收起视觉态 translateY(-56px)+opacity、门控
//   fc-pill-fold 延迟 250ms 落 display:none、关窗退出动画 ctxPillFall 240ms+收尾计时器 240ms 后
//   内容展开回来）；药丸弹窗卡列表恒白底 #ffffff（深浅同）+条目压暗；桌面右键零变化；药丸只在菜单
//   打开时出现（用户钦定，平时左侧菜单原样）。
//   S 静态（线上 site-config 47.4+平滑折叠 changelog+rev 00325-+站点 58.0 恒+旧 47.3 赋值零残留、
//   编辑器页 两卡锚（placeCtxPillDots/fc-pill-fold/ctxPillRise/translateY(110%)/ctxPillFade/
//   .asset-panel > .ctx-pill-dots）在场+47.4 锚（fc-pill-fold-prep/ctxPillFall/ctxPillFadeOut/
//   ctx-pill-exit/__pillCloseTimer/__foldTimer/finishHideContextMenu/translateY(-56px)/#ffffff）
//   在场+旧一体化锚（ctxPillIn/translateY(-110%)/ctx-collapsed）零残留、fc-touch.js __fcTouchMenu 旗）/
//   B 实机触控（CDP iPad 仿真：长按平滑折叠两卡结构+白底/两卡独立+动画落定/点药丸平滑关窗三段/
//   再长按重开/桌面右键零变化/空画布 tap 双消/真 tap 删卡/面板折叠时长按自动展开）。
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
  ok('S1 线上 site-config：FC v10.28.47.4 + 平滑折叠 changelog（折叠的过渡动画不顺畅/列表的背景能不能是白色的）+ 两卡 changelog（三粒点独立一个/从下向上滑出）+ rev 00325- + 站点恒 v0.2.58.15 + 旧 47.3 版本赋值锚零残留',
    sc.status === 200 && sc.body.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") !== -1 &&
    sc.body.indexOf('折叠的过渡动画不顺畅') !== -1 &&
    sc.body.indexOf('列表的背景能不能是白色的') !== -1 &&
    sc.body.indexOf('三粒点独立一个') !== -1 &&
    sc.body.indexOf('从下向上滑出') !== -1 &&
    sc.body.indexOf('rev 00325-') !== -1 &&
    sc.body.indexOf('v0.2.58.15') !== -1 &&
    sc.body.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.3';") === -1,
    'status=' + sc.status + ' err=' + sc.error);
  const fc = await get(BASE + '/pages/fluidcanvas-editor.html');
  const fcHtml = fc.body.replace(/\r\n/g, '\n'); // 归一换行（紧锚 hideContextMenu();\n  } 依赖 LF）
  ok('S2 线上编辑器页：两卡锚（placeCtxPillDots(panel)/fc-pill-fold/@keyframes ctxPillRise/translateY(110%)/@keyframes ctxPillFade/.asset-panel > .ctx-pill-dots/折叠门控 !important/药丸关窗 toggleCtxPill）在场 + 47.4 平滑折叠锚（fc-pill-fold-prep/@keyframes ctxPillFall/@keyframes ctxPillFadeOut/ctx-pill-exit/__pillCloseTimer/__foldTimer/function finishHideContextMenu()/translateY(-56px)/background: #ffffff;）在场 + 旧一体化锚（ctxPillIn/translateY(-110%)/ctx-collapsed）零残留 + flex-shrink 禁压保持 + 药丸钮/菜单首子挂载锚在场 + more_horiz 横向三点 + _lastMoveEv 守卫',
    fc.status === 200 &&
    fcHtml.indexOf('placeCtxPillDots(panel)') !== -1 &&
    fcHtml.indexOf('fc-pill-fold') !== -1 &&
    fcHtml.indexOf('@keyframes ctxPillRise') !== -1 &&
    fcHtml.indexOf('translateY(110%)') !== -1 &&
    fcHtml.indexOf('@keyframes ctxPillFade') !== -1 &&
    fcHtml.indexOf('.asset-panel > .ctx-pill-dots') !== -1 &&
    fcHtml.indexOf('display: none !important;') !== -1 &&
    fcHtml.indexOf('hideContextMenu();\n  }') !== -1 &&
    fcHtml.indexOf('flex-shrink: 0;') !== -1 &&
    fcHtml.indexOf('id="ctxPillDots"') !== -1 &&
    fcHtml.indexOf('panel.insertBefore(contextMenu, panel.firstChild)') !== -1 &&
    fcHtml.indexOf('more_horiz') !== -1 &&
    fcHtml.indexOf('if (_lastMoveEv) {') !== -1 &&
    fcHtml.indexOf('fc-pill-fold-prep') !== -1 &&
    fcHtml.indexOf('@keyframes ctxPillFall') !== -1 &&
    fcHtml.indexOf('@keyframes ctxPillFadeOut') !== -1 &&
    fcHtml.indexOf('ctx-pill-exit') !== -1 &&
    fcHtml.indexOf('__pillCloseTimer') !== -1 &&
    fcHtml.indexOf('__foldTimer') !== -1 &&
    fcHtml.indexOf('function finishHideContextMenu()') !== -1 &&
    fcHtml.indexOf('translateY(-56px)') !== -1 &&
    fcHtml.indexOf('background: #ffffff;') !== -1 &&
    fcHtml.indexOf('@keyframes ctxPillIn') === -1 &&
    fcHtml.indexOf('translateY(-110%)') === -1 &&
    fcHtml.indexOf('ctx-collapsed') === -1,
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
    // 卡面取点：遍历全部卡扫描避开可编辑区（SNE 卡中心 sne-val 输入框——必须落在卡身非编辑区；
    //   删卡后 DOM 序会变，首卡未必有可取点——全部卡逐个试）
    const cardPoint = () => cdp.evalJs("(function(){ var cards = document.querySelectorAll('#gridCanvas .sne-card');" +
      " if (!cards.length) return null; var r, el;" +
      " var bad = 'input, textarea, select, button, a, [contenteditable=\"true\"], .card-text-content, .card-edit-field, .card-label, .resize-handle, .rotate-grip, .sheet-col-grip, .sheet-row-grip';" +
      " for (var ci = 0; ci < cards.length; ci++) { var c = cards[ci]; r = c.getBoundingClientRect();" +
      "  for (var fy = 0.2; fy <= 0.85; fy += 0.15) for (var fx = 0.2; fx <= 0.85; fx += 0.15) {" +
      "   el = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);" +
      "   if (el && el.closest('.grid-card') === c && !el.closest(bad)) return { x: Math.round(r.left + r.width * fx), y: Math.round(r.top + r.height * fy) };" +
      "  } } return null; })()");
    // 两卡结构：药丸=面板首子独立卡片①、弹窗=次子独立卡片②；面板原本内容（搜索框代表）折叠进药丸；
    // 47.4：prep=收起视觉态、exit=关窗退出动画中、dotsOut=药丸淡出、midAnim=内容 transform/opacity 过渡中
    const menuState = () => cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " if (!m) return { open: false };" +
      " var p = document.querySelector('.asset-panel');" +
      " var cs = getComputedStyle(m); var vis = 0;" +
      " document.querySelectorAll('.context-menu .context-menu-item').forEach(function (it) { if (getComputedStyle(it).display !== 'none') vis++; });" +
      " var d = document.getElementById('ctxPillDots');" +
      " var inPanel = !!(m.parentNode && m.parentNode.classList && m.parentNode.classList.contains('asset-panel'));" +
      " var fold = !!(p && p.classList.contains('fc-pill-fold'));" +
      " var sc = p ? p.querySelector('.search-capsule') : null;" +
      " var scs = sc ? getComputedStyle(sc) : null;" +
      " var item = m.querySelector('.context-menu-item');" +
      " return { open: cs.display !== 'none', pill: m.classList.contains('ctx-pill')," +
      " pos: cs.position, left: cs.left, bottom: cs.bottom," +
      " w: m.offsetWidth, h: m.offsetHeight, sh: m.scrollHeight, ch: m.clientHeight, vis: vis," +
      " dotsDisplay: d ? getComputedStyle(d).display : 'none'," +
      " dh: d ? d.offsetHeight : 0, inlineL: m.style.left, inlineT: m.style.top," +
      " inPanel: inPanel, pillFirst: !!(p && p.firstElementChild === d)," +
      " menuSecond: !!(p && d && d.parentNode === p && d.nextElementSibling === m)," +
      " fold: fold, searchHidden: scs ? scs.display === 'none' : null," +
      " prep: !!(p && p.classList.contains('fc-pill-fold-prep'))," +
      " exit: m.classList.contains('ctx-pill-exit')," +
      " dotsOut: !!(d && d.classList.contains('ctx-pill-out'))," +
      " midAnim: scs ? (scs.transform !== 'none' && parseFloat(scs.opacity) < 0.95) : false," +
      " dRadius: d ? parseFloat(getComputedStyle(d).borderRadius) : 0," +
      " dBg: d ? getComputedStyle(d).backgroundColor : ''," +
      " mShadow: cs.boxShadow, mBg: cs.backgroundColor, mBorder: cs.borderWidth, mRadius: cs.borderRadius," +
      " mItemColor: item ? getComputedStyle(item).color : '' }; })()");

    const gate = await cdp.evalJs("(function(){ return { coarse: matchMedia('(pointer: coarse)').matches, mtp: navigator.maxTouchPoints, bridge: !!window.__fcTouch }; })()");
    ok('B0 门控自证：coarse 媒体查询翻转 + maxTouchPoints=5 + 触控桥在场',
      gate && gate.coarse === true && gate.mtp === 5 && gate.bridge, JSON.stringify(gate));

    // B1 长按 → 平滑折叠 → 两卡结构现身：药丸卡首子（顶部=红带）+弹窗卡次子（其下=蓝区）+面板原本内容折叠进药丸；
    // 47.4：fold 门控延迟 250ms 落定（holdTouch 完只余 10ms 余量→加 sleep(300) 确定性）+白底列表
    await cdp.evalJs('window.createSneCard(2, 2, 9, 12)');
    await sleep(200);
    const pt = await cardPoint();
    await holdTouch(pt.x, pt.y, 650);
    await sleep(300); // 47.4: 门控 250ms 计时器落定
    const b1 = await menuState();
    ok('B1 长按现身两卡：菜单开 + ctx-pill 有 + 药丸卡=面板首子、弹窗卡=次子（两卡独立不再同箱）+ fc-pill-fold 门控在场 + prep 在场 + 搜索框（原本内容代表）已折叠 display none + static 定位 + 弹窗卡宽 228-242 + 完整内容零压缩（sh=ch、高 ≥320——纯条目不再含 40px 药丸头）+ 药丸卡 40px 真药丸（radius-full 大圆角+实底）+ 47.4 白底列表（#ffffff 恒白+条目压暗）+ ≥3 项可见',
      b1.open === true && b1.pill === true &&
      b1.inPanel === true && b1.pillFirst === true && b1.menuSecond === true &&
      b1.fold === true && b1.prep === true && b1.searchHidden === true &&
      b1.pos === 'static' && b1.left === 'auto' && b1.bottom === 'auto' &&
      b1.w >= 228 && b1.w <= 242 && b1.dh >= 38 && b1.dh <= 48 &&
      b1.sh === b1.ch && b1.h >= 320 &&
      b1.dRadius >= 100 && b1.dBg !== 'rgba(0, 0, 0, 0)' && b1.dBg !== 'transparent' && b1.vis >= 3 &&
      b1.mBg === 'rgb(255, 255, 255)' && b1.mItemColor === 'rgb(28, 28, 46)',
      JSON.stringify(b1));

    // B2 药丸=独立卡片①（不在弹窗内）+全宽+more_horiz；弹窗=独立卡片②（自带卡片底 shadow-lg+底+边+圆角）
    await sleep(450); // 等 ctxPillRise 从下向上滑入动画 0.28s 落定再量位（动画中量位漂移）
    const b2 = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " var d = document.getElementById('ctxPillDots'); var p = document.querySelector('.asset-panel');" +
      " var ic = d ? d.querySelector('.material-symbols-outlined') : null;" +
      " var dr = d.getBoundingClientRect(); var mr = m.getBoundingClientRect();" +
      " var cs = getComputedStyle(m);" +
      " return { inMenu: m.contains(d), inPanel: d.parentNode === p, dots: getComputedStyle(d).display," +
      " icon: ic ? ic.textContent : '', dw: d.offsetWidth, pw: p ? p.clientWidth : 0," +
      " pillBottom: Math.round(dr.bottom), menuTop: Math.round(mr.top)," +
      " mShadow: cs.boxShadow, mBg: cs.backgroundColor, mBorder: cs.borderWidth, mRadius: parseFloat(cs.borderRadius) }; })()");
    ok('B2 两卡独立：药丸不在弹窗内 + 在面板内 display flex + 全宽（dw ≥ 面板内宽-10）+ more_horiz 横向三点 + 弹窗卡在药丸卡下方（menuTop ≥ 药丸底）+ 弹窗卡自带卡片底（shadow-lg 非 none + 实底 + 边 + 圆角 >8）',
      b2 && b2.inMenu === false && b2.inPanel === true && b2.dots === 'flex' &&
      b2.icon === 'more_horiz' && b2.dw >= b2.pw - 26 &&
      b2.menuTop >= b2.pillBottom - 1 &&
      b2.mShadow !== 'none' && b2.mBg !== 'rgba(0, 0, 0, 0)' && b2.mBorder !== '0px' && b2.mRadius > 8,
      JSON.stringify(b2));

    // B3 点药丸 → 平滑关窗（47.4：退出动画 240ms+收尾计时器 240ms）——退出中态/内容展开过渡中/落定三段
    const dotsPt = await cdp.evalJs("(function(){ var d = document.getElementById('ctxPillDots'); var r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    await tapAt(dotsPt.x, dotsPt.y);
    await sleep(40); // 退出动画进行中（tapAt 尾已 fire+120ms，+40=fire+160ms；exit 类在场、菜单仍可见、门控已摘、prep 尚在）
    let b3mid = await menuState();
    if (!b3mid.exit) { // tap 漏 → 兜底程序化点击后重读中态
      await cdp.evalJs("document.getElementById('ctxPillDots').click()");
      await sleep(40);
      b3mid = await menuState();
    }
    await sleep(220); // fire+380ms：收尾 240ms 已过 + 内容展开过渡 240ms 进行中
    const b3exp = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " var p = document.querySelector('.asset-panel');" +
      " var d = document.getElementById('ctxPillDots');" +
      " var sc = p ? p.querySelector('.search-capsule') : null;" +
      " var scs = sc ? getComputedStyle(sc) : null;" +
      " return { open: !!m && getComputedStyle(m).display !== 'none'," +
      " fold: !!(p && p.classList.contains('fc-pill-fold'))," +
      " prep: !!(p && p.classList.contains('fc-pill-fold-prep'))," +
      " searchHidden: scs ? scs.display === 'none' : null," +
      " expanding: scs ? scs.transform !== 'none' : false," +
      " dotsInPanel: d.parentNode === p, dotsDisplay: getComputedStyle(d).display }; })()");
    await sleep(300); // 展开过渡 240ms 落定
    const b3 = await menuState();
    ok('B3 点药丸平滑关窗三段：退出动画中（exit 类+药丸淡出+菜单仍可见+门控已摘+prep 尚在）+ 内容展开过渡中（菜单关+门控清+prep 清+搜索框可见+transform 过渡中+药丸回收出面板）+ 落定（exit/prep 摘净+菜单关+内容复位）',
      b3mid.exit === true && b3mid.dotsOut === true && b3mid.open === true &&
      b3mid.fold === false && b3mid.prep === true &&
      b3exp.open === false && b3exp.fold === false && b3exp.prep === false && b3exp.searchHidden === false &&
      b3exp.expanding === true && b3exp.dotsInPanel === false && b3exp.dotsDisplay === 'none' &&
      b3.open === false && b3.exit === false && b3.prep === false,
      JSON.stringify({ mid: b3mid, exp: b3exp, settled: b3 }));

    // B4 再长按 → 两卡结构重开（折叠门控重挂）
    const pt2 = await cardPoint();
    await holdTouch(pt2.x, pt2.y, 650);
    await sleep(300); // 47.4: 门控 250ms 计时器落定
    const b4 = await menuState();
    ok('B4 再长按重开：菜单开 + 两卡结构重挂（药丸首子+弹窗次子）+ 折叠门控重挂 + prep 在场 + 内容再折叠',
      b4.open === true && b4.pill === true && b4.pillFirst === true && b4.menuSecond === true &&
      b4.fold === true && b4.prep === true && b4.searchHidden === true,
      JSON.stringify(b4));

    // B5 桌面右键零变化（同一仿真页——CDP 鼠标输入完全不经触控桥）：游标弹层、无 ctx-pill、药丸藏、无折叠门控
    await cdp.evalJs('window.createSneCard(5, 5, 9, 12)');
    await sleep(200);
    const pt3 = await cardPoint();
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt3.x, y: pt3.y, button: 'right', buttons: 2, clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt3.x, y: pt3.y, button: 'right', buttons: 0, clickCount: 1 });
    await sleep(250);
    const b5 = await menuState();
    ok('B5 桌面右键零变化：菜单开 + 无 ctx-pill + 弹层回 body（不在面板内）+ 内联 left/top 非空（贴指针）+ 药丸 display none + 折叠门控不在 + prep 不在 + ≥3 项可见',
      b5.open === true && b5.pill === false &&
      b5.inPanel === false && b5.pos === 'fixed' &&
      b5.inlineL !== '' && b5.inlineT !== '' && b5.dotsDisplay === 'none' && b5.fold === false && b5.prep === false && b5.vis >= 3,
      JSON.stringify(b5));

    // B6 空画布 strict 空点 tap → 双消+折叠门控清（避开卡缘 ±60：Chrome 触控命中膨胀小目标）
    const strictEp = await cdp.evalJs("(function(){ var cv = document.getElementById('gridCanvas');" +
      " var card = document.querySelector('#gridCanvas .grid-card'); var cr = card ? card.getBoundingClientRect() : null;" +
      " var m = document.querySelector('.context-menu'); var mr = m ? m.getBoundingClientRect() : null;" +
      " for (var y = 100; y <= 650; y += 20) for (var x = 300; x < 800; x += 20) {" +
      "  if (document.elementFromPoint(x, y) !== cv) continue;" +
      "  if (cr && x > cr.left - 60 && x < cr.right + 60 && y > cr.top - 60 && y < cr.bottom + 60) continue;" +
      "  if (mr && x > mr.left - 30 && x < mr.right + 30 && y > mr.top - 30 && y < mr.bottom + 30) continue;" +
      "  return { x: x, y: y }; } return null; })()");
    await tapAt(strictEp.x, strictEp.y);
    await sleep(250); // 47.4: 退出动画+收尾计时器 240ms 已落定
    const b6 = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " var p = document.querySelector('.asset-panel');" +
      " return { open: !!m && getComputedStyle(m).display !== 'none'," +
      " sel: document.querySelectorAll('#gridCanvas .grid-card.selected').length," +
      " fold: !!(p && p.classList.contains('fc-pill-fold'))," +
      " prep: !!(p && p.classList.contains('fc-pill-fold-prep')) }; })()");
    ok('B6 空画布 tap 双消：菜单关 + 选中清 + 折叠门控清 + prep 清（' + JSON.stringify(strictEp) + '）',
      strictEp !== null && b6.open === false && b6.sel === 0 && b6.fold === false && b6.prep === false, JSON.stringify(b6));

    // B7 重长按 → 两卡开 → 真 tap 删除项（danger）→ 卡数 -1 + 菜单关 + 内容展开回来
    const pt4 = await cardPoint();
    await holdTouch(pt4.x, pt4.y, 650); // B6 空点 tap 已关菜单——重长按再开
    await sleep(200);
    const countBeforeDel = await cdp.evalJs("document.querySelectorAll('#gridCanvas .grid-card').length");
    const delPt = await cdp.evalJs("(function(){ var d = document.querySelector('.context-menu .context-menu-item.danger');" +
      " if (!d) return null; var r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    await tapAt(delPt.x, delPt.y);
    await sleep(500); // 47.4: 退出动画 240ms+收尾计时器 240ms 落定
    let stillOpen = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu'); return !!m && getComputedStyle(m).display !== 'none'; })()");
    if (stillOpen) { // 兜底：原生合成 click 没接住 → 直接程序化点击
      await cdp.evalJs("(function(){ var d = document.querySelector('.context-menu .context-menu-item.danger'); if (d) d.click(); })()");
      await sleep(500);
      stillOpen = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu'); return !!m && getComputedStyle(m).display !== 'none'; })()");
    }
    const b7 = await cdp.evalJs("(function(){ var p = document.querySelector('.asset-panel');" +
      " var sc = p ? p.querySelector('.search-capsule') : null;" +
      " return { count: document.querySelectorAll('#gridCanvas .grid-card').length," +
      " open: !!document.querySelector('.context-menu') && getComputedStyle(document.querySelector('.context-menu')).display !== 'none'," +
      " fold: !!(p && p.classList.contains('fc-pill-fold'))," +
      " searchHidden: sc ? getComputedStyle(sc).display === 'none' : null }; })()");
    ok('B7 真 tap 删除项：卡数 ' + countBeforeDel + '→' + b7.count + ' + 菜单关 + 折叠门控清 + 内容展开回来',
      b7.count === countBeforeDel - 1 && stillOpen === false && b7.fold === false && b7.searchHidden === false,
      JSON.stringify({ before: countBeforeDel, after: b7.count, open: b7.open, fold: b7.fold, searchHidden: b7.searchHidden }));

    // B8 面板折叠态 → 长按 → 面板自动展开 + 两卡结构（药丸首子+弹窗次子）
    await cdp.evalJs('window.createSneCard(6, 6, 9, 12)'); // B7 已删卡——先建再长按
    await sleep(200);
    await cdp.evalJs("document.querySelector('.asset-panel').classList.add('collapsed')");
    await sleep(400); // width 0.25s 过渡
    const pt5 = await cardPoint();
    await holdTouch(pt5.x, pt5.y, 650);
    await sleep(400);
    const b8 = await cdp.evalJs("(function(){ var p = document.querySelector('.asset-panel');" +
      " var m = document.querySelector('.context-menu');" +
      " var d = document.getElementById('ctxPillDots');" +
      " return { collapsed: p.classList.contains('collapsed'), pw: p.offsetWidth," +
      " menuInPanel: !!m && m.parentNode === p, open: !!m && getComputedStyle(m).display !== 'none'," +
      " pill: !!m && m.classList.contains('ctx-pill')," +
      " pillFirst: p.firstElementChild === d, menuSecond: d.parentNode === p && d.nextElementSibling === m," +
      " fold: p.classList.contains('fc-pill-fold'), prep: p.classList.contains('fc-pill-fold-prep') }; })()");
    ok('B8 面板折叠时长按：面板自动展开（无 collapsed + 宽>0）+ 菜单开且在面板内 + 两卡结构（药丸首子+弹窗次子）+ 折叠门控+prep 在场',
      b8 && b8.collapsed === false && b8.pw > 0 && b8.menuInPanel === true &&
      b8.open === true && b8.pill === true && b8.pillFirst === true && b8.menuSecond === true &&
      b8.fold === true && b8.prep === true,
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
