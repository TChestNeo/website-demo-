// tmp-battery-community-nodemo.js — v0.2.58.26 社区页演示样本全移除 + 三 tab 全接真数据电池（2026-09-30）
// 用户：「能不能把社区页面的所有测试使用的样本信息都去除掉」
// 四项钦定：①只删页面假样本（后端库数据不动）②匿名访客看登录引导卡（58.17 following 先例）
//   ③三 tab 全接真数据（recommend=/api/social/posts、following=/api/social/feed、topic=/api/social/topics）
//   ④发现中心一并清理接真数据（Topics/热门接真话题空表空态；Channels 无数据源保留 tab 空态；访客看引导）。
// F 静态段（零浏览器直接读文件）：site-config 58.24×2+58.23 历史保留+rev 占位双锚；hub 演示零残留全表（16 锚=0）+
//   新件锚 23 项（isHubAuthed/登录卡/离线卡/mn:unauthorized/三端点/空态/发现中心等）；i18n 32 删键全 0 +
//   hub.emptyFeed 保留 ×12 + 11 新键各 SQ×11+DQ×1。
// B 访客段（本地无种子）：登录引导卡形态（lock 图标+去登录钮+feed 恰 1 卡）+三 tab 恒引导卡+发现中心/热门双引导行+
//   切频道 tab 仍引导+零 API 含零 probe+正文零演示签名+零异常。
// C 云模式罐头段（本地 seedUser）：recommend=composer+2 云卡零死爱心/关注 2 帖零 composer/话题 2 卡成员计数响应序+
//   发现 topics 响应序+热门 memberCount 降序+channels 空态/空 feed 双空态（recommend 通用+following 专属）/
//   空 topics 三空态+建话题 CTA 链/feed 401 整流→登录引导卡/probe 网络错误→离线卡（非登录卡）/零异常。
// L live 访客段：真站点访客面=登录引导卡+零云卡零演示签名零 composer+发现引导行+切 topic tab 恒引导卡+零异常。
// 跑法：node tmp-battery-community-nodemo.js（LIVE_BASE=<完整站点 URL> 跑线上）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3900 + Math.floor(Math.random() * 500);
const CDP_PORT = 4900 + Math.floor(Math.random() * 500);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-' + Date.now());

// 1x1 真 PNG（媒体瓦片用真图，防 404 图片日志污染 0-console-error 断言）
const PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const AVATAR_URI = 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2228%22%20height%3D%2228%22%3E%3Ccircle%20cx%3D%2214%22%20cy%3D%2214%22%20r%3D%2214%22%20fill%3D%22%23464dd4%22%2F%3E%3C%2Fsvg%3E';

