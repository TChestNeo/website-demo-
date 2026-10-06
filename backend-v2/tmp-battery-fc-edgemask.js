// tmp-battery-fc-edgemask.js — v10.28.57.0 AI 边缘 Mask 化+图片与边缘同步勾选+边缘外扩电池（本地工作树）
//   S 静态：编辑器 13 锚（expandClipPct/CUSTOM_EDGE_EXPAND/--card-mask-clip/dataset.edgeMask/勾选节链/clipRaw）
//     （行计数口径=实测 grep -cF）；site-config 53.0 赋值+52.5 零残留+changelog 头+rev 00379-/00380-；
//     i18n fc.edge.maskSync ×12；
//   B 编辑器 CDP：B0 就绪 / B1 应用自定义 edge 种（edgeMask='1' 默认 + maskVar=原多边形 + --card-clip=外扩
//     + expandClipPct 数学三式）/ B2 图片卡 Mask 实测（.card-img-bg clipPath 原形 + 卡根不剪 + 阴影在）/
//     B3 勾选节可见已勾 + 点击取消（'0' + var 移除 + img 回整矩形）+ 重勾恢复 / B4 内置 tech4（旗不动=off
//     + 节可见未勾 + 勾后 url(#hud-frame-4) 生效）/ B5 border 种（旗删 + 无 mask + 节隐藏 + clip=EXP_RING）/
//     B6 无→清（var 移除 + 旗删 + 节隐藏）/ B7 草稿往返（edgeMask '1'/'0' 入草稿 + reload 双卡恢复）/
//     B8 组模式（节隐藏 + setEdgeMaskSync 无操作）/ B9 AI 生成→保存→点击选中→画布出现（bug 修复实证）；
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
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-edgemask-' + Date.now());
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

// ── 罐头形状（raw=原多边形；EXP=0.06 外扩多边形——expandClipPct 数学推值）──
const EDGE_CLIP = 'polygon(0% 0%, 100% 3%, 98% 97%, 3% 100%, 0% 0%)';
const EXP_EDGE = 'polygon(-3% -3%, 103% 0.18%, 100.88% 99.82%, 0.18% 103%, -3% -3%)';
const EXP_14 = 'polygon(-20% -20%, 120% -15.8%, 117.2% 115.8%, -15.8% 120%, -20% -20%)'; // v10.28.57.0 紫色=1.4×内容
const RING = 'polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 8% 8%, 92% 8%, 92% 92%, 8% 92%, 8% 8%)';
const EXP_RING = 'polygon(evenodd, -3% -3%, 103% -3%, 103% 103%, -3% 103%, -3% -3%, 5.48% 5.48%, 94.52% 5.48%, 94.52% 94.52%, 5.48% 94.52%, 5.48% 5.48%)';
const EXP_RING_14 = 'polygon(evenodd, -20% -20%, 120% -20%, 120% 120%, -20% 120%, -20% -20%, -8.8% -8.8%, 108.8% -8.8%, 108.8% 108.8%, -8.8% 108.8%, -8.8% -8.8%)';
const TRI = 'polygon(0% 0%, 100% 50%, 0% 100%)';
const EXP_TRI = 'polygon(-3% -3%, 103% 50%, -3% 103%)';
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// ── fetch 罐头（复用 edgeai：/fc/edges/scopes + /fc/edge-gen + /fc/edges）──
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' window.__fcalls = []; window.__edgePosted = null; window.__edgePut = null; window.__edgeGetScope = null;' +
  ' var EDGE_CLIP = ' + JSON.stringify(EDGE_CLIP) + ';' +
  ' var stubResponse = function (body, status) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status || 200, headers: { "Content-Type": "application/json" } })); }, 0); }); };' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  var method = (opts && opts.method) || "GET";' +
  '  var bodyObj = null;' +
  '  try { if (opts && opts.body && typeof opts.body === "string") bodyObj = JSON.parse(opts.body); } catch (e) {}' +
  '  if (u.indexOf("/fc/edges/scopes") !== -1) {' +
  '   window.__fcalls.push({ m: method, url: u, body: bodyObj });' +
  '   return stubResponse(JSON.stringify({ hasFriends: false, hasTeam: false }));' +
  '  }' +
  '  if (u.indexOf("/fc/edge-gen") !== -1) {' +
  '   window.__fcalls.push({ m: method, url: u, body: bodyObj });' +
  '   var mode = window.__genMode || "edge";' +
  '   if (mode === "unavailable") return stubResponse(JSON.stringify({ unavailable: true }), 503);' +
  '   if (mode === "budget") return stubResponse(JSON.stringify({ budget_exhausted: true }), 200);' +
  '   if (mode === "failed") return stubResponse(JSON.stringify({ ok: false }), 200);' +
  '   return stubResponse(JSON.stringify({ ok: true, edge: { name: "AI撕边", clip: EDGE_CLIP } }), 200);' +
  '  }' +
  '  if (u.indexOf("/fc/edges") !== -1) {' +
  '   window.__fcalls.push({ m: method, url: u, body: bodyObj });' +
  '   var scope = (u.match(/[?&]scope=([a-z]+)/) || [])[1] || "all";' +
  '   window.__edgeGetScope = scope;' +
  '   return stubResponse(JSON.stringify({ edges: [] }), 200);' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';

