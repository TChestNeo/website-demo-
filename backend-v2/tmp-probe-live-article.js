// tmp-probe-live-article.js — 线上实机探针（无打桩）：用户「我在MicroNationary内没有看见」
// 直接访问 https://mnationworld.com 真实页面+真实 API，验证：
// S1 首页访客视角最新文章区块（应显示 ART-000004 Testing）
// S2 首页搜索框输入 Testing → 下拉结果
// S3 文章阅读页 article.html?id=ART-000004 正文渲染——v0.2.56.2 FC 1:1 画布：国旗/国徽并排不竖堆、
//    尺寸 1:1（fit 264×174 / span 240×174）、国徽卡 Emblem 不丢
// S4 全程零 JS 错误
// S5 概览页真文章 / S6 explore 页文章搜索 / S7 阅读页版本锚 + 宽窗完整格舞台投影（v0.2.58.0）
// S8 v0.2.58.0 呈现界面：去侧栏 + 标签条 + 480 窄窗维基式回流往返 + 目录列全部卡（真文章 2 卡条目）
// S9 v10.28.40.0 FC 编辑区固定 125 格横：线上 site-config 版本锚 + 门禁通过 + --grid-cols=125 + 画布盒 2748 全覆盖 + 底部横向拉条 + Ctrl+滚轮缩放 + 芯片重置 + Shift+滚轮横向 + 纯滚轮不缩放 + 中键拖平移落点精确/平移中玻璃挂起/松手还原（39.1 掉帧修复行为锚）
// S10 v10.28.40.0 SNE 格底随卡色 + 画布边缘淡淡阴影（用户「二级显示分数的卡片颜色根据卡片本身的颜色自动变化背景颜色融入背景主题；画布格子边缘加淡淡阴影」）：画布盒 box-shadow 逐字节 + 建卡读混色恒等 + tint 写入 62/38 混色，IIFE 内建读删零草稿污染
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

    // S7 v0.2.58.0：版本锚 + 宽窗完整格舞台投影（125 格横 + 格子线代码在场透明度 0）+ S8 呈现界面
    const artVer = await cdp.evalJs("window.MN_SITE_VERSION");
    ok('S7 阅读页线上版本 = v0.2.58.0', artVer === 'v0.2.58.0', 'ver=' + artVer);
    ok('S7b 宽窗完整格舞台投影自洽：s=min(availW/stageW,availH/stageH)（下限 0.25）+ holder=stage×s + 125 格横 + 格子线代码在场透明度 0',
      await cdp.evalJs("(function(){ var b = document.getElementById('artBody'); var h = b.querySelector('.art-canvas'); if (!h) return false; var e = h.querySelector('.art-canvas-inner'); var m = e.style.transform.match(/scale\\(([\\d.]+)\\)/); var s = m ? parseFloat(m[1]) : 0; var availH = Math.max(200, window.innerHeight - h.getBoundingClientRect().top - 24); var exp = Math.max(0.25, Math.min(b.clientWidth / e.offsetWidth, availH / e.offsetHeight)); var cs = getComputedStyle(e); var bi = cs.backgroundImage.replace(/\\s+/g, ''); return Math.abs(s - exp) <= 0.005 && Math.abs(h.clientWidth - Math.round(e.offsetWidth * s)) <= 2 && s >= 0.25 && Math.abs(e.offsetWidth / 22 - 125) <= 1 && bi.indexOf('linear-gradient') !== -1 && bi.indexOf('rgba(120,120,120,0)') !== -1; })()") === true,
      await cdp.evalJs("(function(){ var b = document.getElementById('artBody'); var h = b.querySelector('.art-canvas'); var e = h.querySelector('.art-canvas-inner'); return 'avail=' + b.clientWidth + ' inner=' + e.offsetWidth + 'x' + e.offsetHeight + ' holder=' + h.clientWidth + ' ' + e.style.transform; })()"));
    ok('S8 站点侧栏灭（art-present 单列）+ 标签条容器在场',
      await cdp.evalJs("(function(){ return getComputedStyle(document.querySelector('.app-sidebar')).display === 'none' && getComputedStyle(document.querySelector('.app-main')).marginLeft === '0px' && !!document.getElementById('artTags'); })()") === true,
      await cdp.evalJs("getComputedStyle(document.querySelector('.app-sidebar')).display + '/' + getComputedStyle(document.querySelector('.app-main')).marginLeft"));
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 480, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(900);
    ok('S8b 480 窄窗 → 维基式回流（reflow 类 + 零缩放 transform none）',
      await cdp.evalJs("(function(){ var h = document.querySelector('#artBody .art-canvas'); if (!h) return false; var e = h.querySelector('.art-canvas-inner'); return h.classList.contains('art-canvas-reflow') && getComputedStyle(e).transform === 'none'; })()") === true,
      await cdp.evalJs("(function(){ var h = document.querySelector('#artBody .art-canvas'); return h ? 'reflow=' + h.classList.contains('art-canvas-reflow') + ' avail=' + document.getElementById('artBody').clientWidth : 'NO_CANVAS'; })()"));
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(900);
    ok('S8c 回 1280 → 全屏投影还原（reflow 灭 + transform scale 恢复、往返稳定）',
      await cdp.evalJs("(function(){ var h = document.querySelector('#artBody .art-canvas'); if (!h) return false; var e = h.querySelector('.art-canvas-inner'); var m = e.style.transform.match(/scale\\(([\\d.]+)\\)/); return !h.classList.contains('art-canvas-reflow') && m && parseFloat(m[1]) >= 0.25; })()") === true);
    ok('S8d 标签条/目录随内容自洽（有标签出 chip、目录钮必在——列全部卡：label→正文派生→卡型名兜底）',
      await cdp.evalJs("(function(){ var b = document.getElementById('artTags'); var chips = b.querySelectorAll('.art-tag-chip'); var tb = document.getElementById('artTocBtn'); if (!tb) return { chips: chips.length, toc: false }; tb.click(); var opened = document.getElementById('artTocDrawer').classList.contains('open'); document.getElementById('artTocDrawer').classList.remove('open'); return { chips: chips.length, toc: opened }; })()").then(r => r && r.toc === true && r.chips >= 1),
      await cdp.evalJs("(function(){ var b = document.getElementById('artTags'); var d = document.getElementById('artTocDrawer'); var items = d ? d.querySelectorAll('.art-toc-item').length : -1; return 'chips=' + b.querySelectorAll('.art-tag-chip').length + ' tocBtn=' + !!document.getElementById('artTocBtn') + ' items=' + items; })()"));

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
    ok('S6 explore 页线上版本 = v0.2.58.0', exVer === 'v0.2.58.0', 'ver=' + exVer);
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

    // S9 v10.28.40.0 FC 编辑区固定 125 格横（用户「FC也是一样是125格横向，固定不会因窗口不够宽而缩小，最多底下横向拉条」）
    const scCfg = await (await fetch(BASE + '/assets/js/site-config.js')).text();
    ok('S9a 线上 site-config 含 FC v10.28.40.0 + 站点 v0.2.58.0', scCfg.indexOf('v10.28.40.0') !== -1 && scCfg.indexOf('v0.2.58.0') !== -1);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    let fcLoaded = false;
    try { fcLoaded = await waitFor(cdp, "!!document.getElementById('gridCanvas')", 30000, 'FC 编辑器加载'); } catch (e) {}
    ok('S9b 编辑器门禁通过（已登录种子）+ 画布在场', fcLoaded,
      await cdp.evalJs("location.pathname + ' canvas=' + !!document.getElementById('gridCanvas')").catch(() => 'EVAL_FAIL'));
    ok('S9c 固定 125 格：--grid-cols=125 + 画布盒宽 2748（max-content 全覆盖）+ 底部横向拉条在（scrollW>clientW）',
      await cdp.evalJs("(function(){ var gc = document.getElementById('gridCanvas'); var body = gc.parentElement; var cols = parseInt(getComputedStyle(gc).getPropertyValue('--grid-cols').trim(), 10); var cs = parseInt(getComputedStyle(gc).getPropertyValue('--cell-size').trim(), 10); return cols === 125 && cs === 20 && gc.offsetWidth === 2748 && body.scrollWidth > body.clientWidth; })()") === true,
      await cdp.evalJs("(function(){ var gc = document.getElementById('gridCanvas'); var body = gc.parentElement; return 'cols=' + getComputedStyle(gc).getPropertyValue('--grid-cols') + ' w=' + gc.offsetWidth + ' sw=' + body.scrollWidth + ' cw=' + body.clientWidth; })()"));
    ok('S9d 缩放芯片按钮在场', await cdp.evalJs("!!document.getElementById('zoomChip')") === true);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 640, y: 500, deltaX: 0, deltaY: -120, modifiers: 2 });
    let z9 = false;
    try { z9 = await waitFor(cdp, "document.getElementById('gridCanvas').style.zoom === '1.1'", 3000, 'Ctrl+滚轮放大'); } catch (e) {}
    ok('S9e Ctrl+滚轮上 → 放大 1.1（style.zoom=1.1）', z9, await cdp.evalJs("document.getElementById('gridCanvas').style.zoom || '(none=1)'"));
    ok('S9e2 芯片显示 110%', await cdp.evalJs("document.getElementById('zoomChip').textContent") === '110%');
    await cdp.evalJs("document.getElementById('zoomChip').click()");
    ok('S9f 点芯片 → 重置回 1（style.zoom 移除）', await cdp.evalJs("document.getElementById('gridCanvas').style.zoom") === '');
    await cdp.evalJs("(function(){ var body = document.getElementById('gridCanvas').parentElement; body.scrollLeft = 0; body.scrollTop = 0; })()");
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 640, y: 500, deltaX: 240, deltaY: 0, modifiers: 8 });
    let sl9 = 0;
    try { await waitFor(cdp, "document.getElementById('gridCanvas').parentElement.scrollLeft > 0", 3000, 'Shift+滚轮横向'); sl9 = await cdp.evalJs("document.getElementById('gridCanvas').parentElement.scrollLeft"); } catch (e) {}
    ok('S9g Shift+滚轮 → 横向移动（scrollLeft>0）', sl9 > 0, 'scrollLeft=' + sl9);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 640, y: 500, deltaX: 0, deltaY: 120, modifiers: 0 });
    await sleep(400);
    ok('S9h 纯滚轮不缩放（zoom 仍 1）', await cdp.evalJs("document.getElementById('gridCanvas').style.zoom") === '');

    // S9i/S9j v10.28.39.1 平移掉帧修复行为锚（真事件管线：落点精确 + 玻璃挂起/还原）
    // S9h 滚轮平滑滚动尾部可能仍在飞（headless 慢滚动，会抢写 scrollTop）——先等
    // st 稳定再平移；置位后的程序滚动 scroll 事件防抖 150ms 也先清场（按前 class 归零）。
    // 按点 = editor-body +300/250（画布空区）——+10/+10 落在资产面板浮动按钮上
    // （tmp-diag-live-pan 实证 elementFromPoint=asset-panel-toggle，中键按它不触发平移）
    let st9 = -1, st9prev = -2, settleN = 0;
    while (settleN < 12) {
      st9prev = st9;
      st9 = await cdp.evalJs("document.getElementById('gridCanvas').parentElement.scrollTop");
      if (st9prev === st9) break;
      settleN++;
      await sleep(200);
    }
    await sleep(250);
    await cdp.evalJs("(function(){ var body = document.getElementById('gridCanvas').parentElement; body.scrollLeft = 800; body.scrollTop = 400; })()");
    await sleep(200);
    const pt9 = await cdp.evalJs("(function(){ var r = document.getElementById('gridCanvas').parentElement.getBoundingClientRect(); return { x: r.left + 300, y: r.top + 250 }; })()");
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt9.x, y: pt9.y, button: 'middle', clickCount: 1, modifiers: 0 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt9.x + 60, y: pt9.y + 30, button: 'middle', modifiers: 0 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt9.x + 100, y: pt9.y + 60, button: 'middle', modifiers: 0 });
    await sleep(120); // rAF 合并落位帧
    const p9 = await cdp.evalJs("(function(){ var body = document.getElementById('gridCanvas').parentElement; return { sl: body.scrollLeft, st: body.scrollTop, mov: document.body.classList.contains('fc-moving') }; })()");
    ok('S9i 中键长按拖 → 平移视口（右移 100 下移 60 → sl 800→700 / st 400→340）+ 平移中玻璃挂起',
      Math.abs(p9.sl - 700) <= 2 && Math.abs(p9.st - 340) <= 2 && p9.mov === true, JSON.stringify(p9));
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt9.x + 100, y: pt9.y + 60, button: 'middle', clickCount: 1, modifiers: 0 });
    await sleep(450);
    const p9b = await cdp.evalJs("document.body.classList.contains('fc-moving')");
    ok('S9j 松手后玻璃还原（fc-moving 已移除）', p9b === false, 'fc-moving=' + p9b);

    // S10 v10.28.40.0 SNE 格底随卡色 + 画布边缘淡淡阴影（用户「SNE Index Card 的二级
    // 显示分数的卡片颜色根据卡片本身的颜色自动变化背景颜色融入背景主题；画布格子边缘
    // 加淡淡阴影」）——建卡→读→移除全在一个 IIFE 内，createSneCard 不触发
    // onContentChange、不写草稿，实机草稿零污染
    const parseColor = (s) => {
      const m = s && s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
      const c = s && s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
      return c ? [Math.round(c[1] * 255), Math.round(c[2] * 255), Math.round(c[3] * 255)] : null;
    };
    const near = (a, b, tol) => !!a && !!b && Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
    const s10 = await cdp.evalJs("(function(){ var gc = document.getElementById('gridCanvas'); var shadow = getComputedStyle(gc).boxShadow; var card = window.createSneCard(2, 2, 9, 12); var cell = card.querySelector('.sne-cell'); var cellDefault = getComputedStyle(cell).backgroundColor; var faceDefault = getComputedStyle(card).backgroundColor; card.style.setProperty('--sne-cell-tint', 'rgba(212, 60, 60, 1)'); var tintVar = card.style.getPropertyValue('--sne-cell-tint'); var cellTint = getComputedStyle(cell).backgroundColor; var faceTint = getComputedStyle(card).backgroundColor; card.remove(); return { shadow: shadow, cellDefault: cellDefault, faceDefault: faceDefault, tintVar: tintVar, cellTint: cellTint, faceTint: faceTint }; })()");
    ok('S10a 编辑态画布盒 box-shadow=细线勾边+主题投影（与本地电池逐字节同串）',
      s10 && s10.shadow === 'rgba(118, 117, 134, 0.14) 0px 0px 0px 1px, rgba(0, 0, 0, 0.06) 0px 4px 24px 0px', JSON.stringify(s10));
    ok('S10b 默认无选色：格底=卡面 surface 恒等（混色恒等、默认观感零变化）',
      s10 && near(parseColor(s10.cellDefault), parseColor(s10.faceDefault), 1), JSON.stringify(s10 && { cellDefault: s10.cellDefault, faceDefault: s10.faceDefault }));
    ok('S10c tint 写入 → 格底=62/38 纸上混色 rgb(221,128,128)（tint 变量字面在场）',
      s10 && s10.tintVar === 'rgba(212, 60, 60, 1)' && near(parseColor(s10.cellTint), [221, 128, 128], 1.5), JSON.stringify(s10 && { tintVar: s10.tintVar, cellTint: s10.cellTint }));

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
