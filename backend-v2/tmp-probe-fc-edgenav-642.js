// tmp-probe-fc-edgenav-642.js — FC v10.28.52.1 边缘抽屉全部/我滑动胶囊+全语言化线上探针（mnationworld.com）
//   S1a site-config：52.1 赋值 ×1 + 52.0 赋值零残留 + 站点 58.28 赋值 ×1 + changelog 头 52.1/52.0 各 ×1；
//   S1b rev live 口径：rev 00369-真值 ×1 + 00369-XXX 零残留 + 00370-??? 占位 ×1 + 00370-终态零残留
//      （live 滞后一部署=惯例：工作树已填 00370-终态，live 仍二次烘焙镜像）；
//   S1c 编辑器 live 10 锚（subnav data-slider/双钮/tabMy 兜底我/subnav.js 引入/两条 flex 规则/
//      旧 .fc-edge-nav .segmented-control 零残留/edgeNavResync 定义+调用）；
//   S1d i18n live：fc.edge.tabMy ×12 + 我 ×2 + My ×1（zh/zh-Hant=我；en=My；其余 9 语本语）；
//   S2 API：health 200 + tables:66（本轮零迁移）；S3 fc/edges 匿名公开 200（回归）；
//   P1 CDP 编辑器（假会话）：P1a 抽屉 subnav 结构（hasBg/cloneCount×2/初始对齐=offsetLeft）→
//      P1b 点「我」中途 200ms computed left 严格介于两钮间+bg 过渡含 left 0.55s（真滑动 live 实证）→
//      P1c 750ms 落定=my 钮 offsetLeft+pane 切换 → P1d 往返回全部落定 → P1e zh 标签全部/我+克隆文本同 → E1 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

