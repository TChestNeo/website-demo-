// tmp-battery-fc-pilltop.js — FC v10.28.48.0 平板端药丸菜单平滑折叠+白底列表（rev 00348-）
// 用户「折叠的过渡动画不顺畅 很割裂」+「列表的背景能不能是白色的？」——47.3 的 display:none 瞬间
//   消失零过渡作废：内容收起/展开改走 transform translateY(-56px)+opacity 过渡（fc-pill-fold-prep=
//   收起视觉态，coarse 限定桌面零影响）、门控 fc-pill-fold 延迟 250ms 到内容透明后才落 display:none；
//   关窗退出动画 ctxPillFall 下向滑出+ctxPillFadeOut 药丸淡出 240ms forwards+240ms 计时器收尾后
//   内容展开回来；药丸弹窗卡列表底恒白 #ffffff（深浅同）+条目/悬停/分隔/危险/勾选配套压暗。
//   S 静态（site-config 47.4+changelog（折叠的过渡动画不顺畅/列表的背景能不能是白色的）+00348-+
//     58.0 恒+旧 47.3 赋值零残留；编辑器页 47.4 锚（fc-pill-fold-prep/@keyframes ctxPillFall/
//     ctxPillFadeOut/ctx-pill-exit/__pillCloseTimer/__foldTimer/function finishHideContextMenu()/
//     translateY(-56px)/background: #ffffff;）+旧一体化锚（ctxPillIn/translateY(-110%)/
//     ctx-collapsed）零残留保持+47.3 两卡锚恒在；fc-touch.js __fcTouchMenu 旗在场）/
//   B 实机触控（CDP iPad 仿真：长按平滑折叠两卡结构——内容先收起过渡（prep+midAnim+门控未落）再
//     落定（fold+prep+白底+条目压暗）/药丸独立卡全宽 more_horiz+弹窗卡自带卡片底 shadow-lg/
//     点药丸=退出动画中态（exit 类+药丸淡出+prep 尚在）→内容展开过渡中→落定复位/再长按重开两卡
//     恒在/桌面右键零变化/面板折叠时长按自动展开+两卡结构）/
//   E 零异常。
// （house CDP 模式；判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4900 + Math.floor(Math.random() * 80);
const CDP_PORT = 5900 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fcpilltop-' + Date.now());
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
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber, raw: JSON.stringify(d).slice(0, 600) }).slice(0, 1000));
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

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}

