// tmp-battery-community-post.js — v0.2.58.24 Community 头像/点赞/评论 + 独立帖页电池（2026-09-30；2026-09-05 起）
// 用户：「那个为什么没有头像，然后点赞按钮没有功能，评论也是，然后我希望做成点击帖子查看评论就是和Twitter一样的那种」→ 钦定独立帖子页。
// v0.2.58.24 演示样本全移除：本地 A 段 hub 面 seeded 仍走真云卡（罐头 /api/health 200 点 cloudMode，云卡断言不变）；
//   A1 demo 口径改「#feedContent 非云卡恰 1=composer 零演示卡」（页面另有 discovery 卡必须 feedContent 作用域）；
//   线上 L 段 hub 面=登录引导卡（fake-login /social/feed 401 整流零云卡），真帖断言改 Node 侧直取 /api/social/posts 首个 id 导航帖页；
//   L3 点赞 401 → L4 评论 401 边界补 seedUser+reload（mn:unauthorized 清了 session）。
// 本地：静态壳 + document-start fetch 罐头（每次导航新文档生效——MN_API 底层走 fetch，罐头统一从 fetch 层拦；
//   /api/health 200 点亮 cloudMode、posts/单帖/评论/点赞/发评论全罐头；唯一真资源 = /uploads/UPL-DEMO01.jpg 1x1 PNG 供瓦片+灯箱）。
// 线上（LIVE_BASE）：只读侧断言（真帖渲染/头像/计数/整卡跳转/帖页渲染/评论列表/404）+ 点赞/评论 401 回滚链
//   ——无凭据不真写（localStorage 种子是纯客户端假登录，服务端无 cookie → 点赞 POST 401 → 乐观回滚 + toast「登录已过期」实测）。
// 跑法：node tmp-battery-community-post.js（LIVE_BASE=<完整站点 URL> 跑线上）
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

const POST_CONTENT = '电池帖子全文：这个世界正在书写它的宪法，公民们聚集在社区广场讨论每一个条款的措辞与标点。这个世界正在书写它的宪法，公民们聚集在社区广场讨论每一个条款的措辞与标点。这个世界正在书写它的宪法，公民们聚集在社区广场讨论每一个条款的措辞与标点。';
const AVATAR_URI = 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2228%22%20height%3D%2228%22%3E%3Ccircle%20cx%3D%2214%22%20cy%3D%2214%22%20r%3D%2214%22%20fill%3D%22%23464dd4%22%2F%3E%3C%2Fsvg%3E';

