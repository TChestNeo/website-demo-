// tmp-probe-activity.js — v0.2.58.16 动态页真实数据接入线上探针（rev 00328- 终态上线后跑）
// 用户「能不能先把动态页面的所有实际功能做一下？」——六大区块假数据全撤、搜索接过滤、全站 pageview 灯塔。
// S 静态/端点：S1 线上页面静态（api.js 在位/id=activitySearch/chart.contentTypes/MN_API.get 调用/假数据种子
//   零残留/新键名在位）S2 端点形状（range 回显 30d/kpi 5 键/trends 四序列各 30 条/heatmap 6 时段×7 天×6 格
//   maxCell 数字/leaderboard+contentTypes 结构）S3 range 族 7d/30d/90d/all 全 200 且 all.from===2000-01-01
//   S4 PII 禁令（响应体无 @ 无 display_name）；
// P 实机：P1 页面值=端点值（CDP 读 5 卡逐项比对 live fmt；非 892/非旧假数据签名+无 Republic of Etheria）
//   P2 灯塔实发（导航前预注入 patch navigator.sendBeacon 记录——灯塔 sendBeacon 优先只 patch fetch 会漏记）
//   path===/pages/activity.html+clientId 非空+恰好 1 条（每页一次守卫）P3 实机切 7d（点击后 5 卡=7d 端点
//   值）；E1 零异常零 console error（Failed to load resource 过滤）。
// 真实数据坑：公开站点数值可能为零（新公民/内容/热力图空态）——断言只比对「页面=端点」一致性，不钦定非零。
'use strict';
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PASS = { n: 0 }, FAIL = { n: 0 };
const ok = (name, cond, detail) => {
  if (cond) { PASS.n++; console.log('  ✅ ' + name); }
  else { FAIL.n++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
};
const get = (url) => new Promise((resolve) => {
  const req = https.request(url, { headers: { 'User-Agent': 'mn-probe' }, timeout: 30000 }, (res) => {
    const chunks = [];
    let len = 0;
    res.on('data', (c) => { chunks.push(c); len += c.length; if (len > 2000000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
  });
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
});
// 与页面 fmt 同款：≥1000 → x.xK，否则整数位分组
const fmtLive = (n) => {
  n = n || 0;
  return n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toLocaleString('en-US');
};

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
        this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 300));
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
    try { if (await cdp.evalJs(expr)) return true; } catch (e) {}
    await sleep(200);
  }
  console.log('  ⏳ waitFor 超时: ' + label);
  return false;
}

