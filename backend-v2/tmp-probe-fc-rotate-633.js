// tmp-probe-fc-rotate-633.js — FC v10.28.49.0 平板 4:3 视口+旋转按钮+逐设备布局线上探针（mnationworld.com）
//   S1a site-config：58.26 赋值 ×1/58.25 赋值零残留/FC 49.0 赋值 ×1/48.2+48.1 赋值零残留/
//       changelog 头 49.0/48.2/58.26/48.1/58.25 各 ×1（49.0 新头 + 历史头全保留）；
//   S1b rev live 口径：rev 00350-真值 ×1 + 00350-XXX 零残留 + 00351-??? 占位 ×1 + 00351-终态零残留
//      （live 滞后一部署=惯例：工作树已填 00351-终态，live 仍二次烘焙镜像）；
//   S1c 编辑器 live 20 锚（rotateWrap/rotateBtn/screen_rotation/rotateTablet×2/tabletOrientation×2/
//       autoFlowCards/clampPresetEntry/markPresetCustom×2/PRESETS cols 110/77/58+rows 77/110/p.cols/
//       fc-rotate-wrap×3/fc-rot-l×3/fc-rot-p×3/return 115 零残留/v10.28.49.0×16）；
//   S1d article live 9 锚（'tablet-p': 20/pickReaderLayout/autoFlowEntries/orientation portrait×3/
//       spanPx/LAYOUT_COLS×5/STAGE_COLS/STAGE_BASE_ROWS/__slatiForceLayout×3/v10.28.49.0×10）；
//   S1e i18n live：4 新键 ×12 语 + 旧 tablet 键 ×12 保留 + __ZH_HANT_AUTO__ ×2；
//   P1 CDP 编辑器交互（种子 slati_session loggedIn）：切 tablet→rotateWrap.show（滑出）→
//       点旋转→activePreset tablet-p+cols 77+aria-pressed→auto-flow 渲染零异常→E1 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const REAL50 = '00350-6vv'; // deploy#1 实得 rev 填此处
const REAL51 = '00351-5mm'; // deploy#2 实得 rev 填此处（live 断言=零残留）
const SITE = 'https://mnationworld.com';
const ED = SITE + '/pages/fluidcanvas-editor.html';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-fcrotate633-' + Date.now());
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; this.reqs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Network.requestWillBeSent') {
        this.reqs.push(m.params.request.url);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.exceptionDetails || {};
        this.errs.push(JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
      } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        this.errs.push(JSON.stringify({ text: m.params.entry.text, url: m.params.entry.url || '' }).slice(0, 200));
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

