// tmp-battery-autosave-interval.js — v0.2.40.0 / FC v10.28.30.0 自动保存周期制电池
//   （v0.2.40.2/v10.28.30.2 口径复跑：F1 版本更新+齿轮/Tags 两钮纯图标钉「用户『设置和Tags能不能也是只有一个icon?』」）
// （用户「平台自动保存能不能是每10分钟一次？用户可以在设置里调整保存时间频率，
//  然后最快是5分钟一次」：3s 防抖→固定节拍心跳；频率=slati_settings.fcAutoSave
//  五档药丸 5/10/15/30/60 默认 10 clamp 下限 5；齿轮→平台设置弹窗「编辑器」区；
//  pagehide 兜底保存。时钟=注入式 setTimeout 加速（≥60s→150ms 真跑+记录原 delay），
//  产品代码零加速钩子——10 分钟节拍不真等）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5700 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-autosave-' + Date.now());
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
        this.errs.push(JSON.stringify({ text: d.text, desc: d.exception && d.exception.description, url: d.url, line: d.lineNumber }).slice(0, 300));
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

(async () => {
  // ═══ F 静态检查 ═══
  const fceSrc = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  const sconfSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  const smSrc = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'settings-modal.js'), 'utf8');
  ok('F1 静态：设置弹窗（fcAutoSave:10/事件/编辑器区/药丸容器）+编辑器（心跳函数/clamp/pagehide 监听/改频监听/齿轮/3s 防抖已除）+齿轮/Tags 两钮纯图标（无文字标签+title 悬停提示）+版本 v0.2.45.2/v10.28.34.2',
    smSrc.indexOf('fcAutoSave: 10') !== -1 &&
    smSrc.indexOf('slati-settings-changed') !== -1 &&
    smSrc.indexOf("label: '编辑器'") !== -1 &&
    smSrc.indexOf('fcAutoSubnav') !== -1 &&
    fceSrc.indexOf('function scheduleAutoSaveTick()') !== -1 &&
    fceSrc.indexOf('function getAutoSaveIntervalMs()') !== -1 &&
    fceSrc.indexOf("if (m < 5) m = 5;") !== -1 &&
    fceSrc.indexOf("addEventListener('pagehide'") !== -1 &&
    fceSrc.indexOf("addEventListener('slati-settings-changed'") !== -1 &&
    fceSrc.indexOf('id="settingsBtn"') !== -1 &&
    fceSrc.indexOf('window.SlatiSettings.open()') !== -1 &&
    fceSrc.indexOf('settings</span> 设置') === -1 &&
    fceSrc.indexOf('sell</span> Tags') === -1 &&
    fceSrc.indexOf('onclick="openModal(\'tagsModal\')" title="Tags"') !== -1 &&
    fceSrc.indexOf('setTimeout(autoSave, 3000)') === -1 &&
    sconfSrc.indexOf("window.MN_SITE_VERSION = 'v0.2.45.2';") !== -1 &&
    sconfSrc.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.34.2';") !== -1 &&
    sconfSrc.indexOf('自动保存周期') !== -1);

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
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    // 时钟加速包（仅电池注入）：delay ≥60s 记入 __longTimers 后以 150ms 真跑——10 分钟节拍不真等
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: "(function(){ var r = window.setTimeout.bind(window); window.__longTimers = []; " +
        "window.setTimeout = function(fn, d){ var a = Array.prototype.slice.call(arguments, 2); " +
        "if (typeof d === 'number' && d >= 60000) { window.__longTimers.push(d); return r(function(){ fn.apply(null, a); }, 150); } " +
        "return r.apply(null, [fn, d].concat(a)); }; })();"
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const draftHas = (label) => cdp.evalJs("(function(){ var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}'); return JSON.stringify(d).indexOf('" + label + "') !== -1; })()");
    const draftLastSaved = () => cdp.evalJs("(function(){ var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}'); return d.lastSaved || null; })()");

    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function' && typeof window.SlatiSettings !== 'undefined'", '编辑器就绪');

    // ── S1 默认节拍 10 分钟（600000ms）+ 改动自动落草稿 + 徽章复位 ──
    let r = await cdp.evalJs('window.__longTimers.indexOf(600000) !== -1');
    ok('S1a 心跳按默认 10 分钟武装（600000ms 已记录）', r === true, '');
    await cdp.evalJs("window.createFlagCard('autosave-test', 0, 12, 8, 5)");
    await sleep(500); // 加速后 ~3 拍
    const s1 = await cdp.evalJs("JSON.stringify({ saved: JSON.stringify(JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}')).indexOf('autosave-test') !== -1, " +
      "badge: document.getElementById('headerStatus').textContent, label: document.getElementById('lastSavedLabel').textContent })");
    const s1d = JSON.parse(s1);
    ok('S1b 改动后节拍到点自动落草稿+徽章 Draft+「Saved just now」',
      s1d.saved && s1d.badge === 'Draft' && s1d.label === 'Saved just now', s1);

    // ── S2 干净不写（脏守卫：无改动节拍空转 lastSaved 不变） ──
    const ls0 = await draftLastSaved();
    await sleep(400); // ≥2 拍，无任何改动
    const ls1 = await draftLastSaved();
    ok('S2 无改动节拍空转不重写草稿（lastSaved 不变）', ls0 !== null && ls1 === ls0, JSON.stringify({ ls0: ls0, ls1: ls1 }));

    // ── S3 齿轮→设置弹窗「编辑器」区默认落位+10 active→点 5 分钟→持久+心跳 300000 重排→改动已存 ──
    await cdp.evalJs("document.getElementById('settingsBtn').click()");
    // v0.2.45.2: 遮罩 active 在 requestAnimationFrame 里才挂——固定 300ms 高负载下偶发读到
    // false（S3a 红实证）；改收敛轮询（caredge-dark B2 先例）
    await waitFor(cdp, "document.getElementById('settingsBackdrop') && document.getElementById('settingsBackdrop').classList.contains('active')", 3000, 'S3a 设置遮罩激活');
    const s3a = await cdp.evalJs("JSON.stringify({ backdrop: document.getElementById('settingsBackdrop').classList.contains('active'), " +
      "menu: Array.prototype.map.call(document.querySelectorAll('#settingsMenu .settings-menu-item'), function(b){ return b.textContent; }), " +
      "activeSec: (document.querySelector('.settings-menu-item.active') || { dataset: {} }).dataset.sec || null, " +
      "paneSec: (document.querySelector('.settings-sec:not(.settings-sec-hidden)') || { dataset: {} }).dataset.sec || null, " +
      "pill10: !!(document.querySelector('#fcAutoSubnav .subnav-pill[data-min=\"10\"]') || {}).classList.contains('active'), " +
      "gearIconOnly: document.getElementById('settingsBtn').textContent.trim() === 'settings', " +
      "tagsIconOnly: (function(){ var t = document.querySelector('[onclick=\"openModal(\\'tagsModal\\')\"]'); return !!t && t.textContent.trim() === 'sell' && t.title === 'Tags'; })() })");
    const s3ad = JSON.parse(s3a);
    ok('S3a 齿轮开弹窗+菜单含「编辑器」+默认落编辑器区+10 分钟 active+齿轮/Tags 两钮纯图标（title 悬停提示）',
      s3ad.backdrop && s3ad.menu.some(function (x) { return x.indexOf('编辑器') !== -1; }) && s3ad.activeSec === 'editor' && s3ad.paneSec === 'editor' && s3ad.pill10 && s3ad.gearIconOnly && s3ad.tagsIconOnly, s3a);
    await cdp.evalJs("document.querySelector('#fcAutoSubnav .subnav-pill[data-min=\"5\"]').click()");
    await sleep(300);
    const s3b = await cdp.evalJs("JSON.stringify({ v: (JSON.parse(localStorage.getItem('slati_settings') || '{}')).fcAutoSave, " +
      "long300: window.__longTimers.indexOf(300000) !== -1 })");
    const s3bd = JSON.parse(s3b);
    ok('S3b 点 5 分钟=slati_settings.fcAutoSave=5+心跳按 300000 重排', s3bd.v === 5 && s3bd.long300, s3b);
    await cdp.evalJs("window.createFlagCard('autosave-5min', 0, 14, 8, 5)");
    await sleep(500);
    const s3c = await draftHas('autosave-5min');
    ok('S3c 改频后改动按新节拍自动落草稿', s3c === true, '');
    await cdp.evalJs("window.SlatiSettings.close()");

    // ── S4 clamp：直写 fcAutoSave=1 → reload → 心跳仍按 300000（下限 5 分钟） ──
    await cdp.evalJs("localStorage.setItem('slati_settings', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('slati_settings') || '{}'), { fcAutoSave: 1 })))");
    await cdp.send('Page.reload');
    await waitFor(cdp, "typeof window.createFlagCard === 'function' && typeof window.SlatiSettings !== 'undefined'", 20000, '编辑器 reload 就绪');
    await sleep(400);
    const s4 = await cdp.evalJs("JSON.stringify({ long300: window.__longTimers.indexOf(300000) !== -1, long60: window.__longTimers.indexOf(60000) !== -1, " +
      "v: (JSON.parse(localStorage.getItem('slati_settings') || '{}')).fcAutoSave })");
    const s4d = JSON.parse(s4);
    ok('S4 clamp 下限 5：fcAutoSave=1 也被 300000 武装（无 60000）', s4d.long300 && !s4d.long60 && s4d.v === 1, s4);

    // ── S5 Ctrl+S 立即保存（零等待节拍） ──
    const s5 = await cdp.evalJs("(function(){ window.createFlagCard('ctrl-s-test', 0, 16, 8, 5); " +
      "document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true })); " +
      "return JSON.stringify(JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}')).indexOf('ctrl-s-test') !== -1; })()");
    ok('S5 Ctrl+S 立即落草稿（不等节拍）', s5 === true, '');

    // ── S6 pagehide 关页兜底：脏内容立即存 ──
    const s6 = await cdp.evalJs("(function(){ window.createFlagCard('pagehide-test', 0, 18, 8, 5); " +
      "window.dispatchEvent(new Event('pagehide')); " +
      "return JSON.stringify(JSON.parse(localStorage.getItem('slati_fluidcanvas_draft') || '{}')).indexOf('pagehide-test') !== -1; })()");
    ok('S6 pagehide 脏内容兜底立即落草稿', s6 === true, '');

    // ── S7 非编辑器页：设置弹窗无「编辑器」区、默认落 profile ──
    await nav(BASE + '/index.html', "typeof window.SlatiSettings !== 'undefined'", '首页就绪');
    await cdp.evalJs('window.SlatiSettings.open()');
    await waitFor(cdp, "document.getElementById('settingsBackdrop') && document.getElementById('settingsBackdrop').classList.contains('active')", 3000, 'S7 设置遮罩激活');
    const s7 = await cdp.evalJs("JSON.stringify({ menu: Array.prototype.map.call(document.querySelectorAll('#settingsMenu .settings-menu-item'), function(b){ return b.textContent; }), " +
      "activeSec: (document.querySelector('.settings-menu-item.active') || { dataset: {} }).dataset.sec || null, " +
      "backdrop: document.getElementById('settingsBackdrop').classList.contains('active') })");
    const s7d = JSON.parse(s7);
    ok('S7 非编辑器页弹窗无「编辑器」区+默认 profile+正常打开', s7d.backdrop && s7d.menu.every(function (x) { return x.indexOf('编辑器') === -1; }) && s7d.activeSec === 'profile', s7);
    await cdp.evalJs('window.SlatiSettings.close()');

    // ── Z 零 console error ──
    ok('Z 零 console error', cdp.errs.length === 0, JSON.stringify(cdp.errs));

    cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
  }
  console.log('\n  ── 结果: ' + PASS + '/' + (PASS + FAIL) + (FAIL === 0 ? ' 全绿 ✅' : ' 有红 ❌'));
  process.exit(FAIL === 0 ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
