// tmp-battery-fc-i18n.js — FC v10.28.48.0 两页接入 12 语言 i18n 电池
// 用户「还有 FC还没有做翻译」——编辑器页+落地页共享 fluidcanvas.i18n.js 字典
// （zh 英文 chrome 换中文；卡片类型名显示层本地化、dataset.label 英文 payload 零改动）。
// 验证：F0 管道（site-config 45.0/00348- 占位 + 两页字典三件套挂载 + data-i18n 规模 +
//   zh 默认解析）/ F1 zh chrome 逐字（视口/模板/图层/历史/保存草稿/发布 + 状态栏四格）
//   / F2 资产面板 zh 标签 + data-asset/data-label 英文 payload 恒在
//   / F3 setLang 实时切换（en→zh 双向 + lang 属性 + 持久化）
//   / F4 撤销栈跨语言存活（改名→切 en→撤销回规范名显示 Flag→重做→切 zh 自取名原样）
//   / F5 输入中切换守卫（焦点+文本保留、画布不重建）
//   / F6 卡数据安全（规范名卡存英文 payload：存→重载 label 恒等、显示随语言）
//   / F7 查看模式 ?article=（notFound zh 占位 + demo 种子渲染 zh 卡面/目录）
//   / F8 落地页（zh 默认 chrome + Edit/View title 恒英文 + 委托点击开编辑器 + subnav 克隆同步）
//   / F9 zh-Hant OpenCC（視口/圖層 + 卡面國旗）/ F10 12 语言循环零异常零 console error
//   / E 全程零 Runtime exception + 零 console error。
// （house CDP 模式；判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fci18n-' + Date.now());
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

// F8（v0.2.58.26 Round 46）：落地页清单=FC_OVERVIEW 真数据——/api/fc/overview 罐头
// （published+draft 各 1：Edit/View title 按钮齐；stats/windows 全键防 '—' 渲染路径异常）
const FIX_OVERVIEW = {
  stats: { followers: 0, following: 0, articles: 2, articlesPublished: 1, articleViews: 0, articleLikes: 0,
    articleFavorites: 0, articleShares: 0, posts: 0, postViews: 0, postLikes: 0, postFavorites: 0, postShares: 0,
    repostsReceived: 0, media: 0 },
  windows: {
    '7d': { from: '2026-09-26T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z', newFollowers: 0, newFollowersPct: null, articlesCreated: 1, articlesCreatedPct: null, postsCreated: 0, postsCreatedPct: null, interactionsReceived: 0, interactionsReceivedPct: null, days: [] },
    '28d': { from: '2026-09-05T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z', newFollowers: 0, newFollowersPct: null, articlesCreated: 2, articlesCreatedPct: null, postsCreated: 0, postsCreatedPct: null, interactionsReceived: 0, interactionsReceivedPct: null, days: [] },
    'month': { from: '2026-09-02T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z', newFollowers: 0, newFollowersPct: null, articlesCreated: 2, articlesCreatedPct: null, postsCreated: 0, postsCreatedPct: null, interactionsReceived: 0, interactionsReceivedPct: null, days: [] }
  },
  articles: [
    { id: 'ART-I18N-PUB', title: 'Charter', status: 'published', createdAt: '2026-09-20T08:00:00.000Z', updatedAt: '2026-09-20T08:00:00.000Z', viewCount: 0, likeCount: 0, favoriteCount: 0, shareCount: 0, wordCount: 10 },
    { id: 'ART-I18N-DRAFT', title: 'Draft Notes', status: 'draft', createdAt: '2026-09-19T10:00:00.000Z', updatedAt: '2026-09-19T10:00:00.000Z', viewCount: 0, likeCount: 0, favoriteCount: 0, shareCount: 0, wordCount: 5 }
  ],
  media: [],
  posts: []
};

