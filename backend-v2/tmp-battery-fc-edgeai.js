// tmp-battery-fc-edgeai.js — v10.28.51.0 边缘抽屉+AI 生成+本地库+边缘仓库电池（本地工作树）
//   S 静态：编辑器/后端（config/budget/server/fc-edgegen/fc-edges/031/health）/site-config/i18n/article 锚
//     （行计数口径=实测 grep -cF）；
//   B 编辑器 CDP：B0 就绪抽屉隐 / B1 右键入口无卡拒+有卡开 / B2 卡片背景弹层幽灵钮入口 / B3 15 样本+tech4 mini /
//     B4 边框节 7 线型+宽度+取色 / B5 AI 生成 edge 流（空输入拒+预览+保存+请求形状）/ B6 border 流（evenodd 环） /
//     B7 应用 border 自定义（bg 保留+clip+透明边框+无外板）/ B8 应用 edge 自定义（bg 清+无外板） / B9 无→清 /
//     B10 草稿往返（customEdges 只收被引用+reload 恢复）/ B11 在用拒删 / B12 组模式 custom 上组背景 /
//     B13 仓库应用（source:'repo'+author）/ B14 上传仓库选可见性（POST 体含 visibility+徽章） / B15 修改（PUT 体）/
//     B16 圆球好友/团队切换+scopes 三态 / B17 三降级 toast / B18 附图生成 / B19 Esc 链；
//   C 阅读页 CDP：C1 罐头文章 customEdges（edge 直写 clipPath/border 框环子层/缺 map 平卡）/ C2 无 map 平卡；
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
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-edgeai-' + Date.now());
const EDITOR_URL_PATH = '/pages/fluidcanvas-editor.html';
const ARTICLE_URL_PATH = '/pages/article.html';

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

// ── 罐头形状 ──
const RING = 'polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 8% 8%, 92% 8%, 92% 92%, 8% 92%, 8% 8%)';
const EDGE_CLIP = 'polygon(0% 0%, 100% 3%, 98% 97%, 3% 100%, 0% 0%)';
const REPO_ROWS = [
  { id: 'EDG-000001', name: '锯齿星', kind: 'edge', clip: EDGE_CLIP, visibility: 'public', createdAt: '2026-10-01T10:00:00.000Z', ownerId: 'USR-000042', authorName: 'Neo' },
  { id: 'EDG-000002', name: '团队框', kind: 'border', clip: RING, visibility: 'team', createdAt: '2026-10-01T11:00:00.000Z', ownerId: 'USR-000043', authorName: 'Nia' }
];
const REPO_ROW_FRIENDS = { id: 'EDG-000003', name: '友缘边', kind: 'edge', clip: EDGE_CLIP, visibility: 'friends', createdAt: '2026-10-01T12:00:00.000Z', ownerId: 'USR-000044', authorName: 'Fia' };

// ── 阅读页罐头（烤进 stub 串——window 变量跨页导航即清零，不能运行时塞）──
const CARD_BASE = { rotate: 0, borderRadius: 8, background: '', borderStyle: 'solid', borderColor: '', borderWidth: 2, z: 1 };
const FIX_ART1 = {
  v: 9, title: 'Edge Article', activePreset: '169', lastSaved: 1750000000000,
  presets: { '169': { cards: {} }, half: { cards: {} }, tablet: { cards: {} }, 'tablet-p': { cards: {} }, mobile: { cards: {} } },
  cards: [
    Object.assign({ id: 'e1', type: 'text', col: 2, row: 2, colSpan: 6, rowSpan: 4, x: 0, y: 0, w: 130, label: 'E1', content: 'edge card', cardEdge: 'custom:e1' }, CARD_BASE),
    Object.assign({ id: 'e2', type: 'text', col: 10, row: 2, colSpan: 6, rowSpan: 4, x: 176, y: 0, w: 130, label: 'E2', content: 'border card', cardEdge: 'custom:e2' }, CARD_BASE),
    Object.assign({ id: 'e3', type: 'text', col: 18, row: 2, colSpan: 6, rowSpan: 4, x: 352, y: 0, w: 130, label: 'E3', content: 'missing map', cardEdge: 'custom:e9' }, CARD_BASE)
  ],
  customEdges: [
    { id: 'e1', name: '撕边', kind: 'edge', clip: EDGE_CLIP },
    { id: 'e2', name: '框环', kind: 'border', clip: RING }
  ]
};
const FIX_ART2 = {
  v: 9, title: 'No Map Article', activePreset: '169', lastSaved: 1750000000000,
  presets: { '169': { cards: {} }, half: { cards: {} }, tablet: { cards: {} }, 'tablet-p': { cards: {} }, mobile: { cards: {} } },
  cards: [
    Object.assign({ id: 'e1', type: 'text', col: 2, row: 2, colSpan: 6, rowSpan: 4, x: 0, y: 0, w: 130, label: 'E1', content: 'no map', cardEdge: 'custom:e1' }, CARD_BASE)
  ]
};

