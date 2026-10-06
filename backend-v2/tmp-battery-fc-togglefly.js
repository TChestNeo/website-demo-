// tmp-battery-fc-togglefly.js — v10.28.62.0 折叠出画加深+画外停一拍+展开加Q弹电池（本地工作树；52.5 轮改锚）
//   S 静态：site-config 52.5 赋值 ×1/52.4 赋值零残留/站点 58.28 ×1/changelog 头 52.5/52.4/52.3 各 ×1/
//     rev 00377-/00378- 前缀锚各 ×1 + 编辑器锚（52.4/52.5 注释五原话/fine 块右缘 calc 带展开 Q弹/
//     胶囊让位 46px/双动画挂接/位移四站+画外停拍/Q弹五站/展开 Q弹关键帧/40×40 同高/旧锚零残留）
//     位移三站关键帧/Q弹四站关键帧/40×40 同高/旧 52.3 锚零残留（左缘 6px 规则/margin-left 让位/单动画行/
//     38px 让位/32×32）/内联宽度搬出零残留/49.1 :has 规则仍在/52.2 纯白+暗色还原仍在/粗指针基态 266px 口径仍在）；
//   B 编辑器 CDP（桌面细指针）：B1 展开态按钮驻右缘 214px+top 12px 正圆 40×40 纯白+搜索胶囊让位
//     （margin-left 0/左缘 12px/与按钮左缘留 ≥10px 缝）/B2 折叠动画=页内 16ms 采样轨迹
//     （animationName 双名命中+起步右缘 earlyMax>100+出画 min≤-30+回弹过冲 maxAfterMin≥8+
//     先出画后回弹+落定 6px+面板 0+▸）/B3 展开=0.25s 过渡滑回 214px+animationName none/
//     B4 再折叠双动画重触发+B5 搜索过滤功能完好/B6 暗色主题还原 rgb(32,32,56) 零回归（52.2 规则）；
//   E 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PORT = 4800 + Math.floor(Math.random() * 400);
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-batt-togglefly-' + Date.now());
const EDITOR_URL_PATH = '/pages/fluidcanvas-editor.html';
const BASE = 'http://127.0.0.1:' + PORT;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (cond ? '' : (detail ? ' — ' + detail : '')));
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(cdp, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await cdp.evalJs('!!(' + expr + ')')) return true; } catch (e) {}
    await sleep(150);
  }
  throw new Error('waitFor 超时: ' + label);
}

// ── 本地静态服务器 ──
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};
const server = require('http').createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u.indexOf('/api') === 0) { res.writeHead(404); res.end('{"error":"NOT_FOUND"}'); return; }
  if (u === '/' || u === '/dashboard') u = '/index.html';
  let f = path.join(DOCS, u);
  if (!fs.existsSync(f) && !path.extname(f)) { if (fs.existsSync(f + '.html')) f += '.html'; }
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
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
        this.errs.push('EXC:' + JSON.stringify({ text: d.text, url: d.url, line: d.lineNumber }).slice(0, 200));
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        const txt = (m.params.args || []).map(a => a.value || a.description || '').join(' ');
        if (txt.indexOf('Failed to load resource') === -1) this.errs.push('CON:' + txt.slice(0, 200));
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

const SESSION_SCRIPT = 'try{localStorage.setItem("slati_session", ' + JSON.stringify(JSON.stringify({ loggedIn: true })) + ');}catch(e){}';

// ═══ 面板/按钮/胶囊状态读取（DOM 计算样式口径）═══
const PANEL_EXPR = "(function(){ var b = document.querySelector('.asset-panel-toggle');" +
  " var p = document.querySelector('.asset-panel'); var s = document.querySelector('.asset-panel .search-capsule');" +
  " var bs = getComputedStyle(b), ps = getComputedStyle(p);" +
  " var br = b.getBoundingClientRect(), pr = p.getBoundingClientRect(), sr = s.getBoundingClientRect();" +
  " return { left: bs.left, top: bs.top, br: bs.borderRadius, w: bs.width, h: bs.height, bg: bs.backgroundColor," +
  " blur: bs.backdropFilter || 'none', txt: b.textContent.trim(), pw: ps.width," +
  " capL: Math.round(sr.left - pr.left), capW: getComputedStyle(s).width, capML: getComputedStyle(s).marginLeft," +
  " btnL: Math.round(br.left - pr.left) }; })()";
