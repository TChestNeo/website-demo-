// tmp-probe-fc-ttlib.js — FC v10.28.47.0 文字工具栏弹层图库同步 上线实机探针（rev 00299-）
// 用户「文字的工具栏那边的添加图像的图库有没有做好同步图库？」「能不能同步一下？」钦定：搜索框保持搜维基+全部同步
//   S 静态（线上 site-config 47.0 + rev 00299- + 站点 58.0 恒 + 同步图库 changelog + 46.0 零残留；
//     编辑器页弹层锚 ttFilterBtn/ttFilterMenu/ttTagManageBtn/TT_FILTER_TAG_IDS/桥 exports/钩子）
//   P 实机（桌面 CDP + 一次性临时 profile）：P1 开弹层→库格两列+上传格尾位｜P2 筛选并集｜
//     P3 点库格→卡内输入框内联插入+弹层关｜P4 标签管理叠弹层不坏｜
//     P5 真维基搜索（超时容忍+一次重试）→清除回库视图+筛选保持｜P6 弹层上传带标签→库+弹层即现｜E1 零异常。
// 探针纪律：一次性 user-data-dir（与用户真实 profile 隔离）+ 收尾清草稿/图库/标签键——零污染。
'use strict';
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PASS = { n: 0 }, FAIL = { n: 0 };
const ok = (name, cond, detail) => {
  if (cond) { PASS.n++; console.log('  ✅ ' + name); }
  else { FAIL.n++; console.log('  ❌ ' + name + (detail ? '  ' + detail : '')); }
};
const get = (url, opts) => new Promise((resolve) => {
  opts = opts || {};
  const req = https.request(url, { method: opts.method || 'GET', headers: Object.assign({ 'User-Agent': 'mn-probe' }, opts.headers), timeout: 30000 }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 2000000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  if (opts.body) req.write(opts.body);
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
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
        this.errs.push(String(d.text || (d.exception && d.exception.description) || '').slice(0, 300));
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

(async () => {
  const BASE = 'https://mnationworld.com';

  // ── S 线上静态 ──
  const sc = await get(BASE + '/assets/js/site-config.js');
  ok('S1 线上 site-config：FC v10.28.48.0 + rev 00346- 前缀 + 站点恒 v0.2.58.25 + 同步图库 changelog + 旧 47.1 版本赋值锚零残留',
    sc.status === 200 && sc.body.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") !== -1 &&
    sc.body.indexOf('rev 00346-') !== -1 && sc.body.indexOf('v0.2.58.25') !== -1 &&
    sc.body.indexOf('同步图库') !== -1 && sc.body.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.2';") === -1,
    'status=' + sc.status + ' err=' + sc.error);
  const ed = await get(BASE + '/pages/fluidcanvas-editor.html');
  ok('S2 线上编辑器页：弹层筛选/管理锚 + TT_FILTER_TAG_IDS + 桥 exports + 钩子 ≥5',
    ed.status === 200 &&
    ed.body.indexOf('id="ttFilterBtn"') !== -1 &&
    ed.body.indexOf('id="ttFilterMenu"') !== -1 &&
    ed.body.indexOf('id="ttTagManageBtn"') !== -1 &&
    ed.body.indexOf('id="ttFilterCount"') !== -1 &&
    ed.body.indexOf('TT_FILTER_TAG_IDS') !== -1 &&
    ed.body.indexOf('window.currentTabItems = currentTabItems') !== -1 &&
    ed.body.indexOf('window.esc = esc') !== -1 &&
    (ed.body.match(/window\.__ttOnTagsChanged/g) || []).length >= 5,
    'status=' + ed.status + ' hooks=' + (ed.body.match(/window\.__ttOnTagsChanged/g) || []).length + ' err=' + ed.error);

  // ── P 实机（一次性 profile + 收尾清键） ──
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-fcttlib-' + Date.now());
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

    // 页内工具：合成图 URL / 弹层上传 / 读 toast / 弹层网格快照
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
      window.__lib = function () { try { return JSON.parse(localStorage.getItem('slati_img_library') || '[]'); } catch (e) { return []; } };
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

    // ── P1 开弹层→真实图库条目 ──
    await cdp.evalJs("window.showImgPop(); true");
    await sleep(400);
    const p1 = await cdp.evalJs("window.__grid()");
    ok('P1 开弹层：3 库格两列+上传格尾位+零条纹+库视图态',
      p1.libN === 3 && p1.uploads === 1 && p1.stripes === 0 && p1.mode === true && p1.searchMode === false &&
      JSON.stringify(p1.names) === JSON.stringify(['A', 'B', 'C']),
      JSON.stringify(p1));

    // ── P2 筛选 OR 并集（每次菜单重渲染后重查 NodeList） ──
    await cdp.evalJs("document.getElementById('ttFilterBtn').click(); true");
    await sleep(250);
    await cdp.evalJs("document.querySelectorAll('#ttFilterMenu .tt-filter-item')[0].click(); true"); // 国旗
    await sleep(300);
    const p2a = await cdp.evalJs("window.__grid()");
    await cdp.evalJs("document.querySelectorAll('#ttFilterMenu .tt-filter-item')[2].click(); true"); // 地图
    await sleep(300);
    const p2b = await cdp.evalJs("window.__grid()");
    ok('P2 筛选并集实机：选国旗 n=' + p2a.libN + ' 徽章=' + p2a.badge.text + ' → 加选地图 n=' + p2b.libN + ' 徽章=' + p2b.badge.text,
      p2a.libN === 2 && p2b.libN === 3 && p2a.badge.text === '1' && p2b.badge.text === '2' && p2a.badge.hidden === false,
      JSON.stringify({ p2a: p2a, p2b: p2b }));

    // ── P3 点库格→卡内输入框内联插入+弹层关 ──
    await cdp.evalJs("window.__card = window.createCharacterCard(2, 2, 4, 5); var inp = window.__card.querySelector('input.card-label') || window.__card.querySelector('input'); inp.focus(); true");
    await cdp.evalJs("window.showImgPop(); true"); // 重捕获 IMG_SAVED_INPUT（弹层开着也重跑）
    await sleep(300);
    await cdp.evalJs("document.querySelectorAll('#ttImgGrid .tt-lib-tile')[0].click(); true");
    await sleep(400);
    const p3 = await cdp.evalJs(`(function(){
      var rich = window.__card.querySelector('[data-rich="1"]');
      var img = rich ? rich.querySelector('img.tt-inline-img') : null;
      return { rich: !!rich, has: !!img, src: img ? img.src === ${JSON.stringify(seed.uA)} : false,
        name: img ? img.dataset.imgName : null, desc: img ? img.dataset.imgDesc : null,
        vis: img ? img.dataset.imgVisibility : null, toast: window.__toast(),
        popClosed: !document.getElementById('ttImgPop').classList.contains('active') };
    })()`);
    ok('P3 点库格：弹层关+卡内输入框 richify+img 三 dataset+toast 图片已插入',
      p3.rich === true && p3.has === true && p3.src === true && p3.name === 'A' && p3.desc === 'A desc' &&
      p3.vis === 'private' && p3.toast.indexOf('图片已插入：A') !== -1 && p3.popClosed === true,
      JSON.stringify(p3));

    // ── P4 标签管理叠弹层（#ttTagManageBtn 进） ──
    await cdp.evalJs("window.showImgPop(); true");
    await sleep(300);
    await cdp.evalJs("document.getElementById('ttTagManageBtn').click(); true");
    await sleep(400);
    const p4a = await cdp.evalJs("(function(){ return { tm: !!document.querySelector('#tagManageModal .modal-card.active'), pop: document.getElementById('ttImgPop').classList.contains('active') }; })()");
    ok('P4a 标签管理弹窗叠在弹层上（tagManageModal active 且 ttImgPop 仍 active）', p4a.tm === true && p4a.pop === true, JSON.stringify(p4a));
    await cdp.evalJs("window.closeTagManage ? window.closeTagManage() : null; true");
    await sleep(300);
    const p4b = await cdp.evalJs("(function(){ return { tm: !document.querySelector('#tagManageModal .modal-card.active'), pop: document.getElementById('ttImgPop').classList.contains('active') }; })()");
    ok('P4b 关标签管理=弹层不坏（modal 关、ttImgPop 仍 active）', p4b.tm === true && p4b.pop === true, JSON.stringify(p4b));

    // ── P5 真维基搜索（超时容忍+一次重试；搜索只接 Enter/按钮 click 不听 input）→清除回库视图 ──
    const wikiTry = async () => {
      await cdp.evalJs("(function(){ var q = document.getElementById('ttImgSearch'); q.value = 'flag'; q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true; })()");
      await waitFor(cdp, "document.querySelectorAll('#ttImgGrid .tim-thumb-tile').length >= 1", 15000, 'P5 真维基结果');
    };
    let wikiOk = false;
    try { await wikiTry(); wikiOk = true; } catch (e) {
      await sleep(500);
      try {
        await cdp.evalJs("document.getElementById('ttImgClear').click(); true");
        await sleep(300);
        await wikiTry();
        wikiOk = true;
      } catch (e2) { wikiOk = false; }
    }
    if (wikiOk) {
      const p5a = await cdp.evalJs("window.__grid()");
      ok('P5a 真维基搜索：thumb 结果 ≥1+搜索态', p5a.thumbs >= 1 && p5a.searchMode === true && p5a.mode === false, JSON.stringify(p5a));
      await cdp.evalJs("document.getElementById('ttImgClear').click(); true");
      await sleep(400);
      const p5b = await cdp.evalJs("window.__grid()");
      ok('P5b 清空搜索：回库视图全量 3 格+徽章隐藏（P4 重开弹层筛选已重置）',
        p5b.mode === true && p5b.searchMode === false && p5b.libN === 3 && p5b.badge.hidden === true,
        JSON.stringify(p5b));
    } else {
      ok('P5 真维基搜索（超时容忍+一次重试）：两次均无结果（网络/CORS 环境因素）', false, 'commons fetch 双败');
    }

    // ── P6 弹层上传带标签→库+钩子重绘（点 chip 触发既存 document 收浮层=弹层关，重开仍在） ──
    const u6 = await cdp.evalJs("window.__mkImgPop('probe-live.png', '#c70', '#020')");
    await waitFor(cdp, metaOpen, 8000, 'P6 元数据弹窗打开');
    await cdp.evalJs("(function(){ var c = document.querySelectorAll('#immTagChips .imm-tag-chip')[0]; c.click(); })()");
    await cdp.evalJs("window.imgMetaSave()");
    await waitFor(cdp, metaClosed, 4000, 'P6 元数据弹窗关闭');
    await sleep(500);
    const p6 = await cdp.evalJs(`(function(){
      var e = window.__lib().filter(function(x){ return x.src === '${u6}'; })[0];
      // openImgMetaModal 剥扩展名：条目名 'probe-live'（电池 T8 同口径）
      return { has: !!e, tags: e ? JSON.stringify(e.tags) : null,
        tile: document.getElementById('ttImgGrid').textContent.indexOf('probe-live') !== -1 };
    })()`);
    ok('P6 弹层上传→保存：库条目 tags==["sys-flag"] + 钩子重绘网格含新条目（弹层关=既存收浮层行为）',
      p6.has === true && p6.tags === '["sys-flag"]' && p6.tile === true,
      JSON.stringify(p6));
    await cdp.evalJs("window.showImgPop(); true");
    await sleep(400);
    const p6b = await cdp.evalJs(`(function(){
      var g = window.__grid();
      return { libN: g.libN, has: g.names.indexOf('probe-live') !== -1, pop: document.getElementById('ttImgPop').classList.contains('active') };
    })()`);
    ok('P6b 重开弹层：新条目仍在（持久库已存：' + p6b.libN + ' 条目含 probe-live）',
      p6b.has === true && p6b.pop === true, JSON.stringify(p6b));

    ok('E1 全程零 Runtime exception + 零 console error', cdp.errs.length === 0 && cdp.consoleErrs.length === 0,
      JSON.stringify({ errs: cdp.errs.slice(0, 3), cons: cdp.consoleErrs.slice(0, 3) }));

    // 收尾：清草稿/图库/标签键（一次性 profile 内零污染）
    await cdp.evalJs("localStorage.removeItem('slati_fluidcanvas_draft'); localStorage.removeItem('slati_img_library'); localStorage.removeItem('slati_img_tags');");
    cdp.close();
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
    console.error('💥 ' + (e.stack || e.message));
    process.exit(1);
  }
  try { chrome.kill(); } catch (e) {}
  console.log('');
  console.log(FAIL.n === 0 ? '🎉 全部通过 ' + PASS.n + '/' + PASS.n : '💔 失败 ' + FAIL.n + ' / 共 ' + (PASS.n + FAIL.n));
  process.exit(FAIL.n === 0 ? 0 : 1);
})();
