// tmp-battery-fc-undo.js — 撤回/恢复验证（2026-09-11 初版 v0.2.30.0；v0.2.40.1/v10.28.30.1 口径复跑：
// S1 改纯图标断言「用户『能不能把undo和redo的按钮只是保留icon不需要名称』」+ F4/S8 版本更新；
// v0.2.40.2/v10.28.30.2 口径再跑：F4/S8 版本更新「用户『设置和Tags能不能也是只有一个icon?』」）
// 背景：用户「能不能在顶部添加一个撤回和恢复按钮」。本轮新增：
//   快照式撤销栈（buildDraft JSON 串剥 lastSaved 时间戳、600ms 防抖挂在
//   onContentChange 尾零调用点改动、基线初始化完成后即拍下——首个改动即可撤回回原点、
//   栈上限 60）；工具栏 撤回/恢复 两钮（disabled 灰态）；Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y
//   （input/textarea/contenteditable 焦点让位原生撤销）；historyRestore 走
//   applyDraft（v10.28.15.2 先清画布→幂等）+saveDraft 落库+重基线防漂移。
// 断言组：
//   F1-F4 静态：工具栏按钮/撤销引擎函数/onContentChange 钩子+键盘守卫/版本链与版本号；
//   S1-S8 浏览器：按钮在场+初始灰态/工厂创建可撤/两步往返/三步深栈/键盘/输入框守卫/
//     撤销态即时落草稿/重载持久/版本徽章；
//   Z 全程零 console error。
// 跑法：node tmp-battery-fc-undo.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4500 + Math.floor(Math.random() * 400);
const CDP_PORT = 5500 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fcundo-' + Date.now());

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err && path.extname(file) === '') {
      fs.readFile(file + '.html', (e2, b2) => {
        if (e2) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b2);
      });
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

