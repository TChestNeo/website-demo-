// tmp-battery-fc-edgecolors.js — v10.28.51.1 边缘样本默认配色+抽屉顶部导航平台同款+应用链修复+边框裸值放宽
//   +AI 弹窗正向反馈电池（本地工作树）
//   S 静态：site-config 51.1 赋值/零残留/changelog 头/rev 占位/50.0 条目保留/站点恒 58.26；编辑器 30 锚
//     （edgeMiniHtml bg 参数/cardLayers join/segmented 结构/线型样本色/零残留 fc-edge-tab/bug 修复 toast 锚/
//      裸值 ±100 放宽锚/fc-gen-lamp/fc-gen-dots/edgeGenSetStatus 正向反馈 UI 锚）；
//     i18n 51.1 正向反馈 5 新键 ×12 语（genIdle/genThinking/genOk/genFail/genThinkingHint）+tabAll ×12 保留
//     +cardUnsupported ×0；
//   B 编辑器 CDP：B1 无卡点条目 toast 引导（51.1 修复）/ B2 抽屉 nav segmented 结构+0.2s 过渡+padding 3px /
//     B3 15 样本 cardLayers 默认配色四款（纸/藏宝/科技1/油漆1）+「无」虚线空盒+自定义剪影仍中性渐变 /
//     B4 顶部导航 My↔全部 active 互换+pane 切换 / B5 边框线型样本画取色器当前色（默认 #c8c8d0→改红刷新）/
//     B6 51.1 正向反馈状态机：打开弹窗 idle 灰灯→生成中 thinking 蓝灯脉冲+三粒点+小字→成功 success 绿灯
//     +预览/保存（罐头=裸值内环 evenodd 双环——border 生成失败根因修复实证）→保存进本地库 /
//     B7 失败态 fail 红灯+小字=具体原因+toast 同文案；
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
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-edgecolors-' + Date.now());
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

// ── 罐头 ──
const EDGE_CLIP = 'polygon(0% 0%, 100% 3%, 98% 97%, 3% 100%, 0% 0%)';
// 51.1: edge-gen 罐头——裸值内环 evenodd 双环成功回复（border 生成失败根因=裸值被拒，
// 放宽后应过）；desc 含 FAIL→ok:false；统一 600ms 延迟供 thinking 态采样
const GEN_CLIP_BORDER = 'polygon(evenodd, 0 0, 100 0, 100 100, 8 100, 8 8, 92 8, 92 92, 0 92)';
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' var stubResponse = function (body, status, delay) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status || 200, headers: { "Content-Type": "application/json" } })); }, delay || 0); }); };' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  if (u.indexOf("/fc/edges/scopes") !== -1) return stubResponse(JSON.stringify({ hasFriends: false, hasTeam: false }));' +
  '  if (u.indexOf("/fc/edges") !== -1) return stubResponse(JSON.stringify({ edges: [] }), 200);' +
  '  if (u.indexOf("/fc/edge-gen") !== -1) {' +
  '   var body = {}; try { body = JSON.parse(typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body || {})); } catch (e) {}' +
  '   if (String(body.desc || "").indexOf("FAIL") !== -1) return stubResponse(JSON.stringify({ ok: false }), 200, 600);' +
  '   return stubResponse(JSON.stringify({ ok: true, edge: { name: "裸值环", clip: "' + GEN_CLIP_BORDER + '" } }), 200, 600);' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';
const SEED_SCRIPT = 'try{(function(){' +
  ' localStorage.setItem("slati_session", "{\\"loggedIn\\":true}");' +
  ' localStorage.setItem("slati_user", JSON.stringify({ id: "USR-000101", displayName: "电池用户", tier: "premium" }));' +
  ' localStorage.setItem("slati_lang", "zh-CN");' +
  ' try { localStorage.removeItem("slati_fluidcanvas_draft"); } catch (e) {}' +
  '})();}catch(e){}';

