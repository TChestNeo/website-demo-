// tmp-battery-community-repost.js — v0.2.18.0 Community 转发 + 分享电池（2026-09-05）
// 用户：「能不能在帖子的评论后面那边再添加转发按钮和分享按钮？」→ 钦定真转发（转发即发帖，Twitter 式）。
// 本地：静态壳 + document-start fetch 罐头（feed 四卡：普通/转发/裸转发/原帖已删；转发 POST/DELETE 有状态翻转
//   + __repostBodies 捕获载荷 + __force409/__shareMode/__clipFail 开关；分享桩 navigator.share/clipboard/
//   execCommand 三档兜底链全捕获；唯一真资源 = /uploads/UPL-DEMO01.jpg 1x1 PNG）。
// 线上（LIVE_BASE）：真帖页按钮在场 + 转发 401 回滚链（假登录开框 → 真后端 401 → toast 登录已过期）
//   + 真访客转发拦截 toast + 分享 toast 必达（链接已复制 OR 复制失败）+ 404。
// 跑法：node tmp-battery-community-repost.js（LIVE_BASE=<完整站点 URL> 跑线上）
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

// 1x1 真 PNG（媒体瓦片/灯箱用真图，防 404 图片日志污染 0-console-error 断言）
const PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

// 原帖全文 250+ 字（嵌入盒截 200 字断言用：转发行内嵌原帖必截断）
const ORIG_CONTENT = '电池原帖全文：这个世界正在书写它的宪法，公民们聚集在社区广场讨论每一个条款的措辞与标点。议会大厅的钟声敲响了新的一天，外交官们在走廊里交换着来自邻国的问候。这个世界正在书写它的宪法，公民们聚集在社区广场讨论每一个条款的措辞与标点。议会大厅的钟声敲响了新的一天，外交官们在走廊里交换着来自邻国的问候。宪法委员会宣布进入最终审读阶段。贸易部长签署了与南方邻国的第一份海运协定，港口灯火通明，庆祝的焰火在夜空中绽放，新闻记者们从各地赶来记录这个年轻国家的外交时刻。';
const AVATAR_URI = 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2228%22%20height%3D%2228%22%3E%3Ccircle%20cx%3D%2214%22%20cy%3D%2214%22%20r%3D%2214%22%20fill%3D%22%23464dd4%22%2F%3E%3C%2Fsvg%3E';

