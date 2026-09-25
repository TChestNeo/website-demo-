// tmp-battery-fc-sne-canvas.js — FC v10.28.42.1 SNE 格底随卡色 + 画布边缘阴影电池
// 用户「SNE Index Card 的二级显示分数的卡片颜色能不能根据卡片本身的颜色然后自动变化
//   背景颜色融入背景主题，然后整个画布格子的边缘能不能加上一个淡淡的阴影因为现在
//   边缘有点不明显」
// 验证：F0 静态锚（FC 41.0 + rev 00280- 占位 + 站点 58.0 恒 + color-mix 格底规则 +
//         --sne-cell-tint 写点 + 画布 box-shadow 规则 + 查看模式显式关闭锚）
//   / S 格底随卡色（S1 默认格底=卡面 surface 恒等零变化；S2 选色 #d43c3c 后格底=
//         卡色 62%+surface 38% 纸上混色、tint 变量=rgba 字面、卡面变色；S3 清色
//         回落 surface + tint 移除；S4 油漆主题边缘 paint1 同款跟随 #2e5bff）
//   / C 画布阴影（C1 编辑态 box-shadow 纸上期望串逐字节；C2 查看模式显式 none +
//         #fcViewScaler 投影在场）
//   / E 全程零异常
// （house CDP 模式；浅色主题纸面常量：surface-container #eceef0=(236,238,240)、
//   divider-line-strong rgba(118,117,134,0.14)、shadow-md 0 4px 24px rgba(0,0,0,0.06)；
//   判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-snecanvas-' + Date.now());
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
// 解析 computed 颜色串（rgb/rgba/color(srgb …) 三型通吃）→ [r,g,b]（0-255）
function parseColor(s) {
  if (!s) return null;
  let m = s.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/);
  if (m) return [parseFloat(m[1]) * 255, parseFloat(m[2]) * 255, parseFloat(m[3]) * 255];
  m = s.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)/);
  if (m) return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
  return null;
}
function near(a, b, tol) {
  if (!a || !b) return false;
  return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;
}

