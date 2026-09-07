// tmp-battery-group-fill.js — 矮列放大填满电池（v10.28.17 轮）
// 用户（2026-09-02）「为什么当合拼一体时左右两列的高度不一致？」——钦定
// 「矮列的卡片放大填满」：列高取最高列，矮列按 f=H/colH 放大——图卡宽高
// 同比例（aspectRatio 不变、fitW/fitH/colSpan/rowSpan 同步）、content/text
// 只加高。验证：A 图卡+内容卡（内容只加高）/ B 双图卡等比放大+幂等+草稿
// 往返不翻倍（v10.28.15.2 回归守卫）+二次重载稳定 / C 第三卡并入三列重配
// 平+拆分塌合 / D 单列空转；全程 0 异常 0 console error。
// 跑法：node tmp-battery-group-fill.js（LIVE_BASE=<完整站点 URL> 跑线上精简版）
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

// ── 静态壳（docs/ 原样；/api 全 404 → demo 模式零请求，重载往返无碍） ──
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

// ── 种子素材：data URI SVG（aspect-lock 恢复要求 .card-img-bg 存在，图内容无关） ──
const SVG_SRC = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="40"><rect width="64" height="40" fill="#4f46e5"/><circle cx="32" cy="20" r="12" fill="#ffffff"/></svg>'
).toString('base64');