(async () => {
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name); } };

  await new Promise(r => server.listen(PORT, r));
  const BASE = 'http://127.0.0.1:' + PORT;

  // ── F1-F4 静态 ──
  const fce = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  ok('F1 静态：工具栏 撤回/恢复 两钮纯图标（onclick+disabled+undoBtn 在 History 钮之前+title 悬停提示保留+无文字标签）',
    fce.indexOf('id="undoBtn" onclick="historyUndoAction()" disabled') !== -1 &&
    fce.indexOf('id="redoBtn" onclick="historyRedoAction()" disabled') !== -1 &&
    fce.indexOf('id="undoBtn"') !== -1 && fce.indexOf('id="undoBtn"') < fce.indexOf("onclick=\"openModal('historyModal')\"") &&
    fce.indexOf('title="撤回 (Ctrl+Z)"') !== -1 && fce.indexOf('title="恢复 (Ctrl+Y)"') !== -1 &&
    fce.indexOf('undo</span> 撤回') === -1 && fce.indexOf('redo</span> 恢复') === -1);
  ok('F2 静态：撤销引擎（historySnapshot 剥 lastSaved/防抖 600/上限 60/applyDraft 恢复+saveDraft+重基线/初始化后即拍基线）',
    fce.indexOf('function historySnapshot(') !== -1 &&
    fce.indexOf('delete d.lastSaved') !== -1 &&
    fce.indexOf('setTimeout(historyCommit, 600)') !== -1 &&
    fce.indexOf('var HISTORY_CAP = 60;') !== -1 &&
    fce.indexOf('undoStack.push(lastCommitted)') !== -1 &&
    fce.indexOf('redoStack.length = 0;') !== -1 &&
    fce.indexOf('applyDraft(JSON.parse(snap))') !== -1 &&
    fce.indexOf('lastCommitted = historySnapshot(); // 以实际还原态重基线') !== -1 &&
    fce.indexOf('if (lastCommitted === null) lastCommitted = historySnapshot();') !== -1);
  ok('F3 静态：onContentChange 尾钩 + Ctrl+Z/Y 键盘守卫（INPUT/TEXTAREA/contenteditable 让位原生撤销）',
    fce.indexOf('scheduleHistoryCommit(); // v10.28.20') !== -1 &&
    fce.indexOf("el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable") !== -1 &&
    fce.indexOf("k === 'y' || (k === 'z' && e.shiftKey)") !== -1);
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('F4 静态：buildDraft 版本链 v10.28.20 条目仍在 + 站点号 v0.2.45.2 + FC 号 v10.28.34.2（贴齐缝修复轮复跑口径）',
    fce.indexOf('v10.28.20 adds NO new fields (撤回/恢复') !== -1 &&
    sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.45.2';") !== -1 &&
    sconf.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.34.2';") !== -1 &&
    sconf.indexOf('小改动位 40→41') !== -1 &&
    sconf.indexOf('保留icon不需要名称') !== -1 &&
    sconf.indexOf('设置和Tags') !== -1);

  // ── Chrome CDP ──
  let chromePath = null;
  for (const p of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

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
    if (!up) throw new Error('CDP 没起来');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    console.log('  ℹ CDP 就绪');

    // 注：不预清 slati_fluidcanvas_draft（S12 陷阱）——全新 --user-data-dir 本就空 localStorage。
    const preset = (withSession) => cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{' +
        (withSession ? 'localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');' : '') +
        '}catch(e){}'
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const cellVal = "document.querySelector('.grid-card.sheet-card .sheet-body-row .sheet-cell').value";

    // ── S1-S8 浏览器 ──
    await preset(true);
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.getElementById('undoBtn') && typeof window.historyUndoAction === 'function'", 'S1 编辑器加载');

    ok('S1 初始：撤回/恢复两钮在场纯图标（无文字标签）+ 双灰态（无历史可撤可恢）',
      await cdp.evalJs("(function(){ var u = document.getElementById('undoBtn'), r = document.getElementById('redoBtn'); return !!u && !!r && u.disabled && r.disabled && u.textContent.trim() === 'undo' && r.textContent.trim() === 'redo' && u.title === '撤回 (Ctrl+Z)' && r.title === '恢复 (Ctrl+Y)'; })()"));

    ok('S2a 工厂创建可撤：createSheetCard 种子 3 行也走 onContentChange → 防抖提交后撤回钮亮',
      await cdp.evalJs("(function(){ window.createSheetCard(2, 2); return !!document.querySelector('.grid-card.sheet-card'); })()") &&
      await waitFor(cdp, "!document.getElementById('undoBtn').disabled", 4000, 'S2a 防抖提交'));
    await cdp.evalJs("(function(){ var inp = document.querySelector('.grid-card.sheet-card .sheet-body-row .sheet-cell'); inp.value = '苹果'; inp.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
    await sleep(800); // 等 600ms 防抖提交
    ok('S2b 编辑单元格 苹果 → 防抖提交 → 撤一步值回空（卡片在）→ 再撤一步卡片整张消失（回初始画布）+ 撤回钮灰 + 恢复钮亮',
      await cdp.evalJs("(function(){ var u = document.getElementById('undoBtn'), r = document.getElementById('redoBtn'); u.click(); var v1 = document.querySelector('.grid-card.sheet-card .sheet-body-row .sheet-cell').value; u.click(); var gone = !document.querySelector('.grid-card.sheet-card'); return v1 === '' && gone && u.disabled && !r.disabled; })()"));
    ok('S2c 恢复两步：卡片回来 + 值回来（苹果）+ 恢复钮灰 + 撤回钮亮',
      await cdp.evalJs("(function(){ var u = document.getElementById('undoBtn'), r = document.getElementById('redoBtn'); r.click(); var c1 = !!document.querySelector('.grid-card.sheet-card'); var v1 = document.querySelector('.grid-card.sheet-card .sheet-body-row .sheet-cell').value; r.click(); var v2 = document.querySelector('.grid-card.sheet-card .sheet-body-row .sheet-cell').value; return c1 && v1 === '' && v2 === '苹果' && !u.disabled && r.disabled; })()"));

    await cdp.evalJs("(function(){ var inp = document.querySelector('.grid-card.sheet-card .sheet-body-row .sheet-cell'); inp.value = '香蕉'; inp.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
    await sleep(800); // 等 600ms 防抖提交
    ok('S3 三步深栈：再编辑 香蕉 → 三连撤（苹果→空→卡消失）→ 三连恢（空→苹果→香蕉）+ 恢复钮再灰',
      await cdp.evalJs("(function(){ var u = document.getElementById('undoBtn'), r = document.getElementById('redoBtn'); var cell = function(){ var el = document.querySelector('.grid-card.sheet-card .sheet-body-row .sheet-cell'); return el ? el.value : null; }; u.click(); var a1 = cell(); u.click(); var a2 = cell(); u.click(); var a3 = cell(); r.click(); var b1 = cell(); r.click(); var b2 = cell(); r.click(); var b3 = cell(); return a1 === '苹果' && a2 === '' && a3 === null && b1 === '' && b2 === '苹果' && b3 === '香蕉' && !u.disabled && r.disabled; })()"));

    ok('S4 键盘：Ctrl+Z 撤回一步回 苹果、Ctrl+Y 恢复回 香蕉',
      await cdp.evalJs("(function(){ var u = document.getElementById('undoBtn'), r = document.getElementById('redoBtn'); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true })); var v1 = document.querySelector('.grid-card.sheet-card .sheet-body-row .sheet-cell').value; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, cancelable: true })); var v2 = document.querySelector('.grid-card.sheet-card .sheet-body-row .sheet-cell').value; return v1 === '苹果' && v2 === '香蕉' && !u.disabled && r.disabled; })()"));

    ok('S5 守卫：焦点在单元格输入框时 Ctrl+Z 不触发画布撤销（值仍 香蕉、撤回栈不动）',
      await cdp.evalJs("(function(){ var inp = document.querySelector('.grid-card.sheet-card .sheet-body-row .sheet-cell'); inp.focus(); var wasInput = document.activeElement === inp; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true })); var v = inp.value; inp.blur(); var u = document.getElementById('undoBtn'), r = document.getElementById('redoBtn'); return wasInput && v === '香蕉' && !u.disabled && r.disabled; })()"));

    ok('S6 撤销态即时落草稿：再撤一步 → localStorage 草稿同步为 苹果 态（historyRestore 内 saveDraft）',
      await cdp.evalJs("(function(){ document.getElementById('undoBtn').click(); var d = JSON.parse(localStorage.getItem('slati_fluidcanvas_draft')); var sheet = null; for (var i = 0; i < d.cards.length; i++){ if (d.cards[i].type === 'sheet') { sheet = d.cards[i]; break; } } if (!sheet) return false; var sd = JSON.parse(sheet.sheetData); return sd.cells[1][0] === '苹果'; })()"));

    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.grid-card.sheet-card')", 'S7 重载恢复');
    ok('S7 重载持久：撤销态不丢（苹果）+ 新会话栈为空（双钮灰、不重复叠卡）',
      await cdp.evalJs("(function(){ var inp = document.querySelector('.grid-card.sheet-card .sheet-body-row .sheet-cell'); var u = document.getElementById('undoBtn'), r = document.getElementById('redoBtn'); return inp.value === '苹果' && document.querySelectorAll('.grid-card.sheet-card').length === 1 && u.disabled && r.disabled; })()"));

    ok('S8 版本徽章：右下角 badge 渲染 FC v10.28.34.2（最新构建标识）',
      await cdp.evalJs("(function(){ var ds = document.querySelectorAll('body > div'); for (var i=0;i<ds.length;i++){ if (ds[i].textContent === 'FC v10.28.34.2') return true; } return false; })()"));

    ok('Z 零 console error', cdp.errs.length === 0);
    if (cdp.errs.length) console.log('  errors:', JSON.stringify(cdp.errs).slice(0, 600));

    await cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  }
  console.log('\n  ── 结果: ' + pass + '/' + (pass + fail) + ' 全绿' + (fail === 0 ? ' ✅' : ' ❌'));
  if (fail) process.exit(1);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
