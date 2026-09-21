// tmp-battery-xp-social.js — v0.2.49.0 社区/编辑器动作 XP 钩子电池（发帖 +25 / 评论 +2 / 发布文章 120·5）
//   （用户「发布一个评论 +2 一篇文章 +120 发帖 +25」+ 问询钦定「草稿首次发布算新 +120、同草稿再发布 +5、
//   草稿清空重写回 +120」）
// F 静态：hub/post 页 removed 拦截后记分 + 编辑器 publishXPReward；S 浏览器（页内 fetch 桩）：
//   hub 发帖成功 +25（removed 0）/帖页评论成功 +2（removed 0）/编辑器本地首 120 次 5 清空回 120（guest 不计）/
//   编辑器云端发布首 120 次 5；Z 零 console error。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-xpsocial-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

// ── 打桩 state（同进程内存）──
const SC = {
  cloud: { health: 200, status: 'visible' },   // 后端可达：发帖/评论成功（visible）
  removed: { health: 200, status: 'removed' }, // 后端可达：返回 removed 帖/评论（拦截 → 不记 XP）
  demo: { health: 404 },                       // 后端不可达：编辑器本地发布路径
};
let scName = 'demo';
const CLOUD_USER = { id: 'USR-batt-8', displayName: 'Cloud Batt', email: 'cloud@batt.test', citizenId: 'CIT-batt-8', createdAt: '2026-09-01T00:00:00.000Z', tier: 'free', role: 'member', xpGained: 0 };
const POST_STUB = { id: 'PST-batt1', status: 'visible', authorId: 'USR-batt-8', authorName: 'Cloud Batt', avatarUrl: null, content: 'Batt 测试帖', createdAt: '2026-09-15T10:00:00.000Z', likeCount: 3, commentCount: 0, viewCount: 7, repostCount: 0, media: [], repostOfId: null, likedByMe: false, favoritedByMe: false, repostedByMe: false };
let postLog = [];        // POST /api/social/posts 请求记录
let commentLog = [];     // POST .../comments 请求记录
let articleLog = [];     // POST /api/articles 请求记录
let draftGetLog = 0;     // GET /api/drafts/fluidcanvas/main 次数（fcCloudMode 就绪信号）

