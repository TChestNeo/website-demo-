// tmp-battery-fc-edgenav.js — v10.28.52.3 边缘抽屉全部/我左右切换平台同款滑动+My 标签全语言化电池（本地工作树）
//   S 静态：site-config 52.3 赋值 ×1/52.0 赋值零残留/changelog 头 52.3/52.0 各 ×1/rev 真值 00369-gmh+00370-8g7 各 ×1/
//     站点恒 58.28；编辑器锚：subnav data-slider 抽屉 nav ×1/subnav-pill 双钮/tabMy 兜底「我」×1+>My</button> 零残留/
//     subnav.js 引入 ×1/.fc-edge-nav .subnav/.subnav-pill 各 ×1/旧 .fc-edge-nav .segmented-control 零残留/
//     edgeNavResync 定义+调用各 ×1；i18n tabMy 键 ×12 语+zh/zh-Hant=我 各 ×1+en=My ×1（12 语零英文混杂）；
//   B 编辑器 CDP：B1 开抽屉 subnav.js 注入白胶囊/双 clone/blob（52.1 平台同款结构实证）/
//     B2 初始高亮对齐全部（style left/width=offset）/ B3 点「我」→200ms 中程 computed left 介于两 pill 间
//     （0.55s 滑动真实移动实证）→750ms 归位我+pane 切换 / B4 点回全部往返归位+pane 复原 /
//     B5 zh 标签 全部/我+clone 同文案 / B6 en 重载标签 All/My（removeSeed+slati_lang=en）/
//     B7 程序化 edgeDrawerSetTab('my') 观察器动画归位 / B8 关开抽屉 IO 重对齐全部；
//   E 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PORT = 4800 + Math.floor(Math.random() * 400);
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-edgenav-' + Date.now());
const EDITOR_URL_PATH = '/pages/fluidcanvas-editor.html';

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