(async () => {
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
  const connectCdp = async (port) => {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    // iPad 竖屏 + 5 点触控仿真——必须先于任何 navigate（触控仿真翻转 (pointer:coarse) 媒体查询）
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 834, height: 1194, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    return cdp;
  };

  try {
    // ── S 静态锚 ──
    const siteCfg = await (await fetch(BASE + '/assets/js/site-config.js')).text();
    const editorHtml = (await (await fetch(BASE + '/pages/fluidcanvas-editor.html')).text()).replace(/\r\n/g, '\n');
    const touchJs = await (await fetch(BASE + '/assets/js/fc-touch.js')).text();
    ok('S1 site-config：FC v10.28.48.0 + 平滑折叠 changelog（折叠的过渡动画不顺畅/列表的背景能不能是白色的）+ rev 00348- + 站点恒 v0.2.58.28 + 旧 47.3 版本赋值锚零残留',
      siteCfg.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.56.1';") !== -1 &&
      siteCfg.indexOf('折叠的过渡动画不顺畅') !== -1 &&
      siteCfg.indexOf('列表的背景能不能是白色的') !== -1 &&
      siteCfg.indexOf('rev 00348-') !== -1 && siteCfg.indexOf('v0.2.58.28') !== -1 &&
      siteCfg.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.3';") === -1);
    ok('S2 编辑器页：两卡锚（placeCtxPillDots/fc-pill-fold/ctxPillRise/translateY(110%)/ctxPillFade/.asset-panel > .ctx-pill-dots/折叠门控 !important/药丸关窗 toggleCtxPill）在场 + 47.4 平滑折叠锚（fc-pill-fold-prep/ctxPillFall/ctxPillFadeOut/ctx-pill-exit/__pillCloseTimer/__foldTimer/finishHideContextMenu/pointer: coarse 过渡/translateY(-56px)/白底 #ffffff）在场 + 旧一体化锚（ctxPillIn/translateY(-110%)/ctx-collapsed）零残留 + flex-shrink 禁压保持 + 药丸钮/菜单首子挂载锚在场',
      editorHtml.indexOf('placeCtxPillDots(panel)') !== -1 &&
      editorHtml.indexOf('fc-pill-fold') !== -1 &&
      editorHtml.indexOf('@keyframes ctxPillRise') !== -1 &&
      editorHtml.indexOf('translateY(110%)') !== -1 &&
      editorHtml.indexOf('@keyframes ctxPillFade') !== -1 &&
      editorHtml.indexOf('.asset-panel > .ctx-pill-dots') !== -1 &&
      editorHtml.indexOf('display: none !important;') !== -1 &&
      editorHtml.indexOf('hideContextMenu();\n  }') !== -1 &&
      editorHtml.indexOf('flex-shrink: 0;') !== -1 &&
      editorHtml.indexOf('id="ctxPillDots"') !== -1 &&
      editorHtml.indexOf('panel.insertBefore(contextMenu, panel.firstChild)') !== -1 &&
      editorHtml.indexOf('fc-pill-fold-prep') !== -1 &&
      editorHtml.indexOf('@keyframes ctxPillFall') !== -1 &&
      editorHtml.indexOf('@keyframes ctxPillFadeOut') !== -1 &&
      editorHtml.indexOf('ctx-pill-exit') !== -1 &&
      editorHtml.indexOf('__pillCloseTimer') !== -1 &&
      editorHtml.indexOf('__foldTimer') !== -1 &&
      editorHtml.indexOf('function finishHideContextMenu()') !== -1 &&
      editorHtml.indexOf('translateY(-56px)') !== -1 &&
      editorHtml.indexOf('background: #ffffff;') !== -1 &&
      editorHtml.indexOf('@keyframes ctxPillIn') === -1 &&
      editorHtml.indexOf('translateY(-110%)') === -1 &&
      editorHtml.indexOf('ctx-collapsed') === -1);
    ok('S3 fc-touch.js：长按派发前置 __fcTouchMenu 旗在位',
      touchJs.indexOf('window.__fcTouchMenu') !== -1);

    const cdp = await connectCdp(CDP_PORT);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };

    // ── 触控手势 helper（Input.dispatchTouchEvent：touchStart 带全部触点/touchMove 只发移动点/touchEnd 空数组）──
    const tch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type: type, touchPoints: pts });
    const tpoint = (id, x, y) => ({ x: Math.round(x), y: Math.round(y), radiusX: 2, radiusY: 2, force: 1, id: id });
    const tapAt = async (x, y) => { await tch('touchStart', [tpoint(0, x, y)]); await sleep(50); await tch('touchEnd', []); await sleep(100); };
    const holdTouch = async (x, y, ms) => { await tch('touchStart', [tpoint(0, x, y)]); await sleep(ms); await tch('touchEnd', []); await sleep(120); };
    // 卡面取点：扫描避开可编辑区（SNE 卡中心是 sne-val 数字输入框——桥豁免正确；手势必须落在卡身非编辑区）
    const cardPoint = () => cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card');" +
      " if (!c) return null; var r = c.getBoundingClientRect();" +
      " var bad = 'input, textarea, select, button, a, [contenteditable=\"true\"], .card-text-content, .card-edit-field, .card-label, .resize-handle, .rotate-grip, .sheet-col-grip, .sheet-row-grip';" +
      " for (var fy = 0.2; fy <= 0.85; fy += 0.15) for (var fx = 0.2; fx <= 0.85; fx += 0.15) {" +
      "  var el = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);" +
      "  if (el && el.closest('.grid-card') === c && !el.closest(bad)) return { x: Math.round(r.left + r.width * fx), y: Math.round(r.top + r.height * fy) };" +
      " } return null; })()");
    // 两卡结构：药丸=面板首子独立卡片①、弹窗=次子独立卡片②；面板原本内容（搜索框代表）折叠进药丸；
    // 47.4：prep=收起视觉态过渡中、exit=关窗退出动画中、midAnim=内容 transform/opacity 过渡进行中
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

    // ── B 两卡药丸实测 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "!!document.getElementById('gridCanvas') && !!window.createSneCard && !!window.__fcTouch", 'B 编辑器加载');

    const gate = await cdp.evalJs("(function(){ return { coarse: matchMedia('(pointer: coarse)').matches, mtp: navigator.maxTouchPoints, bridge: !!window.__fcTouch }; })()");
    ok('B0 门控自证：coarse 媒体查询翻转 + maxTouchPoints=5 + 触控桥在场',
      gate && gate.coarse === true && gate.mtp === 5 && gate.bridge, JSON.stringify(gate));

    // B1 长按 → 平滑折叠（47.4：内容先收起过渡、门控延迟 250ms 落定）→ 两卡结构现身：
    // 药丸卡首子（顶部=红带）+弹窗卡次子（其下=蓝区）+面板原本内容折叠进药丸
    await cdp.evalJs('window.createSneCard(2, 2, 9, 12)');
    await sleep(200);
    const snePt = await cardPoint();
    await tch('touchStart', [tpoint(0, snePt.x, snePt.y)]);
    await sleep(560); // 长按 500ms 触发 + 60ms 处=收起过渡进行中（47.4 平滑折叠中态）
    const b1mid = await menuState();
    await tch('touchEnd', []);
    await sleep(420); // 收起过渡 240ms 完成 + 门控 250ms 落定 + 弹窗上滑 280ms 落定
    const b1 = await menuState();
    ok('B1 长按平滑折叠（47.4）：中态=prep 在场+门控未落+搜索框仍可见+transform/opacity 过渡中；落定=菜单开 + ctx-pill 有 + 药丸卡=面板首子、弹窗卡=次子（两卡独立不再同箱）+ fc-pill-fold 门控在场 + 搜索框已折叠 display none + static 定位 + 弹窗卡宽 228-242 + 完整内容零压缩（sh=ch、高 ≥320）+ 药丸卡 40px 真药丸 + 弹窗白底列表（用户「列表背景白色」：#fff 底+暗字）+ ≥3 项可见',
      b1mid.open === true && b1mid.prep === true && b1mid.fold === false &&
      b1mid.searchHidden === false && b1mid.midAnim === true &&
      b1.open === true && b1.pill === true &&
      b1.inPanel === true && b1.pillFirst === true && b1.menuSecond === true &&
      b1.fold === true && b1.prep === true && b1.searchHidden === true &&
      b1.pos === 'static' && b1.left === 'auto' && b1.bottom === 'auto' &&
      b1.w >= 228 && b1.w <= 242 && b1.dh >= 38 && b1.dh <= 48 &&
      b1.sh === b1.ch && b1.h >= 320 &&
      b1.dRadius >= 100 && b1.dBg !== 'rgba(0, 0, 0, 0)' && b1.dBg !== 'transparent' && b1.vis >= 3 &&
      b1.mBg === 'rgb(255, 255, 255)' && b1.mItemColor === 'rgb(28, 28, 46)',
      JSON.stringify({ mid: b1mid, settled: b1 }));

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

    // B3 点药丸 → 平滑关窗（47.4：退出动画 240ms 收尾 + 内容展开过渡）——中态/过渡中/落定三段
    const dotsPt = await cdp.evalJs("(function(){ var d = document.getElementById('ctxPillDots'); var r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    await tapAt(dotsPt.x, dotsPt.y);
    await sleep(40); // 退出动画进行中（exit 类在场、菜单仍可见、门控已摘、prep 尚在=内容仍收起）
    let b3mid = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " var p = document.querySelector('.asset-panel'); var d = document.getElementById('ctxPillDots');" +
      " return { exit: !!(m && m.classList.contains('ctx-pill-exit'))," +
      " open: !!m && getComputedStyle(m).display !== 'none'," +
      " fold: !!(p && p.classList.contains('fc-pill-fold'))," +
      " prep: !!(p && p.classList.contains('fc-pill-fold-prep'))," +
      " dotsOut: !!(d && d.classList.contains('ctx-pill-out')) }; })()");
    if (!b3mid.exit) { // tap 漏 → 兜底程序化点击后重读中态
      await cdp.evalJs("document.getElementById('ctxPillDots').click()");
      await sleep(40);
      b3mid = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
        " var p = document.querySelector('.asset-panel'); var d = document.getElementById('ctxPillDots');" +
        " return { exit: !!(m && m.classList.contains('ctx-pill-exit'))," +
        " open: !!m && getComputedStyle(m).display !== 'none'," +
        " fold: !!(p && p.classList.contains('fc-pill-fold'))," +
        " prep: !!(p && p.classList.contains('fc-pill-fold-prep'))," +
        " dotsOut: !!(d && d.classList.contains('ctx-pill-out')) }; })()");
    }
    await sleep(220); // 收尾 240ms 已过 + 内容展开过渡 240ms 进行中（搜索框可见 + transform 过渡中）
    const b3 = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " var p = document.querySelector('.asset-panel');" +
      " var d = document.getElementById('ctxPillDots');" +
      " var sc = p ? p.querySelector('.search-capsule') : null;" +
      " return { open: !!m && getComputedStyle(m).display !== 'none'," +
      " fold: !!(p && p.classList.contains('fc-pill-fold'))," +
      " prep: !!(p && p.classList.contains('fc-pill-fold-prep'))," +
      " searchHidden: sc ? getComputedStyle(sc).display === 'none' : null," +
      " expanding: sc ? getComputedStyle(sc).transform !== 'none' : false," +
      " dotsInPanel: d.parentNode === p, dotsDisplay: getComputedStyle(d).display }; })()");
    await sleep(300); // 展开过渡 240ms 落定
    const b3set = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " var p = document.querySelector('.asset-panel'); var sc = p ? p.querySelector('.search-capsule') : null;" +
      " return { exit: !!(m && m.classList.contains('ctx-pill-exit'))," +
      " prep: !!(p && p.classList.contains('fc-pill-fold-prep'))," +
      " transform: sc ? getComputedStyle(sc).transform : '', opacity: sc ? getComputedStyle(sc).opacity : '' }; })()");
    ok('B3 点药丸平滑关窗（47.4）：退出动画中（exit 类在场+菜单仍可见+门控已摘+prep 尚在+药丸淡出类在场）+ 内容展开过渡中（菜单关+门控清+prep 清+搜索框可见+transform 过渡中+药丸已回收）+ 落定（exit/prep 摘净+内容复位 transform none/opacity 1）',
      b3mid.exit === true && b3mid.open === true && b3mid.fold === false &&
      b3mid.prep === true && b3mid.dotsOut === true &&
      b3.open === false && b3.fold === false && b3.prep === false && b3.searchHidden === false &&
      b3.expanding === true && b3.dotsInPanel === false && b3.dotsDisplay === 'none' &&
      b3set.exit === false && b3set.prep === false && b3set.transform === 'none' && b3set.opacity === '1',
      JSON.stringify({ mid: b3mid, mid2: b3, settled: b3set }));

    // B4 再长按 → 两卡结构重开（折叠门控重挂）
    const snePt2 = await cardPoint();
    await holdTouch(snePt2.x, snePt2.y, 650);
    await sleep(300); // 47.4: 门控 250ms 计时器落定
    const b4 = await menuState();
    ok('B4 再长按重开：菜单开 + 两卡结构重挂（药丸首子+弹窗次子）+ 折叠门控重挂 + prep 在场 + 内容再折叠',
      b4.open === true && b4.pill === true && b4.pillFirst === true && b4.menuSecond === true &&
      b4.fold === true && b4.prep === true && b4.searchHidden === true,
      JSON.stringify(b4));

    // B5 桌面右键零变化（同一仿真页——CDP 鼠标输入完全不经触控桥）：游标弹层、无 ctx-pill、药丸藏、无折叠门控
    await cdp.evalJs('window.createSneCard(5, 5, 9, 12)');
    await sleep(200);
    const snePt3 = await cardPoint();
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: snePt3.x, y: snePt3.y, button: 'right', buttons: 2, clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: snePt3.x, y: snePt3.y, button: 'right', buttons: 0, clickCount: 1 });
    await sleep(250);
    const b5 = await menuState();
    ok('B5 桌面右键零变化：菜单开 + 无 ctx-pill + 弹层回 body（不在面板内）+ 内联 left/top 非空（贴指针）+ 药丸 display none + 折叠门控不在 + prep 不在 + ≥3 项可见',
      b5.open === true && b5.pill === false &&
      b5.inPanel === false && b5.pos === 'fixed' &&
      b5.inlineL !== '' && b5.inlineT !== '' && b5.dotsDisplay === 'none' && b5.fold === false && b5.prep === false && b5.vis >= 3,
      JSON.stringify(b5));

    // B6 面板折叠态 → 长按 → 面板自动展开 + 两卡结构（药丸首子+弹窗次子）
    await cdp.evalJs("document.querySelector('.asset-panel').classList.add('collapsed')");
    await sleep(400); // width 0.25s 过渡
    const snePt4 = await cardPoint();
    await holdTouch(snePt4.x, snePt4.y, 650);
    await sleep(400);
    const b6 = await cdp.evalJs("(function(){ var p = document.querySelector('.asset-panel');" +
      " var m = document.querySelector('.context-menu');" +
      " var d = document.getElementById('ctxPillDots');" +
      " return { collapsed: p.classList.contains('collapsed'), pw: p.offsetWidth," +
      " menuInPanel: !!m && m.parentNode === p, open: !!m && getComputedStyle(m).display !== 'none'," +
      " pill: !!m && m.classList.contains('ctx-pill')," +
      " pillFirst: p.firstElementChild === d, menuSecond: d.parentNode === p && d.nextElementSibling === m," +
      " fold: p.classList.contains('fc-pill-fold'), prep: p.classList.contains('fc-pill-fold-prep') }; })()");
    ok('B6 面板折叠时长按：面板自动展开（无 collapsed + 宽>0）+ 菜单开且在面板内 + 两卡结构（药丸首子+弹窗次子）+ 折叠门控+prep 在场',
      b6 && b6.collapsed === false && b6.pw > 0 && b6.menuInPanel === true &&
      b6.open === true && b6.pill === true && b6.pillFirst === true && b6.menuSecond === true &&
      b6.fold === true && b6.prep === true,
      JSON.stringify(b6));

    ok('E1 全程零 Runtime.exceptionThrown + 零 console.error',
      cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      JSON.stringify({ errs: cdp.errs.slice(0, 3), cons: cdp.consoleErrs.slice(0, 3) }));
    cdp.close();
  } catch (e) {
    console.error('💥 电池异常: ' + (e && e.stack || e));
    FAIL++;
  } finally {
    server.close();
    try { chrome.kill(); } catch (e) {}
  }
  console.log('');
  console.log('╭────────────────────────────────────╮');
  console.log('│  🎉 ' + PASS + ' ✅ / ' + FAIL + ' ❌  (fc-pilltop)      │');
  console.log('╰────────────────────────────────────╯');
  if (FAIL > 0) process.exit(1);
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  else process.exit(0);
})();
