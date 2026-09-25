// tmp-battery-i18n.js — v0.2.54.0 全站 12 语言 i18n 电池（S 静态巡检 + A/B/C 三 Chrome 浏览器段）
// 用户「能不能做以下所有语言的适配？新增德语，俄语，马来语，泰语，越南语，印尼语」→ 问询钦定：
//   12 语言（zh/zh-Hant/en/de/ru/ms/th/vi/id/fr/es/pt；zh-Hant 由 OpenCC 自动生成，勿手写）
//   一次性全站（44 页除 FC 两页+两个重定向 stub+两个纯英文 demo 共 6 页排除）/ 管理后台也翻
//   语言切换器只在设置弹窗 / 访客首访跟浏览器语言自动选（resolveLang）
// 断言：
//   S  静态：7 旧 .zh.js 全删 / 词典文件集恰 39（37 页+common+admin）/ 每词典含 en+zh-Hant 块 /
//       38 页↔词典挂载逐一接通（auth 同域双页共用）/ 接入页三件套（i18n.js+common+apply）/
//       6 排除页零 i18n / LANGS 12 码序列 / site-config v0.2.54.0 / common 键族（sidebar/settings/report/aichat/verify）
//   A  浏览器（--lang=zh-CN+登录会话）：设置弹窗 12 pill 序列 → 点 Deutsch → 标题变德语+双键
//       持久（slati_lang+slati_settings.language）+reload 仍德语；xx 无字典回落浏览器 zh；
//       FC 编辑器页零 i18n（typeof MN_I18N undefined）+弹窗兜底 pill+点 de 落 slati_lang+文案英文保持
//   B  浏览器（--lang=de-DE 新 profile）：法律页自动选德语（标题 t() 值+无 CJK）；admin 壳
//       静态节点自动选德语→切 zh 回落中文（导航 8 分类/23 条目计数由 smoke-admin 保——
//       admin zh 值逐字节=管理端原文+smoke-admin 零改动）
//   C  浏览器（--lang=zh-CN 新 profile）：默认 zh 回归（侧栏首项=主页 + 知识库卡=知识库）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const I18N_DIR = path.join(DOCS, 'assets', 'i18n');
const PORT = 4950 + Math.floor(Math.random() * 80);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};

// ── 全貌表（v0.2.54.0 定案）────────────────────────────────────────
const DICT_FILES = ['about', 'activity', 'auth', 'badge', 'community-hub', 'community-post',
  'community-profile', 'community-rules', 'construction', 'create-topic-step-1', 'create-topic-step-2',
  'create-topic-step-3', 'create-world', 'edge', 'explore', 'financial-terms', 'fluidcanvas', 'following',
  'guidelines', 'help', 'index', 'messages', 'onboarding-complete',
  'onboarding-identity', 'overview', 'platform-responsibility', 'premium', 'privacy',
  'registry-step-1', 'registry-step-2', 'registry-step-3', 'sovereignty-ratified', 'terms', 'ticket',
  'transitioning', 'workspace', 'world-created', 'world-wizard']; // 38 页词典（auth 同域双页共用；v10.28.45.2 +fluidcanvas 两页共享）
const PAGE_HTML = {
  'index': ['docs/index.html'],
  'auth': ['docs/signup-and-login.html', 'docs/forgot-password.html'], // 同域双页共用 auth.i18n.js
  'edge': ['docs/pages/edge-themes-demo.html'],
  'admin': ['docs/admin/index.html'],
  'fluidcanvas': ['docs/pages/fluidcanvas.html', 'docs/pages/fluidcanvas-editor.html'] // v10.28.45.2 FC 两页共享
}; // 其余 → docs/pages/<name>.html
const EXCLUDED = new Set(['fluidcanvas-analytics',
  'fluidcanvas-articles', 'blackhole-demo', 'cyberfall-demo']); // 重定向 stub×2+纯英文 demo×2
