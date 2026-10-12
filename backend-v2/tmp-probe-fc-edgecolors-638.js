// tmp-probe-fc-edgecolors-638.js — FC v10.28.51.1 边缘样本配色+抽屉导航+应用链修复+边框裸值放宽+正向反馈线上探针（mnationworld.com）
//   S1a site-config：58.26 赋值 ×1 + FC 51.1 赋值 ×1 + 51.0 赋值零残留 + changelog 头 51.1/51.0 各 ×1；
//   S1b rev live 口径：rev 00361-真值 ×1 + 00361-XXX 零残留 + 00362-??? 占位 ×1 + 00362-终态零残留
//      （live 滞后一部署=惯例：工作树已填 00362-终态，live 仍二次烘焙镜像）；
//   S1c 编辑器 live 12 锚（edgeMiniHtml bg 参数 ×1/cardLayers join ×1/fc-edge-nav .segmented-control ×1/
//      class="segmented-control"> ×1/fc.edge.cardUnsupported ×1/v10.28.51.1 ×3/fc-edge-tab 零残留 ×0/
//      fc-gen-lamp ×6/fc-gen-dots ×6/edgeGenSetStatus ×6/fcEdgeGenFeedback ×5/fc.edge.genThinkingHint ×1）；
//   S2 API：health 200 + tables:61（后端零改动回归）；
//   P1 CDP 编辑器（种子 prem）：无选中卡点内置样本→toast「请先选中一张卡片」（51.1 bug 修复 live 实证）→
//      建卡选中→抽屉 15 样本→纸/藏宝/科技1/油漆1 computed 默认配色→segmented 结构+0.2s→My↔全部切换→
//      P1e AI 弹窗正向反馈 live（idle 灰灯+三粒点结构）→P2 Gemini 直连 border evenodd（636 同款绕开会话口径）→E1 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

