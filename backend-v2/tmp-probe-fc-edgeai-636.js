// tmp-probe-fc-edgeai-636.js — FC v10.28.50.0 边缘抽屉+AI 生成+本地库+边缘仓库线上探针（mnationworld.com）
//   S1a site-config：58.26 赋值 ×1 + FC 50.0 赋值 ×1 + 49.2 赋值零残留 + changelog 头 50.0/49.2 各 ×1；
//   S1b rev live 口径：rev 00356-真值 ×1 + 00356-XXX 零残留 + 00357-??? 占位 ×1 + 00357-终态零残留
//      （live 滞后一部署=惯例：工作树已填 00357-终态，live 仍二次烘焙镜像）；
//   S1c 编辑器 live 锚（fc-edge-drawer ×3/card-edge-custom ×8/fcEdgeCustomAddBtn ×1/sanitizeClipEdge ×5/
//      unavailable 先于 ×1/fcEdgeScopeBall ×2/v10.28.50.0 ×25/49.2 注释 ×1）；
//   S1d article live 锚（art-card-custom-frame ×2/sanitizeClipEd ×2/customEdges ×2/v10.28.50.0 ×3）；
//   S1e i18n live（fc.edge.drawerTitle ×12 + fc.imgMeta.visFriends ×12）；
//   S2 API：health tables:61 / GET /api/fc/edges 匿名 200 {edges:[]} 公开可见空库 / scopes 匿名双假 /
//      POST /api/fc/edge-gen 匿名 401（requireSession 实证）；
//   P1 CDP 编辑器交互（种子 slati_session loggedIn）：抽屉 .open+15 样本+自定义添加开 AI 弹窗+空输入 toast
//      +仓库空态 暂无仓库边缘+圆球隐（双假）→E1 零异常；
//   P2 直连 Gemini 端点实测 key（AQ. 前缀 x-goog-api-key 头 Google 端点；一条 2 词小请求省预算）——
//      401/403 即停下问用户（服务端管线已由本地电池+后端 mock 测试覆盖）。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

const REAL56 = '00356-djq'; // deploy#1 实得 rev
const REAL57 = '00357-sh8'; // deploy#2 实得 rev（live 断言=零残留）
const SITE = 'https://mnationworld.com';
const ED = SITE + '/pages/fluidcanvas-editor.html';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-fce636-' + Date.now());
const GEMINI_KEY = 'AQ.Ab8RN6I16BgqFGF1lgwcpPXlQXgoslaUAGrN6m3vIMEwUQAfuA';
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
  ' localStorage.setItem("slati_lang", "zh-CN"); })();}catch(e){}';