// 查看模式 fixture + fetch 桩（同 fc-present：4 卡）
const FIXTURE_CONTENT = {
  v: 9,
  title: 'Cloud Constitution',
  tags: ['宪法', '官方'],
  cards: [
    { id: 'c1', type: 'content', label: 'Constitution', col: 2, row: 2, colSpan: 10, rowSpan: 6,
      content: '<p><b>Cloud Constitution</b> — fixture body text.</p>', bgAlpha: 0, baseFontSize: 14 },
    { id: 'c2', type: 'flag', label: 'Fixture Flag', col: 4, row: 10, colSpan: 12, rowSpan: 7,
      imgSrc: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20360%22%3E%3Crect%20width%3D%22600%22%20height%3D%22180%22%20fill%3D%22%232E5BFF%22%2F%3E%3Crect%20y%3D%22180%22%20width%3D%22600%22%20height%3D%22180%22%20fill%3D%22%23FFFFFF%22%2F%3E%3C%2Fsvg%3E' },
    { id: 'c3', type: 'text', label: 'OOB-Right', col: 38, row: 3, colSpan: 12, rowSpan: 7,
      content: 'right edge beyond grid (38+12 > 40 cols)', background: 'rgba(220,38,38,0.15)' },
    { id: 'c4', type: 'text', label: 'OOB-Bottom', col: 2, row: 98, colSpan: 8, rowSpan: 8,
      content: 'bottom edge beyond grid (98+8 > 100 rows)', background: 'rgba(46,91,255,0.15)' }
  ],
  settings: { snapOn: true, alignOn: true },
  activePreset: '169', presets: {}, groupStyles: {}, pageBg: null, lastSaved: 1750000000000
};
const FETCH_STUB = 'try{(function(){ if (window.__slatiFetchStub) return; window.__slatiFetchStub = true;' +
  ' var realFetch = window.fetch.bind(window);' +
  ' var stubResponse = function (body, status) { return new Promise(function (resolve) { setTimeout(function () { resolve(new Response(body, { status: status, headers: { "Content-Type": "application/json" } })); }, 0); }); };' +
  ' window.fetch = function (url, opts) {' +
  '  var u = String(url);' +
  '  if (u.indexOf("/articles") !== -1) {' +
  '   if (u.indexOf("/articles/") !== -1) {' +
  '    var id = decodeURIComponent(u.split("/articles/")[1].split("?")[0].split("#")[0]);' +
  '    if (id === "ART-CLOUD-1") {' +
  '     return stubResponse(JSON.stringify({ article: { id: id, title: "Cloud Constitution", status: "published", createdAt: "2026-09-14T10:00:00.000Z", updatedAt: "2026-09-14T10:00:00.000Z", contentJson: ' + JSON.stringify(FIXTURE_CONTENT) + ' } }), 200);' +
  '    }' +
  '    return stubResponse(JSON.stringify({ error: "NOT_FOUND" }), 404);' +
  '   }' +
  '   return stubResponse(JSON.stringify({ articles: [] }), 200);' +
  '  }' +
  '  return realFetch(url, opts);' +
  ' };' +
  '})();}catch(e){}';

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
    // ── F0 静态锚：版本号 + 规则锚 ──
    const siteCfg = await (await fetch(BASE + '/assets/js/site-config.js')).text();
    const editorHtml = await (await fetch(BASE + '/pages/fluidcanvas-editor.html')).text();
    ok('F1 site-config：FC v10.28.45.0 + rev 00280- 占位 + 站点版本恒 v0.2.58.0',
      siteCfg.indexOf('v10.28.45.0') !== -1 && siteCfg.indexOf('00280-') !== -1 && siteCfg.indexOf('v0.2.58.0') !== -1);
    ok('F2 编辑器页静态锚：格底 color-mix(--sne-cell-tint 62%, surface) + applyCardBg 写 tint + 画布 box-shadow 细线勾边',
      editorHtml.indexOf('color-mix(in srgb, var(--sne-cell-tint') !== -1 &&
      editorHtml.indexOf("setProperty('--sne-cell-tint', rgba)") !== -1 &&
      editorHtml.indexOf('box-shadow: 0 0 0 1px var(--divider-line-strong), var(--shadow-md);') !== -1);
    ok('F3 编辑器页静态锚：查看模式显式关闭编辑态整盒阴影',
      editorHtml.indexOf('box-shadow: none; /* v10.28.40.0') !== -1);

    const cdp = await connectCdp(CDP_PORT);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: FETCH_STUB });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };
    const mouse = async (type, x, y, opts) =>
      cdp.send('Input.dispatchMouseEvent', Object.assign({ type: type, x: x, y: y, button: 'none', clickCount: 1, modifiers: 0 }, opts || {}));

    // ── S 格底随卡色 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "!!document.getElementById('gridCanvas') && !!window.createSneCard", 'S 编辑器加载');
    await cdp.evalJs("window.createSneCard(2, 2, 9, 12)");
    await sleep(200);
    const s0 = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); if (!c) return null; return { cells: c.querySelectorAll('.sne-cell').length, l: c.style.left, t: c.style.top }; })()");
    ok('S1 建卡：SNE 卡落位 (2,2)→left 22/top 22、6 格在场', s0 && s0.cells === 6 && s0.l === '22px' && s0.t === '22px', JSON.stringify(s0));

    const readBg = async () => cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); return { cell: getComputedStyle(c.querySelector('.sne-cell')).backgroundColor, face: getComputedStyle(c).backgroundColor, tint: c.style.getPropertyValue('--sne-cell-tint') }; })()");
    const SURFACE = [236, 238, 240]; // 浅色主题 --color-surface-container #eceef0（纸面常量）
    let bg = await readBg();
    ok('S2 默认无选色：格底=卡面=surface-container（混色恒等、默认观感零变化）',
      near(parseColor(bg.cell), SURFACE, 1) && near(parseColor(bg.face), SURFACE, 1) && bg.tint === '',
      JSON.stringify(bg));

    // 点选卡（点击选卡走真实选择管线；订阅锁测试态放行选色）
    const pt = await cdp.evalJs("(function(){ var c = document.querySelector('#gridCanvas .sne-card'); var r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 30 }; })()");
    await mouse('mousePressed', pt.x, pt.y, { button: 'left' });
    await mouse('mouseReleased', pt.x, pt.y, { button: 'left' });
    await sleep(150);
    await cdp.evalJs("window.setSubscriptionTestMode(true)");
    await cdp.evalJs("window.setCardBgColor('#d43c3c')");
    await sleep(150);
    bg = await readBg();
    // 纸上混色：0.62×d43c3c + 0.38×surface = (221.12, 127.64, 128.4) → (221,128,128)
    ok('S3 选色 #d43c3c：tint=rgba(212, 60, 60, 1) + 格底=62/38 纸上混色 rgb(221,128,128) + 卡面=纯色',
      bg.tint === 'rgba(212, 60, 60, 1)' && near(parseColor(bg.cell), [221, 128, 128], 1.5) &&
      near(parseColor(bg.face), [212, 60, 60], 1),
      JSON.stringify(bg));

    await cdp.evalJs("window.resetCardBg()");
    await sleep(150);
    bg = await readBg();
    ok('S4 清色：tint 移除 + 格底回落 surface-container',
      bg.tint === '' && near(parseColor(bg.cell), SURFACE, 1), JSON.stringify(bg));

    await cdp.evalJs("window.setCardEdge('paint1')");
    await sleep(150);
    await cdp.evalJs("window.setCardBgColor('#2e5bff')");
    await sleep(150);
    bg = await readBg();
    const edgeCls = await cdp.evalJs("document.querySelector('#gridCanvas .sne-card').className.indexOf('card-edge-paint') !== -1");
    // 纸上混色：0.62×2e5bff + 0.38×surface = (118.2, 146.86, 249.3) → (118,147,249)
    ok('S5 油漆主题边缘 paint1 + 选色 #2e5bff：格底同款跟随 rgb(118,147,249)（主题 tint 与 plain 同一 tint 源）',
      edgeCls === true && bg.tint === 'rgba(46, 91, 255, 1)' && near(parseColor(bg.cell), [118, 147, 249], 1.5),
      JSON.stringify(bg));

    // ── C 画布整盒阴影 ──
    const sh = await cdp.evalJs("getComputedStyle(document.getElementById('gridCanvas')).boxShadow");
    // 纸上期望：Chrome computed 序列化 color 在前——细线勾边 rgba(118,117,134,0.14)
    // 0 0 0 1px + 浅色 shadow-md 0 4px 24px rgba(0,0,0,0.06)
    ok('C1 编辑态画布 box-shadow=细线勾边+主题投影（纸上期望串逐字节）',
      sh === 'rgba(118, 117, 134, 0.14) 0px 0px 0px 1px, rgba(0, 0, 0, 0.06) 0px 4px 24px 0px',
      'computed=' + JSON.stringify(sh));

    // ── C2 查看模式：编辑态阴影显式关闭、投影由 #fcViewScaler 承担 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html?article=ART-CLOUD-1',
      "document.querySelectorAll('#gridCanvas .grid-card').length === 4 && !!document.getElementById('fcViewScaler')", 'C2 查看器加载');
    const vsh = await cdp.evalJs("(function(){ return { canvas: getComputedStyle(document.getElementById('gridCanvas')).boxShadow, scaler: getComputedStyle(document.getElementById('fcViewScaler')).boxShadow }; })()");
    ok('C2 查看模式：canvas box-shadow=none + scaler 投影在场',
      vsh.canvas === 'none' && vsh.scaler !== 'none' && vsh.scaler.indexOf('60px') !== -1,
      JSON.stringify(vsh));

    // ── E 全程零 Runtime exception + 零 console error ──
    ok('E5 全程零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 5).join(' | ') || '干净');
    ok('E6 全程零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 5).join(' | ') || '干净');
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
