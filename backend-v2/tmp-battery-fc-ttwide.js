// tmp-battery-fc-ttwide.js — FC v10.28.47.1 添加图像弹层加大电池
// 用户「那个添加图像的窗口能不能做大些？」；一问钦定：440px·3 列（推荐档）
// 验证：S 静态锚（site-config 47.1/00300-/58.0/做大些/旧赋值零残留 + 弹层新几何 CSS 锚 +
//        旧 280px/2 列零残留 + 47.0 遗锚）＋ T 行为段（桌面 CDP + 本地 /wikistub 维基桩）：
//         T1 开弹层：宽 440 计算值+钮上方右缘对齐+不越视口
//         T2 库视图 3 列（计算 grid-template-columns 3 轨）+3 库格+上传格尾位+缩略图 60×60+图名 11px
//         T3 维基搜索态 3 列+清除回库视图
//         T4 12 条目网格超高滚动（clientHeight ≤380 且 scrollHeight>clientHeight——不再无限拉长）
//         T5 点库格内联插入回归（弹层关+richify+toast）
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
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-ttwide-' + Date.now());
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
    const occ = (s, sub) => s.split(sub).length - 1;
    ok('S1 site-config：FC v10.28.48.0 + rev 00348- 占位 + 站点恒 v0.2.58.28 + 「做大些」在 changelog + 47.1 条目保留 + 旧赋值零残留',
      siteCfg.indexOf('v10.28.62.6') !== -1 && siteCfg.indexOf('00348-') !== -1 &&
      siteCfg.indexOf('v0.2.58.28') !== -1 && siteCfg.indexOf('做大些') !== -1 &&
      siteCfg.indexOf('v10.28.47.0 = 文字工具栏添加图像弹层图库同步') !== -1 &&
      siteCfg.indexOf("'v10.28.47.2';") === -1);
    ok('S2 弹层新几何锚：440px 宽+库格/维基格 3 列+网格 380px 超高滚动+缩略图 60×60+图名 11px 两行截断',
      editorHtml.indexOf('.radius-popover.tt-img-pop { z-index: 302; width: 440px; max-width: calc(100vw - 16px); padding: 12px; }') !== -1 &&
      occ(editorHtml, 'repeat(3, 1fr)') >= 2 &&
      editorHtml.indexOf('.tim-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; max-height: 380px; overflow-y: auto; }') !== -1 &&
      editorHtml.indexOf('width: 60px; height: 60px; flex: none; border-radius: 6px;') !== -1 &&
      editorHtml.indexOf('font-size: 11px; line-height: 1.35;') !== -1 &&
      editorHtml.indexOf('-webkit-line-clamp: 2') !== -1);
    ok('S3 旧弹层几何整条规则零残留（280px 宽/2 列库格/2 列维基格/44px 缩略图/10px 单行名全灭——文件其余同名样式不属弹层）',
      editorHtml.indexOf('.radius-popover.tt-img-pop { z-index: 302; width: 280px; padding: 10px; }') === -1 &&
      editorHtml.indexOf('.tim-grid.tt-lib-mode { grid-template-columns: repeat(2, 1fr); }') === -1 &&
      editorHtml.indexOf('.tim-grid.tim-search-mode { grid-template-columns: repeat(2, 1fr); }') === -1 &&
      editorHtml.indexOf('width: 44px; height: 44px; flex: none; border-radius: 5px;') === -1 &&
      editorHtml.indexOf('font-size: 10px; line-height: 1.3;') === -1);
    ok('S4 47.0 遗锚：弹层图库同步机器在场（4 id+TT_FILTER_TAG_IDS+renderTTLib+钩子 5 处）',
      editorHtml.indexOf('id="ttFilterBtn"') !== -1 && editorHtml.indexOf('id="ttFilterMenu"') !== -1 &&
      editorHtml.indexOf('id="ttFilterCount"') !== -1 && editorHtml.indexOf('id="ttTagManageBtn"') !== -1 &&
      editorHtml.indexOf('var TT_FILTER_TAG_IDS = [];') !== -1 &&
      editorHtml.indexOf('function renderTTLib') !== -1 &&
      editorHtml.indexOf('renderLibTiles(grid); // 旗格+上传格恒尾位') !== -1 &&
      occ(editorHtml, 'if (window.__ttOnTagsChanged) window.__ttOnTagsChanged();') === 4 &&
      editorHtml.indexOf('function insertInlineImage(src, alt, meta)') !== -1);

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
    await waitFor(cdp, "!!window.MN_I18N && !!document.getElementById('gridCanvas') && !!window.imgMetaSave && !!window.showImgPop && !!window.imgLibPut", 30000, '编辑器加载');
    await sleep(800);

    // 页内工具：合成图 URL / 读 toast / 网格快照（含几何：列轨数/缩略图尺寸/图名字号/滚动态）
    await cdp.evalJs("window.__toast = function () { var t = document.getElementById('toast'); return t ? t.textContent : ''; };");
    await cdp.evalJs(`(function(){
      window.__mkUrl = function (colorA, colorB) {
        var cv = document.createElement('canvas'); cv.width = 8; cv.height = 6;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = colorA; ctx.fillRect(0, 0, 8, 6);
        ctx.fillStyle = colorB; ctx.fillRect(0, 0, 4, 6);
        return cv.toDataURL('image/png');
      };
      window.__geo = function () {
        var grid = document.getElementById('ttImgGrid');
        var cs = window.getComputedStyle(grid);
        var tile = document.querySelector('#ttImgGrid .tt-lib-tile');
        var thumb = tile ? tile.querySelector('.tt-lib-thumb') : null;
        var name = tile ? tile.querySelector('.tt-lib-name') : null;
        return {
          gridCols: cs.gridTemplateColumns.split(' ').length,
          libN: document.querySelectorAll('#ttImgGrid .tt-lib-tile').length,
          uploads: document.querySelectorAll('#ttImgGrid .tim-upload').length,
          stripes: document.querySelectorAll('#ttImgGrid .tim-stripes').length,
          thumbW: thumb ? window.getComputedStyle(thumb).width : null,
          thumbH: thumb ? window.getComputedStyle(thumb).height : null,
          nameFont: name ? window.getComputedStyle(name).fontSize : null,
          clientH: grid.clientHeight, scrollH: grid.scrollHeight
        };
      };
    })()`);

    // ── T1 开弹层几何：宽 440+钮上方右缘对齐+不越视口 ──
    await cdp.evalJs("window.__cardT = window.createCharacterCard(2, 2, 4, 5); var inp = window.__cardT.querySelector('input.card-label') || window.__cardT.querySelector('input'); inp.focus(); true");
    await cdp.evalJs("window.showImgPop(); true");
    await sleep(400);
    const t1 = await cdp.evalJs(`(function(){
      var b = document.getElementById('ttImgBtn').getBoundingClientRect();
      var p = document.getElementById('ttImgPop').getBoundingClientRect();
      return { w: p.width, above: p.bottom <= b.top - 4 && p.top < b.top,
        rightAlign: Math.abs(p.right - b.right) <= 2, inView: p.right <= window.innerWidth - 4 };
    })()`);
    ok('T1 开弹层：计算宽 440±2+钮上方右缘对齐+不越视口（钳制数学原样）',
      Math.abs(t1.w - 440) <= 2 && t1.above === true && t1.rightAlign === true && t1.inView === true, JSON.stringify(t1));

    // ── T2 库视图 3 列（种子 3 条目） ──
    await cdp.evalJs(`(function(){
      var uA = window.__mkUrl('#e33', '#fff');
      var uB = window.__mkUrl('#36e', '#0a0');
      var uC = window.__mkUrl('#a4c', '#ff0');
      window.imgLibPut(uA, { name: 'A', desc: 'A desc', visibility: 'private', tags: ['sys-flag'] });
      window.imgLibPut(uB, { name: 'B', desc: 'B desc', visibility: 'private', tags: ['sys-map'] });
      window.imgLibPut(uC, { name: 'C', desc: 'C desc', visibility: 'private', tags: ['sys-flag', 'sys-emblem'] });
    })()`);
    await cdp.evalJs("window.hideImgPop(); window.showImgPop(); true");
    await sleep(400);
    const t2 = await cdp.evalJs("window.__geo()");
    ok('T2 库视图：3 列轨+3 库格+上传格尾位+零条纹+缩略图 60×60+图名 11px',
      t2.gridCols === 3 && t2.libN === 3 && t2.uploads === 1 && t2.stripes === 0 &&
      t2.thumbW === '60px' && t2.thumbH === '60px' && t2.nameFont === '11px', JSON.stringify(t2));

    // ── T3 维基搜索态 3 列+清除回库视图 ──
    await cdp.evalJs("window.FC_IMG_SEARCH_API = " + JSON.stringify(BASE + '/wikistub') + "; var inp = document.getElementById('ttImgSearch'); inp.value = 'cat'; inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); true");
    await waitFor(cdp, "document.querySelectorAll('#ttImgGrid .tim-thumb-tile').length === 2", 8000, 'T3 维基桩结果');
    const t3a = await cdp.evalJs(`(function(){
      var g = document.getElementById('ttImgGrid');
      var cs = window.getComputedStyle(g);
      return { cols: cs.gridTemplateColumns.split(' ').length,
        searchMode: g.classList.contains('tim-search-mode'), thumbs: document.querySelectorAll('#ttImgGrid .tim-thumb-tile').length };
    })()`);
    ok('T3a 维基搜索=3 列轨+搜索态+2 缩略格（搜索框仍搜维基）',
      t3a.cols === 3 && t3a.searchMode === true && t3a.thumbs === 2, JSON.stringify(t3a));
    await cdp.evalJs("document.getElementById('ttImgClear').click(); true");
    await sleep(300);
    const t3b = await cdp.evalJs(`(function(){
      var g = document.getElementById('ttImgGrid');
      var cs = window.getComputedStyle(g);
      return { cols: cs.gridTemplateColumns.split(' ').length, libMode: g.classList.contains('tt-lib-mode'),
        libN: document.querySelectorAll('#ttImgGrid .tt-lib-tile').length };
    })()`);
    ok('T3b 清除搜索=回库视图 3 列+全量条目', t3b.cols === 3 && t3b.libMode === true && t3b.libN === 3, JSON.stringify(t3b));

    // ── T4 12 条目：网格超高滚动（不再无限拉长弹层） ──
    await cdp.evalJs(`(function(){
      var colors = ['#e33','#36e','#a4c','#5a5','#f80','#08f','#f0f','#0f8','#e90','#90e','#099','#c33'];
      var ws = ['国旗','地图','国徽','旗帜','徽章','图章','标志','纹章','旗帜图','地图图','徽章图','标志图'];
      for (var i = 0; i < 12; i++) {
        window.imgLibPut(window.__mkUrl(colors[i], '#fff'), { name: 'img' + i, desc: 'd', visibility: 'private', tags: [] });
      }
    })()`);
    await cdp.evalJs("window.hideImgPop(); window.showImgPop(); true");
    await sleep(400);
    const t4 = await cdp.evalJs("window.__geo()");
    ok('T4 12 条目：网格 clientHeight ≤380 且超高滚动（scrollHeight>clientHeight，弹层不再无限拉长）',
      t4.libN >= 12 && t4.clientH <= 381 && t4.scrollH > t4.clientH, JSON.stringify(t4));

    // ── T5 点库格内联插入回归（大窗不坏插入链） ──
    await cdp.evalJs("window.__cardI = window.createCharacterCard(6, 2, 4, 5); var inp = window.__cardI.querySelector('input.card-label') || window.__cardI.querySelector('input'); inp.focus(); true");
    await cdp.evalJs("window.showImgPop(); true"); // 重捕获 IMG_SAVED_INPUT
    await sleep(300);
    await cdp.evalJs("document.querySelectorAll('#ttImgGrid .tt-lib-tile')[0].click(); true");
    await sleep(400);
    const t5 = await cdp.evalJs(`(function(){
      var rich = window.__cardI.querySelector('[data-rich="1"]');
      var img = rich ? rich.querySelector('img.tt-inline-img') : null;
      return { rich: !!rich, has: !!img, toast: window.__toast(),
        popClosed: !document.getElementById('ttImgPop').classList.contains('active') };
    })()`);
    ok('T5 点库格：弹层关+卡内输入框 richify+toast 图片已插入（插入链回归）',
      t5.rich === true && t5.has === true && t5.toast.indexOf('图片已插入') !== -1 && t5.popClosed === true, JSON.stringify(t5));

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
  console.log(FAIL === 0 ? '🎉 全部通过 ' + PASS + '/' + PASS + '  (fc-ttwide)' : '💔 失败 ' + FAIL + ' / 共 ' + (PASS + FAIL));
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(FAIL === 0 ? 0 : 1);
})();