// document-start fetch 罐头（只在本地模式挂，线上走真后端）
const DOC_START_SRC = `
(function () {
  window.__fetchCalls = []; window.__repostBodies = []; window.__copied = []; window.__shared = []; window.__execCmd = [];
  window.__force409 = false; window.__shareMode = 'ok'; window.__clipFail = false;
  var ORIG = {
    id: 'PST-000101', authorName: '电池作者', avatarUrl: ${JSON.stringify(AVATAR_URI)},
    content: ${JSON.stringify(ORIG_CONTENT)}, createdAt: '2026-09-05T08:00:00.000Z',
    likeCount: 3, commentCount: 5, likedByMe: false,
    media: ['/uploads/UPL-DEMO01.jpg'],
    repostOfId: null, repostOf: null, repostCount: 2, repostedByMe: false
  };
  var ORIG_EMBED = {
    id: ORIG.id, authorName: ORIG.authorName, avatarUrl: ORIG.avatarUrl,
    content: ORIG.content, media: ORIG.media, createdAt: ORIG.createdAt, likeCount: 3, commentCount: 5
  };
  var REPOST = {
    id: 'PST-000102', authorName: '转发者Bob', avatarUrl: null,
    content: '这是一条转发语', createdAt: '2026-09-05T10:00:00.000Z',
    likeCount: 0, commentCount: 0, likedByMe: false,
    media: [],
    repostOfId: ORIG.id, repostOf: ORIG_EMBED, repostCount: 0, repostedByMe: false
  };
  var REPOST_BARE = {
    id: 'PST-000103', authorName: '转发者Carol', avatarUrl: null,
    content: '', createdAt: '2026-09-05T11:00:00.000Z',
    likeCount: 0, commentCount: 0, likedByMe: false,
    media: [],
    repostOfId: ORIG.id, repostOf: ORIG_EMBED, repostCount: 0, repostedByMe: false
  };
  var REPOST_GONE = {
    id: 'PST-000104', authorName: '转发者Dave', avatarUrl: null,
    content: '原帖没了', createdAt: '2026-09-05T12:00:00.000Z',
    likeCount: 0, commentCount: 0, likedByMe: false,
    media: [],
    repostOfId: 'PST-000888', repostOf: null, repostCount: 0, repostedByMe: false
  };
  var FEED = [REPOST_GONE, REPOST_BARE, REPOST, ORIG];
  var COMMENTS = [];
  function res(status, body) {
    return { status: status, ok: status >= 200 && status < 300, headers: { get: function () { return null; } }, json: function () { return Promise.resolve(body); } };
  }
  // 分享三档兜底链桩：share → clipboard → execCommand，全捕获
  Object.defineProperty(navigator, 'share', { configurable: true, value: function (d) {
    if (window.__shareMode === 'reject') return Promise.reject(new Error('share cancelled'));
    window.__shared.push({ title: d.title, url: d.url }); return Promise.resolve();
  } });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: function (t) {
    if (window.__clipFail) return Promise.reject(new Error('clipboard denied'));
    window.__copied.push(String(t)); return Promise.resolve();
  } } });
  document.execCommand = function (c) { window.__execCmd.push(String(c)); return true; };
  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf('/api/') !== -1) {
      var method = (opts && opts.method) || 'GET';
      var rawBody = (opts && opts.body != null) ? opts.body : null;
      window.__fetchCalls.push({ url: u, method: method, body: typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody == null ? null : rawBody) });
      var key = method + ' ' + u;
      if (key === 'GET /api/health') return Promise.resolve(res(200, { status: 'ok', version: '2.0.0', tables: 58 }));
      if (key === 'GET /api/social/posts') return Promise.resolve(res(200, { posts: FEED }));
      if (key === 'GET /api/social/posts/PST-000101') return Promise.resolve(res(200, { post: ORIG }));
      if (key === 'GET /api/social/posts/PST-000102') return Promise.resolve(res(200, { post: REPOST }));
      if (key === 'GET /api/social/posts/PST-000102/comments') return Promise.resolve(res(200, { comments: COMMENTS }));
      if (key === 'POST /api/social/posts/PST-000102/repost') {
        var b = {}; try { b = JSON.parse(rawBody || '{}'); } catch (e) {}
        window.__repostBodies.push(String(b.content == null ? '' : b.content));
        if (window.__force409) return Promise.resolve(res(409, { error: { code: 'CONFLICT', message: '你已经转发过这条帖子' } }));
        REPOST.repostCount = 1; REPOST.repostedByMe = true;
        return Promise.resolve(res(200, { post: REPOST, moderation: { verdict: 'pass', reasonCode: null }, repostCount: 1 }));
      }
      if (key === 'DELETE /api/social/posts/PST-000102/repost') {
        REPOST.repostCount = 0; REPOST.repostedByMe = false;
        return Promise.resolve(res(200, { reposted: false, repostCount: 0 }));
      }
      if (u.indexOf('/api/social/posts/PST-999999') === 0) return Promise.resolve(res(404, { error: '帖子不存在或已下架' }));
    }
    return realFetch(url, opts);
  };
})();
`;

// ── 静态壳（docs/ 原样；/api 全 404 → demo 模式零请求） ──
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
async function pressEsc(t) {
  await t.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await t.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await sleep(200);
}
async function seedUser(t) {
  await t.evalJs("localStorage.setItem('slati_session', JSON.stringify({ loggedIn: true, at: new Date().toISOString() }));" +
    "localStorage.setItem('slati_user', JSON.stringify({ id: 'USR-000101', name: '电池用户', avatarUrl: null }));");
}
async function clearUser(t) {
  await t.evalJs("localStorage.removeItem('slati_session'); localStorage.removeItem('slati_user');");
}
async function patchToast(t) {
  await t.evalJs("window.__toasts = []; if (window.MN_Report && window.MN_Report.toast) { var o = MN_Report.toast.bind(MN_Report); MN_Report.toast = function (m, e) { window.__toasts.push(String(m)); return o(m, e); }; }");
}
const pathOf = t => t.evalJs('window.location.pathname + window.location.search');

