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
// v0.2.58.26（社区页演示样本全移除）：A1/L1 版本锚 58.24；boot 假登录 401 整流终态=登录引导卡（hub 云卡不可得→六件行断言
//   全部迁真帖页直达）；G 段重写=访客登录引导卡（三 tab 恒引导卡+发现引导行+零 API 含零 probe+零演示签名）；
//   L 段重写=假登录 boot 整流终态登录卡+公共端点取真 id 帖页六件齐+分享弹窗同 id+访客点赞/转发 toast+假登录 401 回滚链+访客 hub 面。
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
    if (LIVE) {
      // 假登录 boot：/social/posts 公共 200 先渲染真卡 → /social/feed 401 → mn:unauthorized 整流 → 终态登录引导卡
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
  // 本地：罐头全矩阵（粒子对齐 + hub 转发/分享 + 分享弹窗 + 实心爱心）
  // ──────────────────────────────────────────────
  async function runLocal(t) {
    console.log('── A. Hub 粒子对齐 + 操作行（本地罐头）──');

    const ver = await t.evalJs('window.MN_SITE_VERSION');
    check('A1 版本 v0.2.58.26', ver === 'v0.2.58.26', 'ver=' + ver);
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

    console.log('── G. 访客登录引导卡（v0.2.58.26 演示样本全移除）──');
    await clearUser(t);
    await nav(t, BASE + '/pages/community-hub.html');
    await sleep(500);
    await waitFor(t, "document.getElementById('hubLoginCard')", 15000, '访客登录引导卡渲染');
    const g1 = await t.evalJs("(() => { var feed = document.getElementById('feedContent'); var card = document.getElementById('hubLoginCard');" +
      " return { loginCard: !!card, lockIcon: card ? (card.querySelector('.material-symbols-outlined') || {}).textContent : null," +
      " btnText: card ? ((card.querySelector('button') || {}).textContent || '') : ''," +
      " cards: feed.querySelectorAll('.card').length," +
      " cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " guestLike: feed.querySelectorAll('[data-guest-like]').length," +
      " guestRepost: feed.querySelectorAll('[data-guest-repost]').length," +
      " guestShare: feed.querySelectorAll('[data-guest-share]').length," +
      " guestFav: feed.querySelectorAll('[data-guest-favorite]').length," +
      " likeBtn: feed.querySelectorAll('[data-like-post]').length," +
      " static: feed.querySelectorAll('.post-action-btn-static').length }; })()");
    check('G1 访客=登录引导卡（锁图标+去登录按钮）且零云卡零演示四钮零 composer', g1 && g1.loginCard && g1.lockIcon === 'lock' && g1.btnText.indexOf('去登录') !== -1 && g1.cards === 1 && g1.cloud === 0 && g1.guestLike === 0 && g1.guestRepost === 0 && g1.guestShare === 0 && g1.guestFav === 0 && g1.likeBtn === 0 && g1.static === 0, JSON.stringify(g1));

    // G2/G3 切 tab 恒登录引导卡（云模式短路在绑定之前——访客零 composer 零云卡）
    await t.evalJs("document.querySelector('[data-tab=\"following\"]').click()");
    await sleep(200);
    const g2 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { loginCard: !!document.getElementById('hubLoginCard'), cloud: feed.querySelectorAll('[data-cloud-id]').length }; })()");
    check('G2 following tab 恒登录引导卡（切 tab 零云卡）', g2 && g2.loginCard && g2.cloud === 0, JSON.stringify(g2));
    await t.evalJs("document.querySelector('[data-tab=\"topic\"]').click()");
    await sleep(200);
    const g3 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { loginCard: !!document.getElementById('hubLoginCard'), cloud: feed.querySelectorAll('[data-cloud-id]').length }; })()");
    check('G3 topic tab 恒登录引导卡（切 tab 零云卡）', g3 && g3.loginCard && g3.cloud === 0, JSON.stringify(g3));

    // G4 发现中心+热门双引导行
    const g4 = await t.evalJs("(() => { var d = document.getElementById('discoveryList'); var tr = document.getElementById('trendingList');" +
      " return { guest: d.textContent.indexOf('登录后探索话题与频道') !== -1, trendGuest: tr.textContent.indexOf('登录后探索话题与频道') !== -1 }; })()");
    check('G4 发现中心+热门双引导行', g4 && g4.guest && g4.trendGuest, JSON.stringify(g4));

    // G5 访客零 API（连 probe 都不发）
    const g5 = await t.evalJs('window.__fetchCalls.length');
    check('G5 访客零 API 调用（含零 probe）', g5 === 0, 'calls=' + g5);

    check('G6 全程 0 console 错误', errs.length === 0, errs.slice(0, 2).join(' | '));
  }

  // ──────────────────────────────────────────────
  // 线上（v0.2.58.26）：假登录 boot 401 整流终态=登录引导卡 + 真帖页六件齐 + 分享弹窗同 id +
  //   访客点赞/转发 toast + 假登录 401 回滚链 + 访客 hub 面
  // ──────────────────────────────────────────────
  async function runLive(t) {
    console.log('── L. 线上（假登录 boot 401 整流）──');

    const l1 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { ver: window.MN_SITE_VERSION, loginCard: !!document.getElementById('hubLoginCard')," +
      " cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " guestLike: feed.querySelectorAll('[data-guest-like]').length," +
      " likeBtn: feed.querySelectorAll('[data-like-post]').length }; })()");
    check('L1 版本 v0.2.58.26', l1.ver === 'v0.2.58.26', 'ver=' + l1.ver);
    check('L1 假登录 boot 终态=登录引导卡（401 整流零云卡零演示签名）', l1 && l1.loginCard && l1.cloud === 0 && l1.guestLike === 0 && l1.likeBtn === 0, JSON.stringify(l1));

    // L2-L5 真帖页链：公共端点取真帖 id 直达（hub 云卡不可得→六件行断言全部迁帖页）
    let livePostId = null;
    try {
      const pr = await fetch(LIVE + '/api/social/posts');
      const pj = await pr.json();
      if (pj && Array.isArray(pj.posts) && pj.posts.length) livePostId = pj.posts[0].id;
    } catch (e) {}
    if (!livePostId) {
      console.log('  ⏭ L2-L5 跳过：线上无帖');
    } else {
      await nav(t, BASE + '/pages/community-post.html?id=' + encodeURIComponent(livePostId));
      await waitFor(t, "(document.getElementById('postDetail').style.display === 'flex') || (document.getElementById('postState404').style.display === 'block')", 20000, '帖页渲染');
      await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
      await patchToast(t);
      await patchClipboard(t);
      const l2 = await t.evalJs("(() => { var b = document.querySelector('#postCardWrap [data-like-post]'); var rp = document.querySelector('#postCardWrap [data-repost-post]');" +
        " var sh = document.querySelector('#postCardWrap [data-share-post]'); var fav = document.querySelector('#postCardWrap [data-favorite-post]');" +
        " var ic = sh ? sh.querySelector('.material-symbols-outlined') : null; var fi = fav ? fav.querySelector('.material-symbols-outlined') : null;" +
        " var vw = null; Array.prototype.forEach.call(document.querySelectorAll('#postCardWrap .post-action-btn-static'), function (x) { var i = x.querySelector('.material-symbols-outlined'); if (i && i.textContent === 'visibility') vw = x; });" +
        " return { hasBtn: !!b, hasFx: b ? !!b.querySelector('.like-fx') : false, hasRepost: !!rp, hasShare: !!sh, hasFav: !!fav," +
        " repostCount: rp ? (rp.querySelector('[data-repost-count]') || {}).textContent : null," +
        " shareIcon: ic ? ic.textContent : null, shareText: sh ? sh.textContent : null," +
        " favConsistent: fav ? (fav.getAttribute('aria-pressed') === 'true') === (fi && fi.textContent === 'star') : false," +
        " viewText: vw ? (vw.textContent.match(/\\d+/) || [null])[0] : null," +
        " order: sh && fav ? sh.parentElement.lastElementChild === sh && sh.parentElement.children[sh.parentElement.children.length - 2] === fav : false," +
        " rightEdge: sh ? Math.round(sh.parentElement.getBoundingClientRect().right - sh.getBoundingClientRect().right) : null," +
        " s404: document.getElementById('postState404').style.display }; })()");
      check('L2 真帖页六件齐（赞带 .like-fx / 转带计数 / 浏览数字 / 星 / 分享）', l2.s404 === 'none' && l2.hasBtn && l2.hasFx && l2.hasRepost && l2.hasShare && l2.hasFav && l2.repostCount != null && /^\d+$/.test(l2.viewText || ''), JSON.stringify(l2));
      check('L2 分享钮纯图标 icon=upload 无「分享」文字 + 星收藏态一致（star ⇔ aria=true）+ 分享最右·星居左邻贴右缘',
        l2.shareIcon === 'upload' && l2.shareText.indexOf('分享') === -1 && l2.favConsistent && l2.order && l2.rightEdge <= 1, JSON.stringify(l2));

      // L3 帖页分享弹窗：URL 与本页同 id + 关闭钮关
      await t.evalJs("document.querySelector('#postCardWrap [data-share-post]').click()");
      await sleep(600);
      const l3 = await t.evalJs("(() => { var inp = document.querySelector('#shareUrlInput');" +
        " var q = window.location.search || '';" +
        " var card = inp ? inp.closest('.modal-card') : null;" +
        " return { dlg: !!inp, val: inp ? inp.value : null," +
        " sameId: inp ? inp.value.indexOf(window.location.pathname) !== -1 && inp.value.indexOf(q.slice(1)) !== -1 : false," +
        " cardOpacity: card ? getComputedStyle(card).opacity : null }; })()");
      check('L3 帖页分享弹窗 URL 与本页同 id + 弹窗卡片真正可见（opacity=1）', l3.dlg && l3.sameId && l3.cardOpacity === '1', JSON.stringify(l3));
      await t.evalJs("document.querySelector('#shareClose').click()");
      await sleep(300);
      check('L3 关闭钮关弹窗', await t.evalJs("!document.querySelector('#shareUrlInput')"), '');

      // L4 真访客：点赞/转发拦截 toast + 零状态变化（boot 整流已清会话→访客；再显式清一次防竞速）
      await clearUser(t);
      await t.send('Page.reload');
      await sleep(1800);
      await waitFor(t, "(document.getElementById('postDetail').style.display === 'flex') || (document.getElementById('postState404').style.display === 'block')", 20000, '访客重载渲染');
      await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
      await patchToast(t);
      await t.evalJs("document.querySelector('#postCardWrap [data-like-post]').click()");
      await sleep(300);
      await t.evalJs("document.querySelector('#postCardWrap [data-repost-post]').click()");
      await sleep(300);
      const l4 = await t.evalJs("(() => { var b = document.querySelector('#postCardWrap [data-like-post]'); var rp = document.querySelector('#postCardWrap [data-repost-post]');" +
        " return { pressed: b.getAttribute('aria-pressed'), pop: b.classList.contains('like-pop'), reposted: rp.classList.contains('reposted')," +
        " backdrops: document.querySelectorAll('.modal-backdrop').length, toasts: window.__toasts.join('|') }; })()");
      check('L4 真访客：点赞 toast 登录后才能点赞 + 转发 toast 登录后才能转发（零动画类零弹窗零置位）',
        l4.pressed === 'false' && !l4.pop && !l4.reposted && l4.backdrops === 0 && l4.toasts.indexOf('登录后才能点赞') !== -1 && l4.toasts.indexOf('登录后才能转发') !== -1, JSON.stringify(l4));

      // L5 假登录真 401 回滚链（与点赞同口径：乐观置位 → 回滚 + toast 登录已过期）
      await seedUser(t);
      await t.send('Page.reload');
      await sleep(1800);
      await waitFor(t, "(document.getElementById('postDetail').style.display === 'flex') || (document.getElementById('postState404').style.display === 'block')", 20000, '假登录重载渲染');
      await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
      await patchToast(t);
      await t.evalJs("document.querySelector('#postCardWrap [data-like-post]').click()");
      await sleep(1400);
      const l5 = await t.evalJs("(() => { var b = document.querySelector('#postCardWrap [data-like-post]');" +
        " return { pressed: b.getAttribute('aria-pressed'), liked: b.classList.contains('liked')," +
        " pop: b.classList.contains('like-pop'), toasts: window.__toasts.join('|') }; })()");
      check('L5 假登录 401 回滚：实心回退 + like-pop 摘除 + toast 登录已过期', l5.pressed === 'false' && !l5.liked && !l5.pop && l5.toasts.indexOf('登录已过期') !== -1, JSON.stringify(l5));
    }

    // L6 访客 hub 面：登录卡 + 三 tab 恒引导卡 + 发现引导行 + 零云卡零演示签名
    await clearUser(t);
    await nav(t, BASE + '/pages/community-hub.html');
    await waitFor(t, "document.getElementById('hubLoginCard')", 30000, '访客登录引导卡');
    await sleep(500);
    const l6 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { loginCard: !!document.getElementById('hubLoginCard'), cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " guestLike: feed.querySelectorAll('[data-guest-like]').length, likeBtn: feed.querySelectorAll('[data-like-post]').length," +
      " disc: document.getElementById('discoveryList').textContent.indexOf('登录后探索话题与频道') !== -1 }; })()");
    check('L6 访客 hub 面：登录卡 + 零云卡零演示签名 + 发现引导行', l6 && l6.loginCard && l6.cloud === 0 && l6.guestLike === 0 && l6.likeBtn === 0 && l6.disc, JSON.stringify(l6));
    await t.evalJs("document.querySelector('[data-tab=\"topic\"]').click()");
    await sleep(200);
    const l6b = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { loginCard: !!document.getElementById('hubLoginCard'), cloud: feed.querySelectorAll('[data-cloud-id]').length }; })()");
    check('L6b 访客切 topic tab 恒登录引导卡', l6b && l6b.loginCard && l6b.cloud === 0, JSON.stringify(l6b));

    check('L7 全程 0 console 错误', errs.length === 0, errs.slice(0, 2).join(' | '));
  }
}

main().catch(e => { console.error('电池异常:', e.message); process.exit(2); });
