// tmp-battery-fc-rotate.js — v10.28.49.0 平板 4:3 视口+旋转按钮+逐设备布局电池（本地工作树）
//   S 静态：编辑器/阅读页/site-config/i18n 锚（行计数口径=实测 grep -cF）；
//   B 编辑器 CDP：B1 默认 169 / B2 切 tablet 旋转钮滑出 / B3 旋转横竖切换 / B4 tablet auto-flow 2/行 /
//     B5 六卡三视口全布局规则（half 4/行+content 24 挤下+aspect fit）/ B7 合并组=一单位+手机展开 /
//     B8 拖拽自定义持久化+旋转往返 / B9 未动过不落盘 / B10 增删同步 / B11 旧草稿 clamp / B12 竖屏 seed 往返；
//   C 阅读页 CDP（fetch 罐头+Emulation+__FCXLAYOUT__ 强制钩）：C0 orientation 自检 / C1 169 等价路径回归 /
//     C2 平板横向自然选 / C3 平板竖向（自然优先,兜底强制）/ C4 手机 reflow / C5 half 表 clamp+append /
//     C6 auto-flow 与编辑器同款数学（tablet+half）/ C7 组读者（合并=一卡+手机展开）；
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
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-rotate-' + Date.now());
const EDITOR_URL_PATH = '/pages/fluidcanvas-editor.html';
const ARTICLE_URL_PATH = '/pages/article.html';

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};
const approx = (a, b, tol) => Math.abs(a - b) <= (tol || 1.5);
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

const FLAG_SVG = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#4a7fd4"/><rect y="200" width="800" height="200" fill="#e0e6f0"/></svg>'
).toString('base64');

// ═══ 阅读页罐头（三套）═══
const CARD_BASE = { rotate: 0, borderRadius: 8, background: '', borderStyle: 'solid', borderColor: '', borderWidth: 2, z: 1 };
const FIXTURE_CLOUD1 = {
  v: 9, title: 'Cloud Constitution', activePreset: '169', lastSaved: 1750000000000,
  presets: {
    '169': { cards: {} },
    half: { cards: {
      c1: { col: 40, row: 1, colSpan: 6, rowSpan: 6 },
      c2: { col: 1, row: 10, colSpan: 4, rowSpan: 5 },
      c3: { col: 6, row: 10, colSpan: 4, rowSpan: 4 },
      c4: { col: 11, row: 10, colSpan: 6, rowSpan: 4 },
      c6: { col: 30, row:24, colSpan: 6, rowSpan: 4, aspectLock: '1', aspectRatio: '2', fitW: 200, fitH: 100 }
    } },
    tablet: { cards: {} }, 'tablet-p': { cards: {} }, mobile: { cards: {} }
  },
  cards: [
    Object.assign({ id: 'c1', type: 'content', col: 2, row: 2, colSpan: 6, rowSpan: 4, x: 0, y: 0, w: 300, label: 'Body', baseFontSize: 14, content: '<p>Cloud Constitution</p>' }, CARD_BASE),
    Object.assign({ id: 'c2', type: 'text', col: 2, row: 11, colSpan: 12, rowSpan: 4, x: 0, y: 220, label: 'N2', content: 'note two' }, CARD_BASE),
    Object.assign({ id: 'c3', type: 'text', col: 14, row: 11, colSpan: 6, rowSpan: 4, x: 264, y: 220, label: 'N3', content: 'note three' }, CARD_BASE),
    Object.assign({ id: 'c4', type: 'text', col: 26, row: 11, colSpan: 12, rowSpan: 4, x: 528, y: 220, label: 'N4', content: 'note four' }, CARD_BASE),
    Object.assign({ id: 'c5', type: 'content', col: 2, row: 31, colSpan: 8, rowSpan: 8, x: 0, y: 638, label: 'Late', baseFontSize: 14, content: '<p>appended later</p>' }, CARD_BASE),
    Object.assign({ id: 'c6', type: 'flag', col: 2, row: 44, colSpan: 8, rowSpan: 5, x: 0, y: 878, aspectLock: '1', aspectRatio: '2', fitW: 200, fitH: 100, imgSrc: FLAG_SVG, label: 'Flag' }, CARD_BASE)
  ]
};
const FIXTURE_CLOUD2 = {
  v: 9, title: 'Auto Flow Parity', activePreset: '169', lastSaved: 1750000000000,
  presets: { '169': { cards: {} }, half: { cards: {} }, tablet: { cards: {} }, 'tablet-p': { cards: {} }, mobile: { cards: {} } },
  cards: [
    Object.assign({ id: 's1', type: 'shield', col: 1, row: 1, colSpan: 6, rowSpan: 5, x: 0, y: 0, label: 'Stats' }, CARD_BASE),
    Object.assign({ id: 's2', type: 'shield', col: 10, row: 1, colSpan: 4, rowSpan: 3, x: 198, y: 0, label: 'Shield' }, CARD_BASE),
    Object.assign({ id: 's3', type: 'shield', col: 16, row: 1, colSpan: 8, rowSpan: 6, x: 318, y: 0, label: 'Map' }, CARD_BASE),
    Object.assign({ id: 'c4', type: 'content', col: 30, row: 1, colSpan: 30, rowSpan: 6, x: 598, y: 0, label: 'Long', baseFontSize: 14, content: '<p>the long one</p>' }, CARD_BASE),
    Object.assign({ id: 't5', type: 'text', col: 61, row: 1, colSpan: 12, rowSpan: 5, x: 1218, y: 0, label: 'Tail', content: 'tail text' }, CARD_BASE),
    Object.assign({ id: 'f6', type: 'flag', col: 1, row: 20, colSpan: 8, rowSpan: 5, x: 0, y: 398, aspectLock: '1', aspectRatio: '2', fitW: 200, fitH: 100, imgSrc: FLAG_SVG, label: 'Flag' }, CARD_BASE)
  ]
};
const FIXTURE_CLOUD3 = {
  v: 9, title: 'Group Reader', activePreset: '169', lastSaved: 1750000000000,
  presets: { '169': { cards: {} }, half: { cards: {} }, tablet: { cards: {} }, 'tablet-p': { cards: {} }, mobile: { cards: {} } },
  cards: [
    Object.assign({ id: 'g1', type: 'text', col: 1, row: 1, colSpan: 6, rowSpan: 4, x: 0, y: 0, label: 'Solo', content: 'standalone' }, CARD_BASE),
    Object.assign({ id: 'g2', type: 'text', col: 1, row: 8, colSpan: 6, rowSpan: 3, x: 0, y: 140, groupId: 'g1', label: 'MA', content: 'member A' }, CARD_BASE),
    Object.assign({ id: 'g3', type: 'text', col: 7, row: 8, colSpan: 6, rowSpan: 3, x: 0, y: 140, groupId: 'g1', label: 'MB', content: 'member B' }, CARD_BASE)
  ]
};
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' var stubResponse = function (body, status) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status, headers: { "Content-Type": "application/json" } })); }, 0); }); };' +
  ' var CLOUD1 = ' + JSON.stringify(FIXTURE_CLOUD1) + ';' +
  ' var CLOUD2 = ' + JSON.stringify(FIXTURE_CLOUD2) + ';' +
  ' var CLOUD3 = ' + JSON.stringify(FIXTURE_CLOUD3) + ';' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  if (u.indexOf("/articles") !== -1) {' +
  '   if (u.indexOf("/articles/") !== -1) {' +
  '    var id = decodeURIComponent(u.split("/articles/")[1].split("?")[0].split("#")[0]);' +
  '    var cj = (id === "ART-CLOUD1") ? CLOUD1 : (id === "ART-CLOUD2") ? CLOUD2 : (id === "ART-CLOUD3") ? CLOUD3 : null;' +
  '    if (cj) return stubResponse(JSON.stringify({ article: { id: id, title: cj.title, status: "published", authorId: "USR-000042", authorName: "Neo", createdAt: "2026-09-20T10:00:00.000Z", updatedAt: "2026-09-20T10:00:00.000Z", viewCount: 7, likeCount: 2, likedByMe: false, favoritedByMe: false, contentJson: cj } }), 200);' +
  '    return stubResponse(JSON.stringify({ error: "NOT_FOUND" }), 404);' +
  '   }' +
  '   return stubResponse(JSON.stringify({ articles: [] }), 200);' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';

// ═══ window.name 种子脚本：__FCSEED__=编辑器草稿注入 / __FCXLAYOUT__=阅读页强制布局 ═══
const SEED_SCRIPT = 'try{(function(){' +
  ' var n = window.name || "";' +
  ' if (n.indexOf("__FCSEED__") === 0) { localStorage.setItem("slati_fluidcanvas_draft", n.slice(10)); }' +
  ' else if (n.indexOf("__FCXLAYOUT__") === 0) { window.__slatiForceLayout = n.slice(13); }' +
  ' else { localStorage.removeItem("slati_fluidcanvas_draft"); }' +
  '})();}catch(e){}';
const SESSION_SCRIPT = 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}';

