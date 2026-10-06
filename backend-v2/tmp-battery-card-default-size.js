// tmp-battery-card-default-size.js — v0.2.30.5 国旗卡/国徽卡默认尺寸验证（2026-09-12）
// 背景：用户「把国旗卡片改成 长5格 国徽卡片改成5x5」→问询钦定国旗=8宽×5长。
//   国旗卡默认 8×6→8×5（assetSpan flag h 6→5 + 草稿恢复 rowSpan||5）、
//   国徽卡（shield 资产卡）默认 4×3→5×5（assetSpan shield 显式 5×5 +
//   草稿恢复新增 shield 分支 colSpan||5/rowSpan||5）。
// 断言组：
//   F1-F5 静态：assetSpan 两处/草稿恢复两处/buildDraft 链/版本号/调色板入口；
//   S1-S9 浏览器：调色板 DOM/拖放 flag 8×5/拖放 shield 5×5（4×3 不再）/
//     shield 近正方形/草稿往返/legacy 无 span 兜底 8×5+5×5/旧草稿存了 span
//     则尊重旧尺寸不强制改；
//   Z 全程零 console error。
// 跑法：node tmp-battery-card-default-size.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4500 + Math.floor(Math.random() * 400);
const CDP_PORT = 5500 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-cardsize-' + Date.now());

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

  // ── F1-F5 静态 ──
  const fce = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  ok('F1 静态：assetSpan flag 8×5 + shield 显式 5×5（旧通用兜底 4×3 仍在，其他资产不受影响）',
    fce.indexOf("if (asset === 'flag') return { w: 8, h: 5 };") !== -1 &&
    fce.indexOf("if (asset === 'shield') return { w: 5, h: 5 };") !== -1 &&
    fce.indexOf('return { w: 4, h: 3 };') !== -1);
  ok('F2 静态：草稿恢复 flag rowSpan||5 + shield 分支 colSpan||5/rowSpan||5',
    fce.indexOf("createFlagCard(cData.label || 'Flag', pos.col, pos.row, pos.colSpan || 8, pos.rowSpan || 5)") !== -1 &&
    fce.indexOf("} else if (cData.type === 'shield') {") !== -1 &&
    fce.indexOf("createAssetCard('shield', cData.label, pos.col, pos.row, pos.colSpan || 5, pos.rowSpan || 5)") !== -1);
  ok('F3 静态：buildDraft 链 v10.28.20.5 条目（国旗卡 8×6→8×5、国徽卡 4×3→5×5）',
    fce.indexOf('v10.28.20.5 adds NO new fields (国旗卡默认 8×6→8×5、国徽卡默认 4×3→5×5') !== -1);
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('F4 静态：站点号 v0.2.30.5 + FC 号 v10.28.20.5（两线各一处）+ 补丁位 4→5·观感微调轮注释',
    sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.30.5';") !== -1 &&
    sconf.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.20.5';") !== -1 &&
    sconf.indexOf('补丁位 4→5·观感微调轮；2026-09-12') !== -1);
  ok('F5 静态：调色板两入口 data-asset="flag" National Flag + data-asset="shield" Emblem',
    fce.indexOf('data-asset="flag" data-label="National Flag"') !== -1 &&
    fce.indexOf('data-asset="shield" data-label="Emblem"') !== -1);

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
    // 模拟调色板 drop：构造 DataTransfer + 在 gridCanvas 上派发 drop（
    // lastDragPos 为空 → findFreeCell 找空位，span 走 assetSpan——正是
    // 用户拖出来的真实路径）
    const dropAsset = (asset, label) => cdp.evalJs("(function(){ var dt = new DataTransfer(); dt.setData('text/plain', JSON.stringify({ asset: " + JSON.stringify(asset) + ", label: " + JSON.stringify(label) + " })); window.gridCanvas.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); return true; })()");

    await preset(true);
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S1 编辑器加载');

    ok('S1 调色板：National Flag + Emblem 两入口在 DOM',
      await cdp.evalJs("(function(){ var els = document.querySelectorAll('.asset-panel .card[draggable]'); var f = false, s = false; for (var i=0;i<els.length;i++){ if (els[i].dataset.asset === 'flag' && els[i].querySelector('.label-md').textContent === 'National Flag') f = true; if (els[i].dataset.asset === 'shield' && els[i].querySelector('.label-md').textContent === 'Emblem') s = true; } return f && s; })()"));

    await dropAsset('flag', 'National Flag');
    ok('S2 拖放国旗卡：新卡 cardType=flag + 默认 8宽×5长（dataset colSpan=8 rowSpan=5）',
      await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-type=\"flag\"]'); return !!c && c.dataset.colSpan === '8' && c.dataset.rowSpan === '5'; })()"));

    await dropAsset('shield', 'Emblem');
    ok('S3 拖放国徽卡：新卡 cardType=shield + 默认 5×5（旧 4×3 不再）',
      await cdp.evalJs("(function(){ var c = document.querySelector('.grid-card[data-card-type=\"shield\"]'); return !!c && c.dataset.colSpan === '5' && c.dataset.rowSpan === '5'; })()"));

    ok('S4 形状：国徽卡近正方形、国旗卡宽大于长（8×5 横向旗面）',
      await cdp.evalJs("(function(){ var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); return Math.abs(s.offsetWidth - s.offsetHeight) <= 2 && f.offsetWidth > f.offsetHeight; })()"));

    // S5 草稿往返：drop 两卡 → saveDraft → 重载 → 8×5 / 5×5 随草稿恢复
    await cdp.evalJs("window.saveDraft(); true");
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.grid-card[data-card-type=\"shield\"]')", 'S5 重载恢复');
    ok('S5 草稿往返：重载后国旗 8×5、国徽 5×5（drop 路径的尺寸随草稿往返）',
      await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); return !!f && !!s && f.dataset.colSpan === '8' && f.dataset.rowSpan === '5' && s.dataset.colSpan === '5' && s.dataset.rowSpan === '5'; })()"));

    // S6 兜底：legacy 草稿无 colSpan/rowSpan → 恢复走新兜底（flag 8×5、shield 5×5）
    await cdp.evalJs("(function(){ localStorage.setItem('slati_fluidcanvas_draft', JSON.stringify({ title: 'LegacyNoSpan', cards: [ { id: 'c901', type: 'flag', label: 'LegacyFlag', col: 10, row: 10 }, { id: 'c902', type: 'shield', label: 'LegacyEmblem', col: 14, row: 10 } ], settings: { snapOn: true, alignOn: true }, activePreset: null, presets: {}, groupStyles: {}, lastSaved: Date.now() })); return true; })()");
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.grid-card[data-card-type=\"flag\"]')", 'S6 legacy 无 span 恢复');
    ok('S6 兜底：legacy 草稿无 colSpan/rowSpan → 国旗 8×5、国徽 5×5（新默认兜底生效）',
      await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); return !!f && !!s && f.dataset.colSpan === '8' && f.dataset.rowSpan === '5' && s.dataset.colSpan === '5' && s.dataset.rowSpan === '5'; })()"));

    // S7 旧草稿尊重：legacy 草稿存了旧 span（flag 8×6、shield 4×3）→
    // 恢复仍用存值，不强制改旧画布
    await cdp.evalJs("(function(){ localStorage.setItem('slati_fluidcanvas_draft', JSON.stringify({ title: 'LegacyOldSpan', cards: [ { id: 'c911', type: 'flag', label: 'OldFlag', col: 10, row: 10, colSpan: 8, rowSpan: 6 }, { id: 'c912', type: 'shield', label: 'OldEmblem', col: 14, row: 10, colSpan: 4, rowSpan: 3 } ], settings: { snapOn: true, alignOn: true }, activePreset: null, presets: {}, groupStyles: {}, lastSaved: Date.now() })); return true; })()");
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.grid-card[data-card-type=\"shield\"]')", 'S7 legacy 旧 span 恢复');
    ok('S7 旧草稿尊重：存了旧 span 的草稿恢复仍 8×6 / 4×3（不强制改旧画布）',
      await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); return !!f && !!s && f.dataset.colSpan === '8' && f.dataset.rowSpan === '6' && s.dataset.colSpan === '4' && s.dataset.rowSpan === '3'; })()"));

    ok('S8 版本徽章：右下角 badge 渲染 FC v10.28.20.5（最新构建标识）',
      await cdp.evalJs("(function(){ var ds = document.querySelectorAll('body > div'); for (var i=0;i<ds.length;i++){ if (ds[i].textContent === 'FC v10.28.20.5') return true; } return false; })()"));

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