async function main() {
  const LIVE = process.env.LIVE_BASE || '';
  const BASE = LIVE || ('http://127.0.0.1:' + PORT);
  if (!LIVE) server.listen(PORT);
  let chromePath = null;
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
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

  async function bootHub() {
    await nav(t, BASE + '/pages/community-hub.html');
    await seedUser(t);
    await t.send('Page.reload');
    await sleep(800);
    await waitFor(t, "document.querySelectorAll('[data-cloud-id]').length >= 1", LIVE ? 30000 : 20000, 'hub 云卡渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);
  }

  await bootHub();
  if (LIVE) await runLive(t);
  else await runLocal(t);

  console.log('\n' + pass.length + ' ✅ / ' + fail.length + ' ❌');
  t.close();
  chrome.kill();
  process.exit(fail.length ? 1 : 0);

  // ──────────────────────────────────────────────
  // 本地：罐头全矩阵（转发卡三种形态 + 对话框/分享/撤销/409/访客）
  // ──────────────────────────────────────────────
  async function runLocal(t) {
    console.log('── H. Hub 转发卡形态（本地罐头）──');

    // H1 版本 + 四卡
    const ver = await t.evalJs('window.MN_SITE_VERSION');
    check('H1 版本 v0.2.18.0', ver === 'v0.2.18.0', 'ver=' + ver);
    const cardN = await t.evalJs("document.querySelectorAll('[data-cloud-id]').length");
    check('H1 feed 四卡渲染', cardN === 4, 'n=' + cardN);

    // H2 转发卡：徽章「转发了」badge-success + 内嵌盒（作者/截断正文/媒体）
    const h2 = await t.evalJs("(() => { var c = document.querySelector('[data-cloud-id=\"PST-000102\"]');" +
      " var badge = c.querySelector('.badge'); var emb = c.querySelector('.repost-embedded');" +
      " var text = emb ? emb.querySelector('.repost-embedded-text') : null;" +
      " return { badge: badge.textContent, badgeCls: badge.className," +
      " hasEmb: !!emb, author: emb ? emb.textContent.indexOf('电池作者') !== -1 : false," +
      " textLen: text ? text.textContent.length : 0, truncated: text ? text.textContent.slice(-1) === '…' : false," +
      " tiles: c.querySelectorAll('.repost-embedded .pm-tile').length }; })()");
    check('H2 转发卡徽章「转发了」+ badge-success', h2.badge === '转发了' && h2.badgeCls.indexOf('badge-success') !== -1, h2.badge + ' / ' + h2.badgeCls);
    check('H2 内嵌盒：作者 + 正文截 200 字 + 媒体 1 瓦片', h2.hasEmb && h2.author && h2.textLen === 201 && h2.truncated && h2.tiles === 1, 'len=' + h2.textLen + ' tiles=' + h2.tiles);
    check('H2 转发卡自带转发语 h4 渲染', (await t.evalJs("!!document.querySelector('[data-cloud-id=\"PST-000102\"] h4')")), '');

    // H3 裸转发卡：无 h4（title 条件渲染）+ 内嵌盒仍在
    const h3 = await t.evalJs("(() => { var c = document.querySelector('[data-cloud-id=\"PST-000103\"]');" +
      " return { h4: c.querySelectorAll('h4').length, hasEmb: !!c.querySelector('.repost-embedded')," +
      " badge: c.querySelector('.badge').textContent }; })()");
    check('H3 裸转发卡无空 h4 + 内嵌盒 + 转发了徽章', h3.h4 === 0 && h3.hasEmb && h3.badge === '转发了', JSON.stringify(h3));

    // H4 原帖已删占位卡
    const h4 = await t.evalJs("(() => { var c = document.querySelector('[data-cloud-id=\"PST-000104\"]');" +
      " var gone = c.querySelector('.repost-embedded-gone');" +
      " return { gone: gone ? gone.textContent : null, hasEmb: !!c.querySelector('.repost-embedded') }; })()");
    check('H4 占位卡「原帖已删除或不可见」+ 无嵌入盒', h4.gone === '原帖已删除或不可见' && !h4.hasEmb, h4.gone);

    // H5 普通卡无转发痕迹
    const h5 = await t.evalJs("(() => { var c = document.querySelector('[data-cloud-id=\"PST-000101\"]');" +
      " return { badge: c.querySelector('.badge').textContent, emb: c.querySelectorAll('.repost-embedded, .repost-embedded-gone').length }; })()");
    check('H5 普通卡 Citizen Post 徽章 + 零转发痕迹', h5.badge === 'Citizen Post' && h5.emb === 0, JSON.stringify(h5));

    // H6 转发卡整卡点击 → 真导航到转发帖页
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000102\"] h4').click()");
    await waitFor(t, "window.location.pathname.indexOf('community-post.html') !== -1", 10000, '整卡跳转');
    const navPath = await pathOf(t);
    check('H6 转发卡整卡点击进帖页（含 id）', navPath.indexOf('/pages/community-post.html') !== -1 && navPath.indexOf('PST-000102') !== -1, navPath);

    console.log('── P. 转发帖页（本地罐头）──');
    await waitFor(t, "document.getElementById('postDetail').style.display === 'flex'", 10000, '帖页渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);

    // P1 转发帖页形态：转发头（repeat 图标+「转发了」）+ 转发语 + 嵌入盒 + 四钮操作行
    const p1 = await t.evalJs("(() => { var wrap = document.getElementById('postCardWrap');" +
      " var line = wrap.querySelector('.repost-line');" +
      " return { hasLine: !!line, lineText: line ? line.textContent : ''," +
      " hasRepeat: line ? !!line.querySelector('.material-symbols-outlined') : false," +
      " quote: (wrap.querySelector('.post-content') || {}).textContent || null," +
      " hasEmb: !!wrap.querySelector('.repost-embedded')," +
      " embTiles: wrap.querySelectorAll('.repost-embedded .pm-tile').length," +
      " hasRepost: !!wrap.querySelector('[data-repost-post]'), hasShare: !!wrap.querySelector('[data-share-post]')," +
      " repostCount: (wrap.querySelector('[data-repost-count]') || {}).textContent || null," +
      " repostPressed: wrap.querySelector('[data-repost-post]').getAttribute('aria-pressed') }; })()");
    check('P1 转发头：repeat 图标 + 头像 + 「转发者Bob 转发了」', p1.hasLine && p1.hasRepeat && p1.lineText.indexOf('转发了') !== -1 && p1.lineText.indexOf('转发者Bob') !== -1, p1.lineText);
    check('P1 转发语 .post-content 渲染', p1.quote === '这是一条转发语', p1.quote);
    check('P1 嵌入原帖盒 + 媒体 1 瓦片', p1.hasEmb && p1.embTiles === 1, 'tiles=' + p1.embTiles);
    check('P1 操作行转发/分享双钮 + 计数 0 + 未转发态', p1.hasRepost && p1.hasShare && p1.repostCount === '0' && p1.repostPressed === 'false', p1.repostCount + ' / ' + p1.repostPressed);

    // P2 点转发钮 → 对话框开（textarea maxlength 2000 + 取消/转发钮）
    await t.evalJs("document.querySelector('#postCardWrap [data-repost-post]').click()");
    await sleep(400);
    const p2 = await t.evalJs("(() => { var bg = document.querySelector('.modal-backdrop.active');" +
      " var ta = document.getElementById('repostInput');" +
      " return { open: !!bg, hasTa: !!ta, maxlen: ta ? ta.getAttribute('maxlength') : null," +
      " ph: ta ? ta.placeholder : null," +
      " hasCancel: !!document.getElementById('repostCancel'), hasSubmit: !!document.getElementById('repostSubmit') }; })()");
    check('P2 转发对话框开 + textarea maxlength 2000 + 双钮', p2.open && p2.hasTa && p2.maxlen === '2000' && p2.hasCancel && p2.hasSubmit, JSON.stringify(p2));

    // P3 三种关法：Escape → 再开 backdrop 点击关 → 再开取消钮关
    await pressEsc(t);
    const p3a = await t.evalJs("!document.querySelector('.modal-backdrop.active')");
    await t.evalJs("document.querySelector('#postCardWrap [data-repost-post]').click()");
    await sleep(400);
    await t.evalJs("(function(){ var b = document.querySelector('.modal-backdrop.active'); if (b) b.click(); })()");
    await sleep(200);
    const p3b = await t.evalJs("!document.querySelector('.modal-backdrop.active')");
    await t.evalJs("document.querySelector('#postCardWrap [data-repost-post]').click()");
    await sleep(400);
    await t.evalJs("document.getElementById('repostCancel').click()");
    await sleep(200);
    const p3c = await t.evalJs("!document.querySelector('.modal-backdrop.active')");
    check('P3 对话框 Escape / backdrop / 取消 三路关闭', p3a && p3b && p3c, p3a + '/' + p3b + '/' + p3c);

    // P4 提交转发语：POST 载荷捕获 + 按钮置位 + 计数 + toast + 框关
    await t.evalJs("document.querySelector('#postCardWrap [data-repost-post]').click()");
    await sleep(400);
    await t.evalJs("document.getElementById('repostInput').value = '电池转发语'; document.getElementById('repostSubmit').click()");
    await sleep(500);
    const p4 = await t.evalJs("(() => { var b = document.querySelector('#postCardWrap [data-repost-post]');" +
      " return { bodies: window.__repostBodies.join('|')," +
      " pressed: b.getAttribute('aria-pressed'), reposted: b.classList.contains('reposted')," +
      " count: b.querySelector('[data-repost-count]').textContent," +
      " open: !!document.querySelector('.modal-backdrop.active'), toasts: window.__toasts.join('|') }; })()");
    check('P4 POST 载荷 {content:电池转发语} 捕获', p4.bodies === '电池转发语', p4.bodies);
    check('P4 按钮置位（true/reposted/计数 1）+ toast 转发成功 + 框关', p4.pressed === 'true' && p4.reposted && p4.count === '1' && !p4.open && p4.toasts.indexOf('转发成功') !== -1, JSON.stringify(p4));

    // P5 再点（已转发）→ 撤销 DELETE 捕获 + 乐观回位
    await t.evalJs("document.querySelector('#postCardWrap [data-repost-post]').click()");
    await sleep(500);
    const p5 = await t.evalJs("(() => { var b = document.querySelector('#postCardWrap [data-repost-post]');" +
      " return { delCalls: window.__fetchCalls.filter(function (c) { return c.method === 'DELETE' && c.url.indexOf('/repost') !== -1; }).length," +
      " pressed: b.getAttribute('aria-pressed'), reposted: b.classList.contains('reposted')," +
      " count: b.querySelector('[data-repost-count]').textContent }; })()");
    check('P5 撤销：DELETE 捕获 + 回位（false/计数 0）', p5.delCalls >= 1 && p5.pressed === 'false' && !p5.reposted && p5.count === '0', JSON.stringify(p5));

    // P6 分享 ok 场景：navigator.share 捕获 {title,url} + 规范 URL 形状
    await t.evalJs("document.querySelector('#postCardWrap [data-share-post]').click()");
    await sleep(400);
    const p6 = await t.evalJs("(() => { var s = window.__shared[0] || {};" +
      " return { shared: window.__shared.length, title: s.title || '', url: s.url || '' }; })()");
    check('P6 分享走系统面板：share 捕获 title+url 规范形状', p6.shared === 1 && p6.title.length > 0 && p6.url.indexOf('/pages/community-post.html?id=PST-000102') !== -1, p6.url);

    // P7 分享 reject 场景：share 拒绝 → clipboard 兜底 + toast 链接已复制
    await t.evalJs("window.__shareMode = 'reject'");
    await t.evalJs("document.querySelector('#postCardWrap [data-share-post]').click()");
    await sleep(400);
    const p7 = await t.evalJs("(() => { return { copied: window.__copied.join('|'), toasts: window.__toasts.join('|') }; })()");
    check('P7 share 拒绝 → clipboard 兜底 + toast 链接已复制', p7.copied.indexOf('?id=PST-000102') !== -1 && p7.toasts.indexOf('链接已复制') !== -1, p7.copied.slice(0, 60));

    // P8 clipboard 也失败 → execCommand 兜底 + 同 toast
    await t.evalJs("window.__clipFail = true");
    await t.evalJs("document.querySelector('#postCardWrap [data-share-post]').click()");
    await sleep(400);
    const p8 = await t.evalJs("(() => { return { exec: window.__execCmd.join('|'), toasts: window.__toasts.join('|') }; })()");
    check('P8 clipboard 失败 → execCommand copy 兜底 + toast', p8.exec.indexOf('copy') !== -1 && p8.toasts.indexOf('链接已复制') !== -1, p8.exec);

    // P9 409 场景：__force409 → 提交 → toast 已转发过 + 按钮同步置位
    await t.evalJs("window.__shareMode = 'ok'; window.__clipFail = false; window.__force409 = true");
    await t.evalJs("document.querySelector('#postCardWrap [data-repost-post]').click()");
    await sleep(400);
    await t.evalJs("document.getElementById('repostInput').value = '再来一次'; document.getElementById('repostSubmit').click()");
    await sleep(500);
    const p9 = await t.evalJs("(() => { var b = document.querySelector('#postCardWrap [data-repost-post]');" +
      " return { pressed: b.getAttribute('aria-pressed'), reposted: b.classList.contains('reposted')," +
      " open: !!document.querySelector('.modal-backdrop.active'), toasts: window.__toasts.join('|') }; })()");
    check('P9 409：toast 已转发过 + 按钮同步置位 + 框关', p9.pressed === 'true' && p9.reposted && !p9.open && p9.toasts.indexOf('你已经转发过这条帖子') !== -1, JSON.stringify(p9));

    // P10 访客态：转发拦截 toast 不开框；分享仍可用
    await clearUser(t);
    await t.send('Page.reload');
    await sleep(1500);
    await waitFor(t, "document.getElementById('postDetail').style.display === 'flex'", 10000, '访客重载渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);
    await t.evalJs("document.querySelector('#postCardWrap [data-repost-post]').click()");
    await sleep(300);
    const p10a = await t.evalJs("(() => { return { open: !!document.querySelector('.modal-backdrop.active'), toasts: window.__toasts.join('|') }; })()");
    check('P10 访客点转发：toast 登录后才能转发 + 不开框', !p10a.open && p10a.toasts.indexOf('登录后才能转发') !== -1, p10a.toasts);
    await t.evalJs("document.querySelector('#postCardWrap [data-share-post]').click()");
    await sleep(400);
    const p10b = await t.evalJs("window.__shared.length");
    check('P10 访客分享可用（share 捕获）', p10b === 1, 'n=' + p10b);

    // P11 404 态
    await nav(t, BASE + '/pages/community-post.html?id=PST-999999');
    await sleep(1200);
    const p11 = await t.evalJs("(() => { var b = document.getElementById('postState404');" +
      " return { s404: b.style.display, detail: document.getElementById('postDetail').style.display }; })()");
    check('P11 404 态：提示可见 + 详情藏', p11.s404 === 'block' && p11.detail === 'none', JSON.stringify(p11));

    check('P12 全程 0 console error', errs.length === 0, errs.slice(0, 3).join(' | '));
  }

  // ──────────────────────────────────────────────
  // 线上：真帖页按钮在场 + 转发 401 回滚链 + 访客拦截 + 分享 toast 必达
  // ──────────────────────────────────────────────
  async function runLive(t) {
    console.log('── L. 线上只读侧 + 401 回滚链 ──');

    // L1 版本 + 云卡
    const l1 = await t.evalJs("(() => { var c = document.querySelector('[data-cloud-id]');" +
      " return { ver: window.MN_SITE_VERSION, id: c.getAttribute('data-cloud-id'), cls: c.className }; })()");
    check('L1 版本 v0.2.18.0', l1.ver === 'v0.2.18.0', 'ver=' + l1.ver);
    check('L1 云卡跳转属性 + 真 id', l1.cls.indexOf('post-card-click') !== -1 && /^PST-/.test(l1.id), l1.id);

    // L2 整卡点击 → 帖页 → 转发/分享双钮在场
    await t.evalJs("document.querySelector('[data-cloud-id] h4').click()");
    await waitFor(t, "window.location.pathname.indexOf('community-post.html') !== -1", 15000, '整卡跳转');
    await waitFor(t, "(document.getElementById('postDetail').style.display === 'flex') || (document.getElementById('postState404').style.display === 'block')", 20000, '帖页渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);
    const l2 = await t.evalJs("(() => { var wrap = document.getElementById('postCardWrap');" +
      " var s404 = document.getElementById('postState404').style.display;" +
      " return { s404: s404, repost: !!wrap.querySelector('[data-repost-post]')," +
      " share: !!wrap.querySelector('[data-share-post]')," +
      " count: (wrap.querySelector('[data-repost-count]') || {}).textContent || null," +
      " pressed: (wrap.querySelector('[data-repost-post]') || {}).getAttribute('aria-pressed') || null }; })()");
    check('L2 真帖页：转发/分享双钮在场 + 真计数 + 未转发态', l2.s404 === 'none' && l2.repost && l2.share && /^\d+$/.test(l2.count) && l2.pressed === 'false', JSON.stringify(l2));

    // L3 转发 401 链：假登录开框 → 真后端 401 → toast 登录已过期 + 框关 + 按钮未置位
    await t.evalJs("document.querySelector('#postCardWrap [data-repost-post]').click()");
    await sleep(400);
    await t.evalJs("document.getElementById('repostInput').value = '线上电池转发'; document.getElementById('repostSubmit').click()");
    await sleep(1200);
    const l3 = await t.evalJs("(() => { var b = document.querySelector('#postCardWrap [data-repost-post]');" +
      " return { pressed: b.getAttribute('aria-pressed'), reposted: b.classList.contains('reposted')," +
      " open: !!document.querySelector('.modal-backdrop.active'), toasts: window.__toasts.join('|') }; })()");
    check('L3 转发 401：toast 登录已过期 + 框关 + 按钮未置位', l3.pressed === 'false' && !l3.reposted && !l3.open && l3.toasts.indexOf('登录已过期') !== -1, JSON.stringify(l3));
    await seedUser(t);

    // L4 真访客：转发拦截 toast 不开框
    await clearUser(t);
    await t.send('Page.reload');
    await sleep(1800);
    await waitFor(t, "(document.getElementById('postDetail').style.display === 'flex') || (document.getElementById('postState404').style.display === 'block')", 20000, '访客重载渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);
    await t.evalJs("document.querySelector('#postCardWrap [data-repost-post]').click()");
    await sleep(300);
    const l4 = await t.evalJs("(() => { return { open: !!document.querySelector('.modal-backdrop.active'), toasts: window.__toasts.join('|') }; })()");
    check('L4 访客点转发：toast 登录后才能转发 + 不开框', !l4.open && l4.toasts.indexOf('登录后才能转发') !== -1, l4.toasts);

    // L5 分享 toast 必达（真环境 clipboard/share 权限不定 → 链接已复制 OR 复制失败都算链达）
    await t.evalJs("document.querySelector('#postCardWrap [data-share-post]').click()");
    await sleep(800);
    const l5 = await t.evalJs("window.__toasts.join('|')");
    check('L5 分享 toast 必达（复制成功/失败兜底）', l5.indexOf('链接已复制') !== -1 || l5.indexOf('复制失败') !== -1, l5.slice(0, 60));

    // L6 404 态（真后端 404）
    await nav(t, BASE + '/pages/community-post.html?id=PST-999999999');
    await sleep(1500);
    const l6 = await t.evalJs("(() => { var b = document.getElementById('postState404');" +
      " return { s404: b.style.display, detail: document.getElementById('postDetail').style.display }; })()");
    check('L6 404 态：提示可见 + 详情藏', l6.s404 === 'block' && l6.detail === 'none', JSON.stringify(l6));

    check('L7 全程 0 console error', errs.length === 0, errs.slice(0, 3).join(' | '));
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