// document-start fetch 罐头（只在本地模式挂，线上走真后端）
//   开关（localStorage，全在请求时读）：__mn_empty_feed 空 feed/空关注、__mn_empty_topics 空话题、
//   __mn_force_401 feed 401 整流、__mn_probe_fail probe 网络错误（reject——api.js probe 内部 catch 落 false）
const DOC_START_SRC = `
(function () {
  window.__fetchCalls = [];
  var P1 = {
    id: 'PST-000101', authorName: '电池作者甲', avatarUrl: ${JSON.stringify(AVATAR_URI)},
    content: '电池云帖一：真实云数据流第一张卡片。',
    createdAt: '2026-09-30T08:00:00.000Z', likeCount: 3, commentCount: 2, likedByMe: false, media: [],
    repostOfId: null, repostOf: null, repostCount: 0, repostedByMe: false
  };
  var P2 = {
    id: 'PST-000102', authorName: '电池作者乙', avatarUrl: null,
    content: '电池云帖二：真实云数据流第二张卡片。',
    createdAt: '2026-09-30T09:00:00.000Z', likeCount: 1, commentCount: 0, likedByMe: false, media: [],
    repostOfId: null, repostOf: null, repostCount: 0, repostedByMe: false
  };
  var F1 = {
    id: 'PST-000201', authorName: '关注作者丙', avatarUrl: null,
    content: '电池关注流帖一。',
    createdAt: '2026-09-30T10:00:00.000Z', likeCount: 0, commentCount: 0, likedByMe: false, media: [],
    repostOfId: null, repostOf: null, repostCount: 0, repostedByMe: false
  };
  var F2 = {
    id: 'PST-000202', authorName: '关注作者丁', avatarUrl: null,
    content: '电池关注流帖二。',
    createdAt: '2026-09-30T11:00:00.000Z', likeCount: 0, commentCount: 0, likedByMe: false, media: [],
    repostOfId: null, repostOf: null, repostCount: 0, repostedByMe: false
  };
  // 话题响应序故意 5 在前 12 在后——topic 流按响应序、热门按 memberCount 降序（12 在前），两条口径各自可证
  var TOPICS = [
    { name: '国徽设计讨论', description: '电池话题一描述', memberCount: 5 },
    { name: '宪法草案', description: '电池话题二描述', memberCount: 12 }
  ];
  function res(status, body) {
    return { status: status, ok: status >= 200 && status < 300, headers: { get: function () { return null; } }, json: function () { return Promise.resolve(body); } };
  }
  function sw(k) { try { return window.localStorage.getItem(k) === '1'; } catch (e) { return false; } }
  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf('/api/') !== -1) {
      var method = (opts && opts.method) || 'GET';
      window.__fetchCalls.push({ url: u, method: method });
      var key = method + ' ' + u;
      if (key === 'GET /api/health') {
        if (sw('__mn_probe_fail')) return Promise.reject(new Error('network down'));
        return Promise.resolve(res(200, { status: 'ok', version: '2.0.0', tables: 58 }));
      }
      if (key === 'GET /api/social/posts') return Promise.resolve(res(200, { posts: sw('__mn_empty_feed') ? [] : [P1, P2] }));
      if (key === 'GET /api/social/feed') {
        if (sw('__mn_force_401')) return Promise.resolve(res(401, { error: '未登录' }));
        return Promise.resolve(res(200, { posts: sw('__mn_empty_feed') ? [] : [F1, F2] }));
      }
      if (key === 'GET /api/social/topics') return Promise.resolve(res(200, { topics: sw('__mn_empty_topics') ? [] : TOPICS }));
    }
    return realFetch(url, opts);
  };
})();
`;

// ── 静态壳（docs/ 原样；/api 全 404） ──
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/uploads/UPL-DEMO01.jpg') { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(PIXEL_PNG); return; }
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => {
        if (e2) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b2);
      });
      return;
    }
    if (err) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});

// ── CDP 客户端 ──
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method) {
        const ls = this.listeners.get(m.method);
        if (ls) ls.forEach(fn => fn(m.params));
      }
    };
  }
  send(method, params) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  on(method, fn) { if (!this.listeners.has(method)) this.listeners.set(method, []); this.listeners.get(method).push(fn); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || 'exception'));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('waitFor 超时: ' + label);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const pass = [], fail = [];
function check(name, cond, detail) {
  const line = (cond ? '  ✅ ' : '  ❌ ') + name + (detail ? '（' + detail + '）' : '');
  console.log(line);
  (cond ? pass : fail).push(line);
}
async function nav(t, url) { await t.send('Page.navigate', { url }); await sleep(900); }
async function seedUser(t) {
  await t.evalJs("localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true, at: new Date().toISOString() }));" +
    "localStorage.setItem('slati_user', JSON.stringify({ id: 'USR-000101', name: '电池用户', avatarUrl: null }));");
}
async function clearUser(t) {
  await t.evalJs("localStorage.removeItem('slati_session'); localStorage.removeItem('slati_user');");
}

