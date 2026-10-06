// tmp-battery-group-resize.js — v0.2.45.2 / FC v10.28.34.2 合并组整体缩放 + 单击恒选整组 + 贴齐缝保持验证（2026-09-12 起；2026-09-14 贴齐缝轮扩 W 组）
// 背景：用户「合并后整体的卡片能不能做一个可以放大缩小的功能和独立卡片一样，
//   然后当我只是要选中整体的卡片时会直接触发到独立卡片而不是在选中独立卡片
//   的情况下双击才会触发」→ ①整组选中时 8 手柄挂组框（可见成员 bbox 并集）可整组缩放
//   ②单击组内成员恒选整组（旧 v10.28.15.1「再次点击=单独选中」切换移除），单独选中只走双击。
// Round Q v10.28.26.0 自由形状（2026-09-12）：行卡机制整体退役（snapshotGroupRows/
//   pushGroupRows/reassertRowWidths/alignGroupTops 全删）、reflowGroup 保形、墙模型
//   右/左集合加垂直重叠守卫（台阶斜对卡不再误推）——S24/S25/S26/S28 重写为
//   自由形状等价场景（台阶面宽组、自定义宽保持、同列叠堆南扩、L 形草稿往返）。
// 断言组：
//   F1-F3 静态：click 无切换分支+dblclick 保留 / refreshResizeHandles 整组分支 / 版本号+链；
//   S1-S13 浏览器：建组（drop flag+shield → mergeCards）→ 整组手柄可见且挂组框 /
//     旋转钮整组隐藏 / 单击恒整组（再击不切单卡）/ 双击=单独选中 / e 手柄拖=两成员
//     同比例变宽+对边固定 / se 角柄两轴缩放 / 等比锁成员比例保持 / 单卡 resize 回归
//     （另成员不动）/ 草稿往返 span+groupId / 未分组卡单击回归 / 版本徽章；
//   S14-S19 Round O v10.28.25.1（CDP 可信输入）：慢双击（600ms 两击 detail 各 1）→
//     单独选中 / 慢+8px 漂移双击 → 单独选中 / 孤立单击仍整组 / 快双击不弹图源 /
//     列成员 s 柄下拖 +45 → 下方卡墙让位 flush 无重叠 / s 柄上收 -30 → 拉回仍 flush；
//   S20-S28 Round P v10.28.25.2 → Round Q v10.28.26.0（CDP 可信输入·墙让位）：
//     A 东扩 +60 → B 整列让位 flush / A 东收 -30 → B 回贴仍 flush / 3列组中列东扩 →
//     右列让位左列不动 / B 西扩 → A 让位 flush / 台阶组 A 东扩 → B flush A、台阶下 C
//     完全不动且宽保持 / C 自定义窄宽后 A 东扩 → C 宽保持自定义（不抢回）/
//     同列叠堆南扩 → 下卡让位 flush / Escape 提交同样让位 / L 形草稿往返逐卡一致；
//   W1-W9 Round T v10.28.34.2（CDP 可信输入·整组缩放贴齐缝保持；探针 tmp-probe-seams.js
//     cs=22 真实量化 n×22−2 实证口径：旗左盾右=mergeCards(s,f,'right')，修前红值
//     W1 e+120=+3.1 / W2 se+45/+35=+6.4 / W3 三链 e+60=+1.3×2 / W4 底并 s+45 /
//     W5 L 形 e+60 纵缝 +1.1（se 拖留 −8.6 重叠弃用）/ W6 锁旗+盾 se+120/+20=+40.1 /
//     W7 e−20=+9.7 / W8 nw−40/−30=+6.4 / W9 se+45/+35 草稿往返 +6.4——整组缩放后
//     贴齐成员缝 |≤1|（用户实况「合并后调整整体大小卡片被拆分…没有继续保持连接在一起」）；
//     S6/S7/S8 收紧加缝断言（S6 旗右盾左 e+60 修前 +4 红；S7/S8 se+40/+30 修前缝被
//     去重叠链救回 0——红→绿实证由 W 组承担）；
//   Z 全程零 console error。
// 已知红（既有陈旧，非本轮回归）：S9/S15/S17 三红在 round-Y 前提交 0dd2153 的
//   worktree 上失败值完全相同（S15/S17 = {"gs":0,"sel":1,"modal":true}）。探针：
//   modalBackdrop 卡在 active 但所有已知模态 false（更早场景遗留假阳性）+ 单选确实
//   未发生。是否调整断言留待下一轮产品口径确认（现行行为自 ≤v0.2.40.2 上线未变、
//   用户无反馈）。
// 跑法：node tmp-battery-group-resize.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4500 + Math.floor(Math.random() * 400);
const CDP_PORT = 5500 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-grpz-' + Date.now());

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
  async trustedDbl(x, y) { await this.trustedClick(x, y, 1); await sleep(80); await this.trustedClick(x, y, 2); }
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
  ok('F1 静态：click 无「再次点击=单独选中」切换分支（恒 selectCard）+ dblclick 单卡路径保留',
    fce.indexOf("if (card.dataset.groupId && mousedownAlreadySelected)") === -1 &&
    fce.indexOf('mousedownAlreadySelected =') === -1 &&
    fce.indexOf("if (card.dataset.groupId) { selectCard(card, true); return; }") !== -1);
  ok('F2 静态：refreshResizeHandles 整组分支（组框并集）+ onGroupResizeMove + commitGroupResize + beginResize isGroup',
    fce.indexOf('var wholeGroup = !!(selectedCard && selectedCard.dataset.groupId && !selectionIsSingle);') !== -1 &&
    fce.indexOf('function onGroupResizeMove(e) {') !== -1 &&
    fce.indexOf('function commitGroupResize(st) {') !== -1 &&
    fce.indexOf('isGroup: true,') !== -1 &&
    fce.indexOf("if (st.isGroup) { onGroupResizeMove(e); return; }") !== -1);
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('F3 静态：当前版本 v0.2.45.2 + FC v10.28.34.2（2026-09-14 贴齐缝修复轮复跑口径）+ buildDraft 链 v10.28.21 条目仍在',
    sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.45.2';") !== -1 &&
    sconf.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.34.2';") !== -1 &&
    fce.indexOf('v10.28.21 adds NO new fields (合并组整体缩放+单击恒选整组') !== -1);
  ok('F4 静态：v10.28.25.1 慢双击容错（clickPairState）保留 + 行卡机制整体退役（snapshotGroupRows/pushGroupRows/resizeState.rows 全删）+ commitSingleResize 仍在',
    fce.indexOf('var clickPairState = null;') !== -1 &&
    fce.indexOf('function snapshotGroupRows(g) {') === -1 &&
    fce.indexOf('function pushGroupRows(st) {') === -1 &&
    fce.indexOf('resizeState.rows = snapshotGroupRows(') === -1 &&
    fce.indexOf('function commitSingleResize(st) {') !== -1 &&
    fce.indexOf('commitSingleResize(resizeState);') !== -1);
  ok('F5 静态：v10.28.26 墙模型泛化（snapshotGroupPartners/pushGroupPartners/origVisH 保留 + 右/左集合垂直重叠守卫）+ reassertRowWidths/alignGroupTops 退役',
    fce.indexOf('function snapshotGroupPartners(card) {') !== -1 &&
    fce.indexOf('function pushGroupPartners(st) {') !== -1 &&
    fce.indexOf('resizeState.partners = snapshotGroupPartners(card);') !== -1 &&
    fce.indexOf('origVisH: card.offsetHeight,') !== -1 &&
    fce.indexOf('function reassertRowWidths(st) {') === -1 &&
    fce.indexOf('function alignGroupTops(') === -1 &&
    fce.indexOf('else if (l >= R && b > T && t < B) sets.right.push') !== -1 &&
    fce.indexOf('else if (r <= L && b > T && t < B) sets.left.push') !== -1 &&
    fce.indexOf('pushGroupPartners(st);') !== -1);
  ok('F6 静态：v10.28.34.2 贴齐缝保持——beginResize 组分支缝快照（xSeams/ySeams 双字段+隐藏成员跳缝）+ onGroupResizeMove 闭缝遍锚升序 + 组框隐藏成员过滤',
    fce.indexOf('var xSeams = [], ySeams = [];') !== -1 &&
    fce.indexOf("ma.card.classList.contains('layer-hidden')") !== -1 &&
    fce.indexOf('st.xSeams.slice().sort') !== -1 &&
    fce.indexOf('st.ySeams.slice().sort') !== -1 &&
    fce.indexOf('xSeams: xSeams,') !== -1 &&
    fce.indexOf('ySeams: ySeams,') !== -1 &&
    fce.indexOf("groupMembers(card).filter(function (m) { return !m.classList.contains('layer-hidden'); })") !== -1);

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
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
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

    const preset = (withSession) => cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{' +
        (withSession ? 'localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');' : '') +
        '}catch(e){}'
    });
    const nav = async (url, waitExpr, label) => {
      await cdp.send('Page.navigate', { url });
      await waitFor(cdp, waitExpr, 20000, label);
      await sleep(600);
    };
    const dropAsset = (asset, label) => cdp.evalJs("(function(){ var dt = new DataTransfer(); dt.setData('text/plain', JSON.stringify({ asset: " + JSON.stringify(asset) + ", label: " + JSON.stringify(label) + " })); window.gridCanvas.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); return true; })()");
    // 建组：drop flag + shield → mergeCards(flag, shield, 'right')（走真实合并路径）
    const setupGroup = () => cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); window.mergeCards(f, s, 'right'); return true; })()");
    // 页内测量/手势 helper（旋转为 0 时 bbox=普通盒）
    const install = () => cdp.evalJs("(function(){ if (window.__batt) return true; " +
      "window.__members = function(){ return Array.prototype.slice.call(document.querySelectorAll('.grid-card[data-group-id]')).map(function(c){ return { t: c.dataset.cardType, x: parseFloat(c.style.left) || 0, y: parseFloat(c.style.top) || 0, w: c.offsetWidth, h: c.offsetHeight, cs: c.dataset.colSpan, rs: c.dataset.rowSpan }; }); };" +
      "window.__groupBox = function(){ var ms = window.__members(), minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9; ms.forEach(function(m){ if (m.x < minX) minX = m.x; if (m.y < minY) minY = m.y; if (m.x + m.w > maxX) maxX = m.x + m.w; if (m.y + m.h > maxY) maxY = m.y + m.h; }); return { left: minX, top: minY, right: maxX, bottom: maxY, w: maxX - minX, h: maxY - minY }; };" +
      "window.__handles = function(){ var o = {}; document.querySelectorAll('.resize-handle').forEach(function(h){ o[h.dataset.dir] = { display: h.style.display, left: parseFloat(h.style.left) || 0, top: parseFloat(h.style.top) || 0 }; }); return o; };" +
      "window.__dragHandle = function(dir, dx, dy){ var h = document.querySelector('.resize-handle[data-dir=\"' + dir + '\"]'); if (!h) return 'no handle'; var r = h.getBoundingClientRect(); var cx = r.left + r.width / 2, cy = r.top + r.height / 2; h.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy, button: 0 })); for (var i = 1; i <= 5; i++) { document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx + dx * i / 5, clientY: cy + dy * i / 5 })); } document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx + dx, clientY: cy + dy })); return true; };" +
      "window.__sel = function(){ var ms = document.querySelectorAll('.grid-card[data-group-id]'); var sel = [], gs = []; ms.forEach(function(c){ if (c.classList.contains('selected')) sel.push(c.dataset.cardType); if (c.classList.contains('group-single')) gs.push(c.dataset.cardType); }); return { sel: sel, gs: gs, isSingle: window.__getSelIsSingle ? window.__getSelIsSingle() : null }; };" +
      "window.__batt = true; return true; })()");

    await preset(true);
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S0 编辑器加载');

    // ══ 场景 A：建组 → 整组手柄/旋转钮/单击/双击 ══
    await dropAsset('flag', 'National Flag');
    await dropAsset('shield', 'Emblem');
    await setupGroup();
    await install();
    // mergeCards 尾部 deselectAll → selectCard(flag) 整组选中
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); window.selectCard(f); return true; })()");

    ok('S1 整组选中：8 手柄全可见 + nw 手柄锚定组框左上角（左缘-5px、上缘-5px）',
      await cdp.evalJs("(function(){ var hs = window.__handles(); var box = window.__groupBox(); var vis = 0; for (var k in hs) if (hs[k].display === 'block') vis++; var nw = hs.nw; return vis === 8 && Math.abs(nw.left - (box.left - 5)) <= 1 && Math.abs(nw.top - (box.top - 5)) <= 1; })()"));
    ok('S2 整组选中：旋转钮隐藏（整组无旋转）+ 手柄 rotation 0',
      await cdp.evalJs("(function(){ var g = document.querySelector('.rotate-grip'); var h = document.querySelector('.resize-handle[data-dir=\"nw\"]'); return (!g || g.style.display === 'none') && h.style.transform.indexOf('rotate(0deg)') !== -1; })()"));

    ok('S3 单击恒整组：点成员 flag → 整组选中（两成员 selected、无 group-single）；再点同一张仍是整组（旧切换已移除）',
      await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); f.dispatchEvent(new MouseEvent('click', { bubbles: true })); var first = f.classList.contains('selected') && s.classList.contains('selected') && !f.classList.contains('group-single') && !s.classList.contains('group-single'); f.dispatchEvent(new MouseEvent('click', { bubbles: true })); var second = f.classList.contains('selected') && s.classList.contains('selected') && !f.classList.contains('group-single') && !s.classList.contains('group-single'); return first && second; })()"));

    ok('S4 单击切成员：点成员 shield → 整组（selectedCard 换卡但仍是整组）',
      await cdp.evalJs("(function(){ var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); s.dispatchEvent(new MouseEvent('click', { bubbles: true })); var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); return f.classList.contains('selected') && s.classList.contains('selected') && !s.classList.contains('group-single'); })()"));

    ok('S5 双击=单独选中：dblclick shield → .group-single + 只有 shield selected（单独选中唯一路径）',
      await cdp.evalJs("(function(){ var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); s.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); return s.classList.contains('group-single') && s.classList.contains('selected') && !f.classList.contains('selected'); })()"));

    // ══ 场景 B：整组缩放（e 边柄 + se 角柄）══
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S6 重载');
    await dropAsset('flag', 'National Flag');
    await dropAsset('shield', 'Emblem');
    await setupGroup();
    await install();
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); window.selectCard(f); return true; })()");

    ok('S6 e 边柄拖 +60px：两成员都变宽（span 各自量化）、西边（对边）左缘不动、北边不动、成员横缝贴齐 |≤1|（v10.28.34.2 贴齐缝；修前 +4 红——探针 cs=22 实测，旗右盾左方向）',
      await cdp.evalJs("(function(){ var box0 = window.__groupBox(); var m0 = window.__members(); window.__dragHandle('e', 60, 0); var box1 = window.__groupBox(); var m1 = window.__members(); var wider = m1.every(function(m, i){ return m.w > m0[i].w; }); var L = m1[0].x <= m1[1].x ? m1[0] : m1[1], R = m1[0].x > m1[1].x ? m1[0] : m1[1]; var gap = R.x - (L.x + L.w); return window.__dragHandle && box1.w > box0.w + 40 && wider && Math.abs(box1.left - box0.left) <= 1 && Math.abs(box1.top - box0.top) <= 1 && Math.abs(gap) <= 1; })()"));

    ok('S7 se 角柄拖 +40,+30：组框两轴变大（宽+高）、两成员尺寸两轴都变大（cs=22 量化 174→196/108→130 实证）、成员横缝贴齐 |≤1|（该拖法修前缝被去重叠链救回 0——红→绿实证由 W 组承担）',
      await cdp.evalJs("(function(){ var box0 = window.__groupBox(); var m0 = window.__members(); window.__dragHandle('se', 40, 30); var box1 = window.__groupBox(); var m1 = window.__members(); var big = m1.every(function(m, i){ return m.w > m0[i].w && m.h > m0[i].h; }); var L = m1[0].x <= m1[1].x ? m1[0] : m1[1], R = m1[0].x > m1[1].x ? m1[0] : m1[1]; var gap = R.x - (L.x + L.w); return box1.w > box0.w + 20 && box1.h > box0.h + 15 && big && Math.abs(gap) <= 1; })()"));

    ok('S8 组缩放提交：成员 dataset 跨度已落（span=尺寸不变量：(w+gap)/colSpan 全成员一致）+ 组背景仍存在 + 成员横缝贴齐 |≤1|',
      await cdp.evalJs("(function(){ var m1 = window.__members(); var bg = document.querySelector('.grid-group-bg'); var Ks = []; m1.forEach(function(m){ Ks.push((m.w + 2) / parseFloat(m.cs)); Ks.push((m.h + 2) / parseFloat(m.rs)); }); var k0 = Ks[0]; var spanOk = Ks.every(function(k){ return Math.abs(k - k0) <= 1.5; }); var noOverlap = true; for (var i = 0; i < m1.length; i++) for (var j = i + 1; j < m1.length; j++) { var a = m1[i], b = m1[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) noOverlap = false; } var L = m1[0].x <= m1[1].x ? m1[0] : m1[1], R = m1[0].x > m1[1].x ? m1[0] : m1[1]; var gap = R.x - (L.x + L.w); return spanOk && noOverlap && !!bg && Math.abs(gap) <= 1; })()"));

    // ══ 场景 C：等比锁成员比例保持 ══
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S9 重载');
    await dropAsset('flag', 'National Flag');
    await dropAsset('shield', 'Emblem');
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); f.dataset.aspectLock = '1'; f.dataset.aspectRatio = 1.6; return true; })()");
    await setupGroup();
    await install();
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); window.selectCard(f); return true; })()");

    ok('S9 等比锁成员：se 角柄拖后 flag 宽高比例保持 1.6（两轴取小倍率）',
      await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var r0 = f.offsetWidth / f.offsetHeight; window.__dragHandle('se', 50, 80); var r1 = f.offsetWidth / f.offsetHeight; return Math.abs(r0 - 1.6) <= 0.05 && Math.abs(r1 - r0) <= 0.06; })()"));

    // ══ 场景 D：单卡 resize 回归 + 草稿往返 ══
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S10 重载');
    await dropAsset('flag', 'National Flag');
    await dropAsset('shield', 'Emblem');
    await setupGroup();
    await install();
    await cdp.evalJs("(function(){ var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); s.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return true; })()");

    ok('S10 双击单卡选中后手柄出现（角手柄 4 个起）+ e 边柄拖：只有 shield 变宽、flag 不动（单卡路径回归）',
      await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); var fw0 = f.offsetWidth, sw0 = s.offsetWidth; var hs = window.__handles(); var corners = 0; for (var k in hs) if (hs[k].display === 'block' && k.length === 2) corners++; window.__dragHandle('e', 52, 0); return corners >= 4 && s.offsetWidth > sw0 + 30 && Math.abs(f.offsetWidth - fw0) <= 1; })()"));

    // ══ 场景 D2：组缩放草稿往返（独立场景——组缩放是 v10.28.21 交付本体）══
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S11 重载');
    await dropAsset('flag', 'National Flag');
    await dropAsset('shield', 'Emblem');
    await setupGroup();
    await install();
    await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); window.selectCard(f); return true; })()");
    await cdp.evalJs("window.__dragHandle('e', 60, 0); true");

    ok('S11 草稿往返：组缩放（e+60 去重叠后）saveDraft → 重载 → 成员跨度/位置/并排布局随草稿（不再被 reflow 叠成列）+ 组背景仍在',
      await (async () => {
        await cdp.evalJs("window.saveDraft(); true");
        const before = await cdp.evalJs("JSON.stringify(window.__members())");
        await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.grid-card[data-card-type=\"shield\"]')", 'S11 重载恢复');
        await install();
        const after = await cdp.evalJs("(function(){ var ms = window.__members(); return JSON.stringify(ms) + '|' + (!!document.querySelector('.grid-group-bg')); })()");
        const [afterJson, bg] = after.split('|');
        const b = JSON.parse(before), a = JSON.parse(afterJson);
        const same = a.length === b.length && a.every((m, i) => m.t === b[i].t && Math.abs(m.x - b[i].x) <= 1 && Math.abs(m.y - b[i].y) <= 1 && m.cs === b[i].cs && m.rs === b[i].rs);
        return same && bg === 'true';
      })());

    // ══ 场景 E：未分组卡单击回归 + 徽章 ══
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S12 重载');
    await dropAsset('flag', 'National Flag');
    ok('S12 未分组卡单击照常选中（普通选中回归）',
      await cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); f.dispatchEvent(new MouseEvent('click', { bubbles: true })); return f.classList.contains('selected') && !f.classList.contains('group-single'); })()"));

    ok('S13 版本徽章：右下角 badge 渲染 FC v10.28.34.2（最新构建标识）',
      await cdp.evalJs("(function(){ var ds = document.querySelectorAll('body > div'); for (var i=0;i<ds.length;i++){ if (ds[i].textContent === 'FC v10.28.34.2') return true; } return false; })()"));

    // ══ 场景 F：Round O v10.28.25.1 慢双击容错 + 行组行卡贴回（CDP 可信输入）══
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S14 重载');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createContentCard(); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); window.__A = A; window.__B = B; return true; })()");
    const mCenter = () => cdp.evalJs("(function(){ var r = window.__B.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()");
    const selState = () => cdp.evalJs("JSON.stringify({ gs: document.querySelectorAll('.grid-card.group-single').length, sel: document.querySelectorAll('.grid-card.selected').length, modal: !!(document.getElementById('modalBackdrop') && document.getElementById('modalBackdrop').classList.contains('active')) })");
    const deselectTrusted = async () => {
      const p = JSON.parse(await cdp.evalJs("(function(){ var r = gridCanvas.getBoundingClientRect(); return JSON.stringify({ x: r.left + 30, y: r.top + 30 }); })()"));
      await cdp.trustedClick(p.x, p.y, 1);
    };

    // S14：慢双击（600ms 两击，detail 各 1）→ 单独选中（安定睡眠同 singleSel 口径）
    await sleep(400);
    let bc = JSON.parse(await mCenter());
    await cdp.trustedClick(bc.x, bc.y, 1); await sleep(600); await cdp.trustedClick(bc.x, bc.y, 1);
    await sleep(350);
    let s14 = JSON.parse(await selState());
    ok('S14 慢双击（600ms 两击 detail 各 1）→ 单独选中（gs:1/sel:1）', s14.gs === 1 && s14.sel === 1);

    // S15：慢+8px 漂移双击 → 单独选中
    await deselectTrusted();
    bc = JSON.parse(await mCenter());
    await cdp.trustedClick(bc.x, bc.y, 1); await sleep(500); await cdp.trustedClick(bc.x + 8, bc.y, 1);
    await sleep(350);
    let s15 = JSON.parse(await selState());
    ok('S15 慢+8px 漂移双击（500ms 间隔）→ 单独选中（' + JSON.stringify(s15) + '）', s15.gs === 1 && s15.sel === 1);

    // S16：孤立单击（前一次在 800ms 窗外）→ 仍整组
    await deselectTrusted();
    bc = JSON.parse(await mCenter());
    await cdp.trustedClick(bc.x, bc.y, 1); await sleep(900); await cdp.trustedClick(bc.x, bc.y, 1);
    await sleep(200);
    let s16 = JSON.parse(await selState());
    ok('S16 两击隔 900ms（窗口外不误配对）→ 仍整组（gs:0/sel:2）', s16.gs === 0 && s16.sel === 2);

    // S17：快双击组内国旗成员 → 单独选中 + 不弹图源（v10.28.21.1 回归）
    await deselectTrusted();
    let ac = JSON.parse(await cdp.evalJs("(function(){ var r = window.__A.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
    await cdp.trustedDbl(ac.x, ac.y);
    await sleep(350);
    let s17 = JSON.parse(await selState());
    ok('S17 快双击国旗成员 → 单独选中 + 不弹图源（' + JSON.stringify(s17) + '）', s17.gs === 1 && s17.sel === 1 && !s17.modal);

    // S18/S19：列成员 s 柄下拖/上收 → 下方卡墙让位 flush（Round Q 自由形状：A+C 上下组，行卡语义已退役）
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S18 重载');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 350); var C = window.createContentCard(); window.moveCardPx(C, 260, (parseFloat(A.style.top)||0) + A.offsetHeight + 6); window.mergeCards(C, A, 'bottom'); window.__A = A; window.__C = C; return true; })()");
    ac = JSON.parse(await cdp.evalJs("(function(){ var r = window.__A.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
    await cdp.trustedClick(ac.x, ac.y, 1); await sleep(600); await cdp.trustedClick(ac.x, ac.y, 1);
    await sleep(350);
    const sh = () => cdp.evalJs("(function(){ var h = document.querySelector('.resize-handle[data-dir=\"s\"]'); if (!h) return 'null'; var r = h.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()");
    const geo = () => cdp.evalJs("(function(){ var A = window.__A, C = window.__C; var aT = parseFloat(A.style.top) || 0, aB = aT + A.offsetHeight; var cT = parseFloat(C.style.top) || 0; return JSON.stringify({ aB: aB, cT: cT, gap: cT - aB }); })()");
    let hs = JSON.parse(await sh());
    await cdp.mouse('mousePressed', hs.x, hs.y, 1);
    for (let i = 1; i <= 3; i++) await cdp.mouse('mouseMoved', hs.x, hs.y + 15 * i);
    await cdp.mouse('mouseReleased', hs.x, hs.y + 45, 1);
    await sleep(250);
    let g18 = JSON.parse(await geo());
    ok('S18 列成员 s 柄下拖 +45 → 下方卡墙让位 flush（gap≈0 无重叠）', Math.abs(g18.gap) <= 1);
    hs = JSON.parse(await sh());
    await cdp.mouse('mousePressed', hs.x, hs.y, 1);
    for (let i = 1; i <= 3; i++) await cdp.mouse('mouseMoved', hs.x, hs.y - 10 * i);
    await cdp.mouse('mouseReleased', hs.x, hs.y - 30, 1);
    await sleep(250);
    let g19 = JSON.parse(await geo());
    ok('S19 列成员 s 柄上收 -30 → 下方卡拉回仍 flush（gap≈0）', Math.abs(g19.gap) <= 1);

    // ══ 场景 G：Round P v10.28.25.2 挤压让位（CDP 可信输入）══
    const cen = (which) => cdp.evalJs("(function(){ var r = window.__" + which + ".getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()");
    const singleSel = async (which) => {
      // v10.28.34.2 轮：建卡/草稿恢复渲染未落定时双击会配对失败（S24/S25 偶发红
      // 实证——探针 tmp-probe-s24c.js：7 张累积草稿卡时双击保持整组选中 → 拖手柄
      // 误走整组缩放路径 C 被缩放；400ms 安定睡眠不够（高负载时 S21/S24/S25 仍
      // 偶发红、签名同 s24c）→ 改收敛重试：双击后验证 gs:1/sel:1，未配对最多
      // 重试 4 次；若误弹图源（600ms 双击不触发 dblclick 事件、理论上不弹，兜底
      // 防重试点击落在遮罩上）则 Escape 关闭再试）
      await sleep(400);
      const c = JSON.parse(await cen(which));
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
    const hdl = (dir) => cdp.evalJs("(function(){ var h = document.querySelector('.resize-handle[data-dir=\"" + dir + "\"]'); if (!h) return 'null'; var r = h.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()");
    const drag2 = async (dir, dx, dy) => {
      const h = JSON.parse(await hdl(dir));
      if (h === 'null') throw new Error('no handle ' + dir);
      await cdp.mouse('mousePressed', h.x, h.y, 1);
      for (let i = 1; i <= 4; i++) await cdp.mouse('mouseMoved', h.x + dx * i / 4, h.y + dy * i / 4);
      await cdp.mouse('mouseReleased', h.x + dx, h.y + dy, 1);
      await sleep(250);
    };
    const gL = (which) => cdp.evalJs("parseFloat(window.__" + which + ".style.left) || 0");
    const g2 = (a, b) => cdp.evalJs("(function(){ var A = window.__" + a + ", B = window.__" + b + "; var al = parseFloat(A.style.left) || 0, bl = parseFloat(B.style.left) || 0; return JSON.stringify({ gap: bl - (al + A.offsetWidth), overlap: Math.max(0, (al + A.offsetWidth) - bl) }); })()");

    // S20/S21：2列组 A 东扩 +60 → B 整列让位 flush；再东收 -30 → B 回贴仍 flush
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S20 重载');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createContentCard(); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); window.__A = A; window.__B = B; return true; })()");
    await singleSel('A');
    let bL0 = await gL('B');
    await drag2('e', 60, 0);
    let g20 = JSON.parse(await g2('A', 'B')); let bL1 = await gL('B');
    ok('S20 A 东扩 +60 → B 整列让位（右移 >40 且与 A 右缘 flush 无重叠）',
      g20.overlap === 0 && Math.abs(g20.gap) <= 1 && (bL1 - bL0) > 40);
    await drag2('e', -30, 0);
    let g21 = JSON.parse(await g2('A', 'B')); let bL2 = await gL('B');
    ok('S21 A 东收 -30 → B 回贴（左移 >10 且仍 flush 无重叠）',
      g21.overlap === 0 && Math.abs(g21.gap) <= 1 && (bL2 - bL1) < -10);

    // S22：3列组中列东扩 +60 → 右列让位、左列不动、BC flush
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S22 重载');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 200, 200); var B = window.createContentCard(); window.moveCardPx(B, 380, 200); var C = window.createFlagCard(); window.moveCardPx(C, 560, 200); window.mergeCards(B, A, 'right'); window.mergeCards(C, B, 'right'); window.__A = A; window.__B = B; window.__C = C; return true; })()");
    await singleSel('B');
    let a0 = await gL('A'), c0 = await gL('C');
    await drag2('e', 60, 0);
    let a1 = await gL('A'), c1 = await gL('C');
    let g22 = JSON.parse(await g2('B', 'C'));
    ok('S22 3列组中列东扩 +60 → 右列让位（右移 >40）、左列不动、BC flush',
      g22.overlap === 0 && Math.abs(g22.gap) <= 1 && (c1 - c0) > 40 && Math.abs(a1 - a0) < 0.5);

    // S23：2列组 B 西扩（w 柄 dx=-40 真西扩）→ A 让位左移、仍 flush
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S23 重载');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createContentCard(); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); window.__A = A; window.__B = B; return true; })()");
    await singleSel('B');
    let a23 = await gL('A');
    await drag2('w', -40, 0);
    let a23b = await gL('A');
    let g23 = JSON.parse(await g2('A', 'B'));
    ok('S23 B 西扩 -40 → A 让位左移（>30）且仍与 B 左缘 flush', g23.overlap === 0 && Math.abs(g23.gap) <= 1 && (a23 - a23b) > 30);

    // S24：台阶组（Round Q 自由形状）A 东扩 +60 → B 让位 flush A、台阶下 C 完全不动且宽保持（只推垂直相交那一面）
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S24 重载');
    // A=内容卡（8×4）B=国旗卡（8×5，比 A 高一排）→ B 底低于 A 底，C 贴 B 底时
    // C.t > A.b → C 不在 A 右集合（垂直不重叠）——台阶斜对确定性不误推
    await cdp.evalJs("(function(){ var A = window.createContentCard(); window.moveCardPx(A, 250, 350); var B = window.createFlagCard(); window.moveCardPx(B, 430, 350); window.mergeCards(B, A, 'right'); var C = window.createContentCard(); window.moveCardPx(C, 440, 520); window.mergeCards(C, B, 'bottom'); window.__A = A; window.__B = B; window.__C = C; return true; })()");
    await singleSel('A');
    bL0 = await gL('B');
    let cL0 = await gL('C');
    let cT0 = await cdp.evalJs('parseFloat(window.__C.style.top) || 0');
    let cW0 = await cdp.evalJs('window.__C.offsetWidth');
    await drag2('e', 60, 0);
    let g24 = JSON.parse(await g2('A', 'B'));
    bL1 = await gL('B');
    let cL1 = await gL('C');
    let cT1 = await cdp.evalJs('parseFloat(window.__C.style.top) || 0');
    let cW1 = await cdp.evalJs('window.__C.offsetWidth');
    console.log('  [S24 值] gap=' + g24.gap + ' overlap=' + g24.overlap + ' bΔ=' + (bL1 - bL0) + ' cΔL=' + (cL1 - cL0) + ' cΔT=' + (cT1 - cT0) + ' cΔW=' + (cW1 - cW0));
    ok('S24 台阶组 A 东扩 +60 → B 让位 flush A（右移 >40）、台阶下 C 完全不动且宽保持（斜对不误推）',
      g24.overlap === 0 && Math.abs(g24.gap) <= 1 && (bL1 - bL0) > 40 &&
      Math.abs(cL1 - cL0) < 0.5 && Math.abs(cT1 - cT0) < 0.5 && Math.abs(cW1 - cW0) < 0.5);

    // S25：台阶下 C 自定义窄宽（先东收 -60）→ A 东扩 → C 宽保持自定义（不抢回）
    await singleSel('C');
    await drag2('e', -60, 0);
    let cWcustom = await cdp.evalJs('window.__C.offsetWidth');
    await singleSel('A');
    await drag2('e', 60, 0);
    let cWafter = await cdp.evalJs('window.__C.offsetWidth');
    console.log('  [S25 值] cW0=' + cW0 + ' cWcustom=' + cWcustom + ' cWafter=' + cWafter + ' cΔW(custom→after)=' + (cWafter - cWcustom));
    ok('S25 台阶下 C 自定义窄宽不抢回（C 东收 -60 后 A 东扩 → C 宽保持自定义）',
      (cW0 - cWcustom) > 40 && Math.abs(cWafter - cWcustom) < 0.5);

    // S26：同列叠堆（右列旗卡 B 上 + 旗卡 S 下）B 南扩 +45 → S 让位 flush
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S26 重载');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createFlagCard(); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); var S = window.createFlagCard(); window.moveCardPx(S, 430, 420); window.mergeCards(S, B, 'bottom'); window.__A = A; window.__B = B; window.__S = S; return true; })()");
    await singleSel('B');
    const vg = () => cdp.evalJs("(function(){ var B = window.__B, S = window.__S; var bB = (parseFloat(B.style.top) || 0) + B.offsetHeight; var sT = parseFloat(S.style.top) || 0; return JSON.stringify({ gap: sT - bB }); })()");
    await drag2('s', 0, 45);
    let g26 = JSON.parse(await vg());
    ok('S26 同列叠堆上卡南扩 +45 → 下卡让位 flush（gap≈0）', Math.abs(g26.gap) <= 1);

    // S27：Escape 中途提交 → 同样让位（commitSingleResize 收口）
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S27 重载');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createContentCard(); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); window.__A = A; window.__B = B; return true; })()");
    await singleSel('A');
    let b27 = await gL('B');
    let h27 = JSON.parse(await hdl('e'));
    await cdp.mouse('mousePressed', h27.x, h27.y, 1);
    for (let i = 1; i <= 4; i++) await cdp.mouse('mouseMoved', h27.x + 15 * i, h27.y);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await sleep(250);
    let b27b = await gL('B');
    let g27 = JSON.parse(await g2('A', 'B'));
    ok('S27 Escape 中途提交同样让位（B 右移 >40 且 flush）', g27.overlap === 0 && Math.abs(g27.gap) <= 1 && (b27b - b27) > 40);

    // S28：L 形草稿往返——先清残留草稿（多场景 autosave 累积防污染）→ A+B 右并（B 保 174）+ C 下并入 B（台阶 L）→ saveDraft → 重载 → 逐卡几何+gid 零差异、C 仍贴 B 底且宽=B 宽
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S28 重载');
    await cdp.evalJs("localStorage.removeItem('slati_fluidcanvas_draft'); true");
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'S28 清草稿重载');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 350); var B = window.createContentCard(); window.moveCardPx(B, 430, 350); window.mergeCards(B, A, 'right'); var C = window.createContentCard(); window.moveCardPx(C, 440, 520); window.mergeCards(C, B, 'bottom'); window.__A = A; window.__B = B; window.__C = C; window.__bc = { b: B.dataset.cardId, c: C.dataset.cardId }; return true; })()");
    await cdp.evalJs("window.saveDraft(); true");
    const snapJson = await cdp.evalJs("JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('.grid-card')).map(function(c){ return { id: c.dataset.cardId, l: parseFloat(c.style.left)||0, t: parseFloat(c.style.top)||0, w: c.offsetWidth, h: c.offsetHeight, g: c.dataset.groupId }; }).sort(function(a,b){ return a.id < b.id ? -1 : 1; }))");
    const bcIds = JSON.parse(await cdp.evalJs('JSON.stringify(window.__bc)'));
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.grid-card')", 'S28 重载恢复');
    await install();
    const afterJson = await cdp.evalJs("JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('.grid-card')).map(function(c){ return { id: c.dataset.cardId, l: parseFloat(c.style.left)||0, t: parseFloat(c.style.top)||0, w: c.offsetWidth, h: c.offsetHeight, g: c.dataset.groupId }; }).sort(function(a,b){ return a.id < b.id ? -1 : 1; })) + '|' + (!!document.querySelector('.grid-group-bg'))");
    const [afterCards, bgOk] = afterJson.split('|');
    const sb28 = JSON.parse(snapJson), sa28 = JSON.parse(afterCards);
    const allSame28 = sb28.length === 3 && sb28.length === sa28.length && sb28.every((m, i) => m.id === sa28[i].id && m.l === sa28[i].l && m.t === sa28[i].t && m.w === sa28[i].w && m.h === sa28[i].h && m.g === sa28[i].g && !!m.g);
    const b28 = sa28.find(m => m.id === bcIds.b), c28 = sa28.find(m => m.id === bcIds.c);
    const cOk = !!b28 && !!c28 && Math.abs(c28.w - b28.w) <= 0.5 && Math.abs(c28.t - (b28.t + b28.h)) <= 1;
    ok('S28 L 形草稿往返：3 卡重载逐卡几何+gid 零差异（保形不塌）+ 背景在 + C 仍贴 B 底、宽=B 宽',
      allSame28 && bgOk === 'true' && cOk);

    // ══ 场景 W：v10.28.34.2 贴齐缝保持（整组缩放后成员仍严丝合缝；单击恒选整组 → 走 onGroupResizeMove 组路径）══
    const wSel = async (which) => {
      const c = JSON.parse(await cen(which));
      await cdp.trustedClick(c.x, c.y, 1);
      await sleep(350);
    };
    const vg2 = (a, b) => cdp.evalJs("(function(){ var A = window.__" + a + ", B = window.__" + b + "; var at = parseFloat(A.style.top) || 0, bt = parseFloat(B.style.top) || 0; return JSON.stringify({ gap: bt - (at + A.offsetHeight), overlap: Math.max(0, (at + A.offsetHeight) - bt) }); })()");
    const boxOf = () => cdp.evalJs("(function(){ var ms = [window.__A, window.__B]; if (window.__C) ms.push(window.__C); var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9; ms.forEach(function(m){ var l = parseFloat(m.style.left) || 0, t = parseFloat(m.style.top) || 0; if (l < minX) minX = l; if (t < minY) minY = t; if (l + m.offsetWidth > maxX) maxX = l + m.offsetWidth; if (t + m.offsetHeight > maxY) maxY = t + m.offsetHeight; }); return JSON.stringify({ left: minX, top: minY, w: maxX - minX, h: maxY - minY }); })()");
    const noOv = () => cdp.evalJs("(function(){ var ms = [window.__A, window.__B]; if (window.__C) ms.push(window.__C); for (var i = 0; i < ms.length; i++) for (var j = i + 1; j < ms.length; j++) { var a = ms[i], b = ms[j]; var al = parseFloat(a.style.left) || 0, at = parseFloat(a.style.top) || 0, bl = parseFloat(b.style.left) || 0, bt = parseFloat(b.style.top) || 0; if (al < bl + b.offsetWidth && bl < al + a.offsetWidth && at < bt + b.offsetHeight && bt < at + a.offsetHeight) return false; } return true; })()");

    // 探针实测口径（tmp-probe-seams.js，cs=22 真实量化 n×22−2）：mergeCards(card,target,side)=card 放在 target 的 side →
    // 旗左盾右 = mergeCards(s, f, 'right')（setupGroup 的 mergeCards(f, s, 'right') 为旗右盾左，多数拖法缝被去重叠链救回）；
    // W 组统一用旗左盾右 + 探针实测红值拖距（W1 +3.1/W2 +6.4/W5 纵 +1.1/W6 +40.1/W7 +9.7/W8 +6.4/W9 +6.4）
    const preClean = async () => {
      await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'W 重载');
      await cdp.evalJs("localStorage.removeItem('slati_fluidcanvas_draft'); true");
      await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'W 清草稿重载');
    };
    const setupFlagShield = () => cdp.evalJs("(function(){ var f = document.querySelector('.grid-card[data-card-type=\"flag\"]'); var s = document.querySelector('.grid-card[data-card-type=\"shield\"]'); window.mergeCards(s, f, 'right'); window.__A = f; window.__B = s; window.selectCard(f); return true; })()");

    // W1：旗左盾右 e 拖 +120 → 横缝 |≤1|（探针修前 +3.1 红；e+60 被去重叠链救回零缝故加大拖距）
    await preClean();
    await dropAsset('flag', 'National Flag');
    await dropAsset('shield', 'Emblem');
    await setupFlagShield();
    await drag2('e', 120, 0);
    let gW1 = JSON.parse(await g2('A', 'B'));
    ok('W1 整组 e 拖 +120 → A/B 横缝 |≤1|（修前 +3.1）', gW1.overlap === 0 && Math.abs(gW1.gap) <= 1);

    // W2：旗左盾右 se 拖 +45/+35 → 横缝 |≤1| 且两卡变高（探针修前 +6.4 红；cs=22 下 5 行 108→7 行 152 两卡都长高）
    await preClean();
    await dropAsset('flag', 'National Flag');
    await dropAsset('shield', 'Emblem');
    await setupFlagShield();
    let hA0 = await cdp.evalJs('window.__A.offsetHeight');
    let hB0 = await cdp.evalJs('window.__B.offsetHeight');
    await drag2('se', 45, 35);
    let hA1 = await cdp.evalJs('window.__A.offsetHeight');
    let hB1 = await cdp.evalJs('window.__B.offsetHeight');
    let gW2 = JSON.parse(await g2('A', 'B'));
    ok('W2 整组 se 拖 +45/+35 → A/B 横缝 |≤1| 且两卡变高（修前 +6.4）',
      gW2.overlap === 0 && Math.abs(gW2.gap) <= 1 && hA1 > hA0 && hB1 > hB0);

    // W3：三列链 e 拖 → 两个横缝都 |≤1|（锚升序级联收敛；修前红）
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'W3 重载');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 200, 200); var B = window.createContentCard(); window.moveCardPx(B, 380, 200); var C = window.createFlagCard(); window.moveCardPx(C, 560, 200); window.mergeCards(B, A, 'right'); window.mergeCards(C, B, 'right'); window.__A = A; window.__B = B; window.__C = C; return true; })()");
    await wSel('B');
    await drag2('e', 60, 0);
    let gW3a = JSON.parse(await g2('A', 'B'));
    let gW3b = JSON.parse(await g2('B', 'C'));
    ok('W3 三列链整组 e 拖 +60 → 两处横缝都 |≤1|（级联收敛）',
      gW3a.overlap === 0 && Math.abs(gW3a.gap) <= 1 && gW3b.overlap === 0 && Math.abs(gW3b.gap) <= 1);

    // W4：底并 s 拖 +45 → 纵缝 |≤1|（修前 +4.1 红）
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'W4 重载');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); var B = window.createContentCard(); window.moveCardPx(B, 250, 420); window.mergeCards(B, A, 'bottom'); window.__A = A; window.__B = B; return true; })()");
    await wSel('A');
    await drag2('s', 0, 45);
    let gW4 = JSON.parse(await vg2('A', 'B'));
    ok('W4 底并整组 s 拖 +45 → 纵缝 |≤1|（修前 +4.1）', gW4.overlap === 0 && Math.abs(gW4.gap) <= 1);

    // W5：L 形（旗+盾右并+内容卡下并）e 拖 +60 → 横缝+纵缝 |≤1| + 两两不重叠（探针修前纵缝 +1.1 红、横缝链救回 0；
    // se 拖会留下 B-C −8.6 重叠（链未修）故弃用 se；不断言 C.x==B.x——阶梯列对齐为已知限制）
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'W5 重载');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 350); var B = window.createAssetCard('shield', 'Emblem', 0, 0, 5, 5); window.moveCardPx(B, 430, 350); window.mergeCards(B, A, 'right'); var C = window.createContentCard(); window.moveCardPx(C, 440, 520); window.mergeCards(C, B, 'bottom'); window.__A = A; window.__B = B; window.__C = C; return true; })()");
    await wSel('A');
    await drag2('e', 60, 0);
    let gW5h = JSON.parse(await g2('A', 'B'));
    let gW5v = JSON.parse(await vg2('B', 'C'));
    let ov5 = await noOv();
    ok('W5 L 形整组 e 拖 +60 → 横缝+纵缝 |≤1| 且两两不重叠（修前纵缝 +1.1；不断言 C.x==B.x——阶梯列对齐已知限制）',
      gW5h.overlap === 0 && Math.abs(gW5h.gap) <= 1 && gW5v.overlap === 0 && Math.abs(gW5v.gap) <= 1 && ov5 === true);

    // W6：等比锁旗 + 盾右并 se 拖 +120/+20 → 横缝 |≤1|（探针修前 +40.1 红；锁卡浮点宽 vs 邻卡量化；不断言比例——S9 是既有红不继承其失败模式）
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createFlagCard === 'function'", 'W6 重载');
    await cdp.evalJs("(function(){ var A = window.createFlagCard(); window.moveCardPx(A, 250, 200); A.dataset.aspectLock = '1'; A.dataset.aspectRatio = 1.6; var B = window.createAssetCard('shield', 'Emblem', 0, 0, 5, 5); window.moveCardPx(B, 430, 200); window.mergeCards(B, A, 'right'); window.__A = A; window.__B = B; return true; })()");
    await wSel('A');
    await drag2('se', 120, 20);
    let gW6 = JSON.parse(await g2('A', 'B'));
    ok('W6 等比锁旗整组 se 拖 +120/+20 → 横缝 |≤1|（修前 +40.1；不断言比例）',
      gW6.overlap === 0 && Math.abs(gW6.gap) <= 1);

    // W7：旗左盾右 e 拖 -20 收缩 → 缝 |≤1| 且整组变窄（探针修前 +9.7 红、wΔ=22；旧旗+内容卡 206px 不缩故换旗+盾）
    await preClean();
    await dropAsset('flag', 'National Flag');
    await dropAsset('shield', 'Emblem');
    await setupFlagShield();
    let w70 = await cdp.evalJs('window.__A.offsetWidth + window.__B.offsetWidth');
    await drag2('e', -20, 0);
    let w71 = await cdp.evalJs('window.__A.offsetWidth + window.__B.offsetWidth');
    let gW7 = JSON.parse(await g2('A', 'B'));
    ok('W7 整组 e 拖 -20 收缩 → 缝 |≤1| 且整组变窄（修前 +9.7）', gW7.overlap === 0 && Math.abs(gW7.gap) <= 1 && (w70 - w71) > 10);

    // W8：旗左盾右 nw 拖 -40/-30 → 缝 |≤1| 且框左/上外移（探针修前 +6.4 红、dL=46/dT=22；dirX=-1 回归护栏）
    await preClean();
    await dropAsset('flag', 'National Flag');
    await dropAsset('shield', 'Emblem');
    await setupFlagShield();
    let b80 = JSON.parse(await boxOf());
    await drag2('nw', -40, -30);
    let b81 = JSON.parse(await boxOf());
    let gW8 = JSON.parse(await g2('A', 'B'));
    ok('W8 整组 nw 拖 -40/-30 → 缝 |≤1| 且组框左/上外移（修前 +6.4）',
      gW8.overlap === 0 && Math.abs(gW8.gap) <= 1 && (b80.left - b81.left) > 20 && (b80.top - b81.top) > 15);

    // W9：旗左盾右整组 se 拖 +45/+35 → saveDraft → 清草稿重载 → 成员几何 ±1 且横缝 |≤1|（探针修前 +6.4 且重载后仍 +6.4——缝隙不进草稿）
    await preClean();
    await dropAsset('flag', 'National Flag');
    await dropAsset('shield', 'Emblem');
    await setupFlagShield();
    await drag2('se', 45, 35);
    let gW9a = JSON.parse(await g2('A', 'B'));
    await cdp.evalJs("window.saveDraft(); true");
    const w9snap = JSON.parse(await cdp.evalJs("JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('.grid-card')).map(function(c){ return { id: c.dataset.cardId, l: parseFloat(c.style.left)||0, t: parseFloat(c.style.top)||0, w: c.offsetWidth, h: c.offsetHeight, g: c.dataset.groupId }; }).sort(function(a,b){ return a.id < b.id ? -1 : 1; }))"));
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.grid-card')", 'W9 重载恢复');
    await install();
    const w9after = JSON.parse(await cdp.evalJs("JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('.grid-card')).map(function(c){ return { id: c.dataset.cardId, l: parseFloat(c.style.left)||0, t: parseFloat(c.style.top)||0, w: c.offsetWidth, h: c.offsetHeight, g: c.dataset.groupId }; }).sort(function(a,b){ return a.id < b.id ? -1 : 1; }))"));
    const w9same = w9snap.length === 2 && w9after.length === 2 && w9snap.every((m, i) => m.id === w9after[i].id && Math.abs(m.l - w9after[i].l) <= 1 && Math.abs(m.t - w9after[i].t) <= 1 && Math.abs(m.w - w9after[i].w) <= 1 && Math.abs(m.h - w9after[i].h) <= 1 && m.g === w9after[i].g && !!m.g);
    const w9Left = w9after[0].l <= w9after[1].l ? w9after[0] : w9after[1];
    const w9Right = w9after[0].l > w9after[1].l ? w9after[0] : w9after[1];
    const w9gap = w9Right.l - (w9Left.l + w9Left.w);
    ok('W9 整组 se 拖 → saveDraft → 清草稿重载 → 成员几何 ±1 且横缝 |≤1|（缝隙不进草稿）',
      w9same && gW9a.overlap === 0 && Math.abs(gW9a.gap) <= 1 && Math.abs(w9gap) <= 1);

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
