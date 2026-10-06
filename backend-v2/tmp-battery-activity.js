// tmp-battery-activity.js — v0.2.58.28 动态页真实数据接入电池
// 用户「能不能先把动态页面的所有实际功能做一下？」——六大区块假数据全撤、搜索接过滤、全站灯塔。
// 断言面：F1 页面静态 → F1-2 site-config 版本+灯塔 → F1-3 i18n 键族 → F1-4 后端源码
//        → R9 无桩导航离线态 → R1 初始加载 5 卡真实值 → R2 切 7d 重拉 → R3 切 metric 零重拉 → R4 内容类型
//        → R5 热力图 → R6 榜 → R7 相对时间 → R8 搜索过滤零重拉 → R10 空夹具空态 → R11 灯塔每页一次
//        → R12 切语言从缓存重渲 → E1 零异常
// 注意：fetch 桩必须同时覆写 navigator.sendBeacon（灯塔 sendBeacon 优先，只 patch fetch 会漏记）。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const BE = path.join(ROOT, 'backend-v2');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-activity-batt-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};

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
      } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        this.errs.push(JSON.stringify({ text: m.params.entry.text, url: m.params.entry.url || '' }).slice(0, 200));
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
    await sleep(120);
  }
  throw new Error('waitFor 超时: ' + label);
}

// ═══ 夹具（骨架同真实响应；30d：kpi 47/913/23/11/156、contentTypes 11/34/52/88、heatmap maxCell 37、
// leaderboard 3 行含 Nova Terra 🪐、milestones 3 条 isoAgo(2)/isoAgo(3)/now-1h）═══
const NOW = Date.now();
const isoAgo = (d) => new Date(NOW - d * 86400e3).toISOString();
const isoHoursAgo = (h) => new Date(NOW - h * 3600e3).toISOString();
function ts(base, step) {
  const arr = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(NOW - (29 - i) * 86400e3);
    arr.push({ date: d.toISOString().slice(0, 10), value: base + i * step });
  }
  return arr;
}
const HEAT = {
  timeBlocks: ['00-04', '04-08', '08-12', '12-16', '16-20', '20-24'],
  days: [
    { key: 'mon', total: 40, cells: [1, 2, 3, 4, 5, 6] },
    { key: 'tue', total: 50, cells: [2, 3, 4, 5, 6, 7] },
    { key: 'wed', total: 60, cells: [3, 4, 5, 6, 7, 8] },
    { key: 'thu', total: 70, cells: [4, 5, 6, 7, 8, 9] },
    { key: 'fri', total: 80, cells: [5, 6, 7, 8, 9, 10] },
    { key: 'sat', total: 90, cells: [6, 7, 8, 9, 10, 11] },
    { key: 'sun', total: 100, cells: [37, 8, 9, 10, 11, 12] }
  ],
  maxCell: 37
};
const FIX_30D = {
  range: '30d', from: isoAgo(29), to: new Date(NOW).toISOString(),
  kpi: {
    nations: { value: 47, prev: 3, deltaPct: 12.5 },
    citizens: { value: 913, prev: 20, deltaPct: 8.3 },
    newCitizens: { value: 23, prev: 10, deltaPct: 130 },
    articles: { value: 11, prev: 8, deltaPct: 37.5 },
    activity: { value: 156, prev: 120, deltaPct: 30 }
  },
  trends: { users: ts(1, 1), nations: ts(0, 2), articles: ts(2, 1), teams: ts(0, 1) },
  contentTypes: { articles: 11, posts: 34, comments: 52, likes: 88 },
  heatmap: HEAT,
  leaderboard: [
    { rank: 1, name: 'Nova Terra', flag: '🪐', score: 10 },
    { rank: 2, name: 'Königreich Aethel', flag: '👑', score: 5 },
    { rank: 3, name: 'Land 3', flag: null, score: 2 }
  ],
  milestones: [
    { type: 'nation', title: 'Nova Terra', at: isoAgo(2) },
    { type: 'article', title: 'Nova Charter', at: isoAgo(3) },
    { type: 'citizen', title: null, at: isoHoursAgo(1) }
  ]
};
const FIX_7D = Object.assign({}, FIX_30D, {
  range: '7d',
  kpi: Object.assign({}, FIX_30D.kpi, { newCitizens: { value: 7, prev: 4, deltaPct: 75 } })
});
const FIX_EMPTY = {
  range: '90d', from: isoAgo(29), to: new Date(NOW).toISOString(),
  kpi: {
    nations: { value: 0, prev: 0, deltaPct: null },
    citizens: { value: 0, prev: 0, deltaPct: null },
    newCitizens: { value: 0, prev: 0, deltaPct: null },
    articles: { value: 0, prev: 0, deltaPct: null },
    activity: { value: 0, prev: 0, deltaPct: null }
  },
  trends: { users: ts(0, 0), nations: ts(0, 0), articles: ts(0, 0), teams: ts(0, 0) },
  contentTypes: { articles: 0, posts: 0, comments: 0, likes: 0 },
  heatmap: { timeBlocks: HEAT.timeBlocks, days: HEAT.days.map((d) => ({ key: d.key, total: 0, cells: [0, 0, 0, 0, 0, 0] })), maxCell: 0 },
  leaderboard: [],
  milestones: []
};

