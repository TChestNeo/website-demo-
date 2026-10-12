// tmp-probe-51-apply.js — 复现用户报告「AI 边缘生成成功但点击应用无效」的本地 probe
//   流程 A（无选中卡）：seed 自定义边缘 → 开抽屉 → 点 My 条目 → 看 setCardEdge 静默与否
//   流程 B（有选中卡）：完整 AI 生成 → 保存 → My 条目点击 → 断言卡片生效
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PORT = 4800 + Math.floor(Math.random() * 400);
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-probe-51apply-' + Date.now());
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
        this.errs.push('EXC:' + JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 300));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        const txt = (m.params.args || []).map(a => a.value || a.description || '').join(' ');
        if (txt.indexOf('Failed to load resource') === -1) this.errs.push('CON:' + txt.slice(0, 300));
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

const EDGE_CLIP = 'polygon(0% 0%, 100% 3%, 98% 97%, 3% 100%, 0% 0%)';
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' var EDGE_CLIP = ' + JSON.stringify(EDGE_CLIP) + ';' +
  ' var stubResponse = function (body, status) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status || 200, headers: { "Content-Type": "application/json" } })); }, 0); }); };' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  if (u.indexOf("/fc/edges/scopes") !== -1) return stubResponse(JSON.stringify({ hasFriends: false, hasTeam: false }));' +
  '  if (u.indexOf("/fc/edge-gen") !== -1) return stubResponse(JSON.stringify({ ok: true, edge: { name: "AI撕边", clip: EDGE_CLIP } }), 200);' +
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

