// tmp-battery-fc-mergefix.js — FC v10.28.47.4 触控合拼边缘不齐修复电池
// 用户「还有平板移动端在合拼卡片之后边缘会不齐」——真身：预览贴齐（findMergeSnap）
//   按旋转感知 bbox 算边，提交落位（mergeCards）旧用未旋转 offsetWidth 整数边——
//   带旋转的卡合并后视觉错开可达卡宽 10-15%（30° 9×12 sne 卡 ≈52px）；捏合缩放
//   的浮点 viewZoom 使拖拽落位为浮点，加剧偏差。
// 修法：mergeCards 落位统一 cardBBox 口径（tbb/cb0/面并集全 bbox 边），未旋转卡
//   恒退化回旧算式（零行为变化）；不做网格取整（几何贴齐=视觉真相，取整反而
//   制造 ≤半格间隙）。
// 验证：S1 静态锚（site-config 44.3 + rev 00293- 占位 / 编辑器 bbox 落位锚在场 +
//   旧 offsetWidth 落位锚零残留）/ M 真实桌面鼠标拖拽实测（clone fc-viewport
//   mouse helper + rAF 落位帧纪律）：M1 浮点 zoom 1.2347 左并 flush 贴齐 +
//   dataset.x 同步；M2 旋转目标 30° 左并 bbox flush ≤0.5（旧码 ~52px 错开）；
//   M3 zoom 1 未旋转退化恒等（左并 = 旧算式零行为变化）；M4 旋转目标 30°
//   上并 bbox 底边贴顶边 flush / E1 全程零异常。
// （house CDP 模式；断言走 offset*/style 不受 transform 干扰；判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4950 + Math.floor(Math.random() * 40);
const CDP_PORT = 5950 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-fcmergefix-' + Date.now());
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

// 画布本地旋转感知 bbox（与编辑器 cardBBox 同公式；transform 视觉旋转不入
// offset 几何，只用 dataset.rotate 三角函数——assertion 与生产代码同源口径）
const BB_FN = "(function(){ window.__bb = function(c){ var l = parseFloat(c.style.left)||0, t = parseFloat(c.style.top)||0;" +
  " var w = c.offsetWidth, h = c.offsetHeight;" +
  " var rad = Math.abs(parseFloat(c.dataset.rotate)||0) * Math.PI / 180;" +
  " var bw = Math.abs(w*Math.cos(rad)) + Math.abs(h*Math.sin(rad));" +
  " var bh = Math.abs(w*Math.sin(rad)) + Math.abs(h*Math.cos(rad));" +
  " var cx = l + w/2, cy = t + h/2;" +
  " return { left: cx-bw/2, top: cy-bh/2, right: cx+bw/2, bottom: cy+bh/2, w: w, h: h }; }; return true; })()";
// 首卡（=被拖卡 A）卡面取点：扫避开输入/标签/手柄（sne 卡中心 sne-val 输入框、
// 选中后 8 手柄/旋转 grip 全避开——桌面与触控桥同口径）
const DRAG_PT = "(function(){ var c = document.querySelector('#gridCanvas .grid-card');" +
  " if (!c) return null; var r = c.getBoundingClientRect();" +
  " var bad = 'input, textarea, select, button, a, [contenteditable=\"true\"], .card-text-content, .card-edit-field, .card-label, .resize-handle, .rotate-grip';" +
  " for (var fy = 0.15; fy <= 0.85; fy += 0.1) for (var fx = 0.15; fx <= 0.85; fx += 0.1) {" +
  "  var el = document.elementFromPoint(r.left + r.width*fx, r.top + r.height*fy);" +
  "  if (el && el.closest('.grid-card') === c && !el.closest(bad)) return { x: Math.round(r.left + r.width*fx), y: Math.round(r.top + r.height*fy) };" +
  " } return null; })()";