// ── fetch 罐头：/fc/edges/scopes（__edgeScopes 可切）/ /fc/edge-gen（__genMode 可切）/ /fc/edges（GET/POST/PUT 记体）
//    /articles/ART-EDGE1|ART-EDGE2 罐头（ART1/ART2 烤进串内）──
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' window.__fcalls = []; window.__edgePosted = null; window.__edgePut = null; window.__edgeGetScope = null;' +
  ' var RING = ' + JSON.stringify(RING) + '; var EDGE_CLIP = ' + JSON.stringify(EDGE_CLIP) + ';' +
  ' var REPO_ROWS = ' + JSON.stringify(REPO_ROWS) + '; var REPO_F = ' + JSON.stringify(REPO_ROW_FRIENDS) + ';' +
  ' var ART1 = ' + JSON.stringify(FIX_ART1) + '; var ART2 = ' + JSON.stringify(FIX_ART2) + ';' +
  ' var stubResponse = function (body, status) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status || 200, headers: { "Content-Type": "application/json" } })); }, 0); }); };' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  var method = (opts && opts.method) || "GET";' +
  '  var bodyObj = null;' +
  '  try { if (opts && opts.body && typeof opts.body === "string") bodyObj = JSON.parse(opts.body); } catch (e) {}' +
  '  if (u.indexOf("/fc/edges/scopes") !== -1) {' +
  '   window.__fcalls.push({ m: method, url: u, body: bodyObj });' +
  '   var sc = window.__edgeScopes || { hasFriends: false, hasTeam: false };' +
  '   return stubResponse(JSON.stringify(sc));' +
  '  }' +
  '  if (u.indexOf("/fc/edge-gen") !== -1) {' +
  '   window.__fcalls.push({ m: method, url: u, body: bodyObj });' +
  '   var mode = window.__genMode || "edge";' +
  '   if (mode === "unavailable") return stubResponse(JSON.stringify({ unavailable: true }), 503);' +
  '   if (mode === "budget") return stubResponse(JSON.stringify({ budget_exhausted: true }), 200);' +
  '   if (mode === "failed") return stubResponse(JSON.stringify({ ok: false }), 200);' +
  '   if (mode === "ring") return stubResponse(JSON.stringify({ ok: true, edge: { name: "AI框环", clip: RING } }), 200);' +
  '   return stubResponse(JSON.stringify({ ok: true, edge: { name: "AI撕边", clip: EDGE_CLIP } }), 200);' +
  '  }' +
  '  if (u.indexOf("/fc/edges") !== -1) {' +
  '   window.__fcalls.push({ m: method, url: u, body: bodyObj });' +
  '   if (method === "POST") {' +
  '    window.__edgePosted = bodyObj;' +
  '    return stubResponse(JSON.stringify({ edge: { id: "EDG-000042", name: bodyObj && bodyObj.name, kind: bodyObj && bodyObj.kind, clip: bodyObj && bodyObj.clip, visibility: bodyObj && bodyObj.visibility, createdAt: "2026-10-04T00:00:00.000Z", ownerId: "USR-000101", authorName: "电池用户" } }), 200);' +
  '   }' +
  '   if (method === "PUT") {' +
  '    window.__edgePut = bodyObj;' +
  '    return stubResponse(JSON.stringify({ edge: { id: "EDG-000042", name: bodyObj && bodyObj.name, kind: "edge", clip: EDGE_CLIP, visibility: bodyObj && bodyObj.visibility, createdAt: "2026-10-04T00:00:00.000Z", ownerId: "USR-000101", authorName: "电池用户" } }), 200);' +
  '   }' +
  '   var scope = (u.match(/[?&]scope=([a-z]+)/) || [])[1] || "all";' +
  '   window.__edgeGetScope = scope;' +
  '   if (scope === "team") return stubResponse(JSON.stringify({ edges: [REPO_ROWS[1]] }), 200);' +
  '   if (scope === "friends") return stubResponse(JSON.stringify({ edges: [REPO_F] }), 200);' +
  '   if (scope === "mine") return stubResponse(JSON.stringify({ edges: [] }), 200);' +
  '   return stubResponse(JSON.stringify({ edges: REPO_ROWS }), 200);' +
  '  }' +
  '  if (u.indexOf("/articles/") !== -1) {' +
  '   var id = decodeURIComponent(u.split("/articles/")[1].split("?")[0].split("#")[0]);' +
  '   var fj = (id === "ART-EDGE1") ? ART1 : (id === "ART-EDGE2") ? ART2 : null;' +
  '   if (fj) return stubResponse(JSON.stringify({ article: { id: id, title: fj.title, status: "published", authorId: "USR-000042", authorName: "Neo", createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z", viewCount: 7, likeCount: 2, likedByMe: false, favoritedByMe: false, contentJson: fj } }), 200);' +
  '   return stubResponse(JSON.stringify({ error: "NOT_FOUND" }), 404);' +
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

// ── 状态读取 ──
const READY = "document.getElementById('undoBtn') && document.getElementById('gridCanvas') && window.openEdgeDrawer && window.openCardBgPopover && window.setCardEdge && window.openEdgeGenModal && window.createAssetCard";
const DRAWER_EXPR = "(function(){ var d = document.getElementById('fcEdgeDrawer');" +
  " var ball = document.getElementById('fcEdgeScopeBall');" +
  " var lbl = document.getElementById('fcEdgeScopeLabel');" +
  " return { open: d.classList.contains('open'), aria: d.getAttribute('aria-hidden')," +
  "  tabAll: document.getElementById('fcEdgeTabAll').classList.contains('active')," +
  "  tabMy: document.getElementById('fcEdgeTabMy').classList.contains('active')," +
  "  paneAll: getComputedStyle(document.getElementById('fcEdgePaneAll')).display," +
  "  paneMy: getComputedStyle(document.getElementById('fcEdgePaneMy')).display," +
  "  ballShow: ball.classList.contains('show'), ballPressed: ball.getAttribute('aria-pressed')," +
  "  ballIcon: ball.querySelector('.material-symbols-outlined').textContent," +
  "  label: lbl ? lbl.textContent : null," +
  "  samples: document.getElementById('fcEdgeSamplesGrid').children.length," +
  "  repo: document.getElementById('fcEdgeRepoGrid').children.length," +
  "  my: document.getElementById('fcEdgeMyGrid').children.length," +
  "  border: document.getElementById('borderStyleOptions').children.length," +
  "  bw: document.getElementById('borderWidthSlider').value," +
  "  bwv: document.getElementById('borderWidthVal').textContent," +
  "  bp: document.getElementById('borderColorPicker').value }; })()";
const CARD_EXPR = (label) => "(function(){ var c = document.querySelector('#gridCanvas .grid-card[data-label=\"" + label + "\"]');" +
  " if (!c) return null;" +
  " var cs = getComputedStyle(c);" +
  " return { edge: c.dataset.cardEdge || '', cls: c.classList.contains('card-edge-custom')," +
  "  clip: cs.getPropertyValue('--card-clip').trim(), bg: c.style.background, bgImg: c.style.backgroundImage," +
  "  bc: cs.borderColor, bs: c.style.borderStyle, oe: c.dataset.outerEdge || '', tint: !!c.querySelector('.card-tint') }; })()";
const TOAST_EXPR = "(function(){ var t = document.getElementById('toast');" +
  " return t ? { text: t.textContent, show: t.classList.contains('show') } : null; })()";