// 等比锁旗卡：aspectLock/aspectRatio/fitW/fitH 由 applyDraft 同步恢复精确 px
//（setCardImage onload 见 isAspectLocked 跳过重拟合，尺寸不被图覆盖）
function flagCard(id, ratio, w, h, x, y, extra) {
  return Object.assign({
    id: id, type: 'flag', label: id, col: 2, row: 2, colSpan: 8, rowSpan: 6,
    x: x, y: y, rotate: 0, borderRadius: 8, background: '',
    borderStyle: 'solid', borderColor: '', borderWidth: 2,
    imgSrc: SVG_SRC, aspectLock: '1', aspectRatio: ratio, fitW: w, fitH: h
  }, extra || {});
}
// 内容卡：rowSpan 1 → minHeight 24（--cell-size 24px），自然高远低于图卡列
// 高 → 填满方向确定（内容只加高）。宽度走 v10.28.15 精确 w。
function contentCard(id, w, x, y, html) {
  return {
    id: id, type: 'content', label: id, col: 8, row: 2, colSpan: 8, rowSpan: 1,
    x: x, y: y, rotate: 0, borderRadius: 8, background: '',
    borderStyle: 'solid', borderColor: '', borderWidth: 2, w: w, content: html
  };
}
function draft(cards) {
  return { v: 9, title: 'group-fill-test', tags: [], cards: cards,
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
  // 陷阱 84：超时先吐已收集异常/错误 + 现场探针再抛（别丢线索）
  throw new Error('waitFor 超时: ' + label);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const pass = [], fail = [];
function check(name, cond, detail) {
  const line = (cond ? '  ✅ ' : '  ❌ ') + name + (detail ? '（' + detail + '）' : '');
  console.log(line);
  (cond ? pass : fail).push(line);
}

// 页内探针（ES5）：全部卡片几何快照（JSON 字符串出页）。border-box 全局
// → offsetWidth/Height 含边框，组内藏边框不改变盒尺寸，测量口径一致。
const GEO = `(function () {
  var out = [];
  document.querySelectorAll('.grid-card').forEach(function (c) {
    out.push({
      id: c.dataset.cardId, t: c.dataset.cardType, g: c.dataset.groupId || '',
      x: parseFloat(c.style.left) || 0, y: parseFloat(c.style.top) || 0,
      w: c.offsetWidth, h: c.offsetHeight,
      fitW: c.dataset.fitW || '', fitH: c.dataset.fitH || '',
      ar: c.dataset.aspectRatio || '', al: c.dataset.aspectLock || '',
      cs: c.dataset.colSpan || '', rs: c.dataset.rowSpan || '',
      bottom: (parseFloat(c.style.top) || 0) + c.offsetHeight
    });
  });
  return JSON.stringify(out);
})()`;

// 格步 = 当前画布 --cell-size + 2（值随画布预设走——'169' 预设 20px 不是
// CSS 默认 24px，期望必须从实测 cell-size 推，不硬编码）
const CELL = `(function () {
  var v = getComputedStyle(document.getElementById('gridCanvas')).getPropertyValue('--cell-size');
  return parseInt(v, 10) || 0;
})()`;
const near = (a, b, tol) => Math.abs(a - b) <= tol;

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

  // 每相一个独立 target：种子写在根页（无编辑器 autosave 3s 定时器竞争），
  // 再导航进编辑器——各相状态零污染、无种子被旧相 autosave 覆盖的时序洞。
  // 线上（LIVE）：根页种子有竞态——根页自身 auth 探测 401 → mn:unauthorized
  // 清会话可能先于编辑器 head 门禁读取（A 相赢了竞态 B 相输了），改文档级
  // 注入（addScriptToEvaluateOnNewDocument 先于任何页内脚本含门禁 head 执行，
  // 零竞态）；假会话打真后端 401 清会话发生在卡片恢复之后、无碍非重载断言。
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
  async function geoOf(t) { return JSON.parse(await t.evalJs(GEO)); }
  function cardOf(geo, id) {
    const c = geo.find(c => c.id === id);
    if (!c) throw new Error('探针缺卡 ' + id);
    return c;
  }

  // ════ 阶段 A：图卡 + 内容卡（内容列矮 → 只加高、宽不变） ════
  {
    const name = 'A';
    const { t, exc, err } = await newPhase(name, [
      flagCard('c1', '1', 320, 320, 40, 40),
      contentCard('c2', 320, 600, 40, '<p>短内容</p>')
    ], 2);
    const hasVer = await t.evalJs("document.documentElement.outerHTML.indexOf('v10.28.17') > -1");
    check('A0 编辑器页含 v10.28.17', hasVer === true);

    let g = await geoOf(t);
    const h1 = cardOf(g, 'c1'), h2m = cardOf(g, 'c2').h;
    check('A1 合并前图卡 320×320 / 内容宽 320', h1.w === 320 && h1.h === 320 && cardOf(g, 'c2').w === 320,
      'h2m=' + h2m);
    check('A1b 图列高于内容列（方向确定）', 320 > h2m, '320 vs ' + h2m);

    await t.evalJs("window.mergeCards(document.querySelectorAll('.grid-card')[0], document.querySelectorAll('.grid-card')[1])");
    await waitFor(t, "document.querySelectorAll('.grid-group-bg').length === 1", 4000, 'A 组背景');
    g = await geoOf(t);
    const a1 = cardOf(g, 'c1'), a2 = cardOf(g, 'c2');
    check('A2 填满后两列底缘齐平', near(a1.bottom, a2.bottom, 1.5), a1.bottom + '/' + a2.bottom);
    check('A2b 内容卡只加高（高=列高 320、宽不变 320）', a2.h === 320 && a2.w === 320, a2.w + '×' + a2.h);
    check('A2c 图卡分毫未动（320×320、fitW/fitH 320）', a1.w === 320 && a1.h === 320 && a1.fitW === '320' && a1.fitH === '320',
      a1.w + '×' + a1.h);

    // 幂等：对已填满几何再重排 → f=1 空转
    await t.evalJs("window.reflowGroup(document.querySelector('.grid-card').dataset.groupId)");
    await sleep(150);
    g = await geoOf(t);
    check('A3 重排幂等（尺寸/位置不变）', cardOf(g, 'c1').w === 320 && cardOf(g, 'c2').h === 320 && cardOf(g, 'c2').w === 320,
      JSON.stringify([cardOf(g, 'c1'), cardOf(g, 'c2')]));

    // 草稿往返：内容高不落草稿 → 重载回自然高 → reflow 补填，无翻倍
    await t.evalJs('window.saveDraft()');
    const d1 = JSON.parse(await t.evalJs("localStorage.getItem('slati_fluidcanvas_draft')"));
    const dc1 = d1.cards.find(c => c.id === 'c1'), dc2 = d1.cards.find(c => c.id === 'c2');
    check('A4a 草稿图卡 aspectLock+fitW/fitH 320', dc1.aspectLock === '1' && dc1.fitW === 320 && dc1.fitH === 320, JSON.stringify(dc1));
    check('A4b 草稿内容卡 w 320、无高度字段（高度不落草稿）', dc2.w === 320 && !('height' in dc2), JSON.stringify(dc2));

    // 重载往返只跑本地（陷阱 84：线上假会话云同步 401 → mn:unauthorized 清会话
    // → 重载被门禁送回 locked 页属产品正确行为）
    if (!LIVE) {
      await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
      await waitFor(t, "document.querySelectorAll('.grid-card').length === 2", 8000, 'A 重载恢复');
      g = await geoOf(t);
      check('A4 重载后图卡不翻倍（仍 320×320）', cardOf(g, 'c1').w === 320 && cardOf(g, 'c1').h === 320,
        cardOf(g, 'c1').w + '×' + cardOf(g, 'c1').h);
      check('A4c 重载后内容卡 reflow 补填回 320 高、底缘齐平', cardOf(g, 'c2').h === 320 &&
        near(cardOf(g, 'c1').bottom, cardOf(g, 'c2').bottom, 1.5), cardOf(g, 'c2').w + '×' + cardOf(g, 'c2').h);

      await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
      await waitFor(t, "document.querySelectorAll('.grid-card').length === 2", 8000, 'A 二次重载');
      g = await geoOf(t);
      check('A5 二次重载稳定（320×320 / 320×320）', cardOf(g, 'c1').w === 320 && cardOf(g, 'c2').h === 320,
        cardOf(g, 'c1').w + '/' + cardOf(g, 'c2').h);
    }

    check('A6 无运行时异常', exc.length === 0, exc.join(' | '));
    check('A7 无 console error', err.length === 0, err.join(' | '));
    t.close();
  }

  // ════ 阶段 B：双图卡等比放大（400×400 r1 + 320×200 r1.6 → 640×400） ════
  {
    const { t, exc, err } = await newPhase('B', [
      flagCard('c1', '1', 400, 400, 40, 40),
      flagCard('c2', '1.6', 320, 200, 600, 40)
    ], 2);
    let g = await geoOf(t);
    check('B0 合并前 400×400 / 320×200', cardOf(g, 'c1').w === 400 && cardOf(g, 'c2').w === 320 && cardOf(g, 'c2').h === 200,
      JSON.stringify(g));

    await t.evalJs("window.mergeCards(document.querySelectorAll('.grid-card')[0], document.querySelectorAll('.grid-card')[1])");
    await waitFor(t, "document.querySelectorAll('.grid-group-bg').length === 1", 4000, 'B 组背景');
    g = await geoOf(t);
    const b1 = cardOf(g, 'c1'), b2 = cardOf(g, 'c2');
    // 期望纸上算：归一 c2→400×250（400/1.6），列高 400 vs 250 → f=1.6 →
    // c2=640×400；colSpan/rowSpan 按实测 cell-size 推（'169' 预设 20px →
    // step 22 → 29/18）
    const csB = await t.evalJs(CELL);
    const stepB = csB + 2;
    check('B1 矮列图卡等比放大 640×400', b2.w === 640 && b2.h === 400, b2.w + '×' + b2.h);
    check('B1b aspectRatio 1.6 保持（640/400）', near(b2.w / b2.h, 1.6, 0.01), (b2.w / b2.h).toFixed(4));
    check('B1c fitW/fitH 同步 640/400', b2.fitW === '640' && b2.fitH === '400', b2.fitW + '/' + b2.fitH);
    check('B1d colSpan/rowSpan 按格同步（' + Math.round((640 + 2) / stepB) + '/' + Math.round((400 + 2) / stepB) + '，cs=' + csB + '）',
      b2.cs === String(Math.round((640 + 2) / stepB)) && b2.rs === String(Math.round((400 + 2) / stepB)), b2.cs + '/' + b2.rs);
    check('B1e 两列底缘齐平 440', near(b1.bottom, b2.bottom, 1.5) && near(b1.bottom, 440, 1.5), b1.bottom + '/' + b2.bottom);
    check('B1f 列间按实际宽度贴齐（c2 左缘 440）', near(b2.x, 440, 1), String(b2.x));
    check('B1g 高列图卡分毫未动 400×400', b1.w === 400 && b1.h === 400, b1.w + '×' + b1.h);

    // 幂等：连排两次 → 尺寸/列划分稳定（0.5px 容差下 flush 列仍分两列）
    await t.evalJs("window.reflowGroup(document.querySelector('.grid-card').dataset.groupId)");
    await t.evalJs("window.reflowGroup(document.querySelector('.grid-card').dataset.groupId)");
    await sleep(150);
    g = await geoOf(t);
    check('B2 重排幂等（640×400 不变、贴齐 440 不变）', cardOf(g, 'c2').w === 640 && cardOf(g, 'c2').h === 400 && near(cardOf(g, 'c2').x, 440, 1),
      cardOf(g, 'c2').w + '×' + cardOf(g, 'c2').h + ' @' + cardOf(g, 'c2').x);

    // 草稿往返：fitW/fitH 精确恢复 → reflow f=1 → 不翻倍（v10.28.15.2 守卫）
    await t.evalJs('window.saveDraft()');
    const d1 = JSON.parse(await t.evalJs("localStorage.getItem('slati_fluidcanvas_draft')"));
    const dc2 = d1.cards.find(c => c.id === 'c2');
    check('B3a 草稿 c2 fitW 640 fitH 400', dc2.fitW === 640 && dc2.fitH === 400 && dc2.aspectRatio === '1.6', JSON.stringify(dc2));

    if (!LIVE) { // 陷阱 84：重载往返只跑本地
      await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
      await waitFor(t, "document.querySelectorAll('.grid-card').length === 2", 8000, 'B 重载恢复');
      g = await geoOf(t);
      check('B3 重载不翻倍（c2 仍 640×400、c1 仍 400×400）',
        cardOf(g, 'c2').w === 640 && cardOf(g, 'c2').h === 400 && cardOf(g, 'c1').w === 400 && cardOf(g, 'c1').h === 400,
        cardOf(g, 'c2').w + '×' + cardOf(g, 'c2').h + ' / ' + cardOf(g, 'c1').w + '×' + cardOf(g, 'c1').h);
      check('B3b 重载后底缘齐平', near(cardOf(g, 'c1').bottom, cardOf(g, 'c2').bottom, 1.5),
        cardOf(g, 'c1').bottom + '/' + cardOf(g, 'c2').bottom);

      await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
      await waitFor(t, "document.querySelectorAll('.grid-card').length === 2", 8000, 'B 二次重载');
      g = await geoOf(t);
      check('B4 二次重载稳定', cardOf(g, 'c2').w === 640 && cardOf(g, 'c2').h === 400, cardOf(g, 'c2').w + '×' + cardOf(g, 'c2').h);
    }

    check('B5 无运行时异常', exc.length === 0, exc.join(' | '));
    check('B6 无 console error', err.length === 0, err.join(' | '));
    t.close();
  }

  // ════ 阶段 C：第三卡并入 → 三列重配平；拆分塌合 ════
  {
    // 种子 = B 重载后状态（c1/c2 已填满并分组）+ 未分组 c3 300×300 r1
    const { t, exc, err } = await newPhase('C', [
      flagCard('c1', '1', 400, 400, 40, 40, { groupId: 'g1' }),
      flagCard('c2', '1.6', 640, 400, 440, 40, { groupId: 'g1' }),
      flagCard('c3', '1', 300, 300, 1200, 40)
    ], 3);
    let g = await geoOf(t);
    check('C0 种子恢复：组背景 1 处、c3 未分组', (await t.evalJs("document.querySelectorAll('.grid-group-bg').length")) === 1 &&
      cardOf(g, 'c2').g === 'g1' && cardOf(g, 'c3').g === '', JSON.stringify(g));

    // c3 并入组（target=c2）：挤到组宽 640 → 640×640；列高 400/400/640 →
    // H=640 → col1 f=1.6 → c1 640×640、col2 f=1.6 → c2 1024×640、col3 跳过
    await t.evalJs("window.mergeCards(document.querySelectorAll('.grid-card')[2], document.querySelectorAll('.grid-card')[1])");
    await sleep(200);
    g = await geoOf(t);
    const c1 = cardOf(g, 'c1'), c2 = cardOf(g, 'c2'), c3 = cardOf(g, 'c3');
    check('C1 并入卡挤到组宽 640×640', c3.w === 640 && c3.h === 640, c3.w + '×' + c3.h);
    check('C1b 矮列 c1 等比放大 640×640', c1.w === 640 && c1.h === 640 && c1.fitW === '640', c1.w + '×' + c1.h);
    check('C1c 矮列 c2 等比放大 1024×640（r1.6 保持）', c2.w === 1024 && c2.h === 640 && near(c2.w / c2.h, 1.6, 0.01),
      c2.w + '×' + c2.h);
    check('C1d 三列底缘齐平 680', near(c1.bottom, 680, 1.5) && near(c2.bottom, 680, 1.5) && near(c3.bottom, 680, 1.5),
      c1.bottom + '/' + c2.bottom + '/' + c3.bottom);
    check('C1e 列间按实际宽度贴齐（c2@680、c3@1704）', near(c2.x, 680, 1) && near(c3.x, 1704, 1), c2.x + '/' + c3.x);

    // 幂等
    await t.evalJs("window.reflowGroup(document.querySelector('.grid-card').dataset.groupId)");
    await sleep(150);
    g = await geoOf(t);
    check('C2 重排幂等（640/1024/640 不变）', cardOf(g, 'c1').w === 640 && cardOf(g, 'c2').w === 1024 && cardOf(g, 'c3').w === 640,
      [cardOf(g, 'c1').w, cardOf(g, 'c2').w, cardOf(g, 'c3').w].join('/'));

    // 拆分 c3：剩余组两列已等高 → 塌合空转，尺寸不回缩也不放大
    await t.evalJs("window.splitCardFromGroup(document.querySelectorAll('.grid-card')[2])");
    await sleep(200);
    g = await geoOf(t);
    check('C3 拆分后 c3 离组、剩余组尺寸不变（640×640 / 1024×640）', cardOf(g, 'c3').g === '' &&
      cardOf(g, 'c1').w === 640 && cardOf(g, 'c2').w === 1024 && cardOf(g, 'c2').h === 640,
      JSON.stringify(g));
    check('C3b 拆分后组背景仍在（2 成员）', (await t.evalJs("document.querySelectorAll('.grid-group-bg').length")) === 1);

    // 草稿往返
    await t.evalJs('window.saveDraft()');
    const d1 = JSON.parse(await t.evalJs("localStorage.getItem('slati_fluidcanvas_draft')"));
    const dc3 = d1.cards.find(c => c.id === 'c3');
    check('C4a 草稿 c3 无 groupId', !dc3.groupId, JSON.stringify(dc3));

    if (!LIVE) { // 陷阱 84：重载往返只跑本地
      await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
      await waitFor(t, "document.querySelectorAll('.grid-card').length === 3", 8000, 'C 重载恢复');
      g = await geoOf(t);
      check('C4 重载不翻倍（c1 640×640、c2 1024×640）', cardOf(g, 'c1').w === 640 && cardOf(g, 'c2').w === 1024 && cardOf(g, 'c2').h === 640,
        cardOf(g, 'c1').w + '/' + cardOf(g, 'c2').w);
    }

    check('C5 无运行时异常', exc.length === 0, exc.join(' | '));
    check('C6 无 console error', err.length === 0, err.join(' | '));
    t.close();
  }

  // ════ 阶段 D：单列组空转（H=colH → 无填满）+ 贴齐堆叠 ════
  {
    const { t, exc, err } = await newPhase('D', [
      flagCard('c1', '1.6', 320, 200, 40, 40),
      flagCard('c2', '1.0667', 320, 300, 40, 260)
    ], 2);
    await t.evalJs("window.mergeCards(document.querySelectorAll('.grid-card')[0], document.querySelectorAll('.grid-card')[1])");
    await waitFor(t, "document.querySelectorAll('.grid-group-bg').length === 1", 4000, 'D 组背景');
    let g = await geoOf(t);
    const d1 = cardOf(g, 'c1'), d2 = cardOf(g, 'c2');
    check('D1 单列不填满（尺寸不变 320×200 / 320×300）', d1.w === 320 && d1.h === 200 && d2.w === 320 && d2.h === 300,
      d1.w + '×' + d1.h + ' / ' + d2.w + '×' + d2.h);
    check('D1b 列内贴齐堆叠（c2 顶 240）', near(d2.y, 240, 1), String(d2.y));
    check('D1c fitW/fitH 未动', d1.fitW === '320' && d2.fitW === '320' && d2.fitH === '300', d1.fitW + '/' + d2.fitW + '/' + d2.fitH);

    await t.evalJs("window.reflowGroup(document.querySelector('.grid-card').dataset.groupId)");
    await sleep(150);
    g = await geoOf(t);
    check('D2 重排幂等（尺寸/堆叠不变）', cardOf(g, 'c2').w === 320 && cardOf(g, 'c2').h === 300 && near(cardOf(g, 'c2').y, 240, 1),
      cardOf(g, 'c2').w + '×' + cardOf(g, 'c2').h + ' @' + cardOf(g, 'c2').y);

    check('D3 无运行时异常', exc.length === 0, exc.join(' | '));
    check('D4 无 console error', err.length === 0, err.join(' | '));
    t.close();
  }

  // ════ 阶段 L：线上精简版（重载类断言跳过——陷阱 84 假会话 401 清会话
  // 门禁送回 locked 页属产品正确行为；线上跑合并填满主链路） ════
  if (LIVE) {
    const { t, exc, err } = await newPhase('L', [
      flagCard('c1', '1', 400, 400, 40, 40),
      flagCard('c2', '1.6', 320, 200, 600, 40)
    ], 2);
    const hasVer = await t.evalJs("document.documentElement.outerHTML.indexOf('v10.28.17') > -1");
    check('L1 线上代码含 v10.28.17', hasVer === true);
    await t.evalJs("window.mergeCards(document.querySelectorAll('.grid-card')[0], document.querySelectorAll('.grid-card')[1])");
    await waitFor(t, "document.querySelectorAll('.grid-group-bg').length === 1", 4000, '线上合并组背景');
    await sleep(200);
    const g = await geoOf(t);
    const l1 = cardOf(g, 'c1'), l2 = cardOf(g, 'c2');
    check('L2 线上矮列等比放大 640×400', l2.w === 640 && l2.h === 400, l2.w + '×' + l2.h);
    check('L3 线上两列底缘齐平', near(l1.bottom, l2.bottom, 1.5), l1.bottom + '/' + l2.bottom);
    check('L4 线上无运行时异常', exc.length === 0, exc.join(' | '));
    check('L5 线上无 console error', err.length === 0, err.join(' | '));
    t.close();
  }

  chrome.kill();
  if (!LIVE) server.close();
  await sleep(300);
  try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch (e) {}

  console.log('\n结果：' + pass.length + ' 通过 / ' + fail.length + ' 失败');
  if (fail.length) { console.log('失败项：'); fail.forEach(f => console.log(f)); }
  process.exit(fail.length ? 1 : 0);
}

main().catch(e => { console.error('电池崩溃:', e && e.message); process.exit(2); });