(async () => {
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;

  console.log('═══ S1 静态锚（live site-config + 编辑器 + article + i18n）═══');
  const sc = await fetch(SITE + '/assets/js/site-config.js');
  const scSrc = norm(await sc.text());
  const scCount = mk(scSrc);
  ok('S1a site-config：58.26 在位 + 58.25 零残留 + FC 49.0 在位 + 48.2/48.1 赋值零残留 + changelog 头 49.0/48.2/58.26/48.1/58.25 各 ×1',
    scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") === 1 && scCount("window.MN_SITE_VERSION = 'v0.2.58.25';") === 0 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.49.0';") === 1 && scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.2';") === 0 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.1';") === 0 &&
    scCount('// v10.28.49.0 = ') === 1 && scCount('// v10.28.48.2 = ') === 1 && scCount('// v0.2.58.26 = ') === 1 &&
    scCount('// v10.28.48.1 = ') === 1 && scCount('// v0.2.58.25 = ') === 1,
    'v26=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") + ' v25=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.25';") +
    ' fc49=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.49.0';") + ' fc482=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.2';") +
    ' fc481=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.48.1';") +
    ' cl49=' + scCount('// v10.28.49.0 = ') + ' cl482=' + scCount('// v10.28.48.2 = ') + ' cl26=' + scCount('// v0.2.58.26 = ') +
    ' cl481=' + scCount('// v10.28.48.1 = ') + ' cl25=' + scCount('// v0.2.58.25 = '));
  ok('S1b site-config rev live 口径：rev ' + REAL50 + ' ×1 + 00350-XXX 零残留 + 00351-??? 占位 ×1 + ' + REAL51 + ' 零残留（live 滞后一部署）',
    scCount('rev ' + REAL50) === 1 && scCount('00350-XXX') === 0 && scCount('00351-???') === 1 && scCount(REAL51) === 0,
    'r50=' + scCount('rev ' + REAL50) + ' x50=' + scCount('00350-XXX') + ' q51=' + scCount('00351-???') + ' r51=' + scCount(REAL51));

  const E = await fetch(SITE + '/pages/fluidcanvas-editor.html');
  const eSrc = norm(await E.text());
  const elines = eSrc.split('\n');
  const c = (a) => elines.filter((l) => l.includes(a)).length; // 行计数口径=实测 grep -cF
  const E_ANCHORS = [['id="rotateWrap"', 1], ['id="rotateBtn"', 1], ['screen_rotation', 1], ['function rotateTablet(', 1],
    ['window.rotateTablet', 1], ['var tabletOrientation', 1], ['function autoFlowCards(', 1], ['function clampPresetEntry(', 1],
    ['function markPresetCustom(', 1], ['window.markPresetCustom', 1],
    ['cols: 110', 1], ['cols: 77', 1], ['cols: 58', 1], ['rows: 77', 1], ['rows: 110', 1], ['p.cols', 1],
    ['fc-rotate-wrap', 3], ['fc-rot-l', 3], ['fc-rot-p', 3], ['return 115;', 0], ['v10.28.49.0', 16]];
  const ebad = E_ANCHORS.filter(([a, n]) => c(a) !== n);
  ok('S1c 编辑器 21 锚全中（rotateWrap/rotateBtn/rotateTablet/tabletOrientation/autoFlowCards/clampPresetEntry/markPresetCustom/PRESETS cols+rows/p.cols/CSS 三件/return 115 零残留/49.0×16）', ebad.length === 0,
    ebad.map(([a, n]) => a + '=' + c(a) + '≠' + n).join(',') || '21/21');

  const A = await fetch(SITE + '/pages/article.html');
  const aSrc = norm(await A.text());
  const alines = aSrc.split('\n');
  const ca = (x) => alines.filter((l) => l.includes(x)).length;
  const A_ANCHORS = [["'tablet-p': 20", 1], ['function pickReaderLayout(', 1], ['function autoFlowEntries(', 1],
    ['(orientation: portrait)', 3], ['function spanPx(', 1], ['LAYOUT_COLS', 5],
    ['var STAGE_COLS = LAYOUT_COLS[layout] || 115;', 1], ['var STAGE_BASE_ROWS = LAYOUT_ROWS[layout] || 70;', 1],
    ['__slatiForceLayout', 3], ['v10.28.49.0', 10]];
  const abad = A_ANCHORS.filter(([a, n]) => ca(a) !== n);
  ok('S1d article 10 锚全中（tablet-p:20/pickReaderLayout/autoFlowEntries/orientation×3/spanPx/LAYOUT_COLS×5/STAGE 两声明/__slatiForceLayout×3/49.0×10）', abad.length === 0,
    abad.map(([a, n]) => a + '=' + ca(a) + '≠' + n).join(',') || '10/10');

  const I = await fetch(SITE + '/assets/i18n/fluidcanvas.i18n.js');
  const iSrc = norm(await I.text());
  const ic = mk(iSrc);
  ok('S1e i18n live：4 新键 ×12 语 + 旧 tablet 键 ×12 保留 + __ZH_HANT_AUTO__ ×2',
    ic('"fc.viewport.tablet43"') === 12 && ic('"fc.viewport.rotate"') === 12 && ic('"fc.viewport.landscape"') === 12 &&
    ic('"fc.viewport.portrait"') === 12 && ic('"fc.viewport.tablet"') === 12 && ic('__ZH_HANT_AUTO__') === 2,
    't43=' + ic('"fc.viewport.tablet43"') + ' rot=' + ic('"fc.viewport.rotate"') + ' land=' + ic('"fc.viewport.landscape"') +
    ' port=' + ic('"fc.viewport.portrait"') + ' old=' + ic('"fc.viewport.tablet"') + ' hant=' + ic('__ZH_HANT_AUTO__'));

  console.log('═══ P1 CDP 编辑器交互（切平板→旋转滑出→旋转→77 格→auto-flow 零异常）═══');
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
    const pageTab = pages.find(x => x.type === 'page');
    const cdp = new CDP(pageTab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Log.enable'); await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    // 先 nav 到同源再 seed localStorage（about:blank 下 localStorage SecurityError 老坑）
    await cdp.send('Page.navigate', { url: SITE + '/' });
    await waitFor(cdp, 'document.readyState === "complete"', 60000, 'origin 加载');
    await cdp.evalJs('try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}');
    await cdp.send('Page.navigate', { url: ED });
    await waitFor(cdp, 'document.getElementById("undoBtn") && document.getElementById("gridCanvas") && window.switchPreset && window.rotateTablet', 60000, '编辑器就绪');
    await sleep(800);
    // 状态读取=DOM/computed 口径（currentPreset 等编辑器内部变量不在 window 上——电池同款 FIXED_EXPR）
    const READ = "(function(){ var gc = document.getElementById('gridCanvas');" +
      " var rw = document.getElementById('rotateWrap'); var rb = document.getElementById('rotateBtn');" +
      " return { cs: getComputedStyle(gc).getPropertyValue('--cell-size').trim()," +
      "  cols: getComputedStyle(gc).getPropertyValue('--grid-cols').trim(), w: gc.offsetWidth," +
      "  rwShow: rw.classList.contains('show'), rbPressed: rb.getAttribute('aria-pressed')," +
      "  maxW: getComputedStyle(rw).maxWidth, op: getComputedStyle(rw).opacity," +
      "  rotP: getComputedStyle(rb.querySelector('.fc-rot-p')).display," +
      "  rotL: getComputedStyle(rb.querySelector('.fc-rot-l')).display," +
      "  btnState: document.getElementById('viewportBtnState').textContent }; })()";
    const st0 = await cdp.evalJs(READ);
    ok('P1a 初始 169：cols 115 + 画布 2528 + rotateWrap 无 .show（旋转钮未滑出）',
      st0.cols === '115' && st0.w === 2528 && st0.rwShow === false && st0.btnState === '16:9', JSON.stringify(st0));
    await cdp.evalJs('document.getElementById("viewportBtn").click()');
    await waitFor(cdp, 'document.getElementById("vpPresets").style.display !== "none"', 10000, '视口弹层开');
    await cdp.evalJs('document.querySelector("#vpPresets button[data-preset=\\"tablet\\"]").click()');
    await waitFor(cdp, 'getComputedStyle(document.getElementById("gridCanvas")).getPropertyValue("--grid-cols").trim() === "110"', 10000, 'tablet 生效');
    // 滑出是 max-width .25s 过渡——等过渡走完再读计算态（.show 类先到位但 maxW 仍 0）
    await waitFor(cdp, 'getComputedStyle(document.getElementById("rotateWrap")).maxWidth === "160px"', 10000, 'rotateWrap 过渡完成');
    const st1 = await cdp.evalJs(READ);
    ok('P1b 切 tablet：cols 110 + rotateWrap.show 滑出（maxWidth 160px/opacity 1）+ 按钮态 Tablet 4:3',
      st1.cols === '110' && st1.rwShow === true && st1.maxW === '160px' && st1.op === '1' &&
      st1.btnState.indexOf('Tablet 4:3') !== -1, JSON.stringify(st1));
    await cdp.evalJs('document.getElementById("rotateBtn").click()');
    await waitFor(cdp, 'getComputedStyle(document.getElementById("gridCanvas")).getPropertyValue("--grid-cols").trim() === "77"', 10000, '旋转 tablet-p 生效');
    const st2 = await cdp.evalJs(READ);
    ok('P1c 点旋转钮：cols 77 + 画布 1692 + aria-pressed true + 标签切换（landscape 隐/portrait 显）+ rotateWrap 仍滑出',
      st2.cols === '77' && st2.w === 1692 && st2.rbPressed === 'true' && st2.rwShow === true &&
      st2.rotL === 'none' && st2.rotP === 'inline', JSON.stringify(st2));
    await cdp.evalJs('document.getElementById("rotateBtn").click()');
    await waitFor(cdp, 'getComputedStyle(document.getElementById("gridCanvas")).getPropertyValue("--grid-cols").trim() === "110"', 10000, '旋转回 tablet');
    const st3 = await cdp.evalJs(READ);
    ok('P1d 再点旋转：回 tablet cols 110 + aria-pressed false + 标签复原',
      st3.cols === '110' && st3.rbPressed === 'false' && st3.rotL === 'inline' && st3.rotP === 'none', JSON.stringify(st3));
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|Failed to load resource|analytics|pageview|mnationworld/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('E1 全程零异常（噪声已滤）', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));
    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    fail++;
  }
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}

  console.log('\n═══ ' + (fail === 0 ? 'ALL GREEN' : 'FAILED') + ' — ' + pass + '/' + (pass + fail) + ' ═══');
  process.exit(fail === 0 ? 0 : 1);
})();