(async () => {
  const BASE = 'https://mnationworld.com';
  const EP = BASE + '/api/public/activity';

  // ── S1 线上页面静态 ──
  const pg = await get(BASE + '/pages/activity.html');
  ok('S1 线上页面静态：api.js 引入+id=activitySearch+chart.contentTypes+MN_API.get 调用+新键名在位（kpi.newCitizens/empty.heatmap/offline.title）+假数据种子全零残留（Republic of Etheria/generateGrowthSeries/kpiData/topNations/trendData/892/treaties）',
    pg.status === 200 &&
    pg.body.split('assets/js/api.js').length - 1 === 1 &&
    pg.body.split('id="activitySearch"').length - 1 === 1 &&
    pg.body.split('activity.chart.contentTypes').length - 1 === 1 &&
    pg.body.split("MN_API.get('/public/activity").length - 1 === 1 &&
    pg.body.indexOf('activity.kpi.newCitizens') !== -1 &&
    pg.body.indexOf('activity.empty.heatmap') !== -1 &&
    pg.body.indexOf('activity.offline.title') !== -1 &&
    pg.body.indexOf('Republic of Etheria') === -1 &&
    pg.body.indexOf('generateGrowthSeries') === -1 &&
    pg.body.indexOf('kpiData') === -1 &&
    pg.body.indexOf('topNations') === -1 &&
    pg.body.indexOf('trendData') === -1 &&
    pg.body.indexOf('892') === -1 &&
    pg.body.indexOf('treaties') === -1,
    'status=' + pg.status + ' err=' + pg.error);

  // ── S2 端点形状 ──
  const r30 = await get(EP + '?range=30d');
  let d30 = null;
  try { d30 = JSON.parse(r30.body); } catch (e) {}
  const dayOk = (d) => d && typeof d.key === 'string' && Array.isArray(d.cells) && d.cells.length === 6;
  ok('S2 端点形状（30d）：200+range 回显+kpi 5 键（nations/citizens/newCitizens/articles/activity）+trends 四序列各 30 条日序列+contentTypes 4 键+heatmap timeBlocks 6/7 天×6 格/maxCell 数字+leaderboard/milestones 数组',
    r30.status === 200 && d30 &&
    d30.range === '30d' && typeof d30.from === 'string' && typeof d30.to === 'string' &&
    d30.kpi && ['nations', 'citizens', 'newCitizens', 'articles', 'activity'].every((k) => typeof d30.kpi[k] === 'object' && typeof d30.kpi[k].value === 'number') &&
    d30.trends && ['users', 'nations', 'articles', 'teams'].every((k) => Array.isArray(d30.trends[k]) && d30.trends[k].length === 30) &&
    d30.contentTypes && ['articles', 'posts', 'comments', 'likes'].every((k) => typeof d30.contentTypes[k] === 'number') &&
    d30.heatmap && Array.isArray(d30.heatmap.timeBlocks) && d30.heatmap.timeBlocks.length === 6 &&
    Array.isArray(d30.heatmap.days) && d30.heatmap.days.length === 7 && d30.heatmap.days.every(dayOk) &&
    typeof d30.heatmap.maxCell === 'number' &&
    Array.isArray(d30.leaderboard) && Array.isArray(d30.milestones),
    'status=' + r30.status + ' bodyHead=' + r30.body.slice(0, 160));

  // ── S3 range 族 ──
  const r7 = await get(EP + '?range=7d');
  const r90 = await get(EP + '?range=90d');
  const rall = await get(EP + '?range=all');
  let dall = null;
  try { dall = JSON.parse(rall.body); } catch (e) {}
  ok('S3 range 族：7d/30d/90d/all 全 200 且 all.from===2000-01-01T00:00:00.000Z（custom 全史口径）',
    r7.status === 200 && r90.status === 200 && rall.status === 200 && dall &&
    dall.range === 'all' && dall.from === '2000-01-01T00:00:00.000Z',
    '7d=' + r7.status + ' 90d=' + r90.status + ' all=' + rall.status + ' from=' + (dall && dall.from));

  // ── S4 PII 禁令 ──
  const bodyStr = r30.body;
  ok('S4 PII 禁令：30d 响应体无 @ 无 display_name（公民里程碑匿名 title=null、零邮箱零展示名）',
    bodyStr.indexOf('@') === -1 && bodyStr.indexOf('display_name') === -1,
    'at=' + (bodyStr.indexOf('@') !== -1) + ' dn=' + (bodyStr.indexOf('display_name') !== -1));

  // ── P 实机 ──
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const CDP_PORT = 9600 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-activity-' + Date.now());
  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    ok('P0 Chrome CDP 就绪', up, 'port=' + CDP_PORT);
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const tab = pages.find(p => p.type === 'page') || pages[0];
    const cdp = new CDP(tab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // 灯塔记录桩（导航前预注入——sendBeacon 优先，只 patch fetch 会漏记；异步 Blob.text() 双通道）
    const BEACON_STUB = '(function(){ var realBeacon = navigator.sendBeacon.bind(navigator);' +
      ' navigator.sendBeacon = function (url, data) {' +
      '  var u = String(url);' +
      '  if (u.indexOf("/api/analytics/pageview") !== -1) {' +
      '   window.__probePvCalls = window.__probePvCalls || [];' +
      '   var done = function (txt) { var p = null; try { p = JSON.parse(txt); } catch (e) {}' +
      '    window.__probePvCalls.push({ path: p && p.path, clientId: p && p.clientId }); };' +
      '   try {' +
      '    if (data && typeof data.text === "function") { var t = data.text(); if (t && typeof t.then === "function") { t.then(done).catch(function(){}); } else { done(String(t)); } }' +
      '    else { done(String(data || "")); }' +
      '   } catch (e) {}' +
      '   return true;' +
      '  }' +
      '  return realBeacon(url, data);' +
      ' }; })();';
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: BEACON_STUB });
    await cdp.send('Page.navigate', { url: BASE + '/pages/activity.html' });

    const READY = "document.querySelectorAll('#kpiRow .kpi-card').length === 5";
    let rd = await waitFor(cdp, READY, 20000, '活动页 5 卡渲染');
    if (!rd) {
      await cdp.send('Page.reload');
      rd = await waitFor(cdp, READY, 20000, 'reload 后 5 卡渲染');
    }
    if (!rd) {
      ok('P1 页面值=端点值', false, '页面未渲染');
      ok('P2 灯塔实发', false, '页面未渲染');
      ok('P3 实机切 7d', false, '页面未渲染');
      ok('E1 全程零异常', cdp.errs.length === 0 && cdp.consoleErrs.length === 0, (cdp.errs.slice(0, 3).join(' | ') + cdp.consoleErrs.slice(0, 3).join(' | ')).slice(0, 300));
      cdp.close();
      console.log('\nactivity 探针：' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌');
      process.exit(FAIL.n ? 1 : 0);
    }

    // P1 页面值=端点值（真实公开数据可能为零——只比对一致性；绝不允许旧假数据签名）
    const pageVals = await cdp.evalJs("(function(){ return Array.prototype.map.call(document.querySelectorAll('#kpiRow .kpi-value'), function(e){ return e.textContent; }); })()");
    const bodyTxt = await cdp.evalJs("document.body.textContent");
    const expect30 = ['nations', 'citizens', 'articles', 'activity', 'newCitizens'].map((k) => fmtLive(d30.kpi[k].value));
    const matched = pageVals.length === 5 && pageVals.every((v, i) => v === expect30[i]);
    ok('P1 页面值=端点值（30d）：5 卡逐项=fmtLive(端点 kpi)（' + expect30.join('/') + '）+ 页面无 Republic of Etheria+非旧假数据签名 892/128400',
      matched === true && bodyTxt.indexOf('Republic of Etheria') === -1 &&
      bodyTxt.indexOf('892') === -1 && bodyTxt.indexOf('128400') === -1,
      'page=' + JSON.stringify(pageVals) + ' ep=' + JSON.stringify(expect30));

    // P2 灯塔实发（本次导航即发；每页一次守卫 → 恰好 1 条）
    await waitFor(cdp, "(window.__probePvCalls || []).length >= 1", 10000, '灯塔记录');
    const pv = await cdp.evalJs("(function(){ var c = window.__probePvCalls || []; return JSON.stringify({ n: c.length, path: c[0] && c[0].path, cid: c[0] && c[0].clientId }); })()");
    const PV = JSON.parse(pv);
    ok('P2 灯塔实发：恰好 1 条+path===/pages/activity.html+clientId 非空（sendBeacon 优先通道被 patch 记录）',
      PV.n === 1 && PV.path === '/pages/activity.html' && typeof PV.cid === 'string' && PV.cid.length > 0, pv);

    // P3 实机切 7d（真请求到端点；值变=7d 端点值；公开数据可能 30d 与 7d 同值——比对一致性即通过）
    const r7b = await get(EP + '?range=7d');
    let d7 = null;
    try { d7 = JSON.parse(r7b.body); } catch (e) {}
    await cdp.evalJs("document.querySelector('#timeRangePills [data-range=\"7d\"]').click()");
    await sleep(2500);
    const pageVals7 = await cdp.evalJs("(function(){ return Array.prototype.map.call(document.querySelectorAll('#kpiRow .kpi-value'), function(e){ return e.textContent; }); })()");
    const expect7 = d7 ? ['nations', 'citizens', 'articles', 'activity', 'newCitizens'].map((k) => fmtLive(d7.kpi[k].value)) : null;
    ok('P3 实机切 7d：点击后 5 卡=fmtLive(7d 端点 kpi)（' + (expect7 ? expect7.join('/') : '端点失败') + '）',
      expect7 !== null && pageVals7.length === 5 && pageVals7.every((v, i) => v === expect7[i]),
      'page=' + JSON.stringify(pageVals7) + ' ep=' + JSON.stringify(expect7));

    ok('E1 全程零异常：零 Runtime exception + 零 console error（Failed to load resource 过滤）',
      cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      (cdp.errs.slice(0, 3).join(' | ') + cdp.consoleErrs.slice(0, 3).join(' | ')).slice(0, 300));
    cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
  }

  console.log('\nactivity 探针：' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌');
  process.exit(FAIL.n ? 1 : 0);
})().catch((e) => { console.error('探针崩溃：' + (e && e.stack || e)); process.exit(1); });
