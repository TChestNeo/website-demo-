// tmp-battery-article-frontend.js — v0.2.55.0 文章前端电池（用户「能不能把文章的前端做好？……搜索看不见有搜索不到我之前按过publish的文章」）
// 问询钦定：①搜索只搜文章 ②首页活动流混入最新文章 ③wiki 普通文章阅读页 ④点赞+收藏+评论
// 验证：S 静态（028 迁移/articles.js q+评论/notifications 三事件/health 60 表 29 版/index 搜索面板+最新文章区块+
//       article.html 四型卡渲染与互动接线/双 i18n 词典 12 语言/site-config 双版本）
//       B 浏览器（fetch 打桩）：阅读页标题+作者行+正文流渲染、卡片 (row,col) 排序、script/on* 消毒实证、
//       flag/text 卡渲染、点赞乐观+同步、收藏、评论列表+提交+removed 不追加、guest 门禁+登录引导 toast、
//       404 占位、语言切换重渲染、首页搜索下拉三态+点击跳转、最新文章区块、全程零异常
// （house CDP 模式；截图全黑纪律，无截图依赖；confirm 对话框自动接受防挂起）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const B2 = path.resolve(__dirname, 'src');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-artfront-batt-' + Date.now());
const USER_DATA_GUEST = path.join(os.tmpdir(), 'mn-cdp-artfront-guest-' + Date.now()); // 全新 profile 无登录态
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
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
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber, raw: JSON.stringify(d).slice(0, 600) }).slice(0, 1000));
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
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

let PASS = 0, FAIL = 0;
function ok(name, cond, detail) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (detail ? '  ' + detail : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
}

