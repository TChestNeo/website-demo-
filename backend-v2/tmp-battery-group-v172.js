// tmp-battery-group-v172.js — 一体口径补全电池（v10.28.17.2 轮）
// 用户（2026-09-02）三点投诉：「为什么我选中的时候他那边的第一个框是单独
// 卡片的框而不是整个框起来？？然后为什么他们还是一样拥有独立的白色背景？
// 然后我希望那个一样长度的是默认合并时但是如果是合并完后用户要单独调整是
// 可以的但最顶部的部分的高度永远一致行不行？中间部分要怎么调就怎么调但是
// 图片的大小永远是等比例」
// 修复口径：①整组选中=单框（手柄/旋转钮整组选中时全隐，组背景 .selected
// 卡片同款环）②成员独立白色卡面（背景色/高光渐变/backdrop-filter）+背景图
// +装饰纹组内全藏（:not(.group-single)），组背景升级卡面玻璃=那张整卡，
// 单独选中该卡独立外观全回归 ③合并默认仍等宽填满齐顶齐底（回归），合并后
// 单独调整（缩放/旋转）提交只走 alignGroupTops 列顶对齐——调整生效不反弹、
// 顶部永远齐平、图片尺寸永远等比。
// 跑法：node tmp-battery-group-v172.js（LIVE_BASE=<完整站点 URL> 跑线上）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 3900 + Math.floor(Math.random() * 500);
const CDP_PORT = 4900 + Math.floor(Math.random() * 500);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-' + Date.now());

// ── 静态壳（docs/ 原样；/api 全 404 → demo 模式零请求） ──
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.indexOf('/api/') === 0) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
  let f = p === '/' ? '/index.html' : p;
  const file = path.join(DOCS, f);
  if (!file.startsWith(DOCS)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

// ── 种子素材 ──
const SVG_SRC = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="40"><rect width="64" height="40" fill="#4f46e5"/><circle cx="32" cy="20" r="12" fill="#ffffff"/></svg>'
).toString('base64');

function flagCard(id, ratio, w, h, x, y, extra) {
  return Object.assign({
    id: id, type: 'flag', label: id, col: 2, row: 2, colSpan: 8, rowSpan: 6,
    x: x, y: y, rotate: 0, borderRadius: 8, background: '',
    borderStyle: 'solid', borderColor: '', borderWidth: 2,
    imgSrc: SVG_SRC, aspectLock: '1', aspectRatio: ratio, fitW: w, fitH: h
  }, extra || {});
}
function draft(cards) {
  return { v: 9, title: 'group-v172-test', tags: [], cards: cards,
    settings: { snapOn: false, alignOn: false }, activePreset: '169', presets: {}, lastSaved: Date.now() - 300000 };
}

// ── CDP 客户端（Node 24 全局 WebSocket） ──
class CDP {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws error')); });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method) {
        const ls = this.listeners.get(m.method);
        if (ls) ls.forEach(fn => fn(m.params));
      }
    };
  }
  send(method, params) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  on(method, fn) { if (!this.listeners.has(method)) this.listeners.set(method, []); this.listeners.get(method).push(fn); }
  async evalJs(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evalJs: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || 'exception'));
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch (e) {} }
}

async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('waitFor 超时: ' + label);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const pass = [], fail = [];
function check(name, cond, detail) {
  const line = (cond ? '  ✅ ' : '  ❌ ') + name + (detail ? '（' + detail + '）' : '');
  console.log(line);
  (cond ? pass : fail).push(line);
}

