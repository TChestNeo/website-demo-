// tmp-battery-micro-v056.js — v0.2.56.2 MicroNationary 真文章电池（用户「在MicroNationary看不见也搜索不到…
// FC只是一个编辑器…」）：概览页（侧栏第一菜单项 MicroNationary = overview.html）真实文章接入 + 搜索胶囊 +
// 首页活动流混入真实文章（55.0 钦定字面落地）+ FC 列表 View 云端→平台阅读页
// 验证：B 浏览器（fetch 打桩）——概览页近期贡献=真文章（假数据 Alex Rivera 移除）、搜索三态、零文章空态、
//       首页活动流首卡=真文章卡、双版本锚 v0.2.56.2/v10.28.36.3、全程零异常
//       F FC 列表（?view=articles）云端行 View → article.html?id=、本地行 View → ?article=（编辑器预览保留）
// （house CDP 模式；截图全黑纪律，无截图依赖）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-micro056-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => { if (e2) { res.writeHead(404); res.end(); return; } res.writeHead(200); res.end(b2); });
      return;
    }
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});

class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.errs = []; this.consoleErrs = []; }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej, method } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(method + ' 失败: ' + m.error.message)) : res(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = (m.params && m.params.exceptionDetails) || {};
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 400));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error') {
        const a = m.params.args || [];
        const text = a.map(x => (x.value !== undefined ? x.value : (x.description || ''))).join(' ').slice(0, 200);
        if (text.indexOf('Failed to load resource') === -1) this.consoleErrs.push(text);
      } else if (m.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}

// ═══ fetch 打桩（模拟后端口径）：2 篇已发布文章；sessionStorage __stubEmptyArticles=1 → 列表返回空（空态断言；
// 必须走 sessionStorage——navigate 换新 document，window 标志必丢，sessionStorage 同源导航后仍在）
const FIX_LIST = { articles: [
  { id: 'ART-MICRO-1', title: 'Founding Charter', status: 'published', authorId: 'USR-000001', authorName: 'Neo', createdAt: '2026-09-20T08:00:00.000Z', updatedAt: '2026-09-20T08:00:00.000Z' },
  { id: 'ART-MICRO-2', title: 'Trade Treaty Notes', status: 'published', authorId: 'USR-000002', authorName: 'Vela', createdAt: '2026-09-19T10:00:00.000Z', updatedAt: '2026-09-19T10:00:00.000Z' }
] };
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' var stubResponse = function (body, status) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status, headers: { "Content-Type": "application/json" } })); }, 0); }); };' +
  ' var FIX_LIST = ' + JSON.stringify(FIX_LIST) + ';' +
  ' var isStubEmpty = function () { try { return sessionStorage.getItem("__stubEmptyArticles") === "1"; } catch (e) { return false; } };' +
  ' window.__stubCalls = [];' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url); var method = (opts && opts.method) || "GET";' +
  '  if (u.indexOf("/api/") === -1) return realFetch(url, opts);' +
  '  window.__stubCalls.push({ u: u, method: method });' +
  '  if (u.indexOf("/api/health") === 0) return stubResponse(JSON.stringify({ status: "ok", db: "ok" }), 200);' +
  '  if (u.indexOf("/api/articles?q=") !== -1) {' +
  '   var q = decodeURIComponent(u.split("q=")[1] || "").toLowerCase();' +
  '   var hit = (isStubEmpty() ? [] : FIX_LIST.articles).filter(function (a) { return a.title.toLowerCase().indexOf(q) !== -1; });' +
  '   return stubResponse(JSON.stringify({ articles: hit }), 200);' +
  '  }' +
  '  if (u.indexOf("/api/articles") === 0 && u.indexOf("/api/articles/") !== 0) {' +
  '   return stubResponse(JSON.stringify(isStubEmpty() ? { articles: [] } : FIX_LIST), 200);' +
  '  }' +
  '  return stubResponse(JSON.stringify({ error: { code: "NOT_FOUND" } }), 404);' +
  ' };' +
  '})();}catch(e){}';