// ═══ fetch 打桩 fixture（模拟后端口径）：detail 7 卡（content 含富文本+注入弹、flag、text、乱序 row、
// content 卡含 <script> 与 onerror 属性供消毒实证；v0.2.56.0 增 shield 无图国徽卡 + map 无图兜底卡 +
// character 有图兜底卡）；likeCount 5 likedByMe true；评论 2 条 visible；
// 提交含 'spam' → removed；POST like → {likeCount:7}（服务端口径覆盖乐观值）
const FIXTURE_CONTENT = {
  v: 9,
  title: 'Test Article Title',
  tags: [],
  cards: [
    { id: 'c-late', type: 'content', col: 2, row: 30, colSpan: 12, rowSpan: 6, bgAlpha: 0, baseFontSize: 14,
      content: '<p><b>Late card</b> should render after earlier rows.</p>' },
    { id: 'c-main', type: 'content', col: 2, row: 2, colSpan: 12, rowSpan: 6, bgAlpha: 0, baseFontSize: 14,
      content: '<h2 style="margin:0 0 8px">Heading Two</h2><p><b>Bold lead</b> and <i>italic tail</i>.</p><script>window.__pwned = 1</script><p onerror="window.__pwned2 = 1">para with onerror</p>' },
    { id: 'c-flag', type: 'flag', label: 'Test Flag', col: 16, row: 2, colSpan: 12, rowSpan: 7,
      imgSrc: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20360%22%3E%3Crect%20width%3D%22600%22%20height%3D%22180%22%20fill%3D%22%232E5BFF%22%2F%3E%3Crect%20y%3D%22180%22%20width%3D%22600%22%20height%3D%22180%22%20fill%3D%22%23FFFFFF%22%2F%3E%3C%2Fsvg%3E' },
    { id: 'c-note', type: 'text', label: 'Note', col: 2, row: 12, colSpan: 10, rowSpan: 4,
      content: '<b>Signatories</b><br>— Alice<br>— Bob', background: 'rgba(108,92,231,0.08)' },
    { id: 'c-shield', type: 'shield', label: 'Emblem', col: 32, row: 2, colSpan: 8, rowSpan: 8 },
    { id: 'c-map', type: 'map', label: 'Territorial Map', col: 2, row: 20, colSpan: 10, rowSpan: 6 },
    { id: 'c-char', type: 'character', label: 'King', col: 16, row: 20, colSpan: 10, rowSpan: 6,
      imgSrc: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Ccircle%20cx%3D%2232%22%20cy%3D%2232%22%20r%3D%2230%22%20fill%3D%22%23EAB308%22%2F%3E%3C%2Fsvg%3E' }
  ],
  settings: { snapOn: true, alignOn: true },
  activePreset: '169', presets: {}, groupStyles: {}, pageBg: null, lastSaved: 1750000000000
};
const FIXTURE_DETAIL = { article: {
  id: 'ART-X', title: 'Test Article Title', status: 'published', authorId: 'USR-000001', authorName: 'Alice',
  createdAt: '2026-09-18T10:00:00.000Z', updatedAt: '2026-09-18T10:00:00.000Z',
  contentJson: FIXTURE_CONTENT, viewCount: 42, likeCount: 5, favoriteCount: 2, likedByMe: true, favoritedByMe: false
} };
const FIXTURE_COMMENTS = { comments: [
  { id: 'ACM-000001', articleId: 'ART-X', authorId: 'USR-000002', authorName: 'Bob', avatarUrl: null, content: 'First comment', status: 'visible', createdAt: '2026-09-19T10:00:00.000Z' },
  { id: 'ACM-000002', articleId: 'ART-X', authorId: 'USR-000003', authorName: 'Carol', avatarUrl: null, content: 'Second comment', status: 'visible', createdAt: '2026-09-19T11:00:00.000Z' }
] };
const FIXTURE_LIST = { articles: [
  { id: 'ART-X', title: 'Test Article Title', status: 'published', authorId: 'USR-000001', authorName: 'Alice', createdAt: '2026-09-18T10:00:00.000Z', updatedAt: '2026-09-18T10:00:00.000Z' },
  { id: 'ART-Y', title: 'Constitution Notes', status: 'published', authorId: 'USR-000002', authorName: 'Bob', createdAt: '2026-09-17T10:00:00.000Z', updatedAt: '2026-09-17T10:00:00.000Z' },
  { id: 'ART-Z', title: 'Hidden Draft', status: 'hidden', authorId: 'USR-000001', authorName: 'Alice', createdAt: '2026-09-16T10:00:00.000Z', updatedAt: '2026-09-16T10:00:00.000Z' }
] };
// v0.2.58.28 Round 46：FC 落地页清单=FC_OVERVIEW.articles 真聚合（B19 罐头——与 FIXTURE_LIST 同源映射；
// syncCloudArticles 状态映射 published→published / pending→review / 其余→draft）
const FIX_OVERVIEW = {
  stats: { followers: 1, following: 0, articles: 3, articlesPublished: 2, articleViews: 42, articleLikes: 0,
    articleFavorites: 0, articleShares: 0, posts: 0, postViews: 0, postLikes: 0, postFavorites: 0, postShares: 0,
    repostsReceived: 0, media: 0 },
  windows: {
    '7d': { from: '2026-09-26T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z', newFollowers: 0, newFollowersPct: null, articlesCreated: 0, articlesCreatedPct: null, postsCreated: 0, postsCreatedPct: null, interactionsReceived: 0, interactionsReceivedPct: null, days: [] },
    '28d': { from: '2026-09-05T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z', newFollowers: 0, newFollowersPct: null, articlesCreated: 3, articlesCreatedPct: null, postsCreated: 0, postsCreatedPct: null, interactionsReceived: 0, interactionsReceivedPct: null, days: [] },
    'month': { from: '2026-09-02T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z', newFollowers: 0, newFollowersPct: null, articlesCreated: 3, articlesCreatedPct: null, postsCreated: 0, postsCreatedPct: null, interactionsReceived: 0, interactionsReceivedPct: null, days: [] }
  },
  articles: [
    { id: 'ART-X', title: 'Test Article Title', status: 'published', createdAt: '2026-09-18T10:00:00.000Z', updatedAt: '2026-09-18T10:00:00.000Z', viewCount: 42, likeCount: 0, favoriteCount: 0, shareCount: 0, wordCount: 120 },
    { id: 'ART-Y', title: 'Constitution Notes', status: 'published', createdAt: '2026-09-17T10:00:00.000Z', updatedAt: '2026-09-17T10:00:00.000Z', viewCount: 30, likeCount: 0, favoriteCount: 0, shareCount: 0, wordCount: 95 },
    { id: 'ART-Z', title: 'Hidden Draft', status: 'pending', createdAt: '2026-09-16T10:00:00.000Z', updatedAt: '2026-09-16T10:00:00.000Z', viewCount: 12, likeCount: 0, favoriteCount: 0, shareCount: 0, wordCount: 60 }
  ],
  media: [],
  posts: []
};
let likeState = { liked: false, likeCount: 5 };
let favState = { favorited: false, favoriteCount: 2 };
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' var stubResponse = function (body, status) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status, headers: { "Content-Type": "application/json" } })); }, 0); }); };' +
  ' var FIX_DETAIL = ' + JSON.stringify(FIXTURE_DETAIL) + ';' +
  ' var FIX_COMMENTS = ' + JSON.stringify(FIXTURE_COMMENTS) + ';' +
  ' var FIX_LIST = ' + JSON.stringify(FIXTURE_LIST) + ';' +
  ' var FIX_OVERVIEW = ' + JSON.stringify(FIX_OVERVIEW) + ';' +
  ' window.__stubLike = { liked: false, likeCount: 5 }; window.__stubFav = { favorited: false, favoriteCount: 2 };' +
  ' window.__stubCalls = [];' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url); var method = (opts && opts.method) || "GET";' +
  '  if (u.indexOf("/api/") === -1) return realFetch(url, opts);' +
  '  if (u.indexOf("/api/health") === 0) return stubResponse(JSON.stringify({ status: "ok", db: "ok" }), 200);' +
  '  if (u.indexOf("/api/fc/overview") === 0) {' +
  '   return stubResponse(JSON.stringify(FIX_OVERVIEW), 200);' +
  '  }' +
  '  var id = "ART-X";' +
  '  if (u.indexOf("/api/articles?q=") !== -1) {' +
  '   var q = decodeURIComponent(u.split("q=")[1] || "").toLowerCase();' +
  '   var hit = FIX_LIST.articles.filter(function (a) { return a.title.toLowerCase().indexOf(q) !== -1; });' +
  '   return stubResponse(JSON.stringify({ articles: hit }), 200);' +
  '  }' +
  '  if (u.indexOf("/api/articles") === 0 && u.indexOf("/api/articles/") !== 0) {' +
  '   if (method === "POST") { window.__stubCalls.push({ u: u, method: method }); return stubResponse(JSON.stringify({ article: { id: "ART-NEW1", title: "Fresh Article", status: "published", createdAt: new Date().toISOString() } }), 200); }' +
  '   return stubResponse(JSON.stringify(FIX_LIST), 200);' +
  '  }' +
  '  if (u.indexOf("/api/articles/") === 0) {' +
  '   var m = u.split("/api/articles/")[1]; var parts = m.split("/");' +
  '   if (parts[0] !== "ART-X") return stubResponse(JSON.stringify({ error: { code: "NOT_FOUND" } }), 404);' +
  '   if (parts[1] === "comments") {' +
  '    if (method === "GET") return stubResponse(JSON.stringify(FIX_COMMENTS), 200);' +
  '    if (method === "POST") {' +
  '     var body = JSON.parse((opts && opts.body) || "{}");' +
  '     if (String(body.content || "").indexOf("spam") !== -1) {' +
  '      return stubResponse(JSON.stringify({ comment: { id: "ACM-000099", articleId: "ART-X", authorId: "USR-000001", authorName: "Tester", avatarUrl: null, content: body.content, status: "removed", createdAt: new Date().toISOString() }, moderation: { verdict: "reject", reasonCode: "zero_tolerance" } }), 200);' +
  '     }' +
  '     return stubResponse(JSON.stringify({ comment: { id: "ACM-000100", articleId: "ART-X", authorId: "USR-000001", authorName: "Tester", avatarUrl: null, content: body.content, status: "visible", createdAt: new Date().toISOString() }, moderation: { verdict: "pass" } }), 200);' +
  '    }' +
  '   }' +
  '   if (method === "PUT") { window.__stubCalls.push({ u: u, method: method }); return stubResponse(JSON.stringify({ article: { id: "ART-X", title: "Test Article Title", status: "published", updatedAt: new Date().toISOString() } }), 200); }' +
  '   if (method === "DELETE") { window.__stubCalls.push({ u: u, method: method }); return stubResponse(JSON.stringify({ deleted: true, id: "ART-X" }), 200); }' +
  '   return stubResponse(JSON.stringify(FIX_DETAIL), 200);' +
  '  }' +
  '  if (u.indexOf("/api/social/articles/") === 0) {' +
  '   if (u.indexOf("/like") !== -1) {' +
  '    if (method === "POST") { window.__stubLike.liked = true; window.__stubLike.likeCount = 7; return stubResponse(JSON.stringify({ liked: true, likeCount: 7 }), 200); }' +
  '    window.__stubLike.liked = false; window.__stubLike.likeCount = 6; return stubResponse(JSON.stringify({ liked: false, likeCount: 6 }), 200);' +
  '   }' +
  '   if (u.indexOf("/favorite") !== -1) {' +
  '    if (method === "POST") { window.__stubFav.favorited = true; window.__stubFav.favoriteCount = 3; return stubResponse(JSON.stringify({ favorited: true, favoriteCount: 3 }), 200); }' +
  '    window.__stubFav.favorited = false; window.__stubFav.favoriteCount = 2; return stubResponse(JSON.stringify({ favorited: false, favoriteCount: 2 }), 200);' +
  '   }' +
  '  }' +
  '  return stubResponse(JSON.stringify({ error: { code: "NOT_FOUND" } }), 404);' +
  ' };' +
  '})();}catch(e){}';

(async () => {
  // ═══ S 静态检查 ═══
  const read = (p) => fs.readFileSync(p, 'utf8');
  const mig028 = read(path.join(__dirname, 'migrations', '028_article_comments.sql'));
  const articlesJs = read(path.join(B2, 'routes', 'public', 'articles.js'));
  const notifJs = read(path.join(B2, 'routes', 'public', 'notifications.js'));
  const healthTest = read(path.join(__dirname, 'test', 'health.test.js'));
  const migTest = read(path.join(__dirname, 'test', 'migrations.test.js'));
  const idx = read(path.join(DOCS, 'index.html'));
  const art = read(path.join(DOCS, 'pages', 'article.html'));
  const artI18n = read(path.join(DOCS, 'assets', 'i18n', 'article.i18n.js'));
  const idxI18n = read(path.join(DOCS, 'assets', 'i18n', 'index.i18n.js'));
  const sconf = read(path.join(DOCS, 'assets', 'js', 'site-config.js'));

  ok('S1 028 迁移：article_comments 表 + id TEXT UNIQUE 可空（insertWithId 契约）+ ACM- 前缀 + FK 级联 + status CHECK',
    mig028.indexOf('CREATE TABLE article_comments') !== -1 && mig028.indexOf('id         TEXT UNIQUE') !== -1 &&
    mig028.indexOf('id TEXT NOT NULL UNIQUE') === -1 && mig028.indexOf('ACM-') !== -1 &&
    mig028.indexOf('REFERENCES articles(id) ON DELETE CASCADE') !== -1 &&
    mig028.indexOf("status IN ('visible','hidden','removed')") !== -1);
  ok('S2 articles.js：q 搜索 LIKE ESCAPE 转义 + 只搜 published + 评论 GET/POST + commentRow avatarUrl + 限流键 acw',
    articlesJs.indexOf("q.replace(/[%_\\\\]/g") !== -1 && articlesJs.indexOf("ESCAPE '\\\\'") !== -1 &&
    articlesJs.indexOf("status = 'published'") !== -1 && articlesJs.indexOf("/api/articles/:id/comments") !== -1 &&
    articlesJs.indexOf('avatarUrl') !== -1 && articlesJs.indexOf("'acw:user:'") !== -1);
  ok('S3 notifications.js：article_comment 事件从 article_comments 联查',
    notifJs.indexOf("push('article_comment'") !== -1 && notifJs.indexOf('FROM article_comments c JOIN articles a') !== -1);
  ok('S4 测试锚：health 66 表 + user_version 33 + migrations 头注释 033',
    healthTest.indexOf('data.tables, 66') !== -1 && healthTest.indexOf("user_version', { simple: true }), 33") !== -1 &&
    migTest.indexOf('033') !== -1);
  ok('S5 index.html：搜索输入+面板+防抖三态+最新文章区块+article 跳转锚（搜索行/最新文章/通知三处）',
    idx.indexOf('id="dashSearchInput"') !== -1 && idx.indexOf('id="dashSearchPanel"') !== -1 &&
    idx.indexOf('dashSearchTimer') !== -1 && idx.indexOf('id="latestArticlesSection"') !== -1 &&
    (idx.match(/pages\/article\.html\?id=/g) || []).length >= 3 &&
    idx.indexOf('placeholder="搜索文章…"') !== -1);
  ok('S6 index.html：通知第八类 article_comment 文案+跳转分支 + 三态 i18n 键调用',
    idx.indexOf("case 'article_comment': return T('index.notif.articleComment')") !== -1 &&
    idx.indexOf("type === 'article_like' || type === 'article_favorite' || type === 'article_comment'") !== -1 &&
    idx.indexOf("T('index.search.searching')") !== -1 && idx.indexOf("T('index.search.noResults')") !== -1 &&
    idx.indexOf("T('index.search.unavailable')") !== -1);
  ok('S7 article.html：阅读页骨架（wrap/title/meta/正文流/评论区）+ 三件套 + __articleI18nRefresh + pre-stagger art-present',
    art.indexOf('article-page-wrap') !== -1 && art.indexOf('id="artTitle"') !== -1 && art.indexOf('id="artBody"') !== -1 &&
    art.indexOf('id="commentsList"') !== -1 && art.indexOf('article.i18n.js') !== -1 &&
    art.indexOf('window.__articleI18nRefresh') !== -1 && art.indexOf('class="pre-stagger art-present"') !== -1 &&
    art.indexOf('ethereal.css 内联') !== -1 && art.indexOf('Material Symbols Outlined') !== -1);
  ok('S8 article.html：draft v9 卡渲染（四型+盾徽+兜底）+ (row,col) 排序 + 消毒 + 互动端点 + 访客引导',
    art.indexOf("card.type === 'content'") !== -1 && art.indexOf("card.type === 'img' || card.type === 'bitmap' || card.type === 'flag' || card.type === 'shield'") !== -1 &&
    art.indexOf("card.type === 'text'") !== -1 && art.indexOf('a.row || 0) - (b.row || 0)') !== -1 &&
    art.indexOf('CARD_TYPE_ICONS') !== -1 && art.indexOf('class="art-emblem"') !== -1 && art.indexOf('class="art-asset"') !== -1 &&
    art.indexOf('sanitizeCardHtml') !== -1 && art.indexOf('/social/articles/') !== -1 &&
    art.indexOf("'/articles/' + encodeURIComponent(articleId) + '/comments'") !== -1 &&
    art.indexOf('signup-and-login.html?next=') !== -1 && art.indexOf("SlatiDB.addXP('create_comment', 2)") !== -1);
  ok('S9 article.i18n.js：zh 23 键 + en 链 + zh-Hant 自动段（OpenCC 已重跑）',
    artI18n.indexOf("'article.back': '返回首页'") !== -1 && artI18n.indexOf("add('en'") !== -1 &&
    artI18n.indexOf('__ZH_HANT_AUTO__') !== -1 && (artI18n.match(/'article\./g) || []).length >= 23);
  ok('S10 index.i18n.js：新键 11 语言（latestArticles/searching/notif.articleComment）+ searchPh 文章口径 + zh-Hant 自动段',
    (idxI18n.match(/'index\.latestArticles'/g) || []).length >= 11 && (idxI18n.match(/'index\.search\.searching'/g) || []).length >= 11 &&
    (idxI18n.match(/'index\.notif\.articleComment'/g) || []).length >= 11 &&
    idxI18n.indexOf("'index.searchPh': '搜索文章…'") !== -1 && idxI18n.indexOf("'index.searchPh': 'Search articles...'") !== -1 &&
    idxI18n.indexOf('搜索世界、话题') === -1 && idxI18n.indexOf('__ZH_HANT_AUTO__') !== -1);
  ok('S11 site-config：v0.2.57.1 + changelog 文章前端条目 + FC v10.28.39.0',
    sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.58.28';") !== -1 &&
    sconf.indexOf('文章前端') !== -1 && sconf.indexOf('article_comments') !== -1 &&
    sconf.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.62.4';") !== -1);

  // ── v0.2.55.1 发布去重复 + 删除 ──
  const editor = read(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'));
  const fclist = read(path.join(DOCS, 'pages', 'fluidcanvas.html'));
  const awTest = read(path.join(__dirname, 'test', 'article-write.test.js'));
  ok('S12 articles.js PUT/DELETE 端点（本人校验/互动行清理/级联）+ article-write 4 测',
    articlesJs.indexOf("router.add('PUT', '/api/articles/:id'") !== -1 &&
    articlesJs.indexOf("router.add('DELETE', '/api/articles/:id'") !== -1 &&
    articlesJs.indexOf('只能修改自己的文章') !== -1 && articlesJs.indexOf('只能删除自己的文章') !== -1 &&
    articlesJs.indexOf("DELETE FROM content_likes WHERE target_type = 'article'") !== -1 &&
    articlesJs.indexOf("DELETE FROM favorites WHERE target_type = 'article'") !== -1 &&
    awTest.indexOf("PUT：本人更新") !== -1 && awTest.indexOf('DELETE：本人删除 + 评论级联') !== -1);
  ok('S13 编辑器：publish id 记忆 + PUT 更新分支 + 404/403 回退 + 草稿清空作废 + ?edit= 加载 + boot 分支',
    editor.indexOf("var PUBLISH_ID_KEY = 'slati_article_publish_id'") !== -1 &&
    editor.indexOf("method: 'PUT'") !== -1 && editor.indexOf("'已更新发布'") !== -1 &&
    editor.indexOf('doCreatePublish(draft)') !== -1 &&
    editor.indexOf('setPublishId(null); // v0.2.55.1: 草稿清空') !== -1 &&
    editor.indexOf('function isEditParam()') !== -1 && editor.indexOf('function loadArticleForEdit()') !== -1 &&
    editor.indexOf("setPublishId(id);") !== -1 &&
    editor.indexOf("} else if (isEditParam()) {") !== -1);
  ok('S14 FC 列表：全清单皆云端（FC_OVERVIEW 驱动）+ 无条件 danger 钮 + DELETE API + Edit 带 ?edit=（cloudIds 旧族全撤）',
    fclist.indexOf("a.cloud ? '' :") === -1 &&
    fclist.indexOf('cloudIds.forEach') === -1 &&
    fclist.indexOf("MN_API.request('/articles/' + encodeURIComponent(id), { method: 'DELETE' })") !== -1 &&
    fclist.indexOf("'fluidcanvas-editor.html?edit=' + encodeURIComponent(id)") !== -1 &&
    fclist.indexOf('var cloudArticles') !== -1 &&
    fclist.indexOf('FC_OVERVIEW.articles.map') !== -1);

  // ═══ 浏览器场景（登录态 Chrome #1）═══
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }

  const spawnChrome = (port, profile) => spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1320,900', '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore' });
  const connectCdp = async (port) => {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    return cdp;
  };
  const nav = async (cdp, url, waitExpr, label) => {
    await cdp.send('Page.navigate', { url });
    await waitFor(cdp, waitExpr, 20000, label);
    await sleep(700);
  };

  let chrome = spawnChrome(CDP_PORT, USER_DATA);
  try {
    const cdp = await connectCdp(CDP_PORT);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) +
        ');localStorage.setItem("slati_user", ' + JSON.stringify(JSON.stringify({ id: 'USR-000001', displayName: 'Tester', email: 't@x.com', avatarUrl: null })) + ');}catch(e){}'
    });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });

    // ── B1-B9 阅读页渲染与互动 ──
    await nav(cdp, BASE + '/pages/article.html?id=ART-X',
      "document.getElementById('articleDetail').style.display === 'flex'", 'B 文章渲染');
    ok('B1 标题 + 作者行（首字母圆头像 A + 名字 Alice + 主页锚 + 日期 + 浏览数 42）',
      await cdp.evalJs("document.getElementById('artTitle').textContent") === 'Test Article Title' &&
      await cdp.evalJs("document.getElementById('artAuthorAvatar').textContent") === 'A' &&
      await cdp.evalJs("document.getElementById('artAuthorLink').textContent") === 'Alice' &&
      await cdp.evalJs("document.getElementById('artAuthorLink').getAttribute('href')") === 'community-profile.html?id=USR-000001' &&
      await cdp.evalJs("document.getElementById('artDate').textContent") === '2026-09-18' &&
      await cdp.evalJs("document.getElementById('artViews').textContent") === '42');
    ok('B2 正文流 2 张 content 卡 + baseFontSize 内联 + 富文本 h2/p/b/i 保留',
      await cdp.evalJs("document.querySelectorAll('#artBody .art-flow').length") === 2 &&
      await cdp.evalJs("document.querySelector('#artBody .art-flow').style.fontSize") === '14px' &&
      await cdp.evalJs("document.querySelector('#artBody .art-flow h2')") !== null &&
      await cdp.evalJs("document.querySelector('#artBody .art-flow b')") !== null &&
      await cdp.evalJs("document.querySelector('#artBody .art-flow i')") !== null);
    ok('B3 消毒实证：script 不执行（__pwned 未定义）+ script 节点 0 + onerror 属性被剥',
      await cdp.evalJs('window.__pwned') === undefined &&
      await cdp.evalJs("document.querySelectorAll('#artBody script').length") === 0 &&
      await cdp.evalJs("document.querySelectorAll('#artBody [onerror]').length") === 0);
    ok('B4a flag 卡：figure.art-figure + img 挂 data URI + figcaption label',
      await cdp.evalJs("(function(){ var f = document.querySelector('#artBody .art-figure'); var i = f && f.querySelector('img'); return !!f && !!i && i.src.indexOf('data:image/svg+xml') === 0; })()") === true &&
      await cdp.evalJs("(function(){ var f = document.querySelector('#artBody .art-figure'); return !!f.querySelector('figcaption') && f.querySelector('figcaption').textContent === 'Test Flag'; })()") === true);
    ok('B4b text 卡：art-note + 内联 rgba 底 + 富文本 b/br 保留',
      await cdp.evalJs("(function(){ var n = document.querySelector('#artBody .art-note'); return !!n && !!n.style.background && n.style.background.replace(/\\s/g, '').indexOf('rgba(108,92,231,0.08)') !== -1; })()") === true &&
      await cdp.evalJs("(function(){ var n = document.querySelector('#artBody .art-note'); return !!n && !!n.querySelector('b') && !!n.querySelector('br'); })()") === true);
    ok('B4c shield 无图国徽卡：art-emblem + shield 图标 + Emblem 标签（v0.2.56.0 不再静默丢弃）',
      await cdp.evalJs("(function(){ var e = document.querySelector('#artBody .art-emblem'); return !!e && !!e.querySelector('.material-symbols-outlined') && e.querySelector('.material-symbols-outlined').textContent === 'shield' && !!e.querySelector('.art-emblem-label'); })()") === true &&
      await cdp.evalJs("(function(){ var e = document.querySelector('#artBody .art-emblem'); return e.querySelector('.art-emblem-label').textContent === 'Emblem'; })()") === true);
    ok('B4d map 无图兜底卡：art-asset + map 图标 + Territorial Map 标签',
      await cdp.evalJs("(function(){ var a = document.querySelector('#artBody .art-asset'); return !!a && a.querySelector('.material-symbols-outlined').textContent === 'map' && a.textContent.indexOf('Territorial Map') !== -1; })()") === true);
    ok('B4e character 有图兜底卡：第二个 figure + figcaption King',
      await cdp.evalJs("(function(){ var fs = document.querySelectorAll('#artBody .art-figure'); return fs.length === 2 && !!fs[1].querySelector('figcaption') && fs[1].querySelector('figcaption').textContent === 'King'; })()") === true);
    ok('B5 卡序按 (row,col)：row2 的 content 卡先于 row30 的 Late card',
      await cdp.evalJs("(function(){ var fs = document.querySelectorAll('#artBody .art-flow'); return fs[0].textContent.indexOf('Heading Two') !== -1 && fs[1].textContent.indexOf('Late card') !== -1; })()") === true);
    ok('B6 点赞初始态（aria-pressed true + liked 类 + 计数 5）',
      await cdp.evalJs("document.getElementById('artLikeBtn').getAttribute('aria-pressed')") === 'true' &&
      await cdp.evalJs("document.getElementById('artLikeBtn').classList.contains('liked')") === true &&
      await cdp.evalJs("document.getElementById('artLikeCount').textContent") === '5');
    await cdp.evalJs("document.getElementById('artLikeBtn').click()");
    await waitFor(cdp, "document.getElementById('artLikeCount').textContent === '6'", 10000, 'B6b 取消点赞');
    ok('B6b 取消点赞（likedByMe 初始 true → 第一次点击=DELETE）→ 计数 6 + pressed false + liked 类摘除',
      await cdp.evalJs("document.getElementById('artLikeBtn').getAttribute('aria-pressed')") === 'false' &&
      await cdp.evalJs("document.getElementById('artLikeBtn').classList.contains('liked')") === false);
    await cdp.evalJs("document.getElementById('artLikeBtn').click()");
    await waitFor(cdp, "document.getElementById('artLikeCount').textContent === '7'", 10000, 'B6c 再点赞');
    ok('B6c 再点赞（POST）→ 服务端 7 同步 + pressed true + liked 类回来',
      await cdp.evalJs("document.getElementById('artLikeBtn').getAttribute('aria-pressed')") === 'true' &&
      await cdp.evalJs("document.getElementById('artLikeBtn').classList.contains('liked')") === true);
    await cdp.evalJs("document.getElementById('artFavBtn').click()");
    ok('B7 收藏：点击 → star + favorited 类（无计数显示）',
      await waitFor(cdp, "document.getElementById('artFavBtn').getAttribute('aria-pressed') === 'true'", 10000, 'B7 收藏') === true &&
      await cdp.evalJs("document.getElementById('artFavBtn').querySelector('.material-symbols-outlined').textContent") === 'star' &&
      await cdp.evalJs("document.getElementById('artFavBtn').classList.contains('favorited')") === true);
    ok('B8 评论列表 2 条（名字/内容/相对时间渲染）+ 空态不在',
      await cdp.evalJs("document.querySelectorAll('#commentsList .comment-item').length") === 2 &&
      await cdp.evalJs("document.querySelector('#commentsList .comment-item').textContent.indexOf('Bob') !== -1") === true &&
      await cdp.evalJs("document.querySelector('#commentsList .comment-item').textContent.indexOf('First comment') !== -1") === true &&
      await cdp.evalJs("document.querySelector('#commentsList p.comment-empty')") === null);
    await cdp.evalJs("(function(){ var i = document.getElementById('commentInput'); i.value = 'A fresh comment'; document.getElementById('commentSubmit').click(); })()");
    await waitFor(cdp, "document.querySelectorAll('#commentsList .comment-item').length === 3", 10000, 'B8 评论追加');
    ok('B8b 提交评论 → 追加 1 条（共 3）+ 输入框清空',
      await cdp.evalJs("document.querySelectorAll('#commentsList .comment-item').length") === 3 &&
      await cdp.evalJs("document.querySelector('#commentsList .comment-item:last-child').textContent.indexOf('A fresh comment') !== -1") === true &&
      await cdp.evalJs("document.getElementById('commentInput').value") === '');
    await cdp.evalJs("(function(){ var i = document.getElementById('commentInput'); i.value = 'spam content'; document.getElementById('commentSubmit').click(); })()");
    await sleep(1200);
    ok('B9 removed 评论不追加（仍 3 条）+ 拦截 toast 在场',
      await cdp.evalJs("document.querySelectorAll('#commentsList .comment-item').length") === 3 &&
      await cdp.evalJs("Array.from(document.querySelectorAll('div')).some(function(d){ return d.style.position === 'fixed' && d.textContent.indexOf('内容违反社区规则') !== -1; })") === true);
    await cdp.evalJs("(function(){ document.getElementById('commentInput').value = '   '; document.getElementById('commentSubmit').click(); })()");
    ok('B10 空评论 → 拦截 toast（内容需 1-2000 字符）',
      await waitFor(cdp, "Array.from(document.querySelectorAll('div')).some(function(d){ return d.style.position === 'fixed' && d.textContent.indexOf('内容需 1-2000 字符') !== -1; })", 10000, 'B10 空评论 toast') === true);

    // ── B11 语言切换重渲染（en）──
    await cdp.evalJs("MN_I18N.setLang('en')");
    await sleep(700);
    ok('B11 切 en：评论标题变 Comments + 返回链接 Back to Home + 占位英文 + 评论列表重渲染不丢（仍 3 条）',
      await cdp.evalJs("document.querySelector('#articleDetail h3').textContent") === 'Comments' &&
      await cdp.evalJs("document.querySelector('.back-link').textContent.indexOf('Back to Home') !== -1") === true &&
      await cdp.evalJs("document.getElementById('commentInput').getAttribute('placeholder')") === 'Write a comment…' &&
      await cdp.evalJs("document.querySelectorAll('#commentsList .comment-item').length") === 3);
    await cdp.evalJs("MN_I18N.setLang('zh')");
    await sleep(500);

    // ── B12 404 占位 ──
    await nav(cdp, BASE + '/pages/article.html?id=ART-MISSING',
      "document.getElementById('articleState404').style.display === 'block'", 'B12 404');
    ok('B12 404 占位在场 + notFound 文案 + detail 隐藏',
      await cdp.evalJs("document.getElementById('articleState404').style.display") === 'block' &&
      await cdp.evalJs("document.getElementById('articleState404').querySelector('h2').textContent") === '文章不存在或未公开' &&
      await cdp.evalJs("document.getElementById('articleDetail').style.display") === 'none');

    // ── B13-B14 首页：搜索下拉 + 最新文章区块（登录态）──
    await nav(cdp, BASE + '/index.html', "document.getElementById('latestArticlesSection').style.display === 'block'", 'B13 首页');
    ok('B13 最新文章区块显示 + 只渲染 published（ART-X/ART-Y 2 行，hidden 不出现）',
      await cdp.evalJs("document.getElementById('latestArticlesSection').style.display") === 'block' &&
      await cdp.evalJs("document.querySelectorAll('#latestArticles .latest-article').length") === 2 &&
      await cdp.evalJs("document.getElementById('latestArticles').textContent.indexOf('Hidden Draft')") === -1);
    ok('B14 最新文章行锚到 pages/article.html?id=',
      await cdp.evalJs("document.querySelector('#latestArticles .latest-article').getAttribute('href')") === 'pages/article.html?id=ART-X');
    await cdp.evalJs("(function(){ var i = document.getElementById('dashSearchInput'); i.value = 'con'; i.dispatchEvent(new Event('input')); })()");
    await waitFor(cdp, "document.querySelectorAll('.dash-search-item').length === 1", 10000, 'B14 搜索下拉');
    ok('B14b 搜索下拉 1 行（Constitution Notes 命中、大小写不敏感）+ 行锚到 article.html',
      await cdp.evalJs("document.querySelector('.dash-search-item').textContent.indexOf('Constitution Notes') !== -1") === true &&
      await cdp.evalJs("document.querySelector('.dash-search-item').getAttribute('href')") === 'pages/article.html?id=ART-Y');
    await cdp.evalJs("(function(){ var i = document.getElementById('dashSearchInput'); i.value = 'zzz'; i.dispatchEvent(new Event('input')); })()");
    ok('B14c 无结果三态：zzz → 没有找到相关文章',
      await waitFor(cdp, "Array.from(document.querySelectorAll('.dash-search-state')).some(function(s){ return s.textContent.indexOf('没有找到相关文章') !== -1; })", 10000, 'B14c 无结果') === true);
    ok('B14d Escape 关闭面板',
      await cdp.evalJs("document.getElementById('dashSearchInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))") !== undefined &&
      await cdp.evalJs("document.getElementById('dashSearchPanel').style.display") === 'none');

    // ── B16-B19 编辑器发布去重复 + FC 列表删除（v0.2.55.1）──
    await cdp.evalJs("try{localStorage.removeItem('slati_article_publish_id');localStorage.removeItem('slati_fluidcanvas_draft');}catch(e){}");
    await nav(cdp, BASE + '/pages/fluidcanvas-editor.html?edit=ART-X',
      "document.getElementById('titleInput').value === 'Test Article Title'", 'B16 edit 加载');
    ok('B16 ?edit= 加载：标题回填 + publish id 记忆 + 画布卡片恢复',
      await cdp.evalJs("document.getElementById('titleInput').value") === 'Test Article Title' &&
      await cdp.evalJs("localStorage.getItem('slati_article_publish_id')") === 'ART-X' &&
      await cdp.evalJs("document.querySelectorAll('.grid-card').length") > 0);
    await cdp.evalJs("window.__stubCalls = []");
    await cdp.evalJs("document.querySelector('button[onclick=\"publishArticle()\"]').click()");
    await waitFor(cdp, "document.getElementById('modalBackdrop').classList.contains('active')", 10000, 'B17 发布日志弹窗');
    await cdp.evalJs("(function(){ var ta=document.getElementById('pubLogInput'); ta.value='B17 更新日志'; ta.dispatchEvent(new Event('input',{bubbles:true})); })()");
    await cdp.evalJs("Array.prototype.slice.call(document.querySelectorAll('#publishLogModal button')).filter(function(b){ return b.textContent.trim() === '确认发布'; })[0].click()");
    await waitFor(cdp, "document.getElementById('toast').textContent === '已更新发布'", 10000, 'B17 PUT 更新');
    ok('B17 已发布文章再点 Publish = 发布日志弹窗 → 确认 = PUT 更新原文章（恰 1 次 PUT、零新 POST）',
      await cdp.evalJs("window.__stubCalls.length") === 1 &&
      await cdp.evalJs("window.__stubCalls[0].method") === 'PUT' &&
      await cdp.evalJs("window.__stubCalls[0].u.indexOf('/api/articles/ART-X') === 0") === true);
    await cdp.evalJs("try{localStorage.removeItem('slati_article_publish_id');localStorage.removeItem('slati_fluidcanvas_draft');}catch(e){}");
    await nav(cdp, BASE + '/pages/fluidcanvas-editor.html',
      "!!document.getElementById('titleInput')", 'B18 空白编辑器');
    await cdp.evalJs("window.__stubCalls = []");
    await cdp.evalJs("(function(){ var t = document.getElementById('titleInput'); t.value = 'Fresh Article'; })()");
    await cdp.evalJs("document.querySelector('button[onclick=\"publishArticle()\"]').click()");
    await waitFor(cdp, "document.getElementById('modalBackdrop').classList.contains('active')", 10000, 'B18 发布日志弹窗');
    await cdp.evalJs("(function(){ var ta=document.getElementById('pubLogInput'); ta.value='B18 首发日志'; ta.dispatchEvent(new Event('input',{bubbles:true})); })()");
    await cdp.evalJs("Array.prototype.slice.call(document.querySelectorAll('#publishLogModal button')).filter(function(b){ return b.textContent.trim() === '确认发布'; })[0].click()");
    await waitFor(cdp, "localStorage.getItem('slati_article_publish_id') === 'ART-NEW1'", 10000, 'B18 POST 创建');
    ok('B18 无发布 id 时点 Publish = 发布日志弹窗 → 确认 = POST 创建 + id 记忆（后续再发布即更新）',
      await cdp.evalJs("window.__stubCalls.some(function(c){ return c.method === 'POST' && c.u.indexOf('/api/articles') === 0; })") === true);
    await cdp.evalJs("window.__stubCalls = []");
    await nav(cdp, BASE + '/pages/fluidcanvas.html?view=articles',
      "document.querySelectorAll('.art-row').length >= 1", 'B19 列表');
    ok('B19a cloud 行删除按钮渲染（ART-X 有 danger 按钮）',
      await cdp.evalJs("!!document.querySelector('.art-row[data-id=\"ART-X\"] .art-action-btn.danger')") === true);
    await cdp.evalJs("document.querySelector('.art-row[data-id=\"ART-X\"] .art-action-btn.danger').click()");
    await waitFor(cdp, "!document.querySelector('.art-row[data-id=\"ART-X\"]')", 10000, 'B19 删除');
    ok('B19b 点击删除 → DELETE /api/articles/ART-X + 行从列表消失',
      await cdp.evalJs("window.__stubCalls.some(function(c){ return c.method === 'DELETE' && c.u.indexOf('/api/articles/ART-X') === 0; })") === true);

    // ── G 全程零 Runtime exception + 零 console error（资源 404 豁免）──
    ok('G1 零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 5).join(' | ') || '干净');
    ok('G2 零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 5).join(' | ') || '干净');
    cdp.close();
    try { chrome.kill(); } catch (e) {}

    // ── B15 guest 直载（全新 profile 无登录态）──
    const chromeG = spawnChrome(CDP_PORT + 1, USER_DATA_GUEST);
    try {
      const cdpG = await connectCdp(CDP_PORT + 1);
      await cdpG.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
      await nav(cdpG, BASE + '/pages/article.html?id=ART-X',
        "document.getElementById('articleDetail').style.display === 'flex'", 'B15 guest 渲染');
      ok('B15 guest 可读文章（detail 显示）+ 评论框隐藏 + 访客提示显示 + ?next= 登录锚',
        await cdpG.evalJs("document.getElementById('commentComposerBox').style.display") === 'none' &&
        await cdpG.evalJs("document.getElementById('guestPrompt').style.display") === 'block' &&
        await cdpG.evalJs("(function(){ var a = document.querySelector('#guestPrompt a'); return !!a && a.getAttribute('href').indexOf('signup-and-login.html?next=') !== -1 && a.textContent === '前往登录'; })()") === true);
      await cdpG.evalJs("document.getElementById('artFavBtn').click()");
      ok('B15b guest 点收藏 → 登录 toast（登录后才能收藏）',
        await waitFor(cdpG, "Array.from(document.querySelectorAll('div')).some(function(d){ return d.style.position === 'fixed' && d.textContent.indexOf('登录后才能收藏') !== -1; })", 10000, 'B15b toast') === true);
      ok('B15c guest 零 Runtime exception', cdpG.errs.length === 0, cdpG.errs.slice(0, 5).join(' | ') || '干净');
      cdpG.close();
    } finally { try { chromeG.kill(); } catch (e) {} }
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    server.close();
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  server.close();
  console.log('');
  console.log(FAIL === 0 ? '🎉 全部通过 ' + PASS + '/' + PASS : '💔 失败 ' + FAIL + ' / 共 ' + (PASS + FAIL));
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(FAIL === 0 ? 0 : 1);
})();
