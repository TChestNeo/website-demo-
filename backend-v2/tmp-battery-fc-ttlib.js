// tmp-battery-fc-ttlib.js — FC v10.28.47.0 文字工具栏添加图像弹层图库同步电池
// 用户「文字的工具栏那边的添加图像的图库有没有做好同步图库？」+「能不能同步一下？」
// 两问钦定：搜索框保持搜维基 / 全部同步（条目+标签筛选+标签管理，同主图库口径）
// 验证：S 静态锚（site-config 47.0/00299-/58.0/同步图库/旧赋值零残留 + 弹层锚 + 遗锚 +
//        主图库行零动 + i18n 零新键）
//   / T 行为段（桌面 CDP + 本地 /wikistub 维基桩）：
//         T1 开弹层→真实图库条目两列格+chips+上传格尾位+零条纹
//         T2 点条目→内联插入（卡内输入框 richify 路径+三 dataset+toast）
//         T3 筛选 OR 并集（勾国旗=A+C、再勾地图=A+B+C、徽章 1→2）
//         T4 全选/清空（徽章 3→hidden）
//         T7 维基搜索不变+筛选跨搜索保持（桩→清除→库视图过滤集+徽章仍在）
//         T10 关重开重置筛选（徽章清、条目全量）
//         T5 标签管理叠弹层（tagManageModal active 且 ttImgPop 仍 active；关窗弹层不坏）
//         T6 删标签→弹层即时重绘（钩子计数+chip 消失+store 已删）
//         T8 上传格→meta 保存→条目即现（FileReader 异步 waitFor+重开仍在）
//         T9 空库口径（T9a 只清 store=派生图同源在场；T9b 重载真空库=仅上传格）
//   / E 全程零异常零 console error
// （house CDP 模式；判定看输出体 🎉/💔 行）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4800 + Math.floor(Math.random() * 100);
const CDP_PORT = 5800 + Math.floor(Math.random() * 100);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-ttlib-' + Date.now());
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const PNG1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const WIKI = {
  query: { pages: {
    '100': { pageid: 100, ns: 6, title: 'File:ProbeCatA.jpg', index: 1, imageinfo: [{ thumburl: PNG1, url: PNG1, size: 68, width: 1, height: 1 }] },
    '101': { pageid: 101, ns: 6, title: 'File:ProbeCatB.jpg', index: 2, imageinfo: [{ thumburl: PNG1, url: PNG1, size: 68, width: 1, height: 1 }] }
  } }
};
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/wikistub') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(WIKI)); return; }
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

  try {
    // ── S 静态锚 ──
    const siteCfg = await (await fetch(BASE + '/assets/js/site-config.js')).text();
    const editorHtml = await (await fetch(BASE + '/pages/fluidcanvas-editor.html')).text();
    const i18nJs = await (await fetch(BASE + '/assets/i18n/fluidcanvas.i18n.js')).text();
    const occ = (s, sub) => s.split(sub).length - 1;
    ok('S1 site-config：FC v10.28.47.4 + rev 00306- 占位 + 站点恒 v0.2.58.3 + 「同步图库」在 changelog + 旧赋值零残留',
      siteCfg.indexOf('v10.28.47.4') !== -1 && siteCfg.indexOf('00306-') !== -1 &&
      siteCfg.indexOf('v0.2.58.3') !== -1 && siteCfg.indexOf('同步图库') !== -1 &&
      siteCfg.indexOf("'v10.28.47.2';") === -1);
    ok('S2 弹层锚：4 新 id + TT_FILTER_TAG_IDS + 两桥两导出（currentTabItems/refreshLibItems/esc）+ 钩子 4 处+赋值 1 处',
      editorHtml.indexOf('id="ttFilterBtn"') !== -1 && editorHtml.indexOf('id="ttFilterMenu"') !== -1 &&
      editorHtml.indexOf('id="ttFilterCount"') !== -1 && editorHtml.indexOf('id="ttTagManageBtn"') !== -1 &&
      editorHtml.indexOf('var TT_FILTER_TAG_IDS = [];') !== -1 &&
      editorHtml.indexOf('window.currentTabItems = currentTabItems;') !== -1 &&
      editorHtml.indexOf('window.refreshLibItems = function () { LIB_ITEMS = collectImgLibrary(); };') !== -1 &&
      editorHtml.indexOf('window.esc = esc;') !== -1 &&
      occ(editorHtml, 'if (window.__ttOnTagsChanged) window.__ttOnTagsChanged();') === 4 &&
      occ(editorHtml, 'window.__ttOnTagsChanged = function () {') === 1 &&
      editorHtml.indexOf('function renderTTLib') !== -1 &&
      editorHtml.indexOf('grid.classList.add(\'tt-lib-mode\')') !== -1);
    ok('S3 遗锚：insertInlineImage 签名/FC_FLAG_LIBRARY 行/renderLibTiles(grid)/openImgMetaModal ≥8/守卫豁免/SEED·MY 无',
      editorHtml.indexOf('function insertInlineImage(src, alt, meta)') !== -1 &&
      editorHtml.indexOf('var lib = window.FC_FLAG_LIBRARY || [];') !== -1 &&
      editorHtml.indexOf('window.FC_FLAG_LIBRARY = [];') !== -1 &&
      editorHtml.indexOf('renderLibTiles(grid); // 旗格+上传格恒尾位') !== -1 &&
      occ(editorHtml, 'openImgMetaModal(') >= 8 &&
      editorHtml.indexOf("e.target.closest('.tt-filter-row')) return;") !== -1 &&
      editorHtml.indexOf('SEED_FLAGS = [') === -1 && editorHtml.indexOf('MY_FLAGS = [') === -1);
    ok('S4 主图库行零动 + i18n 零新键（filterBtn/manageBtn ×12 复用，无 fc.tt.filter/fc.tt.lib/fc.tt.manage 新键）',
      editorHtml.indexOf('id="flagFilterBtn"') !== -1 && editorHtml.indexOf('id="flagFilterMenu"') !== -1 &&
      editorHtml.indexOf('id="flagTagManageBtn"') !== -1 && editorHtml.indexOf('id="tagManageModal"') !== -1 &&
      occ(i18nJs, '"fc.tag.filterBtn":') === 12 && occ(i18nJs, '"fc.tag.manageBtn":') === 12 &&
      occ(i18nJs, '"fc.tag.filterAll":') === 12 && occ(i18nJs, '"fc.tag.filterNone":') === 12 &&
      i18nJs.indexOf('"fc.tt.filter') === -1 && i18nJs.indexOf('"fc.tt.lib') === -1 && i18nJs.indexOf('"fc.tt.manage') === -1);

    // ── 桌面段 ──
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.bringToFront');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "!!window.MN_I18N && !!document.getElementById('gridCanvas') && !!window.imgMetaSave && !!window.showImgPop && !!window.imgLibPut && !!window.tagCreate", 30000, '编辑器加载');
    await sleep(800);

    // 页内工具：合成图 URL / 弹层上传 / 读 toast / 网格快照
    await cdp.evalJs("window.__toast = function () { var t = document.getElementById('toast'); return t ? t.textContent : ''; };");
    await cdp.evalJs(`(function(){
      window.__mkUrl = function (colorA, colorB) {
        var cv = document.createElement('canvas'); cv.width = 8; cv.height = 6;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = colorA; ctx.fillRect(0, 0, 8, 6);
        ctx.fillStyle = colorB; ctx.fillRect(0, 0, 4, 6);
        return cv.toDataURL('image/png');
      };
      window.__mkImgPop = function (name, colorA, colorB) {
        var url = window.__mkUrl(colorA, colorB);
        var bin = atob(url.split(',')[1]);
        var u8 = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        var dt = new DataTransfer();
        dt.items.add(new File([u8], name, { type: 'image/png' }));
        var fi = document.getElementById('ttInlineFileInput');
        fi.files = dt.files;
        fi.dispatchEvent(new Event('change', { bubbles: true }));
        return url;
      };
      window.__grid = function () {
        var tiles = Array.prototype.slice.call(document.querySelectorAll('#ttImgGrid .tt-lib-tile'));
        return {
          mode: document.getElementById('ttImgGrid').classList.contains('tt-lib-mode'),
          searchMode: document.getElementById('ttImgGrid').classList.contains('tim-search-mode'),
          libN: tiles.length,
          thumbs: document.querySelectorAll('#ttImgGrid .tim-thumb-tile').length,
          uploads: document.querySelectorAll('#ttImgGrid .tim-upload').length,
          stripes: document.querySelectorAll('#ttImgGrid .tim-stripes').length,
          names: tiles.map(function (t) { return t.querySelector('.tt-lib-name') ? t.querySelector('.tt-lib-name').textContent : null; }),
          chips: tiles.map(function (t) { return t.querySelectorAll('.flag-tag-chip').length; }),
          badge: (function () { var c = document.getElementById('ttFilterCount'); return { text: c.textContent, hidden: c.style.display === 'none' }; })()
        };
      };
    })()`);

    const metaOpen = "!!document.getElementById('imgMetaModal') && !!document.querySelector('#imgMetaModal .modal-card.active')";
    const metaClosed = "!document.querySelector('#imgMetaModal .modal-card.active')";

    // ── 种子：sys 标签 + 三张库图（A[国旗] B[地图] C[国旗+国徽]） ──
    const seed = await cdp.evalJs(`(function(){
      window.tagLoad(); // 惰性播种 sys-flag/sys-emblem/sys-map
      var uA = window.__mkUrl('#e33', '#fff');
      var uB = window.__mkUrl('#36e', '#0a0');
      var uC = window.__mkUrl('#a4c', '#ff0');
      window.imgLibPut(uA, { name: 'A', desc: 'A desc', visibility: 'private', tags: ['sys-flag'] });
      window.imgLibPut(uB, { name: 'B', desc: 'B desc', visibility: 'private', tags: ['sys-map'] });
      window.imgLibPut(uC, { name: 'C', desc: 'C desc', visibility: 'private', tags: ['sys-flag', 'sys-emblem'] });
      return { uA: uA, uB: uB, uC: uC };
    })()`);

    // ── T1 开弹层→真实图库条目 ──
    await cdp.evalJs("window.showImgPop(); true");
    await sleep(400);
    const t1 = await cdp.evalJs("window.__grid()");
    ok('T1 开弹层：3 库格两列+上传格尾位+零条纹+库视图态（chips A1/B1/C2）',
      t1.libN === 3 && t1.uploads === 1 && t1.stripes === 0 && t1.mode === true && t1.searchMode === false &&
      JSON.stringify(t1.names) === JSON.stringify(['A', 'B', 'C']) && JSON.stringify(t1.chips) === JSON.stringify([1, 1, 2]),
      JSON.stringify(t1));

    // ── T2 点库格→内联插入（卡内输入框 richify 路径） ──
    await cdp.evalJs("window.__card = window.createCharacterCard(2, 2, 4, 5); var inp = window.__card.querySelector('input.card-label') || window.__card.querySelector('input'); inp.focus(); true");
    await cdp.evalJs("window.showImgPop(); true"); // 重捕获 IMG_SAVED_INPUT（弹层开着也重跑）
    await sleep(300);
    await cdp.evalJs("document.querySelectorAll('#ttImgGrid .tt-lib-tile')[0].click(); true");
    await sleep(400);
    const t2 = await cdp.evalJs(`(function(){
      var rich = window.__card.querySelector('[data-rich="1"]');
      var img = rich ? rich.querySelector('img.tt-inline-img') : null;
      return { rich: !!rich, has: !!img, src: img ? img.src === ${JSON.stringify(seed.uA)} : false,
        name: img ? img.dataset.imgName : null, desc: img ? img.dataset.imgDesc : null,
        vis: img ? img.dataset.imgVisibility : null, toast: window.__toast(),
        popClosed: !document.getElementById('ttImgPop').classList.contains('active') };
    })()`);
    ok('T2 点库格：弹层关+卡内输入框 richify+img 三 dataset+toast 图片已插入',
      t2.rich === true && t2.has === true && t2.src === true && t2.name === 'A' && t2.desc === 'A desc' &&
      t2.vis === 'private' && t2.toast.indexOf('图片已插入：A') !== -1 && t2.popClosed === true,
      JSON.stringify(t2));

    // ── T3 筛选 OR 并集（每次菜单重渲染后重查 NodeList） ──
    await cdp.evalJs("window.showImgPop(); document.getElementById('ttFilterBtn').click(); true");
    await sleep(250);
    await cdp.evalJs("document.querySelectorAll('#ttFilterMenu .tt-filter-item')[0].click(); true"); // 国旗
    await sleep(300);
    const t3a = await cdp.evalJs("window.__grid()");
    ok('T3a 勾国旗=A+C（OR 并集）+徽章 1', t3a.libN === 2 && JSON.stringify(t3a.names) === JSON.stringify(['A', 'C']) &&
      t3a.badge.text === '1' && t3a.badge.hidden === false, JSON.stringify(t3a));
    await cdp.evalJs("document.querySelectorAll('#ttFilterMenu .tt-filter-item')[2].click(); true"); // 地图（重查后索引仍同序）
    await sleep(300);
    const t3b = await cdp.evalJs("window.__grid()");
    ok('T3b 再勾地图=A+B+C 并集+徽章 2', t3b.libN === 3 && JSON.stringify(t3b.names) === JSON.stringify(['A', 'B', 'C']) &&
      t3b.badge.text === '2', JSON.stringify(t3b));

    // ── T4 全选/清空 ──
    await cdp.evalJs("document.querySelectorAll('#ttFilterMenu .tt-filter-head button')[0].click(); true"); // 全选
    await sleep(300);
    const t4a = await cdp.evalJs("window.__grid()");
    ok('T4a 全选=徽章 3+全量条目', t4a.badge.text === '3' && t4a.libN === 3, JSON.stringify(t4a));
    await cdp.evalJs("document.querySelectorAll('#ttFilterMenu .tt-filter-head button')[1].click(); true"); // 清空
    await sleep(300);
    const t4b = await cdp.evalJs("window.__grid()");
    ok('T4b 清空=徽章隐藏+全量条目', t4b.badge.hidden === true && t4b.libN === 3, JSON.stringify(t4b));

    // ── T7 维基搜索不变+筛选跨搜索保持 ──
    await cdp.evalJs("document.getElementById('ttFilterBtn').click(); true"); // 菜单已收起：重开
    await sleep(200);
    await cdp.evalJs("document.querySelectorAll('#ttFilterMenu .tt-filter-item')[0].click(); true"); // 勾国旗（徽章 1）
    await sleep(300);
    await cdp.evalJs("window.FC_IMG_SEARCH_API = " + JSON.stringify(BASE + '/wikistub') + "; var inp = document.getElementById('ttImgSearch'); inp.value = 'cat'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); true");
    await waitFor(cdp, "document.querySelectorAll('#ttImgGrid .tim-thumb-tile').length === 2", 8000, 'T7 维基桩结果');
    const t7a = await cdp.evalJs("window.__grid()");
    ok('T7a 搜索=维基桩 2 缩略格+搜索态+无库格（搜索框仍搜维基）',
      t7a.thumbs === 2 && t7a.searchMode === true && t7a.mode === false && t7a.libN === 0, JSON.stringify(t7a));
    await cdp.evalJs("document.getElementById('ttImgClear').click(); true");
    await sleep(300);
    const t7b = await cdp.evalJs("window.__grid()");
    ok('T7b 清除搜索=回库视图+筛选跨搜索保持（A+C+徽章 1）',
      t7b.mode === true && t7b.libN === 2 && JSON.stringify(t7b.names) === JSON.stringify(['A', 'C']) &&
      t7b.badge.text === '1', JSON.stringify(t7b));

    // ── T10 关重开重置筛选 ──
    await cdp.evalJs("window.hideImgPop(); window.showImgPop(); true");
    await sleep(400);
    const t10 = await cdp.evalJs("window.__grid()");
    ok('T10 关重开=筛选重置（徽章隐藏+全量 3 条目）', t10.badge.hidden === true && t10.libN === 3, JSON.stringify(t10));

    // ── T5 标签管理叠弹层 ──
    await cdp.evalJs("document.getElementById('ttTagManageBtn').click(); true");
    await sleep(300);
    const t5a = await cdp.evalJs("(function(){ return { tm: !!document.querySelector('#tagManageModal .modal-card.active'), pop: document.getElementById('ttImgPop').classList.contains('active') }; })()");
    ok('T5a 标签管理弹窗叠在弹层上（tagManageModal active 且 ttImgPop 仍 active）',
      t5a.tm === true && t5a.pop === true, JSON.stringify(t5a));
    await cdp.evalJs("window.closeTagManage(); true");
    await sleep(300);
    const t5b = await cdp.evalJs("(function(){ return { tm: !document.querySelector('#tagManageModal .modal-card.active'), pop: document.getElementById('ttImgPop').classList.contains('active') }; })()");
    ok('T5b 关标签管理=弹层不坏（modal 关、ttImgPop 仍 active）', t5b.tm === true && t5b.pop === true, JSON.stringify(t5b));

    // ── T6 删标签→弹层即时重绘（钩子计数） ──
    const t6seed = await cdp.evalJs(`(function(){
      var t = window.tagCreate('探针标签', 'probe tag', 'desc6');
      window.imgLibPut(${JSON.stringify(seed.uC)}, { name: 'C', desc: 'C desc', visibility: 'private', tags: ['sys-flag', 'sys-emblem', t.id] });
      window.__ttFired = 0;
      window.__ttOrigH = window.__ttOnTagsChanged;
      window.__ttOnTagsChanged = function () { window.__ttFired++; if (window.__ttOrigH) window.__ttOrigH(); };
      window.showImgPop(); // 重绘（C 变 3 chips）
      return { id: t.id };
    })()`);
    await sleep(400);
    const t6a = await cdp.evalJs("window.__grid()");
    ok('T6a 重放：C 带自建标签（3 chips=国旗+国徽+溢出 +1）', JSON.stringify(t6a.chips) === JSON.stringify([1, 1, 3]), JSON.stringify(t6a));
    await cdp.evalJs("window.tagManageDelete(" + JSON.stringify(t6seed.id) + "); true");
    await sleep(500);
    const t6b = await cdp.evalJs(`(function(){
      var grid = window.__grid();
      return { fired: window.__ttFired, chipsC: grid.chips[2] || null,
        gone: grid.names.map ? document.getElementById('ttImgGrid').textContent.indexOf('probe tag') === -1 : false,
        tagGone: !window.tagLoad().some(function (t) { return t.id === ${JSON.stringify(t6seed.id)}; }) };
    })()`);
    ok('T6b 删自建标签：钩子触发 ≥1+弹层重绘（C 回 2 chips+grid 无 probe tag）+store 已删',
      t6b.fired >= 1 && t6b.chipsC === 2 && t6b.gone === true && t6b.tagGone === true, JSON.stringify(t6b));
    await cdp.evalJs("window.__ttOnTagsChanged = window.__ttOrigH; true"); // 还原钩子

    // ── T8 上传格→meta 保存→条目即现（FileReader 异步） ──
    await cdp.evalJs("window.__card8 = window.createCharacterCard(8, 2, 4, 5); var inp8 = window.__card8.querySelector('input.card-label') || window.__card8.querySelector('input'); inp8.focus(); true");
    await cdp.evalJs("window.showImgPop(); true");
    await sleep(300);
    const t8url = await cdp.evalJs("window.__mkImgPop('uplib1.png', '#5a5', '#fff')");
    await waitFor(cdp, metaOpen, 8000, 'T8 元数据弹窗打开');
    await cdp.evalJs("window.imgMetaSave()");
    await waitFor(cdp, metaClosed, 4000, 'T8 元数据弹窗关闭');
    await sleep(400);
    const t8a = await cdp.evalJs("window.__grid()");
    ok('T8a 上传→meta 保存→弹层条目即现（4 条目含 uplib1，钩子即时重绘）',
      t8a.libN === 4 && t8a.names.indexOf('uplib1') !== -1, JSON.stringify({ libN: t8a.libN, names: t8a.names }));
    await cdp.evalJs("window.hideImgPop(); window.showImgPop(); true");
    await sleep(400);
    const t8b = await cdp.evalJs("window.__grid()");
    ok('T8b 重开仍在（持久库已存：4 条目含 uplib1）', t8b.libN === 4 && t8b.names.indexOf('uplib1') !== -1, JSON.stringify({ libN: t8b.libN, names: t8b.names }));

    // ── T9 空库口径（派生图=画布 DOM 内联图，同主图库同源——只清 store 仍在场） ──
    await cdp.evalJs("localStorage.setItem('slati_img_library', '[]'); window.showImgPop(); true");
    await sleep(400);
    const t9a = await cdp.evalJs("window.__grid()");
    ok('T9a 只清 store：画布内联图仍按主图库同源口径在场（A+uplib1 派生图、零标签、无条纹）',
      t9a.libN === 2 && JSON.stringify(t9a.names) === JSON.stringify(['A', 'uplib1']) &&
      JSON.stringify(t9a.chips) === JSON.stringify([0, 0]) && t9a.stripes === 0, JSON.stringify(t9a));
    // T9b 真空库：store+草稿全清后重载（顺带验证弹层自足刷新——不依赖主图库先开过）
    await cdp.evalJs("localStorage.removeItem('slati_fluidcanvas_draft'); true");
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "!!window.showImgPop && !!window.imgLibPut && !!document.getElementById('gridCanvas')", 30000, 'T9 重载');
    await sleep(800);
    await cdp.evalJs(`(function(){ // 重载后重装网格快照助手
      window.__grid = function () {
        var tiles = Array.prototype.slice.call(document.querySelectorAll('#ttImgGrid .tt-lib-tile'));
        return {
          mode: document.getElementById('ttImgGrid').classList.contains('tt-lib-mode'),
          libN: tiles.length,
          uploads: document.querySelectorAll('#ttImgGrid .tim-upload').length,
          stripes: document.querySelectorAll('#ttImgGrid .tim-stripes').length
        };
      };
    })()`);
    await cdp.evalJs("window.showImgPop(); true");
    await sleep(400);
    const t9b = await cdp.evalJs("window.__grid()");
    ok('T9b 真空库（重载后）：零库格+仅上传格（同 v10.28.29.1 口径）',
      t9b.libN === 0 && t9b.uploads === 1 && t9b.stripes === 0 && t9b.mode === true, JSON.stringify(t9b));

    ok('E1 全程零 Runtime.exceptionThrown', cdp.errs.length === 0, JSON.stringify(cdp.errs.slice(0, 3)));
    ok('E2 全程零 console error', cdp.consoleErrs.length === 0, JSON.stringify(cdp.consoleErrs.slice(0, 3)));
    cdp.close();
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  try { chrome.kill(); } catch (e) {}
  server.close();
  console.log('');
  console.log(FAIL === 0 ? '🎉 全部通过 ' + PASS + '/' + PASS + '  (fc-ttlib)' : '💔 失败 ' + FAIL + ' / 共 ' + (PASS + FAIL));
  process.exit(FAIL === 0 ? 0 : 1);
})();
