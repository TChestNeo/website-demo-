// tmp-battery-group-click.js — 真实手势合拼/选中电池（v10.28.17.1 轮）
// 用户（2026-09-02）三点投诉：「为什么高度还是一样不一样？？？？？然后
// 为什么点击一下选中时是他妈的是整个合并内的其中一个而不是整个？合并后
// 除了单独选中以外都是属于一个整体的卡片了不存在任何独立的背景好不好？？？」
// 排查结论：合拼后 mergeCards 自动整组选中 → 用户第一次点击被
// mousedownAlreadySelected 判为「再次点击」→ 单卡选中 → 拖动即拆组 →
// 全散：高度不等（拆出回原高）+ 独立背景（组散）——一个连锁。修复：
// mergeCards 后 deselectAll（第一次点击=整组，再次点击同卡=单卡保留旧钦定）。
// 本电池用真实鼠标手势（Input.dispatchMouseEvent 拖拽+点击），断言按修复
// 后口径写：修复前跑 A4/B1 应红（记录 bug），修复后全绿。
// 跑法：node tmp-battery-group-click.js（LIVE_BASE=<完整站点 URL> 跑线上）
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
  return { v: 9, title: 'group-click-test', tags: [], cards: cards,
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
      sel: c.classList.contains('selected'),
      bd: getComputedStyle(c).borderTopWidth
    });
  });
  return JSON.stringify(out);
})()`;
// 选中快照：选中卡 id 列表 + 组背景选中数
const SEL = `(function () {
  var ids = [];
  document.querySelectorAll('.grid-card.selected').forEach(function (c) { ids.push(c.dataset.cardId); });
  return JSON.stringify({ ids: ids, bg: document.querySelectorAll('.grid-group-bg.selected').length,
    bgCount: document.querySelectorAll('.grid-group-bg').length });
})()`;
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ── 真实鼠标手势 ──
async function mouse(t, type, x, y, buttons, clickCount) {
  await t.send('Input.dispatchMouseEvent', { type: type, x: Math.round(x), y: Math.round(y), button: 'left', buttons: buttons, clickCount: clickCount || 1 });
}
async function clickAt(t, x, y) {
  await mouse(t, 'mousePressed', x, y, 1, 1); await sleep(40); await mouse(t, 'mouseReleased', x, y, 0, 1); await sleep(80);
}
async function dblClickAt(t, x, y) {
  await mouse(t, 'mousePressed', x, y, 1, 1); await sleep(40); await mouse(t, 'mouseReleased', x, y, 0, 1);
  await sleep(60);
  await mouse(t, 'mousePressed', x, y, 1, 2); await sleep(40); await mouse(t, 'mouseReleased', x, y, 0, 2);
  await sleep(80);
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
// 手势落点：上缘水平中心（图片区）——卡中心是 .card-label 输入框，从标签
// 按下不 arm 拖拽（v10.24/10.10 文字守卫）；标签 onclick stopPropagation 还会
// 吃掉 click 切换。防御性验证落点不是标签。
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
function cardOf(geo, id) {
  const c = geo.find(c => c.id === id);
  if (!c) throw new Error('探针缺卡 ' + id);
  return c;
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
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
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

  // ════ 阶段 A：真实拖拽合拼 → 高度填满 + 合并后无选中 ════
  {
    const name = 'A';
    const { t, exc, err } = await newPhase(name, [
      flagCard('c1', '1', 320, 320, 200, 200),
      flagCard('c2', '1.6', 320, 200, 700, 200)
    ], 2);
    await sleep(800); // 画布加载后缩放/滚动 settle 完再读 rect/下手势
    const hasVer = await t.evalJs("document.documentElement.outerHTML.indexOf('v10.28.17.1') > -1");
    check('A0 编辑器页含 v10.28.17.1', hasVer === true);

    // 真实拖拽：c2 上缘图片区起拖（中心是 .card-label 不 arm 拖拽），左移让
    // c2 左缘落到 c1 右缘 +12 内（吸合吸附 → 松手提交成组）
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
    // 期望纸上算：合并等宽 W=320 → c2 归一 320×200（320/1.6），列高 320 vs
    // 200 → f=1.6 → c2 512×320，两列底缘齐平（200+320=520）
    check('A3 矮列图卡等比放大 512×320（高度填满）', a2.w === 512 && a2.h === 320, a2.w + '×' + a2.h);
    check('A3b 两列底缘齐平 520', near(a1.bottom, 520, 1.5) && near(a2.bottom, 520, 1.5), a1.bottom + '/' + a2.bottom);
    check('A3c 高列图卡分毫未动 320×320', a1.w === 320 && a1.h === 320, a1.w + '×' + a1.h);
    // 修复后口径：合并后不自动选中（旧行为整组自动选中 → 用户第一次点击
    // 被判「再次点击」→ 单卡 → 拖即拆组连锁）
    const selA = await selOf(t);
    check('A4 合并后无选中（修复：deselectAll）', selA.ids.length === 0 && selA.bg === 0, JSON.stringify(selA));

    // ════ 阶段 B：单击 = 整组选中 ════
    const gp1 = await grabPoint(t, 'c1');
    await clickAt(t, gp1.x, gp1.y);
    let selB = await selOf(t);
    check('B1 单击选中整组（两卡全 selected + 组背景环）', selB.ids.length === 2 && selB.bg === 1, JSON.stringify(selB));
    g = await geoOf(t);
    check('B1b 整组选中成员无独立边框（一体：border 0）', cardOf(g, 'c1').bd === '0px' && cardOf(g, 'c2').bd === '0px',
      cardOf(g, 'c1').bd + '/' + cardOf(g, 'c2').bd);

    // ════ 阶段 C：再次点击同一张 = 单卡（旧钦定 v10.28.15.1 保留） ════
    await clickAt(t, gp1.x, gp1.y);
    selB = await selOf(t);
    check('C1 再击同卡 → 单卡选中', selB.ids.length === 1 && selB.ids[0] === 'c1' && selB.bg === 0, JSON.stringify(selB));

    // ════ 阶段 D：三击回整组 ════
    await clickAt(t, gp1.x, gp1.y);
    selB = await selOf(t);
    check('D1 三击回整组', selB.ids.length === 2 && selB.bg === 1, JSON.stringify(selB));

    // ════ 阶段 E：双击单卡后点别的卡 = 整组（重新计数） ════
    await dblClickAt(t, gp1.x, gp1.y);
    selB = await selOf(t);
    check('E1 双击 → 单卡', selB.ids.length === 1 && selB.ids[0] === 'c1', JSON.stringify(selB));
    const gp2 = await grabPoint(t, 'c2');
    await clickAt(t, gp2.x, gp2.y);
    selB = await selOf(t);
    check('E2 点别的卡 → 整组', selB.ids.length === 2 && selB.bg === 1, JSON.stringify(selB));

    // ════ 阶段 F：单卡拖出 = 拆组（组散 → 独立背景/高度回原） ════
    await dblClickAt(t, gp2.x, gp2.y);
    const gp2b = await grabPoint(t, 'c2');
    await dragFromTo(t, gp2b.x, gp2b.y, gp2b.x + 350, gp2b.y + 220, 8);
    await sleep(350);
    g = await geoOf(t);
    const f1 = cardOf(g, 'c1'), f2 = cardOf(g, 'c2');
    check('F1 拆出卡无 groupId', !f2.g, String(f2.g));
    check('F2 剩余孤卡 groupId 清空（<2 解散）', !f1.g, String(f1.g));
    check('F3 组背景消失', (await selOf(t)).bgCount === 0);

    // ════ 阶段 G：API 合拼回归（防 v10.28.17 核心功能回归） ════
    await t.evalJs("window.mergeCards(document.querySelectorAll('.grid-card')[1], document.querySelectorAll('.grid-card')[0])");
    await waitFor(t, "document.querySelectorAll('.grid-group-bg').length === 1", 4000, 'G 组背景');
    g = await geoOf(t);
    // F 后 c1 320×320 @200,200；c2 512×320 独立。合并 W=max(320,512)=512 →
    // c1 归一 512×512（r1），列高 512 vs 320 → f=1.6 → c2 819×512，底缘齐平
    const g1 = cardOf(g, 'c1'), g2 = cardOf(g, 'c2');
    check('G1 合并等宽 512（c1 512×512）', g1.w === 512 && g1.h === 512, g1.w + '×' + g1.h);
    check('G2 矮列填满 c2 819×512、底缘齐平', g2.w === 819 && g2.h === 512 &&
      near(g1.bottom, g2.bottom, 1.5), g2.w + '×' + g2.h + ' @' + g1.bottom + '/' + g2.bottom);
    check('G2b aspectRatio 1.6 保持', near(g2.w / g2.h, 1.6, 0.01), (g2.w / g2.h).toFixed(4));

    // 幂等 + 草稿往返（重载只跑本地——陷阱 84）
    await t.evalJs("window.reflowGroup(document.querySelector('.grid-card').dataset.groupId)");
    await t.evalJs("window.reflowGroup(document.querySelector('.grid-card').dataset.groupId)");
    await sleep(150);
    g = await geoOf(t);
    check('G3 重排幂等（819×512 不变）', cardOf(g, 'c2').w === 819 && cardOf(g, 'c2').h === 512,
      cardOf(g, 'c2').w + '×' + cardOf(g, 'c2').h);

    await t.evalJs('window.saveDraft()');
    const d1 = JSON.parse(await t.evalJs("localStorage.getItem('slati_fluidcanvas_draft')"));
    const dg1 = d1.cards.find(c => c.id === 'c1'), dg2 = d1.cards.find(c => c.id === 'c2');
    check('G4a 草稿 groupId 双落', dg1.groupId && dg1.groupId === dg2.groupId, dg1.groupId + '/' + dg2.groupId);
    check('G4b 草稿 c2 fitW/fitH 819/512', dg2.fitW === 819 && dg2.fitH === 512, dg2.fitW + '/' + dg2.fitH);

    if (!LIVE) {
      await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
      await waitFor(t, "document.querySelectorAll('.grid-card').length === 2", 8000, 'G 重载恢复');
      g = await geoOf(t);
      check('G5 重载不翻倍（c2 仍 819×512）', cardOf(g, 'c2').w === 819 && cardOf(g, 'c2').h === 512,
        cardOf(g, 'c2').w + '×' + cardOf(g, 'c2').h);
      check('G5b 重载后底缘齐平', near(cardOf(g, 'c1').bottom, cardOf(g, 'c2').bottom, 1.5),
        cardOf(g, 'c1').bottom + '/' + cardOf(g, 'c2').bottom);
      await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
      await waitFor(t, "document.querySelectorAll('.grid-card').length === 2", 8000, 'G 二次重载');
      g = await geoOf(t);
      check('G6 二次重载稳定（819×512）', cardOf(g, 'c2').w === 819 && cardOf(g, 'c2').h === 512,
        cardOf(g, 'c2').w + '×' + cardOf(g, 'c2').h);
    }

    check('A8 无运行时异常', exc.length === 0, exc.join(' | '));
    check('A9 无 console error', err.length === 0, err.join(' | '));
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

main().catch(e => { console.error('电池崩溃:', e); process.exit(2); });