// ── 会话/用户/语言 + window.name 草稿注入 ──
const SEED_SCRIPT = 'try{(function(){' +
  ' var q = location.search || "";' +
  ' localStorage.setItem("slati_session", "{\\"loggedIn\\":true}");' +
  ' var u = { id: "USR-000101", displayName: "电池用户", citizenId: "CIT-000101", bio: "电池用户简介", gender: "Male",' +
  '  tier: q.indexOf("prem") !== -1 ? "premium" : "free", avatarUrl: null, bannerUrl: null };' +
  ' localStorage.setItem("slati_user", JSON.stringify(u));' +
  ' localStorage.setItem("slati_lang", "zh-CN");' +
  ' var n = window.name || "";' +
  ' if (n.indexOf("__FCSEED__") === 0) { localStorage.setItem("slati_fluidcanvas_draft", n.slice(10)); }' +
  ' else { try { localStorage.removeItem("slati_fluidcanvas_draft"); } catch (e) {} }' +
  '})();}catch(e){}';

// ── 本地库种子（ce-mask1=edge 种 / ce-mask2=border 种）──
const LIB_SEED = [
  { id: 'ce-mask1', name: 'Mask边', kind: 'edge', clip: EDGE_CLIP, clipSoft: null, createdAt: 1760000000000, source: 'ai', repoId: null },
  { id: 'ce-mask2', name: 'Mask框', kind: 'border', clip: RING, clipSoft: null, createdAt: 1760000000100, source: 'ai', repoId: null }
];

// ── 状态读取 ──
const READY = "document.getElementById('undoBtn') && document.getElementById('gridCanvas') && window.openEdgeDrawer && window.setCardEdge && window.setEdgeMaskSync && window.expandClipPct && window.createAssetCard && window.setCardImage && window.edgeMyApply && window.edgeGenRun && window.edgeGenSave";
const DRAWER_EXPR = "(function(){ var d = document.getElementById('fcEdgeDrawer');" +
  " return { open: d.classList.contains('open'), samples: document.getElementById('fcEdgeSamplesGrid').children.length," +
  "  my: document.getElementById('fcEdgeMyGrid').children.length }; })()";
const MCARD_EXPR = (label) => "(function(){ var c = document.querySelector('#gridCanvas .grid-card[data-label=\"" + label + "\"]');" +
  " if (!c) return null;" +
  " var cs = getComputedStyle(c);" +
  " var img = c.querySelector('.card-img-bg');" +
  " return { edge: c.dataset.cardEdge || '', mask: c.dataset.edgeMask || ''," +
  "  clip: cs.getPropertyValue('--card-clip').trim(), maskVar: cs.getPropertyValue('--card-mask-clip').trim()," +
  "  imgClip: img ? getComputedStyle(img).clipPath : null, rootClip: cs.clipPath, shadow: cs.boxShadow !== 'none'," +
  "  bgImg: !!img }; })()";
const MASK_SEC_EXPR = "(function(){ var sec = document.getElementById('fcEdgeMaskSec'); var cb = document.getElementById('fcEdgeMaskSync');" +
  " return { show: sec ? sec.style.display !== 'none' : null, checked: cb ? cb.checked : null }; })()";
const TOAST_EXPR = "(function(){ var t = document.getElementById('toast');" +
  " return t ? { text: t.textContent, show: t.classList.contains('show') } : null; })()";
