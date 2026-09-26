// tmp-probe-live-article.js — 线上实机探针（无打桩）：用户「我在MicroNationary内没有看见」
// 直接访问 https://mnationworld.com 真实页面+真实 API，验证：
// S1 首页访客视角最新文章区块（应显示 ART-000004 Testing）
// S2 首页搜索框输入 Testing → 下拉结果
// S3 文章阅读页 article.html?id=ART-000004 正文渲染——v0.2.56.2 FC 1:1 画布：国旗/国徽并排不竖堆、
//    尺寸 1:1（fit 264×174 / span 240×174）、国徽卡 Emblem 不丢
// S4 全程零 JS 错误
// S5 概览页真文章 / S6 explore 页文章搜索 / S7 阅读页版本锚 + 宽窗完整格舞台投影（v0.2.58.4）
// S8 v0.2.58.4 呈现界面：去侧栏 + 标签条 + 480 窄窗维基式回流往返 + 目录列全部卡（真文章 2 卡条目）
// S9 v10.28.40.0 FC 编辑区固定 115 格横：线上 site-config 版本锚 + 门禁通过 + --grid-cols=115 + 画布盒 2528 全覆盖 + 底部横向拉条 + Ctrl+滚轮缩放 + 芯片重置 + Shift+滚轮横向 + 纯滚轮不缩放 + 中键拖平移落点精确/平移中玻璃挂起/松手还原（39.1 掉帧修复行为锚）
// S10 v10.28.40.0 SNE 格底随卡色 + 画布边缘淡淡阴影（用户「二级显示分数的卡片颜色根据卡片本身的颜色自动变化背景颜色融入背景主题；画布格子边缘加淡淡阴影」）：画布盒 box-shadow 逐字节 + 建卡读混色恒等 + tint 写入 62/38 混色，IIFE 内建读删零草稿污染
// S11 v10.28.41.0 发布日志弹窗（用户「点击发布的时候先弹出一个弹窗填写日志…限制320字」）：弹窗 DOM 在场 + 打开固定初始高 + 按空格分词计数（"code"=1）+ 自动增长 220 上限内滚 + 321 词 .over 红字确认硬拦 + 取消放弃 + 演示路径确认落草稿 + 再开预填（全链零网络——guest 无 USR 用户 fcCloudMode 恒 false；草稿只落探针一次性档案）
// S12 v10.28.42.0 全卡不透明（用户「把FC内的所有卡片变成不透明」——磨砂玻璃轮结束、08-17「100% 不透明」口径复活；也修「拖动时背景消失」）：编辑器 CSS 55% 配方撤下 + 内容卡面不透明 surface + 作者自选半透保留 + 选色纯色不透明 + paper/paint 填充层 opacity 1 + 合并组背景不透明/成员透明一体回归 + fc-moving 卡面逐字节不变/组背景 filter 挂起 + 注入层全灭 + SNE 62% 不动 + 0.55 仅剩 caption-edge-btn.locked
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

    // S7 v0.2.58.4：版本锚 + 宽窗完整格舞台投影（115 格横 + 格子线代码在场透明度 0）+ S8 呈现界面
    const artVer = await cdp.evalJs("window.MN_SITE_VERSION");
    ok('S7 阅读页线上版本 = v0.2.58.4', artVer === 'v0.2.58.4', 'ver=' + artVer);
    ok('S7b 宽窗完整格舞台投影自洽：s=min(availW/stageW,availH/stageH)（下限 0.25）+ holder=stage×s + 115 格横 + 格子线代码在场透明度 0',
      await cdp.evalJs("(function(){ var b = document.getElementById('artBody'); var h = b.querySelector('.art-canvas'); if (!h) return false; var e = h.querySelector('.art-canvas-inner'); var m = e.style.transform.match(/scale\\(([\\d.]+)\\)/); var s = m ? parseFloat(m[1]) : 0; var availH = Math.max(200, window.innerHeight - h.getBoundingClientRect().top - 24); var exp = Math.max(0.25, Math.min(b.clientWidth / e.offsetWidth, availH / e.offsetHeight)); var cs = getComputedStyle(e); var bi = cs.backgroundImage.replace(/\\s+/g, ''); return Math.abs(s - exp) <= 0.005 && Math.abs(h.clientWidth - Math.round(e.offsetWidth * s)) <= 2 && s >= 0.25 && Math.abs(e.offsetWidth / 22 - 115) <= 1 && bi.indexOf('linear-gradient') !== -1 && bi.indexOf('rgba(120,120,120,0)') !== -1; })()") === true,
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
    ok('S6 explore 页线上版本 = v0.2.58.4', exVer === 'v0.2.58.4', 'ver=' + exVer);
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

    // S9 v10.28.40.0 FC 编辑区固定 115 格横（用户「FC也是一样是115格横向，固定不会因窗口不够宽而缩小，最多底下横向拉条」）
    const scCfg = await (await fetch(BASE + '/assets/js/site-config.js')).text();
    ok('S9a 线上 site-config 含 FC v10.28.47.4 + 站点 v0.2.58.4', scCfg.indexOf('v10.28.47.4') !== -1 && scCfg.indexOf('v0.2.58.4') !== -1);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    let fcLoaded = false;
    try { fcLoaded = await waitFor(cdp, "!!document.getElementById('gridCanvas')", 30000, 'FC 编辑器加载'); } catch (e) {}
    ok('S9b 编辑器门禁通过（已登录种子）+ 画布在场', fcLoaded,
      await cdp.evalJs("location.pathname + ' canvas=' + !!document.getElementById('gridCanvas')").catch(() => 'EVAL_FAIL'));
    ok('S9c 固定 115 格：--grid-cols=115 + 画布盒宽 2528（max-content 全覆盖）+ 底部横向拉条在（scrollW>clientW）',
      await cdp.evalJs("(function(){ var gc = document.getElementById('gridCanvas'); var body = gc.parentElement; var cols = parseInt(getComputedStyle(gc).getPropertyValue('--grid-cols').trim(), 10); var cs = parseInt(getComputedStyle(gc).getPropertyValue('--cell-size').trim(), 10); return cols === 115 && cs === 20 && gc.offsetWidth === 2528 && body.scrollWidth > body.clientWidth; })()") === true,
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

    // S11 v10.28.41.0 发布日志弹窗（用户「点击发布的时候先弹出一个弹窗填写日志…限制320字」）
    // 编辑器已在场（S9 加载）；guest 无 USR 用户 → fcCloudMode 恒 false：
    // 演示确认全链零网络（saveDraft 只写探针一次性档案、publishXPReward 只动 localStorage）
    const s11dom = await cdp.evalJs("(function(){ var cnt = document.getElementById('pubLogCount'); return { modal: !!document.getElementById('publishLogModal'), ta: !!document.getElementById('pubLogInput'), cnt: cnt ? cnt.textContent : null, btn: !!document.querySelector('#publishLogModal button[onclick=\"confirmPublish()\"]') }; })()");
    ok('S11a 发布日志弹窗 DOM 在场（modal + 输入框 + 计数 0 / 320 + 确认发布按钮）',
      s11dom && s11dom.modal === true && s11dom.ta === true && s11dom.cnt === '0 / 320' && s11dom.btn === true, JSON.stringify(s11dom));
    await cdp.evalJs('window.openPublishLogModal()');
    await sleep(200);
    const s11o = await cdp.evalJs("(function(){ var ta = document.getElementById('pubLogInput'); return { open: document.getElementById('modalBackdrop').classList.contains('active') && document.querySelector('#publishLogModal .modal-card').classList.contains('active'), h: ta.offsetHeight, cnt: document.getElementById('pubLogCount').textContent }; })()");
    ok('S11b 打开弹窗：遮罩+卡片 active + 输入框固定初始高 ~110 + 计数 0 / 320',
      s11o && s11o.open === true && s11o.h >= 110 && s11o.h <= 120 && s11o.cnt === '0 / 320', JSON.stringify(s11o));
    const s11c = await cdp.evalJs("(function(){ var ta = document.getElementById('pubLogInput'); ta.value = 'hello world'; ta.dispatchEvent(new Event('input',{bubbles:true})); var c1 = document.getElementById('pubLogCount').textContent; ta.value = 'code'; ta.dispatchEvent(new Event('input',{bubbles:true})); return { c1: c1, c2: document.getElementById('pubLogCount').textContent }; })()");
    ok('S11c 计数按空格分词：hello world=2 / 320、code=1 / 320（用户钦定口径）',
      s11c && s11c.c1 === '2 / 320' && s11c.c2 === '1 / 320', JSON.stringify(s11c));
    const s11g = await cdp.evalJs("(function(){ var ta = document.getElementById('pubLogInput'); var h0 = ta.offsetHeight; ta.value = Array(8).fill('这是一行比较长的日志内容文字').join('\\n'); ta.dispatchEvent(new Event('input',{bubbles:true})); var h1 = ta.offsetHeight; ta.value = Array(120).fill('abcdefgh').join(' '); ta.dispatchEvent(new Event('input',{bubbles:true})); return { h0: h0, h1: h1, sh: ta.style.height, scrollH: ta.scrollHeight }; })()");
    ok('S11d 输入框随日志自动增长（8 行长高）+ 超长恰达 220px 上限内滚',
      s11g && s11g.h1 > s11g.h0 + 30 && s11g.sh === '220px' && s11g.scrollH > 220, JSON.stringify(s11g));
    const s11l = await cdp.evalJs("(function(){ var ta = document.getElementById('pubLogInput'); ta.value = Array(321).fill('x').join(' '); ta.dispatchEvent(new Event('input',{bubbles:true})); var over = document.getElementById('pubLogCount').classList.contains('over'); window.confirmPublish(); return over; })()");
    await sleep(200);
    const s11b2 = await cdp.evalJs("(function(){ return { toast: document.getElementById('toast').textContent, open: document.getElementById('modalBackdrop').classList.contains('active'), cnt: document.getElementById('pubLogCount').textContent }; })()");
    ok('S11e 321 词 → .over 红字 + 确认被硬拦（toast 超限提示 + 弹窗留 + 计数 321 / 320）',
      s11l === true && s11b2 && s11b2.toast === '日志超过 320 词上限，请删减' && s11b2.open === true && s11b2.cnt === '321 / 320', JSON.stringify(s11b2));
    await cdp.evalJs("(function(){ var b = Array.prototype.slice.call(document.querySelectorAll('#publishLogModal button')).filter(function(x){ return x.textContent.trim() === '取消'; })[0]; b.click(); })()");
    await sleep(200);
    ok('S11f 取消 → 弹窗关（发布未发生）',
      await cdp.evalJs("document.getElementById('modalBackdrop').classList.contains('active')") === false);
    await cdp.evalJs('window.openPublishLogModal()');
    await sleep(150);
    await cdp.evalJs("(function(){ var ta = document.getElementById('pubLogInput'); ta.value = '探针日志'; ta.dispatchEvent(new Event('input',{bubbles:true})); window.confirmPublish(); })()");
    await sleep(250);
    const s11p = await cdp.evalJs("(function(){ return { hs: document.getElementById('headerStatus').textContent, open: document.getElementById('modalBackdrop').classList.contains('active'), log: (function(){ try { return JSON.parse(localStorage.getItem('slati_fluidcanvas_draft')).log; } catch (e) { return null; } })() }; })()");
    ok('S11g 演示路径确认 → 弹窗关 + 徽章 Published + 日志落草稿「探针日志」',
      s11p && s11p.hs === 'Published' && s11p.open === false && s11p.log === '探针日志', JSON.stringify(s11p));
    await cdp.evalJs('window.openPublishLogModal()');
    await sleep(150);
    ok('S11h 再开弹窗预填上一条日志（草稿 log 往返）',
      await cdp.evalJs("document.getElementById('pubLogInput').value") === '探针日志');
    await cdp.evalJs("(function(){ var b = Array.prototype.slice.call(document.querySelectorAll('#publishLogModal button')).filter(function(x){ return x.textContent.trim() === '取消'; })[0]; b.click(); })()");
    await sleep(150);

    // S12 v10.28.42.0 全卡不透明（用户「把FC内的所有卡片变成不透明」——磨砂玻璃轮结束、
    // 08-17「100% 不透明」口径复活；也修「拖动时背景消失」——面不透明后 fc-moving 挂起
    // 对卡面成 no-op）。编辑器已在场；先归零滚动（S9 平移尾态清场），建卡→测→删段内完成。
    // 点选卡必须在窗口可见区：编辑器 client 宽 ~1014px、sne 卡放 20/32 列（46/58 列
    // x>1280 窗外 CDP 点击落空——首轮 S12d/e/f 红实证），与本地电池同位同口径
    await cdp.evalJs("(function(){ var body = document.getElementById('gridCanvas').parentElement; body.scrollLeft = 0; body.scrollTop = 0; })()");
    await sleep(400);
    const edHtml12 = (await (await fetch(BASE + '/pages/fluidcanvas-editor.html')).text()).replace(/\r\n/g, '\n'); // CRLF 归一（多行锚）
    ok('S12a 线上编辑器 CSS：55% 玻璃配方撤下（混色零在场）+ 卡面直用 --card-bg-color 不透明 + 卡身 blur 摘除',
      edHtml12.indexOf('color-mix(in srgb, var(--card-bg-color) 55%, transparent)') === -1 &&
      edHtml12.indexOf('--card-border-color: var(--divider-line);\n      background-color: var(--card-bg-color);\n    }') !== -1);
    const lastOf = (sel) => "(function(){ var cs = document.querySelectorAll('" + sel + "'); return cs.length ? cs[cs.length - 1] : null; })()";
    await cdp.evalJs('window.createContentCard(2, 40, 8, 4)');
    await sleep(200);
    let f12 = await cdp.evalJs("(function(){ var c = " + lastOf('#gridCanvas .content-card') + "; if (!c) return null; var cs = getComputedStyle(c); return { bg: cs.backgroundColor, blur: cs.backdropFilter || 'none', webkitBlur: cs.webkitBackdropFilter || 'none' }; })()");
    ok('S12b 内容卡：卡面不透明 surface-container + blur 摘除（含 -webkit）',
      f12 && f12.bg.replace(/\s/g, '') === 'rgb(236,238,240)' && f12.blur === 'none' && f12.webkitBlur === 'none', JSON.stringify(f12));
    const d12 = await cdp.evalJs("(function(){ var c = " + lastOf('#gridCanvas .content-card') + "; if (!c) return null; c.style.setProperty('--card-bg-color', 'rgba(220, 38, 38, 0.15)'); var bg = getComputedStyle(c).backgroundColor; c.style.removeProperty('--card-bg-color'); return { bg: bg, after: getComputedStyle(c).backgroundColor }; })()");
    ok('S12c 作者自选半透明背景原样保留（rgba(220,38,38,0.15) 用户选色通道不受玻璃轮影响、撤后回 surface）',
      d12 && d12.bg.replace(/\s/g, '') === 'rgba(220,38,38,0.15)' && d12.after.replace(/\s/g, '') === 'rgb(236,238,240)', JSON.stringify(d12));
    await cdp.evalJs('window.createSneCard(2, 20, 9, 12)');
    await sleep(200);
    const sel12 = await cdp.evalJs("(function(){ var c = " + lastOf('#gridCanvas .sne-card') + "; var r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 30 }; })()");
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sel12.x, y: sel12.y, button: 'left', clickCount: 1, modifiers: 0 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sel12.x, y: sel12.y, button: 'left', clickCount: 1, modifiers: 0 });
    await sleep(150);
    await cdp.evalJs('window.setSubscriptionTestMode(true)');
    await cdp.evalJs("window.setCardBgColor('#d43c3c')");
    await sleep(150);
    f12 = await cdp.evalJs("(function(){ var c = " + lastOf('#gridCanvas .sne-card') + "; if (!c) return null; var cs = getComputedStyle(c); return { bg: cs.backgroundColor, blur: cs.backdropFilter || 'none' }; })()");
    ok('S12d 选色 #d43c3c：卡面=纯色 rgb(212,60,60) 不透明 + blur 仍无',
      f12 && f12.bg.replace(/\s/g, '') === 'rgb(212,60,60)' && f12.blur === 'none', JSON.stringify(f12));
    await cdp.evalJs("window.setCardEdge('paper')");
    await sleep(150);
    const paper12 = await cdp.evalJs("(function(){ var c = " + lastOf('#gridCanvas .sne-card') + "; if (!c) return null; var t = c.querySelector('.card-tint'); if (!t) return null; var cts = getComputedStyle(t); return { tintOp: cts.opacity, tintBg: cts.backgroundColor, tintImg: cts.backgroundImage.slice(0, 40), edge: c.className.indexOf('card-edge-paper') !== -1 }; })()");
    ok('S12e 纸主题：tint 层 opacity 1 + 底色不透明 surface + 渐变层在位',
      paper12 && paper12.edge && paper12.tintOp === '1' && paper12.tintBg.replace(/\s/g, '') === 'rgb(236,238,240)' &&
      paper12.tintImg.indexOf('linear-gradient') !== -1, JSON.stringify(paper12));
    await cdp.evalJs("window.setCardEdge('paint1')");
    await sleep(150);
    const paint12 = await cdp.evalJs("(function(){ var c = " + lastOf('#gridCanvas .sne-card') + "; if (!c) return null; var p = getComputedStyle(c, '::before'); return { op: p.opacity, img: p.backgroundImage.slice(0, 40), edge: c.className.indexOf('card-edge-paint') !== -1 }; })()");
    ok('S12f 油漆主题：::before 填充 opacity 1 + 渐变在位',
      paint12 && paint12.edge && paint12.op === '1' && paint12.img.indexOf('linear-gradient') !== -1, JSON.stringify(paint12));
    await cdp.evalJs('window.createSneCard(2, 32, 9, 12)');
    await sleep(200);
    await cdp.evalJs("(function(){ var cards = document.querySelectorAll('#gridCanvas .sne-card'); window.mergeCards(cards[cards.length - 1], cards[cards.length - 2], 'right'); })()");
    await sleep(250);
    const grp12 = await cdp.evalJs("(function(){ var gb = document.querySelector('.grid-group-bg'); if (!gb) return null; var gcs = getComputedStyle(gb); var members = []; document.querySelectorAll('.grid-card[data-group-id]').forEach(function(c){ if (c.dataset.groupId) members.push({ bg: getComputedStyle(c).backgroundColor, blur: getComputedStyle(c).backdropFilter || 'none' }); }); return { gb: gcs.backgroundColor, gblur: gcs.backdropFilter || 'none', members: members }; })()");
    ok('S12g 合并组背景：卡面不透明 surface + blur 摘除 + 成员面透明一体回归',
      grp12 && grp12.gb.replace(/\s/g, '') === 'rgb(236,238,240)' && grp12.gblur === 'none' &&
      grp12.members.length >= 2 && grp12.members.every(function (m) { return m.bg.replace(/\s/g, '') === 'rgba(0,0,0,0)' && m.blur === 'none'; }),
      JSON.stringify(grp12));
    const mv12 = async () => cdp.evalJs("(function(){ var c = " + lastOf('#gridCanvas .content-card') + "; if (!c) return null; var cs = getComputedStyle(c); return { bg: cs.backgroundColor, blur: cs.backdropFilter || 'none' }; })()");
    const mBefore = await mv12();
    await cdp.evalJs("document.body.classList.add('fc-moving')");
    await sleep(60);
    const mDuring = await mv12();
    await cdp.evalJs("document.body.classList.remove('fc-moving')");
    await sleep(60);
    const mAfter = await mv12();
    ok('S12h fc-moving 挂起：独立卡卡面 before=during=after 逐字节一致（拖动时背景不再「消失」）',
      JSON.stringify(mBefore) === JSON.stringify(mDuring) && JSON.stringify(mBefore) === JSON.stringify(mAfter),
      JSON.stringify({ before: mBefore, during: mDuring, after: mAfter }));
    const gb12 = async () => cdp.evalJs("(function(){ var gb = document.querySelector('.grid-group-bg'); var cs = getComputedStyle(gb); return { bg: cs.backgroundColor, filter: cs.filter }; })()");
    const gbB = await gb12();
    await cdp.evalJs("document.body.classList.add('fc-moving')");
    await sleep(60);
    const gbD = await gb12();
    await cdp.evalJs("document.body.classList.remove('fc-moving')");
    await sleep(60);
    const gbA = await gb12();
    ok('S12i fc-moving 下组背景：底色 before=during=after 不变（面不消失）、filter 描边挂起为 none=45.2 纪律',
      gbB && gbD && gbA && gbB.bg === gbD.bg && gbD.bg === gbA.bg &&
      gbB.filter !== 'none' && gbD.filter === 'none' && gbA.filter === gbB.filter,
      JSON.stringify({ before: gbB, during: gbD, after: gbA }));
    const inj12 = await cdp.evalJs("(function(){ var out = []; document.querySelectorAll('#gridCanvas .grid-card > .lg-backdrop, #gridCanvas .grid-card > .lg-specular').forEach(function(l){ out.push(l.className + ':' + getComputedStyle(l).display); }); var gb = document.querySelector('.grid-group-bg'); if (gb) gb.querySelectorAll(':scope > .lg-backdrop, :scope > .lg-specular').forEach(function(l){ out.push(l.className + ':' + getComputedStyle(l).display); }); return out; })()");
    ok('S12j 玻璃注入层：卡/组背景上不在场或 display:none（零可见注入层）',
      inj12.every(function (s) { return s.indexOf(':none') !== -1; }), JSON.stringify(inj12));
    ok('S12k 不动锚：SNE 格底 62% 混色保留（40.0 口径不受玻璃轮影响）',
      edHtml12.indexOf('color-mix(in srgb, var(--sne-cell-tint') !== -1);
    ok('S12l 编辑器 CSS opacity: 0.55 只剩 caption-edge-btn.locked 一处（主题卡/paint 的 0.55 已除）',
      (edHtml12.match(/opacity: 0\.55/g) || []).length === 1 &&
      edHtml12.split('\n').filter(function (l) { return l.indexOf('opacity: 0.55') !== -1; })[0].indexOf('.caption-edge-btn.locked') !== -1);

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