(async () => {
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) { console.log('CHROME_NOT_FOUND'); process.exit(1); }

  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });

  try {
    await new Promise((res) => server.listen(PORT, res));
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });

    // ═══ B 概览页（MicroNationary）═══
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/overview.html' });
    await waitFor(cdp, "document.readyState === 'complete' && !!document.getElementById('ovSearchInput')", 30000, '概览页加载');
    await sleep(2500); // 等 fetch 渲染近期贡献
    const contribsText = await cdp.evalJs("document.getElementById('recentContribs').textContent");
    ok('B1 概览页近期贡献=真文章（Charter 在列）', contribsText.indexOf('Founding Charter') !== -1, contribsText.slice(0, 60).replace(/\s+/g, ' '));
    ok('B1b 假数据 Alex Rivera 已移除', contribsText.indexOf('Alex Rivera') === -1);
    ok('B1c 贡献行含作者+动作词（发布了）', contribsText.indexOf('Neo') !== -1 && contribsText.indexOf('发布了') !== -1);
    const contribHref = await cdp.evalJs("(function(){ var a = document.querySelector('#recentContribs a'); return a ? a.getAttribute('href') : null; })()");
    ok('B1d 贡献行锚到 article.html?id=ART-MICRO-1', contribHref === 'article.html?id=ART-MICRO-1', 'href=' + contribHref);
    ok('B1e 概览页已接 api.js（MN_API 存在）', await cdp.evalJs("typeof window.MN_API === 'object' && typeof window.MN_API.get === 'function'") === true);

    // B2 概览页搜索：输入 Charter → 下拉出结果
    await cdp.evalJs("(function(){ var i = document.getElementById('ovSearchInput'); i.value = 'Charter'; i.dispatchEvent(new Event('input')); })()");
    let searchHit = false;
    try {
      searchHit = await waitFor(cdp, "document.querySelectorAll('#ovSearchPanel .dash-search-item').length >= 1", 10000, '概览搜索下拉');
    } catch (e) {}
    const searchText = await cdp.evalJs("document.getElementById('ovSearchPanel').textContent").then(s => (s || '').slice(0, 80));
    ok('B2 概览搜索 Charter → 下拉出结果', searchHit, searchText);
    const searchHref = await cdp.evalJs("(function(){ var r = document.querySelector('#ovSearchPanel .dash-search-item'); return r ? r.getAttribute('href') : null; })()");
    ok('B2b 结果锚到 article.html?id=ART-MICRO-1', searchHref === 'article.html?id=ART-MICRO-1', 'href=' + searchHref);

    // B3 概览搜索无结果态
    await cdp.evalJs("(function(){ var i = document.getElementById('ovSearchInput'); i.value = 'zzzz'; i.dispatchEvent(new Event('input')); })()");
    let noHit = false;
    try {
      noHit = await waitFor(cdp, "document.getElementById('ovSearchPanel').textContent.indexOf('没有找到相关文章') !== -1", 10000, '概览搜索无结果态');
    } catch (e) {}
    ok('B3 概览搜索无结果 → 没有找到相关文章', noHit);

    // B4 概览页零文章空态（sessionStorage 标志后重载；waitFor 轮询空态文本——
    // 固定 sleep 会踩旧 document 未卸载竞态：waitFor 首轮即命中旧页的完整列表）
    await cdp.evalJs("try{ sessionStorage.setItem('__stubEmptyArticles','1'); }catch(e){}");
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/overview.html' });
    let emptyRendered = false;
    try {
      emptyRendered = await waitFor(cdp, "document.getElementById('recentContribs').textContent.indexOf('暂无贡献内容') !== -1", 15000, '概览页空态渲染');
    } catch (e) {}
    const emptyText = await cdp.evalJs("document.getElementById('recentContribs').textContent");
    ok('B4 零文章 → 空态（暂无贡献内容）不回退假数据', emptyRendered && emptyText.indexOf('暂无贡献内容') !== -1 && emptyText.indexOf('Alex Rivera') === -1, emptyText.slice(0, 40).replace(/\s+/g, ' '));
    await cdp.evalJs("try{ sessionStorage.removeItem('__stubEmptyArticles'); }catch(e){}");

    // ═══ B 首页活动流混入真文章 ═══
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/' });
    await waitFor(cdp, "document.readyState === 'complete' && !!document.getElementById('activityFeed')", 30000, '首页加载');
    // 文章卡插入在 fetch 完成回调里：waitFor 轮询目标状态，不踩固定 sleep 竞态
    let feedCard = false;
    try {
      feedCard = await waitFor(cdp, "document.querySelector('#activityFeed > a') !== null", 10000, '活动流文章卡插入');
    } catch (e) {}
    const firstFeedHref = await cdp.evalJs("(function(){ var a = document.querySelector('#activityFeed > a'); return a ? a.getAttribute('href') : null; })()");
    ok('B5 活动流首卡=真文章卡（混入）', firstFeedHref === 'pages/article.html?id=ART-MICRO-1', 'href=' + firstFeedHref);
    const feedText = await cdp.evalJs("(function(){ var a = document.querySelector('#activityFeed > a'); return a ? a.textContent : ''; })()");
    ok('B5b 文章卡含标题+作者+badge', feedText.indexOf('Founding Charter') !== -1 && feedText.indexOf('Neo') !== -1 && feedText.indexOf('文章') !== -1, feedText.slice(0, 60).replace(/\s+/g, ' '));
    ok('B5c 文章卡插在 demo 活动项之前', await cdp.evalJs("(function(){ var feed = document.getElementById('activityFeed'); return feed.firstElementChild && feed.firstElementChild.tagName === 'A'; })()") === true);
    ok('B5d 最新文章区块仍显示（并存）', await cdp.evalJs("document.getElementById('latestArticlesSection').style.display") === 'block');
    ok('B5e 活动流 demo 项仍在（4 条）', await cdp.evalJs("document.querySelectorAll('#activityFeed > div.card').length") >= 4);

    // B6 双版本锚
    const ver = await cdp.evalJs("window.MN_SITE_VERSION");
    const fcVer = await cdp.evalJs("window.FLUIDCANVAS_VERSION");
    ok('B6 站点号 v0.2.58.2', ver === 'v0.2.58.2', 'got=' + ver);
    ok('B6b FC v10.28.39.0', fcVer === 'v10.28.47.4', 'got=' + fcVer);

    // ═══ F FC 列表 View 分流 ═══
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/fluidcanvas.html?view=articles' });
    await waitFor(cdp, "document.readyState === 'complete' && !!document.getElementById('artList')", 30000, 'FC 列表加载');
    await sleep(4000); // 等云端行拉取+渲染
    const rows = await cdp.evalJs("(function(){ return Array.from(document.querySelectorAll('#artList .art-row')).map(function(r){ return { id: r.dataset.id, title: (r.querySelector('.art-title') ? r.querySelector('.art-title').textContent : ''), isCloud: (r.className.indexOf('cloud') !== -1) }; }); })()");
    ok('F1 FC 列表行渲染（含云端行）', Array.isArray(rows) && rows.length >= 1 && rows.some(r => r.id === 'ART-MICRO-1'), JSON.stringify(rows).slice(0, 200));
    // 云端行 View → 平台阅读页（v0.2.56.2 口径：FC 只是编辑器）
    await cdp.evalJs("(function(){ var row = Array.from(document.querySelectorAll('#artList .art-row')).find(function(r){ return r.dataset.id === 'ART-MICRO-1'; }); var btn = row.querySelector('.art-action-btn[title=\"View\"]'); btn.click(); })()");
    await sleep(800);
    const fUrl = await cdp.evalJs('location.href');
    ok('F2 云端文章 View → 平台阅读页 article.html?id=', fUrl.indexOf('article.html?id=ART-MICRO-1') !== -1, fUrl);
    // 回到列表；本地行 View → 编辑器 ?article=（v10.28.35.0 预览保留）
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/pages/fluidcanvas.html?view=articles' });
    await waitFor(cdp, "document.readyState === 'complete' && !!document.getElementById('artList')", 30000, 'FC 列表重载');
    await sleep(4000);
    const localRow = await cdp.evalJs("(function(){ var row = Array.from(document.querySelectorAll('#artList .art-row')).find(function(r){ return r.dataset.id !== 'ART-MICRO-1' && r.dataset.id !== 'ART-MICRO-2'; }); if (!row) return null; var btn = row.querySelector('.art-action-btn[title=\"View\"]'); if (!btn) return 'NO_VIEW_BTN'; btn.click(); return 'clicked'; })()");
    await sleep(800);
    const fUrl2 = await cdp.evalJs('location.href');
    ok('F3 本地草稿 View → 编辑器 ?article=（预览保留）', localRow === 'clicked' && fUrl2.indexOf('fluidcanvas-editor.html?article=') !== -1, localRow + ' / ' + fUrl2);

    // S 全程零 JS 错误
    ok('S1 全程零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 3).join(' | ') || '干净');
    ok('S1b 零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 3).join(' | ') || '干净');

    cdp.close();
  } catch (e) {
    console.log('💥 ' + (e.stack || e.message));
    FAIL++;
  }
  try { chrome.kill(); } catch (e) {}
  server.close();
  console.log('');
  console.log(FAIL === 0 ? '🎉 全部通过 ' + PASS + '/' + PASS : '💔 失败 ' + FAIL + ' / 共 ' + (PASS + FAIL));
  process.exit(FAIL === 0 ? 0 : 1);
})();
