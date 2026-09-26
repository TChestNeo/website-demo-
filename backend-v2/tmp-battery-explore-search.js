// tmp-battery-explore-search.js — v0.2.56.1 explore 页文章搜索（用户「我在 explore.html 搜索都搜索不到」）
// 本地静态服务器 + fetch 打桩（/api/articles?q= 返回假文章）；headless Chrome --lang=zh-CN
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CDP_PORT = 5900 + Math.floor(Math.random() * 100);
const SRV_PORT = 8600 + Math.floor(Math.random() * 300);
const DOCS = path.resolve(__dirname, '../docs');
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-exsearch-' + Date.now());

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let p = path.join(DOCS, u === '/' ? '/pages/explore.html' : u);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(p).pipe(res);
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
    await sleep(200);
  }
  throw new Error('waitFor 超时: ' + label);
}

(async () => {
  await new Promise(res => server.listen(SRV_PORT, res));
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

  let PASS = 0, FAIL = 0;
  const ok = (n, c, d) => { if (c) { PASS++; console.log('  ✅ ' + n + (d ? '  ' + d : '')); } else { FAIL++; console.log('  ❌ ' + n + (d ? '  ' + d : '')); } };

  try {
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
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      (function () {
        var FAKE = {
          articles: [
            { id: 'ART-000004', title: 'Testing', status: 'published', authorName: 'TChestBox_Neo', createdAt: '2026-09-20T06:01:15.434Z' }
          ]
        };
        var EMPTY = { articles: [] };
        var _f = window.fetch;
        window.fetch = function (url, opts) {
          var u = String(url);
          if (u.indexOf('/api/articles?q=') !== -1) {
            var q = decodeURIComponent(u.split('q=')[1] || '');
            return Promise.resolve({ ok: true, status: 200, headers: { get: function () { return null; } }, json: function () { return Promise.resolve(q === 'Testing' ? FAKE : EMPTY); } });
          }
          return _f.apply(this, arguments);
        };
      })();
    ` });
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + SRV_PORT + '/pages/explore.html' });
    await waitFor(cdp, "document.readyState === 'complete' && !!document.getElementById('exSearchInput')", 30000, 'explore 加载');

    // S1 页面结构：搜索胶囊 + 面板 + 文章段 + api.js 入栈
    const hasPanel = await cdp.evalJs("!!document.getElementById('exSearchPanel') && document.getElementById('exSearchPanel').style.display === 'none'");
    ok('S1 搜索胶囊含隐藏下拉面板 #exSearchPanel', hasPanel === true);
    const hasSec = await cdp.evalJs("!!document.getElementById('exArticleResults') && document.getElementById('exArticleResults').style.display === 'none'");
    ok('S1b 主区文章结果段 #exArticleResults 初始隐藏', hasSec === true);
    const hasApi = await cdp.evalJs("!!window.MN_API && typeof window.MN_API.get === 'function'");
    ok('S1c api.js 入栈 MN_API 可用', hasApi === true);
    const hasI18n = await cdp.evalJs("!!window.MN_I18N && window.MN_I18N.t('ex.search.articles') === '文章'");
    ok('S1d i18n 新键生效（zh 文章）', hasI18n === true);

    // S2 输入 Testing → 防抖后下拉出文章行
    await cdp.evalJs("(function(){ var i = document.getElementById('exSearchInput'); i.value = 'Testing'; i.dispatchEvent(new Event('input')); })()");
    await waitFor(cdp, "document.querySelectorAll('#exSearchPanel .dash-search-item').length === 1", 10000, '下拉出文章');
    const rowTitle = await cdp.evalJs("document.querySelector('#exSearchPanel .dash-search-title').textContent");
    ok('S2 下拉显示文章 Testing', rowTitle === 'Testing', 'title=' + rowTitle);
    const rowHref = await cdp.evalJs("document.querySelector('#exSearchPanel .dash-search-item').getAttribute('href')");
    ok('S2b 下拉行锚 article.html?id=ART-000004', rowHref === 'article.html?id=ART-000004', 'href=' + rowHref);

    // S3 主区文章结果段（双保险）
    const secVisible = await cdp.evalJs("document.getElementById('exArticleResults').style.display === 'block'");
    ok('S3 主区文章段显示', secVisible === true);
    const secHref = await cdp.evalJs("(function(){ var a = document.querySelector('#exArticleResults a'); return a ? a.getAttribute('href') : null; })()");
    ok('S3b 主区文章段锚阅读页', secHref === 'article.html?id=ART-000004', 'href=' + secHref);
    const secHeader = await cdp.evalJs("document.getElementById('exArticleResults').textContent.indexOf('文章') !== -1");
    ok('S3c 主区段标题「文章」', secHeader === true);

    // S4 回车立即搜（改词后 Enter，不等防抖）
    await cdp.evalJs("(function(){ var i = document.getElementById('exSearchInput'); i.value = 'Testing'; i.dispatchEvent(new Event('input')); })()");
    await cdp.evalJs("(function(){ var i = document.getElementById('exSearchInput'); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()");
    await waitFor(cdp, "document.querySelectorAll('#exSearchPanel .dash-search-item').length === 1", 10000, '回车重开下拉');
    ok('S4 回车触发立即搜索并出结果', true);

    // S5 无结果词 → 空态文案
    await cdp.evalJs("(function(){ var i = document.getElementById('exSearchInput'); i.value = 'zzzz'; i.dispatchEvent(new Event('input')); })()");
    await waitFor(cdp, "document.getElementById('exSearchPanel').textContent.indexOf('没有找到相关文章') !== -1", 10000, '空态文案');
    ok('S5 无结果词显示空态文案', true);
    const secHidden = await cdp.evalJs("document.getElementById('exArticleResults').style.display === 'none'");
    ok('S5b 无结果时主区文章段隐藏', secHidden === true);

    // S6 Escape 关闭 + 清空关闭 + 主区段恢复隐藏
    await cdp.evalJs("(function(){ var i = document.getElementById('exSearchInput'); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); })()");
    const escClosed = await cdp.evalJs("document.getElementById('exSearchPanel').style.display === 'none'");
    ok('S6 Escape 关闭下拉', escClosed === true);
    await cdp.evalJs("(function(){ var i = document.getElementById('exSearchInput'); i.value = 'Testing'; i.dispatchEvent(new Event('input')); })()");
    await waitFor(cdp, "document.querySelectorAll('#exSearchPanel .dash-search-item').length === 1", 10000, '再开');
    await cdp.evalJs("(function(){ var i = document.getElementById('exSearchInput'); i.value = ''; i.dispatchEvent(new Event('input')); })()");
    const cleared = await cdp.evalJs("document.getElementById('exSearchPanel').style.display === 'none' && document.getElementById('exArticleResults').style.display === 'none'");
    ok('S6b 清空输入关闭下拉+隐藏文章段', cleared === true);

    // S7 世界筛选仍工作（filterNations 未被破坏；空 localStorage → 空态卡片文案）
    await cdp.evalJs("(function(){ var i = document.getElementById('exSearchInput'); i.value = 'Narnia'; i.dispatchEvent(new Event('input')); })()");
    const worldEmpty = await cdp.evalJs("document.getElementById('nationCards').textContent.indexOf('没有符合你搜索的世界') !== -1");
    ok('S7 世界筛选仍工作（无匹配 → 空态文案）', worldEmpty === true);

    // S8 零 JS 错误
    ok('S8 全程零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 3).join(' | ') || '干净');
    ok('S8b 零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 3).join(' | ') || '干净');

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