// ═══ 折叠动画页内采样轨迹（16ms 采样 1300ms，动画钟自洽=对采样延迟免疫）═══
const TRACE_EXPR = "new Promise(function(res){" +
  " var b = document.querySelector('.asset-panel-toggle');" +
  " var t = []; var t0 = performance.now();" +
  " var an = getComputedStyle(b).animationName; var ac = b.getAnimations().length;" +
  " var h = setInterval(function(){" +
  "   t.push([performance.now() - t0, parseFloat(getComputedStyle(b).left)]);" +
  "   if (performance.now() - t0 >= 1300) { clearInterval(h); res({ t: t, an: an, ac: ac }); }" +
  " }, 16); })";
const parseColor = (s) => (s || '').replace(/[^\d,.]/g, '').split(',').map(Number);
const near = (a, b, tol) => a && a.length >= 3 && b && b.length >= 3 &&
  Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol;

(async () => {
  server.listen(PORT, '127.0.0.1');

  // ═══ S 静态锚（行计数口径=实测 grep -cF）═══
  console.log('═══ S 静态锚 ═══');
  const edSrc = fs.readFileSync(path.join(DOCS, 'pages/fluidcanvas-editor.html'), 'utf8');
  const edLines = edSrc.split(/\r?\n/);
  const el = (a) => edLines.filter((l) => l.includes(a)).length;
  // 基态三行连续块（border 线+半径行+lowest 背景行）——「border-radius: 50%;」全文件多行命中，块序列独有
  const circleBlock = edSrc.replace(/\r\n/g, '\n').indexOf(
    'border: 1px solid var(--divider-line-strong);\n      border-radius: 50%;\n      background: var(--color-surface-container-lowest);') !== -1;
  const cfgSrc = fs.readFileSync(path.join(DOCS, 'assets/js/site-config.js'), 'utf8');
  const sc = (s) => cfgSrc.split(s).length - 1;
  ok('S1 site-config：FC 52.5 赋值 ×1 + 52.4 赋值零残留 + 站点 58.28 ×1 + changelog 头 52.5/52.4/52.3 各 ×1 + rev 前缀锚各 ×1',
    sc("window.FLUIDCANVAS_VERSION = 'v10.28.62.0';") === 1 &&
    sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.5';") === 0 &&
    sc("window.MN_SITE_VERSION = 'v0.2.58.28';") === 1 &&
    sc('// v10.28.62.0 = ') === 1 && sc('// v10.28.52.5 = ') === 1 && sc('// v10.28.52.4 = ') === 1 &&
    sc('rev 00379-') === 1 && sc('rev 00380-') === 1,
    'fc525=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.62.0';") + ' fc524=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.4';") +
    ' cl525=' + sc('// v10.28.62.0 = ') + ' cl524=' + sc('// v10.28.52.4 = ') + ' cl523=' + sc('// v10.28.52.3 = ') +
    ' r77=' + sc('rev 00377-') + ' r78=' + sc('rev 00378-'));
  ok('S2 编辑器：52.4/52.5 注释原话 + fine 块锚（右缘 calc 带展开 Q弹/胶囊让位 46px/双动画挂接/位移四站/画外停拍/Q弹五站/展开 Q弹关键帧/40×40 同高）+ 旧锚零残留（52.4 浅出画 -40px/58% 拉长站/左缘 6px 规则/margin-left 让位/单动画行/38px 让位/32×32）+ 内联宽度搬出零残留',
    el('我希望那个圆形是在右侧的') === 1 &&
    el('然后那个按钮回弹的时候能不能有一个Q弹') === 1 &&
    el('还有那个按钮的大小能不能和搜索栏一样') === 1 &&
    el('为什么他没有短暂的滑出画面外') === 1 &&
    el('在展开的时候按钮能不能也附加上Q弹效果') === 2 &&
    el('v10.28.62.0 — 边缘 Mask（用户：边缘像 Alight Motion 的 Mask 一样') === 1 &&
    el('v10.28.52.5: 折叠出画加深+画外停一拍+展开加 Q弹') === 1 &&
    el('.asset-panel-toggle { left: calc(var(--asset-panel-w) - 46px); top: 12px; animation: fcToggleInQSquash 0.28s; }') === 1 &&
    el('.asset-panel .search-capsule { width: calc(100% - 46px); }') === 1 &&
    el('.asset-panel .search-capsule { width: 100%; }') === 1 &&
    el('animation: fcToggleOutSpring 0.9s, fcToggleQSquash 0.9s;') === 1 &&
    el('@keyframes fcToggleOutSpring {') === 1 &&
    el('0%   { left: calc(var(--asset-panel-w) - 46px);  animation-timing-function: cubic-bezier(0.5, 0, 1, 0.6); }') === 1 &&
    el('28%  { left: -80px; animation-timing-function: linear; }') === 1 &&
    el('50%  { left: -80px; animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }') === 1 &&
    el('100% { left: 6px; }') === 1 &&
    el('@keyframes fcToggleQSquash {') === 1 &&
    el('28%  { transform: scale(0.85, 0.85); animation-timing-function: linear; }') === 1 &&
    el('50%  { transform: scale(0.85, 0.85); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }') === 1 &&
    el('70%  { transform: scale(1.35, 0.65); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }') === 1 &&
    el('100% { transform: scale(1, 1); }') === 2 &&
    el('@keyframes fcToggleInQSquash {') === 1 &&
    el('45%  { transform: scale(1.3, 0.7); animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }') === 1 &&
    el('75%  { transform: scale(0.9, 1.1); }') === 1 &&
    el('width: 40px; height: 40px; /* 52.4') === 1 &&
    el('left: -40px') === 0 &&
    el('58%  { transform: scale(1.35, 0.65)') === 0 &&
    el('.asset-panel-toggle { left: 6px; top: 16px; }') === 0 &&
    el('width: calc(100% - 38px); margin-left: 38px;') === 0 &&
    el('.asset-panel-toggle { left: calc(var(--asset-panel-w) - 38px); top: 16px; }') === 0 &&
    el('width: calc(100% - 38px); }') === 0 &&
    el('animation: fcToggleOutSpring 0.9s;') === 0 &&
    el('width: 32px; height: 32px;') === 0 &&
    el('search-capsule" style="margin-bottom:var(--space-sm)"') === 1 &&
    el('style="width:100%;margin-bottom:var(--space-sm)"') === 0,
    JSON.stringify({
      q1: el('我希望那个圆形是在右侧的'), q2: el('然后那个按钮回弹的时候能不能有一个Q弹'), q3: el('还有那个按钮的大小能不能和搜索栏一样'),
      q4: el('为什么他没有短暂的滑出画面外'), q5: el('在展开的时候按钮能不能也附加上Q弹效果'),
      head53: el('v10.28.62.0 — 边缘 Mask（用户：边缘像 Alight Motion 的 Mask 一样'), head52: el('v10.28.52.5: 折叠出画加深+画外停一拍+展开加 Q弹'),
      rest: el('.asset-panel-toggle { left: calc(var(--asset-panel-w) - 46px); top: 12px; animation: fcToggleInQSquash 0.28s; }'),
      give: el('.asset-panel .search-capsule { width: calc(100% - 46px); }'), base: el('.asset-panel .search-capsule { width: 100%; }'),
      anim: el('animation: fcToggleOutSpring 0.9s, fcToggleQSquash 0.9s;'), kf: el('@keyframes fcToggleOutSpring {'),
      qkf: el('@keyframes fcToggleQSquash {'), inq: el('@keyframes fcToggleInQSquash {'), s1: el('100% { transform: scale(1, 1); }'),
      size: el('width: 40px; height: 40px; /* 52.4'), oldFly: el('left: -40px'), oldStretch: el('58%  { transform: scale(1.35, 0.65)'),
      oldRest: el('.asset-panel-toggle { left: 6px; top: 16px; }'),
      oldGive: el('width: calc(100% - 38px); margin-left: 38px;'), oldRest2: el('.asset-panel-toggle { left: calc(var(--asset-panel-w) - 38px); top: 16px; }'),
      oldGive2: el('width: calc(100% - 38px); }'), oldAnim: el('animation: fcToggleOutSpring 0.9s;'),
      oldSize: el('width: 32px; height: 32px;'), inl: el('search-capsule" style="margin-bottom:var(--space-sm)"')
    }));
  ok('S3 编辑器：旧轮锚全保留（49.1 :has 折叠态/49.2 正圆 50%/52.2 纯白+暗色还原/粗指针基态 266px 口径）',
    el('.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle { left: 6px; }') === 1 &&
    circleBlock &&
    el('background: var(--color-surface-container-lowest); /* 52.2 纯白不透明 */') === 1 &&
    el(':root[data-theme="dark"] .asset-panel-toggle,') === 1 &&
    el('left: calc(var(--asset-panel-w) + 6px)') === 1 &&
    el('transition: left 0.25s;') === 1,
    JSON.stringify({
      has: el('.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle { left: 6px; }'),
      circ: circleBlock ? 1 : 0, white: el('background: var(--color-surface-container-lowest); /* 52.2 纯白不透明 */'),
      dark: el(':root[data-theme="dark"] .asset-panel-toggle,'), base: el('left: calc(var(--asset-panel-w) + 6px)'),
      trans: el('transition: left 0.25s;')
    }));

  // ═══ B 编辑器 CDP（桌面细指针）═══
  console.log('═══ B 编辑器 CDP ═══');
  let chromePath = null;
  (['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
  ]).forEach((p) => { if (!chromePath && fs.existsSync(p)) chromePath = p; });
  const chrome = spawn(chromePath, [
    '--headless=new', '--lang=zh-CN', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,900', '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + USER_DATA, 'about:blank'
  ], { stdio: 'ignore' });
  let cdp = null;
  try {
    let up = false;
    for (let i = 0; i < 80; i++) {
      try { const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version'); if (r.ok) { up = true; break; } } catch (e) {}
      await sleep(250);
    }
    if (!up) throw new Error('Chrome CDP 未就绪');
    const pages = await (await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list')).json();
    const page = pages.find(x => x.type === 'page');
    cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: SESSION_SCRIPT });
    await cdp.send('Page.setDownloadBehavior', { behavior: 'deny' });
    await cdp.send('Page.navigate', { url: BASE + EDITOR_URL_PATH });
    await waitFor(cdp, "document.getElementById('undoBtn') && document.getElementById('gridCanvas') && window.toggleAssetPanel", 40000, '编辑器就绪');
    await sleep(900);

    // ═══ B1 展开态：按钮驻搜索菜单右侧 40×40 同高 + 胶囊让位 ═══
    {
      const f = await cdp.evalJs(PANEL_EXPR);
      ok('B1 展开态：按钮 left 214px/top 12px 正圆 40×40（=搜索胶囊同高）纯白 rgb(255,255,255)+blur 摘除/◂/面板 260px',
        f.left === '214px' && f.top === '12px' && f.br === '50%' && f.w === '40px' && f.h === '40px' &&
        near(parseColor(f.bg), [255, 255, 255], 0) && f.blur === 'none' && f.txt === '◂' && f.pw === '260px',
        JSON.stringify(f));
      ok('B1b 搜索胶囊让位：左缘 12px（=面板内边距）/margin-left 0/宽 180~200px（244-46-滚动条 6）/按钮左缘 214 留 ≥10px 缝',
        f.capL === 12 && f.capML === '0px' && parseFloat(f.capW) >= 180 && parseFloat(f.capW) <= 200 &&
        f.btnL === 214 && (f.btnL - f.capL - parseFloat(f.capW)) >= 10,
        'capL=' + f.capL + ' capML=' + f.capML + ' capW=' + f.capW + ' btnL=' + f.btnL);
    }

    // ═══ B2 点击折叠：出画→回弹轨迹（页内 16ms 采样 1300ms）═══
    {
      await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
      const tr = await cdp.evalJs(TRACE_EXPR);
      const xs = (tr && tr.t) ? tr.t.map((p) => p[1]) : [];
      const earlyMax = xs.length ? Math.max.apply(null, xs.slice(0, 12)) : NaN;
      const min = xs.length ? Math.min.apply(null, xs) : NaN;
      const final = xs.length ? xs[xs.length - 1] : NaN;
      const minIdx = xs.indexOf(min);
      const after = xs.slice(minIdx);
      const maxAfterMin = Math.max.apply(null, after);
      const maxAfterMinIdx = minIdx + after.indexOf(maxAfterMin);
      const f = await cdp.evalJs(PANEL_EXPR);
      ok('B2a 折叠双动画命中：animationName 含 fcToggleOutSpring+fcToggleQSquash + getAnimations≥2 + 轨迹 ≥60 采样 + 起步右缘（前 12 采样最大 >100）',
        tr && tr.an && tr.an.indexOf('fcToggleOutSpring') !== -1 && tr.an.indexOf('fcToggleQSquash') !== -1 &&
        tr.ac >= 2 && xs.length >= 60 && earlyMax > 100,
        JSON.stringify({ an: tr && tr.an, ac: tr && tr.ac, n: xs.length, earlyMax }));
      const dwell = xs.filter((x) => x <= -75).length;
      ok('B2b 出画：轨迹最低 ≤ -70（深出画 -80px）+ 画外停拍 ≥8 采样（left≤-75）+ 回弹过冲最高 ≥ 8 + 先出画后回弹（min 先于 maxAfterMin）',
        min <= -70 && dwell >= 8 && maxAfterMin >= 8 && minIdx < maxAfterMinIdx,
        JSON.stringify({ min, dwell, maxAfterMin, minIdx, maxAfterMinIdx }));
      ok('B2c 落定：终采样 left 6px + 面板宽 0 + 按钮仍纯白 + ▸',
        final === 6 && f.pw === '0px' && near(parseColor(f.bg), [255, 255, 255], 0) && f.txt === '▸',
        JSON.stringify({ final, pw: f.pw, txt: f.txt }));
    }

    // ═══ B3 点击展开：0.25s 过渡滑回右缘 214px + 展开 Q弹命中 ═══
    {
      await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
      await sleep(1400);
      const f = await cdp.evalJs(PANEL_EXPR);
      const an = await cdp.evalJs("getComputedStyle(document.querySelector('.asset-panel-toggle')).animationName");
      ok('B3 展开回来：按钮 left 214px/◂/面板 260px + animationName 含 fcToggleInQSquash（展开=0.25s 过渡滑回右缘+52.5 展开 Q弹）',
        f.left === '214px' && f.txt === '◂' && f.pw === '260px' && an && an.indexOf('fcToggleInQSquash') !== -1, JSON.stringify({ f, an }));
    }

    // ═══ B4 再折叠：双动画重触发（类重挂即重放）═══
    {
      await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
      const an = await cdp.evalJs("getComputedStyle(document.querySelector('.asset-panel-toggle')).animationName");
      const ac = await cdp.evalJs("document.querySelector('.asset-panel-toggle').getAnimations().length");
      await sleep(1400);
      const f = await cdp.evalJs(PANEL_EXPR);
      ok('B4 再折叠：双动画重触发（双名命中+getAnimations≥2）→ 落定 6px',
        an && an.indexOf('fcToggleOutSpring') !== -1 && an.indexOf('fcToggleQSquash') !== -1 && ac >= 2 && f.left === '6px',
        JSON.stringify({ an, ac, left: f.left }));
    }

    // ═══ B5 搜索过滤功能完好（胶囊回贴后仍可用）═══
    {
      await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
      await sleep(1400);
      const g = await cdp.evalJs("(function(){ var inp = document.querySelector('.asset-panel .search-capsule input');" +
        " inp.value = 'flag'; inp.dispatchEvent(new Event('input', { bubbles: true }));" +
        " var vis = []; document.querySelectorAll('.asset-panel .grid-card, .asset-panel .card').forEach(function(c){" +
        "   if (getComputedStyle(c).display !== 'none') vis.push(c.getAttribute('data-label') || c.textContent.trim().slice(0, 20)); });" +
        " return { ok: !!inp, vis: vis }; })()");
      ok('B5 搜索过滤：输入 flag 过滤生效（可见卡 ≤3 张且含 National Flag 或零卡）',
        g && g.ok && g.vis.length <= 3 && (g.vis.length === 0 || g.vis.join(',').indexOf('National Flag') !== -1),
        JSON.stringify(g));
    }

    // ═══ B6 暗色主题：52.2 还原规则零回归 ═══
    {
      await cdp.evalJs("document.documentElement.setAttribute('data-theme', 'dark')");
      await sleep(400);
      const f = await cdp.evalJs(PANEL_EXPR);
      await cdp.evalJs("document.documentElement.removeAttribute('data-theme')");
      await sleep(400);
      const f2 = await cdp.evalJs(PANEL_EXPR);
      ok('B6 暗色主题：按钮还原 rgb(32,32,56) 实心 → 回亮色纯白恢复（52.2 规则在新位置零回归）',
        near(parseColor(f.bg), [32, 32, 56], 0) && f.left === '214px' &&
        near(parseColor(f2.bg), [255, 255, 255], 0) && f2.left === '214px',
        JSON.stringify({ dark: f.bg, light: f2.bg }));
    }

    // ═══ E 零异常 ═══
    {
      const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
      const realErrs = cdp.errs.filter(e => !noise.test(e));
      ok('E 零异常（Runtime exception + 控制台 error 全滤噪声后）', realErrs.length === 0,
        realErrs.slice(0, 3).join(' | '));
    }
    cdp.close();
  } catch (e) {
    console.error('💥 ' + (e.stack || e.message));
    fail++;
    try { cdp && cdp.close(); } catch (e2) {}
  }
  try { require('child_process').spawnSync('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  try { server.close(); } catch (e) {}

  console.log('\n═══ ' + (fail === 0 ? 'ALL GREEN' : 'FAILED') + ' — ' + pass + '/' + (pass + fail) + ' ═══');
  (() => { for (let _i = 0; _i < 15; _i++) { try { fs.rmSync(USER_DATA, { recursive: true, force: true }); break; } catch (e) { const _t = Date.now(); while (Date.now() - _t < 200) {} } } })();
  process.exit(fail === 0 ? 0 : 1);
})();