(async () => {
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

  try {
    // ── F0 管道静态 ──
    const siteCfg = await (await fetch(BASE + '/assets/js/site-config.js')).text();
    const editorHtml = await (await fetch(BASE + '/pages/fluidcanvas-editor.html')).text();
    const landingHtml = await (await fetch(BASE + '/pages/fluidcanvas.html')).text();
    const countAttr = (html, attr) => (html.match(new RegExp(attr + '=', 'g')) || []).length;
    ok('F0a site-config：FC v10.28.48.0 + rev 00348- 占位 + 站点版本恒 v0.2.58.26',
      siteCfg.indexOf('v10.28.49.1') !== -1 && siteCfg.indexOf('00348-') !== -1 && siteCfg.indexOf('v0.2.58.26') !== -1);
    ok('F0b 编辑器页字典三件套挂载 + data-i18n 规模（≥180 文本 + ≥40 title + ≥8 placeholder）',
      editorHtml.indexOf('assets/js/i18n.js') !== -1 &&
      editorHtml.indexOf('assets/i18n/common.i18n.js') !== -1 &&
      editorHtml.indexOf('assets/i18n/fluidcanvas.i18n.js') !== -1 &&
      countAttr(editorHtml, 'data-i18n') >= 180 && countAttr(editorHtml, 'data-i18n-title') >= 40 &&
      countAttr(editorHtml, 'data-i18n-placeholder') >= 8,
      'i18n=' + countAttr(editorHtml, 'data-i18n') + ' title=' + countAttr(editorHtml, 'data-i18n-title'));
    ok('F0c 落地页字典三件套挂载 + data-i18n 规模（≥45）',
      landingHtml.indexOf('assets/js/i18n.js') !== -1 &&
      landingHtml.indexOf('assets/i18n/common.i18n.js') !== -1 &&
      landingHtml.indexOf('assets/i18n/fluidcanvas.i18n.js') !== -1 &&
      countAttr(landingHtml, 'data-i18n') >= 45, 'i18n=' + countAttr(landingHtml, 'data-i18n'));

    const cdp = await connectCdp(CDP_PORT);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    // 卡 label 是 <input>（富文本才升级 span）——textContent 恒空，必须读 value；
    // 每个新文档都注入（navigate 会清掉旧 window 上的定义）
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{window.__lblTxt=function(id){var el=document.querySelector(\'.grid-card[data-card-id="\'+id+\'"] .card-label\');if(!el)return null;return (el.value!=null)?el.value.trim():el.textContent.trim();};}catch(e){}'
    });
    // F8（Round 46）：落地页 cloudMode 需 slati_user USR- 前缀（session 已由全局种子置 loggedIn）
    // + /api/fc/overview 罐头（其余 /api/ 照旧走静态服务器 404——页面静默容错，F8 只吃 fc/overview）
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try{(function(){
        if (location.pathname.indexOf('fluidcanvas.html') !== -1) {
          try { localStorage.setItem('slati_user', JSON.stringify({ id: 'USR-000001', displayName: 'Neo', citizenId: 'CIT-000001', avatarUrl: null })); } catch (e) {}
        }
        if (window.__slatiFcStub) return; window.__slatiFcStub = true;
        var realFetch = window.fetch.bind(window);
        var OVERVIEW = ${JSON.stringify(FIX_OVERVIEW)};
        window.fetch = function (url, opts) {
          var u = String(url);
          if (u.indexOf('/api/fc/overview') === 0) return Promise.resolve(new Response(JSON.stringify(OVERVIEW), { status: 200, headers: { 'Content-Type': 'application/json' } }));
          return realFetch(url, opts);
        };
      })();}catch(e){}`
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };
    const setLang = async (l) => cdp.evalJs('window.MN_I18N.setLang(' + JSON.stringify(l) + ')');
    const txt = (sel) => cdp.evalJs("(function(){ var el=document.querySelector(" + JSON.stringify(sel) + "); return el ? el.textContent.trim() : null; })()");

    // ── F0d 运行时 + F1 zh chrome ──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "!!window.MN_I18N && !!document.getElementById('gridCanvas') && !!window.publishArticle", '编辑器加载');
    ok('F0d 运行时：MN_I18N 在场 + 12 语言 + zh 默认解析 + lang 属性',
      await cdp.evalJs('(function(){ return typeof window.MN_I18N === "object" && typeof window.__fcT === "function" && window.MN_I18N.LANGS.length === 12 && window.MN_I18N.getLang() === "zh" && document.documentElement.lang === "zh"; })()') === true);
    const zhChrome = await cdp.evalJs("(function(){ function t(k){ var el=document.querySelector('[data-i18n=\"'+k+'\"]'); return el?el.textContent.trim():null; } return { vp:t('fc.chrome.viewport'), tpl:t('fc.chrome.templates'), ly:t('fc.chrome.layers'), hist:t('fc.chrome.history'), sv:t('fc.chrome.saveDraft'), pub:t('fc.chrome.publish'), hs:document.getElementById('headerStatus').textContent, ss:document.getElementById('saveStatus').textContent, wc:document.getElementById('wordCount').textContent, cc:document.getElementById('charCount').textContent }; })()");
    ok('F1 zh 默认 chrome 逐字：视口 ·/模板/图层/历史/保存草稿/发布 + 徽章 草稿 + 状态 就绪 + 0 词 0 字符',
      zhChrome.vp === '视口 ·' && zhChrome.tpl === '模板' && zhChrome.ly === '图层' && zhChrome.hist === '历史' &&
      zhChrome.sv === '保存草稿' && zhChrome.pub === '发布' && zhChrome.hs === '草稿' && zhChrome.ss === '就绪' &&
      zhChrome.wc === '0 词' && zhChrome.cc === '0 字符', JSON.stringify(zhChrome));

    // ── F2 资产面板 zh 标签 + 英文 payload 属性 ──
    const asset = await cdp.evalJs("(function(){ function a(k){ var el=document.querySelector('[data-i18n=\"'+k+'\"]'); return el ? { label: el.textContent.trim(), asset: el.closest('[data-asset]') ? el.closest('[data-asset]').getAttribute('data-asset') : null, payload: el.closest('[data-asset]') ? el.closest('[data-asset]').getAttribute('data-label') : null } : null; } return { flag:a('fc.asset.flag'), emblem:a('fc.asset.emblem'), content:a('fc.asset.contentCard'), ph: document.querySelector('[data-i18n-placeholder=\"fc.assetPanel.filter\"]').getAttribute('placeholder') }; })()");
    ok('F2 资产面板：国旗/国徽/内容卡 zh 显示 + data-asset/data-label 英文 payload 恒在 + 筛选占位 zh',
      asset.flag.label === '国旗' && asset.flag.asset === 'flag' && asset.flag.payload === 'National Flag' &&
      asset.emblem.label === '国徽' && asset.emblem.asset === 'shield' && asset.emblem.payload === 'Emblem' &&
      asset.content.label === '内容卡' && asset.content.asset === 'content' && asset.content.payload === 'Content Card' &&
      asset.ph === '筛选资产…', JSON.stringify(asset));

    // ── F3 setLang 实时切换 ──
    await setLang('en'); await sleep(200);
    const en1 = await cdp.evalJs("(function(){ return { sv: document.querySelector('[data-i18n=\"fc.chrome.saveDraft\"]').textContent.trim(), lang: document.documentElement.lang, gl: window.MN_I18N.getLang(), stored: localStorage.getItem('slati_lang') }; })()");
    await setLang('zh'); await sleep(200);
    const zh1 = await cdp.evalJs("(function(){ return { sv: document.querySelector('[data-i18n=\"fc.chrome.saveDraft\"]').textContent.trim(), lang: document.documentElement.lang, gl: window.MN_I18N.getLang() }; })()");
    ok('F3 setLang 实时切换：en→Save Draft/lang/stored 三写 + zh→保存草稿 恢复',
      en1.sv === 'Save Draft' && en1.lang === 'en' && en1.gl === 'en' && en1.stored === 'en' &&
      zh1.sv === '保存草稿' && zh1.lang === 'zh' && zh1.gl === 'zh', JSON.stringify({ en: en1, zh: zh1 }));

    // ── F5 输入中切换守卫 ──
    await cdp.evalJs("(function(){ var ti=document.getElementById('titleInput'); ti.focus(); ti.value='测试标题'; ti.dispatchEvent(new Event('input',{bubbles:true})); return true; })()");
    await setLang('en'); await sleep(200);
    const f5 = await cdp.evalJs("(function(){ var ti=document.getElementById('titleInput'); return { focus: document.activeElement === ti, val: ti.value, ph: ti.getAttribute('placeholder') }; })()");
    await setLang('zh'); await sleep(200);
    ok('F5 输入中切换：焦点+文本保留（画布重建被守卫跳过）+ 占位符随语言换',
      f5.focus === true && f5.val === '测试标题' && f5.ph === 'Article Title', JSON.stringify(f5));
    await cdp.evalJs("(function(){ document.getElementById('titleInput').value=''; document.body.focus(); return true; })()");

    // ── F4/F6：播种规范名草稿 → 重载 ──
    // 播种必须走新文档脚本：旧页 pagehide→autoSave 会在新页脚本前覆盖 localStorage 直写
    const seedDraft = JSON.stringify({ title: '测试文章', tags: [], cards: [{ id: 'c1', type: 'flag', label: 'National Flag', col: 5, row: 5, colSpan: 5, rowSpan: 5 }] });
    const seedScript = "try{localStorage.setItem('slati_fluidcanvas_draft', " + JSON.stringify(seedDraft) + ");}catch(e){}";
    const seedId = (await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: seedScript })).identifier;
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "!!document.querySelector('.grid-card[data-card-id=\"c1\"]')", '播种草稿重载');
    await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seedId });
    const f6a = await cdp.evalJs("(function(){ var c=document.querySelector('.grid-card[data-card-id=\"c1\"]'); var l=c.querySelector('.card-label'); return { display: (l.value != null ? l.value : l.textContent).trim(), stored: c.dataset.label }; })()");
    ok('F6a 规范名草稿重载：显示层 国旗 + dataset.label 英文 payload 恒等',
      f6a.display === '国旗' && f6a.stored === 'National Flag', JSON.stringify(f6a));

    // F4 撤销栈跨语言：改名 → 历史提交 → 切 en（守卫重建）→ 撤销 → 重做 → 切 zh
    await cdp.evalJs("(function(){ var l=document.querySelector('.grid-card[data-card-id=\"c1\"] .card-label'); if (l.tagName==='INPUT'||l.tagName==='TEXTAREA'){l.value='自定义名';}else{l.textContent='自定义名';} l.dispatchEvent(new Event('input',{bubbles:true})); l.dispatchEvent(new Event('blur',{bubbles:true})); document.body.focus(); return true; })()");
    await sleep(900); // 600ms 防抖提交
    const f4pre = await cdp.evalJs("(function(){ return { undo: !document.getElementById('undoBtn').disabled, label: window.__lblTxt('c1') }; })()");
    await setLang('en'); await sleep(200);
    const f4en = await cdp.evalJs("(function(){ var c=document.querySelector('.grid-card[data-card-id=\"c1\"]'); return { label: window.__lblTxt('c1'), stored: c.dataset.label }; })()");
    await cdp.evalJs('window.historyUndoAction()'); await sleep(250);
    const f4u = await cdp.evalJs("(function(){ var c=document.querySelector('.grid-card[data-card-id=\"c1\"]'); return { label: window.__lblTxt('c1'), stored: c.dataset.label }; })()");
    await cdp.evalJs('window.historyRedoAction()'); await sleep(250);
    await setLang('zh'); await sleep(200);
    const f4z = await cdp.evalJs("(function(){ var c=document.querySelector('.grid-card[data-card-id=\"c1\"]'); return { label: window.__lblTxt('c1'), stored: c.dataset.label }; })()");
    ok('F4 撤销栈跨语言存活：改名后可撤销 → en 下撤销显示 Flag（显示随语言）→ 重做回 自定义名 → zh 下自取名原样',
      f4pre.undo === true && f4pre.label === '自定义名' &&
      f4en.label === '自定义名' && f4en.stored === '自定义名' &&
      f4u.label === 'Flag' && f4u.stored === 'National Flag' &&
      f4z.label === '自定义名' && f4z.stored === '自定义名',
      JSON.stringify({ pre: f4pre, en: f4en, undo: f4u, zh: f4z }));

    // F6b 规范名卡存英文 payload：直接存草稿 → 读 localStorage label 恒等 → 重载仍 国旗
    const seedId2 = (await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: seedScript })).identifier;
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "!!document.querySelector('.grid-card[data-card-id=\"c1\"]')", 'F6b 重载');
    await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seedId2 });
    await cdp.evalJs('window.saveDraft()'); await sleep(200);
    const f6b = await cdp.evalJs("(function(){ try { var d=JSON.parse(localStorage.getItem('slati_fluidcanvas_draft')); return { label: d.cards[0].label }; } catch(e) { return null; } })()");
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "!!document.querySelector('.grid-card[data-card-id=\"c1\"]')", 'F6b 再重载');
    const f6c = await cdp.evalJs("(function(){ var c=document.querySelector('.grid-card[data-card-id=\"c1\"]'); return { display: window.__lblTxt('c1'), stored: c.dataset.label }; })()");
    ok('F6b 存→重载 label 恒等：草稿存英文 payload National Flag（显示文本不入数据）+ 重载后显示 国旗/payload 恒等',
      f6b && f6b.label === 'National Flag' && f6c.display === '国旗' && f6c.stored === 'National Flag',
      JSON.stringify({ saved: f6b, reloaded: f6c }));

    // ── F7 查看模式 ?article= ──
    await nav(BASE + '/pages/fluidcanvas-editor.html?article=ART-MISSING',
      "document.body.classList.contains('fc-viewmode') && !!document.getElementById('fcViewPlaceholder')", 'F7a notFound 占位');
    const f7a = await cdp.evalJs("(function(){ var h2=document.querySelector('#fcViewPlaceholder h2'); var back=document.querySelector('#fcViewPlaceholder a.btn'); return { h2: h2.textContent.trim(), reason: document.querySelector('#fcViewPlaceholder p').textContent.trim(), back: back.textContent.trim() }; })()");
    ok('F7a 查看模式 notFound：zh 占位标题/原因 + 返回文章列表 zh',
      f7a.h2 === 'ART-MISSING' && f7a.reason === '这篇文章不存在，或已被删除。' && f7a.back === '← 返回文章列表', JSON.stringify(f7a));
    // demo 种子 → 真渲染路径（零后端）
    const demo = { 'ART-FC-I18N': JSON.stringify({ title: '演示文章', cards: [{ id: 'c1', type: 'flag', label: 'National Flag', col: 5, row: 5, colSpan: 5, rowSpan: 5 }] }) };
    await cdp.evalJs("localStorage.setItem('slati_demo_article_content', " + JSON.stringify(JSON.stringify(demo)) + "); true");
    await nav(BASE + '/pages/fluidcanvas-editor.html?article=ART-FC-I18N',
      "document.body.classList.contains('fc-viewmode') && !!document.querySelector('.grid-card[data-card-id=\"c1\"]') && !!document.getElementById('fcViewTocBtn')", 'F7b demo 渲染');
    const f7b = await cdp.evalJs("(function(){ var c=document.querySelector('.grid-card[data-card-id=\"c1\"]'); var t=document.querySelector('.fcv-toc-item'); return { label: window.__lblTxt('c1'), stored: c.dataset.label, toc: t ? t.textContent.trim() : null, draftTouched: (localStorage.getItem('slati_fluidcanvas_draft')||'').indexOf('National Flag') !== -1 }; })()");
    ok('F7b demo 种子查看：卡面 国旗 + TOC 条目 zh 国旗 + payload 恒等 + 本地草稿零触碰',
      f7b.label === '国旗' && f7b.stored === 'National Flag' && f7b.toc === '国旗' && f7b.draftTouched === true,
      JSON.stringify(f7b));

    // ── F8 落地页 ──
    await nav(BASE + '/pages/fluidcanvas.html',
      "!!window.MN_I18N && document.querySelectorAll('#artList .art-action-btn[title=\"Edit\"]').length > 0", '落地页加载');
    const f8a = await cdp.evalJs("(function(){ var o=document.querySelector('#openEditorCta [data-i18n=\"fc.landing.openEditor\"]'); var pill=document.querySelector('.subnav-pill[data-tab=\"articles\"]'); var e=document.querySelector('#artList .art-action-btn[title=\"Edit\"]'); var v=document.querySelector('#artList .art-action-btn[title=\"View\"]'); return { open: o ? o.textContent.trim() : null, pill: pill ? pill.textContent.trim() : null, editTitle: e ? e.getAttribute('title') : null, viewTitle: v ? v.getAttribute('title') : null, lang: document.documentElement.lang }; })()");
    ok('F8a 落地页 zh 默认 chrome + Edit/View title 恒英文（委托陷阱守约）',
      f8a.open === '打开编辑器' && f8a.pill === '文章' && f8a.editTitle === 'Edit' && f8a.viewTitle === 'View' && f8a.lang === 'zh', JSON.stringify(f8a));
    await setLang('en'); await sleep(250);
    const f8b = await cdp.evalJs("(function(){ var pill=document.querySelector('.subnav-pill[data-tab=\"articles\"]'); var clone=document.querySelector('.subnav-highlight-clone'); return { pill: pill.textContent.trim(), clone: clone ? clone.textContent.trim() : null }; })()");
    ok('F8b subnav 克隆同步：en 切换后克隆 textContent 随药丸更新',
      f8b.pill === 'Articles' && f8b.clone === 'Articles', JSON.stringify(f8b));
    await cdp.evalJs("(function(){ var e=document.querySelector('#artList .art-action-btn[title=\"Edit\"]'); e.click(); return true; })()");
    await waitFor(cdp, "window.location.href.indexOf('fluidcanvas-editor.html') !== -1", 8000, 'Edit 委托跳编辑器');
    await sleep(700);
    ok('F8c Edit 委托点击仍工作：英文 title 按钮 → 打开编辑器', true);

    // ── F9 zh-Hant（编辑器，草稿卡在场）──
    await waitFor(cdp, "!!window.MN_I18N && !!document.querySelector('.grid-card[data-card-id=\"c1\"]')", 8000, 'F9 编辑器就绪');
    await setLang('zh-Hant'); await sleep(250);
    const f9 = await cdp.evalJs("(function(){ var c=document.querySelector('.grid-card[data-card-id=\"c1\"]'); return { vp: document.querySelector('[data-i18n=\"fc.chrome.viewport\"]').textContent.trim(), ly: document.querySelector('[data-i18n=\"fc.chrome.layers\"]').textContent.trim(), label: window.__lblTxt('c1'), stored: c.dataset.label, lang: document.documentElement.lang }; })()");
    ok('F9 zh-Hant OpenCC：視口 ·/圖層 + 卡面 國旗（重建随语言）+ payload 恒等',
      f9.vp === '視口 ·' && f9.ly === '圖層' && f9.label === '國旗' && f9.stored === 'National Flag' && f9.lang === 'zh-Hant', JSON.stringify(f9));

    // ── F10 12 语言循环零异常 ──
    const errBefore = (await cdp.evalJs('0')) === 0 ? 0 : 0; // 占位：真实计数走 CDP 事件
    const f10 = await cdp.evalJs("(function(){ var out=[]; for (var i=0;i<window.MN_I18N.LANGS.length;i++){ var l=window.MN_I18N.LANGS[i].code; window.MN_I18N.setLang(l); out.push(document.documentElement.lang === l); } return out; })()");
    await sleep(300);
    const f10tail = await cdp.evalJs("(function(){ var c=document.querySelector('.grid-card[data-card-id=\"c1\"]'); window.MN_I18N.setLang('zh'); return { allOk: " + JSON.stringify('PLACEHOLDER') + ", label: window.__lblTxt('c1'), stored: c.dataset.label, lang: document.documentElement.lang }; })()");
    ok('F10 12 语言循环：lang 属性每步跟进 + 末回 zh 卡面 国旗/payload 恒等',
      f10.every(function (x) { return x === true; }) && f10tail.label === '国旗' && f10tail.stored === 'National Flag' && f10tail.lang === 'zh',
      JSON.stringify({ steps: f10.length, tail: f10tail }));

    // ── E 全程零异常零 console error ──
    ok('E1 全程零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 5).join(' | ') || '干净');
    ok('E2 全程零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 5).join(' | ') || '干净');
    cdp.close();
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    server.close();
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  try { chrome.kill(); } catch (e) {}
  server.close();
  console.log('');
  console.log(FAIL === 0 ? '🎉 全部通过 ' + PASS + '/' + PASS : '💔 失败 ' + FAIL + ' / 共 ' + (PASS + FAIL));
  process.exit(FAIL === 0 ? 0 : 1);
})();