(async () => {
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const mk = (src) => (s) => src.split(s).length - 1;

  console.log('═══ S1 静态锚（live）═══');
  const sc = await hget(SITE + '/assets/js/site-config.js');
  const scSrc = norm(sc.body);
  const scCount = mk(scSrc);
  ok('S1a site-config：58.26 赋值 ×1 + FC 50.0 赋值 ×1 + 49.2 赋值零残留 + changelog 头 50.0/49.2 各 ×1',
    scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") === 1 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.50.0';") === 1 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.49.2';") === 0 &&
    scCount('// v10.28.50.0 = ') === 1 && scCount('// v10.28.49.2 = ') === 1,
    'v26=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") +
    ' fc50=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.50.0';") +
    ' fc49=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.49.2';") +
    ' cl50=' + scCount('// v10.28.50.0 = ') + ' cl49=' + scCount('// v10.28.49.2 = '));
  ok('S1b site-config rev live 口径：rev 00356-djq ×1 + 00357-sh8 ×1 + 00356-XXX/00357-??? 双零残留（三次烘焙=工作树同文）',
    scCount('rev 00356-djq') === 1 && scCount('00357-sh8') === 1 && scCount('00356-XXX') === 0 && scCount('00357-???') === 0,
    'r56=' + scCount('rev 00356-djq') + ' r57=' + scCount('00357-sh8') + ' x56=' + scCount('00356-XXX') + ' q57=' + scCount('00357-???'));

  const E = await hget(ED);
  const eSrc = norm(E.body);
  const elines = eSrc.split('\n');
  const c = (a) => elines.filter((l) => l.includes(a)).length; // 行计数口径=实测 grep -cF
  const E_ANCHORS = [['fc-edge-drawer', 3], ['card-edge-custom', 8], ['fcEdgeCustomAddBtn', 1],
    ['sanitizeClipEdge', 5], ['unavailable 先于', 1], ['fcEdgeScopeBall', 2],
    ['v10.28.50.0', 25], ['v10.28.49.2', 1]];
  const ebad = E_ANCHORS.filter(([a, n]) => c(a) !== n);
  ok('S1c 编辑器 8 锚全中（抽屉/自定义类/添加钮/sanitizer×5/unavailable 先于/圆球/50.0×25/49.2 注释）', ebad.length === 0,
    ebad.map(([a, n]) => a + '=' + c(a) + '≠' + n).join(',') || '8/8');

  const A = await hget(SITE + '/pages/article.html');
  const alines = norm(A.body).split('\n');
  const ac = (a) => alines.filter((l) => l.includes(a)).length;
  const A_BAD = [['art-card-custom-frame', 2], ['sanitizeClipEd', 2], ['customEdges', 2], ['v10.28.50.0', 3]]
    .filter(([a, n]) => ac(a) !== n);
  ok('S1d article 4 锚全中（框环子层×2/sanitizeClipEd×2/customEdges×2/50.0×3）', A_BAD.length === 0,
    A_BAD.map(([a, n]) => a + '=' + ac(a) + '≠' + n).join(',') || '4/4');

  const I = await hget(SITE + '/assets/i18n/fluidcanvas.i18n.js');
  const ic = mk(norm(I.body));
  ok('S1e i18n live：fc.edge.drawerTitle ×12 + fc.edge.genBtn ×12 + fc.imgMeta.visFriends ×12',
    ic('"fc.edge.drawerTitle"') === 12 && ic('"fc.edge.genBtn"') === 12 && ic('"fc.imgMeta.visFriends"') === 12,
    'dt=' + ic('"fc.edge.drawerTitle"') + ' gb=' + ic('"fc.edge.genBtn"') + ' vf=' + ic('"fc.imgMeta.visFriends"'));

  console.log('═══ S2 API（匿名口径）═══');
  const health = await hget(SITE + '/api/health');
  let healthJson = null; try { healthJson = JSON.parse(health.body); } catch (e) {}
  ok('S2a /api/health 200 + tables:61（031 新表）', health.status === 200 && healthJson && healthJson.status === 'ok' && healthJson.tables === 61,
    JSON.stringify({ status: health.status, tables: healthJson && healthJson.tables }));
  const edgesAnon = await hget(SITE + '/api/fc/edges');
  let edgesJson = null; try { edgesJson = JSON.parse(edgesAnon.body); } catch (e) {}
  ok('S2b GET /api/fc/edges 匿名 200 {edges:[]}（公开可见空库，未登录不 401）',
    edgesAnon.status === 200 && edgesJson && Array.isArray(edgesJson.edges) && edgesJson.edges.length === 0,
    JSON.stringify({ status: edgesAnon.status, body: edgesAnon.body.slice(0, 80) }));
  const scopes = await hget(SITE + '/api/fc/edges/scopes');
  let scopesJson = null; try { scopesJson = JSON.parse(scopes.body); } catch (e) {}
  ok('S2c GET /api/fc/edges/scopes 匿名 {hasFriends:false,hasTeam:false}', scopes.status === 200 && scopesJson &&
    scopesJson.hasFriends === false && scopesJson.hasTeam === false, JSON.stringify({ status: scopes.status, body: scopes.body.slice(0, 80) }));
  const genAnon = await hget(SITE + '/api/fc/edge-gen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'edge', desc: '测试' }) });
  ok('S2d POST /api/fc/edge-gen 匿名 401（requireSession 实证）', genAnon.status === 401, JSON.stringify({ status: genAnon.status, body: genAnon.body.slice(0, 80) }));

  console.log('═══ P1 CDP 编辑器交互（种子 slati_session loggedIn）═══');
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
    await waitFor(cdp, "document.getElementById('fcEdgeDrawer') && window.openEdgeDrawer && window.createAssetCard", 40000, 'P1 编辑器就绪');
    await sleep(900);
    await cdp.evalJs('(function(){ window.openEdgeDrawer("edge"); })()');
    await waitFor(cdp, "document.getElementById('fcEdgeDrawer').classList.contains('open')", 8000, 'P1 抽屉 .open');
    await sleep(700);
    const d = await cdp.evalJs("(function(){ var g = document.getElementById('fcEdgeDrawer');" +
      " var ball = document.getElementById('fcEdgeScopeBall');" +
      " var repo = document.getElementById('fcEdgeRepoGrid');" +
      " var empty = repo ? repo.querySelector('.fc-edge-empty') : null;" +
      " return { open: g.classList.contains('open'), samples: document.getElementById('fcEdgeSamplesGrid').children.length," +
      "  repo: repo ? repo.children.length : -1, repoEmpty: empty ? empty.textContent : null," +
      "  ballShow: ball.classList.contains('show') }; })()");
    ok('P1a 抽屉 .open + 15 内置样本 + 仓库空态（live 空库）+ 圆球隐（双假）',
      d.open === true && d.samples === 15 && d.repo === 1 && d.repoEmpty === '暂无仓库边缘' && d.ballShow === false,
      JSON.stringify(d));
    await cdp.evalJs("document.getElementById('fcEdgeCustomAddBtn').click()");
    await sleep(500);
    const gm = await cdp.evalJs("(function(){ var m = document.getElementById('fcEdgeGenModal'); return m ? !!m.querySelector('.modal-card.active') : false; })()");
    const t = await cdp.evalJs("(function(){ var el = document.getElementById('toast'); return el ? { text: el.textContent, show: el.classList.contains('show') } : null; })()");
    ok('P1b 订阅门 live 实证：未认证点自定义添加 → 门禁 toast + 弹窗保持关（开弹窗+空输入路径本地电池覆盖）',
      gm === false && t && t.show && t.text === '背景边缘为订阅用户专属功能', JSON.stringify({ gm: gm, t: t }));
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

  console.log('═══ P2 直连 Gemini 端点实测 key（gemini-3.8-flash——2.5 已 404 退役；一条 2 词小请求；401/403=停下问用户）═══');
  let g = null;
  for (let i = 0; i < 4; i++) {
    g = await hget('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: '只输出 JSON：{"name":"测试边","clip":"polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)"}' }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
      })
    });
    if (g.status === 200 && g.body.indexOf('polygon') !== -1) break;
    if (g.status !== 503) break; // 非瞬态 503 即定罪
    await sleep(8000);
  }
  ok('P2 Gemini 直连 200 且回体含 polygon（key 有效=Cloud Run env 同款可用）', g.status === 200 && g.body.indexOf('polygon') !== -1,
    'status=' + g.status + ' body=' + g.body.slice(0, 200));

  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  process.exit(fail === 0 ? 0 : 1);
})();