// ── 探针 ──
const GEO = `(function () {
  var out = [];
  document.querySelectorAll('.grid-card').forEach(function (c) {
    out.push({
      id: c.dataset.cardId, t: c.dataset.cardType, g: c.dataset.groupId || '',
      x: parseFloat(c.style.left) || 0, y: parseFloat(c.style.top) || 0,
      w: c.offsetWidth, h: c.offsetHeight,
      fitW: c.dataset.fitW || '', fitH: c.dataset.fitH || '',
      ar: c.dataset.aspectRatio || '', bottom: (parseFloat(c.style.top) || 0) + c.offsetHeight,
      rot: c.dataset.rotate || '0', sel: c.classList.contains('selected'),
      bd: getComputedStyle(c).borderTopWidth
    });
  });
  return JSON.stringify(out);
})()`;
const SEL = `(function () {
  var ids = [];
  document.querySelectorAll('.grid-card.selected').forEach(function (c) { ids.push(c.dataset.cardId); });
  return JSON.stringify({ ids: ids, bg: document.querySelectorAll('.grid-group-bg.selected').length,
    bgCount: document.querySelectorAll('.grid-group-bg').length });
})()`;
// 手柄/旋转钮可见性（整组选中应全隐；单卡 locked 卡 = 4 角柄 + 旋转钮）
const HANDLES = `(function () {
  var vis = [];
  document.querySelectorAll('.resize-handle').forEach(function (h) { if (h.style.display !== 'none') vis.push(h.dataset.dir); });
  var g = document.querySelector('.rotate-grip');
  return JSON.stringify({ vis: vis, grip: g ? g.style.display : 'absent' });
})()`;
// 卡面/组背景外观探针：成员透明=rgba(0,0,0,0)（一体）、单卡回归=非透明；
// 组背景=那张整卡的卡面（非透明玻璃）；国旗图 .card-img-bg 是内容保留。
const FACES = `(function () {
  var out = [];
  document.querySelectorAll('.grid-card').forEach(function (c) {
    var cs = getComputedStyle(c);
    out.push({
      id: c.dataset.cardId, gs: c.classList.contains('group-single'),
      bgColor: cs.backgroundColor, blur: cs.backdropFilter || cs.webkitBackdropFilter || 'none',
      shadow: cs.boxShadow, bd: cs.borderTopWidth,
      flagVis: (function () { var f = c.querySelector('.card-img-bg'); return f ? getComputedStyle(f).display : 'absent'; })()
    });
  });
  var gb = document.querySelector('.grid-group-bg');
  return JSON.stringify({ cards: out,
    groupBg: gb ? getComputedStyle(gb).backgroundColor : 'absent',
    groupBgSel: document.querySelectorAll('.grid-group-bg.selected').length });
})()`;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

// ── 真实鼠标手势 ──
async function mouse(t, type, x, y, buttons, clickCount) {
  await t.send('Input.dispatchMouseEvent', { type: type, x: Math.round(x), y: Math.round(y), button: 'left', buttons: buttons, clickCount: clickCount || 1 });
}
async function clickAt(t, x, y) {
  await mouse(t, 'mousePressed', x, y, 1, 1); await sleep(40); await mouse(t, 'mouseReleased', x, y, 0, 1); await sleep(80);
}
async function dragFromTo(t, sx, sy, ex, ey, steps) {
  await mouse(t, 'mousePressed', sx, sy, 1, 1);
  await sleep(50);
  for (let i = 1; i <= steps; i++) {
    await mouse(t, 'mouseMoved', sx + (ex - sx) * i / steps, sy + (ey - sy) * i / steps, 1, 1);
    await sleep(25);
  }
  await sleep(60);
  await mouse(t, 'mouseReleased', ex, ey, 0, 1);
  await sleep(150);
}
async function rectOf(t, id) {
  return JSON.parse(await t.evalJs(`(function () {
    var c = null;
    document.querySelectorAll('.grid-card').forEach(function (x) { if (x.dataset.cardId === '${id}') c = x; });
    if (!c) return '{}';
    var r = c.getBoundingClientRect();
    return JSON.stringify({ x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2, right: r.right });
  })()`));
}
// 手势落点：上缘水平中心（图片区）——卡中心是 .card-label 输入框不 arm 拖拽
// 且 onclick 吃掉切换（陷阱 86）。防御性验证落点不是标签。
async function grabPoint(t, id) {
  const r = await rectOf(t, id);
  const px = r.x + r.w / 2, py = r.y + 6;
  const hit = await t.evalJs(`(function () {
    var el = document.elementFromPoint(${px}, ${py});
    var chain = [];
    while (el && chain.length < 5) { chain.push(String(el.className)); el = el.parentElement; }
    return chain.join(' | ');
  })()`);
  if (hit.indexOf('card-label') !== -1) throw new Error('落点在标签上: ' + hit);
  return { x: px, y: py };
}
async function geoOf(t) { return JSON.parse(await t.evalJs(GEO)); }
async function selOf(t) { return JSON.parse(await t.evalJs(SEL)); }
async function handlesOf(t) { return JSON.parse(await t.evalJs(HANDLES)); }
async function facesOf(t) { return JSON.parse(await t.evalJs(FACES)); }
function cardOf(geo, id) {
  const c = geo.find(c => c.id === id);
  if (!c) throw new Error('探针缺卡 ' + id);
  return c;
}
// 元素中心点（手柄/旋转钮这类 canvas 兄弟元素）
async function centerOf(t, selExpr) {
  return JSON.parse(await t.evalJs(`(function () {
    var el = ${selExpr};
    if (!el) return '{}';
    var r = el.getBoundingClientRect();
    return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  })()`));
}

