// tmp-battery-fc-pilltop.js — FC v10.28.47.2 平板端药丸菜单顶部停靠（rev 00301-）
// 用户「然后平板端的FC编辑左侧菜单我要的是长这样的」+截图钦定：红带=折叠三粒点的位置在
//   左侧菜单最顶部、蓝区=电脑端弹窗的内容在其下方——44.2 的「菜单挂在左侧菜单内」不变，
//   只挪停靠位：面板末子（底部）→ 面板首子（顶部）；CSS margin-top→margin-bottom、
//   动画 ctxPillUp 底部滑入 → ctxPillIn 顶部滑入；折叠/展开、⋮ 恒居菜单首位、桌面右键零变化。
//   S 静态（site-config 47.2+顶部停靠 changelog+00301-+58.0 恒+旧 47.1 赋值零残留；编辑器页
//     insertBefore 首子锚+ctxPillIn/translateY(-110%)/margin-bottom 8px 锚+旧 appendChild/
//     ctxPillUp/旧 margin-top 规则零残留；fc-touch.js __fcTouchMenu 旗在场）/
//   B 实机触控（CDP iPad 仿真：长按现身菜单在面板首子=顶部停靠+紧邻搜索框/药丸头首位/点 ⋯
//     折叠后药丸仍留面板顶部/再点展开/桌面右键零变化/面板折叠时长按自动展开+菜单顶部停靠）/
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
    ok('S1 site-config：FC v10.28.47.2 + 顶部停靠 changelog（左侧菜单最顶部）+ rev 00301- + 站点恒 v0.2.58.0 + 旧 47.1 版本赋值锚零残留',
      siteCfg.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.2';") !== -1 &&
      siteCfg.indexOf('左侧菜单最顶部') !== -1 &&
      siteCfg.indexOf('rev 00301-') !== -1 && siteCfg.indexOf('v0.2.58.0') !== -1 &&
      siteCfg.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.1';") === -1);
    ok('S2 编辑器页：顶部停靠锚（insertBefore 首子/margin-bottom 8px/flex-shrink 0 禁压/ctxPillIn/translateY(-110%)）在场 + 旧底停靠锚（appendChild/ctxPillUp/旧 margin-top 规则）零残留 + 药丸头/折叠锚在场',
      editorHtml.indexOf('panel.insertBefore(contextMenu, panel.firstChild)') !== -1 &&
      editorHtml.indexOf('margin-bottom: 8px;') !== -1 &&
      editorHtml.indexOf('flex-shrink: 0;') !== -1 &&
      editorHtml.indexOf('@keyframes ctxPillIn') !== -1 &&
      editorHtml.indexOf('translateY(-110%)') !== -1 &&
      editorHtml.indexOf('panel.appendChild(contextMenu)') === -1 &&
      editorHtml.indexOf('@keyframes ctxPillUp') === -1 &&
      editorHtml.indexOf('width: 100%; min-width: 0;\n      margin-top: 8px;') === -1 &&
      editorHtml.indexOf('id="ctxPillDots"') !== -1 &&
      editorHtml.indexOf('ctx-collapsed') !== -1 &&
      editorHtml.indexOf('placeCtxPillDots') !== -1);
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
    const menuState = () => cdp.evalJs("(function(){ var m = document.querySelector('.context-menu');" +
      " if (!m) return { open: false };" +
      " var cs = getComputedStyle(m); var vis = 0;" +
      " document.querySelectorAll('.context-menu .context-menu-item').forEach(function (it) { if (getComputedStyle(it).display !== 'none') vis++; });" +
      " var d = document.getElementById('ctxPillDots');" +
      " var inPanel = !!(m.parentNode && m.parentNode.classList && m.parentNode.classList.contains('asset-panel'));" +
      " return { open: cs.display !== 'none', pill: m.classList.contains('ctx-pill')," +
      " collapsed: m.classList.contains('ctx-collapsed'), pos: cs.position, left: cs.left, bottom: cs.bottom," +
      " w: m.offsetWidth, h: m.offsetHeight, sh: m.scrollHeight, ch: m.clientHeight, vis: vis, dotsDisplay: d ? getComputedStyle(d).display : 'none'," +
      " dh: d ? d.offsetHeight : 0, inlineL: m.style.left, inlineT: m.style.top," +
      " inPanel: inPanel, first: inPanel && m.parentNode.firstElementChild === m," +
      " aboveSearch: inPanel && !!(m.nextElementSibling && m.nextElementSibling.classList.contains('search-capsule'))," +
      " dRadius: d ? parseFloat(getComputedStyle(d).borderRadius) : 0," +
      " dBg: d ? getComputedStyle(d).backgroundColor : '' }; })()");

    // ── B 药丸实测 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "!!document.getElementById('gridCanvas') && !!window.createSneCard && !!window.__fcTouch", 'B 编辑器加载');

    const gate = await cdp.evalJs("(function(){ return { coarse: matchMedia('(pointer: coarse)').matches, mtp: navigator.maxTouchPoints, bridge: !!window.__fcTouch }; })()");
    ok('B0 门控自证：coarse 媒体查询翻转 + maxTouchPoints=5 + 触控桥在场',
      gate && gate.coarse === true && gate.mtp === 5 && gate.bridge, JSON.stringify(gate));

    // B1 长按 → 药丸菜单现身（在资产面板内 + static 定位 + 首子=顶部停靠紧邻搜索框 + 真·横药丸头规格）
    await cdp.evalJs('window.createSneCard(2, 2, 9, 12)');
    await sleep(200);
    const snePt = await cardPoint();
    await holdTouch(snePt.x, snePt.y, 650);
    const b1 = await menuState();
    ok('B1 长按现身：菜单开 + ctx-pill 有 + 非折叠 + 在 .asset-panel 内（首子=顶部停靠+紧邻搜索框）+ static 定位 + 宽 228-242（面板内宽·滚条在时收窄）+ 完整内容零压缩（sh=ch、高 ≥350——7 项全展开=截图蓝区）+ 横药丸头 40px 真药丸（radius-full 大圆角 + 实底）+ ≥3 项可见',
      b1.open === true && b1.pill === true && b1.collapsed === false &&
      b1.inPanel === true && b1.first === true && b1.aboveSearch === true &&
      b1.pos === 'static' && b1.left === 'auto' && b1.bottom === 'auto' &&
      b1.w >= 228 && b1.w <= 242 && b1.dh >= 38 && b1.dh <= 48 &&
      b1.sh === b1.ch && b1.h >= 350 &&
      b1.dRadius >= 100 && b1.dBg !== 'rgba(0, 0, 0, 0)' && b1.dBg !== 'transparent' && b1.vis >= 3,
      JSON.stringify(b1));

    // B2 三点钮：在菜单内 + display flex + 恒居首位（药丸头）+ 横向三点 more_horiz + 全部可见项在药丸下方
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

    // B3 点 ⋯ → 折叠（全项 none + 容器透明化只留横药丸）——药丸仍留面板顶部（红带位置）
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
    ok('B3 点 ⋯ 折叠：ctx-collapsed + 全项 display none + 横药丸 236×≤48（宽不缩、横卧）+ 容器透明化（bg 透明+边 0）只留药丸 + 三点 flex + 药丸仍在面板顶部（红带位置）',
      b3 && b3.collapsed === true && b3.allNone === true && b3.w >= 230 && b3.w <= 242 &&
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

    // B5 桌面右键零变化（同一仿真页——CDP 鼠标输入完全不经触控桥）：游标弹层、无 ctx-pill、三点钮藏
    await cdp.evalJs('window.createSneCard(5, 5, 9, 12)');
    await sleep(200);
    const snePt4 = await cardPoint();
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: snePt4.x, y: snePt4.y, button: 'right', buttons: 2, clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: snePt4.x, y: snePt4.y, button: 'right', buttons: 0, clickCount: 1 });
    await sleep(250);
    const b5 = await menuState();
    ok('B5 桌面右键零变化：菜单开 + 无 ctx-pill/ctx-collapsed + 弹层回 body（不在面板内）+ 内联 left/top 非空（贴指针）+ 三点钮 display none + ≥3 项可见',
      b5.open === true && b5.pill === false && b5.collapsed === false &&
      b5.inPanel === false && b5.pos === 'fixed' &&
      b5.inlineL !== '' && b5.inlineT !== '' && b5.dotsDisplay === 'none' && b5.vis >= 3,
      JSON.stringify(b5));

    // B6 面板折叠态 → 长按 → 面板自动展开 + 菜单顶部停靠（首子）
    await cdp.evalJs("document.querySelector('.asset-panel').classList.add('collapsed')");
    await sleep(400); // width 0.25s 过渡
    const snePt5 = await cardPoint();
    await holdTouch(snePt5.x, snePt5.y, 650);
    await sleep(400);
    const b6 = await cdp.evalJs("(function(){ var p = document.querySelector('.asset-panel');" +
      " var m = document.querySelector('.context-menu');" +
      " return { collapsed: p.classList.contains('collapsed'), pw: p.offsetWidth," +
      " menuInPanel: !!m && m.parentNode === p, first: !!m && m.parentNode === p && p.firstElementChild === m," +
      " open: !!m && getComputedStyle(m).display !== 'none'," +
      " pill: !!m && m.classList.contains('ctx-pill') }; })()");
    ok('B6 面板折叠时长按：面板自动展开（无 collapsed + 宽>0）+ 菜单开且在面板内顶部停靠（首子+ctx-pill）',
      b6 && b6.collapsed === false && b6.pw > 0 && b6.menuInPanel === true && b6.first === true &&
      b6.open === true && b6.pill === true,
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
  else process.exit(0);
})();
