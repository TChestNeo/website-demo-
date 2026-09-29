// tmp-battery-fc-present.js — v0.2.58.22 / FC v10.28.39.0 完整格子画布轮 FC 侧电池
// 用户「16：9宽的格子数量是115个做一下这是最大值」（问询钦定「横向115格 长度不限」；
//   纵向默认 16:9 115×70 再外加 25 行预留；卡片逼近底边按卡片底+25 行自动增长）
// 验证：E 编辑态固定 115 格回归（169 预设 16:9 恒 20px 不被窗口缩放改动、
//       480→1280→3840 往返 cols 恒 115 不缩小（v10.28.39.0 视口系统后横向拉条承载）、
//       画布盒 2528 全覆盖、零漂移零异常零自动建卡）
//   / V 查看镜像完整舞台（fit1to1 自洽：s=min(availW/2530,availH/stageH)、
//     canvas 0,0 零平移、哨兵草稿不被 resize 触碰）
//       草稿哨兵未被 resize 动、目录 4 条目 draft 数据口径——含 content 卡 label）
// fetch 打桩：仅 /articles 拦截（ART-CLOUD-1 → 4 卡 contentJson + tags['宪法','官方']）；编辑态不发文章请求。
// （house CDP 模式；截图全黑纪律；断言走 offset*/计算样式不受 transform 干扰）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fcpresent-' + Date.now());
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