async function main() {
  const LIVE = process.env.LIVE_BASE || '';
  if (!LIVE) server.listen(PORT);
  let chromePath = null;
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
  ]) if (fs.existsSync(p)) { chromePath = p; break; }
  if (!chromePath) throw new Error('找不到 Chrome');

  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });

  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) break; } catch (e) {}
    await sleep(250);
  }

  async function newTarget() {
    const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/new?about:blank', { method: 'PUT' });
    const info = await r.json();
    const cdp = new CDP(info.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    return cdp;
  }

  const BASE = LIVE || ('http://127.0.0.1:' + PORT);

  // 种子相（陷阱 84/85：线上文档级注入先于门禁 head；本地走根页写种子）
  async function newPhase(name, seedCards, count) {
    const t = await newTarget();
    const exc = [], err = [];
    t.on('Runtime.exceptionThrown', p => exc.push((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || '?'));
    t.on('Log.entryAdded', p => {
      const e = p.entry;
      if (e.level === 'error' && e.url && e.url.indexOf('/api') === -1 && e.url.indexOf('favicon') === -1) err.push(e.url + ' :: ' + e.text);
    });
    const seedJs = `localStorage.setItem('slati_session', JSON.stringify({loggedIn:true}));
      localStorage.setItem('slati_user', JSON.stringify({id:'USR-batt', displayName:'Battery Tester', tier:'premium'}));
      localStorage.setItem('slati_fluidcanvas_draft', JSON.stringify(${JSON.stringify(draft(seedCards))}));`;
    if (LIVE) {
      await t.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try { ' + seedJs + ' } catch (e) {}' });
      await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    } else {
      await t.send('Page.navigate', { url: BASE + '/' });
      await waitFor(t, "document.readyState === 'complete'", 8000, name + ' 根页');
      await t.evalJs(seedJs);
      await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    }
    await waitFor(t, "document.querySelectorAll('.grid-card').length === " + count, 8000, name + ' 草稿恢复');
    return { t, exc, err };
  }

  // ════ 阶段 A：真实拖拽合拼 → 默认等宽填满齐顶齐底（v10.28.17 口径回归） ════
  // 种子几何约束（调试两轮实抓）：画布左偏移 ~284、宽 944（43 列×22−2）。
  // Chrome 对父元素边框盒外的点不命中（elementsFromPoint 层栈里 gridCanvas
  // 缺席）——合并后 c2 右缘+手柄若溢出画布盒（右缘 939 内），press 落
  // editor-body 空区 → 原生选区拖拽 → 容器 auto-scroll 65→2580 全盘乱套。
  // c1(99)+320+8=427 起贴、c2 合并后 427+512=939 ≤944 ✓、se 手柄 client
  // 1218 < 画布右 1228 < 窗口 1280 ✓、旋转钮/拆分拖拽全部界内。
  {
    const name = 'A';
    const { t, exc, err } = await newPhase(name, [
      flagCard('c1', '1', 320, 320, 99, 200),
      flagCard('c2', '1.6', 320, 200, 587, 200)
    ], 2);
    await sleep(800); // 画布加载 settle（陷阱 86）
    const hasVer = await t.evalJs("document.documentElement.outerHTML.indexOf('v10.28.17.2') > -1");
    check('A0 编辑器页含 v10.28.17.2', hasVer === true);

    const r1 = await rectOf(t, 'c1'), r2 = await rectOf(t, 'c2');
    const targetLeft = r1.right + 8; // c2 左缘目标（吸合 12px 内 → 贴齐 520）
    const dx = -(r2.x - targetLeft);
    check('A1 起拖前两卡独立（无 groupId）', (await geoOf(t)).every(c => !c.g), JSON.stringify(await geoOf(t)));
    const gpt2 = await grabPoint(t, 'c2');
    await dragFromTo(t, gpt2.x, gpt2.y, gpt2.x + dx, gpt2.y, 6);
    await sleep(350); // justDragged 300ms 窗口过后再探

    let g = await geoOf(t);
    const a1 = cardOf(g, 'c1'), a2 = cardOf(g, 'c2');
    check('A2 真实拖拽成组（两卡 groupId 相同非空）', a1.g && a1.g === a2.g, a1.g + '/' + a2.g);
    check('A2b 组背景出现', (await selOf(t)).bgCount === 1);
    // 期望纸上算：合并等宽 W=320 → c2 归一 320×200，列高 320 vs 200 →
    // f=1.6 → c2 512×320，两列底缘齐平（200+320=520）——默认合并口径
    check('A3 默认合并：矮列等比放大 512×320', a2.w === 512 && a2.h === 320, a2.w + '×' + a2.h);
    check('A3b 两列底缘齐平 520', near(a1.bottom, 520, 1.5) && near(a2.bottom, 520, 1.5), a1.bottom + '/' + a2.bottom);
    check('A3c 高列图卡分毫未动 320×320', a1.w === 320 && a1.h === 320, a1.w + '×' + a1.h);
    const selA = await selOf(t);
    check('A4 合并后无选中（deselectAll 回归）', selA.ids.length === 0 && selA.bg === 0, JSON.stringify(selA));
    g = await geoOf(t);
    check('A4b 成员无独立边框（一体回归）', cardOf(g, 'c1').bd === '0px' && cardOf(g, 'c2').bd === '0px',
      cardOf(g, 'c1').bd + '/' + cardOf(g, 'c2').bd);

    // ════ 阶段 B：单击 = 整组选中 = 一条整组框 + 无独立白色背景 ════
    const gp1 = await grabPoint(t, 'c1');
    await clickAt(t, gp1.x, gp1.y);
    let selB = await selOf(t);
    check('B1 单击选中整组（两卡 selected + 组背景环）', selB.ids.length === 2 && selB.bg === 1, JSON.stringify(selB));
    let hd = await handlesOf(t);
    check('B2 整组选中：8 手柄全隐（不再挂点中那张卡的框）', hd.vis.length === 0, JSON.stringify(hd));
    check('B3 整组选中：旋转钮隐（absent 或 none）', hd.grip === 'absent' || hd.grip === 'none', String(hd.grip));
    let fc = await facesOf(t);
    check('B4 整组选中：无 .group-single', fc.cards.every(c => !c.gs), JSON.stringify(fc.cards.map(c => c.id + ':' + c.gs)));
    check('B5 组背景 .selected 带环', fc.groupBgSel === 1, String(fc.groupBgSel));
    const b1 = fc.cards.find(c => c.id === 'c1'), b2 = fc.cards.find(c => c.id === 'c2');
    check('B6 成员白色卡面全藏（背景色 transparent）', b1.bgColor === TRANSPARENT && b2.bgColor === TRANSPARENT,
      b1.bgColor + '/' + b2.bgColor);
    check('B7 成员磨砂玻璃 blur 关闭', b1.blur === 'none' && b2.blur === 'none', b1.blur + '/' + b2.blur);
    check('B8 组背景=整卡卡面（非透明玻璃）', fc.groupBg !== 'absent' && fc.groupBg !== TRANSPARENT, String(fc.groupBg));
    check('B9 成员 box-shadow 全隐', b1.shadow === 'none' && b2.shadow === 'none', b1.shadow + '/' + b2.shadow);
    check('B10 国旗内容图保留（.card-img-bg 可见）', b1.flagVis !== 'none' && b1.flagVis !== 'absent', String(b1.flagVis));

    // ════ 阶段 C：再击同卡 = 单卡（该卡独立外观全回归，其余成员保持一体） ════
    await clickAt(t, gp1.x, gp1.y);
    selB = await selOf(t);
    check('C1 再击同卡 → 单卡选中', selB.ids.length === 1 && selB.ids[0] === 'c1' && selB.bg === 0, JSON.stringify(selB));
    fc = await facesOf(t);
    const c1f = fc.cards.find(c => c.id === 'c1'), c2f = fc.cards.find(c => c.id === 'c2');
    check('C2 仅 c1 .group-single', c1f.gs === true && c2f.gs === false, c1f.gs + '/' + c2f.gs);
    check('C3 c1 独立卡面回归（背景色非透明）', c1f.bgColor !== TRANSPARENT, String(c1f.bgColor));
    check('C4 c2 仍一体（透明）', c2f.bgColor === TRANSPARENT, String(c2f.bgColor));
    hd = await handlesOf(t);
    check('C5 单卡 locked 图卡：4 角柄出现', hd.vis.length === 4, JSON.stringify(hd));
    check('C6 单卡：旋转钮出现', hd.grip === 'block', String(hd.grip));
    check('C7 组背景无 .selected（单卡态）', fc.groupBgSel === 0, String(fc.groupBgSel));
    await clickAt(t, gp1.x, gp1.y);
    selB = await selOf(t);
    fc = await facesOf(t);
    hd = await handlesOf(t);
    check('C8 三击回整组（.group-single 清除+手柄再隐）',
      selB.ids.length === 2 && selB.bg === 1 && fc.cards.every(c => !c.gs) && hd.vis.length === 0,
      JSON.stringify(selB) + '/' + JSON.stringify(hd));

    // ════ 阶段 D：单卡 se 手柄缩放 → 调整生效不反弹、顶部齐平、等比 ════
    const gp2 = await grabPoint(t, 'c2');
    await clickAt(t, gp2.x, gp2.y);   // 点 c2 = 整组（重新计数）
    await clickAt(t, gp2.x, gp2.y);   // 再击 = c2 单卡
    selB = await selOf(t);
    check('D0 c2 单卡选中', selB.ids.length === 1 && selB.ids[0] === 'c2', JSON.stringify(selB));
    const preG = await geoOf(t);
    const pre1 = cardOf(preG, 'c1'), pre2 = cardOf(preG, 'c2');
    const se = await centerOf(t, `(function () {
      var h = null;
      document.querySelectorAll('.resize-handle').forEach(function (x) { if (x.dataset.dir === 'se') h = x; });
      return h;
    })()`);
    if (!se.x) throw new Error('se 手柄不存在');
    await dragFromTo(t, se.x, se.y, se.x + 80, se.y + 80, 8);
    await sleep(350);
    g = await geoOf(t);
    const d1 = cardOf(g, 'c1'), d2 = cardOf(g, 'c2');
    // 纸上算：locked corner f=1+(w0·lx+h0·ly)/(w0²+h0²)=1+66560/364544≈1.183
    // → newW=round(1.183·512)=605、newH=round(605/1.6)=378（等比无漂移）
    check('D1 se 缩放生效（c2 变大 >512）', d2.w > 512 && d2.h > 320, d2.w + '×' + d2.h);
    check('D2 图片大小永远等比（w/h≈1.6）', near(d2.w / d2.h, 1.6, 0.02), (d2.w / d2.h).toFixed(4));
    check('D3 另一卡 c1 分毫不动', d1.x === pre1.x && d1.y === pre1.y && d1.w === pre1.w && d1.h === pre1.h,
      d1.x + ',' + d1.y + ',' + d1.w + '×' + d1.h);
    check('D4 列顶对齐保持（顶部永远一致）', near(d1.y, d2.y, 1), d1.y + '/' + d2.y);
    check('D5 fitW/fitH 同步', Number(d2.fitW) === d2.w && Number(d2.fitH) === d2.h, d2.fitW + '/' + d2.fitH);
    await sleep(600); // 不反弹：等一个「填满回抢」周期（旧 reflow 会立刻拉回）
    g = await geoOf(t);
    const d2b = cardOf(g, 'c2');
    check('D6 缩放不反弹（600ms 后尺寸不变）', d2b.w === d2.w && d2b.h === d2.h, d2b.w + '×' + d2b.h + ' vs ' + d2.w + '×' + d2.h);

    // ════ 阶段 E：组内旋转 → 调整生效 + 顶对齐保持 ════
    fc = await facesOf(t);
    check('E0 缩放后仍单卡选中（.group-single 保持）', fc.cards.find(c => c.id === 'c2').gs === true, JSON.stringify(fc.cards.map(c => c.id + ':' + c.gs)));
    const gp = await centerOf(t, "document.querySelector('.rotate-grip')");
    if (!gp.x) throw new Error('旋转钮不存在');
    await dragFromTo(t, gp.x, gp.y, gp.x + 90, gp.y + 70, 8);
    await sleep(350);
    g = await geoOf(t);
    const e2 = cardOf(g, 'c2');
    check('E1 旋转生效（rotate 变化）', Math.abs(parseFloat(e2.rot)) >= 5, String(e2.rot));
    check('E2 旋转提交后列顶仍对齐', near(cardOf(g, 'c1').y, e2.y, 1), cardOf(g, 'c1').y + '/' + e2.y);
    check('E3 旋转不触碰任何尺寸', e2.w === d2b.w && e2.h === d2b.h, e2.w + '×' + e2.h);

    // ════ 阶段 F：单卡拖出 = 拆组（独立卡面回归、组散） ════
    const gp1b = await grabPoint(t, 'c1');
    await clickAt(t, gp1b.x, gp1b.y); // 点 c1 = 整组
    await clickAt(t, gp1b.x, gp1b.y); // 再击 = c1 单卡
    await dragFromTo(t, gp1b.x, gp1b.y, gp1b.x + 360, gp1b.y + 240, 8);
    await sleep(350);
    g = await geoOf(t);
    const f1 = cardOf(g, 'c1'), f2 = cardOf(g, 'c2');
    check('F1 拆出卡无 groupId', !f1.g, String(f1.g));
    check('F2 剩余孤卡 groupId 清空（<2 解散）', !f2.g, String(f2.g));
    check('F3 组背景消失', (await selOf(t)).bgCount === 0);
    fc = await facesOf(t);
    const f1f = fc.cards.find(c => c.id === 'c1');
    check('F4 拆出卡独立外观回归（非透明 + 无 .group-single）',
      f1f.bgColor !== TRANSPARENT && !f1f.gs, f1f.bgColor + '/' + f1f.gs);

    check('A8 无运行时异常', exc.length === 0, exc.join(' | '));
    check('A9 无 console error', err.length === 0, err.join(' | '));
    t.close();
  }

  // ════ 阶段 G：API 合拼默认口径回归 + 草稿往返 + 重载后一体状态一致 ════
  // 种子同 A 相约束（合并后 c2 右缘 428+512=940 ≤944 画布盒内）
  {
    const name = 'G';
    const { t, exc, err } = await newPhase(name, [
      flagCard('c1', '1', 320, 320, 100, 200),
      flagCard('c2', '1.6', 320, 200, 580, 200)
    ], 2);
    await sleep(800);
    await t.evalJs("window.mergeCards(document.querySelectorAll('.grid-card')[1], document.querySelectorAll('.grid-card')[0])");
    await waitFor(t, "document.querySelectorAll('.grid-group-bg').length === 1", 4000, 'G 组背景');
    let g = await geoOf(t);
    const g1 = cardOf(g, 'c1'), g2 = cardOf(g, 'c2');
    check('G1 合并等宽 320（c1 320×320）', g1.w === 320 && g1.h === 320, g1.w + '×' + g1.h);
    check('G2 默认填满 c2 512×320、底缘齐平', g2.w === 512 && g2.h === 320 && near(g1.bottom, g2.bottom, 1.5),
      g2.w + '×' + g2.h + ' @' + g1.bottom + '/' + g2.bottom);
    check('G3 合并后无选中', (await selOf(t)).ids.length === 0, JSON.stringify(await selOf(t)));

    await t.evalJs('window.saveDraft()');
    const d1 = JSON.parse(await t.evalJs("localStorage.getItem('slati_fluidcanvas_draft')"));
    const dg1 = d1.cards.find(c => c.id === 'c1'), dg2 = d1.cards.find(c => c.id === 'c2');
    check('G4a 草稿 groupId 双落', dg1.groupId && dg1.groupId === dg2.groupId, dg1.groupId + '/' + dg2.groupId);
    check('G4b 草稿 c2 fitW/fitH 512/320', dg2.fitW === 512 && dg2.fitH === 320, dg2.fitW + '/' + dg2.fitH);

    if (!LIVE) {
      await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
      await waitFor(t, "document.querySelectorAll('.grid-card').length === 2", 8000, 'G 重载恢复');
      g = await geoOf(t);
      check('G5 重载不翻倍（c2 仍 512×320）', cardOf(g, 'c2').w === 512 && cardOf(g, 'c2').h === 320,
        cardOf(g, 'c2').w + '×' + cardOf(g, 'c2').h);
      check('G5b 重载后底缘齐平', near(cardOf(g, 'c1').bottom, cardOf(g, 'c2').bottom, 1.5),
        cardOf(g, 'c1').bottom + '/' + cardOf(g, 'c2').bottom);
      // 重载后一体状态一致：单击整组 → 单框 + 成员透明
      await sleep(600);
      const gp1 = await grabPoint(t, 'c1');
      await clickAt(t, gp1.x, gp1.y);
      const hd = await handlesOf(t);
      const fc = await facesOf(t);
      check('G6 重载后单击整组：单框（手柄全隐）', hd.vis.length === 0, JSON.stringify(hd));
      check('G6b 重载后成员卡面透明（一体持久）',
        fc.cards.every(c => c.bgColor === TRANSPARENT) && fc.cards.every(c => !c.gs),
        JSON.stringify(fc.cards.map(c => c.id + ':' + c.bgColor)));
      await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
      await waitFor(t, "document.querySelectorAll('.grid-card').length === 2", 8000, 'G 二次重载');
      g = await geoOf(t);
      check('G7 二次重载稳定（512×320）', cardOf(g, 'c2').w === 512 && cardOf(g, 'c2').h === 320,
        cardOf(g, 'c2').w + '×' + cardOf(g, 'c2').h);
    }

    check('G8 无运行时异常', exc.length === 0, exc.join(' | '));
    check('G9 无 console error', err.length === 0, err.join(' | '));
    t.close();
  }

  // 汇总
  console.log('\n════════ 汇总 ════════');
  console.log('通过 ' + pass.length + ' / 失败 ' + fail.length);
  if (fail.length) { console.log('失败项：'); fail.forEach(f => console.log(f)); }
  if (!LIVE) server.close();
  try { chrome.kill(); } catch (e) {}
  process.exit(fail.length ? 1 : 0);
}

(() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
main().catch(e => { console.error('电池崩溃:', e); process.exit(2); });
