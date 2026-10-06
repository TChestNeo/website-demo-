// tmp-battery-group-shapes.js — v0.2.36.0 / FC v10.28.26.0 自由形状合并组验证（2026-09-12，Round Q）
// 背景：用户「合并时能不能不只是正方形：①从左/右侧合并时不会因为长度不一样
//   被拉长成一个长度，保持一样的大小但是合并；②从上方/下方合并时卡片只根据
//   『他动到的那一面』的最宽值调整大小（倒 L 台阶只拿那一面的最宽值）；
//   ③合并组不再只是四边形，可以是 6 边形的 L 型/十字型等排列」。
//   修法：mergeCards 接触面模型（上/下并入宽=面并集跨度、左右并入零归一化）、
//   reflowGroup 保形（只重画背景手柄永不改几何）、行卡机制整体退役、
//   墙模型右/左集合加垂直重叠守卫（台阶斜对不误推）、组背景 clip-path path()
//   L/十字剪影 + drop-shadow 四向描边（无 spread）。
// 断言组：
//   F1-F3 静态：接触面模型/保形/退役函数全删 / computeGroupOutline+XOR+钩子+CSS /
//     版本 v0.2.36.0 + v10.28.26.0；
//   U1-U2 纯函数纸面串：L 形并集轮廓精确串 / 三矩形横条（并集=矩形）精确串；
//   S1 右并入保尺寸（80 宽 B 右并入 A → 双方各保、贴齐顶对齐）；
//   S2 倒 L 台阶面宽（C 从下并入 x 只叠 B → 宽=B 宽、x 对齐 B、窄于组）；
//   S3 平底跨两列（D 横跨 A+B 平底 → 宽=整面跨度、左=面左缘）；
//   S4 十字四向（四臂贴齐中心各边、上下臂面宽=中心宽、左右臂保 80、同组+bg clip 在场）；
//   S5 组背景多边形（空角 elementFromPoint 命中画布、体内命中 bg、clip 含 path( 与圆弧、
//     与 computeGroupOutline 重算自洽）；
//   S6 墙让位（A 东扩 → B flush A 而台阶斜对 C 完全不动 / A2 南扩 → C2 下方卡 flush）；
//   S7 整组缩放保形（十字 se 柄 +40,+30 → 四臂仍贴中心、同组）；
//   S8 十字草稿往返（逐卡几何+gid 零差异）；S9 拆分保形（拆出臂 gid 清+几何不动、余组完好）；
//   B 版本徽章 FC v10.28.26.0；Z 零 console error。
// 跑法：node backend-v2/tmp-battery-group-shapes.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4700 + Math.floor(Math.random() * 300);
const CDP_PORT = 5800 + Math.floor(Math.random() * 300);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-gshapes-' + Date.now());

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
  async mouse(type, x, y, clickCount) {
    await this.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: clickCount || 1 });
  }
  async trustedClick(x, y, cc) { await this.mouse('mousePressed', x, y, cc); await this.mouse('mouseReleased', x, y, cc); }
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

  // ── F1-F3 静态 ──
  const fce = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  ok('F1 静态：接触面模型（face 过滤+空面退化+面并集跨度）+ 左右并入零归一化（贴侧边顶对齐）+ reflowGroup 保形 + 行卡机制整体退役（退役函数全删）',
    fce.indexOf('var face = getAllCards().filter(function (c) {') !== -1 &&
    fce.indexOf('if (face.length === 0) face = [target];') !== -1 &&
    fce.indexOf('normalizeCardWidth(card, Math.max(1, fR - fL))') !== -1 &&
    fce.indexOf("moveCardPx(card, fL, (side === 'bottom' ? fB : (fT - card.offsetHeight)));") !== -1 &&
    fce.indexOf("if (side === 'left') {") !== -1 &&
    fce.indexOf('moveCardPx(card, tL + target.offsetWidth, tT);') !== -1 &&
    (function () { var rg = fce.slice(fce.indexOf('function reflowGroup(g)'), fce.indexOf('window.reflowGroup'));
      return rg.indexOf('updateGroupBgs();') !== -1 && rg.indexOf('refreshResizeHandles();') !== -1 &&
        rg.indexOf('moveCardPx') === -1 && rg.indexOf('normalizeCardWidth') === -1 && rg.indexOf('setCardSize') === -1; })() &&
    fce.indexOf('function alignGroupTops') === -1 &&
    fce.indexOf('function snapshotGroupRows') === -1 &&
    fce.indexOf('function pushGroupRows') === -1 &&
    fce.indexOf('function reassertRowWidths') === -1 &&
    fce.indexOf('function groupColumns') === -1 &&
    fce.indexOf("card.dataset.rowInGroup = '1';") === -1);
  ok('F2 静态：computeGroupOutline（区间带扫描+共享边界 XOR）+ window 测试钩子 + updateGroupBgs 写 clip-path + CSS drop-shadow 无 spread 四向描边栈',
    fce.indexOf('function computeGroupOutline(rects)') !== -1 &&
    fce.indexOf('function xorH(below, above, y) {') !== -1 &&
    fce.indexOf('window.computeGroupOutline = computeGroupOutline;') !== -1 &&
    fce.indexOf("bg.style.clipPath = \"path('\" + outline + \"')\";") !== -1 &&
    fce.indexOf('clip-path: none;') !== -1 &&
    fce.indexOf('drop-shadow(1px 0 0 var(--divider-line)) drop-shadow(-1px 0 0 var(--divider-line)) drop-shadow(0 1px 0 var(--divider-line)) drop-shadow(0 -1px 0 var(--divider-line))') !== -1 &&
    fce.indexOf('drop-shadow(3px 0 0 var(--color-primary-fixed-dim))') !== -1);
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('F3 静态：当前版本 v0.2.45.2 + FC v10.28.34.2（2026-09-14 贴齐缝修复轮复跑口径）',
    sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.45.2';") !== -1 &&
    sconf.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.34.2';") !== -1);

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
    '--window-size=1600,1200', '--remote-debugging-port=' + CDP_PORT,
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

    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "typeof window.findMergeSnap === 'function'", 20000, '编辑器加载');
    await sleep(600);

    const helpers = "function byId(id){ return Array.from(document.querySelectorAll('.grid-card')).find(function(c){ return c.dataset.cardId === id; }); }" +
      "function posCard(el){ return { left: parseFloat(el.style.left) || 0, top: parseFloat(el.style.top) || 0, w: el.offsetWidth, h: el.offsetHeight }; }";

    // ── U1/U2 纯函数纸面串（computeGroupOutline，测试钩子）──
    const u1 = await cdp.evalJs(`(function(){
      var got = window.computeGroupOutline([{l:0,t:0,r:100,b:200},{l:0,t:0,r:200,b:100}]);
      var exp = "M0 0 L14 0 A14 14 0 0 0 0 14 L0 186 A14 14 0 0 0 14 200 L86 200 A14 14 0 0 0 100 186 L100 100 L186 100 A14 14 0 0 0 200 86 L200 14 A14 14 0 0 0 186 0Z";
      return { ok: got === exp, got: got, exp: exp };
    })()`);
    ok('U1 纯函数纸面串：L 形并集轮廓精确串（凹角直角+凸角 r14 圆弧+走环序）',
      !!u1 && u1.ok);
    if (u1 && !u1.ok) console.log('  ℹ U1 got:', JSON.stringify(u1.got), '\n     exp:', JSON.stringify(u1.exp));
    const u2 = await cdp.evalJs(`(function(){
      var got = window.computeGroupOutline([{l:0,t:100,r:100,b:200},{l:100,t:100,r:200,b:200},{l:200,t:100,r:300,b:200}]);
      var exp = "M0 100 L14 100 A14 14 0 0 0 0 114 L0 186 A14 14 0 0 0 14 200 L286 200 A14 14 0 0 0 300 186 L300 114 A14 14 0 0 0 286 100Z";
      return { ok: got === exp, got: got, exp: exp };
    })()`);
    ok('U2 纯函数纸面串：三矩形横条并集（=矩形）精确串（共享边界 XOR 不泄漏内边）',
      !!u2 && u2.ok);
    if (u2 && !u2.ok) console.log('  ℹ U2 got:', JSON.stringify(u2.got), '\n     exp:', JSON.stringify(u2.exp));

    // ── S1 右并入保尺寸（80 宽 B 右并入 A → 双方各保、贴齐顶对齐）──
    const s1 = await cdp.evalJs(helpers + `(function(){
      var A = window.createContentCard(); window.moveCardPx(A, 300, 200);
      var B = window.createContentCard(); window.moveCardPx(B, 500, 200); B.style.width = '80px';
      var a0 = posCard(A), b0 = posCard(B);
      window.mergeCards(B, A, 'right');
      var AP = posCard(A), BP = posCard(B);
      return { ids: { a: A.dataset.cardId, b: B.dataset.cardId },
        sameGroup: A.dataset.groupId && A.dataset.groupId === B.dataset.groupId,
        bKept: BP.w === b0.w && BP.h === b0.h,
        aKept: AP.w === a0.w && AP.h === a0.h && AP.left === a0.left && AP.top === a0.top,
        flushRight: Math.abs(BP.left - (AP.left + AP.w)) < 0.5,
        topAligned: Math.abs(BP.top - AP.top) < 0.5 };
    })()`);
    ok('S1 右并入保尺寸：80 宽 B 右并入 A → B 保持 80 宽、A 尺寸零变化、贴 A 右缘+顶对齐+同组',
      !!s1 && s1.sameGroup && s1.bKept && s1.aKept && s1.flushRight && s1.topAligned);
    if (s1 && !(s1.sameGroup && s1.bKept && s1.aKept && s1.flushRight && s1.topAligned)) console.log('  ℹ S1 诊断:', JSON.stringify(s1));

    // ── S2 倒 L 台阶面宽（C 从下并入 x 只叠 B → 宽=B 宽、x 对齐 B、窄于组）──
    const s2 = await cdp.evalJs(helpers + `(function(){
      var A = byId('${s1.ids.a}'), B = byId('${s1.ids.b}');
      var C = window.createContentCard();
      window.moveCardPx(C, posCard(B).left + 10, posCard(B).top + posCard(B).h + 6);
      window.mergeCards(C, B, 'bottom');
      var BP = posCard(B), CP = posCard(C), AP = posCard(A);
      return { ids: { c: C.dataset.cardId },
        sameGroup: C.dataset.groupId === B.dataset.groupId,
        faceWidth: Math.abs(CP.w - BP.w) < 0.5,
        leftAligned: Math.abs(CP.left - BP.left) < 0.5,
        below: Math.abs(CP.top - (BP.top + BP.h)) < 0.5,
        narrowerThanGroup: CP.w < AP.w,
        groupIntact: A.dataset.groupId === B.dataset.groupId };
    })()`);
    ok('S2 倒 L 台阶面宽：C 从下并入 x 只叠 B → 宽=B 宽（只拿那一面）、x 对齐 B、贴 B 底、窄于组最宽',
      !!s2 && s2.sameGroup && s2.faceWidth && s2.leftAligned && s2.below && s2.narrowerThanGroup && s2.groupIntact);
    if (s2 && !(s2.sameGroup && s2.faceWidth && s2.leftAligned && s2.below && s2.narrowerThanGroup && s2.groupIntact)) console.log('  ℹ S2 诊断:', JSON.stringify(s2));

    // ── S3 平底跨两列（D 横跨 A+B 平底 → 宽=整面跨度、左=面左缘）──
    const s3 = await cdp.evalJs(helpers + `(function(){
      var A7 = window.createContentCard(); window.moveCardPx(A7, 1100, 900);
      var B7c = window.createContentCard(); window.moveCardPx(B7c, 1280, 900); B7c.style.width = '80px';
      window.mergeCards(B7c, A7, 'right');
      var A7P = posCard(A7), B7cP = posCard(B7c);
      var D7 = window.createContentCard();
      window.moveCardPx(D7, posCard(A7).left + 10, posCard(A7).top + posCard(A7).h + 6);
      window.mergeCards(D7, A7, 'bottom');
      var D7P = posCard(D7);
      var faceSpan = (B7cP.left + B7cP.w) - A7P.left;
      return { sameGroup: D7.dataset.groupId === A7.dataset.groupId,
        faceWidth: Math.abs(D7P.w - faceSpan) < 0.5,
        leftAligned: Math.abs(D7P.left - A7P.left) < 0.5,
        below: Math.abs(D7P.top - (A7P.top + A7P.h)) < 0.5,
        bKept: B7cP.w === 80 };
    })()`);
    ok('S3 平底跨两列：D 横跨 A+B 平底 → 宽=整面跨度（A.l→B.r）、左缘=面左缘、贴平底、B 保 80',
      !!s3 && s3.sameGroup && s3.faceWidth && s3.leftAligned && s3.below && s3.bKept);
    if (s3 && !(s3.sameGroup && s3.faceWidth && s3.leftAligned && s3.below && s3.bKept)) console.log('  ℹ S3 诊断:', JSON.stringify(s3));

    // ── S4 十字四向 ──
    const s4 = await cdp.evalJs(helpers + `(function(){
      var C0 = window.createContentCard(); window.moveCardPx(C0, 800, 500);
      var c0p = posCard(C0);
      var N = window.createContentCard(); window.moveCardPx(N, c0p.left + 10, c0p.top - c0p.h - 6);
      window.mergeCards(N, C0, 'top');
      var S = window.createContentCard(); window.moveCardPx(S, c0p.left + 10, c0p.top + c0p.h + 6);
      window.mergeCards(S, C0, 'bottom');
      var W = window.createContentCard(); window.moveCardPx(W, c0p.left - 90, c0p.top + 10); W.style.width = '80px';
      window.mergeCards(W, C0, 'left');
      var E = window.createContentCard(); window.moveCardPx(E, c0p.left + 190, c0p.top + 10); E.style.width = '80px';
      window.mergeCards(E, C0, 'right');
      var NP = posCard(N), SP = posCard(S), WP = posCard(W), EP = posCard(E), C0P = posCard(C0);
      var g = C0.dataset.groupId;
      var bg = document.querySelector('.grid-group-bg[data-group-id="' + g + '"]');
      return { ids: { c0: C0.dataset.cardId, n: N.dataset.cardId, s: S.dataset.cardId, w: W.dataset.cardId, e: E.dataset.cardId }, g: g,
        allSame: N.dataset.groupId === g && S.dataset.groupId === g && W.dataset.groupId === g && E.dataset.groupId === g,
        nFlush: Math.abs((NP.top + NP.h) - C0P.top) < 0.5 && Math.abs(NP.left - C0P.left) < 0.5,
        sFlush: Math.abs(SP.top - (C0P.top + C0P.h)) < 0.5 && Math.abs(SP.left - C0P.left) < 0.5,
        wFlush: Math.abs((WP.left + WP.w) - C0P.left) < 0.5 && Math.abs(WP.top - C0P.top) < 0.5,
        eFlush: Math.abs(EP.left - (C0P.left + C0P.w)) < 0.5 && Math.abs(EP.top - C0P.top) < 0.5,
        nFace: Math.abs(NP.w - C0P.w) < 0.5, sFace: Math.abs(SP.w - C0P.w) < 0.5,
        wKept: WP.w === 80, eKept: EP.w === 80,
        bgClip: !!(bg && bg.style.clipPath && bg.style.clipPath.indexOf('path(') === 0) };
    })()`);
    ok('S4 十字四向：四臂贴齐中心各边、上下臂面宽=中心宽、左右臂保 80、五卡同组、组背景 clip-path 在场',
      !!s4 && s4.allSame && s4.nFlush && s4.sFlush && s4.wFlush && s4.eFlush && s4.nFace && s4.sFace && s4.wKept && s4.eKept && s4.bgClip);
    if (s4 && !(s4.allSame && s4.nFlush && s4.sFlush && s4.wFlush && s4.eFlush && s4.nFace && s4.sFace && s4.wKept && s4.eKept && s4.bgClip)) console.log('  ℹ S4 诊断:', JSON.stringify(s4));

    // ── S5 组背景多边形（用 S1/S2 的倒 L 组：上排 A+B、下排只 B 下 C → 空角=左下）──
    const s5 = await cdp.evalJs(helpers + `(function(){
      var A = byId('${s1.ids.a}'), B = byId('${s1.ids.b}'), C = byId('${s2.ids.c}');
      var g = A.dataset.groupId;
      var bg = document.querySelector('.grid-group-bg[data-group-id="' + g + '"]');
      if (!bg) return { noBg: true };
      var cvs = document.querySelector('.grid-canvas');
      var cr = cvs.getBoundingClientRect();
      // 空角=左下（A 底与 C 底齐平、C 只在右列 → [A.l, B.l]×[C.t, C.b] 是洞）
      var ax = cr.left + posCard(A).left + 30, ay = cr.top + posCard(C).top + 30;
      var hitHole = document.elementFromPoint(ax, ay);
      // 体内点=pad 环（A 左缘外 7px、A 竖直中段）：该处只有组背景（pointer-events auto、clip 覆盖 pad 环）
      var bx2 = cr.left + posCard(A).left - 7, by2 = cr.top + posCard(A).top + 30;
      var hitBody = document.elementFromPoint(bx2, by2);
      // clip 与 computeGroupOutline 重算自洽（无旋转：直盒并集+四周 PAD 14）
      var mems = Array.from(document.querySelectorAll('.grid-card')).filter(function(c){ return c.dataset.groupId === g; });
      var minX = Infinity, minY = Infinity;
      mems.forEach(function(c){ var l = parseFloat(c.style.left)||0, t = parseFloat(c.style.top)||0; if (l < minX) minX = l; if (t < minY) minY = t; });
      var rects = mems.map(function(c){
        var l = parseFloat(c.style.left)||0, t = parseFloat(c.style.top)||0;
        return { l: l - minX, t: t - minY, r: l + c.offsetWidth - minX + 28, b: t + c.offsetHeight - minY + 28 };
      });
      var outline = window.computeGroupOutline(rects);
      var clip = bg.style.clipPath;
      // 浏览器回读规范化（path("M 0 0 L 14 0 …" 双引号+命令后空格）vs 我们输出（M0 0 L14 0 …）——剥包装+引号、命令字母两侧插空格、token 重组后比较
      var toks = function(s){
        s = String(s);
        if (s.indexOf('path(') === 0) s = s.slice(5);
        if (s.charAt(s.length - 1) === ')') s = s.slice(0, -1);
        s = s.replace(/"/g, '').replace(/'/g, '');
        s = s.replace(/([MLAZ])/g, ' $1 ');
        return s.split(' ').filter(function(t){ return t.length > 0; }).join(' ');
      };
      var cToks = toks(clip), oToks = toks(outline);
      var cArr = cToks.split(' '), oArr = oToks.split(' ');
      var diffAt = -1;
      for (var i = 0; i < Math.max(cArr.length, oArr.length); i++) { if (cArr[i] !== oArr[i]) { diffAt = i; break; } }
      return { holeHitsCanvas: hitHole === cvs || (hitHole && cvs.contains(hitHole) && !bg.contains(hitHole)),
        bodyHitsBg: hitBody === bg || (hitBody && bg.contains(hitBody)),
        clipSelfConsistent: cToks === oToks,
        clipHasArc: cToks.split(' ').indexOf('A') !== -1 && cToks.split(' ').indexOf('L') !== -1,
        diffAt: diffAt, cAt: cArr[diffAt], oAt: oArr[diffAt], cLen: cArr.length, oLen: oArr.length,
        cToks: cToks.slice(0, 260), oToks: oToks.slice(0, 260) };
    })()`);
    ok('S5 组背景多边形：倒 L 空角 elementFromPoint 命中画布（clip 参与命中测试）、体内命中 bg、clip 含 path( 与圆弧、与 computeGroupOutline 重算自洽',
      !!s5 && !s5.noBg && s5.holeHitsCanvas && s5.bodyHitsBg && s5.clipSelfConsistent && s5.clipHasArc);
    if (s5 && !(!s5.noBg && s5.holeHitsCanvas && s5.bodyHitsBg && s5.clipSelfConsistent && s5.clipHasArc)) console.log('  ℹ S5 诊断:', JSON.stringify(s5));

    // ── 可信输入 helper（单卡选中/手柄拖，同 group-resize 电池口径）──
    const cen = (idVar) => cdp.evalJs("(function(){ var el = byId('" + idVar + "'); var r = el.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()");
    const singleSelId = async (id) => {
      // v10.28.34.2 轮：建卡/草稿恢复渲染未落定时双击会配对失败（S6 偶发红实证——
      // 配对失败保持整组选中 → 拖手柄误走整组缩放路径斜对 C 被缩放动；400ms 安定
      // 睡眠不够 → 改收敛重试：双击后验证 gs:1/sel:1，未配对最多重试 4 次；若误弹
      // 图源则 Escape 关闭再试，同 group-resize 电池 singleSel 修法）
      await sleep(400);
      const c = JSON.parse(await cen(id));
      for (let attempt = 0; attempt < 4; attempt++) {
        await cdp.trustedClick(c.x, c.y, 1); await sleep(600); await cdp.trustedClick(c.x, c.y, 1);
        await sleep(350);
        const st = JSON.parse(await cdp.evalJs("JSON.stringify({ gs: document.querySelectorAll('.grid-card.group-single').length, sel: document.querySelectorAll('.grid-card.selected').length, modal: !!(document.getElementById('modalBackdrop') && document.getElementById('modalBackdrop').classList.contains('active')) })"));
        if (st.gs === 1 && st.sel === 1) return;
        if (st.modal) {
          await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
          await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
          await sleep(300);
        }
      }
    };
    const dragH = async (dir, dx, dy) => {
      const h = JSON.parse(await cdp.evalJs("(function(){ var h = document.querySelector('.resize-handle[data-dir=\"" + dir + "\"]'); if (!h) return 'null'; var r = h.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
      if (h === 'null') throw new Error('no handle ' + dir);
      await cdp.mouse('mousePressed', h.x, h.y, 1);
      for (let i = 1; i <= 4; i++) await cdp.mouse('mouseMoved', h.x + dx * i / 4, h.y + dy * i / 4);
      await cdp.mouse('mouseReleased', h.x + dx, h.y + dy, 1);
      await sleep(300);
    };

    // ── S6 墙让位（倒 L 组：A 东扩 → B flush A、台阶斜对 C 完全不动；另组 A2 南扩 → C2 flush）──
    const s6aPre = await cdp.evalJs(helpers + `(function(){
      var A = byId('${s1.ids.a}'), B = byId('${s1.ids.b}'), C = byId('${s2.ids.c}');
      var AP = posCard(A), BP = posCard(B), CP = posCard(C);
      return { a: AP, b: BP, c: CP, bL: BP.left };
    })()`);
    await singleSelId(s1.ids.a);
    await dragH('e', 60, 0);
    const s6a = await cdp.evalJs(helpers + `(function(){
      var A = byId('${s1.ids.a}'), B = byId('${s1.ids.b}'), C = byId('${s2.ids.c}');
      var AP = posCard(A), BP = posCard(B), CP = posCard(C);
      return { gap: BP.left - (AP.left + AP.w), bMoved: BP.left - ${s6aPre.bL},
        cStill: CP.left === ${s6aPre.c.left} && CP.top === ${s6aPre.c.top} && CP.w === ${s6aPre.c.w},
        sameGroup: A.dataset.groupId === B.dataset.groupId && C.dataset.groupId === A.dataset.groupId };
    })()`);
    ok('S6 墙让位①：倒 L 组 A 东扩 +60 → B 让位 flush A（右移 >40）、台阶斜对 C 完全不动（垂直重叠守卫）',
      !!s6a && Math.abs(s6a.gap) <= 1 && s6a.bMoved > 40 && s6a.cStill && s6a.sameGroup);
    if (s6a && !(Math.abs(s6a.gap) <= 1 && s6a.bMoved > 40 && s6a.cStill && s6a.sameGroup)) console.log('  ℹ S6a 诊断:', JSON.stringify(s6a));

    const s6bSetup = await cdp.evalJs(helpers + `(function(){
      var A2 = window.createFlagCard(); window.moveCardPx(A2, 700, 800);
      var C2 = window.createContentCard(); window.moveCardPx(C2, posCard(A2).left + 10, posCard(A2).top + posCard(A2).h + 6);
      window.mergeCards(C2, A2, 'bottom');
      return { ids: { a2: A2.dataset.cardId, c2: C2.dataset.cardId },
        sameGroup: A2.dataset.groupId === C2.dataset.groupId };
    })()`);
    await singleSelId(s6bSetup.ids.a2);
    await dragH('s', 0, 45);
    const s6b = await cdp.evalJs(helpers + `(function(){
      var A2 = byId('${s6bSetup.ids.a2}'), C2 = byId('${s6bSetup.ids.c2}');
      var A2P = posCard(A2), C2P = posCard(C2);
      return { gap: C2P.top - (A2P.top + A2P.h),
        sameGroup: A2.dataset.groupId === C2.dataset.groupId };
    })()`);
    ok('S6 墙让位②：A2 南扩 +45 → 正下方 C2 让位 flush（gap≈0）',
      !!s6bSetup.sameGroup && !!s6b && Math.abs(s6b.gap) <= 1 && s6b.sameGroup);
    if (s6b && !(Math.abs(s6b.gap) <= 1 && s6b.sameGroup)) console.log('  ℹ S6b 诊断:', JSON.stringify(s6b));

    // ── S7 整组缩放保形（十字 se 柄 +40,+30 → 四臂仍贴中心）──
    const s7pre = await cdp.evalJs(helpers + `(function(){
      var C0 = byId('${s4.ids.c0}'), N = byId('${s4.ids.n}'), S = byId('${s4.ids.s}'), W = byId('${s4.ids.w}'), E = byId('${s4.ids.e}');
      window.selectCard(C0); // 单击组内成员=恒选整组（single 缺省 falsy）→ 手柄锚组包围盒
      return { c0: posCard(C0), n: posCard(N), s: posCard(S), w: posCard(W), e: posCard(E),
        gid: C0.dataset.groupId, single: !!window.__dbgS7single };
    })()`);
    const s7h = JSON.parse(await cdp.evalJs(`(function(){
      var h = document.querySelector('.resize-handle[data-dir="se"]');
      if (!h) return JSON.stringify({ none: 1 });
      var r = h.getBoundingClientRect();
      var hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, disp: h.style.display,
        hit: hit ? (hit.tagName + '.' + String(hit.className).slice(0, 70)) : null });
    })()`));
    console.log('  ℹ S7 pre:', JSON.stringify(s7pre));
    console.log('  ℹ S7 handle:', JSON.stringify(s7h));
    await sleep(200);
    const s7trace = [];
    {
      const h = s7h;
      await cdp.mouse('mousePressed', h.x, h.y, 1);
      for (let i = 1; i <= 4; i++) {
        await cdp.mouse('mouseMoved', h.x + 40 * i / 4, h.y + 30 * i / 4);
        const frame = await cdp.evalJs(helpers + `(function(){
          var C0 = byId('${s4.ids.c0}'), N = byId('${s4.ids.n}'), S = byId('${s4.ids.s}'), W = byId('${s4.ids.w}'), E = byId('${s4.ids.e}');
          return { c0: posCard(C0), n: posCard(N), s: posCard(S), w: posCard(W), e: posCard(E) };
        })()`);
        s7trace.push(frame);
      }
      await cdp.mouse('mouseReleased', h.x + 40, h.y + 30, 1);
      await sleep(300);
    }
    const s7 = await cdp.evalJs(helpers + `(function(){
      var C0 = byId('${s4.ids.c0}'), N = byId('${s4.ids.n}'), S = byId('${s4.ids.s}'), W = byId('${s4.ids.w}'), E = byId('${s4.ids.e}');
      var C0P = posCard(C0), NP = posCard(N), SP = posCard(S), WP = posCard(W), EP = posCard(E);
      var g = C0.dataset.groupId;
      var bg = document.querySelector('.grid-group-bg[data-group-id="' + g + '"]');
      // 位置=框内连续比例缩放、尺寸=整格量化（既有口径）→ 齐平边界允许 ≤半格
      // 间隙；本场景真正防的回归=级联下推（臂被 y 链推落一整卡高，S7 实况
      // e 掉到 594.667/s 掉到 680.667）
      return { sameGroup: N.dataset.groupId === g && S.dataset.groupId === g && W.dataset.groupId === g && E.dataset.groupId === g,
        eNoCascade: Math.abs(EP.top - C0P.top) <= 0.5, wNoCascade: Math.abs(WP.top - C0P.top) <= 0.5,
        nAtTop: Math.abs(NP.top - ${JSON.stringify(s7pre.n.top)}) <= 0.5,
        sBelow: SP.top >= C0P.top + C0P.h - 0.5 && SP.top < C0P.top + C0P.h + 11,
        eFlush: Math.abs(EP.left - (C0P.left + C0P.w)) <= 0.5,
        grew: C0P.w > ${JSON.stringify(s7pre.c0.w)} + 10,
        bg: !!bg, dbg: { c0: C0P, n: NP, s: SP, w: WP, e: EP } };
    })()`);
    console.log('  ℹ S7 trace:', JSON.stringify(s7trace));
    ok('S7 整组缩放保形：十字 se 柄 +40,+30 → 五卡同组、臂不级联下推（e/w 顶齐平中心顶、s 在中心下方不落一整卡）、e 贴齐、中心变宽、背景在',
      !!s7 && s7.sameGroup && s7.eNoCascade && s7.wNoCascade && s7.nAtTop && s7.sBelow && s7.eFlush && s7.grew && s7.bg);
    if (s7 && !(s7.sameGroup && s7.eNoCascade && s7.wNoCascade && s7.nAtTop && s7.sBelow && s7.eFlush && s7.grew && s7.bg)) console.log('  ℹ S7 诊断:', JSON.stringify(s7));

    // ── S8 十字草稿往返（逐卡几何+gid 零差异）──
    await cdp.evalJs("localStorage.removeItem('slati_fluidcanvas_draft'); window.saveDraft(); true");
    const snapJson = await cdp.evalJs(helpers + `(function(){
      window.saveDraft();
      var snap = {};
      document.querySelectorAll('.grid-card').forEach(function(c){ snap[c.dataset.cardId] = posCard(c); snap[c.dataset.cardId].g = c.dataset.groupId || ''; });
      // 破坏现场：东臂挪走
      var E = byId('${s4.ids.e}'); window.moveCardPx(E, 50, 50);
      window.loadDraft();
      return JSON.stringify(snap);
    })()`);
    await sleep(300);
    const s8 = await cdp.evalJs(helpers + `(function(){
      var snap = JSON.parse(${JSON.stringify(snapJson)});
      var allSame = true;
      Object.keys(snap).forEach(function(id){
        var el = byId(id); if (!el) { allSame = false; return; }
        var p = posCard(el), s = snap[id];
        if (p.left !== s.left || p.top !== s.top || p.w !== s.w || p.h !== s.h || (el.dataset.groupId || '') !== s.g) allSame = false;
      });
      return { allSame: allSame, n: Object.keys(snap).length };
    })()`);
    ok('S8 十字草稿往返：破坏东臂位置后 loadDraft → 全卡逐卡几何+gid 零差异（保形不塌）',
      !!s8 && s8.allSame && s8.n >= 11);
    if (s8 && !(s8.allSame && s8.n >= 11)) console.log('  ℹ S8 诊断:', JSON.stringify(s8));

    // ── S9 拆分保形（拆出东臂 → gid 清+几何不动、余 4 臂组完好）──
    const s9 = await cdp.evalJs(helpers + `(function(){
      var E = byId('${s4.ids.e}'), C0 = byId('${s4.ids.c0}'), N = byId('${s4.ids.n}'), S = byId('${s4.ids.s}'), W = byId('${s4.ids.w}');
      var e0 = posCard(E), others0 = [posCard(N), posCard(S), posCard(W), posCard(C0)];
      var g = C0.dataset.groupId;
      window.splitCardFromGroup(E);
      var e1 = posCard(E);
      var intact = e1.left === e0.left && e1.top === e0.top && e1.w === e0.w && e1.h === e0.h;
      var others = [posCard(N), posCard(S), posCard(W), posCard(C0)];
      var othersSame = others.every(function(p, i){ return p.left === others0[i].left && p.top === others0[i].top && p.w === others0[i].w && p.h === others0[i].h; });
      return { cleared: !E.dataset.groupId, intact: intact,
        groupAlive: N.dataset.groupId === g && S.dataset.groupId === g && W.dataset.groupId === g && C0.dataset.groupId === g,
        othersSame: othersSame };
    })()`);
    ok('S9 拆分保形：拆出东臂 → gid 清+几何不动、余 4 臂同组且几何不动',
      !!s9 && s9.cleared && s9.intact && s9.groupAlive && s9.othersSame);
    if (s9 && !(s9.cleared && s9.intact && s9.groupAlive && s9.othersSame)) console.log('  ℹ S9 诊断:', JSON.stringify(s9));

    ok('B 版本徽章：右下角 badge 渲染 FC v10.28.34.2',
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