function json(res, status, body) {
  const b = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(b) });
  res.end(b);
}
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
  const st = SC[scName].status;
  let body = '';
  req.on('data', (d) => { body += d; if (body.length > 1e6) req.destroy(); });
  req.on('end', () => {
    let parsed = null;
    try { parsed = body ? JSON.parse(body) : {}; } catch (e) {}
    if (p === '/api/auth/me') return json(res, 200, { user: CLOUD_USER });
    if (p === '/api/social/activity') return json(res, 200, { days: [] });
    if (p === '/api/social/nations') return json(res, 200, { nations: [] });
    if (p === '/api/social/topics') return json(res, 200, { topics: [] });
    if (p === '/api/social/teams') return json(res, 200, { teams: [] });
    if (p === '/api/social/following') return json(res, 200, { nations: [], topics: [], users: [] });
    if (p === '/api/social/posts') {
      if (req.method === 'GET') return json(res, 200, { posts: [] });
      postLog.push({ content: parsed.content });
      const id = 'PST-batt-' + postLog.length;
      return json(res, 200, { post: Object.assign({}, POST_STUB, { id: id, status: st, content: parsed.content, createdAt: new Date().toISOString() }) });
    }
    let m = p.match(/^\/api\/social\/posts\/([^/]+)$/);
    if (m && req.method === 'GET') return json(res, 200, { post: Object.assign({}, POST_STUB, { id: m[1] }) });
    m = p.match(/^\/api\/social\/posts\/([^/]+)\/comments$/);
    if (m) {
      if (req.method === 'GET') return json(res, 200, { comments: [] });
      commentLog.push({ postId: m[1], content: parsed.content });
      const cid = 'CMT-batt-' + commentLog.length;
      return json(res, 200, { comment: { id: cid, status: st, authorId: 'USR-batt-8', authorName: 'Cloud Batt', content: parsed.content, createdAt: new Date().toISOString(), parentId: parsed.parentId || null, likeCount: 0 } });
    }
    if (p === '/api/drafts/fluidcanvas/main') {
      if (req.method === 'GET') { draftGetLog++; return json(res, 200, { draft: null }); }
      return json(res, 200, { draft: { version: (articleLog.length + 1) } });
    }
    if (p === '/api/articles') {
      articleLog.push({ title: parsed.title });
      return json(res, 200, { article: { id: 'ART-batt-' + articleLog.length, status: 'published' } });
    }
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
const norm = (s) => s.replace(/\r\n/g, '\n');

(async () => {
  // ═══ F 静态检查 ═══
  const hubSrc = norm(fs.readFileSync(path.join(DOCS, 'pages', 'community-hub.html'), 'utf8'));
  const postSrc = norm(fs.readFileSync(path.join(DOCS, 'pages', 'community-post.html'), 'utf8'));
  const fceSrc = norm(fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8'));

  ok('F1 静态：hub 发帖 +25 在 removed 拦截之后（removed 帖不记；i18n 轮起 T() 文案+同行注释）',
    hubSrc.indexOf("addXP('create_post', 25);") !== -1 &&
    hubSrc.indexOf("if (p.status === 'removed') { toastMsg(T('hub.post.removed') || '内容违反社区规则，已被拦截', true); return; }") !== -1 &&
    hubSrc.indexOf("addXP('create_post', 25); // v0.2.49.0 发帖 +25 立得（removed 帖不记）") !== -1);

  ok('F2 静态：帖页评论 +2 在 removed 拦截之后（removed 评论不记）+ 评论区 DOM 追加链保留',
    postSrc.indexOf("addXP('create_comment', 2);") !== -1 &&
    postSrc.indexOf("if (c.status === 'removed') { toastMsg(T('post.comment.removed') || '内容违反社区规则，已被拦截', true); return; }") !== -1 &&
    postSrc.indexOf("addXP('create_comment', 2); // v0.2.49.0 发布评论 +2 立得（removed 评论不记）") !== -1 &&
    postSrc.indexOf("insertAdjacentHTML('beforeend', commentHtml(c, !!c.parentId));") !== -1);

  ok('F3 静态：编辑器 publishXPReward 120/5 判定（仅 addXP 成功置旗 + 清空草稿重置）三发布路径接线（v10.28.41 演示路径改在确认发布弹窗后：confirmPublish 演示/doCreatePublish/PUT 成功）',
    cnt(fceSrc, 'publishXPReward();') === 3 &&
    fceSrc.indexOf("var state = SlatiDB.addXP('publish_article', published ? 5 : 120);") !== -1 &&
    fceSrc.indexOf('if (!published && state) SlatiDB.set(SlatiDB.KEYS.ARTICLE_PUBLISHED, true);') !== -1 &&
    fceSrc.indexOf('window.publishArticle = publishArticle;') !== -1);

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
      await waitFor(cdp, waitExpr, 25000, label);
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
    const xpNow = () => cdp.evalJs("(function(){ return JSON.stringify({ xp: JSON.parse(localStorage.getItem('slati_xp') || '0'), " +
      "flag: localStorage.getItem('slati_article_published') }); })()");
    const setElVal = async (id, val) => {
      const r = await cdp.evalJs("(function(){ var el = document.getElementById(" + JSON.stringify(id) + "); if (!el) return 'MISSING'; el.value = " + JSON.stringify(val) + "; return 'ok'; })()");
      if (r !== 'ok') throw new Error('setElVal 失败: ' + id + ' ' + r);
    };
    // v10.28.41 发布日志弹窗：publishArticle 现在先弹窗，确认发布才走发布（XP 奖励在确认后）
    const publishViaModal = async () => {
      await cdp.evalJs("window.publishArticle()");
      await waitFor(cdp, "document.getElementById('modalBackdrop').classList.contains('active')", 8000, '发布日志弹窗');
      await cdp.evalJs("Array.prototype.slice.call(document.querySelectorAll('#publishLogModal button')).filter(function(b){ return b.textContent.trim() === '确认发布'; })[0].click()");
    };

    // ═══ S1 hub 发帖 +25 立得（cloud 模式：USR- 用户 + 后端可达 → 推荐流真帖+composer）═══
    await setSc('cloud');
    await setLS([
      { k: 'slati_session', v: JSON.stringify({ loggedIn: true }) },
      { k: 'slati_user', v: JSON.stringify({ id: 'USR-batt', displayName: 'Batt' }) },
      { k: 'slati_xp', v: '0' },
      { k: 'slati_xp_gained', remove: true },
      { k: 'slati_xp_topic_pending', remove: true },
      { k: 'slati_xp_last_login', remove: true },
    ]);
    await nav(BASE + '/pages/community-hub.html', "!!document.getElementById('postSubmit')", 'hub composer 就绪(S1)');
    await setElVal('postComposer', 'Batt 发帖测试');
    await cdp.evalJs("document.getElementById('postSubmit').click()");
    for (let i = 0; i < 100; i++) { if (postLog.length === 1) break; await sleep(100); }
    await waitFor(cdp, "JSON.parse(localStorage.getItem('slati_xp') || '0') === 30", 8000, 'S1 发帖 +25');
    let r = await xpNow();
    let s = JSON.parse(r);
    r = await cdp.evalJs("JSON.stringify({ cleared: document.getElementById('postComposer').value === '' })");
    let s1b = JSON.parse(r);
    ok('S1 hub 发帖成功：+25 立得（0+5 每日+25=30）+ 输入框清空 + 打桩收到内容',
      s.xp === 30 && s1b.cleared && postLog.length === 1 && postLog[0].content === 'Batt 发帖测试',
      JSON.stringify(s) + ' ' + JSON.stringify(postLog));

    // ═══ S2 hub removed 帖不记（拦截 → XP 不动 + 输入框保留）═══
    await setSc('removed');
    await setElVal('postComposer', 'Batt 违规测试');
    await cdp.evalJs("document.getElementById('postSubmit').click()");
    for (let i = 0; i < 100; i++) { if (postLog.length === 2) break; await sleep(100); }
    await sleep(600);
    r = await xpNow();
    s = JSON.parse(r);
    r = await cdp.evalJs("JSON.stringify({ kept: document.getElementById('postComposer').value })");
    s1b = JSON.parse(r);
    ok('S2 hub removed 帖不记 XP：30 保持 + 输入框保留内容（拦截分支）+ 打桩收到第二次',
      s.xp === 30 && s1b.kept === 'Batt 违规测试' && postLog.length === 2, JSON.stringify(s) + ' ' + r);

    // ═══ S3 帖页评论 +2（cloud：可见评论 → 记分 + DOM 追加）═══
    await setSc('cloud');
    await nav(BASE + '/pages/community-post.html?id=PST-batt1', "document.getElementById('postDetail').style.display !== 'none'", '帖页就绪(S3)');
    await setElVal('commentInput', 'Batt 评论测试');
    await cdp.evalJs("document.getElementById('commentSubmit').click()");
    for (let i = 0; i < 100; i++) { if (commentLog.length === 1) break; await sleep(100); }
    await waitFor(cdp, "JSON.parse(localStorage.getItem('slati_xp') || '0') === 32", 8000, 'S3 评论 +2');
    r = await xpNow();
    s = JSON.parse(r);
    r = await cdp.evalJs("JSON.stringify({ inList: document.getElementById('commentsList').innerHTML.indexOf('CMT-batt-1') !== -1, cleared: document.getElementById('commentInput').value === '' })");
    s1b = JSON.parse(r);
    ok('S3 帖页评论成功：+2（30→32）+ 评论入列表 + 输入框清空 + 打桩收到内容',
      s.xp === 32 && s1b.inList && s1b.cleared && commentLog.length === 1 && commentLog[0].content === 'Batt 评论测试',
      JSON.stringify(s) + ' ' + JSON.stringify(commentLog));

    // ═══ S4 帖页 removed 评论不记（拦截 → XP 不动 + 不入列表）═══
    await setSc('removed');
    await setElVal('commentInput', 'Batt 违规评论');
    await cdp.evalJs("document.getElementById('commentSubmit').click()");
    for (let i = 0; i < 100; i++) { if (commentLog.length === 2) break; await sleep(100); }
    await sleep(600);
    r = await xpNow();
    s = JSON.parse(r);
    r = await cdp.evalJs("JSON.stringify({ inList: document.getElementById('commentsList').innerHTML.indexOf('CMT-batt-2') !== -1 })");
    s1b = JSON.parse(r);
    ok('S4 帖页 removed 评论不记 XP：32 保持 + 未入列表 + 打桩收到第二次',
      s.xp === 32 && !s1b.inList && commentLog.length === 2, JSON.stringify(s) + ' ' + r);

    // ═══ S5 编辑器本地发布：首 +120 / 再 +5 / 草稿清空重置回 +120 ═══
    await setSc('demo');
    await setLS([
      { k: 'slati_session', v: JSON.stringify({ loggedIn: true }) },
      { k: 'slati_user', v: JSON.stringify({ id: 'batt-tester', displayName: 'Batt' }) },
      { k: 'slati_xp', v: '0' },
      { k: 'slati_xp_gained', remove: true },
      { k: 'slati_article_published', remove: true },
      { k: 'slati_fluidcanvas_draft', remove: true },
      { k: 'slati_xp_last_login', remove: true },
    ]);
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.publishArticle === 'function'", '编辑器就绪(S5)');
    await sleep(1000); // 编辑器重页，等每日奖励/初始渲染落定
    await setElVal('titleInput', 'Batt Local 1');
    await publishViaModal();
    await waitFor(cdp, "JSON.parse(localStorage.getItem('slati_xp') || '0') === 125", 8000, 'S5 首发布 +120');
    r = await xpNow();
    s = JSON.parse(r);
    ok('S5a 编辑器本地首发布：+120（0+5 每日+120=125）+ 旗子置真',
      s.xp === 125 && s.flag === 'true', JSON.stringify(s));
    await publishViaModal(); // 同草稿再发布 = 更新
    await waitFor(cdp, "JSON.parse(localStorage.getItem('slati_xp') || '0') === 130", 8000, 'S5 再发布 +5');
    r = await xpNow();
    s = JSON.parse(r);
    ok('S5b 同草稿再发布：+5（125→130）+ 旗子保持真（改内容也算更新=用户钦定）',
      s.xp === 130 && s.flag === 'true', JSON.stringify(s));
    await setElVal('titleInput', '');
    await cdp.evalJs("window.saveDraft()"); // 标题空且无卡 → 旗子重置（清空草稿=新文章起点）
    await setElVal('titleInput', 'Batt Local 2');
    await publishViaModal();
    await waitFor(cdp, "JSON.parse(localStorage.getItem('slati_xp') || '0') === 250", 8000, 'S5 清空后回 +120');
    r = await xpNow();
    s = JSON.parse(r);
    ok('S5c 草稿清空重写：旗子重置 → 发布回 +120（130→250）',
      s.xp === 250 && s.flag === 'true', JSON.stringify(s));

    // ═══ S6 编辑器 guest 发布不计（addXP 守卫）═══
    await setElVal('titleInput', '');
    await cdp.evalJs("window.saveDraft()"); // 旗子回假，让「guest 不置旗」断言锋利
    await setElVal('titleInput', 'Guest Art');
    await cdp.evalJs("localStorage.removeItem('slati_session')"); // 页内撤会话（不导航，无门禁重定向）
    await publishViaModal();
    await sleep(600);
    r = await xpNow();
    s = JSON.parse(r);
    ok('S6 编辑器 guest 发布：XP 不动（250 保持）+ 旗子不置真（guest 没记上不置旗）',
      s.xp === 250 && s.flag === 'false', JSON.stringify(s));

    // ═══ S7 编辑器云端发布：首 +120 / 再 +5（桩 /api/articles）═══
    await setSc('cloud');
    await setLS([
      { k: 'slati_session', v: JSON.stringify({ loggedIn: true }) },
      { k: 'slati_user', v: JSON.stringify({ id: 'USR-batt-c', displayName: 'Batt' }) },
      { k: 'slati_xp', v: '0' },
      { k: 'slati_xp_gained', remove: true },
      { k: 'slati_article_published', remove: true },
      { k: 'slati_fluidcanvas_draft', remove: true },
      { k: 'slati_xp_last_login', remove: true },
    ]);
    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.publishArticle === 'function'", '编辑器就绪(S7)');
    for (let i = 0; i < 100; i++) { if (draftGetLog >= 1) break; await sleep(150); } // fcCloudMode 就绪信号（syncCloudDraft 拉取）
    await sleep(1000);
    await setElVal('titleInput', 'Cloud Art');
    await publishViaModal();
    for (let i = 0; i < 100; i++) { if (articleLog.length === 1) break; await sleep(100); }
    await waitFor(cdp, "JSON.parse(localStorage.getItem('slati_xp') || '0') === 125", 8000, 'S7 云端首发布 +120');
    r = await xpNow();
    s = JSON.parse(r);
    ok('S7a 编辑器云端首发布：+120（0+5 每日+120=125）+ 旗子置真 + 打桩收到标题',
      s.xp === 125 && s.flag === 'true' && articleLog.length === 1 && articleLog[0].title === 'Cloud Art',
      JSON.stringify(s) + ' ' + JSON.stringify(articleLog));
    await publishViaModal();
    for (let i = 0; i < 100; i++) { if (articleLog.length === 2) break; await sleep(100); }
    await waitFor(cdp, "JSON.parse(localStorage.getItem('slati_xp') || '0') === 130", 8000, 'S7 云端再发布 +5');
    r = await xpNow();
    s = JSON.parse(r);
    ok('S7b 云端同草稿再发布：+5（125→130）+ 打桩收到第二次（更新文章=用户钦定）',
      s.xp === 130 && s.flag === 'true' && articleLog.length === 2, JSON.stringify(s));

    // ═══ Z 零 console error ═══
    ok('Z 零 console error/exception', cdp.errs.length === 0, JSON.stringify(cdp.errs));

    cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
  }
  console.log('\n  ── 结果: ' + PASS + '/' + (PASS + FAIL) + (FAIL === 0 ? ' 全绿 ✅' : ' 有红 ❌'));
  process.exit(FAIL === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
