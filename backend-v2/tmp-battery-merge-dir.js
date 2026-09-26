// tmp-battery-merge-dir.js — v0.2.30.4 吸合方向感验证 + v0.2.36.0 自由形状合并组验证（2026-09-12）
// 背景①：用户「能不能判定一下方向，如果卡片是在左侧合并后应该就是在左侧而不是变成跑到下方」。
// 真身=mergeCards 等宽归一后不按吸合方向重新落位：窄卡从左/右并入既有组时被拉成组宽，
// 右缘越过目标竖边 → reflowGroup 按水平重叠把全组压成一列叠在下方。
// 背景②（v0.2.36.0）：用户「左/右侧合并不会被拉长而是保持一样的大小合并；上/下方合并只根据
// 动到的那一面的最宽值调整大小（倒 L 下方只拿那一面的最宽值）；可以是 L 型、十字型」。
// 真身=mergeCards 左右并入等宽归一（双方都被拉成目标宽）+ 上下并入整组宽（rowInGroup 行语义）；
// 修法=左右并入完全不做宽度归一（各保原尺寸贴目标侧边+顶对齐）；上下并入=接触面模型（对边 ≤12px
// 且 x 相交的成员=面，宽=面并集跨度）；行卡机制（rowInGroup）整体退役、reflowGroup 保形。
// 断言组：
//   F1 静态：findMergeSnap 返回 side、mergeCards(card, target, side)、调用点传 recheck.side；
//   F2 静态：版本 v0.2.36.0 / v10.28.26.0 + buildDraft 链 v10.28.20.4 条目仍在；
//   F3 静态：自由形状静态——mergeCards 无 rowInGroup 写入+左右分支无归一化、reflowGroup 保形、
//     computeGroupOutline+drop-shadow 栈、退役函数全删（alignGroupTops/snapshotGroupRows/groupColumns）；
//   S1 首合并左并入：B3 保 80px 窄宽（不归一）+ 左右两列（B3.right ≤ A3.left、顶齐）；
//   S3 左并入既有组（拖卡窄于组宽）：B 成左列且保窄宽、组完好（A2 原位堆叠）；
//   S4 右并入既有组：B6 成右列（B6.left = A2.right）且保窄宽、组完好；
//   S5 上并入既有组（v10.28.26 面语义）：B7 宽=接触面 A 宽（非整组宽）、贴组顶、无 rowInGroup；
//   S2 左侧下方带（下意图胜出）：B4.top = A4.bottom + 同列（方向按吸合边，不是按视觉侧）；
//   S6 用户场景：2列组下方并入 x 只叠 A5 → C5 宽=A5 面宽贴组底、A5/B5 尺寸零拉伸（右并入不归一）；
//   S6b 倒L台阶：C6 从下并入 x 只叠 B5（台阶）→ C6 宽=B5 宽、x 对齐 B5（只拿那一面的最宽值）；
//   S6c 平底跨两列：D7 从下并入横跨 A5+B5 平底 → D7 宽=整面宽（A.l→B.r）；
//   S7 草稿往返：L 组几何逐卡一致、无 rowInGroup 字段；
//   S8 重排幂等：reflowGroup 再跑几何不动（保形）；S9 拆分保形+侧并入回组保持原尺寸；
//   R1 远距不吸合回归（v0.2.30.1 守卫）；R2 拖卡高亮恰好 1 个 .cell-hl（一体式回归）；
//   Z 零 console error。
// 跑法：node backend-v2/tmp-battery-merge-dir.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4600 + Math.floor(Math.random() * 300);
const CDP_PORT = 5700 + Math.floor(Math.random() * 300);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-mergedir-' + Date.now());

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
        this.errs.push(JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
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

  // ── F1-F2 静态 ──
  const fce = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  ok('F1 静态：findMergeSnap 返回 side + mergeCards(card, target, side) + 调用点传 recheck.side',
    fce.indexOf('side: p[3]') !== -1 &&
    fce.indexOf('function mergeCards(card, target, side)') !== -1 &&
    fce.indexOf('recheck.side') !== -1);
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('F2 静态：当前版本 v0.2.45.2 + v10.28.34.2（2026-09-14 贴齐缝修复轮复跑口径）+ buildDraft 链 v10.28.20.4 条目仍在',
    sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.45.2';") !== -1 &&
    sconf.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.34.2';") !== -1 &&
    fce.indexOf('v10.28.20.4 adds NO new fields (吸合方向感') !== -1);
  ok('F3 静态：自由形状——mergeCards 无 rowInGroup 写入+左右分支无归一化、reflowGroup 保形、computeGroupOutline/drop-shadow 栈、行卡机制整体退役（退役函数全删、草稿无 rowInGroup 字段）',
    fce.indexOf("card.dataset.rowInGroup = '1';") === -1 &&
    fce.indexOf('function alignGroupTops') === -1 &&
    fce.indexOf('function snapshotGroupRows') === -1 &&
    fce.indexOf('function pushGroupRows') === -1 &&
    fce.indexOf('function reassertRowWidths') === -1 &&
    fce.indexOf('function groupColumns') === -1 &&
    fce.indexOf("entry.rowInGroup = '1';") === -1 &&
    fce.indexOf("cData.rowInGroup === '1'") === -1 &&
    fce.indexOf('function computeGroupOutline(rects)') !== -1 &&
    fce.indexOf('window.computeGroupOutline = computeGroupOutline;') !== -1 &&
    fce.indexOf("bg.style.clipPath = \"path('\" + outline + \"')\";") !== -1 &&
    fce.indexOf('drop-shadow(1px 0 0 var(--divider-line))') !== -1 &&
    fce.indexOf('function reflowGroup(g) {') !== -1 &&
    fce.indexOf('function mergeCards(card, target, side)') !== -1 &&
    fce.indexOf('normalizeCardWidth(card, Math.max(1, fR - fL))') !== -1);

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

    // 铺卡 + 建组（A2 拖到 A 下方吸合成组）+ 各方向目标卡
    const setup = await cdp.evalJs(`(function(){
      var A = window.createFlagCard(); window.moveCardPx(A, 300, 80);
      var A2 = window.createContentCard(); window.moveCardPx(A2, 300, 80 + A.offsetHeight + 60);
      var B = window.createContentCard(); window.moveCardPx(B, 80, 80); B.style.width = '80px';
      var A3 = window.createFlagCard(); window.moveCardPx(A3, 900, 80);
      var B3 = window.createContentCard(); window.moveCardPx(B3, 700, 80); B3.style.width = '80px';
      var A4 = window.createFlagCard(); window.moveCardPx(A4, 1200, 500);
      var B4 = window.createContentCard(); window.moveCardPx(B4, 400, 900); B4.style.width = '80px';
      var B6 = window.createContentCard(); window.moveCardPx(B6, 120, 500); B6.style.width = '80px';
      var B7 = window.createContentCard(); window.moveCardPx(B7, 60, 1100); B7.style.width = '80px';
      var B8 = window.createContentCard(); window.moveCardPx(B8, 120, 1200);
      return { a: A.dataset.cardId, a2: A2.dataset.cardId, b: B.dataset.cardId,
        a3: A3.dataset.cardId, b3: B3.dataset.cardId, a4: A4.dataset.cardId, b4: B4.dataset.cardId,
        b6: B6.dataset.cardId, b7: B7.dataset.cardId, b8: B8.dataset.cardId };
    })()`);
    console.log('  ℹ 铺卡完成:', JSON.stringify(setup));
    await sleep(300);

    const helpers = "function byId(id){ return Array.from(document.querySelectorAll('.grid-card')).find(function(c){ return c.dataset.cardId === id; }); }" +
      "function posCard(el){ return { left: parseFloat(el.style.left) || 0, top: parseFloat(el.style.top) || 0, w: el.offsetWidth, h: el.offsetHeight }; }" +
      "function dragCard(id, dropX, dropY) { return (async function(){ var el = byId(id); " +
      "  var canvas = document.querySelector('.grid-canvas'); var rect = canvas.getBoundingClientRect(); " +
      "  var p = posCard(el); " +
      "  el.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: rect.left + p.left + 6, clientY: rect.top + p.top + 6, bubbles: true, cancelable: true })); " +
      "  var cx = rect.left + dropX, cy = rect.top + dropY; " +
      "  document.dispatchEvent(new MouseEvent('mousemove', { clientX: cx, clientY: cy, bubbles: true, cancelable: true })); " +
      "  document.dispatchEvent(new MouseEvent('mousemove', { clientX: cx, clientY: cy, bubbles: true, cancelable: true })); " +
      "  var hl = 0, hlT0 = Date.now(); " +
      "  while (Date.now() - hlT0 < 1200 && hl === 0) { await new Promise(function(r){ setTimeout(r, 50); }); hl = document.querySelectorAll('.cell-hl').length; } " +
      "  document.dispatchEvent(new MouseEvent('mouseup', { clientX: cx, clientY: cy, bubbles: true, cancelable: true })); " +
      "  await new Promise(function(r){ setTimeout(r, 400); }); " +
      "  return { hl: hl, at: posCard(byId(id)) }; })(); }";

    // ── 建组：A2 拖到 A 下方吸合 ──
    const mkGroup = await cdp.evalJs(helpers + `(async function(){
      var A = byId('${setup.a}');
      var dropY = posCard(A).top + posCard(A).h + 6;
      var r = await dragCard('${setup.a2}', posCard(A).left + 20, dropY);
      return { r: r, sameGroup: byId('${setup.a2}').dataset.groupId && byId('${setup.a2}').dataset.groupId === A.dataset.groupId };
    })()`);
    ok('S0 建组前置：A2 拖到 A 下方吸合成组', !!mkGroup && mkGroup.sameGroup);
    console.log('  ℹ S0 建组:', JSON.stringify(mkGroup));

    // ── S3 左并入既有组（拖卡窄于组宽）──
    const s3 = await cdp.evalJs(helpers + `(async function(){
      var A = byId('${setup.a}'), A2 = byId('${setup.a2}'), B = byId('${setup.b}');
      var g = A.dataset.groupId;
      var preW = { a: posCard(A).w, a2: posCard(A2).w, b: posCard(B).w };
      var dropX = posCard(A).left - posCard(B).w - 6;
      var r = await dragCard('${setup.b}', dropX, posCard(A).top + 10);
      var BP = posCard(B), AP = posCard(A), A2P = posCard(A2);
      return {
        r: r, preW: preW,
        narrower: preW.b < preW.a,
        widthKept: BP.w === preW.b,
        sameGroup: B.dataset.groupId === g,
        leftCol: BP.left < AP.left && BP.left + BP.w <= AP.left + 0.5,
        topsAligned: Math.abs(BP.top - AP.top) < 1,
        groupIntact: A2P.left === AP.left && Math.abs(A2P.top - (AP.top + AP.h)) < 1
      };
    })()`);
    ok('S3 左并入既有组（窄卡）：B 成左列（flush 无重叠）且保窄宽（v10.28.26 不做宽度归一）+ 列顶齐 + 组完好（A2 原位堆叠）',
      !!s3 && s3.narrower && s3.widthKept && s3.sameGroup && s3.leftCol && s3.topsAligned && s3.groupIntact);
    if (s3 && !(s3.narrower && s3.sameGroup && s3.leftCol && s3.topsAligned && s3.groupIntact)) console.log('  ℹ S3 诊断:', JSON.stringify(s3));
    ok('R2 回归：拖卡过程覆盖高亮仍恰好 1 个 .cell-hl（一体式高亮）', !!s3 && s3.r && s3.r.hl === 1);

    // ── S1 首合并左并入（等宽归一后仍左右两列）──
    const s1 = await cdp.evalJs(helpers + `(async function(){
      var A3 = byId('${setup.a3}'), B3 = byId('${setup.b3}');
      var dropX = posCard(A3).left - posCard(B3).w - 6;
      await dragCard('${setup.b3}', dropX, posCard(A3).top + 10);
      var BP = posCard(B3), AP = posCard(A3);
      return { sameGroup: B3.dataset.groupId && B3.dataset.groupId === A3.dataset.groupId,
        leftCol: BP.left < AP.left && BP.left + BP.w <= AP.left + 0.5,
        topsAligned: Math.abs(BP.top - AP.top) < 1 };
    })()`);
    ok('S1 首合并左并入：归一后仍左右两列（B3.right ≤ A3.left）+ 列顶齐',
      !!s1 && s1.sameGroup && s1.leftCol && s1.topsAligned);
    if (s1 && !(s1.sameGroup && s1.leftCol && s1.topsAligned)) console.log('  ℹ S1 诊断:', JSON.stringify(s1));

    // ── S4 右并入既有组 ──
    const s4 = await cdp.evalJs(helpers + `(async function(){
      var A = byId('${setup.a}'), A2 = byId('${setup.a2}'), B6 = byId('${setup.b6}');
      var g = A.dataset.groupId;
      var preW6 = posCard(B6).w;
      var dropX = posCard(A2).left + posCard(A2).w + 6;
      await dragCard('${setup.b6}', dropX, posCard(A2).top + 10);
      var BP = posCard(B6), AP = posCard(A), A2P = posCard(A2);
      return { sameGroup: B6.dataset.groupId === g,
        widthKept: BP.w === preW6,
        rightCol: BP.left >= A2P.left + A2P.w - 0.5,
        groupIntact: A2P.left === AP.left && Math.abs(A2P.top - (AP.top + AP.h)) < 1 };
    })()`);
    ok('S4 右并入既有组：B6 成右列（left = A2.right）且保窄宽 + 组完好',
      !!s4 && s4.sameGroup && s4.widthKept && s4.rightCol && s4.groupIntact);
    if (s4 && !(s4.sameGroup && s4.rightCol && s4.groupIntact)) console.log('  ℹ S4 诊断:', JSON.stringify(s4));

    // ── S5 上并入既有组（v10.28.26 面语义）──
    const s5 = await cdp.evalJs(helpers + `(async function(){
      var A = byId('${setup.a}'), B7 = byId('${setup.b7}');
      var g = A.dataset.groupId;
      var dropY = posCard(A).top - posCard(B7).h - 6;
      await dragCard('${setup.b7}', posCard(A).left + 20, dropY);
      var BP = posCard(B7), AP = posCard(A);
      return { sameGroup: B7.dataset.groupId === g,
        faceWidth: BP.w === AP.w,
        leftAligned: Math.abs(BP.left - AP.left) < 0.5,
        above: Math.abs(BP.top + BP.h - AP.top) < 1,
        noRow: B7.dataset.rowInGroup !== '1' };
    })()`);
    ok('S5 上并入既有组（v10.28.26 面语义）：B7 宽=接触面 A 宽（非整组宽）、贴组顶、无 rowInGroup',
      !!s5 && s5.sameGroup && s5.faceWidth && s5.leftAligned && s5.above && s5.noRow);
    if (s5 && !(s5.sameGroup && s5.faceWidth && s5.leftAligned && s5.above && s5.noRow)) console.log('  ℹ S5 诊断:', JSON.stringify(s5));

    // ── S2 左侧下方带（下意图胜出：吸合方向按吸合边）──
    const s2 = await cdp.evalJs(helpers + `(async function(){
      var A4 = byId('${setup.a4}'), B4 = byId('${setup.b4}');
      var dropX = posCard(A4).left - posCard(B4).w + 40;
      var dropY = posCard(A4).top + posCard(A4).h - 6;
      await dragCard('${setup.b4}', dropX, dropY);
      var BP = posCard(B4), AP = posCard(A4);
      return { sameGroup: B4.dataset.groupId && B4.dataset.groupId === A4.dataset.groupId,
        below: Math.abs(BP.top - (AP.top + AP.h)) < 1,
        sameCol: Math.abs(BP.left - AP.left) < 0.5 };
    })()`);
    ok('S2 左侧下方带（下意图胜出）：B4.top = A4.bottom + 同列（贴下边而非左侧）',
      !!s2 && s2.sameGroup && s2.below && s2.sameCol);
    if (s2 && !(s2.sameGroup && s2.below)) console.log('  ℹ S2 诊断:', JSON.stringify(s2));

    // ── R1 远距不吸合回归（v0.2.30.1 垂直重叠守卫）──
    const r1 = await cdp.evalJs(helpers + `(async function(){
      var before = Array.from(document.querySelectorAll('.grid-card')).map(function(c){
        return { id: c.dataset.cardId, x: posCard(c).left, y: posCard(c).top, g: c.dataset.groupId || '' };
      });
      await dragCard('${setup.b8}', 60, 1200);
      var B8 = byId('${setup.b8}');
      var probe = window.findMergeSnap(B8, posCard(B8).left, posCard(B8).top);
      return { g: B8.dataset.groupId || '', at: posCard(B8), before: before,
        probe: probe ? { d: probe.d, axis: probe.axis, tgt: probe.target.dataset.cardId } : null };
    })()`);
    ok('R1 回归：远距落点（60,1200）不吸合不建组', !!r1 && r1.g === '');
    if (!r1 || r1.g !== '') console.log('  ℹ R1 诊断:', JSON.stringify(r1));

    // ── S6 用户场景（v10.28.26）：2列组 + 下方并入（x 只叠 A5）→ 面宽=A5 宽贴组底、原列零拉伸 ──
    const s6 = await cdp.evalJs(helpers + `(async function(){
      var A5 = window.createFlagCard(); window.moveCardPx(A5, 1400, 700);
      var B5 = window.createContentCard(); window.moveCardPx(B5, 1700, 700);
      var C5 = window.createContentCard(); window.moveCardPx(C5, 1450, 1000);
      await new Promise(function(r){ setTimeout(r, 200); });
      var ids = { a5: A5.dataset.cardId, b5: B5.dataset.cardId, c5: C5.dataset.cardId };
      // B5 从右并入 A5 → 2列组（v10.28.26：B5 保原尺寸 174、不归一）
      await dragCard(ids.b5, posCard(A5).left + posCard(A5).w + 6, posCard(A5).top + 10);
      var g = A5.dataset.groupId;
      var sizeBefore = { a5: { w: posCard(A5).w, h: posCard(A5).h }, b5: { w: posCard(B5).w, h: posCard(B5).h } };
      // C5 从下方拖入、x 只叠 A5 → 面=[A5]（旧行为=整宽成行；新行为=那一面的最宽值）
      await dragCard(ids.c5, posCard(A5).left + 30, posCard(A5).top + posCard(A5).h + 6);
      var A5P = posCard(A5), B5P = posCard(B5), C5P = posCard(C5);
      return { ids: ids, group: g,
        sameGroup: C5.dataset.groupId === g,
        noRow: C5.dataset.rowInGroup !== '1',
        faceWidth: Math.abs(C5P.w - A5P.w) < 0.5,
        leftAligned: Math.abs(C5P.left - A5P.left) < 0.5,
        noFill: A5P.w === sizeBefore.a5.w && A5P.h === sizeBefore.a5.h && B5P.w === sizeBefore.b5.w && B5P.h === sizeBefore.b5.h,
        below: Math.abs(C5P.top - (A5P.top + A5P.h)) < 1,
        groupIntact: Math.abs(B5P.top - A5P.top) < 0.5 };
    })()`);
    ok('S6 用户场景：2列组下方并入（x 只叠 A5）→ C5 宽=A5 面宽贴组底 + A5/B5 尺寸零拉伸 + 组完好 + 无行标记',
      !!s6 && s6.sameGroup && s6.noRow && s6.faceWidth && s6.leftAligned && s6.noFill && s6.below && s6.groupIntact);
    if (s6 && !(s6.sameGroup && s6.noRow && s6.faceWidth && s6.leftAligned && s6.noFill && s6.below && s6.groupIntact)) console.log('  ℹ S6 诊断:', JSON.stringify(s6));

    // ── S6b 倒L台阶（v10.28.26 用户场景②）：独立倒 L 组（A 长旗卡+短 B 缩进），C6 从下并入 x 只叠 B → 宽=B 宽、x 对齐 B ──
    const s6b = await cdp.evalJs(helpers + `(async function(){
      var A6 = window.createFlagCard(); window.moveCardPx(A6, 1900, 700);
      var B6 = window.createContentCard(); window.moveCardPx(B6, 2080, 700); B6.style.width = '80px';
      await new Promise(function(r){ setTimeout(r, 200); });
      await dragCard(B6.dataset.cardId, posCard(A6).left + posCard(A6).w + 6, posCard(A6).top + 10); // 右并入 A6（保 80）
      var g = A6.dataset.groupId;
      var C6 = window.createContentCard(); window.moveCardPx(C6, 1900, 1100);
      await new Promise(function(r){ setTimeout(r, 200); });
      await dragCard(C6.dataset.cardId, posCard(B6).left + 10, posCard(B6).top + posCard(B6).h + 6); // 从下并入 x 只叠 B6（A6 底低 22 差 >12 不在面）
      var C6P = posCard(C6), B6P = posCard(B6), A6P = posCard(A6);
      return { ids: { a6: A6.dataset.cardId, b6: B6.dataset.cardId, c6: C6.dataset.cardId },
        sameGroup: C6.dataset.groupId === g,
        faceWidth: Math.abs(C6P.w - B6P.w) < 0.5,
        leftAligned: Math.abs(C6P.left - B6P.left) < 0.5,
        below: Math.abs(C6P.top - (B6P.top + B6P.h)) < 1,
        narrowerThanGroup: C6P.w < A6P.w }; // 面=台阶那一面，非整组最宽
    })()`);
    ok('S6b 倒L台阶：C6 从下并入 x 只叠 B6 → 宽=B6 宽（只拿那一面的最宽值）、x 对齐 B6、贴 B6 底、窄于组最宽',
      !!s6b && s6b.sameGroup && s6b.faceWidth && s6b.leftAligned && s6b.below && s6b.narrowerThanGroup);
    if (s6b && !(s6b.sameGroup && s6b.faceWidth && s6b.leftAligned && s6b.below && s6b.narrowerThanGroup)) console.log('  ℹ S6b 诊断:', JSON.stringify(s6b));

    // ── S6c 平底跨两列（v10.28.26 面语义）：D7 从下并入横跨 A7+B7 平底 → 宽=整面宽 ──
    const s6c = await cdp.evalJs(helpers + `(async function(){
      var A7 = window.createContentCard(); window.moveCardPx(A7, 1600, 1300);
      var B7c = window.createContentCard(); window.moveCardPx(B7c, 1780, 1300); B7c.style.width = '80px';
      var D7 = window.createContentCard(); window.moveCardPx(D7, 1610, 1500);
      await new Promise(function(r){ setTimeout(r, 200); });
      await dragCard(B7c.dataset.cardId, posCard(A7).left + posCard(A7).w + 6, posCard(A7).top + 10);
      var A7P = posCard(A7), B7cP = posCard(B7c);
      // D7 拖到平底正下方、x 横跨 A7+B7c → 面=[A7,B7c]
      await dragCard(D7.dataset.cardId, posCard(A7).left + 10, posCard(A7).top + posCard(A7).h + 6);
      var D7P = posCard(D7);
      var faceSpan = (B7cP.left + B7cP.w) - A7P.left;
      return { sameGroup: D7.dataset.groupId === A7.dataset.groupId,
        faceWidth: Math.abs(D7P.w - faceSpan) < 0.5,
        leftAligned: Math.abs(D7P.left - A7P.left) < 0.5,
        below: Math.abs(D7P.top - (A7P.top + A7P.h)) < 1 };
    })()`);
    ok('S6c 平底跨两列：D7 从下并入横跨 A7+B7 平底 → 宽=整面宽（A.l→B.r）、左缘=面左缘、贴平底',
      !!s6c && s6c.sameGroup && s6c.faceWidth && s6c.leftAligned && s6c.below);
    if (s6c && !(s6c.sameGroup && s6c.faceWidth && s6c.leftAligned && s6c.below)) console.log('  ℹ S6c 诊断:', JSON.stringify(s6c));

    // ── S7 草稿往返（v10.28.26）：L/平底组逐卡几何一致、草稿无 rowInGroup 字段 ──
    const s7 = await cdp.evalJs(helpers + `(async function(){
      window.saveDraft();
      var raw = localStorage.getItem('slati_fluidcanvas_draft');
      var draft = JSON.parse(raw);
      var cards = draft.cards || [];
      var entry = cards.filter(function(c){ return c.id === '${s6b.ids.c6}'; })[0];
      var noRowField = !(entry && entry.rowInGroup);
      var hasRowAny = cards.some(function(c){ return c.rowInGroup; });
      // 几何快照（全卡）
      var snap = {};
      document.querySelectorAll('.grid-card').forEach(function(c){ snap[c.dataset.cardId] = posCard(c); });
      // 破坏现场：C6 挪走 → loadDraft 应逐卡还原几何（保形，不 reflow 塌形）
      var c6old = byId('${s6b.ids.c6}');
      c6old.style.left = '50px'; c6old.style.top = '50px';
      window.loadDraft();
      await new Promise(function(r){ setTimeout(r, 300); });
      var allSame = true;
      Object.keys(snap).forEach(function(id){
        var el = byId(id); if (!el) { allSame = false; return; }
        var p = posCard(el), s = snap[id];
        if (p.left !== s.left || p.top !== s.top || p.w !== s.w || p.h !== s.h) allSame = false;
      });
      return { noRowField: noRowField, noRowAny: !hasRowAny, allSame: allSame,
        n: Object.keys(snap).length };
    })()`);
    ok('S7 草稿往返：草稿无 rowInGroup 字段、破坏位置后 loadDraft 逐卡几何零差异（保形不塌）',
      !!s7 && s7.noRowField && s7.noRowAny && s7.allSame && s7.n >= 6);
    if (s7 && !(s7.noRowField && s7.noRowAny && s7.allSame && s7.n >= 6)) console.log('  ℹ S7 诊断:', JSON.stringify(s7));

    // ── S8 重排幂等：reflowGroup 再跑一遍全卡几何不动（保形） ──
    const s8 = await cdp.evalJs(helpers + `(async function(){
      var ids = ['${s6.ids.a5}','${s6.ids.b5}','${s6.ids.c5}','${s6b.ids.c6}'];
      var before = {};
      ids.forEach(function(id){ before[id] = posCard(byId(id)); });
      window.reflowGroup(byId('${s6.ids.a5}').dataset.groupId);
      await new Promise(function(r){ setTimeout(r, 200); });
      var allStable = true;
      ids.forEach(function(id){
        var b = before[id], a = posCard(byId(id));
        if (a.left !== b.left || a.top !== b.top || a.w !== b.w || a.h !== b.h) allStable = false;
      });
      return { allStable: allStable, noRow: byId('${s6.ids.c5}').dataset.rowInGroup !== '1' };
    })()`);
    ok('S8 重排幂等：reflowGroup 再跑一遍 L 组 4 卡几何完全不动（保形）+ 无行标记',
      !!s8 && s8.allStable && s8.noRow);
    if (s8 && !(s8.allStable && s8.noRow)) console.log('  ℹ S8 诊断:', JSON.stringify(s8));

    // ── S9 拆分保形 + 侧并入回组保原尺寸 ──
    const s9 = await cdp.evalJs(helpers + `(async function(){
      var A5 = byId('${s6.ids.a5}'), B5 = byId('${s6.ids.b5}'), C6 = byId('${s6b.ids.c6}');
      var g = A5.dataset.groupId;
      var before = posCard(C6);
      window.splitCardFromGroup(C6);
      await new Promise(function(r){ setTimeout(r, 200); });
      var afterSplit = posCard(C6);
      var cleared = !C6.dataset.groupId;
      var intact = afterSplit.left === before.left && afterSplit.top === before.top && afterSplit.w === before.w && afterSplit.h === before.h;
      // 再从右并入 B5 → 回组、保原尺寸（右并入零归一化）、贴 B5 右缘、顶对齐
      window.mergeCards(C6, B5, 'right');
      await new Promise(function(r){ setTimeout(r, 200); });
      var C6P = posCard(C6), B5P = posCard(B5);
      return { cleared: cleared, intact: intact,
        backInGroup: C6.dataset.groupId === g,
        keptSize: C6P.w === before.w && C6P.h === before.h,
        flushRight: Math.abs(C6P.left - (B5P.left + B5P.w)) < 0.5,
        topAligned: Math.abs(C6P.top - B5P.top) < 0.5,
        noRowMarker: C6.dataset.rowInGroup !== '1' };
    })()`);
    ok('S9 拆分保形 + 侧并入回组：拆分后 gid 清+几何不动、右并入回组保原尺寸+贴右缘顶对齐+无行标记',
      !!s9 && s9.cleared && s9.intact && s9.backInGroup && s9.keptSize && s9.flushRight && s9.topAligned && s9.noRowMarker);
    if (s9 && !(s9.cleared && s9.intact && s9.backInGroup && s9.keptSize && s9.flushRight && s9.topAligned && s9.noRowMarker)) console.log('  ℹ S9 诊断:', JSON.stringify(s9));

    ok('B4 版本徽章：右下角 badge 渲染 FC v10.28.34.2',
      await cdp.evalJs("(function(){ var ds = document.querySelectorAll('body > div'); for (var i=0;i<ds.length;i++){ if (ds[i].textContent === 'FC v10.28.34.2') return true; } return false; })()"));

    ok('Z 零 console error', cdp.errs.length === 0);
    if (cdp.errs.length) console.log('  errors:', JSON.stringify(cdp.errs).slice(0, 600));

    await cdp.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('\n  ── 结果: ' + pass + '/' + (pass + fail) + ' 全绿' + (fail === 0 ? ' ✅' : ' ❌'));
  if (fail) process.exit(1);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
