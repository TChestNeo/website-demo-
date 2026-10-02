// tmp-battery-community-like-anim.js — v0.2.18.1 点赞实心+动画 + v0.2.18.2 假爱心修复 + v0.2.18.3 粒子照搬参考电池（2026-09-05）
// 用户：「那个点赞后能不能变成实心和有一个动画」（附 like/dislike 参考代码）→「只是要动画而已 一样是用爱心不要换」；
//   「没有变实心啊」→ 线上探针实锤登录态推荐流真帖+演示卡混排、演示卡爱心是死 span → v0.2.18.2 修复；
//   「粒子效果别改颜色啊」「只是把完整的粒子特效搬出来」→ v0.2.18.3 61 粒子色环逐字照搬 + 三动画链原版时长。
// 本地：静态壳 + document-start fetch 罐头（feed 两卡：已点赞 LIKED + 未点赞 ORIG；like POST/DELETE 有状态翻转 +
//   __forceLikeFail 开关测回滚 + localStorage __mn_empty_feed 开关测空态提示；动画断言 = .like-pop 一次性类 +
//   图标/粒子 computed animation-name + 摘除时机（6.25s 最后一档）+ reduced-motion 关动画只换实心 + 初始已点赞卡不重播）。
// v0.2.18.2 新增：H9 云模式推荐流零演示卡零死爱心；H10 空 feed 空态提示卡；G 访客演示卡爱心点击 toast 登录后才能点赞。
// v0.2.18.3 新增：HC1-7 CSSOM 直验规则（61 色环逐字/禁旧色/gravity scale(0.4)/position 5 窗/三动画链/图标弹跳）；H5/P3 摘类时机翻转为飞行中仍在、7s 后摘。
// 线上（LIVE_BASE）：真卡/真帖页双按钮带粒子 span + 真访客拦截 toast + 假登录真 401 回滚链（like-pop 摘除）+
//   L5 云模式零死爱心（修复前线上实测 3 个）+ L6 访客演示卡爱心 toast。
// v0.2.58.26（社区页演示样本全移除）：H1/L1 版本锚 58.24；H9 死爱心口径改「静态 span 含爱心图标=0」
//   （真卡评论/浏览静态 span 合法——旧 static===0 口径失效）；G 段重写=访客登录引导卡（三 tab 恒引导卡+
//   发现中心/热门双引导行+切频道 tab 仍引导+零 API 含零 probe+零演示签名）；H10/P 段零改动；
//   L 段重写=假登录 boot 401 整流终态登录引导卡（/social/feed 401→mn:unauthorized 静默整流零 toast）+
//   真帖页公共端点取真 id 直达+访客拦截+假登录 401 回滚+访客 hub 面三 tab。
// v0.2.58.26 另修：HC/H4/H5/P2 CSSOM 断言随 v0.2.19.0 中心对齐重构修口径——.like-fx 载三动画链、
//   .like-burst 外壳常量 scale(0.4) 零动画（transform 无 animation）、gravity 恢复参考原值 translateY(200px) 不带 scale、
//   chain 选择器 .post-action-btn.like-pop .like-fx（58.19 后社区电池未入舰队从未被扫到，本轮回扫暴露）。
// 跑法：node tmp-battery-community-like-anim.js（LIVE_BASE=<完整站点 URL> 跑线上）
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
  window.__fetchCalls = []; window.__forceLikeFail = false;
  var ORIG = {
    id: 'PST-000101', authorName: '电池作者', avatarUrl: ${JSON.stringify(AVATAR_URI)},
    content: '电池原帖：这是一条用来点爱心点赞的帖子，点一下会变成实心爱心并且炸出彩色粒子。',
    createdAt: '2026-09-05T08:00:00.000Z',
    likeCount: 3, commentCount: 2, likedByMe: false,
    media: [],
    repostOfId: null, repostOf: null, repostCount: 0, repostedByMe: false
  };
  var LIKED = {
    id: 'PST-000102', authorName: '已赞作者', avatarUrl: null,
    content: '这条帖子初始化就是已点赞状态，用来断言初始渲染不带动画类不重播。',
    createdAt: '2026-09-05T09:00:00.000Z',
    likeCount: 5, commentCount: 0, likedByMe: true,
    media: [],
    repostOfId: null, repostOf: null, repostCount: 0, repostedByMe: false
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
const pathOf = t => t.evalJs('window.location.pathname + window.location.search');
// 点赞钮瞬时态快照（aria/类/图标/粒子外壳/粒子点动画/图标动画名；v0.2.19.0 后动画链在 .like-fx 上、外壳 .like-burst 常量 scale）
const likeStateExpr = sel => "(() => { var b = document.querySelector('" + sel + "'); if (!b) return null;" +
  " var icon = b.querySelector('.material-symbols-outlined'); var burst = b.querySelector('.like-burst');" +
  " var fx = burst ? burst.querySelector('.like-fx') : null;" +
  " return { pressed: b.getAttribute('aria-pressed'), liked: b.classList.contains('liked')," +
  " pop: b.classList.contains('like-pop'), icon: icon ? icon.textContent : null," +
  " iconAnim: icon ? getComputedStyle(icon).animationName : null," +
  " burstDisp: burst ? getComputedStyle(burst).display : null," +
  " burstAnim: burst ? getComputedStyle(burst).animationName : null," +
  " shellScale: burst ? getComputedStyle(burst).transform : null," +
  " fxAnim: fx ? getComputedStyle(fx).animationName : null," +
  " count: (b.querySelector('[data-like-count]') || {}).textContent || null }; })()";

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
  // 本地：罐头全矩阵（实心切换 + 一次性动画类 + 粒子 + 回滚 + reduced-motion + 不重播）
  // ──────────────────────────────────────────────
  async function runLocal(t) {
    console.log('── H. Hub 点赞动画（本地罐头）──');

    const ver = await t.evalJs('window.MN_SITE_VERSION');
    check('H1 版本 v0.2.58.26', ver === 'v0.2.58.26', 'ver=' + ver);
    const cardN = await t.evalJs("document.querySelectorAll('[data-cloud-id]').length");
    check('H1 feed 两卡渲染', cardN === 2, 'n=' + cardN);

    // HC v0.2.18.3 照搬参考：CSSOM 直验 keyframes 规则（61 色环逐字、禁旧自创色、gravity 带 scale、position 5 窗、三动画链原版时长）
    //   v0.2.19.0 口径：gravity 恢复参考原值 translateY(200px) 不带 scale；scale(0.4) 在外壳 .like-burst 常量 transform；
    //   三动画链挂在 .like-fx 上（选择器 .post-action-btn.like-pop .like-fx）
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
      "     if (r.type === CSSRule.STYLE_RULE && r.selectorText === '.post-action-btn.like-pop .like-fx') out.chain = r.style.animation;" +
      "     if (r.type === CSSRule.STYLE_RULE && r.selectorText === '.like-burst') out.shell = r.style.transform;" +
      "   } }" +
      " return out; })()");
    // Chrome 把规则样式序列化为 rgb(...)（带逗号）+ 长手写展开（"1.25s ease-out 0s 1 normal forwards running mn-...")——按影子数/分项断言，不按原文串
    const bangDots = hcss && hcss.bang ? (hcss.bang.match(/-?\d+(\.\d+)?px -?\d+(\.\d+)?px/g) || []).length : 0;
    const hasC1 = hcss && hcss.bang && (hcss.bang.indexOf('#8800ff') !== -1 || hcss.bang.indexOf('rgb(136, 0, 255)') !== -1);
    const hasC2 = hcss && hcss.bang && (hcss.bang.indexOf('#0073ff') !== -1 || hcss.bang.indexOf('rgb(0, 115, 255)') !== -1);
    const noOld = hcss && hcss.bang && hcss.bang.indexOf('#e0245e') === -1 && hcss.bang.indexOf('rgb(224, 36, 94)') === -1;
    const chain = hcss && hcss.chain ? hcss.chain.split(', ') : [];
    const chainOk = chain.length === 3 &&
      chain[0].indexOf('1.25s') !== -1 && chain[0].indexOf('ease-out') !== -1 && chain[0].indexOf('mn-fireworks-bang') !== -1 &&
      chain[1].indexOf('1.25s') !== -1 && chain[1].indexOf('ease-in') !== -1 && chain[1].indexOf('mn-fireworks-gravity') !== -1 &&
      chain[2].indexOf('6.25s') !== -1 && chain[2].indexOf('linear') !== -1 && chain[2].indexOf('mn-fireworks-position') !== -1;
    check('HC1 粒子 61 条 box-shadow（照搬参考数量）', bangDots === 61, 'dots=' + bangDots);
    check('HC2 色环含参考首色 #8800ff + 尾色 #0073ff', hasC1 && hasC2, '');
    check('HC3 禁 v0.2.18.1 自创色 #e0245e（照搬不改色）', noOld, '');
    check('HC4 gravity 恢复参考原值 translateY(200px) 不带 scale（scale 在外壳常量）', hcss && hcss.gravity && hcss.gravity.indexOf('translateY(200px)') !== -1 && hcss.gravity.indexOf('scale') === -1, 'g=' + (hcss && hcss.gravity));
    check('HC4b 外壳 .like-burst 常量 scale(0.4)（参考外壳恒缩放零动画）', hcss && hcss.shell && hcss.shell.indexOf('scale(0.4)') !== -1, 's=' + (hcss && hcss.shell));
    check('HC5 position 5 档 margin 游走窗口', hcss && hcss.posWindows === 5, 'w=' + (hcss && hcss.posWindows));
    check('HC6 三动画链原版时长挂 .like-fx（1.25s bang + 1.25s gravity + 6.25s position）', chainOk, 'c=' + (hcss && hcss.chain));
    check('HC7 图标弹跳 like-pop-icon 照参考值（0.5s）', !!hcss.iconPop, '');

    // H2 初始已点赞卡：实心态 + 不重播（无 like-pop、粒子藏）
    const h2 = await t.evalJs(likeStateExpr('[data-cloud-id="PST-000102"] [data-like-post]'));
    check('H2 已点赞卡初始实心态（liked+favorite+粒子藏）', h2 && h2.liked && h2.pressed === 'true' && h2.icon === 'favorite' && h2.burstDisp === 'none', JSON.stringify(h2));
    check('H2 已点赞卡初始不重播（无 like-pop）', h2 && !h2.pop, '');

    // H3 未点赞卡初始空心态
    const h3 = await t.evalJs(likeStateExpr('[data-cloud-id="PST-000101"] [data-like-post]'));
    check('H3 未点赞卡初始空心态', h3 && !h3.liked && h3.pressed === 'false' && h3.icon === 'favorite_border' && !h3.pop, JSON.stringify(h3));

    // H4 点赞瞬间：实心 + like-pop + 图标弹跳动画 + 粒子迸发动画 + POST 捕获
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-like-post]').click()");
    await sleep(120);
    const h4 = await t.evalJs(likeStateExpr('[data-cloud-id="PST-000101"] [data-like-post]'));
    const h4call = await t.evalJs("window.__fetchCalls.filter(function (c) { return c.url.indexOf('/like') !== -1; }).map(function (c) { return c.method + ' ' + c.url; }).join('|')");
    check('H4 点赞瞬间实心 + like-pop 一次性类', h4 && h4.liked && h4.pressed === 'true' && h4.icon === 'favorite' && h4.pop, JSON.stringify(h4));
    check('H4 图标弹跳动画 like-pop-icon', h4 && h4.iconAnim === 'like-pop-icon', 'anim=' + (h4 && h4.iconAnim));
    check('H4 粒子迸发外壳 display:block + .like-fx 三动画链在场', h4 && h4.burstDisp === 'block' && h4.fxAnim.indexOf('mn-fireworks-bang') !== -1 && h4.fxAnim.indexOf('mn-fireworks-gravity') !== -1 && h4.fxAnim.indexOf('mn-fireworks-position') !== -1, 'disp=' + (h4 && h4.burstDisp) + ' fxAnim=' + (h4 && h4.fxAnim));
    check('H4 计数乐观 +1 = 4', h4 && h4.count === '4', 'count=' + (h4 && h4.count));
    check('H4 POST like 已发出', h4call === 'POST /api/social/posts/PST-000101/like', h4call);

    // H5 v0.2.18.3 摘类时机翻转：1.5s 粒子链仍在飞（旧版 950ms 已摘——这正是「特效没好」的原因之一）；7s 后最后一档完才摘
    await sleep(1400);
    const h5 = await t.evalJs(likeStateExpr('[data-cloud-id="PST-000101"] [data-like-post]'));
    check('H5 飞行中（1.5s）：like-pop 仍在 + 粒子外壳 display:block + .like-fx 三动画链在场', h5 && h5.pop && h5.burstDisp === 'block' && h5.fxAnim.indexOf('mn-fireworks-bang') !== -1 && h5.liked && h5.count === '4', JSON.stringify(h5));
    await sleep(5600);
    const h5b = await t.evalJs(likeStateExpr('[data-cloud-id="PST-000101"] [data-like-post]'));
    check('H5b 动画全链完（7s）：无 like-pop + 粒子藏 + 实心态保留', h5b && !h5b.pop && h5b.burstDisp === 'none' && h5b.liked && h5b.pressed === 'true' && h5b.count === '4', JSON.stringify(h5b));

    // H6 取消点赞：空心回退、无动画类、DELETE 捕获、计数回落
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-like-post]').click()");
    await sleep(400);
    const h6 = await t.evalJs(likeStateExpr('[data-cloud-id="PST-000101"] [data-like-post]'));
    const h6call = await t.evalJs("window.__fetchCalls.filter(function (c) { return c.url.indexOf('/like') !== -1; }).map(function (c) { return c.method; }).join('|')");
    check('H6 取消点赞：空心回退 + 无动画类 + 计数回落 3', h6 && !h6.liked && h6.pressed === 'false' && h6.icon === 'favorite_border' && !h6.pop && h6.count === '3', JSON.stringify(h6));
    check('H6 DELETE like 已发出', h6call === 'POST|DELETE', h6call);

    // H7 失败回滚：乐观实心+动画被摘、空心恢复、计数恢复
    await t.evalJs("window.__forceLikeFail = true");
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-like-post]').click()");
    await sleep(600);
    const h7 = await t.evalJs(likeStateExpr('[data-cloud-id="PST-000101"] [data-like-post]'));
    check('H7 失败回滚：空心恢复 + like-pop 摘除 + 计数 3', h7 && !h7.liked && h7.pressed === 'false' && h7.icon === 'favorite_border' && !h7.pop && h7.count === '3', JSON.stringify(h7));
    await t.evalJs("window.__forceLikeFail = false");

    // H8 reduced-motion：关动画只换实心（图标无动画、粒子藏、实心态照常）
    await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await sleep(200);
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-like-post]').click()");
    await sleep(150);
    const h8 = await t.evalJs(likeStateExpr('[data-cloud-id="PST-000101"] [data-like-post]'));
    check('H8 reduced-motion：图标无动画 + 粒子藏 + 实心态照常', h8 && h8.liked && h8.pressed === 'true' && h8.icon === 'favorite' && (h8.iconAnim === 'none' || h8.iconAnim === '') && h8.burstDisp === 'none', JSON.stringify(h8));
    await t.evalJs("document.querySelector('[data-cloud-id=\"PST-000101\"] [data-like-post]').click()"); // 还原空心
    await sleep(400);
    await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: '' }] });

    // H9 云模式推荐流纯度：零演示卡、零死爱心（v0.2.18.2 修复核心——修复前混排 3 个 span 死爱心；
    //   58.24 口径：真卡评论/浏览静态 span 合法，只数静态 span 里含爱心图标的死爱心）
    const h9 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " var staticHeart = 0;" +
      " feed.querySelectorAll('.post-action-btn-static').forEach(function (s) {" +
      "   var ic = s.querySelector('.material-symbols-outlined');" +
      "   if (ic && (ic.textContent === 'favorite' || ic.textContent === 'favorite_border')) staticHeart++; });" +
      " return { staticHeart: staticHeart," +
      " guestLike: feed.querySelectorAll('[data-guest-like]').length," +
      " cloud: feed.querySelectorAll('[data-cloud-id]').length }; })()");
    check('H9 云模式推荐流零演示卡零死爱心（全部真卡）', h9 && h9.staticHeart === 0 && h9.guestLike === 0 && h9.cloud === 2, JSON.stringify(h9));

    // H10 空 feed → 空态提示卡（演示卡不再补位混排）
    await t.evalJs("localStorage.setItem('__mn_empty_feed', '1')");
    await t.send('Page.reload');
    await sleep(1500);
    await waitFor(t, "document.getElementById('feedContent').textContent.indexOf('这里还没有帖子') !== -1", 15000, '空态提示卡');
    const h10 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " static: feed.querySelectorAll('.post-action-btn-static').length," +
      " cards: feed.querySelectorAll('.card').length," +
      " hint: feed.textContent.indexOf('这里还没有帖子') !== -1 }; })()");
    check('H10 空 feed 空态提示卡 + 零云卡零演示卡（cards=发帖框+提示）', h10 && h10.hint && h10.cloud === 0 && h10.static === 0 && h10.cards === 2, JSON.stringify(h10));
    await t.evalJs("localStorage.removeItem('__mn_empty_feed')");
    await t.send('Page.reload');
    await sleep(1000);
    await waitFor(t, "document.querySelectorAll('[data-cloud-id]').length >= 1", 20000, '恢复两卡 feed');

    console.log('── P. 帖页点赞动画（本地罐头）──');
    await nav(t, BASE + '/pages/community-post.html?id=PST-000101');
    await waitFor(t, "document.getElementById('postDetail').style.display === 'flex'", 15000, '帖页渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);

    const p1 = await t.evalJs(likeStateExpr('#postCardWrap [data-like-post]'));
    check('P1 帖页点赞钮在场 + 空心态 + 粒子 span', p1 && p1.pressed === 'false' && p1.icon === 'favorite_border' && !p1.pop && p1.burstDisp === 'none', JSON.stringify(p1));

    await t.evalJs("document.querySelector('#postCardWrap [data-like-post]').click()");
    await sleep(120);
    const p2 = await t.evalJs(likeStateExpr('#postCardWrap [data-like-post]'));
    check('P2 帖页点赞瞬间：实心 + 弹跳 + 粒子三动画链 + 计数 4', p2 && p2.liked && p2.pop && p2.icon === 'favorite' && p2.iconAnim === 'like-pop-icon' && p2.fxAnim.indexOf('mn-fireworks-bang') !== -1 && p2.fxAnim.indexOf('mn-fireworks-position') !== -1 && p2.count === '4', JSON.stringify(p2));

    await sleep(1400);
    const p3 = await t.evalJs(likeStateExpr('#postCardWrap [data-like-post]'));
    check('P3 帖页飞行中（1.5s）：like-pop 仍在 + 粒子在飞 + 实心态', p3 && p3.pop && p3.burstDisp === 'block' && p3.liked && p3.count === '4', JSON.stringify(p3));
    await sleep(5600);
    const p3b = await t.evalJs(likeStateExpr('#postCardWrap [data-like-post]'));
    check('P3b 帖页全链完（7s）：摘类 + 粒子藏 + 实心态保留', p3b && !p3b.pop && p3b.burstDisp === 'none' && p3b.liked && p3b.count === '4', JSON.stringify(p3b));

    // P4 访客：拦截 toast、零动画类、状态不动
    await clearUser(t);
    await t.send('Page.reload');
    await sleep(1600);
    await waitFor(t, "document.getElementById('postDetail').style.display === 'flex'", 15000, '访客重载渲染');
    await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
    await patchToast(t);
    await t.evalJs("document.querySelector('#postCardWrap [data-like-post]').click()");
    await sleep(300);
    const p4 = await t.evalJs("(() => { var b = document.querySelector('#postCardWrap [data-like-post]');" +
      " return { pressed: b.getAttribute('aria-pressed'), pop: b.classList.contains('like-pop'), toasts: window.__toasts.join('|') }; })()");
    check('P4 访客点赞：toast 登录后才能点赞 + 无动画类 + 状态不动', p4.pressed === 'false' && !p4.pop && p4.toasts.indexOf('登录后才能点赞') !== -1, JSON.stringify(p4));

    // P5 已点赞帖页：初始实心态不重播
    await nav(t, BASE + '/pages/community-post.html?id=PST-000102');
    await waitFor(t, "document.getElementById('postDetail').style.display === 'flex'", 15000, '已赞帖页渲染');
    const p5 = await t.evalJs(likeStateExpr('#postCardWrap [data-like-post]'));
    check('P5 已点赞帖页初始实心态不重播（无 like-pop）', p5 && p5.liked && p5.pressed === 'true' && p5.icon === 'favorite' && !p5.pop, JSON.stringify(p5));

    check('P6 全程 0 console 错误（帖页段）', errs.length === 0, errs.slice(0, 2).join(' | '));

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
      " likeBtn: feed.querySelectorAll('[data-like-post]').length," +
      " static: feed.querySelectorAll('.post-action-btn-static').length }; })()");
    check('G1 访客=登录引导卡（锁图标+去登录按钮）且零云卡零演示签名零 composer', g1 && g1.loginCard && g1.lockIcon === 'lock' && g1.btnText.indexOf('去登录') !== -1 && g1.cards === 1 && g1.cloud === 0 && g1.guestLike === 0 && g1.likeBtn === 0 && g1.static === 0, JSON.stringify(g1));

    // G2/G3 切 tab 恒登录引导卡（云模式短路在绑定之前——访客零 composer 零云卡）
    await t.evalJs("document.querySelector('[data-tab=\"following\"]').click()");
    await sleep(200);
    const g2 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { loginCard: !!document.getElementById('hubLoginCard'), cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " active: (document.querySelector('[data-tab=\"following\"]') || {}).className || '' }; })()");
    check('G2 following tab 恒登录引导卡（切 tab 零云卡）', g2 && g2.loginCard && g2.cloud === 0 && g2.active.indexOf('active') !== -1, JSON.stringify(g2));
    await t.evalJs("document.querySelector('[data-tab=\"topic\"]').click()");
    await sleep(200);
    const g3 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { loginCard: !!document.getElementById('hubLoginCard'), cloud: feed.querySelectorAll('[data-cloud-id]').length }; })()");
    check('G3 topic tab 恒登录引导卡（切 tab 零云卡）', g3 && g3.loginCard && g3.cloud === 0, JSON.stringify(g3));

    // G4 发现中心+热门双引导行；切频道 tab 仍引导（访客分支无视 tab）
    const g4 = await t.evalJs("(() => { var d = document.getElementById('discoveryList'); var tr = document.getElementById('trendingList');" +
      " return { guest: d.textContent.indexOf('登录后探索话题与频道') !== -1, trendGuest: tr.textContent.indexOf('登录后探索话题与频道') !== -1 }; })()");
    check('G4 发现中心+热门双引导行', g4 && g4.guest && g4.trendGuest, JSON.stringify(g4));
    await t.evalJs("document.querySelector('[data-dtab=\"channels\"]').click()");
    await sleep(200);
    const g4b = await t.evalJs("document.getElementById('discoveryList').textContent.indexOf('登录后探索话题与频道') !== -1");
    check('G4b 访客切频道 tab 仍引导行', g4b === true);

    // G5 访客零 API（连 probe 都不发）
    const g5 = await t.evalJs('window.__fetchCalls.length');
    check('G5 访客零 API 调用（含零 probe）', g5 === 0, 'calls=' + g5);

    check('G6 全程 0 console 错误（访客段）', errs.length === 0, errs.slice(0, 2).join(' | '));
  }

  // ──────────────────────────────────────────────
  // 线上（v0.2.58.26）：假登录 boot 401 整流终态=登录引导卡 + 真帖页按钮带粒子 span + 真访客拦截 +
  //   假登录真 401 回滚链（动画类摘除）+ 访客 hub 面（三 tab 恒引导卡+发现引导行）
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

    // L2-L4 真帖页链：公共端点取真帖 id 直达（假登录 boot 整流后云卡不再可得）
    let livePostId = null;
    try {
      const pr = await fetch(LIVE + '/api/social/posts');
      const pj = await pr.json();
      if (pj && Array.isArray(pj.posts) && pj.posts.length) livePostId = pj.posts[0].id;
    } catch (e) {}
    if (!livePostId) {
      console.log('  ⏭ L2-L4 跳过：线上无帖');
    } else {
      await nav(t, BASE + '/pages/community-post.html?id=' + encodeURIComponent(livePostId));
      await waitFor(t, "(document.getElementById('postDetail').style.display === 'flex') || (document.getElementById('postState404').style.display === 'block')", 20000, '帖页渲染');
      await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
      await patchToast(t);
      const l2 = await t.evalJs("(() => { var b = document.querySelector('#postCardWrap [data-like-post]');" +
        " return { hasBtn: !!b, hasBurst: b ? !!b.querySelector('.like-burst') : false," +
        " s404: document.getElementById('postState404').style.display }; })()");
      check('L2 真帖页点赞钮 + 粒子 span 在场', l2.s404 === 'none' && l2.hasBtn && l2.hasBurst, JSON.stringify(l2));

      // L3 真访客：拦截 toast + 零动画类（boot 整流已清会话→访客；再显式清一次防竞速）
      await clearUser(t);
      await t.send('Page.reload');
      await sleep(1800);
      await waitFor(t, "(document.getElementById('postDetail').style.display === 'flex') || (document.getElementById('postState404').style.display === 'block')", 20000, '访客重载渲染');
      await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
      await patchToast(t);
      await t.evalJs("document.querySelector('#postCardWrap [data-like-post]').click()");
      await sleep(300);
      const l3 = await t.evalJs("(() => { var b = document.querySelector('#postCardWrap [data-like-post]');" +
        " return { pressed: b.getAttribute('aria-pressed'), pop: b.classList.contains('like-pop'), toasts: window.__toasts.join('|') }; })()");
      check('L3 真访客点赞：toast 登录后才能点赞 + 无动画类', l3.pressed === 'false' && !l3.pop && l3.toasts.indexOf('登录后才能点赞') !== -1, JSON.stringify(l3));

      // L4 假登录真 401：乐观实心+动画 → 回滚摘类 + toast 登录已过期
      await seedUser(t);
      await t.send('Page.reload');
      await sleep(1800);
      await waitFor(t, "(document.getElementById('postDetail').style.display === 'flex') || (document.getElementById('postState404').style.display === 'block')", 20000, '假登录重载渲染');
      await waitFor(t, 'window.MN_Report && window.MN_Report.toast', 10000, 'MN_Report 就绪');
      await patchToast(t);
      // 同步快照：click 后同一任务内立即读乐观态（真 401 回程 <120ms 时异步读必被竞速吞掉，同步读必现）
      const l4mid = await t.evalJs("(function () { var b = document.querySelector('#postCardWrap [data-like-post]');" +
        " b.click();" +
        " var icon = b.querySelector('.material-symbols-outlined');" +
        " return { pressed: b.getAttribute('aria-pressed'), liked: b.classList.contains('liked')," +
        " pop: b.classList.contains('like-pop'), icon: icon.textContent }; })()");
      check('L4 假登录点赞瞬间：乐观实心 + like-pop 动画在场', l4mid && l4mid.liked && l4mid.pop && l4mid.pressed === 'true' && l4mid.icon === 'favorite', JSON.stringify(l4mid));
      await sleep(1400);
      const l4 = await t.evalJs("(() => { var b = document.querySelector('#postCardWrap [data-like-post]');" +
        " return { pressed: b.getAttribute('aria-pressed'), liked: b.classList.contains('liked')," +
        " pop: b.classList.contains('like-pop'), toasts: window.__toasts.join('|') }; })()");
      check('L4 真 401 回滚：实心回退 + like-pop 摘除 + toast 登录已过期', l4.pressed === 'false' && !l4.liked && !l4.pop && l4.toasts.indexOf('登录已过期') !== -1, JSON.stringify(l4));
    }

    // L5 访客 hub 面：登录卡 + 三 tab 恒引导卡 + 发现引导行 + 零云卡零演示签名
    await clearUser(t);
    await nav(t, BASE + '/pages/community-hub.html');
    await waitFor(t, "document.getElementById('hubLoginCard')", 30000, '访客登录引导卡');
    await sleep(500);
    const l5 = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { loginCard: !!document.getElementById('hubLoginCard'), cloud: feed.querySelectorAll('[data-cloud-id]').length," +
      " guestLike: feed.querySelectorAll('[data-guest-like]').length, likeBtn: feed.querySelectorAll('[data-like-post]').length," +
      " disc: document.getElementById('discoveryList').textContent.indexOf('登录后探索话题与频道') !== -1 }; })()");
    check('L5 访客 hub 面：登录卡 + 零云卡零演示签名 + 发现引导行', l5 && l5.loginCard && l5.cloud === 0 && l5.guestLike === 0 && l5.likeBtn === 0 && l5.disc, JSON.stringify(l5));
    await t.evalJs("document.querySelector('[data-tab=\"topic\"]').click()");
    await sleep(200);
    const l5b = await t.evalJs("(() => { var feed = document.getElementById('feedContent');" +
      " return { loginCard: !!document.getElementById('hubLoginCard'), cloud: feed.querySelectorAll('[data-cloud-id]').length }; })()");
    check('L5b 访客切 topic tab 恒登录引导卡', l5b && l5b.loginCard && l5b.cloud === 0, JSON.stringify(l5b));

    check('L6 全程 0 console 错误', errs.length === 0, errs.slice(0, 2).join(' | '));
  }
}

main().catch(e => { console.error('电池异常:', e.message); process.exit(2); });
