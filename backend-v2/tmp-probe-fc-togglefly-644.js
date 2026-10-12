// tmp-probe-fc-togglefly-644.js — FC v10.28.52.3 折叠按钮搬搜索菜单左侧+折叠出画回弹线上探针（mnationworld.com）
//   S1a site-config live：52.3 赋值 ×1 + 52.2 赋值零残留 + 站点 58.28 ×1 + changelog 头 52.3/52.2 各 ×1；
//   S1b rev live 口径：rev 00373-真值 ×1 + 00373-XXX 零残留 + 00374-??? 占位 ×1 + 00374-终态零残留
//      （live 滞后一部署=惯例：工作树已填 00374-终态，live 仍二次烘焙镜像）；
//   S1c 编辑器 live 9 锚（52.3 注释头/fine 左缘 6px top 16px/胶囊让位 calc/动画挂接/关键帧头/出画 -40px/
//      49.1 :has 折叠规则/52.2 纯白锚/暗色还原规则）；
//   S2 API：health 200 + tables:66（本轮零迁移）；S3 fc/edges 匿名公开 200（回归）；
//   P1 CDP 编辑器（假会话）：P1a 展开态按钮驻搜索菜单左侧 6px+top 16px+正圆+纯白（52.2 回归）→
//     P1b 点击折叠 live 出画回弹轨迹（页内 16ms 采样 1300ms：animationName 命中+样本 ≥60+早期起步+min ≤ -30
//     出画+max ≥ 8 过冲+顺序 minIdx<maxIdx+终态落定 6px）→ P1c 点击展开→驻原地 6px+animationName none →
//     P1d 再折叠再出画回弹（重触发）+面板宽 0 → E1 零异常。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

