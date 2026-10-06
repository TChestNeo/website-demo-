// tmp-battery-xp-rebalance.js — v0.2.49.0 / FC v10.28.35.3 社交互动经验值电池
//   （用户逐字两段「发布一个评论 +2 一篇文章 +120 发帖 +25，一个粉丝 +25 一个赞 +15，获得一个评论 +10」+
//   「一个保存 +12」；问询钦定：①文章=草稿首发布 +120/再发布 +5/清空重写回 +120 ②发帖+25 立得+话题 30 天
//   连续活跃度才 +25（活跃日=当天 ≥10 个不同用户发帖）③赞/藏都是获得（+15/+12）④获得类后端实时记
//   users.xp_gained → 登录刷新同步前端徽章）
// F 静态：版本/changelog/12 级表/来源数值/编辑器钩子/双轨机制；S 浏览器：徽章 0 起点/每日 +5 去重/13 阈值
//   走查/满级徽章/1200 跨级/来源集成（话题→pending 队列）/访客不计/云端合并显示/话题 30 天结算+断档/
//   登出+unauthorized 清理；Z 零 error
// /api 打桩（SC 状态对象 + /batt-set?sc= 场景切换）：/auth/me 带 xpGained、/social/activity 按请求时刻
//   现算日数组（UTC 域，服务端生成免跨午夜漂移）；demo 场景 health 404 保持旧页面 demo 模式零 API。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-xpreb-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

// ── 打桩 state（同进程内存）──
const SC = {
  demo: { health: 404 },                                              // S1-S7/S10：后端不可达 → 页面 demo 模式（云合并零 API）
  cloud: { health: 200, xpGained: 1100, meDelay: 800, days: null },   // S8 云端合并：/auth/me 带回获得类经验
  settle: { health: 200, xpGained: 0, meDelay: 500, daysSpan: 31, daysRun: 30, todayActive: false, actDelay: 800 }, // S9a 30 连击结算
  gap: { health: 200, xpGained: 0, meDelay: 500, daysSpan: 31, daysRun: 29, todayActive: false, actDelay: 800 },    // S9b 断档不结算
};
let scName = 'demo';
const CLOUD_USER = { id: 'USR-batt-8', displayName: 'Cloud Batt', email: 'cloud@batt.test', citizenId: 'CIT-batt-8', createdAt: '2026-09-01T00:00:00.000Z', tier: 'free', role: 'member' };