// ── 本地静态服务器 ──
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};
const server = require('http').createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u.indexOf('/api') === 0) { res.writeHead(404); res.end('{"error":"NOT_FOUND"}'); return; }
  if (u === '/' || u === '/dashboard') u = '/index.html';
  let f = path.join(DOCS, u);
  if (!fs.existsSync(f) && !path.extname(f)) { if (fs.existsSync(f + '.html')) f += '.html'; }
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
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
        this.errs.push('EXC:' + JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
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

// ── 罐头：圆球隐藏（hasFriends/hasTeam=false → 布局稳定）；仓库空 ──
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' var stubResponse = function (body, status, delay) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status || 200, headers: { "Content-Type": "application/json" } })); }, delay || 0); }); };' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  if (u.indexOf("/fc/edges/scopes") !== -1) return stubResponse(JSON.stringify({ hasFriends: false, hasTeam: false }));' +
  '  if (u.indexOf("/fc/edges") !== -1) return stubResponse(JSON.stringify({ edges: [] }), 200);' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';
const SEED_SCRIPT = 'try{(function(){' +
  ' localStorage.setItem("slati_session", "{\\"loggedIn\\":true}");' +
  ' localStorage.setItem("slati_user", JSON.stringify({ id: "USR-000101", displayName: "电池用户", tier: "premium" }));' +
  ' localStorage.setItem("slati_lang", "zh-CN");' +
  ' try { localStorage.removeItem("slati_fluidcanvas_draft"); } catch (e) {}' +
  '})();}catch(e){}';

const READY = "document.getElementById('undoBtn') && document.getElementById('gridCanvas') && window.openEdgeDrawer && window.closeEdgeDrawer && window.edgeDrawerSetTab && window.setCardEdge";
const NAV_EXPR = "(function(){ var d = document.getElementById('fcEdgeDrawer');" +
  " var nav = document.getElementById('fcEdgeTabNav');" +
  " var tAll = document.getElementById('fcEdgeTabAll'); var tMy = document.getElementById('fcEdgeTabMy');" +
  " var bg = nav ? nav.querySelector('.subnav-highlight-bg') : null;" +
  " var blob = nav ? nav.querySelector('.subnav-blob') : null;" +
  " var clones = nav ? nav.querySelectorAll('.subnav-highlight-clone') : [];" +
  " var ct = []; for (var i=0;i<clones.length;i++) ct.push(clones[i].textContent);" +
  " return { open: d.classList.contains('open')," +
  "  slider: nav ? nav.getAttribute('data-slider') : null," +
  "  allPill: tAll.classList.contains('subnav-pill'), allActive: tAll.classList.contains('active')," +
  "  myPill: tMy.classList.contains('subnav-pill'), myActive: tMy.classList.contains('active')," +
  "  allText: tAll.textContent, myText: tMy.textContent, cloneTexts: ct," +
  "  hasBg: !!bg, hasBlob: !!blob, cloneCount: clones.length," +
  "  bgLeft: bg ? parseFloat(bg.style.left) : null, bgWidth: bg ? parseFloat(bg.style.width) : null," +
  "  bgComputedLeft: bg ? parseFloat(getComputedStyle(bg).left) : null," +
  "  bgTrans: bg ? getComputedStyle(bg).transition : null," +
  "  allOff: tAll.offsetLeft, allOffW: tAll.offsetWidth, myOff: tMy.offsetLeft, myOffW: tMy.offsetWidth," +
  "  paneAll: getComputedStyle(document.getElementById('fcEdgePaneAll')).display," +
  "  paneMy: getComputedStyle(document.getElementById('fcEdgePaneMy')).display }; })()";
const align = (n, pillOff, pillOffW) => Math.abs(n.bgLeft - pillOff) < 1 && Math.abs(n.bgWidth - pillOffW) < 1;

(async () => {
  // ═══ S 静态锚 ═══
  console.log('═══ S 静态锚 ═══');
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;

  const scSrc = norm(await (await fetch(BASE + '/assets/js/site-config.js')).text());
  const sc = mk(scSrc);
  ok('S1 site-config：52.3 赋值 ×1 + 52.0 赋值零残留 + changelog 头 52.3/52.0 各 ×1 + rev 真值 00369-gmh/00370-8g7 各 ×1（642 终态填真值口径）+ 站点恒 58.28',
    sc("window.FLUIDCANVAS_VERSION = 'v10.28.62.5';") === 1 && sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.0';") === 0 &&
    sc('// v10.28.52.3 = ') === 1 && sc('// v10.28.52.0 = ') === 1 &&
    sc('00369-gmh') === 1 && sc('00370-8g7') === 1 &&
    sc("window.MN_SITE_VERSION = 'v0.2.58.28';") === 1,
    'fc522=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.62.5';") +
    ' fc520=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.0';") +
    ' cl522=' + sc('// v10.28.52.3 = ') + ' q69=' + sc('00369-gmh') + ' q70=' + sc('00370-8g7'));

  const ed = norm(await (await fetch(BASE + EDITOR_URL_PATH)).text());
  const edLines = ed.split('\n');
  const c = (a) => edLines.filter((l) => l.includes(a)).length; // 行计数口径=实测 grep -cF
  const ED_ANCHORS = [
    ['class="subnav" data-slider id="fcEdgeTabNav"', 1],
    ['subnav-pill active" id="fcEdgeTabAll"', 1],
    ['data-i18n="fc.edge.tabMy">我</button>', 1],
    ['<script src="../assets/js/subnav.js"></script>', 1],
    ['.fc-edge-nav .subnav { flex: 1; }', 1],
    ['.fc-edge-nav .subnav-pill { flex: 1; }', 1],
    ['.fc-edge-nav .segmented-control', 0],
    ['function edgeNavResync()', 1],
    ['setTimeout(edgeNavResync, 320)', 1],
    ['>My</button>', 0],
  ];
  for (const [a, n] of ED_ANCHORS) {
    ok('S2 编辑器锚 [' + a.slice(0, 44) + '] = ' + n, c(a) === n, '实=' + c(a));
  }

  const i18Src = norm(await (await fetch(BASE + '/assets/i18n/fluidcanvas.i18n.js')).text());
  const i18 = mk(i18Src);
  ok('S3 i18n：tabMy 键 ×12 语 + zh/zh-Hant=我 各 ×1 + en=My ×1（12 语零英文混杂）',
    i18('"fc.edge.tabMy"') === 12 && i18('"fc.edge.tabMy": "我"') === 2 && i18('"fc.edge.tabMy": "My"') === 1,
    'keys=' + i18('"fc.edge.tabMy"') + ' wo=' + i18('"fc.edge.tabMy": "我"') + ' my=' + i18('"fc.edge.tabMy": "My"'));

  // ═══ Chrome ═══
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
    const seedRes = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SEED_SCRIPT });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    const origHandler = cdp.ws.onmessage;
    cdp.ws.onmessage = (ev) => {
      origHandler(ev);
      try {
        const m = JSON.parse(ev.data);
        if (m.method === 'Page.javascriptDialogOpening') cdp.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      } catch (e) {}
    };
    await cdp.send('Page.navigate', { url: BASE + EDITOR_URL_PATH + '?prem' });
    await waitFor(cdp, READY, 40000, '编辑器就绪');
    await sleep(900);

    console.log('═══ B 编辑器 CDP ═══');
    // ═══ B1 开抽屉：subnav.js 注入平台同款滑动结构 ═══
    await cdp.evalJs('(function(){ window.openEdgeDrawer(); })()');
    await sleep(600);
    const n1 = await cdp.evalJs(NAV_EXPR);
    ok('B1 抽屉 nav = 平台 subnav 同款：data-slider + subnav-pill 双钮 + subnav.js 注入白胶囊/双 clone/blob',
      n1.open === true && n1.slider === '' && n1.allPill === true && n1.myPill === true &&
      n1.hasBg === true && n1.hasBlob === true && n1.cloneCount === 2,
      JSON.stringify(n1));

    // ═══ B2 初始高亮对齐全部 ═══
    ok('B2 初始高亮对齐全部（style left/width=offset；全部 active/我非 active）',
      n1.allActive === true && n1.myActive === false && align(n1, n1.allOff, n1.allOffW),
      JSON.stringify({ bgLeft: n1.bgLeft, allOff: n1.allOff, bgWidth: n1.bgWidth, allOffW: n1.allOffW }));

    // ═══ B3 点「我」：0.55s 滑动（200ms 中程 computed 介于两 pill 间）+ 归位 + pane 切换 ═══
    {
      const pre = n1;
      await cdp.evalJs('(function(){ document.getElementById("fcEdgeTabMy").click(); })()');
      await sleep(200);
      const mid = await cdp.evalJs(NAV_EXPR);
      await sleep(600);
      const end = await cdp.evalJs(NAV_EXPR);
      ok('B3a 200ms 中程：computed left 介于两 pill 间（白胶囊真实滑动实证）',
        mid.bgComputedLeft > pre.allOff + 1 && mid.bgComputedLeft < mid.myOff - 1 &&
        mid.bgTrans.indexOf('left 0.55s') !== -1,
        JSON.stringify({ computed: mid.bgComputedLeft, allOff: pre.allOff, myOff: mid.myOff }));
      ok('B3b 750ms 归位我：高亮=我 offset + active 互换 + paneMy 显示/paneAll 隐藏',
        end.myActive === true && end.allActive === false && align(end, end.myOff, end.myOffW) &&
        end.paneMy !== 'none' && end.paneAll === 'none',
        JSON.stringify({ bgLeft: end.bgLeft, myOff: end.myOff, pMy: end.paneMy, pAll: end.paneAll }));
    }

    // ═══ B4 点回全部：往返归位 + pane 复原 ═══
    {
      await cdp.evalJs('(function(){ document.getElementById("fcEdgeTabAll").click(); })()');
      await sleep(750);
      const back = await cdp.evalJs(NAV_EXPR);
      ok('B4 点回全部：高亮归位全部 + active 复原 + paneAll 显示/paneMy 隐藏',
        back.allActive === true && back.myActive === false && align(back, back.allOff, back.allOffW) &&
        back.paneAll !== 'none' && back.paneMy === 'none',
        JSON.stringify({ bgLeft: back.bgLeft, allOff: back.allOff, pMy: back.paneMy, pAll: back.paneAll }));
    }

    // ═══ B5 zh 标签 全部/我 + clone 同文案 ═══
    {
      const zh = await cdp.evalJs(NAV_EXPR);
      ok('B5 zh 标签：全部/我（My 已全语言化）+ bold clone 同文案',
        zh.allText === '全部' && zh.myText === '我' && zh.cloneTexts.join('|') === '全部|我',
        JSON.stringify({ allText: zh.allText, myText: zh.myText, clones: zh.cloneTexts }));
    }

    // ═══ B6 en 重载：标签 All/My（界面语言零英文混杂反向实证）═══
    {
      await cdp.evalJs("localStorage.setItem('slati_lang','en')");
      await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seedRes.identifier });
      await cdp.send('Page.navigate', { url: BASE + EDITOR_URL_PATH + '?prem' });
      await waitFor(cdp, READY, 40000, '编辑器就绪(en)');
      await sleep(900);
      await cdp.evalJs('(function(){ window.openEdgeDrawer(); })()');
      await sleep(600);
      const en = await cdp.evalJs(NAV_EXPR);
      ok('B6 en 重载：标签 All/My + clone 同文案',
        en.allText === 'All' && en.myText === 'My' && en.cloneTexts.join('|') === 'All|My',
        JSON.stringify({ allText: en.allText, myText: en.myText, clones: en.cloneTexts }));
    }

    // ═══ B7 程序化 edgeDrawerSetTab('my')：观察器动画归位（零点击路径）═══
    {
      await cdp.evalJs('(function(){ window.edgeDrawerSetTab("my"); })()');
      await sleep(750);
      const prog = await cdp.evalJs(NAV_EXPR);
      ok('B7 程序化 setTab(my)：观察器动画归位我 + pane 切换',
        prog.myActive === true && prog.allActive === false && align(prog, prog.myOff, prog.myOffW) &&
        prog.paneMy !== 'none' && prog.paneAll === 'none',
        JSON.stringify({ bgLeft: prog.bgLeft, myOff: prog.myOff }));
    }

    // ═══ B8 关开抽屉：IntersectionObserver 重对齐 ═══
    {
      await cdp.evalJs('(function(){ document.getElementById("fcEdgeTabAll").click(); })()');
      await sleep(750);
      await cdp.evalJs('(function(){ window.closeEdgeDrawer(); })()');
      await sleep(350);
      await cdp.evalJs('(function(){ window.openEdgeDrawer(); })()');
      await sleep(800);
      const re = await cdp.evalJs(NAV_EXPR);
      ok('B8 关开抽屉：IO 重对齐（高亮=全部 offset 且 open 复原）',
        re.open === true && re.allActive === true && align(re, re.allOff, re.allOffW),
        JSON.stringify({ open: re.open, bgLeft: re.bgLeft, allOff: re.allOff }));
    }
  } catch (e) {
    console.log('  💔 ' + e.message);
    fail++;
  }
  console.log('═══ E 零异常 ═══');
  const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
  const rawErrs = cdp ? cdp.errs : [];
  const errs = rawErrs.filter(e => !noise.test(e));
  ok('E 零异常（' + rawErrs.length + ' 原始 / ' + errs.length + ' 噪声后）', errs.length === 0, errs.slice(0, 5).join(' || '));
  try { cdp && cdp.close(); } catch (e) {}
  try { require('child_process').spawnSync('taskkill', ['/pid', String(chrome.pid), '/t', '/f'], { stdio: 'ignore' }); } catch (e) {}

  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(fail === 0 ? 0 : 1);
})();