const REAL69 = '00369-gmh'; // deploy#1 实得 rev（已填真）
const REAL70 = '00370-8g7'; // deploy#2 实得 rev（已填真；live 断言=零残留）
const SITE = 'https://mnationworld.com';
const ED = SITE + '/pages/fluidcanvas-editor.html';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-fc642-' + Date.now());
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
const hget = (url, opts) => new Promise((resolve) => {
  opts = opts || {};
  const req = https.request(url, Object.assign({ method: opts.method || 'GET', headers: Object.assign({}, opts.headers), timeout: 25000 }), (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 12000000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  if (opts.body) req.write(opts.body);
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.exceptionDetails || {};
        this.errs.push(JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        const txt = (m.params.args || []).map(a => a.value || a.description || '').join(' ');
        if (txt.indexOf('Failed to load resource') === -1) this.errs.push('CON:' + txt.slice(0, 200));
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

const SESSION_SCRIPT = 'try{(function(){ localStorage.setItem("slati_session", "{\\"loggedIn\\":true}");' +
  ' localStorage.setItem("slati_user", JSON.stringify({ id: "USR-000101", displayName: "探针用户", tier: "premium" }));' +
  ' localStorage.setItem("slati_lang", "zh-CN"); })();}catch(e){}';

(async () => {
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;

  console.log('═══ S1 静态锚（live）═══');
  const sc = await hget(SITE + '/assets/js/site-config.js');
  const scSrc = norm(sc.body);
  const scCount = mk(scSrc);
  ok('S1a site-config：52.1 赋值 ×1 + 52.0 赋值零残留 + 站点 58.28 ×1 + changelog 头 52.1/52.0 各 ×1',
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.52.1';") === 1 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.52.0';") === 0 &&
    scCount("window.MN_SITE_VERSION = 'v0.2.58.28';") === 1 &&
    scCount('// v10.28.52.1 = ') === 1 && scCount('// v10.28.52.0 = ') === 1,
    'fc521=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.52.1';") +
    ' fc520=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.52.0';") +
    ' v28=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.28';") +
    ' cl521=' + scCount('// v10.28.52.1 = ') + ' cl520=' + scCount('// v10.28.52.0 = '));
  ok('S1b site-config rev live 口径：rev ' + REAL69 + ' ×1 + 00369-XXX 零残留 + 00370-??? 占位 ×1 + ' + REAL70 + ' 零残留',
    scCount('rev ' + REAL69) === 1 && scCount('00369-XXX') === 0 && scCount('00370-???') === 1 && scCount(REAL70) === 0,
    'r69=' + scCount('rev ' + REAL69) + ' x69=' + scCount('00369-XXX') + ' q70=' + scCount('00370-???') + ' r70=' + scCount(REAL70));

  const E = await hget(ED);
  const elines = norm(E.body).split('\n');
  const c = (a) => elines.filter((l) => l.includes(a)).length; // 行计数口径=实测 grep -cF
  const E_ANCHORS = [['class="subnav" data-slider id="fcEdgeTabNav"', 1],
    ['subnav-pill active" id="fcEdgeTabAll"', 1], ['subnav-pill" id="fcEdgeTabMy"', 1],
    ['data-i18n="fc.edge.tabMy">我</button>', 1], ['src="../assets/js/subnav.js"', 1],
    ['fc-edge-nav .subnav { flex: 1; }', 1], ['fc-edge-nav .subnav-pill { flex: 1; }', 1],
    ['.fc-edge-nav .segmented-control', 0], ['function edgeNavResync()', 1], ['setTimeout(edgeNavResync, 320)', 1]];
  const ebad = E_ANCHORS.filter(([a, n]) => c(a) !== n);
  ok('S1c 编辑器 10 锚全中（subnav 平台原版/兜底我/旧 segmented 抽屉规则零残留/圆球重对齐）', ebad.length === 0,
    ebad.map(([a, n]) => a + '=' + c(a) + '≠' + n).join(',') || '10/10');

  const I = await hget(SITE + '/assets/i18n/fluidcanvas.i18n.js');
  const iSrc = norm(I.body);
  ok('S1d i18n live：fc.edge.tabMy ×12 + 我 ×2 + My ×1（zh/zh-Hant=我；en=My；其余 9 语本语）',
    mk(iSrc)('"fc.edge.tabMy":') === 12 && mk(iSrc)('"fc.edge.tabMy": "我"') === 2 && mk(iSrc)('"fc.edge.tabMy": "My"') === 1,
    'keys=' + mk(iSrc)('"fc.edge.tabMy":') + ' 我=' + mk(iSrc)('"fc.edge.tabMy": "我"') + ' My=' + mk(iSrc)('"fc.edge.tabMy": "My"'));

  console.log('═══ S2 API（匿名口径）═══');
  const health = await hget(SITE + '/api/health');
  let healthJson = null; try { healthJson = JSON.parse(health.body); } catch (e) {}
  ok('S2 /api/health 200 + tables:66（本轮零迁移）', health.status === 200 && healthJson && healthJson.status === 'ok' && healthJson.tables === 66,
    JSON.stringify({ status: health.status, tables: healthJson && healthJson.tables }));

  console.log('═══ S3 匿名回归 ═══');
  const edges = await hget(SITE + '/api/fc/edges?scope=all');
  ok('S3 fc/edges 匿名公开 200（回归）', edges.status === 200, 'status=' + edges.status);

  console.log('═══ P1 CDP 编辑器（假会话；live 滑动实证）═══');
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
  let cdp = null;
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION_SCRIPT });
    const origHandler = cdp.ws.onmessage;
    cdp.ws.onmessage = (ev) => {
      origHandler(ev);
      try {
        const m = JSON.parse(ev.data);
        if (m.method === 'Page.javascriptDialogOpening') cdp.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      } catch (e) {}
    };
    await cdp.send('Page.navigate', { url: ED });
    await waitFor(cdp, "document.getElementById('gridCanvas') && window.openEdgeDrawer", 40000, 'P1 编辑器就绪');
    await sleep(900);
    await cdp.evalJs('(function(){ window.openEdgeDrawer(); })()');
    await waitFor(cdp, "document.querySelector('#fcEdgeTabNav .subnav-highlight-bg')", 10000, 'P1 subnav 胶囊注入');
    await sleep(400);

    // P1a 结构 + 初始对齐（skipAnim 定位 = offsetLeft/offsetWidth 无动画）
    const structExpr = "(function(){ var nav = document.getElementById('fcEdgeTabNav');" +
      " var all = document.getElementById('fcEdgeTabAll'); var my = document.getElementById('fcEdgeTabMy');" +
      " var bg = nav.querySelector('.subnav-highlight-bg'); var clip = nav.querySelector('.subnav-highlight-text');" +
      " return { hasBg: !!bg, cloneCount: nav.querySelectorAll('.subnav-highlight-clone').length," +
      "  allActive: all.classList.contains('active'), myActive: my.classList.contains('active')," +
      "  bgLeft: Math.round(bg.offsetLeft), bgW: Math.round(bg.offsetWidth)," +
      "  allLeft: Math.round(all.offsetLeft), allW: Math.round(all.offsetWidth)," +
      "  blob: !!nav.querySelector('.subnav-blob')," +
      "  allText: all.textContent, myText: my.textContent," +
      "  cloneTexts: Array.prototype.map.call(nav.querySelectorAll('.subnav-highlight-clone'), function(e){return e.textContent;}).join(',')," +
      "  myLeft: Math.round(my.offsetLeft) }; })()";
    const st = await cdp.evalJs(structExpr);
    ok('P1a 结构：胶囊+文字层+克隆×2+尾部 blob+初始对齐=全部钮 offsetLeft/width',
      st.hasBg === true && st.cloneCount === 2 && st.allActive === true && st.myActive === false &&
      st.blob === true && st.bgLeft === st.allLeft && st.bgW === st.allW,
      JSON.stringify(st));

    // P1b 点「我」→ 200ms 中途采样：胶囊 computed left 严格介于两钮 + bg 过渡含 left 0.55s（真滑动 live 实证）
    const midExpr = "(function(){ var nav = document.getElementById('fcEdgeTabNav');" +
      " var bg = nav.querySelector('.subnav-highlight-bg');" +
      " return { left: Math.round(bg.getBoundingClientRect().left - nav.getBoundingClientRect().left)," +
      "  trans: getComputedStyle(bg).transition }; })()";
    await cdp.evalJs('(function(){ document.getElementById("fcEdgeTabMy").click(); })()');
    await sleep(200);
    const mid = await cdp.evalJs(midExpr);
    const st2 = await cdp.evalJs(structExpr);
    ok('P1b 点「我」200ms 中途：胶囊 left 严格介于全部/我之间（' + st.allLeft + '<' + mid.left + '<' + st.myLeft + '）+ 过渡含 left 0.55s',
      mid.left > st.allLeft && mid.left < st.myLeft && mid.trans.indexOf('left 0.55s') !== -1,
      JSON.stringify(mid));
    await sleep(650);
    const settled = await cdp.evalJs("(function(){ var nav = document.getElementById('fcEdgeTabNav');" +
      " var bg = nav.querySelector('.subnav-highlight-bg'); var my = document.getElementById('fcEdgeTabMy');" +
      " var all = document.getElementById('fcEdgeTabAll');" +
      " return { left: Math.round(bg.getBoundingClientRect().left - nav.getBoundingClientRect().left)," +
      "  myLeft: Math.round(my.getBoundingClientRect().left - nav.getBoundingClientRect().left)," +
      "  myActive: my.classList.contains('active'), allActive: all.classList.contains('active')," +
      "  paneAll: getComputedStyle(document.getElementById('fcEdgePaneAll')).display," +
      "  paneMy: getComputedStyle(document.getElementById('fcEdgePaneMy')).display }; })()");
    ok('P1c 750ms 落定：胶囊=我钮 left + active 互换 + pane 切换（全部隐藏/我的显示）',
      settled.left === settled.myLeft && settled.myActive === true && settled.allActive === false &&
      settled.paneAll === 'none' && settled.paneMy !== 'none',
      JSON.stringify(settled));

    // P1d 往返回全部：落定=全部钮
    await cdp.evalJs('(function(){ document.getElementById("fcEdgeTabAll").click(); })()');
    await sleep(800);
    const back = await cdp.evalJs("(function(){ var nav = document.getElementById('fcEdgeTabNav');" +
      " var bg = nav.querySelector('.subnav-highlight-bg'); var all = document.getElementById('fcEdgeTabAll');" +
      " return { left: Math.round(bg.getBoundingClientRect().left - nav.getBoundingClientRect().left)," +
      "  allLeft: Math.round(all.getBoundingClientRect().left - nav.getBoundingClientRect().left)," +
      "  allActive: all.classList.contains('active')," +
      "  myActive: document.getElementById('fcEdgeTabMy').classList.contains('active') }; })()");
    ok('P1d 往返：胶囊回落=全部钮 + active 还原',
      back.left === back.allLeft && back.allActive === true && back.myActive === false, JSON.stringify(back));

    // P1e zh 标签 全部/我 + 克隆层同文案（52.1 全语言化 live 实证）
    ok('P1e zh 标签：全部/我（兜底+词典同值）+ 克隆层文案同',
      st.allText === '全部' && st.myText === '我' && st.cloneTexts === '全部,我',
      'labels=' + st.allText + '/' + st.myText + ' clones=' + st.cloneTexts);
  } catch (e) {
    console.log('  💔 ' + e.message);
    fail++;
  }
  console.log('═══ E1 零异常 ═══');
  const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
  const rawErrs = cdp ? cdp.errs : [];
  const errs = rawErrs.filter(e => !noise.test(e));
  ok('E1 零异常（' + rawErrs.length + ' 原始 / ' + errs.length + ' 噪声后）', errs.length === 0, errs.slice(0, 5).join(' || '));
  try { cdp && cdp.close(); } catch (e) {}
  try { spawn('taskkill', ['/pid', String(chrome.pid), '/t', '/f'], { stdio: 'ignore' }); } catch (e) {}

  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  process.exit(fail === 0 ? 0 : 1);
})();
