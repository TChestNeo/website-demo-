// tmp-battery-sheet-card.js — v0.2.29.0 表格卡验证（2026-09-11；v0.2.29.2 轮扩至自动变长变宽）
// 背景：用户「我们还缺少一个sheet card」——wiki 表格迁移目标。本轮新增
//   createSheetCard：可编辑表格（首行表头加粗）、行内编辑走 v10.28 新卡片族
//   .card-edit-field 模式、dataset.sheetData={cols,cells} JSON 串往返、
//   底部 +添加行/+添加列、行尾 ✕ 删除（删光自动补空白行）、table-layout:fixed
//   首行 ✕ 占位列（防 ✕ 列塌 0 宽）。
// v0.2.29.2：+添加行/+添加列自动变长变宽（sheetGrow：rowSpan/colSpan+1 写回
//   dataset+setCardSize+刷手柄；种子 3 行/删光自补/草稿恢复路径不增长）。
// v0.2.29.3：列宽/行高手柄（每列上方 ↔、每行左侧 ↕ 按住拖动调整；
//   colgroup 三截制；sheetData 增 colW/rowH 随草稿往返）。
// 断言组：
//   F1-F8 静态：工厂/恢复函数/调色板入口/拖放分支/版本链/sheetGrow+grow 参数/
//     sheetGripDrag+colgroup+colW/rowH+白名单；
//   S1-S16 浏览器：调色板 DOM/工厂调用/种子结构/行内编辑同步/加行/加列/删行/
//     删光自补/CSS 计算样式/手柄结构/拖列宽/拖行高/草稿往返（值+尺寸往返）；
//   Z 全程零 console error。
// 跑法：node tmp-battery-sheet-card.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4500 + Math.floor(Math.random() * 400);
const CDP_PORT = 5500 + Math.floor(Math.random() * 400);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-sheetcard-' + Date.now());

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

  // ── F1-F5 静态 ──
  const fce = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  ok('F1 静态：createSheetCard 工厂 + window 钩子 + sheetSerialize/sheetAddRow/sheetAddCol/restoreSheet 在',
    fce.indexOf('function createSheetCard(') !== -1 && fce.indexOf('window.createSheetCard = createSheetCard;') !== -1 &&
    fce.indexOf('function sheetSerialize(') !== -1 && fce.indexOf('function sheetAddRow(') !== -1 &&
    fce.indexOf('function sheetAddCol(') !== -1 && fce.indexOf('function restoreSheet(') !== -1);
  ok('F2 静态：调色板 Sheet Card 入口（data-asset="sheet" + table 图标）',
    fce.indexOf('data-asset="sheet" data-label="Sheet Card"') !== -1 &&
    fce.indexOf('>table</span><span class="label-md">Sheet Card</span>') !== -1);
  ok('F3 静态：拖放分支 + assetSpan 8×5 + 图层图标 sheet:table',
    fce.indexOf("} else if (data.asset === 'sheet') {") !== -1 &&
    fce.indexOf("if (asset === 'sheet') return { w: 10, h: 7 };") !== -1 &&
    fce.indexOf("sheet: 'table'") !== -1);
  ok('F4 静态：草稿序列化/恢复分支（buildDraft sheetData + applyDraft createSheetCard+restoreSheet）',
    fce.indexOf("} else if (entry.type === 'sheet') {") !== -1 &&
    fce.indexOf("entry.sheetData = c.dataset.sheetData || '[]';") !== -1 &&
    fce.indexOf("} else if (cData.type === 'sheet') {") !== -1);
  ok('F5 静态：版本链 v10.28.19 条目 + 种子表头 项目/内容',
    fce.indexOf('v10.28.19 adds additive sheetData') !== -1 &&
    fce.indexOf("sheetNewCell(card, '表头', ['项目', '内容'][i])") !== -1);
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('F6 静态：站点号 v0.2.45.2 + FC 号 v10.28.34.2（v0.2.45.2 编辑器掉帧根治轮复跑口径；手柄轮旧标记已随注释链修剪）',
    sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.45.2';") !== -1 &&
    sconf.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.34.2';") !== -1 &&
    sconf.indexOf('编辑器掉帧根治') !== -1);
  ok('F7 静态：sheetGrow 助手 + 两按钮传 grow=true + 种子/删光自补/草稿恢复路径不增长',
    fce.indexOf('function sheetGrow(') !== -1 &&
    fce.indexOf('sheetAddRow(card, null, true)') !== -1 &&
    fce.indexOf('sheetAddCol(card, null, true)') !== -1 &&
    fce.indexOf('for (var r = 0; r < 3; r++) sheetAddRow(card, null);') !== -1 &&
    fce.indexOf('sheetAddCol(card, null);') !== -1);
  ok('F8 静态：sheetGripDrag 拖拽 + colgroup/手柄行/手柄格 + colW/rowH 序列化与恢复 + 拖卡白名单两处排除',
    fce.indexOf('function sheetGripDrag(') !== -1 &&
    fce.indexOf("className = 'sheet-colgroup'") !== -1 &&
    fce.indexOf("className = 'sheet-col-grip-row'") !== -1 &&
    fce.indexOf('colW.push(') !== -1 && fce.indexOf('rowH.push(') !== -1 &&
    fce.indexOf('if (data.colW) {') !== -1 && fce.indexOf('if (data.rowH) {') !== -1 &&
    fce.indexOf('.card-text-content, .card-edit-field, .card-label, .sheet-row-grip, .sheet-col-grip') !== -1);

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

    // 注：不在这里清 slati_fluidcanvas_draft——此脚本每次导航都跑，
    // S12 重载时会把刚 saveDraft 的草稿抹掉（重载恢复不回来）。
    // 全新 --user-data-dir 本就空 localStorage，无需预清。
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

    // ── S1-S11 浏览器 ──
    await preset(true);
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.migrate-btn') && typeof window.createSheetCard === 'function'", 'S1 编辑器加载');

    ok('S1 调色板：Sheet Card 入口在 DOM（table 图标）',
      await cdp.evalJs("(function(){ var els = document.querySelectorAll('.asset-panel .card[draggable]'); for (var i=0;i<els.length;i++){ if (els[i].dataset.asset === 'sheet') return els[i].querySelector('.material-symbols-outlined').textContent === 'table' && els[i].querySelector('.label-md').textContent === 'Sheet Card'; } return false; })()"));
    ok('S2 工厂：window.createSheetCard 可用', await cdp.evalJs("typeof window.createSheetCard === 'function'"));

    ok('S3 创建：sheet-card 进画布 + cardType=sheet + 默认尺寸 宽10格×长7格（colSpan/rowSpan 落 dataset；种子 3 行不增长仍 10×7）',
      await cdp.evalJs("(function(){ var c = window.createSheetCard(2, 2); return !!document.querySelector('.grid-card.sheet-card') && c.dataset.cardType === 'sheet' && c.dataset.colSpan === '10' && c.dataset.rowSpan === '7'; })()"));

    ok('S4 种子：表头 2 格（项目/内容）+ 表头 ✕ 占位列 + 3 数据行（各 2 输入 + ✕）+ 底部双按钮',
      await cdp.evalJs("(function(){ var card = document.querySelector('.grid-card.sheet-card'); var heads = card.querySelectorAll('.sheet-head-row .sheet-cell'); var delHead = card.querySelector('.sheet-head-row .sheet-del-cell'); var rows = card.querySelectorAll('.sheet-body-row'); var btns = card.querySelectorAll('.sheet-controls .row-add'); return heads.length === 2 && heads[0].value === '项目' && heads[1].value === '内容' && !!delHead && rows.length === 3 && rows[0].querySelectorAll('.sheet-cell').length === 2 && !!rows[0].querySelector('.row-del') && btns.length === 2 && btns[0].textContent === '+ 添加行' && btns[1].textContent === '+ 添加列'; })()"));

    ok('S5 编辑框：全部单元格输入框挂 .card-edit-field（拖拽不 arm）',
      await cdp.evalJs("(function(){ var els = document.querySelectorAll('.grid-card.sheet-card .sheet-cell'); if (els.length !== 8) return false; for (var i=0;i<els.length;i++){ if (!els[i].classList.contains('card-edit-field')) return false; } return true; })()"));

    ok('S14 手柄结构：手柄行（角落占位 + 2 ↔ + ✕ 占位）+ 表头/每数据行左侧 ↕ 手柄 + colgroup 四截（18px 手柄列+数据×2+22px ✕ 列）',
      await cdp.evalJs("(function(){ var card = document.querySelector('.grid-card.sheet-card'); var gripRow = card.querySelector('.sheet-col-grip-row'); var grips = card.querySelectorAll('.sheet-col-grip'); var rowGrips = card.querySelectorAll('.sheet-row-grip'); var cg = card.querySelector('.sheet-colgroup'); var corner = card.querySelector('.sheet-grip-corner'); return !!gripRow && !!gripRow.querySelector('.sheet-del-cell') && grips.length === 2 && !!corner && rowGrips.length === 4 && !!cg && cg.children.length === 4 && cg.children[0].className === 'sheet-grip-col' && !!card.querySelector('.sheet-del-col') && !!card.querySelector('.sheet-body-row .sheet-row-grip'); })()"));

    ok('S6 行内编辑：改单元格 → dataset.sheetData 同步（{cols:2,cells 4 行含新值）',
      await cdp.evalJs("(function(){ var card = document.querySelector('.grid-card.sheet-card'); var inp = card.querySelector('.sheet-body-row .sheet-cell'); inp.value = '测试A'; inp.dispatchEvent(new Event('input', { bubbles: true })); var d = JSON.parse(card.dataset.sheetData); return d.cols === 2 && d.cells.length === 4 && d.cells[1][0] === '测试A'; })()"));

    ok('S7 加行：点 + 添加行 → 4 数据行 + sheetData 5 行 + 卡片自动变长（rowSpan 7→8、高度 px 变大）',
      await cdp.evalJs("(function(){ var card = document.querySelector('.grid-card.sheet-card'); var h0 = parseFloat(card.style.height); card.querySelectorAll('.sheet-controls .row-add')[0].click(); var d = JSON.parse(card.dataset.sheetData); return card.querySelectorAll('.sheet-body-row').length === 4 && d.cells.length === 5 && card.dataset.rowSpan === '8' && card.dataset.colSpan === '10' && parseFloat(card.style.height) > h0; })()"));

    ok('S8 加列：点 + 添加列 → 3 列（新表头/单元格空 + 插在 ✕ 前）+ sheetData cols=3 + 卡片自动变宽（colSpan 10→11、宽度 px 变大）+ 新手柄/新 col 同步长出',
      await cdp.evalJs("(function(){ var card = document.querySelector('.grid-card.sheet-card'); var w0 = parseFloat(card.style.width); card.querySelectorAll('.sheet-controls .row-add')[1].click(); var heads = card.querySelectorAll('.sheet-head-row .sheet-cell'); var row0 = card.querySelectorAll('.sheet-body-row')[0]; var td = row0.querySelectorAll('td'); var d = JSON.parse(card.dataset.sheetData); var grips = card.querySelectorAll('.sheet-col-grip'); var cg = card.querySelector('.sheet-colgroup'); return heads.length === 3 && heads[2].value === '' && heads[2].placeholder === '表头' && row0.querySelectorAll('.sheet-cell').length === 3 && row0.querySelector('.sheet-cell') && td[td.length-1].className === 'sheet-del-cell' && d.cols === 3 && d.cells[0].length === 3 && d.cells[1].length === 3 && card.dataset.colSpan === '11' && card.dataset.rowSpan === '8' && parseFloat(card.style.width) > w0 && grips.length === 3 && cg.children.length === 5 && cg.lastElementChild.className === 'sheet-del-col'; })()"));

    ok('S9 删行：点一行 ✕ → 回到 3 数据行 + sheetData 4 行（删行不缩回，rowSpan 仍 8）',
      await cdp.evalJs("(function(){ var card = document.querySelector('.grid-card.sheet-card'); card.querySelector('.sheet-body-row .row-del').click(); var d = JSON.parse(card.dataset.sheetData); return card.querySelectorAll('.sheet-body-row').length === 3 && d.cells.length === 4 && card.dataset.rowSpan === '8'; })()"));

    ok('S10 删光自补：连删到 0 → 自动补 1 空白行（与数据卡口径一致；自补路径不误增长，rowSpan 仍 8）',
      await cdp.evalJs("(function(){ var card = document.querySelector('.grid-card.sheet-card'); for (var i=0;i<4;i++){ var del = card.querySelector('.sheet-body-row .row-del'); if (del) del.click(); } var rows = card.querySelectorAll('.sheet-body-row'); var inps = rows[0].querySelectorAll('.sheet-cell'); return rows.length === 1 && inps.length === 3 && inps[0].value === '' && inps[1].value === '' && card.dataset.rowSpan === '8'; })()"));

    ok('S11 CSS：table-layout:fixed + 表头加粗 + ✕ 列 22px + 横向滚动容器',
      await cdp.evalJs("(function(){ var card = document.querySelector('.grid-card.sheet-card'); var st = getComputedStyle(card.querySelector('.sheet-table')); var hw = getComputedStyle(card.querySelector('.sheet-head-row .sheet-cell')); var dw = getComputedStyle(card.querySelector('.sheet-del-cell')); var sw = getComputedStyle(card.querySelector('.sheet-scroll')); return st.tableLayout === 'fixed' && parseInt(hw.fontWeight) >= 700 && dw.width === '22px' && sw.overflowX === 'auto'; })()"));

    // ── S15/S16 拖手柄调整列宽/行高（合成 mousedown→document mousemove→mouseup） ──
    ok('S15 拖列宽：按住第 1 列 ↔ 手柄右拖 60px → 该列变宽 60（col 落 px + sheetData.colW 同步）',
      await cdp.evalJs("(function(){ var card = document.querySelector('.grid-card.sheet-card'); var g = card.querySelectorAll('.sheet-col-grip')[0]; var r = g.getBoundingClientRect(); var h0 = card.querySelectorAll('.sheet-head-row .sheet-cell-td')[0].getBoundingClientRect().width; var x = r.left + r.width / 2, y = r.top + r.height / 2; g.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: x, clientY: y })); document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x + 60, clientY: y })); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x + 60, clientY: y })); var col = card.querySelector('.sheet-colgroup').children[1]; var h1 = card.querySelectorAll('.sheet-head-row .sheet-cell-td')[0].getBoundingClientRect().width; var d = JSON.parse(card.dataset.sheetData); return Math.abs(parseFloat(col.style.width) - (h0 + 60)) <= 1.5 && Math.abs(h1 - h0 - 60) <= 2 && Math.abs(d.colW[0] - h1) <= 2; })()"));
    ok('S16 拖行高：按住第 1 数据行 ↕ 手柄下拉 40px → 该行变高 40（tr 落 px + sheetData.rowH 同步）',
      await cdp.evalJs("(function(){ var card = document.querySelector('.grid-card.sheet-card'); var tr = card.querySelectorAll('.sheet-body-row')[0]; var g = tr.querySelector('.sheet-row-grip'); var r = g.getBoundingClientRect(); var h0 = tr.getBoundingClientRect().height; var x = r.left + r.width / 2, y = r.top + r.height / 2; g.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: x, clientY: y })); document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y + 40 })); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y + 40 })); var h1 = tr.getBoundingClientRect().height; var d = JSON.parse(card.dataset.sheetData); return Math.abs(parseFloat(tr.style.height) - (h0 + 40)) <= 1.5 && Math.abs(h1 - h0 - 40) <= 2 && Math.abs(d.rowH[1] - h1) <= 2; })()"));

    // ── S12 草稿往返：改值 → saveDraft → 重载 → 值恢复（含列宽/行高尺寸往返） ──
    await cdp.evalJs("(function(){ var card = document.querySelector('.grid-card.sheet-card'); var heads = card.querySelectorAll('.sheet-head-row .sheet-cell'); heads[0].value = '国家'; heads[1].value = '首都'; heads[2].value = '人口'; var cells = card.querySelectorAll('.sheet-body-row')[0].querySelectorAll('.sheet-cell'); cells[0].value = '测试国'; cells[1].value = '测试都'; cells[2].value = '100'; [heads[0], heads[1], heads[2], cells[0], cells[1], cells[2]].forEach(function (inp) { inp.dispatchEvent(new Event('input', { bubbles: true })); }); window.saveDraft(); var d = JSON.parse(card.dataset.sheetData); var cg = card.querySelector('.sheet-colgroup'); var r0 = card.querySelectorAll('.sheet-body-row')[0]; localStorage.setItem('__sheetExp', JSON.stringify({ colW: d.colW, rowH: d.rowH, colStyle: cg.children[1].style.width, rowStyle: r0.style.height })); return true; })()");
    await nav(BASE + '/pages/fluidcanvas-editor.html', "document.querySelector('.grid-card.sheet-card')", 'S12 重载恢复');
    ok('S12 草稿往返：重载后表头/单元格值 + 3 列恢复 + 增长跨度 11×8 随草稿恢复（恢复路径不额外增长）+ 拖过的列宽/行高尺寸复原',
      await cdp.evalJs("(function(){ var card = document.querySelector('.grid-card.sheet-card'); var heads = card.querySelectorAll('.sheet-head-row .sheet-cell'); var cells = card.querySelectorAll('.sheet-body-row')[0].querySelectorAll('.sheet-cell'); var d = JSON.parse(card.dataset.sheetData); var exp = null; try { exp = JSON.parse(localStorage.getItem('__sheetExp')); } catch (e) {} var sizeOk = false; if (exp) { var cg = card.querySelector('.sheet-colgroup'); var r0 = card.querySelectorAll('.sheet-body-row')[0]; sizeOk = Math.abs(parseFloat(cg.children[1].style.width) - parseFloat(exp.colStyle)) <= 2 && Math.abs(parseFloat(r0.style.height) - parseFloat(exp.rowStyle)) <= 2 && Math.abs(d.colW[0] - exp.colW[0]) <= 2 && Math.abs(d.rowH[1] - exp.rowH[1]) <= 2; } return heads.length === 3 && heads[0].value === '国家' && heads[1].value === '首都' && heads[2].value === '人口' && cells.length === 3 && cells[0].value === '测试国' && cells[1].value === '测试都' && cells[2].value === '100' && d.cols === 3 && d.cells.length === 2 && card.dataset.colSpan === '11' && card.dataset.rowSpan === '8' && sizeOk; })()"));

    ok('S13 版本徽章：右下角 badge 渲染 FC v10.28.34.2（最新构建标识）',
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