const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  if (u.indexOf("/api/analytics/pageview") !== -1) {' +
  '   return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  if (u.indexOf("/api/public/activity") !== -1) {' +
  '   window.__mnActCalls = (window.__mnActCalls || 0) + 1;' +
  '   var body = ' + JSON.stringify(FIX_30D) + ';' +
  '   try { if (localStorage.getItem("__mnActEmpty") === "1") { body = ' + JSON.stringify(FIX_EMPTY) + '; }' +
  '         else if (u.indexOf("range=7d") !== -1) { body = ' + JSON.stringify(FIX_7D) + '; } } catch (e) {}' +
  '   return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  ' var realBeacon = navigator.sendBeacon.bind(navigator);' +
  ' navigator.sendBeacon = function (url, data) {' +
  '  var u = String(url);' +
  '  if (u.indexOf("/api/analytics/pageview") !== -1) {' +
  '   window.__mnPvCalls = window.__mnPvCalls || [];' +
  '   var done = function (txt) {' +
  '    var p = null; try { p = JSON.parse(txt); } catch (e) {}' +
  '    window.__mnPvCalls.push({ path: p && p.path, clientId: p && p.clientId });' +
  '   };' +
  '   try {' +
  '    if (data && typeof data.text === "function") { var t = data.text(); if (t && typeof t.then === "function") { t.then(done).catch(function(){}); } else { done(String(t)); } }' +
  '    else { done(String(data || "")); }' +
  '   } catch (e) {}' +
  '   return true;' +
  '  }' +
  '  return realBeacon(url, data);' +
  ' };' +
  '})();}catch(e){}';

(async () => {
  // ═══ F 静态 ═══
  const act = fs.readFileSync(path.join(DOCS, 'pages', 'activity.html'), 'utf8').replace(/\r\n/g, '\n');
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8').replace(/\r\n/g, '\n');
  const i18n = fs.readFileSync(path.join(DOCS, 'assets', 'i18n', 'activity.i18n.js'), 'utf8');
  const serverSrc = fs.readFileSync(path.join(BE, 'src', 'server.js'), 'utf8');
  const routeSrc = fs.readFileSync(path.join(BE, 'src', 'routes', 'public', 'activity-stats.js'), 'utf8');
  const aggSrc = fs.readFileSync(path.join(BE, 'src', 'analytics', 'public-activity.js'), 'utf8');
  const count = (s, n) => s.split(n).length - 1;

  console.log('═══ F1-1 activity.html 静态 ═══');
  ok('F1-1 api.js 引入 + 搜索框 id + 内容类型键 + 端点调用（各 ×1）',
    count(act, 'assets/js/api.js') === 1 && count(act, 'id="activitySearch"') === 1 &&
    count(act, 'activity.chart.contentTypes') === 1 && count(act, "MN_API.get('/public/activity") === 1,
    'api=' + count(act, 'assets/js/api.js') + ' search=' + count(act, 'id="activitySearch"') +
    ' ct=' + count(act, 'activity.chart.contentTypes') + ' ep=' + count(act, "MN_API.get('/public/activity"));
  ok('F1-2 假数据种子零残留（7 项全 0）',
    count(act, 'Republic of Etheria') === 0 && count(act, 'generateGrowthSeries') === 0 &&
    count(act, 'kpiData') === 0 && count(act, 'topNations') === 0 && count(act, 'trendData') === 0 &&
    count(act, '892') === 0 && count(act, 'treaties') === 0,
    'etheria=' + count(act, 'Republic of Etheria') + ' ggs=' + count(act, 'generateGrowthSeries') +
    ' kpiData=' + count(act, 'kpiData') + ' top=' + count(act, 'topNations') + ' td=' + count(act, 'trendData') +
    ' 892=' + count(act, '892') + ' treaties=' + count(act, 'treaties'));
  ok('F1-3 新渲染骨架（新键引用/空态/离线态/陈旧守卫/缓存）',
    count(act, 'activity.kpi.newCitizens') === 1 && count(act, 'activity.empty.heatmap') === 1 &&
    count(act, 'activity.offline.title') === 1 && count(act, 'activity.ms.title.citizen') === 1 &&
    count(act, "activity.ct.' + m.key") === 1 && count(act, 'state.cache') >= 3 &&
    count(act, 'renderOffline()') >= 2 && count(act, '.act-empty') === 1 &&
    count(act, 'class="act-empty"') === 1,
    'newC=' + count(act, 'activity.kpi.newCitizens') + ' heat=' + count(act, 'activity.empty.heatmap') +
    ' off=' + count(act, 'activity.offline.title') + ' citizen=' + count(act, 'activity.ms.title.citizen') +
    ' cache=' + count(act, 'state.cache') + ' offn=' + count(act, 'renderOffline()') +
    ' empty=' + count(act, '.act-empty') + '/' + count(act, 'class="act-empty"'));

  console.log('═══ F1-2 site-config.js 版本+灯塔 ═══');
  ok('F1-2a 版本 58.16 在位/58.15 赋值零残留/FC 恒 47.4',
    count(sconf, "window.MN_SITE_VERSION = 'v0.2.58.28';") === 1 &&
    count(sconf, "window.MN_SITE_VERSION = 'v0.2.58.15';") === 0 &&
    count(sconf, "window.FLUIDCANVAS_VERSION = 'v10.28.62.5';") === 1,
    'v16=' + count(sconf, "window.MN_SITE_VERSION = 'v0.2.58.28';") +
    ' v15res=' + count(sconf, "window.MN_SITE_VERSION = 'v0.2.58.15';"));
  ok('F1-2b changelog 条目（标题+原话片断+rev 注记）',
    count(sconf, '// v0.2.58.28 = ') === 1 && count(sconf, '能不能先把动态页面的') === 1 &&
    count(sconf, 'rev 00348-') === 2 && count(sconf, 'rev 00349-') === 2,
    'title=' + count(sconf, '// v0.2.58.28 = ') + ' quote=' + count(sconf, '能不能先把动态页面的'));
  ok('F1-2c 灯塔块（守卫/端点/slati_cid/发送双通道）',
    count(sconf, '__slatiPvSent') === 3 && count(sconf, '/analytics/pageview') === 3 &&
    count(sconf, 'slati_cid') === 4 && count(sconf, 'navigator.sendBeacon') === 2 &&
    count(sconf, 'keepalive: true') === 1,
    'sent=' + count(sconf, '__slatiPvSent') + ' ep=' + count(sconf, '/analytics/pageview') +
    ' cid=' + count(sconf, 'slati_cid') + ' beacon=' + count(sconf, 'navigator.sendBeacon'));

  console.log('═══ F1-3 i18n 键族 ═══');
  ok('F1-3a 新键 ×12 语（代表性 5 键）+ zh-Hant 标记 ×1',
    count(i18n, 'activity.kpi.newCitizens') === 12 && count(i18n, 'activity.chart.contentTypes') === 12 &&
    count(i18n, 'activity.ms.title.citizen') === 12 && count(i18n, 'activity.empty.heatmap') === 12 &&
    count(i18n, 'activity.offline.title') === 12 && count(i18n, '__ZH_HANT_AUTO__') === 1,
    'newC=' + count(i18n, 'activity.kpi.newCitizens') + ' ct=' + count(i18n, 'activity.chart.contentTypes') +
    ' hant=' + count(i18n, '__ZH_HANT_AUTO__'));
  ok('F1-3b 旧键族零残留（条约/分类/desc/time）',
    count(i18n, 'treatiesSigned') === 0 && count(i18n, 'activity.cat.governance') === 0 &&
    count(i18n, 'ms.desc.anniv2') === 0 && count(i18n, 'ms.time.t2d') === 0 &&
    count(i18n, 'activity.chart.category') === 0,
    'treaty=' + count(i18n, 'treatiesSigned') + ' cat=' + count(i18n, 'activity.cat.governance'));

  console.log('═══ F1-4 后端源码 ═══');
  ok('F1-4a server.js 装配（require+register）',
    count(serverSrc, "require('./routes/public/activity-stats')") === 1 && count(serverSrc, 'registerActivityStats') === 2,
    'req=' + count(serverSrc, "require('./routes/public/activity-stats')") + ' reg=' + count(serverSrc, 'registerActivityStats'));
  ok('F1-4b 路由（端点/限流配置/键）+ 聚合（SQL 口径）',
    count(routeSrc, "'/api/public/activity'") === 1 && count(routeSrc, 'publicActivity') === 1 &&
    count(routeSrc, "'pa:ip:'") === 1 &&
    count(aggSrc, "strftime('%w'") === 1 && count(aggSrc, 'substr(created_at,12,2)') === 1 &&
    count(aggSrc, "target_type = 'post'") === 3,
    'ep=' + count(routeSrc, "'/api/public/activity'") + ' pa=' + count(routeSrc, "'pa:ip:'") +
    ' dow=' + count(aggSrc, "strftime('%w'") + ' post=' + count(aggSrc, "target_type = 'post'"));
  console.log('');

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
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Log.enable'); await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });

    const PAGE_URL = BASE + '/pages/activity.html';
    const READY = "document.querySelectorAll('#kpiRow .kpi-card').length === 5";

    // ═══ R9 无桩导航 → 离线态（绝不回退假数据）═══
    console.log('═══ R 浏览器流程 ═══');
    await cdp.send('Page.navigate', { url: PAGE_URL });
    await waitFor(cdp, "document.body.textContent.indexOf('数据暂时不可用') !== -1 || document.body.textContent.indexOf('Data temporarily unavailable') !== -1", 30000, 'R9 离线态');
    const r9 = await cdp.evalJs("(function(){return {off:document.body.textContent.indexOf('数据暂时不可用') !== -1,kpi:document.querySelectorAll('#kpiRow .kpi-card').length,has892:document.body.textContent.indexOf('892') !== -1,ct:document.getElementById('trendChart').textContent.length};})()");
    ok('R9 无桩 → 离线提示卡 + 零 kpi-card + 无 892 + 图表清空',
      r9.off && r9.kpi === 0 && !r9.has892 && r9.ct === 0, JSON.stringify(r9));

    // ═══ 装桩 → R1 初始加载 ═══
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    await cdp.send('Page.navigate', { url: PAGE_URL });
    await waitFor(cdp, READY + " && document.querySelectorAll('#kpiRow .kpi-label')[4].textContent === '新公民'", 30000, 'R1 五卡渲染+i18n');
    const r1 = await cdp.evalJs("(function(){var vs=Array.prototype.map.call(document.querySelectorAll('#kpiRow .kpi-value'),function(e){return e.textContent;});var ls=Array.prototype.map.call(document.querySelectorAll('#kpiRow .kpi-label'),function(e){return e.textContent;});var hb=Array.prototype.map.call(document.querySelectorAll('.hbar-label'),function(e){return e.textContent;});var lb=document.querySelector('.lb-row');var ms=Array.prototype.map.call(document.querySelectorAll('.milestone-title'),function(e){return e.textContent;});return {n:document.querySelectorAll('#kpiRow .kpi-card').length,v0:vs[0],v4:vs[4],l4:ls[4],hbN:hb.length,hb0:hb[0],lb:lb?lb.textContent:'',ms:ms,heat:document.querySelectorAll('.heatmap-cell').length,calls:window.__mnActCalls};})()");
    ok('R1 初始 30d（5 卡/47/23/新公民/文章/榜首 Nova Terra 🪐/里程碑[2] 一位新公民/热力 42 格/1 拉取）',
      r1.n === 5 && r1.v0 === '47' && r1.v4 === '23' && r1.l4 === '新公民' && r1.hbN === 4 && r1.hb0 === '文章' &&
      r1.lb.indexOf('Nova Terra') !== -1 && r1.lb.indexOf('🪐') !== -1 && r1.ms[2] === '一位新公民' &&
      r1.heat === 42 && r1.calls === 1, JSON.stringify(r1));

    // ═══ R2 切 7d 重拉 ═══
    await cdp.evalJs("document.querySelector('#timeRangePills [data-range=\"7d\"]').click()");
    await waitFor(cdp, "document.querySelectorAll('#kpiRow .kpi-value')[4].textContent === '7'", 8000, 'R2 7d 新公民 7');
    const r2 = await cdp.evalJs("(function(){return {v4:document.querySelectorAll('#kpiRow .kpi-value')[4].textContent,calls:window.__mnActCalls,has892:document.body.textContent.indexOf('892') !== -1};})()");
    ok('R2 切 7d（新公民 23→7 + 拉取数 2 + 无 892）', r2.v4 === '7' && r2.calls === 2 && !r2.has892, JSON.stringify(r2));

    // ═══ R3 切 metric 零重拉 ═══
    await cdp.evalJs("document.querySelector('#trendTabs [data-metric=\"nations\"]').click()");
    await waitFor(cdp, "document.querySelectorAll('.trend-bar')[29].getAttribute('data-val') === '58'", 8000, 'R3 nations 末柱 58');
    const r3 = await cdp.evalJs("(function(){return {last:document.querySelectorAll('.trend-bar')[29].getAttribute('data-val'),calls:window.__mnActCalls};})()");
    ok('R3 切 metric（末柱 30→58 + 拉取数停 2）', r3.last === '58' && r3.calls === 2, JSON.stringify(r3));

    // ═══ R4 内容类型（7d 口径仍 11/34/52/88 夹具同值）═══
    const r4 = await cdp.evalJs("(function(){var hs=Array.prototype.map.call(document.querySelectorAll('.hbar-count'),function(e){return e.textContent;});var ps=Array.prototype.map.call(document.querySelectorAll('.hbar-pct'),function(e){return e.textContent;});return {hs:hs,p0:ps[0]};})()");
    ok('R4 hbar 计数 11/34/52/88 + 首条 5.9%', r4.hs.join(',') === '11,34,52,88' && r4.p0 === '5.9%', JSON.stringify(r4));

    // ═══ R5 热力图 ═══
    const r5 = await cdp.evalJs("(function(){var ls=Array.prototype.map.call(document.querySelectorAll('.heatmap-label'),function(e){return e.textContent;});var ts=document.querySelectorAll('.heatmap-total').length;var max=Array.prototype.filter.call(document.querySelectorAll('.heatmap-cell'),function(c){return (c.getAttribute('style')||'').indexOf('0.96')!==-1;}).length;return {l0:ls[0],totals:ts,max:max};})()");
    ok('R5 热力图（首行 00-04 + 七列合计 + maxCell 37 满强度格在位）', r5.l0 === '00-04' && r5.totals === 7 && r5.max >= 1, JSON.stringify(r5));

    // ═══ R6 排行榜 ═══
    const r6 = await cdp.evalJs("(function(){var rs=Array.prototype.map.call(document.querySelectorAll('.lb-rank'),function(e){return e.textContent;});return {n:rs.length,ranks:rs.join(',')};})()");
    ok('R6 榜 3 行 rank 1/2/3', r6.n === 3 && r6.ranks === '1,2,3', JSON.stringify(r6));

    // ═══ R7 相对时间 ═══
    const r7 = await cdp.evalJs("(function(){return Array.prototype.map.call(document.querySelectorAll('.milestone-date'),function(e){return e.textContent;});})()");
    ok('R7 里程碑相对时间 2 天前/3 天前/今天', r7.join('|') === '2 天前|3 天前|今天', JSON.stringify(r7));

    // ═══ R8 搜索过滤零重拉 ═══
    await cdp.evalJs("(function(){var el=document.getElementById('activitySearch');el.value='nova';el.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await waitFor(cdp, "document.querySelectorAll('.lb-row').length === 1 && document.querySelectorAll('.milestone').length === 2", 8000, 'R8 nova 过滤');
    const r8a = await cdp.evalJs("(function(){return {lb:document.querySelectorAll('.lb-row').length,ms:document.querySelectorAll('.milestone').length,calls:window.__mnActCalls};})()");
    ok('R8a 搜索 nova（榜 1 行 + 里程碑 2 条 + 拉取数不变）', r8a.lb === 1 && r8a.ms === 2 && r8a.calls === 2, JSON.stringify(r8a));
    await cdp.evalJs("(function(){var el=document.getElementById('activitySearch');el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await waitFor(cdp, "document.querySelectorAll('.lb-row').length === 3 && document.querySelectorAll('.milestone').length === 3", 8000, 'R8 清空复原');
    const r8b = await cdp.evalJs("(function(){return {lb:document.querySelectorAll('.lb-row').length,ms:document.querySelectorAll('.milestone').length,calls:window.__mnActCalls};})()");
    ok('R8b 清空复原（榜 3 行 + 里程碑 3 条 + 拉取数仍 2）', r8b.lb === 3 && r8b.ms === 3 && r8b.calls === 2, JSON.stringify(r8b));

    // ═══ R10 空夹具空态（localStorage 旗 + 点 90d 触发；绝不回退假数据）═══
    await cdp.evalJs("localStorage.setItem('__mnActEmpty','1');document.querySelector('#timeRangePills [data-range=\"90d\"]').click()");
    await waitFor(cdp, "document.getElementById('heatmapContainer').textContent.indexOf('访问数据正在积累中') !== -1", 10000, 'R10 热力图空态');
    const r10 = await cdp.evalJs("(function(){var vs=Array.prototype.map.call(document.querySelectorAll('#kpiRow .kpi-value'),function(e){return e.textContent;});return {empty:document.querySelectorAll('.act-empty').length,heat:document.getElementById('heatmapContainer').textContent.indexOf('访问数据正在积累中')!==-1,sec:document.getElementById('leaderboardList').textContent.indexOf('这里还没有内容')!==-1,vals:vs.join(','),calls:window.__mnActCalls};})()");
    ok('R10 空夹具（热力图积累提示 + 四区空态 + 5 卡全 0 + 拉取 3）',
      r10.empty === 4 && r10.heat && r10.sec && r10.vals === '0,0,0,0,0' && r10.calls === 3, JSON.stringify(r10));
    await cdp.evalJs("localStorage.removeItem('__mnActEmpty');document.querySelector('#timeRangePills [data-range=\"30d\"]').click()");
    await waitFor(cdp, "document.querySelectorAll('#kpiRow .kpi-value')[0].textContent === '47'", 8000, 'R10 回 30d 缓存复原');
    const r10b = await cdp.evalJs("(function(){return {v0:document.querySelectorAll('#kpiRow .kpi-value')[0].textContent,calls:window.__mnActCalls};})()");
    ok('R10b 回 30d（缓存命中复原 47 + 零新拉取）', r10b.v0 === '47' && r10b.calls === 3, JSON.stringify(r10b));

    // ═══ R11 灯塔每页一次（sendBeacon 桩记录；需重新导航触发 site-config 灯塔）═══
    await cdp.send('Page.navigate', { url: PAGE_URL });
    await waitFor(cdp, READY, 30000, 'R11 重载渲染');
    await waitFor(cdp, "(window.__mnPvCalls||[]).length === 1", 10000, 'R11 灯塔记录');
    const r11 = await cdp.evalJs("(function(){var c=window.__mnPvCalls||[];return {n:c.length,path:c[0]&&c[0].path,cid:c[0]&&c[0].clientId,sent:window.__slatiPvSent};})()");
    ok('R11 灯塔每页一次（1 条/路径 activity.html/clientId 非空/守卫置位）',
      r11.n === 1 && r11.path === '/pages/activity.html' && !!r11.cid && r11.sent === true, JSON.stringify(r11));

    // ═══ R12 切语言从缓存重渲（零重拉）═══
    await cdp.evalJs("window.MN_I18N.setLang('en')");
    await waitFor(cdp, "document.querySelectorAll('#kpiRow .kpi-label')[4].textContent === 'New Citizens'", 8000, 'R12 en');
    const r12a = await cdp.evalJs("(function(){return {l4:document.querySelectorAll('#kpiRow .kpi-label')[4].textContent,v0:document.querySelectorAll('#kpiRow .kpi-value')[0].textContent,calls:window.__mnActCalls};})()");
    ok('R12a setLang(en)（第 5 标签 New Citizens + 值仍 47 + 零重拉）', r12a.l4 === 'New Citizens' && r12a.v0 === '47' && r12a.calls === 1, JSON.stringify(r12a));
    await cdp.evalJs("window.MN_I18N.setLang('zh')");
    await waitFor(cdp, "document.querySelectorAll('#kpiRow .kpi-label')[4].textContent === '新公民'", 8000, 'R12 zh');
    const r12b = await cdp.evalJs("(function(){return {l4:document.querySelectorAll('#kpiRow .kpi-label')[4].textContent,v0:document.querySelectorAll('#kpiRow .kpi-value')[0].textContent};})()");
    ok('R12b setLang(zh) 复原（新公民 + 47）', r12b.l4 === '新公民' && r12b.v0 === '47', JSON.stringify(r12b));

    // ═══ E1 全程零异常零 console error ═══
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|settings-menu|\/api\//i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('E1 控制台零错误（噪声已滤）', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));

    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    fail++;
  }
  try { require('child_process').spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  server.close();
  console.log('\n═══ ' + (fail === 0 ? 'ALL GREEN' : 'FAILED') + ' — ' + pass + '/' + (pass + fail) + ' ═══');
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(fail === 0 ? 0 : 1);
})();
