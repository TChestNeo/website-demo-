// tmp-battery-following.js — v0.2.58.20 关注页真实数据接入电池
// 用户「那么关注页面的也做一下」——5 组种子全删、三端点接入、登录引导卡、离线卡、搜索过滤、真关注调用。
// 断言面：F1-1 页面静态 → F1-2 种子零残留 → F1-3 i18n 键族 → F1-4 site-config 版本 → F1-5 后端源码
//        → R7 匿名无桩（引导卡+发现离线卡+零种子）→ R6 匿名有桩（引导卡+发现真数据+零 authed 调用）
//        → R1 登录 feed 3 帖 → R1b 灯塔每页一次 → R2 following 4 行+四滤镜+统计卡 → R3 发现三区+按钮态
//        → R4 搜索过滤零重拉 → R5 关注/取关真调用（PUT 记录/POST+DELETE/行消失）→ R8 切语言零重拉
//        → R9 空夹具空态 → E1 零异常
// 注意：fetch 桩必须同时覆写 navigator.sendBeacon（全站灯塔 sendBeacon 优先，只 patch fetch 会漏记）。
// 注意：session 预种脚本（addScriptToEvaluateOnNewDocument）必须带 __mnNoLogin 守卫——R7/R6 先置旗再导航。
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
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-following-batt-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  // /health 200 = 探活通过（storage.js whenUp 门控 PUT 镜像——R5a 需要）；夹具媒体图给 1px PNG 免 404 噪声
  if (p === '/api/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return; }
  if (p === '/uploads/mn-batt-1.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(PNG_1PX); return; }
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

// ═══ 夹具（骨架同真实响应：feed=postRow camelCase、detail=三类行、public users=公开形状）═══
const NOW = Date.now();
const isoAgo = (d) => new Date(NOW - d * 86400e3).toISOString();
const isoHoursAgo = (h) => new Date(NOW - h * 3600e3).toISOString();
function postRow(p, extra) { return Object.assign({ id: p.id, authorId: p.authorId, authorName: p.authorName, avatarUrl: null, content: p.content, media: p.media || [], topicId: p.topicId || null, status: 'visible', createdAt: p.createdAt, likeCount: p.likeCount, commentCount: p.commentCount, likedByMe: false, repostOfId: null, repostOf: null, repostCount: 0, repostedByMe: false, viewCount: p.viewCount, favoritedByMe: false }, extra || {}); }
const FEED = [
  postRow({ id: 'PST-000001', authorId: 'USR-000002', authorName: 'Nova Lin', content: 'Hello from Nova Terra — first citizen log.', createdAt: isoAgo(2), likeCount: 5, commentCount: 2, viewCount: 31 }),
  postRow({ id: 'PST-000002', authorId: 'USR-000003', authorName: 'Kai Zhang', content: 'Economic outlook thread for micronations.', media: ['/uploads/mn-batt-1.png'], createdAt: isoAgo(1), likeCount: 9, commentCount: 3, viewCount: 58 }),
  postRow({ id: 'PST-000003', authorId: 'USR-000004', authorName: 'Lena Hartmann', content: 'Flag redesign proposal in the guild topic.', topicId: 'TOP-000001', createdAt: isoHoursAgo(3), likeCount: 1, commentCount: 0, viewCount: 12 })
];
const DETAIL_BASE = {
  nations: [
    { id: 'NAT-000001', name: 'Nova Terra', moniker: 'NT', classification: '共和国', capital: 'Newport', followerCount: 2, followedAt: isoAgo(5) },
    { id: 'NAT-000002', name: 'Königreich Aethel', moniker: 'KA', classification: '王国', capital: 'Aethel', followerCount: 1, followedAt: isoAgo(4) }
  ],
  topics: [
    { id: 'TOP-000001', name: 'AI 治理实验室', description: '探索立法中的自动化', memberCount: 42, followedAt: isoAgo(3) }
  ],
  users: [
    { id: 'USR-000002', displayName: 'Nova Lin', avatarUrl: null, citizenId: 'USR-000002', followedAt: isoAgo(2) }
  ]
};
const PUB_USERS = [
  { id: 'USR-000002', displayName: 'Nova Lin', avatarUrl: null, citizenId: 'USR-000002', followerCount: 9 },
  { id: 'USR-000005', displayName: 'Marcus Vane', avatarUrl: null, citizenId: 'USR-000005', followerCount: 7 },
  { id: 'USR-000003', displayName: 'Kai Zhang', avatarUrl: null, citizenId: 'USR-000003', followerCount: 5 },
  { id: 'USR-000004', displayName: 'Lena Hartmann', avatarUrl: null, citizenId: 'USR-000004', followerCount: 3 }
];
const DISC_NATIONS = [
  { id: 'NAT-000001', name: 'Nova Terra', moniker: 'NT', classification: '共和国', lore: 'Pacific alliance micronation with floating districts.' },
  { id: 'NAT-000002', name: 'Königreich Aethel', moniker: 'KA', classification: '王国', lore: 'Kingdom of renewable energy mandates.' },
  { id: 'NAT-000003', name: 'Solarian Federation', moniker: 'SF', classification: '联邦', lore: 'A space-focused micronation with orbital habitat research programs.' },
  { id: 'NAT-000004', name: 'Deepwater Accord', moniker: 'DA', classification: '邦联', lore: 'Sub-aquatic colony pioneering deep-sea sustainable living.' }
];
const DISC_TOPICS = [
  { id: 'TOP-000001', name: 'AI 治理实验室', description: '探索立法中的自动化', memberCount: 42 },
  { id: 'TOP-000002', name: '旗帜纹章公会', description: 'Vexillology, coat-of-arms design, and national symbolism.', memberCount: 115 },
  { id: 'TOP-000003', name: '条约起草室', description: 'Collaborative drafting of bilateral treaties.', memberCount: 68 },
  { id: 'TOP-000004', name: '微国经济学', description: 'Currency design and micro-GDP modeling.', memberCount: 92 }
];

// 动态 detail 桩：以 __mnLastPutBody（PUT 全量镜像）为权威 + __mnFollowState（POST/DELETE）覆盖
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' window.__mnPutCalls = []; window.__mnLastPutBody = null; window.__mnFollowCalls = []; window.__mnFollowState = {};' +
  ' window.__mnFeedCalls = 0; window.__mnDetCalls = 0; window.__mnPubCalls = 0; window.__mnDiscCalls = 0;' +
  ' var FEED = ' + JSON.stringify(FEED) + ';' +
  ' var DETAIL_BASE = ' + JSON.stringify(DETAIL_BASE) + ';' +
  ' var PUB_USERS = ' + JSON.stringify(PUB_USERS) + ';' +
  ' var DISC_NATIONS = ' + JSON.stringify(DISC_NATIONS) + ';' +
  ' var DISC_TOPICS = ' + JSON.stringify(DISC_TOPICS) + ';' +
  ' var ALL_ROWS = {' +
  '  nations: {}, topics: {}, users: {}' +
  ' };' +
  ' DISC_NATIONS.forEach(function(n){ ALL_ROWS.nations[n.id] = { id:n.id, name:n.name, moniker:n.moniker, classification:n.classification, capital:\'\', followerCount:1, followedAt:new Date().toISOString() }; });' +
  ' DETAIL_BASE.nations.forEach(function(n){ ALL_ROWS.nations[n.id] = n; });' +
  ' DISC_TOPICS.forEach(function(t){ ALL_ROWS.topics[t.id] = { id:t.id, name:t.name, description:t.description, memberCount:t.memberCount, followedAt:new Date().toISOString() }; });' +
  ' DETAIL_BASE.topics.forEach(function(t){ ALL_ROWS.topics[t.id] = t; });' +
  ' PUB_USERS.forEach(function(u){ ALL_ROWS.users[u.id] = { id:u.id, displayName:u.displayName, avatarUrl:u.avatarUrl, citizenId:u.citizenId, followedAt:new Date().toISOString() }; });' +
  ' var emptyFlag = function(){ try { return localStorage.getItem("__mnFollowingEmpty") === "1"; } catch(e){ return false; } };' +
  ' var detail = function(){' +
  '  if (emptyFlag()) return { nations: [], topics: [], users: [] };' +
  '  var src = window.__mnLastPutBody || { nations: ["NAT-000001","NAT-000002"], topics: ["TOP-000001"], users: ["USR-000002"] };' +
  '  var pick = function(type){ return (src[type]||[]).map(function(id){ return ALL_ROWS[type][id]; }).filter(Boolean); };' +
  '  var out = { nations: pick("nations"), topics: pick("topics"), users: pick("users") };' +
  '  out.users.forEach(function(u){' +
  '   var st = window.__mnFollowState[u.id];' +
  '   if (st === false) { out.users = out.users.filter(function(x){ return x.id !== u.id; }); }' +
  '  });' +
  '  Object.keys(window.__mnFollowState).forEach(function(id){' +
  '   if (window.__mnFollowState[id] === true && !out.users.some(function(x){ return x.id === id; }) && ALL_ROWS.users[id]) out.users.push(ALL_ROWS.users[id]);' +
  '  });' +
  '  return out;' +
  ' };' +
  ' window.fetch = function (url, opts) {' +
  '  opts = opts || {};' +
  '  var u = String(url);' +
  '  var method = ((opts && opts.method) || "GET").toUpperCase();' +
  '  if (u.indexOf("/api/analytics/pageview") !== -1) {' +
  '   return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  if (u.indexOf("/api/social/feed") !== -1) {' +
  '   window.__mnFeedCalls++;' +
  '   var feed = emptyFlag() ? [] : FEED;' +
  '   return Promise.resolve(new Response(JSON.stringify({ posts: feed }), { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  if (u.indexOf("/api/social/following/detail") !== -1) {' +
  '   window.__mnDetCalls++;' +
  '   return Promise.resolve(new Response(JSON.stringify(detail()), { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  if (u.indexOf("/api/public/users") !== -1) {' +
  '   window.__mnPubCalls++;' +
  '   var pub = emptyFlag() ? [] : PUB_USERS;' +
  '   return Promise.resolve(new Response(JSON.stringify({ users: pub }), { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  if (u.indexOf("/api/social/nations") !== -1) {' +
  '   window.__mnDiscCalls++;' +
  '   return Promise.resolve(new Response(JSON.stringify({ nations: emptyFlag() ? [] : DISC_NATIONS }), { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  if (u.indexOf("/api/social/topics") !== -1) {' +
  '   window.__mnDiscCalls++;' +
  '   return Promise.resolve(new Response(JSON.stringify({ topics: emptyFlag() ? [] : DISC_TOPICS }), { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  var m = u.match(/\\/social\\/users\\/([^\\/]+)\\/follow$/);' +
  '  if (m) {' +
  '   window.__mnFollowCalls.push({ method: method, id: decodeURIComponent(m[1]) });' +
  '   window.__mnFollowState[m[1]] = method === "POST";' +
  '   return Promise.resolve(new Response(JSON.stringify({ following: method === "POST", followerCount: 5 }), { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  if (u.indexOf("/api/social/following") !== -1 && method === "PUT") {' +
  '   window.__mnPutCalls.push(String(opts.body || ""));' +
  '   try { window.__mnLastPutBody = JSON.parse(opts.body); } catch(e) {}' +
  '   return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));' +
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

// session 预种（storage.js 实形状 {loggedIn:true,at} + slati_user USR-）+ __mnNoLogin 守卫
const SEED_SESSION = 'try{(function(){' +
  ' if (localStorage.getItem("__mnNoLogin") === "1") {' +
  '  localStorage.removeItem("slati_session"); localStorage.removeItem("slati_user"); localStorage.removeItem("slati_following");' +
  '  return;' +
  ' }' +
  ' localStorage.setItem("slati_session", JSON.stringify({ loggedIn: true, at: new Date().toISOString() }));' +
  ' localStorage.setItem("slati_user", JSON.stringify({ id: "USR-000001", displayName: "测试公民" }));' +
  ' localStorage.setItem("slati_following", JSON.stringify({ nations: ["NAT-000001","NAT-000002"], topics: ["TOP-000001"], users: ["USR-000002"] }));' +
  '})();}catch(e){}';

(async () => {
  // ═══ F 静态 ═══
  const fol = fs.readFileSync(path.join(DOCS, 'pages', 'following.html'), 'utf8').replace(/\r\n/g, '\n');
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8').replace(/\r\n/g, '\n');
  const i18n = fs.readFileSync(path.join(DOCS, 'assets', 'i18n', 'following.i18n.js'), 'utf8');
  const socialSrc = fs.readFileSync(path.join(BE, 'src', 'routes', 'public', 'social.js'), 'utf8').replace(/\r\n/g, '\n');
  const count = (s, n) => s.split(n).length - 1;

  console.log('═══ F1-1 following.html 静态 ═══');
  ok('F1-1a api.js 引入 + 搜索 id + 三端点调用 + 链式 rerender + unauthorized + 引导/离线卡',
    count(fol, 'assets/js/api.js') === 1 && count(fol, 'id="followingSearch"') === 1 &&
    count(fol, "MN_API.get('/social/feed'") === 1 && count(fol, "MN_API.get('/social/following/detail'") === 1 &&
    count(fol, "MN_API.get('/public/users'") === 1 && count(fol, "MN_API.get('/social/nations'") === 1 &&
    count(fol, "MN_API.get('/social/topics'") === 1 && count(fol, '__mnPrevRerender') === 2 &&
    count(fol, "mn:unauthorized") === 1 && count(fol, "T('following.offline.title')") === 1 &&
    count(fol, "T('following.loginCta.title')") === 1,
    'api=' + count(fol, 'assets/js/api.js') + ' search=' + count(fol, 'id="followingSearch"') +
    ' feed=' + count(fol, "MN_API.get('/social/feed'") + ' det=' + count(fol, "MN_API.get('/social/following/detail'") +
    ' pub=' + count(fol, "MN_API.get('/public/users'") + ' prev=' + count(fol, '__mnPrevRerender') +
    ' ua=' + count(fol, 'mn:unauthorized') + ' off=' + count(fol, "T('following.offline.title')") +
    ' cta=' + count(fol, "T('following.loginCta.title')"));
  ok('F1-1b 页面专属样式块 + 页面 CSS 类（folg-cta/offline/empty/media）',
    count(fol, '.folg-cta, .folg-offline, .folg-empty {') === 1 && count(fol, 'card folg-offline') === 1 &&
    count(fol, 'card folg-cta') === 1 && count(fol, 'folg-media') >= 2,
    'css=' + count(fol, '.folg-cta, .folg-offline, .folg-empty {') + ' off=' + count(fol, 'card folg-offline') +
    ' cta=' + count(fol, 'card folg-cta') + ' media=' + count(fol, 'folg-media'));

  console.log('═══ F1-2 假数据种子零残留 ═══');
  ok('F1-2 5 组种子数组 + nameLookup + 种子专名全 0（10 项）',
    count(fol, 'var feedItems') === 0 && count(fol, 'var discoverNations') === 0 &&
    count(fol, 'var discoverTopics') === 0 && count(fol, 'var discoverUsers') === 0 &&
    count(fol, 'var recItems') === 0 && count(fol, 'nameLookup') === 0 &&
    count(fol, 'Republic of Etheria') === 0 && count(fol, 'Marcus Vane') === 0 &&
    count(fol, 'NAT-demo-1') === 0 && count(fol, 'TOP-demo-1') === 0,
    'fi=' + count(fol, 'var feedItems') + ' dn=' + count(fol, 'var discoverNations') +
    ' dt=' + count(fol, 'var discoverTopics') + ' du=' + count(fol, 'var discoverUsers') +
    ' rec=' + count(fol, 'var recItems') + ' nl=' + count(fol, 'nameLookup') +
    ' eth=' + count(fol, 'Republic of Etheria') + ' mv=' + count(fol, 'Marcus Vane') +
    ' n1=' + count(fol, 'NAT-demo-1') + ' t1=' + count(fol, 'TOP-demo-1'));

  console.log('═══ F1-3 i18n 键族 ═══');
  ok('F1-3a 新键 ×12 语（代表性 5 键）+ searchPh ×12 + zh-Hant 标记 ×1',
    count(i18n, 'following.offline.title') === 12 && count(i18n, 'following.loginCta.title') === 12 &&
    count(i18n, 'following.feed.time.daysAgo') === 12 && count(i18n, 'following.empty.users') === 12 &&
    count(i18n, '"following.rec.empty":') === 12 &&
    count(i18n, 'following.searchPh') === 12 && count(i18n, '__ZH_HANT_AUTO__') === 1,
    'off=' + count(i18n, 'following.offline.title') + ' cta=' + count(i18n, 'following.loginCta.title') +
    ' days=' + count(i18n, 'following.feed.time.daysAgo') + ' eu=' + count(i18n, 'following.empty.users') +
    ' rec=' + count(i18n, '"following.rec.empty":') +
    ' sp=' + count(i18n, 'following.searchPh') + ' hant=' + count(i18n, '__ZH_HANT_AUTO__'));
  ok('F1-3b 计数后缀保留 ×12 + 死键零残留（规则行锚 6 项）',
    count(i18n, 'following.suffix.followers') === 12 && count(i18n, 'following.suffix.members') === 12 &&
    count(i18n, "'following.feed.badge.nation':") === 0 && count(i18n, "'following.feed.time.t2h':") === 0 &&
    count(i18n, "'following.feed.desc.nation':") === 0 && count(i18n, "'following.discover.natDesc.solarian':") === 0 &&
    count(i18n, "'following.rec.sub.solarian':") === 0 && count(i18n, "'following.list.citizen':") === 0,
    'suf=' + count(i18n, 'following.suffix.followers') + '/' + count(i18n, 'following.suffix.members') +
    ' badge=' + count(i18n, "'following.feed.badge.nation':") + ' t2h=' + count(i18n, "'following.feed.time.t2h':") +
    ' desc=' + count(i18n, "'following.feed.desc.nation':") + ' nat=' + count(i18n, "'following.discover.natDesc.solarian':") +
    ' rec=' + count(i18n, "'following.rec.sub.solarian':") + ' cit=' + count(i18n, "'following.list.citizen':"));

  console.log('═══ F1-4 site-config.js 版本 ═══');
  ok('F1-4 版本 58.17 在位/58.16 赋值零残留/FC 恒 47.4/changelog（标题+原话+rev 对）',
    count(sconf, "window.MN_SITE_VERSION = 'v0.2.58.20';") === 1 &&
    count(sconf, "window.MN_SITE_VERSION = 'v0.2.58.16';") === 0 &&
    count(sconf, "window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") === 1 &&
    count(sconf, '// v0.2.58.20 = ') === 1 && count(sconf, '那么关注页面的也做一下') === 1 &&
    count(sconf, 'rev 00336-XXX') === 2 && count(sconf, 'rev 00337-???') === 2,
    'v17=' + count(sconf, "window.MN_SITE_VERSION = 'v0.2.58.20';") +
    ' v16res=' + count(sconf, "window.MN_SITE_VERSION = 'v0.2.58.16';") +
    ' title=' + count(sconf, '// v0.2.58.20 = ') + ' quote=' + count(sconf, '那么关注页面的也做一下'));

  console.log('═══ F1-5 后端源码（social.js 三新端点）═══');
  ok('F1-5 端点串 + SQL 片断 + 限流键 + LIMIT（各 ×1）',
    count(socialSrc, "'/api/social/feed'") === 1 && count(socialSrc, "'/api/social/following/detail'") === 1 &&
    count(socialSrc, "'/api/public/users'") === 1 && count(socialSrc, "'pu:ip:'") === 1 &&
    count(socialSrc, 'publicUsers') === 1 && count(socialSrc, 'ORDER BY seq DESC LIMIT 100') >= 1 &&
    count(socialSrc, 'followerCount DESC') === 1 && count(socialSrc, "author_id IN (SELECT target_id FROM following") === 1,
    'feed=' + count(socialSrc, "'/api/social/feed'") + ' det=' + count(socialSrc, "'/api/social/following/detail'") +
    ' pub=' + count(socialSrc, "'/api/public/users'") + ' pu=' + count(socialSrc, "'pu:ip:'") +
    ' lim=' + count(socialSrc, 'ORDER BY seq DESC LIMIT 100') + ' fdesc=' + count(socialSrc, 'followerCount DESC'));
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
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SEED_SESSION });

    const PAGE_URL = BASE + '/pages/following.html';
    const SEED_TXT = 'Republic of Etheria';

    // ═══ R7 匿名无桩（先暖身导航建 localStorage 域，再置旗重导航）═══
    console.log('═══ R 浏览器流程 ═══');
    await cdp.send('Page.navigate', { url: PAGE_URL });
    await waitFor(cdp, "document.getElementById('feedPanel').children.length > 0", 30000, 'R7 暖身渲染');
    await cdp.evalJs("localStorage.setItem('__mnNoLogin','1')");
    await cdp.send('Page.navigate', { url: PAGE_URL });
    await waitFor(cdp, "document.getElementById('feedPanel').textContent.indexOf('登录后查看你的动态') !== -1", 30000, 'R7 登录引导卡');
    const r7 = await cdp.evalJs("(function(){return {cta:document.getElementById('feedPanel').textContent.indexOf('登录后查看你的动态')!==-1,offN:document.querySelectorAll('#discoverPanel .folg-offline').length,offW:document.getElementById('rightSidebarSlot').textContent.indexOf('数据暂时不可用')!==-1,seed:document.body.textContent.indexOf('Republic of Etheria')!==-1,feedCalls:window.__mnFeedCalls};})()");
    ok('R7 匿名无桩（feed 登录引导卡 + 发现三区离线卡 + 右栏离线 + 零种子 + 零 feed 调用）',
      r7.cta && r7.offN === 3 && r7.offW && !r7.seed && r7.feedCalls === undefined, JSON.stringify(r7));

    // ═══ 装桩 → R6 匿名有桩 ═══
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    await cdp.send('Page.navigate', { url: PAGE_URL });
    await waitFor(cdp, "document.querySelectorAll('#discoverNations .tilt-container').length === 4", 30000, 'R6 发现区真数据');
    const r6 = await cdp.evalJs("(function(){var wf=document.querySelectorAll('#rightSidebarSlot .follow-btn').length;return {cta:document.getElementById('feedPanel').textContent.indexOf('登录后查看你的动态')!==-1,nN:document.querySelectorAll('#discoverNations .tilt-container').length,tN:document.querySelectorAll('#discoverTopics .tilt-container').length,uN:document.querySelectorAll('#discoverUsers .tilt-container').length,wf:wf,seed:document.body.textContent.indexOf('Republic of Etheria')!==-1,feedCalls:window.__mnFeedCalls,detCalls:window.__mnDetCalls};})()");
    ok('R6 匿名有桩（引导卡 + 发现 4/4/4 真行 + 推荐关注 4 行 + 零种子 + 零 feed/detail 调用）',
      r6.cta && r6.nN === 4 && r6.tN === 4 && r6.uN === 4 && r6.wf === 4 && !r6.seed && r6.feedCalls === 0 && r6.detCalls === 0, JSON.stringify(r6));

    // ═══ 去旗 → 登录态 R1 ═══
    await cdp.evalJs("localStorage.removeItem('__mnNoLogin')");
    await cdp.send('Page.navigate', { url: PAGE_URL });
    await waitFor(cdp, "document.querySelectorAll('#feedPanel .tilt-container').length === 3", 30000, 'R1 三帖渲染');
    const r1 = await cdp.evalJs("(function(){var cs=document.querySelectorAll('#feedPanel .tilt-container');var txt=document.getElementById('feedPanel').textContent;return {n:cs.length,authors:txt.indexOf('Nova Lin')!==-1&&txt.indexOf('Kai Zhang')!==-1&&txt.indexOf('Lena Hartmann')!==-1,c1:txt.indexOf('Hello from Nova Terra')!==-1,d2:txt.indexOf('2 天前')!==-1,d1:txt.indexOf('1 天前')!==-1,today:txt.indexOf('今天')!==-1,img:document.querySelectorAll('#feedPanel .folg-media img').length,likes:txt.indexOf('favorite9')!==-1,views:txt.indexOf('visibility58')!==-1,feedCalls:window.__mnFeedCalls};})()");
    ok('R1 登录 feed（3 帖/三作者/内容/2 天前+1 天前+今天/1 媒体图/计数 9·58/1 次拉取）',
      r1.n === 3 && r1.authors && r1.c1 && r1.d2 && r1.d1 && r1.today && r1.img === 1 && r1.likes && r1.views && r1.feedCalls === 1, JSON.stringify(r1));
    await waitFor(cdp, "(window.__mnPvCalls||[]).length === 1", 10000, 'R1b 灯塔记录');
    const r1b = await cdp.evalJs("(function(){var c=window.__mnPvCalls||[];return {n:c.length,path:c[0]&&c[0].path,cid:c[0]&&c[0].clientId};})()");
    ok('R1b 灯塔每页一次（1 条/路径 following.html/clientId 非空）',
      r1b.n === 1 && r1b.path === '/pages/following.html' && !!r1b.cid, JSON.stringify(r1b));

    // ═══ R2 following 列表 + 四滤镜 + 统计卡 ═══
    await cdp.evalJs("document.querySelector('#mainTabs [data-tab=\"following\"]').click()");
    await waitFor(cdp, "document.querySelectorAll('#followingList .unfollow-btn').length === 4", 30000, 'R2 4 行');
    const r2a = await cdp.evalJs("(function(){var ls=document.querySelectorAll('#followingList .card');var txt=document.getElementById('followingList').textContent;var ns=Array.prototype.map.call(document.querySelectorAll('#rightSidebarSlot span[style*=\"font-weight:700\"]'),function(s){return s.textContent;});return {n:ls.length,nova:txt.indexOf('Nova Terra')!==-1,aethel:txt.indexOf('Königreich Aethel')!==-1,topic:txt.indexOf('AI 治理实验室')!==-1,user:txt.indexOf('Nova Lin')!==-1,stats:ns};})()");
    ok('R2a following 4 行（2 国+1 话题+1 公民）+ 统计卡 2/1/1',
      r2a.n === 4 && r2a.nova && r2a.aethel && r2a.topic && r2a.user &&
      r2a.stats.length === 3 && r2a.stats[0] === '2' && r2a.stats[1] === '1' && r2a.stats[2] === '1', JSON.stringify(r2a));
    const r2b = {};
    const filters = [['nations', 2], ['topics', 1], ['users', 1], ['all', 4]];
    for (const [fl, want] of filters) {
      await cdp.evalJs("document.querySelector('#followingFilter [data-filter=\"" + fl + "\"]').click()");
      await waitFor(cdp, "document.querySelectorAll('#followingList .unfollow-btn').length === " + want + " || document.getElementById('followingEmpty').style.display !== 'none'", 8000, 'R2b filter ' + fl);
      r2b[fl] = await cdp.evalJs("(function(){return {n:document.querySelectorAll('#followingList .unfollow-btn').length,empty:document.getElementById('followingEmpty').style.display==='none'?false:true};})()");
    }
    ok('R2b 四滤镜 2/1/1/4（无假空态）',
      r2b.nations.n === 2 && r2b.topics.n === 1 && r2b.users.n === 1 && r2b.all.n === 4 &&
      !r2b.nations.empty && !r2b.topics.empty && !r2b.users.empty && !r2b.all.empty, JSON.stringify(r2b));

    // ═══ R3 发现三区 + 按钮态 ═══
    await cdp.evalJs("document.querySelector('#mainTabs [data-tab=\"discover\"]').click()");
    await waitFor(cdp, "document.querySelectorAll('#discoverNations .tilt-container').length === 4", 8000, 'R3 发现渲染');
    const r3 = await cdp.evalJs("(function(){var nb=Array.prototype.map.call(document.querySelectorAll('#discoverNations .follow-btn'),function(b){return b.textContent.indexOf('已关注')!==-1;});var tb=Array.prototype.map.call(document.querySelectorAll('#discoverTopics .follow-btn'),function(b){return b.textContent.indexOf('已关注')!==-1;});var ub=Array.prototype.map.call(document.querySelectorAll('#discoverUsers .follow-btn'),function(b){return b.textContent.indexOf('已关注')!==-1;});var txt=document.getElementById('discoverPanel').textContent;return {nb:nb,tb:tb,ub:ub,sf:txt.indexOf('Solarian Federation')!==-1,da:txt.indexOf('Deepwater Accord')!==-1,guild:txt.indexOf('旗帜纹章公会')!==-1,mv:txt.indexOf('Marcus Vane')!==-1};})()");
    ok('R3 发现三区（真名 4 国/4 话题/4 公民 + 按钮态=followingIds：已关注 2/1/1）',
      r3.nb.filter(function (x) { return x; }).length === 2 && r3.nb.length === 4 &&
      r3.tb.filter(function (x) { return x; }).length === 1 && r3.ub.filter(function (x) { return x; }).length === 1 &&
      r3.sf && r3.da && r3.guild && r3.mv, JSON.stringify(r3));

    // ═══ R4 搜索过滤零重拉 ═══
    const callsBefore4 = await cdp.evalJs("window.__mnFeedCalls + '/' + window.__mnDetCalls + '/' + window.__mnPubCalls + '/' + window.__mnDiscCalls");
    await cdp.evalJs("(function(){var el=document.getElementById('followingSearch');el.value='nova';el.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await waitFor(cdp, "document.querySelectorAll('#feedPanel .tilt-container').length === 1 && document.querySelectorAll('#discoverNations .tilt-container').length === 1", 8000, 'R4 nova 过滤');
    const r4a = await cdp.evalJs("(function(){return {feed:document.querySelectorAll('#feedPanel .tilt-container').length,nN:document.querySelectorAll('#discoverNations .tilt-container').length,tN:document.querySelectorAll('#discoverTopics .tilt-container').length,uN:document.querySelectorAll('#discoverUsers .tilt-container').length,calls:window.__mnFeedCalls + '/' + window.__mnDetCalls + '/' + window.__mnPubCalls + '/' + window.__mnDiscCalls};})()");
    ok('R4a 搜索 nova（feed 1 帖 Nova Lin + 国 1/话题 0/公民 1 + 零重拉）',
      r4a.feed === 1 && r4a.nN === 1 && r4a.tN === 0 && r4a.uN === 1 && r4a.calls === callsBefore4, JSON.stringify(r4a));
    await cdp.evalJs("document.querySelector('#mainTabs [data-tab=\"following\"]').click()");
    await waitFor(cdp, "document.querySelectorAll('#followingList .unfollow-btn').length === 2", 8000, 'R4 following nova');
    const r4b = await cdp.evalJs("(function(){return {n:document.querySelectorAll('#followingList .unfollow-btn').length,txt:document.getElementById('followingList').textContent.indexOf('Nova Terra')!==-1&&document.getElementById('followingList').textContent.indexOf('Nova Lin')!==-1,calls:window.__mnFeedCalls + '/' + window.__mnDetCalls + '/' + window.__mnPubCalls + '/' + window.__mnDiscCalls};})()");
    ok('R4b following 过滤（Nova Terra+Nova Lin 2 行 + 零重拉）', r4b.n === 2 && r4b.txt && r4b.calls === callsBefore4, JSON.stringify(r4b));
    await cdp.evalJs("(function(){var el=document.getElementById('followingSearch');el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await waitFor(cdp, "document.querySelectorAll('#followingList .unfollow-btn').length === 4", 8000, 'R4 清空复原');
    const r4c = await cdp.evalJs("(function(){return {n:document.querySelectorAll('#followingList .unfollow-btn').length,calls:window.__mnFeedCalls + '/' + window.__mnDetCalls + '/' + window.__mnPubCalls + '/' + window.__mnDiscCalls};})()");
    ok('R4c 清空复原（4 行 + 零重拉）', r4c.n === 4 && r4c.calls === callsBefore4, JSON.stringify(r4c));

    // ═══ R5 关注/取关真调用 ═══
    // R5a nation：discover 卡 +关注 → PUT 镜像记录 + 按钮翻已关注 + following 3 国
    await cdp.evalJs("document.querySelector('#mainTabs [data-tab=\"discover\"]').click()");
    await waitFor(cdp, "document.querySelectorAll('#discoverNations .follow-btn').length === 4", 8000, 'R5 发现就绪');
    await cdp.evalJs("(function(){var btns=document.querySelectorAll('#discoverNations .follow-btn');for(var i=0;i<btns.length;i++){if(btns[i].dataset.id==='NAT-000003'){btns[i].click();break;}}})()");
    await waitFor(cdp, "document.querySelector('#discoverNations .follow-btn[data-id=\"NAT-000003\"]').textContent.indexOf('已关注') !== -1", 10000, 'R5a 按钮翻转');
    await waitFor(cdp, "(window.__mnPutCalls||[]).length >= 1", 8000, 'R5a PUT 记录');
    await waitFor(cdp, "document.querySelectorAll('#discoverNations .follow-btn').length === 4 && document.querySelector('#discoverNations .follow-btn[data-id=\"NAT-000003\"]').textContent.indexOf('已关注') !== -1", 10000, 'R5a 真相重拉后仍已关注');
    const r5a = await cdp.evalJs("(function(){var p=window.__mnPutCalls||[];var nb=document.querySelector('#discoverNations .follow-btn[data-id=\"NAT-000003\"]').textContent.indexOf('已关注')!==-1;return {puts:p.length,body:p[p.length-1]||'',nb:nb};})()");
    ok('R5a nation 关注（PUT 镜像 1 条+体含 NAT-000003+按钮翻已关注）',
      r5a.puts >= 1 && r5a.body.indexOf('NAT-000003') !== -1 && r5a.nb, JSON.stringify(r5a));
    await cdp.evalJs("document.querySelector('#mainTabs [data-tab=\"following\"]').click()");
    await waitFor(cdp, "document.querySelectorAll('#followingList .unfollow-btn').length === 5", 10000, 'R5a following 5 行');
    const r5a2 = await cdp.evalJs("(function(){var ns=Array.prototype.map.call(document.querySelectorAll('#rightSidebarSlot span[style*=\"font-weight:700\"]'),function(s){return s.textContent;});return {n:document.querySelectorAll('#followingList .unfollow-btn').length,stats:ns};})()");
    ok('R5a 服务端真相（following 5 行 + 统计卡国 3）', r5a2.n === 5 && r5a2.stats.length === 3 && r5a2.stats[0] === '3', JSON.stringify(r5a2));

    // R5b user：Who-to-Follow +关注 → POST 记录 + 行消失
    await cdp.evalJs("document.querySelector('#mainTabs [data-tab=\"feed\"]').click()");
    await waitFor(cdp, "document.querySelectorAll('#rightSidebarSlot .follow-btn').length === 3", 8000, 'R5b 推荐 3 行');
    await cdp.evalJs("(function(){var btns=document.querySelectorAll('#rightSidebarSlot .follow-btn');btns[0].click();})()");
    await waitFor(cdp, "document.querySelectorAll('#rightSidebarSlot .follow-btn').length === 2", 10000, 'R5b 行消失');
    await waitFor(cdp, "(window.__mnFollowCalls||[]).length >= 1", 8000, 'R5b POST 记录');
    const r5b = await cdp.evalJs("(function(){var c=window.__mnFollowCalls||[];return {n:c.length,m0:c[0]&&c[0].method,id0:c[0]&&c[0].id,wf:document.querySelectorAll('#rightSidebarSlot .follow-btn').length};})()");
    ok('R5b user 关注（POST USR-000005 + 推荐行 3→2）',
      r5b.n >= 1 && r5b.m0 === 'POST' && r5b.id0 === 'USR-000005' && r5b.wf === 2, JSON.stringify(r5b));

    // R5c user 取关：following 列表 users 行 → DELETE 记录 + 行消失
    await cdp.evalJs("document.querySelector('#mainTabs [data-tab=\"following\"]').click()");
    await waitFor(cdp, "document.querySelectorAll('#followingList .unfollow-btn').length === 6", 10000, 'R5c 列表 6 行（国 3+话题 1+公民 2）');
    await cdp.evalJs("document.querySelector('#followingFilter [data-filter=\"users\"]').click()");
    await waitFor(cdp, "document.querySelectorAll('#followingList .unfollow-btn').length === 2", 8000, 'R5c users 2 行');
    await cdp.evalJs("(function(){var btns=document.querySelectorAll('#followingList .unfollow-btn');for(var i=0;i<btns.length;i++){if(btns[i].dataset.id==='USR-000005'){btns[i].click();break;}}})()");
    await waitFor(cdp, "document.querySelectorAll('#followingList .unfollow-btn').length === 1", 10000, 'R5c 取关后 1 行');
    await waitFor(cdp, "(window.__mnFollowCalls||[]).length >= 2", 8000, 'R5c DELETE 记录');
    const r5c = await cdp.evalJs("(function(){var c=window.__mnFollowCalls||[];return {n:c.length,m1:c[1]&&c[1].method,id1:c[1]&&c[1].id,rows:document.querySelectorAll('#followingList .unfollow-btn').length,txt:document.getElementById('followingList').textContent.indexOf('Marcus Vane')!==-1};})()");
    ok('R5c user 取关（DELETE USR-000005 + 行 2→1 + followingList 无 Marcus Vane）',
      r5c.n >= 2 && r5c.m1 === 'DELETE' && r5c.id1 === 'USR-000005' && r5c.rows === 1 && !r5c.txt, JSON.stringify(r5c));

    // ═══ R8 切语言零重拉 ═══
    const callsBefore8 = await cdp.evalJs("window.__mnFeedCalls + '/' + window.__mnDetCalls + '/' + window.__mnPubCalls + '/' + window.__mnDiscCalls");
    await cdp.evalJs("window.MN_I18N.setLang('en')");
    await waitFor(cdp, "document.getElementById('feedPanel').textContent.indexOf('2 days ago') !== -1", 8000, 'R8 en');
    const r8a = await cdp.evalJs("(function(){var txt=document.getElementById('feedPanel').textContent;return {days:txt.indexOf('2 days ago')!==-1,hello:txt.indexOf('Hello from Nova Terra')!==-1,calls:window.__mnFeedCalls + '/' + window.__mnDetCalls + '/' + window.__mnPubCalls + '/' + window.__mnDiscCalls};})()");
    ok('R8a setLang(en)（2 days ago + 内容值保留 + 零重拉）', r8a.days && r8a.hello && r8a.calls === callsBefore8, JSON.stringify(r8a));
    await cdp.evalJs("window.MN_I18N.setLang('zh')");
    await waitFor(cdp, "document.getElementById('feedPanel').textContent.indexOf('2 天前') !== -1", 8000, 'R8 zh');
    const r8b = await cdp.evalJs("(function(){return {days:document.getElementById('feedPanel').textContent.indexOf('2 天前')!==-1,calls:window.__mnFeedCalls + '/' + window.__mnDetCalls + '/' + window.__mnPubCalls + '/' + window.__mnDiscCalls};})()");
    ok('R8b setLang(zh) 复原（2 天前 + 零重拉）', r8b.days && r8b.calls === callsBefore8, JSON.stringify(r8b));

    // ═══ R9 空夹具空态（localStorage 旗 + 重导航；绝不回退假数据）═══
    await cdp.evalJs("localStorage.setItem('__mnFollowingEmpty','1')");
    await cdp.send('Page.navigate', { url: PAGE_URL });
    await waitFor(cdp, "document.getElementById('feedPanel').textContent.indexOf('这里就会显示更新') !== -1", 30000, 'R9 feed 空态');
    await cdp.evalJs("document.querySelector('#mainTabs [data-tab=\"following\"]').click()");
    await waitFor(cdp, "document.getElementById('followingEmpty').style.display !== 'none'", 8000, 'R9 following 空态');
    await cdp.evalJs("document.querySelector('#mainTabs [data-tab=\"discover\"]').click()");
    await waitFor(cdp, "document.getElementById('discoverNations').textContent.indexOf('还没有国家') !== -1", 8000, 'R9 发现空态');
    const r9 = await cdp.evalJs("(function(){var txt=document.body.textContent;return {nN:document.getElementById('discoverNations').textContent.indexOf('还没有国家')!==-1,tN:document.getElementById('discoverTopics').textContent.indexOf('还没有话题')!==-1,uN:document.getElementById('discoverUsers').textContent.indexOf('还没有公民')!==-1,rec:document.getElementById('rightSidebarSlot').textContent.indexOf('暂时没有推荐')!==-1,seed:txt.indexOf('Republic of Etheria')!==-1||txt.indexOf('Solarian Federation')!==-1};})()");
    ok('R9 空夹具（三区空态 + 推荐空态 + 零种子文本）',
      r9.nN && r9.tN && r9.uN && r9.rec && !r9.seed, JSON.stringify(r9));

    // ═══ E1 全程零异常零 console error ═══
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|settings-menu|\/api\/|Failed to load resource/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('E1 控制台零错误（噪声已滤）', realErrs.length === 0, realErrs.slice(0, 3).join(' | '));

    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    fail++;
  }
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  server.close();
  console.log('\n═══ ' + (fail === 0 ? 'ALL GREEN' : 'FAILED') + ' — ' + pass + '/' + (pass + fail) + ' ═══');
  process.exit(fail === 0 ? 0 : 1);
})();
