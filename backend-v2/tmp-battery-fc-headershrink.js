// tmp-battery-fc-headershrink.js — FC v10.28.48.0 编辑页顶部栏缩身+迁移按钮白底白字修复电池
// 用户「能不能吧FC编辑页的顶部栏缩小一些太大了」+「还有顶部的迁移按钮为什么文字默认是白底白字的」
// 验证：F 静态锚（site-config 45.1/00348-/58.0 恒 + 子代选择器在源 + 缩身规则在源）
//   / H 头栏缩身段（桌面 1280 窗口 computed）：
//         H1 头栏纵向垫 5px + gap 8px；H2 头栏总高 ~42px（旧 ~64）
//         H3 btn-sm 垫 3px 12px；H4 返回钮 btn-icon 30×30 + padding 0
//         H5 undo 图标 20px；H6 标题 article 图标 18px；H7 钮高 ≤34（旧 38/40）
//   / M 迁移按钮修复段（双重 invert 真身回归）：
//         M1 外层 span filter=invert(1) + 内层 <span data-i18n> filter=none（单次反转=黑字）
//         M2 svg 20×20 + 外层 span 垫 4px 12px + 钮高 ≤34
//         M3 ::before 白面板在位 + 外层 span z-index 10 压面板之上
//         M4 真悬停（mouseMoved 到钮心）→ 外层 filter 翻 invert(0)（面板滑离紫底白字）
//         M5 移开回静息 invert(1)
//   / C 粗指针段（iPad 834×1194 仿真）：C1 .btn min 44 兜底 + C2 migrate-btn min 44 兜底
//   / E 全程零异常零 console error
// （house CDP 模式；判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-hdshrink-' + Date.now());
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

  try {
    // ── F 静态锚 ──
    const siteCfg = await (await fetch(BASE + '/assets/js/site-config.js')).text();
    const editorHtml = await (await fetch(BASE + '/pages/fluidcanvas-editor.html')).text();
    ok('F1 site-config：FC v10.28.48.0 + rev 00348- 占位 + 站点版本恒 v0.2.58.28',
      siteCfg.indexOf('v10.28.62.1') !== -1 && siteCfg.indexOf('00348-') !== -1 && siteCfg.indexOf('v0.2.58.28') !== -1);
    ok('F2 迁移按钮子代选择器在源：.migrate-btn > span / hover > span + 后代选择器零残留',
      editorHtml.indexOf('.migrate-btn > span {') !== -1 &&
      editorHtml.indexOf('.migrate-btn:hover > span {') !== -1 &&
      editorHtml.indexOf('.migrate-btn span {') === -1);
    ok('F3 头栏缩身规则在源：纵向垫 5px + gap 8px + btn-sm 3px 12px + btn-icon 30×30 + migrate svg 20 + 标题 icon 18px + 粗指针 migrate 入 44px 列表',
      editorHtml.indexOf('padding: 5px var(--space-md)') !== -1 &&
      editorHtml.indexOf('gap: 8px') !== -1 &&
      editorHtml.indexOf('.editor-header .btn-sm { padding: 3px 12px; }') !== -1 &&
      editorHtml.indexOf('.editor-header .btn-icon { width: 30px; height: 30px; padding: 0; }') !== -1 &&
      editorHtml.indexOf('.editor-header .migrate-btn svg { width: 20px; height: 20px; margin-right: 6px; }') !== -1 &&
      editorHtml.indexOf('font-size:18px') !== -1 &&
      editorHtml.indexOf('.editor-header .migrate-btn, .grid-controls .btn') !== -1);

    // ── 桌面段 ──
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
    await waitFor(cdp, "!!document.getElementById('gridCanvas') && !!window.publishArticle", 30000, '编辑器加载');
    await sleep(800);

    // ── H 头栏缩身（computed）──
    const h = await cdp.evalJs("(function(){ var hd = document.querySelector('.editor-header'); var hs = getComputedStyle(hd);" +
      " var back = hd.querySelector('a.btn-icon'); var bs = getComputedStyle(back);" +
      " var save = hd.querySelector('button.btn-sm'); var ss = getComputedStyle(save);" +
      " var undoIcon = hd.querySelector('#undoBtn .material-symbols-outlined');" +
      " var titleIcon = hd.querySelector('.editor-header > .material-symbols-outlined');" +
      " return { pt: hs.paddingTop, pb: hs.paddingBottom, gap: hs.columnGap, hh: hd.offsetHeight," +
      " spad: ss.paddingTop + ' ' + ss.paddingRight, saveH: save.offsetHeight," +
      " bw: back.offsetWidth, bh: back.offsetHeight, bpad: bs.padding," +
      " ui: getComputedStyle(undoIcon).fontSize, undoH: hd.querySelector('#undoBtn').offsetHeight," +
      " ti: getComputedStyle(titleIcon).fontSize }; })()");
    ok('H1 头栏纵向垫 5px + gap 8px', h.pt === '5px' && h.pb === '5px' && h.gap === '8px', JSON.stringify(h));
    ok('H2 头栏总高 ~42px（旧 ~64px 缩身 ≥14px）', h.hh >= 38 && h.hh <= 48, 'hh=' + h.hh);
    ok('H3 Save Draft（.btn-sm）垫 3px 12px + 钮高 ≤34', h.spad === '3px 12px' && h.saveH <= 34, 'spad=' + h.spad + ' h=' + h.saveH);
    ok('H4 返回钮（.btn-icon）30×30 + padding 0（顺序敏感：0 压回 3px 垫）', h.bw === 30 && h.bh === 30 && h.bpad === '0px', 'bw=' + h.bw + ' bh=' + h.bh + ' pad=' + h.bpad);
    ok('H5 undo 图标 24→20px + 钮高 ≤34', h.ui === '20px' && h.undoH <= 34, 'ui=' + h.ui + ' h=' + h.undoH);
    ok('H6 标题 article 图标 22→18px', h.ti === '18px', 'ti=' + h.ti);

    // ── M 迁移按钮白底白字修复（双重 invert 真身回归）──
    const m = await cdp.evalJs("(function(){ var btn = document.querySelector('.migrate-btn');" +
      " var outer = btn.querySelector(':scope > span'); var inner = btn.querySelector('span[data-i18n=\"fc.chrome.migrate\"]');" +
      " var os = getComputedStyle(outer); var is = getComputedStyle(inner); var bs = getComputedStyle(btn);" +
      " var bb = getComputedStyle(btn, '::before'); var svg = btn.querySelector('svg');" +
      " var r = btn.getBoundingClientRect();" +
      " return { of: os.filter, ifl: is.filter, ocol: os.color, icol: is.color," +
      " pad: os.paddingTop + ' ' + os.paddingRight, sw: Math.round(svg.getBoundingClientRect().width), sh: Math.round(svg.getBoundingClientRect().height)," +
      " bh: btn.offsetHeight, bbg: bb.backgroundColor, bz: bb.zIndex, oz: os.zIndex," +
      " cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2) }; })()");
    ok('M1 外层 span filter=invert(1) + 内层 <span data-i18n> filter=none（单次反转=静息黑字，双重反转回归不复现）',
      m.of === 'invert(1)' && m.ifl === 'none', JSON.stringify({ of: m.of, ifl: m.ifl }));
    ok('M2 迁移钮缩身：svg 20×20 + 外层垫 4px 12px + 钮高 ≤34', m.sw === 20 && m.sh === 20 && m.pad === '4px 12px' && m.bh <= 34,
      JSON.stringify({ sw: m.sw, sh: m.sh, pad: m.pad, bh: m.bh }));
    ok('M3 ::before 白面板在位（z 0）+ 外层 span z 10 压面板之上（文字可见性前提）',
      m.bbg === 'rgb(255, 255, 255)' && m.bz === '0' && m.oz === '10', JSON.stringify({ bbg: m.bbg, bz: m.bz, oz: m.oz }));

    // 真悬停：mouseMoved 到钮心 → :hover 生效，等 0.4s 过渡完
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: m.cx, y: m.cy });
    await sleep(600);
    const mh = await cdp.evalJs("getComputedStyle(document.querySelector('.migrate-btn > span')).filter");
    ok('M4 悬停 → 外层 filter 翻 invert(0)（白面板滑离，紫底白字）', mh === 'invert(0)', 'filter=' + mh);

    // 移开 → 回静息
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
    await sleep(600);
    const mr = await cdp.evalJs("getComputedStyle(document.querySelector('.migrate-btn > span')).filter");
    ok('M5 移开回静息 invert(1)', mr === 'invert(1)', 'filter=' + mr);

    // ── C 粗指针段（iPad 834×1194 仿真）──
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 834, height: 1194, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await sleep(400);
    const c = await cdp.evalJs("(function(){ var hd = document.querySelector('.editor-header');" +
      " var btn = hd.querySelector('#settingsBtn'); var mb = hd.querySelector('.migrate-btn');" +
      " return { coarse: matchMedia('(hover: none) and (pointer: coarse)').matches," +
      " bminH: getComputedStyle(btn).minHeight, bminW: getComputedStyle(btn).minWidth," +
      " mbminH: getComputedStyle(mb).minHeight, mbminW: getComputedStyle(mb).minWidth," +
      " bh: btn.offsetHeight, mbh: mb.offsetHeight }; })()");
    ok('C1 粗指针 .btn 44px 命中区兜底（缩身不缩触控）', c.coarse === true && c.bminH === '44px' && c.bminW === '44px' && c.bh >= 44,
      JSON.stringify({ coarse: c.coarse, minH: c.bminH, minW: c.bminW, bh: c.bh }));
    ok('C2 粗指针 migrate-btn 44px 兜底（本轮新入列表）', c.mbminH === '44px' && c.mbminW === '44px' && c.mbh >= 44,
      JSON.stringify({ minH: c.mbminH, minW: c.mbminW, bh: c.mbh }));

    // ── E 全程零 Runtime exception + 零 console error ──
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
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(FAIL === 0 ? 0 : 1);
})();