// ── F. 静态文件零残留（零浏览器直接读文件）──
function runStatic() {
  console.log('── F. 静态文件零残留（零浏览器）──');
  const cfg = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  const hub = fs.readFileSync(path.join(DOCS, 'pages', 'community-hub.html'), 'utf8');
  const i18n = fs.readFileSync(path.join(DOCS, 'assets', 'i18n', 'community-hub.i18n.js'), 'utf8');
  const c = (s, a) => s.split(a).length - 1;

  // F1 site-config：58.26 恰 3（版本行+站点 changelog 头+FC 条目正文提及）+ 58.23 历史条目保留 + rev 占位双锚
  check('F1 site-config v0.2.58.26 恰 11 处（版本行+站点头+49.0 条目头/正文+49.1 条目头/正文+49.2 条目头/正文+50.0 条目头/正文——636 轮再 +2）', c(cfg, 'v0.2.58.26') === 11, 'n=' + c(cfg, 'v0.2.58.26'));
  check('F1 site-config 58.23 历史条目保留 ×1', c(cfg, 'v0.2.58.23') === 1, 'n=' + c(cfg, 'v0.2.58.23'));
  check('F1 rev 占位双锚（00348-XXX + 00349-??? 各 2，部署后终态同数）', c(cfg, 'rev 00348-') === 2 && c(cfg, 'rev 00349-') === 2, c(cfg, 'rev 00348-') + ' / ' + c(cfg, 'rev 00349-'));

  // F2 hub 演示零残留全表（16 锚=0）
  const ZERO = ['var feedData', 'Marcus Vane', 'Sovereign Council', 'Cartography Guild', 'Neural Architects',
    'SlatiDB.getTopics', 'data-guest-', 'hub.toast.likeLogin', 'hub.toast.repostLogin', 'hub.toast.favLogin',
    'hub.share.communityTitle', 'communityHub.feed.', 'badgeKey', 'timeKey', 'titleKey', 'descKey'];
  const zleft = ZERO.filter(a => c(hub, a) !== 0);
  check('F2 hub 演示零残留全表（16 锚全 0）', zleft.length === 0, zleft.join(',') || '全零');

  // F3 hub 新件锚（23 项——写锚前实测计数）
  const ONE = ['function isHubAuthed', 'cloudMode = isHubAuthed()', 'id="hubLoginCard"', 'id="hubOfflineCard"',
    'function hubOfflineCardHtml', "addEventListener('mn:unauthorized'", "MN_API.get('/social/posts')",
    "MN_API.get('/social/feed')", "MN_API.get('/social/topics')", 'create-topic-step-1.html', "T('hub.emptyFeed')",
    "T('hub.topic.members')", "T('hub.discovery.channelsEmpty')", "T('hub.feedEmptyFollowing')", "T('hub.feedEmptyTopic')",
    "T('hub.offline')", 'function topicCardHtml', 'function feedEmptyHtml'];
  const oneBad = ONE.filter(a => c(hub, a) !== 1);
  const TWO = ["T('hub.discovery.guest')", "T('hub.discovery.emptyTopics')", 'hubLoginCardHtml', 'hubOfflineCardHtml'];
  const twoBad = TWO.filter(a => c(hub, a) !== 2);
  const THREE = ["T('hub.loginCta."];
  const threeBad = THREE.filter(a => c(hub, a) !== 3);
  check('F3 hub 新件锚（18 项恰 1 + 4 项恰 2 + loginCta 恰 3）', oneBad.length === 0 && twoBad.length === 0 && threeBad.length === 0,
    oneBad.concat(twoBad, threeBad).join(',') || '全对');

  // F4 i18n：32 删键全 0 + hub.emptyFeed 保留 ×12
  const IZERO = ['communityHub.feed.', 'hub.toast.likeLogin', 'hub.toast.repostLogin', 'hub.toast.favLogin', 'hub.share.communityTitle'];
  const izleft = IZERO.filter(a => c(i18n, a) !== 0);
  check('F4 i18n 删键全 0（32 键族）', izleft.length === 0, izleft.join(',') || '全零');
  check('F4 i18n hub.emptyFeed 保留 ×12（12 语言块）', c(i18n, 'hub.emptyFeed') === 12, 'n=' + c(i18n, 'hub.emptyFeed'));

  // F5 i18n：11 新键各 SQ×11 + DQ×1（zh-Hant OpenCC 块）+ __ZH_HANT_AUTO__ 标记
  const KEYS = ['hub.loginCta.title', 'hub.loginCta.desc', 'hub.loginCta.btn', 'hub.offline', 'hub.feedEmptyFollowing',
    'hub.feedEmptyTopic', 'hub.feedEmptyTopicCta', 'hub.discovery.guest', 'hub.discovery.emptyTopics',
    'hub.discovery.channelsEmpty', 'hub.topic.members'];
  const kbad = KEYS.filter(k => c(i18n, "'" + k + "':") !== 11 || c(i18n, '"' + k + '":') !== 1);
  check('F5 i18n 11 新键各 ×11 单引号块 + ×1 zh-Hant 双引号块', kbad.length === 0, kbad.join(',') || '全对');
  check('F5 i18n __ZH_HANT_AUTO__ 标记 ×1', c(i18n, '__ZH_HANT_AUTO__') === 1, 'n=' + c(i18n, '__ZH_HANT_AUTO__'));
}

