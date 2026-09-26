// tmp-probe-q-shapes.js — 第 Q 轮自由形状合并组探针（v0.2.36.0 前取证 + 后验证）
// P1 左右并入保尺寸 / P2 倒L台阶面宽并入 / P2h 空角命中+截图 / P3 伸出部面宽并入 /
// P4 十字四向 / P5 平底跨两列整面宽 / P10 组背景 clip-path+filter / P6 墙让位
// （斜对卡不误推）/ P6b 南扩 / P8 整组缩放保形 / P9 拆分保形 / P7 草稿往返 / Z 零 error
// 用法：cd backend-v2 && node tmp-probe-q-shapes.js（改前跑=记录现状失败项，改后跑=全绿）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 100);
const CDP_PORT = 5900 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-qshapes-' + Date.now());
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
  async mouse(type, x, y, clickCount) {
    await this.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: clickCount || 1 });
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

let results = [];
function check(tag, cond, detail) {
  results.push({ tag, ok: !!cond, detail: detail || '' });
  console.log('  ' + (cond ? '✅' : '❌') + ' ' + tag + (detail ? '  ' + detail : ''));
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
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1600,1000', '--remote-debugging-port=' + CDP_PORT,
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
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const meas = async (expr) => JSON.parse(await cdp.evalJs('JSON.stringify(' + expr + ')'));
    const dragHandle = async (dir, dx, dy) => {
      const h = JSON.parse(await cdp.evalJs('JSON.stringify(window.__hdl(' + JSON.stringify(dir) + '))'));
      if (!h) throw new Error('no handle: ' + dir);
      await cdp.mouse('mousePressed', h.x, h.y, 1);
      for (let i = 1; i <= 4; i++) await cdp.mouse('mouseMoved', h.x + dx * i / 4, h.y + dy * i / 4);
      await cdp.mouse('mouseReleased', h.x + dx, h.y + dy, 1);
      await sleep(300);
    };

    await nav(BASE + '/pages/fluidcanvas-editor.html', "typeof window.createFlagCard === 'function'", 'load');
    await cdp.evalJs(`(function(){
      window.__mkContent = function (x, y) { var c = window.createContentCard(); window.moveCardPx(c, x, y); return c; };
      window.__meas = function (c) { return { l: parseFloat(c.style.left) || 0, t: parseFloat(c.style.top) || 0, w: c.offsetWidth, h: c.offsetHeight, gid: c.dataset.groupId || null, rowIn: c.dataset.rowInGroup || null }; };
      window.__dumpAll = function () { return Array.prototype.slice.call(document.querySelectorAll('.grid-card')).map(function (c) { return { id: c.dataset.cardId || null, l: parseFloat(c.style.left) || 0, t: parseFloat(c.style.top) || 0, w: c.offsetWidth, h: c.offsetHeight, gid: c.dataset.groupId || null, rowIn: c.dataset.rowInGroup || null }; }); };
      window.__hdl = function (dir) { var h = document.querySelector('.resize-handle[data-dir="' + dir + '"]'); if (!h) return null; var r = h.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
      window.__mkNear = function (anchor, side, x) { var c = window.createContentCard(); var al = parseFloat(anchor.style.left) || 0, at = parseFloat(anchor.style.top) || 0; var aw = anchor.offsetWidth, ah = anchor.offsetHeight; var cw = c.offsetWidth, ch = c.offsetHeight; if (side === 'bottom') window.moveCardPx(c, x, at + ah); else if (side === 'top') window.moveCardPx(c, x, at - ch); else if (side === 'right') window.moveCardPx(c, al + aw, at); else window.moveCardPx(c, al - cw, at); return c; };
      window.__holePoint = function (gid) { var ms = Array.prototype.slice.call(document.querySelectorAll('.grid-card')).filter(function (c) { return c.dataset.groupId === gid; }); if (ms.length === 0) return null; var L = Infinity, T = Infinity, R = -Infinity, B = -Infinity; ms.forEach(function (c) { var l = parseFloat(c.style.left) || 0, t = parseFloat(c.style.top) || 0, r = l + c.offsetWidth, b = t + c.offsetHeight; if (l < L) L = l; if (t < T) T = t; if (r > R) R = r; if (b > B) B = b; }); var pts = [[L + 6, T + 6], [R - 6, T + 6], [L + 6, B - 6], [R - 6, B - 6]]; for (var i = 0; i < pts.length; i++) { var px = pts[i][0], py = pts[i][1], free = true; for (var j = 0; j < ms.length; j++) { var c = ms[j]; var l = parseFloat(c.style.left) || 0, t = parseFloat(c.style.top) || 0, r = l + c.offsetWidth, b = t + c.offsetHeight; if (px > l && px < r && py > t && py < b) { free = false; break; } } if (free) return { x: px, y: py }; } return null; };
      return true;
    })()`);

    // ── P1 右并入保尺寸：A1 默认宽 + B1 收窄 → 双方各保原尺寸 ──
    await cdp.evalJs('window.__A1 = window.__mkContent(200, 200); true');
    const wA1o = await cdp.evalJs('window.__A1.offsetWidth');
    await cdp.evalJs('window.__B1 = window.__mkContent(380, 200); window.selectCard(window.__B1, true); true');
    await sleep(300);
    await dragHandle('w', wA1o - 86, 0);
    const wB1 = await cdp.evalJs('window.__B1.offsetWidth');
    await cdp.evalJs('window.mergeCards(window.__B1, window.__A1, "right"); true');
    await sleep(250);
    let g1 = await meas('{ A: window.__meas(window.__A1), B: window.__meas(window.__B1) }');
    check('P1 右并入后 A 宽度不变', g1.A.w === wA1o, 'A=' + g1.A.w + ' 原=' + wA1o);
    check('P1 右并入后 B 保持收窄宽度（不被拉成 A 宽）', g1.B.w === wB1, 'B=' + g1.B.w + ' 原=' + wB1);
    check('P1 B 贴 A 右缘 flush', Math.abs(g1.B.l - (g1.A.l + g1.A.w)) < 0.6, 'B.l=' + g1.B.l + ' A.r=' + (g1.A.l + g1.A.w));
    check('P1 B 顶对齐 A', Math.abs(g1.B.t - g1.A.t) < 0.6, 'B.t=' + g1.B.t + ' A.t=' + g1.A.t);
    check('P1 同组', g1.A.gid === g1.B.gid && !!g1.A.gid, 'gid=' + g1.A.gid);

    // ── P2 倒L：A2 宽 + B2 收窄右并入 → C2 从下并入只匹配 B2 面宽 ──
    await cdp.evalJs('window.__A2 = window.__mkContent(600, 200); true');
    const wA2o = await cdp.evalJs('window.__A2.offsetWidth');
    await cdp.evalJs('window.__B2 = window.__mkContent(800, 200); window.selectCard(window.__B2, true); true');
    await sleep(300);
    await dragHandle('w', wA2o - 86, 0);
    const wB2 = await cdp.evalJs('window.__B2.offsetWidth');
    await cdp.evalJs('window.mergeCards(window.__B2, window.__A2, "right"); true');
    await sleep(250);
    let g2 = await meas('{ A: window.__meas(window.__A2), B: window.__meas(window.__B2) }');
    check('P2 右并入后 A2 不被拉伸', g2.A.w === wA2o, 'A=' + g2.A.w + ' 原=' + wA2o);
    check('P2 右并入后 B2 保持窄宽', g2.B.w === wB2, 'B=' + g2.B.w + ' 原=' + wB2);
    check('P2 B2 贴 A2 右缘、顶对齐', Math.abs(g2.B.l - (g2.A.l + g2.A.w)) < 0.6 && Math.abs(g2.B.t - g2.A.t) < 0.6, 'B=(' + g2.B.l + ',' + g2.B.t + ')');
    await cdp.evalJs('window.__C2 = window.__mkNear(window.__B2, "bottom", 774); window.mergeCards(window.__C2, window.__B2, "bottom"); true');
    await sleep(250);
    let g3 = await meas('{ A: window.__meas(window.__A2), B: window.__meas(window.__B2), C: window.__meas(window.__C2) }');
    check('P2 从下并入只匹配接触面 B2 宽（不是整组宽）', g3.C.w === g3.B.w, 'C=' + g3.C.w + ' B=' + g3.B.w);
    check('P2 C2 x 对齐 B2', Math.abs(g3.C.l - g3.B.l) < 0.6, 'C.l=' + g3.C.l + ' B.l=' + g3.B.l);
    check('P2 C2 贴 B2 下缘 flush', Math.abs(g3.C.t - (g3.B.t + g3.B.h)) < 0.6, 'C.t=' + g3.C.t + ' B.b=' + (g3.B.t + g3.B.h));
    check('P2 无 rowInGroup 标记', !g3.C.rowIn, 'C.rowIn=' + g3.C.rowIn);

    // ── P2h 空角命中：倒L 缺口（A2 下方、C2 左侧）不应被组背景矩形拦截 ──
    let hole = await meas('window.__holePoint(window.__A2.dataset.groupId)');
    check('P2h 组 bbox 存在空角（倒L 缺口）', !!hole, hole ? '(' + hole.x + ',' + hole.y + ')' : '无空角（bbox 被全盖=形状被压成矩形）');
    if (hole) {
      let hit = await cdp.evalJs("(function(){ var el = document.elementFromPoint(" + hole.x + "," + hole.y + "); return el ? (el.className || el.tagName || '?') : 'null'; })()");
      check('P2h 空角命中画布而非组背景', String(hit).indexOf('grid-group-bg') === -1, 'hit=' + String(hit));
      try {
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: hole.x - 60, y: hole.y - 60, width: 320, height: 120, scale: 1 } });
        fs.writeFileSync(path.join(__dirname, 'tmp-q-shapes-hole.png'), Buffer.from(shot.data, 'base64'));
        console.log('  [截图] tmp-q-shapes-hole.png（空角区域）');
      } catch (e) { console.log('  [截图失败跳过] ' + e.message); }
    }

    // ── P3 从下并入 A2 伸出部 → 面=A2 → 宽=A2 宽 ──
    await cdp.evalJs('window.__D3 = window.__mkNear(window.__A2, "bottom", 600); window.mergeCards(window.__D3, window.__A2, "bottom"); true');
    await sleep(250);
    let g4 = await meas('{ A: window.__meas(window.__A2), D: window.__meas(window.__D3) }');
    check('P3 伸出部面=A2：D 宽=A2 宽（不是整组宽）', g4.D.w === g4.A.w, 'D=' + g4.D.w + ' A=' + g4.A.w);
    check('P3 D x 对齐 A2、贴 A2 下缘', Math.abs(g4.D.l - g4.A.l) < 0.6 && Math.abs(g4.D.t - (g4.A.t + g4.A.h)) < 0.6, 'D=(' + g4.D.l + ',' + g4.D.t + ')');

    // ── P4 十字：中心 C0 + 左右保尺寸 + 上下面=中心宽 ──
    await cdp.evalJs('window.__C0 = window.__mkContent(800, 350); true');
    await cdp.evalJs('window.__L4 = window.__mkContent(660, 350); window.selectCard(window.__L4, true); true');
    await sleep(300);
    await dragHandle('w', 174 - 86, 0);
    const wL4 = await cdp.evalJs('window.__L4.offsetWidth');
    await cdp.evalJs('window.mergeCards(window.__L4, window.__C0, "left"); true');
    await cdp.evalJs('window.__R4 = window.__mkContent(1050, 350); window.mergeCards(window.__R4, window.__C0, "right"); true');
    await cdp.evalJs('window.__T4 = window.__mkNear(window.__C0, "top", 800); window.mergeCards(window.__T4, window.__C0, "top"); true');
    await cdp.evalJs('window.__B4 = window.__mkNear(window.__C0, "bottom", 800); window.mergeCards(window.__B4, window.__C0, "bottom"); true');
    await sleep(300);
    let g5 = await meas('{ L: window.__meas(window.__L4), T: window.__meas(window.__T4), C: window.__meas(window.__C0), R: window.__meas(window.__R4), B: window.__meas(window.__B4) }');
    check('P4 左臂保窄尺寸', g5.L.w === wL4, 'L=' + g5.L.w + ' 原=' + wL4);
    check('P4 右臂保原尺寸', g5.R.w === 174 || Math.abs(g5.R.w - 174) <= 22, 'R=' + g5.R.w);
    check('P4 上臂面=中心宽（不被拉到整组宽）', Math.abs(g5.T.w - g5.C.w) < 0.6, 'T=' + g5.T.w + ' C=' + g5.C.w);
    check('P4 下臂面=中心宽', Math.abs(g5.B.w - g5.C.w) < 0.6, 'B=' + g5.B.w + ' C=' + g5.C.w);
    check('P4 上臂贴中心顶、下臂贴中心底', Math.abs(g5.T.t + g5.T.h - g5.C.t) < 0.6 && Math.abs(g5.B.t - (g5.C.t + g5.C.h)) < 0.6, '');
    check('P4 左右臂顶对齐中心', Math.abs(g5.L.t - g5.C.t) < 0.6 && Math.abs(g5.R.t - g5.C.t) < 0.6, '');
    check('P4 五卡同组', g5.L.gid === g5.C.gid && g5.R.gid === g5.C.gid && g5.T.gid === g5.C.gid && g5.B.gid === g5.C.gid, 'gid=' + g5.C.gid);

    // ── P5 平底跨两列：A5 与 B5 等高平底 → 跨两列下并入=整面宽 ──
    await cdp.evalJs('window.__A5 = window.__mkContent(1000, 200); true');
    await cdp.evalJs('window.__B5 = window.__mkContent(1190, 200); window.selectCard(window.__B5, true); true');
    await sleep(300);
    await dragHandle('w', 174 - 86, 0);
    const wB5 = await cdp.evalJs('window.__B5.offsetWidth');
    await cdp.evalJs('window.mergeCards(window.__B5, window.__A5, "right"); true');
    await cdp.evalJs('window.__D5 = window.__mkNear(window.__A5, "bottom", 1050); window.mergeCards(window.__D5, window.__A5, "bottom"); true');
    await sleep(250);
    let g6 = await meas('{ A: window.__meas(window.__A5), B: window.__meas(window.__B5), D: window.__meas(window.__D5) }');
    check('P5 右并入 B5 保持窄宽', g6.B.w === wB5, 'B=' + g6.B.w + ' 原=' + wB5);
    check('P5 平底跨两列：D 宽=整面宽（A.l→B.r）', Math.abs(g6.D.w - ((g6.B.l + g6.B.w) - g6.A.l)) < 0.6, 'D=' + g6.D.w + ' 面=' + ((g6.B.l + g6.B.w) - g6.A.l));
    check('P5 D 左缘=面左缘、贴平底', Math.abs(g6.D.l - g6.A.l) < 0.6 && Math.abs(g6.D.t - (g6.A.t + g6.A.h)) < 0.6, 'D=(' + g6.D.l + ',' + g6.D.t + ')');

    // ── P10 组背景多边形（CSS 层）──
    let p10 = await meas("(function(){ var bgs = document.querySelectorAll('.grid-group-bg'); var any = null; for (var i = 0; i < bgs.length; i++) { var cp = bgs[i].style.clipPath || getComputedStyle(bgs[i]).clipPath || 'none'; if (cp !== 'none') { any = cp; break; } } return { clip: any, count: bgs.length, filter: bgs.length ? getComputedStyle(bgs[0]).filter : 'none' }; })()");
    check('P10 组背景带多边形 clip-path（path() 非矩形）', !!p10.clip && p10.clip.indexOf('path(') !== -1 && p10.clip.length > 60, 'clip=' + String(p10.clip || 'none').slice(0, 80));
    check('P10 组背景描边/阴影走 drop-shadow 跟随剪影', p10.filter.indexOf('drop-shadow') !== -1, 'filter=' + p10.filter.slice(0, 90));
    check('P10 多组各有背景', p10.count >= 3, 'bg 数=' + p10.count);

    // ── P6 墙让位：A6 东扩 → 右侧 y 相交伙伴 B6 让位；斜对卡 X6（正下方右侧）不误推 ──
    await cdp.evalJs('window.__A6 = window.__mkContent(100, 600); true');
    await cdp.evalJs('window.__B6 = window.__mkContent(280, 600); window.mergeCards(window.__B6, window.__A6, "right"); true');
    await cdp.evalJs('window.__C6 = window.__mkNear(window.__A6, "bottom", 100); window.mergeCards(window.__C6, window.__A6, "bottom"); true');
    await cdp.evalJs('window.__X6 = window.__mkNear(window.__C6, "right", 0); window.mergeCards(window.__X6, window.__C6, "right"); true');
    await cdp.evalJs('window.moveCardPx(window.__X6, 340, 686); window.selectCard(window.__A6, true); true');
    await sleep(300);
    await dragHandle('e', 60, 0);
    let g7 = await meas('{ A: window.__meas(window.__A6), B: window.__meas(window.__B6), C: window.__meas(window.__C6), X: window.__meas(window.__X6) }');
    check('P6 A6 东扩 +60', Math.abs(g7.A.w - 234) < 24, 'A.w=' + g7.A.w);
    check('P6 右侧 y 相交伙伴 B6 让位 flush', Math.abs(g7.B.l - (g7.A.l + g7.A.w)) < 0.6, 'B.l=' + g7.B.l + ' A.r=' + (g7.A.l + g7.A.w));
    check('P6 斜对卡 X6（正下方右侧、y 不相交）不误推', Math.abs(g7.X.l - 340) < 0.6 && Math.abs(g7.X.t - 686) < 0.6, 'X=(' + g7.X.l + ',' + g7.X.t + ') 原=(340,686)');
    check('P6 正下方 C6 不随东扩移动', Math.abs(g7.C.l - 100) < 0.6 && Math.abs(g7.C.t - 686) < 0.6, 'C=(' + g7.C.l + ',' + g7.C.t + ')');

    // ── P6b 南扩：正下方 C6 让位 flush；右侧 B6 不动；斜对 X6 不动 ──
    await cdp.evalJs('window.selectCard(window.__A6, true); true');
    await sleep(300);
    await dragHandle('s', 0, 30);
    let g8 = await meas('{ A: window.__meas(window.__A6), B: window.__meas(window.__B6), C: window.__meas(window.__C6), X: window.__meas(window.__X6) }');
    check('P6b 正下方 C6 让位 flush', Math.abs(g8.C.t - (g8.A.t + g8.A.h)) < 0.6, 'C.t=' + g8.C.t + ' A.b=' + (g8.A.t + g8.A.h));
    check('P6b 右侧伙伴 B6 不随南扩移动', Math.abs(g8.B.t - 600) < 0.6, 'B.t=' + g8.B.t);
    check('P6b 斜对卡 X6 不随南扩移动', Math.abs(g8.X.l - 340) < 0.6 && Math.abs(g8.X.t - 686) < 0.6, 'X=(' + g8.X.l + ',' + g8.X.t + ')');

    // ── P8 整组缩放（十字组 e 柄 +60）→ 保形 ──
    await cdp.evalJs('window.selectCard(window.__L4, false); true');
    await sleep(300);
    let wC0o = g5.C.w;
    await dragHandle('e', 60, 0);
    let g9 = await meas('{ L: window.__meas(window.__L4), T: window.__meas(window.__T4), C: window.__meas(window.__C0), R: window.__meas(window.__R4), B: window.__meas(window.__B4) }');
    check('P8 整组缩放后左臂仍贴中心左缘', Math.abs(g9.L.l + g9.L.w - g9.C.l) < 3, 'L.r=' + (g9.L.l + g9.L.w) + ' C.l=' + g9.C.l);
    check('P8 上臂仍在中心上方、下臂仍在下方', g9.T.t + g9.T.h <= g9.C.t + 3 && g9.B.t >= g9.C.t + g9.C.h - 3, '');
    check('P8 右臂仍贴中心右缘', Math.abs(g9.R.l - (g9.C.l + g9.C.w)) < 3, 'R.l=' + g9.R.l);
    check('P8 成员随组框变宽（等比缩放）', g9.C.w > wC0o, 'C.w ' + wC0o + '→' + g9.C.w);

    // ── P9 拆分保形：P1 组拆出 B1 → 双方回独立卡、位置不动 ──
    let g10a = await meas('{ A: window.__meas(window.__A1), B: window.__meas(window.__B1) }');
    await cdp.evalJs('window.splitCardFromGroup(window.__B1); true');
    await sleep(250);
    let g10b = await meas('{ A: window.__meas(window.__A1), B: window.__meas(window.__B1) }');
    check('P9 拆出后双方位置/尺寸不动', g10b.A.l === g10a.A.l && g10b.A.t === g10a.A.t && g10b.A.w === g10a.A.w && g10b.B.l === g10a.B.l && g10b.B.t === g10a.B.t, '');
    check('P9 双方回独立卡（gid 清空）', !g10b.A.gid && !g10b.B.gid, '');

    // ── P7 草稿往返保形：saveDraft → 重载 → 逐卡几何一致 ──
    await cdp.evalJs('window.saveDraft(); true');
    await sleep(400);
    let before = await meas('window.__dumpAll()');
    let groupsBefore = await cdp.evalJs('document.querySelectorAll(".grid-group-bg").length');
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelectorAll('.grid-card').length > 0", 'P7 重载');
    await cdp.evalJs("window.__dumpAll = function () { return Array.prototype.slice.call(document.querySelectorAll('.grid-card')).map(function (c) { return { id: c.dataset.cardId || null, l: parseFloat(c.style.left) || 0, t: parseFloat(c.style.top) || 0, w: c.offsetWidth, h: c.offsetHeight, gid: c.dataset.groupId || null, rowIn: c.dataset.rowInGroup || null }; }); }; true");
    let after = await meas('window.__dumpAll()');
    let groupsAfter = await cdp.evalJs('document.querySelectorAll(".grid-group-bg").length');
    check('P7 重载后卡数量一致', after.length === before.length, before.length + '→' + after.length);
    check('P7 组背景数量一致', groupsAfter === groupsBefore, groupsBefore + '→' + groupsAfter);
    let diffCnt = 0, diffRow = '';
    after.forEach(function (a) {
      var b = before.find(function (x) { return x.id === a.id; });
      if (!b) { diffCnt++; diffRow = '缺 id ' + a.id; return; }
      if (Math.abs(a.l - b.l) > 0.6 || Math.abs(a.t - b.t) > 0.6 || Math.abs(a.w - b.w) > 0.6 || Math.abs(a.h - b.h) > 0.6 || a.gid !== b.gid) {
        diffCnt++; diffRow = 'id ' + a.id + ' 前(' + b.l + ',' + b.t + ',' + b.w + ',' + b.h + ',' + b.gid + ') 后(' + a.l + ',' + a.t + ',' + a.w + ',' + a.h + ',' + a.gid + ')';
      }
    });
    check('P7 逐卡几何/组归属完全一致（无 reflow 塌形）', diffCnt === 0, diffRow || '零差异');
    check('P7 无任何 rowInGroup 残留', after.every(function (x) { return !x.rowIn; }), '');

    await sleep(200);
    check('Z 零 console error', cdp.errs.length === 0, cdp.errs.slice(0, 3).join(' | '));
    await cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
  const ok = results.filter(r => r.ok).length;
  console.log('\n── 结果: ' + ok + '/' + results.length + (ok === results.length ? ' 全绿 ✅' : ' 有失败 ❌') + ' ──');
  process.exit(ok === results.length ? 0 : 1);
})().catch(e => { console.error('FAIL:', e.message); process.exit(2); });