// 左并目标位：A（未旋转）bbox 右边贴 B bbox 左边——wantLeft = bbB.left − A.offsetWidth；
// 屏幕位移 = 画布位移 × viewZoom（dragFrame 反除回画布本地）
const TGT_LEFT = "(function(){ var z = parseFloat(document.getElementById('gridCanvas').style.zoom)||1;" +
  " var cards = document.querySelectorAll('#gridCanvas .grid-card'); var a = cards[0], b = cards[1];" +
  " var bbB = window.__bb(b); var wantLeft = bbB.left - a.offsetWidth;" +
  " return { dx: (wantLeft - (parseFloat(a.style.left)||0)) * z, wantLeft: wantLeft, bL: bbB.left, aW: a.offsetWidth, z: z }; })()";
// 上并目标位：A（未旋转）bbox 底边贴 B bbox 顶边——wantTop = bbB.top − A.offsetHeight
const TGT_TOP = "(function(){ var z = parseFloat(document.getElementById('gridCanvas').style.zoom)||1;" +
  " var cards = document.querySelectorAll('#gridCanvas .grid-card'); var a = cards[0], b = cards[1];" +
  " var bbB = window.__bb(b); var wantTop = bbB.top - a.offsetHeight;" +
  " return { dy: (wantTop - (parseFloat(a.style.top)||0)) * z, wantTop: wantTop, bT: bbB.top, aH: a.offsetHeight, z: z }; })()";
