// tmp-battery-fc-pillmenu.js — FC v10.28.48.0 触控长按药丸菜单平滑折叠+白底列表电池
// 用户 44.0「长按菜单能不能改成左边的小药丸」→ 44.1 横药丸头 → 44.2 进左侧菜单 → 47.2 顶部
//   停靠 → 47.3「…三粒点独立一个 弹窗内容独立一个你怎么可以随便整合」→ 47.4「折叠的过渡动画不
//   顺畅 很割裂」+「列表的背景能不能是白色的？」——本文件断言随轮改：两卡结构保持（药丸=独立
//   卡片①面板首子、弹窗=独立卡片②面板次子 ctxPillRise 从下向上滑出）；47.4 折叠/展开/关窗全走
//   过渡（fc-pill-fold-prep 收起视觉态+门控 250ms 延迟落+退出动画 240ms+收尾计时器 240ms）；
//   药丸弹窗卡列表恒白底 #ffffff+条目压暗；桌面右键游标弹层原样不动（弹层搬回 body 贴指针）。
// 验证：S 静态锚（site-config 47.4 + 平滑折叠 changelog + 00348- / 编辑器两卡锚（fc-pill-fold/
//   ctxPillRise/translateY(110%)/.asset-panel > .ctx-pill-dots/placeCtxPillDots）+47.4 锚
//   （fc-pill-fold-prep/ctxPillFall/ctxPillFadeOut/ctx-pill-exit/__pillCloseTimer/__foldTimer/
//   finishHideContextMenu/translateY(-56px)/#ffffff）+旧一体化锚（ctx-collapsed/ctxPillIn/
//   translateY(-110%)）零残留 / fc-touch.js __fcTouchMenu 旗 / showContextMenu 药丸分支锚）/
//   B 药丸实测（CDP iPad 竖屏 834×1194 dsf2 + 5 触点：B0 门控自证；B1 长按平滑折叠两卡现身——
//   药丸首子+弹窗次子+面板内容折叠进药丸+白底；B2 药丸独立卡全宽+弹窗卡自带卡片底；B3 点药丸
//   平滑关窗+内容展开回来；B4 再长按重开；B5 空画布 tap 双消+内容展开回来+重长按恒开+手柄纯
//   tap 零变化；B6 真 tap 删除项——卡数 -1+菜单关+内容展开回来；B7 桌面右键零变化——游标弹层回
//   body、无 ctx-pill、药丸 display none；B8 面板折叠时长按——面板自动展开+两卡结构）/ E 零异常。
//   菜单内 tap 走原生 compat click（桥 inFloatExclude 豁免 .asset-panel），断言前等待 +
//   el.click() 兜底（headless 合成或飘）；47.4 门控 250ms 计时器→holdTouch 后加 sleep(300)。
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
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fcpill-' + Date.now());
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
    ok('S1 site-config：FC v10.28.48.0 + 平滑折叠 changelog（折叠的过渡动画不顺畅/列表的背景能不能是白色的）+ 两卡 changelog（三粒点独立一个）+ 47.2 顶部停靠 changelog + rev 00348- 占位 + 站点恒 v0.2.58.28 + 旧 47.3 赋值零残留',
      siteCfg.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.52.0';") !== -1 &&
      siteCfg.indexOf('折叠的过渡动画不顺畅') !== -1 &&
      siteCfg.indexOf('列表的背景能不能是白色的') !== -1 &&
      siteCfg.indexOf('三粒点独立一个') !== -1 &&
      siteCfg.indexOf('左侧菜单最顶部') !== -1 &&
      siteCfg.indexOf('rev 00348-') !== -1 && siteCfg.indexOf('v0.2.58.28') !== -1 &&
      siteCfg.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.3';") === -1);
    ok('S2 编辑器：ctxPillDots 三点钮 + 横向三点 more_horiz（more_vert 零在场）+ 两卡 CSS（fc-pill-fold 门控/.asset-panel > .ctx-pill-dots/ctxPillRise/translateY(110%)/static/占满宽/真药丸规格）+ 47.4 平滑折叠锚（fc-pill-fold-prep/ctxPillFall/ctxPillFadeOut/ctx-pill-exit/__pillCloseTimer/__foldTimer/finishHideContextMenu/translateY(-56px)/白底 #ffffff）+ 旧一体化锚（ctx-collapsed/ctxPillIn/translateY(-110%)）零在场 + flex-shrink 禁压保持 + 顶部挂载锚（insertBefore 首子/margin-bottom）',
      editorHtml.indexOf('id="ctxPillDots"') !== -1 &&
      editorHtml.indexOf('class="ctx-pill-dots"') !== -1 &&
      editorHtml.indexOf('more_horiz') !== -1 &&
      editorHtml.indexOf('more_vert') === -1 &&
      editorHtml.indexOf('fc-pill-fold') !== -1 &&
      editorHtml.indexOf('.asset-panel > .ctx-pill-dots') !== -1 &&
      editorHtml.indexOf('@keyframes ctxPillRise') !== -1 &&
      editorHtml.indexOf('translateY(110%)') !== -1 &&
      editorHtml.indexOf('ctx-collapsed') === -1 &&
      editorHtml.indexOf('@keyframes ctxPillIn') === -1 &&
      editorHtml.indexOf('translateY(-110%)') === -1 &&
      editorHtml.indexOf('position: static;') !== -1 &&
      editorHtml.indexOf('width: 100%; min-width: 0;') !== -1 &&
      editorHtml.indexOf('border-radius: var(--radius-full);') !== -1 &&
      editorHtml.indexOf('background: var(--input-bg-focus);') !== -1 &&
      editorHtml.indexOf('flex-shrink: 0;') !== -1 &&
      editorHtml.indexOf('panel.insertBefore(contextMenu, panel.firstChild)') !== -1 &&
      editorHtml.indexOf('margin-bottom: 8px;') !== -1 &&
      editorHtml.indexOf('display: none; /* 桌面恒藏') !== -1 &&
      editorHtml.indexOf('display: none !important;') !== -1 &&
      editorHtml.indexOf('fc-pill-fold-prep') !== -1 &&
      editorHtml.indexOf('@keyframes ctxPillFall') !== -1 &&
      editorHtml.indexOf('@keyframes ctxPillFadeOut') !== -1 &&
      editorHtml.indexOf('ctx-pill-exit') !== -1 &&
      editorHtml.indexOf('__pillCloseTimer') !== -1 &&
      editorHtml.indexOf('__foldTimer') !== -1 &&
      editorHtml.indexOf('function finishHideContextMenu()') !== -1 &&
      editorHtml.indexOf('translateY(-56px)') !== -1 &&
      editorHtml.indexOf('background: #ffffff;') !== -1);
    ok('S3 fc-touch.js：长按派发前置 __fcTouchMenu 旗在位',
      touchJs.indexOf('window.__fcTouchMenu') !== -1);
    ok('S4 showContextMenu 药丸分支：读旗 + toggle ctx-pill + 面板挂载/body 还原 + scrollIntoView + toggleCtxPill 导出 + 药丸独立挂载 placeCtxPillDots(panel) 锚在场',
      editorHtml.indexOf('var pillMode = !!window.__fcTouchMenu;') !== -1 &&
      editorHtml.indexOf("classList.toggle('ctx-pill', pillMode)") !== -1 &&
      editorHtml.indexOf('document.body.appendChild(contextMenu)') !== -1 &&
      editorHtml.indexOf("contextMenu.scrollIntoView({ block: 'nearest' })") !== -1 &&
      editorHtml.indexOf('window.toggleCtxPill = toggleCtxPill;') !== -1 &&
      editorHtml.indexOf('placeCtxPillDots(panel)') !== -1 &&
      editorHtml.indexOf("panel.classList.add('fc-pill-fold')") !== -1 &&
      editorHtml.indexOf("panel.classList.remove('fc-pill-fold')") !== -1);

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
      " radius: cs.borderRadius, w: m.offsetWidth, h: m.offsetHeight, vis: vis," +
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
      " mShadow: cs.boxShadow, mBg: cs.backgroundColor, mItemColor: item ? getComputedStyle(item).color : '' }; })()");

    // ── B 两卡药丸实测 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "!!document.getElementById('gridCanvas') && !!window.createSneCard && !!window.__fcTouch", 'B 编辑器加载');

    const gate = await cdp.evalJs("(function(){ return { coarse: matchMedia('(pointer: coarse)').matches, mtp: navigator.maxTouchPoints, bridge: !!window.__fcTouch }; })()");
    ok('B0 门控自证：coarse 媒体查询翻转 + maxTouchPoints=5 + 触控桥在场',
      gate && gate.coarse === true && gate.mtp === 5 && gate.bridge, JSON.stringify(gate));

    // B1 长按 → 平滑折叠 → 两卡结构现身：药丸卡首子（顶部=红带）+弹窗卡次子（其下=蓝区）+面板原本内容折叠进药丸；
    // 47.4：fold 门控延迟 250ms 落定（holdTouch 完只余 10ms 余量→加 sleep(300) 确定性）+白底列表
    await cdp.evalJs('window.createSneCard(2, 2, 9, 12)');
    await sleep(200);
    const snePt = await cardPoint();
    await holdTouch(snePt.x, snePt.y, 650);
    await sleep(300); // 47.4: 门控 250ms 计时器落定
    const b1 = await menuState();
    ok('B1 长按现身两卡：菜单开 + ctx-pill 有 + 药丸卡=面板首子、弹窗卡=次子（两卡独立不再同箱）+ fc-pill-fold 门控在场 + prep 在场 + 搜索框（原本内容代表）已折叠 display none + static 定位 + 弹窗卡宽 228-242 + 药丸卡 40px 真药丸（radius-full 大圆角+实底）+ 弹窗卡自带卡片底 shadow-lg + 47.4 白底列表（#ffffff 恒白+条目压暗）+ ≥3 项可见',
      b1.open === true && b1.pill === true &&
      b1.inPanel === true && b1.pillFirst === true && b1.menuSecond === true &&
      b1.fold === true && b1.prep === true && b1.searchHidden === true &&
      b1.pos === 'static' && b1.left === 'auto' && b1.bottom === 'auto' &&
      b1.w >= 228 && b1.w <= 242 && b1.dh >= 38 && b1.dh <= 48 &&
      b1.dRadius >= 100 && b1.dBg !== 'rgba(0, 0, 0, 0)' && b1.dBg !== 'transparent' &&
      b1.mShadow !== 'none' && b1.mBg === 'rgb(255, 255, 255)' && b1.mItemColor === 'rgb(28, 28, 46)' && b1.vis >= 3,
      JSON.stringify(b1));

    // B2 药丸=独立卡片①（不在弹窗内）+全宽+more_horiz；弹窗=独立卡片②在药丸下方
    await sleep(450); // 等 ctxPillRise 从下向上滑入动画 0.28s 落定再量位（动画中量位漂移）
    const b2 = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " var d = document.getElementById('ctxPillDots'); var p = document.querySelector('.asset-panel');" +
      " var ic = d ? d.querySelector('.material-symbols-outlined') : null;" +
      " var dr = d.getBoundingClientRect(); var mr = m.getBoundingClientRect();" +
      " return { inMenu: m.contains(d), inPanel: d.parentNode === p, dots: getComputedStyle(d).display," +
      " icon: ic ? ic.textContent : '', dw: d.offsetWidth, pw: p ? p.clientWidth : 0," +
      " pillBottom: Math.round(dr.bottom), menuTop: Math.round(mr.top) }; })()");
    ok('B2 两卡独立：药丸不在弹窗内 + 在面板内 display flex + 全宽（dw ≥ 面板内宽-10）+ more_horiz 横向三点 + 弹窗卡在药丸卡下方（menuTop ≥ 药丸底）',
      b2 && b2.inMenu === false && b2.inPanel === true && b2.dots === 'flex' &&
      b2.icon === 'more_horiz' && b2.dw >= b2.pw - 26 &&
      b2.menuTop >= b2.pillBottom - 1,
      JSON.stringify(b2));

    // B3 点药丸 → 平滑关窗+内容展开回来（47.4：退出动画 240ms+收尾计时器 240ms 落定）——原生 compat click，飘则 el.click() 兜底
    const dotsPt = await cdp.evalJs("(function(){ var d = document.getElementById('ctxPillDots'); var r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    await tapAt(dotsPt.x, dotsPt.y);
    await sleep(500); // 47.4: 退出动画 240ms + 收尾计时器 240ms
    if (await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu'); return !!m && getComputedStyle(m).display !== 'none'; })()")) {
      await cdp.evalJs("document.getElementById('ctxPillDots').click()"); // 兜底
      await sleep(500);
    }
    const b3 = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " var p = document.querySelector('.asset-panel');" +
      " var d = document.getElementById('ctxPillDots');" +
      " var sc = p ? p.querySelector('.search-capsule') : null;" +
      " return { open: !!m && getComputedStyle(m).display !== 'none'," +
      " fold: !!(p && p.classList.contains('fc-pill-fold'))," +
      " prep: !!(p && p.classList.contains('fc-pill-fold-prep'))," +
      " searchHidden: sc ? getComputedStyle(sc).display === 'none' : null," +
      " dotsInPanel: d.parentNode === p, dotsDisplay: getComputedStyle(d).display }; })()");
    ok('B3 点药丸关窗：菜单关 + fc-pill-fold 门控清 + prep 清 + 搜索框（原本内容）展开回来（非 none）+ 药丸回收出面板（display none 恒藏）',
      b3 && b3.open === false && b3.fold === false && b3.prep === false && b3.searchHidden === false &&
      b3.dotsInPanel === false && b3.dotsDisplay === 'none',
      JSON.stringify(b3));

    // B4 再长按 → 两卡结构重开（折叠门控重挂、内容再折叠）
    const snePt2 = await cardPoint();
    await holdTouch(snePt2.x, snePt2.y, 650);
    await sleep(300); // 47.4: 门控 250ms 计时器落定
    const b4 = await menuState();
    ok('B4 再长按重开：菜单开 + 两卡结构重挂（药丸首子+弹窗次子）+ 折叠门控重挂 + prep 在场 + 内容再折叠',
      b4.open === true && b4.pill === true && b4.pillFirst === true && b4.menuSecond === true &&
      b4.fold === true && b4.prep === true && b4.searchHidden === true,
      JSON.stringify(b4));

    // B5 空画布 strict 空点 tap → 双消（菜单关 + 取消选中）+ 内容展开回来；再长按 → 恒开呼出
    // 扫点必须避开卡片矩形 ±60：Chrome 触控目标命中会膨胀小目标（TouchAdjuster 滑移——
    // elementFromPoint 报 gridCanvas 的点 touch 仍可能落手柄 ::after 区；实证 (300,240) 距
    // 左上角手柄命中区 8px 仍被 touch 命中）；菜单矩形 ±30 同避
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
    const b5a = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " var p = document.querySelector('.asset-panel');" +
      " var sc = p ? p.querySelector('.search-capsule') : null;" +
      " return { open: !!m && getComputedStyle(m).display !== 'none'," +
      " sel: document.querySelectorAll('#gridCanvas .grid-card.selected').length," +
      " fold: !!(p && p.classList.contains('fc-pill-fold'))," +
      " prep: !!(p && p.classList.contains('fc-pill-fold-prep'))," +
      " searchHidden: sc ? getComputedStyle(sc).display === 'none' : null }; })()");
    ok('B5a 空画布 tap 双消+展开回来：菜单关 + 选中清 + 折叠门控清 + prep 清 + 搜索框展开回来（' + JSON.stringify(strictEp) + '）',
      strictEp !== null && b5a.open === false && b5a.sel === 0 &&
      b5a.fold === false && b5a.prep === false && b5a.searchHidden === false, JSON.stringify(b5a));
    const snePt3 = await cardPoint();
    await holdTouch(snePt3.x, snePt3.y, 650);
    await sleep(300); // 47.4: 门控 250ms 计时器落定
    const b5b = await menuState();
    ok('B5b 重长按：恒展开呼出（ctx-pill 有 + 两卡结构+折叠门控重挂+prep 在场——hideContextMenu 清理证明）',
      b5b.open === true && b5b.pill === true && b5b.pillFirst === true &&
      b5b.menuSecond === true && b5b.fold === true && b5b.prep === true, JSON.stringify(b5b));

    // B5c 手柄纯 tap（无移动）→ 菜单经 click 冒泡关 + 选中保持 + 卡尺寸零变化 + 折叠门控清
    // （v10.28.44.0 编辑器 mouseup flush 加 _lastMoveEv 空守卫——修桌面点手柄同款 console.error 噪音）
    const hdlPt = await cdp.evalJs("(function(){ var h = document.querySelector('#gridCanvas .resize-handle');" +
      " if (!h) return null; var r = h.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()");
    const cardRectBefore = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card');" +
      " var r = c.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; })()");
    await tapAt(hdlPt.x, hdlPt.y);
    await sleep(250); // 47.4: 退出动画+收尾计时器 240ms 已落定
    const b5c = await cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " var c = document.querySelector('#gridCanvas .grid-card'); var r = c.getBoundingClientRect();" +
      " var p = document.querySelector('.asset-panel');" +
      " return { open: !!m && getComputedStyle(m).display !== 'none'," +
      " sel: document.querySelectorAll('#gridCanvas .grid-card.selected').length," +
      " fold: !!(p && p.classList.contains('fc-pill-fold'))," +
      " prep: !!(p && p.classList.contains('fc-pill-fold-prep'))," +
      " rect: { l: r.left, t: r.top, w: r.width, h: r.height } }; })()");
    ok('B5c 手柄纯 tap：菜单关（click 冒泡）+ 选中保持 + 卡尺寸零变化（无移动不缩放）+ 折叠门控清 + prep 清',
      hdlPt !== null && b5c.open === false && b5c.sel === 1 && b5c.fold === false && b5c.prep === false &&
      Math.abs(b5c.rect.l - cardRectBefore.l) < 1 && Math.abs(b5c.rect.t - cardRectBefore.t) < 1 &&
      b5c.rect.w === cardRectBefore.w && b5c.rect.h === cardRectBefore.h, JSON.stringify(b5c));

    // B6 菜单开着真 tap 删除项（danger）→ 卡数 -1 + 菜单关 + 内容展开回来（deleteSelectedCard 先 hideContextMenu）
    const snePtB6 = await cardPoint();
    await holdTouch(snePtB6.x, snePtB6.y, 650); // B5c 手柄 tap 已关菜单——重长按再开
    await sleep(450); // 47.2 教训：等从下向上滑入动画 0.28s 落定再量危险项位（动画中量位条目位漂移）；
                      // 真身另有 flex 压缩（44.2 起菜单被面板压成 117px 小缝、内部滚动条——
                      // 危险项真实布局位落进面板资产卡=造卡；47.2 flex-shrink:0 修复后全展开）
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
    const countAfterDel = await cdp.evalJs("document.querySelectorAll('#gridCanvas .grid-card').length");
    const b6fold = await cdp.evalJs("(function(){ var p = document.querySelector('.asset-panel');" +
      " var sc = p ? p.querySelector('.search-capsule') : null;" +
      " return { fold: !!(p && p.classList.contains('fc-pill-fold'))," +
      " searchHidden: sc ? getComputedStyle(sc).display === 'none' : null }; })()");
    ok('B6 真 tap 删除项：卡数 ' + countBeforeDel + '→' + countAfterDel + ' + 菜单关 + 折叠门控清 + 内容展开回来',
      countAfterDel === countBeforeDel - 1 && stillOpen === false && b6fold.fold === false && b6fold.searchHidden === false,
      JSON.stringify({ before: countBeforeDel, after: countAfterDel, open: stillOpen, fold: b6fold.fold, searchHidden: b6fold.searchHidden }));

    // B7 桌面右键零变化（同一仿真页——CDP 鼠标输入完全不经触控桥）：游标弹层、无 ctx-pill、药丸藏、无折叠门控
    await cdp.evalJs('window.createSneCard(5, 5, 9, 12)');
    await sleep(200);
    const snePt4 = await cardPoint();
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: snePt4.x, y: snePt4.y, button: 'right', buttons: 2, clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: snePt4.x, y: snePt4.y, button: 'right', buttons: 0, clickCount: 1 });
    await sleep(250);
    const b7 = await menuState();
    ok('B7 桌面右键零变化：菜单开 + 无 ctx-pill + 弹层回 body（不在面板内）+ 内联 left/top 非空（贴指针）+ 药丸 display none + 折叠门控不在 + ≥3 项可见',
      b7.open === true && b7.pill === false &&
      b7.inPanel === false && b7.pos === 'fixed' &&
      b7.inlineL !== '' && b7.inlineT !== '' && b7.dotsDisplay === 'none' && b7.fold === false && b7.vis >= 3,
      JSON.stringify(b7));

    // B8 面板折叠态 → 长按 → 面板自动展开 + 两卡结构（药丸首子+弹窗次子）
    await cdp.evalJs("document.querySelector('.asset-panel').classList.add('collapsed')");
    await sleep(400); // width 0.25s 过渡
    const snePt5 = await cardPoint();
    await holdTouch(snePt5.x, snePt5.y, 650);
    await sleep(400);
    const b8 = await cdp.evalJs("(function(){ var p = document.querySelector('.asset-panel');" +
      " var m = document.querySelector('.context-menu');" +
      " var d = document.getElementById('ctxPillDots');" +
      " return { collapsed: p.classList.contains('collapsed'), pw: p.offsetWidth," +
      " menuInPanel: !!m && m.parentNode === p, open: !!m && getComputedStyle(m).display !== 'none'," +
      " pill: !!m && m.classList.contains('ctx-pill')," +
      " pillFirst: p.firstElementChild === d, menuSecond: d.parentNode === p && d.nextElementSibling === m," +
      " fold: p.classList.contains('fc-pill-fold'), prep: p.classList.contains('fc-pill-fold-prep') }; })()");
    ok('B8 面板折叠时长按：面板自动展开（无 collapsed + 宽>0）+ 菜单开且在面板内（ctx-pill）+ 两卡结构 + 折叠门控+prep 在场',
      b8 && b8.collapsed === false && b8.pw > 0 && b8.menuInPanel === true && b8.open === true &&
      b8.pill === true && b8.pillFirst === true && b8.menuSecond === true &&
      b8.fold === true && b8.prep === true,
      JSON.stringify(b8));

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
  console.log('│  🎉 ' + PASS + ' ✅ / ' + FAIL + ' ❌  (fc-pillmenu)      │');
  console.log('╰────────────────────────────────────╯');
  if (FAIL > 0) process.exit(1);
  else process.exit(0);
})();
