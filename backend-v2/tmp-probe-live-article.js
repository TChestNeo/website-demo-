// tmp-probe-live-article.js — 线上实机探针（无打桩）：用户「我在MicroNationary内没有看见」
// 直接访问 https://mnationworld.com 真实页面+真实 API，验证：
// S1 首页访客视角最新文章区块（应显示 ART-000004 Testing）
// S2 首页搜索框输入 Testing → 下拉结果
// S3 文章阅读页 article.html?id=ART-000004 正文渲染——v0.2.56.2 FC 1:1 画布：国旗/国徽并排不竖堆、
//    尺寸 1:1（fit 264×174 / span 240×174）、国徽卡 Emblem 不丢
// S4 全程零 JS 错误
// S5 概览页真文章 / S6 explore 页文章搜索 / S7 阅读页版本锚 + 缩放自洽（v0.2.56.2）
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CDP_PORT = 5900 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-live-probe-' + Date.now());
const BASE = 'https://mnationworld.com';

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
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });

    // S1 首页访客视角
    await cdp.send('Page.navigate', { url: BASE + '/' });
    await waitFor(cdp, "document.readyState === 'complete' && !!document.getElementById('dashSearchInput')", 30000, '首页加载');
    await sleep(3000); // 等 fetch 渲染
    const secVisible = await cdp.evalJs("document.getElementById('latestArticlesSection').style.display") === 'block';
    const rows = await cdp.evalJs("document.querySelectorAll('#latestArticles .latest-article').length");
    const hasArt4 = await cdp.evalJs("document.getElementById('latestArticles').textContent.indexOf('Testing') !== -1");
    const secHtml = await cdp.evalJs("document.getElementById('latestArticlesSection') ? document.getElementById('latestArticlesSection').style.display : 'MISSING'");
    ok('S1 首页最新文章区块显示', secVisible, 'display=' + secHtml);
    ok('S1b 区块含文章行', rows >= 1, 'rows=' + rows);
    ok('S1c 行含 Testing（ART-000004）', hasArt4 === true);

    // S2 首页搜索
    await cdp.evalJs("(function(){ var i = document.getElementById('dashSearchInput'); i.value = 'Testing'; i.dispatchEvent(new Event('input')); })()");
    let searchHit = false;
    try {
      searchHit = await waitFor(cdp, "document.querySelectorAll('.dash-search-item').length >= 1", 10000, '搜索下拉');
    } catch (e) {}
    const searchText = await cdp.evalJs("document.getElementById('dashSearchPanel').textContent").then(s => (s || '').slice(0, 80));
    ok('S2 搜索 Testing → 下拉出结果', searchHit, searchText);
    const searchHref = await cdp.evalJs("(function(){ var r = document.querySelector('.dash-search-item'); return r ? r.getAttribute('href') : null; })()");
    ok('S2b 结果锚到 article.html?id=ART-000004', searchHref === 'pages/article.html?id=ART-000004', 'href=' + searchHref);

    // S3 阅读页正文——v0.2.56.2 FC 1:1 画布渲染（用户「我要的是FC里的1:1」）
    await cdp.send('Page.navigate', { url: BASE + '/pages/article.html?id=ART-000004' });
    await waitFor(cdp, "document.getElementById('articleDetail').style.display === 'flex'", 30000, '阅读页加载');
    await sleep(1500);
    const bodyHtml = await cdp.evalJs("document.getElementById('artBody').innerHTML");
    const nCanvas = (bodyHtml.match(/art-canvas/g) || []).length;
    const nFlows = (bodyHtml.match(/art-flow/g) || []).length;
    const emptyHint = bodyHtml.indexOf('这篇文章还没有正文内容') !== -1;
    ok('S3 阅读页正文有内容（非空提示）', !emptyHint);
    ok('S3b 1:1 画布在场（art-canvas ≥1、零竖堆 art-flow）', nCanvas >= 1 && nFlows === 0, 'canvas=' + nCanvas + ' flows=' + nFlows);
    const geo = await cdp.evalJs("(function(){ var b8 = document.querySelector('#artBody .art-card[data-card-id=\"c8\"]'); var b1 = document.querySelector('#artBody .art-card[data-card-id=\"c1\"]'); if (!b8 || !b1) return null; return { l8: b8.offsetLeft, l1: b1.offsetLeft, t8: b8.offsetTop, t1: b1.offsetTop, w8: b8.offsetWidth, w1: b1.offsetWidth, h8: b8.offsetHeight, h1: b1.offsetHeight }; })()");
    ok('S3c 国旗/国徽并排不竖堆（c8 左于 c1、顶对齐同 top）', !!geo && geo.l8 < geo.l1 && Math.abs(geo.t8 - geo.t1) <= 0.5, JSON.stringify(geo));
    ok('S3d 卡尺寸 1:1（国旗 fit 264×174 / 国徽 span 240×174）',
      !!geo && Math.abs(geo.w8 - 264) <= 1.5 && Math.abs(geo.h8 - 174) <= 1.5 && Math.abs(geo.w1 - 240) <= 1.5 && Math.abs(geo.h1 - 174) <= 1.5,
      JSON.stringify(geo));
    const imgs = await cdp.evalJs("(function(){ return Array.from(document.querySelectorAll('#artBody img')).map(function(i){ return i.getAttribute('src') ? String(i.getAttribute('src')).slice(0, 40) : 'NO_SRC'; }); })()");
    ok('S3e 国旗图卡 img 有 src', Array.isArray(imgs) && imgs.length >= 1 && imgs.every(s => s !== 'NO_SRC'), JSON.stringify(imgs).slice(0, 200));
    // v0.2.55.2 口径延续：国徽卡必须渲染（用户文章 = shield Emblem 卡）
    ok('S3f 国徽卡渲染：art-card-emblem + shield 图标 + Emblem 标签',
      await cdp.evalJs("(function(){ var e = document.querySelector('#artBody .art-card-emblem'); return !!e && !!e.querySelector('.material-symbols-outlined') && !!e.querySelector('.art-card-emblem-label'); })()") === true &&
      await cdp.evalJs("(function(){ var e = document.querySelector('#artBody .art-card-emblem-label'); return e.textContent === 'Emblem'; })()") === true);

    // S7 v0.2.56.2：版本锚 + 缩放自洽（仍在阅读页上）
    const artVer = await cdp.evalJs("window.MN_SITE_VERSION");
    ok('S7 阅读页线上版本 = v0.2.56.2', artVer === 'v0.2.56.2', 'ver=' + artVer);
    ok('S7b 缩放自洽（inner scale ∈ (0.25,1.6] 且 holder 高 = bboxH×s）',
      await cdp.evalJs("(function(){ var e = document.querySelector('#artBody .art-canvas-inner'); var m = e.style.transform.match(/scale\\(([\\d.]+)\\)/); var s = m ? parseFloat(m[1]) : 0; var h = document.querySelector('#artBody .art-canvas'); return s > 0.25 && s <= 1.6 && Math.abs(h.clientHeight - e.offsetHeight * s) <= 1.5; })()") === true,
      await cdp.evalJs("document.querySelector('#artBody .art-canvas-inner').style.transform"));

    // v0.2.56.0：MicroNationary 概览页真文章（用户「我在MicroNationary看不见也搜索不到」）
    await cdp.send('Page.navigate', { url: BASE + '/pages/overview.html' });
    await waitFor(cdp, "document.readyState === 'complete' && !!document.getElementById('ovSearchInput')", 30000, '概览页加载');
    await sleep(3000); // 等 fetch 渲染
    const hasFake = await cdp.evalJs("document.getElementById('recentContribs').textContent.indexOf('Alex Rivera') !== -1");
    ok('S5 概览页假数据移除（contrib 列表无 Alex Rivera）', hasFake === false);
    const contribLinks = await cdp.evalJs("(function(){ return Array.from(document.querySelectorAll('#recentContribs a')).map(function(a){ return a.getAttribute('href'); }); })()");
    ok('S5b Recent Contributions 真文章链接（article.html?id=）',
      Array.isArray(contribLinks) && contribLinks.length >= 1 && contribLinks.every(h => h && h.indexOf('article.html?id=') !== -1),
      JSON.stringify(contribLinks).slice(0, 200));
    await cdp.evalJs("(function(){ var i = document.getElementById('ovSearchInput'); i.value = 'Testing'; i.dispatchEvent(new Event('input')); })()");
    let ovHit = false;
    try { ovHit = await waitFor(cdp, "document.querySelectorAll('#ovSearchPanel .dash-search-item').length >= 1", 10000, '概览搜索下拉'); } catch (e) {}
    ok('S5c 概览页搜索 Testing → 下拉结果', ovHit);
    const ovHref = await cdp.evalJs("(function(){ var r = document.querySelector('#ovSearchPanel .dash-search-item'); return r ? r.getAttribute('href') : null; })()");
    ok('S5d 概览搜索结果锚阅读页', ovHref && ovHref.indexOf('article.html?id=') !== -1, 'href=' + ovHref);

    // v0.2.56.1：explore 页文章搜索（用户「我在 explore.html 搜索都搜索不到」）
    await cdp.send('Page.navigate', { url: BASE + '/pages/explore.html' });
    await waitFor(cdp, "document.readyState === 'complete' && !!document.getElementById('exSearchInput')", 30000, 'explore 页加载');
    const exVer = await cdp.evalJs("window.MN_SITE_VERSION");
    ok('S6 explore 页线上版本 = v0.2.56.2', exVer === 'v0.2.56.2', 'ver=' + exVer);
    await cdp.evalJs("(function(){ var i = document.getElementById('exSearchInput'); i.value = 'Testing'; i.dispatchEvent(new Event('input')); })()");
    let exHit = false;
    try { exHit = await waitFor(cdp, "document.querySelectorAll('#exSearchPanel .dash-search-item').length >= 1", 10000, 'explore 下拉'); } catch (e) {}
    ok('S6b explore 搜索 Testing → 下拉出文章', exHit);
    const exTitle = await cdp.evalJs("document.querySelector('#exSearchPanel .dash-search-title').textContent");
    ok('S6c 下拉文章 = Testing', exTitle === 'Testing', 'title=' + exTitle);
    const exHref = await cdp.evalJs("(function(){ var r = document.querySelector('#exSearchPanel .dash-search-item'); return r ? r.getAttribute('href') : null; })()");
    ok('S6d 下拉锚 article.html?id=ART-000004', exHref === 'article.html?id=ART-000004', 'href=' + exHref);
    const exSec = await cdp.evalJs("document.getElementById('exArticleResults').style.display === 'block'");
    ok('S6e 主区文章结果段显示', exSec === true);
    const exSecHref = await cdp.evalJs("(function(){ var a = document.querySelector('#exArticleResults a'); return a ? a.getAttribute('href') : null; })()");
    ok('S6f 主区段锚阅读页', exSecHref === 'article.html?id=ART-000004', 'href=' + exSecHref);

    // S4 零 JS 错误
    ok('S4 全程零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 3).join(' | ') || '干净');
    ok('S4b 零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 3).join(' | ') || '干净');

    cdp.close();
  } catch (e) {
    console.log('💥 ' + (e.stack || e.message));
    FAIL++;
  }
  try { chrome.kill(); } catch (e) {}
  console.log('');
  console.log(FAIL === 0 ? '🎉 全部通过 ' + PASS + '/' + PASS : '💔 失败 ' + FAIL + ' / 共 ' + (PASS + FAIL));
  process.exit(FAIL === 0 ? 0 : 1);
})();