function json(res, status, body) {
  const b = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(b) });
  res.end(b);
}
// 活动日数组按请求时刻现算（UTC 域与服务端同域；结尾天=今天，结尾前 daysRun 天连续 active）
function buildDays(cfg) {
  const days = [];
  const now = new Date();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = 0; i < cfg.daysSpan; i++) {
    const t = new Date(todayMs - (cfg.daysSpan - 1 - i) * 86400000);
    const dateStr = t.toISOString().slice(0, 10);
    const isLast = i === cfg.daysSpan - 1;
    const active = isLast ? !!cfg.todayActive : (cfg.daysSpan - 1 - i) <= cfg.daysRun;
    days.push({ date: dateStr, posters: active ? 10 : 0, active: active });
  }
  return days;
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url);
  const p = url.split('?')[0];
  if (p === '/batt-setup.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html><head><meta charset="utf-8"></head><body>setup</body></html>');
    return;
  }
  if (p === '/batt-set') {
    const q = new URLSearchParams(url.split('?')[1] || '');
    if (SC[q.get('sc')]) scName = q.get('sc');
    json(res, 200, { ok: true, sc: scName });
    return;
  }
  if (p === '/api/health') {
    if (SC[scName].health !== 200) return json(res, 404, { error: { code: 'NOT_FOUND', message: 'offline' } });
    return json(res, 200, { ok: true });
  }
  if (p.indexOf('/api/') !== 0) {
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
    return;
  }
  const sc = SC[scName];
  req.on('data', () => {});
  req.on('end', async () => {
    if (p === '/api/auth/me') {
      if (sc.meDelay) await delay(sc.meDelay);
      const u = Object.assign({}, CLOUD_USER, { xpGained: sc.xpGained });
      return json(res, 200, { user: u });
    }
    if (p === '/api/social/activity') {
      if (sc.actDelay) await delay(sc.actDelay);
      return json(res, 200, { days: sc.daysSpan ? buildDays(sc) : [] });
    }
    if (p === '/api/social/nations') return json(res, 200, { nations: [] });
    if (p === '/api/social/topics') return json(res, 200, { topics: [] });
    if (p === '/api/social/teams') return json(res, 200, { teams: [] });
    if (p === '/api/social/following') return json(res, 200, { nations: [], topics: [], users: [] });
    json(res, 404, { error: { code: 'NOT_FOUND', message: p } });
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
        this.errs.push('EXC ' + JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 300));
      } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        const e = m.params.entry;
        const t = e.text || '';
        const u = e.url || '';
        if (t.indexOf('story.mnationworld.com') !== -1 || u.indexOf('story.mnationworld.com') !== -1) return;
        if (u.indexOf('favicon') !== -1) return;
        if (u.indexOf('/api/') !== -1) return;
        this.errs.push('LOG ' + JSON.stringify({ text: t.slice(0, 200), url: u }).slice(0, 300));
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
  let lastErr = '';
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; }
    catch (e) { lastErr = String(e.message || e).slice(0, 160); }
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label + (lastErr ? '（最后 eval 错误: ' + lastErr + '）' : ''));
}

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}
const cnt = (s, sub) => s.split(sub).length - 1;