// 合并结果断言体：两组共用 groupId + bbox 贴齐 + dataset.x 与 style.left 同步 +
// 左/右并 top 恒等（tT 顶对齐）
const CHECK_FLUSH = "(function(){ var cards = document.querySelectorAll('#gridCanvas .grid-card');" +
  " var a = cards[0], b = cards[1]; if (!a || !b) return null;" +
  " var bbA = window.__bb(a), bbB = window.__bb(b);" +
  " return { flR: Math.abs(bbA.right - bbB.left), flL: Math.abs(bbA.left - bbB.right)," +
  " flB: Math.abs(bbA.bottom - bbB.top), flT: Math.abs(bbA.top - bbB.bottom)," +
  " gidA: a.dataset.groupId || '', gidB: b.dataset.groupId || ''," +
  " topEq: a.style.top === b.style.top," +
  " dxSync: Math.abs((parseFloat(a.dataset.x)||0) - (parseFloat(a.style.left)||0)) < 0.01," +
  " aL: parseFloat(a.style.left), aT: parseFloat(a.style.top), aW: a.offsetWidth, aH: a.offsetHeight," +
  " bL: parseFloat(b.style.left), bRot: parseFloat(b.dataset.rotate)||0, bbBL: bbB.left, bbBT: bbB.top }; })()";

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
    // ── S1 静态锚：版本 + bbox 落位锚在场 + 旧 offsetWidth 落位锚零残留 ──
    const siteCfg = await (await fetch(BASE + '/assets/js/site-config.js')).text();
    const editorHtml = (await (await fetch(BASE + '/pages/fluidcanvas-editor.html')).text()).replace(/\r\n/g, '\n');
    ok('S1 site-config 44.3 + rev 00293- 占位 + 站点恒 v0.2.58.10 + 编辑器 bbox 落位锚在场（tbb/cb0/面并集）＋旧 offsetWidth 落位锚零残留',
      siteCfg.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.4';") !== -1 &&
      siteCfg.indexOf('00293-') !== -1 && siteCfg.indexOf('v0.2.58.10') !== -1 &&
      editorHtml.indexOf('var tbb = cardBBox(target, tL, tT);') !== -1 &&
      editorHtml.indexOf('tbb.left - cb0.right') !== -1 &&
      editorHtml.indexOf('tbb.right - cb0.left') !== -1 &&
      editorHtml.indexOf('fL - cb0.left') !== -1 &&
      editorHtml.indexOf('tL + target.offsetWidth') === -1 &&
      editorHtml.indexOf('fT - card.offsetHeight') === -1 &&
      editorHtml.indexOf('fB - cb0.top') !== -1);

    const cdp = await connectCdp(CDP_PORT);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    // 编辑器草稿骑 localStorage——每次 navigate 清掉非会话键（草稿/撤销栈随页
    // 载入恢复，M2-M4 会被 M1 合并后的草稿污染：旧卡恢复+新卡叠加+groupId
    // 已在组→findMergeSnap 拒吸合。清干净=每测试真空画布）
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{var keep = ["slati_session"]; Object.keys(localStorage).forEach(function (k) { if (keep.indexOf(k) === -1) localStorage.removeItem(k); });}catch(e){}'
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(700);
    };
    const mouse = async (type, x, y, opts) =>
      cdp.send('Input.dispatchMouseEvent', Object.assign({ type: type, x: x, y: y, button: 'none', clickCount: 1, modifiers: 0 }, opts || {}));
    // 真实桌面拖拽：按下 → 步进移动（越过 3px 起拖阈值）→ rAF 落位帧 → 松手
    const dragMouse = async (x1, y1, x2, y2, steps) => {
      await mouse('mousePressed', x1, y1, { button: 'left' });
      await sleep(30);
      for (let i = 1; i <= steps; i++) {
        await sleep(16);
        await mouse('mouseMoved', x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps, { button: 'left' });
      }
      await sleep(250); // rAF 落位帧（同 fc-viewport D 段纪律）
      await mouse('mouseReleased', x2, y2, { button: 'left' });
      await sleep(200);
    };

    // ── M1 浮点 zoom 1.2347（捏合缩放类浮点值）左并：bbox flush + 同组 + dataset.x 同步 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "document.getElementById('undoBtn') && typeof window.historyUndoAction === 'function'", 'M1 编辑器加载');
    await cdp.evalJs("window.setViewZoom(1.2347)"); await sleep(150);
    await cdp.evalJs("window.createSneCard(2, 2, 9, 12)"); await sleep(150);
    await cdp.evalJs("window.createSneCard(14, 2, 9, 12)"); await sleep(150);
    await cdp.evalJs(BB_FN);
    const m1pt = await cdp.evalJs(DRAG_PT);
    const m1tg = await cdp.evalJs(TGT_LEFT);
    await dragMouse(m1pt.x, m1pt.y, m1pt.x + m1tg.dx, m1pt.y, 8);
    const m1 = await cdp.evalJs(CHECK_FLUSH);
    ok('M1 浮点 zoom 1.2347 左并：bbox 右边贴目标左边 ≤0.5 + 同组 groupId + top 恒等（tT 顶对齐）+ dataset.x 同步',
      m1 && m1.flR <= 0.5 && m1.gidA && m1.gidA === m1.gidB && m1.topEq === true && m1.dxSync === true,
      JSON.stringify(m1) + ' tgt=' + JSON.stringify(m1tg));

    // ── M2 旋转目标 30° 左并：bbox flush（旧码 ~52px 错开——bug 判别项）──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "document.getElementById('undoBtn') && typeof window.historyUndoAction === 'function'", 'M2 编辑器加载');
    await cdp.evalJs("window.setViewZoom(1.2347)"); await sleep(150);
    await cdp.evalJs("window.createSneCard(2, 2, 9, 12)"); await sleep(150);
    await cdp.evalJs("window.createSneCard(14, 2, 9, 12)"); await sleep(150);
    await cdp.evalJs("(function(){ var b = document.querySelectorAll('#gridCanvas .grid-card')[1]; b.dataset.rotate = 30; b.style.transform = 'rotate(30deg)'; return true; })()");
    await sleep(150);
    await cdp.evalJs(BB_FN);
    const m2pt = await cdp.evalJs(DRAG_PT);
    const m2tg = await cdp.evalJs(TGT_LEFT);
    await dragMouse(m2pt.x, m2pt.y, m2pt.x + m2tg.dx, m2pt.y, 8);
    const m2 = await cdp.evalJs(CHECK_FLUSH);
    ok('M2 旋转目标 30° 左并：A bbox 右边贴 B bbox 左边 ≤0.5（bbox 口径；旧整数边落位错开 ' +
      (m2 && m2.bRot === 30 ? (Math.abs(m2.bL - m2.bbBL)).toFixed(1) + 'px' : '?') + '）+ 同组 groupId',
      m2 && m2.flR <= 0.5 && m2.gidA && m2.gidA === m2.gidB,
      JSON.stringify(m2) + ' tgt=' + JSON.stringify(m2tg));

    // ── M3 zoom 1 未旋转退化恒等：左并 = 旧算式（A.left = B.left − A.width）零行为变化 ──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "document.getElementById('undoBtn') && typeof window.historyUndoAction === 'function'", 'M3 编辑器加载');
    await cdp.evalJs("window.createSneCard(2, 2, 9, 12)"); await sleep(150);
    await cdp.evalJs("window.createSneCard(14, 2, 9, 12)"); await sleep(150);
    await cdp.evalJs(BB_FN);
    const m3pt = await cdp.evalJs(DRAG_PT);
    const m3tg = await cdp.evalJs(TGT_LEFT);
    await dragMouse(m3pt.x, m3pt.y, m3pt.x + m3tg.dx, m3pt.y, 8);
    const m3 = await cdp.evalJs(CHECK_FLUSH);
    ok('M3 zoom 1 未旋转退化恒等：A.left = B.left − A.width（±0.5，旧算式同值）+ 同组',
      m3 && Math.abs(m3.aL - (m3.bL - m3.aW)) <= 0.5 && m3.gidA && m3.gidA === m3.gidB,
      JSON.stringify(m3) + ' tgt=' + JSON.stringify(m3tg));

    // ── M4 旋转目标 30° 上并：A bbox 底边贴 B bbox 顶边 flush（bbox 面并集口径）──
    await nav(BASE + '/pages/fluidcanvas-editor.html',
      "document.getElementById('undoBtn') && typeof window.historyUndoAction === 'function'", 'M4 编辑器加载');
    await cdp.evalJs("window.createSneCard(2, 2, 9, 12)"); await sleep(150);
    await cdp.evalJs("window.createSneCard(2, 16, 9, 12)"); await sleep(150);
    await cdp.evalJs("(function(){ var b = document.querySelectorAll('#gridCanvas .grid-card')[1]; b.dataset.rotate = 30; b.style.transform = 'rotate(30deg)'; return true; })()");
    await sleep(150);
    await cdp.evalJs(BB_FN);
    const m4pt = await cdp.evalJs(DRAG_PT);
    const m4tg = await cdp.evalJs(TGT_TOP);
    await dragMouse(m4pt.x, m4pt.y, m4pt.x, m4pt.y + m4tg.dy, 8);
    const m4 = await cdp.evalJs(CHECK_FLUSH);
    ok('M4 旋转目标 30° 上并：A bbox 底边贴 B bbox 顶边 ≤0.5（bbox 面并集；旧整数边落位错开 ' +
      (m4 && m4.bRot === 30 ? (Math.abs(m4.bL + m4.aH / 2 - m4.bbBT)).toFixed(1) + 'px' : '?') + '）+ 同组',
      m4 && m4.flB <= 0.5 && m4.gidA && m4.gidA === m4.gidB,
      JSON.stringify(m4) + ' tgt=' + JSON.stringify(m4tg));

    // ── E 全程零 Runtime exception + 零 console error ──
    ok('E1 全程零 Runtime exception + 零 console error', cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      (cdp.errs.slice(0, 3).join(' | ') || '') + (cdp.consoleErrs.slice(0, 3).join(' | ') || '干净'));
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