async function main() {
  const LIVE = process.env.LIVE_BASE || '';
  const BASE = LIVE || ('http://127.0.0.1:' + PORT);
  if (!LIVE) server.listen(PORT);

  runStatic();

  let chromePath = null;
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {}
    await sleep(250);
  }
  const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' });
  const info = await r.json();
  const t = new CDP(info.webSocketDebuggerUrl);
  await t.connect();
  await t.send('Page.enable');
  await t.send('Runtime.enable');
  if (!LIVE) await t.send('Page.addScriptToEvaluateOnNewDocument', { source: DOC_START_SRC });
  const errs = [];
  t.on('Runtime.exceptionThrown', p => {
    const d = (p.exceptionDetails.exception && p.exceptionDetails.exception.description) || 'exc';
    if (d.indexOf('data:') === -1) errs.push(d);
  });
  t.on('Log.entryAdded', p => {
    if (p.entry.level === 'error' && p.entry.url && p.entry.url.indexOf('/api/') === -1 &&
        p.entry.url.indexOf('data:') === -1 && p.entry.url.indexOf('favicon') === -1) errs.push(p.entry.text);
  });
  await t.send('Log.enable');

  if (LIVE) await runLive(t);
  else await runLocal(t);

  console.log('\n' + pass.length + ' ✅ / ' + fail.length + ' ❌');
  t.close();
  chrome.kill();
  process.exit(fail.length ? 1 : 0);

  // ──────────────────────────────────────────────
  // 本地：B 访客（零种子）+ C 云模式罐头
  // ──────────────────────────────────────────────
  async function runLocal(t) {
    console.log('── B. 访客=登录引导卡（演示样本全移除）──');
    await nav(t, BASE + '/pages/community-hub.html');
    await waitFor(t, "document.getElementById('hubLoginCard')", 15000, '访客登录引导卡');

    // B1 引导卡形态：锁图标+去登录钮+feed 恰 1 卡（引导卡自身）+零云卡零演示签名零 composer
    const b1 = await t.evalJs("(() => { var feed = document.getElementById('feedContent'); var card = document.getElementById('hubLoginCard');" +
      " return { loginCard: !!card, lockIcon: card ? (card.querySelector('.material-symbols-outlined') || {}).textContent : null," +
      " btnText: card ? ((card.querySelector('button') || {}).textContent || '') : ''," +
      " cards: feed.querySelectorAll('.card').length," +
      " cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " guest: document.querySelectorAll('[data-guest-like],[data-guest-repost],[data-guest-favorite],[data-guest-share]').length," +
      " likeBtn: feed.querySelectorAll('[data-like-post]').length," +
      " static: feed.querySelectorAll('.post-action-btn-static').length," +
      " composer: !!document.getElementById('postComposer') }; })()");
    check('B1 访客=登录引导卡（锁图标+去登录钮）且零云卡零演示签名零 composer', b1 && b1.loginCard && b1.lockIcon === 'lock' && b1.btnText.indexOf('去登录') !== -1 && b1.cards === 1 && b1.cloud === 0 && b1.guest === 0 && b1.likeBtn === 0 && b1.static === 0 && !b1.composer, JSON.stringify(b1));

    // B2/B3 三 tab 恒登录引导卡（短路在绑定之前——访客零 composer 零云卡）
    await t.evalJs("document.querySelector('[data-tab=\"following\"]').click()");
    await sleep(200);
    const b2 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { loginCard: !!document.getElementById('hubLoginCard'), cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " active: (document.querySelector('[data-tab=\"following\"]') || {}).className || '' }; })()");
    check('B2 following tab 恒登录引导卡（切 tab 零云卡）', b2 && b2.loginCard && b2.cloud === 0 && b2.active.indexOf('active') !== -1, JSON.stringify(b2));
    await t.evalJs("document.querySelector('[data-tab=\"topic\"]').click()");
    await sleep(200);
    const b3 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { loginCard: !!document.getElementById('hubLoginCard'), cloud: feed.querySelectorAll('[data-cloud-id]').length }; })()");
    check('B3 topic tab 恒登录引导卡（切 tab 零云卡）', b3 && b3.loginCard && b3.cloud === 0, JSON.stringify(b3));

    // B4 发现中心+热门双引导行；切频道 tab 仍引导（访客分支无视 tab）
    const b4 = await t.evalJs("(() => { var d = document.getElementById('discoveryList'); var tr = document.getElementById('trendingList');" +
      " return { guest: d.textContent.indexOf('登录后探索话题与频道') !== -1, trendGuest: tr.textContent.indexOf('登录后探索话题与频道') !== -1 }; })()");
    check('B4 发现中心+热门双引导行', b4 && b4.guest && b4.trendGuest, JSON.stringify(b4));
    await t.evalJs("document.querySelector('[data-dtab=\"channels\"]').click()");
    await sleep(200);
    const b4b = await t.evalJs("document.getElementById('discoveryList').textContent.indexOf('登录后探索话题与频道') !== -1");
    check('B4b 访客切频道 tab 仍引导行', b4b === true);

    // B5 访客零 API（连 probe 都不发——initCloudFeed 同步门短路）
    const b5 = await t.evalJs('window.__fetchCalls.length');
    check('B5 访客零 API 调用（含零 probe）', b5 === 0, 'calls=' + b5);

    // B6 正文零演示签名（假名假数全不在 DOM）
    const b6 = await t.evalJs("(() => { var t = document.body.textContent;" +
      " return { m: t.indexOf('Marcus Vane') === -1, s: t.indexOf('Sovereign Council') === -1," +
      " c: t.indexOf('Cartography Guild') === -1, n: t.indexOf('Neural Architects') === -1 }; })()");
    check('B6 正文零演示签名（四假名全不在 DOM）', b6 && b6.m && b6.s && b6.c && b6.n, JSON.stringify(b6));

    check('B7 全程 0 console 错误（访客段）', errs.length === 0, errs.slice(0, 2).join(' | '));

    console.log('── C. 云模式罐头（三 tab 全接真数据）──');
    await seedUser(t);
    await t.send('Page.reload');
    await sleep(1500);
    await waitFor(t, "document.querySelectorAll('[data-cloud-id]').length >= 2", 20000, 'recommend 两云卡');

    // C1 recommend=composer + 2 云卡 + 零演示签名零死爱心
    const c1 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " var staticHeart = 0;" +
      " feed.querySelectorAll('.post-action-btn-static').forEach(function (s) {" +
      "   var ic = s.querySelector('.material-symbols-outlined');" +
      "   if (ic && (ic.textContent === 'favorite' || ic.textContent === 'favorite_border')) staticHeart++; });" +
      " return { composer: !!document.getElementById('postComposer'), cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " guest: document.querySelectorAll('[data-guest-like],[data-guest-repost],[data-guest-favorite],[data-guest-share]').length," +
      " staticHeart: staticHeart," +
      " ids: Array.prototype.map.call(feed.querySelectorAll('[data-cloud-id]'), function (el) { return el.getAttribute('data-cloud-id'); }).join('|') }; })()");
    check('C1 recommend=composer + 2 云卡 + 零演示签名零死爱心', c1 && c1.composer && c1.cloud === 2 && c1.guest === 0 && c1.staticHeart === 0 && c1.ids === 'PST-000101|PST-000102', JSON.stringify(c1));

    // C2 following=2 真关注帖 + 零 composer + 药丸激活
    await t.evalJs("document.querySelector('[data-tab=\"following\"]').click()");
    await sleep(300);
    const c2 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { composer: !!document.getElementById('postComposer'), cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " ids: Array.prototype.map.call(feed.querySelectorAll('[data-cloud-id]'), function (el) { return el.getAttribute('data-cloud-id'); }).join('|')," +
      " active: (document.querySelector('[data-tab=\"following\"]') || {}).className || '' }; })()");
    check('C2 following=2 真关注帖 + 零 composer + 药丸激活', c2 && !c2.composer && c2.cloud === 2 && c2.ids === 'PST-000201|PST-000202' && c2.active.indexOf('active') !== -1, JSON.stringify(c2));

    // C3 topic=2 真话题卡（成员计数+响应序）+ 零 composer 零云帖卡
    await t.evalJs("document.querySelector('[data-tab=\"topic\"]').click()");
    await sleep(300);
    const c3 = await t.evalJs("(() => { var feed = document.getElementById('feedContent'); var tx = feed.textContent;" +
      " return { composer: !!document.getElementById('postComposer'), cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " members: tx.indexOf('成员') !== -1," +
      " orderOk: tx.indexOf('国徽设计讨论') !== -1 && tx.indexOf('宪法草案') !== -1 && tx.indexOf('国徽设计讨论') < tx.indexOf('宪法草案') }; })()");
    check('C3 topic=2 真话题卡 + 成员计数 + 响应序 + 零 composer 零云帖卡', c3 && !c3.composer && c3.cloud === 0 && c3.members && c3.orderOk, JSON.stringify(c3));

    // C3d/C3t/C3c 发现中心：topics 响应序 + 热门 memberCount 降序 + channels 空态
    await t.evalJs("document.querySelector('[data-dtab=\"topics\"]').click()");
    await sleep(200);
    const c3d = await t.evalJs("(() => { var d = document.getElementById('discoveryList');" +
      " return { rows: d.children.length, first: d.textContent.indexOf('国徽设计讨论') === 0 }; })()");
    check('C3d 发现中心 topics=2 真行（响应序首=国徽设计讨论）', c3d && c3d.rows === 2 && c3d.first, JSON.stringify(c3d));
    const c3t = await t.evalJs("(() => { var tr = document.getElementById('trendingList');" +
      " return { rows: tr.children.length," +
      " first: tr.children[0] ? tr.children[0].textContent.indexOf('宪法草案') !== -1 : false," +
      " second: tr.children[1] ? tr.children[1].textContent.indexOf('国徽设计讨论') !== -1 : false }; })()");
    check('C3t 热门 memberCount 降序（12 的宪法草案在前）', c3t && c3t.rows === 2 && c3t.first && c3t.second, JSON.stringify(c3t));
    await t.evalJs("document.querySelector('[data-dtab=\"channels\"]').click()");
    await sleep(200);
    const c3c = await t.evalJs("document.getElementById('discoveryList').textContent.indexOf('频道功能即将上线') !== -1");
    check('C3c channels tab 空态（真数据零频道）', c3c === true);

    // C4 空 feed：recommend=composer+通用空态卡；following=专属空态零 composer（绝不回退假数据）
    await t.evalJs("localStorage.setItem('__mn_empty_feed', '1')");
    await t.send('Page.reload');
    await sleep(1500);
    await waitFor(t, "document.getElementById('feedContent').textContent.indexOf('这里还没有帖子') !== -1", 15000, 'recommend 空态');
    const c4 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { composer: !!document.getElementById('postComposer'), cloud: feed.querySelectorAll('[data-cloud-id]').length, cards: feed.querySelectorAll('.card').length }; })()");
    check('C4 recommend 空表=composer + 空态卡（零演示卡补位）', c4 && c4.composer && c4.cloud === 0 && c4.cards === 2, JSON.stringify(c4));
    await t.evalJs("document.querySelector('[data-tab=\"following\"]').click()");
    await sleep(300);
    const c4b = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { composer: !!document.getElementById('postComposer'), cloud: feed.querySelectorAll('[data-cloud-id]').length, text: feed.textContent }; })()");
    check('C4b following 空表=专属空态（关注一些用户后）零 composer', c4b && !c4b.composer && c4b.cloud === 0 && c4b.text.indexOf('关注一些用户后') !== -1, c4b.text.slice(0, 40));
    await t.evalJs("localStorage.removeItem('__mn_empty_feed')");

    // C5 空 topics：topic 空态+建话题 CTA 链 + 发现中心/热门双空态
    await t.evalJs("localStorage.setItem('__mn_empty_topics', '1')");
    await t.send('Page.reload');
    await sleep(1500);
    await waitFor(t, "document.querySelectorAll('[data-cloud-id]').length >= 2", 15000, 'recommend 恢复云卡');
    await t.evalJs("document.querySelector('[data-tab=\"topic\"]').click()");
    await sleep(300);
    const c5 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " var a = feed.querySelector('a');" +
      " return { text: feed.textContent, cta: a ? a.getAttribute('href') : null, cloud: feed.querySelectorAll('[data-cloud-id]').length }; })()");
    check('C5 topic 空表=空态 + 建话题 CTA 链', c5 && c5.text.indexOf('还没有话题') !== -1 && c5.cta === 'create-topic-step-1.html' && c5.cloud === 0, JSON.stringify(c5));
    await t.evalJs("document.querySelector('[data-dtab=\"topics\"]').click()");
    await sleep(200);
    const c5d = await t.evalJs("document.getElementById('discoveryList').textContent.indexOf('还没有话题') !== -1");
    const c5t = await t.evalJs("document.getElementById('trendingList').textContent.indexOf('还没有话题') !== -1");
    check('C5d 发现中心+热门空表=双空态', c5d === true && c5t === true, 'd=' + c5d + ' t=' + c5t);
    await t.evalJs("localStorage.removeItem('__mn_empty_topics')");

    // C6 401 整流：feed 401→mn:unauthorized→清态回登录引导卡（零云卡零演示）
    await seedUser(t);
    await t.evalJs("localStorage.setItem('__mn_force_401', '1')");
    await t.send('Page.reload');
    await sleep(1500);
    await waitFor(t, "document.getElementById('hubLoginCard')", 15000, '401 整流登录引导卡');
    const c6 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { loginCard: !!document.getElementById('hubLoginCard'), cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " guest: document.querySelectorAll('[data-guest-like],[data-guest-repost],[data-guest-favorite],[data-guest-share]').length }; })()");
    check('C6 401 整流（feed 401→mn:unauthorized）→ 登录引导卡零云卡', c6 && c6.loginCard && c6.cloud === 0 && c6.guest === 0, JSON.stringify(c6));
    await t.evalJs("localStorage.removeItem('__mn_force_401')");

    // C7 probe 网络错误=离线卡（非登录卡——已登录但后端不可达不诱导去登录）
    await seedUser(t); // C6 的 401 清了会话
    await t.evalJs("localStorage.setItem('__mn_probe_fail', '1')");
    await t.send('Page.reload');
    await sleep(1500);
    await waitFor(t, "document.getElementById('hubOfflineCard')", 15000, '离线卡');
    const c7 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { offline: !!document.getElementById('hubOfflineCard'), loginCard: !!document.getElementById('hubLoginCard')," +
      " cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " text: (document.getElementById('hubOfflineCard') || {}).textContent || '' }; })()");
    check('C7 probe 网络错误=离线卡（非登录卡）零云卡', c7 && c7.offline && !c7.loginCard && c7.cloud === 0 && c7.text.indexOf('无法连接服务器') !== -1, JSON.stringify(c7));
    await t.evalJs("localStorage.removeItem('__mn_probe_fail')");

    check('C8 全程 0 console 错误（云模式段）', errs.length === 0, errs.slice(0, 2).join(' | '));
  }

  // ──────────────────────────────────────────────
  // 线上：访客面（真站点零种子）
  // ──────────────────────────────────────────────
  async function runLive(t) {
    console.log('── L. 线上访客面（真站点）──');
    await nav(t, BASE + '/pages/community-hub.html');
    await waitFor(t, "document.getElementById('hubLoginCard')", 30000, '访客登录引导卡');
    await sleep(500);
    const l1 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { ver: window.MN_SITE_VERSION, loginCard: !!document.getElementById('hubLoginCard')," +
      " cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " guest: document.querySelectorAll('[data-guest-like],[data-guest-repost],[data-guest-favorite],[data-guest-share]').length," +
      " composer: !!document.getElementById('postComposer')," +
      " disc: document.getElementById('discoveryList').textContent.indexOf('登录后探索话题与频道') !== -1 }; })()");
    check('L1 版本 v0.2.58.26', l1.ver === 'v0.2.58.26', 'ver=' + l1.ver);
    check('L1 访客=登录引导卡 + 零云卡零演示签名零 composer + 发现引导行', l1 && l1.loginCard && l1.cloud === 0 && l1.guest === 0 && !l1.composer && l1.disc, JSON.stringify(l1));
    await t.evalJs("document.querySelector('[data-tab=\"topic\"]').click()");
    await sleep(200);
    const l2 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { loginCard: !!document.getElementById('hubLoginCard'), cloud: feed.querySelectorAll('[data-cloud-id]').length }; })()");
    check('L2 访客切 topic tab 恒登录引导卡', l2 && l2.loginCard && l2.cloud === 0, JSON.stringify(l2));
    check('L3 全程 0 console 错误', errs.length === 0, errs.slice(0, 2).join(' | '));
  }
}

main().catch(e => { console.error('电池异常:', e.message); process.exit(2); });