// ═══ 编辑器状态读取 ═══
const FIXED_EXPR = "(function(){ var gc = document.getElementById('gridCanvas');" +
  " var rw = document.getElementById('rotateWrap'); var rb = document.getElementById('rotateBtn');" +
  " return { cs: getComputedStyle(gc).getPropertyValue('--cell-size').trim()," +
  "  cols: getComputedStyle(gc).getPropertyValue('--grid-cols').trim()," +
  "  w: gc.offsetWidth, h: gc.offsetHeight," +
  "  rwShow: rw.classList.contains('show'), rbActive: rb.classList.contains('active')," +
  "  rbPressed: rb.getAttribute('aria-pressed')," +
  "  rotP: getComputedStyle(rb.querySelector('.fc-rot-p')).display," +
  "  rotL: getComputedStyle(rb.querySelector('.fc-rot-l')).display," +
  "  btnState: document.getElementById('viewportBtnState').textContent }; })()";
const CARDS_EXPR = "(function(){ var out = [];" +
  " document.querySelectorAll('#gridCanvas .grid-card').forEach(function(c){" +
  "  out.push({ label: c.dataset.label || '', col: c.dataset.col, row: c.dataset.row," +
  "   colSpan: c.dataset.colSpan, rowSpan: c.dataset.rowSpan, left: c.style.left, top: c.style.top," +
  "   gid: c.dataset.groupId || '' }); });" +
  " out.sort(function(a,b){ return (a.label||'').localeCompare(b.label||''); }); return out; })()";

// ═══ 阅读页状态读取 ═══
const STAGE_EXPR = "(function(){ var h = document.querySelector('.art-canvas'); if (!h) return null;" +
  " var inn = h.querySelector('.art-canvas-inner');" +
  " return { reflow: h.classList.contains('art-canvas-reflow'), w: inn.offsetWidth, h: inn.offsetHeight," +
  "  cell: inn.style.getPropertyValue('--art-cell-px').trim()," +
  "  bands: h.querySelectorAll('.art-reflow-band').length," +
  "  cards: h.querySelectorAll('.art-card').length," +
  "  avail: (document.getElementById('artBody') || { clientWidth: 0 }).clientWidth }; })()";
const boxExpr = (id) => "(function(){ var e = document.querySelector('#artBody .art-card[data-card-id=\"" + id + "\"]');" +
  " if (!e) return null; return { l: e.offsetLeft, t: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight }; })()";

// ═══ 编辑器 B 段种子草稿 ═══
const SEED_LEGACY = {
  v: 9, title: 'Legacy Clamp', activePreset: 'tablet',
  presets: { '169': { cards: {} }, half: { cards: {} },
    tablet: { cards: { c1: { col: 112, row: 1, colSpan: 10, rowSpan: 4 } } },
    'tablet-p': { cards: {} }, mobile: { cards: {} } },
  cards: [{ id: 'c1', type: 'text', col: 112, row: 1, colSpan: 10, rowSpan: 4, label: 'Legacy', content: 'clamp me' }]
};
const SEED_PORTRAIT = {
  v: 9, title: 'Portrait', activePreset: 'tablet-p', tabletOrientation: 'p',
  presets: { '169': { cards: {} }, half: { cards: {} }, tablet: { cards: {} }, 'tablet-p': { cards: {} }, mobile: { cards: {} } },
  cards: [{ id: 'c1', type: 'text', col: 2, row: 2, colSpan: 6, rowSpan: 4, label: 'P', content: 'portrait card' }]
};

