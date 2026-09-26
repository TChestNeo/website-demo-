// tmp-probe-fc-headershrink.js — FC v10.28.47.4 顶部栏缩身+迁移按钮白底白字修复 上线实机探针
// 用户「能不能吧FC编辑页的顶部栏缩小一些太大了」+「还有顶部的迁移按钮为什么文字默认是白底白字的」
//   S 静态（线上 site-config 45.1 + rev 00310- + 站点 58.0 恒、编辑器页子代选择器+缩身规则锚）
//   P 实机（桌面 CDP + 登录态 stub：P1 头栏 5px/8px/高 ≤48｜P2 钮 30×30/3px 12px/图标 20px｜
//     P3 迁移钮单次反转（外层 invert(1)+内层 none）+ svg 20+白面板在位｜P4 悬停翻 invert(0)
//     移开回 invert(1)｜P5 粗指针 44px 兜底（btn+migrate 双保）｜E1 零异常零 console error）。
// 探针纪律：零草稿污染（只读 computed，不建卡不改草稿）。
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
  ok('S1 线上 site-config：FC v10.28.47.4 + rev 00310- + 站点恒 v0.2.58.7',
    sc.status === 200 && sc.body.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") !== -1 &&
    sc.body.indexOf('rev 00310-') !== -1 && sc.body.indexOf('v0.2.58.7') !== -1,
    'status=' + sc.status + ' err=' + sc.error);
  const ed = await get(BASE + '/pages/fluidcanvas-editor.html');
  ok('S2 线上编辑器页：子代选择器在源 + 后代零残留 + 缩身规则锚（5px 垫/gap 8px/btn-icon 30/migrate svg 20/18px/粗指针 migrate 入列）',
    ed.status === 200 &&
    ed.body.indexOf('.migrate-btn > span {') !== -1 &&
    ed.body.indexOf('.migrate-btn:hover > span {') !== -1 &&
    ed.body.indexOf('.migrate-btn span {') === -1 &&
    ed.body.indexOf('padding: 5px var(--space-md)') !== -1 &&
    ed.body.indexOf('gap: 8px') !== -1 &&
    ed.body.indexOf('.editor-header .btn-icon { width: 30px; height: 30px; padding: 0; }') !== -1 &&
    ed.body.indexOf('.editor-header .migrate-btn svg { width: 20px; height: 20px; margin-right: 6px; }') !== -1 &&
    ed.body.indexOf('font-size:18px') !== -1 &&
    ed.body.indexOf('.editor-header .migrate-btn, .grid-controls .btn') !== -1,
    'status=' + ed.status + ' err=' + ed.error);

  // ── P 实机 ──
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-hdshrink-' + Date.now());
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

    const h = await cdp.evalJs("(function(){ var hd = document.querySelector('.editor-header'); var hs = getComputedStyle(hd);" +
      " var back = hd.querySelector('a.btn-icon'); var save = hd.querySelector('button.btn-sm');" +
      " var undoIcon = hd.querySelector('#undoBtn .material-symbols-outlined');" +
      " return { pt: hs.paddingTop, gap: hs.columnGap, hh: hd.offsetHeight," +
      " bw: back.offsetWidth, bh: back.offsetHeight, spad: getComputedStyle(save).paddingTop + ' ' + getComputedStyle(save).paddingRight," +
      " ui: getComputedStyle(undoIcon).fontSize, saveH: save.offsetHeight }; })()");
    ok('P1 实机头栏：纵向垫 5px + gap 8px + 总高 ≤48（旧 ~64 缩身）',
      h.pt === '5px' && h.gap === '8px' && h.hh >= 36 && h.hh <= 48, JSON.stringify(h));
    ok('P2 实机钮缩身：返回钮 30×30 + btn-sm 垫 3px 12px + undo 图标 20px + Save 高 ≤34',
      h.bw === 30 && h.bh === 30 && h.spad === '3px 12px' && h.ui === '20px' && h.saveH <= 34, JSON.stringify(h));

    const m = await cdp.evalJs("(function(){ var btn = document.querySelector('.migrate-btn');" +
      " var outer = btn.querySelector(':scope > span'); var inner = btn.querySelector('span[data-i18n=\"fc.chrome.migrate\"]');" +
      " var os = getComputedStyle(outer); var svg = btn.querySelector('svg'); var r = btn.getBoundingClientRect();" +
      " return { of: os.filter, ifl: getComputedStyle(inner).filter, pad: os.paddingTop + ' ' + os.paddingRight," +
      " sw: Math.round(svg.getBoundingClientRect().width), bh: btn.offsetHeight," +
      " bbg: getComputedStyle(btn, '::before').backgroundColor, oz: os.zIndex," +
      " cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2) }; })()");
    ok('P3 实机迁移钮：单次反转（外层 invert(1) + 内层 none=黑字）+ svg 20 + 垫 4px 12px + 白面板在位 + 文字层 z10 压面板',
      m.of === 'invert(1)' && m.ifl === 'none' && m.sw === 20 && m.pad === '4px 12px' && m.bh <= 34 &&
      m.bbg === 'rgb(255, 255, 255)' && m.oz === '10', JSON.stringify(m));

    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: m.cx, y: m.cy });
    await sleep(600);
    const mh = await cdp.evalJs("getComputedStyle(document.querySelector('.migrate-btn > span')).filter");
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
    await sleep(600);
    const mr = await cdp.evalJs("getComputedStyle(document.querySelector('.migrate-btn > span')).filter");
    ok('P4 实机悬停翻 invert(0) + 移开回静息 invert(1)', mh === 'invert(0)' && mr === 'invert(1)',
      'hover=' + mh + ' rest=' + mr);

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 834, height: 1194, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await sleep(400);
    const c = await cdp.evalJs("(function(){ var hd = document.querySelector('.editor-header');" +
      " var btn = hd.querySelector('#settingsBtn'); var mb = hd.querySelector('.migrate-btn');" +
      " return { coarse: matchMedia('(hover: none) and (pointer: coarse)').matches," +
      " bminH: getComputedStyle(btn).minHeight, mbminH: getComputedStyle(mb).minHeight," +
      " bh: btn.offsetHeight, mbh: mb.offsetHeight }; })()");
    ok('P5 实机粗指针 44px 兜底（缩身不缩触控：btn + migrate 双保）',
      c.coarse === true && c.bminH === '44px' && c.mbminH === '44px' && c.bh >= 44 && c.mbh >= 44,
      JSON.stringify(c));

    ok('E1 全程零 Runtime exception + 零 console error', cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      JSON.stringify({ errs: cdp.errs.slice(0, 3), cons: cdp.consoleErrs.slice(0, 3) }));
    cdp.close();
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  try { chrome.kill(); } catch (e) {}
  console.log('');
  console.log(FAIL.n === 0 ? '🎉 全部通过 ' + PASS.n + '/' + PASS.n : '💔 失败 ' + FAIL.n + ' / 共 ' + (PASS.n + FAIL.n));
  process.exit(FAIL.n === 0 ? 0 : 1);
})();