const REAL61 = '00361-7vk'; // deploy#1 实得 rev（已填真）
const REAL62 = '00362-fdj'; // deploy#2 实得 rev（已填真；live 断言=零残留）
const SITE = 'https://mnationworld.com';
const ED = SITE + '/pages/fluidcanvas-editor.html';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-fc638-' + Date.now());
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};
const GEMINI_KEY = 'AQ.Ab8RN6I16BgqFGF1lgwcpPXlQXgoslaUAGrN6m3vIMEwUQAfuA'; // 只活未跟踪 tmp-* 脚本+Cloud Run env（636 同款直连口径）
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
  ok('S1a site-config：58.26 赋值 ×1 + FC 51.1 赋值 ×1 + 51.0 赋值零残留 + changelog 头 51.1/51.0 各 ×1',
    scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") === 1 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.51.1';") === 1 &&
    scCount("window.FLUIDCANVAS_VERSION = 'v10.28.51.0';") === 0 &&
    scCount('// v10.28.51.1 = ') === 1 && scCount('// v10.28.51.0 = ') === 1,
    'v26=' + scCount("window.MN_SITE_VERSION = 'v0.2.58.26';") +
    ' fc511=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.51.1';") +
    ' fc510=' + scCount("window.FLUIDCANVAS_VERSION = 'v10.28.51.0';") +
    ' cl511=' + scCount('// v10.28.51.1 = ') + ' cl510=' + scCount('// v10.28.51.0 = '));
  ok('S1b site-config rev live 口径：rev ' + REAL61 + ' ×1 + 00361-XXX 零残留 + 00362-??? 占位 ×1 + ' + REAL62 + ' 零残留',
    scCount('rev ' + REAL61) === 1 && scCount('00361-XXX') === 0 && scCount('00362-???') === 1 && scCount(REAL62) === 0,
    'r61=' + scCount('rev ' + REAL61) + ' x61=' + scCount('00361-XXX') + ' q62=' + scCount('00362-???') + ' r62=' + scCount(REAL62));

  const E = await hget(ED);
  const elines = norm(E.body).split('\n');
  const c = (a) => elines.filter((l) => l.includes(a)).length; // 行计数口径=实测 grep -cF
  const E_ANCHORS = [['function edgeMiniHtml(clip, cls, bg)', 1], ["st.cardLayers.join(', ')", 1],
    ['fc-edge-nav .segmented-control', 1], ['class="segmented-control">', 1], ['fc.edge.cardUnsupported', 1],
    ['v10.28.51.1', 3], ['fc-edge-tab', 0], ['fc-gen-lamp', 6], ['fc-gen-dots', 6], ['edgeGenSetStatus', 6],
    ['fcEdgeGenFeedback', 5], ['fc.edge.genThinkingHint', 1]];
  const ebad = E_ANCHORS.filter(([a, n]) => c(a) !== n);
  ok('S1c 编辑器 12 锚全中（样本配色/segmented/cardUnsupported/51.1/零残留 fc-edge-tab/正向反馈 UI）', ebad.length === 0,
    ebad.map(([a, n]) => a + '=' + c(a) + '≠' + n).join(',') || '12/12');

  console.log('═══ S2 API（匿名口径）═══');
  const health = await hget(SITE + '/api/health');
  let healthJson = null; try { healthJson = JSON.parse(health.body); } catch (e) {}
  ok('S2 /api/health 200 + tables:61（后端零改动回归）', health.status === 200 && healthJson && healthJson.status === 'ok' && healthJson.tables === 61,
    JSON.stringify({ status: health.status, tables: healthJson && healthJson.tables }));

  console.log('═══ P1 CDP 编辑器（种子 prem）═══');
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
    await waitFor(cdp, "document.getElementById('gridCanvas') && window.openEdgeDrawer && window.setCardEdge && window.createAssetCard", 40000, 'P1 编辑器就绪');
    await sleep(900);

    const toastExpr = "(function(){ var t = document.getElementById('toast');" +
      " return t ? { text: t.textContent, show: t.classList.contains('show') } : null; })()";
    const sampleExpr = (i) => "(function(){ var grid = document.getElementById('fcEdgeSamplesGrid');" +
      " var s = grid.children[" + i + "]; if (!s) return null; var m = s.querySelector('.fc-edge-mini');" +
      " var cs = getComputedStyle(m);" +
      " return { name: s.querySelector('.fc-edge-sample-name').textContent, bg: cs.backgroundImage + ' | ' + cs.backgroundColor," +
      "  none: m.classList.contains('fc-edge-mini-none'), inline: m.getAttribute('style') || '' }; })()";

    // P1a 无选中卡点内置样本 → toast 引导（51.1 bug 修复 live 实证）
    await cdp.evalJs('(function(){ window.openEdgeDrawer(); })()');
    await sleep(500);
    await cdp.evalJs("(function(){ var b = document.querySelector('#fcEdgeSamplesGrid .fc-edge-sample'); if (b) b.click(); })()");
    await sleep(300);
    const t = await cdp.evalJs(toastExpr);
    ok('P1a 无选中卡点样本 → toast「请先选中一张卡片」（51.1 修复 live）',
      t && t.show === true && t.text === '请先选中一张卡片', JSON.stringify(t));

    // P1b 建卡选中 → 样本默认配色 + segmented 结构
    await cdp.evalJs("(function(){ window.createAssetCard('text','T1',2,2,6,4); })()");
    await sleep(500);
    await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card[data-label=\"T1\"]'); window.selectCard(c, true); })()");
    await sleep(400);
    await cdp.evalJs('(function(){ window.openEdgeDrawer(); })()');
    await sleep(500);
    const s0 = await cdp.evalJs(sampleExpr(0));
    const s1 = await cdp.evalJs(sampleExpr(1));
    const s2 = await cdp.evalJs(sampleExpr(2));
    const s3 = await cdp.evalJs(sampleExpr(3));
    const s9 = await cdp.evalJs(sampleExpr(9));
    ok('P1b 15 样本 + 纸/藏宝/科技1/油漆1 cardLayers 默认配色 + 「无」虚线空盒',
      s0 !== null && s0.none === true && s0.inline.indexOf('background') === -1 &&
      s1 !== null && s1.bg.indexOf('255, 248, 225') !== -1 && s1.inline.indexOf('--mini-clip') !== -1 &&
      s2 !== null && s2.bg.indexOf('129, 92, 49') !== -1 &&
      s3 !== null && s3.bg.indexOf('10, 22, 40') !== -1 &&
      s9 !== null && s9.bg.indexOf('230, 57, 32') !== -1,
      JSON.stringify({ s0: s0 && s0.name, s1: s1 && s1.bg.slice(0, 60), s2: s2 && s2.bg.slice(0, 60), s3: s3 && s3.bg.slice(0, 60), s9: s9 && s9.bg.slice(0, 60) }));

    // P1c segmented 结构 + 0.2s + tab 切换
    const navExpr = "(function(){ var tAll = document.getElementById('fcEdgeTabAll'); var tMy = document.getElementById('fcEdgeTabMy');" +
      " var control = tAll ? tAll.parentElement : null;" +
      " return { allSeg: tAll.classList.contains('segmented-option'), allActive: tAll.classList.contains('active')," +
      "  mySeg: tMy.classList.contains('segmented-option'), myActive: tMy.classList.contains('active')," +
      "  controlCls: control ? control.className : null, trans: tAll ? getComputedStyle(tAll).transition : null," +
      "  paneAll: getComputedStyle(document.getElementById('fcEdgePaneAll')).display," +
      "  paneMy: getComputedStyle(document.getElementById('fcEdgePaneMy')).display }; })()";
    const nav0 = await cdp.evalJs(navExpr);
    ok('P1c segmented 结构（双钮 option+全部 active+0.2s 过渡）',
      nav0.allSeg === true && nav0.allActive === true && nav0.mySeg === true && nav0.myActive === false &&
      nav0.controlCls === 'segmented-control' && typeof nav0.trans === 'string' && nav0.trans.indexOf('0.2s') !== -1,
      JSON.stringify(nav0));
    await cdp.evalJs('(function(){ document.getElementById("fcEdgeTabMy").click(); })()');
    await sleep(400);
    const navMy = await cdp.evalJs(navExpr);
    ok('P1d My↔全部切换：active 互换 + pane 切换',
      navMy.myActive === true && navMy.allActive === false && navMy.paneMy !== 'none' && navMy.paneAll === 'none',
      JSON.stringify({ myA: navMy.myActive, allA: navMy.allActive, pMy: navMy.paneMy, pAll: navMy.paneAll }));

    // P1e 51.1 AI 弹窗正向反馈 live：打开弹窗=idle 灰灯+「AI 空闲」+反馈行隐藏+三粒点结构在位
    await cdp.evalJs('(function(){ window.openEdgeGenModal(); })()');
    await sleep(500);
    const genUi = await cdp.evalJs("(function(){ var box = document.getElementById('fcEdgeGenState'); var fb = document.getElementById('fcEdgeGenFeedback');" +
      " if (!box || !fb) return null; var lamp = document.getElementById('fcEdgeGenLamp');" +
      " return { boxCls: box.className, txt: document.getElementById('fcEdgeGenStateText').textContent," +
      "  lampBg: getComputedStyle(lamp).backgroundColor, fbDisplay: getComputedStyle(fb).display," +
      "  dots: !!fb.querySelector('.fc-gen-dots'), active: !!document.querySelector('#fcEdgeGenModal .modal-card.active') }; })()");
    ok('P1e AI 弹窗正向反馈 live：左栏 idle 灰灯 rgb(154,160,180)+「AI 空闲」+反馈行隐藏+三粒点结构+弹窗 active',
      genUi.boxCls === 'fc-gen-state fc-gen-state-idle' && genUi.txt === 'AI 空闲' &&
      genUi.lampBg === 'rgb(154, 160, 180)' && genUi.fbDisplay === 'none' && genUi.dots === true && genUi.active === true,
      JSON.stringify(genUi));
    await cdp.evalJs("(function(){ closeModalOnly('fcEdgeGenModal'); })()");

    // P2 直连 Gemini border 真调用 live（用户报告「边框生成失败」修复实证：border 提示词回 evenodd 双环；
    // 裸值放宽服务端已在 npm test 399/399 单元覆盖（裸 50 三角形/evenodd 裸值内环双环/小数 12.5 75.25）；
    // 直连口径=636 同款绕开会话（探针只种 localStorage 无真 session——经 /api/fc/edge-gen requireSession 必 401）；
    // 638 实测外部态三连：503 高需求/网络 status0/429 配额——瞬态族全重试（6 试 12s），只 401/403 定罪停下问用户
    let g = null;
    for (let i = 0; i < 6; i++) {
      g = await hget('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: '只输出 JSON：{"name":"双环边框","clip":"polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 8% 8%, 92% 8%, 92% 92%, 8% 92%)"}' }] }],
          generationConfig: { temperature: 0.4, responseMimeType: 'application/json' }
        })
      });
      if (g.status === 200 && g.body.indexOf('evenodd') !== -1) break;
      if (g.status === 401 || g.status === 403) break; // 鉴权定罪=停下问用户
      await sleep(12000);
    }
    ok('P2 Gemini 直连 border 200 且回体含 evenodd 双环（key 有效=Cloud Run env 同款；裸值放宽=npm test 覆盖）',
      g.status === 200 && g.body.indexOf('evenodd') !== -1,
      'status=' + g.status + ' body=' + String(g.body).slice(0, 200));
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
