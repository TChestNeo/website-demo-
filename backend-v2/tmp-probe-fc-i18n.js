// tmp-probe-fc-i18n.js — FC v10.28.47.4 翻译轮上线实机探针（两页 12 语言接入）
// 用户「还有 FC还没有做翻译」——钦定：两页一起翻、卡片类型名翻译成和平台一样的
// （显示层本地化，草稿 dataset.label 英文规范名零改动）。
//   S 静态（线上 site-config 45.0 + FC 翻译 changelog + rev 00305- + 站点 58.0 恒、
//   两页 i18n 三件套挂载 + data-i18n-title 扫描 + __fcT + labelEdited payload 分支锚、
//   字典 12 语言 + zh-Hant 自动段）/ P 实机（桌面 CDP + 登录态 stub：
//   P1 zh 默认 chrome 逐字｜P2 资产面板 zh+英文属性｜P3 设置弹窗切语言实时重渲染｜
//   P4 en 英文 chrome+撤回 title 英文（zh 兜底恢复）｜P5 落地页 zh+英文委托点击｜
//   P6 zh-Hant OpenCC+卡面國旗｜P7 草稿往返 label 安全（存 Flag 非國旗）｜
//   P8 状态栏 zh 刚刚保存｜E1 零异常零 console error）。
// 探针纪律：草稿零污染（临时卡建后即删、draft 键快照后原样恢复）。
'use strict';
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PASS = { n: 0 }, FAIL = { n: 0 };
const ok = (name, cond, detail) => {
  if (cond) { PASS.n++; console.log('  ✅ ' + name); }
  else { FAIL.n++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
};
const get = (url) => new Promise((resolve) => {
  const req = https.request(url, { headers: { 'User-Agent': 'mn-probe' }, timeout: 30000 }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 2000000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
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
        this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 300));
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

(async () => {
  const BASE = 'https://mnationworld.com';

  // ── S 线上静态 ──
  const sc = await get(BASE + '/assets/js/site-config.js');
  ok('S1 线上 site-config：FC v10.28.47.4 + FC 翻译 changelog + rev 00305- + 站点恒 v0.2.58.2',
    sc.status === 200 && sc.body.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") !== -1 &&
    sc.body.indexOf('FC还没有做翻译') !== -1 && sc.body.indexOf('rev 00305-') !== -1 &&
    sc.body.indexOf('v0.2.58.2') !== -1,
    'status=' + sc.status + ' err=' + sc.error);
  const ed = await get(BASE + '/pages/fluidcanvas-editor.html');
  ok('S2 线上编辑器页：i18n 三件套挂载 + __fcT + labelEdited payload 分支 + 设置钮 data-i18n-title',
    ed.status === 200 &&
    ed.body.indexOf('assets/js/i18n.js') !== -1 &&
    ed.body.indexOf('assets/i18n/common.i18n.js') !== -1 &&
    ed.body.indexOf('assets/i18n/fluidcanvas.i18n.js') !== -1 &&
    ed.body.indexOf('window.__fcT') !== -1 &&
    ed.body.indexOf('data-i18n-title="fc.chrome.settings"') !== -1 &&
    ed.body.indexOf('未改名卡永远存 dataset.label 规范名 payload') !== -1,
    'status=' + ed.status + ' err=' + ed.error);
  const ld = await get(BASE + '/pages/fluidcanvas.html');
  ok('S3 线上落地页：i18n 三件套挂载 + data-i18n 节点',
    ld.status === 200 &&
    ld.body.indexOf('assets/js/i18n.js') !== -1 &&
    ld.body.indexOf('assets/i18n/common.i18n.js') !== -1 &&
    ld.body.indexOf('assets/i18n/fluidcanvas.i18n.js') !== -1 &&
    ld.body.indexOf('data-i18n=') !== -1,
    'status=' + ld.status + ' err=' + ld.error);
  const dict = await get(BASE + '/assets/i18n/fluidcanvas.i18n.js');
  ok('S4 线上字典：12 语言块 + zh-Hant 自动段 + zh 国旗/en Flag/zh-Hant 國旗',
    dict.status === 200 &&
    (dict.body.match(/window\.MN_I18N\.add\(/g) || []).length === 12 &&
    dict.body.indexOf('__ZH_HANT_AUTO__') !== -1 &&
    dict.body.indexOf('"fc.cardtype.flag": "国旗"') !== -1 &&
    dict.body.indexOf('"fc.cardtype.flag": "Flag"') !== -1 &&
    dict.body.indexOf('"fc.cardtype.flag": "國旗"') !== -1,
    'status=' + dict.status + ' err=' + dict.error);
  const i18njs = await get(BASE + '/assets/js/i18n.js');
  ok('S5 线上 i18n.js：data-i18n-title 扫描在位（apply 幂等）',
    i18njs.status === 200 && i18njs.body.indexOf('data-i18n-title') !== -1,
    'status=' + i18njs.status + ' err=' + i18njs.error);

  // ── P 线上实机（桌面 CDP + 登录态 stub）──
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-fci18n-' + Date.now());
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
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "!!window.MN_I18N && !!document.getElementById('gridCanvas') && !!window.publishArticle", 30000, 'P 编辑器加载');
    await sleep(800);

    // ── P1 zh 默认 chrome 逐字 ──
    const p1 = await cdp.evalJs("(function(){ function t(k){ var el=document.querySelector('[data-i18n=\"'+k+'\"]'); return el?el.textContent.trim():null; }" +
      " return { vp:t('fc.chrome.viewport'), tpl:t('fc.chrome.templates'), ly:t('fc.chrome.layers'), hist:t('fc.chrome.history')," +
      " sv:t('fc.chrome.saveDraft'), pub:t('fc.chrome.publish'), hs:document.getElementById('headerStatus').textContent," +
      " ss:document.getElementById('saveStatus').textContent, wc:document.getElementById('wordCount').textContent," +
      " cc:document.getElementById('charCount').textContent, lang:document.documentElement.lang }; })()");
    ok('P1 zh 默认 chrome 逐字：视口 ·/模板/图层/历史/保存草稿/发布 + 草稿/就绪/0 词 0 字符',
      p1.vp === '视口 ·' && p1.tpl === '模板' && p1.ly === '图层' && p1.hist === '历史' &&
      p1.sv === '保存草稿' && p1.pub === '发布' && p1.hs === '草稿' && p1.ss === '就绪' &&
      p1.wc === '0 词' && p1.cc === '0 字符' && p1.lang === 'zh', JSON.stringify(p1));

    // ── P2 资产面板 zh 标签 + 英文 payload 属性 ──
    const p2 = await cdp.evalJs("(function(){ function a(k){ var el=document.querySelector('[data-i18n=\"'+k+'\"]');" +
      " return el ? { label: el.textContent.trim(), asset: el.closest('[data-asset]') ? el.closest('[data-asset]').getAttribute('data-asset') : null," +
      " payload: el.closest('[data-asset]') ? el.closest('[data-asset]').getAttribute('data-label') : null } : null; }" +
      " return { flag:a('fc.asset.flag'), emblem:a('fc.asset.emblem'), content:a('fc.asset.contentCard') }; })()");
    ok('P2 资产面板：国旗/国徽/内容卡 zh 显示 + data-asset/data-label 英文 payload 恒在',
      p2.flag.label === '国旗' && p2.flag.asset === 'flag' && p2.flag.payload === 'National Flag' &&
      p2.emblem.label === '国徽' && p2.emblem.asset === 'shield' && p2.emblem.payload === 'Emblem' &&
      p2.content.label === '内容卡' && p2.content.asset === 'content' && p2.content.payload === 'Content Card',
      JSON.stringify(p2));

    // ── P3 设置弹窗切语言（药丸 → setLang 实时重渲染）──
    await cdp.evalJs('window.SlatiSettings.open()'); await sleep(400);
    const p3a = await cdp.evalJs("(function(){ var h3=document.querySelector('#settingsContainer h3[data-i18n=\"settings.sec.language\"]');" +
      " var pills=document.querySelectorAll('#langSubnav .subnav-pill'); return { h3: h3?h3.textContent.trim():null, pills: pills.length }; })()");
    await cdp.evalJs("(function(){ var b=document.querySelector('#langSubnav .subnav-pill[data-lang=\"en\"]'); b.click(); return true; })()");
    await sleep(300);
    const p3b = await cdp.evalJs("(function(){ return { sv: document.querySelector('[data-i18n=\"fc.chrome.saveDraft\"]').textContent.trim()," +
      " lang: document.documentElement.lang, stored: localStorage.getItem('slati_lang') }; })()");
    await cdp.evalJs("(function(){ var b=document.querySelector('#langSubnav .subnav-pill[data-lang=\"zh\"]'); b.click(); return true; })()");
    await sleep(300);
    const p3c = await cdp.evalJs("(function(){ return { sv: document.querySelector('[data-i18n=\"fc.chrome.saveDraft\"]').textContent.trim()," +
      " lang: document.documentElement.lang }; })()");
    await cdp.evalJs("(function(){ var c=document.getElementById('settingsCloseBtn'); if(c)c.click(); return true; })()");
    await sleep(200);
    ok('P3 设置弹窗切语言：h3 语言 + 12 药丸 → en 实时 Save Draft → zh 恢复保存草稿',
      p3a.h3 === '语言' && p3a.pills === 12 && p3b.sv === 'Save Draft' && p3b.lang === 'en' &&
      p3b.stored === 'en' && p3c.sv === '保存草稿' && p3c.lang === 'zh', JSON.stringify({ a: p3a, b: p3b, c: p3c }));

    // ── P4 en 英文 chrome + 撤回 title 英文（zh 兜底恢复）──
    await cdp.evalJs('window.MN_I18N.setLang("en")'); await sleep(250);
    const p4 = await cdp.evalJs("(function(){ return { undo: document.getElementById('undoBtn').getAttribute('title')," +
      " redo: document.getElementById('redoBtn').getAttribute('title'), pub: document.querySelector('[data-i18n=\"fc.chrome.publish\"]').textContent.trim() }; })()");
    await cdp.evalJs('window.MN_I18N.setLang("zh")'); await sleep(250);
    const p4z = await cdp.evalJs("document.getElementById('undoBtn').getAttribute('title')");
    ok('P4 en 恢复英文 chrome + 撤回 title 英文（Undo (Ctrl+Z)）；zh 下撤回 title 兜底恢复',
      p4.undo === 'Undo (Ctrl+Z)' && p4.redo === 'Redo (Ctrl+Y)' && p4.pub === 'Publish' &&
      p4z === '撤回 (Ctrl+Z)', JSON.stringify({ en: p4, zh: p4z }));

    // ── P5 落地页 zh + 英文 Edit/View 委托点击 ──
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas.html' });
    await waitFor(cdp, "!!window.MN_I18N && document.querySelectorAll('#artList .art-action-btn[title=\"Edit\"]').length > 0", 30000, 'P5 落地页');
    await sleep(600);
    const p5 = await cdp.evalJs("(function(){ var o=document.querySelector('#openEditorCta [data-i18n=\"fc.landing.openEditor\"]');" +
      " var e=document.querySelector('#artList .art-action-btn[title=\"Edit\"]');" +
      " var v=document.querySelector('#artList .art-action-btn[title=\"View\"]');" +
      " return { open: o?o.textContent.trim():null, editTitle: e?e.getAttribute('title'):null, viewTitle: v?v.getAttribute('title'):null," +
      " lang: document.documentElement.lang }; })()");
    await cdp.evalJs("(function(){ document.querySelector('#artList .art-action-btn[title=\"Edit\"]').click(); return true; })()");
    await waitFor(cdp, "window.location.href.indexOf('fluidcanvas-editor.html') !== -1", 15000, 'P5 Edit 委托跳编辑器');
    await waitFor(cdp, "!!window.MN_I18N && !!document.getElementById('gridCanvas')", 30000, 'P5 编辑器就绪');
    await sleep(600);
    ok('P5 落地页 zh 打开编辑器 + Edit/View title 恒英文 + 委托点击开编辑器',
      p5.open === '打开编辑器' && p5.editTitle === 'Edit' && p5.viewTitle === 'View' && p5.lang === 'zh',
      JSON.stringify(p5));

    // ── P6 zh-Hant OpenCC + 卡面國旗（重建随语言）──
    await cdp.evalJs('window.MN_I18N.setLang("zh-Hant")'); await sleep(300);
    await cdp.evalJs('window.createFlagCard("Flag", 5, 5, 5, 5)'); await sleep(300);
    const p6 = await cdp.evalJs("(function(){ var c=document.querySelector('#gridCanvas .grid-card[data-card-type=\"flag\"]');" +
      " var l=c.querySelector('.card-label'); return { vp: document.querySelector('[data-i18n=\"fc.chrome.viewport\"]').textContent.trim()," +
      " ly: document.querySelector('[data-i18n=\"fc.chrome.layers\"]').textContent.trim()," +
      " label: (l.value!=null?l.value:l.textContent).trim(), stored: c.dataset.label, lang: document.documentElement.lang }; })()");
    ok('P6 zh-Hant OpenCC：視口 ·/圖層 + 卡面 國旗（显示随语言）+ dataset.label 英文 Flag',
      p6.vp === '視口 ·' && p6.ly === '圖層' && p6.label === '國旗' && p6.stored === 'Flag' && p6.lang === 'zh-Hant',
      JSON.stringify(p6));

    // ── P7 草稿往返 label 安全：存英文规范名 Flag（显示文本國旗不入数据）──
    const draftBefore = await cdp.evalJs("localStorage.getItem('slati_fluidcanvas_draft')");
    await cdp.evalJs('window.saveDraft()'); await sleep(300);
    const p7 = await cdp.evalJs("(function(){ try { var d=JSON.parse(localStorage.getItem('slati_fluidcanvas_draft'));" +
      " return { label: d.cards[0].label, title: d.title }; } catch(e) { return null; } })()");
    ok('P7 草稿往返 label 安全：saveDraft 存英文规范名 Flag（显示文本國旗不入数据）',
      p7 && p7.label === 'Flag', JSON.stringify(p7));

    // ── P8 状态栏 zh 刚刚保存（保存草稿按钮 → savedNow）──
    await cdp.evalJs('window.MN_I18N.setLang("zh")'); await sleep(250);
    await cdp.evalJs("(function(){ var b=document.querySelector('[data-i18n=\"fc.chrome.saveDraft\"]'); b.click(); return true; })()");
    await sleep(400);
    const p8 = await cdp.evalJs("(function(){ return { ss: document.getElementById('saveStatus').textContent," +
      " hs: document.getElementById('headerStatus').textContent }; })()");
    ok('P8 状态栏 zh：点击保存草稿 → saveStatus 刚刚保存 + 徽章 草稿',
      p8.ss === '刚刚保存' && p8.hs === '草稿', JSON.stringify(p8));

    // ── 零污染收尾：临时卡移除 + 草稿键原样恢复（快照前=无 → 删键）──
    await cdp.evalJs("(function(){ var cs=document.querySelectorAll('#gridCanvas .grid-card');" +
      " for (var i=0;i<cs.length;i++){ if (cs[i].parentNode) cs[i].parentNode.removeChild(cs[i]); } return true; })()");
    await cdp.evalJs(draftBefore == null
      ? "try{localStorage.removeItem('slati_fluidcanvas_draft');}catch(e){}; true"
      : "try{localStorage.setItem('slati_fluidcanvas_draft', " + JSON.stringify(draftBefore) + ");}catch(e){}; true");

    ok('E1 实机全程零 Runtime.exceptionThrown + 零 console.error',
      cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      JSON.stringify({ errs: cdp.errs.slice(0, 3), cons: cdp.consoleErrs.slice(0, 3) }));
    cdp.close();
  } catch (e) {
    console.error('💥 探针异常: ' + (e && e.stack || e));
    FAIL.n++;
  } finally {
    try { chrome.kill(); } catch (e) {}
  }
  console.log('');
  console.log('╭──────────────────────────────────────────╮');
  console.log('│  🎉 ' + PASS.n + ' ✅ / ' + FAIL.n + ' ❌  (fc-i18n-live)           │');
  console.log('╰──────────────────────────────────────────╯');
  if (FAIL.n > 0) process.exit(1);
  else process.exit(0);
})().catch((e) => { console.error('💥 探针异常: ' + (e && e.stack || e)); process.exit(1); });