// ═══ fixture：查看器 4 卡（同 view 电池：c3 右越界 c4 下越界 + content c1 带 label）═══
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
// 编辑态固定格子断言（v10.28.39.0 横向恒 115 格：computeCols 恒 115，窗口任意宽不缩小、
// 不足部分由 .editor-body 横向拉条承载；画布盒 width:max-content 全覆盖 115 列）
const COLS_EXPR = "(function(){ var gc = document.getElementById('gridCanvas'); var body = gc.parentElement;" +
  " var cs = parseInt(getComputedStyle(gc).getPropertyValue('--cell-size').trim(), 10);" +
  " var actual = parseInt(getComputedStyle(gc).getPropertyValue('--grid-cols').trim(), 10);" +
  " return { actual: actual, cs: cs, canvasW: gc.offsetWidth, scrollW: body.scrollWidth, clientW: body.clientWidth }; })()";

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
  const setWidth = async (cdp, w) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(1200); // 探针实证：250ms 防抖 + 过渡重排 ≈ +800ms 才落 cols；1200 稳
  };

  try {
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

    // ── E 编辑态固定 115 格回归：169 预设 16:9 恒 20px、cols 恒 115 不随窗口缩、往返零漂移 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "document.getElementById('undoBtn') && typeof window.historyUndoAction === 'function'", 'E 编辑器加载');
    const e1 = await cdp.evalJs(COLS_EXPR);
    ok('E1 1280 编辑态：169 预设 cellSize=20 + cols 恒 115 + 画布盒 2528 全覆盖 + 横向拉条（scrollW>clientW）',
      e1.cs === 20 && e1.actual === 115 && e1.canvasW === 2528 && e1.scrollW > e1.clientW,
      JSON.stringify(e1));
    await setWidth(cdp, 480);
    const e2 = await cdp.evalJs(COLS_EXPR);
    const e2scroll = await cdp.evalJs("(function(){ var se = document.getElementById('gridCanvas').parentElement; se.scrollLeft = 200; return se.scrollLeft; })()");
    ok('E2 480 窄窗：cols 仍恒 115 不缩小（v10.28.39.0 固定横向，旧自适应 12 格已死）+ 画布仍 2528 + 可横滚',
      e2.cs === 20 && e2.actual === 115 && e2.canvasW === 2528 && e2.scrollW > e2.clientW && e2scroll === 200,
      JSON.stringify(e2) + ' scrollLeft=' + e2scroll);
    await setWidth(cdp, 1280);
    const e3 = await cdp.evalJs(COLS_EXPR);
    ok('E3 回 1280：cols 恒 115（固定横向往返零漂移）+ 零自动建卡（无冻结副作用）',
      e3.actual === 115 &&
      await cdp.evalJs("document.querySelectorAll('#gridCanvas .grid-card').length") === 0,
      JSON.stringify(e3) + ' cards=' + await cdp.evalJs("document.querySelectorAll('#gridCanvas .grid-card').length"));
    await setWidth(cdp, 3840);
    const e4 = await cdp.evalJs(COLS_EXPR);
    ok('E4 3840 超宽窗：cols 仍恒 115 不再增长（「这是最大值」实证）+ cellSize 仍 20',
      e4.cs === 20 && e4.actual === 115 && e4.canvasW === 2528,
      JSON.stringify(e4));
    await setWidth(cdp, 1280);

    // ── V 查看镜像 resize 稳定性：fit1to1 contain fit 自洽 + 哨兵草稿不动 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html?article=ART-CLOUD-1',
      "document.querySelectorAll('#gridCanvas .grid-card').length === 4 && !!document.getElementById('fcViewScaler')", 'V 查看器加载');
    const draftBefore = await cdp.evalJs("localStorage.getItem('slati_fluidcanvas_draft') || ''");
    const FIT_SELFCHECK = "(function(){ var g = document.getElementById('gridCanvas'); var s = document.getElementById('fcViewScaler'); var m = g.style.transform.match(/scale\\(([\\d.]+)\\)/); if (!m) return false; var sv = parseFloat(m[1]); var any = false, maxBY = -1e9; document.querySelectorAll('#gridCanvas .grid-card').forEach(function (e) { if (getComputedStyle(e).display === 'none') return; any = true; var rad = ((parseFloat(e.dataset.rotate || 0) * Math.PI) / 180); var rh = e.offsetWidth * Math.abs(Math.sin(rad)) + e.offsetHeight * Math.abs(Math.cos(rad)); var cy = e.offsetTop + e.offsetHeight / 2; maxBY = Math.max(maxBY, cy + rh / 2); }); var contentRows = any ? Math.max(1, Math.ceil(maxBY / 22)) : 0; var stageW = 2530, stageH = (Math.max(70, contentRows) + 25) * 22; var availW = Math.max(200, s.parentNode.clientWidth - 32); var availH = Math.max(200, s.parentNode.clientHeight - 32); var exp = Math.max(0.25, Math.min(availW / stageW, availH / stageH)); return Math.abs(sv - exp) <= 0.01 && Math.abs(s.clientWidth - Math.round(stageW * sv)) <= 2 && g.style.left === '0px'; })()";
    await setWidth(cdp, 640);
    ok('V1 查看态 640 窄窗：fit1to1 完整舞台自洽（s=min(availW/2530,availH/stageH)、scaler=stage×s、canvas 0,0 零平移）',
      await cdp.evalJs(FIT_SELFCHECK) === true &&
      await cdp.evalJs("document.querySelectorAll('#gridCanvas .grid-card').length") === 4,
      await cdp.evalJs("(function(){ var s = document.getElementById('fcViewScaler'); var g = document.getElementById('gridCanvas'); return 'scaler.w=' + s.clientWidth + ' left=' + g.style.left + ' tf=' + g.style.transform; })()"));
    await setWidth(cdp, 1280);
    ok('V2 回 1280：再 fit 自洽 + 哨兵草稿未被 resize 触碰（byte 相等）',
      await cdp.evalJs(FIT_SELFCHECK) === true &&
      await cdp.evalJs("localStorage.getItem('slati_fluidcanvas_draft') || ''") === draftBefore,
      await cdp.evalJs("(function(){ var s = document.getElementById('fcViewScaler'); var g = document.getElementById('gridCanvas'); return 'scaler.w=' + s.clientWidth + ' tf=' + g.style.transform; })()"));
    ok('V3 查看镜像目录 4 条目（v0.2.58.22 列全部卡：content c1 label + flag c2 label + c3/c4 文字卡）',
      await cdp.evalJs("(function(){ var d = document.getElementById('fcViewTocDrawer'); if (!d) return false; var items = d.querySelectorAll('.fcv-toc-item'); return items.length === 4 && items[0].textContent === 'Constitution' && items[1].textContent === 'Fixture Flag' && items[2].textContent === 'OOB-Right' && items[3].textContent === 'OOB-Bottom'; })()") === true);

    // ── E 全程零 Runtime exception + 零 console error ──
    ok('E4 全程零 Runtime exception', cdp.errs.length === 0, cdp.errs.slice(0, 5).join(' | ') || '干净');
    ok('E5 全程零 console error', cdp.consoleErrs.length === 0, cdp.consoleErrs.slice(0, 5).join(' | ') || '干净');
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