const LIB_EXPR = "(function(){ try { return JSON.parse(localStorage.getItem('slati_custom_edges') || '[]'); } catch (e) { return []; } })()";

(async () => {
  // ═══ S 静态锚 ═══
  console.log('═══ S 静态锚 ═══');
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;

  const ed = norm(await (await fetch(BASE + EDITOR_URL_PATH)).text());
  const edLines = ed.split('\n');
  const c = (a) => edLines.filter((l) => l.includes(a)).length;
  const ED_ANCHORS = [
    ['function expandClipPct', 1], ['window.expandClipPct', 1], ['CUSTOM_EDGE_SCALE', 2],
    ['--card-mask-clip', 5], ['dataset.edgeMask', 10], ['fcEdgeMaskSec', 2], ['fcEdgeMaskSync', 3],
    ['setEdgeMaskSync', 3], ['renderEdgeMaskSec', 3], ['clipRaw', 2], ['expandClipPct(e.clip', 1],
    ['function customEdgeById', 1], ['function customEdgeRecipe', 1],
    ['.grid-card .card-stripes { clip-path: var(--card-mask-clip, none); }', 1]];
  const edBad = ED_ANCHORS.filter(([a, n]) => c(a) !== n);
  ok('S1 编辑器 14 锚全中（外扩/Mask 门/勾选节/草稿旗链）', edBad.length === 0,
    edBad.map(([a, n]) => a + '=' + c(a) + '≠' + n).join(',') || '14/14');

  const scSrc = norm(await (await fetch(BASE + '/assets/js/site-config.js')).text());
  const sc = mk(scSrc);
  ok('S2 site-config：53.0 在位 + 52.5 赋值零残留 + changelog 头 53.0/52.5 各 ×1 + rev 00379-/00380- 各 ×1 + 站点恒 58.28',
    sc("window.FLUIDCANVAS_VERSION = 'v10.28.57.0';") === 1 && sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.5';") === 0 &&
    sc('// v10.28.57.0 = ') === 1 && sc('// v10.28.52.5 = ') === 1 &&
    sc('rev 00379-') === 1 && sc('rev 00380-') === 1 &&
    sc("window.MN_SITE_VERSION = 'v0.2.58.28';") === 1,
    'fc53=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.57.0';") + ' fc525=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.5';") +
    ' cl53=' + sc('// v10.28.57.0 = ') + ' cl525=' + sc('// v10.28.52.5 = ') +
    ' r79=' + sc('rev 00379-') + ' r80=' + sc('rev 00380-') +
    ' v28=' + sc("window.MN_SITE_VERSION = 'v0.2.58.28';"));

  const i18nSrc = norm(await (await fetch(BASE + '/assets/i18n/fluidcanvas.i18n.js')).text());
  const ic = mk(i18nSrc);
  ok('S3 i18n：fc.edge.maskSync ×12 语', ic('"fc.edge.maskSync"') === 12, 'ms=' + ic('"fc.edge.maskSync"'));

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
    await cdp.send('Page.setDownloadBehavior', { behavior: 'deny' });
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

    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 30000, label);
      await sleep(600);
    };
    const setWinName = async (name) => { await cdp.evalJs('window.name = ' + JSON.stringify(name)); };
    const createCard = async (asset, label, col, row, sw, sh) => {
      await cdp.evalJs("(function(){ window.createAssetCard(" + JSON.stringify(asset) + "," + JSON.stringify(label) + "," + col + "," + row + "," + sw + "," + sh + "); })()");
    };
    const selectCard = async (label) => {
      await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card[data-label=\"" + label + "\"]'); window.selectCard(c, true); return !!c; })()");
      await sleep(250);
    };
    const seedLib = () => cdp.evalJs("localStorage.setItem('slati_custom_edges', " + JSON.stringify(JSON.stringify(LIB_SEED)) + ")");
    const mcard = (label) => cdp.evalJs(MCARD_EXPR(label));
    const maskSec = () => cdp.evalJs(MASK_SEC_EXPR);
    const lib = () => cdp.evalJs(LIB_EXPR);
    const toast = async () => { await sleep(150); return cdp.evalJs(TOAST_EXPR); };

    // ═══ B0 就绪 ═══
    console.log('═══ B 编辑器 CDP ═══');
    {
      const d = await cdp.evalJs(DRAWER_EXPR);
      ok('B0 就绪：抽屉隐 + 样本未渲染（开抽屉才渲染）+ My 0', d.open === false && d.samples === 0 && d.my === 0, JSON.stringify(d));
    }

    // ═══ B1 应用自定义 edge 种（默认勾选 Mask + 装饰外扩 + 数学三式）═══
    {
      await seedLib();
      await createCard('text', 'T1', 2, 2, 6, 4);
      await sleep(400);
      await selectCard('T1');
      await cdp.evalJs('(function(){ window.edgeMyApply("ce-mask1"); })()');
      await sleep(400);
      const card = await mcard('T1');
      const math = await cdp.evalJs("(function(){ return { e: window.expandClipPct(" + JSON.stringify(EDGE_CLIP) + ", 0.06)," +
        " r: window.expandClipPct(" + JSON.stringify(RING) + ", 0.06)," +
        " t: window.expandClipPct(" + JSON.stringify(TRI) + ", 0.06)," +
        " bad: window.expandClipPct('url(#x)', 0.06) }; })()");
      ok('B1 应用 edge 自定义：edgeMask=\'1\' 默认 + maskVar=原多边形 + --card-clip=外扩 + expandClipPct 数学三式 + 非 polygon 防御回退',
        card && card.edge === 'custom:ce-mask1' && card.mask === '1' &&
        card.maskVar === EDGE_CLIP && card.clip === EXP_14 && card.bgImg === false &&
        math.e === EXP_EDGE && math.r === EXP_RING && math.t === EXP_TRI && math.bad === 'url(#x)',
        JSON.stringify({ card: card, math: math }));
    }

    // ═══ B2 图片卡 Mask 实测（图片只显示在边缘范围内、形状跟随边缘）═══
    {
      await createCard('text', 'IMG1', 10, 2, 6, 4);
      await sleep(400);
      await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card[data-label=\"IMG1\"]');" +
        " window.setCardImage(c, " + JSON.stringify(PNG_1PX) + ", 'IMG1'); })()");
      await sleep(500);
      await selectCard('IMG1');
      await cdp.evalJs('(function(){ window.edgeMyApply("ce-mask1"); })()');
      await sleep(400);
      const card = await mcard('IMG1');
      ok('B2 图片卡 Mask：.card-img-bg clipPath=原多边形 + 卡根不剪（rootClip none）+ maskVar 原形',
        card && card.bgImg === true && card.mask === '1' &&
        card.imgClip === EDGE_CLIP && card.rootClip === 'none' && card.maskVar === EDGE_CLIP,
        JSON.stringify(card));
    }

    // ═══ B3 勾选节（可见已勾 + 点击取消 + 重勾恢复）═══
    {
      await cdp.evalJs('(function(){ window.openEdgeDrawer("edge"); })()');
      await sleep(400);
      let sec = await maskSec();
      ok('B3a 抽屉开：勾选节可见 + 已勾（edge 种默认）', sec.show === true && sec.checked === true, JSON.stringify(sec));
      const clicked = await cdp.evalJs("(function(){ var cb = document.getElementById('fcEdgeMaskSync'); if (!cb) return false; cb.click(); return true; })()");
      await sleep(400);
      const card = await mcard('IMG1');
      sec = await maskSec();
      ok('B3b 点击取消：edgeMask=\'0\' + maskVar 移除 + img 回整矩形 none + 未勾',
        clicked === true && card && card.mask === '0' && card.maskVar === '' && card.imgClip === 'none' && sec.checked === false,
        JSON.stringify({ card: card, sec: sec }));
      await cdp.evalJs('(function(){ window.setEdgeMaskSync(true); })()');
      await sleep(400);
      const card2 = await mcard('IMG1');
      sec = await maskSec();
      ok('B3c 重勾恢复：edgeMask=\'1\' + img clipPath 原形回来 + 已勾',
        card2 && card2.mask === '1' && card2.maskVar === EDGE_CLIP && card2.imgClip === EDGE_CLIP && sec.checked === true,
        JSON.stringify({ card2: card2, sec: sec }));
    }

    // ═══ B4 内置 tech4（旗不动=off + 勾后生效）═══
    {
      await createCard('text', 'T4', 2, 12, 6, 4);
      await sleep(400);
      await selectCard('T4');
      await cdp.evalJs("(function(){ window.setCardEdge('tech4'); })()");
      await sleep(400);
      let card = await mcard('T4');
      let sec = await maskSec();
      ok('B4a 内置 tech4：旗缺省=off（maskVar 无）+ 勾选节可见未勾 + --card-clip url 在',
        card && card.edge === 'tech4' && card.mask === '' && card.maskVar === '' &&
        card.clip === 'url(#hud-frame-4)' && sec.show === true && sec.checked === false,
        JSON.stringify({ card: card, sec: sec }));
      await cdp.evalJs('(function(){ window.setEdgeMaskSync(true); })()');
      await sleep(400);
      card = await mcard('T4');
      sec = await maskSec();
      await cdp.evalJs("(function(){ window.setCardEdge('tech4'); })()"); // 重应用内置：旗保留
      await sleep(400);
      const card2 = await mcard('T4');
      ok('B4b 勾后生效 + 重应用内置旗保留：maskVar=url(#hud-frame-4) + 已勾',
        card && card.mask === '1' && card.maskVar === 'url(#hud-frame-4)' && sec.checked === true &&
        card2 && card2.mask === '1' && card2.maskVar === 'url(#hud-frame-4)',
        JSON.stringify({ card: card, card2: card2, sec: sec }));
    }

    // ═══ B5 border 种（无 Mask + 节隐藏 + 装饰 EXP_RING）═══
    {
      await createCard('text', 'T5', 10, 12, 6, 4);
      await sleep(400);
      await selectCard('T5');
      await cdp.evalJs('(function(){ window.edgeMyApply("ce-mask2"); })()');
      await sleep(400);
      const card = await mcard('T5');
      const sec = await maskSec();
      ok('B5 border 种：旗删 + maskVar 无 + --card-clip=EXP_RING + 勾选节隐藏',
        card && card.edge === 'custom:ce-mask2' && card.mask === '' && card.maskVar === '' &&
        card.clip === EXP_RING_14 && sec.show === false,
        JSON.stringify({ card: card, sec: sec }));
    }

    // ═══ B6 无→清（var 移除 + 旗删 + 节隐藏）═══
    {
      await cdp.evalJs("(function(){ window.setCardEdge('none'); })()");
      await sleep(400);
      const card = await mcard('T5');
      const sec = await maskSec();
      ok('B6 无：dataset 清 + maskVar 移除 + --card-clip 撤 + 节隐藏',
        card && card.edge === '' && card.mask === '' && card.maskVar === '' &&
        (card.clip === '' || card.clip === 'none') && sec.show === false,
        JSON.stringify({ card: card, sec: sec }));
    }

    // ═══ B7 草稿往返（edgeMask '1'/'0' 显式值）═══
    {
      // IMG1 = '1'；T6 = 应用后取消勾 = '0'
      await createCard('text', 'T6', 18, 12, 6, 4);
      await sleep(400);
      await selectCard('T6');
      await cdp.evalJs('(function(){ window.edgeMyApply("ce-mask1"); })()');
      await sleep(400);
      await cdp.evalJs('(function(){ window.setEdgeMaskSync(false); })()');
      await sleep(400);
      await cdp.evalJs('(function(){ window.saveDraft(); })()');
      await sleep(400);
      const draft = await cdp.evalJs("JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}')");
      const imgE = (draft.cards || []).find(x => x.label === 'IMG1');
      const t6E = (draft.cards || []).find(x => x.label === 'T6');
      ok('B7a 草稿：edgeMask 显式值入草稿（IMG1=\'1\' / T6=\'0\'）+ customEdges 含被引用条目',
        imgE && imgE.edgeMask === '1' && t6E && t6E.edgeMask === '0' &&
        Array.isArray(draft.customEdges) && draft.customEdges.some(x => x.id === 'ce-mask1'),
        JSON.stringify({ imgE: imgE && imgE.edgeMask, t6E: t6E && t6E.edgeMask, ce: (draft.customEdges || []).map(x => x.id) }));
      await setWinName('__FCSEED__' + JSON.stringify(draft));
      await nav(BASE + EDITOR_URL_PATH + '?prem', "document.querySelectorAll('#gridCanvas .grid-card').length >= 5", 'B7 nav');
      await sleep(700);
      const imgC = await mcard('IMG1');
      const t6C = await mcard('T6');
      ok('B7b reload 往返：IMG1 mask=\'1\' + img clip 原形 + clip EXP_EDGE；T6 mask=\'0\' + maskVar 无',
        imgC && imgC.edge === 'custom:ce-mask1' && imgC.mask === '1' && imgC.imgClip === EDGE_CLIP && imgC.clip === EXP_14 &&
        t6C && t6C.edge === 'custom:ce-mask1' && t6C.mask === '0' && t6C.maskVar === '',
        JSON.stringify({ imgC: imgC, t6C: t6C }));
    }

    // ═══ B8 组模式（节隐藏 + 勾选无操作）═══
    {
      await createCard('text', 'T7', 2, 22, 6, 4);
      await createCard('text', 'T8', 10, 22, 6, 4);
      await sleep(400);
      await cdp.evalJs("(function(){ var a = document.querySelector('#gridCanvas .grid-card[data-label=\"T7\"]');" +
        " var b = document.querySelector('#gridCanvas .grid-card[data-label=\"T8\"]');" +
        " window.mergeCards(b, a, 'right'); return true; })()");
      await sleep(700);
      await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card[data-label=\"T7\"]');" +
        " window.selectCard(c, false); return !!c; })()");
      await sleep(250);
      const sec = await maskSec();
      const before = await mcard('T7');
      await cdp.evalJs('(function(){ window.setEdgeMaskSync(true); })()');
      await sleep(300);
      const after = await mcard('T7');
      ok('B8 组模式：勾选节隐藏 + setEdgeMaskSync 无操作（成员旗不写）',
        sec.show === false && before && before.mask === '' && after && after.mask === '',
        JSON.stringify({ sec: sec, before: before && before.mask, after: after && after.mask }));
    }

    // ═══ B9 AI 生成→保存→点击选中→画布出现（bug 修复实证）═══
    {
      await cdp.evalJs('(function(){ window.closeEdgeDrawer(); })()');
      await selectCard('T1');
      await cdp.evalJs("document.getElementById('fcEdgeCustomAddBtn').click()");
      await sleep(300);
      await cdp.evalJs("window.__genMode = 'edge'");
      await cdp.evalJs("document.getElementById('edgeGenDesc').value = 'AI 撕边测试'");
      await cdp.evalJs('(function(){ window.edgeGenRun(); })()');
      await waitFor(cdp, "getComputedStyle(document.getElementById('edgeGenResult')).display !== 'none'", 15000, 'B9 生成结果');
      await cdp.evalJs('(function(){ window.edgeGenSave(); })()');
      await sleep(400);
      const L = await lib();
      const t = await toast();
      const saved = L.find(x => x.name === 'AI撕边');
      await cdp.evalJs('(function(){ window.edgeMyApply(' + JSON.stringify(saved && saved.id) + '); })()');
      await sleep(400);
      const card = await mcard('T1');
      ok('B9 AI 生成流端到端：保存进库 + toast + 点击选中后画布出现（edgeMask=\'1\' + maskVar 原形 + clip 外扩）',
        L.length === 3 && saved && saved.kind === 'edge' && t && t.text === '已保存到我的自定义' &&
        card && card.edge === 'custom:' + saved.id && card.mask === '1' &&
        card.maskVar === EDGE_CLIP && card.clip === EXP_14,
        JSON.stringify({ n: L.length, t: t, card: card && { edge: card.edge, mask: card.mask, maskVar: card.maskVar, clip: card.clip } }));
    }

  } catch (e) {
    console.log('  💔 ' + e.message);
    fail++;
  }
  // ═══ E 零异常（无论 B 是否中断都跑）═══
  console.log('═══ E 零异常 ═══');
  const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
  const rawErrs = cdp ? cdp.errs : [];
  const errs = rawErrs.filter(e => !noise.test(e));
  ok('E 零异常（' + rawErrs.length + ' 原始 / ' + errs.length + ' 噪声后）', errs.length === 0, errs.slice(0, 5).join(' || '));
  try { cdp && cdp.close(); } catch (e) {}
  try { require('child_process').spawnSync('taskkill', ['/pid', String(chrome.pid), '/t', '/f'], { stdio: 'ignore' }); } catch (e) {}
  server.close();
  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(fail === 0 ? 0 : 1);
})();