const REAL73 = '00373-q4k'; // deploy#1 实得 rev（填）
const REAL74 = '00374-5cz'; // deploy#2 实得 rev（live 断言=零残留）
const SITE = 'https://mnationworld.com';
const ED = SITE + '/pages/fluidcanvas-editor.html';
const CDP_PORT = 5900 + Math.floor(Math.random() * 90);
const USER_DATA = path.join(os.tmpdir(), 'mn-cdp-probe-fc644-' + Date.now());
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
const hget = (url, opts) => new Promise((resolve) => {
  opts = opts || {};
  const req = https.request(url, Object.assign({ method: opts.method || 'GET', headers: Object.assign({}, opts.headers), timeout: 25000 }), (res) => {
    let body = '';
    res.on('data', (c) => { body += c; if (body.length > 12000000) req.destroy(); });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  if (opts.body) req.write(opts.body);
  req.on('error', (e) => resolve({ status: 0, error: String(e && e.message || e) }));
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.end();
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

const SESSION_SCRIPT = 'try{(function(){ localStorage.setItem("slati_session", "{\\"loggedIn\\":true}");' +
  ' localStorage.setItem("slati_user", JSON.stringify({ id: "USR-000101", displayName: "探针用户", tier: "premium" }));' +
  ' localStorage.setItem("slati_lang", "zh-CN"); })();}catch(e){}';
const FACE_EXPR = "(function(){ var t = document.querySelector('.asset-panel-toggle');" +
  " var c = document.querySelector('.asset-panel .search-capsule'); var ts = getComputedStyle(t);" +
  " return { tl: ts.left, tt: ts.top, tw: ts.width, th: ts.height, br: ts.borderRadius," +
  " tb: ts.backgroundColor, tblur: ts.backdropFilter || 'none', txt: t.textContent.trim()," +
  " pw: getComputedStyle(document.querySelector('.asset-panel')).width," +
  " capL: c ? getComputedStyle(c).marginLeft : null }; })()";
// 页内 16ms 采样 1300ms：对 CDP 往返延迟免疫（动画钟电池法——照 togglefly 电池原版裸 Promise）
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
const isOpaque = (s) => !/rgba\(/.test(s) || (parseColor(s).length === 4 && parseColor(s)[3] >= 0.999);

(async () => {
  // ═══ S1 静态（live 文本口径）═══
  console.log('═══ S1 静态（live）═══');
  const sc = await hget(SITE + '/assets/js/site-config.js');
  const ed = await hget(ED);
  const scS = sc.body;
  const scC = (s) => scS.split(s).length - 1;
  ok('S1a site-config：52.3 赋值 ×1 + 52.2 赋值零残留 + 站点 58.28 ×1 + changelog 头 52.3/52.2 各 ×1',
    scC("window.FLUIDCANVAS_VERSION = 'v10.28.52.3';") === 1 && scC("window.FLUIDCANVAS_VERSION = 'v10.28.52.2';") === 0 &&
    scC("window.MN_SITE_VERSION = 'v0.2.58.28';") === 1 &&
    scC('// v10.28.52.3 = ') === 1 && scC('// v10.28.52.2 = ') === 1,
    'fc523=' + scC("window.FLUIDCANVAS_VERSION = 'v10.28.52.3';") + ' fc522=' + scC("window.FLUIDCANVAS_VERSION = 'v10.28.52.2';") +
    ' cl523=' + scC('// v10.28.52.3 = ') + ' cl522=' + scC('// v10.28.52.2 = '));
  ok('S1b rev live 口径：rev ' + REAL73 + ' ×1 + 00373-XXX 零残留 + 00374-??? 占位 ×1 + ' + REAL74 + ' 零残留（live 滞后一部署）',
    scC(REAL73) === 1 && scC('00373-XXX') === 0 && scC('00374-???') === 1 && scC(REAL74) === 0,
    'r73=' + scC(REAL73) + ' p73=' + scC('00373-XXX') + ' p74=' + scC('00374-???') + ' r74=' + scC(REAL74));
  const ebad = [];
  const eanchors = [
    ['52.3 注释头', 'v10.28.52.3: 折叠按钮搬搜索菜单左侧', 1],
    ['fine 左缘 6px top 16px', '.asset-panel-toggle { left: 6px; top: 16px; }', 1],
    ['胶囊让位 calc', 'width: calc(100% - 38px); margin-left: 38px;', 1],
    ['动画挂接', 'animation: fcToggleOutSpring 0.9s;', 1],
    ['关键帧头', '@keyframes fcToggleOutSpring {', 1],
    ['出画 -40px', '30%  { left: -40px; animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1); }', 1],
    ['49.1 :has 折叠规则', '.canvas-body:has(.asset-panel.collapsed) .asset-panel-toggle { left: 6px; }', 1],
    ['52.2 纯白锚', 'background: var(--color-surface-container-lowest); /* 52.2 纯白不透明 */', 1],
    ['暗色还原规则', ':root[data-theme="dark"] .asset-panel-toggle,', 1]
  ];
  eanchors.forEach(([n, s, want]) => { if (ed.body.split(s).length - 1 !== want) ebad.push(n + '=' + (ed.body.split(s).length - 1)); });
  ok('S1c 编辑器 live 9 锚全中（52.3 六件+49.1 :has/52.2 纯白/暗色还原回归）', ebad.length === 0, ebad.join(','));

  console.log('═══ S2 API（匿名口径）═══');
  const health = await hget(SITE + '/api/health');
  let healthJson = null; try { healthJson = JSON.parse(health.body); } catch (e) {}
  ok('S2 /api/health 200 + tables:66（本轮零迁移）', health.status === 200 && healthJson && healthJson.status === 'ok' && healthJson.tables === 66,
    'status=' + health.status + ' tables=' + (healthJson && healthJson.tables));

  console.log('═══ S3 匿名回归 ═══');
  const edges = await hget(SITE + '/api/fc/edges');
  ok('S3 fc/edges 匿名公开 200（回归）', edges.status === 200, 'status=' + edges.status);

  // ═══ P1 CDP 编辑器（假会话）═══
  console.log('═══ P1 CDP（假会话）═══');
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
    await cdp.send('Page.navigate', { url: ED });
    await waitFor(cdp, "document.getElementById('gridCanvas') && document.querySelector('.asset-panel-toggle')", 40000, 'P1 编辑器就绪');
    await sleep(900);

    // P1a 展开态：按钮驻搜索菜单左侧 6px + top 16px + 正圆 + 纯白（52.2 回归）
    const f = await cdp.evalJs(FACE_EXPR);
    ok('P1a 展开态 live：按钮 left 6px+top 16px+正圆 32×32+纯白 rgb(255,255,255) 不透明（52.2 回归）',
      f && f.tl === '6px' && f.tt === '16px' && f.tw === '32px' && f.th === '32px' && f.br === '50%' &&
      near(parseColor(f.tb), [255, 255, 255], 0) && isOpaque(f.tb) && f.tblur === 'none' && f.txt === '◂' && f.pw === '260px',
      JSON.stringify(f));

    // P1b 点击折叠：页内 16ms 采样 live 出画回弹轨迹
    await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
    const tr = await cdp.evalJs(TRACE_EXPR);
    const tt = tr.t || [];
    const xs = tt.map((p) => p[1]);
    const mn = Math.min.apply(null, xs), mx = Math.max.apply(null, xs);
    const mnIdx = xs.indexOf(mn), mxIdx = xs.indexOf(mx);
    const earlyMin = Math.min.apply(null, xs.slice(0, 12));
    const anHit = tr.an === 'fcToggleOutSpring' ? 1 : 0;
    const final = xs[xs.length - 1];
    ok('P1b 折叠 live 出画回弹轨迹：animationName ' + tr.an + ' 命中+动画数 ≥1+样本 ' + xs.length + ' ≥60+早期起步 ' + earlyMin + ' <5.5+min ' + mn + ' ≤ -30 出画+max ' + mx + ' ≥ 8 过冲+顺序 minIdx(' + mnIdx + ')<maxIdx(' + mxIdx + ')+终态落定 6px',
      anHit >= 1 && tr.ac >= 1 && xs.length >= 60 && earlyMin < 5.5 && mn <= -30 && mx >= 8 && mnIdx < mxIdx && final === 6,
      JSON.stringify({ n: xs.length, min: mn, max: mx, minIdx: mnIdx, maxIdx: mxIdx, final: final, an: tr.an, ac: tr.ac }));

    // P1c 点击展开：驻原地 6px + animationName none
    await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
    await sleep(1400);
    const fe = await cdp.evalJs(FACE_EXPR);
    const anE = await cdp.evalJs("getComputedStyle(document.querySelector('.asset-panel-toggle')).animationName");
    ok('P1c 展开 live：按钮驻原地 6px + animationName none（展开不动=钦定）',
      fe && fe.tl === '6px' && fe.pw === '260px' && fe.txt === '◂' && anE === 'none', JSON.stringify(Object.assign({ an: anE }, fe)));

    // P1d 再折叠：再出画回弹（重触发）+ 面板宽 0
    await cdp.evalJs("document.querySelector('.asset-panel-toggle').click()");
    const tr2 = await cdp.evalJs(TRACE_EXPR);
    const tt2 = tr2.t || [];
    const xs2 = tt2.map((p) => p[1]);
    const mn2 = Math.min.apply(null, xs2), mx2 = Math.max.apply(null, xs2);
    const anHit2 = tr2.an === 'fcToggleOutSpring' ? 1 : 0;
    const f2 = await cdp.evalJs(FACE_EXPR);
    ok('P1d 再折叠 live：重触发轨迹（an ' + tr2.an + '+min ' + mn2 + ' ≤ -30+max ' + mx2 + ' ≥ 8+动画数 ≥1）+终态按钮 6px+面板宽 0+▸',
      anHit2 >= 1 && tr2.ac >= 1 && mn2 <= -30 && mx2 >= 8 && f2 && f2.tl === '6px' && f2.pw === '0px' && f2.txt === '▸',
      JSON.stringify({ n: xs2.length, min: mn2, max: mx2, an: tr2.an, ac: tr2.ac, face: f2 }));

    // E1 零异常
    const noise = /favicon|fonts\.googleapis|fonts\.gstatic|^data:|slati_entrance|analytics|pageview/i;
    const realErrs = cdp.errs.filter(e => !noise.test(e));
    ok('E1 零异常（实际 ' + realErrs.length + ' 条）', realErrs.length === 0, realErrs.join(' | '));
  } catch (e) {
    console.log('  💥 ' + (e && e.message || e));
    fail++;
  } finally {
    try { cdp && cdp.close(); } catch (e) {}
    chrome.kill();
  }
  console.log('🎉 ' + pass + ' ✅ / ' + fail + ' ❌');
  process.exit(fail ? 1 : 0);
})();