(async () => {
  // ═══ F 静态检查 ═══
  const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  const storageSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'storage.js'), 'utf8');
  const fceSrc = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  const hubSrc = fs.readFileSync(path.join(DOCS, 'pages', 'community-hub.html'), 'utf8');
  const postSrc = fs.readFileSync(path.join(DOCS, 'pages', 'community-post.html'), 'utf8');

  ok('F1 静态：changelog 历史条目保留（v0.2.49.0/v10.28.35.3 轮标题；赋值锚随版本前进失效——00305 维修口径）+ changelog 社交 XP 条目（用户原话两段 + 钦定口径）',
    sconfSrc.indexOf('v0.2.49.0 = 社交互动经验值来源') !== -1 &&
    sconfSrc.indexOf('v10.28.35.3 = 编辑器发布 XP 钩子 120/5') !== -1 &&
    sconfSrc.indexOf('发布一个评论 +2') !== -1 &&
    sconfSrc.indexOf('一篇文章 +120') !== -1 &&
    sconfSrc.indexOf('发帖 +25') !== -1 &&
    sconfSrc.indexOf('一个粉丝 +25') !== -1 &&
    sconfSrc.indexOf('一个赞 +15') !== -1 &&
    sconfSrc.indexOf('获得一个评论 +10') !== -1 &&
    sconfSrc.indexOf('一个保存 +12') !== -1 &&
    sconfSrc.indexOf('草稿首次发布算新') !== -1 &&
    sconfSrc.indexOf('30 天连续活跃度') !== -1 &&
    sconfSrc.indexOf('10 个不同用户') !== -1 &&
    sconfSrc.indexOf('后端实时记录') !== -1);

  // 12 级表：need 累计阈值按序（0/1200/2400/4800/9600/19200/38400/76800/153600/307200/614400/1228800）+ 称号 12 个
  const needs = [0, 1200, 2400, 4800, 9600, 19200, 38400, 76800, 153600, 307200, 614400, 1228800];
  const names = ['旅行者', '拓荒者', '公民', '建城者', '镇长', '总督', '外交官', '首相', '元首', '君主', '皇帝', '传奇'];
  let orderOk = true, last = -1;
  for (const n of needs) { const p = storageSrc.indexOf('need: ' + n); if (p === -1 || p <= last) orderOk = false; last = p; }
  let namesOk = true;
  for (const nm of names) { if (storageSrc.indexOf("name: '" + nm + "'") === -1) namesOk = false; }
  ok('F2 静态：LEVELS 12 级 need 阈值按序（0→1228800 等比×2）+ 12 称号（旅行者→君主+皇帝+传奇）',
    orderOk && namesOk && cnt(storageSrc, 'need: ') >= 12,
    JSON.stringify(needs));

  ok('F3 静态：来源数值（登录 +5/引导 +10/国家世界 +150 不动）+ 话题改 30 天结算（旧 +5 移除 → topic_sustained 25）+ 发帖 25/评论 2',
    storageSrc.indexOf("addXP('daily_login', 5)") !== -1 &&
    storageSrc.indexOf("addXP('onboarding_done', 10)") !== -1 &&
    storageSrc.indexOf("addXP('submit_nation', 150)") !== -1 &&
    storageSrc.indexOf("addXP('submit_world', 150)") !== -1 &&
    storageSrc.indexOf("addXP('create_topic', 5)") === -1 &&
    storageSrc.indexOf("addXP('topic_sustained', 25)") !== -1 &&
    storageSrc.indexOf('无立即奖励') !== -1 &&
    storageSrc.indexOf('旧 +5 移除') !== -1 &&
    storageSrc.indexOf('重平衡 20→5') !== -1 &&
    storageSrc.indexOf('重平衡 50→10') !== -1 &&
    hubSrc.indexOf("SlatiDB.addXP('create_post', 25)") !== -1 &&
    postSrc.indexOf("SlatiDB.addXP('create_comment', 2)") !== -1);

  ok('F4 静态：编辑器 publishXPReward（120/5 旗子判定）替换旧 15 钩子 ×3（演示发布/新建/更新三路径）+ 草稿清空重置旗子',
    cnt(fceSrc, 'function publishXPReward') === 1 &&
    cnt(fceSrc, 'publishXPReward();') === 3 &&
    fceSrc.indexOf("addXP('publish_article', published ? 5 : 120)") !== -1 &&
    fceSrc.indexOf("SlatiDB.addXP('publish_article', 15)") === -1 &&
    fceSrc.indexOf("SlatiDB.addXP('publish_article', 100)") === -1 &&
    fceSrc.indexOf('guest 没记上不置旗') !== -1 &&
    fceSrc.indexOf('SlatiDB.set(SlatiDB.KEYS.ARTICLE_PUBLISHED, false)') !== -1);

  ok('F5 静态：storage 双轨机制（3 新键 + 合计判定 + syncXPGained 双挂点 + settlePendingTopics + 登出/unauthorized 清理 + saveTopic 入队）',
    storageSrc.indexOf("XP_GAINED: 'slati_xp_gained'") !== -1 &&
    storageSrc.indexOf("XP_TOPIC_PENDING: 'slati_xp_topic_pending'") !== -1 &&
    storageSrc.indexOf("ARTICLE_PUBLISHED: 'slati_article_published'") !== -1 &&
    storageSrc.indexOf('var xp = getXP() + getXPGained();') !== -1 &&
    storageSrc.indexOf('function syncXPGained(n)') !== -1 &&
    cnt(storageSrc, 'syncXPGained(user.xpGained)') === 1 &&
    cnt(storageSrc, 'syncXPGained(r.data.user.xpGained)') === 1 &&
    storageSrc.indexOf('function settlePendingTopics(days)') !== -1 &&
    storageSrc.indexOf('settlePendingTopics(r.data.days)') !== -1 &&
    cnt(storageSrc, 'remove(KEYS.XP_GAINED)') === 2 &&
    cnt(storageSrc, 'remove(KEYS.XP_TOPIC_PENDING)') === 2 &&
    storageSrc.indexOf('pending.push({ id: topic.id, created:') !== -1);

  // ═══ 浏览器场景 ═══
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
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    await cdp.send('Log.enable'); await cdp.send('Network.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });

    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const setSc = async (name) => {
      const r = await fetch(BASE + '/batt-set?sc=' + name);
      if (!r.ok) throw new Error('setSc 失败');
    };
    const setLS = async (pairs) => {
      await nav(BASE + '/batt-setup.html', "document.readyState === 'complete'", 'LS setup');
      const body = pairs.map(p => p.remove
        ? "localStorage.removeItem('" + p.k + "')"
        : "localStorage.setItem('" + p.k + "', " + JSON.stringify(p.v) + ")").join(';');
      const r = await cdp.evalJs("(function(){ try { " + body + "; return 'ok'; } catch(e){ return 'ERR ' + e.message; } })()");
      if (r !== 'ok') throw new Error('setLS 失败: ' + r);
    };
    const badgeNow = () => cdp.evalJs("(function(){ var b = document.querySelector('#slati-sidebar .mn-lv-badge'); " +
      "if (!b) return JSON.stringify({ absent: true }); " +
      "var n = b.querySelector('.mn-lv-normal'); " +
      "var fill = n && n.lastElementChild && n.lastElementChild.firstElementChild; " +
      "return JSON.stringify({ txt: b.textContent, bar: fill && fill.style ? fill.style.width : null, kids: n ? n.children.length : -1, " +
      "xp: JSON.parse(localStorage.getItem('slati_xp') || '0') }); })()");
    const armRecorder = () => cdp.evalJs("(function(){ window.__xpEvts = []; window.__lvl = []; " +
      "window.addEventListener('mn:xp-changed', function(e){ window.__xpEvts.push({ src: e.detail.source, amt: e.detail.amount }); }); " +
      "window.addEventListener('mn:level-up', function(e){ window.__lvl.push(e.detail.state.lv); }); return 'ok'; })()");
    const toastSeen = (txt) => cdp.evalJs("(function(){ var all = document.querySelectorAll('div'); " +
      "for (var i = 0; i < all.length; i++) { if (all[i].textContent === " + JSON.stringify(txt) + " && all[i].style.position === 'fixed') return true; } return false; })()");

    // ═══ S1 每日登录 +5（无日期键 → 页面首载发奖励并写下自己的日期键）═══
    // 注：日期键由页面按本地时区计算，Node 侧（可能 UTC）不算——用页面自写的键做后续去重基准
    await setLS([
      { k: 'slati_session', v: JSON.stringify({ loggedIn: true }) },
      { k: 'slati_user', v: JSON.stringify({ id: 'batt-tester', displayName: 'XP Tester', citizenId: 'CIT-8842', tier: 'free' }) },
      { k: 'slati_xp', v: '0' },
      { k: 'slati_xp_gained', remove: true },
      { k: 'slati_xp_last_login', remove: true },
    ]);
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .mn-lv-badge')", '首页徽章就绪(S1)');
    let r = await badgeNow();
    const s1 = JSON.parse(r);
    ok('S1 每日登录 +5（0→5）+ 徽章 Lv.1·旅行者 5 / 1200 XP',
      s1.xp === 5 && s1.txt.indexOf('Lv.1 · 旅行者') !== -1 && s1.txt.indexOf('5 / 1200 XP') !== -1, r);

    // ═══ S2 0 经验就是 Lv1 + 每日奖励去重（页面已写今天键 → 重置 XP 后不再补发）═══
    await setLS([{ k: 'slati_xp', v: '0' }]);
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .mn-lv-badge')", '首页徽章就绪(S2)');
    r = await badgeNow();
    const s2 = JSON.parse(r);
    ok('S2a 0 经验就是 Lv1：徽章 Lv.1·旅行者 + 0 / 1200 XP + 进度 0%（当天不重复发）',
      s2.xp === 0 && s2.txt.indexOf('Lv.1 · 旅行者') !== -1 && s2.txt.indexOf('0 / 1200 XP') !== -1 && s2.bar === '0%', r);
    await cdp.send('Page.reload');
    await waitFor(cdp, "!!document.querySelector('#slati-sidebar .mn-lv-badge')", 20000, '重载去重');
    r = await badgeNow();
    const s2b = JSON.parse(r);
    ok('S2b 重载 XP 仍 0（每日 +5 只发一次）', s2b.xp === 0, r);

    // ═══ S3 13 点阈值走查（getLevelState 口径；获得类经验先清零——合计判定不受残留影响）═══
    r = await cdp.evalJs("(function(){ localStorage.removeItem('slati_xp_gained'); " +
      "var tests = [[1199,1,'旅行者',1200,false],[1200,2,'拓荒者',2400,false],[2399,2,'拓荒者',2400,false],[2400,3,'公民',4800,false]," +
      "[4800,4,'建城者',9600,false],[9600,5,'镇长',19200,false],[19200,6,'总督',38400,false],[38400,7,'外交官',76800,false]," +
      "[76800,8,'首相',153600,false],[153600,9,'元首',307200,false],[307200,10,'君主',614400,false]," +
      "[614400,11,'皇帝',1228800,false],[1228800,12,'传奇',1228800,true]]; " +
      "var out = []; for (var i = 0; i < tests.length; i++) { " +
      "localStorage.setItem('slati_xp', String(tests[i][0])); var st = window.SlatiDB.getLevelState(); " +
      "out.push([tests[i][0], st.lv, st.name, st.nextNeed, st.isMax, (st.lv === tests[i][1] && st.name === tests[i][2] && st.nextNeed === tests[i][3] && st.isMax === tests[i][4])]); } " +
      "return JSON.stringify(out); })()");
    const s3rows = JSON.parse(r);
    let s3fail = [];
    for (const row of s3rows) if (!row[5]) s3fail.push(row.slice(0, 5));
    ok('S3 13 点阈值走查全对（1199 仍是 Lv1 / 1200 升 Lv2 / ……/ 1228800 Lv12·传奇 isMax）',
      s3rows.length === 13 && s3fail.length === 0,
      JSON.stringify(s3fail.length ? s3fail : '13/13'));

    // ═══ S4 满级徽章（isMax：无「/」无进度条）═══
    await cdp.evalJs("localStorage.removeItem('slati_xp_gained'); localStorage.setItem('slati_xp', '1228800'); window.SlatiDB.addXP('batt', 1)");
    await sleep(300);
    r = await badgeNow();
    const s4 = JSON.parse(r);
    ok('S4 满级徽章 Lv.12·传奇 + 1228801 XP（无「/」）+ 进度条不渲染',
      s4.txt.indexOf('Lv.12 · 传奇') !== -1 && s4.txt.indexOf('1228801 XP') !== -1 && s4.txt.indexOf(' / ') === -1 && s4.kids === 1, r);

    // ═══ S5 1200 跨级：事件 + toast ═══
    await cdp.evalJs("window.__lvl = []; window.addEventListener('mn:level-up', function(e){ window.__lvl.push(e.detail.state.lv); });");
    await cdp.evalJs("localStorage.removeItem('slati_xp_gained'); localStorage.setItem('slati_xp', '1195'); window.SlatiDB.addXP('batt', 10)");
    r = await cdp.evalJs("JSON.stringify({ badge: document.querySelector('#slati-sidebar .mn-lv-badge').textContent, " +
      "lvl: JSON.stringify(window.__lvl), xp: JSON.parse(localStorage.getItem('slati_xp') || '0'), " +
      "toast: (function(){ var t = null; var all = document.querySelectorAll('div'); for (var i = 0; i < all.length; i++) { if (all[i].textContent === '等级提升！Lv.2 · 拓荒者' && all[i].style.position === 'fixed') t = true; } return !!t; })() })");
    const s5 = JSON.parse(r);
    ok('S5 1195+10 跨级 → Lv.2·拓荒者 + mn:level-up [2] + 升级 toast + 徽章 1205 / 2400',
      s5.badge.indexOf('Lv.2 · 拓荒者') !== -1 && s5.badge.indexOf('1205 / 2400 XP') !== -1 && s5.lvl === '[2]' && s5.toast && s5.xp === 1205, r);

    // ═══ S6 来源集成：引导 +10 / 话题 → pending 队列（无立即经验）/ 国家 +150 / 世界 +150 → 1515 ═══
    // 换 USR- 用户（saveTopic 仅云端账号入队）；sc demo（health 404）→ 云合并零请求零干扰
    await setLS([
      { k: 'slati_session', v: JSON.stringify({ loggedIn: true }) },
      { k: 'slati_user', v: JSON.stringify({ id: 'USR-batt-6', displayName: 'XP Tester', citizenId: 'CIT-8842', tier: 'free' }) },
      { k: 'slati_xp', v: '1205' },
    ]);
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .mn-lv-badge')", '首页徽章就绪(S6)');
    await cdp.evalJs("window.__lvl = []; window.addEventListener('mn:level-up', function(e){ window.__lvl.push(e.detail.state.lv); });");
    r = await cdp.evalJs("(function(){ " +
      "window.SlatiDB.setOnboardingStep(3); " +                                   // 1205 → 1215
      "var topic = window.SlatiDB.saveTopic({ name: 'Batt XP Topic' }); " +      // 1215 → 1215（话题经验 30 天后结算）
      "localStorage.setItem('slati_nation_draft', JSON.stringify({ steps: { 2: { lore: 'Batt' }, 3: { sectors: {}, demographics: {} } } })); " +
      "var nat = window.SlatiDB.submitNation(); " +                              // 1215 → 1365
      "window.SlatiDB.submitWorld({ name: 'Batt XP World' }); " +                // 1365 → 1515
      "var st = window.SlatiDB.getLevelState(); " +
      "var pending = JSON.parse(localStorage.getItem('slati_xp_topic_pending') || '[]'); " +
      "return JSON.stringify({ xp: JSON.parse(localStorage.getItem('slati_xp') || '0'), lv: st.lv, nation: !!nat, lvlEvents: JSON.stringify(window.__lvl), " +
      "draftGone: localStorage.getItem('slati_nation_draft') === null, topicId: topic.id, pending: pending }); })()");
    const s6 = JSON.parse(r);
    ok('S6a 来源集成：+10/话题 0（改 30 天结算）/+150/+150 → 1515 XP 仍 Lv2 + 草稿清空 + 无新升级事件（S6 换页后监听器全新）',
      s6.xp === 1515 && s6.lv === 2 && s6.nation && s6.draftGone && s6.lvlEvents === '[]', r);
    ok('S6b 话题入待结算队列（无立即经验）：队列 1 项 = 刚创建话题 + created 为 10 位日期串',
      s6.pending.length === 1 && s6.pending[0].id === s6.topicId &&
      typeof s6.pending[0].created === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s6.pending[0].created), r);

    // ═══ S7 访客不计（先导航到首页再测——batt-setup 无 SlatiDB）═══
    await setLS([{ k: 'slati_session', remove: true }]);
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar')", '访客首页');
    r = await cdp.evalJs("(function(){ var before = JSON.parse(localStorage.getItem('slati_xp') || '0'); " +
      "var ret = window.SlatiDB.addXP('batt', 10); " +
      "return JSON.stringify({ before: before, after: JSON.parse(localStorage.getItem('slati_xp') || '0'), ret: ret, " +
      "badge: !!document.querySelector('#slati-sidebar .mn-lv-badge'), " +
      "guest: document.querySelector('#slati-sidebar').textContent.indexOf('注册 / 登录') !== -1 }); })()");
    const s7 = JSON.parse(r);
    ok('S7 访客 addXP 返回 null + XP 不变（1515 保持）+ 无徽章 + 注册/登录 CTA 正常',
      s7.before === 1515 && s7.after === 1515 && s7.ret === null && !s7.badge && s7.guest, r);

    // ═══ S8 云端合并显示：本地动作 95 + 每日 +5 + 获得类 1100 → 合计 1200 升 Lv2 ═══
    await setSc('cloud');
    await setLS([
      { k: 'slati_session', v: JSON.stringify({ loggedIn: true }) },
      { k: 'slati_user', v: JSON.stringify({ id: 'USR-batt-8', displayName: 'Cloud Batt', citizenId: 'CIT-batt-8' }) },
      { k: 'slati_xp', v: '95' },
      { k: 'slati_xp_gained', remove: true },
      { k: 'slati_xp_topic_pending', remove: true },
      { k: 'slati_xp_last_login', remove: true },
    ]);
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .mn-lv-badge')", '首页徽章就绪(S8)');
    await armRecorder(); // /auth/me 桩延迟 800ms → 事件必在监听器挂好后到达
    await waitFor(cdp, "localStorage.getItem('slati_xp_gained') === '1100'", 10000, 'S8 获得类经验同步');
    r = await cdp.evalJs("JSON.stringify({ badge: document.querySelector('#slati-sidebar .mn-lv-badge').textContent, " +
      "xp: JSON.parse(localStorage.getItem('slati_xp') || '0'), gained: JSON.parse(localStorage.getItem('slati_xp_gained') || '0'), " +
      "lvl: JSON.stringify(window.__lvl), evts: JSON.stringify(window.__xpEvts), " +
      "toast: (function(){ var all = document.querySelectorAll('div'); for (var i = 0; i < all.length; i++) { if (all[i].textContent === '等级提升！Lv.2 · 拓荒者' && all[i].style.position === 'fixed') return true; } return false; })() })");
    const s8 = JSON.parse(r);
    ok('S8 云端合并：/auth/me 带回 xpGained 1100 → 本地 100 + 获得 1100 = 1200 → 徽章 Lv.2·拓荒者 1200 / 2400 XP',
      s8.xp === 100 && s8.gained === 1100 &&
      s8.badge.indexOf('Lv.2 · 拓荒者') !== -1 && s8.badge.indexOf('1200 / 2400 XP') !== -1, r);
    ok('S8b 同步事件：mn:xp-changed source=gained +1100 + mn:level-up [2] + 升级 toast（跨级同 addXP 口径）',
      s8.lvl === '[2]' && s8.evts.indexOf('"src":"gained","amt":1100') !== -1 && s8.toast, r);

    // ═══ S9a 话题 30 天结算：pending 31 天前创建 + 30 连续活跃日（今天 inactive → 以昨天结尾）→ +25 ═══
    const created31 = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
    await setSc('settle');
    await setLS([
      { k: 'slati_session', v: JSON.stringify({ loggedIn: true }) },
      { k: 'slati_user', v: JSON.stringify({ id: 'USR-batt-9', displayName: 'Cloud Batt' }) },
      { k: 'slati_xp', v: '100' },
      { k: 'slati_xp_gained', remove: true },
      { k: 'slati_xp_topic_pending', v: JSON.stringify([{ id: 'TOP-batt-9', created: created31 }]) },
      { k: 'slati_xp_last_login', remove: true },
    ]);
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .mn-lv-badge')", '首页徽章就绪(S9a)');
    await armRecorder();
    await waitFor(cdp, "JSON.parse(localStorage.getItem('slati_xp') || '0') === 130", 10000, 'S9a 话题结算 +25');
    r = await cdp.evalJs("JSON.stringify({ xp: JSON.parse(localStorage.getItem('slati_xp') || '0'), " +
      "pending: localStorage.getItem('slati_xp_topic_pending'), evts: JSON.stringify(window.__xpEvts) })");
    const s9a = JSON.parse(r);
    ok('S9a 话题结算：连续 30 活跃日 + 满 30 天 → +25（100+5 每日+25=130）+ 队列清空 + 事件 topic_sustained 25',
      s9a.xp === 130 && s9a.pending === '[]' && s9a.evts.indexOf('"src":"topic_sustained","amt":25') !== -1, r);

    // ═══ S9b 断档（29 连击）→ 不结算：队列保留 + XP 不动（每日键已写 → 无 +5 干扰）═══
    await setSc('gap');
    await setLS([
      { k: 'slati_xp', v: '100' },
      { k: 'slati_xp_gained', remove: true },
      { k: 'slati_xp_topic_pending', v: JSON.stringify([{ id: 'TOP-batt-9b', created: created31 }]) },
    ]);
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .mn-lv-badge')", '首页徽章就绪(S9b)');
    await armRecorder();
    await sleep(2000); // 等 activity 响应（actDelay 800ms）落定
    r = await cdp.evalJs("JSON.stringify({ xp: JSON.parse(localStorage.getItem('slati_xp') || '0'), " +
      "pending: localStorage.getItem('slati_xp_topic_pending'), evts: JSON.stringify(window.__xpEvts) })");
    const s9b = JSON.parse(r);
    ok('S9b 断档不结算：29 连击 < 30 → XP 保持 100 + 队列保留 TOP-batt-9b + 无 topic_sustained 事件',
      s9b.xp === 100 && s9b.pending !== null && s9b.pending.indexOf('TOP-batt-9b') !== -1 &&
      s9b.evts.indexOf('topic_sustained') === -1, r);

    // ═══ S10 清理：unauthorized 与 logout 都清获得类经验 + 待结算队列（防换号混入）═══
    await setSc('demo');
    await setLS([
      { k: 'slati_session', v: JSON.stringify({ loggedIn: true }) },
      { k: 'slati_user', v: JSON.stringify({ id: 'USR-batt-10', displayName: 'Cloud Batt' }) },
      { k: 'slati_xp_gained', v: '500' },
      { k: 'slati_xp_topic_pending', v: JSON.stringify([{ id: 'TOP-x', created: created31 }]) },
    ]);
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .mn-lv-badge')", '首页徽章就绪(S10)');
    await cdp.evalJs("window.dispatchEvent(new Event('mn:unauthorized'))");
    r = await cdp.evalJs("JSON.stringify({ session: localStorage.getItem('slati_session'), " +
      "gained: localStorage.getItem('slati_xp_gained'), pending: localStorage.getItem('slati_xp_topic_pending') })");
    const s10a = JSON.parse(r);
    ok('S10a mn:unauthorized 清理：session + 获得类经验 + 待结算队列全清（换号防陈旧经验混入）',
      s10a.session === null && s10a.gained === null && s10a.pending === null, r);
    await setLS([
      { k: 'slati_session', v: JSON.stringify({ loggedIn: true }) },
      { k: 'slati_xp_gained', v: '500' },
      { k: 'slati_xp_topic_pending', v: JSON.stringify([{ id: 'TOP-y', created: created31 }]) },
    ]);
    await nav(BASE + '/index.html', "!!document.querySelector('#slati-sidebar .mn-lv-badge')", '首页徽章就绪(S10b)');
    await cdp.evalJs("window.SlatiDB.logout()");
    r = await cdp.evalJs("JSON.stringify({ session: localStorage.getItem('slati_session'), " +
      "gained: localStorage.getItem('slati_xp_gained'), pending: localStorage.getItem('slati_xp_topic_pending'), " +
      "userKept: localStorage.getItem('slati_user') !== null })");
    const s10b = JSON.parse(r);
    ok('S10b logout 同样清获得类经验 + 待结算队列（session 清、user 残留=既有口径）',
      s10b.session === null && s10b.gained === null && s10b.pending === null && s10b.userKept, r);

    // ═══ Z 零 console error ═══
    ok('Z 零 console error/exception', cdp.errs.length === 0, JSON.stringify(cdp.errs));

    cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
  }
  console.log('\n  ── 结果: ' + PASS + '/' + (PASS + FAIL) + (FAIL === 0 ? ' 全绿 ✅' : ' 有红 ❌'));
  process.exit(FAIL === 0 ? 0 : 1);
(() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
