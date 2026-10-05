// tmp-battery-fc-togglefly.js — v10.28.52.3 折叠按钮搬搜索菜单左侧+折叠出画回弹电池（本地工作树）
//   S 静态：site-config 52.3 赋值 ×1/52.2 赋值零残留/站点 58.28 ×1/changelog 头 52.3/52.2 各 ×1/
//     rev 00373-/00374- 前缀锚各 ×1 + 编辑器锚（52.3 注释原话/fine 块六锚/搜索胶囊让位/
//     内联宽度搬出零残留/49.1 :has 规则仍在/52.2 纯白+暗色还原仍在/粗指针基态 266px 口径仍在）；
//   B 编辑器 CDP（桌面细指针）：B1 展开态按钮驻左缘 6px+top 16px 正圆 32×32 纯白+搜索胶囊让位
//     （margin-left 38px/宽 206px/与按钮右缘留 ≥10px 缝）/B2 折叠动画=页内 16ms 采样轨迹
//     （animationName 命中+出画 min≤-30+回弹过冲 max≥8+先出画后回弹+落定 6px+面板 0+▸）/
//     B3 展开回来 6px+◂+animationName none/B4 再折叠重触发动画+B5 搜索过滤功能完好/
//     B6 暗色主题还原 rgb(32,32,56) 零回归（52.2 规则）；
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
  " capL: Math.round(sr.left - pr.left), capW: getComputedStyle(s).width," +
  " btnR: Math.round(br.right - pr.left) }; })()";
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
  const cfgSrc = fs.readFileSync(path.join(DOCS, 'assets/js/site-config.js'), 'utf8');
  const sc = (s) => cfgSrc.split(s).length - 1;
  ok('S1 site-config：FC 52.3 赋值 ×1 + 52.2 赋值零残留 + 站点 58.28 ×1 + changelog 头 52.3/52.2 各 ×1 + rev 前缀锚各 ×1',
    sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.3';") === 1 &&
    sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.2';") === 0 &&
    sc("window.MN_SITE_VERSION = 'v0.2.58.28';") === 1 &&
    sc('// v10.28.52.3 = ') === 1 && sc('// v10.28.52.2 = ') === 1 &&
    sc('rev 00373-') === 1 && sc('rev 00374-') === 1,
    'fc523=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.3';") + ' fc522=' + sc("window.FLUIDCANVAS_VERSION = 'v10.28.52.2';") +
    ' cl523=' + sc('// v10.28.52.3 = ') + ' cl522=' + sc('// v10.28.52.2 = ') +
    ' r73=' + sc('rev 00373-') + ' r74=' + sc('rev 00374-'));
  ok('S2 编辑器：52.3 注释原话 + fine 块六锚（左缘 6px/top 16px/胶囊让位/动画挂接/关键帧/过冲曲线）+ 内联宽度搬出零残留',
    el('变成是放在搜索菜单左侧那边再多出一个圆形') === 1 &&
    el('v10.28.52.3: 折叠按钮搬搜索菜单左侧') === 1 &&
    el('.asset-panel-toggle { left: 6px; top: 16px; }') === 1 &&
    el('.asset-panel .search-capsule { width: 100%; }') === 1 &&
    el('width: calc(100% - 38px); margin-left: 38px;') === 1 &&
    el('animation: fcToggleOutSpring 0.9s;') === 1 &&
    el('@keyframes fcToggleOutSpring {') === 1 &&
    el('30%  { left: -40px; animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }') === 1 &&
    el('search-capsule" style="margin-bottom:var(--space-sm)"') === 1 &&
    el('style="width:100%;margin-bottom:var(--space-sm)"') === 0,
    JSON.stringify({
      quote: el('变成是放在搜索菜单左侧那边再多出一个圆形'), head: el('v10.28.52.3: 折叠按钮搬搜索菜单左侧'),
      rest: el('.asset-panel-toggle { left: 6px; top: 16px; }'), base: el('.asset-panel .search-capsule { width: 100%; }'),
      give: el('width: calc(100% - 38px); margin-left: 38px;'), anim: el('animation: fcToggleOutSpring 0.9s;'),
      kf: el('@keyframes fcToggleOutSpring {'), bez: el('30%  { left: -40px; animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }'),
      inl: el('search-capsule" style="margin-bottom:var(--space-sm)"'), old: el('style="width:100%;margin-bottom:var(--space-sm)"')
    }));
  ok('S3 编辑器：旧轮锚全保留（49.1 :has 折叠态/49.2 正圆尺寸/52.2 纯白+暗色还原/粗指针基态 266px 口径）',
    el('.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle { left: 6px; }') === 1 &&
    el('width: 32px; height: 32px;') === 1 &&
    el('background: var(--color-surface-container-lowest); /* 52.2 纯白不透明 */') === 1 &&
    el(':root[data-theme="dark"] .asset-panel-toggle,') === 1 &&
    el('left: calc(var(--asset-panel-w) + 6px)') === 1 &&
    el('transition: left 0.25s;') === 1,
    JSON.stringify({
      has: el('.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle { left: 6px; }'),
      size: el('width: 32px; height: 32px;'), white: el('background: var(--color-surface-container-lowest); /* 52.2 纯白不透明 */'),
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

    // ═══ B1 展开态：按钮驻搜索菜单左侧 + 胶囊让位 ═══
    {
      const f = await cdp.evalJs(PANEL_EXPR);
      ok('B1 展开态：按钮 left 6px/top 16px 正圆 32×32 纯白 rgb(255,255,255)+blur 摘除/◂/面板 260px',
        f.left === '6px' && f.top === '16px' && f.br === '50%' && f.w === '32px' && f.h === '32px' &&
        near(parseColor(f.bg), [255, 255, 255], 0) && f.blur === 'none' && f.txt === '◂' && f.pw === '260px',
        JSON.stringify(f));
      ok('B1b 搜索胶囊让位：左缘 50px（=面板内边距 12+margin-left 38）/宽 185~210px（244-38-滚动条 6）/按钮右缘 38 留 ≥10px 缝',
        f.capL === 50 && parseFloat(f.capW) >= 185 && parseFloat(f.capW) <= 210 && f.btnR === 38 && (f.capL - f.btnR) >= 10,
        'capL=' + f.capL + ' capW=' + f.capW + ' btnR=' + f.btnR);
    }

    // ═══ B2 点击折叠：出画→回弹轨迹（页内 16ms 采样 1300ms）═══
    {
      await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
      const tr = await cdp.evalJs(TRACE_EXPR);
      const xs = (tr && tr.t) ? tr.t.map((p) => p[1]) : [];
      const first = xs.length ? xs[0] : NaN;
      const earlyMin = xs.length ? Math.min.apply(null, xs.slice(0, 12)) : NaN;
      const min = xs.length ? Math.min.apply(null, xs) : NaN;
      const max = xs.length ? Math.max.apply(null, xs) : NaN;
      const final = xs.length ? xs[xs.length - 1] : NaN;
      const minIdx = xs.indexOf(min), maxIdx = xs.indexOf(max);
      const f = await cdp.evalJs(PANEL_EXPR);
      ok('B2a 折叠动画命中：animationName=fcToggleOutSpring + getAnimations≥1 + 轨迹 ≥60 采样 + 前 12 采样内已起步（<5.5）',
        tr && tr.an === 'fcToggleOutSpring' && tr.ac >= 1 && xs.length >= 60 && earlyMin < 5.5,
        JSON.stringify({ an: tr && tr.an, ac: tr && tr.ac, n: xs.length, earlyMin }));
      ok('B2b 出画：轨迹最低 ≤ -30（右缘出画面外）+ 回弹过冲最高 ≥ 8 + 先出画后回弹（min 先于 max）',
        min <= -30 && max >= 8 && minIdx < maxIdx,
        JSON.stringify({ min, max, minIdx, maxIdx }));
      ok('B2c 落定：终采样 left 6px + 面板宽 0 + 按钮仍纯白 + ▸',
        final === 6 && f.pw === '0px' && near(parseColor(f.bg), [255, 255, 255], 0) && f.txt === '▸',
        JSON.stringify({ final, pw: f.pw, txt: f.txt }));
    }

    // ═══ B3 点击展开：按钮驻原地（不跑动画）═══
    {
      await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
      await sleep(1400);
      const f = await cdp.evalJs(PANEL_EXPR);
      const an = await cdp.evalJs("getComputedStyle(document.querySelector('.asset-panel-toggle')).animationName");
      ok('B3 展开回来：按钮仍 left 6px/◂/面板 260px + animationName none（展开态恒驻原地）',
        f.left === '6px' && f.txt === '◂' && f.pw === '260px' && an === 'none', JSON.stringify({ f, an }));
    }

    // ═══ B4 再折叠：动画重触发（类重挂即重放）═══
    {
      await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
      const an = await cdp.evalJs("getComputedStyle(document.querySelector('.asset-panel-toggle')).animationName");
      const ac = await cdp.evalJs("document.querySelector('.asset-panel-toggle').getAnimations().length");
      await sleep(1400);
      const f = await cdp.evalJs(PANEL_EXPR);
      ok('B4 再折叠：动画重触发（animationName 命中+getAnimations≥1）→ 落定 6px',
        an === 'fcToggleOutSpring' && ac >= 1 && f.left === '6px',
        JSON.stringify({ an, ac, left: f.left }));
    }

    // ═══ B5 搜索过滤功能完好（胶囊让位后仍可用）═══
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
        near(parseColor(f.bg), [32, 32, 56], 0) && f.left === '6px' &&
        near(parseColor(f2.bg), [255, 255, 255], 0) && f2.left === '6px',
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
  try { spawn('taskkill', ['/T', '/F', '/PID', String(chrome.pid)], { stdio: 'ignore' }); } catch (e) {}
  try { server.close(); } catch (e) {}

  console.log('\n═══ ' + (fail === 0 ? 'ALL GREEN' : 'FAILED') + ' — ' + pass + '/' + (pass + fail) + ' ═══');
  process.exit(fail === 0 ? 0 : 1);
})();