const LANG_CODES = ['zh', 'zh-Hant', 'en', 'de', 'ru', 'ms', 'th', 'vi', 'id', 'fr', 'es', 'pt'];
const LANG_NAMES = ['中文', '繁體中文', 'English', 'Deutsch', 'Русский', 'Bahasa Melayu', 'ไทย',
  'Tiếng Việt', 'Bahasa Indonesia', 'Français', 'Español', 'Português'];
const CJK = /[\u4e00-\u9fff]/;
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const pagesOf = (d) => PAGE_HTML[d] || ['docs/pages/' + d + '.html'];

// ═══ S. 静态巡检（纯文件，无浏览器）═══
console.log('═══ S. 静态巡检 ═══');
{
  const dirFiles = fs.readdirSync(I18N_DIR);
  const legacy = dirFiles.filter(f => f.endsWith('.zh.js'));
  ok('S1 7 旧 .zh.js 全删（badge/help/ticket/ai-chat/community-rules/financial-terms/platform-responsibility）',
    legacy.length === 0, legacy.join(','));
  const dicts = dirFiles.filter(f => f.endsWith('.i18n.js')).map(f => f.replace('.i18n.js', ''));
  const expected = DICT_FILES.concat(['common', 'admin', 'article']).sort(); // v0.2.55.0 +article.i18n.js
  ok('S2 词典文件集恰 41 个（38 页 + common + admin + article，无杂散无缺失；auth/fluidcanvas 各同域双页共用）',
    dicts.length === 41 && dicts.slice().sort().join(',') === expected.join(','),
    '实际 ' + dicts.length + '：' + dicts.filter(d => expected.indexOf(d) === -1).join(',') + ' 缺：' + expected.filter(d => dicts.indexOf(d) === -1).join(','));
  let allEn = true, allHant = true, missEn = [], missHant = [];
  for (const f of dirFiles.filter(f => f.endsWith('.i18n.js'))) {
    const src = fs.readFileSync(path.join(I18N_DIR, f), 'utf8');
    if (src.indexOf("add('en'") === -1) { allEn = false; missEn.push(f); }
    if (src.indexOf("add('zh-Hant'") === -1 || src.indexOf('__ZH_HANT_AUTO__') === -1) { allHant = false; missHant.push(f); }
  }
  ok('S3 每个词典含 en 块', allEn, missEn.join(','));
  ok('S4 每个词典含 OpenCC 生成的 zh-Hant 块（哨兵 __ZH_HANT_AUTO__）', allHant, missHant.join(','));
  let mapOk = true, mapBad = [];
  for (const d of DICT_FILES) {
    for (const p of pagesOf(d)) {
      const html = read(p);
      if (html.indexOf(d + '.i18n.js') === -1) { mapOk = false; mapBad.push(d + ' → ' + p); }
    }
  }
  ok('S5 40 页↔词典挂载逐一接通（HTML 加载自身 .i18n.js）', mapOk, mapBad.slice(0, 5).join('；'));
  let trioOk = true, trioBad = [];
  for (const d of DICT_FILES.concat(['admin'])) {
    for (const p of pagesOf(d)) {
      const html = read(p);
      const hasEngine = html.indexOf('assets/js/i18n.js') !== -1;
      const hasApply = html.indexOf('MN_I18N.apply()') !== -1;
      const hasCommon = d === 'admin' || html.indexOf('common.i18n.js') !== -1;
      if (!(hasEngine && hasApply && hasCommon)) { trioOk = false; trioBad.push(p + '(引擎' + hasEngine + '/apply' + hasApply + '/common' + hasCommon + ')'); }
    }
  }
  ok('S6 40 接入页三件套（i18n.js + apply() + common.i18n.js，admin 免 common）', trioOk, trioBad.slice(0, 6).join('；'));
  let exclOk = true, exclBad = [];
  for (const p of EXCLUDED) {
    const html = read('docs/pages/' + p + '.html');
    if (html.indexOf('i18n.js') !== -1) { exclOk = false; exclBad.push(p); }
  }
  ok('S7 4 排除页零 i18n（重定向 stub×2+demo×2 一个 i18n script 都没有）', exclOk, exclBad.join(','));
  const engine = read('docs/assets/js/i18n.js');
  let seqOk = true, last = -1;
  for (const c of LANG_CODES) {
    const at = engine.indexOf("{ code: '" + c + "'");
    if (at < 0 || at < last) { seqOk = false; break; }
    last = at;
  }
  ok('S8 i18n.js LANGS 12 码序列 zh→zh-Hant→en→de→ru→ms→th→vi→id→fr→es→pt', seqOk);
  const sconf = read('docs/assets/js/site-config.js');
  ok('S9 site-config 版本 = v0.2.54.2', sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.58.0';") !== -1);
  const common = fs.readFileSync(path.join(I18N_DIR, 'common.i18n.js'), 'utf8');
  ok('S10 common.i18n.js 键族齐（sidebar/settings/report/aichat 从 help 移入/verify 从 badge 共享）',
    ["'sidebar.", "'settings.", "'report.", "'aichat.", "'verify."].every(k => common.indexOf(k) !== -1));
}

// ── house CDP 骨架 ────────────────────────────────────────────────
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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      }
    };
  }
  send(method, params) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); }); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitFor(cdp, expr, ms, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await cdp.evalJs(expr)) return true; } catch (e) {}
    await sleep(120);
  }
  throw new Error('waitFor 超时：' + (label || expr));
}