const LIB_EXPR = "(function(){ try { return JSON.parse(localStorage.getItem('slati_custom_edges') || '[]'); } catch (e) { return []; } })()";
const GEN_CALLS_EXPR = "(function(){ return (window.__fcalls || []).filter(function (c) { return c.url.indexOf('/fc/edge-gen') !== -1; }); })()";
const POSTED_EXPR = "(function(){ return window.__edgePosted; })()";
const PUT_EXPR = "(function(){ return window.__edgePut; })()";
const GETSCOPE_EXPR = "(function(){ return window.__edgeGetScope; })()";

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
  const ED_ANCHORS = [['id="fcEdgeDrawer"', 1], ['id="fcEdgeScopeBall"', 1], ['id="fcEdgeCustomAddBtn"', 1],
    ['id="fcEdgeRepoModal"', 1], ['id="fcEdgeGenModal"', 1],
    ['function openEdgeDrawer', 1], ['function closeEdgeDrawer', 1], ['function renderEdgeSamples', 1],
    ['function customEdgeAdd', 1], ['function customEdgeRecipe', 1], ['function edgeGenRun', 1],
    ['function edgeGenSave', 1], ['function edgeGenAttachImage', 1], ['function edgeRepoUpload', 1],
    ['function edgeRepoApply', 1], ['function edgeRepoOpen', 1], ['function edgeDrawerSetTab', 1],
    ['function edgeDrawerToggleScope', 1], ['function renderEdgeMy', 1], ['function renderEdgeRepo', 1],
    ['function updateEdgeScopeBall', 1], ['function loadEdgeScopes', 1], ['function sanitizeClipEdge', 1],
    ['function openBorderStyleModal', 1],
    ['CUSTOM_EDGE_KEY', 3], ['card-edge-custom', 8], ['customEdges', 7], ['slati_custom_edges', 1],
    ['fc-edge-drawer', 3], ['fc-edge-ball', 4], ['fc-edge-mini', 7],
    ['window.openEdgeDrawer', 1], ["openEdgeDrawer('border')", 1], ['art-card-custom-frame', 0]];
  const edBad = ED_ANCHORS.filter(([a, n]) => c(a) !== n);
  ok('S1 编辑器 34 锚全中（抽屉/圆球/样本/AI/仓库/本地库/草稿链）', edBad.length === 0,
    edBad.map(([a, n]) => a + '=' + c(a) + '≠' + n).join(',') || '34/34');

  const BF = (p) => fs.readFileSync(path.join(ROOT, 'backend-v2', p), 'utf8');
  const blines = (src) => norm(src).split('\n');
  const bc = (src) => (a) => blines(src).filter((l) => l.includes(a)).length;
  const cfg = BF('src/config.js'), bud = BF('src/moderation/budget.js'), srv = BF('src/server.js');
  const gen = BF('src/routes/public/fc-edgegen.js'), edges = BF('src/routes/public/fc-edges.js');
  const mig = BF('migrations/031_fc_edges.sql'), health = BF('test/health.test.js');
  const B_ANCHORS = [
    ['config GEMINI_API_KEY', bc(cfg)('GEMINI_API_KEY'), 1],
    ['config GEMINI_BASE_URL', bc(cfg)('GEMINI_BASE_URL'), 1],
    ['config BUDGET_EDGEGEN', bc(cfg)('BUDGET_EDGEGEN'), 1],
    ['budget edgeGen ×2（FEATURES+PROVIDER_OF）', bc(bud)('edgeGen'), 2],
    ['budget gemini ×1', bc(bud)('gemini'), 1],
    ['server registerEdgeGen ×2', bc(srv)('registerEdgeGen'), 2],
    ['server registerFcEdges ×2', bc(srv)('registerFcEdges'), 2],
    ['fc-edgegen sanitizeClip ×6', bc(gen)('sanitizeClip'), 6],
    ['fc-edgegen SYSTEM_EDGE_GEN ×3', bc(gen)('SYSTEM_EDGE_GEN'), 3],
    ['fc-edgegen generateContent ×1', bc(gen)('generateContent'), 1],
    ['fc-edgegen MODEL_DEFAULT ×3', bc(gen)('MODEL_DEFAULT'), 3],
    ['fc-edgegen budget_exhausted ×2', bc(gen)('budget_exhausted'), 2],
    ['fc-edgegen unavailable ×3', bc(gen)('unavailable'), 3],
    ['fc-edges VISIBILITIES ×3', bc(edges)('VISIBILITIES'), 3],
    ['fc-edges optionalViewer ×6', bc(edges)('optionalViewer'), 6],
    ['031 fc_edges ×4', bc(mig)('fc_edges'), 4],
    ['health 66 张表 ×2', bc(health)('66'), 2]
  ];
  const bBad = B_ANCHORS.filter(([, got, want]) => got !== want);
  ok('S2 后端 17 锚全中（Gemini 配置/预算/注册/端点/031/health 66）', bBad.length === 0,
    bBad.map(([n, got, want]) => n + '=' + got + '≠' + want).join(',') || '17/17');

  const scSrc = norm(await (await fetch(BASE + '/assets/js/site-config.js')).text());
  const sc = mk(scSrc);
  ok('S3 site-config：50.0 在位 + 49.2 赋值零残留 + changelog 头各 ×1 + rev 终态各 ×1 + 站点恒 58.26',
    sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.0';") === 1 && sc("window.FLUIDCANVAS_VERSION = 'v10.28.50.0';") === 0 &&
    sc('// v10.28.51.1 = ') === 1 && sc('// v10.28.50.0 = ') === 1 &&
    sc('rev 00356-djq') === 1 && sc('rev 00357-sh8') === 1 &&
    sc("window.MN_SITE_VERSION = 'v0.2.58.27';") === 1 && sc("window.MN_SITE_VERSION = 'v0.2.58.25';") === 0,
    'fc50=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.0';") + ' fc49=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.50.0';") +
    ' cl50=' + sc('// v10.28.51.1 = ') + ' r56=' + sc('rev 00356-djq') + ' q57=' + sc('rev 00357-sh8') +
    ' v26=' + sc("window.MN_SITE_VERSION = 'v0.2.58.27';"));

  const i18nSrc = norm(await (await fetch(BASE + '/assets/i18n/fluidcanvas.i18n.js')).text());
  const ic = mk(i18nSrc);
  ok('S4 i18n：6 样键 ×12（drawerTitle/genBtn/repoEmpty/tabAll/genUnavailable/visFriends）',
    ic('"fc.edge.drawerTitle"') === 12 && ic('"fc.edge.genBtn"') === 12 && ic('"fc.edge.repoEmpty"') === 12 &&
    ic('"fc.edge.tabAll"') === 12 && ic('"fc.edge.genUnavailable"') === 12 && ic('"fc.imgMeta.visFriends"') === 12,
    'dt=' + ic('"fc.edge.drawerTitle"') + ' gb=' + ic('"fc.edge.genBtn"') + ' re=' + ic('"fc.edge.repoEmpty"') +
    ' ta=' + ic('"fc.edge.tabAll"') + ' gu=' + ic('"fc.edge.genUnavailable"') + ' vf=' + ic('"fc.imgMeta.visFriends"'));

  const ar = norm(await (await fetch(BASE + ARTICLE_URL_PATH)).text());
  const arLines = ar.split('\n');
  const ac = (a) => arLines.filter((l) => l.includes(a)).length;
  const AR_BAD = [['art-card-custom-frame', 2], ['sanitizeClipEd', 2], ['customEdges', 2]]
    .filter(([a, n]) => ac(a) !== n);
  ok('S5 阅读页 3 锚全中（框环子层/sanitizeClipEd/customEdges 消费）', AR_BAD.length === 0,
    AR_BAD.map(([a, n]) => a + '=' + ac(a) + '≠' + n).join(',') || '3/3');

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
    const clearLib = () => cdp.evalJs("try{localStorage.removeItem('slati_custom_edges');}catch(e){}");
    const drawer = () => cdp.evalJs(DRAWER_EXPR);
    const toast = async () => { await sleep(150); return cdp.evalJs(TOAST_EXPR); };
    const lib = () => cdp.evalJs(LIB_EXPR);
    const myItem = (name) => cdp.evalJs("(function(){ var items = document.querySelectorAll('#fcEdgeMyGrid .fc-edge-item');" +
      " for (var i = 0; i < items.length; i++) { var n = items[i].querySelector('.fc-edge-item-name');" +
      "  if (n && n.textContent === " + JSON.stringify(name) + ") return i; } return -1; })()");
    const myItemBtn = (name, btnIdx) => cdp.evalJs("(function(){ var items = document.querySelectorAll('#fcEdgeMyGrid .fc-edge-item');" +
      " for (var i = 0; i < items.length; i++) { var n = items[i].querySelector('.fc-edge-item-name');" +
      "  if (n && n.textContent === " + JSON.stringify(name) + ") {" +
      "   var b = items[i].querySelectorAll('.fc-edge-item-btn')[" + btnIdx + "]; if (b) { b.click(); return true; } } } return false; })()");
    const genModal = () => cdp.evalJs("(function(){ var m = document.getElementById('fcEdgeGenModal');" +
      " return m ? !!m.querySelector('.modal-card.active') : false; })()");
    const repoModal = () => cdp.evalJs("(function(){ var m = document.getElementById('fcEdgeRepoModal');" +
      " return m ? !!m.querySelector('.modal-card.active') : false; })()");
    const esc = async () => {
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
      await sleep(250);
    };

    // ═══ B0 就绪 ═══
    console.log('═══ B 编辑器 CDP ═══');
    {
      const d = await drawer();
      ok('B0 就绪：抽屉存在且隐藏（无 .open + aria-hidden true）+ 全部 tab 激活',
        d.open === false && d.aria === 'true' && d.tabAll === true && d.tabMy === false && d.samples === 0, JSON.stringify(d));
    }

    // ═══ B1 右键入口（无卡拒 + 有卡开）═══
    {
      await cdp.evalJs('(function(){ window.openBorderStyleModal(); })()');
      let t = await toast();
      let d = await drawer();
      ok('B1a 无卡右键入口：toast 请先选中一张卡片 + 抽屉不开',
        t && t.text === '请先选中一张卡片' && t.show && d.open === false, JSON.stringify({ t: t, d: d }));
      await createCard('text', 'T1', 2, 2, 6, 4);
      await sleep(400);
      await selectCard('T1');
      await cdp.evalJs('(function(){ window.openBorderStyleModal(); })()');
      await sleep(400);
      d = await drawer();
      ok('B1b 有卡右键入口：抽屉 .open + aria-hidden false + 边框节 7 项 + 宽度 2/2px + 取色 #c8c8d0',
        d.open === true && d.aria === 'false' && d.border === 7 && d.bw === '2' && d.bwv === '2px' && d.bp === '#c8c8d0',
        JSON.stringify(d));
      await cdp.evalJs('(function(){ window.closeEdgeDrawer(); })()');
      await sleep(250);
    }

    // ═══ B2 卡片背景弹层幽灵钮入口 ═══
    {
      await cdp.evalJs('(function(){ window.openCardBgPopover(); })()');
      await sleep(300);
      const popActive = await cdp.evalJs("document.getElementById('cardBgPopover').classList.contains('active')");
      const clicked = await cdp.evalJs("(function(){ var b = document.querySelector('#cardBgPopover button[onclick*=\"openEdgeDrawer\"]');" +
        " if (!b) return false; b.click(); return true; })()");
      await sleep(400);
      const d = await drawer();
      const popAfter = await cdp.evalJs("document.getElementById('cardBgPopover').classList.contains('active')");
      ok('B2 弹层幽灵钮：popover 开→点「自定义添加」→抽屉开 + popover 关 + 全部 tab 激活',
        popActive === true && clicked === true && d.open === true && popAfter === false && d.tabAll === true,
        JSON.stringify({ popActive: popActive, clicked: clicked, d: d, popAfter: popAfter }));
    }

    // ═══ B3 样本 15 + tech4 mini ═══
    {
      const d = await drawer();
      const tech4 = await cdp.evalJs("(function(){ var bs = document.querySelectorAll('#fcEdgeSamplesGrid button');" +
        " for (var i = 0; i < bs.length; i++) { if ((bs[i].getAttribute('onclick') || '').indexOf('tech4') !== -1) {" +
        "  var m = bs[i].querySelector('.fc-edge-mini'); return m ? m.style.getPropertyValue('--mini-clip') : null; } } return null; })()");
      const firstOnc = await cdp.evalJs("(function(){ var b = document.querySelector('#fcEdgeSamplesGrid button');" +
        " return b ? b.getAttribute('onclick') : null; })()");
      ok('B3 样本：15 内置 + tech4 mini=url(#hud-frame-4) + 首样本=无（setCardEdge(\'\')）',
        d.samples === 15 && tech4 === 'url(#hud-frame-4)' && (firstOnc || '').indexOf("setCardEdge('')") !== -1,
        JSON.stringify({ samples: d.samples, tech4: tech4, firstOnc: firstOnc }));
    }

    // ═══ B4 边框节线型 ═══
    {
      const clicked = await cdp.evalJs("(function(){ var bs = document.querySelectorAll('#borderStyleOptions button');" +
        " for (var i = 0; i < bs.length; i++) { if (bs[i].textContent.indexOf('Dashed') !== -1) { bs[i].click(); return true; } } return false; })()");
      await sleep(300);
      const card = await cdp.evalJs(CARD_EXPR('T1'));
      ok('B4 边框节点 Dashed：卡 inline borderStyle=dashed', clicked === true && card && card.bs === 'dashed',
        JSON.stringify(card));
    }

    // ═══ B5 AI 生成 edge 流 ═══
    {
      await clearLib();
      await cdp.evalJs("document.getElementById('fcEdgeCustomAddBtn').click()");
      await sleep(400);
      let gm = await genModal();
      const kindEdgeActive = await cdp.evalJs("document.getElementById('edgeGenKindEdge').classList.contains('active')");
      await cdp.evalJs('(function(){ window.edgeGenRun(); })()');
      let t = await toast();
      let gcs = await cdp.evalJs(GEN_CALLS_EXPR);
      let resShown = await cdp.evalJs("getComputedStyle(document.getElementById('edgeGenResult')).display !== 'none'");
      ok('B5a 生成弹窗开+空输入拒：toast 请输入描述或附上图片 + 零请求 + 结果隐',
        gm === true && kindEdgeActive === true && t && t.text === '请输入描述或附上图片' && t.show &&
        gcs.length === 0 && resShown === false, JSON.stringify({ gm: gm, t: t, calls: gcs.length, resShown: resShown }));
      await cdp.evalJs("window.__genMode = 'edge'");
      await cdp.evalJs("document.getElementById('edgeGenDesc').value = '四周撕纸般的锯齿边缘'");
      await cdp.evalJs('(function(){ window.edgeGenRun(); })()');
      await waitFor(cdp, "getComputedStyle(document.getElementById('edgeGenResult')).display !== 'none'", 15000, 'B5 生成结果');
      const prev = await cdp.evalJs("(function(){ return { name: document.getElementById('edgeGenPreviewName').textContent," +
        " clip: document.getElementById('edgeGenPreviewClip').value," +
        " mini: document.getElementById('edgeGenPreviewMini').style.getPropertyValue('--mini-clip') }; })()");
      gcs = await cdp.evalJs(GEN_CALLS_EXPR);
      ok('B5b 罐头 edge 流：预览名 AI撕边 + clip 等值 + mini 同剪影 + 请求形状 {kind:edge,desc,无 image}',
        prev.name === 'AI撕边' && prev.clip === EDGE_CLIP && prev.mini === EDGE_CLIP &&
        gcs.length === 1 && gcs[0].body && gcs[0].body.kind === 'edge' && gcs[0].body.desc === '四周撕纸般的锯齿边缘' &&
        !('image' in (gcs[0].body || {})), JSON.stringify({ prev: prev, body: gcs.length ? gcs[0].body : null }));
      await cdp.evalJs('(function(){ window.edgeGenSave(); })()');
      await sleep(400);
      gm = await genModal();
      t = await toast();
      let L = await lib();
      let d = await drawer();
      const emptyState = await cdp.evalJs("!!document.querySelector('#fcEdgeMyGrid .fc-edge-empty')");
      ok('B5c 保存：弹窗关 + toast 已保存到我的自定义 + My 1 条 + 库 1 条（source ai/repoId null）',
        gm === false && t && t.text === '已保存到我的自定义' && L.length === 1 &&
        L[0].name === 'AI撕边' && L[0].kind === 'edge' && L[0].source === 'ai' && L[0].repoId === null &&
        d.my === 1 && emptyState === false, JSON.stringify({ gm: gm, t: t, L: L }));
    }

    // ═══ B6 AI 生成 border 流（evenodd 环）═══
    {
      await cdp.evalJs("document.getElementById('fcEdgeCustomAddBtn').click()");
      await sleep(300);
      await cdp.evalJs("document.getElementById('edgeGenKindBorder').click()");
      await cdp.evalJs("window.__genMode = 'ring'");
      await cdp.evalJs("document.getElementById('edgeGenDesc').value = '双环边框'");
      await cdp.evalJs('(function(){ window.edgeGenRun(); })()');
      await waitFor(cdp, "getComputedStyle(document.getElementById('edgeGenResult')).display !== 'none'", 15000, 'B6 生成结果');
      const prev = await cdp.evalJs("(function(){ return { name: document.getElementById('edgeGenPreviewName').textContent," +
        " clip: document.getElementById('edgeGenPreviewClip').value }; })()");
      const body = await cdp.evalJs("(function(){ var g = (window.__fcalls || []).filter(function (c) { return c.url.indexOf('/fc/edge-gen') !== -1; });" +
        " return g.length ? g[g.length - 1].body : null; })()");
      await cdp.evalJs('(function(){ window.edgeGenSave(); })()');
      await sleep(400);
      let L = await lib();
      let d = await drawer();
      const sub = await cdp.evalJs("(function(){ var it = document.querySelector('#fcEdgeMyGrid .fc-edge-item');" +
        " return it ? it.querySelector('.fc-edge-item-sub').textContent : null; })()");
      ok('B6 border 罐头流：预览 RING + kind border + My 2 条 + 首条 sub 含边框',
        prev.name === 'AI框环' && prev.clip === RING && body && body.kind === 'border' && body.desc === '双环边框' &&
        L.length === 2 && d.my === 2 && (sub || '').indexOf('边框') !== -1, JSON.stringify({ prev: prev, body: body, sub: sub }));
    }

    // ═══ B7 应用 border 自定义 ═══
    {
      await cdp.evalJs('(function(){ window.setCardBgColor("#336699"); })()');
      await sleep(300);
      let L = await lib();
      const ringId = L[0].id; // 库序=新在前 → [0]=AI框环
      await cdp.evalJs('(function(){ window.edgeMyApply(' + JSON.stringify(ringId) + '); })()');
      await sleep(400);
      const card = await cdp.evalJs(CARD_EXPR('T1'));
      ok('B7 应用 border 自定义：cardEdge custom:id + 类 + --card-clip RING + 背景保留 rgb + 边框透明 + 无外板',
        card && card.edge === 'custom:' + ringId && card.cls === true && card.clip === RING &&
        card.bg.indexOf('rgb(51, 102, 153') !== -1 && card.bc === 'rgba(0, 0, 0, 0)' && card.oe === '',
        JSON.stringify(card));
    }

    // ═══ B8 应用 edge 自定义 ═══
    {
      let L = await lib();
      const edgeId = L[1].id; // [1]=AI撕边
      await cdp.evalJs('(function(){ window.edgeMyApply(' + JSON.stringify(edgeId) + '); })()');
      await sleep(400);
      const card = await cdp.evalJs(CARD_EXPR('T1'));
      ok('B8 应用 edge 自定义：--card-clip EDGE_CLIP + 背景清空 + 无外板 + 类在',
        card && card.edge === 'custom:' + edgeId && card.cls === true && card.clip === EDGE_CLIP &&
        card.bg === '' && card.bgImg === 'none' && card.oe === '', JSON.stringify(card));
    }

    // ═══ B9 无→清 ═══
    {
      const clicked = await cdp.evalJs("(function(){ var b = document.querySelector('#fcEdgeSamplesGrid button');" +
        " if (b) { b.click(); return true; } return false; })()");
      await sleep(400);
      const card = await cdp.evalJs(CARD_EXPR('T1'));
      ok('B9 样本「无」：dataset 清 + 类撤 + --card-clip 撤 + 背景回 rgb',
        clicked === true && card && card.edge === '' && card.cls === false &&
        (card.clip === '' || card.clip === 'none') && card.bg.indexOf('rgb(51, 102, 153') !== -1,
        JSON.stringify(card));
    }

    // ═══ B10 草稿往返 ═══
    {
      let L = await lib();
      const ringId = L[0].id;
      await cdp.evalJs('(function(){ window.edgeMyApply(' + JSON.stringify(ringId) + '); })()');
      await sleep(400);
      await cdp.evalJs('(function(){ window.saveDraft(); })()');
      await sleep(400);
      const draft = await cdp.evalJs("JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}')");
      const t1 = (draft.cards || []).find(x => x.label === 'T1');
      ok('B10a 草稿：customEdges 只收被引用（1 条=AI框环）+ 卡 cardEdge custom:id',
        Array.isArray(draft.customEdges) && draft.customEdges.length === 1 &&
        draft.customEdges[0].id === ringId && draft.customEdges[0].clip === RING && draft.customEdges[0].kind === 'border' &&
        t1 && t1.cardEdge === 'custom:' + ringId, JSON.stringify({ ce: draft.customEdges, t1: t1 && t1.cardEdge }));
      await setWinName('__FCSEED__' + JSON.stringify(draft));
      await nav(BASE + EDITOR_URL_PATH + '?prem', "document.querySelectorAll('#gridCanvas .grid-card').length === 1", 'B10 nav');
      await sleep(700);
      const card = await cdp.evalJs(CARD_EXPR('T1'));
      let L2 = await lib();
      ok('B10b reload 往返：卡仍 custom 类+clip RING + 库并回该条',
        card && card.edge === 'custom:' + ringId && card.cls === true && card.clip === RING &&
        L2.some(x => x.id === ringId), JSON.stringify({ card: card, ids: L2.map(x => x.id) }));
    }

    // ═══ B11 在用拒删 ═══
    {
      let L = await lib();
      const ringId = L[0].id;
      await cdp.evalJs('(function(){ window.openEdgeDrawer("edge"); })()');
      await sleep(400);
      const idx = await myItem('AI框环');
      const clickedDel = await myItemBtn('AI框环', 1);
      await sleep(250);
      const t = await toast();
      const L2 = await lib();
      ok('B11 在用拒删：toast 该边缘正在使用中 + 库仍 2 条',
        idx !== -1 && clickedDel === true && t && t.text === '该边缘正在使用中，先移除卡片上的应用再删除' && L2.length === 2,
        JSON.stringify({ idx: idx, t: t, n: L2.length }));
    }

    // ═══ B12 组模式 custom 上组背景 ═══
    {
      await createCard('text', 'T2', 12, 2, 6, 4);
      await createCard('text', 'T3', 18, 2, 6, 4);
      await sleep(400);
      await cdp.evalJs("(function(){ var a = document.querySelector('#gridCanvas .grid-card[data-label=\"T2\"]');" +
        " var b = document.querySelector('#gridCanvas .grid-card[data-label=\"T3\"]');" +
        " window.mergeCards(b, a, 'right'); return true; })()");
      await sleep(700);
      // 组模式：single=false 才置 selectedGroupId（selectCard 11176: !single && groupId）
      await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card[data-label=\"T2\"]');" +
        " window.selectCard(c, false); return !!c; })()");
      await sleep(250);
      let L = await lib();
      const ringId = L[0].id;
      await cdp.evalJs('(function(){ window.setCardEdge(' + JSON.stringify('custom:' + ringId) + '); })()');
      await sleep(500);
      const gb = await cdp.evalJs("(function(){ var bg = document.querySelector('#gridCanvas .grid-group-bg');" +
        " if (!bg) return null; var cs = getComputedStyle(bg);" +
        " return { edge: bg.dataset.cardEdge || '', clip: cs.getPropertyValue('--card-clip').trim(), cls: bg.classList.contains('card-edge-custom') }; })()");
      const t2 = await cdp.evalJs(CARD_EXPR('T2'));
      ok('B12 组模式：组背景 dataset custom:id + clip RING + 成员卡零改动',
        gb && gb.edge === 'custom:' + ringId && gb.clip === RING && gb.cls === true &&
        t2 && t2.edge === '', JSON.stringify({ gb: gb, t2: t2 && t2.edge }));
    }

    // ═══ B13 仓库应用 ═══
    {
      await cdp.evalJs("window.__edgeScopes = { hasFriends: false, hasTeam: false }");
      await createCard('text', 'T4', 2, 12, 6, 4);
      await sleep(400);
      await selectCard('T4');
      await cdp.evalJs('(function(){ window.openEdgeDrawer("edge"); })()');
      await sleep(600);
      const d = await drawer();
      const row0 = await cdp.evalJs("(function(){ var rows = document.querySelectorAll('#fcEdgeRepoGrid .fc-edge-item');" +
        " if (!rows.length) return null; var r = rows[0];" +
        " var m = r.querySelector('.fc-edge-mini');" +
        " return { name: r.querySelector('.fc-edge-item-name').textContent," +
        "  author: r.querySelector('.fc-edge-item-sub').textContent," +
        "  mini: m ? m.style.getPropertyValue('--mini-clip') : null }; })()");
      const clicked = await cdp.evalJs("(function(){ var r = document.querySelector('#fcEdgeRepoGrid .fc-edge-item');" +
        " if (!r) return false; r.click(); return true; })()");
      await sleep(400);
      const t = await toast();
      const card = await cdp.evalJs(CARD_EXPR('T4'));
      const L = await lib();
      ok('B13 仓库应用：全部 tab 2 行 + 首行名称/作者/剪影 + 点击→库 source repo + author Neo + 卡 clip EDGE_CLIP + toast',
        d.repo === 2 && row0 && row0.name === '锯齿星' && row0.author.indexOf('Neo') !== -1 && row0.mini === EDGE_CLIP &&
        clicked === true && t && t.text === '已添加并应用' &&
        L.length >= 1 && L[0].source === 'repo' && L[0].author === 'Neo' && L[0].name === '锯齿星' &&
        card && card.edge.indexOf('custom:') === 0 && card.clip === EDGE_CLIP,
        JSON.stringify({ d: d.repo, row0: row0, t: t, L0: L[0] }));
    }

    // ═══ B14 上传仓库选可见性 ═══
    {
      await cdp.evalJs("document.getElementById('fcEdgeTabMy').click()");
      await sleep(300);
      const idx = await myItem('AI撕边');
      const clickedUp = await myItemBtn('AI撕边', 0);
      await sleep(400);
      const rmOpen = await repoModal();
      const mInfo = await cdp.evalJs("(function(){ return { mini: document.getElementById('fcEdgeRepoMini').style.getPropertyValue('--mini-clip')," +
        " name: document.getElementById('fcEdgeRepoName').value," +
        " pubActive: document.querySelector('#fcEdgeRepoSeg .segmented-option[data-vis=\"public\"]').classList.contains('active')," +
        " submit: document.getElementById('fcEdgeRepoSubmit').textContent }; })()");
      await cdp.evalJs("document.querySelector('#fcEdgeRepoSeg .segmented-option[data-vis=\"friends\"]').click()");
      await cdp.evalJs("document.getElementById('fcEdgeRepoSubmit').click()");
      await sleep(500);
      const posted = await cdp.evalJs(POSTED_EXPR);
      const rmClosed = await repoModal();
      const t = await toast();
      const L = await lib();
      const saved = L.find(x => x.name === 'AI撕边');
      const badge = await cdp.evalJs("(function(){ var items = document.querySelectorAll('#fcEdgeMyGrid .fc-edge-item');" +
        " for (var i = 0; i < items.length; i++) { var n = items[i].querySelector('.fc-edge-item-name');" +
        "  if (n && n.textContent === 'AI撕边') { var b = items[i].querySelector('.fc-edge-badge');" +
        "   return b ? { vis: b.getAttribute('data-vis'), text: b.textContent } : null; } } return null; })()");
      ok('B14 上传仓库：弹窗（mini+名称+公开默认）+ 选好友 → POST 体含 visibility friends + 关窗 + toast 已上传仓库 + 本地 repoId/徽章',
        idx !== -1 && clickedUp === true && rmOpen === true && mInfo.mini === EDGE_CLIP && mInfo.name === 'AI撕边' &&
        mInfo.pubActive === true && posted && posted.name === 'AI撕边' && posted.kind === 'edge' &&
        posted.clip === EDGE_CLIP && posted.visibility === 'friends' &&
        rmClosed === false && t && t.text === '已上传仓库' &&
        saved && saved.repoId === 'EDG-000042' && saved.visibility === 'friends' &&
        badge && badge.vis === 'friends' && badge.text === '好友',
        JSON.stringify({ idx: idx, clickedUp: clickedUp, rmOpen: rmOpen, rmClosed: rmClosed, saved: saved && { repoId: saved.repoId, vis: saved.visibility }, mInfo: mInfo, posted: posted, t: t, badge: badge }));
    }

    // ═══ B15 修改（PUT）═══
    {
      const clickedEdit = await myItemBtn('AI撕边', 0);
      await sleep(400);
      const rmOpen = await repoModal();
      const submit = await cdp.evalJs("document.getElementById('fcEdgeRepoSubmit').textContent");
      await cdp.evalJs("document.querySelector('#fcEdgeRepoSeg .segmented-option[data-vis=\"private\"]').click()");
      await cdp.evalJs("document.getElementById('fcEdgeRepoSubmit').click()");
      await sleep(500);
      const put = await cdp.evalJs(PUT_EXPR);
      const rmClosed = await repoModal();
      const L = await lib();
      const saved = L.find(x => x.name === 'AI撕边');
      const badge = await cdp.evalJs("(function(){ var items = document.querySelectorAll('#fcEdgeMyGrid .fc-edge-item');" +
        " for (var i = 0; i < items.length; i++) { var n = items[i].querySelector('.fc-edge-item-name');" +
        "  if (n && n.textContent === 'AI撕边') { var b = items[i].querySelector('.fc-edge-badge');" +
        "   return b ? b.getAttribute('data-vis') : null; } } return null; })()");
      ok('B15 修改已上传：按钮文本 保存修改 + PUT 体 {name,visibility} 无 kind/clip + 徽章→私密',
        clickedEdit === true && rmOpen === true && submit === '保存修改' &&
        put && put.name === 'AI撕边' && put.visibility === 'private' &&
        !('kind' in put) && !('clip' in put) && rmClosed === false &&
        saved && saved.visibility === 'private' && badge === 'private',
        JSON.stringify({ clickedEdit: clickedEdit, rmOpen: rmOpen, rmClosed: rmClosed, saved: saved && saved.visibility, submit: submit, put: put, badge: badge }));
    }

    // ═══ B16 圆球好友/团队切换 + scopes 三态 ═══
    {
      await cdp.evalJs("window.__edgeScopes = { hasFriends: true, hasTeam: true }");
      await cdp.evalJs('(function(){ window.closeEdgeDrawer(); window.openEdgeDrawer("edge"); })()');
      await sleep(700);
      let d = await drawer();
      let scope = await cdp.evalJs(GETSCOPE_EXPR);
      const fRow = await cdp.evalJs("(function(){ var r = document.querySelector('#fcEdgeRepoGrid .fc-edge-item');" +
        " return r ? r.querySelector('.fc-edge-item-name').textContent : null; })()");
      ok('B16a 双真：圆球滑出 + 默认好友侧 + label 好友 + scope friends + 仓库首行 友缘边',
        d.ballShow === true && d.ballPressed === 'true' && d.ballIcon === 'group' && d.label === '好友' &&
        scope === 'friends' && fRow === '友缘边', JSON.stringify({ d: d, scope: scope, fRow: fRow }));
      await cdp.evalJs('(function(){ window.edgeDrawerToggleScope(); })()');
      await sleep(600);
      d = await drawer();
      scope = await cdp.evalJs(GETSCOPE_EXPR);
      const tRow = await cdp.evalJs("(function(){ var r = document.querySelector('#fcEdgeRepoGrid .fc-edge-item');" +
        " return r ? r.querySelector('.fc-edge-item-name').textContent : null; })()");
      ok('B16b 点圆球：切团队侧 + 图标 workspaces + label 团队 + scope team + 首行 团队框',
        d.ballIcon === 'workspaces' && d.label === '团队' && scope === 'team' && tRow === '团队框',
        JSON.stringify({ icon: d.ballIcon, label: d.label, scope: scope, tRow: tRow }));
      await cdp.evalJs("window.__edgeScopes = { hasFriends: true, hasTeam: false }");
      await cdp.evalJs('(function(){ window.closeEdgeDrawer(); window.openEdgeDrawer("edge"); })()');
      await sleep(700);
      d = await drawer();
      scope = await cdp.evalJs(GETSCOPE_EXPR);
      ok('B16c 只有好友：圆球隐 + label 好友 + scope friends',
        d.ballShow === false && d.label === '好友' && scope === 'friends', JSON.stringify({ d: d, scope: scope }));
      await cdp.evalJs("window.__edgeScopes = { hasFriends: false, hasTeam: false }");
      await cdp.evalJs('(function(){ window.closeEdgeDrawer(); window.openEdgeDrawer("edge"); })()');
      await sleep(700);
      d = await drawer();
      scope = await cdp.evalJs(GETSCOPE_EXPR);
      ok('B16d 双假：圆球隐 + label 空 + scope all',
        d.ballShow === false && d.label === '' && scope === 'all', JSON.stringify({ d: d, scope: scope }));
    }

    // ═══ B17 三降级 toast ═══
    {
      await cdp.evalJs('(function(){ window.closeEdgeDrawer(); })()');
      await cdp.evalJs("document.getElementById('fcEdgeCustomAddBtn').click()");
      await sleep(300);
      await cdp.evalJs("window.__genMode = 'unavailable'");
      await cdp.evalJs("document.getElementById('edgeGenDesc').value = '测试'");
      await cdp.evalJs('(function(){ window.edgeGenRun(); })()');
      let t = await toast();
      let resShown = await cdp.evalJs("getComputedStyle(document.getElementById('edgeGenResult')).display !== 'none'");
      ok('B17a unavailable：toast AI 生成暂不可用 + 结果隐 + 弹窗仍开',
        t && t.text === 'AI 生成暂不可用' && resShown === false && (await genModal()) === true,
        JSON.stringify({ t: t, resShown: resShown }));
      await cdp.evalJs("window.__genMode = 'budget'");
      await cdp.evalJs('(function(){ window.edgeGenRun(); })()');
      t = await toast();
      ok('B17b budget_exhausted：toast 本月 AI 生成额度已用完', t && t.text === '本月 AI 生成额度已用完', JSON.stringify(t));
      await cdp.evalJs("window.__genMode = 'failed'");
      await cdp.evalJs('(function(){ window.edgeGenRun(); })()');
      t = await toast();
      ok('B17c ai_failed：toast 生成失败，请稍后再试', t && t.text === '生成失败，请稍后再试', JSON.stringify(t));
      await cdp.evalJs('(function(){ window.closeModalOnly("fcEdgeGenModal"); })()');
      await sleep(250);
    }

    // ═══ B18 附图生成 ═══
    {
      const tmpPng = path.join(os.tmpdir(), 'mn-edgeai-' + Date.now() + '.png');
      fs.writeFileSync(tmpPng, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
      await cdp.evalJs("document.getElementById('fcEdgeCustomAddBtn').click()");
      await sleep(300);
      await cdp.send('DOM.enable');
      const docNode = await cdp.send('DOM.getDocument', { depth: -1 });
      const fileNode = await cdp.send('DOM.querySelector', { nodeId: docNode.root.nodeId, selector: '#edgeGenFileInput' });
      await cdp.send('DOM.setFileInputFiles', { nodeId: fileNode.nodeId, files: [tmpPng] });
      await sleep(600);
      const imgPrev = await cdp.evalJs("(function(){ return { shown: getComputedStyle(document.getElementById('edgeGenImgPreview')).display !== 'none'," +
        " thumb: document.getElementById('edgeGenImgThumb').getAttribute('src') }; })()");
      await cdp.evalJs("window.__genMode = 'edge'");
      await cdp.evalJs("document.getElementById('edgeGenDesc').value = ''");
      await cdp.evalJs('(function(){ window.edgeGenRun(); })()');
      await waitFor(cdp, "getComputedStyle(document.getElementById('edgeGenResult')).display !== 'none'", 15000, 'B18 生成结果');
      const body = await cdp.evalJs("(function(){ var g = (window.__fcalls || []).filter(function (c) { return c.url.indexOf('/fc/edge-gen') !== -1; });" +
        " return g.length ? g[g.length - 1].body : null; })()");
      await cdp.evalJs('(function(){ window.edgeGenSave(); })()');
      await sleep(400);
      const L = await lib();
      ok('B18 附图生成：预览已附图 + 空描述靠图过门 + body.image dataURL png + 库 4 条（AI撕边/AI框环/锯齿星/+本条）',
        imgPrev.shown === true && imgPrev.thumb && imgPrev.thumb.indexOf('data:image/png;base64,') === 0 &&
        body && body.desc === '' && body.image && body.image.indexOf('data:image/png;base64,') === 0 &&
        L.length === 4, JSON.stringify({ imgPrev: { shown: imgPrev.shown }, body: body && { kind: body.kind, desc: body.desc, img: (body.image || '').slice(0, 30) }, n: L.length }));
      try { fs.unlinkSync(tmpPng); } catch (e) {}
    }

    // ═══ B19 Esc 链 ═══
    {
      await cdp.evalJs('(function(){ window.openEdgeDrawer("edge"); })()');
      await sleep(300);
      await esc();
      let d = await drawer();
      await cdp.evalJs("document.getElementById('fcEdgeCustomAddBtn').click()");
      await sleep(300);
      await esc();
      const gm = await genModal();
      ok('B19 Esc 链：抽屉收起 + 生成弹窗关闭', d.open === false && gm === false, JSON.stringify({ d: d.open, gm: gm }));
    }

    // ═══ C 阅读页 CDP ═══
    console.log('═══ C 阅读页 CDP ═══');
    await setWinName('');
    await nav(BASE + ARTICLE_URL_PATH + '?id=ART-EDGE1', "document.querySelectorAll('#artBody .art-card').length === 3", 'C1 nav');
    {
      const e1 = await cdp.evalJs("(function(){ var el = document.querySelector('#artBody .art-card[data-card-id=\"e1\"]');" +
        " return el ? getComputedStyle(el).clipPath : null; })()");
      const e2 = await cdp.evalJs("(function(){ var el = document.querySelector('#artBody .art-card[data-card-id=\"e2\"]');" +
        " if (!el) return null; var fr = el.querySelector('.art-card-custom-frame');" +
        " return { clip: fr ? fr.style.clipPath : null, z: fr ? getComputedStyle(fr).zIndex : null," +
        "  firstChild: el.firstChild && el.firstChild.className }; })()");
      const e3 = await cdp.evalJs("(function(){ var el = document.querySelector('#artBody .art-card[data-card-id=\"e3\"]');" +
        " if (!el) return null; return { clip: getComputedStyle(el).clipPath," +
        "  frame: !!el.querySelector('.art-card-custom-frame') }; })()");
      ok('C1 罐头文章 customEdges：edge 直写 clipPath 等值 / border 框环子层 clip+z -1 / 缺 map 平卡零改动',
        e1 === EDGE_CLIP && e2 && e2.clip === RING && e2.z === '-1' && e2.firstChild === 'art-card-custom-frame' &&
        e3 && (e3.clip === '' || e3.clip === 'none') && e3.frame === false, JSON.stringify({ e1: e1, e2: e2, e3: e3 }));
    }
    await nav(BASE + ARTICLE_URL_PATH + '?id=ART-EDGE2', "document.querySelectorAll('#artBody .art-card').length === 1", 'C2 nav');
    {
      const e1 = await cdp.evalJs("(function(){ var el = document.querySelector('#artBody .art-card[data-card-id=\"e1\"]');" +
        " if (!el) return null; return { clip: getComputedStyle(el).clipPath," +
        "  frame: !!el.querySelector('.art-card-custom-frame') }; })()");
      ok('C2 无 customEdges map：平卡零改动（无 clip 无框环子层）',
        e1 && (e1.clip === '' || e1.clip === 'none') && e1.frame === false, JSON.stringify(e1));
    }

  } catch (e) {
    console.log('  💔 ' + e.message);
    fail++;
  }
  // ═══ E 零异常（无论 B/C 是否中断都跑）═══
  console.log('═══ E 零异常 ═══');
  const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
  const rawErrs = cdp ? cdp.errs : [];
  const errs = rawErrs.filter(e => !noise.test(e));
  ok('E 零异常（' + rawErrs.length + ' 原始 / ' + errs.length + ' 噪声后）', errs.length === 0, errs.slice(0, 5).join(' || '));
  try { cdp && cdp.close(); } catch (e) {}
  try { spawn('taskkill', ['/pid', String(chrome.pid), '/t', '/f'], { stdio: 'ignore' }); } catch (e) {}
  server.close();
  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  process.exit(fail === 0 ? 0 : 1);
})();