const READY = "document.getElementById('undoBtn') && document.getElementById('gridCanvas') && window.openEdgeDrawer && window.setCardEdge && window.createAssetCard && window.selectCard";
const DRAWER_EXPR = "(function(){ var d = document.getElementById('fcEdgeDrawer');" +
  " var tAll = document.getElementById('fcEdgeTabAll'); var tMy = document.getElementById('fcEdgeTabMy');" +
  " var control = tAll ? tAll.parentElement : null;" +
  " return { open: d.classList.contains('open')," +
  "  allSeg: tAll.classList.contains('segmented-option'), allActive: tAll.classList.contains('active')," +
  "  mySeg: tMy.classList.contains('segmented-option'), myActive: tMy.classList.contains('active')," +
  "  navOk: !!tAll.closest('.fc-edge-nav'), controlCls: control ? control.className : null," +
  "  controlPad: control ? getComputedStyle(control).padding : null," +
  "  trans: tAll ? getComputedStyle(tAll).transition : null," +
  "  radius: tAll ? getComputedStyle(tAll).borderRadius : null," +
  "  paneAll: getComputedStyle(document.getElementById('fcEdgePaneAll')).display," +
  "  paneMy: getComputedStyle(document.getElementById('fcEdgePaneMy')).display," +
  "  samples: document.getElementById('fcEdgeSamplesGrid').children.length," +
  "  my: document.getElementById('fcEdgeMyGrid').children.length }; })()";
const SAMPLE_EXPR = (i) => "(function(){ var grid = document.getElementById('fcEdgeSamplesGrid');" +
  " var s = grid.children[" + i + "]; if (!s) return null; var m = s.querySelector('.fc-edge-mini');" +
  " var cs = getComputedStyle(m);" +
  " return { name: s.querySelector('.fc-edge-sample-name').textContent," +
  "  bg: cs.backgroundImage + ' | ' + cs.backgroundColor, none: m.classList.contains('fc-edge-mini-none')," +
  "  inline: m.getAttribute('style') || '' }; })()";
const TOAST_EXPR = "(function(){ var t = document.getElementById('toast');" +
  " return t ? { text: t.textContent, show: t.classList.contains('show') } : null; })()";