(async () => {
  // ═══ S 静态锚（行计数口径=实测 grep -cF）═══
  console.log('═══ S 静态锚 ═══');
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;

  const ed = norm(await (await fetch(BASE + EDITOR_URL_PATH)).text());
  const edLines = ed.split('\n');
  const c = (a) => edLines.filter((l) => l.includes(a)).length;
  const ED_ANCHORS = [['id="rotateWrap"', 1], ['id="rotateBtn"', 1], ['screen_rotation', 1], ['fc.viewport.tablet43', 1],
    ['function autoFlowCards', 1], ['function clampPresetEntry', 1], ['function rotateTablet', 1], ['window.rotateTablet', 1],
    ['var tabletOrientation', 1], ['tabletOrientation:', 1], ['totalRows = p.rows', 1], ['p.cols', 1],
    ['.fc-rotate-wrap', 2], ['markPresetCustom', 12], ["'tablet-p'", 13],
    ['function applyPresetCardPositions', 1], ['function switchPreset', 1], ['rotateWrap', 2]];
  const edBad = ED_ANCHORS.filter(([a, n]) => c(a) !== n);
  ok('S1 编辑器 18 锚全中（旋转钮/autoFlow/门控/方向/13 处 tablet-p）', edBad.length === 0,
    edBad.map(([a, n]) => a + '=' + c(a) + '≠' + n).join(',') || '18/18');

  const ar = norm(await (await fetch(BASE + ARTICLE_URL_PATH)).text());
  const arLines = ar.split('\n');
  const ac = (a) => arLines.filter((l) => l.includes(a)).length;
  const AR_ANCHORS = [["'tablet-p': 20", 1], ['function pickReaderLayout', 1], ['function autoFlowEntries', 1],
    ['function clampLayoutEntry', 1], ['(orientation: portrait)', 3], ['LAYOUT_COLS', 5], ['__slatiForceLayout', 3],
    ['LAYOUT_ROWS', 2], ['var perLayout', 1], ['perLayout ? spanPx', 2], ['art-canvas-reflow', 10], ['--art-cell-px', 3]];
  const arBad = AR_ANCHORS.filter(([a, n]) => ac(a) !== n);
  ok('S2 阅读页 12 锚全中（pickReaderLayout/autoFlowEntries/逐布局渲染链）', arBad.length === 0,
    arBad.map(([a, n]) => a + '=' + ac(a) + '≠' + n).join(',') || '12/12');

  const scSrc = norm(await (await fetch(BASE + '/assets/js/site-config.js')).text());
  const sc = mk(scSrc);
  ok('S3 site-config：49.1 在位 + 48.2 赋值零残留 + changelog 头各 ×1 + rev 终态真值各 ×1 + 站点恒 58.26',
    sc("window.FLUIDCANVAS_VERSION = 'v10.28.49.2';") === 1 && sc("window.FLUIDCANVAS_VERSION = 'v10.28.48.2';") === 0 &&
    sc('// v10.28.49.0 = ') === 1 && sc('// v10.28.48.2 = ') === 1 &&
    sc('rev 00350-6vv') === 1 && sc('rev 00351-5mm') === 1 &&
    sc("window.MN_SITE_VERSION = 'v0.2.58.26';") === 1 && sc("window.MN_SITE_VERSION = 'v0.2.58.25';") === 0,
    'fc49=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.49.2';") + ' fc48=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.48.2';") +
    ' cl49=' + sc('// v10.28.49.0 = ') + ' cl48=' + sc('// v10.28.48.2 = ') +
    ' r50=' + sc('rev 00350-6vv') + ' q51=' + sc('rev 00351-5mm') +
    ' v26=' + sc("window.MN_SITE_VERSION = 'v0.2.58.26';") + ' v25=' + sc("window.MN_SITE_VERSION = 'v0.2.58.25';"));

  const i18nSrc = norm(await (await fetch(BASE + '/assets/i18n/fluidcanvas.i18n.js')).text());
  const ic = mk(i18nSrc);
  ok('S4 i18n：4 新键 ×12 + 旧 tablet 键 ×12 保留',
    ic('"fc.viewport.tablet43"') === 12 && ic('"fc.viewport.rotate"') === 12 &&
    ic('"fc.viewport.landscape"') === 12 && ic('"fc.viewport.portrait"') === 12 && ic('"fc.viewport.tablet"') === 12,
    't43=' + ic('"fc.viewport.tablet43"') + ' rot=' + ic('"fc.viewport.rotate"') +
    ' land=' + ic('"fc.viewport.landscape"') + ' port=' + ic('"fc.viewport.portrait"') + ' legacy=' + ic('"fc.viewport.tablet"'));

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
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION_SCRIPT });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SEED_SCRIPT });
    await cdp.send('Page.setDownloadBehavior', { behavior: 'deny' });
    const origHandler = cdp.ws.onmessage;
    cdp.ws.onmessage = (ev) => {
      origHandler(ev);
      try {
        const m = JSON.parse(ev.data);
        if (m.method === 'Page.javascriptDialogOpening') cdp.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      } catch (e) {}
    };
    await cdp.send('Page.navigate', { url: BASE + EDITOR_URL_PATH });
    await waitFor(cdp, "document.getElementById('undoBtn') && document.getElementById('gridCanvas') && window.switchPreset && window.rotateTablet", 40000, '编辑器就绪');
    await sleep(900);

    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 30000, label);
      await sleep(500);
    };
    const setWinName = async (name) => { await cdp.evalJs('window.name = ' + JSON.stringify(name)); };
    const createCard = async (asset, label, col, row, sw, sh) => {
      await cdp.evalJs("(function(){ window.createAssetCard(" + JSON.stringify(asset) + "," + JSON.stringify(label) + "," + col + "," + row + "," + sw + "," + sh + "); })()");
    };
    const readCards = () => cdp.evalJs(CARDS_EXPR);
    const cardByLabel = (cards, label) => cards.find(x => x.label === label) || {};

    // ═══ B1 默认 169 ═══
    console.log('═══ B 编辑器 CDP ═══');
    {
      const f = await cdp.evalJs(FIXED_EXPR);
      ok('B1 默认 169：cols 115 / cs 20px / 画布 2528×2200 / 旋转钮不滑出 / 按钮态 16:9',
        f.cols === '115' && f.cs === '20px' && f.w === 2528 && f.h === 2200 &&
        f.rwShow === false && f.rbPressed === 'false' && f.btnState === '16:9', JSON.stringify(f));
    }

    // ═══ B2 切 tablet（点弹窗按钮）═══
    {
      await cdp.evalJs("document.getElementById('viewportBtn').click()");
      await sleep(300);
      await cdp.evalJs("(function(){ var b = document.querySelector('#vpPresets [data-preset=\"tablet\"]'); if (!b) return false; b.click(); return true; })()");
      await sleep(700);
      const f = await cdp.evalJs(FIXED_EXPR);
      ok('B2 点弹窗 tablet 钮：cols 110 / 画布 2418×1694 / rotateWrap 滑出 / 按钮态 Tablet 4:3',
        f.cols === '110' && f.cs === '20px' && f.w === 2418 && f.h === 1694 &&
        f.rwShow === true && f.btnState === 'Tablet 4:3' && f.rbPressed === 'false', JSON.stringify(f));
    }

    // ═══ B3 旋转横竖 ═══
    {
      await cdp.evalJs("document.getElementById('rotateBtn').click()");
      await sleep(700);
      let f = await cdp.evalJs(FIXED_EXPR);
      ok('B3a 点旋转钮 → 竖屏：cols 77 / 画布 1692×2420 / active + aria-pressed / 竖标签显横标签隐',
        f.cols === '77' && f.w === 1692 && f.h === 2420 && f.rbActive === true && f.rbPressed === 'true' &&
        f.rotP !== 'none' && f.rotL === 'none', JSON.stringify(f));
      await cdp.evalJs("document.getElementById('rotateBtn').click()");
      await sleep(700);
      f = await cdp.evalJs(FIXED_EXPR);
      ok('B3b 再点旋转钮 → 回横屏：cols 110 / aria-pressed false / 横标签显竖标签隐',
        f.cols === '110' && f.rbPressed === 'false' && f.rbActive === false &&
        f.rotL !== 'none' && f.rotP === 'none', JSON.stringify(f));
    }

    // ═══ B4 tablet auto-flow：3 文本卡 2/行 ═══
    {
      await setWinName(''); await nav(BASE + EDITOR_URL_PATH, "document.getElementById('undoBtn') && window.switchPreset", 'B4 nav');
      await createCard('text', 'A', 1, 1, 6, 4);
      await createCard('text', 'B', 20, 1, 6, 4);
      await createCard('text', 'C', 1, 10, 6, 4);
      await cdp.evalJs('(function(){ window.switchPreset("tablet"); })()');
      await sleep(700);
      const cards = await readCards();
      const A = cardByLabel(cards, 'A'), B = cardByLabel(cards, 'B'), C = cardByLabel(cards, 'C');
      ok('B4 tablet auto-flow 2/行：A(1,1) B(7,1) 同排 / C(1,7) 下一行 / 左对齐零残留组',
        A.col === '1' && A.row === '1' && A.left === '0px' && A.top === '0px' &&
        B.col === '7' && B.row === '1' && B.left === '132px' && B.top === '0px' &&
        C.col === '1' && C.row === '7' && C.left === '0px' && C.top === '132px' &&
        cards.length === 3 && !A.gid && !B.gid && !C.gid, JSON.stringify(cards));
    }

    // ═══ B5 六卡三视口全布局规则 ═══
    {
      await setWinName(''); await nav(BASE + EDITOR_URL_PATH, "document.getElementById('undoBtn') && window.switchPreset", 'B5 nav');
      await createCard('stats', 'K1', 1, 1, 6, 5);
      await createCard('shield', 'K2', 10, 1, 4, 3);
      await createCard('map', 'K3', 16, 1, 8, 6);
      await createCard('content', 'K4', 30, 1, 30, 6);
      await createCard('text', 'K5', 61, 1, 12, 5);
      await createCard('flag', 'K6', 1, 20, 8, 5);
      await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card[data-label=\"K6\"]');" +
        " c.dataset.aspectLock = '1'; c.dataset.aspectRatio = '2'; c.dataset.fitW = '200'; c.dataset.fitH = '100';" +
        " c.style.width = '200px'; c.style.height = '100px'; return true; })()");
      await cdp.evalJs('(function(){ window.switchPreset("tablet"); })()');
      await sleep(700);
      let cards = await readCards();
      let K1 = cardByLabel(cards, 'K1'), K2 = cardByLabel(cards, 'K2'), K3 = cardByLabel(cards, 'K3');
      let K4 = cardByLabel(cards, 'K4'), K5 = cardByLabel(cards, 'K5'), K6 = cardByLabel(cards, 'K6');
      ok('B5a tablet：K1(1,1) K2(7,1) / K3(1,8) K4(9,8) / K5(1,16) K6(13,16)（2/行+行高 5/6+aspect 9.09 宽）',
        K1.col === '1' && K1.row === '1' && K1.left === '0px' && K1.top === '0px' &&
        K2.col === '7' && K2.row === '1' && K2.left === '132px' &&
        K3.col === '1' && K3.row === '8' && K3.top === '154px' &&
        K4.col === '9' && K4.row === '8' && K4.left === '176px' && K4.top === '154px' &&
        K5.col === '1' && K5.row === '16' && K5.top === '330px' &&
        K6.col === '13' && K6.row === '16' && K6.left === '264px' && K6.top === '330px',
        JSON.stringify(cards));
      await cdp.evalJs('(function(){ window.switchPreset("half"); })()');
      await sleep(700);
      cards = await readCards();
      K1 = cardByLabel(cards, 'K1'); K2 = cardByLabel(cards, 'K2'); K3 = cardByLabel(cards, 'K3');
      K4 = cardByLabel(cards, 'K4'); K5 = cardByLabel(cards, 'K5'); K6 = cardByLabel(cards, 'K6');
      ok('B5b half：K1 K2 K3 同行→长文 K4 到来挤下最右 K3 / K5 宽 12→24 / K6 aspect 33 列',
        K1.col === '1' && K1.row === '1' && K1.left === '0px' &&
        K2.col === '7' && K2.row === '1' && K2.left === '156px' &&
        K4.col === '11' && K4.row === '1' && K4.left === '260px' && K4.colSpan === '30' &&
        K3.col === '1' && K3.row === '9' && K3.top === '208px' &&
        K5.col === '9' && K5.row === '9' && K5.left === '208px' && K5.top === '208px' && K5.colSpan === '24' &&
        K6.col === '33' && K6.row === '9' && K6.left === '832px' && K6.top === '208px',
        JSON.stringify(cards));
      await cdp.evalJs('(function(){ window.switchPreset("mobile"); })()');
      await sleep(700);
      cards = await readCards();
      K1 = cardByLabel(cards, 'K1'); K2 = cardByLabel(cards, 'K2'); K3 = cardByLabel(cards, 'K3');
      K4 = cardByLabel(cards, 'K4'); K5 = cardByLabel(cards, 'K5'); K6 = cardByLabel(cards, 'K6');
      ok('B5c mobile：全纵向每卡一行全宽（rows 1/8/13/21/29/36, colSpan 115）',
        K1.col === '1' && K1.row === '1' && K1.colSpan === '115' &&
        K2.col === '1' && K2.row === '8' && K2.top === '140px' &&
        K4.col === '1' && K4.row === '13' && K4.top === '240px' &&
        K3.col === '1' && K3.row === '21' && K3.top === '400px' &&
        K5.col === '1' && K5.row === '29' && K5.top === '560px' &&
        K6.col === '1' && K6.row === '36' && K6.top === '700px' && K6.colSpan === '115',
        JSON.stringify(cards));
    }

    // ═══ B7 合并组=一单位 + 手机展开 ═══
    {
      await setWinName(''); await nav(BASE + EDITOR_URL_PATH, "document.getElementById('undoBtn') && window.switchPreset", 'B7 nav');
      await createCard('text', 'A', 1, 1, 6, 4);
      await createCard('text', 'B', 7, 1, 6, 4);
      await cdp.evalJs("(function(){ var a = document.querySelector('#gridCanvas .grid-card[data-label=\"A\"]');" +
        " var b = document.querySelector('#gridCanvas .grid-card[data-label=\"B\"]');" +
        " window.mergeCards(b, a, 'right'); return true; })()");
      await sleep(900);
      let cards = await readCards();
      let A = cardByLabel(cards, 'A'), B = cardByLabel(cards, 'B');
      ok('B7a 合并：A/B 同 groupId 非空', !!A.gid && A.gid === B.gid, JSON.stringify(cards));
      await cdp.evalJs('(function(){ window.switchPreset("tablet"); })()');
      await sleep(700);
      cards = await readCards();
      A = cardByLabel(cards, 'A'); B = cardByLabel(cards, 'B');
      ok('B7b tablet 合并卡=一单位：A(1,1) B(7,1) 同排相对偏移保持',
        A.col === '1' && A.row === '1' && A.left === '0px' &&
        B.col === '7' && B.row === '1' && B.left === '132px', JSON.stringify(cards));
      await cdp.evalJs('(function(){ window.switchPreset("mobile"); })()');
      await sleep(700);
      cards = await readCards();
      A = cardByLabel(cards, 'A'); B = cardByLabel(cards, 'B');
      ok('B7c mobile 组展开纵向：A(1,1) 全宽 / B(1,7) 全宽（A 高 4 行+2 行空档）',
        A.col === '1' && A.row === '1' && A.colSpan === '115' &&
        B.col === '1' && B.row === '7' && B.top === '120px' && B.colSpan === '115', JSON.stringify(cards));
    }

    // ═══ B8 拖拽自定义持久化 + 旋转往返 ═══
    {
      await setWinName(''); await nav(BASE + EDITOR_URL_PATH, "document.getElementById('undoBtn') && window.switchPreset", 'B8 nav');
      await createCard('text', 'A', 1, 1, 6, 4);
      await createCard('text', 'B', 20, 1, 6, 4);
      await createCard('text', 'C', 1, 10, 6, 4);
      await cdp.evalJs('(function(){ window.switchPreset("tablet"); })()');
      await sleep(700);
      // 拖 A（右下角按压避开 .card-label 守卫）→ +44px = 2 格
      const rect = await cdp.evalJs("(function(){ var r = document.querySelector('#gridCanvas .grid-card[data-label=\"A\"]').getBoundingClientRect();" +
        " return { x: r.left, y: r.top, w: r.width, h: r.height }; })()");
      const px = rect.x + rect.w - 8, py = rect.y + rect.h - 8;
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: px, y: py, button: 'left', clickCount: 1 });
      for (let i = 1; i <= 3; i++) {
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: px + 44 * i / 3, y: py, button: 'left' });
        await sleep(60);
      }
      await sleep(250);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: px + 44, y: py, button: 'left', clickCount: 1 });
      await cdp.evalJs('(function(){ window.onContentChange && window.onContentChange(); })()');
      await sleep(900);
      let cards = await readCards();
      let A = cardByLabel(cards, 'A');
      ok('B8a 拖 A +44px → col 3 left 44px（自定义门控已触发）', A.col === '3' && A.left === '44px', JSON.stringify(A));
      await cdp.evalJs('(function(){ window.saveDraft(); })()');
      let draft = await cdp.evalJs("JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}')");
      const tKeys = Object.keys((draft.presets && draft.presets.tablet && draft.presets.tablet.cards) || {});
      ok('B8b 草稿往返：tablet custom=true + 3 卡（c1=A col 3）+ activePreset tablet + orientation l',
        draft.activePreset === 'tablet' && draft.tabletOrientation === 'l' &&
        draft.presets.tablet.custom === true && tKeys.length === 3 &&
        draft.presets.tablet.cards.c1 && draft.presets.tablet.cards.c1.col === 3 &&
        draft.presets.tablet.cards.c1.row === 1, JSON.stringify({ activePreset: draft.activePreset, orientation: draft.tabletOrientation, custom: draft.presets.tablet.custom, keys: tKeys, c1: draft.presets.tablet.cards.c1 }));
      await cdp.evalJs('(function(){ window.rotateTablet(); })()');
      await sleep(700);
      let f = await cdp.evalJs(FIXED_EXPR);
      await cdp.evalJs('(function(){ window.saveDraft(); })()');
      draft = await cdp.evalJs("JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}')");
      const pKeys = Object.keys((draft.presets && draft.presets['tablet-p'] && draft.presets['tablet-p'].cards) || {});
      ok('B8c 旋转→tablet-p：cols 77 + 未动过不落盘（cards 空/custom falsy）+ orientation p',
        f.cols === '77' && f.rbPressed === 'true' && draft.activePreset === 'tablet-p' && draft.tabletOrientation === 'p' &&
        pKeys.length === 0 && !draft.presets['tablet-p'].custom,
        JSON.stringify({ cols: f.cols, activePreset: draft.activePreset, orientation: draft.tabletOrientation, pKeys: pKeys.length, pCustom: !!draft.presets['tablet-p'].custom }));
      await cdp.evalJs('(function(){ window.rotateTablet(); })()');
      await sleep(700);
      cards = await readCards();
      A = cardByLabel(cards, 'A');
      ok('B8d 转回 tablet：位置记忆恢复（A 仍 col 3 left 44px,不重新 auto-flow）',
        A.col === '3' && A.left === '44px' && A.row === '1',
        JSON.stringify(A));
    }

    // ═══ B9 未动过不落盘 ═══
    {
      await setWinName(''); await nav(BASE + EDITOR_URL_PATH, "document.getElementById('undoBtn') && window.switchPreset", 'B9 nav');
      await createCard('text', 'A', 1, 1, 6, 4);
      await createCard('text', 'B', 20, 1, 6, 4);
      await createCard('text', 'C', 1, 10, 6, 4);
      await cdp.evalJs('(function(){ window.switchPreset("tablet"); })()');
      await sleep(600);
      await cdp.evalJs('(function(){ window.switchPreset("169"); })()');
      await sleep(700);
      const cards = await readCards();
      const B = cardByLabel(cards, 'B'), C = cardByLabel(cards, 'C');
      await cdp.evalJs('(function(){ window.saveDraft(); })()');
      const draft = await cdp.evalJs("JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}')");
      const tKeys = Object.keys((draft.presets && draft.presets.tablet && draft.presets.tablet.cards) || {});
      const dKeys = Object.keys((draft.presets && draft.presets['169'] && draft.presets['169'].cards) || {});
      ok('B9 未动过不落盘：tablet/169 表均空 + custom falsy + 回 169 重新 auto-flow 单列全宽',
        tKeys.length === 0 && dKeys.length === 0 &&
        !draft.presets.tablet.custom && !draft.presets['169'].custom &&
        B.colSpan === '115' && B.row === '7' && C.colSpan === '115' && C.row === '13',
        JSON.stringify({ tKeys: tKeys.length, dKeys: dKeys.length, B: { colSpan: B.colSpan, row: B.row }, C: { colSpan: C.colSpan, row: C.row } }));
    }

    // ═══ B10 增删同步 ═══
    {
      await setWinName(''); await nav(BASE + EDITOR_URL_PATH, "document.getElementById('undoBtn') && window.switchPreset", 'B10 nav');
      await createCard('text', 'A', 1, 1, 6, 4);
      await createCard('text', 'B', 20, 1, 6, 4);
      await createCard('text', 'C', 1, 10, 6, 4);
      await cdp.evalJs('(function(){ window.switchPreset("tablet"); })()');
      await sleep(600);
      await cdp.evalJs('(function(){ window.markPresetCustom(); })()');
      await createCard('text', 'D', 50, 1, 6, 4);
      await cdp.evalJs('(function(){ window.saveDraft(); })()');
      let draft = await cdp.evalJs("JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}')");
      const tKeys4 = Object.keys(draft.presets.tablet.cards);
      ok('B10a 增：tablet 表 4 卡（含 D）+ draft.cards 4（增同步）',
        tKeys4.length === 4 && tKeys4.indexOf('c4') !== -1 && draft.cards.length === 4,
        JSON.stringify({ tKeys: tKeys4, cards: draft.cards.map(x => x.id) }));
      await cdp.evalJs("(function(){ var d = document.querySelector('#gridCanvas .grid-card[data-label=\"D\"]'); window.selectCard(d); return true; })()");
      await cdp.evalJs('(function(){ window.deleteSelectedCard(); })()');
      await sleep(900);
      const domCount = await cdp.evalJs("document.querySelectorAll('#gridCanvas .grid-card').length");
      await cdp.evalJs('(function(){ window.saveDraft(); })()');
      draft = await cdp.evalJs("JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}')");
      const tKeys3 = Object.keys(draft.presets.tablet.cards);
      ok('B10b 删：D 消失 + tablet 表 3 卡 + draft.cards 3（删同步）',
        domCount === 3 && tKeys3.length === 3 && tKeys3.indexOf('c4') === -1 && draft.cards.length === 3,
        JSON.stringify({ dom: domCount, tKeys: tKeys3, cards: draft.cards.map(x => x.id) }));
    }

    // ═══ B11 旧草稿 clamp ═══
    {
      await setWinName('__FCSEED__' + JSON.stringify(SEED_LEGACY));
      await nav(BASE + EDITOR_URL_PATH, "document.querySelectorAll('#gridCanvas .grid-card').length === 1", 'B11 nav');
      await sleep(900);
      const f = await cdp.evalJs(FIXED_EXPR);
      const cards = await readCards();
      const c1 = cardByLabel(cards, 'Legacy');
      await cdp.evalJs('(function(){ window.saveDraft(); })()');
      const draft = await cdp.evalJs("JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}')");
      ok('B11 旧 115 格 tablet 表 clamp：col 112→101 / colSpan 10 / left 2200px + custom falsy（表非空守卫不触发；表保持原值 112 不落新）',
        f.cols === '110' && c1.col === '101' && c1.colSpan === '10' && c1.left === '2200px' && c1.top === '0px' &&
        draft.presets.tablet.cards.c1.col === 112 && !draft.presets.tablet.custom,
        JSON.stringify({ cols: f.cols, c1: { col: c1.col, colSpan: c1.colSpan, left: c1.left }, savedCol: draft.presets.tablet.cards.c1.col, custom: draft.presets.tablet.custom }));
      await setWinName('');
    }

    // ═══ B12 竖屏 seed 往返 ═══
    {
      await setWinName('__FCSEED__' + JSON.stringify(SEED_PORTRAIT));
      await nav(BASE + EDITOR_URL_PATH, "document.querySelectorAll('#gridCanvas .grid-card').length === 1", 'B12 nav');
      await sleep(900);
      let f = await cdp.evalJs(FIXED_EXPR);
      await cdp.evalJs('(function(){ window.saveDraft(); })()');
      let draft = await cdp.evalJs("JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}')");
      const pKeys = Object.keys(draft.presets['tablet-p'].cards);
      ok('B12a 竖屏 seed：cols 77 / 画布高 2420 / rotateBtn active+aria-pressed / 种子守卫填 tablet-p 表（custom true + c1(2,2)）',
        f.cols === '77' && f.h === 2420 && f.rbActive === true && f.rbPressed === 'true' &&
        f.rwShow === true && f.rotP !== 'none' && f.rotL === 'none' &&
        draft.activePreset === 'tablet-p' && draft.tabletOrientation === 'p' &&
        draft.presets['tablet-p'].custom === true && pKeys.length === 1 &&
        draft.presets['tablet-p'].cards.c1.col === 2 && draft.presets['tablet-p'].cards.c1.row === 2,
        JSON.stringify({ cols: f.cols, h: f.h, activePreset: draft.activePreset, orientation: draft.tabletOrientation, custom: draft.presets['tablet-p'].custom, c1: draft.presets['tablet-p'].cards.c1 }));
      await cdp.evalJs('(function(){ window.rotateTablet(); })()');
      await sleep(700);
      f = await cdp.evalJs(FIXED_EXPR);
      await cdp.evalJs('(function(){ window.saveDraft(); })()');
      draft = await cdp.evalJs("JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}')");
      ok('B12b 旋转→tablet：cols 110 / aria-pressed false / orientation l',
        f.cols === '110' && f.rbPressed === 'false' && draft.activePreset === 'tablet' && draft.tabletOrientation === 'l',
        JSON.stringify({ cols: f.cols, activePreset: draft.activePreset, orientation: draft.tabletOrientation }));
      await setWinName('');
    }

    // ═══ C 阅读页 CDP ═══
    console.log('═══ C 阅读页 CDP ═══');
    const setViewport = async (w, h, orient) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: w, height: h, deviceScaleFactor: 1, mobile: false,
        screenOrientation: orient || { type: 'landscapePrimary', angle: 0 }
      });
      await sleep(1200);
    };
    const readStage = () => cdp.evalJs(STAGE_EXPR);

    // C0 orientation 自检
    await setViewport(1000, 700, { type: 'landscapePrimary', angle: 0 });
    const landPortrait = await cdp.evalJs("window.matchMedia('(orientation: portrait)').matches");
    await setViewport(1000, 1400, { type: 'portraitPrimary', angle: 90 });
    const portPortrait = await cdp.evalJs("window.matchMedia('(orientation: portrait)').matches");
    const orientOK = (landPortrait === false && portPortrait === true);
    ok('C0 matchMedia orientation 随 Emulation 翻转（landscape→false / portrait→true）', orientOK,
      'land=' + landPortrait + ' port=' + portPortrait);

    // C1 169 等价路径（force 无关、1280 宽自然选 169）
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    await setViewport(1280, 900, { type: 'landscapePrimary', angle: 0 });
    await setWinName('');
    await nav(BASE + ARTICLE_URL_PATH + '?id=ART-CLOUD1', "document.querySelectorAll('#artBody .art-card').length === 6", 'C1 nav');
    {
      const st = await readStage();
      const c1 = await cdp.evalJs(boxExpr('c1')), c2 = await cdp.evalJs(boxExpr('c2')), c3 = await cdp.evalJs(boxExpr('c3'));
      const c4 = await cdp.evalJs(boxExpr('c4')), c5 = await cdp.evalJs(boxExpr('c5')), c6 = await cdp.evalJs(boxExpr('c6'));
      ok('C1 169 等价路径：stage 2530×2090 / cell 22px / 顶层 x/y 旧公式精确（回归零变动）',
        st && !st.reflow && st.w === 2530 && st.h === 2090 && st.cell === '22px' &&
        approx(c1.l, 24) && approx(c1.t, 24) && approx(c1.w, 300) &&
        approx(c2.l, 24) && approx(c2.t, 244) && approx(c2.w, 262) &&
        approx(c3.l, 288) && approx(c3.t, 244) && approx(c3.w, 130) &&
        approx(c4.l, 552) && approx(c4.t, 244) && approx(c4.w, 262) &&
        approx(c5.l, 24) && approx(c5.t, 662) && approx(c5.w, 174) && c5.h >= 174 &&
        approx(c6.l, 24) && approx(c6.t, 902) && approx(c6.w, 200) && approx(c6.h, 100),
        JSON.stringify({ st: st, c1: c1, c2: c2, c3: c3, c4: c4, c5: c5, c6: c6 }));
    }

    // C2 平板横向自然选（1000×700 landscape）
    await setViewport(1000, 700, { type: 'landscapePrimary', angle: 0 });
    await nav(BASE + ARTICLE_URL_PATH + '?id=ART-CLOUD1', "document.querySelectorAll('#artBody .art-card').length === 6", 'C2 nav');
    {
      const st = await readStage();
      const c1 = await cdp.evalJs(boxExpr('c1')), c2 = await cdp.evalJs(boxExpr('c2')), c3 = await cdp.evalJs(boxExpr('c3'));
      const c4 = await cdp.evalJs(boxExpr('c4')), c5 = await cdp.evalJs(boxExpr('c5')), c6 = await cdp.evalJs(boxExpr('c6'));
      ok('C2 tablet auto-flow：stage 2420 / cell 22px / 2-卡行精确偏移（spanPx+24 口径）',
        st && !st.reflow && st.w === 2420 && st.h >= 2244 && st.h <= 2244 + 44 && st.cell === '22px' &&
        approx(c1.l, 24) && approx(c1.t, 24) && approx(c1.w, 130) &&
        approx(c2.l, 154) && approx(c2.t, 24) && approx(c2.w, 262) &&
        approx(c3.l, 24) && approx(c3.t, 154) && approx(c3.w, 130) &&
        approx(c4.l, 154) && approx(c4.t, 154) && approx(c4.w, 262) &&
        approx(c5.l, 24) && approx(c5.t, 286) && approx(c5.w, 174) &&
        approx(c6.l, 198) && approx(c6.t, 286) && approx(c6.w, 200) && approx(c6.h, 100),
        JSON.stringify({ st: st, c1: c1, c2: c2, c3: c3, c4: c4, c5: c5, c6: c6 }));
    }

    // C3 平板竖向（自然优先；不翻转则强制钩兜底）
    await setViewport(1000, 1400, { type: 'portraitPrimary', angle: 90 });
    let st3 = await readStage();
    let c3Natural = false;
    try {
      await waitFor(cdp, "(function(){ var i = document.querySelector('.art-canvas-inner'); return i && i.offsetWidth === 1694; })()", 4000, 'C3 tablet-p 重渲染');
      c3Natural = true;
      st3 = await readStage();
    } catch (e) { /* 不翻转 → 强制钩 */ }
    if (!c3Natural) {
      await setWinName('__FCXLAYOUT__tablet-p');
      await nav(BASE + ARTICLE_URL_PATH + '?id=ART-CLOUD1', "document.querySelectorAll('#artBody .art-card').length === 6", 'C3 force nav');
      st3 = await readStage();
      await setWinName('');
    }
    {
      const c1 = await cdp.evalJs(boxExpr('c1')), c2 = await cdp.evalJs(boxExpr('c2')), c3 = await cdp.evalJs(boxExpr('c3'));
      const c4 = await cdp.evalJs(boxExpr('c4')), c5 = await cdp.evalJs(boxExpr('c5')), c6 = await cdp.evalJs(boxExpr('c6'));
      ok('C3 tablet-p（' + (c3Natural ? '自然竖屏选' : '强制钩兜底') + '）：stage 1694 / 同款 2-卡行偏移',
        st3 && !st3.reflow && st3.w === 1694 && st3.h >= 2970 && st3.h <= 2970 + 44 && st3.cell === '22px' &&
        approx(c1.l, 24) && approx(c1.t, 24) && approx(c2.l, 154) && approx(c2.t, 24) &&
        approx(c3.l, 24) && approx(c3.t, 154) && approx(c4.l, 154) && approx(c4.t, 154) &&
        approx(c5.l, 24) && approx(c5.t, 286) && approx(c6.l, 198) && approx(c6.t, 286) && approx(c6.w, 200) && approx(c6.h, 100),
        JSON.stringify({ st: st3, c1: c1, c2: c2, c3: c3, c4: c4, c5: c5, c6: c6 }));
    }

    // C4 手机（400×800 自然 mobile + reflow）
    await setWinName('');
    await setViewport(400, 800, { type: 'portraitPrimary', angle: 90 });
    await waitFor(cdp, "document.querySelector('.art-canvas-reflow')", 8000, 'C4 reflow');
    {
      const st = await readStage();
      const bandInfo = await cdp.evalJs("(function(){ var order = [], tops = [];" +
        " document.querySelectorAll('.art-reflow-band').forEach(function(b){" +
        "  var ids = []; b.querySelectorAll('.art-card').forEach(function(c){ ids.push(c.dataset.cardId); });" +
        "  order.push(ids.join(',')); tops.push(b.offsetTop); });" +
        " var c6 = document.querySelector('#artBody .art-card[data-card-id=\"c6\"]');" +
        " return { order: order.join('|'), tops: tops," +
        "  c6Shrink: c6 ? c6.classList.contains('art-card-shrink') : false," +
        "  c6Ar: c6 ? c6.style.getPropertyValue('--art-ar').trim() : ''," +
        "  flexCount: document.querySelectorAll('.art-card-flexible').length }; })()");
      const inc = bandInfo.tops.every((t, i) => i === 0 || t > bandInfo.tops[i - 1]);
      ok('C4 mobile：reflow + 6 带各 1 卡 c1..c6 序 + c1-c5 flexible + c6 shrink(--art-ar 200/100) + cell 20px + 带顶递增',
        st && st.reflow && st.bands === 6 && st.cards === 6 && st.cell === '20px' &&
        bandInfo.order === 'c1|c2|c3|c4|c5|c6' && inc && bandInfo.flexCount === 5 &&
        bandInfo.c6Shrink === true && bandInfo.c6Ar === '200 / 100',
        JSON.stringify({ st: st, bandInfo: bandInfo }));
    }

    // C5 half 表 clamp+append（强制钩；2200 宽保 avail ≥ bboxW 1554）
    await setWinName('__FCXLAYOUT__half');
    await setViewport(2200, 1300, { type: 'landscapePrimary', angle: 0 });
    await nav(BASE + ARTICLE_URL_PATH + '?id=ART-CLOUD1', "document.querySelectorAll('#artBody .art-card').length === 6", 'C5 nav');
    {
      const st = await readStage();
      const c1 = await cdp.evalJs(boxExpr('c1')), c2 = await cdp.evalJs(boxExpr('c2')), c3 = await cdp.evalJs(boxExpr('c3'));
      const c4 = await cdp.evalJs(boxExpr('c4')), c5 = await cdp.evalJs(boxExpr('c5')), c6 = await cdp.evalJs(boxExpr('c6'));
      ok('C5 half 表：stage 1508 / cell 26px / 表内卡精确偏移 + 缺卡 c5 append 表底全宽 58',
        st && !st.reflow && st.w === 1508 && st.h >= 2470 && st.h <= 2470 + 52 && st.cell === '26px' &&
        approx(c1.l, 1036) && approx(c1.t, 24) && approx(c1.w, 154) &&
        approx(c2.l, 24) && approx(c2.t, 256) && approx(c2.w, 102) &&
        approx(c3.l, 152) && approx(c3.t, 256) && approx(c3.w, 102) &&
        approx(c4.l, 282) && approx(c4.t, 256) && approx(c4.w, 154) &&
        approx(c6.l, 776) && approx(c6.t, 620) && approx(c6.w, 200) && approx(c6.h, 100) &&
        approx(c5.l, 24) && approx(c5.t, 750) && approx(c5.w, 1506),
        JSON.stringify({ st: st, c1: c1, c2: c2, c3: c3, c4: c4, c5: c5, c6: c6 }));
    }
    await setWinName('');

    // C6 auto-flow 与编辑器同款数学（ART-CLOUD2 空表）
    await setWinName('__FCXLAYOUT__tablet');
    await setViewport(1100, 700, { type: 'landscapePrimary', angle: 0 });
    await nav(BASE + ARTICLE_URL_PATH + '?id=ART-CLOUD2', "document.querySelectorAll('#artBody .art-card').length === 6", 'C6 tablet nav');
    {
      const st = await readStage();
      const s1 = await cdp.evalJs(boxExpr('s1')), s2 = await cdp.evalJs(boxExpr('s2')), s3 = await cdp.evalJs(boxExpr('s3'));
      const c4 = await cdp.evalJs(boxExpr('c4')), t5 = await cdp.evalJs(boxExpr('t5')), f6 = await cdp.evalJs(boxExpr('f6'));
      ok('C6a tablet auto-flow：stage 2420 / 2-卡行 + aspect 13 列（与编辑器 B5a 同款数学）',
        st && !st.reflow && st.w === 2420 && st.h >= 2244 && st.h <= 2244 + 44 &&
        approx(s1.l, 24) && approx(s1.t, 24) && approx(s1.w, 130) &&
        approx(s2.l, 154) && approx(s2.t, 24) && approx(s2.w, 86) &&
        approx(s3.l, 24) && approx(s3.t, 176) && approx(s3.w, 174) &&
        approx(c4.l, 198) && approx(c4.t, 176) && approx(c4.w, 658) &&
        approx(t5.l, 24) && approx(t5.t, 352) && approx(t5.w, 262) &&
        approx(f6.l, 286) && approx(f6.t, 352) && approx(f6.w, 200) && approx(f6.h, 100),
        JSON.stringify({ st: st, s1: s1, s2: s2, s3: s3, c4: c4, t5: t5, f6: f6 }));
    }
    await setWinName('__FCXLAYOUT__half');
    await setViewport(1600, 900, { type: 'landscapePrimary', angle: 0 });
    await nav(BASE + ARTICLE_URL_PATH + '?id=ART-CLOUD2', "document.querySelectorAll('#artBody .art-card').length === 6", 'C6 half nav');
    {
      const st = await readStage();
      const s1 = await cdp.evalJs(boxExpr('s1')), s2 = await cdp.evalJs(boxExpr('s2')), s3 = await cdp.evalJs(boxExpr('s3'));
      const c4 = await cdp.evalJs(boxExpr('c4')), t5 = await cdp.evalJs(boxExpr('t5')), f6 = await cdp.evalJs(boxExpr('f6'));
      ok('C6b half auto-flow：stage 1508 / 4-卡行 + 长文挤下 s3 + text 12→24（与编辑器 B5b 同款数学）',
        st && !st.reflow && st.w === 1508 && st.h === 2470 &&
        approx(s1.l, 24) && approx(s1.t, 24) && approx(s1.w, 154) &&
        approx(s2.l, 178) && approx(s2.t, 24) && approx(s2.w, 102) &&
        approx(c4.l, 282) && approx(c4.t, 24) && approx(c4.w, 778) &&
        approx(s3.l, 24) && approx(s3.t, 230) && approx(s3.w, 206) &&
        approx(t5.l, 230) && approx(t5.t, 230) && approx(t5.w, 622) &&
        approx(f6.l, 854) && approx(f6.t, 230) && approx(f6.w, 200) && approx(f6.h, 100),
        JSON.stringify({ st: st, s1: s1, s2: s2, s3: s3, c4: c4, t5: t5, f6: f6 }));
    }
    await setWinName('');

    // C7 组读者（ART-CLOUD3：合并=一卡 + 手机展开）
    await setWinName('__FCXLAYOUT__tablet');
    await setViewport(1100, 700, { type: 'landscapePrimary', angle: 0 });
    await nav(BASE + ARTICLE_URL_PATH + '?id=ART-CLOUD3', "document.querySelectorAll('#artBody .art-card').length === 3", 'C7 tablet nav');
    {
      const g1 = await cdp.evalJs(boxExpr('g1')), g2 = await cdp.evalJs(boxExpr('g2')), g3 = await cdp.evalJs(boxExpr('g3'));
      ok('C7a tablet 合并卡=一单位：solo(1,1) + 组员同排相对偏移保持（154/286）',
        approx(g1.l, 24) && approx(g1.t, 24) && approx(g1.w, 130) &&
        approx(g2.l, 154) && approx(g2.t, 24) && approx(g2.w, 130) &&
        approx(g3.l, 286) && approx(g3.t, 24) && approx(g3.w, 130),
        JSON.stringify({ g1: g1, g2: g2, g3: g3 }));
    }
    await setWinName('__FCXLAYOUT__mobile');
    await setViewport(400, 800, { type: 'portraitPrimary', angle: 90 });
    await nav(BASE + ARTICLE_URL_PATH + '?id=ART-CLOUD3', "document.querySelector('.art-canvas-reflow')", 'C7 mobile nav');
    {
      const st = await readStage();
      const bandInfo = await cdp.evalJs("(function(){ var order = [];" +
        " document.querySelectorAll('.art-reflow-band').forEach(function(b){" +
        "  var ids = []; b.querySelectorAll('.art-card').forEach(function(c){ ids.push(c.dataset.cardId); });" +
        "  order.push(ids.join(',')); });" +
        " return { order: order.join('|'), flexCount: document.querySelectorAll('.art-card-flexible').length }; })()");
      ok('C7b mobile 组展开：3 带各 1 卡 g1|g2|g3 序（组展开纵向）+ 全 flexible',
        st && st.reflow && st.bands === 3 && st.cards === 3 && bandInfo.flexCount === 3 &&
        bandInfo.order === 'g1|g2|g3',
        JSON.stringify({ st: st, bandInfo: bandInfo }));
    }
    await setWinName('');

    // ═══ E 零异常 ═══
    {
      const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
      const realErrs = cdp.errs.filter(e => !noise.test(e));
      ok('E 零异常（Runtime exception + 控制台 error 全滤噪声后）', realErrs.length === 0,
        realErrs.slice(0, 3).join(' | '));
    }
    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    fail++;
    try { cdp && cdp.close(); } catch (e2) {}
  }
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  try { server.close(); } catch (e) {}

  console.log('\n═══ ' + (fail === 0 ? 'ALL GREEN' : 'FAILED') + ' — ' + pass + '/' + (pass + fail) + ' ═══');
  process.exit(fail === 0 ? 0 : 1);
})();