// document-start fetch 罐头（只在本地模式挂，线上走真后端）
const DOC_START_SRC = `
(function () {
  var POST = {
    id: 'PST-000101', authorName: '电池作者', avatarUrl: ${JSON.stringify(AVATAR_URI)},
    content: ${JSON.stringify(POST_CONTENT)}, createdAt: '2026-09-05T08:00:00.000Z',
    likeCount: 3, commentCount: 5, likedByMe: false,
    media: ['/uploads/UPL-DEMO01.jpg']
  };
  var COMMENTS = [
    { id: 'CMT-000001', postId: 'PST-000101', parentId: null, authorName: 'CitizenA', avatarUrl: null, content: '第一条评论', createdAt: '2026-09-05T09:00:00.000Z' },
    { id: 'CMT-000002', postId: 'PST-000101', parentId: 'CMT-000001', authorName: 'CitizenB', avatarUrl: null, content: '回复第一条', createdAt: '2026-09-05T09:05:00.000Z' }
  ];
  window.__fetchCalls = [];
  function res(status, body) {
    return { status: status, ok: status >= 200 && status < 300, headers: { get: function () { return null; } }, json: function () { return Promise.resolve(body); } };
  }
  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf('/api/') !== -1) {
      var method = (opts && opts.method) || 'GET';
      var rawBody = (opts && opts.body != null) ? opts.body : null;
      window.__fetchCalls.push({ url: u, method: method, body: typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody == null ? null : rawBody) });
      var key = method + ' ' + u;
      if (key === 'GET /api/health') return Promise.resolve(res(200, { status: 'ok', version: '2.0.0', tables: 58 }));
      if (key === 'GET /api/social/posts') return Promise.resolve(res(200, { posts: [POST] }));
      if (key === 'GET /api/social/posts/PST-000101') return Promise.resolve(res(200, { post: POST }));
      if (key === 'GET /api/social/posts/PST-000101/comments') return Promise.resolve(res(200, { comments: COMMENTS }));
      if (key === 'POST /api/social/posts/PST-000101/like') { POST.likeCount = 4; POST.likedByMe = true; return Promise.resolve(res(200, { liked: true, likeCount: 4 })); }
      if (key === 'DELETE /api/social/posts/PST-000101/like') { POST.likeCount = 3; POST.likedByMe = false; return Promise.resolve(res(200, { liked: false, likeCount: 3 })); }
      if (key === 'POST /api/social/posts/PST-000101/comments') {
        var b = {}; try { b = JSON.parse(rawBody || '{}'); } catch (e) {}
        var c = { id: 'CMT-999999', postId: 'PST-000101', parentId: b.parentId || null, authorName: '电池用户', avatarUrl: null, content: '电池评论', status: 'visible', createdAt: new Date().toISOString() };
        return Promise.resolve(res(200, { comment: c, moderation: { verdict: 'pass' } }));
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

  async function bootHub() {
    await nav(t, BASE + '/pages/community-hub.html');
    await seedUser(t);
    await t.send('Page.reload');
    await sleep(800);
    if (LIVE) {
      await waitFor(t, "document.getElementById('hubLoginCard')", 30000, 'hub 登录引导卡');
    } else {
      await waitFor(t, "document.querySelectorAll('[data-cloud-id]').length >= 1", 20000, 'hub 云卡渲染');
    }
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
  // 本地：罐头全矩阵（成功路径点赞/评论全链路）
  // ──────────────────────────────────────────────
  async function runLocal(t) {
    console.log('── A. Hub 头像/计数/点赞/跳转（本地罐头）──');

    // A1 版本 + 云卡形态（头像 img/计数文本/data-cloud-id/post-card-click）+ 非云卡恰 1（composer，零演示卡）
    const ver = await t.evalJs('window.MN_SITE_VERSION');
    const a1 = await t.evalJs("(() => { var c = document.querySelector('[data-cloud-id]');" +
      " var like = c.querySelector('[data-like-post]');" +
      " return { id: c.getAttribute('data-cloud-id'), cls: c.className," +
      " hasAvatar: !!c.querySelector('img.avatar'), avatarSrc: (c.querySelector('img.avatar') || {}).src || ''," +
      " likeCount: like ? like.querySelector('[data-like-count]').textContent : null, pressed: like.getAttribute('aria-pressed')," +
      " text: c.textContent }; })()");
    const demoNoAttr = await t.evalJs("document.querySelectorAll('#feedContent .card:not([data-cloud-id])').length");
    check('A1 版本 v0.2.58.24', ver === 'v0.2.58.24', 'ver=' + ver);
    check('A1 云卡整卡跳转属性（data-cloud-id + post-card-click）', a1.id === 'PST-000101' && a1.cls.indexOf('post-card-click') !== -1, a1.id + ' / ' + a1.cls);
    check('A1 帖子卡真头像 img.avatar', a1.hasAvatar && a1.avatarSrc.indexOf('data:image/svg') === 0, a1.avatarSrc.slice(0, 40));
    check('A1 点赞钮真实计数 + 未点赞态', a1.likeCount === '3' && a1.pressed === 'false', a1.likeCount + ' / ' + a1.pressed);
    check('A1 评论数真实计数 5', a1.text.indexOf('5') !== -1, a1.text.slice(0, 60));
    check('A1 非云卡恰 1=composer（零演示卡）', demoNoAttr === 1, 'n=' + demoNoAttr);

    // A2 点赞链：POST → 乐观 +1 → 罐头真值；再点 → DELETE → 乐观 -1
    const likeSel = '[data-like-post="' + a1.id + '"]';
    await t.evalJs("document.querySelector('" + likeSel + "').click()");
    await sleep(300);
    const l1 = await t.evalJs("(() => { var b = document.querySelector('" + likeSel + "');" +
      " return { pressed: b.getAttribute('aria-pressed'), liked: b.classList.contains('liked'), count: b.querySelector('[data-like-count]').textContent }; })()");
    const call1 = await t.evalJs("window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/like') !== -1; }).length");
    check('A2 点赞 POST 乐观 +1（aria-pressed/liked 类/计数 4）', l1.pressed === 'true' && l1.liked && l1.count === '4', JSON.stringify(l1));
    check('A2 捕获 POST /social/posts/PST-000101/like', call1 >= 1, 'n=' + call1);
    await t.evalJs("document.querySelector('" + likeSel + "').click()");
    await sleep(300);
    const l2 = await t.evalJs("(() => { var b = document.querySelector('" + likeSel + "');" +
      " return { pressed: b.getAttribute('aria-pressed'), liked: b.classList.contains('liked'), count: b.querySelector('[data-like-count]').textContent }; })()");
    const call2 = await t.evalJs("window.__fetchCalls.filter(function (c) { return c.method === 'DELETE' && c.url.indexOf('/like') !== -1; }).length");
    check('A2 再点取消 DELETE 乐观 -1（回 false/计数 3）', l2.pressed === 'false' && !l2.liked && l2.count === '3', JSON.stringify(l2));
    check('A2 捕获 DELETE 同路径', call2 >= 1, 'n=' + call2);

    // A4 stopPropagation：举报旗点击不跳页；媒体瓦片点击开灯箱不跳页
    await t.evalJs("document.querySelector('[data-cloud-id] [data-cloud-post]').click()");
    await sleep(500);
    const afterFlag = await pathOf(t);
    check('A4 举报旗点击仍在 hub（不跳帖页）', afterFlag.indexOf('community-hub.html') !== -1, afterFlag);
    await t.evalJs("(function(){ var b = document.querySelector('.modal-backdrop.active'); if (b) b.click(); })()");
    await pressEsc(t);
    await sleep(200);
    await t.evalJs("document.querySelector('[data-cloud-id] .pm-tile').click()");
    await sleep(400);
    const lbOpen = await t.evalJs("!!document.querySelector('.modal-backdrop.active')");
    const afterTile = await pathOf(t);
    check('A4 媒体瓦片点击开灯箱且仍在 hub', lbOpen && afterTile.indexOf('community-hub.html') !== -1, afterTile);
    await pressEsc(t);

    // A3 整卡点击 → 真导航到独立帖页
    await t.evalJs("document.querySelector('[data-cloud-id] h4').click()");
    await waitFor(t, "window.location.pathname.indexOf('community-post.html') !== -1", 10000, '整卡跳转');
    const navPath = await pathOf(t);
    check('A3 整卡点击真导航到帖页（含 id 参数）', navPath.indexOf('/pages/community-post.html') !== -1 && navPath.indexOf('PST-000101') !== -1, navPath);

    console.log('── P. 独立帖页（本地罐头）──');
    await waitFor(t, "document.getElementById('postDetail').style.display === 'flex'", 10000, '帖页渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);

    // P1 渲染：返回链/头像/全文不截断/计数/媒体网格
    const p1 = await t.evalJs("(() => { var back = document.querySelector('.back-link');" +
      " var wrap = document.getElementById('postCardWrap');" +
      " return { backHref: back ? back.getAttribute('href') : null," +
      " hasAvatar: !!wrap.querySelector('img.avatar')," +
      " content: (wrap.querySelector('.post-content') || {}).textContent || ''," +
      " likeCount: (wrap.querySelector('[data-like-count]') || {}).textContent || null," +
      " tiles: wrap.querySelectorAll('.pm-tile').length }; })()");
    check('P1 返回链 href 回 hub', p1.backHref === 'community-hub.html', p1.backHref);
    check('P1 帖子卡头像渲染', p1.hasAvatar, '');
    check('P1 全文不截断（全量显示）', p1.content === POST_CONTENT, 'len=' + p1.content.length);
    check('P1 点赞计数渲染 3', p1.likeCount === '3', p1.likeCount);
    check('P1 媒体网格渲染 1 瓦片', p1.tiles === 1, 'n=' + p1.tiles);

    // P2 评论：顶层 + 缩进回复 + 回复钮
    const p2 = await t.evalJs("(() => { var items = document.querySelectorAll('#commentsList .comment-item');" +
      " var replies = document.querySelectorAll('#commentsList .comment-item.reply');" +
      " var rbtns = document.querySelectorAll('#commentsList [data-reply-id]');" +
      " var r0 = replies[0];" +
      " return { n: items.length, nr: replies.length, rbtn: rbtns.length," +
      " firstReplyParent: r0 && r0.querySelector('[data-reply-id]') ? r0.querySelector('[data-reply-id]').getAttribute('data-reply-id') : null," +
      " text: document.getElementById('commentsList').textContent }; })()");
    check('P2 评论列表 2 条（顶层+回复）', p2.n === 2, 'n=' + p2.n);
    check('P2 回复缩进类 reply + 回复挂父评论', p2.nr === 1 && p2.firstReplyParent === 'CMT-000002', p2.firstReplyParent);
    check('P2 每条评论有回复钮', p2.rbtn === 2, 'n=' + p2.rbtn);
    check('P2 评论文本渲染', p2.text.indexOf('第一条评论') !== -1 && p2.text.indexOf('回复第一条') !== -1, p2.text.slice(0, 60));

    // P7 灯箱：点瓦片开 → Escape 关
    await t.evalJs("document.querySelector('#postCardWrap .pm-tile').click()");
    await sleep(400);
    const lb7 = await t.evalJs("!!document.querySelector('.modal-backdrop.active')");
    await pressEsc(t);
    const lb7b = await t.evalJs("!!document.querySelector('.modal-backdrop.active')");
    check('P7 灯箱点开 + Escape 关闭', lb7 && !lb7b, lb7 + ' → ' + lb7b);

    // P3 页内点赞捕获
    await t.evalJs("document.querySelector('#postCardWrap [data-like-post]').click()");
    await sleep(300);
    const p3 = await t.evalJs("(() => { var b = document.querySelector('#postCardWrap [data-like-post]');" +
      " return { pressed: b.getAttribute('aria-pressed'), count: b.querySelector('[data-like-count]').textContent," +
      " postCalls: window.__fetchCalls.filter(function (c) { return c.method === 'POST' && c.url.indexOf('/like') !== -1; }).length }; })()");
    check('P3 页内点赞：POST 捕获 + 计数 4 + 已赞态', p3.postCalls >= 1 && p3.count === '4' && p3.pressed === 'true', JSON.stringify(p3));

    // P4 评论提交：载荷捕获 + 追加 + 清空 + toast
    await t.evalJs("document.getElementById('commentInput').value = '电池评论输入'; document.getElementById('commentSubmit').click()");
    await sleep(500);
    const p4 = await t.evalJs("(() => { var last = window.__fetchCalls.filter(function (c) { return c.url.indexOf('/comments') !== -1 && c.method === 'POST'; }).pop();" +
      " var b = last ? JSON.parse(last.body) : null;" +
      " return { body: b, listHas: document.getElementById('commentsList').textContent.indexOf('电池评论') !== -1," +
      " items: document.querySelectorAll('#commentsList .comment-item').length, cleared: document.getElementById('commentInput').value === ''," +
      " toasts: window.__toasts.join('|') }; })()");
    check('P4 提交载荷 {content, parentId:null}', p4.body && p4.body.content === '电池评论输入' && p4.body.parentId === null, JSON.stringify(p4.body));
    check('P4 评论追加 + 输入清空 + toast 评论成功', p4.listHas && p4.items === 3 && p4.cleared && p4.toasts.indexOf('评论成功') !== -1, p4.toasts.slice(0, 50));

    // P4 回复链：点回复钮 → chip 显名 → 提交带 parentId → chip 复位
    await t.evalJs("document.querySelectorAll('#commentsList [data-reply-id]')[0].click()");
    await sleep(200);
    const chip = await t.evalJs("(() => { var c = document.getElementById('replyChip');" +
      " return { vis: c.style.display, name: document.getElementById('replyChipName').textContent }; })()");
    check('P4 点回复 → replyChip 显名 @CitizenA', chip.vis === 'flex' && chip.name === 'CitizenA', JSON.stringify(chip));
    await t.evalJs("document.getElementById('commentInput').value = '电池回复'; document.getElementById('commentSubmit').click()");
    await sleep(500);
    const p4r = await t.evalJs("(() => { var last = window.__fetchCalls.filter(function (c) { return c.url.indexOf('/comments') !== -1 && c.method === 'POST'; }).pop();" +
      " var b = last ? JSON.parse(last.body) : null;" +
      " return { body: b, chipVis: document.getElementById('replyChip').style.display, items: document.querySelectorAll('#commentsList .comment-item').length }; })()");
    check('P4 回复载荷带 parentId=CMT-000001 + chip 复位 + 追加', p4r.body && p4r.body.parentId === 'CMT-000001' && p4r.chipVis === 'none' && p4r.items === 4, JSON.stringify(p4r.body));

    // P5 访客态：清本地账号 → 重载 → guestPrompt 可见 + composer 藏 + next 回跳含帖页
    await clearUser(t);
    await t.send('Page.reload');
    await sleep(1500);
    await waitFor(t, "document.getElementById('postDetail').style.display === 'flex'", 10000, '访客重载渲染');
    const p5 = await t.evalJs("(() => { var gp = document.getElementById('guestPrompt'); var cb = document.getElementById('commentComposerBox');" +
      " return { gp: gp.style.display, cb: cb.style.display, link: gp.querySelector('a') ? gp.querySelector('a').getAttribute('href') : null }; })()");
    check('P5 访客：guestPrompt 可见 + composer 藏 + 登录链带帖页回跳', p5.gp === 'block' && p5.cb === 'none' && p5.link && p5.link.indexOf('community-post.html') !== -1, p5.link);

    // P6 404 态
    await nav(t, BASE + '/pages/community-post.html?id=PST-999999');
    await sleep(1200);
    const p6 = await t.evalJs("(() => { var b = document.getElementById('postState404'); var d = document.getElementById('postDetail');" +
      " return { s404: b.style.display, detail: d.style.display, text: b.querySelector('p').textContent }; })()");
    check('P6 404 态：提示可见 + 详情藏 + 文案', p6.s404 === 'block' && p6.detail === 'none' && p6.text.length > 0, p6.text);

    check('P8 全程 0 console error', errs.length === 0, errs.slice(0, 3).join(' | '));
  }

  // ──────────────────────────────────────────────
  // 线上：只读侧 + 401 回滚链（无凭据不真写）
  // ──────────────────────────────────────────────
  async function runLive(t) {
    console.log('── L. 线上只读侧 + 401 回滚链 ──');

    // L1 hub 访客面：boot 401 整流终态=登录引导卡（零云卡零演示）+ 版本
    const l1 = await t.evalJs("(() => { return { ver: window.MN_SITE_VERSION," +
      " loginCard: !!document.getElementById('hubLoginCard')," +
      " cloud: document.querySelectorAll('[data-cloud-id]').length," +
      " guest: document.querySelectorAll('[data-guest-like],[data-guest-repost],[data-guest-favorite],[data-guest-share]').length }; })()");
    check('L1 版本 v0.2.58.24', l1.ver === 'v0.2.58.24', 'ver=' + l1.ver);
    check('L1 登录引导卡在位 + 零云卡 + 零演示钮', l1.loginCard && l1.cloud === 0 && l1.guest === 0, JSON.stringify(l1));

    // 真帖 id：Node 侧直取线上帖表（hub 面已无云卡可点，帖页断言改直导航）
    let livePostId = null;
    try {
      const pr = await fetch(LIVE + '/api/social/posts');
      const pj = await pr.json();
      if (pj && Array.isArray(pj.posts) && pj.posts.length) livePostId = pj.posts[0].id;
    } catch (e) {}
    if (!livePostId) {
      check('⏭ L2-L5 跳过：线上无帖', true, '');
      await nav(t, BASE + '/pages/community-post.html?id=PST-999999999');
      await sleep(1500);
      const l6 = await t.evalJs("(() => { var b = document.getElementById('postState404'); var d = document.getElementById('postDetail');" +
        " return { s404: b.style.display, detail: d.style.display, text: b.querySelector('p').textContent }; })()");
      check('L6 404 态：提示可见 + 详情藏', l6.s404 === 'block' && l6.detail === 'none' && l6.text.length > 0, l6.text);
      check('L8 全程 0 console error', errs.length === 0, errs.slice(0, 3).join(' | '));
      return;
    }

    // L2 真帖：直接导航帖页 → 渲染断言（返回链/头像/全文/计数/评论列表）
    await nav(t, BASE + '/pages/community-post.html?id=' + encodeURIComponent(livePostId));
    await waitFor(t, "(document.getElementById('postDetail').style.display === 'flex') || (document.getElementById('postState404').style.display === 'block')", 20000, '帖页渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);
    const l2 = await t.evalJs("(() => { var back = document.querySelector('.back-link'); var wrap = document.getElementById('postCardWrap');" +
      " var s404 = document.getElementById('postState404').style.display;" +
      " return { s404: s404, backHref: back ? back.getAttribute('href') : null," +
      " hasAvatar: !!wrap.querySelector('img.avatar')," +
      " contentLen: (wrap.querySelector('.post-content') || {}).textContent ? wrap.querySelector('.post-content').textContent.length : 0," +
      " likeCount: (wrap.querySelector('[data-like-count]') || {}).textContent || null," +
      " tiles: wrap.querySelectorAll('.pm-tile').length," +
      " commentsRendered: document.getElementById('commentsList').textContent.length > 0 }; })()");
    check('L2 真帖渲染：返回链 + 头像 + 全文 + 计数 + 评论列表', l2.s404 === 'none' && l2.backHref === 'community-hub.html' && l2.hasAvatar && l2.contentLen > 0 && /^\d+$/.test(l2.likeCount) && l2.commentsRendered, 'len=' + l2.contentLen + ' likes=' + l2.likeCount);

    // L3 点赞 401 回滚链：点击 → 服务端 401 → 乐观回滚 + toast「登录已过期」→ 边界补 seedUser+reload
    await t.evalJs("document.querySelector('#postCardWrap [data-like-post]').click()");
    await sleep(800);
    const l3 = await t.evalJs("(() => { var b = document.querySelector('#postCardWrap [data-like-post]');" +
      " return { pressed: b.getAttribute('aria-pressed'), liked: b.classList.contains('liked')," +
      " count: b.querySelector('[data-like-count]').textContent, toasts: window.__toasts.join('|') }; })()");
    check('L3 401 回滚：计数复原 + 未赞态 + toast 登录已过期', l3.count === l2.likeCount && l3.pressed === 'false' && !l3.liked && l3.toasts.indexOf('登录已过期') !== -1, JSON.stringify(l3));
    await seedUser(t); // unauthorized 清了 session，重种
    await t.send('Page.reload');
    await sleep(1500);
    await waitFor(t, "document.getElementById('postDetail').style.display === 'flex'", 20000, '重种后帖页渲染');
    await patchToast(t);

    // L4 评论提交 401（真后端无 cookie → 拦截 toast）
    await t.evalJs("document.getElementById('commentInput').value = '线上电池评论'; document.getElementById('commentSubmit').click()");
    await sleep(800);
    const l4 = await t.evalJs("window.__toasts.join('|')");
    check('L4 评论提交 401 → toast 登录已过期', l4.indexOf('登录已过期') !== -1, l4.slice(0, 60));

    // L7 灯箱（有媒体才测；无媒体跳过）
    if (l2.tiles > 0) {
      await t.evalJs("document.querySelector('#postCardWrap .pm-tile').click()");
      await sleep(400);
      const o = await t.evalJs("!!document.querySelector('.modal-backdrop.active')");
      await pressEsc(t);
      const c2 = await t.evalJs("!!document.querySelector('.modal-backdrop.active')");
      check('L7 真媒体灯箱开 + Escape 关', o && !c2, o + ' → ' + c2);
    } else {
      check('L7 无媒体帖跳过灯箱（真数据无附件）', true, 'tiles=0');
    }

    // L5 访客态（真访客：清两键 → 重载）
    await clearUser(t);
    await t.send('Page.reload');
    await sleep(1800);
    await waitFor(t, "(document.getElementById('postDetail').style.display === 'flex') || (document.getElementById('postState404').style.display === 'block')", 20000, '访客重载渲染');
    const l5 = await t.evalJs("(() => { var gp = document.getElementById('guestPrompt'); var cb = document.getElementById('commentComposerBox');" +
      " return { gp: gp.style.display, cb: cb.style.display, link: gp.querySelector('a') ? gp.querySelector('a').getAttribute('href') : null }; })()");
    check('L5 访客：guestPrompt 可见 + composer 藏 + 回跳链含帖页', l5.gp === 'block' && l5.cb === 'none' && l5.link && l5.link.indexOf('community-post.html') !== -1, l5.link);

    // L6 404 态（真后端 404）
    await nav(t, BASE + '/pages/community-post.html?id=PST-999999999');
    await sleep(1500);
    const l6 = await t.evalJs("(() => { var b = document.getElementById('postState404'); var d = document.getElementById('postDetail');" +
      " return { s404: b.style.display, detail: d.style.display, text: b.querySelector('p').textContent }; })()");
    check('L6 404 态：提示可见 + 详情藏', l6.s404 === 'block' && l6.detail === 'none' && l6.text.length > 0, l6.text);

    check('L8 全程 0 console error', errs.length === 0, errs.slice(0, 3).join(' | '));
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
