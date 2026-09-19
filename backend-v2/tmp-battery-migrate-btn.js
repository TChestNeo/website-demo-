// tmp-battery-migrate-btn.js — Migrate 按钮换肤电池（v10.28.17.4 同轮修正版；
//   v0.2.45.2/v10.28.34.2 复跑适配：①2026-09-11 v0.2.28.15 用户定制（1d7e823）——
//   白面板（黑→白）+字母黑白相反滤镜+尺寸对齐 .btn-sm（span 7px 16px）——
//   B4/B7 断言更新 + 新钉 B7b/C4 反色滤镜两态；②悬停断言固定 sleep 改轮询
//   （陷阱 90：forcePseudoState 生效落在渲染循环，固定 450ms 踩 0.3/0.4s
//   transition 竞态——Q1/R3/C1 偶发读到起点矩阵假红）；③A1 版本 v10.28.34.2）
// 用户（2026-09-02）：「再把Migrate按钮的Ui 改成这个」（给 CSS：cssbuttons-io 紫渐变
// 代码按钮）+ 同轮纠正「不是啊我是说顶部的那个Migrate 不是Migrate to Cards 啊」+
// 同轮二修「那个大小调一下这有点太大了」。
// 最终口径：顶部 editor-header 的 Migrate 按钮 = cssbuttons-io（紫渐变底+ghostwhite 字
// +</> 图标+悬停白面板 skew(30deg) 横扫+按下 0.95，亮/暗共用零覆写；字号 12px+
// span 7px 16px 对齐兄弟 .btn-sm）；弹窗内 Migrate to Cards = 还原 v10.28.17.3
// Uiverse 药丸（.migrate-pill 独立类，药丸近黑/白字/星芒三路径/悬停紫渐变层光环
// 放大 1.1/暗主题翻浅）。迁移逻辑零改动回归。
// 跑法：node tmp-battery-migrate-btn.js（LIVE_BASE=<完整站点 URL> 跑线上）
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

function emptyDraft() {
  return { v: 9, title: 'migrate-btn-test', tags: [], cards: [],
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
// 顶部钮核心 computed：紫渐变底、ghostwhite 字、span 内边距、::before 黑面板位置（skew/横扫）、
// 图标 fill currentColor 解析值、钮宽（translate3d 100% 期望 tx=1.2×钮宽）
const PROBE_TOP = `(function () {
  var b = document.querySelector('.migrate-btn');
  if (!b) return JSON.stringify({ absent: true });
  var cs = getComputedStyle(b);
  var before = getComputedStyle(b, '::before');
  var span = b.querySelector('span');
  var paths = b.querySelectorAll('svg path');
  function matrixTf(s) {
    var m = s && s.match(/matrix\\(([^)]+)\\)/);
    if (!m) return null;
    return m[1].split(',').map(function (x) { return parseFloat(x); });
  }
  var sib = document.querySelector('.editor-header .btn-outline.btn-sm'); // History 钮（避开返回键 .btn-icon 40px 高度）
  return JSON.stringify({
    bg: cs.backgroundImage,
    color: cs.color,
    fontSize: cs.fontSize,
    radius: cs.borderRadius,
    btnTf: cs.transform,
    spanPadding: span ? getComputedStyle(span).padding : '',
    spanFilter: span ? getComputedStyle(span).filter : '',
    beforeBg: before.backgroundColor,
    beforeTf: before.transform,
    beforeMtx: matrixTf(before.transform),
    iconFill: paths.length > 1 ? getComputedStyle(paths[1]).fill : '',
    btnW: b.getBoundingClientRect().width,
    btnH: b.getBoundingClientRect().height,
    sibH: sib ? sib.getBoundingClientRect().height : 0
  });
})()`;

// 药丸钮（弹窗内）核心 computed：::before 药丸底色、::after overlay 透明度、星芒路径色、
// 按钮缩放、悬停紫环 box-shadow
const PROBE_PILL = `(function () {
  var b = document.querySelector('.migrate-pill');
  if (!b) return JSON.stringify({ absent: true });
  var cs = getComputedStyle(b);
  var before = getComputedStyle(b, '::before');
  var after = getComputedStyle(b, '::after');
  var paths = b.querySelectorAll('.sparkle .path');
  return JSON.stringify({
    pillTf: cs.transform,
    beforeBg: before.backgroundColor,
    beforeShadow: before.boxShadow,
    afterOpacity: after.opacity,
    pathFill: paths.length ? getComputedStyle(paths[0]).fill : '',
    textColor: b.querySelector('.text_button') ? getComputedStyle(b.querySelector('.text_button')).color : '',
    textBg: b.querySelector('.text_button') ? getComputedStyle(b.querySelector('.text_button')).backgroundImage : ''
  });
})()`;

async function probeOf(t, probe) { return JSON.parse(await t.evalJs(probe)); }

async function forcePseudo(t, nodeSelector, classes) {
  const { root } = await t.send('DOM.getDocument');
  const { nodeId } = await t.send('DOM.querySelector', { nodeId: root.nodeId, selector: nodeSelector });
  await t.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: classes });
}

