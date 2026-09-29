// tmp-probe-fc-ttwide.js — FC v10.28.47.1 添加图像弹层加大 上线实机探针（rev 00300-）
// 用户「那个添加图像的窗口能不能做大些？」钦定：440px·3 列（推荐档）
//   S 静态（线上 site-config 47.1 + rev 00300- + 站点 58.0 恒 + 做大些 changelog + 47.0 零残留；
//     编辑器页新几何锚 440px/3 列/380px 滚动/60px 缩略图/11px 图名 + 旧弹层整条规则零残留）
//   P 实机（桌面 CDP + 一次性临时 profile）：P1 开弹层宽 440 右缘对齐不越屏｜P2 库视图 3 列轨+
//     缩略图 60×60｜P2b 12 条目网格 380px 滚动封顶｜P3 点库格内联插入+弹层关（插入链回归）｜E1 零异常。
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
  ok('S1 线上 site-config：FC v10.28.48.0 + rev 00336- 前缀 + 站点恒 v0.2.58.20 + 做大些 changelog + 旧 47.1 版本赋值锚零残留',
    sc.status === 200 && sc.body.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.48.0';") !== -1 &&
    sc.body.indexOf('rev 00336-') !== -1 && sc.body.indexOf('v0.2.58.20') !== -1 &&
    sc.body.indexOf('做大些') !== -1 && sc.body.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.47.2';") === -1,
    'status=' + sc.status + ' err=' + sc.error);
  const ed = await get(BASE + '/pages/fluidcanvas-editor.html');
  ok('S2 线上编辑器页：新几何锚（440px 宽/3 列×2/380px 滚动/60px 缩略图/11px 图名两行截断）+ 旧弹层整条规则零残留',
    ed.status === 200 &&
    ed.body.indexOf('.radius-popover.tt-img-pop { z-index: 302; width: 440px; max-width: calc(100vw - 16px); padding: 12px; }') !== -1 &&
    (ed.body.match(/repeat\(3, 1fr\)/g) || []).length >= 2 &&
    ed.body.indexOf('max-height: 380px; overflow-y: auto') !== -1 &&
    ed.body.indexOf('width: 60px; height: 60px; flex: none; border-radius: 6px;') !== -1 &&
    ed.body.indexOf('font-size: 11px; line-height: 1.35;') !== -1 &&
    ed.body.indexOf('-webkit-line-clamp: 2') !== -1 &&
    ed.body.indexOf('.radius-popover.tt-img-pop { z-index: 302; width: 280px; padding: 10px; }') === -1 &&
    ed.body.indexOf('.tim-grid.tt-lib-mode { grid-template-columns: repeat(2, 1fr); }') === -1,
    'status=' + ed.status + ' err=' + ed.error);

  // ── P 实机（一次性 profile + 收尾清键） ──
  const CDP_PORT = 9900 + Math.floor(Math.random() * 100);
  const USER_DATA = path.join(os.tmpdir(), 'mn-probe-fcttwide-' + Date.now());
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
    await waitFor(cdp, "!!window.MN_I18N && !!document.getElementById('gridCanvas') && !!window.imgMetaSave && !!window.showImgPop && !!window.imgLibPut", 30000, '编辑器加载');
    await sleep(800);

    // 页内工具：合成图 URL / 读 toast / 网格几何快照
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
        return {
          gridCols: cs.gridTemplateColumns.split(' ').length,
          libN: document.querySelectorAll('#ttImgGrid .tt-lib-tile').length,
          uploads: document.querySelectorAll('#ttImgGrid .tim-upload').length,
          stripes: document.querySelectorAll('#ttImgGrid .tim-stripes').length,
          thumbW: thumb ? window.getComputedStyle(thumb).width : null,
          clientH: grid.clientHeight, scrollH: grid.scrollHeight
        };
      };
    })()`);

    // ── P1 开弹层几何：宽 440+钮上方右缘对齐+不越视口（空库矮弹层，上方放得下——同电池 T1 口径） ──
    await cdp.evalJs("window.__card = window.createCharacterCard(2, 2, 4, 5); var inp = window.__card.querySelector('input.card-label') || window.__card.querySelector('input'); inp.focus(); true");
    await cdp.evalJs("window.showImgPop(); true");
    await sleep(400);
    const p1 = await cdp.evalJs(`(function(){
      var b = document.getElementById('ttImgBtn').getBoundingClientRect();
      var p = document.getElementById('ttImgPop').getBoundingClientRect();
      return { w: p.width, above: p.bottom <= b.top - 4 && p.top < b.top,
        rightAlign: Math.abs(p.right - b.right) <= 2, inView: p.right <= window.innerWidth - 4 };
    })()`);
    ok('P1 开弹层：计算宽 440±2+钮上方右缘对齐+不越视口', Math.abs(p1.w - 440) <= 2 && p1.above === true && p1.rightAlign === true && p1.inView === true, JSON.stringify(p1));

    // ── 种子：3 张库图（一次性 profile 内，收尾清键）——P1 之后才种，重开弹层即见 ──
    const seed = await cdp.evalJs(`(function(){
      var uA = window.__mkUrl('#e33', '#fff');
      var uB = window.__mkUrl('#36e', '#0a0');
      var uC = window.__mkUrl('#a4c', '#ff0');
      window.imgLibPut(uA, { name: 'A', desc: 'A desc', visibility: 'private', tags: ['sys-flag'] });
      window.imgLibPut(uB, { name: 'B', desc: 'B desc', visibility: 'private', tags: ['sys-map'] });
      window.imgLibPut(uC, { name: 'C', desc: 'C desc', visibility: 'private', tags: ['sys-flag', 'sys-emblem'] });
      return { uA: uA };
    })()`);
    await cdp.evalJs("window.hideImgPop(); window.showImgPop(); true");
    await sleep(300);

    // ── P2 库视图 3 列+缩略图 60×60 ──
    const p2 = await cdp.evalJs("window.__geo()");
    ok('P2 库视图：3 列轨+3 库格+上传格尾位+缩略图 60 宽', p2.gridCols === 3 && p2.libN === 3 && p2.uploads === 1 && p2.stripes === 0 && p2.thumbW === '60px', JSON.stringify(p2));

    // ── P2b 12 条目：网格 380px 滚动封顶（弹层不再无限拉长） ──
    await cdp.evalJs(`(function(){
      var colors = ['#5a5','#f80','#08f','#f0f','#0f8','#e90','#90e','#099','#c33','#7a7','#a7a','#77a'];
      for (var i = 0; i < 12; i++) window.imgLibPut(window.__mkUrl(colors[i], '#fff'), { name: 'img' + i, desc: 'd', visibility: 'private', tags: [] });
    })()`);
    await cdp.evalJs("window.hideImgPop(); window.showImgPop(); true");
    await sleep(400);
    const p2b = await cdp.evalJs("window.__geo()");
    ok('P2b 12 条目：网格 clientHeight ≤380 且超高滚动', p2b.libN >= 12 && p2b.clientH <= 381 && p2b.scrollH > p2b.clientH, JSON.stringify(p2b));

    // ── P3 点库格内联插入+弹层关（大窗不坏插入链） ──
    await cdp.evalJs("window.showImgPop(); true"); // 重捕获 IMG_SAVED_INPUT
    await sleep(300);
    await cdp.evalJs("document.querySelectorAll('#ttImgGrid .tt-lib-tile')[0].click(); true");
    await sleep(400);
    const p3 = await cdp.evalJs(`(function(){
      var rich = window.__card.querySelector('[data-rich="1"]');
      var img = rich ? rich.querySelector('img.tt-inline-img') : null;
      return { rich: !!rich, has: !!img, toast: window.__toast(),
        popClosed: !document.getElementById('ttImgPop').classList.contains('active') };
    })()`);
    ok('P3 点库格：弹层关+卡内输入框 richify+toast 图片已插入（插入链回归）', p3.rich === true && p3.has === true && p3.toast.indexOf('图片已插入') !== -1 && p3.popClosed === true, JSON.stringify(p3));

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