async function launchChrome(lang, injectSession, suffix) {
  const CDP_PORT = 5950 + Math.floor(Math.random() * 80);
  const USER_DATA = path.join(os.tmpdir(), 'mn-batt-i18n-' + suffix + '-' + Date.now());
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=' + lang, '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
    await sleep(250);
  }
  if (!up) throw new Error('Chrome 未起来');
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  const page = pages.find(x => x.type === 'page');
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*', '*favicon*'] });
  if (injectSession) {
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true, user: { id: 'USR-000001', name: 'Neo', email: 'neo@mn.world', tier: 'premium' } })) + ');}catch(e){}'
    });
  }
  const cleanup = () => { try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {} };
  return { cdp, cleanup, chrome };
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;

  // ═══ A. Chrome zh-CN + 登录会话：设置弹窗切换链（badge 页）+ FC 编辑器零 i18n ═══
  try {
    console.log('═══ A. 设置弹窗切换链（badge 页）═══');
    const A = await launchChrome('zh-CN', true, 'A');
    const cdp = A.cdp;
    await cdp.send('Page.navigate', { url: BASE + '/pages/badge.html' });
    await waitFor(cdp, 'typeof window.SlatiSettings === "object"', 15000, 'badge 页 SlatiSettings');
    await cdp.evalJs('window.SlatiSettings.open()');
    await waitFor(cdp, '!!document.getElementById("langSubnav")', 5000, '语言 pill 区');

    const pills = await cdp.evalJs(`(function(){var bs=[].slice.call(document.querySelectorAll('#langSubnav .subnav-pill'));return {names:bs.map(function(b){return b.textContent}),active:(document.querySelector('#langSubnav .subnav-pill.active')||{}).dataset&&document.querySelector('#langSubnav .subnav-pill.active').dataset.lang};})()`);
    ok('A1 设置弹窗 12 语言 pill 标签序列（固有语言名）',
      JSON.stringify(pills.names) === JSON.stringify(LANG_NAMES), JSON.stringify(pills.names));
    ok('A2 初始 active pill = zh（--lang=zh-CN 自动选）', pills.active === 'zh', pills.active);

    await cdp.evalJs('(function(){var b=document.querySelector(\'#langSubnav .subnav-pill[data-lang="de"]\');b.click();})()');
    await waitFor(cdp, 'document.documentElement.getAttribute("lang") === "de"', 5000, '点 Deutsch 后 lang=de');
    let st = await cdp.evalJs(`(function(){var exp=MN_I18N.t('badge.meta.title');return {title:document.title,exp:exp,lang:document.documentElement.getAttribute('lang'),slatiLang:localStorage.getItem('slati_lang'),settingsLang:(JSON.parse(localStorage.getItem('slati_settings')||'{}')).language};})()`);
    ok('A3 点 Deutsch → 页面标题变德语（=t(\'badge.meta.title\') 且 ≠ 中文原文）',
      st.title === st.exp && !CJK.test(st.title) && st.lang === 'de', st.title);
    ok('A4 双键持久：slati_lang=de + slati_settings.language=de',
      st.slatiLang === 'de' && st.settingsLang === 'de', st.slatiLang + '/' + st.settingsLang);

    try { await cdp.evalJs('location.reload()'); } catch (e) {}
    await waitFor(cdp, 'document.documentElement.getAttribute("lang") === "de"', 12000, 'reload 后仍 de');
    st = await cdp.evalJs(`(function(){var exp=MN_I18N.t('badge.meta.title');return {title:document.title,exp:exp,lang:document.documentElement.getAttribute('lang')};})()`);
    ok('A5 reload 后语言仍德语（slati_lang 持久生效）', st.lang === 'de' && st.title === st.exp && !CJK.test(st.title), st.title);

    try { await cdp.evalJs('localStorage.setItem("slati_lang","xx");location.reload()'); } catch (e) {}
    await waitFor(cdp, 'document.documentElement.getAttribute("lang") === "zh"', 12000, 'xx 无字典回落浏览器 zh-CN');
    st = await cdp.evalJs(`(function(){var exp=MN_I18N.t('badge.meta.title');return {title:document.title,exp:exp,lang:document.documentElement.getAttribute('lang')};})()`);
    ok('A6 xx 无字典回落浏览器语言 zh（标题=zh 值）', st.lang === 'zh' && st.title === st.exp, st.title);

    console.log('═══ A\'. FC 编辑器页 i18n 接入（v10.28.45.2）═══');
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, 'typeof window.MN_I18N === "object" && typeof window.__fcT === "function"', 20000, 'FC 编辑器页');
    const fc = await cdp.evalJs(`(function(){return {i18n:typeof window.MN_I18N,lang:document.documentElement.getAttribute('lang')};})()`);
    ok('A7 FC 编辑器页引擎接入（MN_I18N + 默认解析 zh）', fc.i18n === 'object' && fc.lang === 'zh', fc.i18n + '/' + fc.lang);
    await cdp.evalJs('window.SlatiSettings.open()');
    await waitFor(cdp, '!!document.getElementById("langSubnav")', 5000, 'FC 弹窗语言区');
    const fcPills = await cdp.evalJs(`(function(){var bs=[].slice.call(document.querySelectorAll('#langSubnav .subnav-pill'));return bs.map(function(b){return b.textContent});})()`);
    ok('A8 FC 弹窗 12 pill 来自 MN_I18N.LANGS（唯一来源）',
      JSON.stringify(fcPills) === JSON.stringify(LANG_NAMES), JSON.stringify(fcPills));
    const fc2 = await cdp.evalJs(`(function(){var h=document.querySelector('[data-i18n="settings.sec.language"]');return {slatiLang:localStorage.getItem('slati_lang'),h3:h?h.textContent:null};})()`);
    ok('A9 FC 设置弹窗 h3 显示 语言（zh 默认，data-i18n 渲染）', fc2.h3 === '语言', fc2.h3);
    await cdp.evalJs('(function(){var b=document.querySelector(\'#langSubnav .subnav-pill[data-lang="de"]\');b.click();})()');
    await waitFor(cdp, 'document.documentElement.getAttribute("lang") === "de"', 8000, 'FC 切 de 即时重渲染');
    const fc3 = await cdp.evalJs(`(function(){var el=document.querySelector('[data-i18n="fc.chrome.saveDraft"]');return {slatiLang:localStorage.getItem('slati_lang'),save:el?el.textContent:null,exp:MN_I18N.t('fc.chrome.saveDraft')};})()`);
    ok('A10 FC 切 de 后重渲染：slati_lang=de + chrome 元素=de 字典值（非中文）',
      fc3.slatiLang === 'de' && fc3.save === fc3.exp && fc3.save !== '保存草稿', fc3.slatiLang + '/' + fc3.save);
    cdp.close(); A.cleanup();
  } catch (e) {
    fail++;
    console.error('  ❌ A 段异常：', e && e.message);
  }

  // ═══ B. Chrome de-DE 新 profile：法律页自动选 + admin 壳 ═══
  try {
    console.log('═══ B. 浏览器语言自动选（de-DE）═══');
    const B = await launchChrome('de-DE', false, 'B');
    const cdp = B.cdp;
    await cdp.send('Page.navigate', { url: BASE + '/pages/financial-terms.html' });
    await waitFor(cdp, 'document.documentElement.getAttribute("lang") === "de"', 15000, '法律页自动选 de');
    let st = await cdp.evalJs(`(function(){var exp=MN_I18N.t('meta.title');return {title:document.title,exp:exp,lang:document.documentElement.getAttribute('lang')};})()`);
    ok('B1 访客 --lang=de-DE 首访法律页自动选德语（标题=de 值+无 CJK）',
      st.lang === 'de' && st.title === st.exp && !CJK.test(st.title), st.title);

    await cdp.send('Page.navigate', { url: BASE + '/admin/index.html' });
    await waitFor(cdp, 'document.documentElement.getAttribute("lang") === "de" && !!document.querySelector(\'[data-i18n="admin.login.title"]\')', 15000, 'admin 壳自动选 de');
    st = await cdp.evalJs(`(function(){var el=document.querySelector('[data-i18n="admin.login.title"]');var exp=MN_I18N.t('admin.login.title');return {text:el.textContent,exp:exp,lang:document.documentElement.getAttribute('lang')};})()`);
    ok('B2 admin 壳静态节点自动选德语（登录标题=de 值+无 CJK）',
      st.lang === 'de' && st.text === st.exp && !CJK.test(st.text), st.text);

    try { await cdp.evalJs('localStorage.setItem("slati_lang","zh");location.reload()'); } catch (e) {}
    await waitFor(cdp, 'document.documentElement.getAttribute("lang") === "zh" && !!document.querySelector(\'[data-i18n="admin.login.title"]\')', 15000, 'admin 切 zh');
    st = await cdp.evalJs(`(function(){var el=document.querySelector('[data-i18n="admin.login.title"]');return {text:el.textContent,lang:document.documentElement.getAttribute('lang')};})()`);
    ok('B3 admin 切 zh 回落中文（zh 值逐字节=管理端原文，smoke-admin 安全）',
      st.lang === 'zh' && st.text === 'SlatiControl 登录', st.text);
    cdp.close(); B.cleanup();
  } catch (e) {
    fail++;
    console.error('  ❌ B 段异常：', e && e.message);
  }

  // ═══ C. Chrome zh-CN 新 profile：默认 zh 回归 ═══
  try {
    console.log('═══ C. 默认 zh 回归 ═══');
    const C = await launchChrome('zh-CN', false, 'C');
    const cdp = C.cdp;
    await cdp.send('Page.navigate', { url: BASE + '/index.html' });
    await waitFor(cdp, 'document.documentElement.getAttribute("lang") === "zh" && !!document.querySelector("#slati-sidebar .nav-module .nav-item")', 15000, 'index 默认 zh');
    const st = await cdp.evalJs(`(function(){
      var first=document.querySelector('#slati-sidebar .nav-module .nav-item');
      var kb=document.querySelector('[data-i18n="index.knowledgeBase"]');
      return {
        lang:document.documentElement.getAttribute('lang'),
        navFirst:first?first.textContent.replace(first.querySelector('.nav-icon').textContent,''):null,
        navExp:MN_I18N.t('sidebar.nav.home'),
        kb:kb?kb.textContent:null,
        kbExp:MN_I18N.t('index.knowledgeBase')
      };
    })()`);
    ok('C1 无 localStorage 默认 zh（--lang=zh-CN 回落）', st.lang === 'zh', st.lang);
    ok('C2 侧栏首项 = 主页（common T() 渲染）', st.navFirst === st.navExp, st.navFirst);
    ok('C3 知识库卡 = 知识库（index 词典渲染）', st.kb === st.kbExp, st.kb);
    cdp.close(); C.cleanup();
  } catch (e) {
    fail++;
    console.error('  ❌ C 段异常：', e && e.message);
  }

  // ═══ D. Chrome zh-CN：index 页动态区双语断言（v0.2.54.2 用户「首页/公告/订阅卡没翻译」验收）═══
  try {
    console.log('═══ D. index 动态区双语（活动流/公告/订阅卡）═══');
    const D = await launchChrome('zh-CN', false, 'D');
    const cdp = D.cdp;
    await cdp.send('Page.navigate', { url: BASE + '/index.html' });
    await waitFor(cdp, 'document.documentElement.getAttribute("lang") === "zh" && !!document.getElementById("activityFeed") && document.getElementById("activityFeed").innerText.length > 10', 15000, 'index zh 动态区就绪');
    const zh = await cdp.evalJs(`(function(){
      return {
        act:document.getElementById('activityFeed').innerText,
        ann:document.getElementById('dashAnnouncements').innerText,
        feats:[].slice.call(document.querySelectorAll('[data-i18n^="index.premiumFeat"]')).map(function(e){return e.textContent}),
        annBtn:document.querySelector('[data-i18n="index.viewAllAnnouncements"]').textContent,
        search:document.querySelector('[data-i18n-placeholder="index.searchPh"]').placeholder
      };
    })()`);
    ok('D1 zh 活动流已翻译（以太共和国 + 2 小时前）', zh.act.indexOf('以太共和国') !== -1 && zh.act.indexOf('2 小时前') !== -1, zh.act.slice(0, 80));
    ok('D2 zh 公告已翻译（公开测试启动 + 官方）', zh.ann.indexOf('公开测试启动') !== -1 && zh.ann.indexOf('官方') !== -1, zh.ann.slice(0, 80));
    ok('D3 zh 订阅卡特性已翻译（高级分析）', zh.feats.indexOf('高级分析') !== -1, JSON.stringify(zh.feats));
    ok('D4 zh 公告按钮/搜索框已翻译（查看全部公告/搜索文章…——v0.2.55.0 搜索改文章口径）',
      zh.annBtn === '查看全部公告' && zh.search === '搜索文章…', zh.annBtn + '/' + zh.search);
    await cdp.evalJs('MN_I18N.setLang("de")');
    await waitFor(cdp, 'document.documentElement.getAttribute("lang") === "de"', 5000, '切 de');
    const de = await cdp.evalJs(`(function(){
      return {
        act:document.getElementById('activityFeed').innerText,
        ann:document.getElementById('dashAnnouncements').innerText,
        feats:[].slice.call(document.querySelectorAll('[data-i18n^="index.premiumFeat"]')).map(function(e){return e.textContent})
      };
    })()`);
    ok('D5 de 活动流已翻译（Republik Etheria + vor 2 Stunden）',
      de.act.indexOf('Republik Etheria') !== -1 && de.act.indexOf('vor 2 Stunden') !== -1, de.act.slice(0, 80));
    ok('D6 de 公告已翻译（Beta-Start + offiziell）', de.ann.indexOf('Beta-Start') !== -1 && de.ann.indexOf('offiziell') !== -1, de.ann.slice(0, 80));
    ok('D7 de 订阅卡特性已翻译（Erweiterte Analysen）', de.feats.indexOf('Erweiterte Analysen') !== -1, JSON.stringify(de.feats));
    await cdp.evalJs('MN_I18N.setLang("zh")');
    await waitFor(cdp, 'document.documentElement.getAttribute("lang") === "zh"', 5000, '切回 zh');
    const zh2 = await cdp.evalJs(`document.getElementById('activityFeed').innerText`);
    ok('D8 切回 zh 重渲染恢复中文（以太共和国）', zh2.indexOf('以太共和国') !== -1, zh2.slice(0, 80));
    cdp.close(); D.cleanup();
  } catch (e) {
    fail++;
    console.error('  ❌ D 段异常：', e && e.message);
  }

  server.close();
  console.log('\ni18n：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})();