// 陷阱 90（根治）：headless 渲染循环节流冻结 transition 时钟（Cdbg 实证 2.3s+ 才吐一帧，
// --disable-frame-rate-limit 与输入事件补帧均无效）——注入 transition:none !important 让悬停
// 终态在 style recalc 即刻落位，轮询只验证 :hover 终态 CSS；动画平滑度留给用户肉眼复核。
// 陷阱 93：readyExpr 里的正则字符串内要 `\\(` 转义（写成 `\\\\` 会匹配「字面反斜杠」永不命中）。
async function forcePseudoSettled(t, nodeSelector, classes, readyExpr, timeout, label) {
  try { await t.evalJs("if (!document.getElementById('mn-test-noanim')) { var s = document.createElement('style'); s.id = 'mn-test-noanim'; s.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }'; document.head.appendChild(s); }"); } catch (e) {}
  await forcePseudo(t, nodeSelector, classes);
  const t0 = Date.now();
  while (Date.now() - t0 < (timeout || 4000)) {
    try { if (await t.evalJs('!!(' + readyExpr + ')')) return; } catch (e) {}
    await sleep(120);
  }
  throw new Error('forcePseudoSettled 超时: ' + label);
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

  // 陷阱 91：/json/new 建的 tab 可能落后台，forcePseudoState 的悬停伪类在后台 tab 不生效
  // （kill-style 注入 + transition:none 后轮询 64 轮仍 rest 态实证）——改用 /json/list
  // 既有 front page（tmp-debug-c.js 同款先例，poll#1 即终态）。
  const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
  const info = pages.find(x => x.type === 'page');
  const t = new CDP(info.webSocketDebuggerUrl);
  await t.connect();
  await t.send('Page.enable');
  await t.send('Runtime.enable');
  await t.send('Log.enable');
  await t.send('DOM.enable');
  await t.send('CSS.enable');
  await t.send('Page.bringToFront');
  await t.send('Emulation.setFocusEmulationEnabled', { enabled: true }); // 防 headless 后台节流冻结 transition 时钟

  const exc = [], err = [];
  t.on('Runtime.exceptionThrown', p => exc.push((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || '?'));
  t.on('Log.entryAdded', p => {
    const e = p.entry;
    if (e.level === 'error' && e.url && e.url.indexOf('/api') === -1 && e.url.indexOf('favicon') === -1) err.push(e.url + ' :: ' + e.text);
  });

  const BASE = LIVE || ('http://127.0.0.1:' + PORT);
  const seedJs = `localStorage.setItem('slati_session', JSON.stringify({loggedIn:true}));
    localStorage.setItem('slati_user', JSON.stringify({id:'USR-batt', displayName:'Battery Tester', tier:'premium'}));
    localStorage.setItem('slati_fluidcanvas_draft', JSON.stringify(${JSON.stringify(emptyDraft())}));`;
  if (LIVE) {
    await t.send('Page.addScriptToEvaluateOnNewDocument', { source: 'try { ' + seedJs + ' } catch (e) {}' });
    await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
  } else {
    await t.send('Page.navigate', { url: BASE + '/' });
    // 陷阱 92：about:blank 的 readyState 立即是 complete，等 readyState 会秒过 → seed 在
    // about:blank 上写 localStorage 抛 SecurityError（竞态，/json/list 时序下现形）。
    // 改等站点专属标记（根页加载 site-config.js 才存在）。
    await waitFor(t, "typeof window.MN_SITE_VERSION !== 'undefined'", 8000, '根页');
    await t.evalJs(seedJs);
    await t.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
  }
  await waitFor(t, "typeof openModal === 'function'", 8000, '编辑器脚本就绪');
  await sleep(800); // 画布加载 settle（陷阱 86）

  // ════ A：顶部按钮结构 + 版本 ════
  check('A1 版本 v10.28.34.2', (await t.evalJs('window.FLUIDCANVAS_VERSION')) === 'v10.28.34.2',
    String(await t.evalJs('window.FLUIDCANVAS_VERSION')));
  const structTop = JSON.parse(await t.evalJs(`(function () {
    var b = document.querySelector('.migrate-btn');
    return JSON.stringify({
      exists: !!b,
      visible: b ? b.offsetParent !== null : false,
      inHeader: b ? !!b.closest('.editor-header') : false,
      span: b ? b.querySelectorAll('span').length : 0,
      svg: b ? b.querySelectorAll('svg').length : 0,
      paths: b ? b.querySelectorAll('svg path').length : 0,
      text: b ? b.querySelector('span').textContent.trim() : '',
      onclick: b ? (b.getAttribute('onclick') || '') : ''
    });
  })()`));
  check('A2 顶部按钮存在且可见（页头内、弹窗未开）', structTop.exists && structTop.visible && structTop.inHeader, JSON.stringify(structTop));
  check('A3 层结构：span 1 / svg 1 / path 2 / 文案 Migrate', structTop.span === 1 && structTop.svg === 1 && structTop.paths === 2 && structTop.text === 'Migrate',
    structTop.span + '/' + structTop.svg + '/' + structTop.paths + '/' + structTop.text);
  check('A4 onclick 开 migrateModal', structTop.onclick.indexOf("openModal('migrateModal')") > -1, structTop.onclick);

  // ════ B：顶部钮静息态 ════
  let pr = await probeOf(t, PROBE_TOP);
  check('B1 紫渐变底（#8e2de2→#4a00e0）', pr.bg.indexOf('linear-gradient(to right, rgb(142, 45, 226), rgb(74, 0, 224))') > -1, pr.bg.slice(0, 70));
  check('B2 文字 ghostwhite', pr.color === 'rgb(248, 248, 255)', String(pr.color));
  check('B3 字号 12px（对齐 .btn-sm）', pr.fontSize === '12px', String(pr.fontSize));
  const padTop = pr.spanPadding ? parseFloat(pr.spanPadding.split(' ')[0]) : 0;
  check('B4 span 内边距 7px 16px（v0.2.28.15 对齐 .btn-sm）', Math.abs(padTop - 7) < 0.2, pr.spanPadding);
  check('B5 高度对齐兄弟 .btn-sm（差 <3px）', Math.abs(pr.btnH - pr.sibH) < 3, pr.btnH + ' vs ' + pr.sibH);
  check('B6 白面板静息 skew(30deg)（matrix c 位 0.5773）', pr.beforeMtx && Math.abs(pr.beforeMtx[2] - 0.57735) < 0.01, pr.beforeTf);
  check('B7 面板纯白（v0.2.28.15 用户定制：黑→白）', pr.beforeBg === 'rgb(255, 255, 255)', String(pr.beforeBg));
  check('B7b 字母反色滤镜 invert(1)（白面板上黑字）', pr.spanFilter === 'invert(1)', String(pr.spanFilter));
  check('B8 图标 fill=currentColor 解析为 ghostwhite', pr.iconFill === 'rgb(248, 248, 255)', String(pr.iconFill));
  check('B9 静息按钮无缩放', pr.btnTf === 'none' || pr.btnTf === 'matrix(1, 0, 0, 1, 0, 0)', String(pr.btnTf));
  check('B10 药丸圆角 9999px（computed 钳到半高 18px）', pr.radius === '18px' || pr.radius === '9999px', String(pr.radius));

  // ════ C：顶部钮悬停 → 白面板从左扫到右（轮询到横扫终态再读数） ════
  // 陷阱 93：readyExpr 正则双重转义——字符串内 `\\\\` 变 `\\`，正则匹配「matrix+字面反斜杠」
  // 永不命中 → 轮询即使读到终态也返回 false（与 transition 冻结叠加，一直误判为冻结）。
  // 字符串内需 `\\(`（转义左括号）。PROBE_TOP 的 matrixTf 同款写法是对的。
  await forcePseudoSettled(t, '.migrate-btn', ['hover'],
    "(function(){ var m = getComputedStyle(document.querySelector('.migrate-btn'), '::before').transform; var a = m.match(/matrix\\(([^)]+)\\)/); return a && parseFloat(a[1].split(',')[4]) > 0; })()",
    8000, 'C 面板横扫');
  pr = await probeOf(t, PROBE_TOP);
  const mtx = pr.beforeMtx || [0, 0, 0, 0, 0, 0];
  const expectTx = pr.btnW * 1.2; // translate3d(100%) 的 % 相对 ::before 自身盒（=钮宽 120%）
  check('C1 面板横扫到位（tx ≈ 1.2×钮宽）', Math.abs(mtx[4] - expectTx) < 2, mtx.join(',') + ' vs ' + expectTx.toFixed(1));
  check('C2 横扫后 skew 消失（矩阵为纯平移：c/b≈0、对角≈1）', Math.abs(mtx[1]) < 0.001 && Math.abs(mtx[2]) < 0.001 && Math.abs(mtx[0] - 1) < 0.001 && Math.abs(mtx[3] - 1) < 0.001, mtx.join(','));
  check('C3 悬停底纹不变（紫渐变仍在）', pr.bg.indexOf('linear-gradient(to right, rgb(142, 45, 226), rgb(74, 0, 224))') > -1, pr.bg.slice(0, 60));
  check('C4 悬停字母滤镜翻回 invert(0)（白字上紫底）', pr.spanFilter === 'invert(0)', String(pr.spanFilter));
  await forcePseudo(t, '.migrate-btn', []);

  // ════ D：顶部钮按下 → scale(0.95) ════
  await forcePseudo(t, '.migrate-btn', ['active']);
  await sleep(100);
  pr = await probeOf(t, PROBE_TOP);
  check('D1 按下缩小 0.95', pr.btnTf === 'matrix(0.95, 0, 0, 0.95, 0, 0)', String(pr.btnTf));
  await forcePseudo(t, '.migrate-btn', []);

  // ════ E：顶部钮暗主题零覆写 ════
  await t.evalJs("document.documentElement.setAttribute('data-theme', 'dark')");
  await sleep(100);
  pr = await probeOf(t, PROBE_TOP);
  check('E1 暗主题同款紫渐变底', pr.bg.indexOf('linear-gradient(to right, rgb(142, 45, 226), rgb(74, 0, 224))') > -1, pr.bg.slice(0, 60));
  check('E2 暗主题文字仍 ghostwhite', pr.color === 'rgb(248, 248, 255)', String(pr.color));
  await t.evalJs("document.documentElement.setAttribute('data-theme', 'light')");

  // ════ F0：顶部钮点击开弹窗 ════
  await t.evalJs("document.querySelector('.migrate-btn').click()");
  await sleep(300);
  const modalOpen = await t.evalJs("document.getElementById('migrateCard').classList.contains('active')");
  check('F0 顶部钮点击 → migrateModal 打开', modalOpen === true, String(modalOpen));

  // ════ A5：弹窗钮（药丸）结构 ════
  const structPill = JSON.parse(await t.evalJs(`(function () {
    var b = document.querySelector('.migrate-pill');
    return JSON.stringify({
      exists: !!b,
      visible: b ? b.offsetParent !== null : false,
      dots: b ? b.querySelectorAll('.dots_border').length : 0,
      sparkle: b ? b.querySelectorAll('.sparkle').length : 0,
      paths: b ? b.querySelectorAll('.sparkle .path').length : 0,
      text: b && b.querySelector('.text_button') ? b.querySelector('.text_button').textContent.trim() : '',
      onclick: b ? (b.getAttribute('onclick') || '') : ''
    });
  })()`));
  check('A5 药丸钮存在且可见（弹窗内）', structPill.exists && structPill.visible, JSON.stringify(structPill));
  check('A6 层结构：dots 1 / sparkle 1 / path 3 / 文案', structPill.dots === 1 && structPill.sparkle === 1 && structPill.paths === 3 && structPill.text === 'Migrate to Cards',
    structPill.dots + '/' + structPill.sparkle + '/' + structPill.paths + '/' + structPill.text);
  check('A7 onclick 仍绑 runMigration', structPill.onclick.indexOf('runMigration()') > -1, structPill.onclick);

  // ════ P：药丸钮亮主题静息（v10.28.17.3 还原回归） ════
  let pp = await probeOf(t, PROBE_PILL);
  check('P1 药丸近黑底（rgb(31,31,31)）', pp.beforeBg === 'rgb(31, 31, 31)', String(pp.beforeBg));
  check('P2 星芒路径白色（currentColor）', pp.pathFill === 'rgb(255, 255, 255)', String(pp.pathFill));
  check('P3 静息缩放 1（无悬停）', pp.pillTf === 'matrix(1, 0, 0, 1, 0, 0)', String(pp.pillTf));
  check('P4 文字渐变裁切（color transparent）', pp.textColor === 'rgba(0, 0, 0, 0)', String(pp.textColor));

  // ════ Q：药丸悬停 → 紫色渐变层/光环/放大 1.1（轮询到 1.1 终态再读数） ════
  await forcePseudoSettled(t, '.migrate-pill', ['hover'],
    "(function(){ var p = document.querySelector('.migrate-pill'); return p && p.matches(':hover') && getComputedStyle(p).transform === 'matrix(1.1, 0, 0, 1.1, 0, 0)'; })()",
    4000, 'Q 药丸悬停放大');
  pp = await probeOf(t, PROBE_PILL);
  check('Q1 悬停放大 1.1', pp.pillTf === 'matrix(1.1, 0, 0, 1.1, 0, 0)', String(pp.pillTf));
  check('Q2 悬停紫渐变 overlay 现身（opacity 1）', pp.afterOpacity === '1', String(pp.afterOpacity));
  check('Q3 悬停紫环 6px', pp.beforeShadow.indexOf('6px') > -1, pp.beforeShadow.slice(0, 90));
  await forcePseudo(t, '.migrate-pill', []);

  // ════ R：药丸暗主题（翻浅药丸+深紫星芒） ════
  await t.evalJs("document.documentElement.setAttribute('data-theme', 'dark')");
  await sleep(450); // 药丸 ::before transition all 0.3s——切主题必须 sleep >300ms（陷阱 90）
  pp = await probeOf(t, PROBE_PILL);
  check('R1 暗主题药丸翻浅 #f2f1fb', pp.beforeBg === 'rgb(242, 241, 251)', String(pp.beforeBg));
  check('R2 暗主题星芒深紫', pp.pathFill === 'rgb(87, 48, 166)', String(pp.pathFill));
  await forcePseudoSettled(t, '.migrate-pill', ['hover'],
    "(function(){ var p = document.querySelector('.migrate-pill'); return p && p.matches(':hover') && getComputedStyle(p).transform === 'matrix(1.1, 0, 0, 1.1, 0, 0)'; })()",
    4000, 'R 暗主题药丸悬停放大');
  pp = await probeOf(t, PROBE_PILL);
  check('R3 暗主题悬停仍放大 1.1', pp.pillTf === 'matrix(1.1, 0, 0, 1.1, 0, 0)', String(pp.pillTf));
  await forcePseudo(t, '.migrate-pill', []);
  await t.evalJs("document.documentElement.setAttribute('data-theme', 'light')");

  // ════ S：点击仍触发 runMigration（逻辑零改动回归） ════
  await t.evalJs("document.querySelector('.migrate-pill').click()");
  await sleep(200);
  const toast1 = await t.evalJs("document.getElementById('toast').textContent");
  check('S1 空文本点击 → 拦截 toast', toast1.indexOf('Nothing to migrate') > -1, toast1);
  await t.evalJs("document.getElementById('migrateText').value = '## Hello\\nSome body text'");
  await t.evalJs("document.querySelector('.migrate-pill').click()");
  await waitFor(t, "document.querySelectorAll('.grid-card').length === 1", 4000, '建卡');
  const after = JSON.parse(await t.evalJs(`(function () {
    var m = document.getElementById('migrateModal');
    return JSON.stringify({
      cards: document.querySelectorAll('.grid-card').length,
      cardActive: m.querySelector('.modal-card').classList.contains('active'),
      backdropActive: document.getElementById('modalBackdrop').classList.contains('active'),
      title: (document.querySelector('.card-text-content') || {}).textContent || ''
    });
  })()`));
  check('S2 填文本点击 → 建 1 卡 + 弹窗关闭（.active 类全撤）', after.cards === 1 && !after.cardActive && !after.backdropActive, JSON.stringify(after));
  check('S3 内容卡标题/正文正确迁移', after.title.indexOf('Hello') > -1 && after.title.indexOf('Some body text') > -1, after.title.slice(0, 50));

  check('G1 无运行时异常', exc.length === 0, exc.join(' | ').slice(0, 200));
  check('G2 无 console error', err.length === 0, err.join(' | ').slice(0, 200));

  console.log('\n════════ 汇总 ════════');
  console.log('通过 ' + pass.length + ' / 失败 ' + fail.length);
  t.close();
  chrome.kill();
  if (!LIVE) server.close();
  process.exit(fail.length ? 1 : 0);
}

main().catch(e => { console.error('电池崩溃:', e); process.exit(2); });