(async () => {
  // ═══ S 静态锚 ═══
  console.log('═══ S 静态锚 ═══');
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;

  const scSrc = norm(await (await fetch(BASE + '/assets/js/site-config.js')).text());
  const sc = mk(scSrc);
  ok('S1 site-config：51.1 赋值 ×1 + 51.0 赋值零残留 + changelog 头 51.1/51.0/50.0 各 ×1 + rev 占位/历史各 ×1 + 站点恒 58.26',
    sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.0';") === 1 && sc("window.FLUIDCANVAS_VERSION = 'v10.28.51.0';") === 0 &&
    sc('// v10.28.51.1 = ') === 1 && sc('// v10.28.51.0 = ') === 1 && sc('// v10.28.50.0 = ') === 1 &&
    sc('rev 00361-7vk') === 1 && sc('rev 00362-fdj') === 1 && sc('rev 00359-nfc') === 1 && sc('rev 00360-bk7') === 1 &&
    sc("window.MN_SITE_VERSION = 'v0.2.58.28';") === 1,
    'fc511=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.0';") + ' fc510=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.51.0';") +
    ' cl511=' + sc('// v10.28.51.1 = ') + ' r61=' + sc('rev 00361-7vk') + ' q62=' + sc('rev 00362-fdj'));

  const ed = norm(await (await fetch(BASE + EDITOR_URL_PATH)).text());
  const edLines = ed.split('\n');
  const c = (a) => edLines.filter((l) => l.includes(a)).length; // 行计数口径=实测 grep -cF
  const ED_ANCHORS = [
    ['function edgeMiniHtml(clip, cls, bg)', 1],
    ["st.cardLayers.join(', ')", 1],
    ['fc-edge-nav .segmented-control', 1],
    ['class="segmented-control">', 1],
    ['segmented-option active" id="fcEdgeTabAll"', 1],
    ['segmented-option" id="fcEdgeTabMy"', 1],
    ["' + s.value + ' ' + curColor", 1],
    ["selectedCard.style.borderColor || '#c8c8d0'", 1],
    ['fc-edge-tab', 0],
    ['fc-edge-sample-name', 2],
    ['fc-edge-mini', 7],
    ['fc-edge-nav', 3],
    ["showToast(T('fc.common.selectCard')", 2],
    ['fc.edge.cardUnsupported', 1],
    ['该卡片不支持边缘样式', 1],
    ['v10.28.51.1: 无选中卡不再静默', 1],
    // 51.1 追加：边框裸值放宽 + AI 弹窗正向反馈（两栏状态灯/三粒点/按钮下方小字）
    ['v10.28.51.1: 裸值 ±100 全收（同服务端', 1],
    ['51.1: 裸值 ±100（原 0/100）', 1],
    ['fc-gen-lamp', 6],
    ['fc-gen-dots', 6],
    ['edgeGenSetStatus', 6],
    ['fcEdgeGenState', 5],
    ['fcEdgeGenFeedback', 5],
    ['fcEdgeGenStateText', 2],
    ['fc.edge.genThinkingHint', 1],
    ['fc-gen-fb-fail', 2]
  ];
  const edBad = ED_ANCHORS.filter(([a, n]) => c(a) !== n);
  ok('S2 编辑器 30 锚全中（样本配色/segmented/线型样本/无卡 toast/裸值放宽/正向反馈 UI）', edBad.length === 0,
    edBad.map(([a, n]) => a + '=' + c(a) + '≠' + n).join(',') || '30/30');

  const i18nSrc = norm(await (await fetch(BASE + '/assets/i18n/fluidcanvas.i18n.js')).text());
  const ic = mk(i18nSrc);
  ok('S3 i18n：51.1 正向反馈 5 新键 ×12 语 + tabAll ×12 保留 + cardUnsupported ×0（T 键兜底中文）',
    ic('"fc.edge.genIdle"') === 12 && ic('"fc.edge.genThinking"') === 12 && ic('"fc.edge.genOk"') === 12 &&
    ic('"fc.edge.genFail"') === 12 && ic('"fc.edge.genThinkingHint"') === 12 &&
    ic('"fc.edge.tabAll"') === 12 && ic('"fc.edge.cardUnsupported"') === 0,
    'idle=' + ic('"fc.edge.genIdle"') + ' think=' + ic('"fc.edge.genThinking"') + ' ok=' + ic('"fc.edge.genOk"') +
    ' fail=' + ic('"fc.edge.genFail"') + ' hint=' + ic('"fc.edge.genThinkingHint"') +
    ' ta=' + ic('"fc.edge.tabAll"') + ' cu=' + ic('"fc.edge.cardUnsupported"'));

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
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SEED_SCRIPT });
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

    const toast = async () => { await sleep(150); return cdp.evalJs(TOAST_EXPR); };
    const seedCustom = () => cdp.evalJs('(function(){ localStorage.setItem("slati_custom_edges", JSON.stringify([' +
      '{ id: "ce-test-1", name: "测试边", kind: "edge", clip: ' + JSON.stringify(EDGE_CLIP) + ', clipSoft: null, createdAt: new Date().toISOString(), source: "ai", repoId: null, author: null, visibility: null }])) })()');

    console.log('═══ B 编辑器 CDP ═══');
    // ═══ B1 无选中卡点条目 → toast 引导（51.1 bug 修复锚）═══
    {
      await seedCustom();
      await cdp.evalJs('(function(){ window.openEdgeDrawer(); })()');
      await sleep(400);
      await cdp.evalJs('(function(){ var it = document.querySelector("#fcEdgeMyGrid .fc-edge-item"); if (it) it.click(); })()');
      const t = await toast();
      ok('B1 无选中卡点 My 条目：toast「请先选中一张卡片」（原静默零反馈=用户报告）',
        t && t.show === true && t.text === '请先选中一张卡片', JSON.stringify(t));
    }

    // ═══ 建卡 + 选中（后续 B 全在选中卡上下文）═══
    {
      await cdp.evalJs("(function(){ window.createAssetCard('text','T1',2,2,6,4); })()");
      await sleep(400);
      await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card[data-label=\"T1\"]'); window.selectCard(c, true); })()");
      await sleep(300);
      await cdp.evalJs('(function(){ window.openEdgeDrawer(); })()');
      await sleep(400);
    }

    // ═══ B2 抽屉 nav = 平台 segmented-control 同款结构/动画 ═══
    {
      const d = await cdp.evalJs(DRAWER_EXPR);
      ok('B2 nav segmented 结构：双钮 segmented-option + 全部 active + .fc-edge-nav 容器 + 控制条 padding 3px + 过渡含 0.2s + radius-full',
        d.open === true && d.allSeg === true && d.allActive === true && d.mySeg === true && d.myActive === false &&
        d.navOk === true && d.controlCls === 'segmented-control' && d.controlPad === '3px' &&
        typeof d.trans === 'string' && d.trans.indexOf('0.2s') !== -1 && d.radius !== '0px',
        JSON.stringify(d));
    }

    // ═══ B3 样本默认配色（cardLayers 同屏）+ 无 + 自定义中性 ═══
    {
      const s0 = await cdp.evalJs(SAMPLE_EXPR(0));
      const s1 = await cdp.evalJs(SAMPLE_EXPR(1));
      const s2 = await cdp.evalJs(SAMPLE_EXPR(2));
      const s3 = await cdp.evalJs(SAMPLE_EXPR(3));
      const s9 = await cdp.evalJs(SAMPLE_EXPR(9));
      ok('B3a 样本 15 个 + 「无」= 虚线空盒（fc-edge-mini-none + 透明底 + 零内联 background）',
        s0 !== null && s0.none === true && s0.bg.indexOf('rgba(0, 0, 0, 0)') !== -1 && s0.inline.indexOf('background') === -1,
        JSON.stringify(s0));
      ok('B3b 纸样本 cardLayers 羊皮纸米黄（rgba(255,248,225,…)）+ 内联 --mini-clip',
        s1 !== null && s1.bg.indexOf('255, 248, 225') !== -1 && s1.inline.indexOf('--mini-clip') !== -1,
        JSON.stringify({ name: s1 && s1.name, inline: s1 && s1.inline.slice(0, 60), bg: s1 && s1.bg.slice(0, 90) }));
      ok('B3c 藏宝图样本棕金（rgba(129,92,49,…)）', s2 !== null && s2.bg.indexOf('129, 92, 49') !== -1,
        JSON.stringify({ name: s2 && s2.name, bg: s2 && s2.bg.slice(0, 90) }));
      ok('B3d 科技1 样本暗蓝 HUD（rgba(10,22,40,…)）', s3 !== null && s3.bg.indexOf('10, 22, 40') !== -1,
        JSON.stringify({ name: s3 && s3.name, bg: s3 && s3.bg.slice(0, 90) }));
      ok('B3e 油漆1 样本 PAINT_GRADS 红（#e63920→rgb(230, 57, 32)）', s9 !== null && s9.bg.indexOf('230, 57, 32') !== -1,
        JSON.stringify({ name: s9 && s9.name, bg: s9 && s9.bg.slice(0, 90) }));
      const myMini = await cdp.evalJs("(function(){ var it = document.querySelector('#fcEdgeMyGrid .fc-edge-item .fc-edge-mini');" +
        " if (!it) return null; var cs = getComputedStyle(it);" +
        " return { inline: it.getAttribute('style') || '', bg: cs.backgroundImage, name: document.querySelector('#fcEdgeMyGrid .fc-edge-item-name').textContent }; })()");
      ok('B3f 自定义剪影仍中性渐变（零内联 background + 紫渐变 70, 72, 212）',
        myMini !== null && myMini.inline.indexOf('background') === -1 && myMini.bg.indexOf('70, 72, 212') !== -1,
        JSON.stringify({ name: myMini && myMini.name, inline: myMini && myMini.inline, bg: myMini && myMini.bg.slice(0, 90) }));
    }

    // ═══ B4 顶部导航 My↔全部（segmented active 互换 + pane 切换）═══
    {
      await cdp.evalJs('(function(){ document.getElementById("fcEdgeTabMy").click(); })()');
      await sleep(300);
      const dMy = await cdp.evalJs(DRAWER_EXPR);
      ok('B4a 点 My：active 互换 + paneMy 显示 + paneAll 隐藏',
        dMy.myActive === true && dMy.allActive === false && dMy.paneMy !== 'none' && dMy.paneAll === 'none',
        JSON.stringify({ myA: dMy.myActive, allA: dMy.allActive, pMy: dMy.paneMy, pAll: dMy.paneAll }));
      await cdp.evalJs('(function(){ document.getElementById("fcEdgeTabAll").click(); })()');
      await sleep(300);
      const dAll = await cdp.evalJs(DRAWER_EXPR);
      ok('B4b 点回全部：active 复原 + paneAll 显示',
        dAll.allActive === true && dAll.myActive === false && dAll.paneAll !== 'none' && dAll.paneMy === 'none',
        JSON.stringify({ myA: dAll.myActive, allA: dAll.allActive, pMy: dAll.paneMy, pAll: dAll.paneAll }));
    }

    // ═══ B5 边框线型样本画取色器当前色（默认 #c8c8d0；改红后随刷新）═══
    {
      const lineExpr = "(function(){ var b = document.querySelector('#borderStyleOptions button');" +
        " if (!b) return null; var ln = b.querySelector('div');" +
        " return ln ? getComputedStyle(ln).borderTopColor : null; })()";
      const def = await cdp.evalJs(lineExpr);
      ok('B5a 线型样本默认 #c8c8d0（rgb(200, 200, 208) 与卡片实际边框一致）', def === 'rgb(200, 200, 208)', JSON.stringify(def));
      await cdp.evalJs("(function(){ window.updateCardBorderColor('#ff0000'); window.refreshEdgeDrawer(); })()");
      await sleep(300);
      const red = await cdp.evalJs(lineExpr);
      ok('B5b 改红后线型样本跟随取色器当前色（rgb(255, 0, 0)）', red === 'rgb(255, 0, 0)', JSON.stringify(red));
      await cdp.evalJs("(function(){ window.updateCardBorderColor('#c8c8d0'); window.refreshEdgeDrawer(); })()");
      await sleep(200);
    }

    // ═══ B6 51.1 正向反馈状态机 + border 裸值生成链（用户报告「边框生成失败」修复实证）═══
    const GEN_EXPR = "(function(){ var box = document.getElementById('fcEdgeGenState'); var fb = document.getElementById('fcEdgeGenFeedback');" +
      " if (!box || !fb) return null; var lamp = document.getElementById('fcEdgeGenLamp');" +
      " var dots = fb.querySelector('.fc-gen-dots'); var lampCs = getComputedStyle(lamp);" +
      " return { boxCls: box.className, txt: document.getElementById('fcEdgeGenStateText').textContent," +
      "  fbDisplay: getComputedStyle(fb).display, dotsDisplay: getComputedStyle(dots).display," +
      "  fbt: document.getElementById('fcEdgeGenFeedbackText').textContent," +
      "  lampBg: lampCs.backgroundColor, lampAnim: lampCs.animationName," +
      "  resultDisplay: getComputedStyle(document.getElementById('edgeGenResult')).display," +
      "  saveDisplay: getComputedStyle(document.getElementById('edgeGenSaveBtn')).display," +
      "  modalActive: !!document.querySelector('#fcEdgeGenModal .modal-card.active') }; })()";
    {
      await cdp.evalJs('(function(){ window.openEdgeGenModal(); })()');
      await sleep(400);
      const idle = await cdp.evalJs(GEN_EXPR);
      ok('B6a 打开弹窗=idle 态：左栏 fc-gen-state-idle+文本「AI 空闲」+灰灯 rgb(154,160,180)+反馈行隐藏+弹窗 active',
        idle.boxCls === 'fc-gen-state fc-gen-state-idle' && idle.txt === 'AI 空闲' &&
        idle.lampBg === 'rgb(154, 160, 180)' && idle.lampAnim === 'none' &&
        idle.fbDisplay === 'none' && idle.modalActive === true,
        JSON.stringify(idle));
      // 切边框 → 生成（裸值内环罐头）→ thinking 采样
      await cdp.evalJs("(function(){ window.edgeGenSetKind('border');" +
        " document.getElementById('edgeGenDesc').value = '双环边框'; window.edgeGenRun(); })()");
      await sleep(150);
      const thinking = await cdp.evalJs(GEN_EXPR);
      ok('B6b 生成中=thinking 态：蓝灯脉冲动画 fcGenPulse+文本「AI 思考中」+反馈行显示+三粒点显示+小字「正在生成…」',
        thinking.boxCls === 'fc-gen-state fc-gen-state-thinking' && thinking.txt === 'AI 思考中' &&
        thinking.lampAnim === 'fcGenPulse' && thinking.fbDisplay === 'flex' &&
        thinking.dotsDisplay !== 'none' && thinking.fbt.indexOf('正在生成') === 0,
        JSON.stringify(thinking));
      await sleep(900);
      const done = await cdp.evalJs(GEN_EXPR);
      const clipVal = await cdp.evalJs("(function(){ return document.getElementById('edgeGenPreviewClip').value; })()");
      ok('B6c 成功=success 态：绿灯 rgb(34,160,107)+文本「生成成功」+三粒点隐藏+小字「生成成功」+预览/保存显示',
        done.boxCls === 'fc-gen-state fc-gen-state-success' && done.txt === '生成成功' &&
        done.lampBg === 'rgb(34, 160, 107)' && done.dotsDisplay === 'none' &&
        done.fbt === '生成成功' && done.resultDisplay !== 'none' && done.saveDisplay !== 'none',
        JSON.stringify(done));
      ok('B6d border 裸值内环通过客户端 sanitize（预览 clip=evenodd 双环裸值原样）',
        clipVal.indexOf('polygon(evenodd, 0 0, 100 0, 100 100, 8 100, 8 8, 92 8, 92 92, 0 92)') === 0,
        clipVal);
      await cdp.evalJs('(function(){ window.edgeGenSave(); })()');
      await sleep(400);
      const my = await cdp.evalJs("(function(){ var g = document.getElementById('fcEdgeMyGrid');" +
        " var e = null; try { e = JSON.parse(localStorage.getItem('slati_custom_edges') || '[]'); } catch (x) {}" +
        " return { n: g ? g.children.length : -1, saved: (e || []).filter(function (x) { return x.kind === 'border'; }).length }; })()");
      ok('B6e 保存进本地库（My 列表 2 条=B3f 自定义+border 新件；localStorage kind=border=1）', my.n === 2 && my.saved === 1, JSON.stringify(my));
    }

    // ═══ B7 失败态：罐头 ok:false → 左栏红灯+小字=具体原因+toast ═══
    {
      await cdp.evalJs('(function(){ window.openEdgeGenModal(); })()');
      await sleep(300);
      await cdp.evalJs("(function(){ document.getElementById('edgeGenDesc').value = 'FAIL 触发失败'; window.edgeGenRun(); })()");
      await sleep(900);
      const failState = await cdp.evalJs(GEN_EXPR);
      const toast = await cdp.evalJs(TOAST_EXPR);
      ok('B7 失败=fail 态：红灯 rgb(229,72,77)+文本「生成失败」+小字「生成失败，请稍后再试」+toast 同文案',
        failState.boxCls === 'fc-gen-state fc-gen-state-fail' && failState.txt === '生成失败' &&
        failState.lampBg === 'rgb(229, 72, 77)' && failState.dotsDisplay === 'none' &&
        failState.fbt === '生成失败，请稍后再试' && toast.show === true && toast.text === '生成失败，请稍后再试',
        JSON.stringify({ fs: failState, t: toast }));
      await cdp.evalJs("(function(){ closeModalOnly('fcEdgeGenModal'); })()");
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
  try { spawn('taskkill', ['/pid', String(chrome.pid), '/t', '/f'], { stdio: 'ignore' }); } catch (e) {}

  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  process.exit(fail === 0 ? 0 : 1);
})();
