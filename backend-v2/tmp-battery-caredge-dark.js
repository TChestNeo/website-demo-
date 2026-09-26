// tmp-battery-caredge-dark.js — 卡框高光清除+边框统一暗色验证（v0.2.30.3 轮起）
// 背景：用户「深色模式下卡片外框右上角有一条很突兀的白色/浅色高光边线…清除卡片右上角及
// 整个外框所有的白色/浅色渐变高光线」+「将卡片整体的外边框统一改为暗色低调的微弱边框…
// 融入深色背景」。真身=v10.27 磨砂玻璃轮「右上角 2px 高光条」（白渐变贴 top right）。
// v10.28.31 适配：①tier:'premium' 预设（订阅门禁激活）；②组背景卡面描边断言换
// v10.28.26 剪影轮口径——border 已由四向 drop-shadow 栈替代（clip-path 裁 bbox 边框），
// 同一用户规格（divider-line 微弱线）新机制；③卡圆角字面量 14px → var(--card-radius)。
// 断言组：
//   F1-F3 静态：高光梯度全文件只剩 1 处（统计编辑面板·钦定保留）、卡面规则换
//   var(--divider-line)/--card-layers、版本升位+buildDraft 链；
//   B1 浅色：旗/内容/表格三种卡 background-image none + 边框=网格线色（=--divider-line）；
//   B3+B5 吸合成组：拖卡过程 1 个 .cell-hl、合并后组背景卡面无高光+描边栈同 token；
//   B2 深色：data-theme=dark 后边框恰 = rgba(255,255,255,0.08)（用户举例值）且无高光；
//   B4 版本徽章；Z 零 console error。
// 跑法：node backend-v2/tmp-battery-caredge-dark.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const DOCS = path.resolve(__dirname, '..', 'docs');
const PORT = 4600 + Math.floor(Math.random() * 300);
const CDP_PORT = 5700 + Math.floor(Math.random() * 300);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-caredge-' + Date.now());

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
        this.errs.push(JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
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

  // ── F1-F3 静态 ──
  const fce = fs.readFileSync(path.join(DOCS, 'pages', 'fluidcanvas-editor.html'), 'utf8');
  const hlGrad = 'linear-gradient(to left, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0))';
  const hlCount = fce.split(hlGrad).length - 1;
  ok('F1 静态：高光梯度全文件只剩 1 处（统计编辑面板·钦定保留）；卡面规则换 --divider-line/--card-layers',
    hlCount === 1 &&
    fce.indexOf('--card-border-color: var(--divider-line);') !== -1 &&
    fce.indexOf('border: 1px solid var(--divider-line);') !== -1 &&
    fce.indexOf('border-radius: var(--card-radius);') !== -1 &&
    (fce.split('background-image: var(--card-layers, none);').length - 1) === 3 &&
    fce.indexOf('linear-gradient(to left, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0)), var(--card-layers, none)') === -1);
  const sconf = fs.readFileSync(path.join(DOCS, 'assets', 'js', 'site-config.js'), 'utf8');
  ok('F2 静态：版本升位 v0.2.45.2 + v10.28.34.2（贴齐缝修复轮）+ 历史链锚仍在',
    sconf.indexOf("window.MN_SITE_VERSION = 'v0.2.45.2';") !== -1 &&
    sconf.indexOf("window.FLUIDCANVAS_VERSION = 'v10.28.34.2';") !== -1 &&
    sconf.indexOf('小更新位 30→31') !== -1 &&
    sconf.indexOf('小改动位 40→41') !== -1);
  ok('F3 静态：buildDraft 链新条目 v10.28.20.3 adds NO new fields (卡框高光清除…',
    fce.indexOf('v10.28.20.3 adds NO new fields (卡框高光清除+边框统一暗色') !== -1);

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
    '--window-size=1400,1000', '--remote-debugging-port=' + CDP_PORT,
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

    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}'
    });
    // v10.28.31 订阅门禁激活（TEST_MODE=false）——本电池测边缘主题，按订阅用户跑
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'try{localStorage.setItem("slati_user", ' + JSON.stringify(JSON.stringify({ id: 'USR-batt', displayName: 'Battery Tester', citizenId: 'CIT-8842', tier: 'premium' })) + ');}catch(e){}'
    });
    await cdp.send('Page.navigate', { url: BASE + '/pages/fluidcanvas-editor.html' });
    await waitFor(cdp, "typeof window.findMergeSnap === 'function'", 20000, '编辑器加载');
    await sleep(600);

    const setup = await cdp.evalJs(`(function(){
      var A = window.createFlagCard(); window.moveCardPx(A, 60, 60);
      var S = window.createSheetCard(); window.moveCardPx(S, 300, 60);
      var T = window.createContentCard(); window.moveCardPx(T, 560, 60);
      var C = window.createFlagCard(); window.moveCardPx(C, 700, 300);
      return { a: A.dataset.cardId, s: S.dataset.cardId, t: T.dataset.cardId, c: C.dataset.cardId };
    })()`);
    console.log('  ℹ 铺卡完成:', JSON.stringify(setup));
    await sleep(300);

    const helpers = "function byId(id){ return Array.from(document.querySelectorAll('.grid-card')).find(function(c){ return c.dataset.cardId === id; }); }" +
      "function relRect(el){ var cr = document.querySelector('.grid-canvas').getBoundingClientRect(); var b = el.getBoundingClientRect(); return { left: b.left - cr.left, top: b.top - cr.top, right: b.right - cr.left, bottom: b.bottom - cr.top }; }";

    // 网格线色提取（= --divider-line 解析值）：从 .grid-canvas 的 background-image
    // 第一条渐变里抓首个 rgba() —— 与卡边框 computed borderColor 同引擎序列化，字符串相等。
    // 纯内层函数（不拼 helpers——拼在前会成「var x = function byId(){…}」具名函数陷阱）
    const gridLineFn = `function(){
      var g = document.querySelector('.grid-canvas');
      var bi = getComputedStyle(g).backgroundImage;
      var m = bi.match(/rgba?\\([^)]*\\)/);
      return m ? m[0] : '';
    }`;

    // ── B1 浅色：三种卡（玻璃族旗/内容 + 非玻璃族表格）无高光 + 边框=网格线色 ──
    ok('B1 浅色无高光+统一暗色边框：旗/内容/表格三卡 background-image none 且边框色=网格线色（--divider-line）',
      await cdp.evalJs(helpers + `(function(){
        var line = (${gridLineFn})();
        if (!line) return false;
        return ['${setup.a}', '${setup.t}', '${setup.s}'].every(function(id){
          var el = byId(id);
          var cs = getComputedStyle(el);
          return cs.backgroundImage === 'none' && cs.borderColor === line;
        });
      })()`));

    // ── B3+B5 吸合成组：拖卡过程 1 个 .cell-hl；合并后组背景无高光+边框同 token ──
    const merged = await cdp.evalJs(helpers + `(async function(){
      var A = byId('${setup.a}'), C = byId('${setup.c}');
      var rc = relRect(C);
      var tx = rc.left + 10, ty = rc.top - A.offsetHeight - 2;
      var canvas = document.querySelector('.grid-canvas');
      var rect = canvas.getBoundingClientRect();
      var l = parseFloat(A.style.left) || 0, t = parseFloat(A.style.top) || 0;
      var startX = rect.left + l + 6, startY = rect.top + t + 6;
      A.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: startX, clientY: startY, bubbles: true, cancelable: true }));
      var cx = rect.left + tx + 6, cy = rect.top + ty + 6;
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
      // v0.2.45.2：rAF 合并后高亮在帧回调里画——--disable-gpu 环境 rAF 慢，
      // 固定 150ms 撞帧相位假红 → 收敛轮询（house 模式同 autosave S3a）
      var hlT0 = Date.now();
      while (Date.now() - hlT0 < 1200 && !document.querySelector('.cell-hl')) { await new Promise(function(r){ setTimeout(r, 50); }); }
      var hlMid = document.querySelectorAll('.cell-hl').length;
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
      // v0.2.45.2：fc-moving 在 mouseup 后下一 rAF 移除——--disable-gpu 环境
      // rAF 慢（帧距实测最高 433ms），固定 400ms 撞帧相位读到 filter:none 假红
      // → 收敛轮询：等 fc-moving 移除且 drop-shadow 栈回填（house 模式同 autosave S3a）；
      // 真回归（filter 永不回填）照样超时读出原值、照红不误。
      var bg = null, bcs = null, line = (${gridLineFn})();
      var stT0 = Date.now();
      while (Date.now() - stT0 < 2000) {
        if (!document.body.classList.contains('fc-moving')) {
          bg = document.querySelector('.grid-group-bg');
          bcs = bg ? getComputedStyle(bg) : null;
          if (bcs && bcs.filter && bcs.filter !== 'none' && bcs.filter.indexOf('drop-shadow') !== -1) break;
        }
        await new Promise(function(r){ setTimeout(r, 50); });
      }
      var sameGroup = A.dataset.groupId && A.dataset.groupId === C.dataset.groupId;
      // v10.28.26 剪影轮：组背景描边=四向 drop-shadow 栈（border 已退役，bbox 边框被 clip 裁）
      var bFilter = bcs ? bcs.filter : '';
      var strokeCount = line ? bFilter.split(line).length - 1 : -1;
      var fcMoving = document.body.classList.contains('fc-moving');
      return { hlMid: hlMid, merged: !!bg && sameGroup, bgImg: bcs ? bcs.backgroundImage : '(no bg)', strokeCount: strokeCount, line: line, fcMoving: fcMoving };
    })()`);
    ok('B5 回归：拖卡过程覆盖高亮仍恰好 1 个 .cell-hl（一体式高亮未受影响）', merged && merged.hlMid === 1);
    ok('B3 合并后组背景卡面：无高光（background-image none）+ 四向 drop-shadow 描边栈=网格线色（--divider-line）',
      !!merged && merged.merged && merged.bgImg === 'none' && merged.strokeCount >= 4 && !!merged.line);
    if (!merged || !merged.merged || merged.bgImg !== 'none' || merged.strokeCount < 4 || !merged.line) console.log('  ℹ B3 诊断:', JSON.stringify(merged));

    // ── B2 深色：data-theme=dark 后边框恰 = rgba(255, 255, 255, 0.08)（用户举例值）且无高光 ──
    // 注意：.grid-card 有 transition: border-color 0.15s——设完主题立即读会撞上过渡中途
    // 的浅→深插值（两次实测 350ms 读到 rgba(245,245,246,0.08)/rgba(197,196,204,0.08)，
    // 都是插值线上不同进度、每次跑还不一样——headless 定时器/全页重算让过渡起跑偏晚，
    // 偶发起跑晚于 1.5s 时 15 拍采样仍不够（v0.2.42.0 轮实测一次 8/9 后连绿）。
    // 解法：轮询最长 30×100ms、读到终值即停（真实浏览器 150ms 就完，此等待通常仍 <1.5s）。
    const b2 = await cdp.evalJs(helpers + `(async function(){
      document.documentElement.setAttribute('data-theme', 'dark');
      await new Promise(function(r){ setTimeout(r, 350); });
      var T = byId('${setup.t}'), S = byId('${setup.s}');
      var bg = document.querySelector('.grid-group-bg');
      var want = 'rgba(255, 255, 255, 0.08)';
      // 诊断：borderColor 每次跑都落在浅→深插值线上不同位置（245,245,246 / 197,196,204）
      // → 疑似读到过渡中途。采样 1.5s 看是否收敛 + 打印真实 transition 参数。
      var samples = [];
      for (var i = 0; i < 30; i++) {
        var bc0 = getComputedStyle(T).borderColor;
        samples.push(bc0);
        if (bc0 === want) break;
        await new Promise(function(r){ setTimeout(r, 100); });
      }
      var tcs = getComputedStyle(T), scs = getComputedStyle(S), bcs = bg ? getComputedStyle(bg) : null;
      // 组背景描边=drop-shadow 栈（v10.28.26 剪影轮）——深色栈里同样要解析出用户举例值
      var pass = tcs.borderColor === want && scs.borderColor === want &&
             tcs.backgroundImage === 'none' && scs.backgroundImage === 'none' && bcs && bcs.backgroundImage === 'none' &&
             bcs.filter.split(want).length - 1 >= 4;
      return { pass: pass, t: tcs.borderColor, s: scs.borderColor, bFilter: bcs ? bcs.filter : '(no bg)', theme: document.documentElement.getAttribute('data-theme'), tImg: tcs.backgroundImage, bImg: bcs ? bcs.backgroundImage : '',
        tDiv: tcs.getPropertyValue('--divider-line'), tCardBc: tcs.getPropertyValue('--card-border-color'),
        bDiv: bcs ? bcs.getPropertyValue('--divider-line') : '', bCardBc: bcs ? bcs.getPropertyValue('--card-border-color') : '',
        tInlineBorder: T.style.border, tInlineBc: T.style.borderColor, tInlineW: T.style.borderWidth,
        tW: tcs.borderWidth, tStyle: tcs.borderStyle, bW: bcs ? bcs.borderWidth : '',
        trDur: tcs.transitionDuration, trProp: tcs.transitionProperty, trDelay: tcs.transitionDelay,
        samples: samples };
    })()`);
    ok('B2 深色模式：边框恰 = rgba(255, 255, 255, 0.08)（用户举例值）——未分组卡+组背景描边栈，且仍无高光',
      b2 && b2.pass);
    if (b2 && !b2.pass) console.log('  ℹ B2 诊断:', JSON.stringify(b2));

    ok('B4 版本徽章：右下角 badge 渲染 FC v10.28.34.2',
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
