// tmp-battery-community-action-row.js — v0.2.20.4 操作行星+分享再靠拢 4px 电池（2026-09-07，v0.2.20.3 版改）
// 用户 v0.2.20.0：「把分享按钮的位置换成浏览量然后 把分享按钮放到最右边然后它的左侧再放一个星星作为收藏按钮 两个都不需要显示号码」
//   → v0.2.20.1 用户「我是说放到最右边不是这样」：星+分享左对齐挤在浏览量旁不合格——星钮 margin-left:auto 推到行最右缘。
//   → v0.2.20.2 用户「收藏和分享两个按钮的间距可以靠近些吗」：星钮 margin-right:-10px——星↔分享间隙 16px→6px，分享仍贴行右缘。
//   → v0.2.20.3 用户「让他更近8px」：margin-right:-18px——星↔分享间隙 6px→-2px（按钮盒重叠 2px，g5 -4~2px 断言），分享仍贴行右缘。
//   → v0.2.20.4 用户「再靠近4px」：margin-right:-22px——星↔分享间隙 -2px→-6px（按钮盒重叠 6px，g5 -8~-2px 断言），分享仍贴行右缘。
//   行序 [赞][评][转][浏览]…[☆收藏][⇧分享]：浏览（visibility 图标+数字）替代旧分享位；星收藏（star↔star_border+金色+FILL 轴）
//   与分享（upload 纯图标）顶贴行右缘（rightEdge ≤1px 几何断言：分享右缘=行右缘），两个都不显示号码；收藏是真功能开关。
// 历史轮回归保留：v0.2.19.2 分享弹窗可见性断言（opacity=1）/ v0.2.19.3 放大间距几何断言 / v0.2.19.1 转发免弹窗直转 / 粒子对齐。
// 本地：静态壳 + document-start fetch 罐头（feed 两卡：LIKED 已赞+已转+已收藏 / ORIG 未互动；like/repost/favorite POST/DELETE 有状态翻转 +
//   __forceRepostRemoved 测转发 removed 拦截分支 + __forceFavoriteFail 测收藏 500 回滚；粒子对齐/实心爱心回归 = v0.2.19.0 同款 CSSOM + 几何断言）。
// 线上（LIVE_BASE）：真卡六件齐 + 分享弹窗 URL 含帖 id + 转发/收藏假会话 401 回滚实测 + 访客演示卡引导 toast + 帖页实心态/星态一致。
// 跑法：node tmp-battery-community-action-row.js（LIVE_BASE=<完整站点 URL> 跑线上）
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
const DOC_START_SRC = `
(function () {
  window.__fetchCalls = []; window.__forceLikeFail = false; window.__forceRepostRemoved = false; window.__forceFavoriteFail = false;
  var ORIG = {
    id: 'PST-000101', authorName: '电池作者', avatarUrl: ${JSON.stringify(AVATAR_URI)},
    content: '电池原帖：这是一条用来点爱心点赞的帖子，点一下会变成实心爱心并且炸出彩色粒子。',
    createdAt: '2026-09-06T08:00:00.000Z',
    likeCount: 3, commentCount: 2, likedByMe: false,
    media: [],
    repostOfId: null, repostOf: null, repostCount: 0, repostedByMe: false,
    viewCount: 7, favoritedByMe: false
  };
  var LIKED = {
    id: 'PST-000102', authorName: '已赞作者', avatarUrl: null,
    content: '这条帖子初始化就是已点赞已转发状态，用来断言初始渲染不带动画类不重播、转发钮初始绿。',
    createdAt: '2026-09-06T09:00:00.000Z',
    likeCount: 5, commentCount: 0, likedByMe: true,
    media: [],
    repostOfId: null, repostOf: null, repostCount: 2, repostedByMe: true,
    viewCount: 12, favoritedByMe: true
  };
  var FEED = [LIKED, ORIG];
  function res(status, body) {
    return { status: status, ok: status >= 200 && status < 300, headers: { get: function () { return null; } }, json: function () { return Promise.resolve(body); } };
  }
  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf('/api/') !== -1) {
      var method = (opts && opts.method) || 'GET';
      window.__fetchCalls.push({ url: u, method: method });
      var key = method + ' ' + u;
      if (key === 'GET /api/health') return Promise.resolve(res(200, { status: 'ok', version: '2.0.0', tables: 58 }));
      if (key === 'GET /api/social/posts') return Promise.resolve(res(200, { posts: window.localStorage.getItem('__mn_empty_feed') === '1' ? [] : FEED }));
      if (key === 'GET /api/social/posts/PST-000101') return Promise.resolve(res(200, { post: ORIG }));
      if (key === 'GET /api/social/posts/PST-000102') return Promise.resolve(res(200, { post: LIKED }));
      if (key === 'GET /api/social/posts/PST-000101/comments') return Promise.resolve(res(200, { comments: [] }));
      if (key === 'GET /api/social/posts/PST-000102/comments') return Promise.resolve(res(200, { comments: [] }));
      if (key === 'POST /api/social/posts/PST-000101/like') {
        if (window.__forceLikeFail) return Promise.resolve(res(500, { error: 'boom' }));
        ORIG.likedByMe = true; ORIG.likeCount = 4;
        return Promise.resolve(res(200, { likeCount: ORIG.likeCount }));
      }
      if (key === 'DELETE /api/social/posts/PST-000101/like') {
        ORIG.likedByMe = false; ORIG.likeCount = 3;
        return Promise.resolve(res(200, { likeCount: ORIG.likeCount }));
      }
      if (key === 'POST /api/social/posts/PST-000101/repost') {
        if (window.__forceRepostRemoved) return Promise.resolve(res(200, { post: { status: 'removed' }, moderation: { verdict: 'pass' }, repostCount: 0 }));
        ORIG.repostedByMe = true; ORIG.repostCount = 1;
        return Promise.resolve(res(200, { post: { status: 'visible' }, moderation: { verdict: 'pass' }, repostCount: ORIG.repostCount }));
      }
      if (key === 'DELETE /api/social/posts/PST-000101/repost') {
        ORIG.repostedByMe = false; ORIG.repostCount = 0;
        return Promise.resolve(res(200, { repostCount: ORIG.repostCount }));
      }
      if (key === 'POST /api/social/posts/PST-000101/favorite') {
        if (window.__forceFavoriteFail) return Promise.resolve(res(500, { error: 'boom' }));
        ORIG.favoritedByMe = true;
        return Promise.resolve(res(200, { favorited: true }));
      }
      if (key === 'DELETE /api/social/posts/PST-000101/favorite') {
        ORIG.favoritedByMe = false;
        return Promise.resolve(res(200, { favorited: false }));
      }
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
// 假 clipboard：记录被复制的 URL、writeText 恒成功——本地确定性断言弹窗自动复制链
async function patchClipboard(t) {
  await t.evalJs("window.__copied = null; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: function (u) { window.__copied = String(u); return Promise.resolve(); } } });");
}
// 点赞钮瞬时态快照（aria/类/图标/粒子外壳/粒子子元素/动画名）——v0.2.19.0 动画挂 .like-fx
const likeStateExpr = sel => "(() => { var b = document.querySelector('" + sel + "'); if (!b) return null;" +
  " var icon = b.querySelector('.material-symbols-outlined'); var burst = b.querySelector('.like-burst');" +
  " var fx = burst ? burst.querySelector('.like-fx') : null;" +
  " return { pressed: b.getAttribute('aria-pressed'), liked: b.classList.contains('liked')," +
  " pop: b.classList.contains('like-pop'), icon: icon ? icon.textContent : null," +
  " iconAnim: icon ? getComputedStyle(icon).animationName : null," +
  " burstDisp: burst ? getComputedStyle(burst).display : null," +
  " fx: !!fx, fxAnim: fx ? getComputedStyle(fx).animationName : null," +
  " count: (b.querySelector('[data-like-count]') || {}).textContent || null }; })()";
// 转发钮快照
const repostStateExpr = sel => "(() => { var b = document.querySelector('" + sel + "'); if (!b) return null;" +
  " return { pressed: b.getAttribute('aria-pressed'), reposted: b.classList.contains('reposted')," +
  " count: (b.querySelector('[data-repost-count]') || {}).textContent || null }; })()";

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
  // 本地：罐头全矩阵（粒子对齐 + hub 转发/分享 + 分享弹窗 + 实心爱心）
  // ──────────────────────────────────────────────
  async function runLocal(t) {
    console.log('── A. Hub 粒子对齐 + 操作行（本地罐头）──');

    const ver = await t.evalJs('window.MN_SITE_VERSION');
    check('A1 版本 v0.2.20.4', ver === 'v0.2.20.4', 'ver=' + ver);
    const cardN = await t.evalJs("document.querySelectorAll('[data-cloud-id]').length");
    check('A1 feed 两卡渲染', cardN === 2, 'n=' + cardN);

    // CSSOM 直验（Chrome 把规则样式序列化为 rgb() + 长手写展开——按分项断言，不按原文串）
    const hcss = await t.evalJs("(() => { var out = {};" +
      " for (var i = 0; i < document.styleSheets.length; i++) { var rules;" +
      "   try { rules = document.styleSheets[i].cssRules; } catch (e) { continue; }" +
      "   for (var j = 0; j < rules.length; j++) { var r = rules[j];" +
      "     if (r.type === CSSRule.KEYFRAMES_RULE) {" +
      "       if (r.name === 'mn-fireworks-bang') out.bang = r.cssRules[0].style.boxShadow;" +
      "       if (r.name === 'mn-fireworks-gravity') out.gravity = r.cssRules[0].style.transform;" +
      "       if (r.name === 'mn-fireworks-position') out.posWindows = r.cssRules.length;" +
      "       if (r.name === 'like-pop-icon') out.iconPop = true;" +
      "     }" +
      "     if (r.type === CSSRule.STYLE_RULE) {" +
      "       if (r.selectorText === '.like-burst') out.burst = { left: r.style.left, top: r.style.top, right: r.style.right, width: r.style.width, height: r.style.height, transform: r.style.transform, display: r.style.display };" +
      "       if (r.selectorText === '.like-fx') out.fx = { left: r.style.left, top: r.style.top, width: r.style.width, height: r.style.height, radius: r.style.borderRadius, shadow: r.style.boxShadow };" +
      "       if (r.selectorText === '.post-action-btn.like-pop .like-fx') out.chain = r.style.animation;" +
      "     }" +
      "   } }" +
      " return out; })()");
    const bangDots = hcss && hcss.bang ? (hcss.bang.match(/-?\d+(\.\d+)?px -?\d+(\.\d+)?px/g) || []).length : 0;
    const hasC1 = hcss && hcss.bang && (hcss.bang.indexOf('#8800ff') !== -1 || hcss.bang.indexOf('rgb(136, 0, 255)') !== -1);
    const hasC2 = hcss && hcss.bang && (hcss.bang.indexOf('#0073ff') !== -1 || hcss.bang.indexOf('rgb(0, 115, 255)') !== -1);
    const chain = hcss && hcss.chain ? hcss.chain.split(', ') : [];
    const chainOk = chain.length === 3 &&
      chain[0].indexOf('1.25s') !== -1 && chain[0].indexOf('ease-out') !== -1 && chain[0].indexOf('mn-fireworks-bang') !== -1 &&
      chain[1].indexOf('1.25s') !== -1 && chain[1].indexOf('ease-in') !== -1 && chain[1].indexOf('mn-fireworks-gravity') !== -1 &&
      chain[2].indexOf('6.25s') !== -1 && chain[2].indexOf('linear') !== -1 && chain[2].indexOf('mn-fireworks-position') !== -1;
    check('A2 .like-burst = 0×0 居中锚点（left/top 50% + 常量 scale(0.4)，无 right 无宽高——对齐修复本体）',
      !!hcss && !!hcss.burst && hcss.burst.left === '50%' && hcss.burst.top === '50%' &&
      hcss.burst.transform.indexOf('scale(0.4)') !== -1 && hcss.burst.right === '' && hcss.burst.width === '' && hcss.burst.height === '',
      JSON.stringify(hcss && hcss.burst));
    check('A3 .like-fx 子元素 10px 圆点 @ 按钮锚心（left/top -5px）+ 61 粒子照搬',
      !!hcss && !!hcss.fx && hcss.fx.left === '-5px' && hcss.fx.top === '-5px' && hcss.fx.width === '10px' && hcss.fx.height === '10px' && hcss.fx.radius === '50%' &&
      (hcss.fx.shadow.match(/-?\d+(\.\d+)?px -?\d+(\.\d+)?px/g) || []).length === 61, JSON.stringify(hcss && hcss.fx && { l: hcss.fx.left, t: hcss.fx.top, s: hcss.fx.shadow.length }));
    check('A4 三动画链挂 .like-fx 照参考原版时长（1.25s/1.25s/6.25s）', chainOk, 'c=' + (hcss && hcss.chain));
    check('A5 gravity 恢复参考原值 translateY(200px) 不带 scale（scale 已在外壳）',
      !!hcss && hcss.gravity && hcss.gravity.indexOf('translateY(200px)') !== -1 && hcss.gravity.indexOf('scale') === -1, 'g=' + (hcss && hcss.gravity));
    check('A5 粒子色环不变（含参考首尾色 #8800ff/#0073ff）', hasC1 && hasC2, 'dots=' + bangDots);

    // 初始态：已点赞卡实心态不重播；转发钮初始态（LIKED 已转发绿 + 计数 2；ORIG 未转发 0）
    const aInit = await t.evalJs(likeStateExpr('[data-cloud-id="PST-000102"] [data-like-post]'));
    check('A6 已点赞卡初始实心态 + 粒子藏 + 不重播（无 like-pop）', aInit && aInit.liked && aInit.pressed === 'true' && aInit.icon === 'favorite' && aInit.burstDisp === 'none' && !aInit.pop, JSON.stringify(aInit));
    const rInit = await t.evalJs(repostStateExpr('[data-cloud-id="PST-000102"] [data-repost-post]'));
    check('A6 已转发卡初始转发钮绿 + 计数 2', rInit && rInit.reposted && rInit.pressed === 'true' && rInit.count === '2', JSON.stringify(rInit));
    const rInit2 = await t.evalJs(repostStateExpr('[data-cloud-id="PST-000101"] [data-repost-post]'));
    check('A6 未转发卡转发钮常态 + 计数 0', rInit2 && !rInit2.reposted && rInit2.pressed === 'false' && rInit2.count === '0', JSON.stringify(rInit2));
    const rowOk = await t.evalJs("(() => { var c1 = document.querySelector('[data-cloud-id=\"PST-000101\"]');" +
      " var sh = c1.querySelector('[data-share-post]'); var ic = sh ? sh.querySelector('.material-symbols-outlined') : null;" +
      " var fav = c1.querySelector('[data-favorite-post]'); var fi = fav ? fav.querySelector('.material-symbols-outlined') : null;" +
      " var vw = null; Array.prototype.forEach.call(c1.querySelectorAll('.post-action-btn-static'), function (b) { var i = b.querySelector('.material-symbols-outlined'); if (i && i.textContent === 'visibility') vw = b; });" +
      " return { share: !!sh, repost: !!c1.querySelector('[data-repost-post]'), like: !!c1.querySelector('[data-like-post]'), fav: !!fav," +
      " shareIcon: ic ? ic.textContent : null, shareText: sh ? sh.textContent : null," +
      " favIcon: fi ? fi.textContent : null, favText: fav ? fav.textContent : null," +
      " viewText: vw ? (vw.textContent.match(/\\d+/) || [null])[0] : null, order: sh ? sh.parentElement.lastElementChild === sh && sh.parentElement.children[sh.parentElement.children.length - 2] === fav : false," +
      " rightEdge: sh ? Math.round(sh.parentElement.getBoundingClientRect().right - sh.getBoundingClientRect().right) : null }; })()");
    check('A7 hub 真卡操作行六件齐（赞+评+转+浏览+星+分享）', rowOk && rowOk.share && rowOk.repost && rowOk.like && rowOk.fav, JSON.stringify(rowOk));
    check('A7 分享钮纯图标：icon=upload + 无「分享」文字（v0.2.19.2 口径）', rowOk && rowOk.shareIcon === 'upload' && rowOk.shareText.indexOf('分享') === -1, 'icon=' + (rowOk && rowOk.shareIcon) + ' text=' + (rowOk && rowOk.shareText));
    check('A7 浏览量与星收藏无号码（两个都不显示号码）+ 浏览量数字渲染 + 分享最右·星居左邻',
      rowOk && rowOk.viewText === '7' && !/\d/.test(rowOk.favText) && !/\d/.test(rowOk.shareText) && rowOk.order, JSON.stringify(rowOk));
    check('A7 v0.2.20.1 星+分享顶贴行最右缘（分享钮右缘=行右缘 ≤1px）', rowOk && rowOk.rightEdge <= 1, 'rightEdge=' + (rowOk && rowOk.rightEdge));
    // v0.2.19.3 按钮放大+间距拉开几何断言（v0.2.20.0 六件行全邻钮间隙 ≥14px + 行宽 ≥250px；v0.2.20.1 g4=星前 auto 余量）
    const rowGeo = await t.evalJs("(() => { var c = document.querySelector('[data-cloud-id=\"PST-000101\"]');" +
      " var l = c.querySelector('[data-like-post]').getBoundingClientRect();" +
      " var cm = c.querySelectorAll('.post-action-btn')[1].getBoundingClientRect();" +
      " var rp = c.querySelector('[data-repost-post]').getBoundingClientRect();" +
      " var vw = null; Array.prototype.forEach.call(c.querySelectorAll('.post-action-btn-static'), function (b) { var i = b.querySelector('.material-symbols-outlined'); if (i && i.textContent === 'visibility') vw = b; }); var vr = vw.getBoundingClientRect();" +
      " var st = c.querySelector('[data-favorite-post]').getBoundingClientRect();" +
      " var shE = c.querySelector('[data-share-post]'); var sh = shE.getBoundingClientRect();" +
      " return { lh: Math.round(l.height), cw: Math.round(cm.width), g1: Math.round(cm.left - l.right), g2: Math.round(rp.left - cm.right), g3: Math.round(vr.left - rp.right), g4: Math.round(st.left - vr.right), g5: Math.round(sh.left - st.right), span: Math.round(sh.left - l.right), rightEdge: Math.round(shE.parentElement.getBoundingClientRect().right - sh.right) }; })()");
    check('A7 六件行放大+间距拉开（点赞钮高≥36px + 前四处邻钮间隙≥14px + 星→分享再靠拢重叠 2~8px [v0.2.20.4] + 点赞→分享横距≥250px）+ 分享贴行右缘',
      rowGeo && rowGeo.lh >= 36 && rowGeo.cw >= 50 && rowGeo.g1 >= 14 && rowGeo.g2 >= 14 && rowGeo.g3 >= 14 && rowGeo.g4 >= 14 && rowGeo.g5 >= -8 && rowGeo.g5 <= -2 && rowGeo.span >= 250 && rowGeo.rightEdge <= 1, JSON.stringify(rowGeo));

    // A8 点赞瞬间：实心 + like-pop + .like-fx 三动画链 + POST 捕获 + 几何对齐断言（锚点 rect = 按钮中心 ≤1.5px）
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-like-post]').click()");
    await sleep(120);
    const a8 = await t.evalJs(likeStateExpr('[data-cloud-id="PST-000101"] [data-like-post]'));
    const a8call = await t.evalJs("window.__fetchCalls.filter(function (c) { return c.url.indexOf('/like') !== -1; }).map(function (c) { return c.method + ' ' + c.url; }).join('|')");
    check('A8 点赞瞬间实心爱心（icon=favorite）+ like-pop + 计数 4', a8 && a8.liked && a8.pressed === 'true' && a8.icon === 'favorite' && a8.pop && a8.count === '4', JSON.stringify(a8));
    check('A8 .like-fx 子元素在场 + 三动画链运行', a8 && a8.fx && a8.fxAnim.indexOf('mn-fireworks-bang') !== -1 && a8.fxAnim.indexOf('mn-fireworks-gravity') !== -1 && a8.fxAnim.indexOf('mn-fireworks-position') !== -1, 'anim=' + (a8 && a8.fxAnim));
    check('A8 POST like 已发出', a8call === 'POST /api/social/posts/PST-000101/like', a8call);
    const geo = await t.evalJs("(() => { var b = document.querySelector('[data-cloud-id=\"PST-000101\"] [data-like-post]');" +
      " var br = b.getBoundingClientRect(); var burst = b.querySelector('.like-burst'); var bb = burst.getBoundingClientRect();" +
      " return { dx: Math.abs(bb.left - (br.left + br.width / 2)), dy: Math.abs(bb.top - (br.top + br.height / 2)) }; })()");
    check('A8 粒子锚点与点赞按钮中心重合 ≤1.5px（旧版 right:40px 锚在计数那边是偏的）', geo && geo.dx <= 1.5 && geo.dy <= 1.5, JSON.stringify(geo));

    // A9 飞行中 1.5s 仍在 / 7s 全链完摘类（时机口径不动）
    await sleep(1400);
    const a9 = await t.evalJs(likeStateExpr('[data-cloud-id="PST-000101"] [data-like-post]'));
    check('A9 飞行中（1.5s）：like-pop 仍在 + 粒子在飞 + 实心态', a9 && a9.pop && a9.burstDisp === 'block' && a9.fxAnim.indexOf('mn-fireworks-bang') !== -1 && a9.liked && a9.count === '4', JSON.stringify(a9));
    await sleep(5600);
    const a9b = await t.evalJs(likeStateExpr('[data-cloud-id="PST-000101"] [data-like-post]'));
    check('A9b 全链完（7s）：摘类 + 粒子藏 + 实心态保留', a9b && !a9b.pop && a9b.burstDisp === 'none' && a9b.liked && a9b.pressed === 'true' && a9b.count === '4', JSON.stringify(a9b));
    // 还原空心
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-like-post]').click()");
    await sleep(400);

    // R. hub 转发免弹窗直转（真卡）——v0.2.19.1 对话框整体删除（用户「转发不需要弹窗」）
    console.log('── R. Hub 转发免弹窗直转（本地罐头）──');
    await t.evalJs("window.__toasts = []");
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-repost-post]').click()");
    await sleep(300);
    const r1 = await t.evalJs("(() => { return { modal: !!document.querySelector('#repostInput') || !!document.querySelector('#repostSubmit'), backdrops: document.querySelectorAll('.modal-backdrop').length }; })()");
    check('R1 点击转发不弹对话框（零 modal-backdrop——旧对话框已整体删除）', !r1.modal && r1.backdrops === 0, JSON.stringify(r1));
    await sleep(300);
    const r1b = await t.evalJs(repostStateExpr('[data-cloud-id="PST-000101"] [data-repost-post]'));
    const r1call = await t.evalJs("window.__fetchCalls.filter(function (c) { return c.url.indexOf('/repost') !== -1; }).map(function (c) { return c.method; }).join('|')");
    const r1toast = await t.evalJs("window.__toasts.join('|')");
    check('R1 直转成功：钮绿 + 计数 1 + POST 已发出 + toast 已转发到你的主页',
      r1b && r1b.reposted && r1b.pressed === 'true' && r1b.count === '1' && r1call === 'POST' && r1toast.indexOf('已转发到你的主页') !== -1,
      JSON.stringify(r1b) + ' calls=' + r1call + ' toast=' + r1toast);
    // 再点 = 撤销 DELETE + toast 已取消转发
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-repost-post]').click()");
    await sleep(500);
    const r2 = await t.evalJs(repostStateExpr('[data-cloud-id="PST-000101"] [data-repost-post]'));
    const r2call = await t.evalJs("window.__fetchCalls.filter(function (c) { return c.url.indexOf('/repost') !== -1; }).map(function (c) { return c.method; }).join('|')");
    const r2toast = await t.evalJs("window.__toasts.join('|')");
    check('R2 再点撤销：钮回常态 + 计数 0 + DELETE 已发出 + toast 已取消转发',
      r2 && !r2.reposted && r2.pressed === 'false' && r2.count === '0' && r2call === 'POST|DELETE' && r2toast.indexOf('已取消转发') !== -1,
      JSON.stringify(r2) + ' calls=' + r2call + ' toast=' + r2toast);
    // removed 拦截分支：乐观置位后回滚不置位 + toast（不再有对话框可关）
    await t.evalJs("window.__forceRepostRemoved = true");
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-repost-post]').click()");
    await sleep(500);
    const r3 = await t.evalJs(repostStateExpr('[data-cloud-id="PST-000101"] [data-repost-post]'));
    const r3toast = await t.evalJs("window.__toasts.join('|')");
    check('R3 removed 拦截：回滚不置位 + 计数 0 + toast 内容违反社区规则',
      r3 && !r3.reposted && r3.pressed === 'false' && r3.count === '0' && r3toast.indexOf('内容违反社区规则') !== -1, JSON.stringify(r3) + ' toast=' + r3toast);
    await t.evalJs("window.__forceRepostRemoved = false");

    // S. 分享弹窗（hub 真卡：打开即复制 + 三路关 + URL 逐字）
    console.log('── S. 分享弹窗（本地罐头）──');
    await patchClipboard(t);
    const expHubUrl = new URL('community-post.html?id=PST-000101', BASE + '/pages/community-hub.html').href;
    await t.evalJs("window.__toasts = []");
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-share-post]').click()");
    await sleep(400);
    const s1 = await t.evalJs("(() => { var inp = document.querySelector('#shareUrlInput');" +
      " var card = inp ? inp.closest('.modal-card') : null; var bd = inp ? inp.closest('.modal-backdrop') : null;" +
      " return { dlg: !!inp, val: inp ? inp.value : null, state: document.querySelector('#shareCopyState') ? document.querySelector('#shareCopyState').textContent : null, copied: window.__copied," +
      " cardOpacity: card ? getComputedStyle(card).opacity : null, bdOpacity: bd ? getComputedStyle(bd).opacity : null }; })()");
    check('S1 分享弹窗打开 + 打开即自动复制（假 clipboard 记 URL）', s1.dlg && s1.val === expHubUrl && s1.copied === expHubUrl, JSON.stringify(s1));
    check('S1 弹窗卡片真正可见（card/backdrop opacity=1——v0.2.19.2 隐形弹窗回归断言：只变模糊=卡隐形=挂类漏）',
      s1.cardOpacity === '1' && s1.bdOpacity === '1', 'card=' + s1.cardOpacity + ' bd=' + s1.bdOpacity);
    check('S1 状态文案 链接已复制，可直接粘贴', s1.state === '链接已复制，可直接粘贴', 'state=' + s1.state);
    const s1toast = await t.evalJs("window.__toasts.join('|')");
    check('S1 弹窗内反馈不重复 toast（零 toast）', s1toast === '', 'toasts=' + s1toast);
    // 复制链接重试钮
    await t.evalJs("window.__copied = null; document.querySelector('#shareCopyAgain').click()");
    await sleep(300);
    const s2 = await t.evalJs("window.__copied");
    check('S2 复制链接重试钮再复制一次', s2 === expHubUrl, 'copied=' + s2);
    // 关闭钮
    await t.evalJs("document.querySelector('#shareClose').click()");
    await sleep(300);
    check('S2 关闭钮关弹窗', await t.evalJs("!document.querySelector('#shareUrlInput')"), '');
    // backdrop 点击关
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-share-post]').click()");
    await sleep(300);
    await t.evalJs("var bd = document.querySelector('#shareUrlInput').closest('.modal-backdrop'); bd.click()");
    await sleep(300);
    check('S3 backdrop 点击关弹窗', await t.evalJs("!document.querySelector('#shareUrlInput')"), '');
    // Escape 关
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-share-post]').click()");
    await sleep(300);
    await t.evalJs("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))");
    await sleep(300);
    check('S4 Escape 关弹窗', await t.evalJs("!document.querySelector('#shareUrlInput')"), '');

    // F. 星收藏开关 + 浏览量（v0.2.20.0）——star↔star_border + 金色 + FILL 轴 + 无号码
    console.log('── F. 星收藏开关 + 浏览量（本地罐头）──');
    const fInit = await t.evalJs("(() => { var b = document.querySelector('[data-cloud-id=\"PST-000102\"] [data-favorite-post]');" +
      " var i = b ? b.querySelector('.material-symbols-outlined') : null;" +
      " var o = document.querySelector('[data-cloud-id=\"PST-000101\"] [data-favorite-post]'); var oi = o ? o.querySelector('.material-symbols-outlined') : null;" +
      " return { p: b ? b.getAttribute('aria-pressed') : null, fav: b ? b.classList.contains('favorited') : null, icon: i ? i.textContent : null," +
      " color: b ? getComputedStyle(b).color : null, op: o ? o.getAttribute('aria-pressed') : null, oicon: oi ? oi.textContent : null }; })()");
    check('F1 已收藏卡初始金星星（icon=star + .favorited + 金色 rgb(234,179,8)）+ 未收藏卡 star_border',
      fInit && fInit.p === 'true' && fInit.fav && fInit.icon === 'star' && fInit.color === 'rgb(234, 179, 8)' && fInit.op === 'false' && fInit.oicon === 'star_border', JSON.stringify(fInit));
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-favorite-post]').click()");
    await sleep(300);
    const f2 = await t.evalJs("(() => { var b = document.querySelector('[data-cloud-id=\"PST-000101\"] [data-favorite-post]'); var i = b.querySelector('.material-symbols-outlined');" +
      " return { p: b.getAttribute('aria-pressed'), fav: b.classList.contains('favorited'), icon: i.textContent, color: getComputedStyle(b).color, text: b.textContent }; })()");
    const f2call = await t.evalJs("window.__fetchCalls.filter(function (c) { return c.url.indexOf('/favorite') !== -1; }).map(function (c) { return c.method; }).join('|')");
    check('F2 点击收藏：star + 金色 + POST favorite + 无号码（用户「两个都不需要显示号码」）',
      f2 && f2.p === 'true' && f2.fav && f2.icon === 'star' && f2.color === 'rgb(234, 179, 8)' && !/\d/.test(f2.text) && f2call === 'POST', JSON.stringify(f2) + ' calls=' + f2call);
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-favorite-post]').click()");
    await sleep(300);
    const f3 = await t.evalJs("(() => { var b = document.querySelector('[data-cloud-id=\"PST-000101\"] [data-favorite-post]'); var i = b.querySelector('.material-symbols-outlined');" +
      " return { p: b.getAttribute('aria-pressed'), fav: b.classList.contains('favorited'), icon: i.textContent }; })()");
    const f3call = await t.evalJs("window.__fetchCalls.filter(function (c) { return c.url.indexOf('/favorite') !== -1; }).map(function (c) { return c.method; }).join('|')");
    check('F3 再点撤销：star_border + 去金色 + DELETE favorite', f3 && f3.p === 'false' && !f3.fav && f3.icon === 'star_border' && f3call === 'POST|DELETE', JSON.stringify(f3) + ' calls=' + f3call);
    // 500 失败回滚（乐观置位 → 复原态 + toast）
    await t.evalJs("window.__toasts = []; window.__forceFavoriteFail = true");
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-favorite-post]').click()");
    await sleep(300);
    const f4 = await t.evalJs("(() => { var b = document.querySelector('[data-cloud-id=\"PST-000101\"] [data-favorite-post]'); var i = b.querySelector('.material-symbols-outlined');" +
      " return { p: b.getAttribute('aria-pressed'), fav: b.classList.contains('favorited'), icon: i.textContent, toast: window.__toasts.join('|') }; })()");
    check('F4 500 失败回滚：star_border 复原 + toast 操作失败', f4 && f4.p === 'false' && !f4.fav && f4.icon === 'star_border' && f4.toast.indexOf('操作失败') !== -1, JSON.stringify(f4));
    await t.evalJs("window.__forceFavoriteFail = false");

    // M. reduced-motion：关动画只换实心
    await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await sleep(200);
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-like-post]').click()");
    await sleep(150);
    const m1 = await t.evalJs(likeStateExpr('[data-cloud-id="PST-000101"] [data-like-post]'));
    check('M1 reduced-motion：图标无动画 + 粒子藏 + 实心态照常', m1 && m1.liked && m1.pressed === 'true' && m1.icon === 'favorite' && (m1.iconAnim === 'none' || m1.iconAnim === '') && m1.burstDisp === 'none', JSON.stringify(m1));
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-like-post]').click()");
    await sleep(400);
    await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: '' }] });

    console.log('── P. 帖页（本地罐头）──');
    await nav(t, BASE + '/pages/community-post.html?id=PST-000101');
    await waitFor(t, "document.getElementById('postDetail').style.display === 'flex'", 15000, '帖页渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);
    await patchClipboard(t);

    const p1 = await t.evalJs(likeStateExpr('#postCardWrap [data-like-post]'));
    check('P1 帖页点赞钮空心态 + .like-fx 子元素在场（markup 已换外壳结构）', p1 && p1.pressed === 'false' && p1.icon === 'favorite_border' && p1.fx && !p1.pop && p1.burstDisp === 'none', JSON.stringify(p1));
    // v0.2.20.0 帖页六件行：浏览量渲染 + 星收藏初态 star_border + 分享最右
    const p1b = await t.evalJs("(() => { var fav = document.querySelector('#postCardWrap [data-favorite-post]'); var fi = fav ? fav.querySelector('.material-symbols-outlined') : null;" +
      " var sh = document.querySelector('#postCardWrap [data-share-post]');" +
      " var vw = null; Array.prototype.forEach.call(document.querySelectorAll('#postCardWrap .post-action-btn-static'), function (b) { var i = b.querySelector('.material-symbols-outlined'); if (i && i.textContent === 'visibility') vw = b; });" +
      " return { fav: !!fav, fi: fi ? fi.textContent : null, fp: fav ? fav.getAttribute('aria-pressed') : null," +
      " viewText: vw ? (vw.textContent.match(/\\d+/) || [null])[0] : null, order: sh && fav ? sh.parentElement.lastElementChild === sh && sh.parentElement.children[sh.parentElement.children.length - 2] === fav : false," +
      " rightEdge: sh ? Math.round(sh.parentElement.getBoundingClientRect().right - sh.getBoundingClientRect().right) : null }; })()");
    check('P1 帖页浏览 7 渲染 + 星收藏初态 star_border + 分享最右·星居左邻', p1b && p1b.fav && p1b.fi === 'star_border' && p1b.fp === 'false' && p1b.viewText === '7' && p1b.order, JSON.stringify(p1b));
    check('P1 v0.2.20.1 帖页星+分享顶贴行最右缘（≤1px）', p1b && p1b.rightEdge <= 1, 'rightEdge=' + (p1b && p1b.rightEdge));

    await t.evalJs("document.querySelector('#postCardWrap [data-like-post]').click()");
    await sleep(120);
    const p2 = await t.evalJs(likeStateExpr('#postCardWrap [data-like-post]'));
    check('P2 帖页点赞瞬间：实心爱心 + 弹跳 + .like-fx 三动画链 + 计数 4', p2 && p2.liked && p2.pop && p2.icon === 'favorite' && p2.iconAnim === 'like-pop-icon' && p2.fxAnim.indexOf('mn-fireworks-bang') !== -1 && p2.fxAnim.indexOf('mn-fireworks-position') !== -1 && p2.count === '4', JSON.stringify(p2));

    // 帖页分享弹窗：URL = 本页 origin+pathname?id= 逐字
    const expPostUrl = BASE + '/pages/community-post.html?id=PST-000101';
    await t.evalJs("window.__toasts = []; document.querySelector('#postCardWrap [data-share-post]').click()");
    await sleep(400);
    const p3 = await t.evalJs("(() => { var inp = document.querySelector('#shareUrlInput');" +
      " var card = inp ? inp.closest('.modal-card') : null;" +
      " var sh = document.querySelector('#postCardWrap [data-share-post]'); var ic = sh ? sh.querySelector('.material-symbols-outlined') : null;" +
      " return { dlg: !!inp, val: inp ? inp.value : null, copied: window.__copied," +
      " cardOpacity: card ? getComputedStyle(card).opacity : null, icon: ic ? ic.textContent : null }; })()");
    check('P3 帖页分享弹窗 + 打开即复制（URL 逐字 = 本页规范链接）', p3.dlg && p3.val === expPostUrl && p3.copied === expPostUrl, JSON.stringify(p3));
    check('P3 弹窗卡片真正可见（opacity=1）+ 帖页分享钮 icon=upload', p3.cardOpacity === '1' && p3.icon === 'upload', 'opacity=' + p3.cardOpacity + ' icon=' + p3.icon);
    await t.evalJs("document.querySelector('#shareClose').click()");
    await sleep(300);
    check('P3 关闭钮关弹窗', await t.evalJs("!document.querySelector('#shareUrlInput')"), '');
    // 帖页转发钮在场（回归）
    const p4 = await t.evalJs("!!document.querySelector('#postCardWrap [data-repost-post]') && !!document.querySelector('#postCardWrap [data-repost-count]')");
    check('P4 帖页转发钮 + 计数在场（回归）', p4, '');
    // v0.2.19.3 帖页放大+间距拉开（v0.2.20.0 六件行口径：点赞钮高≥36px + 点赞→分享横距≥250px）
    const p6 = await t.evalJs("(() => { var l = document.querySelector('#postCardWrap [data-like-post]').getBoundingClientRect();" +
      " var sh = document.querySelector('#postCardWrap [data-share-post]').getBoundingClientRect();" +
      " return { lh: Math.round(l.height), span: Math.round(sh.left - l.right) }; })()");
    check('P6 帖页操作行放大+间距拉开（点赞钮高≥36px + 点赞→分享横距≥250px）', p6 && p6.lh >= 36 && p6.span >= 250, JSON.stringify(p6));
    // v0.2.20.0 帖页收藏开关（与 hub 同构：点击 star + 金色 + POST；再点净零还原）
    await t.evalJs("document.querySelector('#postCardWrap [data-favorite-post]').click()");
    await sleep(300);
    const p7 = await t.evalJs("(() => { var b = document.querySelector('#postCardWrap [data-favorite-post]'); var i = b.querySelector('.material-symbols-outlined');" +
      " return { p: b.getAttribute('aria-pressed'), fav: b.classList.contains('favorited'), icon: i.textContent, color: getComputedStyle(b).color, text: b.textContent }; })()");
    const p7call = await t.evalJs("window.__fetchCalls.filter(function (c) { return c.url.indexOf('/favorite') !== -1; }).map(function (c) { return c.method; }).join('|')");
    check('P7 帖页收藏：star + 金色 + POST favorite + 无号码', p7 && p7.p === 'true' && p7.fav && p7.icon === 'star' && p7.color === 'rgb(234, 179, 8)' && !/\d/.test(p7.text) && p7call === 'POST', JSON.stringify(p7) + ' calls=' + p7call);
    await t.evalJs("document.querySelector('#postCardWrap [data-favorite-post]').click()");
    await sleep(300);
    // v0.2.19.1 帖页转发免弹窗直转（回归 hub 同构）
    await t.evalJs("window.__toasts = []");
    await t.evalJs("document.querySelector('#postCardWrap [data-repost-post]').click()");
    await sleep(300);
    const p5modal = await t.evalJs("!document.querySelector('#repostInput') && document.querySelectorAll('.modal-backdrop').length === 0");
    await sleep(300);
    const p5 = await t.evalJs(repostStateExpr('#postCardWrap [data-repost-post]'));
    const p5toast = await t.evalJs("window.__toasts.join('|')");
    check('P5 帖页转发免弹窗直转：不弹对话框 + 钮置位 + toast 已转发到你的主页',
      p5modal && p5 && p5.reposted && p5.pressed === 'true' && p5toast.indexOf('已转发到你的主页') !== -1, JSON.stringify(p5) + ' toast=' + p5toast);
    // 撤销还原（净零，不影响后续）
    await t.evalJs("document.querySelector('#postCardWrap [data-repost-post]').click()");
    await sleep(400);

    console.log('── G. 访客演示卡：转发 toast + 分享弹窗（本地罐头）──');
    await clearUser(t);
    await nav(t, BASE + '/pages/community-hub.html');
    await sleep(1200);
    await waitFor(t, "document.querySelectorAll('[data-guest-like]').length >= 1", 15000, '演示卡渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);
    await patchClipboard(t);
    const g1 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " var sh = feed.querySelector('[data-guest-share]'); var ic = sh ? sh.querySelector('.material-symbols-outlined') : null;" +
      " var vw = null; Array.prototype.forEach.call(feed.querySelectorAll('.post-action-btn-static'), function (b) { var i = b.querySelector('.material-symbols-outlined'); if (i && i.textContent === 'visibility') vw = b; });" +
      " return { guestLike: feed.querySelectorAll('[data-guest-like]').length," +
      " guestRepost: feed.querySelectorAll('[data-guest-repost]').length," +
      " guestShare: feed.querySelectorAll('[data-guest-share]').length," +
      " guestFav: feed.querySelectorAll('[data-guest-favorite]').length," +
      " shareIcon: ic ? ic.textContent : null," +
      " viewText: vw ? (vw.textContent.match(/\\d+/) || [null])[0] : null," +
      " rightEdge: sh ? Math.round(sh.parentElement.getBoundingClientRect().right - sh.getBoundingClientRect().right) : null," +
      " cloud: feed.querySelectorAll('[data-cloud-id]').length }; })()");
    check('G1 访客演示卡四钮齐（爱心/转发/星收藏/分享真按钮 + 零云卡）', g1 && g1.guestLike >= 1 && g1.guestRepost >= 1 && g1.guestShare >= 1 && g1.guestFav >= 1 && g1.cloud === 0, JSON.stringify(g1));
    check('G1 v0.2.20.1 演示卡星+分享顶贴行最右缘（≤1px）', g1 && g1.rightEdge <= 1, 'rightEdge=' + (g1 && g1.rightEdge));
    check('G1 演示卡分享钮 icon=upload（v0.2.19.2 口径）+ 浏览量数字渲染（演示卡 views 字段）', g1 && g1.shareIcon === 'upload' && /^\d+$/.test(g1.viewText || ''), 'icon=' + (g1 && g1.shareIcon) + ' view=' + (g1 && g1.viewText));
    // 转发 toast（演示卡无真帖可转，保持引导登录）
    await t.evalJs("window.__toasts = []");
    await t.evalJs("document.querySelector('[data-guest-repost]').click()");
    await sleep(300);
    const g2 = await t.evalJs("window.__toasts.join('|')");
    check('G2 演示卡转发 toast 登录后才能转发', g2.indexOf('登录后才能转发') !== -1, g2);
    // v0.2.20.0 演示卡星收藏 = 引导登录 toast（与爱心同口径不装死）
    await t.evalJs("document.querySelector('[data-guest-favorite]').click()");
    await sleep(300);
    const g2b = await t.evalJs("window.__toasts.join('|')");
    check('G2 演示卡星收藏 toast 登录后才能收藏', g2b.indexOf('登录后才能收藏') !== -1, g2b);
    // v0.2.19.1 演示卡分享也弹分享弹窗（用户「为什么分享按钮点击后没有弹窗」根因修复）
    const expHubShare = new URL('community-hub.html', BASE + '/pages/community-hub.html').href;
    await t.evalJs("document.querySelector('[data-guest-share]').click()");
    await sleep(400);
    const g3 = await t.evalJs("(() => { var inp = document.querySelector('#shareUrlInput');" +
      " var h3 = document.querySelector('.modal-card h3');" +
      " var card = inp ? inp.closest('.modal-card') : null;" +
      " return { dlg: !!inp, val: inp ? inp.value : null, title: h3 ? h3.textContent : null, copied: window.__copied," +
      " cardOpacity: card ? getComputedStyle(card).opacity : null }; })()");
    check('G3 演示卡分享也弹弹窗 + 标题 分享社区 + URL = 社区页链接 + 打开即复制',
      g3.dlg && g3.title === '分享社区' && g3.val === expHubShare && g3.copied === expHubShare, JSON.stringify(g3));
    check('G3 弹窗卡片真正可见（opacity=1——v0.2.19.2 隐形弹窗回归断言）', g3.cardOpacity === '1', 'opacity=' + g3.cardOpacity);
    await t.evalJs("document.querySelector('#shareClose').click()");
    await sleep(300);
    check('G3 关闭钮关弹窗', await t.evalJs("!document.querySelector('#shareUrlInput')"), '');
    // 演示卡互动零 API 调用
    const g4 = await t.evalJs("window.__fetchCalls.filter(function (c) { return c.url.indexOf('/repost') !== -1 || c.url.indexOf('/social') !== -1; }).length");
    check('G4 演示卡互动零 API 调用', g4 === 0, 'calls=' + g4);
    check('G5 全程 0 console 错误', errs.length === 0, errs.slice(0, 2).join(' | '));
  }

  // ──────────────────────────────────────────────
  // 线上：真卡三钮齐 + 分享弹窗 URL + 转发免弹窗（401 回滚实测）+ 访客演示卡转发 toast/分享弹窗 + 帖页实心态一致
  // ──────────────────────────────────────────────
  async function runLive(t) {
    console.log('── L. 线上操作行 + 分享弹窗 ──');

    const l1 = await t.evalJs("(() => { var c = document.querySelector('[data-cloud-id]');" +
      " var b = c && c.querySelector('[data-like-post]'); var rp = c && c.querySelector('[data-repost-post]'); var sh = c && c.querySelector('[data-share-post]');" +
      " var fav = c && c.querySelector('[data-favorite-post]'); var fi = fav ? fav.querySelector('.material-symbols-outlined') : null;" +
      " var ic = sh ? sh.querySelector('.material-symbols-outlined') : null;" +
      " var vw = null; if (c) Array.prototype.forEach.call(c.querySelectorAll('.post-action-btn-static'), function (x) { var i = x.querySelector('.material-symbols-outlined'); if (i && i.textContent === 'visibility') vw = x; });" +
      " return { ver: window.MN_SITE_VERSION, id: c ? c.getAttribute('data-cloud-id') : null," +
      " hasBtn: !!b, hasFx: b ? !!b.querySelector('.like-fx') : false," +
      " hasRepost: !!rp, hasShare: !!sh, hasFav: !!fav, repostCount: rp ? (rp.querySelector('[data-repost-count]') || {}).textContent : null," +
      " shareIcon: ic ? ic.textContent : null, shareText: sh ? sh.textContent : null," +
      " favIcon: fi ? fi.textContent : null, favText: fav ? fav.textContent : null, favP: fav ? fav.getAttribute('aria-pressed') : null," +
      " favConsistent: fav ? (fav.getAttribute('aria-pressed') === 'true') === (fi && fi.textContent === 'star') : false," +
      " viewText: vw ? (vw.textContent.match(/\\d+/) || [null])[0] : null, order: sh && fav ? sh.parentElement.lastElementChild === sh && sh.parentElement.children[sh.parentElement.children.length - 2] === fav : false," +
      " rightEdge: sh ? Math.round(sh.parentElement.getBoundingClientRect().right - sh.getBoundingClientRect().right) : null }; })()");
    check('L1 版本 v0.2.20.4', l1.ver === 'v0.2.20.4', 'ver=' + l1.ver);
    check('L1 真卡六件齐（赞带 .like-fx / 转带计数 / 浏览 / 星 / 分享）', l1.hasBtn && l1.hasFx && l1.hasRepost && l1.hasShare && l1.hasFav && /^PST-/.test(l1.id) && l1.repostCount != null && /^\d+$/.test(l1.viewText || ''), JSON.stringify(l1));
    check('L1 分享钮纯图标 icon=upload 无「分享」文字（v0.2.19.2 口径）', l1.shareIcon === 'upload' && l1.shareText.indexOf('分享') === -1, 'icon=' + l1.shareIcon + ' text=' + l1.shareText);
    check('L1 星收藏态一致（star ⇔ aria=true）+ 星/分享无号码 + 分享最右·星居左邻', l1.favConsistent && !/\d/.test(l1.favText) && !/\d/.test(l1.shareText) && l1.order, JSON.stringify(l1));
    check('L1 v0.2.20.1 线上星+分享顶贴行最右缘（≤1px）', l1.rightEdge <= 1, 'rightEdge=' + l1.rightEdge);
    // v0.2.19.3 线上操作行放大+间距拉开（v0.2.20.0 六件行口径：点赞钮高≥36px + 点赞→分享横距≥250px；v0.2.20.1 分享贴行右缘）
    const l1geo = await t.evalJs("(() => { var c = document.querySelector('[data-cloud-id]');" +
      " var l = c.querySelector('[data-like-post]').getBoundingClientRect();" +
      " var shE = c.querySelector('[data-share-post]'); var sh = shE.getBoundingClientRect();" +
      " return { lh: Math.round(l.height), span: Math.round(sh.left - l.right), rightEdge: Math.round(shE.parentElement.getBoundingClientRect().right - sh.right) }; })()");
    check('L1 操作行六件放大+间距拉开（点赞钮高≥36px + 点赞→分享横距≥250px）+ 分享贴行右缘', l1geo.lh >= 36 && l1geo.span >= 250 && l1geo.rightEdge <= 1, JSON.stringify(l1geo));

    // L2 hub 分享弹窗：URL 含帖 id + 关闭钮关
    await t.evalJs("document.querySelector('[data-share-post]').click()");
    await sleep(600);
    const l2 = await t.evalJs("(() => { var inp = document.querySelector('#shareUrlInput');" +
      " var card = inp ? inp.closest('.modal-card') : null;" +
      " return { dlg: !!inp, val: inp ? inp.value : null, id: document.querySelector('[data-share-post]').getAttribute('data-share-post')," +
      " cardOpacity: card ? getComputedStyle(card).opacity : null }; })()");
    check('L2 hub 分享弹窗打开 + URL 指向该帖独立帖页（含帖 id）', l2.dlg && l2.val && l2.val.indexOf('community-post.html?id=' + l2.id) !== -1, JSON.stringify(l2));
    check('L2 弹窗卡片真正可见（opacity=1——v0.2.19.2 隐形弹窗回归断言）', l2.cardOpacity === '1', 'opacity=' + l2.cardOpacity);
    await t.evalJs("document.querySelector('#shareClose').click()");
    await sleep(300);
    check('L2 关闭钮关弹窗', await t.evalJs("!document.querySelector('#shareUrlInput')"), '');

    // L2b v0.2.19.1 转发免弹窗：点击零弹窗（对话框已整体删除）；假会话 POST 401 → 乐观回滚 + toast 登录已过期分支实测
    await t.evalJs("document.querySelector('[data-repost-post]').click()");
    await sleep(600);
    const l2b = await t.evalJs("(() => { var b = document.querySelector('[data-repost-post]');" +
      " return { backdrops: document.querySelectorAll('.modal-backdrop').length," +
      " pressed: b.getAttribute('aria-pressed'), reposted: b.classList.contains('reposted')," +
      " toast: window.__toasts.join('|') }; })()");
    check('L2b 转发点击零弹窗（对话框已删）+ 401 回滚不置位 + toast 登录已过期',
      l2b.backdrops === 0 && l2b.pressed === 'false' && !l2b.reposted && l2b.toast.indexOf('登录已过期') !== -1, JSON.stringify(l2b));

    // L2c v0.2.20.0 收藏假会话 401 → 乐观回滚 + toast 登录已过期分支实测（与点赞/转发同口径）
    await t.evalJs("window.__toasts = []");
    await t.evalJs("document.querySelector('[data-favorite-post]').click()");
    await sleep(600);
    const l2c = await t.evalJs("(() => { var b = document.querySelector('[data-favorite-post]'); var i = b.querySelector('.material-symbols-outlined');" +
      " return { pressed: b.getAttribute('aria-pressed'), fav: b.classList.contains('favorited'), icon: i.textContent, toast: window.__toasts.join('|') }; })()");
    check('L2c 收藏 401 回滚：star_border 复原不置位 + toast 登录已过期',
      l2c.pressed === 'false' && !l2c.fav && l2c.icon === 'star_border' && l2c.toast.indexOf('登录已过期') !== -1, JSON.stringify(l2c));

    // L3 访客演示卡：转发 toast + 分享弹窗（v0.2.19.1 演示卡分享也弹窗——「为什么分享按钮点击后没有弹窗」根因修复）
    await clearUser(t);
    await t.send('Page.reload');
    await sleep(1800);
    await waitFor(t, "document.querySelectorAll('[data-guest-repost]').length >= 1", 20000, '访客演示卡渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);
    await patchClipboard(t);
    await t.evalJs("document.querySelector('[data-guest-repost]').click()");
    await sleep(300);
    await t.evalJs("document.querySelector('[data-guest-share]').click()");
    await sleep(400);
    const l3 = await t.evalJs("(() => { var inp = document.querySelector('#shareUrlInput');" +
      " var h3 = document.querySelector('.modal-card h3');" +
      " var card = inp ? inp.closest('.modal-card') : null;" +
      " return { toasts: window.__toasts.join('|'), dlg: !!inp, val: inp ? inp.value : null, title: h3 ? h3.textContent : null, copied: window.__copied," +
      " cardOpacity: card ? getComputedStyle(card).opacity : null }; })()");
    check('L3 访客演示卡：转发 toast 登录后才能转发 + 分享弹窗打开（标题 分享社区 + URL 社区页 + 自动复制）',
      l3.toasts.indexOf('登录后才能转发') !== -1 && l3.dlg && l3.title === '分享社区' && l3.val && l3.val.indexOf('community-hub.html') !== -1 && l3.copied === l3.val, JSON.stringify(l3));
    check('L3 弹窗卡片真正可见（opacity=1——v0.2.19.2 隐形弹窗回归断言）', l3.cardOpacity === '1', 'opacity=' + l3.cardOpacity);
    await t.evalJs("document.querySelector('#shareClose').click()");
    await sleep(300);
    check('L3 关闭钮关弹窗', await t.evalJs("!document.querySelector('#shareUrlInput')"), '');

    // L4 帖页：实心态与 aria 一致（不点不发请求，线上零改动）+ 分享弹窗 URL 与当前页同 id + .like-fx 在场
    await seedUser(t);
    await nav(t, BASE + '/pages/community-hub.html');
    await waitFor(t, "document.querySelectorAll('[data-cloud-id]').length >= 1", 30000, '云卡渲染');
    await t.evalJs("document.querySelector('[data-cloud-id] h4, [data-cloud-id] p').click()");
    await waitFor(t, "window.location.pathname.indexOf('community-post.html') !== -1", 15000, '整卡跳转');
    await waitFor(t, "(document.getElementById('postDetail').style.display === 'flex') || (document.getElementById('postState404').style.display === 'block')", 20000, '帖页渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);
    const l4 = await t.evalJs("(() => { var b = document.querySelector('#postCardWrap [data-like-post]');" +
      " if (!b) return { noBtn: true };" +
      " var icon = b.querySelector('.material-symbols-outlined');" +
      " var fav = document.querySelector('#postCardWrap [data-favorite-post]'); var fi = fav ? fav.querySelector('.material-symbols-outlined') : null;" +
      " var vw = null; Array.prototype.forEach.call(document.querySelectorAll('#postCardWrap .post-action-btn-static'), function (x) { var i = x.querySelector('.material-symbols-outlined'); if (i && i.textContent === 'visibility') vw = x; });" +
      " return { pressed: b.getAttribute('aria-pressed'), icon: icon ? icon.textContent : null," +
      " consistent: (b.getAttribute('aria-pressed') === 'true') === (icon && icon.textContent === 'favorite')," +
      " hasFx: !!b.querySelector('.like-fx'), s404: document.getElementById('postState404').style.display," +
      " favConsistent: fav ? (fav.getAttribute('aria-pressed') === 'true') === (fi && fi.textContent === 'star') : false," +
      " viewText: vw ? (vw.textContent.match(/\\d+/) || [null])[0] : null }; })()");
    check('L4 帖页实心态与点赞态一致（favorite ⇔ aria=true）+ .like-fx 在场', l4.s404 === 'none' && l4.consistent && l4.hasFx, JSON.stringify(l4));
    check('L4 帖页星收藏态一致（star ⇔ aria=true）+ 浏览量数字渲染', l4.s404 === 'none' && l4.favConsistent && /^\d+$/.test(l4.viewText || ''), JSON.stringify(l4));
    await t.evalJs("document.querySelector('#postCardWrap [data-share-post]').click()");
    await sleep(600);
    const l5 = await t.evalJs("(() => { var inp = document.querySelector('#shareUrlInput');" +
      " var q = window.location.search || '';" +
      " var card = inp ? inp.closest('.modal-card') : null;" +
      " return { dlg: !!inp, val: inp ? inp.value : null, sameId: inp ? inp.value.indexOf(window.location.pathname) !== -1 && inp.value.indexOf(q.slice(1)) !== -1 : false," +
      " cardOpacity: card ? getComputedStyle(card).opacity : null }; })()");
    check('L5 帖页分享弹窗 URL 与本页同 id', l5.dlg && l5.sameId, JSON.stringify(l5));
    check('L5 弹窗卡片真正可见（opacity=1——v0.2.19.2 隐形弹窗回归断言）', l5.cardOpacity === '1', 'opacity=' + l5.cardOpacity);
    await t.evalJs("document.querySelector('#shareClose').click()");
    await sleep(300);

    check('L6 全程 0 console 错误', errs.length === 0, errs.slice(0, 2).join(' | '));
  }
}

main().catch(e => { console.error('电池异常:', e.message); process.exit(2); });