const READY = "document.getElementById('undoBtn') && document.getElementById('gridCanvas') && window.openEdgeDrawer && window.setCardEdge && window.openEdgeGenModal && window.createAssetCard";

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

    const cardExpr = "(function(){ var c = document.querySelector('#gridCanvas .grid-card[data-label=\"T1\"]');" +
      " if (!c) return null; var cs = getComputedStyle(c);" +
      " return { edge: c.dataset.cardEdge || '', cls: c.classList.contains('card-edge-custom')," +
      "  clip: cs.getPropertyValue('--card-clip').trim(), bg: c.style.background, layers: cs.getPropertyValue('--card-layers').slice(0, 80) }; })()";
    const toastExpr = "(function(){ var t = document.getElementById('toast');" +
      " return t ? { text: t.textContent, show: t.classList.contains('show') } : null; })()";
    const drawerExpr = "(function(){ var d = document.getElementById('fcEdgeDrawer');" +
      " return { open: d.classList.contains('open'), my: document.getElementById('fcEdgeMyGrid').children.length }; })()";

    // ═══ 流程 A：无选中卡点 My 条目 ═══
    console.log('═══ A 无选中卡 ═══');
    {
      // 新画布初始有几张卡、有没有选中卡（selectedCard 内部变量——用画布 .selected 类探测）
      const init = await cdp.evalJs("(function(){ return { cards: document.querySelectorAll('#gridCanvas .grid-card').length," +
        " selected: document.querySelectorAll('#gridCanvas .grid-card.selected').length }; })()");
      console.log('  初始画布: ' + JSON.stringify(init));
      await cdp.evalJs('(function(){ localStorage.setItem("slati_custom_edges", JSON.stringify([' +
        '{ id: "ce-test-1", name: "测试边", kind: "edge", clip: ' + JSON.stringify(EDGE_CLIP) + ', clipSoft: null, createdAt: new Date().toISOString(), source: "ai", repoId: null, author: null, visibility: null }])) })()');
      await cdp.evalJs('(function(){ window.openEdgeDrawer(); })()');
      await sleep(400);
      const d0 = await cdp.evalJs(drawerExpr);
      await cdp.evalJs('(function(){ var it = document.querySelector("#fcEdgeMyGrid .fc-edge-item"); if (it) it.click(); })()');
      await sleep(400);
      const t0 = await cdp.evalJs(toastExpr);
      const after = await cdp.evalJs("(function(){ var s = document.querySelectorAll('#gridCanvas .grid-card.selected').length;" +
        " return { selected: s, cards: document.querySelectorAll('#gridCanvas .grid-card').length }; })()");
      ok('A1 无选中卡点 My 条目：toast「请先选中一张卡片」引导（51.1 修复——原为静默零反馈）',
        t0 && t0.show === true && t0.text === '请先选中一张卡片' && after.selected === 0,
        JSON.stringify({ d0: d0, toast: t0, after: after }));
    }

    // ═══ 流程 B：选中卡 + 完整 AI 生成 → 保存 → My 点击应用 ═══
    console.log('═══ B 有选中卡（完整 AI 链） ═══');
    {
      await cdp.evalJs("(function(){ window.createAssetCard('text','T1',2,2,6,4); })()");
      await sleep(400);
      await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .grid-card[data-label=\"T1\"]'); window.selectCard(c, true); })()");
      await sleep(300);
      await cdp.evalJs('(function(){ window.openEdgeDrawer(); })()');
      await sleep(400);
      // 自定义添加 → AI 弹窗 → 生成 → 保存
      await cdp.evalJs('(function(){ document.getElementById("fcEdgeCustomAddBtn").click(); })()');
      await sleep(400);
      const gm = await cdp.evalJs("(function(){ var m = document.getElementById('fcEdgeGenModal');" +
        " return m ? !!m.querySelector('.modal-card.active') : false; })()");
      ok('B1 AI 弹窗打开', gm === true, JSON.stringify(gm));
      await cdp.evalJs("(function(){ var d = document.getElementById('edgeGenDesc'); if (d) d.value = '撕边'; window.edgeGenRun(); })()");
      await waitFor(cdp, "document.getElementById('edgeGenResult') && document.getElementById('edgeGenResult').style.display === 'flex'", 8000, 'AI 预览');
      await cdp.evalJs('(function(){ window.edgeGenSave(); })()');
      await sleep(500);
      const myCount = await cdp.evalJs("(function(){ return document.querySelectorAll('#fcEdgeMyGrid .fc-edge-item').length; })()");
      const lib = await cdp.evalJs("(function(){ try { return JSON.parse(localStorage.getItem('slati_custom_edges') || '[]'); } catch (e) { return []; } })()");
      ok('B2 保存进我的（列表 2 条=测试边+AI撕边，库 2 条）', myCount === 2 && lib.length === 2,
        JSON.stringify({ myCount: myCount, lib: lib.map(function (e) { return e.id + ':' + e.name; }) }));
      // My 条目点击应用（点名为 AI撕边 那条）
      await cdp.evalJs("(function(){ var items = document.querySelectorAll('#fcEdgeMyGrid .fc-edge-item');" +
        " for (var i = 0; i < items.length; i++) { var n = items[i].querySelector('.fc-edge-item-name');" +
        "  if (n && n.textContent === 'AI撕边') { items[i].click(); break; } } })()");
      await sleep(400);
      const card = await cdp.evalJs(cardExpr);
      ok('B3 点击应用生效：dataset custom: + 类 + --card-clip + 背景清空', card && card.edge.indexOf('custom:') === 0 &&
        card.cls === true && card.clip === EDGE_CLIP && card.bg === '', JSON.stringify(card));
    }

    console.log('═══ E 零异常 ═══');
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
    const errs = (cdp ? cdp.errs : []).filter(e => !noise.test(e));
    ok('E 零异常（' + (cdp ? cdp.errs.length : 0) + ' 原始 / ' + errs.length + ' 噪声后）', errs.length === 0, errs.slice(0, 5).join(' || '));
  } catch (e) {
    console.log('  💔 ' + e.message);
    fail++;
  }
  try { cdp && cdp.close(); } catch (e) {}
  try { spawn('taskkill', ['/pid', String(chrome.pid), '/t', '/f'], { stdio: 'ignore' }); } catch (e) {}
  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  process.exit(fail === 0 ? 0 : 1);
})();
